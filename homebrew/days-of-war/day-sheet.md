# Days of War — Daily Run Sheet

Everything needed to run one day of the Drelev war. Full rules are in
[`rules.md`](rules.md) (§ numbers below) and [`drelev-campaign.md`](drelev-campaign.md).

**Default DC = Control DC.** Unrest and Ruin penalties apply to every kingdom check.
Fame/Infamy can be spent to reroll a Command.

---

## 1. Turn Order

### ☀ Dawn
1. Check **Scheduled Arrivals** (below) and announce anything that arrives today.
2. Announce any **War Clock escalation** triggered last night.
3. Roll **d20 on Daily Events** (§4 of this sheet).
4. Give scouting reports: what the PCs can see, rumors, smoke on the horizon.

### ⚔ Day (Party phase)
- PCs take their normal **hexploration activities**: travel, Reconnoiter, missions,
  encounters.
- **Each PC takes 1 Command** (§2 of this sheet), in any order around the party's actions.
- **Change Standing Orders** (free):
  - **A PC is with the army:** change it any time.
  - **From a friendly settlement:** reach any army within 6 hexes. The change takes
    effect **tomorrow** unless Arcane Relay is active.

### 🥾 March (your armies)
- Each of your armies carries out its Standing Order: **Hold, March to [hex], Patrol
  [hex], Escort, or Besiege.**

| Army type | Activities/day |  | Terrain | Cost to cross |
| --- | --- | --- | --- | --- |
| Infantry, Siege | 1 |  | Open / road | 1 |
| Cavalry, Skirmisher | 2 |  | Difficult (forest) | 2 |
| Flying | 2, ignores terrain |  | Greater difficult (Slough swamp) | 3 (2 with Swamp Guides or a causeway) |
| Lodovka Fleet | 3 on river/lake (4 downstream), Slough channels difficult |  | River crossing with no bridge | +1 |

- Unspent activities carry over to the next day.
- A mired army loses activities equal to its mired value.
- Siege armies can't enter greater difficult terrain without a road or guides.

### 🌒 Dusk (enemy phase)
1. **Move enemy armies** by Drelev's Posture (§5 of this sheet) and their own orders
   (*Raid*, *Hunt*, and so on).
2. **Raids:** an enemy army in a Friendly hex or depot with no friendly army there.
3. **Sieges:** a non-skirmisher enemy army in a friendly settlement's hex.
4. **Clashes:** hostile armies sharing a hex, Patrol intercepts, and Offensive Gambits.

### 🌙 Night (upkeep)
1. **Supply** each army. It's supplied if it's within **2 hexes** of a supply source
   by a path not blocked by enemies, or it has Live off the Land, or it Foraged today.
   Otherwise pay **1 WC** or it gets **weary +1**. Weary 4 means it disbands.
   - **Supply sources:** friendly settlements, depots, captured enemy camps, and
     Tok-Nikrat (only for armies with the Scouts).
2. **Rest:** a supplied army that didn't move reduces weary by 1.
3. **Slough Check** for every army in a Slough swamp hex (§6 of this sheet).
4. **Sieges:** each undefended besieged settlement makes its nightly Defense check.
   **Strain +1** per settlement.
5. **3 or more Contested hexes:** Strain +1.
6. **Every 5th day (★):** **Pay Day**, 1 WC per army you field. Each unpaid army gets
   shaken +1, and Strain +1 (once). Also **war fatigue**: Strain +1.
7. **War Clock +1.**
8. **Thresholds:**
   - **Strain crises** at 5, 10, 15, and 20.
   - **Clock escalations:** announce them at the next Dawn.

---

## 2. Commands (1 per PC per day)

- **In person:** the PC is in the target hex.
- **By courier:** −2 circumstance, and the target must be within 6 hexes of the PC
  or of the friendly settlement the PC is in. Arcane Relay or *sending* removes both
  limits.
