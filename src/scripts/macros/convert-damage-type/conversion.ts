import type { DamageType } from "@system/damage/types.ts";
import { sluggify } from "@util";
import * as R from "remeda";

/** A request to swap one damage type for another throughout a document's data. */
interface DamageTypeConversion {
    from: DamageType;
    to: DamageType;
    /** Whether to rewrite names and prose as well as mechanical data, defaulting to true */
    prose?: boolean;
}

/** Update data for a single document, along with a tally of the values it changes. */
interface SourceConversion {
    /** Flattened update data suitable for passing to `Document#update` */
    updates: Record<string, unknown>;
    /** The number of individual values changed */
    changes: number;
    /** Whether this document was recognized as referencing the damage type, and so had its prose rewritten */
    proseRewritten: boolean;
}

/** A prose replacement: the word to substitute, and whether it may carry a compound's remainder along with it. */
interface ProseTerm {
    replacement: string;
    compound: boolean;
}

/** Rule element keys whose `type` property holds IWR types rather than a discriminator of some other kind. */
const IWR_RULE_KEYS: Set<string> = new Set(["Immunity", "Resistance", "Weakness"]);

/**
 * Second-to-last segments of a roll option after which a *document's own slug* appears rather than a damage type.
 *
 * A roll option whose final segment is exactly the damage type is taken to reference that type: that covers the
 * built-in forms (`damage:type:fire`, `item:trait:fire`, `self:condition:persistent-damage:fire`) and equally the
 * open-ended ones a `ChoiceSet` mints from its own roll option (`kinetic-gate:fire`, `elemental-assault:fire`), which
 * no fixed list could enumerate. These qualifiers are the exception, so that a document actually named "Fire" is not
 * mistaken for the damage type. Options that merely end in a similar *word* — `spell:faerie-fire`,
 * `feature:fire-lung` — never match in the first place, because the damage type must be a whole segment.
 */
