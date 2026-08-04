/**
 * Recolor Automated Animations to match a converted damage type — standalone Foundry macro.
 *
 * A companion to convert-damage-type.js: once spells deal acid, their animations should stop looking like fire. Paste
 * the whole file into a Script macro and run it as GM.
 *
 * Requires Automated Animations and Sequencer. Every replacement is checked against the animation database registered
 * in *your* world, so it adapts to whichever JB2A modules you have (free, Patreon, or both) and never writes a path
 * that does not exist. Where a recolor is impossible the effect itself is swapped, and every swap is reported.
 *
 * Automated Animations stores a v5 flag on each item at `flags.autoanimations`, whose animation sections each carry a
 * `video` descriptor of `{ dbSection, menuType, animation, variant, color, enableCustom, customPath }`. Those five
 * database fields are the coordinates of a Sequencer entry that Automated Animations registers under the
 * `autoanimations` namespace, so a candidate can always be confirmed before it is written.
 *
 * START WITH DRY_RUN = true. It writes nothing and prints the full plan to the console (F12).
 */

/* -------------------------------------------- Settings -------------------------------------------- */

/** The damage type the animations currently depict. */
const FROM = "fire";
/** The damage type they should depict instead. */
const TO = "acid";
/**
 * Which compendium packs to include alongside the world's own items:
 * "none" | "world" | "all". System and module packs are replaced when that package updates.
 */
const PACKS = "all";
/** Report what would change without writing anything. Leave true until the plan looks right. */
const DRY_RUN = true;
/**
 * Only touch items whose own data now references the target damage type. Keeps genuinely fiery items — ones the damage
 * conversion deliberately left alone — looking like fire. Set false to recolor every fire animation in the world.
 */
const ONLY_CONVERTED_ITEMS = true;
/**
 * Also rewrite hand-entered custom file paths. These cannot be checked against the database, so they are reported but
 * left alone by default.
 */
const REWRITE_CUSTOM_PATHS = false;

/* ------------------------------------------ Damage types ------------------------------------------ */

/**
 * Colors to try for each damage type, best first. The names are matched case- and separator-insensitively against
 * whatever colors the database actually offers, so "GreenYellow", "green_yellow", and "greenyellow" all match.
 */
const TYPE_COLORS = {
    acid: ["green", "greenyellow", "yellowgreen", "darkgreen", "grengray", "teal", "bluegreen"],
    cold: ["blue", "lightblue", "bluewhite", "white", "teal"],
    electricity: ["blue", "purple", "yellow", "bluepurple"],
    fire: ["orange", "red", "orangered", "yellow", "orangeyellow"],
    force: ["purple", "blue", "pink"],
    mental: ["purple", "pink", "bluepurple"],
    poison: ["green", "greenyellow", "purple"],
    sonic: ["blue", "purple", "pink"],
    spirit: ["white", "yellow", "blue"],
    vitality: ["yellow", "white", "green"],
    void: ["purple", "dark_purple", "black", "darkred"],
};

/** Words in an animation's own name that mark it as depicting a given damage type. */
const TYPE_KEYWORDS = {
    acid: ["acid", "corrosive", "corrode", "slime", "ooze", "liquid", "splash"],
    cold: ["cold", "ice", "frost", "freeze", "snow", "chill"],
    electricity: ["electric", "lightning", "shock", "thunder", "spark"],
    fire: ["fire", "flame", "burn", "ignite", "inferno", "scorch", "blaze", "ember", "combust", "explosion"],
    poison: ["poison", "venom", "toxic"],
    sonic: ["sonic", "sound", "thunder", "scream"],
};

/* -------------------------------------------- Database -------------------------------------------- */

/** The Sequencer namespace Automated Animations registers its assembled JB2A database under. */
const AA_NAMESPACE = "autoanimations";

/** The sections of an Automated Animations flag that carry a `video` descriptor. */
const VIDEO_SECTIONS = ["primary", "secondary", "source", "target", "meleeSwitch"];

