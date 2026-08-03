import type { ActorPF2e } from "@actor";
import type { ItemPF2e } from "@item";
import type { ScenePF2e } from "@scene";
import type { DamageType } from "@system/damage/types.ts";
import { DAMAGE_TYPES } from "@system/damage/values.ts";
import { Progress } from "@system/progress.ts";
import { localizer, objectHasKey } from "@util";
import { DamageTypeConverter } from "./conversion.ts";

interface ConvertDamageTypeOptions {
    /** The damage type to replace, defaulting to fire */
    from?: DamageType;
    /** The damage type to replace it with, defaulting to acid */
    to?: DamageType;
    /** Whether to rewrite names and prose as well as mechanical data, defaulting to true */
    prose?: boolean;
    /** Report what would change without writing anything */
    dryRun?: boolean;
}

/** Update data for a document identified by ID, as required for a bulk or embedded update */
type IdentifiedUpdate = Record<string, unknown> & { _id: string };

/** An actor and the updates to be applied to it and its items */
interface ActorConversion {
    actor: ActorPF2e;
    update: Record<string, unknown> | null;
    itemUpdates: IdentifiedUpdate[];
}

/** A scene and the renames to be applied to the tokens placed on it */
interface SceneConversion {
    scene: ScenePF2e;
    tokenUpdates: IdentifiedUpdate[];
}

interface ConversionPlan {
    actors: ActorConversion[];
    items: IdentifiedUpdate[];
    scenes: SceneConversion[];
    /** The number of documents with at least one change */
    documents: number;
    /** The number of individual values changed */
    changes: number;
}

/**
 * Replace every reference to one damage type with another throughout the world's actors, items, and unlinked tokens.
 *
 * Mechanical data is always converted: damage types, traits, IWR entries, persistent damage, inline damage expressions
 * in descriptions, and the rule elements driving all of them. Names and prose are rewritten too, but only for documents
 * that carry at least one such mechanical reference, so entries that merely contain the word—*Faerie Fire*, a *Fire
 * Opal*—are left alone entirely.
 */
async function convertDamageType(options: ConvertDamageTypeOptions = {}): Promise<void> {
    const localize = localizer("PF2E.Macro.ConvertDamageType");
    if (!game.user.isGM) {
        ui.notifications.error(localize("NotGM"));
        return;
    }

    const from = options.from ?? "fire";
    const to = options.to ?? "acid";
    for (const type of [from, to]) {
        if (!DAMAGE_TYPES.has(type)) {
            ui.notifications.error(localize("InvalidType", { type }));
            return;
        }
    }
    if (from === to) {
        ui.notifications.error(localize("SameType"));
        return;
    }

    const labels = {
        from: damageTypeLabel(from),
        to: damageTypeLabel(to),
    };

    const plan = await buildPlan({ from, to, prose: options.prose ?? true });
    if (plan.changes === 0) {
        ui.notifications.info(localize("NoMatches", labels));
        return;
    }

    const summary = { ...labels, changes: plan.changes, documents: plan.documents };
    if (options.dryRun) {
        ui.notifications.info(localize("Preview", summary));
        return;
    }

    const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: localize("Title") },
        content: localize(options.prose === false ? "ConfirmMechanical" : "Confirm", summary),
        yes: { default: false },
    });
    if (!confirmed) return;

    const failures = await applyPlan(plan, localize("Converting", labels));
    ui.notifications.info(localize("Complete", summary));
    if (failures > 0) {
        ui.notifications.warn(localize("Failures", { count: failures }));
    }
}

/** Scan every world document for references to the source damage type. */
async function buildPlan({
    from,
    to,
    prose,
}: Required<Pick<ConvertDamageTypeOptions, "prose">> & {
    from: DamageType;
    to: DamageType;
}): Promise<ConversionPlan> {
    const converter = new DamageTypeConverter({ from, to, prose });
    const plan: ConversionPlan = { actors: [], items: [], scenes: [], documents: 0, changes: 0 };
    /** Actors whose prose was rewritten, and whose placed tokens should therefore be renamed to match */
    const renamedActors: Set<string> = new Set();

    const convertItems = (items: Iterable<ItemPF2e>): IdentifiedUpdate[] => {
        const updates: IdentifiedUpdate[] = [];
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
        const tokenUpdates: IdentifiedUpdate[] = [];
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
async function applyPlan(plan: ConversionPlan, label: string): Promise<number> {
    const progress = new Progress({ label, max: plan.actors.length + plan.scenes.length + 1 });
    let failures = 0;

    const attempt = async (description: string, update: () => Promise<unknown>): Promise<void> => {
        try {
            await update();
        } catch (error) {
            console.warn(`PF2e System | Failed to convert ${description}:`, error);
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

/** The localized name of a damage type, falling back to the type itself for an unlabeled one. */
function damageTypeLabel(type: DamageType): string {
    const labels: object = CONFIG.PF2E.damageTypes;
    return objectHasKey(labels, type) ? _loc(labels[type]) : type;
}

export { convertDamageType };
export type { ConvertDamageTypeOptions };
