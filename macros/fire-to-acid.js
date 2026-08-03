/**
 * Fire -> Acid: a full element swap, applied to an existing PF2e world.
 *
 * Paste this into a new Script macro (scope: global) and execute it as a GM.
 * It rewrites documents already in your world; it does not modify the system code.
 *
 * WHAT IT CHANGES
 *   - Damage types            system.damage.*.type, *.damageType, system.damageRolls.*
 *   - IWR                     immunities / weaknesses / resistances of type "fire"
 *   - Traits                  the "fire" trait on actors, items, spells and auras
 *   - Rule elements           DamageDice, FlatModifier, Resistance, Weakness, Immunity,
 *                             FastHealing.deactivatedBy, ChoiceSet choices, RollOption
 *                             suboptions, ActiveEffectLike values, predicates
 *   - Roll options            any ":"-delimited option ending in a "fire" segment,
 *                             e.g. "item:damage:type:fire" -> "item:damage:type:acid"
 *   - Localization labels     PF2E.TraitFire -> PF2E.TraitAcid, RollFlavor.fire -> .acid
 *   - Inline damage links     @Damage[6d6[fire]] -> @Damage[6d6[acid]],
 *                             including [persistent,fire] and multi-type brackets
 *   - Description prose       "6d6 fire damage" -> "6d6 acid damage", "resistance to
 *                             fire" -> "resistance to acid", etc. (see PROSE_PATTERNS)
 *
 * WHAT IT DELIBERATELY LEAVES ALONE
 *   - `element: "fire"`   Kineticist / elemental-gate identity. "acid" is not a valid
 *                         element (air, earth, fire, metal, water, wood), so swapping it
 *                         breaks impulse gating. The damage those features deal is still
 *                         converted; only the elemental identity survives.
 *   - Deity `domains`     There is no acid domain in PF2e; rewriting it corrupts deities.
 *   - Image paths         Acid art does not live at the fire art's filenames, so swapping
 *                         `img` / `texture.src` would just produce broken images.
 *   - Words that merely contain "fire"   firearm, fireball, campfire, bonfire, hellfire,
 *                         misfire, firefly, fireplace, firework, gunfire, firebrand, ...
 *                         All prose matching is word-bounded, so these are never touched.
 *
 * SAFETY
 *   - "Dry run" is on by default: it reports what would change and writes nothing.
 *   - Re-running is harmless. The conversion is idempotent -- once a document holds no
 *     "fire" data, a second pass produces an empty diff.
 *   - There is no undo. Back up your world (or take a Foundry world backup) before the
 *     first real run.
 */

