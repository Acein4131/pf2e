/**
 * Create Thrall
 * =============
 * A script macro that places thrall tokens on the current scene.
 *
 * A thrall is a level -1 mindless undead with 1 Hit Point that must be created in an *unoccupied*
 * space, so this macro searches outward from the selected token (or from the cursor, when nothing is
 * selected) for free squares and refuses to place a thrall if it can't find one.
 *
 * Setup
 * -----
 * 1. Make (or import) the actor the thralls should be created from. Anything works — an NPC with the
 *    thrall stat block is the intended use.
 * 2. Set `SETTINGS.actor` below to that actor's name, id, or UUID. A compendium UUID is fine: the
 *    actor is imported into the world the first time the macro runs.
 * 3. Create a new script macro in Foundry, paste this whole file in, and drop it on the hotbar.
 *
 * Usage
 * -----
 * - Select your necromancer's token and press the macro. Thralls appear in the nearest unoccupied
 *   spaces that aren't behind a wall.
 * - With nothing selected, thralls are placed at the cursor instead.
 * - Shift-click the macro to skip the dialog and use the defaults in `SETTINGS`.
 *
 * What is and isn't automated
 * ---------------------------
 * Placement, size, and the 1-minute duration are handled here. The thrall's own rules — 1 HP,
 * immunities, automatic failures, Speed 15 feet, and the unarmed Strike used by Command a Thrall —
 * belong on the linked actor, not on the token.
 *
 * Thralls are temporary and destroyed after 1 minute unless another duration is listed, so each
 * token gets an effect with that duration. The effects panel tracks and expires it; the token itself
 * is left on the scene for you to delete (or to keep, if the ability that made it lasts longer).
 */

const SETTINGS = {
    /** Name, id, or UUID of the actor thralls are created from. */
    actor: "Thrall",
    /** How many thralls to create per press. */
    quantity: 1,
    /** Size of the created thralls: "sm" or "med" — you choose when you create one. */
    size: "med",
    /** Minutes until the thrall is destroyed; set to `null` to skip the duration effect entirely. */
    durationMinutes: 1,
    /** Show the dialog. Shift-clicking the macro always skips it. */
    prompt: true,
    /** How far, in grid spaces, to search for an unoccupied space. */
    searchRadius: 10,
};

const EFFECT_SLUG = "thrall-temporary";

/* -------------------------------------------- */
/*  Actor resolution                            */
/* -------------------------------------------- */

/** Resolve `SETTINGS.actor` to a world actor, importing it from a compendium if necessary. */
async function resolveThrallActor() {
    const reference = SETTINGS.actor?.trim();
    if (!reference) {
        ui.notifications.error("Create Thrall: no actor configured. Set `SETTINGS.actor` in the macro.");
        return null;
    }

    const found =
        game.actors.get(reference) ??
        game.actors.getName(reference) ??
        (/^(Actor|Compendium)\./.test(reference) ? await fromUuid(reference) : null);

    if (!(found instanceof Actor)) {
        ui.notifications.error(`Create Thrall: no actor found matching "${reference}".`);
        return null;
    }
    if (!found.pack) return found;

    // A token can only be created from a world actor, so import the compendium actor once and reuse it
    const imported = game.actors.getName(found.name);
    if (imported) return imported;
    if (!game.user.can("ACTOR_CREATE")) {
        ui.notifications.error(`Create Thrall: "${found.name}" lives in a compendium and you can't create actors.`);
        return null;
    }
    return game.actors.importFromCompendium(game.packs.get(found.pack), found.id, {}, { keepId: false });
}

/* -------------------------------------------- */
/*  Space finding                               */
/* -------------------------------------------- */

/** The point thralls are placed around: the first controlled token's center, else the cursor. */
function getOrigin() {
    const controlled = canvas.tokens.controlled.at(0);
    if (controlled) return { point: controlled.center, token: controlled };
    const mouse = canvas.mousePosition;
    return { point: { x: mouse.x, y: mouse.y }, token: null };
}

/** Is any token already standing in this rectangle? */
function isOccupied(rect) {
    return canvas.tokens.placeables.some((token) => {
        const bounds = token.document.mechanicalBounds ?? token.bounds;
        return (
            rect.x < bounds.x + bounds.width &&
            rect.x + rect.width > bounds.x &&
            rect.y < bounds.y + bounds.height &&
            rect.y + rect.height > bounds.y
        );
    });
}

/** Can a creature at `origin` reach `destination` without passing through a wall? */
function isReachable(origin, destination) {
    return !CONFIG.Canvas.polygonBackends.move.testCollision(origin, destination, { type: "move", mode: "any" });
}

/** A space is usable if it's inside the scene, unoccupied, and not walled off from the origin. */
function isUsableSpace(topLeft, origin, size) {
    const center = { x: topLeft.x + size / 2, y: topLeft.y + size / 2 };
    const sceneRect = canvas.dimensions.sceneRect;
    if (sceneRect && !sceneRect.contains(center.x, center.y)) return false;
    if (isOccupied({ x: topLeft.x, y: topLeft.y, width: size, height: size })) return false;
    return isReachable(origin.point, center);
}

/** Walk grid spaces outward from the origin, breadth-first, so nearer spaces are used first. */
function findSpacesOnGrid(origin, count, size) {
    const grid = canvas.grid;
    const originOffset = grid.getOffset(origin.point);
    const queue = [originOffset];
    const visited = new Set();
    const spaces = [];

    while (queue.length > 0 && spaces.length < count) {
        const offset = queue.shift();
        const key = `${offset.i},${offset.j}`;
        if (visited.has(key)) continue;
        visited.add(key);

        const center = grid.getCenterPoint(offset);
        if (grid.measurePath([origin.point, center]).distance > SETTINGS.searchRadius * grid.distance) continue;

        const topLeft = grid.getTopLeftPoint(offset);
        if (isUsableSpace(topLeft, origin, size)) spaces.push(topLeft);

        // Keep expanding past unusable spaces: a blocked square may still have open neighbors
        queue.push(...grid.getAdjacentOffsets(offset));
    }

    return spaces;
}