- **Limits:**
  - Only **1 Requisition** per day, kingdom-wide.
  - **Rally the Home Front** can't use the same skill on consecutive days.

| Command | Skills · DC | Critical Success | Success | Failure | Critical Failure |
| --- | --- | --- | --- | --- | --- |
| **Forced March** | Exploration, Boating (water), Magic (master) · Control | +2 activities (Magic: to a friendly settlement or depot ≤10 hexes) | +1 activity (Magic: friendly hex ≤5) | +1 activity, weary +1 | No move, weary +1, DC 11 flat or 1 dmg |
| **Scout the Front** | Exploration, Wilderness, Intrigue · highest enemy Scouting DC within 3 hexes of target | As success, and +2 initiative (or +2 Quick Clash) vs one revealed army | Reveal all enemy armies within 3 hexes of target, plus their next moves | Nothing | GM gives one false report |
| **Fortify** | Defense (settlement or Refuge), Engineering (field, 1 WC, builds a trench: AC 15, HP 1) · Control (+5 outside kingdom, +10 enemy land) | Fortified, weary −1 | Fortified until it moves | Fortified until Dawn | Not fortified, WC lost, +1 Unrest |
| **Establish Depot** | Engineering, Industry · Control · 2 WC; hex not enemy or contested, ≤3 hexes from a supply source | Depot, costs only 1 WC | Depot built | WC spent, no depot | WC spent, War Clock +1 |
| **Requisition** | Agriculture, Industry, Trade · Control | +4 WC | +2 WC | — | Strain +1 |
| **Forage** | Agriculture, Wilderness · Control; not in swamp unless guided | Supplied tonight and tomorrow night | Supplied tonight | — | Weary 1 |
| **Muster Levies** | Warfare · army's Recruitment DC · in person in a settlement, 4 WC, Strain +1; once per settlement | Basic army at kingdom level, efficient | Army raised | No army, WC refunded | No army, WC lost, +1 Unrest |
| **Call Allies** | Statecraft · ally's Recruitment DC · WC as listed | Recruited, efficient | Recruited | — | +1 Unrest, no recruiting until tomorrow |
| **Recover Army** | see table below · Control (+5 vs defeated) · damaged/defeated: army must not move today | Condition −2 (or +2 HP) | Condition −1 (or +1 HP) | — | +1 Unrest. If recovering from defeated, the army is destroyed |
| **Drill** | Scholarship, Warfare · tactic's Training DC · army rests all day | Learns tactic, efficient | Learns tactic | — | Weary +1 |
| **Outfit** | Trade (1 WC per 5 RP) or Warfare (captured gear; needs a win in the last 3 days) · Control | Outfitted, efficient | Outfitted | Fails, WC refunded | Fails, WC lost |
| **Outfit: Reinforce** | Trade, Warfare · Standard DC of the new level · 2 WC; in a friendly settlement or depot; army doesn't move; army below kingdom level −2 | +2 levels (cap: kingdom level −2) | +1 level | No change, WC refunded | No change, WC lost, weary 1 |
| **Offensive Gambit** | Intrigue, Warfare · target's Scouting DC · same or adjacent hex; attack at Dusk | +2 initiative, and one enemy army shaken 1 | +2 initiative | No edge | Enemy +4 initiative |
| **Sabotage** | Intrigue, Magic · target's Scouting DC (+5 fortified or walled); depot uses its own DC | 1 dmg, or weary +2, or destroy a depot | Weary or shaken +1 | — | Strain +1, War Clock +1 |
| **Turn Their Coin** | Statecraft, or Trade (pay 2 WC first) · Standard DC + 2 · Mercenary armies only | +2 Doubt | +1 Doubt | WC lost | War Clock +1, can't target that army for 3 days |
| **Rally the Home Front** | Arts, Folklore, Politics · Control | Strain −2 | Strain −1 | — | Strain +1 |
| **Whispers Behind the Walls** | Arts, Intrigue, Politics · Control + 2 · cap 6 LP from this Command | +2 banked LP | +1 banked LP | — | War Clock +1 |
| **Raise the Alarm** | Defense · Control · one settlement | First raid within 3 hexes auto-repelled, and +2 on the rest | +2 on raid checks within 3 hexes until Dawn | — | — |
| **Martial Law** | Defense, Intrigue · Control · **always** +1 Unrest and +1 Crime | Strain −2 | Strain −2 | Strain −1 | Strain 0, +1d4 Unrest instead of 1 |
| **Arcane Relay** | Magic · Control | No courier penalty or range limit, and orders apply the same day, until Dawn | Same as critical success | — | Enemy learns one army's orders, and gets +2 initiative vs it |
| **Lay a Causeway** *(Drelev)* | Engineering, Wilderness · Control · 1 WC · a Slough hex with your army | Causeway, free | Causeway: +2 Slough Checks, counts as difficult terrain for your armies | WC spent | WC spent, working army weary 1 |
| **Write to Restov** *(Drelev, once)* | Statecraft, Politics · Control | Swordlords arrive 3 days early | 1 day early | — | 2 days late |

