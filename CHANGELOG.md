# Changelog

Kept by hand. Each entry says what changed and, where it matters, **why** — the reasoning is
the part that stops the next person undoing it.

## 2.57 — 8 October 2026

Android versionCode 20571 · iOS build 20571.

- **A date can be cleared** — the × at the end of a set date field on the item screen
  (`SimpleDatePicker` `onClear`, every `DateField` in ItemDetail), and **Clear this date on all
  selected** in Set dates (`BulkPatch` field `null`). Asked for by a vessel (8 Oct 2026) that had
  put next inspection dates where the expiry belonged and could only replace them, never remove
  them. Cleared to a missing key, never `''`: `complianceDate` falls back with `??`, so an empty
  string would have left the item judged by a date it no longer has. Open to every role that can
  edit an item, not only the Master — anyone who can change a date to any other value can already
  do more harm than removing it, and the snapshot taken before Set dates covers a slip.

## 2.56 — 8 October 2026

Android versionCode 20561 · iOS build 20561.

- **Set dates on several items at once** (`services/bulkEdit.ts`, the multi-select on a category
  list — long-press an item or the tag button, then **Set dates** beside Print labels). Asked for by
  a vessel (8 Oct 2026) for the weeks after annual servicing, when thirty or forty items come back
  with the same inspection date. Sets next inspection and/or expiry and can add a comment under each
  item's own; a field left blank keeps every item's value. Edits the items in place — same id, so
  the printed QR labels, photos, certificate links and signed inspections stay exactly where they
  were — and takes a snapshot first, like an import, so it can be rolled back from Settings → Data.
  An item that already holds the date is not touched (no `updatedAt` bump, so sync sees no edit).
  `npm run check:bulk`.
- **Terms of Use, version 2** (`constants/legal.ts`, `LEGAL_VERSION` 1 → 2, so every user accepts
  them again on the next launch — the consent screen is the explicit acceptance). Three additions:
  who provides the app (KukaLab is the trading name of Mykhaylo Osypov, autónomo in Spain — a
  trading name owns nothing, so the Terms must name the person); **Feedback** — suggestions and
  ideas users send are assigned to him, with a perpetual licence as the fallback where assignment
  is not possible, and a request not to send the vessel's or employer's confidential information;
  **Governing law** — Spain, without taking away a consumer's mandatory home-country protection.
  Both documents now name the provider in full — name, NIF and address (`PROVIDER`), as Spain's
  LSSI art. 10 asks of the Terms and GDPR art. 13 of the Privacy Policy's controller. One constant,
  so a move to a business address is a one-line change. Both dated 7 October 2026.

## 2.55 — 7 October 2026

Android versionCode 20551 · iOS build 20551. Submitted to the App Store and Google Play 7 October 2026.

- **Two more icons for a vessel's own headings: dive equipment and cylinders** (Settings →
  Categories, `ICONS` in `CategoriesEditSc`). Asked for by a vessel adding its dive locker
  (7 Oct 2026). `diving-snorkel` rather than `diving-scuba-mask`, which at picker size reads as a
  box on a hose; `gas-cylinder` — a bottle with its valve, as the vessel drew it — rather than
  `diving-scuba-tank`, whose regulator hose makes it a dive set only.
- `npm run check:icons` now checks the picker list too. It used to cover the built-in categories
  and the glyph map only, so a mistyped picker name would have shown as a question mark on the web
  with nothing to say so.

## 2.54 — 5 October 2026

Android versionCode 20541 · iOS build 20541. Submitted to the App Store and Google Play 5 October 2026.

- **Under a deck, items run by their item number** (`compareNumber` inside `groupByPlace`, 5 Oct
  2026). A vessel that numbers its gear numbers it in walking order ("14-BD … 18-BD" along the
  Bridge Deck); under a deck the rows ran by location name A–Z and then by soonest date, so its own
  screenshot read 17, 16, 15, 14, 18. Now: number first; location (under a deck) and date only for
  what is left equal; unnumbered items after the numbered ones. A series code after the number
  counts as the series — "17-BD" sorts as "BD 17" — so 01-BD … 18-BD run together and the fire
  blankets 01-FB … follow as their own run instead of interleaving. Natural number order throughout
  (2 before 10). The first attempt the same morning ordered by number only WITHIN one location,
  which did not touch this case; it never reached the stores.

## 2.53 — 5 October 2026

Android versionCode 20531 · iOS build 20531. Submitted to the App Store and Google Play 5 October 2026.

### Asked for by a vessel going through 2.52 (3 October 2026)

- **Position headings are the DECKS** (`services/placeGroups.ts`, `CategoryItemsSc`). The vessel
  keeps its equipment as Deck → Location → item ("Main Deck → Main Deck Aft → Lifebuoy No. 1"); the
  list grouped by the Location column alone, so the Deck column it had filled in showed nowhere as
  a heading. Sorted by Position, a category that records any deck is now headed deck by deck, the
  rows under a deck run location by location, and the row's second line says the location only (the
  heading has said the deck). Items with no deck go last under "— No deck". A category with no
  decks at all — the reference workbook has no such column — keeps its location headings.
  Headings are in natural order (`comparePlace`): "Deck 2" before "Deck 10", "01 Sun Deck" before
  "02 Bridge Deck", so a vessel orders its decks by numbering them in Excel. Two spellings of one
  deck are one heading (`deckKey`, the same rule the label batches use). The Dashboard's own
  Position sort is unchanged.
