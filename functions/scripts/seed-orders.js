// Seed purchase orders test data for a vessel.
// Usage: npm run seed:orders -- 1234567
//
// Writes 5 orders per department (bridge/engine/deck/accommodation/galley/medical)
// into safety_vessels/<IMO>/purchase_orders with varying statuses and completion.
// Existing orders are left untouched (upsert by id).

const admin = require('firebase-admin');

const PROJECT = 'marine-safety-manager';
const ROOT = 'safety_vessels';

const args = process.argv.slice(2);
const IMO = args[0];
if (!IMO) { console.error('Usage: npm run seed:orders -- <IMO>'); process.exit(1); }

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();

const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 10);
const d = (offset) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().slice(0, 10);
};

const DEPTS = ['bridge', 'engine', 'deck', 'accommodation', 'galley', 'medical'];

const LINES = {
  bridge: [
    ['Chart folio NP136', 'SET', 'ADM Publication', 'CH-NP136'],
    ['ECDIS update subscription', 'yr', 'Jeppesen', 'ECUPD-1Y'],
    ['VHF handheld battery', 'pcs', 'Icom', 'BP-264'],
    ['SART battery replacement', 'pcs', 'McMurdo', 'BAT-SART'],
    ['Aldis lamp bulb', 'pcs', 'Carlisle & Finch', 'ALB-35W'],
    ['Binoculars 7×50', 'pcs', 'Fujinon', 'FMT-SX'],
    ['Compass deviation card set', 'set', 'Marine Supply', null],
  ],
  engine: [
    ['Main engine lube oil', 'L', 'Shell', 'SO-AX4-210'],
    ['Fuel filter element FV-8', 'pcs', 'Perkins', 'FF5135'],
    ['Raw water impeller', 'pcs', 'Jabsco', '1210-0001'],
    ['O-ring set 200 pcs', 'set', 'Parker', 'OR-200-KIT'],
    ['Turbocharger bearing kit', 'set', 'ABB', 'TBK-VTR354'],
    ['Fuel injector nozzle set', 'set', 'Bosch', '0433271755'],
    ['Piston ring set', 'set', 'Mahle', 'PR-6Z'],
  ],
  deck: [
    ['Mooring rope 120m 32mm', 'm', 'Bridon', 'MR-32-120'],
    ['Anti-fouling primer', 'L', 'Jotun', 'SeaForce90'],
    ['Life ring with line', 'pcs', 'Viking', 'LR-30'],
    ['Fire hose 15m', 'pcs', 'Naval', 'FH-15'],
    ['Anchor shackle 76mm', 'pcs', 'Suncor', 'S0176-0031'],
    ['Rope ladder 6m', 'pcs', 'Wichard', 'RL-6'],
    ['Deck brush heavy duty', 'pcs', 'Swobbit', 'SW49-714'],
  ],
  accommodation: [
    ['Bed linen set', 'set', 'Marine Textiles', null],
    ['Cleaning detergent 5L', 'L', 'Diversey', 'DV-CIP'],
    ['Toilet paper bulk (100)', 'pcs', 'Generic', null],
    ['Mattress cover waterproof', 'pcs', 'MarineSafe', 'MC-WP'],
    ['Air freshener dispenser', 'pcs', 'Air Wick', 'PRO3500'],
    ['Cabin lock cylinder', 'pcs', 'Abloy', 'PROTEC2'],
    ['Window blind 600×800', 'pcs', 'Marine Blinds', 'WB-600'],
  ],
  galley: [
    ['Cooking oil 20L drum', 'L', 'Olivar', null],
    ['Coffee beans 5kg', 'kg', 'Lavazza', 'SP-5KG'],
    ['Freezer basket set', 'set', 'Dometic', 'FB-SET'],
    ['Dishwasher tablets ×100', 'pcs', 'Finish', 'FIN-100'],
    ['Gas hose 1.5m SS', 'pcs', 'Regulator Co.', 'GH-15-SS'],
    ['Knife sharpener electric', 'pcs', 'Edgecraft', 'CC4643'],
    ['Food storage container 5L', 'pcs', 'Cambro', '5SFSCW'],
  ],
  medical: [
    ['Paracetamol 500mg ×100', 'pcs', 'GSK', 'PAR-500'],
    ['Sterile gloves M ×50 pairs', 'pcs', 'Kimberly-Clark', 'KG-M50'],
    ['Bandage 10cm × 4m', 'pcs', 'Hartmann', 'BN-10'],
    ['Ibuprofen 400mg ×100', 'pcs', 'Ratiopharm', 'IBU-400'],
    ['Blood pressure monitor', 'pcs', 'Omron', 'M3'],
    ['Defibrillator pads AED', 'set', 'Zoll', 'ZP-AED'],
    ['Morphine 10mg/ml ×5 amp', 'pcs', 'Hameln', 'MOR-10'],
  ],
};

