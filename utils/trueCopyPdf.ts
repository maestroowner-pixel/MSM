// ===================================
// Handing a certified true copy over (services/trueCopy draws it): the browser's
// save on the web, the share sheet on a phone. jsPDF is plain JS, so phones get
// the same file the web does.
// ===================================

import { TrueCopy, trueCopyDoc } from '../services/trueCopy';
import { deliverFile, onWeb } from './fileShare';
import { saveFileWeb } from './webSave';

/** Draw it and hand it over — the browser's save, a phone's share sheet. */
export async function deliverTrueCopy(c: TrueCopy, fileName: string): Promise<string | null | void> {
  const doc = trueCopyDoc(c);
  if (onWeb) return saveFileWeb(doc.output('blob'), fileName, 'reports');
  const b64 = String(doc.output('datauristring')).split(',').pop() ?? '';
  await deliverFile(fileName, b64, true, 'application/pdf');
}
