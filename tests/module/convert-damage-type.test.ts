import { DamageTypeConverter } from "@scripts/macros/convert-damage-type/conversion.ts";

const converter = (): DamageTypeConverter => new DamageTypeConverter({ from: "fire", to: "acid" });

describe("Damage type conversion", () => {
    describe("items", () => {
        test("converts weapon damage, including persistent damage", () => {
            const source = {
                type: "weapon",
                system: {
                    damage: {
                        dice: 1,
                        die: "d6",
                        damageType: "fire",
                        modifier: 0,
                        persistent: { number: 1, faces: 4, type: "fire" },
                    },
                },
            };
            const { updates, changes } = converter().convertItemSource(source);

            expect(updates).toEqual({
                "system.damage.damageType": "acid",
                "system.damage.persistent.type": "acid",
            });
            expect(changes).toBe(2);
        });

        test("converts NPC attack damage rolls", () => {
            const source = {
                type: "melee",
                system: {
                    damageRolls: {
                        abc123: { damage: "2d6", damageType: "fire", category: null },
                        def456: { damage: "1d8", damageType: "slashing", category: null },
                    },
                },
            };
            const { updates } = converter().convertItemSource(source);

            expect(updates).toEqual({ "system.damageRolls.abc123.damageType": "acid" });
        });

        test("converts spell damage partials and the fire trait", () => {
            const source = {
                type: "spell",
                system: {
                    damage: {
                        "0": { formula: "2d6", type: "fire", category: null, materials: [] },
                        "1": { formula: "1d4", type: "fire", category: "persistent", materials: [] },
                    },
                    traits: { value: ["fire", "manipulate"] },
                },
            };
            const { updates } = converter().convertItemSource(source);

            expect(updates).toEqual({
                "system.damage.0.type": "acid",
                "system.damage.1.type": "acid",
                "system.traits.value": ["acid", "manipulate"],
            });
        });

        test("converts spell damage nested in heightening levels and overlays", () => {
            const source = {
                type: "spell",
                system: {
                    heightening: {
                        type: "fixed",
                        levels: { "3": { damage: { "0": { formula: "4d6", type: "fire" } } } },
                    },
                    overlays: {
                        xyz: { system: { damage: { "0": { formula: "6d6", type: "fire" } } }, overlayType: "override" },
                    },
                },
            };
            const { updates } = converter().convertItemSource(source);

            expect(updates).toEqual({
                "system.heightening.levels.3.damage.0.type": "acid",
                "system.overlays.xyz.system.damage.0.type": "acid",
            });
        });

        test("converts persistent damage on a condition", () => {
            const source = {
                type: "condition",
                system: { persistent: { formula: "1d6", damageType: "fire", dc: 15, criticalHit: false } },
            };
            const { updates } = converter().convertItemSource(source);

            expect(updates).toEqual({ "system.persistent.damageType": "acid" });
        });

        test("converts affliction stage damage", () => {
            const source = {
                type: "affliction",
                system: { stages: [{ damage: [{ formula: "2d6", damageType: "fire" }] }] },
            };
            const { updates } = converter().convertItemSource(source);

            expect(updates).toEqual({ "system.stages": [{ damage: [{ formula: "2d6", damageType: "acid" }] }] });
        });

        test("leaves a document alone when only its name mentions fire", () => {
            const source = {
                type: "spell",
                name: "Faerie Fire",
                system: {
                    description: { value: "<p>A burst of fire-colored light...</p>" },
                    damage: {},
                    traits: { value: ["light", "manipulate"] },
                    slug: "faerie-fire",
                    rules: [{ key: "RollOption", option: "spell:faerie-fire" }],
                },
            };
            const { updates, changes } = converter().convertItemSource(source);

            expect(updates).toEqual({});
            expect(changes).toBe(0);
        });

        test("leaves slugs and roll options that merely end in a similar word alone", () => {
            const source = {
                type: "feat",
                system: {
                    slug: "fire-lung",
                    rules: [
                        { key: "RollOption", option: "feature:faerie-fire" },
                        { key: "RollOption", option: "self:effect:wall-of-fire" },
                    ],
                },
            };
            const { changes } = converter().convertItemSource(source);

            expect(changes).toBe(0);
        });
    });

    describe("rule elements", () => {
        test("converts IWR rule elements, whether their type is a string or a list", () => {
            const source = {
                type: "effect",
                system: {
                    rules: [
                        { key: "Resistance", type: "fire", value: 5 },
                        { key: "Immunity", type: ["fire", "cold"] },
                        { key: "Weakness", type: "fire", value: 5, exceptions: ["fire"] },
                    ],
                },
            };
            const { updates } = converter().convertItemSource(source);

            expect(updates["system.rules"]).toEqual([
                { key: "Resistance", type: "acid", value: 5 },
                { key: "Immunity", type: ["acid", "cold"] },
                { key: "Weakness", type: "acid", value: 5, exceptions: ["acid"] },
            ]);
        });

        test("converts damage types and predicates on damage rule elements", () => {
            const source = {
                type: "feat",
                system: {
                    rules: [
                        {
                            key: "FlatModifier",
                            selector: "strike-damage",
                            damageType: "fire",
                            value: 2,
                            predicate: ["damage:type:fire", "item:trait:fire"],
                        },
                    ],
                },
            };
            const { updates } = converter().convertItemSource(source);

            expect(updates["system.rules"]).toEqual([
                {
                    key: "FlatModifier",
                    selector: "strike-damage",
                    damageType: "acid",
                    value: 2,
                    predicate: ["damage:type:acid", "item:trait:acid"],
                },
            ]);
        });

        test("converts alteration rule elements by their altered property", () => {
            const source = {
                type: "effect",
                system: {
                    rules: [
                        { key: "ItemAlteration", itemType: "weapon", property: "damage-type", value: "fire" },
                        { key: "ItemAlteration", itemType: "weapon", property: "traits", mode: "add", value: "fire" },
                        { key: "AdjustStrike", property: "weapon-traits", mode: "add", value: "fire" },
                        {
                            key: "ItemAlteration",
                            property: "persistent-damage",
                            value: { formula: "1d6", damageType: "fire", dc: 15 },
                        },
                    ],
                },
            };
            const { updates } = converter().convertItemSource(source);

            expect(updates["system.rules"]).toEqual([
                { key: "ItemAlteration", itemType: "weapon", property: "damage-type", value: "acid" },
                { key: "ItemAlteration", itemType: "weapon", property: "traits", mode: "add", value: "acid" },
                { key: "AdjustStrike", property: "weapon-traits", mode: "add", value: "acid" },
                {
                    key: "ItemAlteration",
                    property: "persistent-damage",
                    value: { formula: "1d6", damageType: "acid", dc: 15 },
                },
            ]);
        });

        test("converts ActiveEffectLike rule elements targeting IWR and traits", () => {
            const source = {
                type: "effect",
                system: {
                    rules: [
                        {
                            key: "ActiveEffectLike",
                            mode: "add",
                            path: "system.attributes.immunities",
                            value: { type: "fire" },
                        },
                        { key: "ActiveEffectLike", mode: "add", path: "system.traits.value", value: "fire" },
                    ],
                },
            };
            const { updates } = converter().convertItemSource(source);

            expect(updates["system.rules"]).toEqual([
                { key: "ActiveEffectLike", mode: "add", path: "system.attributes.immunities", value: { type: "acid" } },
                { key: "ActiveEffectLike", mode: "add", path: "system.traits.value", value: "acid" },
            ]);
        });

        test("converts a ChoiceSet choice alongside its label and the predicates testing it", () => {
            const source = {
                type: "feat",
                system: {
                    rules: [
                        {
                            key: "ChoiceSet",
                            flag: "element",
                            rollOption: "elemental-assault",
                            choices: [
                                { label: "PF2E.TraitFire", value: "fire" },
                                { label: "PF2E.TraitWater", value: "cold" },
                            ],
                        },
                        {
                            key: "ItemAlteration",
                            property: "traits",
                            predicate: ["elemental-assault:fire"],
                            value: "fire",
                        },
                    ],
                },
            };
            const { updates } = converter().convertItemSource(source);

            expect(updates["system.rules"]).toEqual([
                {
                    key: "ChoiceSet",
                    flag: "element",
                    rollOption: "elemental-assault",
                    choices: [
                        { label: "PF2E.TraitAcid", value: "acid" },
                        { label: "PF2E.TraitWater", value: "cold" },
                    ],
                },
                { key: "ItemAlteration", property: "traits", predicate: ["elemental-assault:acid"], value: "acid" },
            ]);
        });

        test("leaves a FastHealing type alone while converting what deactivates it", () => {
            const source = {
                type: "effect",
                system: {
                    rules: [{ key: "FastHealing", type: "regeneration", value: 5, deactivatedBy: ["fire", "acid"] }],
                },
            };
            const { updates } = converter().convertItemSource(source);

            // The list collapses to a single entry rather than listing acid twice
            expect(updates["system.rules"]).toEqual([
                { key: "FastHealing", type: "regeneration", value: 5, deactivatedBy: ["acid"] },
            ]);
        });
    });

    describe("actors", () => {
        test("converts IWR entries along with their exceptions and doubleVs", () => {
            const source = {
                system: {
                    attributes: {
                        immunities: [{ type: "fire" }, { type: "poison" }],
                        weaknesses: [{ type: "cold", value: 5, doubleVs: ["fire"] }],
                        resistances: [{ type: "fire", value: 10, exceptions: ["fire"] }],
                    },
                },
            };
            const { updates } = converter().convertActorSource(source);

            expect(updates).toEqual({
                "system.attributes.immunities": [{ type: "acid" }, { type: "poison" }],
                "system.attributes.weaknesses": [{ type: "cold", value: 5, doubleVs: ["acid"] }],
                "system.attributes.resistances": [{ type: "acid", value: 10, exceptions: ["acid"] }],
            });
        });

        test("converts actor traits", () => {
            const source = { system: { traits: { value: ["fire", "elemental"] } } };
            const { updates } = converter().convertActorSource(source);

            expect(updates).toEqual({ "system.traits.value": ["acid", "elemental"] });
        });

        test("reports no changes for an actor without fire references", () => {
            const source = {
                system: {
                    attributes: { immunities: [{ type: "poison" }] },
                    traits: { value: ["undead"] },
                },
            };
            const { updates, changes } = converter().convertActorSource(source);

            expect(updates).toEqual({});
            expect(changes).toBe(0);
        });
    });
});