**Doubt:** at 2 Doubt, the army deserts at the next Dusk. Pay **4 WC** right then and
it joins you instead.

**Reinforcing:** use the new level's numbers from the Basic Armies by Level table
(`rules.md` §4). Keep the army's stat block adjustments. HP doesn't change.

**Recover Army skills** (Appendix 3)

| Condition | Skill |
| --- | --- |
| Damaged | Defense, or Folklore (expert) |
| Defeated | Warfare (expert), or Politics (master) |
| Lost | Exploration, or Wilderness (expert) |
| Mired / Pinned | Engineering, or Magic (expert) |
| Shaken | Arts, or Warfare (expert) |
| Weary | Defense, or Arts (expert) |

---

## 3. Scheduled Arrivals

| Day | Event |
| --- | --- |
| 2 (Dusk) | Tiger Lord Outriders arrive from the western map edge. |
| 7 | Swordlords' Company (Restov) appears on the East Sellen road. |
| 10 | Lodovka River Fleet appears on the East Sellen at the north map edge. |
| 10 | Melody Salticidae arrives in High Aquanedge. |

---

## 4. Daily Events (d20 at Dawn)

| d20 | Event |
| --- | --- |
| 1–8 | **Quiet day.** Weather and rumors only. |
| 9 | **Downpour.** Every army in difficult or greater difficult terrain is mired 1 today. |
| 10 | **Deserters.** One of your shaken or unsupplied armies must succeed at a DC 20 Morale check or take 1 damage. If none qualifies, Drelev deserters reach you instead: reveal one enemy army. |
| 11 | **Refugee column.** Take them in (−1 WC, Strain −1), or turn them away (your next Rally the Home Front takes −2). |
| 12 | **Spy in the camp.** Intrigue check (Control DC). On a failure, War Clock +1 and the enemy gets +2 initiative in its next battle. |
| 13 | **The Pride hunts.** One of your armies within 4 hexes of Speartooth's Pride, outside a swamp, takes 1 damage unless you succeed at a Wilderness check (Control DC; the Longbows in that hex give +2). If the Pride is gone, treat this as a quiet day. |
| 14 | **Courier caught.** A free successful Scout the Front on any hex. |
| 15 | **Volunteers.** +2 WC, or one army reduces shaken by 1. |
| 16 | **Fey omens.** An ankou shadows the party, and one Wild hex becomes greater difficult terrain for the rest of the war. |
| 17 | **Drelev's envoy.** Drelev offers terms (below). |
| 18 | **Boggards strike Tok-Nikrat.** Defense check (DC 27; +2 if the Scouts are home). On a failure, the Scouts take 1 damage and Strain +1. Quiet day once M'botuu is reclaimed. |
| 19 | **Camp fever.** Your largest army needs a Defense or Folklore check (Control DC) or gets weary +1. |
| 20 | **Heroic moment.** One PC takes a second Command today, or one Command gets +2. |