- **The blank template has Expiry AND Next Inspection, and a Quantity, on every sheet**
  (`templateHeadings` in `services/registerSheet.ts`). It offered only the date its category is
  judged by, and Persons instead of Quantity, so the Liferafts sheet had no column for an HRU's
  expiry or how many there are. Nothing changed in the importer — it has always read both headings,
  so a vessel can also just add those two columns to the workbook it already has. A row with only
  an Expiry is judged by it (`complianceDate` falls back); a row with both is still judged by its
  category's own date, and the other is kept on the item screen.
- `npm run check:places` covers both: the headings, and a Liferafts sheet built from the template
  (raft + HRU) through the real importer and through Update.

## 2.52 — 2 October 2026

Android versionCode 20521 · iOS build 20521.

### Lifting & Mooring is switched on

`MODULES.lifting` is now `true` (constants/modules.ts): the eight lifting and mooring categories,
their checklists, the LIFTING group in reports and the second import template exist for every
vessel on every platform. `check:inspections` was still asserting the first draft's schedule
(monthly + quarterly everywhere); it now asserts the one agreed with the vessel — annual for all,
quarterly as well for mooring and working aloft, nothing monthly — and the general invariant reads
"every category offers at least one round" rather than "at least monthly".

### Asked for by a vessel after its first weeks aboard (2 October 2026)

- **A category opens sorted by Position, not Expiry date** (`CategoryItemsSc`). The list is what a
  crew member walks a weekly or monthly round with, deck by deck; what is falling due already has
  the Dashboard. Position is also first in the sort cycle now. The Dashboard itself still opens on
  Expiry date — that is its job.
- **A revoked account can be deleted** (Accounts → a revoked account → Delete). Revoke was the only
  way to retire an invitation, so the list grew at every crew change and stopped reading as "who is
  aboard". Offered only AFTER revoking, so a working account cannot be deleted by a slip, and it
  replaces "New PIN" on that dialog to stay within Android's three buttons. It deletes the
  invitation only; its devices are removed under Devices → Remove from list, and the dialog says so.
- **The Crew row says when it is not in use.** With "Sign as the device's account" on, signatures
  come from the device's account and the crew list is not consulted — the row's subtitle now says
  that instead of "Who can sign an inspection".

### A register that tripled, and a way to clear a category (2 October 2026)

- **Update from Excel no longer re-adds rows that have neither a number nor a location**
  (`twinKey` in `services/registerUpdate.ts`). Such a row matched nothing — `detailsKey` refuses it,
  rightly, as an identity — so it was ADDED on every update while the copy already held was listed
  as "not in this file". Load the same workbook three times and the category held three of
  everything; and once copies existed, a serial stopped being unique and stopped matching too.
  Those rows are now paired, in order, with an item that says exactly the same (type, make, size,
  serial, deck) — the answer the ten identical lifejackets in one locker already got. The existing
  check "a serial shared by two items matches neither" changed with it: still no match BY SERIAL,
  but the row is no longer added as a third copy. `npm run check:register` has the tripled case.
  The repair for a vessel already affected is the screen it already has: Update → "In the register,
  not in this file" → Remove these N. The originals are the ones kept, so labels and history hold.
