# Changelog

Kept by hand. Each entry says what changed and, where it matters, **why** — the reasoning is
the part that stops the next person undoing it.

## 2.2 — 5 September 2026

Android versionCode 20201 · iOS build 20201.

The release that answers a customer's question: can MSM take a QR scan through a checklist to a
signed record and out as an LSA/FFE report. It can now, and the account model underneath it had
to change to make those signatures mean anything.

### The audit trail

- **Signed inspections** (`types/inspection.ts`, `services/inspections.ts`). One record is one
  crew member working one checklist against one item: exact timestamp, signature snapshot,
  per-line `pass|fail|na`, frozen outcome, comment, evidence photos, optional defect.
- **Records are append-only.** A correction is a new inspection, never an edit. Two things
  depend on it: a signed statement that could be quietly rewritten is worth nothing at an audit,
  and merging two devices becomes a set union — so several officers can work a round on separate
  phones and lose nothing. The only permitted mutation is a defect going open→closed, itself
  stamped and signed.
- **30 checklist templates** (`constants/checklists.ts`), weekly and/or monthly per category,
  with a generic fallback so no category can refuse a round. Line ids are permanent: they are
  the keys of every stored result map.
- **LSA/FFE period reports** (`services/inspectionReport.ts`), PDF + XLSX, from one pure
  `buildReport` so the preview and the file cannot disagree. Three sections — what was
  inspected, **what was not**, and every open defect carried forward. The middle one is printed
  on purpose: a report that hides the gap reads like a clean sheet.
- New screens: Inspection, InspectionDetail (read-only by design), Crew, Defects.
- `npm run check:inspections` — 41 invariant checks on immutability, merge and calendar windows.

### Accounts are issued, not shared

- **The shared connection password is gone, and its code with it** (~800 lines). A Master issues
  an invitation (name + 8-digit PIN); `functions/enrol` mints a custom token carrying
  `{vessel, role, approved, deviceId}`, and `firestore.rules` is written against those claims.
  A role is now enforced by the server rather than agreed between colleagues, and revoking one
  person no longer means changing the password for everybody.
- **Do not reintroduce a fallback to the old path.** It keyed the register by the Firebase uid,
  which since enrolment is per-device (`<imo>__<deviceId>`) — a device reaching it wrote a
  second register beside the real one, one vessel with two incomplete copies.
- Roles: Crew / Officer / Master. Device management lives in Settings → Accounts, including
  removing a device outright; a device cannot remove itself, or a lone Master would lock the
  vessel out of its own accounts with one tap.
- **The bootstrap code is digits.** The enrolment field is a number pad — crew key it on deck in
  gloves — so a base64 secret could not be entered at all and the first device on a vessel could
  never enrol. Found by walking the flow on a device, not by any typecheck.

### Small things that make the work read

- **An officer can roll their own device back, and it stays there.** Restoring from a file is
  the Master's because it replaces the register and hands it to the vessel; rolling THIS handset
  back to how it was an hour ago is repairing what is in your hand. To keep that promise the push
  has to be actively suppressed — every local edit schedules one — so a private recovery cannot
  quietly become everyone's. What it cannot do is outrank the ship: the register is one shared
  document, so the next sync reconciles, and the dialog says so instead of implying otherwise.
- **Worksheet tabs are coloured by group** in both the blank import template and the exported
  register: LSA blue, FFE red, the rest slate, matching the app. SheetJS 0.18 READS a tab colour
  and does not write one (verified before relying on it — the property goes in and nothing comes
  out), and cell styling is a Pro feature, so the colour is written into the file afterwards with
  jszip, which is already here for the ZIP export. `<sheetPr>` must be the first child of
  `<worksheet>`; anywhere else and Excel calls the file corrupt. A failure to paint returns the
  plain workbook — a colourless template is still a template.

### Manual and splash

- The manual gained 16 entries across six sections, in all four languages: the catch-all
  category, the browser scanner's opt-in camera, the reason on every defect, snapshots and the
  roll-back, what Reset really clears on a syncing device, and rank aboard / This device / Sign
  off. Section counts are equal across languages (22 sections, 88 entries).
- Splash: the octopus is cropped and the logo squared off. `splash.png` is OPAQUE and carries
  ~19% white margin, so on the app's pale background it read as a hard-edged white square with a
  small octopus adrift in it. The file is untouched (it is also the native splash, where the
  margin is wanted) — the image is drawn larger than its window, and the difference is the crop.