**Drelev's terms (event 17):** recognize his barony and cede every Contested and
enemy-held hex.
- **Accept:** the war ends. Contested hexes are lost.
- **Stall:** Statecraft (Control DC). Success: War Clock −1. Critical success: also
  reveal one enemy army. Critical failure: War Clock +2.
- **Demand his surrender:** refused unless 3 or more of his armies are destroyed. If
  they are, he flees to his keep, and War Clock −3.

---

## 5. Dusk Reference

### Drelev's Posture

| Clock | Posture | Behavior |
| --- | --- | --- |
| 0–7 | **Raiding** | Raiders and Outriders raid. Everyone else holds. |
| 8–15 | **Offensive** | Stonethrowers, Free Company, Siege Battery (and the Frog Riders, while Drelev holds them) strike your forward position: Tok-Nikrat, or M'botuu if reclaimed. If Tatzlford is yours and closer, they besiege it instead. |
| 16+ | **Total War** | Every field army attacks the nearest friendly army or settlement. The Fort Guard holds the fort. |
| Override | **Entrenched** | Triggered when 3 or more Drelev armies are destroyed, or your siege engines are within 2 hexes of the fort. Every army returns to the fort and garrisons. |

**Enemy army orders:**
- **Raid:** target your depots first, then the westernmost undefended Friendly hex,
  then Tok-Nikrat.
