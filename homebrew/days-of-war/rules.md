# Days of War — Core Rules

> **The short version:** one day = one turn. Each PC gets one **Command** (a
> kingdom-skill check) per day on top of normal hexploration. Armies follow
> **Standing Orders** and march 1–2 hexes a day. Three tracks drive the war:
> the **War Chest** (your money and supplies), **Home Front Strain** (how much the
> kingdom can endure), and the enemy's **War Clock** (how close the enemy is to
> its next escalation). Kingdom turns are paused until the war ends.

---

## 1. Ground Rules

1. **Kingdom turns are suspended** while the war runs. No Activity phase, no
   Resource Points, no Consumption, no Kingdom events. When the war ends, run the
   **Reckoning** (§11) and then resume Kingdom turns on the calendar as normal. No
   "missed" Kingdom turn is owed for the war days.
2. **Kingdom statistics are live.** Every check in this system is a Kingdom skill
   check using the kingdom sheet exactly as it stands: skill modifiers, leadership
   bonuses, item bonuses from structures, the **Unrest status penalty**, and
   **Ruin item penalties**. When the war raises Unrest or Ruin, those penalties
   immediately make later checks harder.
3. **Default DC = the kingdom's Control DC.** Some actions use an enemy army's
   Scouting DC or Standard DC instead; each action says which.
4. **Fame/Infamy** can be spent to reroll a Command check, as normal.
5. **Changes to the kingdom are permanent and immediate.** Unrest, Ruin, lost
   hexes, and destroyed structures are applied to the kingdom sheet the moment they
   happen, not stored up for later.
6. **Kingdom XP** from defeated armies (Appendix 3) is **banked** and applied
   during the Reckoning.

---

## 2. The Daily Turn

Each day runs through five phases in order.

| Phase | What happens |
| --- | --- |
| **1. Dawn** | Roll the daily event (campaign table). The GM gives scouting reports. Apply any War Clock escalation triggered last night. |
| **2. Day** | **Party phase.** PCs take their hexploration activities (travel, Reconnoiter, missions, encounters) and each PC takes **one Command**. Commands and party actions can happen in any order the table likes. |
| **3. March** | **Your armies** move or act according to their Standing Orders (§5). |
| **4. Dusk** | **Enemy phase.** The GM moves enemy armies by the enemy's current Posture, then resolves **Raids**, **Sieges**, and **Clashes** (§7–§9). |
| **5. Night** | **Upkeep.** Supply checks, rest, every-5th-day Pay Day and war fatigue, War Clock +1, then check Strain and Clock thresholds (§10). |

> **Tip:** Days with no fighting go quickly, about two minutes of bookkeeping.
> Spend the table time on the days that matter. If both sides are only marching,
> resolve several days at once.

---

## 3. The Three Tracks

### War Chest (WC)

An abstract pool of coin, wagons, fodder, and arrows. WC pays for depots,
levies, mercenaries, bribes, and getting supplies to armies cut off from home.

**Starting War Chest: the Mobilization check.** On Day 0, attempt one
**Industry, Trade, or Statecraft** check against the Control DC (the players
choose the skill):

| Result | Starting WC |
| --- | --- |
| Critical Success | 16 |
| Success | 12 |
| Failure | 8 |
| Critical Failure | 5 |

**Emptying the stockpile.** At any time, with no check, the kingdom may convert
stored Commodities into WC at **2 Commodities (any mix) : 1 WC**. Remove them
from the kingdom sheet. They are spent permanently.

**Running dry.** If a cost can't be paid, it isn't paid. The army goes unsupplied,
the levy isn't raised, and so on. WC can't go below 0.

### Home Front Strain (0–20)

Strain measures how close the people back home are to breaking. It replaces
wartime Unrest for the duration of the war. **Starting Strain = current Unrest ÷ 2,
rounded down.**

**Strain goes up for:**

