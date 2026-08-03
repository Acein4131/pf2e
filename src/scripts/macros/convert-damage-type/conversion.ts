import type { DamageType } from "@system/damage/types.ts";
import * as R from "remeda";

/** A request to swap one damage type for another throughout a document's data. */
interface DamageTypeConversion {
    from: DamageType;
    to: DamageType;
}

/** Update data for a single document, along with a tally of the values it changes. */
interface SourceConversion {
    /** Flattened update data suitable for passing to `Document#update` */
    updates: Record<string, unknown>;
    /** The number of individual values changed */
    changes: number;
}

/** Rule element keys whose `type` property holds IWR types rather than a discriminator of some other kind. */
const IWR_RULE_KEYS: Set<string> = new Set(["Immunity", "Resistance", "Weakness"]);

/**
 * Second-to-last segments of a roll option after which a bare damage type or trait name may appear. Requiring one of
 * these keeps unrelated options—`spell:faerie-fire`, `feature:fire-lung`—from being rewritten: only a final segment
 * that is exactly the damage type, qualified by one of these, is a reference to the type itself.
 */
const OPTION_QUALIFIERS: Set<string> = new Set([
    "damage-type",
    "exception",
    "immunity",
    "resistance",
    "trait",
    "traits",
    "type",
    "weakness",
]);

/** `property` values of alteration rule elements whose `value` holds a damage type or trait. */
const ALTERATION_PROPERTIES: Set<string> = new Set(["damage-type", "traits", "weapon-traits"]);

/** Object keys holding an array of damage types, traits, or IWR exceptions. */
const LIST_KEYS: Set<string> = new Set([
    "add",
    "choices",
    "deactivatedBy",
    "doubleVs",
    "exceptions",
    "remove",
    "traits",
]);

/** `path` values of `ActiveEffectLike` rule elements whose `value` holds a damage type or trait. */
const AE_LIKE_PATHS = /\.(?:immunities|weaknesses|resistances|traits\.value)$/;

/** Actor attribute paths holding IWR entries. */
const IWR_ATTRIBUTES = ["immunities", "weaknesses", "resistances"] as const;

/**
 * Rewrites references to one damage type into another within document source data.
 *
 * Only structured, machine-read data is touched: damage types, traits, IWR entries, persistent damage, and the rule
 * elements that manipulate them. Names, descriptions, and other prose are deliberately left alone, so an item whose
 * name merely contains the word—*Faerie Fire*, say—is unaffected unless it actually deals or references fire damage.
 */
class DamageTypeConverter {
    readonly from: DamageType;

    readonly to: DamageType;

    /** A tally of individual values changed by the most recent conversion */
    changes = 0;

    /**
     * Roll option prefixes set by `ChoiceSet` rule elements offering the source damage type: options built from them
     * (`elemental-assault:fire`) must follow the converted selection even though their prefix is item-specific.
     */
    #choiceSetPrefixes: Set<string> = new Set();

    constructor({ from, to }: DamageTypeConversion) {
        this.from = from;
        this.to = to;
    }