- **Hunt** (Speartooth's Pride): attack your nearest army within 4 hexes that isn't
  in a swamp.

### Raid (Defense vs raider's Standard DC)

| Result | Effect |
| --- | --- |
| Critical Success | Raiders driven off and take 1 damage. |
| Success | Driven off. |
| Failure | Hex **Ravaged**: it becomes Contested, Strain +1, and one Farmland, work site, or road is destroyed. A raided depot is destroyed. |
| Critical Failure | As failure, plus Strain +2 and +1 Unrest. |

### Siege (no defending army; nightly Defense vs besieger's Standard DC)

| Result | Effect |
| --- | --- |
| Critical Success | Defenders sally: the besieger takes 1 damage. |
| Success | Walls hold. |
| Failure | 1 structure destroyed. |
| Critical Failure | 2 structures destroyed, +1 Unrest. |

- **Strain +1** each Night of siege.
- **The Fall:** after the **3rd** unrelieved Night, the settlement falls. Lose the hex
  and 8 structures (or half, if fewer), Unrest +1d4, Ruin +1, Strain +3.
- **Relief:** Strain −2.

### Battles

- **PCs present:** run a full War encounter. The PCs can **Strike the Commander**:
  winning improves the result one degree, and being present without engaging worsens
  it one degree.
- **PCs absent:** use a **Quick Clash**. Make a Warfare check against the enemy lead
  army's Standard DC, adjusted as follows:

| DC modifier | |
| --- | --- |
| Each extra enemy army | +2 |
| Each extra friendly army | −2 |
| Enemy fortified, or defender has walls or field works | +2 |
| Per level your lead army is above / below theirs | −1 / +1 |
| Scout the Front critical success or Offensive Gambit success | −2 |
| Your lead army's shaken and weary | penalty to your check |

| Result | Effect |
| --- | --- |
| Critical Success | One enemy army defeated, the rest routed. No damage to you. |
| Success | All enemies routed. Their lead army takes 1 damage, and yours takes 1. |
| Failure | You are routed. Your lead army takes 1 damage and becomes shaken 1. |
| Critical Failure | You are routed. Your lead army takes 2 damage, and all your armies get shaken +1. |

- **Routed** (in a Quick Clash) means falling back 1 hex toward supply.
- **Battles in the Slough:** −2 Maneuver to all except Amphibious, Water Stride, and
  Swamp Dwellers armies.
- **After the battle:** Determining Victory (Warfare) or Loss (Defense).
  - **Win:** Strain −1 (−2 on a critical success), and War Clock −1 for a field army
    or −2 if an army was destroyed.
  - **Loss:** Strain +1 per army of yours defeated, +2 per army destroyed.
  - Bank Kingdom XP.

---

## 6. Slough Check (Night, each army in a Slough swamp hex)

**Maneuver vs DC 23, +1 per consecutive Night after the 3rd** (DC 24 on Night 4, DC 25
on Night 5, and so on).
- **Resets:** a Night outside the Slough, or in Tok-Nikrat (with the Scouts) or a
  reclaimed M'botuu.
- **No roll:** armies camped in those settlements, and natives (Frog Riders,
  Tok-Nikrat Scouts, lizardfolk).
- **Lodovka Fleet:** +4, and treats hazard 3 as no effect.

| Modifier | |
| --- | --- |
| Swamp Guides | +2 |
| Causeway (with guides: +3 total) | +2 |
| Unsupplied tonight | −2 |
| Cavalry | −2 |
| Siege | −4 |

| Result | Effect |
| --- | --- |
| Critical Success | Weary −1, even if the army moved today. |
| Success | No effect. |
| Failure | 1 roll on Slough Hazards. |
| Critical Failure | 2 rolls (reroll duplicates), and weary +1. Beside Lake Hooktongue: **Hooktongue wakes**, and the army takes 2 damage. |

### Slough Hazards (d8)

| d8 | Hazard | Effect |
| --- | --- | --- |
| 1 | **Marsh fever** | Weary +1. The army can't rest off weary until it spends a Night out of the swamp or in a friendly Slough settlement. A Recover Army (weary) Command also cures it. |
| 2 | **Fever spreads** | As 1, plus another army of the same side in the hex rolls a Slough Check now. |
| 3 | **Sucking mire** | Mired 2 until the end of tomorrow's movement. Siege armies also take 1 damage. |
| 4 | **Spoiled stores** | Unsupplied tonight regardless (pay 1 WC or weary +1). Ranged armies start their next battle with 2 fewer shots. |
| 5 | **Leeches and rot** | Weary +1. |
| 6 | **Will-o'-wisps** | Shaken +1. |
| 7 | **Something in the water** | Zone 10 predator: 1 damage, unless the PCs are present and win the encounter. |
| 8 | **Boggard war-party** | While Drelev holds M'botuu: 1 damage and shaken 1. After the PCs reclaim it, your armies are instead supplied and get weary −1. |

---

## 7. War Clock Escalations

| Clock | Escalation |
| --- | --- |
| 4 | **Iron Curfew:** −1 banked LP. |
| 6 | **Pay Convoy** sets out (Mission 7). |
| 8 | **A Price on Their Heads:** Posture becomes Offensive, and bounty hunters attack. |
| 12 | **Pitax's Loan:** Siege Battery arrives at Fort Drelev. |
| 16 | **The Wall Is Finished:** Posture becomes Total War, and the fort's wall gap closes. |
| 20 | **Armag's Gift:** Tiger Lord Warband arrives. |
| 24 | **Conscription:** Drelev Conscripts raised, −2 banked LP. |
| 27 | **Blood in the Square:** −3 banked LP, Strain +2. |
| 30 | **Irovetti's Hand:** Armed Truce, unless the PCs are already besieging the fort. |

**Lowering the Clock:**
- Win against a field army: −1.
- Destroy an army, depot, or camp: −2.
- Some missions: as listed.

## 8. Home Front Crises

| Strain | Crisis |
| --- | --- |
| 5 | +1 Unrest. |
| 10 | +1d4 Unrest, +1 Ruin. Requisition gives 1 less WC while Strain is 10 or more. |
| 15 | +1d4 Unrest, +1 to two different Ruins. Then either a structure is destroyed or an army becomes shaken 1. |
| 20 | +2d4 Unrest, +2 Ruin. Every army makes a DC 20 Morale check or disbands. The war ends next Dawn unless the PCs win a battle or complete an objective that day. |