- **Clear category** (the sweep icon on a category's list, Master only — or a device on no vessel).
  Asked for by the same vessel, and useful during setup generally. Takes a snapshot first (Settings
  → Data rolls it back), says how many items go and that on a syncing device they go for the whole
  vessel, and says what nobody thinks of: the printed labels of that category stop resolving.
  Signed inspections stay.

## 2.50 — 29 September 2026

Android versionCode 20410 · iOS build 20410.

### The lifting register: its own template, its own fields on screen

- **A separate import template** (Settings → Data). The vessel asked for one and the columns settle
  it: the lifting book has SWL, breaking load, diameter, material, two certificate numbers and three
  dates, and shares almost nothing with the LSA/FFE sheet. `exportTemplate(group)` builds either;
  the lifting book is `MSM_Lifting_Template.xlsx`, one sheet per category, with the vessel's own
  column names so the register they already keep imports without being retyped. The second download
  row appears only when the module is on.
- **The item screen shows the lifting fields for lifting categories only** — markings, SWL/WLL,
  breaking load, diameter, material, both certificate numbers, installed and last-inspection dates —
  in the order the vessel's register has them. Quantity, Persons and Manufacture date are not asked
  there: a form full of fields that never apply is a form people stop reading.
- **The label carries the SWL and the colour code.** The vessel said the first few columns of their
  register are the identification, and on a sling that is what the sticker is for: the SWL joins the
  compliance date as a prominent line, and the whipping colour sits with the category and location.

### The lifting register reads the vessel's own spreadsheet

The vessel sent its real lifting and mooring register — 16 columns, three sections, and the units a
ship actually writes ("22 kN", "140kg", "9.9 t", "2200kg", "31 -37 KN"). It is kept at
`design/jez-lifting-register.tsv` and `npm run check:lifting` imports it through the real importer,
because a mapper proved against invented data is worth nothing.

- **Nine typed fields** on `EquipmentItem`: `swl`, `mbl`, `diameter`, `material`, `marking`,
  `mfrCertNo`, `testCertNo`, `installedDate`, `lastInspection`. Asked for by the vessel, and right:
  a register kept in free text cannot drive a reminder, be printed on a label or be searched.
  **Loads stay strings** — the gear is marked "22 kN" or "9.9 t", and a label that printed our
  arithmetic instead of the marking would be the wrong number to compare against the sling.
  "N/A" is read as "there is none", not as a value.
- Three importer faults the real file exposed, all of which would have mangled it silently:
  - **"Manufacturer" was read as the manufacture DATE.** `make` is only claimed outright when a
    column is literally called "Type"; this register calls it "Equipment Name", so `make` fell
    through to the keyword pass where `/manufactur/i` took it for `manufactureDate`. A bare
    "Manufacturer" is now claimed first.
  - **"Next Annual inspection" was not a next-inspection column** — the pattern wanted the noun
    immediately after "next", so the word "Annual" broke it and the date went to extras.
  - **"Size / Length (m)" had no keyword at all**; `size` was matched only as an exact heading.
- The row-sorting vocabulary learned the lifting words (mooring, working aloft, cranes, hooks,
  slings and shackles, chain blocks, lifting eyes), so a sheet named the vessel's way — "Mooring
  lines", not "Mooring Equipment" — still lands in the right category.
- `npm run check:register` still reports the reference workbook at 627 items with an unchanged
  export → import round trip, module on and off.

### Lifting & Mooring — built, and switched off

A vessel asked for lifting and mooring gear to live inside MSM rather than in a second app: one
account, one crew list, one set of labels, one place the evidence is kept. They are right, and the
app was already shaped for it — MSM is a register of CATEGORIES grouped into LSA, FFE and Other, so a
new register is another group.

- `constants/lifting.ts` — the eight categories the vessel listed (mooring, working aloft, cranes,
  hooks & cables, deck slings & shackles, engineering lifting, working aloft anchors, interior
  lifting eyes & beams), each with a monthly check and a quarterly one. Every monthly check asks for
  the SWL/WLL marking and the test certificate, because that is what the gear is inspected against.
- `constants/modules.ts` — **the module ships dark.** Off, its categories are never registered, so no
  screen, report, picker or import sheet knows it exists. Shipping it is one line, and
  `npm run check:inspections` covers the register both ways: with the module off it asserts nothing
  about it is reachable; with it on, that every category is registered, grouped and owes its rounds.
- **Groups are now declared once** (`GROUP_ORDER`, `GROUP_LABEL`, `GROUP_SHORT` in
  constants/categories). Six screens each kept their own copy of the three-group list, which is how a
  fourth register would have appeared in the equipment grid and nowhere else. They all read the
  shared one now, so the module needs no screen changes at all.
- Not yet: typed fields for SWL/WLL, the last proof test and its certificate. `extra{}` carries them
  today and `nextInspection` already drives the reminder; the labels are being settled with the
  vessel's own register rather than invented here.

### Glyphs everywhere, no emoji

Settings showed five question marks in a column — Categories, Print QR labels, Checklists, Scan QR
label before signing and Sounds — because `GlyphBadge` maps an emoji to a monochrome glyph and those
five had never been added to the map, so they fell through to `help-circle-outline`. Five "?" in a
row reads as five broken features.

- The seven missing mappings are in, each checked against the MDI set — an invented name renders as
  an empty square, which is worse than a question mark.
- **The emoji indirection is gone from the screens.** Where the code said
  `<GlyphBadge emoji="🗂️">` it now says `<IconChip name="view-grid-outline">`, which is how the rest
  of the app has always worked. The map stays for the two places where the emoji is DATA (the manual
  and getting-started sections), not a spelling of an icon.
- **Raw emoji rendered as text are gone too**: the Dashboard strip headers (🛠 🚩 📷), the attachment
  and certificate badges (📎 📜), the lock, the compressor's timer, the anchor on the consent screen,
  the file placeholders, the ZIP button and the manual's warning note are all glyphs now. An
  attachment count shows as a number beside one paperclip rather than as a row of them.
- `✓`, `✕` and `★` stay — typographic marks, not emoji, and consistent with the rest.

### The version can no longer be typed twice

An archive went to the App Store carrying the previous build's numbers. `patch-native-version.js`
has synced app.json into the native projects since September, but only when something runs it
(`postinstall`, `npm run aab`) — and an archive made from Xcode runs neither.

`scripts/patch-ios-version-phase.js` adds a Run Script build phase, **first** in the app target, that
runs the sync before anything is compiled. Xcode can now no longer produce a build whose version
disagrees with app.json, whoever presses Archive. `alwaysOutOfDate` is set because the phase has no
inputs Xcode could reason about and would otherwise be skipped as up to date — which is the exact
failure it exists to prevent. Re-applied by `postinstall`, since `ios/` is CNG and prebuild takes the
phase with it; the target is looked up by name because its UUID is minted at prebuild.

Verified by breaking it on purpose: the Info.plist was set to 0.1/1, an ordinary Xcode build was run,
and both the source plist and the built app came out 2.50/20410.

## 2.49 — 29 September 2026

Android versionCode 20409 · iOS build 20409.

### Rectified defects now reach the other devices

A vessel closed its test defects on the Master and they stayed outstanding everywhere else — for
eleven days, as its own cloud copy showed (`open: true`, no rectification, `updatedAt` never moved).

`pushInspections` kept a list of record ids it had already sent and skipped them. That is right for
the inspections themselves, which never change — and wrong for the ONE mutation the trail allows: a
defect going open→closed rewrites a record that had of course already been sent. The closure was
recorded, stamped and signed on the Master's device, and never left it.

What is remembered is now the `updatedAt` that was sent, and `unsentInspections` (pure, checked)
sends a record when it is new **or has moved since**. The old id-only list migrates to a stamp of 0,
so every record goes up once more — which is exactly the repair wanted: **the vessel's stuck
rectifications deliver themselves on the first sync after the update**, with no re-doing by hand.

### The report signs itself off

"Checked by / Rank / Date" at the foot of an inspection report was three blank rules. The vessel does
not print these — they are uploaded straight into the PMS — so a blank line meant every export
needed a human pass before it could be filed, while every record in it already carried who signed it
and their rank.

`signoffFor` (pure, in services/inspections so the check script can reach it) fills the line from the
records themselves: one signer named outright, several all named, more than three named with a count
of the rest. The rank is printed only when it is not in dispute — one person, or several holding the
same rank — because a single rank over several names is wrong for somebody. The date is the LAST
round in the report, not today, so re-exporting September's report in November does not restamp it.
The XLSX summary carries the same three rows.

**The date is built from local parts, not `toISOString`.** A round signed at 00:30 BST is 23:30 the
previous day in UTC, and the report would have filed a night round under the day before — in a
document kept as evidence, on a ship where rounds genuinely happen at night.

### Categories: the vessel's names, and only the ones it carries

- **The Equipment grid shows the full name**, the one saved in Settings. It showed a short form of
  its own invention ("Imm. Suits"), and a heading the vessel added was cut at twelve characters — so
  the two screens disagreed about what a category was called.
- **Any category can be renamed, built-in ones included.** Settings → Categories listed only headings
  the vessel had added, so the twenty-four the app ships could not be worded the way the SMS words
  them. A rename is stored as a vessel row against the SAME key (`applyVesselChange`), so items,
  history and labels never move. Its `sheet` is deliberately NOT renamed: the importer matches
  workbook tabs by that name, and renaming it would leave every existing spreadsheet importing into
  nothing.
- **Hide what the ship does not carry** — a Master-only mode on the Equipment screen itself, where
  you notice the clutter, not buried in Settings. Hidden categories drop out of the grid, the rounds,
  the checklists, the scan rules, the label printing and the reports' "not inspected" lists. Nothing
  is deleted: `CATEGORIES` still holds them, because storage walks it to decide which buckets to
  read, and it is the screens that ask for `visibleCategories()`. Hiding a category that holds
  equipment warns once and says plainly that the items stay on file — "where did my lifebuoys go" is
  a bad five minutes.
- Built-in categories can be hidden but not deleted; only a heading the vessel added can be removed.
- A standalone device (never enrolled) may edit its own categories — it was refused along with the
  crew, and there is no Master aboard to ask.

### iOS 26/27: the app would not open at all

Reported from a vessel: MSM 2.46 dies on launch on an iPhone updated to iOS 27, with
`EXC_BREAKPOINT … UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption` and none of our own
code in the trace — because none of it runs. An app LINKED AGAINST the iOS 26+ SDK (anything built
with Xcode 26/27) that does not declare `UIApplicationSceneManifest` is stopped by UIKit during
start-up, before `didFinishLaunchingWithOptions`. **2.47 and 2.48 have the same fault**; the version
number is irrelevant, the SDK it was built with is what counts. Nothing on the phone can work around
it — only a new build.

- `app.json` now declares a single-scene `UIApplicationSceneManifest` pointing at
  `$(PRODUCT_MODULE_NAME).SceneDelegate`.
- **The manifest alone would have shipped a black screen**, which is the trap in every half-fix of
  this going round: UIKit then expects a scene to own the window while Expo's AppDelegate is still
  creating one from `UIScreen.main.bounds` and attaching it to nothing. So window creation and the
  React Native start-up move into a `SceneDelegate`, which also replays the cold-start URLs and user
  activities — otherwise opening the app by scanning a `msm://` label would land on the dashboard
  instead of the item.
- `scripts/patch-ios-scene-lifecycle.js` (postinstall, idempotent) applies it to the generated
  AppDelegate, because `ios/` is CNG and a hand edit is deleted by the next prebuild. It refuses
  loudly rather than silently if Expo changes the template.
- Verified on an **iOS 27 simulator**, not by reading: the unfixed build is killed at launch; the
  fixed one reaches the JS runtime with its window attached.
- Expo adopts this itself from SDK 57.0.23. On the next SDK upgrade, check the generated AppDelegate
  and delete the script rather than patching a file that no longer needs it.

## 2.48 — 27 September 2026

Android versionCode 20408 · iOS build 20408.

Shipped after 2.47 was already in the stores, which is the reason for the number: the whole point
of the change below is to say WHICH build a device is running, and two different builds both
calling themselves 2.47 would have made the new line lie on its first day.

### Which build a device is actually running

- **`refresh` now re-records `appVersion` and `platform` on every connection** (`functions/index.js`,
  `services/enrolment.ts` sends them). They were written once, at enrolment, and never again — so a
  phone that joined on 2.3 and has updated four times since still read as 2.3. That is worse than no
  version at all: it is the number a Master would use to decide whether an old build is why somebody
  cannot find the round they set up. Written only when present, so an older client that does not send
  them keeps what enrolment recorded rather than having it erased.
- **Accounts shows it per device** — "v2.47 · up to date" or "v2.3 · update to 2.47", amber only when
  something is behind. The yardstick is the newest version anybody aboard is running, including this
  device (`utils/version.ts`), because the app cannot ask a store what the latest release is and a
  hard-coded number would be a lie the day after it shipped. It understates rather than overstates:
  nobody is nagged about a build that does not exist yet, and a whole vessel being behind shows the
  moment one device updates.
- Versions compare part by part as NUMBERS. As strings "2.3" sorts after "2.47", which is how a
  version check ends up telling the newest phone on the ship to downgrade. Checked in
  `npm run check:inspections`.

## 2.47 — 25 September 2026

Android versionCode 20407 · iOS build 20407.

A customer's third round of notes from a month of real weekly and monthly rounds aboard,
including their first full monthly fire-extinguisher inspection filed through the app.

### The schedule is the vessel's, per category

- **Quarterly rounds**, beside weekly and monthly (`ADDABLE` in ChecklistsSc, `quarterWindow` /
  `stepPeriod` in services/inspections, a Quarterly chip on Reports). A quarter is a CALENDAR
  quarter for the same reason a month is a calendar month: a round done on 30 September does not
  cover the quarter that starts the next day. Annual is still out on purpose — an annual service is
  a shore job with a certificate behind it, and the Certificates tab is where that evidence lives.
- **Every frequency can be switched off per category** (`ChecklistTemplate.off`, `roundsFor`,
  a switch on each row of Settings → Checklists). Until now a category owed every round the app
  shipped a checklist for, so a ship that checks its hydrants weekly but its escapes quarterly
  read as permanently behind — and a schedule nobody can complete is a schedule nobody trusts.
  Switched off, the round is not offered on the item and the report stops COUNTING it as due;
  records already signed keep their period and still print.
- **It is a tombstone row, not a deletion, and that is the point.** Templates sync by union of
  ids (`mergeTemplates`) and nothing deletes the vessel's copy in Firestore, so a row deleted on
  the bridge came back on the next pull. Same bug, same fix for **"use the standard checklist
  again"** (`standard: true`): withdrawing a vessel's own wording used to last about a minute
  before the vessel handed it back. `off` and `standard` are separate fields because they are
  independent — a vessel can word a round, stop it for a season, and expect its own words back.
- `periodsFor` no longer falls back to `['monthly']` when a category has rounds but all of them
  are off. The fallback existed for categories with no checklist at all, which is still honoured
  (a vessel's own heading gets the generic monthly round); keeping it after this change would have
  silently overruled the Master.

### Scan before signing, per category

- **`SigningPolicy.scanExempt`** + Settings → **Scan by category** (`screens/ScanRulesSc.tsx`).
  Asked for in these words: a rescue boat's inventory and the loose gear in a fire locker are worth
  keeping and checking off item by item, but nobody is going to label every bailer and spanner. One
  switch for the whole register meant the honest choices were to label a hundred small items or to
  turn the rule off for the extinguishers too — which is not a rule. `signingGate` now takes the
  item's category, and `scanRequiredFor` answers for the vessel when no category is named.
- Stored as the EXEMPT list, so a category added next month is covered by default: the rule must
  not quietly stop applying to new equipment. Exempt is not "unverified" either — a scan made
  anyway is still stamped on the record and still printed in the report's Scan column.

### Renaming a device — the bug, and the rank

- **The rename sheet closed the moment you touched a field.** The sheet sat INSIDE a full-screen
  `TouchableOpacity` backdrop and relied on `onStartShouldSetResponder` to swallow taps meant for
  the inputs; on react-native-web — the bridge browser, where this screen is mostly used — that
  claim does not stop the click reaching the Touchable underneath. The backdrop is now an
  absolutely-positioned SIBLING behind the sheet, so a tap that landed on the sheet cannot reach it
  on any platform, with nothing to get right.
- **Rename is a button on the device row**, not the fourth option in an action sheet. It is what a
  Master comes to that list to do at every crew change.
- **Renaming is Master-only, in the rules as well as the UI** (firestore.rules: a device may no
  longer change its own `firstName` / `lastName` / `position`). The name stopped being cosmetic when
  `signAsDevice` arrived — with that rule on, the name on the device record IS the signature on
  every inspection it files, so a crew member who could rename their own handset could sign as the
  Master. **The rules must be re-pasted into the Firestore console for this to bite**
  (`npm run deploy:rules`).
- The sheet's note now says what renaming actually DOES on this vessel: with `signAsDevice` on it
  names who the next round will be signed by, which is exactly why the customer wanted it at a
  crew change; with the rule off it is a label and signatures come from the crew list.

### Cloud functions moved to Node 22

Google decommissions the Node.js 20 runtime on **30 October 2026**, after which nothing deploys
until it is bumped — including an urgent fix. Done now rather than then: `functions/package.json`
`engines.node` and `firebase.json` `runtime` are **nodejs22**, and **firebase-functions is 7.4**
(the CLI had been warning about 6.x). `enrol`, `refresh` and `sweepPhotos` all redeployed and were
smoke-tested against the live endpoints afterwards — argument validation, a refused PIN and the
`reenrol` success payload all answer as before, and the sweep ran a full pass on the new runtime.
Minting a custom token is the one path that cannot be exercised without a real device secret.

**firebase-admin deliberately stays on 12.7.** Version 14 removes the namespaced API
(`admin.firestore()`, `admin.auth()`, `admin.storage()`) in favour of `firebase-admin/firestore`
and friends — five call sites, three of them on the enrolment path that every device on every
vessel depends on, and `createCustomToken` cannot be tested before a real enrolment. That belongs
in its own change, made when a device is on hand to try it, not bundled into a deadline-driven
runtime bump. 12.7 is not deprecated and runs on Node 22.

### Photo retention — 90 days in the cloud, then the vessel's own archive

Asked for on 25 September: keep inspection photographs in the cloud for two or three months and
have the rest backed up locally.

- **The window is 90 days** (`services/photoArchive.ts` `RETENTION_DAYS`). Older photographs are
  deleted from Cloud Storage by a nightly scheduled function, `sweepPhotos` in `functions/`.
- **Nothing is deleted from a period the vessel has not archived.** The cutoff is
  `min(now − 90 days, photoArchive.archivedThrough)`, and no `archivedThrough` means a cutoff of
  **0 — delete nothing**, never "delete everything". A photograph is evidence for a signed record,
  and after a sweep the only copies are the vessel's archive and whatever the crew's own devices
  hold; a job that deleted the last copy of evidence because a ship was slow to archive would be
  indefensible. A vessel that never archives keeps paying for storage instead, which is a bill and
  not a loss.
- **Settings → Inspection photos → Photo archive** (`screens/PhotoArchiveSc.tsx`). One ZIP per
  calendar month — `photos_2026-09/<date>_<category>_<item>.jpg`, `index.csv` (item, serial,
  position, round, outcome, signer, status) and a README for whoever opens it in two years without
  MSM to hand. Per month because a browser cannot hold a year of JPEGs in memory, and because
  "where are September's photos" is the question that actually gets asked.
- **Save, then confirm — two steps, deliberately.** The app cannot see where a saved file went, so
  it does not pretend to: the Master confirms, and the confirmation is worded as what it authorises
  (the originals may now be deleted). Months are archived in order — `archivedThrough` is a single
  watermark, so marking October while September is unsaved would hand the sweep permission it must
  not have (`canMarkArchived`).
- **A missing photo does not fail the archive, it is recorded in it.** One unreadable file — never
  uploaded from a handset since wiped — would otherwise keep a vessel from ever archiving anything,
  and a sweep gated on archiving would then never run. `index.csv` carries a Status column and the
  count comes back in the confirmation.
- **The sweep deletes by the RECORD's date, not the object's age**, which is why it is a function
  and not a bucket lifecycle rule: the queue holds photographs until the ship has Wi-Fi, so a round
  done in March can upload in May. Each night it reads only the band since `sweptThrough` (with a
  30-day overlap for exactly those late uploads) rather than every record ever signed, and it lists
  the collection with `select('photoArchive')` because a vessel document carries the whole register
  as one string field.
- `photoArchive` is a Master-only field in **firestore.rules**, beside `entitlement` and
  `signingPolicy` and for a sharper reason than either: a crew device that could claim "everything
  up to today is archived" could have the vessel's evidence erased overnight. **storage.rules is
  unchanged — no device may delete a photograph**; only the job may, with admin credentials.
- Local copies are never touched, anywhere. After a sweep the original on the phone that took the
  photo, and the copy another device fetched to view it, are real copies of evidence rather than a
  cache.
- An archived record says so instead of showing a pending-upload icon (`InspectionDetailSc`): "in
  the vessel's own archive for September 2026" — "not uploaded yet" and "kept by the vessel" are
  different facts and the screen now tells them apart.
- `npm run check:inspections` covers the retention logic — the cutoff with and without an archive,
  the window boundary (a month is offered only when it is COMPLETELY out of it), the watermark
  never moving backwards, and the counts the screens show. 141 checks.

**Deploy:** `cd functions && npm run deploy` (first deploy enables Cloud Scheduler), then
`npm run deploy:rules` for the Firestore change.

### Smaller things asked for

- **"Clear all"** beside "All pass" on the inspection screen: one confirmation clears every answer,
  the comment and the defect note. Evidence photos stay — a photograph was taken of something real,
  and "clear the form" is not what anybody means by deleting it; the thumbnails have their own
  remove control.
- **The Vessel card in Settings stays collapsed once the vessel is identified.** It opened on every
  visit showing five filled fields and a live "Save vessel info" button, which reads as an unsaved
  form — the app asking again for what was entered weeks ago. It now opens only while the five
  fields are incomplete, shows "Vessel name · IMO …" when collapsed, and the button is disabled and
  reads "Saved" until something actually changes. A card opened by hand survives the vessel arriving
  from storage a moment later (`touched`), or the effect would shut it under the user's finger.
- `writeSigningPolicy` (services/policy.ts) is now the one path that stores the rule locally and
  pushes it to the vessel. It was inline in SettingsSc, and the per-category screen would have been
  a second copy of "store it, push it, explain a failed push" — with the error handling as the half
  that drifted.
- `npm run check:inspections` covers the new pure logic: round resolution with `off` / `standard`,
  the tombstone surviving a merge against an older row, calendar quarters and stepping, and the
  category-aware scan gate. 117 checks.

## 2.46 — 19 September 2026

Android versionCode 20406 · iOS build 20406.

A customer's second round of testing notes, answered in one release.

### The signature is the device

- **Sign as the device's account** (`SigningPolicy.signAsDevice`, Settings, Master-only like the scan
  rule). An Officer could scan an item on their own phone and then pick a colleague's name from the
  list, so a signature said nothing about whose hands the phone was in. With the rule on, an
  enrolled device signs as the person it was issued to — the name and rank on its account, read
  live from the vessel — and the picker is not offered. The Master changes who a device belongs to
  where the devices are, Settings → Accounts (rename). `signerRule` is pure and checked: a device on
  no vessel still picks (it has no account); an enrolled device whose account has not loaded is
  HELD, not let through to the picker — a rule that quietly fell back whenever the network was slow
  would not be one. The record's `byId` becomes `device:<id>`, which nothing looks up (it was always
  allowed to dangle).