| Event | Strain |
| --- | --- |
| Every 5th day of war (war fatigue, at Night) | +1 |
| A hex is Ravaged by a raid | +1 (+2 on a critical failure) |
| Your army is **defeated** in a battle | +1 |
| Your army is **destroyed** | +2 |
| Mustering levies | +1 |
| Each Night a friendly settlement spends under siege | +1 |
| A friendly settlement falls | +3 |
| Pay Day is missed | +1 |
| Some events and critical failures | as listed |

**Strain goes down for:**

| Event | Strain |
| --- | --- |
| Winning a battle (Clash or War encounter) | −1 (−2 if Determining Victory is a critical success) |
| Rally the Home Front Command | −1 (−2 on a critical success) |
| Completing a mission or objective marked **(Hope)** | as listed |
| Relieving a besieged settlement | −2 |

**Home Front Crises.** The first time Strain rises to each threshold, apply its
crisis immediately. If Strain later drops below a threshold and climbs back to
it, the crisis triggers again.

| Strain | Crisis | Effect on the kingdom (applied immediately) |
| --- | --- | --- |
| **5** | *Anxious Hearts* | Gain 1 Unrest. |
| **10** | *War Weariness* | Gain 1d4 Unrest and increase one Ruin (players choose) by 1. Requisition gains 1 less WC until Strain falls below 10. |
| **15** | *Breaking Point* | Gain 1d4 Unrest and increase two different Ruins by 1. Then, in the largest settlement, choose one: destroy one structure (riots), **or** one of your armies becomes shaken 1 (desertions). |
| **20** | *Collapse of Will* | Gain 2d4 Unrest and increase one Ruin by 2. Every army attempts a DC 20 Morale check and disbands on a failure. The war ends at the next Dawn unless the PCs win a battle or complete an objective that day. If it ends, go to the Reckoning on the enemy's terms (§11). |

### War Clock (0–30)

The War Clock is the enemy's momentum. It rises by 1 every Night automatically
and rises further when the enemy succeeds. At set thresholds the enemy
**escalates**: reinforcements arrive, fortifications go up, hostages die. The
campaign file lists each enemy's escalations. Clock 30 is the enemy's endgame.

**The War Clock goes down when you:**

| Event | Clock |
| --- | --- |
| Win a battle against a field army | −1 |
| Destroy an enemy army | −2 |
| Destroy an enemy depot or camp | −2 |
| Complete certain missions | as listed |

An escalation triggers **once**, the first time the Clock reaches its value.
Pushing the Clock back down delays the *next* escalation but does not undo past
ones.

---

## 4. Commands

Every PC may take **one Command per day** during the Day phase. A Command is a
kingdom skill check. The PC gives the order, but the roll uses the kingdom's
modifier. Use the modifier of the PC whose leadership role best fits, as
normal for kingdom checks.

**Presence.** A Command that targets an army, settlement, or hex is **in person**
if the commanding PC is in that hex. Otherwise it goes **by courier**: −2
circumstance penalty, and the target must be within **6 hexes** of the PC or of
any friendly settlement the PC is in. Magic that delivers a message (*sending*,
*message* rune networks, the Arcane Relay Command) removes the penalty and the
range limit.

**Repetition.** No skill can be used for **Rally the Home Front** on two
consecutive days. Only **one Requisition** may be attempted per day across the
whole kingdom.

### Command List