(async () => {
    if (!game.user.isGM) {
        ui.notifications.error("Fire -> Acid: only a GM can run this macro.");
        return;
    }

    const FROM = "fire";
    const TO = "acid";

    /* ---------------------------------------------------------------------- */
    /* Configuration                                                          */
    /* ---------------------------------------------------------------------- */

    /**
     * Keys whose value (or subtree) must never be rewritten.
     * `element` and `domains` are game-mechanical identities with no acid equivalent;
     * the rest are identifiers, art paths and bookkeeping.
     */
    const SKIP_KEYS = new Set([
        "element", // kineticist / elemental gate identity
        "domains", // deity domains -- no acid domain exists
        "img",
        "src",
        "texture",
        "_id",
        "_stats",
        "_migration",
        "ownership",
        "folder",
        "sort",
        "uuid",
    ]);

    /**
     * Prose replacements. Each entry rewrites "fire" only where it is unambiguously the
     * damage type or energy. Every pattern is word-bounded, so compounds such as
     * "firearm" and "fireball" can never match.
     */
    const PROSE_PATTERNS = [
        // "6d6 fire damage", "fire damage"
        [/\b(fire)(\s+)(damage)\b/gi, 1],
        // "persistent fire damage" is covered above; this catches "persistent fire"
        [/\b(persistent)(\s+)(fire)\b/gi, 3],
        // "fire resistance", "fire immunity", "fire weakness"
        [/\b(fire)(\s+)(resistance|resistances|immunity|immunities|weakness|weaknesses)\b/gi, 1],
        // "resistance to fire", "immune to fire", "weakness to fire"
        [
            /\b(resistance|resistances|immunity|immunities|weakness|weaknesses|immune|resistant|vulnerable)(\s+to\s+)(fire)\b/gi,
            3,
        ],
        // "fire trait", "fire effect", "fire spell"
        [/\b(fire)(\s+)(trait|traits|effect|effects|spell|spells)\b/gi, 1],
    ];

    /**
     * Idioms where a standalone "fire" is not the damage type. Only consulted in
     * aggressive prose mode.
     */
    const PROSE_IDIOMS = [
        /\b(set|sets|setting|catch|catches|caught|cease|ceased|open|opens|opened|held|hold|holds|return|returns|returned)\s+fire\b/i,
        /\bon\s+fire\b/i,
        /\bline\s+of\s+fire\b/i,
        /\bunder\s+fire\b/i,
        // "fire" used as a verb: "two hands to fire it", "fire the crossbow"
        /\bfire\s+(it|them|this|that|these|those|a|an|the|at|into|upon|from|his|her|their|its|one|two|both)\b/i,
    ];

    /* ---------------------------------------------------------------------- */
    /* String conversion                                                      */
    /* ---------------------------------------------------------------------- */

    /** Match the capitalisation of `sample` when substituting `word`. */
    const matchCase = (sample, word) => {
        if (sample.length > 1 && sample === sample.toUpperCase()) return word.toUpperCase();
        if (sample[0] === sample[0].toUpperCase()) return word[0].toUpperCase() + word.slice(1);
        return word;
    };

    /**
     * Run `fn` over `str` with enricher link targets masked out.
     *
     * `@UUID[Compendium.pf2e.spells.Item.Faerie Fire]{Faerie Fire}` must keep its target
     * intact or the link breaks, while the `{...}` display label is free to change.
     * Damage links are already handled before this point, so masking them here is safe.
     */
    const protectLinkTargets = (str, fn) => {
        if (!str.includes("[")) return fn(str);
        const stash = [];
        const masked = str.replace(/@[A-Za-z]+\[[^\]]*\]/g, (match) => {
            stash.push(match);
            return `\u0000${stash.length - 1}\u0000`;
        });
        return fn(masked).replace(/\u0000(\d+)\u0000/g, (_match, index) => stash[Number(index)]);
    };

    /**
     * Rewrite a single string value.
     * @param {string} str   The value to convert.
     * @param {object} opts  { prose: boolean, aggressive: boolean }
     * @returns {string}     The converted value (or the original, unchanged).
     */
    const convertString = (str, opts) => {
        // 1. Exact value: traits, damage types, IWR types, ChoiceSet values, selections.
        if (str === FROM) return TO;

        let out = str;

        // 2. Roll options and predicates: replace whole ":"-delimited segments only, so
        //    "item:damage:type:fire" converts but "item:group:firearm" does not.
        if (out.includes(":") && out.split(":").includes(FROM)) {
            out = out
                .split(":")
                .map((segment) => (segment === FROM ? TO : segment))
                .join(":");
        }

        // 3. Localization keys, so a converted choice does not still read "Fire".
        out = out
            .replace(/\bTraitFire\b/g, "TraitAcid")
            .replace(/\bTraitDescriptionFire\b/g, "TraitDescriptionAcid")
            .replace(/\bRollFlavor\.fire\b/g, "RollFlavor.acid");

        // 4. Inline damage links. Only a bracket token that is exactly "fire" is a damage
        //    type, which leaves @UUID[...] and @Check[...] untouched.
        if (out.includes("[")) {
            out = out.replace(/\[([^\][]*)\]/g, (match, inner) => {
                const tokens = inner.split(",");
                if (!tokens.some((t) => t.trim() === FROM)) return match;
                return `[${tokens.map((t) => (t.trim() === FROM ? TO : t)).join(",")}]`;
            });
        }

        // 5. Prose. Enricher link targets are masked so that rewriting display text can
        //    never break a @UUID[...] reference.
        if (opts.prose) {
            out = protectLinkTargets(out, (text) => {
                let prose = text;

                for (const [pattern, group] of PROSE_PATTERNS) {
                    prose = prose.replace(pattern, (...args) => {
                        const parts = args.slice(1, -2);
                        parts[group - 1] = matchCase(parts[group - 1], TO);
                        return parts.join("");
                    });
                }

                if (opts.aggressive) {
                    // The lookarounds exclude hyphenated identifiers, so slugs such as
                    // "faerie-fire" and "fire-shield" survive intact.
                    prose = prose.replace(/(?<![\w-])fire(?![\w-])/gi, (match, offset, whole) => {
                        // Skip idiomatic uses ("set fire to", "on fire", "fire it", ...).
                        const window = whole.slice(Math.max(0, offset - 24), offset + 24);
                        if (PROSE_IDIOMS.some((re) => re.test(window))) return match;
                        return matchCase(match, TO);
                    });
                }

                return prose;
            });
        }

        return out;
    };

    /* ---------------------------------------------------------------------- */
    /* Recursive walk                                                         */
    /* ---------------------------------------------------------------------- */

    /** Merge IWR entries that collided after conversion (e.g. fire 10 + acid 5 -> acid 10). */
    const mergeIWR = (entries) => {
        const out = [];
        for (const entry of entries) {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
                out.push(entry);
                continue;
            }
            const existing = out.find((e) => e && typeof e === "object" && e.type === entry.type);
            if (!existing) {
                out.push(entry);
                continue;
            }
            // Keep the stronger value, and union the qualifier lists.
            if (typeof entry.value === "number" && typeof existing.value === "number") {
                existing.value = Math.max(existing.value, entry.value);
            } else if (typeof entry.value === "number") {
                existing.value = entry.value;
            }
            for (const key of ["exceptions", "doubleVs"]) {
                if (Array.isArray(entry[key]) || Array.isArray(existing[key])) {
                    existing[key] = [...new Set([...(existing[key] ?? []), ...(entry[key] ?? [])])];
                }
            }
        }
        return out;
    };

    /** Drop duplicate option objects (ChoiceSet choices, RollOption suboptions). */
    const dedupeByValue = (entries) => {
        const seen = new Set();
        return entries.filter((entry) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) return true;
            const key = typeof entry.value === "string" ? entry.value : null;
            if (key === null) return true;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    const IWR_KEYS = new Set(["immunities", "weaknesses", "resistances"]);
    const OPTION_KEYS = new Set(["choices", "suboptions"]);

    /**
     * Recursively convert a data structure.
     * @returns {{value: *, changed: number}} the converted value and a replacement count
     */
    const convertData = (data, opts, key = null) => {
        let changed = 0;

        if (typeof data === "string") {
            const next = convertString(data, opts);
            if (next !== data) changed += 1;
            return { value: next, changed };
        }

        if (Array.isArray(data)) {
            let arrayChanged = 0;
            const mapped = data.map((entry) => {
                const result = convertData(entry, opts, key);
                arrayChanged += result.changed;
                return result.value;
            });
            changed += arrayChanged;

            if (arrayChanged > 0) {
                // A converted array can now hold duplicates that did not exist before.
                if (IWR_KEYS.has(key)) return { value: mergeIWR(mapped), changed };
                if (OPTION_KEYS.has(key)) return { value: dedupeByValue(mapped), changed };
                if (mapped.every((entry) => typeof entry === "string")) {
                    return { value: [...new Set(mapped)], changed };
                }
            }
            return { value: mapped, changed };
        }

        // Accept null-prototype objects too: Foundry data models can produce them.
        const proto = data === null ? undefined : Object.getPrototypeOf(data);
        if (data && typeof data === "object" && (proto === Object.prototype || proto === null)) {
            const out = {};
            for (const [childKey, childValue] of Object.entries(data)) {
                if (SKIP_KEYS.has(childKey)) {
                    out[childKey] = childValue;
                    continue;
                }
                const result = convertData(childValue, opts, childKey);
                out[childKey] = result.value;
                changed += result.changed;
            }
            return { value: out, changed };
        }

        return { value: data, changed };
    };

    /**
     * Build a minimal update for a document source.
     * @returns {{update: object, changed: number}|null}
     */
    const buildUpdate = (source, opts, fields = ["system", "flags"]) => {
        const update = { _id: source._id };
        let changed = 0;

        for (const field of fields) {
            if (!(field in source) || source[field] === undefined) continue;
            const result = convertData(source[field], opts, field);
            if (result.changed > 0) {
                update[field] = result.value;
                changed += result.changed;
            }
        }

        if (opts.renameDocuments && typeof source.name === "string") {
            const next = source.name.replace(/\bFire\b/g, "Acid").replace(/\bfire\b/g, "acid");
            if (next !== source.name) {
                update.name = next;
                changed += 1;
            }
        }

        return changed > 0 ? { update, changed } : null;
    };

    /* ---------------------------------------------------------------------- */
    /* Dialog                                                                 */
    /* ---------------------------------------------------------------------- */

    const checkbox = (name, label, checked, hint = "") => `
        <div style="margin: 0.35rem 0;">
            <label style="display: flex; gap: 0.5rem; align-items: flex-start;">
                <input type="checkbox" name="${name}" ${checked ? "checked" : ""} style="margin-top: 0.25rem;">
                <span><strong>${label}</strong>${hint ? `<br><span style="opacity: 0.7; font-size: 0.9em;">${hint}</span>` : ""}</span>
            </label>
        </div>`;

    const content = `
        <p>Replaces fire damage, fire IWR and the fire trait with their acid equivalents
        throughout the selected documents.</p>
        <fieldset><legend>Scope</legend>
            ${checkbox("actors", "World actors", true, "Includes each actor's owned items.")}
            ${checkbox("items", "World items", true)}
            ${checkbox("tokens", "Unlinked scene tokens", true)}
            ${checkbox("journals", "Journal entries", true)}
            ${checkbox("packs", "Unlocked compendium packs", false, "World-owned packs only; locked packs are skipped.")}
        </fieldset>
        <fieldset><legend>Text</legend>
            ${checkbox("prose", "Convert description text", true, 'e.g. "6d6 fire damage" &rarr; "6d6 acid damage".')}
            ${checkbox("aggressive", "Convert every standalone &quot;fire&quot;", false, "Also rewrites flavour text. Best-effort: idioms such as &quot;set fire to&quot; are skipped, but review the results.")}
            ${checkbox("renameDocuments", "Rename documents", false, 'Standalone words only: "Wall of Fire" &rarr; "Wall of Acid". "Fireball" is left alone.')}
        </fieldset>
        <fieldset><legend>Execution</legend>
            ${checkbox("dryRun", "Dry run", true, "Report what would change without writing anything.")}
        </fieldset>`;

    const opts = await foundry.applications.api.DialogV2.wait({
        window: { title: "Fire → Acid: Element Swap" },
        position: { width: 520 },
        content,
        buttons: [
            {
                action: "run",
                label: "Run",
                default: true,
                callback: (_event, button) =>
                    Object.fromEntries(
                        Array.from(button.form.elements)
                            .filter((el) => el.name)
                            .map((el) => [el.name, el.checked]),
                    ),
            },
            { action: "cancel", label: "Cancel", callback: () => null },
        ],
        rejectClose: false,
    });

    if (!opts) return;

    /* ---------------------------------------------------------------------- */
    /* Execution                                                              */
    /* ---------------------------------------------------------------------- */

    const stats = { documents: 0, replacements: 0, byType: {} };
    const record = (type, changed) => {
        stats.documents += 1;
        stats.replacements += changed;
        stats.byType[type] = (stats.byType[type] ?? 0) + 1;
    };

    const commit = async (documentClass, updates, context = {}) => {
        if (opts.dryRun || updates.length === 0) return;
        try {
            await documentClass.updateDocuments(updates, { noHook: true, ...context });
        } catch (error) {
            console.error("Fire -> Acid | failed to apply a batch of updates", error, updates);
            ui.notifications.warn("Fire → Acid: a batch of updates failed. See the console.");
        }
    };

    /** Convert an actor's own data and its owned items. */
    const processActor = async (actor, context = {}) => {
        const source = actor.toObject();

        const actorResult = buildUpdate(source, opts);
        if (actorResult) {
            record("Actor", actorResult.changed);
            if (!opts.dryRun) {
                try {
                    await actor.update(actorResult.update, { noHook: true, ...context });
                } catch (error) {
                    console.error(`Fire -> Acid | failed to update actor ${actor.uuid}`, error);
                }
            }
        }

        const itemUpdates = [];
        for (const itemSource of source.items ?? []) {
            const result = buildUpdate(itemSource, opts);
            if (result) {
                record("Item (owned)", result.changed);
                itemUpdates.push(result.update);
            }
        }
        if (itemUpdates.length > 0 && !opts.dryRun) {
            try {
                await actor.updateEmbeddedDocuments("Item", itemUpdates, { noHook: true, ...context });
            } catch (error) {
                console.error(`Fire -> Acid | failed to update items on ${actor.uuid}`, error);
            }
        }
    };

    ui.notifications.info(`Fire → Acid: ${opts.dryRun ? "analysing" : "converting"} documents…`);

    // --- World actors ---
    if (opts.actors) {
        for (const actor of game.actors) {
            await processActor(actor);
        }
    }

    // --- World items ---
    if (opts.items) {
        const updates = [];
        for (const item of game.items) {
            const result = buildUpdate(item.toObject(), opts);
            if (result) {
                record("Item", result.changed);
                updates.push(result.update);
            }
        }
        await commit(Item, updates);
    }

    // --- Unlinked scene tokens (synthetic actors) ---
    if (opts.tokens) {
        for (const scene of game.scenes) {
            for (const token of scene.tokens) {
                const actor = token.actor;
                if (!actor?.isToken) continue;
                // Only synthetic actors carrying their own data need converting; the rest
                // inherit from a world actor that is handled above.
                const delta = token.delta?._source;
                const hasOwnData =
                    !!delta &&
                    (Object.keys(delta.system ?? {}).length > 0 ||
                        (delta.items ?? []).length > 0 ||
                        !!delta.flags?.pf2e);
                if (!hasOwnData) continue;
                await processActor(actor);
            }
        }
    }

    // --- Journal entries ---
    if (opts.journals) {
        for (const entry of game.journal) {
            const pageUpdates = [];
            for (const page of entry.pages) {
                const source = page.toObject();
                const result = buildUpdate(source, opts, ["text", "system", "flags"]);
                if (result) {
                    record("Journal page", result.changed);
                    pageUpdates.push(result.update);
                }
            }
            if (pageUpdates.length > 0 && !opts.dryRun) {
                try {
                    await entry.updateEmbeddedDocuments("JournalEntryPage", pageUpdates, { noHook: true });
                } catch (error) {
                    console.error(`Fire -> Acid | failed to update journal ${entry.uuid}`, error);
                }
            }
        }
    }

    // --- Unlocked world compendium packs ---
    if (opts.packs) {
        for (const pack of game.packs) {
            if (pack.locked) continue;
            if (!["Actor", "Item"].includes(pack.documentName)) continue;

            const documents = await pack.getDocuments();
            const updates = [];
            for (const document of documents) {
                const source = document.toObject();
                const result = buildUpdate(source, opts);
                if (result) {
                    // Owned items live inside the actor source for pack updates.
                    if (Array.isArray(source.items)) {
                        const items = [];
                        let itemChanges = 0;
                        for (const itemSource of source.items) {
                            const itemResult = buildUpdate(itemSource, opts);
                            if (itemResult) {
                                itemChanges += itemResult.changed;
                                items.push(foundry.utils.mergeObject(itemSource, itemResult.update));
                            } else {
                                items.push(itemSource);
                            }
                        }
                        if (itemChanges > 0) {
                            result.update.items = items;
                            result.changed += itemChanges;
                        }
                    }
                    record(`Pack: ${pack.metadata.id}`, result.changed);
                    updates.push(result.update);
                }
            }
            await commit(pack.documentClass, updates, { pack: pack.metadata.id });
        }
    }

    /* ---------------------------------------------------------------------- */
    /* Report                                                                 */
    /* ---------------------------------------------------------------------- */

    const breakdown = Object.entries(stats.byType)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `<li>${type}: ${count}</li>`)
        .join("");

    const heading = opts.dryRun ? "Fire → Acid (dry run)" : "Fire → Acid";
    const summary = stats.documents
        ? `<p>${opts.dryRun ? "Would update" : "Updated"} <strong>${stats.documents}</strong> document(s),
           <strong>${stats.replacements}</strong> replacement(s).</p><ul>${breakdown}</ul>`
        : "<p>Nothing to convert &mdash; no fire data found in the selected scope.</p>";

    const dryRunHint = opts.dryRun && stats.documents ? "<p><em>Nothing was written. Clear “Dry run” to apply.</em></p>" : "";

    console.log(`${heading} |`, stats);
    await ChatMessage.create({
        whisper: [game.user.id],
        content: `<h3>${heading}</h3>${summary}${dryRunHint}`,
    });
    ui.notifications.info(
        `Fire → Acid: ${stats.documents} document(s), ${stats.replacements} replacement(s).${opts.dryRun ? " (dry run)" : ""}`,
    );
})();