- The Master's no-scan override and the report's Scan column already existed (2.44); the customer
  had not found them. Both are now called out in the reply, not changed.

### Smaller things asked for

- **Sounds on/off** (Settings → Modules → Sounds, `prefs.soundsMuted`). Read straight from the
  prefs key when `utils/sound` loads, because the ship's bell plays on the splash before DataContext
  has anything — a mute that let the loudest sound through once per launch would not be a mute.
- **Emergency Escapes** is a built-in LSA category (`emergency_escapes`) with weekly and monthly
  checklists: hatches, routes, signs, lighting, seals, ladders, the gear along the route. Filed
  under Other it was invisible in the LSA report. The importer sorts "escape hatch / route / door /
  ladder", "means of escape" and "emergency exit" rows into it — but "emergency escape breathing
  device" is still an EEBD, which is why the pattern names the things along a route rather than
  the word "escape". 24 categories now.
- **BA cylinder pressure: ≥ 90% of rated (300 bar → ≥ 270 bar)**, was 80%, in both the BA-set
  weekly line and the bottle-pressure monthly line. Wording only; the line ids are unchanged, so
  older records read back correctly. A vessel with a different figure words it in Settings → Checklists.
- **The blank import template now has a sheet for Other Safety Equipment** (named after the label,
  which the importer already matched). It used to be skipped for having no source worksheet — so
  the one category a vessel fills by hand was the one it could not fill from Excel.

