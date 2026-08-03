# Homebrew macros

Standalone scripts you paste into a Foundry **Script macro**. They operate on documents
already in your world and do not modify the system code, so they survive system updates.

## `fire-to-acid.js` — full fire → acid element swap

Replaces fire damage, fire IWR and the fire trait with their acid equivalents throughout
your world.

### Installing

1. In Foundry, create a new macro: **Macro Directory → Create Macro**.
2. Set **Type** to `script`.
3. Paste the contents of `fire-to-acid.js`.
4. Save and execute it as a GM.

### Running

The macro opens a dialog:

- **Scope** — world actors (and their owned items), world items, unlinked scene tokens,
  journal entries, and optionally unlocked compendium packs.
- **Text** — whether description prose is converted, and how aggressively.
- **Dry run** — on by default. Reports what *would* change and writes nothing.

Run it once as a dry run, read the whispered summary, then clear **Dry run** to apply.

> **Back up your world first.** There is no undo. Re-running is safe — the conversion is
> idempotent — but it cannot be reversed.

### What it converts

| Area | Example |
| --- | --- |
| Damage types | `system.damage.*.type`, `*.damageType`, `system.damageRolls.*` |
| IWR | fire immunities / weaknesses / resistances |
| Traits | the `fire` trait on actors, items, spells, auras |
| Rule elements | `DamageDice`, `FlatModifier`, `Resistance`, `Weakness`, `Immunity`, `FastHealing.deactivatedBy`, `ChoiceSet`, `RollOption`, `ActiveEffectLike`, predicates |
| Roll options | `item:damage:type:fire` → `item:damage:type:acid` |
| Labels | `PF2E.TraitFire` → `PF2E.TraitAcid` |
| Inline damage | `@Damage[6d6[fire]]` → `@Damage[6d6[acid]]`, including `[persistent,fire]` |
| Prose | "6d6 fire damage" → "6d6 acid damage", "resistance to fire" → "resistance to acid" |

### What it deliberately leaves alone

- **`element: "fire"`** — the kineticist / elemental-gate identity. The valid elements are
  air, earth, fire, metal, water and wood; `acid` is not among them, so rewriting this
  breaks impulse gating. The damage those features deal is still converted.
- **Deity `domains`** — there is no acid domain in PF2e.
- **Image paths** — acid art does not exist at the fire art's filenames.
- **`@UUID[...]` link targets and slugs** — rewriting these breaks references. Display
  labels (`{Persistent Fire Damage}`) are converted; the target inside `[...]` is not.
- **Words that merely contain "fire"** — `firearm`, `fireball`, `campfire`, `bonfire`,
  `hellfire`, `misfire`, `firefly`, `fireplace`, `firework`, `gunfire`, `firebrand` and
  the like. All prose matching is word-bounded.

### Collision handling

`fire` and `acid` can coexist on the same document, which the conversion would otherwise
turn into duplicates. The macro merges them:

- **IWR** — `acid 20` + `fire 25` becomes a single `acid 25`, unioning `exceptions` and
  `doubleVs`.
- **Trait and string arrays** — deduplicated, so a troll's
  `deactivatedBy: ["acid", "fire"]` becomes `["acid"]`.
- **`ChoiceSet` choices and `RollOption` suboptions** — deduplicated by value, so an
  energy-selection toggle does not end up offering "acid" twice.

### Aggressive prose mode

Off by default. It rewrites every standalone `fire` in description text, not just the
mechanical phrases — "a roaring blast of fire" becomes "a roaring blast of acid".

It protects link targets, hyphenated slugs, and common idioms ("set fire to", "on fire",
"line of fire", "two hands to fire it"), but it is a heuristic over free text. Dry-run it
and skim the results before applying.

### Verification

The conversion logic was exercised against the 32,587 documents in this repository's
compendium sources:

| Check | Result |
| --- | --- |
| Documents changed (default / aggressive) | 3,543 / 4,420 |
| Replacements (default / aggressive) | 11,274 / 14,126 |
| Documents where a second pass changed anything | 0 |
| Corrupted words created (`acidarm`, `acidball`, …) | 0 |
| `@UUID`/`@Compendium` targets altered (of 45,075) | 0 |
| Hyphenated slugs altered | 0 |
| Exact `fire` values surviving | 12 — the intentional `element` and `domains` skips |