    /** Convert an actor's source data, excluding its embedded items. */
    convertActorSource(source: object): SourceConversion {
        this.changes = 0;
        this.#choiceSetPrefixes = new Set();
        const updates: Record<string, unknown> = {};
        if (!R.isPlainObject(source)) return { updates, changes: 0 };
        const system = source.system;
        if (!R.isPlainObject(system)) return { updates, changes: 0 };

        // IWR entries, each of which may carry exceptions and doubleVs lists
        const attributes = system.attributes;
        if (R.isPlainObject(attributes)) {
            for (const attribute of IWR_ATTRIBUTES) {
                const entries = attributes[attribute];
                if (!Array.isArray(entries)) continue;
                const converted = entries.map((entry) => this.#convertIWREntry(entry));
                if (!R.isDeepEqual(entries, converted)) {
                    updates[`system.attributes.${attribute}`] = converted;
                }
            }
        }

        // Actor traits
        const traits = system.traits;
        if (R.isPlainObject(traits) && Array.isArray(traits.value)) {
            const converted = this.#convertList(traits.value);
            if (!R.isDeepEqual(traits.value, converted)) updates["system.traits.value"] = converted;
        }

        return { updates, changes: this.changes };
    }

    /** Convert an item's source data, including its rule elements. */
    convertItemSource(source: object): SourceConversion {
        this.changes = 0;
        this.#choiceSetPrefixes = new Set();
        const updates: Record<string, unknown> = {};
        if (!R.isPlainObject(source)) return { updates, changes: 0 };
        const system = source.system;
        if (!R.isPlainObject(system)) return { updates, changes: 0 };

        this.#collectChoiceSetPrefixes(system.rules);
        const converted = this.#convertNode(fu.deepClone(system));
        flattenDiff(system, converted, "system", updates);

        return { updates, changes: this.changes };
    }

    /**
     * Note the roll option prefixes of any `ChoiceSet` offering the source damage type, so that predicates testing the
     * resulting selection are converted alongside it.
     */
    #collectChoiceSetPrefixes(rules: unknown): void {
        if (!Array.isArray(rules)) return;
        for (const rule of rules) {
            if (!R.isPlainObject(rule) || rule.key !== "ChoiceSet") continue;
            if (typeof rule.rollOption !== "string" || rule.rollOption.length === 0) continue;
            const choices = rule.choices;
            if (!Array.isArray(choices)) continue;
            const offersSourceType = choices.some((choice) =>
                R.isPlainObject(choice) ? choice.value === this.from : choice === this.from,
            );
            if (offersSourceType) this.#choiceSetPrefixes.add(rule.rollOption);
        }
    }

    /**
     * Recursively convert an arbitrary node of system data.
     * @param parentKey The key under which this node sits, needed to recognize trait lists at `traits.value`
     */
    #convertNode(node: unknown, parentKey = ""): unknown {
        if (Array.isArray(node)) return node.map((entry) => this.#convertNode(entry, parentKey));
        if (typeof node === "string") return this.#convertRollOption(node);
        if (!R.isPlainObject(node)) return node;

        for (const [key, value] of Object.entries(node)) {
            if (key === "damageType") {
                // Consistent across weapons, NPC attacks, afflictions, conditions, and rule elements
                node[key] = this.#convertScalar(value);
            } else if (key === "type" && this.#isDamageTypeContext(node)) {
                node[key] = Array.isArray(value) ? this.#convertList(value) : this.#convertScalar(value);
            } else if (LIST_KEYS.has(key) && Array.isArray(value)) {
                node[key] = this.#convertList(value);
            } else if (key === "value" && parentKey === "traits" && Array.isArray(value)) {
                // The trait list of an actor or item
                node[key] = this.#convertList(value);
            } else if (key === "value" && this.#isConvertibleAlterationValue(node)) {
                node[key] = this.#convertAlterationValue(value);
            } else {
                node[key] = this.#convertNode(value, key);
            }
        }

        // A `ChoiceSet` choice pairs a value with its own label, which must follow the value to stay truthful
        if ("value" in node && "label" in node) {
            const converted = this.#convertScalar(node.value);
            if (converted !== node.value) {
                node.value = converted;
                node.label = this.#convertLabel(node.label);
            }
        }

        return node;
    }

