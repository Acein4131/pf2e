/**
 * Copy compendium packs into this world — standalone Foundry macro.
 *
 * Packs belonging to the system or to a module live in that package's folder, which every world using the package
 * shares. Editing them in place changes all of your games and a world backup cannot undo it. This macro copies them
 * into *world* compendiums instead, which live inside this world alone and survive package updates.
 *
 * It only copies. Run it first, then run convert-damage-type.js with PACKS = "world" to convert the copies: the
 * originals are never touched, so the system stays pristine and the conversion is confined to this world.
 *
 * Cross-references are repointed as it goes. Document IDs are preserved, so a link from one copied document to another
 * — `@UUID[Compendium.pf2e.spells-srd.Item.abc]` — is rewritten to the copy in this world rather than resolving back
 * to the untouched original.
 *
 * This is a large operation: the PF2e system alone ships around 29,500 documents across 92 actor and item packs.
 * Expect it to take several minutes and to add a few hundred megabytes to your world. START WITH DRY_RUN = true.
 */

/* -------------------------------------------- Settings -------------------------------------------- */

/** Which packages to copy packs from: any of "system" and "module". */
const SOURCE_PACKAGES = ["system"];
/**
 * Copy only packs whose id matches this, as a regular expression source string. Null copies every pack.
 * Try a single pack first, e.g. "spells-srd".
 */
const PACK_FILTER = null;
/** Prefix for the created pack's internal name, which must be unique among this world's packs. */
const NAME_PREFIX = "acid-";
/** Prefix for the label shown in the sidebar. */
const LABEL_PREFIX = "[Acid] ";
/** Compendium folder to group the copies under. Set to null to leave them ungrouped. */
const FOLDER_NAME = "Acid Conversion";
/** What to do when a copy already exists: "skip" to leave it, "replace" to delete and recreate it. */
const ON_EXISTING = "skip";
/** Report what would be copied without creating anything. */
const DRY_RUN = true;

/* --------------------------------------------- Naming --------------------------------------------- */

/** The world pack name for a copy of a source pack. Must be unique, and stable across re-runs so it can resume. */
function targetName(sourcePack) {
    // The source name alone is unique within its package but not across packages, so keep the package in the name
    const owner = sourcePack.metadata.packageType === "system" ? "" : `${sourcePack.metadata.packageName}-`;
    return `${NAME_PREFIX}${owner}${sourcePack.metadata.name}`.replace(/[^a-zA-Z0-9-]/g, "-");
}

/** The sidebar label for a copy. */
function targetLabel(sourcePack) {
    return `${LABEL_PREFIX}${sourcePack.metadata.label}`;
}

/**
 * A mapping from each source pack's compendium prefix to its copy's, so links between copied documents point at the
 * copies. Built for every pack in the run before anything is copied, so a link into a pack copied later still lands.
 */
function buildLinkMap(sourcePacks) {
    const map = new Map();
    for (const pack of sourcePacks) {
        map.set(`Compendium.${pack.metadata.id}.`, `Compendium.world.${targetName(pack)}.`);
    }
    return map;
}

/**
 * Repoint compendium links within a document's data.
 *
 * `_stats` is left alone: its `compendiumSource` records where the document actually came from, and that provenance
 * should keep pointing at the original.
 */
function rewriteLinks(source, linkMap) {
    const stats = source._stats;
    const rest = { ...source };
    delete rest._stats;

    let serialized = JSON.stringify(rest);
    for (const [from, to] of linkMap) {
        if (serialized.includes(from)) serialized = serialized.split(from).join(to);
    }
    const rewritten = JSON.parse(serialized);
    if (stats !== undefined) rewritten._stats = stats;
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
            advance: (stepLabel = label, by = 1) => {
                value = Math.min(value + by, max);
                notification.update({ message: stepLabel, pct: max === 0 ? 1 : value / max });
            },
            close: () => notification.update({ message: "", pct: 1 }),
        };
    } catch {
        return { advance: () => {}, close: () => {} };
    }
}

/** The packs this run will copy, in a stable order. */
function sourcePacksInScope() {
    const filter = PACK_FILTER ? new RegExp(PACK_FILTER) : null;
    return game.packs
        .filter(
            (p) =>
                ["Actor", "Item"].includes(p.metadata.type) &&
                SOURCE_PACKAGES.includes(p.metadata.packageType) &&
                (!filter || filter.test(p.metadata.id)),
        )
        .sort((a, b) => a.metadata.id.localeCompare(b.metadata.id));
}

/** Create the folder the copies are grouped under, if the running Foundry supports compendium folders. */
async function ensureFolder() {
    if (!FOLDER_NAME) return null;
    try {
        const existing = game.folders.find((f) => f.type === "Compendium" && f.name === FOLDER_NAME);
        if (existing) return existing;
        return await Folder.create({ name: FOLDER_NAME, type: "Compendium" });
    } catch (error) {
        console.warn("Snapshot Compendiums | Could not create a compendium folder:", error);
        return null;
    }
}

