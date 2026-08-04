/**
 * Convert one damage type into another throughout the world — standalone Foundry macro.
 *
 * Paste the whole file into a Script macro and run it as GM. It needs no imports and no modified system build: it is a
 * self-contained port of `src/scripts/macros/convert-damage-type/`, kept in step with that source by
 * `tests/module/convert-damage-type-standalone.test.ts`.
 *
 * Mechanical data is always converted: damage types, traits, immunities/weaknesses/resistances, persistent damage,
 * inline damage expressions such as `@Damage[2d6[fire]]`, and the rule elements driving all of them. Names, prose, and
 * placed-token names are rewritten too, but only for documents carrying at least one mechanical reference, so entries
 * that merely contain the word — Faerie Fire, a Fire Opal — are left alone entirely.
 *
 * THIS CANNOT BE UNDONE. Back up your world first.
 */

/* -------------------------------------------- Settings -------------------------------------------- */

/** The damage type to replace. */
const FROM = "fire";
/** The damage type to replace it with. */
const TO = "acid";
/** Set to false to convert mechanical data only, leaving names and prose as they are. */
const PROSE = true;
/** Set to true to report what would change without writing anything. */
const DRY_RUN = false;

/* ------------------------------------------- Conversion ------------------------------------------- */

/** Rule element keys whose `type` property holds IWR types rather than a discriminator of some other kind. */
const IWR_RULE_KEYS = new Set(["Immunity", "Resistance", "Weakness"]);

/**
 * Second-to-last segments of a roll option after which a bare damage type or trait name may appear. Requiring one of
 * these keeps unrelated options — `spell:faerie-fire`, `feature:fire-lung` — from being rewritten: only a final segment
 * that is exactly the damage type, qualified by one of these, is a reference to the type itself.
 */