    /** Whether an object's `type` property holds a damage type rather than some other discriminator. */
    #isDamageTypeContext(node: Record<string, unknown>): boolean {
        // Spell damage partials carry a formula; weapon persistent damage carries die faces
        if ("formula" in node || "faces" in node) return true;
        return typeof node.key === "string" && IWR_RULE_KEYS.has(node.key);
    }

    /** Whether an alteration-style rule element's `value` holds a damage type or trait. */
    #isConvertibleAlterationValue(node: Record<string, unknown>): boolean {
        if (typeof node.property === "string" && ALTERATION_PROPERTIES.has(node.property)) return true;
        return typeof node.path === "string" && AE_LIKE_PATHS.test(node.path);
    }

    /**
     * Convert the `value` of an alteration rule element, which may be a bare damage type, a list of traits, or—for the
     * `ActiveEffectLike` elements that add IWR entries—an object naming the type it adds.
     */
    #convertAlterationValue(value: unknown): unknown {
        if (Array.isArray(value)) return this.#convertList(value);
        if (R.isPlainObject(value)) {
            const converted = this.#convertNode(value);
            if (R.isPlainObject(converted) && "type" in converted) {
                converted.type = this.#convertScalar(converted.type);
            }
            return converted;
        }
        return this.#convertScalar(value);
    }

    /** Convert an IWR entry, including its exceptions and doubleVs lists. */
    #convertIWREntry(entry: unknown): unknown {
        if (!R.isPlainObject(entry)) return this.#convertScalar(entry);
        const converted = fu.deepClone(entry);
        converted.type = this.#convertScalar(converted.type);
        for (const key of ["exceptions", "doubleVs"]) {
            if (Array.isArray(converted[key])) converted[key] = this.#convertList(converted[key]);
        }
        return converted;
    }

    /** Convert a value if it is exactly the source damage type. */
    #convertScalar(value: unknown): unknown {
        if (value === this.from) {
            this.changes += 1;
            return this.to;
        }
        return typeof value === "string" ? this.#convertRollOption(value) : value;
    }

    /**
     * Convert the entries of a list of damage types, traits, or IWR exceptions. A converted entry that collides with
     * one already in the list—`["fire", "acid"]` becoming `["acid", "acid"]`—is dropped rather than duplicated.
     */
    #convertList(values: unknown[]): unknown[] {
        const converted = values.map((value) =>
            R.isPlainObject(value) ? this.#convertNode(value) : this.#convertScalar(value),
        );
        const seen: Set<unknown> = new Set();
        return converted.filter((value) => {
            if (typeof value !== "string") return true;
            if (seen.has(value)) return false;
            seen.add(value);
            return true;
        });
    }

    /**
     * Convert a roll option whose final segment names the source damage type. The preceding segment must identify the
     * final one as a damage type or trait, which leaves options that merely end in a similar word untouched.
     */
    #convertRollOption(option: string): string {
        if (!option.includes(":") || !option.endsWith(`:${this.from}`)) return option;
        const segments = option.split(":");
        const qualifier = segments.at(-2) ?? "";
        const prefix = segments.slice(0, -1).join(":");
        if (!OPTION_QUALIFIERS.has(qualifier) && !this.#choiceSetPrefixes.has(prefix)) {
            return option;
        }
        this.changes += 1;
        return `${prefix}:${this.to}`;
    }

    /** Convert a localization key naming the source damage type, leaving anything else as it is. */
    #convertLabel(label: unknown): unknown {
        if (typeof label !== "string") return label;
        const replacements: Record<string, string> = {
            [`PF2E.Trait${capitalize(this.from)}`]: `PF2E.Trait${capitalize(this.to)}`,
            [`PF2E.Damage.RollFlavor.${this.from}`]: `PF2E.Damage.RollFlavor.${this.to}`,
            [`PF2E.DamageType${capitalize(this.from)}`]: `PF2E.DamageType${capitalize(this.to)}`,
        };
        return replacements[label] ?? label;
    }
}

/** Reduce a converted clone to flattened update paths, emitting arrays and scalars whole. */
function flattenDiff(original: unknown, updated: unknown, path: string, out: Record<string, unknown>): void {
    if (R.isPlainObject(original) && R.isPlainObject(updated)) {
        for (const key of Object.keys(updated)) {
            flattenDiff(original[key], updated[key], `${path}.${key}`, out);
        }
    } else if (!R.isDeepEqual(original, updated)) {
        out[path] = updated;
    }
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export { DamageTypeConverter };
export type { DamageTypeConversion, SourceConversion };