### Sync: what it was actually refusing

"Could not connect" was covering a perfectly good connection. The session was fine and the
FUNCTION calls were succeeding — the server logs showed `auth: VALID` throughout — and the
register WRITE was being refused. Three separate causes, none of which could be seen because
every path to `error` set the status and threw the reason away.

- **The crew list was pushed by every device on every sync**, and the rules gate it on `isSuper`.
  On any device but the Master that is a guaranteed refusal, and it took the whole push down with
  it. A device that may not write the list no longer tries: only a Master can have changed it.
- **The whole inspection trail was re-pushed every time.** By the rules that is an UPDATE, and an
  inspection may be updated only by an officer and only in its `defect` — so a crew device was
  refused for re-sending a record that had not changed at all. It also cost real money: the trail
  grows for the life of the vessel and every launch pushed all of it up a metered VSAT link.
  Devices now track what is already up there; a signed record is immutable, so that knowledge is
  permanent.
- **Signing an inspection scheduled no push at all.** The effect watched the register, the
  certificates, the vessel and the compressor — everything except the one thing the app exists to
  record. A signature reached the vessel on the next launch, or when somebody happened to edit an
  item. On a round worked from two phones that is the difference between seconds and tomorrow.

Every path to `error` now carries its reason, each write names itself (`register:`,
`inspections:`, `crew:`), and a permission refusal on the wrong vessel prints the two IMO numbers
side by side instead of "Missing or insufficient permissions".

- **The rank is remembered locally.** It arrives in a token, so a device with no signal had no
  rank — and gating the interface on that left a Master who lost signal without the backup or the
  roll-back, at exactly the moment those matter. For the INTERFACE only; every write is still
  checked against the claim.
- **Sign off now updates the screens.** `disconnect()` left `enrolled` standing, so the join
  screen went on showing the identity of a device that had just left, and Settings went on hiding
  controls a standalone device is entitled to, until the app was restarted. State that mirrors
  storage must be corrected by whoever changes the storage. "Sign off & erase" also reloads and
  drops the snapshots.

### A net under the trapeze, and who may pull it

- **Automatic snapshots.** The app copies the RECORDS on every launch and keeps the last three
  on the device. Settings → Data → "Roll back to <time>" names the moment it would return you
  to — the date is on the row, because "Restore a snapshot" makes a person open a dialog to find
  out whether it is worth anything. It exists for the accidents nobody plans for, and it is the
  copy that will actually be there: nobody exports a backup the morning before the mistake.
- No binaries in a snapshot: a register with a few hundred photos is tens of megabytes and would
  be felt on every open. Attachment files stay on disk under their own names, so a roll-back
  relinks to them — which is why the UI says a snapshot is not a substitute for a real backup.
- **An empty register never overwrites a good snapshot.** Opening onto an emptied register would
  otherwise record the emptiness and, across three launches, erase the last good copy — the very
  accident the feature exists to survive. Same reasoning as the guard in `pullAll`.
- **"Reset all data" was clearing the ship, silently.** Wiping storage fires the data-change
  push, and `pushAll` sends what it finds, including nothing — so the vessel's register and every
  other device went with it, within seconds. It now asks separately, the button is named "Erase
  everywhere", and it points at Sign off & erase for anyone who wants only their own handset
  cleared. A reset also drops the snapshots, or "delete everything" would be untrue.
- **Data controls follow the rank.** Restore and Reset are the Master's — they replace the
  register and hand it to the vessel, overwriting what other officers have worked against.
  Officers keep Import and Export. A device that has NOT joined a vessel keeps all of it: gating
  on rank alone took Import away from every new install, because the rank is null until
  enrolment, and the first thing a new user must do became the one thing they could not.

### A signed record cannot be doubled, and a defect always says why

- **Tapping Sign twice signed twice.** The guard was React state, which does not settle between
  taps: three taps stacked three confirmations and all three closures read the flag as false.
  A signed record cannot be edited or deleted, so the duplicate was a second signed statement
  about one check — and on a failed round, a second open defect for somebody to close by hand.
  Refs now guard both the confirmation and the signing, and the same guard covers recording a
  rectification. Three checks in `check:inspections` pin down why the guard has to live in the
  screen: two signings get different ids, merge is a union, and nothing downstream can undo it.