const CONFIGS = [
  { status: 'received', pct: 100, daysAgo: 45, supplier: 'Ocean Marine Supplies',     sentDays: -50, recvDays: -45 },
  { status: 'partial',  pct: 60,  daysAgo: 20, supplier: 'Baltic Ship Chandlers',      sentDays: -25 },
  { status: 'sent',     pct: 0,   daysAgo: 10, supplier: 'Port Logistics Ltd',         sentDays: -12 },
  { status: 'draft',    pct: 0,   daysAgo:  3, supplier: null },
  { status: 'partial',  pct: 30,  daysAgo: 35, supplier: 'Wilhelmsen Ship Service',    sentDays: -40 },
];

async function run() {
  const col = db.collection(`${ROOT}/${IMO}/purchase_orders`);
  const batch = db.batch();
  let seq = 1;
  let count = 0;

  for (const dept of DEPTS) {
    const pool = LINES[dept];
    for (let i = 0; i < 5; i++) {
      const cfg = CONFIGS[i];
      const no = `PO-2026-${String(seq++).padStart(3, '0')}`;
      const lineCnt = 2 + (i % 3);

      const lines = pool.slice(i % 3, i % 3 + lineCnt).map((l) => {
        const qty = 3 + Math.floor(Math.random() * 7);
        const qtyReceived =
          cfg.pct === 100 ? qty :
          cfg.pct === 60  ? Math.round(qty * 0.6) :
          cfg.pct === 30  ? Math.round(qty * 0.3) :
          undefined;
        return {
          id: uid('ol'),
          description: l[0],
          qty,
          unit: l[1],
          ...(l[2] ? { maker: l[2] } : {}),
          ...(l[3] ? { partNo: l[3] } : {}),
          ...(qtyReceived != null ? { qtyReceived } : {}),
        };
      });

      const deliveries = [];
      if (cfg.pct > 0 && cfg.pct < 100) {
        deliveries.push({
          date: d(-(cfg.daysAgo - 5)),
          by: 'Chief Officer',
          lines: Object.fromEntries(lines.map((l) => [l.id, l.qtyReceived ?? 0])),
        });
      }
      if (cfg.pct === 100) {
        deliveries.push({
          date: d(-cfg.recvDays),
          by: 'Chief Officer',
          lines: Object.fromEntries(lines.map((l) => [l.id, l.qtyReceived ?? 0])),
        });
      }

      const order = {
        id: uid('po'),
        no,
        dept,
        status: cfg.status,
        date: d(-cfg.daysAgo),
        by: 'Master',
        byRank: 'Master',
        ...(cfg.supplier ? { supplier: cfg.supplier } : {}),
        ...(cfg.sentDays != null ? { sentAt: d(cfg.sentDays), sentBy: 'Chief Officer' } : {}),
        ...(cfg.status === 'received' ? { receivedAt: d(cfg.recvDays ?? -40), receivedBy: 'Chief Officer' } : {}),
        ...(deliveries.length ? { deliveries } : {}),
        lines,
        at: Date.now() - cfg.daysAgo * 86400000,
        updatedAt: Date.now(), // must be NOW so pullList's `updatedAt > since` window catches it
      };

      batch.set(col.doc(order.id), order);
      count++;
    }
  }

  await batch.commit();
  console.log(`✅  Seeded ${count} orders into ${ROOT}/${IMO}/purchase_orders`);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
