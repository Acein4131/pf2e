import fs from "fs";
import path from "path";

/**
 * `build/standalone-macros/convert-animations.js` recolors Automated Animations to match a converted damage type. Its
 * planning logic is pure, so it can be exercised here against a stubbed animation database — which matters, since the
 * macro itself can only be run inside Foundry.
 */

const MACRO_PATH = path.resolve(__dirname, "../../build/standalone-macros/convert-animations.js");

interface VideoDescriptor {
    dbSection?: string;
    menuType?: string;
    animation?: string;
    variant?: string;
    color?: string;
    enableCustom?: boolean;
    customPath?: string;
}

interface VideoPlan {
    action: "recolor" | "swap" | "unresolved" | "custom";
    updates?: Record<string, string>;
    before?: string;
    after?: string;
    path?: string;
}

interface Database {
    entryExists(path: string): boolean;
    childrenOf(prefix: string): string[];
}

interface MacroExports {
    planVideo(video: VideoDescriptor, db: Database, options: { from: string; to: string }): VideoPlan | null;
    planItem(
        source: object,
        db: Database,
        options: { from: string; to: string; onlyConverted: boolean; rewriteCustomPaths: boolean },
    ): { updates: Record<string, unknown>; changes: { action: string; section: string }[]; writes: number } | null;
    videoPath(video: VideoDescriptor, overrides?: VideoDescriptor): string;
    referencesDamageType(system: object, type: string): boolean;
    rewriteCustomPath(path: string, options: { from: string; to: string }): string;
    packsInScope(scope: string): { metadata: { id: string } }[];
}

function loadMacro(packs: { metadata: Record<string, string> }[] = []): MacroExports {
    const contents = fs.readFileSync(MACRO_PATH, "utf-8");
    const tail = contents.indexOf("if (!game.user.isGM) {");
    if (tail === -1) throw new Error("Could not find the macro's executable tail");
    const definitions = contents.slice(0, tail);

    const factory = new Function(
        "game",
        `${definitions}\nreturn { planVideo, planItem, videoPath, referencesDamageType, rewriteCustomPath, packsInScope };`,
    ) as (gameGlobal: object) => MacroExports;

    return factory({ packs: { filter: (p: (pack: unknown) => boolean) => packs.filter(p) } });
}

const macro = loadMacro();

/** A stand-in for the Sequencer database, built from a nested object whose leaves are entries. */
function makeDatabase(tree: object): Database {
    const at = (p: string): unknown =>
        p.split(".").reduce<unknown>((node, key) => {
            if (node && typeof node === "object" && key in node) return (node as Record<string, unknown>)[key];
            return undefined;
        }, tree);

    return {
        entryExists: (p) => at(p) !== undefined,
        childrenOf: (prefix) => {
            const node = at(prefix);
            return node && typeof node === "object" ? Object.keys(node) : [];
        },
    };
}

// Mirrors the real shape: database[section][type][animation][variant][color]
const db = makeDatabase({
    autoanimations: {
        spell: {
            fireball: {
                // A recolorable effect: it offers green
                explosion: { "01": { orange: true, green: true, blue: true } },
                // Fire-only colors, so this one has to be swapped
                beam: { "01": { orange: true, red: true } },
                // The acid effect available to swap to
                acid_splash: { "01": { green: true, blue: true } },
            },
            burning_hands: {
                // No acid sibling anywhere in this menu, and no green
                cone: { "01": { orange: true, red: true } },
            },
            // An effect whose colors sit directly under it, with no variant level, named unlike the preference list
            flame_jet: { jet: { Orange: true, GreenYellow: true } },
        },
    },
});

const options = { from: "fire", to: "acid" };