const OPTION_QUALIFIERS = new Set([
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
const ALTERATION_PROPERTIES = new Set(["damage-type", "traits", "weapon-traits"]);

/** Object keys holding an array of damage types, traits, or IWR exceptions. */
const LIST_KEYS = new Set(["add", "choices", "deactivatedBy", "doubleVs", "exceptions", "remove", "traits"]);

/** `path` values of `ActiveEffectLike` rule elements whose `value` holds a damage type or trait. */
const AE_LIKE_PATHS = /\.(?:immunities|weaknesses|resistances|traits\.value)$/;

/** Actor attribute paths holding IWR entries. */
const IWR_ATTRIBUTES = ["immunities", "weaknesses", "resistances"];

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
 * A word that merely *begins* with the type's name is a compound of it — "Fireball", "Fireproof" — and is converted
 * along with its remainder, except for the words listed in `compoundExceptions`, which do not refer to the element at
 * all. Words that merely *end* with it ("bonfire", "backfire", "wildfire") are never converted, since replacing the
 * tail of such a word almost always produces nonsense.
 */
const DAMAGE_TYPE_PROSE = {
    acid: { adjective: "acidic", synonyms: [] },
    cold: { adjective: "freezing", synonyms: ["ice"] },
    electricity: { adjective: "electrical", synonyms: ["lightning"] },
    fire: {
        adjective: "fiery",
        synonyms: ["flame", "flames"],
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
    poison: { adjective: "poisonous", synonyms: ["venom"] },
    sonic: { adjective: "sonic", synonyms: ["sound"] },
    vitality: { adjective: "vital", synonyms: [] },
    void: { adjective: "void", synonyms: [] },
};

/**
 * Segments of description text that must not be treated as prose: HTML tags, inline rolls, and enricher expressions.
 * Group 2 is an inline roll, group 4 the enricher's name, group 5 its payload, and group 6 its optional label.
 */
const TEXT_SEGMENTS = /(<[^>]*>)|(\[\[[\s\S]*?\]\])|(@([A-Za-z]+)\[((?:[^[\]]|\[[^[\]]*\])*)\](?:\{([^}]*)\})?)/g;

/** A bracketed damage flavor expression such as `[fire]` or `[persistent,fire]`. */
const DAMAGE_FLAVOR = /\[([a-z][a-z-]*(?:,[a-z][a-z-]*)*)\]/g;

/** Rewrites references to one damage type into another within document source data. */
class DamageTypeConverter {
    /** A tally of individual values changed by the most recent conversion */
    changes = 0;

    /** Whole words to replace in prose, mapped from the lowercased word to its replacement */
    #proseTerms;

    /** A pattern matching any of the prose terms as a whole word or as the start of a compound */
    #prosePattern;

    /** Words beginning with the source type's name that do not refer to it, and so are left alone */
    #compoundExceptions;

    /**
     * Roll option prefixes set by `ChoiceSet` rule elements offering the source damage type: options built from them
     * (`elemental-assault:fire`) must follow the converted selection even though their prefix is item-specific.
     */
    #choiceSetPrefixes = new Set();

    constructor({ from, to, prose = true }) {
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
    convertActorSource(source) {
        this.#reset();
        const updates = {};
        if (!isObject(source)) return { updates, changes: 0, proseRewritten: false };
        const system = source.system;
        if (!isObject(system)) return { updates, changes: 0, proseRewritten: false };

        // IWR entries, each of which may carry exceptions and doubleVs lists
        const attributes = system.attributes;
        if (isObject(attributes)) {
            for (const attribute of IWR_ATTRIBUTES) {
                const entries = attributes[attribute];
                if (!Array.isArray(entries)) continue;
                const converted = entries.map((entry) => this.#convertIWREntry(entry));
                if (!isDeepEqual(entries, converted)) {
                    updates[`system.attributes.${attribute}`] = converted;
                }
            }
        }

        // Actor traits
        const traits = system.traits;
        if (isObject(traits) && Array.isArray(traits.value)) {
            const converted = this.#convertList(traits.value);
            if (!isDeepEqual(traits.value, converted)) updates["system.traits.value"] = converted;
        }

        // Inline damage expressions in an actor's notes are mechanical references in their own right
        let texts = this.#convertTextPaths(system, ACTOR_TEXT_PATHS, { prose: false });
        const mechanicalChanges = this.changes;

        const proseRewritten = this.prose && mechanicalChanges > 0;
        if (proseRewritten) {
            texts = this.#convertTextPaths(system, ACTOR_TEXT_PATHS, { prose: true }, texts);
            this.#convertName(source, updates);
            const prototypeToken = source.prototypeToken;
            if (isObject(prototypeToken) && typeof prototypeToken.name === "string") {
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
    convertItemSource(source) {
        this.#reset();
        const updates = {};
        if (!isObject(source)) return { updates, changes: 0, proseRewritten: false };
        const system = source.system;
        if (!isObject(system)) return { updates, changes: 0, proseRewritten: false };

        this.#collectChoiceSetPrefixes(system.rules);
        const converted = this.#convertNode(foundry.utils.deepClone(system));
        if (!isObject(converted)) return { updates, changes: 0, proseRewritten: false };

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
    convertPlainName(name) {
        return this.prose ? this.#convertProse(name) : name;
    }

    /** Rewrite a document's name, recording the update. Returns whether the name changed. */
    #convertName(source, updates) {
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
     * rather than starting over from the original text, which would convert — and count — inline damage twice.
     */
    #convertTextPaths(data, paths, { prose }, current = new Map()) {
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
            if (result === null || isDeepEqual(value, result)) continue;

            // Prose rewrites are counted per field; inline damage expressions count themselves as they are converted
            if (prose) this.changes += 1;
            converted.set(path, result);
        }
        return converted;
    }

    /**
     * Transform description text, converting inline damage expressions and — when rewriting prose — the words naming
     * the damage type. HTML tags, inline rolls, and enricher payloads are left structurally intact, and `@UUID` links
     * keep both their target and their label, since the documents they point at are not themselves renamed.
     */
    #transformText(text, { prose }) {
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
    #convertPlainText(text, { prose }) {
        const converted = this.#convertDamageFlavor(text);
        return prose ? this.#convertProse(converted) : converted;
    }

    /** Convert the damage types named in bracketed flavor expressions such as `2d6[fire]` or `[persistent,fire]`. */
    #convertDamageFlavor(text) {
        if (!text.includes(this.from)) return text;
        return text.replace(DAMAGE_FLAVOR, (whole, contents) => {
            const parts = contents.split(",");
            if (!parts.includes(this.from)) return whole;
            this.changes += 1;
            const replaced = parts.map((part) => (part === this.from ? this.to : part));
            return `[${Array.from(new Set(replaced)).join(",")}]`;
        });
    }

    /** Replace the words naming the source damage type, preserving the capitalization of each occurrence. */
    #convertProse(text) {
        if (!this.#prosePattern) return text;
        this.#prosePattern.lastIndex = 0;
        return text.replace(this.#prosePattern, (whole, article, space, word, remainder) => {
            if (remainder && this.#compoundExceptions.has(`${word}${remainder}`.toLowerCase())) return whole;
            const replacement = this.#proseTerms.get(word.toLowerCase());
            if (!replacement) return whole;
            const converted = `${matchCase(word, replacement)}${remainder}`;
            if (!article) return converted;
            const corrected = /^[aeiou]/i.test(converted) ? "an" : "a";
            return `${matchCase(article, corrected)}${space}${converted}`;
        });
    }

    #reset() {
        this.changes = 0;
        this.#choiceSetPrefixes = new Set();
    }

    /**
     * Note the roll option prefixes of any `ChoiceSet` offering the source damage type, so that predicates testing the
     * resulting selection are converted alongside it.
     */
    #collectChoiceSetPrefixes(rules) {
        if (!Array.isArray(rules)) return;
        for (const rule of rules) {
            if (!isObject(rule) || rule.key !== "ChoiceSet") continue;
            if (typeof rule.rollOption !== "string" || rule.rollOption.length === 0) continue;
            const choices = rule.choices;
            if (!Array.isArray(choices)) continue;
            const offersSourceType = choices.some((choice) =>
                isObject(choice) ? choice.value === this.from : choice === this.from,
            );
            if (offersSourceType) this.#choiceSetPrefixes.add(rule.rollOption);
        }
    }

    /**
     * Recursively convert an arbitrary node of system data.
     * @param parentKey The key under which this node sits, needed to recognize trait lists at `traits.value`
     */
    #convertNode(node, parentKey = "") {
        if (Array.isArray(node)) return node.map((entry) => this.#convertNode(entry, parentKey));
        if (typeof node === "string") return this.#convertRollOption(node);
        if (!isObject(node)) return node;

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
    #isDamageTypeContext(node) {
        // Spell damage partials carry a formula; weapon persistent damage carries die faces
        if ("formula" in node || "faces" in node) return true;
        return typeof node.key === "string" && IWR_RULE_KEYS.has(node.key);
    }

    /** Whether an alteration-style rule element's `value` holds a damage type or trait. */
    #isConvertibleAlterationValue(node) {
        if (typeof node.property === "string" && ALTERATION_PROPERTIES.has(node.property)) return true;
        return typeof node.path === "string" && AE_LIKE_PATHS.test(node.path);
    }

    /**
     * Convert the `value` of an alteration rule element, which may be a bare damage type, a list of traits, or — for
     * the `ActiveEffectLike` elements that add IWR entries — an object naming the type it adds.
     */
    #convertAlterationValue(value) {
        if (Array.isArray(value)) return this.#convertList(value);
        if (isObject(value)) {
            const converted = this.#convertNode(value);
            if (isObject(converted) && "type" in converted) {
                converted.type = this.#convertScalar(converted.type);
            }
            return converted;
        }
        return this.#convertScalar(value);
    }

    /** Convert an IWR entry, including its exceptions and doubleVs lists. */
    #convertIWREntry(entry) {
        if (!isObject(entry)) return this.#convertScalar(entry);
        const converted = foundry.utils.deepClone(entry);
        converted.type = this.#convertScalar(converted.type);
        for (const key of ["exceptions", "doubleVs"]) {
            if (Array.isArray(converted[key])) converted[key] = this.#convertList(converted[key]);
        }
        return converted;
    }

    /** Convert a value if it is exactly the source damage type. */
    #convertScalar(value) {
        if (value === this.from) {
            this.changes += 1;
            return this.to;
        }
        return typeof value === "string" ? this.#convertRollOption(value) : value;
    }

    /**
     * Convert the entries of a list of damage types, traits, or IWR exceptions. A converted entry that collides with
     * one already in the list — `["fire", "acid"]` becoming `["acid", "acid"]` — is dropped rather than duplicated.
     */
    #convertList(values) {
        const converted = values.map((value) =>
            isObject(value) ? this.#convertNode(value) : this.#convertScalar(value),
        );
        const seen = new Set();
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
    #convertRollOption(option) {
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

    /** Convert a `ChoiceSet` label, whether it is a localization key or literal text. */
    #convertChoiceLabel(label) {
        if (typeof label !== "string") return label;
        const keys = {
            [`PF2E.Trait${capitalize(this.from)}`]: `PF2E.Trait${capitalize(this.to)}`,
            [`PF2E.Damage.RollFlavor.${this.from}`]: `PF2E.Damage.RollFlavor.${this.to}`,
            [`PF2E.DamageType${capitalize(this.from)}`]: `PF2E.DamageType${capitalize(this.to)}`,
        };
        return keys[label] ?? this.#convertProse(label);
    }
}