| Command | Skills | DC | Summary |
| --- | --- | --- | --- |
| **Forced March** | Exploration, Boating, Magic (master) | Control | An army gets extra movement today. |
| **Scout the Front** | Exploration, Wilderness, Intrigue | Highest enemy Scouting DC in range | Reveal enemy armies and their next moves. |
| **Fortify** | Defense, Engineering | Control (+5 outside kingdom, +10 in enemy territory) | An army becomes fortified, or you build field works. |
| **Establish Depot** | Engineering, Industry | Control | Create a supply source (2 WC). |
| **Requisition** | Agriculture, Industry, Trade | Control | Gain WC. |
| **Forage** | Agriculture, Wilderness | Control | One army is supplied tonight without WC. |
| **Muster Levies** | Warfare | Army's Recruitment DC | Raise a new basic army in a settlement (4 WC, +1 Strain). |
| **Call Allies** | Statecraft | Ally's Recruitment DC | Recruit a befriended specialized army. |
| **Recover Army** | per Appendix 3 table | Control (+5 for defeated) | Remove an army condition. |
| **Drill** | Scholarship, Warfare | Tactic's Training DC | Teach a resting army a tactic. |
| **Outfit** | Trade (costs WC), Warfare (captured gear) | Control | Give an army gear. |
| **Offensive Gambit** | Intrigue, Warfare | Enemy Scouting DC | Set up an attack with an initiative edge. |
| **Sabotage** | Intrigue, Magic | Enemy Scouting DC (+5 if fortified) | Weary, shake, or damage an enemy army or depot. |
| **Turn Their Coin** | Statecraft, Trade | Enemy Standard DC + 2 | Sow doubt in a mercenary army until it deserts. |
| **Rally the Home Front** | Arts, Folklore, Politics | Control | Reduce Strain. |
| **Whispers Behind the Walls** | Arts, Intrigue, Politics | Control + 2 | Bank Liberation Points (or the campaign's equivalent). |
| **Raise the Alarm** | Defense | Control | Help settlements resist raids tonight. |
| **Martial Law** | Defense, Intrigue | Control | Trade Strain for Unrest and Crime. |
| **Arcane Relay** | Magic | Control | Commands and orders ignore courier rules until tomorrow. |

### Command Details

**Forced March** (Exploration; Boating along rivers and lakes; Magic at master
proficiency). Target one army.
- **Critical Success** The army gains 2 extra hexploration activities of movement
  today. With Magic, it may instead move directly to any friendly settlement or
  depot within 10 hexes.
- **Success** 1 extra activity (Magic: any friendly hex within 5).
- **Failure** 1 extra activity, but the army becomes weary 1 (or increases weary by 1).
- **Critical Failure** The army doesn't move today, increases weary by 1, and
  must attempt a DC 11 flat check or take 1 damage.

**Scout the Front** (Exploration, Wilderness, Intrigue). Pick a hex within 6 hexes
of a PC or a friendly army. DC = the highest Scouting DC among enemy armies
within 3 hexes of it.
- **Critical Success** As success, and your next Clash or War encounter against
  one revealed army gives your armies +2 circumstance to initiative (or +2 on the
  Quick Clash check).
- **Success** The GM reveals every enemy army within 3 hexes of the target: its
  location, identity, conditions, and where it intends to move tomorrow.
- **Failure** You learn nothing new.
- **Critical Failure** The GM gives one false report: a phantom army or a wrong
  destination.

**Fortify** (Defense in a settlement or Refuge; Engineering anywhere else).
Target one army. It becomes **fortified** (Appendix 3) until it moves.
Engineering in the field costs **1 WC** and also builds **field works** (a
trench: AC 15, HP 1) in that hex for later battles.
- **Critical Success** As success, and the army also reduces weary by 1.
- **Success** The army is fortified.
- **Failure** Fortified only until tomorrow's Dawn.
- **Critical Failure** Not fortified. WC spent is lost, and you gain 1 Unrest
  (soldiers bully the locals).

**Establish Depot** (Engineering, Industry). Costs **2 WC**. Target a hex that
isn't enemy-held or contested and that is within 3 hexes of an existing supply
source. On a success it becomes a **depot**, a supply source (§6). On a
critical success it costs only 1 WC. On a failure, the WC is spent and no
depot is built. On a critical failure, the WC is spent, nothing is built, and
the War Clock rises by 1 (the enemy learns your line of advance).

**Requisition** (Agriculture, Industry, Trade). Once per day kingdom-wide.
- **Critical Success** +4 WC.
- **Success** +2 WC.
- **Failure** Nothing.
- **Critical Failure** Nothing, and Strain +1 (soldiers seize stores at spear-point).

**Forage** (Agriculture, Wilderness). Target an army in a hex that isn't swamp or
greater difficult terrain (allied guides can waive this). On a success the army is
supplied tonight. On a critical success it is also supplied tomorrow night. On a
critical failure the army becomes weary 1.

**Muster Levies** (Warfare against the army's Recruitment DC). Must be in person
in a friendly settlement. Costs **4 WC** and **+1 Strain**. Recruit a **basic army**
(Appendix 3) at your kingdom level, following that book's steps 1–7, except
that the army appears immediately in the settlement. Its Consumption doesn't
matter during the war (§6). Each settlement can be mustered **once per war**.
- **Critical Success** The army is recruited and becomes efficient.
- **Success** The army is recruited.
- **Failure** No army. The WC is refunded, but the Strain stays.
- **Critical Failure** No army, the WC is lost, and you gain 1 Unrest.

**Call Allies** (Statecraft against the ally's Recruitment DC). Recruit a
**specialized army** the party has befriended through play, such as Narlmarch
Hunters, bog striders, or Nomen centaurs. The army appears at its home hex.
Costs the WC the campaign lists for that ally (usually 0–4). Outcomes match
Recruit Army (Appendix 3).

**Recover Army.** Use the skill and proficiency listed on Appendix 3's *Recovering
Army Conditions* table. An army recovering from **damaged** or **defeated** must
not move that day. Outcomes match the book's Recover Army.

**Drill.** Train Army from Appendix 3. The army must spend the whole day without
moving.

**Outfit.** Outfit Army from Appendix 3. When buying with Trade, pay **1 WC per
5 RP** of the gear's listed cost (round up) instead of RP. When distributing
captured gear with Warfare, it's free, but you must have won a battle in the
last 3 days.

**Offensive Gambit** (Intrigue to surprise, Warfare to intimidate, against the
target army's Scouting DC). Your army must be in the same hex as the enemy or
adjacent to it. The attack happens at Dusk. Outcomes match Appendix 3's Offensive
Gambit.

**Sabotage** (Intrigue, Magic). Target an enemy army or depot within 6 hexes of a
PC. DC = the army's Scouting DC (+5 if fortified or inside a walled settlement).
For a depot, use its listed DC.
- **Critical Success** Choose one: the army takes 1 damage, **or** it increases
  weary by 2, **or** a depot is destroyed.
- **Success** The army increases weary **or** shaken by 1.
- **Failure** Nothing.
- **Critical Failure** Your agents are caught. Strain +1 and War Clock +1.

**Turn Their Coin** (Statecraft, or Trade by spending 2 WC first). Only works on
armies marked **Mercenary**. DC = the army's Standard DC + 2.
- **Critical Success** The army gains 2 Doubt.
- **Success** The army gains 1 Doubt.
- **Failure** Nothing. Any WC spent is lost.
- **Critical Failure** Your envoy is killed or exposed. War Clock +1, and you
  can't target that army again for 3 days.

When an army reaches **2 Doubt**, it deserts at the next Dusk and leaves the
map. If the kingdom immediately pays **4 WC**, the army instead joins you as a
specialized army (keep its stat block and adjust it to your kingdom level).

**Rally the Home Front** (Arts, Folklore, Politics). Strain −1 (−2 on a critical
success). On a critical failure, Strain +1. You can't use the same skill on two
consecutive days.

**Whispers Behind the Walls** (Arts, Intrigue, Politics; DC = Control DC + 2).
Spread rumors, pamphlets, and promises into the enemy's seat of power. A success
banks +1 Liberation Point (+2 on a critical success). The campaign file sets the
cap. A critical failure raises the War Clock by 1, as the enemy cracks down.

**Raise the Alarm** (Defense). Target a friendly settlement. Until tomorrow's Dawn,
raid checks (§7) in hexes within 3 of that settlement get a +2 circumstance bonus.
On a critical success, the first raid there is driven off with no check needed.

**Martial Law** (Defense, Intrigue). Strain −2 immediately, but gain 1 Unrest and
increase Crime by 1 regardless of the result. On a failure, the Strain reduction is
only −1. On a critical failure, it's 0 and you gain 1d4 Unrest instead of 1.

**Arcane Relay** (Magic). On a success, until tomorrow's Dawn no Command or order
takes the courier penalty or has a range limit, and order changes apply the same
day. On a critical failure, the enemy intercepts: the GM reveals one of your
army's orders to the enemy, and its next Clash gives the enemy +2 initiative.

---

## 5. Armies on the Map

### Standing Orders

Every army (yours and theirs) always has one **Standing Order**, which it carries
out each March (yours) or Dusk (enemy) phase:

| Order | Effect |
| --- | --- |
| **Hold** | Stay in the hex. If supplied, reduce weary by 1 at Night. |
| **March to [hex]** | Move toward the hex using its daily movement, then Hold on arrival. |
| **Patrol [hex]** | Stay within 1 hex of the named hex. When an enemy army enters it or a neighboring hex, move to intercept, causing a Clash at Dusk. |
| **Escort** | Move with a named army or with the PCs. |
| **Besiege** | Stay in an enemy settlement's hex and maintain a siege (§8). |

**Changing orders** costs no Command. If a PC is with the army, change its order
at any time. Otherwise, a PC in any friendly settlement can send new orders to any
army within 6 hexes. These **take effect tomorrow** unless an Arcane Relay or
similar magic is active.

**With the party.** An army escorting the PCs travels with them during
hexploration, as in *Traveling with an Army* (Appendix 3). The party then moves at
the slower of the two rates.

### Daily Movement

Use the same hexploration "activities per day" the party uses, with these army
rates:

| Army type | Activities per day |
| --- | --- |
| Infantry, Siege | 1 |
| Cavalry, Skirmisher | 2 |
| Flying armies | 2, ignoring terrain |

| Terrain | Activities to cross a hex |
| --- | --- |
| Open (plains, hills, road hexes) | 1 |
| Difficult (forest, rough hills) | 2 |
| Greater difficult (swamp, mountains) | 3 |
| Crossing a river without a bridge or ford | +1 |

Unspent activities carry over to the next day while the army keeps the same order.
Siege armies **can't** enter greater difficult terrain without a road or allied guides.

**Mired** and **pinned** conditions apply. A mired army loses activities equal to
its mired value (minimum 0).

---

## 6. Supply

Armies don't use Consumption or Food Commodities during the war. Instead:

**Supply sources:** any friendly settlement, any depot, and any enemy camp you've
captured.

**Supplied:** at Night, an army is supplied if it is within **2 hexes** of a supply
source, by a path that doesn't pass through an enemy-held hex or an enemy army.
An army with the **Live off the Land** tactic, or one that Foraged today, is
supplied anywhere.

**Unsupplied:** pay **1 WC** to rush wagons to it, **or** it increases weary by 1.
An army that would reach weary 4 this way disbands (Appendix 3: gain 1d4 Unrest
and increase a Ruin by 1).

**Rest:** a supplied army that didn't move today reduces weary by 1.

**Pay Day (every 5th Night):** pay **1 WC for each army you field**. Each army you
can't pay increases shaken by 1, and Strain rises by 1 for that night (not per army).

---

## 7. Hex Control and Raids

Each hex is **Friendly** (claimed by your kingdom), **Enemy-held**, **Wild**, or
**Contested**.

**Raids.** When an enemy army ends Dusk in a Friendly hex with no friendly army
present, it raids. The kingdom attempts a **Defense** check against the raider's
Standard DC, representing local militia and watchmen:

- **Critical Success** The raiders are driven off and take 1 damage.
- **Success** The raiders are driven off with nothing to show for it.
- **Failure** The hex is **Ravaged**. It becomes Contested and Strain +1. If it
  contains Farmland, a work site, or a road, one of those is destroyed: remove it
  from the kingdom sheet.
- **Critical Failure** As failure, but Strain +2 and gain 1 Unrest.

**Contested hexes** give the kingdom nothing (no work site output, no road bonus)
until cleared. A friendly army that spends a full day in a Contested hex with no
enemy present returns it to Friendly. At Night, if there are **3 or more Contested
hexes**, Strain +1.

**Enemy-held hexes** are the enemy's territory. A hex with an enemy army, camp, or
settlement and no friendly army is enemy-held. Friendly armies entering it may
fight there (Clash), but supply can't pass through.

---

## 8. Sieges

When a non-skirmisher enemy army ends Dusk in a hex with a **friendly settlement**,
the settlement is **besieged**.

- **If a friendly army is in the hex**, a Clash or War encounter happens at Dusk.
  The defender may use the settlement's walls as fortifications (Appendix 3
  fortification statistics) and counts as fortified if it was garrisoned.
- **If no friendly army is present**, each Night attempt a **Defense** check
  against the besieger's Standard DC:
  - **Critical Success** The defenders sally. The besieger takes 1 damage.
  - **Success** The walls hold.
  - **Failure** One structure (GM's choice) is destroyed.
  - **Critical Failure** Two structures are destroyed, and gain 1 Unrest.
- Every Night of siege adds **Strain +1**.
- **The Fall.** After the **third** consecutive Night of siege with no relief, the
  settlement falls. Treat it as the Tatzlford **Total Defeat** result (Chapter 7,
  p. 299): the settlement is enemy-held, you lose its hex, 8 structures (or half
  its structures, if fewer) are destroyed, Unrest +1d4, one Ruin +1, and
  **Strain +3**. You can retake it later.
- **Relief.** Driving off or defeating every besieger gives **Strain −2**.

---

## 9. Battles

A **Clash** happens at Dusk whenever hostile armies share a hex, unless every army
on one side is fortified inside a settlement and the other side isn't besieging.
Patrols intercepting or a successful Offensive Gambit also cause Clashes.

### Choosing how to resolve a battle

- **The PCs are present:** run a full **War encounter** (Appendix 3). The PCs may
  also **Strike the Commander** (below).
- **The PCs are absent:** resolve a **Quick Clash** (below). If they want, the
  players can still run it as a full War encounter, with the PCs directing from
  afar. Then the PCs can't Strike the Commander, and the result is worsened one
  degree on Determining Victory.
- **Named battles** in the campaign file are always full War encounters.

### Strike the Commander

If the enemy force has a named leader or champion, the PCs can confront them in
an ordinary encounter while the armies fight. This mirrors the fight against
Ameon Trask at Tatzlford. When Determining Victory or Loss:

- PCs **defeated or captured** the commander: improve the result by one degree.
- PCs **were present but didn't engage** the commander: worsen it by one degree.

### Quick Clash

Choose each side's **lead army**, the highest-level army present. Attempt a
**Warfare** check against the enemy lead army's **Standard DC**, modified as follows:

| Situation | Modifier to the DC |
| --- | --- |
| Each additional enemy army in the hex | +2 |
| Each additional friendly army in the hex | −2 |
| Enemy is fortified, or the defender has walls/field works | +2 |
| Your lead army is higher level than theirs | −1 per level |
| Your lead army is lower level than theirs | +1 per level |
| Scout the Front critical success or Offensive Gambit success against them | −2 |

Your lead army's shaken and weary values apply as penalties to the check.

- **Critical Success** One enemy army (your choice) is **defeated**. All other
  enemy armies are **routed**. Your armies take no damage.
- **Success** Every enemy army is **routed** and the enemy lead army takes 1
  damage. Your lead army takes 1 damage.
- **Failure** Your armies are **routed**. Your lead army takes 1 damage and becomes
  shaken 1.
- **Critical Failure** Your armies are **routed**. Your lead army takes 2 damage
  (possibly **defeated**), and every army you had in the battle increases shaken by 1.

**Routed** armies retreat 1 hex toward their nearest supply source, chosen by
their controller, and can't move further until the next March or Dusk phase.

### After any battle

Use Appendix 3's **Determining Victory** (Warfare) or **Determining Loss**
(Defense), with these changes:

- Apply anything that says "at the start of your next Kingdom turn" **immediately**
  instead, such as a Fame point or Unrest reduction.
- **Victory:** Strain −1 (−2 on a critical success). If you beat a field army, War
  Clock −1. If an enemy army was destroyed, War Clock −2 instead.
- **Loss:** Strain +1 for each of your armies defeated, +2 for each destroyed.
- Bank Kingdom XP for each enemy army defeated.

---

## 10. Night Checklist

1. **Supply.** Check each of your armies (§6). Enemy armies follow the same rule
   unless the campaign says otherwise.
2. **Rest.** Supplied armies that didn't move reduce weary by 1.
3. **Sieges.** Resolve each siege's nightly check (§8).
4. **Contested hexes.** With 3 or more, Strain +1.
5. **Every 5th day:** Pay Day (§6) and war fatigue (Strain +1).
6. **War Clock +1.**
7. **Thresholds.** Apply any new Home Front Crisis, then any new War Clock escalation.
   (Escalations are announced or take effect at the next Dawn.)

---

## 11. Ending the War: the Reckoning

The war ends when **one** of these happens:

- **Victory.** The campaign's win condition is met. For Drelev, that's the
  baron overthrown and Fort Drelev liberated.
- **Terms.** Either side accepts a negotiated peace (the campaign lists terms).
- **Collapse.** Strain 20 isn't recovered from (§3), or the War Clock reaches 30
  and the campaign says the enemy's endgame ends the war.

Then run the **Reckoning** in order. Afterward, resume Kingdom turns.

1. **Contested hexes.** For each, attempt a **Defense** or **Exploration** check
   (Control DC). On a success, it returns to Friendly. On a failure, it's lost:
   remove it from the kingdom.
2. **Enemy-held former hexes** (including fallen settlements) stay lost unless the
   victory terms return them.
3. **Leftover War Chest.** Refund it as Commodities at **1 WC : 1 Commodity** of
   the players' choice, up to the kingdom's storage limits.
4. **Lingering Strain.** If Strain is **10 or higher**, gain 1d4 Unrest. If it's
   **15 or higher**, also increase one Ruin by 1. Then Strain is discarded.
5. **Armies.** Your armies keep their conditions and resume using Consumption
   normally. Levies can be disbanded with no check.
6. **Kingdom XP.** Apply all banked Kingdom XP, plus any campaign victory award.
7. **Outcome.** Apply the campaign's victory or defeat results.

---

## 12. Running It: Advice

- **Show the map.** Put every known army on a hex map the players can see. Keep
  hidden ones behind the screen until scouted.
- **Telegraph threats.** Tell the players, in fiction, which way the enemy is
  heading (rumors, smoke on the horizon, refugees). Raids should feel like
  choices the players lost, not ambushes.
- **Let the heroes be heroes.** The best days are the ones where the party rides
  off on a mission (killing a captain, rescuing allies, wrecking a depot) while
  their armies hold the line. Commands keep the war going while the party is away.
- **Keep it moving.** A day with nothing happening takes one sentence. Batch
  marches. Save the table time for missions and battles.
- **Collapsing days.** If the PCs spend several days on one long mission, such
  as a dungeon, resolve the armies' days in a batch at the end and roll one
  combined Requisition or Rally if you want.