const SLUG_QUALIFIERS: Set<string> = new Set([
    "action",
    "ancestry",
    "armor",
    "background",
    "class",
    "condition",
    "consumable",
    "deity",
    "effect",
    "equipment",
    "feat",
    "feature",
    "heritage",
    "item",
    "shield",
    "slug",
    "spell",
    "weapon",
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

/** Prose-bearing paths within an item's system data. */
const ITEM_TEXT_PATHS = ["description.value", "description.gm"];

/** Prose-bearing paths within an actor's system data, spanning NPCs, hazards, and player characters. */
const ACTOR_TEXT_PATHS = [
    "details.blurb",
    "details.description",
    "details.disable",
    "details.privateNotes",
    "details.publicNotes",
    "details.reset",
    "details.routine",
    "details.biography.anathema",
    "details.biography.appearance",
    "details.biography.attitude",
    "details.biography.backstory",
    "details.biography.beliefs",
    "details.biography.campaignNotes",
    "details.biography.catchphrases",
    "details.biography.dislikes",
    "details.biography.edicts",
    "details.biography.likes",
];

/**
 * The words used for each damage type in prose. Nouns and synonyms are replaced with the target type's noun, and
 * adjectives with its adjective, so that "a fiery blast of flame" becomes "an acidic blast of acid".
 *
 * A word that merely *begins* with the type's name is a compound of it—"Fireball", "Fireproof"—and is converted along
 * with its remainder, except for the words listed in `compoundExceptions`, which do not refer to the element at all.
 * Words that merely *end* with it ("bonfire", "backfire", "wildfire") are never converted, since replacing the tail of
 * such a word almost always produces nonsense.
 */
interface DamageTypeProse {
    adjective: string;
    synonyms: string[];
    /** Vivid adjectives for the type beyond the plain one: "Blazing Bolt" is as fiery as "Fire Ray" */
    descriptors?: string[];
    /** Verb forms, mapped across types by key so that "burns" becomes "corrodes" rather than "corrode" */
    verbs?: Record<string, string>;
    /** Words for a large mass of the type */
    mass?: string[];
    compoundExceptions?: string[];
}

const DAMAGE_TYPE_PROSE: Partial<Record<DamageType, DamageTypeProse>> = {
    acid: {
        adjective: "acidic",
        synonyms: [],
        descriptors: ["corrosive", "caustic"],
        verbs: { base: "corrode", third: "corrodes", past: "corroded", pastAlt: "corroded", gerund: "corroding" },
        mass: ["deluge"],
    },
    cold: {
        adjective: "freezing",
        synonyms: ["ice"],
        descriptors: ["frigid", "glacial"],
        verbs: { base: "freeze", third: "freezes", past: "froze", pastAlt: "frozen", gerund: "freezing" },
        mass: ["blizzard"],
    },
    electricity: {
        adjective: "electrical",
        synonyms: ["lightning"],
        descriptors: ["crackling", "arcing"],
        verbs: { base: "shock", third: "shocks", past: "shocked", pastAlt: "shocked", gerund: "shocking" },
        mass: ["storm"],
    },
    fire: {
        adjective: "fiery",
        synonyms: ["flame", "flames"],
        descriptors: ["blazing", "flaming", "scorching", "searing", "smoldering", "smouldering"],
        verbs: { base: "burn", third: "burns", past: "burned", pastAlt: "burnt", gerund: "burning" },
        mass: ["inferno", "conflagration", "blaze"],
        compoundExceptions: [
            "firearm",
            "firearms",
            "fired",
            "fireflies",
            "firefly",
            "fireplace",
            "fireplaces",
            "firer",
            "fires",
            "firewood",
            "firework",
            "fireworks",
        ],
    },
    mental: { adjective: "mental", synonyms: [] },
    poison: {
        adjective: "poisonous",
        synonyms: ["venom"],
        descriptors: ["toxic", "venomous"],
        verbs: { base: "poison", third: "poisons", past: "poisoned", pastAlt: "poisoned", gerund: "poisoning" },
    },
    sonic: { adjective: "sonic", synonyms: ["sound"], descriptors: ["deafening", "thunderous"] },
    vitality: { adjective: "vital", synonyms: [] },
    void: { adjective: "void", synonyms: [] },
};

/**
 * Words whose verb sense means something other than the damage type, and so must be left alone when used that way.
 *
 * "You fire a ray of flame" is an instruction to shoot, and rewriting it produces nonsense. This is deliberately not a
 * list of every word that can be a verb: to burn *is* what fire does, so "it burns them" should indeed become "it
 * corrodes them" — those forms are paired up in each type's `verbs` instead.
 */
const UNRELATED_VERB_SENSE: Set<string> = new Set(["fire", "sound"]);

/** Words that mark what precedes a verb: a subject or an auxiliary. */
const VERB_SUBJECTS: Set<string> = new Set([
    "can",
    "cannot",
    "could",
    "he",
    "i",
    "it",
    "may",
    "might",
    "must",
    "shall",
    "she",
    "should",
    "that",
    "they",
    "to",
    "we",
    "which",
    "who",
    "will",
    "would",
    "you",
]);

/** Words that mark what follows a transitive verb: the start of its object. */
const VERB_OBJECTS: Set<string> = new Set([
    "a",
    "additional",
    "again",
    "an",
    "another",
    "at",
    "back",
    "her",
    "his",
    "into",
    "it",
    "its",
    "my",
    "off",
    "one",
    "our",
    "that",
    "the",
    "their",
    "them",
    "these",
    "this",
    "those",
    "three",
    "two",
    "upon",
    "your",
]);

/**
 * Segments of description text that must not be treated as prose: HTML tags, inline rolls, and enricher expressions.
 * Group 2 is an inline roll, group 4 the enricher's name, group 5 its payload, and group 6 its optional label.
 */
const TEXT_SEGMENTS = /(<[^>]*>)|(\[\[[\s\S]*?\]\])|(@([A-Za-z]+)\[((?:[^[\]]|\[[^[\]]*\])*)\](?:\{([^}]*)\})?)/g;

/** A bracketed damage flavor expression such as `[fire]` or `[persistent,fire]`. */
const DAMAGE_FLAVOR = /\[([a-z][a-z-]*(?:,[a-z][a-z-]*)*)\]/g;

/**
 * Rewrites references to one damage type into another within document source data.
 *
 * Mechanical data—damage types, traits, IWR entries, persistent damage, inline damage expressions, and the rule
 * elements that manipulate them—is always converted. Names and prose are only rewritten for documents that have at
 * least one such mechanical reference, so an entry that merely contains the word—*Faerie Fire*, say, or a *Fire Opal*—
 * is left entirely alone.
 */
class DamageTypeConverter {
    readonly from: DamageType;

    readonly to: DamageType;

    /** Whether names and prose are rewritten alongside mechanical data */
    readonly prose: boolean;

    /** A tally of individual values changed by the most recent conversion */
    changes = 0;

    /** Whole words to replace in prose, mapped from the lowercased word to its replacement */
    readonly #proseTerms: Map<string, ProseTerm>;

    /** A pattern matching any of the prose terms as a whole word or as the start of a compound */
    readonly #prosePattern: RegExp | null;

    /** Words beginning with the source type's name that do not refer to it, and so are left alone */
    readonly #compoundExceptions: Set<string>;

    constructor({ from, to, prose = true }: DamageTypeConversion) {
        this.from = from;
        this.to = to;
        this.prose = prose;
        this.#proseTerms = buildProseTerms(from, to);
        this.#compoundExceptions = new Set(DAMAGE_TYPE_PROSE[from]?.compoundExceptions ?? []);
        // Longest first, so that "fiery" is preferred over "fire" where both could match
        const words = Array.from(this.#proseTerms.keys()).sort((a, b) => b.length - a.length);
        // Any preceding indefinite article is captured so it can be corrected when the replacement's initial sound
        // differs ("a fiery blast" must become "an acidic blast"), and any trailing letters so that a compound such as
        // "Fireball" keeps its remainder.
        this.#prosePattern =
            words.length > 0 ? new RegExp(`\\b(?:(an?)(\\s+))?(${words.join("|")})([a-z]*)\\b`, "gi") : null;
    }

    /** Convert an actor's source data, excluding its embedded items. */
    convertActorSource(source: object): SourceConversion {
        this.#reset();
        const updates: Record<string, unknown> = {};
        if (!R.isPlainObject(source)) return { updates, changes: 0, proseRewritten: false };
        const system = source.system;
        if (!R.isPlainObject(system)) return { updates, changes: 0, proseRewritten: false };

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

        // Inline damage expressions in an actor's notes are mechanical references in their own right
        let texts = this.#convertTextPaths(system, ACTOR_TEXT_PATHS, { prose: false });
        const mechanicalChanges = this.changes;

        const proseRewritten = this.prose && mechanicalChanges > 0;
        if (proseRewritten) {
            texts = this.#convertTextPaths(system, ACTOR_TEXT_PATHS, { prose: true }, texts);
            this.#convertName(source, updates);
            const prototypeToken = source.prototypeToken;
            if (R.isPlainObject(prototypeToken) && typeof prototypeToken.name === "string") {
                const converted = this.#convertProse(prototypeToken.name);
                if (converted !== prototypeToken.name) {
                    updates["prototypeToken.name"] = converted;
                    this.changes += 1;
                }
            }
        }

        for (const [path, value] of texts) {
            updates[`system.${path}`] = value;
        }

        return { updates, changes: this.changes, proseRewritten };
    }

    /** Convert an item's source data, including its rule elements. */
    convertItemSource(source: object): SourceConversion {
        this.#reset();
        const updates: Record<string, unknown> = {};
        if (!R.isPlainObject(source)) return { updates, changes: 0, proseRewritten: false };
        const system = source.system;
        if (!R.isPlainObject(system)) return { updates, changes: 0, proseRewritten: false };

        const converted = this.#convertNode(fu.deepClone(system));
        if (!R.isPlainObject(converted)) return { updates, changes: 0, proseRewritten: false };

        let texts = this.#convertTextPaths(converted, ITEM_TEXT_PATHS, { prose: false });
        const mechanicalChanges = this.changes;

        const proseRewritten = this.prose && mechanicalChanges > 0;
        if (proseRewritten) {
            texts = this.#convertTextPaths(converted, ITEM_TEXT_PATHS, { prose: true }, texts);
            const renamed = this.#convertName(source, updates);
            // Roll options fall back to a slug derived from the name, so pin the old slug to keep predicates working
            if (renamed && !system.slug && typeof source.name === "string") {
                converted.slug = sluggify(source.name);
            }
        }

        for (const [path, value] of texts) {
            setPath(converted, path, value);
        }
        flattenDiff(system, converted, "system", updates);

        return { updates, changes: this.changes, proseRewritten };
    }

    /** Rewrite the words of a bare name, such as that of a placed token, without touching mechanical data. */
    convertPlainName(name: string): string {
        return this.prose ? this.#convertProse(name) : name;
    }

    /** Rewrite a document's name, recording the update. Returns whether the name changed. */
    #convertName(source: Record<string, unknown>, updates: Record<string, unknown>): boolean {
        if (typeof source.name !== "string") return false;
        const converted = this.#convertProse(source.name);
        if (converted === source.name) return false;
        updates.name = converted;
        this.changes += 1;
        return true;
    }

    /**
     * Convert the text at each of the given paths, returning the converted values keyed by path.
     *
     * Results from an earlier pass are threaded through `current` so that the prose pass builds on the mechanical one
     * rather than starting over from the original text, which would convert—and count—inline damage twice.
     */
    #convertTextPaths(
        data: Record<string, unknown>,
        paths: string[],
        { prose }: { prose: boolean },
        current: Map<string, unknown> = new Map(),
    ): Map<string, unknown> {
        const converted = new Map(current);
        for (const path of paths) {
            const value = converted.has(path) ? converted.get(path) : getPath(data, path);
            const result =
                typeof value === "string"
                    ? this.#transformText(value, { prose })
                    : Array.isArray(value)
                      ? value.map((entry) =>
                            typeof entry === "string" ? this.#transformText(entry, { prose }) : entry,
                        )
                      : null;
            if (result === null || R.isDeepEqual(value, result)) continue;

            // Prose rewrites are counted per field; inline damage expressions count themselves as they are converted
            if (prose) this.changes += 1;
            converted.set(path, result);
        }
        return converted;
    }

    /**
     * Transform description text, converting inline damage expressions and—when rewriting prose—the words naming the
     * damage type. HTML tags, inline rolls, and enricher payloads are left structurally intact, and `@UUID` links keep
     * both their target and their label, since the documents they point at are not themselves renamed.
     */
    #transformText(text: string, { prose }: { prose: boolean }): string {
        let result = "";
        let lastIndex = 0;
        TEXT_SEGMENTS.lastIndex = 0;

        for (let match = TEXT_SEGMENTS.exec(text); match; match = TEXT_SEGMENTS.exec(text)) {
            const [whole, htmlTag, inlineRoll, enricher, name, payload, label] = match;
            result += this.#convertPlainText(text.slice(lastIndex, match.index), { prose });
            lastIndex = match.index + whole.length;

            if (htmlTag) {
                result += htmlTag;
            } else if (inlineRoll) {
                result += this.#convertDamageFlavor(inlineRoll);
            } else if (enricher && name === "UUID") {
                result += enricher;
            } else if (enricher) {
                const labelText = label === undefined ? "" : `{${this.#convertPlainText(label, { prose })}}`;
                result += `@${name}[${this.#convertDamageFlavor(payload)}]${labelText}`;
            }
        }

        return result + this.#convertPlainText(text.slice(lastIndex), { prose });
    }

    /** Convert a stretch of ordinary text, outside any tag or enricher. */
    #convertPlainText(text: string, { prose }: { prose: boolean }): string {
        const converted = this.#convertDamageFlavor(text);
        return prose ? this.#convertProse(converted) : converted;
    }

    /** Convert the damage types named in bracketed flavor expressions such as `2d6[fire]` or `[persistent,fire]`. */
    #convertDamageFlavor(text: string): string {
        if (!text.includes(this.from)) return text;
        return text.replace(DAMAGE_FLAVOR, (whole, contents: string) => {
            const parts = contents.split(",");
            if (!parts.includes(this.from)) return whole;
            this.changes += 1;
            const replaced = parts.map((part) => (part === this.from ? this.to : part));
            return `[${Array.from(new Set(replaced)).join(",")}]`;
        });
    }

    /** Replace the words naming the source damage type, preserving the capitalization of each occurrence. */
    #convertProse(text: string): string {
        if (!this.#prosePattern) return text;
        this.#prosePattern.lastIndex = 0;
        return text.replace(
            this.#prosePattern,
            (
                whole: string,
                article: string | undefined,
                space: string,
                word: string,
                remainder: string,
                offset: number,
                full: string,
            ) => {
                const term = this.#proseTerms.get(word.toLowerCase());
                if (!term) return whole;
                if (
                    remainder &&
                    (!term.compound || this.#compoundExceptions.has(`${word}${remainder}`.toLowerCase()))
                ) {
                    return whole;
                }
                if (!remainder && isVerbUsage(word, offset + whole.length - word.length, full)) return whole;

                const converted = `${matchCase(word, term.replacement)}${remainder}`;
                if (!article) return converted;
                const corrected = /^[aeiou]/i.test(converted) ? "an" : "a";
                return `${matchCase(article, corrected)}${space}${converted}`;
            },
        );
    }

    #reset(): void {
        this.changes = 0;
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
                node.label = this.#convertChoiceLabel(node.label);
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
     * Convert a roll option whose final segment names the source damage type. Requiring a whole segment leaves options
     * that merely end in a similar word untouched, and a preceding qualifier that introduces a document's own slug
     * rules the option out entirely.
     */
    #convertRollOption(option: string): string {
        if (!option.includes(":") || !option.endsWith(`:${this.from}`)) return option;
        const segments = option.split(":");
        if (SLUG_QUALIFIERS.has(segments.at(-2) ?? "")) return option;
        this.changes += 1;
        return `${segments.slice(0, -1).join(":")}:${this.to}`;
    }

    /** Convert a `ChoiceSet` label, whether it is a localization key or literal text. */
    #convertChoiceLabel(label: unknown): unknown {
        if (typeof label !== "string") return label;
        const keys: Record<string, string> = {
            [`PF2E.Trait${capitalize(this.from)}`]: `PF2E.Trait${capitalize(this.to)}`,
            [`PF2E.Damage.RollFlavor.${this.from}`]: `PF2E.Damage.RollFlavor.${this.to}`,
            [`PF2E.DamageType${capitalize(this.from)}`]: `PF2E.DamageType${capitalize(this.to)}`,
        };
        return keys[label] ?? this.#convertProse(label);
    }
}