/* -------------------------------------------- Helpers --------------------------------------------- */

/** Build the prose replacements for a conversion: nouns and synonyms map to the noun, adjectives to the adjective. */
function buildProseTerms(from, to) {
    const fromProse = DAMAGE_TYPE_PROSE[from] ?? { adjective: from, synonyms: [] };
    const toProse = DAMAGE_TYPE_PROSE[to] ?? { adjective: to, synonyms: [] };
    const terms = new Map([[from, to]]);
    for (const synonym of fromProse.synonyms) {
        terms.set(synonym, to);
    }
    if (fromProse.adjective !== from) {
        terms.set(fromProse.adjective, toProse.adjective);
    }
    return terms;
}

/** Apply the capitalization of an original word to its replacement. */
function matchCase(original, replacement) {
    if (original.length > 1 && original === original.toUpperCase()) return replacement.toUpperCase();
    if (original[0] === original[0]?.toUpperCase()) return capitalize(replacement);
    return replacement;
}

/** Reduce a converted clone to flattened update paths, emitting arrays and scalars whole. */
function flattenDiff(original, updated, path, out) {
    if (isObject(original) && isObject(updated)) {
        for (const key of Object.keys(updated)) {
            flattenDiff(original[key], updated[key], `${path}.${key}`, out);
        }
    } else if (!isDeepEqual(original, updated)) {
        out[path] = updated;
    }
}