## 2.45 — 16 September 2026

Android versionCode 20405 · iOS build 20405.

### One round, one page

- **The inspection report can be narrowed to a category** (`ReportOptions.categories`,
  Reports → Inspections). Under the group, every category that owes the period's round is listed
  with its progress — "5 of 5 inspected · complete", "3 of 12", "failed", "defect open" — tap to
  include or leave out, press and hold to report on that one alone. Asked for by a customer: the
  lifebuoy round, finished, filed in the PMS as its own evidence. The whole-group report answers
  "is the month done"; this one answers "is THIS check done", and a report that also listed forty
  extinguishers nobody had reached yet read as incomplete for a round that was in fact finished.
- The title names what the report holds — "Lifebuoys Monthly Inspection Report", or the group
  followed by the categories when there are several — and a single category names the file after
  itself. A report must never claim more than it contains.

### All the labels at once

- **A batch picker for QR labels** (`screens/LabelBatchSc.tsx`, `services/labelBatch.ts`) — the tag
  button beside the scanner on the Categories tab, and Settings → Print QR labels. A customer
  fitting out a vessel asked for it in so many words: select a category, a deck or a group and get
  every label in one go. The Label screen already knew how to print a batch to a roll, an A4 grid,
  a PDF or the Xprinter; what it lacked was a way to be handed more than one category's items, and
  the long-press multi-select is a thumb's worth of stickers, not a ship's.