/** Gridless scenes have no spaces to search, so step outward in a square spiral instead. */
function findSpacesGridless(origin, count, size) {
    const spaces = [];
    const start = { x: origin.point.x - size / 2, y: origin.point.y - size / 2 };

    for (let ring = 0; ring <= SETTINGS.searchRadius && spaces.length < count; ring++) {
        for (let x = -ring; x <= ring && spaces.length < count; x++) {
            for (let y = -ring; y <= ring && spaces.length < count; y++) {
                if (Math.max(Math.abs(x), Math.abs(y)) !== ring) continue;
                const topLeft = { x: start.x + x * size, y: start.y + y * size };
                if (isUsableSpace(topLeft, origin, size)) spaces.push(topLeft);
            }
        }
    }

    return spaces;
}

/* -------------------------------------------- */
/*  Token creation                              */
/* -------------------------------------------- */

/** Build the token sources to create, one per free space. */
async function buildTokenSources(actor, spaces, size) {
    const sources = await Promise.all(
        spaces.map(async (space) => {
            const token = await actor.getTokenDocument({ x: space.x, y: space.y, actorLink: false });
            return {
                ...token.toObject(),
                x: space.x,
                y: space.y,
                actorLink: false,
                // Small and Medium thralls both occupy one space; the system scales the artwork
                delta: { system: { traits: { size: { value: size } } } },
            };
        }),
    );

    return sources;
}

/** Give each thrall the effect that tracks how long it survives. */
async function applyDurationEffect(tokens) {
    if (!SETTINGS.durationMinutes) return;

    const description = `<p>A thrall is temporary and is destroyed after ${SETTINGS.durationMinutes} minute if no other duration is listed.</p>`;
    const effect = {
        name: "Effect: Thrall",
        type: "effect",
        img: "systems/pf2e/icons/spells/create-undead.webp",
        system: {
            description: { value: description },
            duration: {
                value: SETTINGS.durationMinutes,
                unit: "minutes",
                sustained: false,
                expiry: "turn-start",
            },
            level: { value: 1 },
            slug: EFFECT_SLUG,
            tokenIcon: { show: true },
            traits: { value: ["undead"], rarity: "common" },
        },
    };

    for (const token of tokens) {
        const thrall = token.actor;
        if (!thrall || thrall.itemTypes.effect.some((e) => e.slug === EFFECT_SLUG)) continue;
        await thrall.createEmbeddedDocuments("Item", [effect]);
    }
}

/* -------------------------------------------- */
/*  Dialog                                      */
/* -------------------------------------------- */

async function promptForOptions() {
    const content = `
        <div class="form-group">
            <label>Number of Thralls</label>
            <div class="form-fields">
                <input type="number" name="quantity" value="${SETTINGS.quantity}" min="1" max="20" step="1" autofocus />
            </div>
        </div>
        <div class="form-group">
            <label>Size</label>
            <div class="form-fields">
                <select name="size">
                    <option value="med" ${SETTINGS.size === "med" ? "selected" : ""}>Medium</option>
                    <option value="sm" ${SETTINGS.size === "sm" ? "selected" : ""}>Small</option>
                </select>
            </div>
        </div>
    `;

    return foundry.applications.api.DialogV2.prompt({
        window: { title: "Create Thrall" },
        content,
        ok: {
            label: "Create",
            callback: (_event, button) => ({
                quantity: Math.clamp(Number(button.form.elements.quantity.value) || 1, 1, 20),
                size: button.form.elements.size.value,
            }),
        },
        rejectClose: false,
    });
}

/* -------------------------------------------- */
/*  Main                                        */
/* -------------------------------------------- */

async function createThralls() {
    if (!canvas.ready) {
        ui.notifications.warn("Create Thrall: no active scene.");
        return;
    }
    if (!game.user.can("TOKEN_CREATE")) {
        ui.notifications.error("Create Thrall: you don't have permission to create tokens.");
        return;
    }

    const actor = await resolveThrallActor();
    if (!actor) return;

    const skipDialog = !SETTINGS.prompt || (typeof event !== "undefined" && event?.shiftKey);
    const options = skipDialog ? { quantity: SETTINGS.quantity, size: SETTINGS.size } : await promptForOptions();
    if (!options) return;

    const origin = getOrigin();
    const spaceSize = canvas.grid.size;
    const spaces = canvas.grid.isGridless
        ? findSpacesGridless(origin, options.quantity, spaceSize)
        : findSpacesOnGrid(origin, options.quantity, spaceSize);

    if (spaces.length === 0) {
        ui.notifications.warn(
            "Create Thrall: no unoccupied space nearby — the spell or ability that would create the thrall fails.",
        );
        return;
    }

    const sources = await buildTokenSources(actor, spaces, options.size);
    const created = await canvas.scene.createEmbeddedDocuments("Token", sources);
    await applyDurationEffect(created);

    if (created.length < options.quantity) {
        const shortfall = options.quantity - created.length;
        ui.notifications.warn(
            `Create Thrall: only ${created.length} unoccupied space(s) found — ${shortfall} thrall(s) weren't created.`,
        );
    } else {
        ui.notifications.info(`Create Thrall: created ${created.length} thrall(s).`);
    }
}

await createThralls();