function getPath(data, path) {
    return path.split(".").reduce((node, key) => (isObject(node) ? node[key] : undefined), data);
}

function setPath(data, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    if (!last) return;
    const parent = keys.reduce((node, key) => (isObject(node) ? node[key] : undefined), data);
    if (isObject(parent)) parent[last] = value;
}

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Whether a value is a plain data object, as opposed to an array, null, or a primitive. */
function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDeepEqual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((entry, index) => isDeepEqual(entry, b[index]));
    }
    if (isObject(a) && isObject(b)) {
        const keys = Object.keys(a);
        if (keys.length !== Object.keys(b).length) return false;
        return keys.every((key) => key in b && isDeepEqual(a[key], b[key]));
    }
    return false;
}

/** The system's own sluggifier, with a faithful fallback for the rare world where it is unavailable. */
function sluggify(text) {
    const systemSluggify = game?.pf2e?.system?.sluggify;
    if (typeof systemSluggify === "function") return systemSluggify(text);
    if (typeof text !== "string") return "";
    if (text === "-") return text;
    return text
        .replace(
            /(\p{Lowercase_Letter})(\p{Uppercase_Letter}(?=^|$|[\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]))/gu,
            "$1-$2",
        )
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]/gu, " ")
        .trim()
        .replace(/[-\s]+/g, "-");
}