- **Every defect carries its reason** — the checklist lines that failed — on the card, on the
  Dashboard strip and in the report, where the column is now "What failed". The officer's note
  is added to the reason, never instead of it: the note is optional, so a defect raised without
  one used to print a blank where the finding should be, and an auditor reading a blank has to
  come and ask. `defectReason` lives in the domain module, not the report: it is a statement
  about a defect, and there it can be tested (the report module imports expo-print and will not
  load under Node).

### The register grows a catch-all

- **Other Safety Equipment** — every register carries gear the standard sheets do not name, and
  with nowhere to put it that item stays on paper, which makes it the one that gets missed. Built
  by hand with ＋; it behaves like any other category (dates, QR labels, inspections, reports).
- `CategoryMeta.sheet` became optional. An empty string made the importer report a missing
  worksheet with no name, and asked Excel for a sheet called `""` — which it refuses, breaking
  "Download import template". Absent says it plainly.
- `check:inspections` now asserts EVERY category has a monthly round and builds a non-empty
  template, instead of sampling one. A category added without a checklist can be scanned and
  opened but not inspected, and nothing else would have said so.

### The interface matches the rank

Every enrolled device was shown the Master's controls — issuing accounts, approving devices,
editing the signing list. The server refused those writes (`firestore.rules` gates them on the
`superadmin` claim), so nothing could actually be done, but **a button that always fails tells
the user something untrue about their own authority**.

- Accounts, Crew and the Settings entry to Accounts now open according to what the device's own
  token says it is. Until the rank comes back from `refresh` the screens offer nothing at all
  rather than guessing.
- A member sees the crew and device lists read-only. That read is legitimate and the rules allow
  it — knowing who is aboard is not the same as changing it.
- Only a Master subscribes to invitations. They carry PINs and are Master-only in the rules, so
  subscribing as anyone else was a guaranteed permission error landing on screen as a red card
  for doing nothing wrong.
- **The crew list tightened from `isAdmin` to `isSuper`.** It decides whose name may appear on a
  signed record, which is closer to issuing an account than to doing a round.
- The Master can add an already-enrolled person to the signing list in one tap, taking the name
  from their account. Asking an officer to type a name the vessel already holds invites two
  spellings of one person. Manual entry stays, because a bosun with no phone still has to be
  able to sign.

### Joining, and leaving

- **A device that has joined is shown who it is, not a form.** Three empty boxes asking for a
  name and a PIN read as "you are not in", which is the opposite of the truth. The screen now
  carries the name, the rank and the approval state, read live from the vessel — so a rank the
  Master changes an hour later appears without anyone reinstalling anything.
- **Sign off** ends the session AND clears the device secret. The second half is the load-bearing
  one: without it `refresh` mints a new session on the next launch and signing off lasts only
  until the app is reopened. Erasing the local register is offered as a separate choice, because
  it is a different decision — that one matters when the handset is handed on or sold.
- **Neither buys a fresh trial**, and the dialog says so with the actual number of days. The 60
  days run from the vessel's first launch, mirrored to the account, earliest wins. A device that
  signs off, wipes and rejoins finds the clock where it left it — and rejoining needs a new
  invitation and a Master's approval, because the device can no longer let itself back in.

### Rank aboard, and where joining lives

- **Invitations carry a `position`** — Third Officer, Bosun, Chief Engineer — kept deliberately
  apart from `role`, which is what the app permits (Crew / Officer / Master). A Second Engineer
  may hold a Crew account and a cadet an Officer one; conflating them would make every promotion
  aboard a permissions change and every permissions change look like a promotion. Free text,
  because ranks differ by flag, company and trade.
- The rank travels invitation → device record → the join screen, and is what fills the signing
  list when a Master adds an enrolled person. **A device cannot name its own rank**: `enrol`
  reads it only from the invitation, or the signature line would be self-declared. Devices that
  enrolled before this have no rank until they rejoin.
- **Joining moved to the bottom of the Vessel section.** The IMO above it is what a device
  joins, so the two questions now read as one sequence. Among the inspection links it looked
  like another weekly task rather than the last step of naming the ship. Once aboard, the row
  reports instead of inviting — "This device · Who it signs as, and how to sign off".
- **The Crew screen is offered to the Master only.** For anyone else it is a management page
  with nothing to do on it and usually nothing on it. Signing is unaffected: the picker inside
  an inspection reads the same list, and every rank still signs.

