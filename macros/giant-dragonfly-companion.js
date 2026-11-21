/**
 * Giant Dragonfly animal companion (Feybound pg. 24) for "PF2e Companion Compendia"
 * (module id: pf2e-animal-companions).
 *
 * HOW TO USE
 *   1. Enable the PF2e Companion Compendia module in your world.
 *   2. As a GM, create a new Macro (type: Script), paste this whole file in, and run it.
 *   3. Open the "Custom Companions" folder in the Items sidebar and drag the
 *      "Giant Dragonfly" ancestry onto your companion actor, the same way you would
 *      drag an ancestry from the module's "Animal Companion Ancestries" compendium.
 *
 * The macro creates three world Items:
 *   - Giant Dragonfly (ancestry): stats, mandible Strike, Grab, speeds, senses
 *   - Giant Dragonfly Support Benefit (action)
 *   - Dragonfly Swoop (action): the advanced maneuver, granted by the module's
 *     "Advanced Maneuver" feature when the companion becomes specialized/advanced
 *
 * Running it again updates those items in place instead of creating copies.
 */

(async () => {
    const MODULE_ID = "pf2e-animal-companions";
    const FOLDER_NAME = "Custom Companions";
    const FLAG_SCOPE = "world";
    const FLAG_KEY = "customCompanion";

    if (!game.user.isGM) {
        return ui.notifications.error("Only a GM can run this macro.");
    }
    if (!game.modules.get(MODULE_ID)?.active) {
        return ui.notifications.error("Enable the PF2e Companion Compendia module first.");
    }

    // UUIDs from the PF2e system and the companion module
    const UUID = {
        animalCompanionFeature: `Compendium.${MODULE_ID}.AC-Features.Item.KKOgokqHa7RjVDN6`,
        grab: "Compendium.pf2e.bestiary-ability-glossary-srd.Item.Tkd8sH4pwFIPzqTr",
        fly: "Compendium.pf2e.actionspf2e.Item.cS9nfDRGD83bNU1p",
        grabbed: "Compendium.pf2e.conditionitems.Item.kWc1fhmv9LBiTuei",
        restrained: "Compendium.pf2e.conditionitems.Item.VcDeM8A5oI6VqhbM",
    };

    const publication = { title: "Pathfinder Feybound", authors: "", license: "ORC", remaster: true };

    // Find or create the folder for our items
    let folder = game.folders.find((f) => f.type === "Item" && f.name === FOLDER_NAME);
    folder ??= await Folder.create({ name: FOLDER_NAME, type: "Item" });

    /** Create the item, or update it if this macro already made it. Returns the Item. */
    async function upsert(key, data) {
        data.folder = folder.id;
        data.flags = { [FLAG_SCOPE]: { [FLAG_KEY]: key } };
        const existing = game.items.find((i) => i.getFlag(FLAG_SCOPE, FLAG_KEY) === key);
        if (existing) {
            await existing.update(data, { diff: false, recursive: false });
            return existing;
        }
        return Item.create(data);
    }

    // ----- Support Benefit -----
    const supportText =
        "<p>Your dragonfly darts around your foes, ready to reposition itself. Until the start of your next turn, " +
        "each time you hit and deal damage to a creature within your dragonfly's reach, the dragonfly can " +
        `@UUID[${UUID.fly}]{Fly} as a free action. If the dragonfly has a creature ` +
        `@UUID[${UUID.grabbed}]{Grabbed} or @UUID[${UUID.restrained}]{Restrained}, it can carry that creature ` +
        "with it, treating all spaces as difficult terrain.</p>";

    const support = await upsert("giant-dragonfly-support-benefit", {
        name: "Giant Dragonfly Support Benefit",
        type: "action",
        img: "systems/pf2e/icons/actions/OneAction.webp",
        system: {
            description: { gm: "", value: supportText },
            rules: [],
            slug: "giant-dragonfly-support-benefit",
            traits: { otherTags: [], value: [] },
            publication,
            actionType: { value: "action" },
            category: "offensive",
            actions: { value: 1 },
        },
    });

    // ----- Advanced Maneuver: Dragonfly Swoop -----
    const maneuver = await upsert("dragonfly-swoop", {
        name: "Dragonfly Swoop",
        type: "action",
        img: "systems/pf2e/icons/actions/TwoActions.webp",
        system: {
            description: {
                gm: "",
                value:
                    `<p>The giant dragonfly @UUID[${UUID.fly}]{Flies} and makes a mandible Strike ` +
                    "at any point during its movement.</p>",
            },
            rules: [],
            slug: "dragonfly-swoop",
            traits: { otherTags: [], value: [] },
            publication,
            actionType: { value: "action" },
            category: "offensive",
            actions: { value: 2 },
        },
    });

    // ----- Ancestry -----
    const description =
        "<p>This insect's compound eyes and quiet yet powerful wings make it an excellent aerial hunter.</p>" +
        "<p><strong>Size</strong> Medium</p>" +
        '<p><strong>Melee</strong> <span class="pf2-icon">1</span> mandible, <strong>Damage</strong> 1d6 piercing plus ' +
        `@UUID[${UUID.grab}]{Grab}</p>` +
        "<p><strong>Str</strong> +3, <strong>Dex</strong> +3, <strong>Con</strong> +1, <strong>Int</strong> -4, " +
        "<strong>Wis</strong> +1, <strong>Cha</strong> +0</p>" +
        "<p><strong>Hit Points</strong> 4</p>" +
        "<p><strong>Skill</strong> Stealth</p>" +
        "<p><strong>Senses</strong> darkvision</p>" +
        "<p><strong>Speed</strong> 20 feet, fly 60 feet</p>" +
        `<p><strong>Support Benefit</strong> @UUID[${support.uuid}]{Giant Dragonfly Support Benefit}</p>` +
        `<p><strong>Advanced Maneuver</strong> @UUID[${maneuver.uuid}]{Dragonfly Swoop}</p>`;

    const abilityMod = (ability, value) => ({
        key: "ActiveEffectLike",
        mode: "add",
        path: `system.abilities.${ability}.mod`,
        value,
    });

    await upsert("giant-dragonfly-ancestry", {
        name: "Giant Dragonfly",
        type: "ancestry",
        img: "systems/pf2e/icons/default-icons/ancestry.svg",
        system: {
            description: { gm: "", value: description },
            rules: [
                // Animal companion base feature from the module (proficiencies, level scaling, etc.)
                { key: "GrantItem", uuid: UUID.animalCompanionFeature },
                abilityMod("str", 3),
                abilityMod("dex", 3),
                abilityMod("con", 1),
                abilityMod("int", -4),
                abilityMod("wis", 1),
                { key: "ActiveEffectLike", mode: "add", path: "system.skills.stealth.rank", value: 1 },
                { key: "BaseSpeed", selector: "fly", value: 60 },
                {
                    key: "Strike",
                    label: "Mandible",
                    category: "unarmed",
                    group: "brawling",
                    range: null,
                    traits: ["unarmed"],
                    damage: { base: { damageType: "piercing", dice: 1, die: "d6" } },
                    img: "systems/pf2e/icons/unarmed-attacks/mandibles.webp",
                    replaceBasicUnarmed: true,
                },
                { key: "GrantItem", uuid: support.uuid },
                { key: "GrantItem", uuid: UUID.grab },
                {
                    key: "ActiveEffectLike",
                    mode: "override",
                    path: "flags.system.companionCompendia.advancedManeuver",
                    value: maneuver.uuid,
                },
            ],
            slug: "giant-dragonfly",
            traits: { otherTags: [], value: ["animal"], rarity: "common" },
            publication,
            hp: 4,
            size: "med",
            hands: 2,
            reach: 5,
            speed: 20,
            vision: "darkvision",
            boosts: { 0: { value: [] }, 1: { value: [] }, 2: { value: [] } },
            flaws: { 0: { value: [] } },
            languages: { value: [], custom: "" },
            additionalLanguages: { count: 0, value: [], custom: "" },
            items: {},
        },
    });

    ui.notifications.info(`Giant Dragonfly companion created in the "${FOLDER_NAME}" Items folder.`);
})();
