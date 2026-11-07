// check:enrolguard — who is still let in and how long a self-approving invitation stands
// (functions/access.js, types/role inviteWindow; 7 Nov 2026).
import { INVITE_TTL_MS, inviteWindow } from '../types/role';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const A = require(require('path').join(process.cwd(), 'functions/access')); // run from the repo root, where functions/ has its own node_modules

let n = 0, bad = 0;
const ok = (c: boolean, label: string) => { n++; if (c) console.log(`✓ ${label}`); else { bad++; console.log(`✗ ${label}`); } };

const H = 3600_000, T0 = 1_000 * H;
const ts = (ms: number) => ({ toMillis: () => ms });

// ---- the device record
ok(A.isLive({ approved: true }), 'approved device is live');
ok(!A.isLive({ approved: false }), 'waiting device is not');
ok(!A.isLive({ approved: true, disabled: true }), 'switched off by the Master is not');
ok(A.isLive({ approved: true, disabled: true, retiredAt: 5 }), 'retired as a duplicate still is (comes back on open)');
ok(!A.isLive(null), 'removed device is not');

// ---- invitations
const inv = (role: string, issuedAt: any, activations: any[] = []) => ({ role, issuedAt, activations });
ok(A.inviteClosed(inv('user', null), 'd1', T0) === null, 'Crew invitation has no window (it waits for approval)');
ok(A.inviteClosed(inv('admin', ts(T0 - 500 * H)), 'd1', T0) === null, 'Officer invitation has none either');
ok(A.inviteClosed(inv('superadmin', ts(T0 - 47 * H)), 'd1', T0) === null, 'Master invitation open at 47 h');
ok(A.inviteClosed(inv('superadmin', ts(T0 - 49 * H)), 'd1', T0) === 'expired', 'Master invitation closed at 49 h');
ok(A.inviteClosed(inv('superadmin', undefined), 'd1', T0) === 'expired', 'Master invitation with no date at all is closed');
ok(A.inviteClosed({ role: 'superadmin', createdAt: T0 - 400 * H, activations: [] }, 'd1', T0) === 'expired', 'an old Master invitation (older app, createdAt only) is closed');
ok(A.inviteClosed({ role: 'superadmin', createdAt: T0 - 2 * H, activations: [] }, 'd1', T0) === null, 'one an older app issued just now is open (createdAt)');
ok(inviteWindow({ role: 'superadmin', createdAt: T0 - 2 * H, activations: [] }, T0)?.state === 'open', '…and the screen says so');
ok(A.inviteClosed(inv('shore', ts(T0 - H)), 'd1', T0) === null, 'shore invitation open within 48 h');
ok(A.inviteClosed(inv('shore', ts(T0 - 49 * H)), 'd1', T0) === 'expired', 'shore invitation closes too');
ok(A.inviteClosed(inv('superadmin', ts(T0 - H), [{ deviceId: 'd2', at: T0 - 0.5 * H }]), 'd1', T0) === 'used', 'used by another device since the PIN → closed');
ok(A.inviteClosed(inv('superadmin', ts(T0 - H), [{ deviceId: 'd1', at: T0 - 0.5 * H }]), 'd1', T0) === null, 'the same device again (reply lost) → open');
ok(A.inviteClosed(inv('superadmin', ts(T0 - H), [{ deviceId: 'd2', at: T0 - 100 * H }]), 'd1', T0) === null, 'a device from before the new PIN does not use it up');
ok(A.inviteClosed(inv('superadmin', T0 - H), 'd1', T0) === null, 'issuedAt as millis is read too');

// ---- the screen says what the server does
const cases: Array<[string, number | undefined, any[]]> = [
  ['superadmin', T0 - 47 * H, []], ['superadmin', T0 - 49 * H, []], ['superadmin', undefined, []],
  ['superadmin', T0 - H, [{ deviceId: 'd2', at: T0 - 0.5 * H }]], ['shore', T0 - H, []], ['user', T0 - 100 * H, []],
];
for (const [role, issuedAt, acts] of cases) {
  const w = inviteWindow({ role: role as any, issuedAt, createdAt: 0, activations: acts }, T0);
  const s = A.inviteClosed(inv(role, issuedAt === undefined ? undefined : ts(issuedAt), acts), 'other', T0) ?? (A.SELF_APPROVING.includes(role) ? 'open' : null);
  ok((w ? w.state : null) === s, `screen and server agree: ${role}, ${issuedAt === undefined ? 'no date' : (T0 - issuedAt) / H + ' h'}, ${acts.length} used → ${s}`);
}
ok(INVITE_TTL_MS === A.INVITE_TTL_MS, 'the same 48 hours on both sides');
const w = inviteWindow({ role: 'superadmin', issuedAt: T0 - H, createdAt: T0 - 300 * H, activations: [] }, T0);
ok(!!w && w.state === 'open' && w.until === T0 + 47 * H, 'valid until = issue + 48 h');

// ---- guesses per vessel
let g: any = null;
for (let i = 0; i < A.VESSEL_MAX; i++) g = A.nextGuard(g, T0 + i * 1000);
ok(g && g.count === A.VESSEL_MAX, `${A.VESSEL_MAX} tries fit in the window`);
ok(A.nextGuard(g, T0 + 60_000) === null, 'the next one in the same 15 minutes is refused');
ok(A.nextGuard(g, T0 + 16 * 60_000)?.count === 1, 'a new window after 15 minutes');

console.log(`\n${n - bad}/${n}`);
process.exit(bad ? 1 : 0);