/* --------------------------------------------- Macro ---------------------------------------------- */

/** A progress bar when the running Foundry build offers one, and a no-op otherwise. */
function createProgress(label, max) {
    try {
        const notification = ui.notifications.info(label, { progress: true });
        let value = 0;
        return {
            advance: () => {
                value = Math.min(value + 1, max);
                notification.update({ message: label, pct: max === 0 ? 1 : value / max });
            },
            close: () => notification.update({ message: "", pct: 1 }),
        };
    } catch {
        return { advance: () => {}, close: () => {} };
    }
}

/** The localized name of a damage type, falling back to the type itself for an unlabeled one. */
function damageTypeLabel(type) {
    const path = CONFIG.PF2E?.damageTypes?.[type];
    return path ? game.i18n.localize(path) : type;
}

/** Scan every world document for references to the source damage type. */
async function buildPlan({ from, to, prose }) {
    const converter = new DamageTypeConverter({ from, to, prose });
    const plan = { actors: [], items: [], scenes: [], documents: 0, changes: 0 };
    /** Actors whose prose was rewritten, and whose placed tokens should therefore be renamed to match */
    const renamedActors = new Set();

    const convertItems = (items) => {
        const updates = [];
        for (const item of items) {
            const { updates: itemUpdates, changes } = converter.convertItemSource(item.toObject());
            if (changes === 0) continue;
            updates.push({ ...itemUpdates, _id: item.id });
            plan.documents += 1;
            plan.changes += changes;
        }
        return updates;
    };

    // World actors and their items
    for (const [index, actor] of game.actors.contents.entries()) {
        // Yield periodically so the interface keeps painting during a long scan
        if (index % 25 === 24) await new Promise((resolve) => setTimeout(resolve, 0));

        const { updates, changes, proseRewritten } = converter.convertActorSource(actor.toObject());
        const itemUpdates = convertItems(actor.items);
        if (changes > 0) {
            plan.documents += 1;
            plan.changes += changes;
        }
        if (proseRewritten) renamedActors.add(actor.id);
        if (changes > 0 || itemUpdates.length > 0) {
            plan.actors.push({ actor, update: changes > 0 ? updates : null, itemUpdates });
        }
    }

    // World items
    plan.items = convertItems(game.items);

    for (const scene of game.scenes) {
        const tokenUpdates = [];
        for (const token of scene.tokens) {
            // Placed tokens carry their own name, which must follow the actor they were made from
            if (token.actorId && renamedActors.has(token.actorId)) {
                const converted = converter.convertPlainName(token.name);
                if (converted !== token.name) {
                    tokenUpdates.push({ _id: token.id, name: converted });
                    plan.documents += 1;
                    plan.changes += 1;
                }
            }

            // Unlinked tokens: only their own delta data is converted, since everything else is inherited from the
            // base actor and will follow from that actor's own conversion.
            if (token.actorLink) continue;
            const actor = token.actor;
            const deltaSource = token.delta?._source;
            if (!actor || !deltaSource) continue;

            const { updates, changes } = converter.convertActorSource({ system: deltaSource.system ?? {} });
            const deltaItemIds = new Set((deltaSource.items ?? []).map((i) => i._id));
            const itemUpdates = convertItems(actor.items.filter((i) => deltaItemIds.has(i.id)));
            if (changes > 0) {
                plan.documents += 1;
                plan.changes += changes;
            }
            if (changes > 0 || itemUpdates.length > 0) {
                plan.actors.push({ actor, update: changes > 0 ? updates : null, itemUpdates });
            }
        }
        if (tokenUpdates.length > 0) plan.scenes.push({ scene, tokenUpdates });
    }

    return plan;
}

