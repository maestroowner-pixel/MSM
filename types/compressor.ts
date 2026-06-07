// ===================================
// BA compressor log (part of the FIFI outfit)
// A vessel may have up to MAX_COMPRESSORS units. Each tracks its accumulated
// running time (each charging run adds minutes to a counter) plus dated
// maintenance / service / inspection events.
// ===================================

export type CompressorEventType = 'run' | 'maintenance' | 'service' | 'inspection';

export interface CompressorEntry {
  id: string;
  date: string; // ISO yyyy-mm-dd
  type: CompressorEventType;
  minutes?: number; // running time for a 'run' entry
  note?: string;
  createdAt: number;
}

export interface Compressor {
  id: string;
  name: string;
  baselineMinutes?: number; // counter value before logging started in the app
  entries: CompressorEntry[];
}

export interface CompressorState {
  compressors: Compressor[];
}

export const MAX_COMPRESSORS = 3;

export const COMPRESSOR_EVENT_META: Record<
  CompressorEventType,
  { label: string; emoji: string }
> = {
  run: { label: 'Running', emoji: '⏱️' },
  maintenance: { label: 'Maintenance', emoji: '🔧' },
  service: { label: 'Service', emoji: '🛠️' },
  inspection: { label: 'Inspection', emoji: '🔍' },
};

/**
 * Normalize stored/backed-up data into the multi-compressor shape, migrating
 * the original single-log format ({ baselineMinutes?, entries[] }).
 */
export function normalizeCompressorState(raw: any): CompressorState {
  if (!raw || typeof raw !== 'object') return { compressors: [] };
  if (Array.isArray(raw.compressors)) {
    return {
      compressors: raw.compressors
        .filter((c: any) => c && typeof c === 'object')
        .map((c: any, i: number) => ({
          id: typeof c.id === 'string' ? c.id : `cmp_${i + 1}`,
          name: typeof c.name === 'string' && c.name.trim() ? c.name : `Compressor ${i + 1}`,
          baselineMinutes: typeof c.baselineMinutes === 'number' ? c.baselineMinutes : undefined,
          entries: Array.isArray(c.entries) ? c.entries : [],
        })),
    };
  }
  // Legacy single-log shape.
  if (Array.isArray(raw.entries)) {
    return {
      compressors: [
        {
          id: 'cmp_1',
          name: 'Compressor 1',
          baselineMinutes: typeof raw.baselineMinutes === 'number' ? raw.baselineMinutes : undefined,
          entries: raw.entries,
        },
      ],
    };
  }
  return { compressors: [] };
}