- **Decks are the vessel's own words**, read from the register rather than a list, and two
  spellings of one deck ("Sun Deck", "sun deck ") are one chip. An item with no deck recorded is
  still an item that needs a sticker, so it gets a bucket of its own instead of vanishing from every
  filter.
- **Labels come off deck by deck**, then by category and item number. The person sticking them walks
  a deck, not a category, and a roll that follows the walk is the difference between an afternoon
  and a day. Items with no deck print last — they are the ones somebody has to go and find.
- Not gated on rank: printing writes nothing to the register, and the bosun holding the label
  printer is exactly who prints them.
- `npm run check:labels` — the selection and its order, 15 checks.

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

## 2.3 — 6 September 2026

Android versionCode 20301 · iOS build 20301.

- **Two photographs broke syncing for a whole vessel.** In a browser an attachment IS a base64
  `data:` URI inside the item, and the register travels as ONE Firestore document with a 1 MiB
  ceiling: `The value of property "register" is longer than 1048487 bytes`. Files now go to Cloud
  Storage and the register carries a reference. The reference is a download URL rather than a
  path so every existing render site keeps working unchanged — the cost, stated plainly, is that
  such a URL carries its own token, and it lives only inside a register that only members can
  read. An upload that fails is not fatal: the records still go up whole and the file waits.