/** Write a conversion plan to the world, returning the number of documents that could not be updated. */
async function applyPlan(plan, label) {
    const progress = createProgress(label, plan.actors.length + plan.scenes.length + 1);
    let failures = 0;

    const attempt = async (description, update) => {
        try {
            await update();
        } catch (error) {
            console.warn(`Convert Damage Type | Failed to convert ${description}:`, error);
            failures += 1;
        }
    };

    // Token actors cannot be updated in bulk alongside world actors, so each actor is handled on its own
    for (const { actor, update, itemUpdates } of plan.actors) {
        if (update) {
            await attempt(actor.uuid, () => actor.update(update, { noHook: true }));
        }
        if (itemUpdates.length > 0) {
            await attempt(`items of ${actor.uuid}`, () =>
                actor.updateEmbeddedDocuments("Item", itemUpdates, { noHook: true }),
            );
        }
        progress.advance();
    }

    if (plan.items.length > 0) {
        await attempt("world items", () => game.items.documentClass.updateDocuments(plan.items, { noHook: true }));
    }

    for (const { scene, tokenUpdates } of plan.scenes) {
        await attempt(`tokens of ${scene.uuid}`, () =>
            scene.updateEmbeddedDocuments("Token", tokenUpdates, { noHook: true }),
        );
        progress.advance();
    }
    progress.close();

    return failures;
}

if (!game.user.isGM) {
    ui.notifications.error("Only a GM can convert damage types.");
    return;
}

const damageTypes = Object.keys(CONFIG.PF2E?.damageTypes ?? {});
for (const type of [FROM, TO]) {
    if (!damageTypes.includes(type)) {
        ui.notifications.error(`"${type}" is not a recognized damage type.`);
        return;
    }
}
if (FROM === TO) {
    ui.notifications.error("The damage type being replaced and its replacement must be different.");
    return;
}

const fromLabel = damageTypeLabel(FROM);
const toLabel = damageTypeLabel(TO);

ui.notifications.info(`Scanning the world for ${fromLabel} damage…`);
const plan = await buildPlan({ from: FROM, to: TO, prose: PROSE });

if (plan.changes === 0) {
    ui.notifications.info(`No ${fromLabel} damage was found in this world.`);
    return;
}

if (DRY_RUN) {
    ui.notifications.info(
        `${plan.changes} values across ${plan.documents} documents would change from ${fromLabel} to ${toLabel}.`,
    );
    console.log("Convert Damage Type | Dry run plan:", plan);
    return;
}

const proseNotice = PROSE
    ? `<p>Names, descriptions, and token names are rewritten as well, but only for documents that actually reference ${fromLabel}: an entry that merely contains the word is left alone.</p>`
    : "<p>Names and descriptions are left unchanged.</p>";

const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Convert Damage Type" },
    content:
        `<p>This will change <strong>${plan.changes}</strong> values across <strong>${plan.documents}</strong> documents ` +
        `from <strong>${fromLabel}</strong> to <strong>${toLabel}</strong>, including damage types, traits, immunities, ` +
        `weaknesses, resistances, and persistent damage.</p>${proseNotice}` +
        "<p>This cannot be undone: back up your world before continuing.</p>",
    yes: { default: false },
});
if (!confirmed) return;

const failures = await applyPlan(plan, `Converting ${fromLabel} to ${toLabel}…`);
ui.notifications.info(
    `Converted ${plan.changes} values across ${plan.documents} documents from ${fromLabel} to ${toLabel}.`,
);
if (failures > 0) {
    ui.notifications.warn(`${failures} documents could not be updated. See the console for details.`);
}
