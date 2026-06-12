// ===================================
// Certificate — a document (e.g. a class/service certificate) that can cover
// one or many equipment items (a "group certificate").
// ===================================

export interface Certificate {
  id: string;
  name: string; // e.g. "Liferaft annual service certificate"
  number?: string; // certificate / report number
  issuer?: string; // servicing station / class society
  issueDate?: string; // ISO yyyy-mm-dd
  expiryDate?: string; // ISO yyyy-mm-dd — drives status
  fileUri?: string; // persisted file (PDF / image) in the document directory
  fileName?: string;
  fileKind?: 'photo' | 'document';
  itemIds: string[]; // equipment items covered by this certificate
  createdAt: number;
  updatedAt: number;
}
