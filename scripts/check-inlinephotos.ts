// npm run check:inlinephotos — a browser's evidence photos stay out of the record's cloud copy and come back on its own device.
import { INLINE_ELSEWHERE, keepLocalPhotos, photosFromCloud, photosToCloud } from '../services/inlinePhotos';

let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) bad++; console.log(`${c ? '✓' : '✗'} ${m}`); };

// Four photos of ~400 KB each, as a browser keeps them: over Firestore's 1 MiB with the record.
const big = (n: number) => `data:image/jpeg;base64,${String(n).repeat(400_000)}`;
const photo = (id: string, uri: string, kind = 'photo') => ({ id, kind, uri, addedAt: 1 });
const defect = {
  id: 'd1', updatedAt: 5, title: 'Leak',
  photos: [photo('p1', big(1)), photo('p2', big(2)), photo('p3', 'file:///var/attachments/p3.jpg'), photo('doc', 'data:application/pdf;base64,AAAA', 'document')],
  closed: { by: 'C/E', note: 'Seal renewed', photos: [photo('p4', big(4))] },
};
ok(JSON.stringify(defect).length > 1_048_487, 'the record with its photos is over the 1 MiB a document may hold');

const up = photosToCloud(defect);
ok(JSON.stringify(up).length < 10_000, `the cloud copy is small (${JSON.stringify(up).length} bytes)`);
ok(up.photos[0].uri === INLINE_ELSEWHERE && up.photos[1].uri === INLINE_ELSEWHERE, 'inline photos leave the marker');
ok(up.closed.photos[0].uri === INLINE_ELSEWHERE, 'a closing photo too (nested)');
ok(up.photos[2].uri === 'file:///var/attachments/p3.jpg', "a phone's file path is left as it was");
ok(up.photos[3].uri === 'data:application/pdf;base64,AAAA', 'a document is not queued for Storage, so it stays');
ok(up.photos[0].id === 'p1' && up.photos[0].kind === 'photo' && up.photos[0].addedAt === 1, 'the rest of the attachment goes as it was');
ok(defect.photos[0].uri === big(1), 'the record on the device is not touched');
const plain = { id: 'x', updatedAt: 1, note: 'no photos', photos: [photo('a', 'https://x/a.jpg')] };
ok(photosToCloud(plain) === plain, 'nothing to strip: the same object back');

// Back from the cloud — the defect closed by another officer (newer), with the marker in place of the bytes.
const back = photosFromCloud(defect, { ...up, updatedAt: 9 });
ok(back.updatedAt === 9 && back.photos[0].uri === big(1) && back.photos[1].uri === big(2), 'its own device puts its bytes back');
ok(back.closed.photos[0].uri === big(4), 'nested too');
ok(photosFromCloud(undefined, up).photos[0].uri === INLINE_ELSEWHERE, 'another device keeps the marker (the photo comes from Storage)');
const other = { ...up, photos: [...up.photos, photo('p9', INLINE_ELSEWHERE)] };
ok(photosFromCloud(defect, other).photos[4].uri === INLINE_ELSEWHERE, "a photo this device never had stays the marker");
const markerHere = { ...defect, photos: [photo('p1', INLINE_ELSEWHERE)] };
ok(photosFromCloud(markerHere, up).photos[0].uri === INLINE_ELSEWHERE, 'a marker here is not taken for bytes');

const list = keepLocalPhotos([defect, plain], [{ ...up, updatedAt: 9 }, plain]);
ok(list[0].photos[1].uri === big(2) && list[1] === plain, 'a batch, by id');

console.log(bad ? `${bad} FAILED` : 'all passed');
process.exit(bad ? 1 : 0);
