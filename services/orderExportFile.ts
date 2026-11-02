// Writes an order export (services/orderExport) — kept apart so the builders stay pure for their check.
import * as XLSX from 'xlsx';

import { VesselInfo } from './storage';
import { MIME, OrderFormat, docxBase64, exportName, ordersJson, ordersWorkbook } from './orderExport';
import { PurchaseOrder } from '../types/orders';
import { deliverFile, onWeb } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';

/** Writes the file: web → the folder chosen for reports (returns its name); phone → the share sheet. */
export async function exportOrders(orders: PurchaseOrder[], vessel: VesselInfo | null, format: OrderFormat, today: string): Promise<string | null | void> {
  const name = exportName(orders, vessel, format, today);
  if (format === 'json') {
    const text = ordersJson(orders, vessel);
    if (onWeb) return saveFileWeb(new Blob([text], { type: MIME.json }), name, 'reports');
    return deliverFile(name, text, false, MIME.json);
  }
  const b64 = format === 'xlsx' ? (XLSX.write(ordersWorkbook(orders, vessel), { type: 'base64', bookType: 'xlsx' }) as string) : await docxBase64(orders, vessel);
  if (onWeb) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return saveFileWeb(new Blob([bytes], { type: MIME[format] }), name, 'reports');
  }
  await deliverFile(name, b64, true, MIME[format]);
}