### Transport: Realtime Database → Firestore

- Per-document writes, so two officers inspecting at once write two documents instead of racing
  for one tree; a real offline queue; live `onSnapshot` instead of manual Push/Pull.
- The register travels as one JSON **string** field: item `extra` keys come from arbitrary Excel
  headers, and as a map every one of them would become an indexed field name.
- The trail is one document per record — it has no 1 MiB ceiling and cannot collide between
  devices.
- `pullAll` **refuses an empty cloud register when the device holds items.** Without that guard a
  device pulled an empty blob, lost all 13 items and pushed the emptiness back over the good copy
  within a minute. Observed for real on 4 Sep 2026.

### Licensing: one licence per vessel

- MSM Pro is **€99/year per vessel (one IMO)**, bought on LemonSqueezy and attached to the
  vessel's account. Every enrolled device inherits it; a crew member buys nothing. A store
  purchase is tied to the Apple ID that paid, so the mate who bought it had Pro and the second
  officer beside him did not — though the licence was meant to cover the ship.
- No IAP product exists in either store, and none should: the app is free there and the native
  paywall shows no price and no link, only key activation.
- **Pass the vessel key, never the auth uid.** Activation used `currentUid()` and wrote to
  `safety_vessels/<imo>__<dev>`, which the rules do not recognise — the key validated and then
  failed with "Missing or insufficient permissions".
- The trial belongs to the vessel, not the handset: the first-launch stamp is mirrored to the
  account, earliest wins. On Android the secure store is wiped with the app, so without this
  every reinstall handed out a fresh 60 days.

### Inspection photos

- Downscaled to 1600px on the long edge before storage — `expo-image-picker`'s `quality` only
  sets JPEG compression and left the full 12 MP, so photos were 2–3 MB and are now 200–450 KB.
- Held in a queue until the connection is worth spending (Wi-Fi by default). The cost that hurts
  is not Google's — it is the ship's own VSAT airtime.
- The object path is **derived** from the record's ids rather than written back onto it: a signed
  inspection is immutable.

### Web / desktop

- Desktop is the web build. The Electron/NSIS installer and the react-native-windows track are
  retired; Firebase Hosting serves the site and `npm run exe` wraps it into one self-updating
  file. macOS is served by the iPad build or the browser — `../MSM_Mac` was retired on 5 Sep.
- **`Alert.alert` is drawn in the DOM.** It used `window.confirm`, and a browser lets the user
  tick "prevent this page from creating additional dialogs" — after which `confirm()` returns
  false having shown nothing. The shim read that as Cancel, so restoring a backup quietly did
  nothing, and the same suppression sat in front of the dialog that SIGNS an inspection.
- **Backup restore.** Three separate faults, in order: the file picker filtered by MIME type and
  `.msm` has none, so macOS greyed the backup out; cancellation was then inferred from window
  focus and a good file could be reported as a cancel; and finally the restore was overwritten by
  the cloud listener putting the vessel's copy back. A restore now outranks incoming data for 30
  seconds and is pushed to the vessel, so the ship adopts what the user chose.
- Deep links: a screen map onto URL paths, so `/accounts` and friends are real addresses.
- The scanner no longer reaches for the camera when it opens. On a desk machine the browser sat
  in a "connecting a device" state — on Opera worded as waiting for a scanner to be plugged in —
  and the page looked stuck with nothing to say why. In a browser the camera is now asked for
  explicitly, and a machine with no camera is told so in one line.

### Build traps found the hard way

- **The version never reached the native projects.** app.json said 2.1/20101 and the AAB came out
  1.9/1095: both `android/` and `ios/` take the version at prebuild, which neither `expo run:*`
  nor Gradle re-runs. `scripts/patch-native-version.js` syncs it and never downgrades.
- **`OutOfMemoryError: Metaspace`** in `:expo:lintVitalAnalyzeRelease` — heap was fine, metaspace
  was not, and it fails at release only. Run `./gradlew --stop` after changing the JVM args or
  the running daemon keeps the old ones.
- **Cloud Storage write-once needs `resource == null`.** `allow update: if false` does not stop an
  overwrite there; verified live before trusting it.
- **`firebase deploy` refuses a hosting `public` path outside the project directory** while
  `firebase serve` accepts it — so serving locally is not proof the deploy will work.