/* ---------------------------------------------- Macro --------------------------------------------- */

if (!game.user.isGM) {
    ui.notifications.error("Only a GM can copy compendiums.");
    return;
}
if (ON_EXISTING !== "skip" && ON_EXISTING !== "replace") {
    ui.notifications.error('ON_EXISTING must be "skip" or "replace".');
    return;
}

const CompendiumClass = foundry.documents?.collections?.CompendiumCollection ?? CompendiumCollection;
const sourcePacks = sourcePacksInScope();
if (sourcePacks.length === 0) {
    ui.notifications.error("No packs matched. Check SOURCE_PACKAGES and PACK_FILTER.");
    return;
}

const linkMap = buildLinkMap(sourcePacks);
const plan = [];
let totalDocuments = 0;
for (const pack of sourcePacks) {
    const name = targetName(pack);
    const existing = game.packs.get(`world.${name}`);
    const count = pack.index.size || (await pack.getIndex()).size;
    totalDocuments += existing && ON_EXISTING === "skip" ? 0 : count;
    plan.push({ pack, name, existing: !!existing, count });
}

const toCopy = plan.filter((entry) => !(entry.existing && ON_EXISTING === "skip"));
const skipping = plan.length - toCopy.length;

console.group("Snapshot Compendiums | plan");
console.table(
    plan.map((entry) => ({
        from: entry.pack.metadata.id,
        to: `world.${entry.name}`,
        documents: entry.count,
        status: entry.existing ? (ON_EXISTING === "skip" ? "already exists — skipping" : "exists — replacing") : "copy",
    })),
);
console.groupEnd();

if (DRY_RUN) {
    ui.notifications.info(
        `Dry run: would copy ${totalDocuments} documents into ${toCopy.length} world compendiums` +
            `${skipping > 0 ? `, skipping ${skipping} that already exist` : ""}. See the console (F12).`,
    );
    return;
}

const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Copy Compendiums Into This World" },
    content:
        `<p>This will create <strong>${toCopy.length}</strong> world compendiums holding ` +
        `<strong>${totalDocuments}</strong> documents copied from ${SOURCE_PACKAGES.join(" and ")} packs.</p>` +
        `${skipping > 0 ? `<p>${skipping} copies already exist and will be left alone.</p>` : ""}` +
        "<p>The originals are not modified. The copies live in this world only, so converting them afterward cannot " +
        "affect your other games.</p>" +
        "<p>This can take several minutes and will noticeably increase the size of your world.</p>",
    yes: { default: false },
});
if (!confirmed) return;

const folder = await ensureFolder();
const progress = createProgress("Copying compendiums…", Math.max(totalDocuments, 1));
const created = [];
let failures = 0;

for (const entry of toCopy) {
    const { pack, name } = entry;
    progress.advance(`Copying ${pack.metadata.label}…`, 0);

    try {
        if (entry.existing && ON_EXISTING === "replace") {
            await game.packs.get(`world.${name}`)?.deleteCompendium();
        }

        const target = await CompendiumClass.createCompendium({
            type: pack.metadata.type,
            label: targetLabel(pack),
            name,
        });
        if (folder) {
            try {
                await target.configure({ folder: folder.id });
            } catch (error) {
                console.warn(`Snapshot Compendiums | Could not file ${target.metadata.id} in a folder:`, error);
            }
        }

        // Copy the pack's own folder structure first, keeping ids so each document still points at its folder
        const folderSources = pack.folders?.contents?.map((f) => f.toObject()) ?? [];
        if (folderSources.length > 0) {
            await Folder.createDocuments(folderSources, { pack: target.metadata.id, keepId: true });
        }

        const documents = await pack.getDocuments();
        const sources = documents.map((d) => rewriteLinks(d.toObject(), linkMap));
        for (const batch of chunk(sources, 50)) {
            await target.documentClass.createDocuments(batch, {
                pack: target.metadata.id,
                keepId: true,
                keepEmbeddedIds: true,
            });
            progress.advance(`Copying ${pack.metadata.label}…`, batch.length);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        created.push({ from: pack.metadata.id, to: target.metadata.id, documents: sources.length });
    } catch (error) {
        console.error(`Snapshot Compendiums | Failed to copy ${pack.metadata.id}:`, error);
        failures += 1;
    }
}
progress.close();

console.group("Snapshot Compendiums | created");
console.table(created);
console.groupEnd();

const copied = created.reduce((total, entry) => total + entry.documents, 0);
ui.notifications.info(
    `Copied ${copied} documents into ${created.length} world compendiums. ` +
        `Now run convert-damage-type.js with PACKS = "world" to convert them.`,
);
if (failures > 0) {
    ui.notifications.warn(`${failures} packs could not be copied. See the console (F12).`);
}
