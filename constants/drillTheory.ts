// ===================================
// Drill theory — the briefing an officer reads to the crew before a drill, and
// the practical checklists. Taken from the Drill Trainer app (the same author,
// /Volumes/Z/DrillTrainer src/data/topics.ts + checklists.ts, 13 Oct 2026); the
// drill report prints the briefing as its theory annex. English: the working
// language on board. Regenerate rather than edit by hand.
// ===================================

export interface DrillTheory {
  title: string;
  /** The briefing, paragraph by paragraph. */
  text: string[];
  /** Practical checklist, where the trainer has one. */
  checklist?: { title: string; items: string[] }[];
}

export const DRILL_THEORY: Record<string, DrillTheory> = {
  "general": {
    "title": "General Emergency & Muster Drill",
    "text": [
      "Attention to all crew! Today we are having a general emergency and muster drill. Our main goal today is not just to tick a box, but to make your actions automatic. In a real emergency, we will not have time to think, and hesitation at this stage costs lives. That is why every one of you must know your duties exactly according to the Muster List, which assigns each of you a specific role — fire party, lifeboat crew, or medical team. SOLAS requires us to run this drill at least once a month, and any new crew member must take part within twenty-four hours of joining the ship. Even experienced officers who have done this drill hundreds of times must treat every single muster as if it were the real emergency, because complacency is exactly what turns a manageable situation into a tragedy.",
      "I remind you, the general emergency alarm is seven short blasts and one long blast on the ship's whistle and the alarm bells, repeated continuously until the order to muster is given. This signal is different from the fire alarm and from the abandon ship announcement, so learn to recognise it by ear, not just by counting the blasts. Usually, the alarm will be followed by an announcement over the public address system giving the nature and location of the emergency. If for any reason the public address system itself has failed, do not wait for further instructions — proceed to your Muster Station based on the alarm alone, since the muster list assumes exactly this kind of failure is possible. When you hear this alarm, you must do the following:",
      "First, stop all your work immediately, unless it is critical for the ship's safety, such as an operation that cannot be interrupted without creating an even greater hazard. Even in that case, hand over the task to someone remaining nearby if at all possible, and follow behind them to the muster point as quickly as you safely can.",
      "Second, you must dress for the weather. Even if we are in the tropics, you must wear long sleeves, trousers, closed shoes, and a hat. This will protect you from burns, cuts, and the cold if the situation gets worse. Take your lifejacket and, if necessary, your immersion suit, and go directly to the Muster Station without stopping to collect personal belongings along the way. Passports, money, and photographs can all be replaced — the only thing that truly matters in these first minutes is getting yourself, and everyone around you, safely to where you are expected to be.",
      "Pay special attention to the escape routes. You must know the main and the alternative route from your cabin and your workplace, and you should be able to find both routes even in darkness or thick smoke. Using elevators during any alarm is strictly forbidden! If the ship loses power, the elevator will become a deadly trap, and you could be stuck between decks with no way out. Rescue teams looking for you would have no idea which deck to search first, wasting precious minutes that could otherwise be spent helping others.",
      "When you arrive at the Muster Station, put on your lifejacket and tighten it well. Check the whistle and the light right now. There must be absolute silence at the Muster Station, because orders can be hard to hear over wind or engine noise. Stand in line in your assigned group, and wait for the roll call. Your group leader checks names against the crew list, and I must clearly hear the orders from the bridge, and you must clearly hear my orders. If your equipment is faulty — a torn lifejacket, a whistle that does not work, a light that will not switch on — report it immediately so it can be replaced before we actually need it in earnest.",
      "If we find out during the roll call that someone is missing, we immediately report to the bridge, and special search teams will start checking the rooms according to a pre-planned search pattern. Nobody is allowed to go back to the cabins for their things, no matter how important they seem at that moment. Panic and breaking the rules are not allowed on board. After the drill, we hold a short debrief so everyone understands what went well and what needs improvement. Remember your duties, check your equipment, and let's do this drill fast and professionally. A crew that performs the muster drill calmly and correctly, every single month, is a crew that will perform just as well the one time it truly matters."
    ]
  },
  "abandon": {
    "title": "Abandon Ship Drill",
    "text": [
      "Colleagues, please give me your full attention. The topic of this briefing is abandoning the ship. You must understand clearly: a lifeboat is the very last option. We fight to save the ship until the very end, because the ship is our best lifeboat — she has more space, more supplies, and far better protection from the sea than any survival craft. We only abandon the ship when staying on board is more dangerous than going into the water. This decision is never taken lightly, because a lifeboat exposes us to cold, waves, and uncertainty that the ship itself, even damaged, may still protect us from far better.",
      "Remember the most important rule: no automatic bell or siren is an order to abandon ship. Only the Master makes this decision, usually after every other option to save the vessel has been tried and has failed. The \"Abandon Ship\" order is given by voice over the public address system or personally by the lifeboat commanders, and it will normally be preceded by a general emergency alarm and a period of preparation. Never assume that silence from the bridge means the order is coming — wait for the explicit instruction, and continue preparing calmly in the meantime.",
      "After the order, the boat team starts the preparation. We remove the lashings and disconnect the battery charging cable. You can board the lifeboats and liferafts only with the commander's permission. You take your seats, fasten your seatbelts securely, and prepare for launching. Those responsible for GMDSS equipment — SART, EPIRB, portable VHF radios — must bring them to the boat along with extra medicine, blankets, and any additional rations if there is time. Every second spent gathering these items is a second we may not get back later, so responsible crew members should already know exactly where each item is stored before an emergency ever begins.",
      "Pay special attention to the hook release mechanisms. The main method is \"Off-load\" release. We pull the release handle only when the boat is fully in the water, never before. The \"On-load\" release system is used only in extreme situations, and it must be used very carefully so the boat does not fall from a height and injure the people inside. After we hit the water, we must release the painter line, start the engine immediately, and move away to a safe distance so we do not get pulled down with the ship or damaged by wreckage floating nearby. Only once we are a safe distance away, with the ship clearly visible and stable, do we stop the engine to conserve fuel and begin the next phase of survival.",
      "If you find yourself in the water, your biggest enemy is the cold (hypothermia). Do not try to swim actively unless you have to, because this burns your body heat far faster than staying still. Take the H.E.L.P. position: bring your knees to your chest and hold them with your arms. If there are several people, hold on to each other in a circle — this is called huddling, and it conserves heat for everyone together. Children, the injured, and the smallest members of any group should always be placed in the centre of the circle, where the most body heat is shared.",
      "Inside the boat, we immediately throw out the sea anchor so the waves do not flip us over. Everyone will get seasickness pills — take them right away, because seasickness leads to dangerous dehydration, and a dehydrated body handles cold and stress far worse. And remember: for the first 24 hours, no fresh water or food is given to anyone. The body needs time to change to survival mode, and eating or drinking too early can actually make seasickness and vomiting worse. Vomiting itself causes further water loss, so managing seasickness correctly in the first hours is directly connected to how well the body will cope with dehydration later.",
      "Finally, once we are clear of the ship and the immediate danger has passed, the boat commander organises watches, checks everyone for injuries, and begins signalling for rescue with whatever equipment we have — flares, the EPIRB, and the portable radio. Staying calm, staying together, and following the commander's orders are what turn a survival situation into a rescue story. Every lifeboat drill we run is designed to make these actions feel familiar, so that in the real event, muscle memory carries us through even when fear does not let us think clearly."
    ],
    "checklist": [
      {
        "title": "Order & authority",
        "items": [
          "Abandon ship ordered by the Master only",
          "Order given by voice / PA — no bell is the order"
        ]
      },
      {
        "title": "Personal preparation",
        "items": [
          "Lifejacket donned and tightened",
          "Immersion suit donned if required — ≤ 2 minutes",
          "Warm clothing; no time wasted on belongings"
        ]
      },
      {
        "title": "Boat preparation",
        "items": [
          "Lashings removed; battery charging cable disconnected",
          "Board only on commander’s permission",
          "Seatbelts fastened, ready for launch",
          "Painter line ready"
        ]
      },
      {
        "title": "GMDSS & survival equipment",
        "items": [
          "SART brought to the boat",
          "EPIRB brought to the boat",
          "Portable VHF radios brought to the boat",
          "Extra medicine, blankets, rations if time permits"
        ]
      },
      {
        "title": "Launch & clear",
        "items": [
          "Off-load release only when fully waterborne",
          "Engine started; move to safe distance",
          "Sea anchor deployed",
          "Seasickness pills issued; no food/water for first 24 h"
        ]
      },
      {
        "title": "Reports & headcount",
        "items": [
          "Roll call at muster / embarkation station",
          "Missing persons reported to bridge",
          "Injuries checked; signalling for rescue started"
        ]
      }
    ]
  },
  "fire": {
    "title": "Fire Drill",
    "text": [
      "Team, listen carefully. Fire is the most terrible threat at sea. We have nowhere to run, and firefighters from the shore will not come to help us. Our safety depends only on how fast we react and how correctly we act, from the very first second the alarm sounds. There is no fire brigade a radio call away, and every minute of delay allows the fire to grow exponentially rather than steadily.",
      "To fight the fire successfully, you must understand how it works. Fire only exists when there are three elements: fuel, oxygen, and heat. This is the fire triangle. Our job is to break it. We must either remove the fuel, cut off the oxygen, or cool down the surface — take away any one side of the triangle, and the fire cannot survive. Understanding this simple principle is what allows us to choose the correct method under pressure, instead of guessing.",
      "If you are the first to see a fire, do not stay quiet and do not try to be a hero alone. You must immediately press the nearest manual call point and shout loudly: \"Fire in [name of the room]!\". You can use a fire extinguisher only if the fire is small and not a danger to your life. If the fire is growing, leave the room immediately and close all doors tightly behind you to cut off the oxygen and slow its spread. Feel any closed door with the back of your hand before opening it — a hot door means fire on the other side, and opening it can create a sudden and dangerous flashover.",
      "It is critically important to choose the right fire extinguisher. If wood, paper, or a cabin is burning (Class A) — we use water, foam, or powder. If fuel or oil is burning (Class B) — we use foam, which makes a film, or powder. Never use a solid stream of water on burning oil, you will cause an explosion! If there is an electrical fire — we use only carbon dioxide (CO2) or dry powder, and first of all, we turn off the power. Using water is strictly forbidden, because it conducts electricity straight back to you! When in doubt about the class of fire, always treat it as electrical until it is proven otherwise, since the consequences of a wrong guess with water are far worse than a slightly slower response with CO2.",
      "The actions of the fire teams must be perfect. While one group isolates the room — closing the ventilation and fire dampers — another group cools the nearby bulkheads with water so the fire does not spread through the metal, and a third group stands ready with a backup hose in case the first attack fails. Clear leadership and constant communication between these groups is what prevents confusion in thick smoke and low visibility.",
      "For those working with breathing apparatus (SCBA): before you enter the smoke, you must check the cylinder pressure and make sure the mask is tight. Pay close attention to the low-pressure alarm — when it sounds, you have only a few minutes of air left, and you must start withdrawing immediately. We communicate using the lifeline with pulls: 1 pull — everything is okay, 2 pulls — I am going forward, 3 pulls — I am coming back, 4 pulls — emergency situation, pull me out immediately. Never enter a smoke-filled space without a clearly briefed buddy system and an agreed maximum time before mandatory withdrawal, regardless of how the search is progressing.",
      "One last thing. If the fire gets out of control and the Master decides to release the fixed fire-extinguishing system, for example, CO2 in the engine room, you will have only a few seconds after the alarm sounds to leave the space. We always do a strict roll call before releasing the gas. There can be no mistakes here — a missed name means a person left behind. Once the gas is released, there is no way to safely re-enter and correct the error, which is exactly why the roll call before release is treated as sacred procedure."
    ],
    "checklist": [
      {
        "title": "On discovery",
        "items": [
          "Raise the alarm — nearest manual call point",
          "Shout the location: \"Fire in [space]!\"",
          "Report to bridge: location, type and size of fire",
          "Feel the door with back of hand before opening — Hot door = fire behind; risk of flashover",
          "Attack only if small and safe; otherwise withdraw and close doors"
        ]
      },
      {
        "title": "BA / SCBA equipment check",
        "items": [
          "Cylinder pressure full — Record start pressure and time",
          "Face mask seal tight, no leaks",
          "Low-pressure whistle / alarm tested",
          "Lifeline attached; pull signals agreed (1-2-3-4)",
          "Fireman’s outfit and gloves worn correctly",
          "Buddy system and max time before withdrawal agreed"
        ]
      },
      {
        "title": "Firefighting equipment",
        "items": [
          "Correct extinguisher for fire class — A: water/foam · B: foam/powder · Electrical: CO₂/powder",
          "Power isolated for electrical fire",
          "Fire hoses run out and charged",
          "Backup hose team standing by"
        ]
      },
      {
        "title": "Boundary & isolation",
        "items": [
          "Close ventilation and fire dampers",
          "Boundary cooling of adjacent bulkheads",
          "Space isolated (openings closed)"
        ]
      },
      {
        "title": "Reports to bridge",
        "items": [
          "Regular situation reports to bridge",
          "BA team in / out times logged",
          "Strict roll call complete before any CO₂ release",
          "Fixed system released on Master’s order only"
        ]
      }
    ]
  },
  "flooding": {
    "title": "Flooding Drill",
    "text": [
      "Team, listen carefully. Water on board is one of the most dangerous emergencies we can face. Unlike fire, water does not stop by itself — it will keep rising until we stop it or the ship loses stability completely. Our goal today has three parts: find the source, stop the flooding, and pump the water out, all at the same time, without wasting a single minute on any one of them. Delay on any one of these three tasks allows the other two to fall further behind, and the gap only grows harder to close as time passes.",
      "When flooding is discovered, the alarm is the same general emergency signal, but the Officer of the Watch will announce clearly over the PA system: \"Flooding in [name of compartment]!\" You may also hear the bilge alarm, which triggers automatically when the water level in a compartment rises above the normal limit, often before anyone has even noticed water by eye. Trust this early warning completely — by the time water is visible on deck plating, the situation below may already be considerably more advanced.",
      "The first person who discovers water must not waste time. Report immediately to the bridge with the exact location. Then close every watertight door and every opening near the area — ventilation flaps, manholes, hatches. This stops the water from spreading to the next compartment, even before we know how bad the damage is, and it is always the correct first action regardless of the size of the leak. Even a small trickle can hide a much larger problem behind a bulkhead, so treat every report of water with full seriousness until proven otherwise.",
      "Once the damage control team arrives, we assess the source together. Is it a cracked pipe, a leaking sea valve, a damaged shell door, or a hole in the hull itself? We use soundings to measure how fast the water level is rising — this tells us how much time we really have, and it lets the Master decide whether we can control the situation ourselves or whether outside assistance will be needed. Repeat the sounding at short, regular intervals rather than once, since a single reading tells us where we are, but only a trend tells us where we are heading.",
      "To stop the flooding, we use shoring — wooden shores and wedges pressed against a damaged bulkhead or door. For a hole in the hull, we can build a cement box around it, or use a softwood plug for smaller holes. For serious hull damage, a collision mat can be lowered over the outside of the hull to reduce the flow, buying us valuable time until we reach a safe port. None of these methods are permanent solutions — they simply convert an emergency into a manageable situation until proper repairs can be made.",
      "At the same time, pumping never stops. We use the main bilge pumps, the emergency bilge pump, and portable pumps with eductors if needed. Always keep an eye on the strainers — if they get blocked with debris, the pump becomes useless in seconds, and someone must be assigned specifically to clear them. A pump running dry, or blocked by debris, gives a false sense of security that is often more dangerous than having no pump running at all.",
      "Never forget the free surface effect: water moving freely inside a compartment reduces our stability dramatically, even before the space is full. The Master and the deck team constantly monitor list and trim. In some cases, and only by the Master's direct order, counter-flooding of an opposite compartment may be used to correct a dangerous list, even though it may feel completely wrong to let more water on board deliberately. Trust the stability calculations over instinct in this moment — the numbers, not the feeling, tell us the truth about what keeps the ship upright.",
      "Report continuously to the bridge — water level, pump status, list, trim. Watertight integrity, correct reporting, and calm teamwork are what keep this ship afloat, and this is exactly why we drill this scenario as often as fire and abandon ship. A team that flows smoothly between locating, stopping, and pumping, without needing to be told what comes next, is a team that has genuinely internalised this drill."
    ]
  },
  "grounding": {
    "title": "Grounding Drill",
    "text": [
      "Colleagues, grounding means the ship touches or rests on the seabed when this was never intended. It is one of the most serious incidents we can have — hull damage, pollution, and loss of stability can all happen within seconds, often before the bridge team even fully understands what has occurred. What we do in the first minutes decides how serious the consequences will be, for the ship, the crew, and the environment around us.",
      "The moment you feel or hear the ship touch bottom, the first order is usually to stop the engines immediately. Do not go astern automatically — moving the wrong way before we understand the damage can tear the hull open even further and turn a manageable grounding into a major casualty. Sound the general alarm, and note the exact time, position, and engine RPM at the moment of contact, since this information will matter greatly to investigators later.",
      "Next, we check for injuries among the crew, and then we sound every tank and every bilge we can reach, looking for water ingress in every accessible space. We also check carefully for any sign of oil or fuel leaking over the side — pollution is a real risk in a grounding, and we must be ready to respond the moment any sheen appears on the water.",
      "The state of the tide is critical information. If we grounded on a rising tide, the situation may improve on its own as the water lifts us clear. If we grounded on a falling tide, the ship could heel further as the water drops around the hull — this is far more dangerous, and we must watch it constantly, ready to react if the list increases beyond a safe angle.",
      "The Master reports the situation to the company and to the coastal Vessel Traffic Service (VTS), and prepares a distress call if the situation requires it. Every detail — time, position, actions taken, weather conditions — must be logged accurately, because a full investigation always follows a grounding, and an incomplete log only creates more difficulty later.",
      "We never attempt to refloat the ship on our own before the damage assessment is complete. Adjusting ballast without full information can make things far worse, shifting weight in a way that increases flooding or destabilises the vessel further. In most cases, professional salvage assistance or a tug is needed before any attempt to move the ship, and patience here is far safer than haste.",
      "Finally, we prepare our SOPEP equipment — booms, absorbent material, pumps — in case of a pollution incident, checking that everything is accessible and ready before it is actually needed. A calm, well-documented response protects the crew, the ship, and the environment, and reflects well on how the whole incident is later assessed.",
      "As soon as the first shock is over, we take a full set of draught readings forward, aft, and amidships on both sides, and compare them with the figures we had before the grounding. The difference tells us how much of the ship's weight is now resting on the seabed instead of floating, which is the single most important number for everything that follows. At the same time we sound all bunker and ballast tanks and repeat those soundings every hour, because a slow leak through a cracked plate shows itself as a quiet change in the numbers long before anyone sees oil on the water.",
      "We also stop taking seawater through the sea chests if we are aground in sand or mud. Sucking sediment into the cooling system will block coolers and can destroy the main engine within minutes, leaving us without power exactly when we need it to get off. The engineers change over to the high suction, and if that is not possible, they stop the pumps and tell the bridge that the engines are not available. Losing an engine to a blocked cooler turns a recoverable grounding into a salvage case, and that is a decision made in the first ten minutes.",
      "Refloating is planned, never improvised. We calculate the tidal window, work out the ground reaction, and decide what combination of ballast transfer, bunker transfer, and tug assistance will lift the ship clear without breaking her back. A ship resting on one point amidships is under enormous hogging stress, and pulling on her at the wrong moment can open the hull. If the situation is beyond our own means, the Master will accept salvage assistance, usually under Lloyd's Open Form, and there is no shame in that — the shame is in trying to power off alone and turning a grounding into a wreck."
    ]
  },
  "blackout": {
    "title": "Blackout Drill",
    "text": [
      "Team, a blackout means we lose all main electrical power on the ship at the same moment — propulsion, steering, lighting, navigation equipment, everything stops together, without warning and often without an obvious single cause. This is especially dangerous if we are in a busy traffic area or in restricted waters, because we lose control of the ship exactly when we need it most, sometimes in a matter of seconds.",
      "You will recognise a blackout instantly: the lights go out, alarms start sounding everywhere at once, the main engine stops, and the helmsman feels the steering go dead in his hands, with no response no matter how hard the wheel is turned.",
      "On the bridge, the immediate actions are clear. Sound the general alarm if we are underway in restricted waters. Hoist the shapes, or switch on the lights, for a vessel Not Under Command (NUC), and broadcast a Securité message on VHF to warn other traffic nearby of our situation. If the water is shallow enough and it is safe, we let go the anchor to avoid drifting into danger, buying valuable time while power is restored.",
      "In the engine room, the priority is the emergency generator. By SOLAS requirement, it must start automatically within 45 seconds and restore power to the most essential systems — steering gear, navigation lights, the radio station, and the fire pumps — giving us the minimum capability to remain safe while the main power is restored.",
      "While emergency power covers the basics, the engineers work to identify what caused the blackout — an overload, a short circuit, or a generator that tripped on protection, checking each system methodically rather than guessing. The faulty circuit must be isolated before we try anything else, or the same fault will simply trip the next generator too.",
      "Once the cause is found, the standby generator is started and synchronised with the switchboard, matching frequency and voltage precisely before connecting. We restore the load gradually, step by step — bringing everything back at once can trip the new generator immediately and put us right back where we started, losing even more time than a careful, staged restoration.",
      "After power is fully restored, we run a full function check on steering, navigation, and all essential equipment, confirming that every system responds correctly before resuming normal operations, and the incident is logged in detail for review with the Chief Engineer.",
      "You must also know what happens if the emergency generator itself fails to start. The emergency switchboard is then fed from the emergency batteries, which carry the essential circuits — emergency lighting, the radio installation, and the general alarm — while the engineers start the main engine on the air receivers or, on smaller ships, by hand pump. SOLAS requires the emergency source of power to be capable of supplying steering gear, navigation lights, and communications for eighteen hours on a cargo ship, but that eighteen hours is only real if the batteries have been tested and the emergency generator has been run under load every week, as the routine requires.",
      "On deck, a blackout is not only an engine room problem. Reefer containers stop cooling, cargo pumps stop mid-discharge, and any mooring or crane operation halts wherever it happens to be, sometimes with a load in the air. In port, gangway and deck lighting go out and the accommodation goes dark, which is exactly when people fall. Anyone working on deck stops what they are doing, makes the equipment safe if that can be done in seconds, and stands still until there is light again. Walking around a dark deck to find out what happened is how a blackout produces its first injury.",
      "When power comes back, we do not switch everything on at once. Loads are restored in sequence — steering and navigation first, then essential machinery, then cargo and domestic services — because throwing the whole load onto a single generator will trip it and put us straight back into darkness. The engine control room stays clear of anyone not directly involved. Afterwards the event goes into the engine log book with the exact time, duration, and cause, and if we blacked out in a traffic separation scheme, a channel, or a river, the bridge will already have had the anchors ready to let go throughout."
    ]
  },
  "steering": {
    "title": "Emergency Steering Drill",
    "text": [
      "Colleagues, losing steering control from the bridge is a serious emergency, especially inside a Traffic Separation Scheme or a narrow channel, where there is no room for mistakes and very little time to react before we drift into danger. We must recognise the failure immediately and shift to alternative steering without delay, treating every second as critical.",
      "The signs are clear: the rudder stops responding to the helm orders, a steering alarm sounds on the bridge, and the ship slowly begins to veer off her course, sometimes so gradually that it is only noticed when checking the compass or the track on the chart.",
      "The bridge team acts at once — reduce speed, and stop engines if necessary to buy time and reduce the risk of collision. Sound the alarm, hoist the Not Under Command (NUC) shapes if we cannot manoeuvre, and warn nearby traffic over VHF so other vessels can keep clear of us. A dedicated lookout is posted immediately, watching constantly for approaching traffic or hazards.",
      "Communication becomes critical, because the bridge can no longer control the rudder directly and must rely entirely on the crew below. We establish a link to the steering gear compartment, called the steering flat, using the sound-powered telephone or a portable radio, testing the connection before relying on it.",
      "Down in the steering flat, the crew switches from remote or autopilot control to local manual control, operating the rudder directly at the steering gear itself. From here on, every rudder order is given by voice from the bridge — \"ten degrees starboard\", \"midships\", \"steady\" — and must be repeated back exactly before it is carried out, with no assumptions made about what was meant.",
      "While steering manually, we also look for the cause of the failure — check the hydraulic oil level, check the power supply to the steering motor, and look for any mechanical jam in the linkage or the rudder stock. If the ship is fitted with a secondary steering pump, we switch to it as soon as the fault is confirmed to be in the primary system.",
      "This drill depends completely on discipline in communication. With no direct view of the sea from the steering flat, every order must be clear, repeated back correctly, and followed exactly, because a single misheard word can send the ship the wrong way at the worst possible moment. This is why SOLAS requires us to practise this drill monthly, keeping the whole team sharp and ready.",
      "This is not an optional exercise. SOLAS Chapter V requires the steering gear to be tested within twelve hours before departure, and it requires emergency steering drills to be carried out at least once every three months, so that changing over to local control is something your hands remember rather than something you read about. The block diagram of the steering system, with the changeover procedures, must be permanently displayed on the bridge and in the steering flat. If you cannot find that diagram right now without looking for it, you are not ready for this drill.",
      "Communication discipline is what actually makes emergency steering work. Orders go from the bridge to the steering flat by sound-powered telephone or portable radio, and every order is repeated back word for word before it is carried out. We give rudder angles in degrees — 'port ten', 'midships', 'steady' — never 'a little left' or 'a bit more', because the man at the local wheel cannot see the sea and has nothing but your words and the rudder angle indicator in front of him. He reports back when the rudder is at the ordered angle. That repeat-back loop is slow, and it must stay slow, because a rushed order that is misheard puts the rudder hard over the wrong way.",
      "Because our ability to manoeuvre is reduced, we tell everyone around us. The bridge broadcasts an urgency message on VHF, displays the shapes and lights for a vessel not under command if we cannot manoeuvre as required, and keeps a close plot of every ship nearby. We reduce speed early, because a slower ship gives the steering team time to correct and gives other vessels time to keep clear. If we are near a pilot station or a confined channel, the Master will normally request tug assistance rather than attempt to hold a narrow track on local steering alone."
    ]
  },
  "mob": {
    "title": "Man Overboard (MOB) Drill",
    "text": [
      "Team, a person falling overboard is a race against the clock. Cold water, drowning, and even being struck by our own propeller are the greatest dangers, and the gap between a fast, correct response and a slow one can be the difference between a rescue and a tragedy. Every one of you must know your first actions instantly, without thinking, and without waiting for someone else to react first.",
      "The first person who sees someone fall shouts immediately: \"Man overboard, port side!\" or \"starboard side!\" — and throws the nearest lifebuoy, with its self-igniting light and smoke signal, directly toward the person, even before running to alert anyone else. From this moment, that person's only job is to keep pointing continuously at the man in the water and never lose sight of him, even for a second, because a lost visual contact can mean a lost life.",
      "On the bridge, the Officer of the Watch presses the MOB button on the GPS to mark the exact position immediately, then begins a Williamson turn — or an Anderson turn on faster vessels — to bring the ship back along her own track to the person. The alarm signal is three long blasts, and extra lookouts are posted aloft immediately, scanning the water methodically rather than searching at random.",
      "While the ship manoeuvres back, the rescue boat crew musters and prepares the boat for lowering without delay. We always approach the person from the leeward side, so the ship's drift does not push the hull onto them, and we use the pilot ladder or a scramble net for the recovery itself, choosing whichever method suits the person's condition.",
      "If the person is unconscious or showing signs of hypothermia, we recover them in a horizontal position whenever possible — pulling a cold body upright too quickly can trigger rescue collapse, a dangerous drop in blood pressure that can be fatal even after a successful rescue. First aid begins the moment they are back on board, and we continue monitoring closely for hypothermia, checking breathing, pulse, and level of consciousness regularly.",
      "Every detail is recorded — the time, the GPS position, and every action taken, from the first shout to the moment the person is safely back on deck. If the person cannot be located immediately, the bridge organises a search pattern, such as an expanding square or a sector search, and informs the coastguard without delay, providing the last known position and drift estimate.",
      "The manoeuvre we use depends on how quickly the fall was noticed. If it was seen immediately, the Williamson turn takes us back down our own track and is the most reliable in poor visibility, though it costs more time and distance. If we react within seconds, the Anderson turn — the single turn — is the fastest way back to a person still in sight, but it demands a well-handled ship and a good helmsman. The Scharnow turn is used when some time has already passed and the person is well astern. Every officer of the watch must be able to choose and execute all three without hesitating.",
      "Marking and watching the person is a job for dedicated people, not for whoever is free. One crew member is assigned to point at the person in the water and do nothing else, not even to answer questions, from the moment of the alarm until recovery. We throw a lifebuoy with a self-igniting light and a smoke signal immediately, both to give the person something to hold and to mark the water. The bridge presses the MOB marker on the GPS and on the radar. In any sea state, a head in the water disappears within a minute if nobody is holding it with their eyes.",
      "At the same time the bridge broadcasts an urgency message so that vessels nearby can join the search, informs the rescue coordination centre, and puts the engines on manual control. The rescue boat crew must also be honest about conditions — in heavy weather, launching a boat can put five more people in the water instead of taking one out, and in that case we recover using a rescue net, a scramble net, or a rescue basket from the ship's side. That decision belongs to the Master, and it is much easier to make if the crew has already practised both methods.",
      "Speed, discipline, and never losing sight of the person — these three things save lives in a man overboard situation, more than any single piece of equipment or procedure on its own."
    ],
    "checklist": [
      {
        "title": "Immediate actions",
        "items": [
          "Shout \"Man overboard, port/starboard!\"",
          "Throw lifebuoy with self-igniting light and smoke",
          "Pointer assigned — never lose visual contact",
          "Press MOB button on GPS to mark position"
        ]
      },
      {
        "title": "Bridge actions",
        "items": [
          "Sound three long blasts",
          "Commence Williamson / Anderson turn",
          "Post extra lookouts aloft",
          "Inform Master; note time and position"
        ]
      },
      {
        "title": "Recovery preparation",
        "items": [
          "Muster rescue boat crew; prepare to lower",
          "Approach from the leeward side",
          "Pilot ladder / scramble net rigged"
        ]
      },
      {
        "title": "Casualty care",
        "items": [
          "Recover horizontal if hypothermic — Vertical lift can trigger rescue collapse",
          "Begin first aid immediately",
          "Monitor breathing, pulse, consciousness; treat for hypothermia"
        ]
      },
      {
        "title": "Reports",
        "items": [
          "Log time, position and actions taken",
          "If not located: start search pattern, inform coastguard"
        ]
      }
    ]
  },
  "enclosed": {
    "title": "Enclosed Space Entry & Rescue Drill",
    "text": [
      "Team, enclosed spaces are one of the most common killers on board — more sailors die entering tanks, cargo holds, and cofferdams than in almost any other type of accident, often in situations that looked completely routine just moments before. The danger is simple: the air inside may not support life, and you cannot see, smell, or feel that danger, which is exactly what makes it so deceptive.",
      "Before anyone enters, we always follow the permit to work system, without exception, regardless of how urgent the task inside may seem. The Enclosed Space Entry Permit must be signed by the responsible officer, and it stays invalid until every condition on the checklist is met, item by item, with no boxes ticked from memory.",
      "The atmosphere must be tested with a calibrated gas detector before entry, and continuously during the work, not just once at the start. We check oxygen content first — it must be close to 21%. Then we check for flammable gases, and for toxic gases such as hydrogen sulphide or carbon monoxide, since some of the most dangerous gases have no smell at all. If oxygen is low, or any toxic gas is present, nobody enters, no exceptions, regardless of rank or urgency.",
      "Every space should be mechanically ventilated before testing and kept ventilated during entry, using portable fans if fixed ventilation is not available. Natural ventilation through an open hatch is never enough on its own, even if the hatch has been open for hours.",
      "Nobody enters an enclosed space alone, under any circumstances. There is always an entrant, and always an attendant standing by at the entrance with harness lines ready, in constant communication with the entrant — by radio or by a lifeline with an agreed signal code, checked and understood by both people before entry begins.",
      "If the entrant is found in distress inside the space, the attendant does not enter to rescue on his own — this is exactly how second and third victims happen, turning a single casualty into a multiple fatality. The attendant raises the alarm immediately, and a rescue team dresses in breathing apparatus before going in, no matter how urgent the situation appears.",
      "The rescue team enters with SCBA, a rescue harness, and a stretcher if needed, always keeping a lifeline back to the entrance so they themselves cannot become trapped. We recover the casualty carefully, begin first aid immediately, and continue support until medical help takes over, documenting the timeline as we go.",
      "Understand why these spaces kill, because the danger is completely invisible. Bare steel rusting inside a closed ballast tank consumes oxygen out of the air. Cargoes such as timber, fishmeal, grain, and scrap metal do the same as they decompose or oxidise. A hold that has been inerted, or one next to an inerted space, may have almost no oxygen at all. You cannot see, smell, or taste any of this. At an oxygen level of around ten percent a man loses consciousness in a few breaths, without warning and without the feeling of suffocating that would make him turn back.",
      "The permit to work is a real document with a time limit on it, signed by a responsible officer, and it stops being valid the moment conditions change. If the entry team comes out for a meal break, if the ventilation stops, or if the time on the permit expires, the atmosphere is tested again before anyone goes back in. Communication between the entrant and the attendant is checked at fixed intervals agreed before entry, and if the attendant does not get an answer at the expected moment, that is treated as an emergency immediately, not after a second try.",
      "Rescue equipment stands ready at the entrance for the whole time the space is occupied — a second set of breathing apparatus, a resuscitator, a lifeline and harness, a stretcher suitable for vertical lifting, and a torch. Statistics on these accidents are brutally consistent: more than half of the people who die in enclosed spaces are would-be rescuers who went in to help a colleague without breathing apparatus. That is why the attendant never enters. Raising the alarm and staying at the opening is not cowardice, it is the only action that does not add a second body to the space.",
      "Remember: test the atmosphere, ventilate continuously, never go in alone, and never rescue without breathing apparatus. These four rules, followed without compromise every single time, are what separate a routine tank entry from a fatal accident."
    ],
    "checklist": [
      {
        "title": "Permit to work",
        "items": [
          "Enclosed Space Entry Permit signed by responsible officer",
          "Every checklist condition met — none ticked from memory",
          "Job briefed to entrant and attendant"
        ]
      },
      {
        "title": "Atmosphere testing",
        "items": [
          "Calibrated gas detector, tested before entry",
          "Oxygen content ≈ 21%",
          "Flammable gas within safe limits",
          "Toxic gas checked (H₂S, CO) — Some dangerous gases have no smell",
          "Continuous monitoring during the work"
        ]
      },
      {
        "title": "Ventilation",
        "items": [
          "Mechanically ventilated before entry",
          "Ventilation kept running throughout entry"
        ]
      },
      {
        "title": "Personnel & communication",
        "items": [
          "Entrant equipped; attendant at the entrance",
          "Communication agreed (radio or lifeline signals)",
          "Rescue harness and lines ready at entrance"
        ]
      },
      {
        "title": "Rescue readiness",
        "items": [
          "Never enter to rescue without breathing apparatus — This is how second/third victims happen",
          "Rescue team with SCBA, harness, stretcher on standby",
          "Lifeline kept back to the entrance"
        ]
      },
      {
        "title": "Reports to bridge",
        "items": [
          "Report to bridge before entry",
          "Entry and exit times logged",
          "Report to bridge on completion"
        ]
      }
    ]
  },
  "collision": {
    "title": "Collision Drill",
    "text": [
      "Colleagues, a collision between two vessels can happen in seconds, even with the best lookout and the best radar, in clear weather as much as in fog. Once it happens, the first minutes decide whether we save the ship, the cargo, and every life on board, and there is no time to hesitate while assessing what just occurred.",
      "Immediately after impact, sound the general alarm and stop the engines. Do not manoeuvre blindly — if the other vessel's bow is still inside our hull, moving away too quickly can open the wound wider and let water pour in even faster than if the two hulls simply stayed together for a moment longer.",
      "The bridge team checks the position, the extent of visible damage, and immediately calls both vessels' names, positions, and condition over VHF Channel 16, followed by a distress call if the damage is serious, giving as much detail as possible in the first transmission.",
      "Damage control parties are mustered at once on both sides of the point of impact, moving toward the damage rather than away from it. We check every adjacent compartment for water ingress, using the same principles as a flooding emergency — close watertight doors, sound the bilges, report continuously to the bridge, and never assume a compartment is dry until it has actually been checked.",
      "We must also check for injuries among the crew, since the force of a collision can throw people from their feet without warning, and for any risk of fire from ruptured fuel lines or damaged electrical systems near the collision zone, which is often overlooked in the first rush to check for flooding.",
      "Communication between the two vessels is essential — we exchange names, IMO numbers, extent of damage, and intentions, and both Masters coordinate before any vessel moves away, in case the coupled hulls are actually limiting the flooding for the moment, which is not always obvious from either bridge alone.",
      "The Master informs the company, the coastal authority, and prepares full documentation — time, position, course, speed, actions of both vessels before the collision, weather and visibility conditions — because a full investigation always follows, and incomplete records only complicate what happens afterward.",
      "The most urgent technical question after impact is whether we are taking water and whether the flooding can spread. All watertight doors are closed, and the damage control party sounds every tank, bilge, and void space in the area of the impact and works outward from there, repeating the soundings so that a rising level shows itself. The loading computer and the damage stability booklet tell us whether the ship survives with the compartments we have lost. Progressive flooding through a cracked bulkhead, an open manhole, or a ventilation trunk is what actually sinks ships after a collision, far more often than the original hole.",
      "If the two ships are still locked together, we do not separate them until the Master has considered what happens next. The other vessel's bow may be the only thing keeping our flooding under control, and pulling clear can open the wound completely. That decision is made with damage stability information in front of us and, wherever possible, in agreement with the other Master. At the same time our own obligation under the collision regulations is clear — we stand by the other vessel, render assistance to her and her crew, and give her our name, port of registry, and the ports we are coming from and bound for.",
      "Evidence must be preserved deliberately, because the default is that it disappears. The Voyage Data Recorder overwrites itself, so the bridge saves the recording immediately after the incident — this is a matter of hours, not days. We keep the working chart untouched, print the ECDIS record, preserve the course and engine movement recorders, and note the exact times of every order. The Master notes a protest at the first opportunity. None of this is about blame; it is about being able to reconstruct what happened for the investigation that will certainly follow."
    ]
  },
  "oilspill": {
    "title": "Oil / Chemical Spill Drill (SOPEP/SMPEP)",
    "text": [
      "Team, a spill of oil or chemicals into the sea is an environmental emergency, and under MARPOL, we are legally required to respond immediately and correctly, whether the spill happens during bunkering, cargo transfer, or from hull damage, and regardless of how small the quantity may initially appear.",
      "The moment a spill is discovered, stop the operation causing it immediately — close the valve, stop the pump, stop the transfer, without waiting for permission if the situation is clearly worsening. Sound the alarm and inform the bridge and the person in charge of the operation without delay, giving the exact location and an estimate of the quantity if possible.",
      "Every vessel over a certain size carries a Shipboard Oil Pollution Emergency Plan (SOPEP), or a Shipboard Marine Pollution Emergency Plan (SMPEP) for chemical tankers, kept readily accessible and known to every relevant crew member. This plan tells us exactly what equipment to use and who to call, removing any guesswork from a stressful moment.",
      "On deck, we deploy absorbent pads and booms around the source to contain the spread before it reaches open water, and we use drip trays under any connection that could leak further. Never use dispersants without direct authorisation — in many areas, using them without permission is itself a violation, potentially causing more legal and environmental harm than the spill itself.",
      "We report the spill immediately to the coastal authority, giving position, estimated quantity, and type of substance, along with the actions already taken to contain it. Under MARPOL, this report must be made without delay, regardless of how small the spill appears, because underreporting is treated as seriously as the pollution itself.",
      "For chemical spills specifically, we consult the Material Safety Data Sheet (MSDS) for the cargo before doing anything further, since different chemicals require completely different protective equipment and neutralising procedures, and an incorrect response can turn a manageable spill into a serious health hazard.",
      "Every crew member near the spill wears the correct personal protective equipment (PPE) — gloves, goggles, and in some cases a full chemical suit and breathing protection, depending on the substance and its known hazards as listed on the safety data sheet.",
      "Afterwards, we record everything in the Oil Record Book or Cargo Record Book, and prepare a full incident report, because port state control will examine our response closely, and a well-documented response demonstrates that the crew acted correctly and promptly.",
      "Most spills we will ever see do not come from dramatic damage — they come from bunkering. Before any transfer starts, all scuppers are plugged, drip trays are in place under every connection, and a continuous watch is kept at the manifold and at the sounding pipes for the whole operation. The pumping rate and the topping-off rate are agreed in writing with the barge or terminal beforehand, along with an emergency stop signal that both sides understand. Tank overflow alarms are tested before we begin. An overflow through a vent head takes seconds and puts oil on deck, over the side, and into a report to the coastal state.",
      "Reporting is a legal duty under MARPOL, not a commercial decision, and the times matter. The Master reports without delay to the nearest coastal state, to the flag state, and to the owners and the P&I club, using the contact list in the SOPEP itself — that list is kept up to date precisely so that nobody has to search for a number during an emergency. The report gives position, time, type and estimated quantity of the product, the source, weather and sea state, and what action we have already taken. An early, honest, incomplete report is always better than a late, complete one.",
      "Two things are absolutely forbidden. We never apply dispersants without the express authority of the coastal state, because in many waters that is itself an offence and it can do more environmental damage than the oil. And we never wash oil over the side to make the deck look clean before an inspection. Falsifying the Oil Record Book or concealing a discharge is a criminal offence in most jurisdictions and has put seafarers in prison — not the company, the seafarers. If oil goes over the side, we say so."
    ]
  },
  "piracy": {
    "title": "Piracy / Armed Attack Drill",
    "text": [
      "Team, in certain areas of the world — the Gulf of Guinea, parts of the Malacca Strait, waters off Somalia — the risk of piracy and armed robbery is real, and we must be ready before we ever enter these waters, not after we see a suspicious approach, because by then there may be only minutes left to act.",
      "As soon as a suspicious craft is detected approaching at speed, the bridge sounds the piracy alarm — a continuous signal different from the general emergency alarm — and increases speed to the maximum safe speed while manoeuvring to create wash and make boarding harder, using every available knot of speed to our advantage.",
      "Every crew member not required on the bridge or in the engine room musters and moves immediately to the Citadel — a hardened, secure compartment with communication equipment, food, and water, designed so pirates cannot force entry even if they board the ship, and built to keep the crew safe for an extended period if necessary.",
      "The Ship Security Alert System (SSAS) is activated silently — it sends a covert distress signal to the company and to the flag state authority without alerting anyone on board who should not know, ensuring that outside help is already on its way even before the attackers realise anyone has responded.",
      "We follow the guidance in Best Management Practices (BMP) — physical barriers such as razor wire along the rails, fire hoses ready to repel boarders with water pressure, and citadel procedures rehearsed so everyone can reach it within minutes, even at night or in poor visibility, when the risk is often highest.",
      "If pirates succeed in boarding, nobody resists physically, under any circumstances. Crew safety always comes first — we cooperate, stay calm, and let the company and naval authorities negotiate, trusting the process even when it feels difficult to do so. No cargo or ship value is worth a human life.",
      "Throughout the incident, we maintain communication with the Company Security Officer and, if possible, with any nearby naval or coalition forces monitoring the area, until the situation is resolved safely, keeping detailed notes of everything observed for the eventual debrief.",
      "The work that decides the outcome is done before we ever enter the high risk area. The ship is hardened — razor wire along the rails, access to the accommodation reduced to a single controlled door, all other doors and ports secured from inside, and the citadel prepared with drinking water, food, sanitation, independent ventilation, and a means of communication that does not depend on the bridge. We register the passage with the relevant reporting centre and report our position daily. The crew practises the muster to the citadel until it takes minutes, in the dark, with the ship rolling.",
      "Speed and manoeuvring are our best defence, and the statistics are clear that a ship making full speed with an alert lookout is very rarely boarded successfully. On sighting a suspicious craft we increase to maximum sea speed, begin a series of large helm movements to throw up a heavy wash and make the ship difficult to come alongside, and start the fire hoses and water spray along the vulnerable sides. Extra lookouts are posted, deck lighting is used according to the guidance for the area, and the bridge team keeps the attackers in sight and reports their number, description, and behaviour.",
      "After any incident, whether or not the ship was boarded, there is work still to do. We report in full to the reporting centre and to the Company Security Officer, because our report is what warns the next ship through those waters. Crew welfare comes next — being hunted at sea affects people for a long time afterwards, and anyone who wants to talk to someone ashore must be given that access without having to ask twice. Finally, nobody discusses details of our routing, security arrangements, or the incident itself on open VHF or on social media."
    ]
  },
  "medical": {
    "title": "Medical Emergency / Mass Casualty Drill",
    "text": [
      "Colleagues, at sea, we are often days away from the nearest hospital, and the designated Medical Officer on board — usually the Master or a senior officer — has only basic training, not the years of experience a shore-based doctor would have. Every crew member must know their role when someone is seriously injured or ill, because help may be hours or days away.",
      "The first priority in any medical emergency is to assess the scene for danger before rushing in — a person collapsed near machinery, in a confined space, or near an electrical hazard can become a second casualty if we are not careful, doubling the difficulty of an already serious situation.",
      "We check the casualty's airway, breathing, and circulation — the ABC of first aid — and begin CPR immediately if there is no pulse and no breathing, without waiting for someone more senior to arrive. Every minute without action reduces the chance of survival significantly, sometimes by ten percent or more.",
      "For serious cases, we contact Radio Medical Advice — a shore-based doctor who can guide our treatment over satellite communication, based on the symptoms and vital signs we describe to them as clearly and completely as possible.",
      "If several people are injured at once — a mass casualty situation, for example after an explosion or a serious accident — we use triage: sorting casualties by the severity of their injuries, so that the most critical cases are treated first, not simply the first one found or the loudest one calling for help.",
      "If the case is beyond what we can manage on board, the company will arrange a medical evacuation — either transfer to another vessel, diversion to the nearest port, or a helicopter medevac, depending on location, weather, and urgency, and the decision is made as quickly as the situation allows.",
      "Throughout the emergency, one person is designated to record everything — time, symptoms, treatment given, medication administered, and any change in condition — because this record is critical for the doctors who receive the patient later, and gaps in it can genuinely affect the outcome of treatment.",
      "Know where everything is before you need it. The hospital, the stretchers, the oxygen, the automated external defibrillator, and the medical locker all have fixed positions, and the ship's medical stores are inspected and restocked against a required list, with expiry dates checked. Controlled drugs are kept locked and logged. If you have to search for the oxygen bottle while a colleague is not breathing, the drill has already failed. Every crew member should be able to say, right now, where the nearest stretcher is and how to get it to the deck they work on.",
      "Moving a casualty on a ship is harder than treating one. Vertical ladders, narrow doorways, high sills, and steep stairwells make a normal stretcher useless in most of the accommodation and machinery spaces, which is why we carry a stretcher designed for vertical lifting and practise rigging it. The route out is planned before the casualty is moved, not during. Somebody goes ahead to open doors and clear obstructions. A suspected spinal injury is immobilised before any movement at all, and if the casualty is in an enclosed space or a smoke-filled compartment, the rescue team wears breathing apparatus regardless of how urgent the medical need appears.",
      "When you contact radio medical advice, have the information ready in a fixed order: the casualty's age, what happened and when, the symptoms, pulse, breathing rate, temperature, level of consciousness, what medication has already been given, and any known medical history from the pre-employment examination. The doctor ashore cannot see the patient and is working entirely from what you tell him, so guessing or rounding numbers to sound reassuring is dangerous. Repeat back the treatment instructions exactly as an order, and write down the time each dose is given."
    ]
  },
  "helicopter": {
    "title": "Helicopter Operations Drill",
    "text": [
      "Team, receiving a helicopter on board — whether for a medical evacuation, a pilot transfer, or a supply run — is one of the more dangerous routine operations we do, and it demands absolute discipline from everyone on deck, because a single loose item or a moment of carelessness can bring the aircraft down.",
      "Before the helicopter arrives, the deck team clears the landing area or hover zone completely — every loose object, every piece of equipment, must be secured or removed, without exception. Loose items become deadly projectiles in rotor wash, capable of injuring crew or damaging the aircraft itself.",
      "We check for foreign object debris (FOD) across the entire area — caps, tools, rags, even small pieces of tape — because even a small object pulled into the rotor or engine intake can bring the aircraft down, with consequences far beyond the immediate area.",
      "The bridge establishes communication with the helicopter before it approaches, giving wind speed and direction, the ship's course and speed, and confirming the deck is ready in every respect. The ship usually adjusts course to put the wind at an angle that gives the pilot the safest approach, sometimes altering course significantly from our planned track.",
      "Fire teams stand by in full gear near the landing area throughout the operation, with hoses charged and ready, in case of an accident during landing or take-off, never relaxing their attention until the aircraft has safely departed.",
      "If the helicopter winches a person up or down instead of landing, nobody touches the hoist cable or the strop until it has touched the deck or the water first — static electricity can build up a dangerous charge during the descent, strong enough to cause a serious shock if grabbed too early.",
      "Once the operation is complete and the helicopter has departed to a safe distance, the deck team confirms the area is clear before returning to normal operations, checking one final time for any debris or equipment left behind.",
      "Static electricity and downwash are the two hazards people underestimate. A helicopter in the hover builds a substantial static charge, and the first contact with the hook or the winch wire will discharge it through whoever is holding it. That is why the wire is always allowed to touch the deck first, and why nobody grabs it in mid-air. The downwash itself is strong enough to lift a man off his feet, blow an unsecured hatch cover across the deck, or throw loose gear into the rotor. Everything on and around the operating area is lashed, and everyone keeps low and moves deliberately.",
      "Approach and departure from the aircraft are done only on the signal of the helicopter crew, always from the direction they indicate, and never towards the tail. The tail rotor is invisible when turning and it kills people every year. On a ship the deck is also moving, so nobody walks under turning blades carrying anything above shoulder height. Personnel involved wear a helmet with a chin strap, ear protection, goggles, gloves, and a life jacket of a type that will not inflate accidentally in the downwash.",
      "The bridge has its own responsibilities throughout. We agree a course and speed that give the pilot a steady relative wind within his limits and the least possible roll and pitch, and we hold that course — no alterations without telling him first. We report the wind, the ship's motion, and any obstructions such as masts, aerials, and funnel exhaust, and we shut down radars and radio transmitters that could interfere as agreed in the pre-operation briefing. Deck lighting for a night operation is arranged so that the working area is lit without dazzling the pilot."
    ]
  },
  "cargoshift": {
    "title": "Cargo Shift / Securing Failure Drill",
    "text": [
      "Team, cargo that breaks loose in heavy weather is extremely dangerous — it can cause a sudden, severe list, damage the hull from the inside, and even threaten the stability of the entire ship, sometimes with almost no warning before the first signs appear.",
      "The first sign is often a sudden noise — cargo shifting, containers or vehicles moving, lashings breaking — followed by an unusual list that was not there before, or a list that changes with every roll of the ship, growing slightly worse each time.",
      "As soon as a cargo shift is suspected, we reduce speed and, if possible, change course to reduce the rolling motion, because continued rolling will only make the shift worse, feeding the same forces that caused the problem in the first place.",
      "A team is sent, only when it is safe to do so, to assess the extent of the shift and the condition of the remaining lashings, without putting themselves in the path of unsecured cargo, which can move again with little warning.",
      "If lashings have failed, we re-secure what we can using additional lashings, wedges, and dunnage, working carefully with the ship's motion, not against it — this is not a moment for improvisation without proper technique, since an incorrectly applied lashing can fail again under the next heavy roll.",
      "For bulk cargo, we watch closely for signs of cargo liquefaction — when fine, wet cargo behaves like a liquid and shifts suddenly to one side, causing a rapid and dangerous list that can develop far faster than a normal cargo shift. If this is suspected, we reduce speed immediately and inform the company without delay.",
      "The Master monitors stability constantly during recovery, because a shifted load changes the ship's centre of gravity in ways that are not always intuitive, and further list correction may be needed carefully, exactly as in a flooding-related stability problem.",
      "Every incident is logged in detail, and the cargo securing arrangements are reviewed before the next port, so the same lashings are not simply reused without inspection, and any weaknesses identified are corrected before we sail again.",
      "Almost every cargo shift can be traced back to a decision made before the ship sailed. The Cargo Securing Manual is approved for this ship and this cargo, and it exists precisely so that securing is calculated rather than estimated by eye. Lashings, chains, and turnbuckles are inspected for wear and corrosion, and a lashing that has been stretched once is no longer rated for its original load. Weights must be what the documents say they are — a container declared at ten tonnes and actually carrying twenty invalidates the whole stow calculation. If something looks wrong during loading, it is reported then, not after the first heavy roll.",
      "Heavy weather is fought with the passage plan, not with the lashings. When bad weather is forecast, the Master alters course or reduces speed early to keep rolling and pitching within what the securing was designed for, and to avoid parametric rolling and synchronous rolling, which can build up dangerously large angles very quickly on container ships and car carriers. Slowing down and arriving late is always cheaper than a shifted stow. The ballast condition and the resulting metacentric height are checked as well, because a ship that is too stiff rolls violently and tears out its own lashings.",
      "Nobody enters a cargo space or goes on deck to inspect a shift in heavy weather without the Master's permission, a lifeline, and a colleague watching. Moving cargo is unpredictable, and a container or a steel coil that has broken free can shift again with the next roll and crush a man against a bulkhead in an instant. For bulk cargoes we also watch for the cargo surface going flat and wet, which is the classic sign of liquefaction, and once that starts there is very little the crew can do except reduce motion and report it — this is what capsizes bulk carriers with no warning at all."
    ]
  },
  "security": {
    "title": "Bomb Threat / Security Drill (ISPS)",
    "text": [
      "Colleagues, under the ISPS Code, every ship operates at one of three Security Levels, and a bomb threat or suspicious object report demands an immediate, disciplined response, whether the threat comes by phone, message, or a report from a crew member noticing something out of place.",
      "If a threat is received directly, the person who takes the call or message must write down every detail immediately — exact words used, time received, and any background information such as noise or accent — without hanging up if it is a phone call, so the call can potentially be traced by the authorities.",
      "The Ship Security Officer (SSO) is informed at once, and the Master decides whether to raise the Security Level and begin a coordinated search of the vessel, working area by area, using pre-planned search patterns from the Ship Security Plan (SSP), so that no space is accidentally missed or searched twice.",
      "If a suspicious object is found, nobody touches it, moves it, or uses radio equipment near it — radio transmissions can, in some cases, trigger an explosive device, even at a distance that might otherwise seem safe. The area is cordoned off immediately and evacuated to a safe distance in every direction.",
      "Crew members searching their own assigned areas know their spaces better than anyone else — this is why a full-crew search is more effective and faster than relying on a small security team alone, since even small changes are more likely to be noticed by someone familiar with the space.",
      "The Master informs the Company Security Officer and the relevant Port Facility Security Officer or coastal authority immediately, following the reporting chain defined in the Ship Security Plan without deviation.",
      "If the threat is confirmed serious, we may need to muster away from the suspect area, prepare for possible evacuation, and await guidance from shore-based security or bomb disposal experts before resuming normal operations, however long that guidance takes to arrive.",
      "Security work is mostly routine, and the routine is what makes the emergency manageable. Access control is maintained at every level — one controlled gangway, a log of everyone who boards and leaves, identity checked against the crew list or a visitor's authorisation, and stores checked before they come aboard. Unattended stores on the quay, a delivery nobody ordered, or a visitor who wanders away from his escort are all reportable. The ship's Security Plan sets out the measures for each of the three levels, and when the level is raised by the flag state or the port, the additional measures apply immediately, not when convenient.",
      "If a threat comes by telephone, keep the caller talking for as long as possible and do not hang up. Write down the exact words used, note the time, and listen for accent, gender, background noise, and whether the caller sounds as though he is reading from a script. Ask where the device is, when it will go off, and what it looks like — some callers answer. Most ships keep a bomb threat checklist next to the telephone for exactly this purpose, and if there is one next to yours, you should have read it before it rings.",
      "A search is done systematically or not at all. Areas are divided so that every space has one person responsible for it, and each searcher works from the deck up to waist height, then waist to head height, then above head height, so nothing is missed. Portable radios and mobile telephones are not used near a suspected device, because radio transmissions can initiate some detonators — that is why searchers report by messenger or from a safe distance. Anything unusual is not touched, opened, or moved. The position is marked, the area cleared, and the Master informed so that the professionals ashore can take over."
    ]
  },
  "holdfire": {
    "title": "Cargo Hold Fire Drill",
    "text": [
      "Team, a fire inside a closed cargo hold is one of the hardest fires to fight, because we usually cannot see the fire directly, and opening the hatch to look can feed the fire with fresh oxygen and make it far worse in a matter of seconds.",
      "The first signs are often indirect — smoke detector alarms, an unusual smell near the ventilation, or a hatch cover that feels hot to the touch. We must confirm the fire's location before deciding how to act, rather than guessing based on a single piece of evidence.",
      "The absolute rule is: do not open the hatch, under any circumstances, no matter how tempting it is to check the situation visually. Opening it lets oxygen in and can cause a sudden, violent increase in the fire, sometimes even a backdraft, endangering everyone nearby.",
      "Instead, we isolate the space completely — close all ventilation, dampers, and any openings to starve the fire of oxygen — and prepare to flood the hold with the fixed fire-extinguishing system, usually CO2 or an equivalent inert gas system, following the procedure exactly as trained.",
      "Before releasing CO2, we perform a strict roll call to confirm every crew member is accounted for and out of the space, because the gas that puts out the fire will also suffocate any person still inside, with no warning and no chance to escape once it is released.",
      "After release, the hold must remain sealed for a considerable time to let the fire fully die down and cool — reopening too early can reignite the fire the moment fresh air reaches the still-hot cargo, undoing all the progress already made.",
      "When we finally reopen the hold, we test the atmosphere exactly as in an enclosed space entry, because the space is now full of extinguishing gas and depleted of oxygen, and it must be ventilated and tested before anyone enters, with no exceptions made for urgency.",
      "Before any of this happens, the fixed system itself has to be trustworthy. The CO2 bottles are weighed or level-checked at the required intervals, the distribution valves and pilot lines are tested, and the alarms that sound before release are proved to work. The release cabinet is kept locked but the key is in a break-glass box beside it, and every officer knows where that is without looking. If the ship carries a hold fire alarm sampling system, the sampling lines must be clear — a blocked line means the alarm never comes, and the first sign of the fire will be smoke or heat on the deck plating above.",
      "The stowage plan decides how bad this gets. We must know exactly what is in the burning hold and what is next to it, which means the dangerous goods manifest and the stowage plan have to be accurate and immediately available on the bridge. Some cargoes carry their own oxygen and will keep burning in a flooded, inerted, or CO2-filled space. Others react violently with water. The IMDG Code emergency schedules tell us which is which, and the Master will use them before choosing between smothering, boundary cooling, and, as a last resort, flooding the hold.",
      "Boundary cooling continues for as long as it takes, and it is heavier work than most crews expect. We cool the decks, bulkheads, and the ship's side around the hold with water, checking temperatures regularly at fixed points, and we keep watch on adjacent holds, bunker tanks, and the accommodation. All that water has to go somewhere — free surface on a deck or in a hold reduces stability, so the Master monitors the ship's condition and the drainage arrangements throughout. The Master will also alter course to put the wind and smoke away from the accommodation, and will consider diverting to the nearest port of refuge early rather than late.",
      "Finally, this is an emergency where every person on board must be accounted for before anything is released, and where nobody may re-enter afterwards on a guess. CO2 in the concentrations used to smother a cargo fire is lethal within a couple of breaths and gives no warning at all. The roll call before release is checked twice against the crew list, and the hold stays sealed and marked until the atmosphere has been tested for oxygen, carbon monoxide, and any product-specific gas, with breathing apparatus worn for the first entry regardless of what the meter says."
    ]
  },
  "draganchor": {
    "title": "Dragging Anchor Drill",
    "text": [
      "Team, when we are anchored, we assume the ship is safely fixed in place — but in strong wind, current, or poor holding ground, the anchor can start to drag, and the ship drifts slowly and silently toward danger, often without any obvious sign at first.",
      "The Officer of the Watch continuously checks the ship's position against fixed references — using GPS, radar ranges, or bearings on shore objects — specifically watching for any gradual movement outside the expected swinging circle, comparing each fix carefully to the last.",
      "The first sign is often subtle: the ship's heading and position do not match what the wind and current should be doing, or the anchor bearing keeps slowly changing in the same direction over time, a pattern easy to miss if checks are not frequent enough.",
      "As soon as dragging is suspected, the OOW informs the Master immediately and increases the frequency of position checks, without waiting to be completely certain first. If dragging is confirmed, the engines are put on standby immediately, ready for use within minutes.",
      "To stop the dragging, we may pay out more anchor cable to increase holding power, or in worse cases, use the main engine carefully to reduce the load on the anchor while we assess the situation, balancing engine power against the risk of damaging the anchor gear.",
      "If the ship continues to drag toward danger — shallow water, other vessels, or the shore — we may need to heave up the anchor and reposition to a safer anchorage, or get underway entirely if conditions do not allow safe re-anchoring anywhere nearby.",
      "Throughout the situation, we keep VHF watch and inform nearby vessels and the port authority if our position is changing in a way that could affect them, giving them as much warning as possible to adjust their own situation.",
      "Most dragging is decided before the anchor goes down. We choose the anchorage for its holding ground — good mud or clay rather than rock, weed, or hard sand — and we check the chart and the pilot book for what the bottom actually is. The scope of cable is calculated for the depth and the expected weather, not simply set at what fitted last time, and in deteriorating conditions more cable goes out early rather than in the middle of the night. We anchor far enough from other vessels that our swinging circles do not overlap even if both ships swing the opposite way to what we expect.",
      "The anchor watch is a real watch, not a formality. The officer plots a fix at fixed intervals, sets the anchor watch alarm on the ECDIS or GPS with a realistic radius that accounts for our own swinging circle, and takes a clearing bearing on a fixed shore object because a bearing changing steadily in one direction is often the first honest sign of dragging. The barometer and the weather forecast are watched throughout. A GPS anchor alarm alone is not enough — it will happily let the ship drift the full radius of the circle before it makes a sound.",
      "When the weather is forecast to deteriorate, the ship is made ready in advance. The engines are brought to notice, the deck crew stands by forward, the bridge is manned by an extra officer, and the second anchor is prepared for use. On many ships the correct decision is to weigh anchor and go to sea before conditions become too bad to heave up at all — once the cable is taking heavy weight, the windlass may not be able to recover it, and the choice will have been made for you. Leaving early is seamanship, not caution.",
      "If we do drag, everything goes in the log book: the time dragging was first suspected, the positions, the weather, the actions taken, and every communication with the port authority and with nearby vessels. Dragging into another ship or into shallow water is investigated exactly like any other collision or grounding, and the log is what shows that the watch was properly kept and that we acted as soon as we had reason to. Afterwards we hold a short debrief and, if the anchorage itself was poor, we say so in the passage plan review for the next visit."
    ]
  },
  "sar": {
    "title": "Search and Rescue (SAR) — Assisting Another Vessel",
    "text": [
      "Colleagues, under SOLAS, every Master is obliged to assist any vessel or person in distress at sea, provided it does not put our own ship in serious danger. When we receive a distress call nearby, we respond, regardless of flag, company, or cargo, because the obligation to assist overrides almost every other consideration.",
      "On receiving a distress alert — by DSC, MAYDAY relay, or direct VHF call — the Master confirms our position relative to the distress, calculates the fastest safe course, and informs the coordinating rescue authority of our intention to assist, giving our estimated time of arrival as accurately as possible.",
      "A Search and Rescue Mission Coordinator (SMC), usually a shore-based rescue coordination centre, directs the overall operation, while an On-Scene Commander — sometimes our own vessel if we arrive first — coordinates the vessels actually present at the scene, avoiding duplicated effort or gaps in the search area.",
      "As we approach, we assign extra lookouts, prepare our rescue boat and boarding equipment, and rig pilot ladders or scramble nets along the side we expect to use for recovery, so that everything is ready the moment survivors are located.",
      "The search itself usually follows a defined pattern — an expanding square search near a known last position, or a sector search when the area is less certain — coordinated with other vessels and any aircraft involved to avoid covering the same area twice while other areas remain unsearched.",
      "Once survivors are located, we recover them exactly as in a man overboard situation — approaching from the leeward side, watching for hypothermia and rescue collapse, and beginning first aid immediately, treating each survivor as a genuine medical casualty regardless of how well they appear at first.",
      "Throughout the operation, we log every detail — times, positions, communications, number of survivors — because this record is essential for the coordinating authority and for any later investigation, and inaccuracies here can complicate the wider search effort for others still missing.",
      "The obligation to assist is personal to the Master and it is not conditional on commercial convenience. Under SOLAS he must proceed with all speed to the assistance of persons in distress at sea, and he must inform the rescue coordination centre if he cannot, giving his reasons — which are then a matter of record. In practice the decision to divert is made in minutes: we note the time and position of the alert, work out our own distance and time to reach the scene, acknowledge the alert, and report our intentions to the coordinating authority so that they know what resources they actually have.",
      "On the way, the ship is prepared. The rescue boat is made ready, pilot ladders and scrambling nets are rigged on both sides at the lowest freeboard, lifebuoys with lights and lines are placed along the rails, and cargo lights are prepared to illuminate the water without dazzling the survivors or the other units. Blankets, dry clothing, hot drinks, and the ship's hospital are prepared, and the medical locker is opened. Extra lookouts are posted with binoculars, and the radar is set up for small target detection with sea clutter carefully adjusted rather than simply turned down.",
      "Survivors are often in worse condition than they look. Cold water pulls the body's heat out many times faster than cold air, and a person who has been immersed for a long time can go into cardiac arrest from being lifted vertically out of the water, because the pressure that was supporting the blood in his legs suddenly disappears. That is why we recover survivors horizontally wherever possible, handle them gently, remove wet clothing, wrap them, and warm the body core rather than rubbing the limbs. Nobody is left alone, and everyone recovered is examined even if they say they feel fine.",
      "Coordination discipline keeps the search safe. Several ships and aircraft may be working in a small area at night, so we follow the assigned search pattern and track spacing exactly, keep the assigned VHF channel, report each leg completed, and do not improvise our own search because we have a feeling about a different area. If we are the first on scene, we may be asked to act as on-scene coordinator until a rescue unit arrives, which means keeping the plot, allocating areas, and passing consolidated reports ashore. Whether we find anybody or not, the log of times, positions, and communications is the record of the whole operation."
    ]
  },
  "towing": {
    "title": "Emergency Towing Arrangement (ETA) Drill",
    "text": [
      "Team, if we lose propulsion or steering in bad weather or near the coast, we may need to be taken under tow before the situation becomes critical. Many ships are required by SOLAS to carry a fitted Emergency Towing Arrangement so this can be done quickly, without improvising under pressure, at exactly the moment when there is least time to spare.",
      "The Emergency Towing Arrangement is fitted at both the bow and the stern, so it can be used whichever end of the ship the tug approaches from, depending on wind, sea state, and the nature of our disability, without needing to rig anything from scratch.",
      "As soon as a tow is likely, we prepare the towing pennant, chafing gear, and messenger lines well before the tug arrives, so the connection can be made quickly and safely once she is alongside or nearby, reducing the time both vessels spend in a vulnerable position.",
      "Communication with the approaching tug is established early — by VHF — to agree on the method of connection, the exact towing point, and the signals we will use during the operation, since visibility and noise can make voice communication difficult once the operation actually begins.",
      "Passing the tow line is one of the more hazardous parts of the operation — the deck team wears full protective equipment, stands clear of the bight of any line under tension, and never stands in the direct line of a line that could part under load and whip back with tremendous force.",
      "Once the tow is connected and load is taken up gradually, we monitor the towing point, the chafing gear, and our own steering constantly, since even a disabled ship under tow needs some ability to assist with heading control if fitted, however limited that ability may be.",
      "Throughout the tow, we maintain communication with the tug, log our position regularly, and stay ready to release the tow quickly in an emergency, using a quick-release mechanism if one is fitted at the towing point, because circumstances at sea can change faster than expected.",
      "The emergency towing arrangement exists because a ship without propulsion drifts, and drifting ships end up on a coast. On tankers the arrangement is required to be pre-rigged and capable of being deployed quickly with no main power, in darkness, by a small number of people — which is exactly the condition we will be in when we need it. That is why the gear is inspected on schedule, the pick-up gear and chafing chain are kept free and lubricated, and the strongpoint and fairleads are checked for cracks and corrosion. Gear that has seized in its stowage is not an emergency towing arrangement, it is deck cargo.",
      "Connecting a tow is one of the most dangerous jobs on deck. A towline under load stores an enormous amount of energy and, if it parts, it comes back along its own line and through anything standing there — this is the snap-back zone, and it kills. Nobody stands in the bight of a rope, in line with a wire under tension, or between the winch and the fairlead. We keep the deck party to the minimum number needed, use hand signals agreed in advance because nothing is audible in that noise, and keep a knife and an axe within reach for an emergency release.",
      "Once the tow is connected, the work becomes a matter of patience and load management. The towing vessel builds speed very slowly to avoid shock loading, and the catenary of the towline is adjusted to absorb the movement of both ships in the seaway. On the towed ship we steer to follow, if steering is available, keep the ballast condition and trim suitable for towing, and watch the connection continuously for chafe at the fairlead, rendering the line periodically so that the same point is not wearing all the time. Position, course, and the load on the arrangement are reported to the towing vessel at agreed intervals throughout."
    ]
  }
};