describe("Animation conversion planning", () => {
    describe("choosing a replacement", () => {
        test("recolors in place when the effect offers a suitable color", () => {
            const plan = macro.planVideo(
                { dbSection: "spell", menuType: "fireball", animation: "explosion", variant: "01", color: "orange" },
                db,
                options,
            );

            expect(plan?.action).toBe("recolor");
            expect(plan?.updates).toEqual({ color: "green" });
            expect(plan?.after).toBe("autoanimations.spell.fireball.explosion.01.green");
        });

        test("swaps the effect when no suitable color exists, keeping section and menu", () => {
            const plan = macro.planVideo(
                { dbSection: "spell", menuType: "fireball", animation: "beam", variant: "01", color: "orange" },
                db,
                options,
            );

            expect(plan?.action).toBe("swap");
            expect(plan?.updates).toEqual({ animation: "acid_splash", variant: "01", color: "green" });
            expect(plan?.after).toBe("autoanimations.spell.fireball.acid_splash.01.green");
        });

        test("reports the animation as unresolved when neither a color nor an effect is available", () => {
            const plan = macro.planVideo(
                { dbSection: "spell", menuType: "burning_hands", animation: "cone", variant: "01", color: "orange" },
                db,
                options,
            );

            expect(plan?.action).toBe("unresolved");
            expect(plan?.after).toBeUndefined();
        });

        test("matches colors regardless of case and separators, and with no variant level", () => {
            const plan = macro.planVideo(
                { dbSection: "spell", menuType: "flame_jet", animation: "jet", variant: "", color: "Orange" },
                db,
                options,
            );

            // "GreenYellow" in the database matches the "greenyellow" preference despite its casing
            expect(plan?.action).toBe("recolor");
            expect(plan?.updates).toEqual({ color: "GreenYellow" });
            expect(plan?.after).toBe("autoanimations.spell.flame_jet.jet.GreenYellow");
        });

        test("leaves an animation that does not depict the source type alone", () => {
            const plan = macro.planVideo(
                { dbSection: "spell", menuType: "fireball", animation: "explosion", variant: "01", color: "blue" },
                db,
                { from: "cold", to: "acid" },
            );
            // Blue is a cold color, but the effect is named for fire — with from: "cold" it still matches on color
            expect(plan?.action).toBe("recolor");

            const unrelated = macro.planVideo(
                { dbSection: "spell", menuType: "fireball", animation: "explosion", variant: "01", color: "blue" },
                db,
                { from: "poison", to: "acid" },
            );
            expect(unrelated).toBeNull();
        });

        test("builds paths without a hole when a coordinate is missing", () => {
            expect(macro.videoPath({ dbSection: "spell", menuType: "fireball", animation: "explosion" })).toBe(
                "autoanimations.spell.fireball.explosion",
            );
            expect(
                macro.videoPath({
                    dbSection: "spell",
                    menuType: "fireball",
                    animation: "explosion",
                    variant: "",
                    color: "green",
                }),
            ).toBe("autoanimations.spell.fireball.explosion.green");
        });
    });

    describe("choosing which items to touch", () => {
        const fireVideo = {
            dbSection: "spell",
            menuType: "fireball",
            animation: "explosion",
            variant: "01",
            color: "orange",
        };
        const acidItem = {
            name: "Acidball",
            system: { damage: { "0": { formula: "6d6", type: "acid" } } },
            flags: { autoanimations: { primary: { video: fireVideo } } },
        };

        test("plans every animation section of a converted item", () => {
            const source = {
                ...acidItem,
                flags: {
                    autoanimations: {
                        primary: { video: fireVideo },
                        secondary: { video: { ...fireVideo, animation: "beam" } },
                    },
                },
            };
            const result = macro.planItem(source, db, { ...options, onlyConverted: true, rewriteCustomPaths: false });

            expect(result?.updates).toEqual({
                "flags.autoanimations.primary.video.color": "green",
                "flags.autoanimations.secondary.video.animation": "acid_splash",
                "flags.autoanimations.secondary.video.variant": "01",
                "flags.autoanimations.secondary.video.color": "green",
            });
            expect(result?.changes.map((c) => c.action)).toEqual(["recolor", "swap"]);
        });

        test("skips an item that still deals the original damage type", () => {
            const stillFire = {
                name: "Fireball",
                system: { damage: { "0": { formula: "6d6", type: "fire" } } },
                flags: { autoanimations: { primary: { video: fireVideo } } },
            };

            expect(macro.planItem(stillFire, db, { ...options, onlyConverted: true, rewriteCustomPaths: false })).toBe(
                null,
            );
            // With the gate off, its animation is recolored like any other
            expect(
                macro.planItem(stillFire, db, { ...options, onlyConverted: false, rewriteCustomPaths: false })?.writes,
            ).toBe(1);
        });

        test("ignores an item with no animation configured", () => {
            const plain = { name: "Longsword", system: {}, flags: {} };
            expect(macro.planItem(plain, db, { ...options, onlyConverted: false, rewriteCustomPaths: false })).toBe(
                null,
            );
        });

        test("reports a custom file path but does not rewrite it by default", () => {
            const custom = {
                name: "Acid Jet",
                system: { damage: { "0": { formula: "2d6", type: "acid" } } },
                flags: {
                    autoanimations: {
                        primary: {
                            video: {
                                enableCustom: true,
                                customPath: "modules/jb2a_patreon/Fire_Jet_Orange_800x600.webm",
                            },
                        },
                    },
                },
            };

            const reported = macro.planItem(custom, db, { ...options, onlyConverted: true, rewriteCustomPaths: false });
            expect(reported?.changes[0].action).toBe("custom");
            expect(reported?.writes).toBe(0);

            const rewritten = macro.planItem(custom, db, { ...options, onlyConverted: true, rewriteCustomPaths: true });
            expect(rewritten?.updates["flags.autoanimations.primary.video.customPath"]).toBe(
                "modules/jb2a_patreon/Fire_Jet_Green_800x600.webm",
            );
        });
    });

    describe("supporting helpers", () => {
        test("recognizes a damage type in structured item data", () => {
            expect(macro.referencesDamageType({ damage: { "0": { type: "acid" } } }, "acid")).toBe(true);
            expect(macro.referencesDamageType({ damage: { damageType: "acid" } }, "acid")).toBe(true);
            expect(macro.referencesDamageType({ traits: { value: ["acid", "manipulate"] } }, "acid")).toBe(true);
            expect(macro.referencesDamageType({ description: { value: "@Damage[2d6[acid]]" } }, "acid")).toBe(true);
            expect(macro.referencesDamageType({ damage: { "0": { type: "fire" } } }, "acid")).toBe(false);
        });

        test("swaps color words in a custom path, preserving capitalization", () => {
            expect(macro.rewriteCustomPath("jb2a/Fire_Bolt_ORANGE_01.webm", options)).toBe(
                "jb2a/Fire_Bolt_Green_01.webm",
            );
            // A color word inside a longer word is not a color
            expect(macro.rewriteCustomPath("jb2a/Redcap_Attack.webm", options)).toBe("jb2a/Redcap_Attack.webm");
        });

        test("compiles the way Foundry compiles a script macro, with no imports", () => {
            const contents = fs.readFileSync(MACRO_PATH, "utf-8");
            const AsyncFunction = async function (): Promise<void> {}.constructor as new (...args: string[]) => unknown;

            expect(contents).not.toMatch(/^\s*import\s/m);
            expect(contents).not.toMatch(/^\s*export\s/m);
            expect(() => new AsyncFunction("speaker", "actor", "token", "character", "scope", contents)).not.toThrow();
        });

        test("selects only actor and item compendiums, by scope", () => {
            const packs = [
                { metadata: { type: "Item", packageType: "world", id: "world.items" } },
                { metadata: { type: "Actor", packageType: "system", id: "pf2e.bestiary" } },
                { metadata: { type: "JournalEntry", packageType: "system", id: "pf2e.journals" } },
            ];
            const scoped = (scope: string): string[] =>
                loadMacro(packs)
                    .packsInScope(scope)
                    .map((p) => p.metadata.id);

            expect(scoped("none")).toEqual([]);
            expect(scoped("world")).toEqual(["world.items"]);
            expect(scoped("all")).toEqual(["world.items", "pf2e.bestiary"]);
        });
    });
});