/**
 * Build the prose replacements for a conversion, pairing each word of the source type with the word playing the same
 * role for the target: nouns to the noun, adjectives to the adjective, each verb form to the matching form.
 *
 * Only the type's own nouns extend into compounds. "Fireball" is a ball of fire, but treating "burn" that way would
 * turn "burner" into "corrodeer", so every other word is matched whole.
 */
function buildProseTerms(from: DamageType, to: DamageType): Map<string, ProseTerm> {
    const fallback = { adjective: "", synonyms: [] };
    const fromProse = DAMAGE_TYPE_PROSE[from] ?? { ...fallback, adjective: from };
    const toProse = DAMAGE_TYPE_PROSE[to] ?? { ...fallback, adjective: to };
    const terms = new Map<string, ProseTerm>([[from, { replacement: to, compound: true }]]);

    for (const synonym of fromProse.synonyms) {
        terms.set(synonym, { replacement: to, compound: true });
    }
    if (fromProse.adjective !== from) {
        terms.set(fromProse.adjective, { replacement: toProse.adjective, compound: false });
    }
    // A vivid adjective falls back to the plain one when the target type has none of its own
    const descriptor = toProse.descriptors?.[0] ?? toProse.adjective;
    for (const word of fromProse.descriptors ?? []) {
        terms.set(word, { replacement: descriptor, compound: false });
    }
    // Verb forms pair by key, so a third-person form stays third-person
    for (const [role, word] of Object.entries(fromProse.verbs ?? {})) {
        const replacement = toProse.verbs?.[role];
        if (replacement) terms.set(word, { replacement, compound: false });
    }
    for (const word of fromProse.mass ?? []) {
        terms.set(word, { replacement: toProse.mass?.[0] ?? to, compound: false });
    }

    return terms;
}

