# Restoring the cloud data (plan item 58)

Project `marine-safety-manager`, Firestore `(default)` in nam5. Owner: one Google account
(osypovmykhaylo@gmail.com) — nobody else holds a human role; no user-managed service-account keys.

## What protects the data
- Firestore: a daily backup, kept 5 days (`gcloud firestore backups schedules list --database='(default)'`).
  Delete protection is on. Point-in-time recovery is off (decided 05.11.2026, not needed).
- Storage (`marine-safety-manager.firebasestorage.app`, photos and attachments): soft delete 7 days —
  a deleted or overwritten file can be brought back for a week. No backup beyond that, no versioning.
- On the vessel: every device keeps its own copy and the `.msm` backup. The cloud is not the only copy.

## Firestore: a bad write or a deletion
A backup restores only into a NEW database, never over `(default)`. Restore, compare, then copy back
what is needed.

1. Pick the backup (snapshot time is the moment it holds):
   `gcloud firestore backups list --project=marine-safety-manager`
2. Restore into a new database (≈2 minutes for ~1 300 documents, 07.11.2026):
   `gcloud firestore databases restore --source-backup=projects/marine-safety-manager/locations/nam5/backups/<ID> --destination-database=<name> --project=marine-safety-manager`
   Wait: `gcloud firestore operations list --database=<name> --project=marine-safety-manager`
3. Compare with live (read-only): `cd functions && node scripts/restore-check.js <name> <snapshot time>`
4. Copy back:
   - a few documents or one vessel — a short Admin SDK script reading `<name>` and writing `(default)`
     (`new Firestore({ databaseId: '<name>' })`). Prefer this: it touches only what was lost.
   - everything — `gcloud firestore export gs://<bucket>/<dir> --database=<name>`, then
     `gcloud firestore import gs://<bucket>/<dir> --database='(default)'`. Import overwrites documents
     with the same path and leaves newer documents alone; it does not delete. NOT tried yet.
   Devices push their own lists again on the next sync, so a vessel whose phones are fine often
   needs nothing from the backup at all.
5. Remove the copy (it costs storage and has delete protection):
   `gcloud firestore databases update --database=<name> --no-delete-protection --project=marine-safety-manager`
   `gcloud firestore databases delete --database=<name> --project=marine-safety-manager`

## Storage: a deleted file
`gcloud storage ls --soft-deleted gs://marine-safety-manager.firebasestorage.app/<path>**` →
`gcloud storage restore gs://marine-safety-manager.firebasestorage.app/<path>#<generation>`. Within 7 days only.

## Checked
07.11.2026: backup of 06.11 19:07 UTC restored into `restore-check`; 1 282 documents unchanged since
the snapshot are identical, 0 missing, 0 different (2 changed and 2 created after it, as expected).
