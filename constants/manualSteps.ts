// GENERATED from /Users/Oxford/MarineSafetyManager/manual/manual.html by manual/to-app.mjs — edit the HTML, not this.
// The step-by-step manual: a screen = where it is in the menu + what can be done there, each a chain of steps.
// In a step, **Label** is the app's own English label (a button or a field); " → " joins a path.

export type StepWho = 'everyone' | 'officers' | 'master' | 'office';
export interface StepAct { t: string; steps: string[]; note?: string; who?: StepWho; perVessel?: boolean }
export interface StepScreen { id: string; title: string; path: string[]; who: StepWho; perVessel?: boolean; intro: string; acts: StepAct[] }
export interface StepGroup { title: string; screens: StepScreen[] }

/** 102 screens, 535 actions. */
export const MANUAL_STEPS: StepGroup[] = [
 {
  "title": "Getting started",
  "screens": [
   {
    "id": "first",
    "title": "First launch",
    "path": [
     "Open the app"
    ],
    "who": "everyone",
    "intro": "The app works on the device straight away, offline and without an account. Joining a vessel comes after, from Settings.",
    "acts": [
     {
      "t": "Open the app the first time",
      "steps": [
       "Read the Privacy Policy and the Terms of Use",
       "Tick **I agree** → **Continue**",
       "The Dashboard opens"
      ]
     },
     {
      "t": "Name the vessel",
      "steps": [
       "**☰** → **Settings**",
       "**Vessel** card",
       "Type the vessel’s name, **IMO**, flag, call sign and MMSI",
       "**Save** — every report prints them"
      ]
     },
     {
      "t": "Bring in your equipment list",
      "steps": [
       "**☰** → **Settings** → **Import from Excel**",
       "Choose your .xlsx — your own layout is fine",
       "Check the preview: how many items in each category",
       "**Import**"
      ],
      "note": "No list yet? On the Import screen tap **Download blank template (.xlsx)**, fill it in, import it back."
     },
     {
      "t": "Switch the theme or the sounds",
      "steps": [
       "**☰** → **Settings**",
       "Sun / moon / star at the top — Light, Dark, Colorful",
       "**Modules** → **Sounds** — off or on"
      ]
     }
    ]
   },
   {
    "id": "menu",
    "title": "Moving around",
    "path": [
     "☰ Menu"
    ],
    "who": "everyone",
    "intro": "The menu groups the screens by what they are for. The order and which groups are open are kept on this device.",
    "acts": [
     {
      "t": "Open a screen",
      "steps": [
       "**☰**",
       "Tap a group heading — **Safety**, **Crew**… — to open it",
       "Tap the screen",
       "A screen with pages (**Drills**, **Fuel**): tap it, then the page"
      ]
     },
     {
      "t": "Find a screen by name",
      "steps": [
       "**☰** → the magnifier",
       "Type part of the name",
       "Tap the screen"
      ]
     },
     {
      "t": "Put the screens in your order",
      "steps": [
       "**☰** → **Edit order** (the arrows button)",
       "**↑** / **↓** beside a screen — within its group",
       "**Done editing order**"
      ],
      "note": "On a phone the first four screens are also on the bar at the bottom."
     },
     {
      "t": "Keep the menu open beside the page (wide screen)",
      "steps": [
       "**☰** → **Pin menu** (the pin)",
       "To hide it again: **Unpin menu**"
      ]
     },
     {
      "t": "Keep a page as a favourite",
      "steps": [
       "Open the page",
       "**★** in the top bar → **Add this page**",
       "Later: **★** → tap it"
      ],
      "note": "On a record (a document, a certificate, an item) the ☆ beside Back does the same."
     },
     {
      "t": "Go back",
      "steps": [
       "**←** at the top",
       "or swipe from the left edge (phone, tablet)"
      ]
     }
    ]
   },
   {
    "id": "join",
    "title": "Joining a vessel and accounts",
    "path": [
     "☰ Menu",
     "Settings",
     "This device"
    ],
    "who": "everyone",
    "intro": "The vessel is its IMO. The first device becomes the Master; the Master gives everyone else an account.",
    "acts": [
     {
      "t": "First device: join as the Master",
      "steps": [
       "**☰** → **Settings** → **Vessel** — the IMO is set",
       "**This device** card → **Join this vessel**",
       "Your name and rank",
       "Enter the joining code from mail@ismpilot.com",
       "**Join** — this device is the Master",
       "Choose the **Master PIN** (not 0000 or 1234)"
      ],
      "who": "master"
     },
     {
      "t": "Give a crew member an account",
      "steps": [
       "**☰** → **Settings** → **Accounts**",
       "**Issue an account** — name, rank aboard, role (Crew / Officer)",
       "**Issue** — the 8-digit PIN is shown",
       "Read the PIN out to the person"
      ],
      "who": "master"
     },
     {
      "t": "Join with your name and PIN",
      "steps": [
       "**☰** → **Settings** → **Vessel** — type the IMO",
       "**This device** → **Join this vessel**",
       "Your name and the 8-digit PIN",
       "**Join** — the device waits for approval",
       "It opens by itself when the Master approves"
      ]
     },
     {
      "t": "Approve a waiting device",
      "steps": [
       "**☰** → **Settings** → **Accounts**",
       "**Devices** — the waiting one is on top",
       "**Approve**"
      ],
      "who": "master"
     },
     {
      "t": "A phone is lost",
      "steps": [
       "**☰** → **Settings** → **Accounts** → **Devices**",
       "Tap the device",
       "**Switch off** — it loses access at once"
      ],
      "note": "Nobody else is affected; no password changes.",
      "who": "master"
     },
     {
      "t": "Leave the vessel on this device",
      "steps": [
       "**☰** → **Settings** → **This device**",
       "**Sign off this device** — keeps the data here",
       "or **Sign off & erase** — clears this device, for one handed on"
      ]
     }
    ]
   },
   {
    "id": "sign",
    "title": "Signing",
    "path": [
     "Any Sign button"
    ],
    "who": "everyone",
    "intro": "Every signature is confirmed by your own signing PIN, your fingerprint, your hand on the screen, or — where the vessel uses them — your NFC wristband.",
    "acts": [
     {
      "t": "Sign the first time on a device",
      "steps": [
       "Tap **Sign**",
       "Choose your signing PIN: 4–6 digits",
       "Repeat it",
       "Signed — next time the PIN alone"
      ]
     },
     {
      "t": "Sign by hand",
      "steps": [
       "Tap **Sign**",
       "**By hand**",
       "Sign with a finger or a stylus",
       "**Done**"
      ]
     },
     {
      "t": "Sign with your wristband",
      "steps": [
       "Tap **Sign**",
       "**NFC wristband**",
       "Hold your own wristband near the phone",
       "Signed"
      ],
      "note": "Only the wristband given to you signs for you. The report prints “signed with NFC wristband”.",
      "perVessel": true
     },
     {
      "t": "Forgot your PIN — on a shared tablet",
      "steps": [
       "Ask the Master",
       "Master: **☰** → **Crew** → **Crew matrix** → **🔒** by your name",
       "Master enters the Master PIN and reads you a one-time code",
       "On the tablet: the code → choose a new PIN"
      ],
      "note": "The code works once, within 15 minutes, for that name."
     }
    ]
   }
  ]
 },
 {
  "title": "Board and logs",
  "screens": [
   {
    "id": "board",
    "title": "Board",
    "path": [
     "☰ Menu",
     "Board"
    ],
    "who": "everyone",
    "intro": "The vessel at a glance, for your rank: what needs attention, the plan, today’s routine and a tile for each section. Red is overdue, amber is coming up, blue is for your information. A device that has not joined a vessel shows the **Dashboard** instead: the register’s expiries.",
    "acts": [
     {
      "t": "See what needs doing",
      "steps": [
       "**☰** → **Board**",
       "**Needs attention** — the worst first",
       "Tap a line — the record or the screen opens",
       "**Show more ↓** for the rest"
      ],
      "note": "A line goes when the thing is done; nothing is ticked off by hand."
     },
     {
      "t": "Follow the plan",
      "steps": [
       "**☰** → **Board**",
       "**Plan** — rounds of the week, month, quarter and year, surveys, services",
       "Tap a row to open it"
      ]
     },
     {
      "t": "Work through today",
      "steps": [
       "**☰** → **Board**",
       "**Today** — the day’s routine",
       "Tap a row and do it — it is ticked when its record is signed"
      ]
     },
     {
      "t": "Open a section",
      "steps": [
       "**☰** → **Board**",
       "**Sections** — a tile per section switched on",
       "Tap the tile"
      ],
      "note": "A coloured top edge on a tile: something in it is due or overdue."
     },
     {
      "t": "Scan a label from the Board",
      "steps": [
       "**☰** → **Board**",
       "The scanner button in the title bar",
       "Point the camera at the QR"
      ]
     }
    ]
   },
   {
    "id": "decklog",
    "title": "Deck Log",
    "path": [
     "☰ Menu",
     "Logs",
     "Deck Log"
    ],
    "who": "everyone",
    "intro": "The bridge watch log, a page per day. An entry is signed by the watch officer and does not change after; the Master endorses it under the signature.",
    "acts": [
     {
      "t": "Write a watch entry",
      "steps": [
       "**☰** → **Logs** → **Deck Log**",
       "**+** (or **New watch entry**)",
       "**AT SEA** or **IN PORT** at the top — tap to switch",
       "At sea: date, period, position, course, speed, weather, sea state, visibility",
       "**EVENT / REMARKS** — what happened",
       "Choose the watch officer",
       "**Sign**"
      ],
      "note": "An empty field asks first: **Save** anyway, or **Go back** and fill it."
     },
     {
      "t": "Keep an entry to finish later",
      "steps": [
       "Fill what you have",
       "**Save** — the entry stays **Unsigned**",
       "Later: tap it on the day’s page, finish it, **Sign**"
      ],
      "note": "Unsigned entries wait on the Board for the officers."
     },
     {
      "t": "Let the gangway and inspections write themselves in",
      "steps": [
       "**+** — the new entry, at the start of the watch",
       "**AUTO** at the top → it turns to **LIVE**",
       "**Save** — the entry waits, still **Unsigned**",
       "Crossings at the gangway (any device), visitors, signed inspections and defects put right appear under **Gangway and inspections since…**",
       "At the end of the watch open the entry, **Sign** — they go into **EVENT / REMARKS**"
      ],
      "note": "Passengers and visitors go in as initials (A…e). Passes of one round are one line; a failure is its own line. Leaving the entry without **Save**, or tapping **LIVE** again, stops it."
     },
     {
      "t": "Say it instead of typing (AI)",
      "steps": [
       "**+** — the new entry",
       "**Say it for the log (AI)** — say or type the position, course, weather, events",
       "**Fill the entry**",
       "**Put into the entry** — check every figure",
       "**Sign**"
      ],
      "note": "No connection: it is done when there is one and waits on the Board. **Save** keeps what you typed meanwhile.",
      "perVessel": true
     },
     {
      "t": "Find an earlier day",
      "steps": [
       "**☰** → **Logs** → **Deck Log**",
       "**←** / **→** beside the date, or tap the date and pick a day"
      ]
     },
     {
      "t": "Endorse an entry",
      "steps": [
       "Open the signed entry",
       "**Master review** → **MASTER / CAPTAIN** — the Master’s name",
       "**Endorse** — the Master signs with their own PIN"
      ],
      "note": "Once endorsed, the review shows name, rank and time.",
      "who": "officers"
     },
     {
      "t": "Share the day’s page",
      "steps": [
       "Open the day",
       "The share button at the top — a PDF of that page"
      ]
     }
    ]
   },
   {
    "id": "enginelog",
    "title": "Engine Log",
    "path": [
     "☰ Menu",
     "Logs",
     "Engine Log"
    ],
    "who": "everyone",
    "intro": "Engine-room rounds, a page per day. The round is a template of figures, each with its normal range; a figure out of range asks for the reason.",
    "acts": [
     {
      "t": "Record a round",
      "steps": [
       "**☰** → **Logs** → **Engine Log**",
       "**+** (or **Start new round**)",
       "Type each reading — the last one and the normal range are shown beside it",
       "**Remarks** — machinery running, changeovers, alarms",
       "**Sign & save round**"
      ],
      "note": "A reading out of range: **Add a remark** to say why, or **Sign anyway**."
     },
     {
      "t": "Leave a round for an officer",
      "steps": [
       "Fill the round",
       "**Leave for an officer to sign**",
       "The officer opens it from the Board on their own device and signs"
      ]
     },
     {
      "t": "See the trends",
      "steps": [
       "**☰** → **Logs** → **Engine Log**",
       "The chart button at the top",
       "The last 14 readings of each figure: green band = normal, orange point = out of it"
      ]
     },
     {
      "t": "Change the round’s figures",
      "steps": [
       "**☰** → **Logs** → **Engine Log**",
       "The gear button — **Round template**",
       "**Add parameter** — name, unit (blank for text), **Normal min** / **Normal max**",
       "Pencil to change one, red minus to drop one",
       "**Save template**"
      ],
      "note": "Rounds already signed keep their figures.",
      "who": "officers"
     },
     {
      "t": "Share the day’s page",
      "steps": [
       "Open the day",
       "The share button — **Share the page (PDF)**"
      ]
     }
    ]
   },
   {
    "id": "gmdss",
    "title": "GMDSS Log",
    "path": [
     "☰ Menu",
     "Logs",
     "GMDSS Log"
    ],
    "who": "officers",
    "intro": "The radio log: daily, weekly and monthly checks, radar on and off, and events. The pills at the top show when each check was last done and whether it is due. Every entry is signed and stays as written; the crew can read it.",
    "acts": [
     {
      "t": "Daily check",
      "steps": [
       "**☰** → **Logs** → **GMDSS Log**",
       "**Daily**",
       "Tick each check; batteries — **Charged** / **Charging**",
       "**RECORDED BY** — your name",
       "**Sign & Save**"
      ]
     },
     {
      "t": "Weekly check or monthly inspection",
      "steps": [
       "**Weekly** or **Monthly**",
       "Tick each line, add a note if needed",
       "**RECORDED BY** → **Sign & Save**"
      ]
     },
     {
      "t": "Radar on or off",
      "steps": [
       "**Radar**",
       "**Radar ON** or **Radar OFF**, the **BAND**",
       "Closing the watch in port: tick **Radio watch closed**",
       "**Sign & Save**"
      ]
     },
     {
      "t": "Record a distress call or any event",
      "steps": [
       "**Event / note**",
       "What, who, MMSI, time UTC, channel, what you did",
       "**Sign & Save**"
      ]
     },
     {
      "t": "Print a month",
      "steps": [
       "The month picker at the top — choose the month",
       "**PDF**"
      ]
     }
    ]
   }
  ]
 },
 {
  "title": "Equipment & inspections",
  "screens": [
   {
    "id": "equipment",
    "title": "Equipment",
    "path": [
     "☰ Menu",
     "Equipment & maintenance",
     "Equipment"
    ],
    "who": "everyone",
    "intro": "The registers — LSA, FFE, Other, Lifting & Mooring — as a grid of categories. Each item has its number, type, make, serial, deck, location and its dates.",
    "acts": [
     {
      "t": "Add an item",
      "steps": [
       "**Equipment** → the category",
       "**＋**",
       "**Item No.**, **Type / Description**, **Make**, **Size**, **Serial / ID**, **Deck**, **Location**",
       "**Next inspection** and/or **Expiry** — tap the field, pick the date",
       "**Save**"
      ]
     },
     {
      "t": "Add several identical items",
      "steps": [
       "Save the first one",
       "**Duplicate item** at the bottom",
       "The copy has the next number: type its serial",
       "**Save** — again for the next"
      ]
     },
     {
      "t": "Set the same dates on many items (after a service)",
      "steps": [
       "**Equipment** → the category",
       "Hold one item — selection starts",
       "Tick the others, or **All**",
       "**Set dates**",
       "Next inspection / Expiry / a comment — blank keeps each one’s own",
       "**Save**"
      ]
     },
     {
      "t": "Attach a photo or a certificate",
      "steps": [
       "Open the item",
       "**Photos & documents** → **＋ Add**",
       "Take a photo, pick one, or choose a document"
      ]
     },
     {
      "t": "Record a replacement",
      "steps": [
       "Open the item",
       "**Lifecycle** → **Replaced…**",
       "Whole unit or a part, why, the date",
       "The new serial and dates — the old ones are shown beside",
       "**Sign** — the item keeps its QR label"
      ],
      "who": "officers"
     },
     {
      "t": "Flag it for a second look",
      "steps": [
       "Open the item",
       "**Flag** by the status",
       "A short note on why",
       "Cleared later from **Dashboard** → **Flagged**"
      ]
     },
     {
      "t": "Put it on the ship’s plan",
      "steps": [
       "Open the item",
       "**Put on the plan**",
       "Choose the deck, tap where it is kept",
       "**Save here**"
      ],
      "who": "officers",
      "perVessel": true
     },
     {
      "t": "Hide categories the vessel does not carry",
      "steps": [
       "**Equipment** → **Show or hide categories**",
       "Tap the ones you do not use",
       "**Done** — nothing is deleted"
      ],
      "who": "master"
     }
    ]
   },
   {
    "id": "labels",
    "title": "QR labels and the scanner",
    "path": [
     "☰ Menu",
     "Equipment & maintenance",
     "Equipment"
    ],
    "who": "everyone",
    "intro": "Every item is labelled by its own id: a reprint is the same code. Use the app’s scanner — the phone’s camera cannot open the code.",
    "acts": [
     {
      "t": "Print one label",
      "steps": [
       "Open the item",
       "**Print label**",
       "Choose the stock (100×50 or 50×30 mm)",
       "**Print**"
      ]
     },
     {
      "t": "Print a batch, deck by deck",
      "steps": [
       "**Equipment** → the tag button beside the QR",
       "Pick a group, tick decks and categories — the count shows",
       "**Next**",
       "Choose the stock and the printer (Xprinter, thermal roll, A4 sheet, PDF)",
       "**Print**"
      ]
     },
     {
      "t": "Find an item by its label",
      "steps": [
       "QR button in the header (**Dashboard** or **Equipment**)",
       "Point at the label — the item opens",
       "Damaged label? Type the digits under it"
      ]
     }
    ]
   },
   {
    "id": "inspect",
    "title": "Inspecting an item",
    "path": [
     "Scan the label",
     "the item"
    ],
    "who": "everyone",
    "intro": "A signed inspection is never changed. A mistake is put right by inspecting again — both stay on file.",
    "acts": [
     {
      "t": "Inspect",
      "steps": [
       "Scan the item’s label (or open it from its category)",
       "**Weekly** / **Monthly** / **Quarterly** / **Annual**",
       "Each line **PASS** / **FAIL** / **N/A** — or **All pass** and change what is wrong",
       "A comment, up to four photos",
       "**Sign**"
      ],
      "note": "Any FAIL raises a defect on the item."
     },
     {
      "t": "Start again before signing",
      "steps": [
       "**Clear all** beside **All pass**",
       "Confirm — answers and notes go, photos stay"
      ]
     },
     {
      "t": "Sign without the scan (Master)",
      "steps": [
       "The vessel asks for a scan, and the label is missing",
       "**Sign** → **Not scanned**",
       "Say why — label missing, item out of reach",
       "**Sign** — the reason prints beside the signature"
      ],
      "who": "master"
     },
     {
      "t": "Check a photo with AI",
      "steps": [
       "On the inspection, add the photo",
       "**Check the photo (AI)**",
       "Read what it says — the signature stays yours"
      ]
     }
    ]
   },
   {
    "id": "defects",
    "title": "Defects",
    "path": [
     "Dashboard",
     "Open defects"
    ],
    "who": "everyone",
    "intro": "A defect is the failed inspection that raised it: what failed, who found it, when.",
    "acts": [
     {
      "t": "Put a defect right",
      "steps": [
       "**Dashboard** → **Open defects**",
       "Tap the defect",
       "**Record rectification** — what was done",
       "**Sign**"
      ],
      "who": "officers"
     },
     {
      "t": "See the ones already put right",
      "steps": [
       "**Open defects** → the **Rectified** toggle"
      ]
     }
    ]
   },
   {
    "id": "rounds",
    "title": "Inspection rounds",
    "path": [
     "☰ Menu",
     "Equipment & maintenance",
     "Inspection rounds"
    ],
    "who": "everyone",
    "intro": "A round is the shared to-do list of one period — this week, this month — for the categories it covers. Everyone works in it from any device.",
    "acts": [
     {
      "t": "Start a round",
      "steps": [
       "**Inspection rounds** → **＋ Start a round**",
       "The period and the categories",
       "**Start the round**"
      ],
      "who": "officers"
     },
     {
      "t": "Work in a round",
      "steps": [
       "Open the round — what is left reads deck, location, number",
       "Tap an item (or scan it anywhere) → inspect → **Sign**",
       "It leaves the list; the count goes 75 / 100"
      ]
     },
     {
      "t": "Close the round",
      "steps": [
       "Open the round",
       "**Sign off and close**",
       "Remarks if items are left",
       "**Sign** — the PDF / Excel carries the sign-off"
      ],
      "who": "officers"
     }
    ]
   },
   {
    "id": "import",
    "title": "Importing from Excel",
    "path": [
     "☰ Menu",
     "Settings",
     "Import from Excel"
    ],
    "who": "officers",
    "intro": "Your own list as it is. Each row finds its category by what the item is.",
    "acts": [
     {
      "t": "First import",
      "steps": [
       "**Settings** → **Import from Excel**",
       "Choose the .xlsx",
       "Check the preview",
       "**Import**"
      ]
     },
     {
      "t": "Bring the register in line with a file",
      "steps": [
       "**Reports** → export the register as Excel (it carries **MSM ID**)",
       "Edit the file; new rows with MSM ID empty",
       "**Settings** → **Import from Excel** → **Update**",
       "Check what changes and what is missing",
       "**Import** — items keep their labels and history"
      ]
     }
    ]
   }
  ]
 },
 {
  "title": "Safety",
  "screens": [
   {
    "id": "drills",
    "title": "Drills",
    "path": [
     "☰ Menu",
     "Safety",
     "Drills",
     "Drills & schedule"
    ],
    "who": "everyone",
    "intro": "The schedule says which drill is due and when; a drill is planned with its scenario minute by minute, run, attended and signed. Oil-spill (SOPEP) and ISPS drills are recorded on their own screens and count here too.",
    "acts": [
     {
      "t": "See what is due",
      "steps": [
       "**Drills** → **Schedule**",
       "Red — overdue; amber — due soon; **Never held — due now**",
       "**Plan it →** under a drill — it opens planned"
      ]
     },
     {
      "t": "Plan a drill",
      "steps": [
       "**Drills** → **＋ Plan a drill**",
       "**Which drill?** — Fire, Abandon ship, Man overboard… or **Other — your own drill…**",
       "**Topic**, **Date ★**, **Where**",
       "**Start from the last one** — its scenario, content and place come back",
       "**Content of the drill** — or **＋ Insert the … checklist**",
       "**Scenario — minute by minute**: what happens, who → **＋ Step at T+…**",
       "It is kept as you go — **Drill plan (PDF)** for the briefing"
      ],
      "who": "officers"
     },
     {
      "t": "Brief the crew before it",
      "steps": [
       "Open the planned drill",
       "**Read the briefing** — the theory for this drill",
       "Or write your own under **Theory briefing**",
       "Tick **Theory briefing given** — it goes into the report"
      ],
      "who": "officers"
     },
     {
      "t": "Run it",
      "steps": [
       "Open the drill on the day",
       "**Started, hh:mm** → **Now**",
       "Each step as it happens → **Done now** — the report shows planned and actual time",
       "**End** → **Now**"
      ],
      "who": "officers"
     },
     {
      "t": "Mark who took part",
      "steps": [
       "**Attendance** → tick the people, or **All present**",
       "Not on the list: **＋ New crew aboard** or **＋ Someone not on the crew list (cadet, contractor, guest)**",
       "Each person present → **Sign** — their signing PIN or by hand"
      ],
      "note": "Anyone signs their own line on the officer’s device."
     },
     {
      "t": "Sign it as carried out",
      "steps": [
       "**Debrief — lessons and actions**",
       "**Sign as carried out**",
       "Someone has not signed the list? **Sign the drill anyway** — their line stays unsigned",
       "**Drill report (PDF)** · **Attendance list (PDF)**"
      ],
      "note": "Signed, the drill cannot be changed.",
      "who": "officers"
     },
     {
      "t": "The year’s plan",
      "steps": [
       "**☰** → **Safety** → **Drills** → **Drill calendar**",
       "**Draw up …** — the year filled from the schedule",
       "Tap an empty month to add a drill; a planned one → **Plan it on a day** or **Take it off the plan**",
       "✓ carried out · ● in the plan · ◆ on a day · ! missed"
      ],
      "who": "officers"
     },
     {
      "t": "Find a past drill",
      "steps": [
       "**Drills** → **Archive**",
       "Year, drill — or search a number, topic, place or name",
       "Tap it — the report"
      ]
     },
     {
      "t": "The register for an audit",
      "steps": [
       "**Drills** → **Drill register (PDF)** or **Excel**"
      ]
     },
     {
      "t": "A DP drill",
      "steps": [
       "**☰** → **Operations** → **Dynamic positioning** → **DP drills**",
       "**＋ Plan a drill** — the IMCA scenarios",
       "**How it is run** — desktop or live; **How often (company DPOM)**; **ASOG status during the drill**",
       "Attendance and signing as for any drill"
      ],
      "note": "On operations most DP drills are desktop: the scenario is talked through, nothing is switched off.",
      "who": "officers"
     },
     {
      "t": "Postpone a DP drill for operations",
      "steps": [
       "Open the planned DP drill",
       "**Postpone — operations…**",
       "Why — ROV dive in progress, next window…",
       "**Postpone — operations** — the reason goes on the record"
      ],
      "who": "master"
     }
    ]
   },
   {
    "id": "muster",
    "title": "Muster",
    "path": [
     "☰ Menu",
     "Safety",
     "Muster"
    ],
    "who": "everyone",
    "perVessel": true,
    "intro": "Muster stations and the count at an alarm. The persons on board when it starts are the list it is counted against.",
    "acts": [
     {
      "t": "Add a muster station",
      "steps": [
       "**Muster** → **＋ Muster station**",
       "Name — Boat deck stbd; where — at lifeboat 1",
       "Tick the people the muster list assigns here",
       "**Save**",
       "Open it again → **NFC tag** → **Write a tag** — for the station’s tag"
      ],
      "who": "officers"
     },
     {
      "t": "Start a muster",
      "steps": [
       "**Muster** → **Start a muster**",
       "A note — scenario, drill no.",
       "**Drill** or **Real alarm**"
      ],
      "who": "officers"
     },
     {
      "t": "Mark people at your station",
      "steps": [
       "**My station** → choose it (or tap the station’s tag)",
       "Each person: tap their wristband, **Scan a crew card**, or press their name",
       "The count shows here / missing"
      ]
     },
     {
      "t": "Close the muster",
      "steps": [
       "**Close the muster**",
       "Missing anyone? Say what happened to them",
       "**Close**",
       "**Share PDF** — under **Past musters**"
      ],
      "who": "officers"
     },
     {
      "t": "Boat landing",
      "steps": [
       "**☰** → **Security** → **Gangway logbook**",
       "**Boat landing** → the boat’s name",
       "**Open the landing**",
       "Each wristband or crew card marks its holder into the boat — or back aboard"
      ],
      "note": "Persons on board stay right: a crossing by boat is a gangway crossing."
     }
    ]
   },
   {
    "id": "nfc",
    "title": "NFC wristbands and tags",
    "path": [
     "☰ Menu",
     "Crew",
     "Crew list",
     "the person"
    ],
    "who": "officers",
    "perVessel": true,
    "intro": "A wristband carries the same code as the crew card’s QR, an equipment tag the same as the item’s label. Only a tag on the vessel’s register counts — a rewritten one is refused.",
    "acts": [
     {
      "t": "Give a person a wristband",
      "steps": [
       "**Crew** → **Crew list** → the person",
       "**NFC wristband** → **Write a tag**",
       "Hold the new wristband near the phone",
       "Shown: …UID · given today by you"
      ]
     },
     {
      "t": "Register a watch or a door card",
      "steps": [
       "The person’s card → **NFC wristband**",
       "**Register as is**",
       "Hold the watch or card near the phone"
      ],
      "note": "For a chip that takes no words (Android). Its fixed UID is the key."
     },
     {
      "t": "A wristband is lost",
      "steps": [
       "The person’s card → **NFC wristband**",
       "**Revoke** → confirm",
       "It stops counting at once; give a new one"
      ]
     },
     {
      "t": "Tag a checkpoint or a muster station",
      "steps": [
       "**☰** → **Security** → **Security rounds** → the checkpoint (or **Muster** → the station)",
       "**NFC tag** → **Write a tag**",
       "Hold the tag near the phone, then fix it in place"
      ]
     },
     {
      "t": "Tag a piece of equipment",
      "steps": [
       "The item → under **Print QR label**: **NFC tag** → **Write a tag**",
       "Hold an on-metal tag near the phone",
       "Fix it beside the QR label"
      ],
      "note": "A tap opens the item and counts as the label scanned — also in **Quick pass** on a round. On steel an ordinary sticker is not read: use on-metal tags."
     },
     {
      "t": "Tag a whole category in a row",
      "steps": [
       "**Equipment** → the category → long-press an item, tick the rest (or **All**)",
       "The **NFC** button beside **Print**",
       "**Start**, then hold each new tag to the phone in turn — the next item comes up by itself",
       "**Skip** an item you cannot reach; **Stop** to finish later"
      ],
      "note": "Items that already have a tag are passed over. A tag already on the register is refused before anything is written to it — take a new one. Officers and the Master, on a phone that reads NFC."
     },
     {
      "t": "Use a wristband anywhere in the app (Android)",
      "steps": [
       "With the app open, hold a wristband to the back of the phone",
       "The person’s card opens: on board / ashore",
       "**Went ashore** / **Back aboard** — the gangway",
       "**Waiting for signature** → open and sign"
      ],
      "note": "On iPhone: open the scanner → **Tap a wristband**."
     }
    ]
   },
   {
    "id": "obs",
    "title": "Safety observations",
    "path": [
     "☰ Menu",
     "Safety",
     "Safety observations & NC",
     "Safety observations"
    ],
    "who": "everyone",
    "intro": "Anyone on board hands in a card: an unsafe act or condition, a near miss, or good practice worth sharing. An officer reviews each one; a card that needs more becomes an NC.",
    "acts": [
     {
      "t": "Hand in a card",
      "steps": [
       "**Safety observations** → **＋ Observation card**",
       "**What did you see?** — **Unsafe condition**, **Unsafe act**, **Near miss**, **Good practice**",
       "**About** — the topic",
       "**What you saw ★**, **Where**, what you did there and then",
       "**I stopped the work (Stop Work Authority)** — if you did",
       "Choose your name — or **Anonymous**",
       "**Hand in the card**"
      ]
     },
     {
      "t": "A QR for the mess room",
      "steps": [
       "**Safety observations** → **Observation QR for anyone aboard**",
       "**Generate QR** — print it and post it",
       "Anyone scans it with their own phone and sends a card — no account",
       "Lost or misused? **Regenerate QR** — the old one stops working"
      ],
      "note": "Needs the vessel’s IMO in Settings and the device joined to the vessel.",
      "who": "officers"
     },
     {
      "t": "Review a card",
      "steps": [
       "Tap a card marked **NEW**",
       "Choose your name, write the review — what was done, who was spoken to",
       "**Reviewed**"
      ],
      "who": "officers"
     },
     {
      "t": "Turn a card into an NC",
      "steps": [
       "Tap the card",
       "**Raise an NC** — the NC opens filled from the card"
      ],
      "who": "officers"
     },
     {
      "t": "Put it on the ship’s plan",
      "steps": [
       "Tap the card → **Put on the plan**",
       "The deck, the place → **Save here**"
      ],
      "who": "officers",
      "perVessel": true
     },
     {
      "t": "The register",
      "steps": [
       "**QHSE register (PDF)** or **Excel** — cards and NCs"
      ]
     }
    ]
   },
   {
    "id": "nc",
    "title": "Non-conformities",
    "path": [
     "☰ Menu",
     "Safety",
     "Safety observations & NC",
     "Non-conformities"
    ],
    "who": "officers",
    "intro": "An NC from any source — a card, an incident, an audit, PSC, a survey — with its root cause, its actions and their dates, and the check that they worked. The Master closes it.",
    "acts": [
     {
      "t": "Raise an NC",
      "steps": [
       "**Non-conformities** → **＋ Non-conformity**",
       "**Found on ★**, **SOURCE**, report or reference no.",
       "**Grade** — Observation, Non-conformity, Major NC",
       "**Short title ★**, **What was found ★**, **Where**, the requirement not met",
       "**Root cause** — now or later",
       "Choose your name → **Raise the NC**"
      ]
     },
     {
      "t": "Draft it from what happened (AI)",
      "steps": [
       "**＋ Non-conformity** → **Draft from what happened (AI)**",
       "Tell it as you would to the Master — typed or said, any language",
       "**Draft the NC** — names go as ranks",
       "Untick the actions you do not want → **Put into the form**",
       "Check it → **Raise the NC**"
      ],
      "note": "No connection: it waits and the draft comes to the Board.",
      "perVessel": true
     },
     {
      "t": "Add the actions",
      "steps": [
       "Open the NC → **Actions**",
       "**What is to be done ★**, **By whom ★**, **By when ★**",
       "**Add the action** — the correction made, the corrective action against the root cause, anything to stop it elsewhere"
      ]
     },
     {
      "t": "Sign an action done",
      "steps": [
       "Open the NC → the action",
       "What was done — optional",
       "**Sign it done**"
      ],
      "note": "Whoever did it signs — crew included.",
      "who": "everyone"
     },
     {
      "t": "Close it",
      "steps": [
       "Every action done, root cause written",
       "**Close the NC…**",
       "**Effective** — what was checked, and when ★",
       "**Sign and close**"
      ],
      "note": "No root cause yet? **Edit** → **Root cause** first.",
      "who": "master"
     }
    ]
   },
   {
    "id": "audits",
    "title": "Internal audits",
    "path": [
     "☰ Menu",
     "Safety",
     "Safety observations & NC",
     "Non-conformities",
     "Internal Audits"
    ],
    "who": "officers",
    "intro": "An ISM, MLC or your own checklist audit, item by item. A finding is raised as an NC from the item.",
    "acts": [
     {
      "t": "Start an audit",
      "steps": [
       "**Non-conformities** → **Internal Audits ›**",
       "**AUDIT TYPE** — ISM Internal Audit, MLC Compliance Audit, Custom Audit",
       "**Start audit** → choose who is auditing",
       "The scope — areas, departments, period"
      ]
     },
     {
      "t": "Go through the items",
      "steps": [
       "Each item: **OK**, **Observation**, **NC** or **N/A**",
       "**Comment / evidence…**",
       "A finding → **Raise NC / finding ›**",
       "Your own point → **Add item**"
      ]
     },
     {
      "t": "Close the audit",
      "steps": [
       "**Close & sign audit** — the count of NCs and observations is kept with it"
      ]
     }
    ]
   },
   {
    "id": "extinsp",
    "title": "External inspections",
    "path": [
     "☰ Menu",
     "Safety",
     "Safety observations & NC",
     "Non-conformities",
     "External inspections"
    ],
    "who": "officers",
    "perVessel": true,
    "intro": "A PSC, flag, class, superintendent or vetting visit recorded once, each finding an NC with its action code and date. A detention stays on the vessel’s record until it is lifted.",
    "acts": [
     {
      "t": "Record the visit",
      "steps": [
       "**Non-conformities** → **External inspections ›** → **＋ External inspection**",
       "Kind, **Date of the inspection**, port, inspector, report no. (Form B…)",
       "**The vessel was detained** — if so",
       "No findings? **Sign and save** — a clean inspection counts too"
      ]
     },
     {
      "t": "Add its findings",
      "steps": [
       "**Findings** → **Finding**",
       "What was found, as in the report; the requirement",
       "Deficiency code, **Action code** — 10, 16, 17, 30…",
       "**Rectify by**, by whom",
       "**Add the finding** → **Sign and save** — each becomes an NC"
      ]
     },
     {
      "t": "Detention lifted",
      "steps": [
       "Open the inspection → **Detention lifted…**",
       "The date → **Save**"
      ],
      "who": "master"
     },
     {
      "t": "A report for the office or the next PSC",
      "steps": [
       "Open the inspection → **Report PDF**"
      ]
     }
    ]
   },
   {
    "id": "moc",
    "title": "Management of change",
    "path": [
     "☰ Menu",
     "Safety",
     "Safety observations & NC",
     "Non-conformities",
     "Management of change"
    ],
    "who": "officers",
    "perVessel": true,
    "intro": "A change to a procedure, equipment, manning or organisation is assessed and approved before it is made (ISM 1.2.2.2 and 10), carried out by its actions and closed when it has worked.",
    "acts": [
     {
      "t": "Raise a change",
      "steps": [
       "**Non-conformities** → **Management of change ›** → **＋ Change**",
       "**What changes** — Procedure / SMS, Equipment / systems, Crew / manning…",
       "The change in a line, what will be different, **Why**",
       "**Temporary change** → **In force until**",
       "**The office approves it too** — if it must",
       "**ISM documents it touches**",
       "**Save**"
      ]
     },
     {
      "t": "Assess the risk",
      "steps": [
       "Open the change → **Make the risk assessment**",
       "Hazards, controls, residual risk — the Master approves it"
      ],
      "note": "The Master approves a change only on an approved risk assessment."
     },
     {
      "t": "Send it for approval",
      "steps": [
       "**Submit to the Master**"
      ]
     },
     {
      "t": "Approve it",
      "steps": [
       "Open the change",
       "**Approve the change** — or **Return for rework** / **Reject** with the reason",
       "Sign"
      ],
      "note": "With the office’s approval, it goes to the office next.",
      "who": "master"
     },
     {
      "t": "Carry it out",
      "steps": [
       "**Actions** → what is to be done, by whom, by when → **Add the action**",
       "As each is done → **Sign it done**",
       "A document it touches is revised — the change shows Rev … → Rev … issued"
      ]
     },
     {
      "t": "Close it",
      "steps": [
       "Every action done",
       "**Close the change** — did it work, what was seen after",
       "**Sign and close**"
      ],
      "note": "A document not yet revised asks first: **Close anyway**.",
      "who": "master"
     }
    ]
   },
   {
    "id": "meeting",
    "title": "Monthly safety meeting",
    "path": [
     "☰ Menu",
     "Safety",
     "Safety observations & NC",
     "Monthly safety meeting"
    ],
    "who": "everyone",
    "intro": "The safety committee every month: the agenda, who took part (each signs their own line), what was said and the actions. Actions still open come back the next month.",
    "acts": [
     {
      "t": "Hold the meeting",
      "steps": [
       "**Monthly safety meeting** → **＋ New meeting**",
       "**Date**, **Place — crew mess, bridge**",
       "**Agenda** — what was said on each point; **＋ Another point**",
       "**Other business**",
       "It is kept as you go — **Draft minutes (PDF)**"
      ],
      "who": "officers"
     },
     {
      "t": "Mark who was there",
      "steps": [
       "**Attendance** → tick, or **All present**",
       "**＋ Someone not on the crew list (superintendent, contractor)**",
       "Each person → **Sign** their line"
      ],
      "note": "Anyone signs their own line on the officer’s device."
     },
     {
      "t": "Follow up the last actions",
      "steps": [
       "**Actions from earlier meetings** — each **done** or **still open — comes back next month**"
      ],
      "who": "officers"
     },
     {
      "t": "Give out new actions",
      "steps": [
       "**＋ An action — who does what by when**",
       "What, **WHO**, **By**",
       "**Add the action**"
      ],
      "who": "officers"
     },
     {
      "t": "Sign the minutes",
      "steps": [
       "**Sign the meeting** — the Master or who chaired",
       "Someone not signed? **Sign anyway**",
       "**Minutes (PDF)** · **Attendance list (PDF)**"
      ],
      "note": "Signed, the meeting cannot be changed.",
      "who": "officers"
     }
    ]
   },
   {
    "id": "flashes",
    "title": "Safety flashes (IMCA)",
    "path": [
     "☰ Menu",
     "Safety",
     "Safety observations & NC",
     "Safety flashes (IMCA)"
    ],
    "who": "everyone",
    "intro": "IMCA publishes short reports of incidents and near misses in the marine industry. Read them; bring what applies aboard to the meeting or a card.",
    "acts": [
     {
      "t": "Read the latest flashes",
      "steps": [
       "**Safety flashes (IMCA)** → **Open IMCA safety flashes**",
       "imca-int.com opens in the browser — needs a connection"
      ]
     },
     {
      "t": "Act on one aboard",
      "steps": [
       "**Safety observations** → **＋ Observation card** — or a point at the **Monthly safety meeting**"
      ]
     }
    ]
   }
  ]
 },
 {
  "title": "Medical",
  "screens": [
   {
    "id": "chest",
    "title": "Hospital — the medicine chest",
    "path": [
     "☰ Menu",
     "Medical",
     "Hospital",
     "Register"
    ],
    "who": "everyone",
    "intro": "Every medicine and piece of medical equipment with what is aboard and in date, the soonest expiry, what is short of the scale and what is on order. Out of date and expiring come first. Everyone reads it; officers keep it.",
    "acts": [
     {
      "t": "Make the list the first time",
      "steps": [
       "**Hospital** → **Register**",
       "**Start from the WHO IMGS scale** → the vessel’s category — medicines with the quantity required, and the medical equipment",
       "Or **Load from Excel** — **Excel layout** shows the columns (Name, Strength / form, Unit, Required, Location, Controlled, Batch, Expiry, Quantity)",
       "Check what it says it will add → **Load**",
       "Change the required quantities to your flag’s scale afterwards"
      ],
      "who": "officers"
     },
     {
      "t": "Read the list from any file",
      "steps": [
       "**Register** → **Any list (AI)** — a spreadsheet with its own columns",
       "Or **Photo / PDF (AI)** — the flag’s or the supplier’s list",
       "Check what it read → **Load**"
      ],
      "who": "officers",
      "perVessel": true
     },
     {
      "t": "Find what needs attention",
      "steps": [
       "**SHOW** → **Out of date** · **Expiring ≤ 30 d** · **Out of stock** · **Low stock** · **Below scale** · **Controlled**",
       "**SORT** → **Attention**, **Purpose**, **Expiry** or **Location**",
       "Or search a name, an indication, ATC, list No., a cabinet",
       "ⓘ beside a medicine — the WHO IMGS note on it"
      ]
     },
     {
      "t": "Add an item",
      "steps": [
       "**Register** → **+ Item**",
       "**Name ★**, strength / form, unit, **Required by the scale**",
       "Where — the room, cabinet, cell; list No.",
       "**Controlled drug** — every move witnessed, counted monthly",
       "**Save**"
      ],
      "who": "officers"
     },
     {
      "t": "Receive outside an order",
      "steps": [
       "The item → **+ Receive outside an order**",
       "How many, **Expiry MM/YY ★**, lot",
       "From — another vessel, a shore pharmacy",
       "**Sign** — a controlled drug with a witness"
      ],
      "note": "What comes on an order is received on the order.",
      "who": "officers"
     },
     {
      "t": "Dispose of a batch",
      "steps": [
       "The item → **Dispose…** on the batch",
       "**Destroyed on board** — why (**Out of date**, **Damaged**…) and how → **Sign**",
       "Or **Landed ashore — landing report** — it opens the landing report"
      ],
      "who": "officers"
     },
     {
      "t": "Print the chest",
      "steps": [
       "**Register** → **Inventory & to order (PDF)** or **Excel**",
       "**Controlled drugs register (PDF)** — every move with its balance and witness"
      ]
     },
     {
      "t": "Fill in the list on a computer",
      "steps": [
       "**Register** → **Excel list to fill in**",
       "Change quantities, expiries, places in Excel",
       "**Load from Excel** — the same items are updated, not doubled"
      ],
      "who": "officers"
     }
    ]
   },
   {
    "id": "medorders",
    "title": "Medical orders",
    "path": [
     "☰ Menu",
     "Medical",
     "Hospital",
     "Orders"
    ],
    "who": "officers",
    "intro": "What has been ordered and is still to come, line by line. An overdue order is red on the list and on the Board. A delivery puts the batches into the chest.",
    "acts": [
     {
      "t": "Order what is short",
      "steps": [
       "**Hospital** → **Orders** → **+ Order what is short or expiring**",
       "The lines come filled — change quantities, **+ Add from the register**",
       "**Supplier / agent**, **Reference / PO number**, **Deliver to**, **Expected**",
       "**Place the order**",
       "**Order (PDF)** — for the agent"
      ]
     },
     {
      "t": "An order of your own",
      "steps": [
       "**Orders** → **+ Empty order**",
       "**+ Add from the register** → the items, quantities",
       "**Place the order**"
      ]
     },
     {
      "t": "Receive a delivery",
      "steps": [
       "Open the order → **Receive a delivery**",
       "Each line: how many came, **Expiry MM/YY**, lot — leave a line empty if none of it came",
       "**Sign the delivery** — with a controlled drug, choose the witness"
      ],
      "note": "One batch per line; a second batch of the same line is a second delivery."
     },
     {
      "t": "Close an order that will not be completed",
      "steps": [
       "The order → **Close — the rest will not come…**",
       "What did not come and why",
       "**Sign and close** — it goes to **Archive**"
      ]
     },
     {
      "t": "Change an order",
      "steps": [
       "The order → **Edit — lines, dates**",
       "**Save**"
      ]
     },
     {
      "t": "Find a past order",
      "steps": [
       "**☰** → **Medical** → **Hospital** → **Orders archive**",
       "Tap it — the lines and every delivery"
      ],
      "who": "everyone"
     }
    ]
   },
   {
    "id": "medcount",
    "title": "Inventory and controlled drugs",
    "path": [
     "☰ Menu",
     "Medical",
     "Hospital",
     "Inventory"
    ],
    "who": "officers",
    "intro": "Counting the chest against the books. The list runs room by room, cabinet by cabinet, with the quantities from the books: change only what you count differently. After the count the books follow it, and the differences print.",
    "acts": [
     {
      "t": "Count the whole chest",
      "steps": [
       "**Hospital** → **Inventory** → **Start an inventory**",
       "Go round with the list; change only what differs",
       "Found a batch the books did not know? Find the item → **A batch the books did not know** → **Add**",
       "Remarks — damaged boxes, what was moved",
       "**Sign the count**",
       "It tells what to order after the count → **Open the order**"
      ]
     },
     {
      "t": "The monthly controlled drugs count",
      "steps": [
       "**Inventory** → **Controlled drugs count**",
       "Count each batch with the witness; correct what differs",
       "**Sign the count** — you, then the witness"
      ],
      "note": "The Master counts them monthly. Both signatures go on the register."
     },
     {
      "t": "Hand over the controlled drugs",
      "steps": [
       "**Inventory** → **Controlled drugs handover**",
       "The outgoing and the incoming officer count every batch together",
       "**Sign the handover** — the outgoing as handing over, the incoming as taking over"
      ]
     },
     {
      "t": "Land out-of-date stock ashore",
      "steps": [
       "**Inventory** → **Landing report — expired** (or **Landing report — controlled drugs**)",
       "The out-of-date batches are listed; add a damaged or recalled one below",
       "**Received ashore by**: name, position, company, **Port**",
       "**Sign the landing** — you, the witness for controlled drugs, then the person ashore by hand on the screen",
       "**Landing report (PDF)**"
      ],
      "note": "The books show them as disposed of."
     },
     {
      "t": "See an earlier count",
      "steps": [
       "**Inventory** → the count below — lines, differences, who counted and the witness"
      ],
      "who": "everyone"
     }
    ]
   },
   {
    "id": "medlog",
    "title": "Medical log",
    "path": [
     "☰ Menu",
     "Medical",
     "Hospital",
     "Medical log"
    ],
    "who": "officers",
    "intro": "Treatments aboard — confidential. The Master and the officers see it; the crew and the shore do not. A signed entry never changes; files can still be added to it.",
    "acts": [
     {
      "t": "Record a treatment",
      "steps": [
       "**Hospital** → **Medical log** → **+ New treatment**",
       "**Who is the patient?** — from the crew list, or a name and role",
       "**Complaint or injury ★**, history, vital signs, findings, diagnosis, treatment",
       "**Outcome** — Fit for duty, Light duties, Unfit, Sent to a doctor ashore, Evacuated",
       "**Follow-up** — a date, if they are to be seen again",
       "**Sign the entry**"
      ]
     },
     {
      "t": "Give a medicine from the chest",
      "steps": [
       "In the entry → **+ A medicine from the chest** → find it",
       "Dose and how — 1 g orally every 6 h…",
       "**IMGS note — dosage, cautions** under it",
       "**Sign the entry** — the chest goes down, from the batch that expires first",
       "A controlled drug: choose the witness"
      ],
      "note": "From the register: **ISSUE** beside the medicine opens a new entry with it."
     },
     {
      "t": "Radio medical advice",
      "steps": [
       "In the entry → **+ Radio medical advice (TMAS / CIRM)**",
       "Centre — CIRM Rome, Radio Medico Spain…, reference, what was advised",
       "**+ Medical advice (PDF)** or **+ Photograph it** — the written advice; after signing too"
      ]
     },
     {
      "t": "Take back what was not used",
      "steps": [
       "The signed entry → **Return …** under the medicine",
       "How many come back → **Sign the return** — into its batch; a controlled drug with a witness"
      ]
     },
     {
      "t": "See the patient again",
      "steps": [
       "**Medical log** → the follow-up due at the top (or the entry → **Follow-up…**)",
       "A new entry that follows the first → **Sign the entry**"
      ]
     },
     {
      "t": "Send a report to a doctor",
      "steps": [
       "The entry → **Medical report (PDF)**",
       "The whole log: **Medical log (PDF)** or **Excel**"
      ]
     }
    ]
   },
   {
    "id": "medref",
    "title": "Medicine reference",
    "path": [
     "☰ Menu",
     "Medical",
     "Hospital",
     "Medicine reference"
    ],
    "who": "everyone",
    "intro": "The WHO International Medical Guide for Ships — for information only; radio medical advice decides.",
    "acts": [
     {
      "t": "Look up a medicine",
      "steps": [
       "**Hospital** → **Medicine reference** → **Medicines**",
       "Search — name, use, ATC, code",
       "Tap it — use, dosage, cautions"
      ]
     },
     {
      "t": "What the scale asks for",
      "steps": [
       "**Medicine reference** → **Scale A / B / C** or **Equipment**",
       "Required quantity for each category of vessel"
      ]
     }
    ]
   },
   {
    "id": "mhm",
    "title": "Marine Hospital Manager (MHM)",
    "path": [
     "MHM",
     "⚙️ Settings",
     "⚓ ISMPilot"
    ],
    "who": "everyone",
    "intro": "Marine Hospital Manager is a separate app for the ship’s hospital. On a vessel with ISMPilot it keeps its hospital in ISMPilot: the chest, the medical log, controlled drugs and orders are the same in both apps. For a doctor or medic who does not use ISMPilot — a tablet in the hospital — or a vessel moving from MHM to ISMPilot. MHM sees the hospital only. While connected it works as PRO without a subscription of its own, and its Cloud Sync is off.",
    "acts": [
     {
      "t": "Give the medic an account",
      "steps": [
       "**☰** → **Settings** → **Accounts**",
       "**Issue an account** — the medic’s name, rank aboard, role **Officer** to keep the chest (**Crew** only reads it)",
       "**Issue** — read the 8-digit PIN out"
      ],
      "note": "MHM joins only with an account issued this way — never with the vessel’s joining code.",
      "who": "master"
     },
     {
      "t": "Connect MHM to the vessel",
      "steps": [
       "In MHM: **⚙️ Settings** → **⚓ ISMPilot**",
       "**Vessel IMO number**, first and last name as the Master wrote them, **PIN**",
       "**Connect** — it shows **Waiting for the Master**",
       "After the Master approves → **Check**"
      ]
     },
     {
      "t": "Approve the MHM device",
      "steps": [
       "**☰** → **Settings** → **Accounts** → **Devices**",
       "The waiting one reads **Marine Hospital Manager — hospital only**",
       "**Approve**",
       "To let it keep the chest: tap it → **Make Officer**"
      ],
      "note": "An MHM device is never the Master and never opens the rest of ISMPilot. **Switch off** takes its access away at once.",
      "who": "master"
     },
     {
      "t": "The first time: whose hospital",
      "steps": [
       "An MHM with nothing of its own takes the vessel’s chest straight away",
       "One with its own stock, log or orders asks:",
       "**Use the vessel’s ISMPilot (recommended)** — the vessel’s chest, log and orders come into MHM; MHM’s own lines and log stay in MHM, and a copy of its lists is kept",
       "Or **Send this MHM’s hospital to ISMPilot** → **Send** — for a vessel whose hospital in ISMPilot is new: MHM’s stock is counted into the vessel’s, its new lines, finished log entries and open orders are added; lines only the vessel has stay as they are"
      ],
      "note": "Sending is for an officer. Log entries cannot be changed in ISMPilot afterwards.",
      "who": "officers"
     },
     {
      "t": "Work in MHM",
      "steps": [
       "**💊 Pharmacy** → a medicine → issue — MHM asks the patient, position, complaint and outcome; a controlled drug — the witness",
       "It goes into ISMPilot’s **Medical log**, and the chest goes down",
       "A return, a delivery, an order, a stock correction or a new item go to ISMPilot the same way"
      ],
      "note": "The patient’s name stays on the device that wrote it; the vessel’s records show it masked (A…e). A Crew device only reads — MHM refuses before saving.",
      "who": "officers"
     },
     {
      "t": "Keep it up to date",
      "steps": [
       "MHM updates from the vessel when it opens",
       "**⚙️ Settings** → **⚓ ISMPilot** → **Update now** — what MHM did goes first, then the vessel’s books come back",
       "**⏳ … change(s) waiting to be sent** — no connection yet; they go with the next update (long-press to discard them)"
      ]
     },
     {
      "t": "One label for both apps",
      "steps": [
       "ISMPilot: **Hospital** → **Register** → **Labels — Xprinter** or **QR labels (PDF)** — or the item → **Label (Xprinter)**",
       "Or MHM, connected: **📦 Inventory** → the item → **Print label**",
       "Either app’s scanner opens the item from the label"
      ]
     },
     {
      "t": "What stays in ISMPilot",
      "steps": [
       "Inventories, the controlled drugs count and handover, landing reports",
       "Changes to an item’s card — required quantity, list No., code",
       "An entry already sent to the medical log"
      ],
      "note": "MHM does not send these; do them in ISMPilot."
     },
     {
      "t": "Disconnect MHM",
      "steps": [
       "In MHM: **⚙️ Settings** → **⚓ ISMPilot** → **Disconnect** → **Disconnect**",
       "MHM keeps the lists as they are and works on its own again"
      ],
      "note": "Joining again needs a new PIN from the Master."
     }
    ]
   }
  ]
 },
 {
  "title": "Security",
  "screens": [
   {
    "id": "gangway",
    "title": "Gangway logbook",
    "path": [
     "☰ Menu",
     "Security",
     "Gangway logbook"
    ],
    "who": "everyone",
    "intro": "Who is on board now — crew, passengers, visitors — and the book of every visit and crossing (ISPS). The gangway watch keeps it; each visitor in and out is written in the Deck Log as well.",
    "acts": [
     {
      "t": "Start at a new berth",
      "steps": [
       "**Gangway logbook** → at the top: **Port ★** (pick it from the list) and **Berth / anchorage ★**",
       "Choose who has the gangway watch — the name picker beside **On board**"
      ],
      "note": "No visitor can be signed on until the port and the berth are set."
     },
     {
      "t": "Set the security level",
      "steps": [
       "**ISPS 1 · 2 · 3** in the top bar",
       "Tap the level → **Set level 2** (or 3)",
       "A banner shows the level and since when"
      ],
      "note": "From level 2 every visitor’s identity document must be recorded.",
      "who": "officers"
     },
     {
      "t": "Sign a visitor on",
      "steps": [
       "**On board** → **+ Visitor**",
       "**Full name ★**, the time in (now), **Company**",
       "**Purpose of the visit ★**",
       "**ID** and **Document No.**, **Visitor pass No.**",
       "**HOST** — whom they visit; **Remarks** — tools, bags searched, areas allowed",
       "**📷 Photo** (optional) and the visitor’s signature",
       "**Sign on**"
      ],
      "note": "A contractor who came before: type two letters of the name and tap ↺ beside the earlier visit — the rest fills itself in. The photo is removed 90 days after the visit; the entry stays."
     },
     {
      "t": "Sign a visitor off",
      "steps": [
       "**Visitors on board** → **Sign off** beside the name",
       "Check the time → **Time out ✓**"
      ],
      "note": "Or scan their pass: the card with the photo opens → **Sign off now — leaving the vessel**."
     },
     {
      "t": "Scan at the gangway",
      "steps": [
       "**Scan card or pass** (or the scanner in the top bar)",
       "A crew or passenger card — going ashore or back aboard is recorded; the next card can follow",
       "A free visitor pass — the sign-on form opens with its number",
       "A pass in use — the holder’s card with the photo"
      ],
      "note": "A crew card scanned anywhere else opens the person, not the gangway. A wristband works the same — see NFC wristbands."
     },
     {
      "t": "Mark crew ashore or back by hand",
      "steps": [
       "**Crew (… aboard)** — the button on the right shows where the person is: **On board** green, **Ashore** yellow",
       "Tap it to change"
      ],
      "note": "Passengers the same, under **Passengers**; **Passenger list ›** opens their list."
     },
     {
      "t": "Print passes and crew cards",
      "steps": [
       "**Print visitor passes** — 20 numbered passes (PDF)",
       "**Print crew cards** — a card with a QR for each person aboard",
       "**ID cards — card printer (CR80)** — with the photo, both sides",
       "Phone: **Print to Xprinter** → crew cards or visitor passes 01–20 → the label size"
      ]
     },
     {
      "t": "Read and print the book",
      "steps": [
       "**Log**",
       "**‹ ›** — the day before or after; **SHOW** → **Day** / **Month**, or pick a month in the top bar",
       "Visitors with times, berth, ID, pass, signature; crew ashore / back aboard",
       "**PDF** or **Excel**"
      ]
     },
     {
      "t": "Correct an entry",
      "steps": [
       "**Log** → the visitor → **Edit** or **Delete**",
       "Write the reason",
       "Sign"
      ],
      "note": "The earlier version stays, struck through, with who changed it and why.",
      "who": "master"
     }
    ]
   },
   {
    "id": "ispsdrill",
    "title": "ISPS drills",
    "path": [
     "☰ Menu",
     "Security",
     "ISPS drills"
    ],
    "who": "everyone",
    "intro": "The ISPS Code asks for a security drill at least every three months. The line at the top says by when the next one is due — red once it is overdue. Also under Safety → Drills → ISPS drills.",
    "acts": [
     {
      "t": "Record a drill",
      "steps": [
       "**ISPS drills**",
       "**SCENARIO** — stowaway search, bomb threat, intruder, piracy, SSAS test… or **…or describe another scenario**",
       "**Minutes**",
       "**Who took part** — tap the names, or **All**",
       "**Areas searched, findings, what to improve**",
       "**Sign the drill** — the person who conducted it signs"
      ]
     },
     {
      "t": "Correct a drill",
      "steps": [
       "The drill in the list → **Edit** or **Delete**",
       "Write the reason",
       "Sign"
      ],
      "who": "master"
     }
    ]
   },
   {
    "id": "searches",
    "title": "Searches — stowaway, bomb",
    "path": [
     "☰ Menu",
     "Security",
     "Searches — stowaway, bomb"
    ],
    "who": "everyone",
    "intro": "A search goes area by area, team by team: each searcher marks their own area from their own phone, the SSO or the Master closes it and signs.",
    "acts": [
     {
      "t": "Set the areas and the teams",
      "steps": [
       "**Searches** → **Areas and teams**",
       "**Teams**: the name, then tap the people in it; **+ Team**",
       "**Areas**: the name, **TEAM**, **IN** — **Both searches**, **Stowaway only** or **Bomb only**; **+ Area**",
       "**Save the plan**"
      ],
      "note": "It starts from a typical yacht. A new search copies the areas as they are now.",
      "who": "officers"
     },
     {
      "t": "Start a search",
      "steps": [
       "**Start a stowaway search** or **Start a bomb search**",
       "Read the guidance on top",
       "Why — before departure from…, a threat by phone at 14:20…",
       "**Start**"
      ]
     },
     {
      "t": "Search your area",
      "steps": [
       "The open search → your team’s areas",
       "**Searching as** — your name",
       "**Clear**, or write what you saw → **Found**"
      ],
      "note": "Found: report to the bridge at once. A bomb — do not touch it, no radios or phones near it. A stowaway — keep them in sight, do not approach alone. **Undo** if marked by mistake."
     },
     {
      "t": "Close the search",
      "steps": [
       "**Outcome — all clear; or what was found and what was done**",
       "**Close and sign**",
       "Areas left unmarked are named first — close anyway or go on"
      ],
      "who": "officers"
     },
     {
      "t": "Print a search",
      "steps": [
       "**Searches done** → the search → **PDF**"
      ]
     }
    ]
   },
   {
    "id": "patrols",
    "title": "Security rounds",
    "path": [
     "☰ Menu",
     "Security",
     "Security rounds"
    ],
    "who": "everyone",
    "intro": "Opening, daytime and closing rounds: the watch scans a QR label at each checkpoint where it is. A round not done within two hours of its time shows as missed.",
    "acts": [
     {
      "t": "Put up the checkpoints",
      "steps": [
       "**Security rounds** → **Checkpoints**",
       "**+ New checkpoint** — **Checkpoint name**, **Where it is**, **ID — on the label** (CP-04)",
       "**Save**",
       "**QR labels — all (PDF)**, **Xprinter — all**, or one: **QR label (PDF)**",
       "Fix each label where the watch must go"
      ],
      "note": "Or **Start from a typical yacht (8 places)**. Renaming a checkpoint or changing its ID does not need a new label.",
      "who": "officers"
     },
     {
      "t": "Plan the rounds",
      "steps": [
       "**Rounds** → **+ New round**",
       "**Round name**, **Due at** — 07:00, 13:30 (ship’s time)",
       "Tick the checkpoints on this round",
       "**Duties** — one a line, shown at the top of the round",
       "**Save**"
      ],
      "note": "**Switch off** a round for a season; **Switch on** brings it back.",
      "who": "officers"
     },
     {
      "t": "Do a round",
      "steps": [
       "**Today** → the round → **Start**",
       "Read the duties → **Read and done**",
       "**Scan a checkpoint** — the scanner stays open; scan each label as you reach it",
       "**Remarks** if anything is wrong",
       "**Finish and sign**"
      ],
      "note": "A label that cannot be read: **Label unreadable** → **Record** — the report says it was typed. A checkpoint can also carry an NFC tag."
     },
     {
      "t": "Drop a round started by mistake",
      "steps": [
       "**Drop this round** → **Drop**"
      ],
      "note": "Nothing of it is kept; the time stays missed unless another round is done for it."
     },
     {
      "t": "Print the rounds",
      "steps": [
       "**Reports**",
       "**A day** → **‹ ›** → **PDF**",
       "**A month** → **‹ ›** → **PDF**"
      ],
      "note": "Due, done and missed; who did each and when; checkpoints missed; each round’s duties."
     }
    ]
   },
   {
    "id": "keys",
    "title": "Key register",
    "path": [
     "☰ Menu",
     "Security",
     "Key register"
    ],
    "who": "everyone",
    "intro": "Every key with its tag and what it opens: on the board, or with whom since when. Scanning a key’s tag opens it here.",
    "acts": [
     {
      "t": "Add the keys and print the tags",
      "steps": [
       "**Key register** → **+ New key**",
       "**What it opens**, **Where it is kept**, **ID — on the tag** (K-07)",
       "**Save**",
       "**Key tags — all (PDF)**, **Xprinter — all**, **Card printer — 3 tags a card (CR80)** or **Laser engraving file (SVG)**"
      ],
      "who": "officers"
     },
     {
      "t": "Sign a key out",
      "steps": [
       "Tap the key (or scan its tag)",
       "**TAKEN BY** — the name, or **…or someone not on the crew list (contractor, guest)**",
       "**Due back (optional)**, **Note (optional)**",
       "**Sign it out** — the person taking it signs (PIN, or by hand)"
      ]
     },
     {
      "t": "Take a key back",
      "steps": [
       "**Out now** → the key",
       "**Back on the board — from …**"
      ],
      "note": "A key past its due-back date is red under **Out now**."
     },
     {
      "t": "Print the register",
      "steps": [
       "**Report** — from / to",
       "**PDF** — keys out now, the register, every issue and return in the period"
      ]
     }
    ]
   },
   {
    "id": "ssp",
    "title": "Ship Security Plan",
    "path": [
     "☰ Menu",
     "Security",
     "Ship Security Plan"
    ],
    "who": "officers",
    "intro": "The approved SSP, the assessment, the ISSC and the security contacts. Confidential: the crew does not see this shelf, and its files go nowhere but to the Master’s and the officers’ devices.",
    "acts": [
     {
      "t": "Put a document on the shelf",
      "steps": [
       "**Ship Security Plan** → **+ Document**",
       "Tap a usual title, or type one",
       "**Number / approval ref.**, **Revision**, **Issued**, **Next review**",
       "**Note** — where the original is kept, who holds copies",
       "**Save** → **Attach PDF / photo**"
      ]
     },
     {
      "t": "Open or replace a document",
      "steps": [
       "The document → **Open**",
       "**Edit** — a new revision or review date; attach the new file"
      ],
      "note": "A review date passed shows as overdue."
     }
    ]
   }
  ]
 },
 {
  "title": "Environment (MARPOL)",
  "screens": [
   {
    "id": "orb",
    "title": "Oil Record Book",
    "path": [
     "☰ Menu",
     "Environment (MARPOL)",
     "Oil record book"
    ],
    "who": "everyone",
    "intro": "Part I — machinery space operations (MARPOL Annex I). One entry per operation under its code A–I; the form asks only for what that code needs and shows the line as it will read in the book. The officer in charge signs it; the Master verifies the month.",
    "acts": [
     {
      "t": "Make an entry",
      "steps": [
       "**☰** → **Environment (MARPOL)** → **Oil record book**",
       "**+ New entry**",
       "**Code** — A … I (D for bilge water, C for sludge, H for bunkering…)",
       "Date and time (ship’s), then the fields the code asks for — tanks, quantity in m³, how (OWS, to shore, to a tank…), position or port, start and stop",
       "Read the line under **In the book**",
       "**Officer in charge** — your name → **Sign the entry**"
      ],
      "note": "A warning (⚠) names what is missing; the entry cannot be signed until it is put right. G — accidental discharge — asks what happened, the cause and the action taken."
     },
     {
      "t": "Enter a bunkering from Fuel",
      "steps": [
       "**+ New entry** → code **H**",
       "Tap **From Fuel: …** — the bunkering recorded on the Fuel page",
       "Port, quantity, tanks and BDN No. fill themselves in — check the grade",
       "**Sign the entry**"
      ],
      "note": "Only bunkerings of the month not yet in the book are offered."
     },
     {
      "t": "Read another month",
      "steps": [
       "The month in the top bar → pick it",
       "**PDF** or **Excel** — the month’s pages"
      ]
     },
     {
      "t": "Correct an entry",
      "steps": [
       "The entry → **Edit** or **Delete**",
       "Write the reason",
       "Sign"
      ],
      "note": "The earlier version stays, struck through, with who changed it and why — and the entry waits for the Master’s verification again.",
      "who": "master"
     }
    ]
   },
   {
    "id": "verify",
    "title": "The Master’s verification and the true copy",
    "path": [
     "☰ Menu",
     "Environment (MARPOL)",
     "any record book",
     "Master"
    ],
    "who": "master",
    "intro": "The same for the Oil Record Book, Garbage, Sewage, Ballast water, Fuel oil changeover and ODS. The Master verifies the entries, not the month as a whole: an entry amended later waits to be verified again. The PDF is a numbered true copy — earlier versions struck under their replacement, the signer’s ID and UTC times, “Page n of N” on every page.",
    "acts": [
     {
      "t": "Verify the entries",
      "steps": [
       "Open the book and the month",
       "**Master** at the bottom — **Verify … as Master**",
       "Choose your name → sign"
      ],
      "note": "Each entry shows **Awaiting the Master's verification**, **Amended — awaiting re-verification** or **Verified …**. The crew see **… awaiting the Master's verification** until you sign."
     },
     {
      "t": "Leave an entry unverified, with the reason",
      "steps": [
       "**Hold back** under the entry",
       "Write why in the box under **Master**",
       "**Verify … · hold back …** (or **Record the reason for …**) → sign"
      ],
      "note": "The reason shows under the entry and prints in the Master's column; the board stops asking about it until the entry is amended."
     },
     {
      "t": "See that nothing was altered",
      "steps": [
       "**Master** — the seals line under the verification",
       "**Seals: … all match · chain unbroken** — green",
       "Red names the trouble: an entry not as signed, a missing entry, or a verification that no longer matches"
      ],
      "note": "The first device to find a broken seal writes it into the access log, once."
     },
     {
      "t": "Give an inspector a copy",
      "steps": [
       "**PDF** — the true copy of the month",
       "Or **Signed copy** — a ZIP with the PDF, the records and a manifest sealed by you"
      ],
      "note": "A signed copy needs your PIN or fingerprint: one signed by hand cannot be sealed. Each verification also keeps the month's signed copy on the device by itself — **Signed copies on this device (…)**."
     },
     {
      "t": "Print several months, the whole book or one entry",
      "steps": [
       "**True copy** at the bottom — **From** and **to** → **Print these months**",
       "Or **Whole book**",
       "One entry: **Print this entry** under it"
      ],
      "note": "One file, numbered “Page n of N” through, each month's verifications under its name.",
      "who": "everyone"
     },
     {
      "t": "Check a copy you were given",
      "steps": [
       "**Check a copy** → pick the ZIP",
       "**The copy is intact** — or the list of what does not check"
      ]
     },
     {
      "t": "Who opened the book",
      "steps": [
       "**Access log (…)** — every opening and export of the month: when, who, what"
      ]
     }
    ]
   },
   {
    "id": "garbage",
    "title": "Garbage Record Book",
    "path": [
     "☰ Menu",
     "Environment (MARPOL)",
     "Garbage record book"
    ],
    "who": "everyone",
    "intro": "Part I (MARPOL Annex V): each discharge into the sea, delivery ashore, incineration or loss — by category A–I, amounts in m³. At sea the position and distance from land are asked, and a discharge the rules forbid is flagged before it is signed.",
    "acts": [
     {
      "t": "Record an operation",
      "steps": [
       "**☰** → **Environment (MARPOL)** → **Garbage record book**",
       "**+ New entry**",
       "**Category** — tap every category in this operation (A Plastics, B Food wastes, C Domestic wastes…)",
       "**Amount, m³** for each",
       "**How** — **To reception facility**, **Discharged into sea**, **Incinerated** or **Accidental / exceptional discharge or loss**",
       "**At sea** — the position and **nm from land**; in port — **Port**",
       "Date and time, **Container No.**, **Reception facility receipt No.** (ashore), **Remarks**",
       "**Officer in charge** → **Sign the entry**"
      ],
      "note": "Food waste at sea: switch on **Comminuted (ground below 25 mm)** if it was. **Not allowed at sea** — **Record it anyway?** asks before such an entry goes in."
     },
     {
      "t": "Print the month",
      "steps": [
       "The month in the top bar",
       "**PDF** or **Excel**"
      ]
     },
     {
      "t": "Change or cancel an entry",
      "steps": [
       "The entry → **Edit** — correct it, **Reason for the change ★** → **Sign the change**",
       "Or **Delete** → **Reason ★** → **Sign — cancel the entry**"
      ],
      "note": "The original stays in the book; a cancelled entry is struck through and out of the totals.",
      "who": "master"
     }
    ]
   },
   {
    "id": "sewage",
    "title": "Sewage, Ballast water, Fuel oil changeover, ODS",
    "path": [
     "☰ Menu",
     "Environment (MARPOL)",
     "Sewage record · Ballast water · Fuel oil changeover · ODS Record Book"
    ],
    "who": "everyone",
    "intro": "Four books kept alike: Sewage (MARPOL Annex IV), the Ballast Water Record Book (BWM Convention), Fuel oil changeover (Annex VI reg. 14.6) and Ozone-depleting substances (Annex VI reg. 12.6). One entry per operation, signed by the officer in charge; the form warns when an operation is against the rules before it can be signed.",
    "acts": [
     {
      "t": "Make an entry",
      "steps": [
       "**☰** → **Environment (MARPOL)** → the book",
       "**+ New entry**",
       "**Operation** — tap it",
       "Date and time, then what the operation asks for",
       "Read the line under **In the book**",
       "**Officer in charge** → **Sign the entry**"
      ],
      "note": "Operations at sea with a start and an end ask a time and a position for each — **Now** puts in the time."
     },
     {
      "t": "Sewage: a discharge",
      "steps": [
       "**Operation** — through the treatment plant, comminuted and disinfected (≥ 3 nm), or untreated from the holding tank (≥ 12 nm, ≥ 4 kn)",
       "**Quantity, m³**, start and end with positions",
       "**Distance from nearest land, nm**, **Ship’s speed, kn**",
       "**Sign the entry**"
      ],
      "note": "Too close to land or too slow — the warning says which rule; also **Delivered to a reception facility**, **Holding tank level**, plant failure and back in service."
     },
     {
      "t": "Ballast water: an exchange",
      "steps": [
       "**Operation** → **Ballast water exchange (D-1)**",
       "**Sequential**, **Flow-through** or **Dilution**",
       "**Tank(s)**, **Quantity, m³**, start and end with positions",
       "**Distance from nearest land, nm**, **Water depth, m**",
       "**Sign the entry**"
      ],
      "note": "At least 50 nm from land and 200 m deep. Uptake, treatment, discharge — mark **Treated (BWMS)** or **Not treated**."
     },
     {
      "t": "Fuel oil changeover: an ECA",
      "steps": [
       "**Operation** — changeover completed before entering, **Entered the ECA**, **Left the ECA**, changeover commenced after leaving; EU berth over 2 h and before departure",
       "**Emission Control Area** — Baltic Sea, North Sea, North American…",
       "**Tank(s)**, quantity of compliant fuel, **Sulphur, % m/m**, position",
       "**Sign the entry**"
      ],
      "note": "Fuel above 0.10 % S signs only with the reason in **Remarks**."
     },
     {
      "t": "ODS: a recharge, a leak, a supply",
      "steps": [
       "**Operation** — full or partial recharge, repair, deliberate or non-deliberate discharge, to a reception facility, supply to the ship",
       "**Equipment**, **Substance (e.g. R-22)**, **Mass, kg**",
       "**Sign the entry**"
      ]
     },
     {
      "t": "Print, verify, correct",
      "steps": [
       "The month in the top bar → **PDF** or **Excel**",
       "The Master verifies at the bottom, as in the Oil Record Book",
       "**Edit** / **Delete** — with the reason and a signature"
      ],
      "note": "Correcting is the Master’s; see The Master’s verification and the true copy."
     }
    ]
   },
   {
    "id": "fuel",
    "title": "Fuel",
    "path": [
     "☰ Menu",
     "Environment (MARPOL)",
     "Fuel",
     "Sounding"
    ],
    "who": "everyone",
    "intro": "The day’s soundings tank by tank, the month at a glance (opening ROB, received, consumed, closing ROB), bunkerings, transfers and the tanks. Diesel in litres; petrol for the tenders, fresh water and lubricating oils are kept on their own pages.",
    "acts": [
     {
      "t": "Set up the tanks",
      "steps": [
       "**☰** → **Environment (MARPOL)** → **Fuel** → **Sounding**",
       "**Set up two diesel tanks** — port and starboard",
       "**Tanks** → rename, **Capacity, L**, **+ Add a tank** or **Remove tank**"
      ],
      "note": "A removed tank keeps its past soundings. **MGO**, **Petrol**, **Water**, **Oils** at the top — each has its own tanks."
     },
     {
      "t": "Take today’s sounding",
      "steps": [
       "**Today's sounding** — litres in each tank (the % of capacity shows beside it)",
       "**Recording as** — your name",
       "**Save sounding**"
      ],
      "note": "Once saved, the day is changed like any signed record: by the Master, with the reason."
     },
     {
      "t": "Record a bunkering",
      "steps": [
       "**+ Bunkering**",
       "**Port ★**, **Supplier**, **Litres ★**",
       "**Into …, L** for each tank — they must add up",
       "**Density kg/L**, **Sulphur %**, **BDN No.**",
       "**Record**"
      ],
      "note": "Then take it into the Oil Record Book as code H — **From Fuel**. Petrol: **+ Fuelling** with the craft; oils: **+ Oil delivery** with the grade."
     },
     {
      "t": "Move fuel between tanks",
      "steps": [
       "**+ Transfer**",
       "**FROM** and **TO**, **Litres**",
       "**Record transfer**"
      ]
     },
     {
      "t": "The month’s report",
      "steps": [
       "The month in the top bar",
       "**Day by day** — ROB, received, consumed",
       "**Monthly report (PDF)** or **Excel**"
      ]
     },
     {
      "t": "Send the noon report",
      "steps": [
       "**Fuel** → **Daily report**",
       "Noon and midnight positions; consumption noon to noon from the soundings, **Average, 7 days**, **Days at this rate**",
       "The day on board from every log",
       "**Remarks** — at anchor, generators only…",
       "**To** — office@… (remembered) → **E-mail**, **Share** or **Share / copy**"
      ],
      "note": "Every report sent is kept under **Sent reports (…)** as it went. No sounding for the day — **Go to Sounding**."
     },
     {
      "t": "Correct a bunkering or a sounding",
      "steps": [
       "The line → **Edit** or **Delete**",
       "Write the reason",
       "Sign"
      ],
      "who": "master"
     }
    ]
   },
   {
    "id": "emissions",
    "title": "Emissions — DCS, CII, EU MRV",
    "path": [
     "☰ Menu",
     "Environment (MARPOL)",
     "Fuel",
     "Emissions"
    ],
    "who": "everyone",
    "perVessel": true,
    "intro": "Which rule applies to this vessel, the year’s fuel, distance and hours from the soundings and the passages, the CII rating as a guide, the EU split, what is missing, and the year’s statement signed for the verifier. MGO / diesel only.",
    "acts": [
     {
      "t": "Enter the vessel’s particulars",
      "steps": [
       "**Fuel** → **Emissions**",
       "**Change type and tonnage**",
       "**Ship type**, GT, DWT, **Carries cargo or passengers commercially?**",
       "**Save**"
      ],
      "note": "**What applies to this vessel** follows from these: DCS and CII from 5000 GT, MRV for commercial ships (offshore from 400 GT). Unsure for a yacht — ask the flag or the verifier.",
      "who": "master"
     },
     {
      "t": "Record a passage",
      "steps": [
       "**Passages** → **+ Passage**",
       "**From port**, **To port**, **EU / EEA port** where it is",
       "**Left the berth**, **Full ahead on passage (FAOP)**, **End of sea passage (EOSP)**, **At the berth** — all UTC",
       "**ROB on leaving, L**, **ROB on arriving, L**, **Distance under way, nm** (FAOP to EOSP)",
       "**Cargo (t) or passengers carried**",
       "**Sign the passage**"
      ],
      "note": "Written on arrival, berth to berth. Over the new year it also asks the ROB and miles at 31 Dec 24:00 UTC — each year reports its own part. A stop only for fuel, stores, repairs or shelter does not end a passage."
     },
     {
      "t": "See the year",
      "steps": [
       "**Year** — fuel in litres and tonnes, density, distance, hours under way",
       "**CII …** — attained against required",
       "EU / EEA voyages and at berth (MRV)",
       "**Missing or not adding up** — what to put right"
      ],
      "note": "Until the year is over the figures are to date (**not final**). No density from a BDN — no tonnes; nothing is assumed."
     },
     {
      "t": "Sign the year’s statement",
      "steps": [
       "After 31 December: **Sign the year**",
       "**How fuel per consumer was measured** — as in the SEEMP Part II",
       "Tonnes per consumer, **Under way** and **Not under way**",
       "**Shore power taken, kWh**, **Innovative technologies installed**, **Note**",
       "**Sign**"
      ],
      "note": "By 31 March it goes to the verifier. A mistake: **Correct: sign a new statement** — the newest counts.",
      "who": "officers"
     },
     {
      "t": "Print for the verifier",
      "steps": [
       "**PDF** or **Excel**"
      ]
     },
     {
      "t": "Correct a passage",
      "steps": [
       "The passage → **Edit**",
       "Write the reason",
       "Sign"
      ],
      "who": "master"
     }
    ]
   },
   {
    "id": "sopep",
    "title": "SOPEP",
    "path": [
     "☰ Menu",
     "Environment (MARPOL)",
     "SOPEP",
     "SOPEP stores (inventory)"
    ],
    "who": "everyone",
    "intro": "The oil-spill lockers, each with its list, ID and QR label; the inventory check; the SOPEP drills; and the plan’s own papers for the officers. The last check’s shortages show on the locker list in red.",
    "acts": [
     {
      "t": "Add a locker",
      "steps": [
       "**☰** → the gear beside **SOPEP**",
       "**+ New locker** — **Name ★**, where it is, **ID ★** (SP-02)",
       "**Save**",
       "**QR label (PDF)**, **Xprinter — all** or **QR labels — all (PDF)**"
      ],
      "note": "Managing lockers is for those the Master allows in Settings → Access.",
      "who": "officers"
     },
     {
      "t": "Load a locker’s list",
      "steps": [
       "The gear beside **SOPEP** → the locker → **Load list (Excel)** (**Template** has the columns)",
       "**Import**"
      ],
      "note": "Or on an empty locker: **Add the typical list** — 16 items of a yacht locker, then edit them.",
      "who": "officers"
     },
     {
      "t": "Keep the list right",
      "steps": [
       "**SOPEP stores (inventory)** → **Lockers · …**",
       "Tap a name, a place or the quantity required to correct it",
       "**+ Add an item to …** — or the bin to remove one"
      ]
     },
     {
      "t": "Count the lockers",
      "steps": [
       "**Inventory check** — every locker (or **Count** on one locker for that one only)",
       "Type what is there; **Replace** marks what is damaged or out of date",
       "**Remarks**, **Checked by** → **Sign the check**"
      ],
      "note": "**Previous checks** below; what to replace is listed under the lockers."
     },
     {
      "t": "Open a locker by its label",
      "steps": [
       "Scan the QR on the locker — its list opens",
       "Or the gear → **Open by ID**"
      ]
     },
     {
      "t": "Record a SOPEP drill",
      "steps": [
       "**☰** → **SOPEP** → **SOPEP drills** (also under **Drills**)",
       "**Scenario** — overflow during bunkering, hydraulic leak on deck… or **…or describe another scenario**",
       "**Who took part**, **Minutes**, **Lessons learned, actions**",
       "**Drill conducted by** → **Sign the drill**"
      ]
     },
     {
      "t": "The plan’s papers",
      "steps": [
       "**SOPEP** → **SOPEP docs**",
       "**+ Document** — the approved SOPEP, contact lists, drawings",
       "**Save** → **Attach PDF / photo**"
      ],
      "note": "The crew do not see this shelf.",
      "who": "officers"
     }
    ]
   }
  ]
 },
 {
  "title": "Crew",
  "screens": [
   {
    "id": "mydocs",
    "title": "My documents",
    "path": [
     "☰ Menu",
     "Crew",
     "My documents"
    ],
    "who": "everyone",
    "perVessel": true,
    "intro": "One person’s own page: the trip and contract, their certificates, the last seven days’ rest and the drills they attended. Read only — the officers keep these records.",
    "acts": [
     {
      "t": "See your own papers",
      "steps": [
       "**☰** → **Crew** → **My documents**",
       "**Trip and contract** — joined, port, contract ends, cabin",
       "**My certificates** — red expired, amber due; tap one to open it",
       "**Hours of rest, last 7 days** — tap it for the full record",
       "**Drills attended, last 12 months**"
      ],
      "note": "The device finds you by your account, or by the name you last signed with. Not found? An officer checks the spelling on the crew list."
     },
     {
      "t": "See what changed",
      "steps": [
       "Open **My documents**",
       "**Changed since you last looked** — certificates and your details changed by an officer",
       "Opening the page clears it for next time"
      ],
      "note": "The Board also says when a certificate of yours is due."
     },
     {
      "t": "Something is wrong",
      "steps": [
       "Tell an officer — they correct the crew list or the certificate",
       "Passport details and next of kin are seen by the officers only and are not shown here"
      ]
     }
    ]
   },
   {
    "id": "crew",
    "title": "Crew list",
    "path": [
     "☰ Menu",
     "Crew",
     "Crew list"
    ],
    "who": "everyone",
    "intro": "Who may sign on this vessel. The name goes onto every record a person signs and stays there after they leave. Officers keep the list; everyone sees it.",
    "acts": [
     {
      "t": "Add a person quickly",
      "steps": [
       "**☰** → **Crew** → **Crew list**",
       "**Add crew member** — **Full name**, **Rank / role (Third Officer, Bosun…)**",
       "**Add**"
      ],
      "note": "For the full card — photo, cabin, passport, next of kin, certificates — tap the person (or **+ Add crew member** in the Crew matrix).",
      "who": "officers"
     },
     {
      "t": "Correct a name or rank",
      "steps": [
       "The pencil beside the person",
       "The form above opens with the name selected",
       "**Save** (or **Cancel**)"
      ],
      "who": "officers"
     },
     {
      "t": "Retire or remove someone",
      "steps": [
       "The person icon beside the name — retire (greyed, kept for the records) or bring back",
       "The bin removes them; if they have signed anything, **Retire instead** is offered"
      ],
      "note": "Signed records keep the name either way.",
      "who": "officers"
     },
     {
      "t": "Make the crew list for port (FAL Form 5)",
      "steps": [
       "**Crew list (PDF)**",
       "**Arrival** or **Departure**",
       "**Port of arrival** / **Port of departure**, the date",
       "Check **Missing** — passport, date of birth, nationality not filled",
       "**Create the crew list — n on board**"
      ],
      "who": "officers"
     },
     {
      "t": "Bring the crew in from a sheet",
      "steps": [
       "**Excel template** — the columns",
       "Fill it in → **Import from Excel**",
       "or **Any list (AI)** — your own list in any layout (per vessel)",
       "or **Import SDM file (.sdm)** — one seafarer’s Seafarer Documents Manager file",
       "**Import** — new and updated names are listed"
      ],
      "note": "Empty cells leave what the app already has. **Export to Excel** gives the list back as a sheet.",
      "who": "officers"
     },
     {
      "t": "The person’s full card",
      "steps": [
       "Tap the person",
       "**Photo** — **Take — camera** / **Choose**, **Adjust**",
       "**Rank / position**, **Cabin No.**",
       "**On board** / **Signed off**, **Signed on**, **Port of embarkation**",
       "**Has the right to sign** — a rating who may sign on a shared tablet",
       "**Personal details (crew list)** — date and place of birth, nationality, passport, seaman’s book, phone, home address, next of kin",
       "**Save**"
      ],
      "note": "Personal details are seen by the officers and the Master only. **Erase personal details** clears them when the person has left.",
      "who": "officers"
     },
     {
      "t": "Add a person’s certificates",
      "steps": [
       "Tap the person → **Certificates** → **+ Add certificate**",
       "Name, number, expiry, the scan",
       "**Save**"
      ],
      "note": "A new person: **Save** the card first. The certificates show in the Crew matrix and in their My documents.",
      "who": "officers"
     }
    ]
   },
   {
    "id": "crewmatrix",
    "title": "Crew matrix",
    "path": [
     "☰ Menu",
     "Crew",
     "Crew matrix"
    ],
    "who": "officers",
    "intro": "Everyone on board against their certificates: a date is an expiry, red expired, amber within 60 days. It is also where people are signed on and off at a crew change.",
    "acts": [
     {
      "t": "See who needs attention",
      "steps": [
       "**☰** → **Crew** → **Crew matrix**",
       "The banner counts people with documents expired or due, or details missing",
       "Tap a date to open that certificate; **+** to add a missing one"
      ]
     },
     {
      "t": "Sign someone off",
      "steps": [
       "Tap the name → the card",
       "Switch **On board** off — the sign-off date is today",
       "**Save**"
      ],
      "note": "They leave the matrix and the hours of rest; nothing they signed changes."
     },
     {
      "t": "Sign someone back on",
      "steps": [
       "**Show signed off (n)**",
       "**Sign on** under their name",
       "Their certificates and details are as they left them"
      ],
      "note": "Signing on again clears the old contract end — set the new one on the card."
     },
     {
      "t": "Add a new joiner",
      "steps": [
       "**+ Add crew member**",
       "Fill in the card → **Save**",
       "Add their certificates"
      ]
     },
     {
      "t": "Signing PINs",
      "steps": [
       "**Master PIN** (amber **Master PIN is 0000 — change it** until it is changed)",
       "The lock beside a person — **Signing PIN of …**"
      ],
      "note": "On a vessel where every person has their own account, they choose their own PIN.",
      "who": "master"
     }
    ]
   },
   {
    "id": "rest",
    "title": "Hours of rest",
    "path": [
     "☰ Menu",
     "Crew",
     "Hours of rest"
    ],
    "who": "everyone",
    "intro": "MLC 2006 and STCW A-VIII/1, in ship’s time: each day drawn in half hours, checked against 10 h in any 24 and 77 h in any 7 days together with the days around it.",
    "acts": [
     {
      "t": "Record a day",
      "steps": [
       "**☰** → **Crew** → **Hours of rest**",
       "Choose the person — yours is marked “(you)”",
       "The month: the list beside **?** at the top — this one, last month, and every month with records",
       "Tap the day — **Not recorded — tap to fill in**",
       "**Tap marks WORK** / **Tap marks REST**, then tap the half hours",
       "Or **Fill the day** / **Same as previous day** / **As planned**",
       "**Note (drill, emergency, exception)** → **Save**"
      ],
      "note": "The check under the bar says at once whether the day keeps the rules."
     },
     {
      "t": "Move between days",
      "steps": [
       "**Previous day** / **Next day** at the top",
       "A future date cannot be recorded"
      ]
     },
     {
      "t": "See a breach",
      "steps": [
       "The month: **Recorded**, **Days with a breach**, **Work this month**",
       "A red day says **Breach**; open it — the first breach and why"
      ]
     },
     {
      "t": "The monthly record for signature",
      "steps": [
       "Choose the person and the month",
       "**Monthly record (PDF) for signature**",
       "Print it, the person and the Master sign"
      ],
      "note": "The first time it asks for a folder; **Change folder** later."
     }
    ]
   },
   {
    "id": "watchplan",
    "title": "Watch plan",
    "path": [
     "☰ Menu",
     "Crew",
     "Hours of rest",
     "Watch plan — the next two weeks"
    ],
    "who": "everyone",
    "perVessel": true,
    "intro": "A person’s watches for the next two weeks, checked against the rest-hour rules before they are worked. The record, where there is one, wins over the plan.",
    "acts": [
     {
      "t": "Set the standing watch",
      "steps": [
       "**Hours of rest** → **Watch plan — the next two weeks ›**",
       "Choose the person",
       "**Standing watch** → **Draw it…** — the watch kept every day",
       "**Save**"
      ],
      "who": "officers"
     },
     {
      "t": "Change one day",
      "steps": [
       "Tap the day — **Nothing planned — tap to plan the day**, or a planned one",
       "Draw that day (arrival, a drill, a day off) → **Save**",
       "**Back to the standing watch** undoes it; **Clear this day** empties it"
      ],
      "who": "officers"
     },
     {
      "t": "See what will break",
      "steps": [
       "**n day(s) of the next 14 break the rules** at the top",
       "Red days say **Will breach** — open one to see the first breach"
      ],
      "note": "The Board warns the officers whose plan breaks and from when."
     },
     {
      "t": "Record a day as planned",
      "steps": [
       "**Hours of rest** → the day",
       "**As planned** → **Save**"
      ]
     }
    ]
   },
   {
    "id": "passengers",
    "title": "Passengers",
    "path": [
     "☰ Menu",
     "Crew",
     "Passengers"
    ],
    "who": "everyone",
    "intro": "Guests, project staff and other passengers: the name as in the passport and the cabin; who is aboard, expected, ashore or disembarked. Documents are seen by the officers only.",
    "acts": [
     {
      "t": "Add a passenger",
      "steps": [
       "**☰** → **Crew** → **Passengers**",
       "**+ Passenger** — **Full name as in the passport ★**, group, **Cabin No.**, **Nationality**",
       "**Embarked**, **Port embarked**; leaving: **Disembarked**, **Port disembarked**",
       "Notes — diet, allergies, mobility; **Documents** — number, expiry, date of birth, phone, contact ashore",
       "**Save**"
      ],
      "who": "officers"
     },
     {
      "t": "Bring a list in",
      "steps": [
       "**Excel template** → fill in → **Import from Excel**",
       "or **Any list (AI)** — the agent’s list in any layout (per vessel)",
       "**Import**"
      ],
      "note": "Empty cells leave what the app already has.",
      "who": "officers"
     },
     {
      "t": "Find and filter",
      "steps": [
       "**Search — name, cabin, nationality**",
       "**SHOW** — **Current guests**, **Expected**, **Disembarked**, **All**"
      ]
     },
     {
      "t": "Ashore and back aboard",
      "steps": [
       "Choose the **Gangway watch** first",
       "**On board** / **Ashore** beside the guest — tap to change",
       "It is written in the gangway logbook"
      ],
      "note": "Or scan the guest’s card at the gangway: **Gangway ›**."
     },
     {
      "t": "Papers",
      "steps": [
       "**Passenger list (PDF)**, **Export to Excel**",
       "**Print passenger cards** — a card with a QR for each guest aboard"
      ]
     }
    ]
   },
   {
    "id": "appraisals",
    "title": "Crew appraisals",
    "path": [
     "☰ Menu",
     "Crew",
     "Crew list",
     "Crew appraisals"
    ],
    "who": "officers",
    "perVessel": true,
    "intro": "At the end of the contract and once a year: scored, signed by the appraiser, read and signed by the seafarer, countersigned by the Master. Once signed it does not change.",
    "acts": [
     {
      "t": "See who is due",
      "steps": [
       "**Crew list** → **Crew appraisals** (Due: n)",
       "Due — red when past",
       "Set **Contract ends** on each crew card, or only the yearly one is asked"
      ]
     },
     {
      "t": "Write an appraisal",
      "steps": [
       "Tap the person under Due, or **+ Appraisal** → **Seafarer**",
       "**Reason**, **Period from**, **Period to**",
       "**Assessment** — a score per line (**N/A** where it does not apply), a comment if needed",
       "**Strengths**, **To improve**, **Training needs**",
       "**Recommended for re-hire**, **Recommended for promotion**",
       "**Save draft** or **Sign as appraiser**"
      ],
      "note": "A crane operator’s or a DPO’s appraisal adds its own section, with the hours from the crane log or the DP log."
     },
     {
      "t": "The seafarer signs",
      "steps": [
       "Hand the device to the seafarer — **… reads and signs**",
       "**I agree** or **I do not agree**, a comment",
       "**Sign** with their own PIN or by hand"
      ],
      "note": "Would not sign: **Refused to sign** with the reason."
     },
     {
      "t": "Countersign",
      "steps": [
       "Open the appraisal — **Waits for the Master’s countersignature**",
       "Remark if any → **Countersign**",
       "**PDF**"
      ],
      "who": "master"
     },
     {
      "t": "Cancel one",
      "steps": [
       "Before the seafarer signs: **Cancel appraisal** with the reason"
      ],
      "note": "Nothing is deleted; it stays on the list as cancelled."
     },
     {
      "t": "Use the company’s own form",
      "steps": [
       "**Crew appraisals** → **Company appraisal form**",
       "**Start from the standard form**, or **Read the paper form (AI)** (per vessel)",
       "**The form, line by line** — sections, criteria, scale, questions",
       "**Use the company form for new appraisals** → **Save**"
      ],
      "note": "Appraisals already written keep the form they were written on.",
      "who": "master"
     }
    ]
   },
   {
    "id": "datests",
    "title": "Drug and alcohol tests",
    "path": [
     "☰ Menu",
     "Crew",
     "Crew list",
     "Drug and alcohol tests"
    ],
    "who": "officers",
    "perVessel": true,
    "intro": "Unannounced, random, after an incident: the readings, the laboratory and what was done. One signature records the test and every result. Results are health data — in the cloud a name is kept as its first and last letter.",
    "acts": [
     {
      "t": "Record a test",
      "steps": [
       "**Crew list** → **Drug and alcohol tests** → **+ D&A test**",
       "**Reason** — Unannounced, Random selection, After an incident, Reasonable cause, Before joining, Follow-up",
       "**Date**, **Time**; **Alcohol — breath test** (breathalyser) and/or **Drugs — screening kit** (kit)",
       "**Carried out by**, **External tester**, witness",
       "**People tested** — **Everyone aboard**, or **Draw at random**",
       "Each person: reading in mg/l; drugs **Negative** / **Non-negative** with the sample no.; or **Refused**",
       "**Sign the test**"
      ],
      "note": "Above the limit: take a **Second reading** after 15–20 minutes. Signing without one asks first."
     },
     {
      "t": "Enter the laboratory’s result",
      "steps": [
       "Open the test → the person with a non-negative screen",
       "**Laboratory result** — **Negative** / **Positive**, report no.",
       "**Sign**"
      ]
     },
     {
      "t": "Record the action",
      "steps": [
       "A positive or a refusal → **Action taken**",
       "What was done: relieved of duty, the company informed, signed off…",
       "**Sign**"
      ],
      "note": "Until then the Board shows it red to the Master."
     },
     {
      "t": "The test on paper",
      "steps": [
       "Open the test → **PDF**"
      ]
     },
     {
      "t": "Set the policy",
      "steps": [
       "**Change the policy**",
       "**An unannounced test at least every** 3 / 6 / 12 months",
       "**Alcohol limit, mg/l in the breath** (STCW 0.25)",
       "**Save**"
      ],
      "note": "The Board says when the next unannounced test is due.",
      "who": "master"
     }
    ]
   }
  ]
 },
 {
  "title": "Maintenance & yard",
  "screens": [
   {
    "id": "pms",
    "title": "Maintenance (PMS)",
    "path": [
     "☰ Menu",
     "Equipment & maintenance",
     "Maintenance (PMS)"
    ],
    "who": "everyone",
    "intro": "The planned maintenance of every department: systems (machines) by department, each with its jobs. A job falls due by the calendar, by running hours, or by whichever comes first. The top shows what is overdue and due soon; the plan itself is changed only by the Master or the superintendent.",
    "acts": [
     {
      "t": "See what is owed",
      "steps": [
       "**☰** → **Equipment & maintenance** → **Maintenance (PMS)**",
       "**Overdue** and **Due soon** at the top",
       "**Owed now** — the jobs, worst first",
       "Tap a job — it opens"
      ]
     },
     {
      "t": "Look ahead",
      "steps": [
       "**Plan ahead · n mo** — choose the months",
       "**All** or a department",
       "Tap a job to open it"
      ]
     },
     {
      "t": "Sign several routine jobs at once",
      "steps": [
       "**Owed now** → **Sign several…**",
       "Tick the jobs done today — one type, calendar jobs only",
       "**Note for all** — e.g. tested, all in order",
       "**Sign n** → **Who did them?** — your name",
       "Confirm the signature"
      ],
      "note": "Only plain jobs can be ticked: not on critical equipment, with no permit, documents or parts. Each is recorded on its own."
     },
     {
      "t": "Add a system",
      "steps": [
       "**Maintenance (PMS)** → **＋** beside the department",
       "**Name ★** — as the crew calls it: Main engine PS, Tender, Galley",
       "**Maker**, **Model**, **Serial**, **Location**",
       "**Running-hours counter** on, or off for calendar-only systems",
       "**Critical equipment** / **Class item** where it applies",
       "**Save**"
      ],
      "who": "master"
     },
     {
      "t": "Print the month’s report",
      "steps": [
       "The month picker at the top",
       "**Report PDF** or **Excel** — % done, critical % done, overdue, deferred"
      ]
     },
     {
      "t": "Give the surveyor the packs",
      "steps": [
       "**Survey pack (PDF)** — every system’s history",
       "**Class pack (PDF)** — class items and their jobs only"
      ]
     },
     {
      "t": "Open a machinery defect",
      "steps": [
       "**Open defects (n)**",
       "Tap the defect — see **Machinery defects** below"
      ]
     }
    ]
   },
   {
    "id": "pmsplan",
    "title": "Building the plan",
    "path": [
     "☰ Menu",
     "Equipment & maintenance",
     "Maintenance (PMS)",
     "Plan"
    ],
    "who": "master",
    "intro": "Three ways in: the wizard (kind of vessel → what is fitted → typical jobs), the Excel template, or system by system. All of them only add: running one again skips what is already on the plan.",
    "acts": [
     {
      "t": "Build it with the wizard",
      "steps": [
       "**Plan** → **Plan wizard** (or **Build the plan with the wizard** on an empty plan)",
       "Step 1 — the kind of vessel → **Next**",
       "Step 2 — how many of each are fitted; 0 = not fitted, ⚑ = critical; **More systems** for the rest → **Next**",
       "Step 3 — name each unit, **Maker**, **Model**, **Serial no.**, **Hours now** → **Next**",
       "Step 4 — the jobs of each system: untick what does not apply, change an interval (it applies to every unit) → **Next**",
       "Step 5 — the summary → **Create the plan**"
      ],
      "note": "Jobs have no last-done date yet: enter it on each job, or sign the first one out. Intervals are typical — check them against the makers’ manuals."
     },
     {
      "t": "Use the maker’s schedule from the library",
      "steps": [
       "In the wizard, after step 4 (**Looking in the makers’ library…**)",
       "A card **Maker’s schedule — model** for each model the library knows",
       "**Show the jobs** to check them",
       "Leave **Use the maker’s schedule** ticked, or untick it for the typical list",
       "**Next** → **Create the plan**"
      ],
      "note": "The library has a model once any vessel has had its manual read by the AI. It is a proposal — check it against the manual aboard.",
      "perVessel": true
     },
     {
      "t": "Load the plan from Excel",
      "steps": [
       "**Plan** → **Template (Excel)** — fill one row per job",
       "**Load plan (Excel)** → choose the file",
       "Read **New systems** and **Jobs: n new, n updated** → **Load**"
      ],
      "note": "Nothing is removed. Lines it could not read are listed under **Not read**."
     },
     {
      "t": "Copy a system’s jobs to its twins",
      "steps": [
       "Open the system",
       "**Copy jobs to…**",
       "Tick the systems → **Copy to n**"
      ],
      "note": "A job a system already has by that name is skipped. The copies are not yet done: set when each was last done."
     }
    ]
   },
   {
    "id": "machine",
    "title": "A system and its counter",
    "path": [
     "Maintenance (PMS)",
     "the system"
    ],
    "who": "everyone",
    "intro": "One machine: its details, running hours, components, jobs, spares, open defects and the history of work done.",
    "acts": [
     {
      "t": "Enter today’s running hours",
      "steps": [
       "Open the system",
       "**Running hours** → **Today’s counter**",
       "**Save reading**"
      ],
      "note": "A figure lower than the last, or more hours than the days allow, asks for the reason — **Save with the reason**."
     },
     {
      "t": "Load running hours from the AMS",
      "steps": [
       "**Maintenance (PMS)** → **Running hours from AMS ›**",
       "**Choose AMS file (CSV, Excel)**",
       "A line not matched — tap it, **Which system is this?**",
       "**Save n readings**"
      ],
      "note": "Each tag is remembered for the next file. A doubtful figure is not taken: enter it on the system with the reason."
     },
     {
      "t": "The counter was replaced",
      "steps": [
       "Open the system",
       "**Counter replaced…**",
       "**New counter shows, h** — what it reads now",
       "**Save** — the difference is added from now on, so the jobs keep their due hours"
      ]
     },
     {
      "t": "Add a component",
      "steps": [
       "Open the system",
       "**Components** → **+ Add component**",
       "Name it; **Running hours from** the parent — on if it has no counter of its own",
       "**Save**"
      ],
      "who": "master"
     },
     {
      "t": "Add the usual jobs",
      "steps": [
       "Open the system",
       "**Jobs** → **Typical jobs**",
       "Check each interval against the maker’s manual",
       "Set **Last done** on each job"
      ],
      "who": "master"
     },
     {
      "t": "Take the jobs from the maker’s manual (AI)",
      "steps": [
       "Open the system — **Maker** and **Model** filled",
       "**Jobs from the maker’s manual (AI)** → **Read the manual (PDF or photo)**",
       "Choose the schedule chapter (up to 100 pages) or a photo of the table",
       "Tick the jobs to add or change — page numbers beside them",
       "**Add or change n ticked**"
      ],
      "note": "**Compare with the library** shows the schedule another vessel’s manual gave for the same model. Nothing is added until you tick it.",
      "who": "master",
      "perVessel": true
     },
     {
      "t": "Report a defect on it",
      "steps": [
       "Open the system",
       "**Open defects** → **+ Report defect**",
       "See **Machinery defects** below"
      ]
     },
     {
      "t": "Record unplanned work",
      "steps": [
       "Open the system",
       "**+ Unplanned work**",
       "**What was done ★**, the date, man-hours, photos",
       "**Sign**"
      ]
     },
     {
      "t": "Print its history for the surveyor",
      "steps": [
       "Open the system",
       "**History** → **History for the surveyor (PDF)**"
      ]
     },
     {
      "t": "Scrap or replace it",
      "steps": [
       "Open the system",
       "**Scrap / replace…**",
       "The date and **Reason ★**",
       "Replaced? Tick **Replaced by a new unit** — **New unit’s serial**, **Its counter, h**",
       "**Scrap and fit the new unit** (or **Scrap**)"
      ],
      "note": "Its history stays under **Scrapped**; the new unit takes its jobs, counted from the day it was fitted.",
      "who": "master"
     }
    ]
   },
   {
    "id": "pmsjob",
    "title": "A job",
    "path": [
     "Maintenance (PMS)",
     "the system",
     "the job"
    ],
    "who": "everyone",
    "intro": "A recurring job (every … running hours, or every … days, whichever comes first — or on fixed dates) or a one-off job. Signing it out adds the record to the machine’s history; it cannot be edited after.",
    "acts": [
     {
      "t": "Add a recurring job",
      "steps": [
       "Open the system → **+ Add job**",
       "**Job ★** — Oil and filter change",
       "**Every … running hours** and/or **Every … days**",
       "**Class job**, **Permit**, **Fresh risk assessment before each sign-out**, documents to read — as needed",
       "**Last done** — the starting point",
       "**Parts used each time** → **+ Add part** from the stores",
       "**Save**"
      ],
      "note": "Changing an interval, the due date, class or permit later asks **Reason for the change** — kept in the job’s change log.",
      "who": "master"
     },
     {
      "t": "Add a one-off job",
      "steps": [
       "Open the system → **+ One-off**",
       "**Job ★**, **Must be done by** — a date and/or a counter reading",
       "**Save**"
      ],
      "note": "Recording it as done takes it off the plan; it stays in the history.",
      "who": "master"
     },
     {
      "t": "Record a job as done",
      "steps": [
       "Open the job → **Record as done**",
       "**What was done ★**, **Done on**, **Counter reading**",
       "**Condition before → after**, **Man-hours**",
       "**Note (parts, findings)**, **Note for next time**",
       "**Photos** — before and after",
       "**Taken from the stores** — set a part to 0 if not used",
       "**Signed by** → **Sign**"
      ],
      "note": "**Same as last time** copies the last note, condition and man-hours. Critical equipment needs at least one photo. A permit, a fresh risk assessment or a document to read is asked for first when the job needs one."
     },
     {
      "t": "Found a defect while doing it",
      "steps": [
       "On **Record as done** tick **Found a defect**",
       "**What is wrong ★**",
       "Condition **Out of service**? Then the defect must be ticked",
       "**Sign** — the defect goes to the list until an officer closes it"
      ]
     },
     {
      "t": "Leave it for an officer to sign",
      "steps": [
       "Fill **Record as done**",
       "**Done — for an officer to sign**",
       "The officer: open the job → **Review and sign** → check, add photos → **Sign**"
      ],
      "note": "It shows as awaiting sign-off on **Maintenance (PMS)** and the Board."
     },
     {
      "t": "Defer a job",
      "steps": [
       "Open the job → **Defer the job (Master)**",
       "**Until** a date and/or **…or until counter reading, h** — or a yard project",
       "**Reason ★** — spares on order, vessel on charter",
       "Office deferral: **Make the risk assessment ›** first",
       "**Sign the deferral**"
      ],
      "note": "Jobs on critical equipment cannot be deferred. A deferral through the office holds at once; if the office refuses, the job is due on its own dates again.",
      "who": "master"
     },
     {
      "t": "Remove a job",
      "steps": [
       "Open the job → **Remove job**",
       "**Remove** — past work stays in the history"
      ],
      "who": "master"
     }
    ]
   },
   {
    "id": "pmsdefect",
    "title": "Machinery defects",
    "path": [
     "Maintenance (PMS)",
     "Open defects"
    ],
    "who": "everyone",
    "intro": "A defect on a system: what is wrong, who found it, whether the machine is out of service. Anyone reports one; an officer or the Master closes it when it is put right.",
    "acts": [
     {
      "t": "Report a defect",
      "steps": [
       "Open the system → **+ Report defect**",
       "**Category** — safety-critical goes to the Master on the Board at once",
       "**What is wrong ★**, a photo",
       "**Machine out of service?** — **Out of service** / **In service**",
       "**Sign and report**"
      ],
      "note": "Critical equipment or safety-critical: the office is emailed as soon as it syncs (where the vessel uses it)."
     },
     {
      "t": "Mark out of service later, or back in",
      "steps": [
       "Open the defect",
       "**Out of service from** → **Sign: out of service**",
       "When it runs again: **Back in service on** → **Sign: back in service**"
      ],
      "who": "officers"
     },
     {
      "t": "Plan a corrective job",
      "steps": [
       "Open the defect → **+ Plan a corrective job**",
       "**Must be done by**, **Save**",
       "When the job is done, close the defect"
      ]
     },
     {
      "t": "Waiting for spares, who is responsible",
      "steps": [
       "Open the defect",
       "**Responsible** ✎ — rank or name, e.g. 2/E",
       "**Awaiting spares** — then **Spares arrived**"
      ],
      "who": "officers"
     },
     {
      "t": "Close the defect",
      "steps": [
       "Open the defect → **Close the defect**",
       "**What was done ★** — part renewed, adjusted, tested",
       "Photo of the repair — required for safety-critical or class",
       "**Sign the rectification**"
      ],
      "note": "Where the office verifies closures it may return one with a reason: it is open again, marked **Returned by the office**.",
      "who": "officers"
     }
    ]
   },
   {
    "id": "pmsprojects",
    "title": "Yard projects",
    "path": [
     "Maintenance (PMS)",
     "Projects — yard / dry dock"
    ],
    "who": "master",
    "intro": "A yard period or dry dock as one date that jobs are deferred to. The yard list prints what is to be done there.",
    "acts": [
     {
      "t": "Create a project",
      "steps": [
       "**Maintenance (PMS)** → **Projects — yard / dry dock**",
       "**+ New project**",
       "**Name ★** — Yard period Feb 2027, **Planned for ★**, yard and scope",
       "**Create the project**"
      ]
     },
     {
      "t": "Defer jobs to it",
      "steps": [
       "Open a job → **Defer the job (Master)**",
       "Tap **To project · date**",
       "**Reason ★** → **Sign the deferral**"
      ]
     },
     {
      "t": "Print the yard list",
      "steps": [
       "Open the project → **Yard list (PDF)**"
      ]
     },
     {
      "t": "Close it after the yard",
      "steps": [
       "Open the project → **Close the project**"
      ],
      "note": "Jobs still deferred to it stay deferred to its date until done or deferred again."
     }
    ]
   },
   {
    "id": "oil",
    "title": "Oil analysis",
    "path": [
     "☰ Menu",
     "Equipment & maintenance",
     "Oil analysis"
    ],
    "who": "everyone",
    "perVessel": true,
    "intro": "Lube oil samples by sampling point — an engine crankcase, a gearbox, a hydraulic system: when the next one is due, what the lab found, the trend. A sample goes taken → sent → result → an officer’s signed review, after which it does not change.",
    "acts": [
     {
      "t": "See what is due",
      "steps": [
       "**☰** → **Equipment & maintenance** → **Oil analysis**",
       "**Due now**, **At the lab**, **To review**, **Action** at the top",
       "Tap a point — **Next by** a date or **or at … h**"
      ]
     },
     {
      "t": "Add a sampling point",
      "steps": [
       "**Oil analysis** → **+ New sampling point**",
       "**Machine (PMS)** — for the running hours",
       "**What is sampled** — Crankcase, Reduction gear, Stabiliser HPU",
       "**Compartment**, **Oil**, **Capacity, litres**, **Lab**, **Lab’s unit ID**",
       "**Sample every** … **days** and/or **running hours**",
       "**New oil** figures and **Limits** — empty takes the guide values",
       "**Save**"
      ],
      "note": "Viscosity, TBN and TAN are judged only when the new oil’s figures are given.",
      "who": "officers"
     },
     {
      "t": "Take a sample",
      "steps": [
       "Open the point → **Take a sample**",
       "**Taken on**, **Running hours**, **Hours on the oil**",
       "**Topped up since the last sample, L**, **Bottle / sample no.**",
       "Your name → **Save**"
      ],
      "note": "Take it hot and running, from the same point every time, before any top-up."
     },
     {
      "t": "Mark it sent",
      "steps": [
       "Open the sample → **Sent to the lab on** → **Mark as sent**"
      ]
     },
     {
      "t": "Enter the lab result",
      "steps": [
       "Open the sample",
       "**Load the lab’s file** (Excel, CSV) — or **Type the result**",
       "Several samples in the file? **Which sample in the file is this?**",
       "**Report date**, **Lab no.**, **Lab’s verdict**, **Lab’s comment**",
       "**Photograph the lab report**",
       "**Save**"
      ],
      "note": "The file needs a header row naming the parameters (Fe, Cu, Si, Water, Viscosity…)."
     },
     {
      "t": "Review the result",
      "steps": [
       "Open the sample — **Assessment** shows each value against its limit",
       "**Oil changed** if it was",
       "**Action taken or decided** — e.g. Oil and filters changed, resample in 100 h",
       "**Sign the review** — or **Raise a defect**"
      ],
      "note": "Values out of limits and nothing done? Write why it is normal (the lab’s advice, a bad sample…). Once signed the sample cannot be changed.",
      "who": "officers"
     },
     {
      "t": "See the trend",
      "steps": [
       "Open the point → **Trend** — each value over the samples"
      ]
     },
     {
      "t": "Print the status",
      "steps": [
       "**Oil analysis** → **Status PDF**"
      ]
     }
    ]
   },
   {
    "id": "yard",
    "title": "Yard & warranty",
    "path": [
     "☰ Menu",
     "Equipment & maintenance",
     "Yard & warranty"
    ],
    "who": "everyone",
    "perVessel": true,
    "intro": "Yard periods and dry docks with their work lists, prices against the budget, and warranty: what is still covered and the claims made under it. A job goes planned → started → done → accepted, and after acceptance only the final price and the invoice change.",
    "acts": [
     {
      "t": "Open a yard period",
      "steps": [
       "**☰** → **Equipment & maintenance** → **Yard & warranty**",
       "**New yard period**",
       "**Name**, **Kind**, **Yard or main contractor**, **Place**",
       "**Planned from** / **Planned to (redelivery)**, **Currency**, **Budget**",
       "**Save**"
      ],
      "who": "master"
     },
     {
      "t": "Build the work list",
      "steps": [
       "Open the yard period",
       "**+ Job** — **What is to be done**, **Machine (PMS)**, **Specification**, **Done by**, **Class / flag to witness**, **Quoted price**, **Warranty, months** → **Save**",
       "**Open defects (n)** — tick → **Add n**",
       "**Deferred PMS jobs (n)** → **Add n**"
      ],
      "note": "Adding the same defect from two devices does not make two jobs.",
      "who": "officers"
     },
     {
      "t": "Send the specification to the yard",
      "steps": [
       "Open the yard period",
       "**Specification PDF** or **Specification Excel**",
       "The yard fills **Yard price** / **Yard remarks** in the Excel",
       "**Read yard prices** → choose their file"
      ],
      "note": "Accepted or cancelled jobs keep their prices; lines not on this work list are counted and left out.",
      "who": "officers"
     },
     {
      "t": "Arrival and redelivery",
      "steps": [
       "Open the yard period",
       "**Arrived today** on the day",
       "**Redelivered today** at the end"
      ],
      "who": "officers"
     },
     {
      "t": "Follow a job",
      "steps": [
       "Open the job",
       "**Started** → **Done**",
       "**Not done after all** to step back"
      ],
      "who": "officers"
     },
     {
      "t": "Accept the work",
      "steps": [
       "Open the done job → **Accept the work**",
       "**What was checked** — seals renewed, sea trial 2 h, class surveyor present",
       "**Final price**, **Invoice no.**, **Photos of the finished work**",
       "**Close the defect with this signature** — when it came from a defect",
       "**Sign the acceptance**"
      ],
      "note": "Warranty runs from acceptance for the months given on the job.",
      "who": "officers"
     },
     {
      "t": "Cancel a job",
      "steps": [
       "Open the job → **Cancel the job**",
       "**Reason** — e.g. Postponed to the next yard period"
      ],
      "note": "It stays on the list, struck; its number is never used again.",
      "who": "officers"
     },
     {
      "t": "Print progress",
      "steps": [
       "Open the yard period → **Progress PDF**"
      ]
     },
     {
      "t": "Close the yard period",
      "steps": [
       "Open it → **Close the project**"
      ],
      "note": "Jobs not accepted stay as they are.",
      "who": "master"
     },
     {
      "t": "Make a warranty claim",
      "steps": [
       "**Yard & warranty** → **Warranty claim** (or from the accepted job)",
       "**Fault in a few words**, **Machine (PMS)**, **Claim against**",
       "Not yard work? **Warranty from** / **Warranty until**",
       "**Fault found** (date), **Description of the fault**, **Photos of the fault**",
       "**Save** → **Claim PDF** to send"
      ],
      "note": "A fault found after the cover ended is marked OUTSIDE the warranty.",
      "who": "officers"
     },
     {
      "t": "Follow the claim to its end",
      "steps": [
       "Open the claim → **Sent to them**",
       "Their reply: **Answered on**, **What they said**, **Their reference**",
       "**Close the claim** — **How it ended**, **Our cost** → **Sign and close**"
      ],
      "who": "officers"
     },
     {
      "t": "See what is under warranty",
      "steps": [
       "**Yard & warranty** → **Warranty** — each item to its date; amber 60 days before",
       "**Warranty register PDF**"
      ]
     }
    ]
   },
   {
    "id": "spares",
    "title": "Spare parts",
    "path": [
     "☰ Menu",
     "Equipment & maintenance",
     "Spare parts"
    ],
    "who": "everyone",
    "intro": "The vessel’s spares: what is on hand, where it is, the level at which to re-order, and what the PMS jobs of the coming weeks will take. Every receipt, use and count is a movement that stays; a wrong one is put right by a stocktake.",
    "acts": [
     {
      "t": "Add a part",
      "steps": [
       "**☰** → **Equipment & maintenance** → **Spare parts**",
       "**Parts** → **+ Add part**",
       "**Part ★**, **Part number**, **Maker**, **IMPA / ISSA No.**",
       "**Location (store, shelf, box)**, **Unit**, **On hand now**",
       "**Re-order at** and **Order up to**",
       "**Fits** — the machines; **Suppliers** → **+ Add supplier** (price, lead days)",
       "**Save**"
      ]
     },
     {
      "t": "Record a receipt or a use",
      "steps": [
       "Open the part",
       "**Received** or **Used**",
       "**How many**, a note (supplier, order no. / what for), **Expiry** if it has one",
       "**Recorded by** → **Record**"
      ],
      "note": "Using more than the book shows is recorded anyway; a stocktake puts the count right."
     },
     {
      "t": "See what to order",
      "steps": [
       "**Spare parts** — **Out of stock**, **Low**, **Expiring ≤ 90 d** at the top",
       "**For jobs ahead** — what the PMS jobs of the next days need against what is on the shelf",
       "**To order** — every line at or below its re-order level"
      ]
     },
     {
      "t": "Raise the order from it",
      "steps": [
       "**To order** → **Create orders** (or **Requisition (Excel)**)",
       "Check the lines → **Create** — a draft per department",
       "Open the draft in **Purchase orders**"
      ]
     },
     {
      "t": "Stocktake",
      "steps": [
       "**Spare parts** → **Stocktake**",
       "Each line prefilled with the book — type what is on the shelf, 0 when empty",
       "**Record the count** → **Who counted?**"
      ],
      "note": "Lines at or below their re-order point go into a draft requisition at once — **Open the draft**."
     }
    ]
   },
   {
    "id": "stores",
    "title": "Stores",
    "path": [
     "☰ Menu",
     "Equipment & maintenance",
     "Stores",
     "the store"
    ],
    "who": "everyone",
    "intro": "Each store has its own list, an ID and a QR label for its door: PPE store, provisions, general stores, the flag locker, charts & publications. Stock is kept in batches by best-before or, for PPE and flags, by wear — poor is not serviceable and does not count towards the minimum.",
    "acts": [
     {
      "t": "Add a store",
      "steps": [
       "**☰** → the gear beside **Stores** — **Manage stores**",
       "**+ New store**",
       "**Name ★**, the kind (**PPE store**, **Provisions**, **General stores**, **Flag locker**, **Charts & publications**), where it is, **ID ★**",
       "**Save**",
       "**QR label (PDF)** — for its door"
      ],
      "note": "Managing stores is for those the Master allows in Settings → Access.",
      "who": "officers"
     },
     {
      "t": "Start from a standard list",
      "steps": [
       "Open an empty store",
       "**Add the typical PPE list**, **Add the signal flag set** or **Add the IMO publications and stationery**",
       "Edit the minimums to the vessel’s needs"
      ]
     },
     {
      "t": "Load a list",
      "steps": [
       "Open the store → **Import from Excel** (**Excel template** has the columns)",
       "Or **Any list (AI)** / **Photo / PDF (AI)** — the AI reads the columns",
       "**Import**"
      ],
      "note": "Quantities in the sheet are counted into the store.",
      "perVessel": true
     },
     {
      "t": "Add an item",
      "steps": [
       "Open the store → **New item**",
       "**Name ★**, type or section, size, edition, **Unit**, **Minimum**, where",
       "**Save**"
      ]
     },
     {
      "t": "Receive",
      "steps": [
       "Tap the item → **Receive**",
       "**How many ★**; best before, or count by wear (new / good / poor)",
       "**FROM** — supplier, delivery note",
       "**Sign**"
      ]
     },
     {
      "t": "Issue to a crew member",
      "steps": [
       "PPE store: tap the item → **Issue to crew**",
       "**TO** — the person, how many",
       "**Sign** — then the person signs for it on this device (PIN or by hand)"
      ],
      "note": "**Issued to crew** shows what each person holds; **PPE record (PDF)** per person."
     },
     {
      "t": "Issue, return or dispose",
      "steps": [
       "Tap the item → **Issue** (or **Issue to galley**), **Return**, **Dispose**",
       "**BATCH** — which one",
       "To whom / why → **Sign**"
      ]
     },
     {
      "t": "Count the store",
      "steps": [
       "Open the store → **Count**",
       "Each line — what is on the shelf; by wear where it is counted so",
       "**Record the count**"
      ],
      "note": "Lines below the minimum go into a draft requisition."
     },
     {
      "t": "See what is short",
      "steps": [
       "**SHOW** → **Below minimum**, **Out of date**, **Expiring**, **Poor**",
       "**To order (Excel)**"
      ]
     },
     {
      "t": "Open a store by its label",
      "steps": [
       "Scan the QR on the store’s door — the list opens",
       "Or **Manage stores** → **Open by ID**"
      ]
     }
    ]
   },
   {
    "id": "po",
    "title": "Purchase orders",
    "path": [
     "☰ Menu",
     "Equipment & maintenance",
     "Purchase orders"
    ],
    "who": "officers",
    "intro": "Requisitions by department: a draft with lines, sent to the supplier, received line by line. Received lines go into the spares and stores by themselves.",
    "acts": [
     {
      "t": "Raise an order",
      "steps": [
       "**☰** → **Equipment & maintenance** → **Purchase orders**",
       "**+ New order**",
       "**Department**, **Urgency**, **Port**, **Delivery date**",
       "**+ Add line** — **Description ★** or IMPA, **Qty**, **Unit**, **Part No.**, **Maker**, **Budget / cost centre**",
       "**Save order**"
      ],
      "note": "**Stock aboard** beside each line shows what is already on the shelf."
     },
     {
      "t": "Ask suppliers for quotes",
      "steps": [
       "Open the order → **Quotations**",
       "**Ask a supplier** — from the directory or a new name; **Quotes wanted by**",
       "**Request PDF** / **Request Excel** for each — send it",
       "Their answer: **Enter quote**, or load their filled Excel"
      ],
      "note": "Only quotes in one currency are ranked; others are not converted.",
      "perVessel": true
     },
     {
      "t": "Send a supplier a link instead",
      "steps": [
       "**Quotations** → the supplier → **Send link**",
       "**Supplier’s e-mail** → **Send by e-mail** (or **Link only** → **Copy** / **Share**)",
       "They enter prices on their own page — the answer lands in the order",
       "**+7 days** to keep it open longer"
      ],
      "perVessel": true
     },
     {
      "t": "Award the order",
      "steps": [
       "**Side by side — unit prices** — ★ the lowest per line",
       "**Award** on the chosen quote",
       "Not the lowest complete one? **Reason** — e.g. delivers to the port in time",
       "**Award the order to …**"
      ],
      "note": "Prices, supplier and ref go onto the lines. **Comparison PDF** / **Excel** for the file.",
      "perVessel": true
     },
     {
      "t": "Send it through the Master and the office",
      "steps": [
       "Open the order → **Approval**",
       "Officer: **Send to the Master**",
       "Master: **Approve and send to the office** — or **Return to the officer** with a reason",
       "The office approves, cuts lines or returns it; then it can be sent"
      ],
      "note": "Emergency: the Master can **Emergency: send to the supplier now** with a reason; the office answers afterwards.",
      "perVessel": true
     },
     {
      "t": "Mark it sent",
      "steps": [
       "Open the order — status **Sent**",
       "**Save order as PDF** for the supplier"
      ]
     },
     {
      "t": "Receive the delivery",
      "steps": [
       "Open the order (or scan its **QR label for box**)",
       "**Confirm receipt**",
       "The quantity that came on each line",
       "**Confirm delivery** → your name"
      ],
      "note": "Part delivered? It stays **Partial** — **Continue receiving** next time. **Delivery history** shows each receipt."
     },
     {
      "t": "Group orders",
      "steps": [
       "**Purchase orders** → **Groups** → **+ New group** — a drydock, a charter",
       "Name → **Create group**",
       "**+ Add / remove** — tick the orders → **Save changes**"
      ]
     },
     {
      "t": "Reuse an order",
      "steps": [
       "Open it → **Copy as template**"
      ]
     },
     {
      "t": "Export orders",
      "steps": [
       "**From** / **To**, filter → **Export n as** PDF or Excel"
      ]
     }
    ]
   },
   {
    "id": "finance",
    "title": "APA & budget",
    "path": [
     "☰ Menu",
     "Equipment & maintenance",
     "APA & budget"
    ],
    "who": "officers",
    "perVessel": true,
    "intro": "The owner’s account or a charter’s APA, each in its currency, and the year’s budget by cost centre. An entry is never edited: a mistake is reversed, and both stay on the statement.",
    "acts": [
     {
      "t": "Open a fund",
      "steps": [
       "**☰** → **Equipment & maintenance** → **APA & budget**",
       "**APA** → **New fund**",
       "**Name of the fund** — Owner’s account, Charter 12–19 Jul (no guest’s name)",
       "**Currency**, **Opened** → **Save**"
      ]
     },
     {
      "t": "Record money in",
      "steps": [
       "Open the fund → **Money in**",
       "**Date**, **Amount** (another currency — **Exchange rate**), **From whom, and what for**",
       "**Save**"
      ]
     },
     {
      "t": "Record a payment",
      "steps": [
       "Open the fund → **Payment**",
       "**Date**, **Amount**, **What it was for**, **Cost centre**, **Supplier**, **Paid by**",
       "**Purchase order it paid** if any, **Receipt / invoice no.**, photo of the receipt",
       "**Save**"
      ]
     },
     {
      "t": "Reverse a mistake",
      "steps": [
       "Tap the entry → **Reverse**",
       "**Reverse this entry — why?** → **Save**"
      ]
     },
     {
      "t": "Statement for the owner",
      "steps": [
       "Open the fund → **Statement for the owner**",
       "**From** / **To** → PDF or Excel"
      ],
      "note": "Opening balance, every entry with the running balance, spending by cost centre, lines for signatures."
     },
     {
      "t": "Close the fund",
      "steps": [
       "**Close the fund** → **Close**"
      ],
      "note": "No new entries after; the statement stays."
     },
     {
      "t": "Follow the budget",
      "steps": [
       "**Budget** — the year (**Previous year** / **Next year**)",
       "**Budget for the year** per cost centre",
       "**Spent**, **Committed**, **Left**"
      ],
      "note": "Spent = APA payments + what was received on orders; committed = what is still to come on orders sent."
     }
    ]
   },
   {
    "id": "compressor",
    "title": "BA compressor",
    "path": [
     "☰ Menu",
     "Equipment & maintenance",
     "Equipment",
     "FIFI Outfit & BA Sets",
     "BA Compressor log"
    ],
    "who": "everyone",
    "intro": "Up to three breathing-air compressors, each with its running-time counter and a log of runs, maintenance, service and inspection.",
    "acts": [
     {
      "t": "Add a compressor",
      "steps": [
       "**Equipment** → **FIFI Outfit & BA Sets** → **BA Compressor log**",
       "**+ Add compressor** — its name",
       "**Adjust starting counter** — the hours it had before logging started"
      ]
     },
     {
      "t": "Log a run",
      "steps": [
       "Open the compressor → **Running**",
       "**Date**, **Running time** — hours and min",
       "**Note** — e.g. Charging bottles 2, 6 & 9",
       "**Add entry**"
      ]
     },
     {
      "t": "Log maintenance, a service or an inspection",
      "steps": [
       "**Maintenance**, **Service** or **Inspection**",
       "Date, note — e.g. 2nd stage filter changed",
       "**Add entry**"
      ]
     }
    ]
   },
   {
    "id": "ropes",
    "title": "Ropes and wires",
    "path": [
     "☰ Menu",
     "Equipment & maintenance",
     "Equipment",
     "Mooring / Hooks & Cables / Cranes",
     "Ropes and wires"
    ],
    "who": "everyone",
    "perVessel": true,
    "intro": "A log for each mooring rope, wire and crane wire: condition, diameter, cuts, end for end, lubrication, brake tests, renewal. The app follows the wear and says when the rope reaches its discard diameter, its shortest length or its age.",
    "acts": [
     {
      "t": "See which ropes need attention",
      "steps": [
       "**Equipment** → the category → **Ropes and wires**",
       "Red — to discard; amber — close to a limit",
       "Tap a rope — its log"
      ]
     },
     {
      "t": "Record a look and a measurement",
      "steps": [
       "Open the item → **Rope log** → **Record**",
       "**What was done** → **Condition**",
       "**Condition**, **Diameter measured, mm**, **Broken wires** (wire)",
       "**Found**, **A photo of the damage**",
       "**Sign the entry**"
      ],
      "note": "Measure the smallest reading along the working length, across the crowns of the strands."
     },
     {
      "t": "Cut and slip, end for end, lubricate, brake test",
      "steps": [
       "**Record** → **Cut and slip** (**Length cut off, m**), **End for end**, **Lubricated** or **Brake test** (**Held** / **Did not hold**, the load)",
       "**Sign the entry**"
      ]
     },
     {
      "t": "Renew the rope",
      "steps": [
       "**Record** → **Renewed**",
       "**Length, m**, **Diameter, mm**, **Certificate No.**",
       "**Sign the entry** — the item takes the new rope"
      ],
      "who": "officers"
     },
     {
      "t": "Print the log",
      "steps": [
       "**Ropes and wires** → PDF or Excel"
      ]
     }
    ]
   },
   {
    "id": "plan",
    "title": "Ship’s plan",
    "path": [
     "☰ Menu",
     "Equipment & maintenance",
     "Ship’s plan"
    ],
    "who": "everyone",
    "perVessel": true,
    "intro": "The decks of the GA plan with points on them: defects, yard jobs, safety equipment and observations. Coloured by state.",
    "acts": [
     {
      "t": "Add a deck",
      "steps": [
       "**Ship’s plan** → **＋ Deck**",
       "**Deck name** — Main deck, Tank top…",
       "**Choose the picture** (PNG / JPEG) or **Choose a PDF** → **Next page** to the deck",
       "**Save**"
      ],
      "who": "officers"
     },
     {
      "t": "Put a record on the plan",
      "steps": [
       "Open the defect, the yard job, the item or the observation",
       "**Put on the plan**",
       "Choose the deck, tap the place — zoom in for a finer point",
       "**Save here**"
      ],
      "who": "officers"
     },
     {
      "t": "Move it or take it off",
      "steps": [
       "Open the record → **On the plan: …**",
       "**Move** — tap the new place → **Save here**",
       "or **Take off the plan**"
      ],
      "who": "officers"
     },
     {
      "t": "See what is where",
      "steps": [
       "**Ship’s plan** → the deck",
       "Filters: kind, category, yard period, **Closed too**",
       "Tap a point → **Open the record**"
      ]
     },
     {
      "t": "A PDF for the yard or the fire plan",
      "steps": [
       "**Ship’s plan** → the deck",
       "**PDF of this deck** or **PDF of all decks**"
      ]
     }
    ]
   },
   {
    "id": "crane",
    "title": "Crane operator’s log",
    "path": [
     "☰ Menu",
     "Equipment & maintenance",
     "Equipment",
     "Cranes",
     "Crane operator’s log"
    ],
    "who": "officers",
    "perVessel": true,
    "intro": "Who worked which crane, for how long — the experience statement for the operator’s CV, and the cranes’ load tests.",
    "acts": [
     {
      "t": "Record a day at the controls",
      "steps": [
       "**Crane operator’s log** → **New entry**",
       "The crane, the operator, the date",
       "**Hours at the controls**, **Lifts**, the kind of work, heaviest lift",
       "**Confirm and sign**"
      ]
     },
     {
      "t": "Cancel a wrong entry",
      "steps": [
       "Hold the entry",
       "**Void this entry?** → confirm",
       "Sign — both stay on record"
      ]
     },
     {
      "t": "An operator’s statement",
      "steps": [
       "**Operators** tab → the person",
       "**Experience statement (PDF)**",
       "The Master signs and stamps the printed line"
      ]
     },
     {
      "t": "Record a load test",
      "steps": [
       "**Tests** → **New test**",
       "Kind, date, test load, examined by, operator at the controls",
       "Pass: certificate no. and **Next test due**",
       "**Sign**"
      ],
      "note": "A failed test changes nothing on the register; the crane shows red until it passes."
     }
    ]
   }
  ]
 },
 {
  "title": "Operations & documents",
  "screens": [
   {
    "id": "orders",
    "title": "Master’s orders",
    "path": [
     "☰ Menu",
     "Operations",
     "Master’s orders"
    ],
    "who": "everyone",
    "perVessel": true,
    "intro": "The night order book and the standing orders. The officers sign that they have read them.",
    "acts": [
     {
      "t": "Write tonight’s orders",
      "steps": [
       "**Master’s orders** → **Night orders**",
       "**＋ Tonight’s orders**",
       "Where, the orders, when to call the Master",
       "Tick the officers of the watch",
       "**Issue and sign**"
      ],
      "who": "master"
     },
     {
      "t": "Sign tonight’s orders",
      "steps": [
       "**Board** → the night orders line (or **Master’s orders** → **Night orders**)",
       "Read them",
       "**I have read and understood**"
      ]
     },
     {
      "t": "Close the night",
      "steps": [
       "**Night orders** → last night (**To close**)",
       "Remarks for the morning — optional",
       "**Close the night**"
      ],
      "who": "master"
     },
     {
      "t": "Issue a revision of the standing orders",
      "steps": [
       "**Master’s orders** → **Standing orders** (DP ones: **Dynamic positioning** → **DP Standing Orders**)",
       "**＋ New revision**",
       "The text, what is new, **Who signs**",
       "**Issue and sign** — everyone asked signs again"
      ],
      "note": "Issued, a revision is never changed: a new text is the next revision.",
      "who": "master"
     }
    ]
   },
   {
    "id": "watch",
    "title": "Bridge and engine checklists",
    "path": [
     "☰ Menu",
     "Operations",
     "Bridge & engine checklists",
     "Bridge checklists"
    ],
    "who": "officers",
    "intro": "The watch handover, sign-on and sign-off, preparation for sea and arrival, pilotage, restricted visibility, heavy weather — and the emergency cards. Two people sign; once saved, a checklist never changes.",
    "acts": [
     {
      "t": "Start a checklist",
      "steps": [
       "**☰** → **Operations** → **Bridge & engine checklists**",
       "**Bridge checklists**, **Engine checklists** or **Emergency cards** at the top",
       "Under **Start a checklist** tap one — **Bridge watch handover**, **Engine room watch handover**…",
       "**Position ★ (from the GNSS)** — degrees, minutes, N/S, E/W; or **As the last checklist (…)**",
       "Answer each line; **All Yes / No items yes — then change what is not** saves taps",
       "**Remarks** if needed"
      ],
      "note": "The date and time are not typed: they are the moment of signing, in ship’s time and UTC."
     },
     {
      "t": "Sign and save it",
      "steps": [
       "**Signatures ★** — each row: **Choose the name…** → **Sign**",
       "PIN, fingerprint on your own phone, or by hand",
       "The second row — another person (handing over / taking over)",
       "**Save the signed checklist** → **Save**"
      ],
      "note": "Lines not answered and lines answered No are counted before it saves. Wrong person: **Undo** beside the name."
     },
     {
      "t": "Leave it for someone to sign",
      "steps": [
       "Filled in, not signed → **Leave for an officer to sign**",
       "It waits for them; they open it, sign and save"
      ],
      "note": "Left unsigned on the device by mistake: next time it asks — **Restore** or **Start new**."
     },
     {
      "t": "An emergency card",
      "steps": [
       "**Bridge & engine checklists** → **Emergency cards**",
       "**Emergency — fire on board**, **man overboard**, **abandon ship**, **collision**, **grounding**, **flooding**",
       "Tick what is done as it is done, remarks — what worked, what did not",
       "**OOW** signs, **Master** confirms (abandon ship: **Master** and **Chief Officer**) → save"
      ]
     },
     {
      "t": "Read one back",
      "steps": [
       "Under **Signed** — green: all yes; amber: not answered; red: a No",
       "Tap it → **PDF** or **Print**",
       "Older ones: **Older than 90 days — from the cloud →**"
      ]
     }
    ]
   },
   {
    "id": "familiar",
    "title": "Familiarisation",
    "path": [
     "☰ Menu",
     "Operations",
     "Familiarisation",
     "Safety familiarisation"
    ],
    "who": "everyone",
    "intro": "On joining: safety within 24 hours and before sailing, then the bridge or the engine room. Project crew and guests too. Whoever was familiarised signs — ratings included.",
    "acts": [
     {
      "t": "Familiarise a new crew member",
      "steps": [
       "**☰** → **Operations** → **Familiarisation**",
       "**Safety familiarisation**, **Bridge familiarisation**, **Engine familiarisation**",
       "Under **Start a checklist** → the checklist",
       "Position, then go through the lines with them",
       "**Familiarised** — the newcomer signs; **Familiarised by** — the one who showed them",
       "**Save the signed checklist**"
      ]
     },
     {
      "t": "Project crew or someone not on the crew list",
      "steps": [
       "**Project crew familiarisation** (or **Safety familiarisation**)",
       "First row: **Choose the name…**, or **or write the name**",
       "A written-in name signs by hand",
       "**Familiarised by** signs → save"
      ]
     },
     {
      "t": "Brief a guest",
      "steps": [
       "**Passenger familiarisation** → **Passenger familiarisation — safety briefing**",
       "**Guest** — pick from the guests aboard (Passengers); the guest signs by hand",
       "**Briefed by** signs → save"
      ],
      "note": "In the cloud a guest’s name is kept as its first and last letter."
     },
     {
      "t": "DP familiarisation",
      "steps": [
       "**☰** → **Operations** → **Dynamic positioning** → **DP checklists**",
       "**DP familiarisation** — signed as above"
      ]
     }
    ]
   },
   {
    "id": "dp",
    "title": "Dynamic positioning",
    "path": [
     "☰ Menu",
     "Operations",
     "Dynamic positioning",
     "DP checklists"
    ],
    "who": "officers",
    "intro": "The DP checklists, the DP log, each DPO’s DP time and the Nautical Institute confirmation letter. The vessel’s own checklists are set up by ISM AI Pilot when it joins.",
    "acts": [
     {
      "t": "Do a DP checklist",
      "steps": [
       "**☰** → **Operations** → **Dynamic positioning** → **DP checklists**",
       "Under **Start a checklist** — **Field arrival — bridge (before the 500 m zone)**, **Field arrival — engine room**, **DP watch handover / takeover**, **Leaving the field**",
       "**Position ★ (from the DGPS)**, **Offshore unit**, **Conditions**",
       "**DP status (ASOG)** — **Green**, **Advisory**, **Yellow**, **Red**",
       "The lines — a column at once: **All … — Yes**",
       "**Schematic** → **Draw the schematic** — own vessel, rig, wind and current",
       "**SDPO** and **DPO** sign → **Save the signed checklist**"
      ],
      "note": "The time of each DP checklist goes into the Deck Log."
     },
     {
      "t": "Keep the DP log",
      "steps": [
       "**Dynamic positioning** → **DP log** at the top",
       "**DPO** — who is at the desk; **Day**",
       "Time **HH:MM**, **What was done, in a few words** → **Add**",
       "Status: **DP set-up started**, **DP set-up complete**, **On DP**, **Off DP** — into the DP log and the Deck Log",
       "**PDF** — the day"
      ],
      "note": "A line cannot be changed; to correct one, add another. At set-up and off DP it shows which DP drills are due — tap one to hold it."
     },
     {
      "t": "Record DP time",
      "steps": [
       "**Dynamic positioning** → **DP time**",
       "**DPO**, **Day**",
       "**Active — in control** or **Passive — watching**, then tap the half-hours; tap again to clear",
       "Or **Fill from the DP log and watch handovers** — then check it",
       "**Remove this day** — if it was wrong"
      ],
      "note": "Two hours or more is a DP day. **DP time on board** shows each DPO’s days and hours."
     },
     {
      "t": "The confirmation letter",
      "steps": [
       "**Dynamic positioning** → **Confirmation letter**",
       "**DPO**, **From**, **To**",
       "**Scheme** — **New Scheme (grey logbook, after 1 Jan 2015)** or **Old Scheme (before 2015)**",
       "**Make the letter (PDF)**"
      ],
      "note": "Printed with 35 mm free at the top — print it on the company’s letterhead, sign and stamp. **Missing:** says what to fill in first."
     },
     {
      "t": "The letter details",
      "steps": [
       "**Confirmation letter** → **Letter details — the same for every DPO**",
       "**Company (employer)**, **DP class**, **GRT**, **Signed by**, **Position**, **Company contacts**",
       "**Save the details**"
      ]
     },
     {
      "t": "DP drills and DP standing orders",
      "steps": [
       "**Dynamic positioning** → **DP drills** — see Drills",
       "**Dynamic positioning** → **DP Standing Orders** — see Master’s orders"
      ]
     }
    ]
   },
   {
    "id": "readiness",
    "title": "Inspection readiness",
    "path": [
     "☰ Menu",
     "Operations",
     "Inspection readiness"
    ],
    "who": "everyone",
    "intro": "What a port State, flag or class inspector would find on a given day, from what the app holds — put it right before they come. Red: would be found on the day; amber: runs out within 30 days after it, or still open.",
    "acts": [
     {
      "t": "See what would be found",
      "steps": [
       "**☰** → **Operations** → **Inspection readiness**",
       "**Port State Control**, **Flag inspection** or **Class survey**",
       "**Today**, **In 7 days**, **In 14 days**, **In 30 days** — or **Inspection date**",
       "Each area — a count, or a tick",
       "Tap a line — it opens where to put it right",
       "**PDF**"
      ],
      "note": "It checks what the app holds; it is not the inspector’s checklist."
     },
     {
      "t": "Ask the AI what to do first",
      "steps": [
       "Something red or amber → **AI: what to do first**",
       "Steps in order, each with why — tap one to go there"
      ],
      "note": "No connection: it waits and runs when one comes back; the result is on the Board.",
      "perVessel": true
     },
     {
      "t": "Due dates to your calendar",
      "steps": [
       "**Due dates to your calendar (.ics) — a year ahead, reminder 7 days before**",
       "Open the file in Outlook, Google or Apple Calendar"
      ]
     },
     {
      "t": "A read-only link for the inspector",
      "steps": [
       "**Inspector / PSC read-only link**",
       "**7 days**, **30 days** or **90 days**",
       "**Generate link** → **Copy link** — send it",
       "Done with it: **Revoke**"
      ],
      "note": "Anyone with the link sees the compliance summary without the app.",
      "who": "master"
     },
     {
      "t": "A calendar that updates itself",
      "steps": [
       "**Calendar subscription (webcal)** → **Generate calendar link**",
       "**Copy webcal://** (iOS) or **Copy https://** (Google, Outlook)",
       "Add it once as a subscribed calendar",
       "**Revoke** — stops it"
      ],
      "note": "Equipment due dates, certificates and drills, 12 months ahead, refreshed every 12 hours.",
      "who": "master"
     }
    ]
   },
   {
    "id": "pscwalk",
    "title": "PSC walk-round",
    "path": [
     "☰ Menu",
     "Operations",
     "Inspection readiness",
     "Port State Control",
     "PSC walk-round"
    ],
    "who": "everyone",
    "intro": "The findings port State inspectors write most often, place by place — walk the ship before the visit. The checks are in English, as PSC works in English.",
    "acts": [
     {
      "t": "What inspectors found last year",
      "steps": [
       "**Inspection readiness** → **Port State Control** → **PSC walk-round — what inspectors find most often**",
       "**What inspectors found last year** — **Tokyo MOU** or **Paris MoU**",
       "**Share of all deficiencies** by area, **Most frequent detainable deficiencies**"
      ]
     },
     {
      "t": "Walk the ship",
      "steps": [
       "Place by place, each line: **OK** or **To fix**",
       "To fix: **What was found, who puts it right**",
       "**Open** — where the app keeps the proof",
       "The count on top: checked, to put right"
      ],
      "note": "The marks stay on this device until printed."
     },
     {
      "t": "Give it to the Master",
      "steps": [
       "**PDF**"
      ]
     },
     {
      "t": "Start again",
      "steps": [
       "**Start a new walk** → **Start a new walk**"
      ],
      "note": "Every mark and note on this device is cleared."
     }
    ]
   },
   {
    "id": "handover",
    "title": "Handover at crew change",
    "path": [
     "☰ Menu",
     "Operations",
     "Inspection readiness",
     "Crew change? Make the handover report"
    ],
    "who": "everyone",
    "intro": "For the relief: what is overdue, what falls due over their trip, and your notes — one PDF, signed by both and the Master.",
    "acts": [
     {
      "t": "Write the handover",
      "steps": [
       "**Inspection readiness** → **Crew change? Make the handover report**",
       "**Outgoing — name**, **Rank**, **Incoming — name**",
       "**What is handed over** — Deck, Engine room, Whole vessel…",
       "**List what falls due in the next** 30 / 60 / 90 days",
       "**Work in progress**, **For the relief** — one item a line"
      ]
     },
     {
      "t": "The brief, printed first",
      "steps": [
       "**In brief — what matters most (printed first)** — write it",
       "or **AI: draft the brief** → **Put into the brief**, then read it"
      ],
      "note": "The draft is in English, as the report is.",
      "perVessel": true
     },
     {
      "t": "Print it",
      "steps": [
       "**See the list on screen →** — check it",
       "**PDF** — both sign, then the Master"
      ],
      "note": "The notes stay on this device until printed; nothing goes to the other devices."
     },
     {
      "t": "Start a fresh one",
      "steps": [
       "**Start a new handover**"
      ]
     }
    ]
   },
   {
    "id": "certs",
    "title": "Certificates",
    "path": [
     "☰ Menu",
     "Documents & compliance",
     "Certificates"
    ],
    "who": "everyone",
    "intro": "Three registers: Equipment (a service certificate that covers a group of items), Crew (STCW, CoC, medical, passport) and Vessel (registry, SMC, ISSC, MLC, load line). Red: expired; amber: falls due within 60 days.",
    "acts": [
     {
      "t": "Add a certificate",
      "steps": [
       "**☰** → **Documents & compliance** → **Certificates**",
       "**Equipment**, **Crew** or **Vessel** at the top",
       "**＋** (top right)",
       "**Certificate name ★**, **Number**, **Issued by**, **Issue date**, **Expiry date ★**",
       "Crew: **Holder ★** — whose it is",
       "**＋ Attach document or photo** — PDF, photo library or camera",
       "**Save**"
      ]
     },
     {
      "t": "Let the AI read it",
      "steps": [
       "The certificate → **Scan with AI**",
       "Choose the file or photo",
       "Check what it filled in → **Save**"
      ],
      "note": "No connection: it waits and runs when one comes back; the result is on the Board.",
      "perVessel": true
     },
     {
      "t": "Link the items it covers",
      "steps": [
       "**Equipment** → the certificate → **Link items**",
       "**Search items to link…** — tick each",
       "**Done** → **Save**"
      ],
      "note": "Each linked item shows the certificate on its own page."
     },
     {
      "t": "Find one",
      "steps": [
       "**Search name, number, issuer…** (Crew: **Search person, certificate, number…**)",
       "Crew are grouped by person, the worst first"
      ]
     },
     {
      "t": "A passport or a medical",
      "steps": [
       "**Crew** → the certificate"
      ],
      "note": "Number and scan of a passport or medical are kept by the officers and the Master; the crew see only the name and the dates.",
      "who": "officers"
     },
     {
      "t": "Replace or remove it",
      "steps": [
       "The certificate → the file → **Replace** or **Remove**",
       "Gone for good: **Delete certificate** → **Delete**"
      ],
      "note": "The items it covered are not deleted."
     },
     {
      "t": "A station’s service report into the register",
      "steps": [
       "**Certificates** → **Equipment** → **From a service report — the station's PDF sets the items' dates**",
       "**PDF / document**, **Photo** or **Camera** → **Read it with AI** (or type the fields)",
       "**Certificate No**, **Service station**, **Service date**, **Next service ★**",
       "Tick the items the report is about — **Not found in the register** lists the rest",
       "**The next date goes into** — **Expiry** or **Next inspection**",
       "**Apply to …** → **Update**"
      ],
      "note": "The items keep their QR labels, photos and history; condemned or failed ones keep their old date and get a remark. A copy of the register is kept first."
     }
    ]
   },
   {
    "id": "docs",
    "title": "Documents (ISM)",
    "path": [
     "☰ Menu",
     "Documents & compliance",
     "Documents"
    ],
    "who": "everyone",
    "intro": "The SMS manual, procedures, circulars and standing orders. Each revision is read and signed by the crew; signatures for earlier revisions stay in the history.",
    "acts": [
     {
      "t": "Read and sign",
      "steps": [
       "**☰** → **Documents & compliance** → **Documents**",
       "**To read — your name (n)** → the document",
       "Open the file, or read the text",
       "**I have read and understood** — PIN, fingerprint or by hand"
      ],
      "note": "A signature cannot be withdrawn."
     },
     {
      "t": "Find a document",
      "steps": [
       "**Search by word — in the title and inside the document**",
       "**SORT** — **Document no.**, **Title**, **Newest first**, **Review due**; **TYPE**"
      ],
      "note": "A scan with no text is found by its title and number only."
     },
     {
      "t": "Upload the office’s documents",
      "steps": [
       "**Upload documents** — pick one or many PDFs",
       "Number and title come from each file name; **Crew must read and sign** on or off",
       "**Upload …**"
      ],
      "note": "A file whose number or title matches a document already here becomes its next revision.",
      "who": "officers"
     },
     {
      "t": "Write one aboard",
      "steps": [
       "**＋ Write one here**",
       "**Title ★**, **Document no.**, **Type**, **Issued**, **Review due**",
       "**Text (for a circular or orders written aboard)** — or **Attach a file**",
       "**Crew must read and sign** — off for reference documents",
       "**Save**"
      ],
      "who": "officers"
     },
     {
      "t": "Issue a new revision",
      "steps": [
       "The document → **Edit**",
       "**New revision (Rev …)**",
       "**replace** the file, or change the text",
       "**What changed in Rev …** — for the crew (optional)",
       "**Save** → **Issue Rev …** → **Issue**"
      ],
      "note": "Everyone is asked to read and sign again.",
      "who": "officers"
     },
     {
      "t": "What the revision changes (AI)",
      "steps": [
       "The document → **AI: read this revision**",
       "**What changed**, then **Checklists and forms that now disagree** — **Open the checklist**",
       "The note for the crew — check it → **Save on the document**"
      ],
      "note": "Nothing changes until you change it.",
      "who": "officers",
      "perVessel": true
     },
     {
      "t": "Who has signed",
      "steps": [
       "The document → **Signatures**",
       "**Read by … of …**, **Not yet:** names"
      ]
     },
     {
      "t": "Withdraw it",
      "steps": [
       "The document → **Edit** → **Withdraw document** → **Withdraw**"
      ],
      "note": "It leaves the list; its signatures are kept.",
      "who": "officers"
     }
    ]
   },
   {
    "id": "letters",
    "title": "Correspondence",
    "path": [
     "☰ Menu",
     "Documents & compliance",
     "Correspondence"
    ],
    "who": "officers",
    "perVessel": true,
    "intro": "Letters in and out, numbered IN- / OUT-year-number, with the file, what is owed and how it was answered.",
    "acts": [
     {
      "t": "Enter a letter received",
      "steps": [
       "**Correspondence** → **＋ Incoming**",
       "Received, from whom, subject, their reference, how it came",
       "**Attach the file** — PDF or photo",
       "**An answer or action is expected** → **Answer by**",
       "**Save** — the number is given"
      ]
     },
     {
      "t": "Answer it",
      "steps": [
       "**To answer** tab → the letter",
       "**Answer with a letter**",
       "Same party, “Re:” is filled in — the date and file",
       "**Save** — the incoming one shows Answered"
      ]
     },
     {
      "t": "Close it without a letter",
      "steps": [
       "The letter → **Close without a letter**",
       "How was it dealt with — by phone, a PMS job…",
       "**Save**"
      ]
     },
     {
      "t": "A PDF of the register",
      "steps": [
       "**Correspondence** → this year, last year or all",
       "**Share PDF**"
      ]
     }
    ]
   },
   {
    "id": "permits",
    "title": "Permits to work",
    "path": [
     "☰ Menu",
     "Documents & compliance",
     "Permits, TBT & RA",
     "Permits to work"
    ],
    "who": "everyone",
    "intro": "Hot work, enclosed space entry, work at height, electrical isolation, cold work, diving and the general permit. A permit is requested, approved by an officer, started after the toolbox meeting and closed when the area is safe.",
    "acts": [
     {
      "t": "Request a permit",
      "steps": [
       "**☰** → **Documents & compliance** → **Permits, TBT & RA**",
       "**Permits to work** → the kind — **Hot work**, **Enclosed space entry**…",
       "**＋ New permit**",
       "**Work to be done ★**, **Location ★**, **Valid from**, **Valid until**, **Team ★**",
       "**Precautions** — tick each; **Gas readings** where asked",
       "**Attach a risk assessment** — copy one from the library, or pick one made for the job",
       "**Request the permit**"
      ]
     },
     {
      "t": "Approve it",
      "steps": [
       "The permit → **Approve**",
       "**Before it can be approved:** — what is still missing"
      ],
      "note": "Only an officer or the Master approves.",
      "who": "officers"
     },
     {
      "t": "Hold the toolbox meeting",
      "steps": [
       "The approved permit → **＋ Hold the toolbox meeting**",
       "**Present — tap each person at the meeting**; **Also present (not on the team)**",
       "**Raised / agreed** — questions and what was agreed",
       "**Sign the toolbox meeting** — or **Leave for an officer to sign**"
      ],
      "note": "Someone not marked present cannot start until a meeting with them is held."
     },
     {
      "t": "Start and close the work",
      "steps": [
       "**Start the work**",
       "Finished: **Close — work complete, area safe**",
       "**Closed at** — date and time",
       "**Sign — work complete, area safe**"
      ],
      "note": "Past **Valid until** the permit shows **Overdue — close or renew**."
     },
     {
      "t": "Cancel it",
      "steps": [
       "The permit → **Cancel the permit**"
      ]
     },
     {
      "t": "Print it, find old ones",
      "steps": [
       "The permit → **Permit PDF**",
       "**Archive — by month** → the month"
      ]
     }
    ]
   },
   {
    "id": "risk",
    "title": "Risk assessments",
    "path": [
     "☰ Menu",
     "Documents & compliance",
     "Permits, TBT & RA",
     "Risk assessments"
    ],
    "who": "everyone",
    "intro": "A library of the vessel’s assessments, and a copy for each job made from it. A permit, a change (MOC) or a chemical needs an approved one.",
    "acts": [
     {
      "t": "Start the library",
      "steps": [
       "**Permits, TBT & RA** → **Risk assessments**",
       "**Add the starter library** — enclosed space, hot work, working aloft, mooring, tender, bunkering",
       "Open each and word it for the vessel"
      ]
     },
     {
      "t": "Write an assessment",
      "steps": [
       "**＋ Library assessment** — or **＋ For a job**",
       "**Task ★**, **Description**, **Location**; **Keep in the library**",
       "**＋ Add a hazard** — the hazard, who could be harmed and how",
       "**Before** — **Likelihood**, **Severity**",
       "Controls, then **With controls** — the residual risk",
       "**Save**"
      ]
     },
     {
      "t": "Approve it",
      "steps": [
       "**Approve the assessment**"
      ],
      "note": "Save first if you changed anything. Any later change clears the approval.",
      "who": "officers"
     }
    ]
   },
   {
    "id": "chem",
    "title": "Chemicals and SDS",
    "path": [
     "☰ Menu",
     "Documents & compliance",
     "Permits, TBT & RA",
     "Chemicals"
    ],
    "who": "everyone",
    "perVessel": true,
    "intro": "Every product kept aboard with its safety data sheet: hazards, PPE, first aid, fire, spill, storage. Amber: no SDS, an SDS over five years old, or a dangerous product without an approved assessment.",
    "acts": [
     {
      "t": "Add a chemical",
      "steps": [
       "**Permits, TBT & RA** → **Chemicals** → **＋ Chemical**",
       "**Product name**, **Maker / supplier**, **Used for**",
       "**Where it is kept, how much** — **＋ Another place**",
       "**Add the SDS** — PDF or photo",
       "**Save**"
      ],
      "who": "officers"
     },
     {
      "t": "Let the AI read the SDS",
      "steps": [
       "After the SDS is added → **Read from the SDS (AI)**",
       "Check it → **Put into the card** → **Save**"
      ],
      "note": "It replaces the hazards, PPE, first aid, fire, spill and storage with what this SDS says.",
      "who": "officers"
     },
     {
      "t": "Check the card",
      "steps": [
       "The card against the paper SDS → **Checked against the SDS**"
      ],
      "note": "A new SDS or any change to what it says clears the check.",
      "who": "officers"
     },
     {
      "t": "Assess a dangerous product",
      "steps": [
       "The card → **Risk assessment**",
       "**Assess: on deck / in a room** or **Assess: in an enclosed space**",
       "Hazards and controls come from the card — approve it"
      ],
      "who": "officers"
     },
     {
      "t": "Name it on a permit",
      "steps": [
       "The permit → **Chemicals used** — tap the product",
       "Its PPE shows on the permit"
      ]
     },
     {
      "t": "Report, or take it off",
      "steps": [
       "**Chemicals** → **PDF** or **Excel** — first aid, fire and spill for each",
       "The card → **Taken off the vessel**"
      ],
      "note": "Permits and assessments that name it keep their record."
     }
    ]
   },
   {
    "id": "surveys",
    "title": "Surveys & audits",
    "path": [
     "☰ Menu",
     "Documents & compliance",
     "Surveys & audits"
    ],
    "who": "everyone",
    "intro": "Class, flag, ISM audits, dry-dock — each with its window. A vessel certificate stays valid only while every annual, intermediate and renewal survey is endorsed inside its window.",
    "acts": [
     {
      "t": "Plan what applies",
      "steps": [
       "**☰** → **Documents & compliance** → **Surveys & audits**",
       "**＋ Add** → **Choose what applies to the vessel** — or **Own…**",
       "Name, **Anniversary date** or **Due date**, **By — class, flag, auditor**",
       "**Window, months before** / **after**, **Repeat every (months, 0 = once)**",
       "**Save**"
      ],
      "who": "officers"
     },
     {
      "t": "A certificate’s surveys",
      "steps": [
       "**Certificates** → **Vessel** → the certificate (with its expiry)",
       "**＋ Plan surveys** → **Plan …**"
      ],
      "note": "The anniversary is the expiry’s day and month.",
      "who": "officers"
     },
     {
      "t": "Record one carried out",
      "steps": [
       "The survey → **Carried out**",
       "Date, **Report / endorsement No.**, **Findings, conditions of class, remarks**",
       "A renewal: **New expiry**, **New certificate No.**",
       "**Sign**"
      ],
      "note": "An intermediate also records the annual it replaces. A renewal plans the new cycle — attach the new certificate on its card.",
      "who": "officers"
     },
     {
      "t": "Change or remove one",
      "steps": [
       "The pencil beside it → change → **Save**",
       "or **Remove**"
      ],
      "note": "What was carried out stays in the history.",
      "who": "officers"
     }
    ]
   },
   {
    "id": "reports",
    "title": "Reports",
    "path": [
     "☰ Menu",
     "Documents & compliance",
     "Reports"
    ],
    "who": "everyone",
    "intro": "The equipment register and the inspection reports, as PDF, Excel or a ZIP with the photos.",
    "acts": [
     {
      "t": "Export the register",
      "steps": [
       "**☰** → **Documents & compliance** → **Reports** → **Register**",
       "**All**, **60 days**, **6 months**, **12 months** — only what falls due",
       "**Included categories** — **Select all** / **Clear all**, or tap each",
       "**Export PDF**, **Export XLSX** or **Print**"
      ],
      "note": "With a horizon the heading says so — the sheet to walk round with before an inspection."
     },
     {
      "t": "The register with its photos",
      "steps": [
       "**Register** → **Export ZIP (PDF + photos)**"
      ]
     },
     {
      "t": "An inspection report",
      "steps": [
       "**Reports** → **Inspections**",
       "**Equipment group** — LSA, FFE or **All**",
       "**Period** — **Weekly**, **Monthly**, **Quarterly**, **Annual**",
       "Categories — tap to leave out; press and hold for one alone",
       "**Previous period** / **Next period**",
       "**Export PDF**, **Export XLSX** or **Print**"
      ],
      "note": "It opens with the period’s status, lists every signed inspection, what was not inspected and every open defect."
     }
    ]
   },
   {
    "id": "chat",
    "title": "Chat",
    "path": [
     "☰ Menu",
     "Chat"
    ],
    "who": "everyone",
    "perVessel": true,
    "intro": "The vessel’s channels: Crew (everyone aboard), Officers, Office. A phone hears a new message even when the app is closed.",
    "acts": [
     {
      "t": "Write in a channel",
      "steps": [
       "**☰** → **Chat** → **Crew** / **Officers** / **Office**",
       "**Write a message…**",
       "**Send**"
      ]
     },
     {
      "t": "Call someone in",
      "steps": [
       "Type **@** and the name — or **@Office** in the Office channel",
       "**Send** — it is on top of their Board"
      ]
     },
     {
      "t": "Read older messages",
      "steps": [
       "Top of the channel → **Earlier messages**"
      ]
     },
     {
      "t": "Keep a copy",
      "steps": [
       "The channel → **PDF, last 30 days** or **PDF, all**",
       "**Share PDF**"
      ]
     },
     {
      "t": "Hear new messages",
      "steps": [
       "**☰** → **Settings** → **App & notifications** → **Modules**",
       "**Expiry reminders** — on",
       "Allow notifications when the phone asks"
      ],
      "note": "The phone gets “New message in Officers” even when the app is closed — never the text. A tap opens the channel. The app open — a strip on top of any screen; a red count on Chat. In a browser — the tab’s own notification."
     }
    ]
   }
  ]
 },
 {
  "title": "Settings",
  "screens": [
   {
    "id": "settings",
    "title": "Settings — the page",
    "path": [
     "☰ Menu",
     "Settings"
    ],
    "who": "everyone",
    "intro": "The “This device” card on top, then six groups: Vessel & ship’s time, Crew & accounts, Inspections & signatures, Data & photos, App & notifications, Help & legal. Each group opens as its own page.",
    "acts": [
     {
      "t": "Open a group",
      "steps": [
       "**☰** → **Settings**",
       "Tap the group — **Vessel & ship's time**, **Crew & accounts**, **Inspections & signatures**, **Data & photos**, **App & notifications** or **Help & legal**"
      ],
      "note": "Crew & accounts shows only to those who manage the crew."
     },
     {
      "t": "Change the look",
      "steps": [
       "**Settings** — the three marks at the top right",
       "Sun — light · moon — dark · star — the third theme"
      ]
     },
     {
      "t": "See whether the vessel is licensed",
      "steps": [
       "**Settings** → **PRO** at the top right",
       "Green — the vessel is licensed; blue — not yet"
      ]
     },
     {
      "t": "Read the manual, privacy and terms",
      "steps": [
       "**Settings** → **Help & legal**",
       "**User Manual**, **Privacy Policy** or **Terms of Use**"
      ]
     }
    ]
   },
   {
    "id": "vessel",
    "title": "Vessel and ship’s time",
    "path": [
     "☰ Menu",
     "Settings",
     "Vessel & ship's time"
    ],
    "who": "everyone",
    "intro": "The vessel’s facts go on every report. Ship’s time is printed beside UTC; past days keep the zone they were kept in.",
    "acts": [
     {
      "t": "Fill in the vessel",
      "steps": [
       "**Settings** → **Vessel & ship's time**",
       "**Vessel** — open the card",
       "**Vessel name**, **IMO number**, **Flag**, **Call sign**, **MMSI** (9 digits)",
       "**Save vessel info** — later **Save changes**"
      ]
     },
     {
      "t": "Set ship’s time",
      "steps": [
       "**Vessel** card → **SHIP'S TIME**",
       "Pick **UTC+…** — or **As the device**",
       "**Save changes**"
      ],
      "note": "The line under it shows ship’s time and UTC now. The change is kept in the history."
     },
     {
      "t": "Plan a clock change",
      "steps": [
       "**Vessel** card → **CLOCK CHANGES**",
       "**Date (ship's time)** and **Time**",
       "**Advance 1 h (+1)** or **Retard 1 h (−1)**"
      ],
      "note": "At that moment every device switches by itself and the Deck Log records it."
     },
     {
      "t": "Cancel a planned change",
      "steps": [
       "**CLOCK CHANGES** → the change → ✕",
       "**Cancel the change**"
      ]
     }
    ]
   },
   {
    "id": "masterpage",
    "title": "Master’s page — who may see and do what",
    "path": [
     "☰ Menu",
     "Settings",
     "Crew & accounts",
     "Master's page"
    ],
    "who": "master",
    "intro": "One table: rows are the menu, its pages and the buttons given person by person; columns are the devices aboard, each with its rank on top. A dot glows when that device has it.",
    "acts": [
     {
      "t": "Show or hide a menu entry on a device",
      "steps": [
       "**Settings** → **Crew & accounts** → **Master's page**",
       "Find the row (the menu entry) and the column (the device)",
       "Tap the dot — it glows or dims"
      ],
      "note": "The phone follows on its next sync. Entries and pages are tidiness, not a lock."
     },
     {
      "t": "Hide one page of a screen",
      "steps": [
       "**Master's page** → the page row under its entry",
       "Tap the dot in that device’s column"
      ]
     },
     {
      "t": "Let someone manage a place (the ⚙ gear)",
      "steps": [
       "**Master's page** → the ⚙ row under the entry",
       "Tap the dot — the person gets the gear on that screen"
      ],
      "note": "Off by default. The server holds to it."
     },
     {
      "t": "Make a crew member an officer — or back",
      "steps": [
       "**Master's page** → the rank on top of the column",
       "**Make Officer** — or **Make Crew**"
      ],
      "note": "Rows marked “by rank” follow the rank: planning drills, the officers’ documents."
     },
     {
      "t": "Rules for the whole vessel",
      "steps": [
       "**Master's page** → **The whole vessel**",
       "Switch **Scan the QR label before signing**, **Each device signs as its own account**, **Confirm every signature**"
      ]
     },
     {
      "t": "Issue accounts and approve devices",
      "steps": [
       "**Master's page** → **Accounts**"
      ],
      "note": "See Joining a vessel and accounts."
     }
    ]
   },
   {
    "id": "emailreport",
    "title": "Monthly email report",
    "path": [
     "☰ Menu",
     "Settings",
     "Crew & accounts",
     "Email report"
    ],
    "who": "master",
    "intro": "A digest of expired equipment, certificates falling due, open defects, non-conformities, overdue drills and observations — to the owner or DPA on the 1st of each month at 08:00 UTC.",
    "acts": [
     {
      "t": "Switch it on",
      "steps": [
       "**Settings** → **Crew & accounts** → **Email report**",
       "**Enable monthly email**"
      ]
     },
     {
      "t": "Add or remove a recipient",
      "steps": [
       "**Recipients** — type the address",
       "**Add**",
       "To take one off: **Remove** beside it"
      ]
     },
     {
      "t": "Write the Master’s note",
      "steps": [
       "**Master's note** — one point a line",
       "**Save the note**"
      ],
      "note": "It goes on top of the next report, once."
     },
     {
      "t": "Let the AI draft the note",
      "steps": [
       "**Master's note** → **AI: draft the brief**",
       "Read it → **Put into the brief**",
       "Edit → **Save the note**"
      ],
      "note": "Drafted from the vessel’s open points and this month’s numbers; in English.",
      "perVessel": true
     },
     {
      "t": "Send the report now",
      "steps": [
       "**Send report now**",
       "**Send**"
      ]
     }
    ]
   },
   {
    "id": "checklists",
    "title": "Checklists",
    "path": [
     "☰ Menu",
     "Settings",
     "Inspections & signatures",
     "Checklists"
    ],
    "who": "everyone",
    "intro": "What each round asks, category by category — weekly, monthly, quarterly. Everyone reads them; officers word them. Rounds already signed keep the questions they were signed against.",
    "acts": [
     {
      "t": "Read what a round asks",
      "steps": [
       "**Settings** → **Inspections & signatures** → **Checklists**",
       "Tap the round"
      ]
     },
     {
      "t": "Word a round for this vessel",
      "steps": [
       "**Checklists** → the round",
       "Change, add (**Add a line**) or remove lines",
       "**Save for this vessel**"
      ],
      "note": "The standard one stays underneath. The row is marked **Edited**.",
      "who": "officers"
     },
     {
      "t": "Add a round a category does not have",
      "steps": [
       "**Checklists** → the category → **Add a round** → **＋ Weekly** / **＋ Monthly** / **＋ Quarterly**",
       "**Add** — or **Add and word it**"
      ],
      "note": "It starts from the category’s existing checks.",
      "who": "officers"
     },
     {
      "t": "Stop a round the vessel does not owe",
      "steps": [
       "**Checklists** → the switch on the round’s row",
       "**Switch off**"
      ],
      "note": "No longer offered or counted as due. Signed records stay and still print.",
      "who": "officers"
     },
     {
      "t": "Go back to the standard wording",
      "steps": [
       "Open the round",
       "**Use the standard checklist again**",
       "**Use the standard**"
      ],
      "who": "officers"
     },
     {
      "t": "Remove a round this vessel added",
      "steps": [
       "Open the round",
       "**Remove this … round**",
       "**Remove**"
      ],
      "who": "officers"
     }
    ]
   },
   {
    "id": "categories",
    "title": "Categories",
    "path": [
     "☰ Menu",
     "Settings",
     "Inspections & signatures",
     "Categories"
    ],
    "who": "everyone",
    "intro": "Headings of your own on top of the built-in ones, and the built-in ones you do not use hidden.",
    "acts": [
     {
      "t": "Add a heading",
      "steps": [
       "**Settings** → **Inspections & signatures** → **Categories**",
       "**New heading** — the name",
       "**Group** — LSA, FFE or Other (decides the report)",
       "**Icon**",
       "**Add heading**"
      ],
      "who": "officers"
     },
     {
      "t": "Rename a heading",
      "steps": [
       "**Categories** → ✎ on the row",
       "Change it → **Save changes**"
      ],
      "who": "officers"
     },
     {
      "t": "Hide or show a category",
      "steps": [
       "**Categories** → the eye on the row"
      ],
      "who": "officers"
     },
     {
      "t": "Remove your own heading",
      "steps": [
       "**Categories** → ✕ on the row",
       "**Remove**"
      ],
      "note": "The items under it stay in storage with their history; adding the heading back brings them back.",
      "who": "officers"
     }
    ]
   },
   {
    "id": "signrules",
    "title": "Signing rules and PINs",
    "path": [
     "☰ Menu",
     "Settings",
     "Inspections & signatures"
    ],
    "who": "everyone",
    "intro": "The vessel’s rules for signing — everyone sees them, only the Master moves them — and the PINs on this device.",
    "acts": [
     {
      "t": "Require a scan before signing",
      "steps": [
       "**Settings** → **Inspections & signatures**",
       "**Scan QR label before signing** — on"
      ],
      "note": "Crew and officers then scan the item before they sign its inspection.",
      "who": "master"
     },
     {
      "t": "Let a category sign from the list",
      "steps": [
       "**Inspections & signatures** → **Scan by category**",
       "Switch the category to **sign from the list**"
      ],
      "note": "For inventories such as the rescue boat’s gear. Shown while the scan rule is on.",
      "who": "master"
     },
     {
      "t": "Make each device sign as its own account",
      "steps": [
       "**Inspections & signatures** → **Sign as the device's account** — on"
      ],
      "note": "No picking a colleague’s name: the account is the signature.",
      "who": "master"
     },
     {
      "t": "Set or change your signing PIN",
      "steps": [
       "**Inspections & signatures** → **My signing PIN**",
       "Your PIN (or the Master PIN) → the new one, twice"
      ]
     },
     {
      "t": "Change the Master PIN",
      "steps": [
       "**Inspections & signatures** → **Master PIN**",
       "The old PIN → the new one, twice"
      ],
      "note": "Shown in orange while it is still 0000.",
      "who": "master"
     },
     {
      "t": "Reset a forgotten PIN on this device",
      "steps": [
       "**Inspections & signatures** — the list of PINs on this device",
       "**Reset** beside the name → **Reset**"
      ],
      "note": "The holder chooses a new one at the next signature. For someone’s own phone: **Crew signing PINs** → Crew matrix.",
      "who": "master"
     }
    ]
   },
   {
    "id": "data",
    "title": "Backups, roll-back and restore",
    "path": [
     "☰ Menu",
     "Settings",
     "Data & photos",
     "Data"
    ],
    "who": "officers",
    "intro": "A snapshot is saved by itself each time the app opens; a .msm file is the whole register with its files. Restore replaces everything — the Master’s.",
    "acts": [
     {
      "t": "Get the blank Excel template",
      "steps": [
       "**Settings** → **Data & photos** → **Data**",
       "**Download LSA / FFE template** — or **Download lifting & mooring template**"
      ]
     },
     {
      "t": "Make a backup file",
      "steps": [
       "**Data** → **Export backup (.msm)**",
       "**Password for this backup** — type it twice → **Protect**",
       "or **No password**",
       "Save or share the file"
      ],
      "note": "The file holds crew passports and treatments. A forgotten password cannot be recovered."
     },
     {
      "t": "Roll back to how it was",
      "steps": [
       "**Data** → **Roll back to …** (the date on the row)",
       "Pick the snapshot — or **Older · …**",
       "**Roll back**"
      ],
      "note": "An officer rolls back this device only; the Master’s roll-back on a syncing device reaches the vessel. Photos and documents are not part of a snapshot."
     },
     {
      "t": "Keep a snapshot as a file",
      "steps": [
       "**Data** → **Save a copy as a file**",
       "Pick the copy (on opening / before import)",
       "Password or **No password**"
      ],
      "note": "Nothing is rolled back."
     },
     {
      "t": "Restore from a backup file",
      "steps": [
       "**Data** → **Restore backup (.msm)**",
       "Choose the .msm — its password if it has one",
       "Check what it holds → **Restore**"
      ],
      "note": "Replaces ALL data on this device; on a syncing device the vessel and the other devices take it too.",
      "who": "master"
     },
     {
      "t": "Choose where reports are saved (web)",
      "steps": [
       "**Data & photos** → **Folders**",
       "**Change** beside the section — or **Forget**"
      ],
      "note": "The first save in a section asks for the folder."
     },
     {
      "t": "Erase everything on this device",
      "steps": [
       "**Settings** → **Help & legal**",
       "**Reset all data**",
       "Type **Reset all data** in **Password**",
       "**Reset**"
      ],
      "note": "Cannot be undone; on a syncing device it clears the vessel. To empty only your own phone use **Sign off & erase**.",
      "who": "master"
     }
    ]
   },
   {
    "id": "photos",
    "title": "Photos — upload and archive",
    "path": [
     "☰ Menu",
     "Settings",
     "Data & photos",
     "Inspection photos"
    ],
    "who": "everyone",
    "intro": "Records sync at once; photographs wait for a connection worth spending. The cloud keeps them 90 days, then the vessel keeps its monthly archive.",
    "acts": [
     {
      "t": "Choose when photos go up",
      "steps": [
       "**Settings** → **Data & photos** → **Inspection photos**",
       "**Wi-Fi only**, **Any connection** or **Never upload**"
      ],
      "note": "Never: photos stay on this device, and still travel in a .msm backup."
     },
     {
      "t": "Send the waiting photos now",
      "steps": [
       "**Inspection photos** → **Upload now**"
      ]
     },
     {
      "t": "Save a month’s archive",
      "steps": [
       "**Inspection photos** → **Photo archive**",
       "**Months to archive** → the earliest month",
       "**Save** — a ZIP with the photographs and index.csv"
      ],
      "note": "Earlier months first. On a phone without ZIP: from the web app."
     },
     {
      "t": "Confirm a month archived",
      "steps": [
       "Save the month’s ZIP",
       "**Saved — mark archived**"
      ],
      "note": "From then the photographs of that month may be deleted from the cloud. Signed records are never touched.",
      "who": "master"
     }
    ]
   },
   {
    "id": "appprefs",
    "title": "Language, reminders, sounds",
    "path": [
     "☰ Menu",
     "Settings",
     "App & notifications"
    ],
    "who": "everyone",
    "intro": "This device only — every phone keeps its own.",
    "acts": [
     {
      "t": "Change the language",
      "steps": [
       "**Settings** → **App & notifications**",
       "**Language** → pick it — or **As the device**"
      ],
      "note": "Reports stay in English."
     },
     {
      "t": "Expiry reminders",
      "steps": [
       "**App & notifications** → **Modules**",
       "**Expiry reminders** — on",
       "Allow notifications when the phone asks"
      ],
      "note": "60, 30 and 7 days before an inspection or expiry — and new chat messages."
     },
     {
      "t": "Sounds on or off",
      "steps": [
       "**Modules** → **Sounds**"
      ]
     },
     {
      "t": "Keep a BA compressor log",
      "steps": [
       "**Modules** → **BA Compressor log** — on",
       "**Open compressor log**"
      ],
      "note": "See BA compressor."
     }
    ]
   },
   {
    "id": "licence",
    "title": "The vessel licence",
    "path": [
     "☰ Menu",
     "Settings",
     "PRO"
    ],
    "who": "master",
    "intro": "The licence belongs to the vessel, not to a phone: once it is on the ship’s account every device that joined has full access. Nothing is bought in the app.",
    "acts": [
     {
      "t": "Ask for a quote",
      "steps": [
       "**Settings** → **PRO**",
       "**Request a quote** — the mail opens with the vessel’s name"
      ],
      "note": "Web app. Priced by the vessel’s size and the modules it uses."
     },
     {
      "t": "Activate the licence key",
      "steps": [
       "Join the vessel first",
       "**Settings** → **PRO**",
       "**Activate the vessel licence** — paste the key",
       "**Activate licence**"
      ]
     },
     {
      "t": "A device does not show the licence",
      "steps": [
       "**Settings** → **PRO**",
       "**Restore the vessel licence**"
      ],
      "note": "Joining the vessel brings it too.",
      "who": "everyone"
     }
    ]
   }
  ]
 },
 {
  "title": "Office, AI and API",
  "screens": [
   {
    "id": "fleet",
    "title": "Fleet console — getting in",
    "path": [
     "☰ Menu",
     "Settings",
     "Crew & accounts",
     "Fleet console"
    ],
    "who": "office",
    "intro": "For a superintendent ashore: every vessel they look after in one console, worst first. It opens in a browser at app.ismpilot.com/fleet, with its own sign-in. Each vessel’s Master lets the office in.",
    "acts": [
     {
      "t": "Let the office into the vessel",
      "steps": [
       "**☰** → **Settings** → **Accounts**",
       "**Issue an account** — the superintendent’s name, type **Superintendent (shore)**",
       "**Issue** — the PIN is shown",
       "Send the PIN and the vessel’s IMO to the superintendent"
      ],
      "note": "The invitation is good for 48 hours and one device.",
      "who": "master"
     },
     {
      "t": "Open the console the first time",
      "steps": [
       "app.ismpilot.com/fleet — or **Settings** → **Crew & accounts** → **Fleet console**",
       "**Superintendent** — first name, last name",
       "**IMO number** and **PIN from the Master**",
       "**Add vessel**"
      ]
     },
     {
      "t": "Add another vessel",
      "steps": [
       "**Add vessel**",
       "Its **IMO number** and the **PIN from the Master** of that vessel",
       "**Add vessel**"
      ]
     },
     {
      "t": "Bring the figures up to date",
      "steps": [
       "**Refresh**"
      ]
     },
     {
      "t": "Sign out on a shared computer",
      "steps": [
       "**Sign out of the fleet console on this browser**"
      ]
     },
     {
      "t": "Take the office’s access away",
      "steps": [
       "**☰** → **Settings** → **Accounts**",
       "Tap the superintendent’s account",
       "**Switch off** — the console loses the vessel at once"
      ],
      "who": "master"
     }
    ]
   },
   {
    "id": "attention",
    "title": "Needs attention",
    "path": [
     "Fleet console",
     "Needs attention"
    ],
    "who": "office",
    "intro": "What the console opens on, for every vessel at once: what waits for the office’s answer, and what is red today.",
    "acts": [
     {
      "t": "Answer what waits for you",
      "steps": [
       "**Needs attention** → **Waiting for your answer**",
       "Emergencies first, then whatever has waited longest — vessel, who asked, how long ago",
       "Tap a line — its vessel opens with the record ready to answer"
      ],
      "note": "PMS deferrals, defects and NCs closed aboard, requisitions sent to the office, emergencies sent without it."
     },
     {
      "t": "See what is wrong now",
      "steps": [
       "**Needs attention** → **Red today**",
       "Vessel by vessel, worst first: detention, critical equipment out of service, defects on critical equipment, overdue findings, overdue PMS, expired certificates and equipment",
       "Tap a line — the vessel’s tab opens"
      ],
      "note": "What is merely due stays on the vessel cards."
     },
     {
      "t": "Look over the fleet",
      "steps": [
       "**Vessels**",
       "A card per vessel: certificates (vessel, crew), documents missing, spares out and low, critical defects, last PSC, detention",
       "Tap a card — the vessel opens"
      ]
     }
    ]
   },
   {
    "id": "fleetvessel",
    "title": "A vessel in the console",
    "path": [
     "Fleet console",
     "Vessels",
     "the vessel"
    ],
    "who": "office",
    "intro": "The vessel’s own tabs. Certificates and ISM documents are kept from the office; changes reach the devices aboard on their next sync. Equipment and PMS are shown, not changed — they are worked aboard.",
    "acts": [
     {
      "t": "Add a certificate",
      "steps": [
       "**Certificates** → **+ Add certificate**",
       "**Certificate**, **Number**, **Issued by**, **Issued**, **Expires**",
       "**Attach the certificate (PDF / photo)**",
       "**Save**"
      ]
     },
     {
      "t": "Renew or remove a certificate",
      "steps": [
       "**Certificates** → tap it",
       "New dates and the new file — **Save**",
       "Or **Remove certificate** — the crew lose it on their next sync"
      ]
     },
     {
      "t": "Send an ISM document aboard",
      "steps": [
       "**Documents** → **+ Add document**",
       "**Title ★**, number, kind",
       "**Attach the file (PDF)** — or write the **Text**",
       "**Save** — the crew read and sign it aboard"
      ]
     },
     {
      "t": "Issue a new revision",
      "steps": [
       "**Documents** → tap the document",
       "**New revision (Rev n) — everyone signs again**",
       "The new file or text",
       "**Issue**"
      ],
      "note": "Changed your mind: **Keep Rev n**."
     },
     {
      "t": "See who has not signed",
      "steps": [
       "**Documents**",
       "Under each document: **Not signed:** and the names"
      ]
     },
     {
      "t": "See what is due aboard",
      "steps": [
       "**Equipment** — expired and due items",
       "**PMS** — jobs overdue and due"
      ],
      "note": "Read only."
     },
     {
      "t": "Follow the inspections and critical equipment",
      "steps": [
       "**External inspections** — each visit, findings open and overdue, detention",
       "**Critical equipment** — defects on critical machines and what is out of service"
      ],
      "perVessel": true
     }
    ]
   },
   {
    "id": "officeverify",
    "title": "To verify — defects, NCs, deferrals",
    "path": [
     "Fleet console",
     "the vessel",
     "To verify"
    ],
    "who": "office",
    "perVessel": true,
    "intro": "Machinery defects closed aboard, NCs closed by the Master, and PMS jobs the Master has deferred. A deferral holds as soon as the Master signs it; the office approves it or refuses it.",
    "acts": [
     {
      "t": "Verify a closed defect or NC",
      "steps": [
       "**To verify** → tap it",
       "Read what was done, look at the repair photos",
       "**Note** — optional",
       "**Verify**"
      ],
      "note": "A safety-critical or class-affecting defect cannot be closed aboard without a photo of the repair."
     },
     {
      "t": "Return a defect to the vessel",
      "steps": [
       "**To verify** → tap the defect",
       "**Note** — what is missing (required)",
       "**Return to the vessel**"
      ],
      "note": "It is open again aboard, marked “Returned by the office”, with your reason on the Board. The earlier closure stays in its history."
     },
     {
      "t": "Approve a PMS deferral",
      "steps": [
       "**To verify** → tap the deferral",
       "Read the **Risk assessment** under it — hazards, controls, the risk left",
       "**Approve**"
      ]
     },
     {
      "t": "Refuse a deferral",
      "steps": [
       "**To verify** → tap the deferral",
       "**Note** — why the job cannot wait (required)",
       "**Refuse**"
      ],
      "note": "The job is due on its own dates again; the Master sees your reason on the Board and may defer again with a new request."
     }
    ]
   },
   {
    "id": "requisitions",
    "title": "Requisitions",
    "path": [
     "Fleet console",
     "the vessel",
     "Requisitions"
    ],
    "who": "office",
    "perVessel": true,
    "intro": "Requisitions the Master sends to the office. To decide first, then approved but not placed, then in work.",
    "acts": [
     {
      "t": "Approve a requisition",
      "steps": [
       "**Requisitions** → tap it",
       "Check the lines and the quotations",
       "**Approve** — the vessel may place it with the supplier"
      ]
     },
     {
      "t": "Send it back or reject it",
      "steps": [
       "**Requisitions** → tap it",
       "**Note to the vessel** (required)",
       "**Return for rework** or **Reject**"
      ]
     },
     {
      "t": "Answer an emergency order",
      "steps": [
       "**Needs attention** → **Sent without approval**",
       "Tap it — it already went to the supplier",
       "**Approve**, or **Return for rework** / **Reject** with a note"
      ]
     },
     {
      "t": "Record that it was placed",
      "steps": [
       "**Requisitions** → **Approved, not placed yet** → tap it",
       "**Placed with the supplier**"
      ]
     }
    ]
   },
   {
    "id": "officetalk",
    "title": "Talking with the vessel",
    "path": [
     "Fleet console",
     "the vessel"
    ],
    "who": "office",
    "perVessel": true,
    "intro": "Each tab is there when its module is on for the vessel. The count on a tab is what waits for the office.",
    "acts": [
     {
      "t": "Answer a discussion",
      "steps": [
       "**Discussions** → tap the record (a defect, an NC, a requisition)",
       "**Write a message…**",
       "**Send** — it leaves **Waiting for your answer**"
      ],
      "note": "Any open record can be asked about from here too."
     },
     {
      "t": "Write in the Office channel",
      "steps": [
       "**Chat**",
       "**Write a message…** → **Send**"
      ],
      "note": "The vessel’s messages since the office last wrote are counted on the tab."
     },
     {
      "t": "Answer a management of change",
      "steps": [
       "**Changes (MOC)** → tap it",
       "The change, why, the documents it touches, the **Risk assessment**",
       "**Approve** — or a word for the vessel and **Return to the vessel** / **Reject**"
      ]
     },
     {
      "t": "Send a letter to the vessel",
      "steps": [
       "**Correspondence** → **+ Letter to the vessel**",
       "Subject, file, **An answer or action is expected** and **Answer by** if it does",
       "**Save** — it arrives in the vessel’s register with its own number"
      ]
     },
     {
      "t": "See who has not signed the Master’s orders",
      "steps": [
       "**Master’s orders** — the count is signatures still missing tonight"
      ]
     }
    ]
   },
   {
    "id": "ask",
    "title": "Ask ISM AI Pilot",
    "path": [
     "☰ Menu",
     "Board",
     "✦"
    ],
    "who": "everyone",
    "perVessel": true,
    "intro": "Questions about the vessel’s records, answered from them and nothing else — in any language. Patients’ and guests’ records never leave the vessel and are not used.",
    "acts": [
     {
      "t": "Ask a question",
      "steps": [
       "**Board** → **✦** (Ask ISM AI Pilot) at the top",
       "Type it under **Ask in any language** — or tap an example",
       "**Ask**"
      ],
      "note": "The device must have joined the vessel (Settings → Sync)."
     },
     {
      "t": "See which records it used",
      "steps": [
       "Under the answer: **From n record lines**",
       "**Hide the records used** to fold them"
      ],
      "note": "Check what matters in the record itself."
     },
     {
      "t": "Work started without a connection",
      "steps": [
       "Any AI action with no connection: **Waits for a connection**",
       "When it is **Ready** — the result is on the Board and here",
       "**Open as a draft** (or **Open the plan**) — check it, then save it",
       "Not needed: **Remove**; still waiting: **Cancel**"
      ],
      "note": "Certificate scans, quotations, invoices, makers’ manuals, NC drafts, revisions, diagnoses, briefs, log entries."
     }
    ]
   },
   {
    "id": "api",
    "title": "Vessel API",
    "path": [
     "☰ Menu",
     "Settings",
     "Crew & accounts",
     "API access"
    ],
    "who": "master",
    "intro": "The vessel’s due dates, equipment, vessel and equipment certificates, surveys, open defects and running hours as JSON — for the office’s reporting, BI or the AMS computer. Crew names, crew certificates, hours of rest and who signed never leave through it.",
    "acts": [
     {
      "t": "Issue a key",
      "steps": [
       "**Settings** → **Crew & accounts** → **API access**",
       "Under **New key**: who uses it (Office BI, AMS PC)",
       "**May write running hours** — off: read only",
       "**Issue key**",
       "Copy it now — it is shown once",
       "**I have saved it**"
      ],
      "note": "The vessel keeps only a fingerprint: a lost key is revoked and a new one issued."
     },
     {
      "t": "Test it",
      "steps": [
       "When the key is shown: **Copy a test command (curl)**",
       "Run it on the office computer"
      ]
     },
     {
      "t": "See how a key is used",
      "steps": [
       "**API access** → **Keys**",
       "Each: who issued it, when, **last used** and how many requests"
      ]
     },
     {
      "t": "Stop a key",
      "steps": [
       "**Keys** → **Revoke**",
       "**Revoke** again to confirm — it stops at once"
      ]
     },
     {
      "t": "Check the running hours sent",
      "steps": [
       "**API access** → **Written through the API**",
       "What was taken, and **n not taken**"
      ],
      "note": "A reading below the last one, or more hours than the calendar allows, waits on the machine aboard for a reason."
     },
     {
      "t": "Give the integrator the details",
      "steps": [
       "Send them ismpilot.com/api — addresses, examples, limits (60 requests a minute per key)"
      ],
      "who": "everyone"
     }
    ]
   }
  ]
 }
];