/**
 * Whether an occurrence of a noun-or-verb word is being used as a verb, and so must be left alone.
 *
 * Both halves have to agree: a subject or auxiliary before it *and* the start of an object after it. "You fire a ray"
 * satisfies both and is an instruction to shoot; "grants you fire resistance" satisfies only the first, and is the
 * damage type.
 */
function isVerbUsage(word: string, offset: number, text: string): boolean {
    if (!UNRELATED_VERB_SENSE.has(word.toLowerCase())) return false;
    const wordAt = (fragment: string, fromEnd: boolean): string => {
        const words = fragment.split(/[^A-Za-z']+/).filter(Boolean);
        return (fromEnd ? words.at(-1) : words[0])?.toLowerCase() ?? "";
    };
    // An exclamation makes it an order — "Ready, Aim, Fire!" — with no subject to look for
    if (text.slice(offset + word.length).startsWith("!")) return true;

    const before = wordAt(text.slice(Math.max(0, offset - 40), offset), true);
    const after = wordAt(text.slice(offset + word.length, offset + word.length + 40), false);
    return VERB_SUBJECTS.has(before) && VERB_OBJECTS.has(after);
}

/** Apply the capitalization of an original word to its replacement. */
function matchCase(original: string, replacement: string): string {
    if (original.length > 1 && original === original.toUpperCase()) return replacement.toUpperCase();
    if (original[0] === original[0]?.toUpperCase()) return capitalize(replacement);
    return replacement;
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

function getPath(data: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce<unknown>((node, key) => (R.isPlainObject(node) ? node[key] : undefined), data);
}

function setPath(data: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split(".");
    const last = keys.pop();
    if (!last) return;
    const parent = keys.reduce<unknown>((node, key) => (R.isPlainObject(node) ? node[key] : undefined), data);
    if (R.isPlainObject(parent)) parent[last] = value;
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export { DamageTypeConverter };
export type { DamageTypeConversion, SourceConversion };