- **Inspection photographs signed in a browser never uploaded at all.** `uploadPhoto` was written
  around expo-file-system, which reports a `data:` URI as a missing file — so the queue retried
  six times and parked it. On a phone the same URI made `getInfoAsync` THROW, the throw escaped
  the effect, and neither the image nor the "not uploaded" state was ever set: the spinner turned
  for ever. And opening one failed with "You don't have access to the provided file", which was
  true — there was no file; a data URI is now written to one before it is shared.
- **An upload allowance for unlicensed vessels: 25 files.** Unlike the other free-tier caps this
  applies DURING the trial, because it limits what we pay for rather than what the app will do.
  Nothing is refused locally — photographs are taken, kept and backed up as before; what waits is
  the copy for the other devices, and everything held back goes up on the first sync after the
  vessel is licensed. Counted on the vessel document so five phones cannot each spend it.
- **A round mark beside every item**, mirroring the expiry bar: blue not inspected, green signed
  and clear, amber the period is closing, red a defect still outstanding. Red is deliberately not
  tied to the window — a defect raised in March is still a defect in June, and letting the
  calendar clear a red mark would hide exactly what an audit looks for. "This period" joins the
  sort options on both the dashboard and the category list.
- **A device removed from the vessel could not rejoin.** `refresh` refused it with "This device is
  not in the register", but the stale secret kept `enrolled` true — so the app believed it was
  aboard, never offered to join, and showed a "Try again" that could not succeed. The server now
  answers `reenrol`, the client forgets the secret, and "Join this vessel" comes back with the
  reason why.