/** Reduce a color or animation name to a comparable form: "Green_Yellow" and "greenyellow" are the same color. */
function normalize(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

/**
 * The Sequencer path for a video descriptor, with any of its coordinates overridden.
 *
 * Entries do not all nest to the same depth — some animations have no variant — so empty coordinates are dropped
 * rather than producing a path with a hole in it.
 */
function videoPath(video, overrides = {}) {
    const coordinates = { ...video, ...overrides };
    const segments = [AA_NAMESPACE, coordinates.dbSection, coordinates.menuType, coordinates.animation];
    if (coordinates.variant) segments.push(coordinates.variant);
    if (coordinates.color) segments.push(coordinates.color);
    return segments.filter((segment) => segment !== undefined && segment !== null && segment !== "").join(".");
}

/** The path of a video descriptor up to but not including its color, which is the prefix its colors sit under. */
function colorPrefix(video) {
    return videoPath({ ...video, color: "" });
}

/** The path of a video descriptor up to but not including its animation, under which sibling animations sit. */
function animationPrefix(video) {
    return [AA_NAMESPACE, video.dbSection, video.menuType].filter(Boolean).join(".");
}

/**
 * Wrap the Sequencer database in the two questions this macro asks of it. Taking it as an argument rather than
 * reaching for the global keeps the planning logic testable.
 */
function createDatabase() {
    return {
        entryExists: (path) => {
            try {
                return !!Sequencer.Database.entryExists(path);
            } catch {
                return false;
            }
        },
        /** The names sitting directly beneath a path, e.g. the colors of one animation variant. */
        childrenOf: (prefix) => {
            try {
                const paths = Sequencer.Database.getPathsUnder(prefix);
                return Array.isArray(paths) ? paths : [];
            } catch {
                return [];
            }
        },
    };
}

/* --------------------------------------------- Planning ------------------------------------------- */

/** Whether a video descriptor currently depicts the source damage type, by its color or by its own name. */
function depictsType(video, type) {
    const colors = (TYPE_COLORS[type] ?? []).map(normalize);
    if (video.color && colors.includes(normalize(video.color))) return true;

    const keywords = TYPE_KEYWORDS[type] ?? [type];
    const name = `${video.animation ?? ""} ${video.variant ?? ""} ${video.menuType ?? ""}`.toLowerCase();
    // "explosion" alone is not fiery; it only counts alongside a fire-flavored color
    return keywords.some((keyword) => keyword !== "explosion" && name.includes(keyword));
}

/** Choose the best available name from a preference list, comparing loosely. */
function preferred(available, preferences) {
    const byNormalized = new Map(available.map((name) => [normalize(name), name]));
    for (const preference of preferences) {
        const match = byNormalized.get(normalize(preference));
        if (match) return match;
    }
    return null;
}

/**
 * Walk down from a prefix to a complete entry, preferring the given names at each level.
 *
 * Entries do not all nest to the same depth — an animation may or may not have a variant level above its colors — so
 * descending until there are no children left is the only reliable way to land on a real entry rather than guessing
 * that some fixed segment is the color.
 */
function resolveEntry(prefix, preferences, db) {
    let path = prefix;
    // Deeper than any Automated Animations entry nests, so a cyclic or malformed database cannot spin here
    for (let depth = 0; depth < 4; depth += 1) {
        const children = db.childrenOf(path);
        if (children.length === 0) break;
        path = `${path}.${preferred(children, preferences) ?? children[0]}`;
    }
    return db.entryExists(path) ? path : null;
}

/** The variant and color of a resolved path, given the prefix it was resolved from. */
function coordinatesOf(prefix, path) {
    const trailing = path.slice(prefix.length).split(".").filter(Boolean);
    if (trailing.length >= 2) return { variant: trailing[0], color: trailing[1] };
    if (trailing.length === 1) return { variant: "", color: trailing[0] };
    return { variant: "", color: "" };
}

/**
 * Plan the change for a single video descriptor.
 *
 * A recolor is tried first and is always preferred: it keeps the shape of the animation, so a fireball still reads as
 * a ball. Only when the animation has no suitable color is the effect itself swapped for one whose name matches the
 * target damage type, and such swaps are reported so they can be reviewed.
 */
function planVideo(video, db, { from, to }) {
    if (!video || typeof video !== "object") return null;
    if (video.enableCustom && video.customPath) {
        return depictsType({ ...video, animation: video.customPath }, from)
            ? { action: "custom", path: video.customPath }
            : null;
    }
    if (!video.dbSection || !video.menuType || !video.animation) return null;
    if (!depictsType(video, from)) return null;

    const before = videoPath(video);

    // A recolor: keep the animation, take the best color it offers for the target type
    const colors = db.childrenOf(colorPrefix(video));
    const color = preferred(colors, TYPE_COLORS[to] ?? [to]);
    if (color && normalize(color) !== normalize(video.color)) {
        const after = videoPath(video, { color });
        if (db.entryExists(after)) {
            return { action: "recolor", updates: { color }, before, after };
        }
    }

    // No usable color: swap the effect for one named after the target type, keeping the section and menu
    const siblings = db.childrenOf(animationPrefix(video));
    const keywords = TYPE_KEYWORDS[to] ?? [to];
    const candidates = siblings.filter((name) => {
        const normalized = name.toLowerCase();
        return keywords.some((keyword) => normalized.includes(keyword));
    });
    // Order by how early the matched keyword appears in the preference list, so "acid" beats "liquid"
    candidates.sort((a, b) => {
        const rank = (name) => {
            const index = keywords.findIndex((keyword) => name.toLowerCase().includes(keyword));
            return index === -1 ? keywords.length : index;
        };
        return rank(a) - rank(b) || a.localeCompare(b);
    });

    for (const animation of candidates) {
        // A swapped animation has its own variants and colors, so descend to whatever entry it actually offers
        const prefix = [animationPrefix(video), animation].join(".");
        const after = resolveEntry(prefix, TYPE_COLORS[to] ?? [to], db);
        if (after && after !== before) {
            return {
                action: "swap",
                updates: { animation, ...coordinatesOf(prefix, after) },
                before,
                after,
            };
        }
    }

    return { action: "unresolved", before };
}

/** Whether an item's own data references a damage type, used to leave genuinely fiery items alone. */
function referencesDamageType(system, type) {
    const serialized = JSON.stringify(system ?? {});
    const patterns = [
        new RegExp(`"damageType":"${type}"`),
        new RegExp(`"type":"${type}"`),
        new RegExp(`\\[(?:[a-z-]+,)*${type}(?:,[a-z-]+)*\\]`),
        new RegExp(`"${type}"`), // a trait or IWR entry
        new RegExp(`:${type}"`), // a roll option
    ];
    return patterns.some((pattern) => pattern.test(serialized));
}

/** Plan every animation change for one item, returning flattened update data and a description of each change. */
function planItem(source, db, options) {
    const flags = source?.flags?.autoanimations;
    if (!flags || typeof flags !== "object") return null;
    if (options.onlyConverted && !referencesDamageType(source.system, options.to)) return null;

    const updates = {};
    const changes = [];
    for (const section of VIDEO_SECTIONS) {
        const plan = planVideo(flags[section]?.video, db, options);
        if (!plan) continue;

        if (plan.action === "custom") {
            const rewritten = rewriteCustomPath(plan.path, options);
            changes.push({ section, action: "custom", before: plan.path, after: rewritten });
            if (options.rewriteCustomPaths && rewritten !== plan.path) {
                updates[`flags.autoanimations.${section}.video.customPath`] = rewritten;
            }
            continue;
        }
        if (plan.action === "unresolved") {
            changes.push({ section, action: "unresolved", before: plan.before });
            continue;
        }

        for (const [field, value] of Object.entries(plan.updates)) {
            updates[`flags.autoanimations.${section}.video.${field}`] = value;
        }
        changes.push({ section, action: plan.action, before: plan.before, after: plan.after });
    }

    const writes = Object.keys(updates).length;
    return changes.length > 0 ? { updates, changes, writes } : null;
}

/** Swap color words inside a hand-entered file path. Unverifiable, so only used when explicitly enabled. */
function rewriteCustomPath(path, { from, to }) {
    let rewritten = path;
    const targets = TYPE_COLORS[to] ?? [to];
    for (const color of TYPE_COLORS[from] ?? [from]) {
        const pattern = new RegExp(`(?<![a-z])${color}(?![a-z])`, "gi");
        rewritten = rewritten.replace(pattern, (match) =>
            match[0] === match[0].toUpperCase()
                ? targets[0].charAt(0).toUpperCase() + targets[0].slice(1)
                : targets[0],
        );
    }
    return rewritten;
}

/* --------------------------------------------- Helpers -------------------------------------------- */

function chunk(values, size) {
    const batches = [];
    for (let index = 0; index < values.length; index += size) {
        batches.push(values.slice(index, index + size));
    }
    return batches;
}

function createProgress(label, max) {
    try {
        const notification = ui.notifications.info(label, { progress: true });
        let value = 0;
        return {
            advance: (stepLabel = label) => {
                value = Math.min(value + 1, max);
                notification.update({ message: stepLabel, pct: max === 0 ? 1 : value / max });
            },
            close: () => notification.update({ message: "", pct: 1 }),
        };
    } catch {
        return { advance: () => {}, close: () => {} };
    }
}

/** The actor and item compendiums in scope, in a stable order. */
function packsInScope(scope) {
    if (scope === "none") return [];
    return game.packs.filter(
        (p) => ["Actor", "Item"].includes(p.metadata.type) && (scope === "all" || p.metadata.packageType === "world"),
    );
}

/* ---------------------------------------------- Macro --------------------------------------------- */

async function buildPlan(db, options) {
    const plan = { items: [], actors: [], packs: [], documents: 0, writes: 0, changes: [] };

    const record = (label, source) => {
        const result = planItem(source, db, options);
        if (!result) return null;
        plan.documents += 1;
        plan.writes += result.writes;
        for (const change of result.changes) {
            plan.changes.push({ item: source.name, label, ...change });
        }
        return result;
    };

    for (const item of game.items) {
        const result = record("World item", item.toObject());
        if (result && result.writes > 0) plan.items.push({ ...result.updates, _id: item.id });
    }

    for (const actor of game.actors) {
        const itemUpdates = [];
        for (const item of actor.items) {
            const result = record(`World actor ${actor.name}`, item.toObject());
            if (result && result.writes > 0) itemUpdates.push({ ...result.updates, _id: item.id });
        }
        if (itemUpdates.length > 0) plan.actors.push({ actor, itemUpdates });
    }

    const packs = packsInScope(options.packs);
    if (packs.length > 0) {
        const progress = createProgress("Scanning compendiums for animations…", packs.length);
        for (const pack of packs) {
            progress.advance(`Scanning ${pack.metadata.label}…`);
            const entry = { pack, items: [], actors: [] };
            let documents = [];
            try {
                documents = await pack.getDocuments();
            } catch (error) {
                console.warn(`Convert Animations | Could not read ${pack.metadata.id}:`, error);
            }

            for (const document of documents) {
                if ("prototypeToken" in document) {
                    const itemUpdates = [];
                    for (const item of document.items) {
                        const result = record(`${pack.metadata.label} — ${document.name}`, item.toObject());
                        if (result && result.writes > 0) itemUpdates.push({ ...result.updates, _id: item.id });
                    }
                    if (itemUpdates.length > 0) entry.actors.push({ actor: document, itemUpdates });
                } else {
                    const result = record(pack.metadata.label, document.toObject());
                    if (result && result.writes > 0) entry.items.push({ ...result.updates, _id: document.id });
                }
            }

            if (entry.items.length > 0 || entry.actors.length > 0) plan.packs.push(entry);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        progress.close();
    }

    return plan;
}

async function applyPlan(plan) {
    const progress = createProgress("Recoloring animations…", plan.actors.length + plan.packs.length + 1);
    let failures = 0;

    const attempt = async (description, update) => {
        try {
            await update();
        } catch (error) {
            console.warn(`Convert Animations | Failed on ${description}:`, error);
            failures += 1;
        }
    };

    if (plan.items.length > 0) {
        await attempt("world items", () => game.items.documentClass.updateDocuments(plan.items, { noHook: true }));
    }
    for (const { actor, itemUpdates } of plan.actors) {
        await attempt(actor.uuid, () => actor.updateEmbeddedDocuments("Item", itemUpdates, { noHook: true }));
        progress.advance();
    }

    for (const { pack, items, actors } of plan.packs) {
        progress.advance(`Recoloring ${pack.metadata.label}…`);
        const wasLocked = pack.locked;
        if (wasLocked) {
            await attempt(`unlocking ${pack.metadata.id}`, () => pack.configure({ locked: false }));
            if (pack.locked) continue;
        }
        try {
            for (const { actor, itemUpdates } of actors) {
                await attempt(actor.uuid, () => actor.updateEmbeddedDocuments("Item", itemUpdates, { noHook: true }));
            }
            for (const batch of chunk(items, 100)) {
                await attempt(pack.metadata.id, () =>
                    pack.documentClass.updateDocuments(batch, { pack: pack.metadata.id, noHook: true }),
                );
            }
        } finally {
            if (wasLocked) {
                await attempt(`relocking ${pack.metadata.id}`, () => pack.configure({ locked: true }));
            }
        }
    }
    progress.close();
    return failures;
}

/** Print the plan grouped by what happened, so swaps and failures are easy to review. */
function reportPlan(plan) {
    const byAction = { recolor: [], swap: [], unresolved: [], custom: [] };
    for (const change of plan.changes) byAction[change.action]?.push(change);

    console.groupCollapsed(`Convert Animations | ${plan.changes.length} animations across ${plan.documents} items`);
    for (const [action, entries] of Object.entries(byAction)) {
        if (entries.length === 0) continue;
        console.groupCollapsed(`${action} (${entries.length})`);
        console.table(
            entries.map((e) => ({
                item: e.item,
                where: `${e.label} / ${e.section}`,
                before: e.before,
                after: e.after ?? "—",
            })),
        );
        console.groupEnd();
    }
    console.groupEnd();
    return byAction;
}

if (!game.user.isGM) {
    ui.notifications.error("Only a GM can convert animations.");
    return;
}
if (!game.modules.get("autoanimations")?.active) {
    ui.notifications.error("This macro needs the Automated Animations module to be active.");
    return;
}
if (typeof Sequencer === "undefined") {
    ui.notifications.error("This macro needs the Sequencer module to be active.");
    return;
}

const database = createDatabase();
if (!database.childrenOf(AA_NAMESPACE).length) {
    ui.notifications.error(
        "Automated Animations has not registered its animation database with Sequencer. Open its menu once, then try again.",
    );
    return;
}

const options = {
    from: FROM,
    to: TO,
    packs: PACKS,
    onlyConverted: ONLY_CONVERTED_ITEMS,
    rewriteCustomPaths: REWRITE_CUSTOM_PATHS,
};

ui.notifications.info(`Scanning for ${FROM} animations. With compendiums included this can take a few minutes…`);
const plan = await buildPlan(database, options);
const byAction = reportPlan(plan);

if (plan.changes.length === 0) {
    ui.notifications.info(`No ${FROM} animations were found.`);
    return;
}

const summary =
    `<p>Found <strong>${plan.changes.length}</strong> ${FROM} animations across <strong>${plan.documents}</strong> items:</p>` +
    `<ul><li><strong>${byAction.recolor.length}</strong> recolored, keeping the same effect</li>` +
    `<li><strong>${byAction.swap.length}</strong> swapped for a different effect, because no ${TO} color exists</li>` +
    `<li><strong>${byAction.unresolved.length}</strong> with no ${TO} equivalent, left as they are</li>` +
    `<li><strong>${byAction.custom.length}</strong> using a custom file path${REWRITE_CUSTOM_PATHS ? ", rewritten unverified" : ", left as they are"}</li></ul>` +
    "<p>The full breakdown is in the console (F12).</p>";

if (DRY_RUN) {
    ui.notifications.info(`Dry run: ${plan.writes} fields would change. See the console (F12) for the breakdown.`);
    return;
}

const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Convert Animations" },
    content: `${summary}<p>Every replacement has been checked against your animation database. This cannot be undone: back up your world before continuing.</p>`,
    yes: { default: false },
});
if (!confirmed) return;

const failures = await applyPlan(plan);
ui.notifications.info(`Recolored ${plan.changes.length} animations across ${plan.documents} items.`);
if (byAction.swap.length > 0) {
    ui.notifications.warn(`${byAction.swap.length} effects were swapped rather than recolored. See the console (F12).`);
}
if (failures > 0) {
    ui.notifications.warn(`${failures} updates failed. See the console (F12) for details.`);
}
