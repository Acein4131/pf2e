/**
 * Find leftover damage-type conversions — standalone Foundry macro. READ ONLY: this never writes anything.
 *
 * Compendium packs belonging to the system or to a module live in the package's own folder, not in the world, so every
 * world sharing that package sees changes made to them and restoring a world backup cannot undo them. Reinstalling the
 * package is what restores those packs. This macro tells you whether that has actually worked, and which packs still
 * carry converted content.
 *
 * It uses two signals:
 *
 *  1. A probe for documents that should exist under their original names. If "Fireball" cannot be found in any item
 *     compendium, the packs are still converted.
 *  2. A fingerprint the conversion leaves behind. Renaming a document whose slug was derived from its name pins the
 *     original slug, so the slug no longer matches the name. Across the 21,346 item documents shipped with the system
 *     that combination never occurs naturally, which makes it a reliable marker.
 *
 * Paste the whole file into a Script macro and run it as GM. Results are printed to the console (F12).
 */

/* -------------------------------------------- Settings -------------------------------------------- */

/**
 * Documents that exist under these names in an unconverted install. If none of them can be found, something has
 * renamed them. Adjust if you converted a type other than fire.
 */
const PROBE_NAMES = ["Fireball", "Burning Hands", "Wall of Fire", "Alchemist's Fire (Lesser)", "Blazing Bolt"];

/** Also check the world's own actors and items, to confirm a world restore took. */
const CHECK_WORLD = true;

/* -------------------------------------------- Detection ------------------------------------------- */

/** The system's own sluggifier, with a faithful fallback. */
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

/**
 * Whether a document carries the conversion's fingerprint: an explicit slug that no longer matches its name.
 *
 * A document with no slug of its own derives one from its name, so the conversion pins the original before renaming.
 * For documents that stand on their own — the ones a compendium index lists — that is the only way the two come apart.
 *
 * It does NOT hold for items embedded in an actor, where a deliberately different slug is ordinary: a graveknight's
 * "Rejuvenation" is slugged `graveknight-rejuvenation`, and "Void Healing" is still slugged `negative-healing` from an
 * older name. Those are never checked, which is why only top-level documents are scanned.
 */
function looksConverted(name, slug) {
    if (typeof slug !== "string" || slug.length === 0) return false;
    if (typeof name !== "string" || name.length === 0) return false;
    return slug !== sluggify(name);
}

/** Group a list of packs by which package they belong to, since that is what has to be reinstalled. */
function describeOwner(pack) {
    const type = pack.metadata.packageType;
    if (type === "world") return "this world";
    return `${type} "${pack.metadata.packageName ?? pack.metadata.package ?? type}"`;
}

/* ---------------------------------------------- Macro --------------------------------------------- */

if (!game.user.isGM) {
    ui.notifications.error("Only a GM can run this check.");
    return;
}

const packs = game.packs.filter((p) => ["Actor", "Item"].includes(p.metadata.type));
const findings = [];
const probesFound = new Map(PROBE_NAMES.map((name) => [name, []]));
let scanned = 0;

const notification = (() => {
    try {
        return ui.notifications.info("Checking compendiums…", { progress: true });
    } catch {
        return null;
    }
})();

for (const [index, pack] of packs.entries()) {
    notification?.update({ message: `Checking ${pack.metadata.label}…`, pct: index / packs.length });
    if (index % 10 === 9) await new Promise((resolve) => setTimeout(resolve, 0));

    let entries = [];
    try {
        // The index is enough: it carries names, and slugs can be requested alongside them
        entries = await pack.getIndex({ fields: ["system.slug"] });
    } catch (error) {
        console.warn(`Verify Conversion | Could not read ${pack.metadata.id}:`, error);
        continue;
    }

    const converted = [];
    for (const entry of entries) {
        scanned += 1;
        if (probesFound.has(entry.name)) probesFound.get(entry.name).push(pack.metadata.id);
        if (looksConverted(entry.name, entry.system?.slug)) {
            converted.push({ name: entry.name, slug: entry.system.slug });
        }
    }
    if (converted.length > 0) {
        findings.push({ pack, converted });
    }
}
notification?.update({ message: "", pct: 1 });

// The world's own top-level items, to confirm a restore took. Items owned by an actor are deliberately skipped: their
// slugs routinely differ from their names, so the fingerprint does not apply to them.
const worldFindings = [];
if (CHECK_WORLD) {
    for (const item of game.items) {
        if (looksConverted(item.name, item._source.system?.slug)) {
            worldFindings.push({ where: "World item", name: item.name, slug: item._source.system.slug });
        }
    }
}

/* --------------------------------------------- Reporting ------------------------------------------ */

console.group(`Verify Conversion | ${scanned} compendium entries checked across ${packs.length} packs`);

console.group("Probe: documents that should exist under their original names");
const missing = [];
for (const [name, found] of probesFound) {
    if (found.length > 0) {
        console.log(`  FOUND    "${name}" in ${found.join(", ")}`);
    } else {
        missing.push(name);
        console.warn(`  MISSING  "${name}" — nothing by that name in any compendium`);
    }
}
console.groupEnd();

if (findings.length > 0) {
    console.group(`Packs still carrying converted documents (${findings.length})`);
    console.table(
        findings.map((f) => ({
            pack: f.pack.metadata.id,
            label: f.pack.metadata.label,
            belongsTo: describeOwner(f.pack),
            locked: f.pack.locked,
            converted: f.converted.length,
            example: `${f.converted[0].name} (slug "${f.converted[0].slug}")`,
        })),
    );
    for (const { pack, converted } of findings) {
        console.groupCollapsed(`${pack.metadata.id} — ${converted.length}`);
        console.table(converted);
        console.groupEnd();
    }
    console.groupEnd();
}

if (worldFindings.length > 0) {
    console.group(`World documents still carrying converted names (${worldFindings.length})`);
    console.table(worldFindings);
    console.groupEnd();
}

const unlocked = packs.filter((p) => p.metadata.packageType !== "world" && !p.locked);
if (unlocked.length > 0) {
    console.group(`Packs left unlocked (${unlocked.length})`);
    console.table(unlocked.map((p) => ({ pack: p.metadata.id, belongsTo: describeOwner(p) })));
    console.groupEnd();
}
console.groupEnd();

/* --------------------------------------------- Summary -------------------------------------------- */

const owners = [...new Set(findings.map((f) => describeOwner(f.pack)))];
if (findings.length === 0 && missing.length === 0 && worldFindings.length === 0) {
    ui.notifications.info(
        `No leftover conversions found: ${scanned} compendium entries across ${packs.length} packs look original.`,
    );
} else {
    const parts = [];
    if (missing.length > 0) parts.push(`${missing.length} of ${PROBE_NAMES.length} probe documents are missing`);
    if (findings.length > 0) parts.push(`${findings.length} packs still hold converted documents`);
    if (worldFindings.length > 0) parts.push(`${worldFindings.length} world documents are still converted`);
    ui.notifications.warn(`Leftover conversions found: ${parts.join("; ")}. See the console (F12).`);
    if (owners.length > 0) {
        console.warn(`Verify Conversion | Reinstall these to restore their packs: ${owners.join(", ")}`);
    }
}