- Settings rearranged: theme as sun/moon/star and PRO as a badge in the header, joining moved
  behind the "This device" card that already carried its name, the Cloud sync panel removed once
  it had nothing left to say. On web the tab bar moved to the top, and the counters and pickers
  became one row of five under the title.
- **Close worked only when there was something behind it.** `navigation.goBack()` is a no-op on a
  one-entry stack and fails SILENTLY, so the button looked dead. It never showed while people
  tapped their way through the app, and started the moment screens got URLs: open /label directly
  or reload the page on it and the stack has exactly one entry. `utils/nav.ts` goes back when it
  can and to the Dashboard when it cannot — applied to all ten screens that could be reached that
  way, not just the one that was reported.
- **The first splash now shares the MSM cube's teal.** It sat on the app's pale background, which
  made the sequence two screens rather than one resolving into the next.
- **The widgets carry the QR-with-the-cube tile** instead of a line-drawn viewfinder — on a home
  screen among two dozen icons a frame reads as "some utility". The art needed a quiet zone added:
  it puts the code hard against the tile edge, so rounding the corners ate into the finder
  squares, the three marks a scanner uses to find a code at all. Only NEUTRAL pixels were
  whitened; a levels curve across all three channels turned the cube's red and blue into poster
  paint. `.unredacted()` on iOS is load-bearing: WidgetKit blanks every Image and Text into grey
  shapes while it has no timeline, which is right for private data and nonsense for a button —
  that is what a real iPhone was showing.
- **The picker previews were regenerated** from the same tile; they are native Android drawables,
  so they reach the app only through `android/app/src/main/res` (or a prebuild).
- **Version 2.3 / 20301 everywhere.** Two copies had drifted: the widget extension was still on
  1.9 / 1096 in the Xcode project — Xcode warns and App Store Connect refuses an extension whose
  version differs from its app — and the web shell has its own app.json, so the deploy stamp said
  2.2 while the app said 2.3, which tells an open tab it is current when it is not.
  `patch-native-version.js` now covers the project settings, and the stamp reads the app's version.
- **Signing: the project was pointed at the wrong team.** `DEVELOPMENT_TEAM` was VL4B4R8D84, which
  holds only a Developer ID (macOS) certificate — no iOS identity — so Xcode could not issue a
  profile and none existed. app.json's LAGTN99698 has a valid one; with that, automatic signing
  produced the profiles by itself and the app ran on a device.

### Labels for printers that are not ours

- **A custom label size, in millimetres.** The five presets match the printer MSM ships with, and
  for that one a free size picker is a way to waste a roll. But a file handed to another make's
  driver app has to match THEIR roll, and nobody can be told to buy ours. The QR footprint and the
  layout are DERIVED from the two numbers, not asked for: nobody knows what "24 mm of QR" means on
  a roll they have just bought, and getting it wrong prints a code that will not scan in a dark
  engine room. Three limits — the short edge less a margin, 40% of the long edge, half the width.
  The third earns its place on PORTRAIT stock: without it a 40 × 60 label gave the code 24 mm of
  its 40 mm width and the layout dropped the type and serial for want of room.
- **Save as image (600 dpi)** in the browser build. The PDF page is the better carrier because it
  has a physical size, but expo-print cannot make one on web — and a desk machine is exactly where
  somebody sits with another maker's thermal printer and its own app. An image is the one format
  every such app takes. Rendered from the SAME html the print path uses, so there is no second
  renderer to keep in step. Verified end to end in a browser: 2362 × 1181 px, which is 100 × 50 mm
  at 600 dpi exactly.
- The millimetres are in the PNG's file name on purpose: an image carries no page size, so the
  receiving app has to be told what to print it at — and told not to "fit to page".

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
