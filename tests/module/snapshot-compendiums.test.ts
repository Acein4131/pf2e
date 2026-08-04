import fs from "fs";
import path from "path";

/**
 * `build/standalone-macros/snapshot-compendiums.js` copies system and module packs into world compendiums, so that a
 * damage-type conversion can be confined to one world. Its naming and link-repointing logic is pure and is checked
 * here; the copying itself can only run inside Foundry.
 */

const MACRO_PATH = path.resolve(__dirname, "../../build/standalone-macros/snapshot-compendiums.js");

interface FakePack {
    metadata: { id: string; name: string; label: string; type: string; packageType: string; packageName: string };
}

interface MacroExports {
    targetName(pack: FakePack): string;
    targetLabel(pack: FakePack): string;
    buildLinkMap(packs: FakePack[]): Map<string, string>;
    rewriteLinks(source: Record<string, unknown>, linkMap: Map<string, string>): Record<string, unknown>;
    sourcePacksInScope(): FakePack[];
}

function loadMacro(packs: FakePack[] = []): MacroExports {
    const contents = fs.readFileSync(MACRO_PATH, "utf-8");
    const tail = contents.indexOf("if (!game.user.isGM) {");
    if (tail === -1) throw new Error("Could not find the macro's executable tail");

    const factory = new Function(
        "game",
        `${contents.slice(0, tail)}\nreturn { targetName, targetLabel, buildLinkMap, rewriteLinks, sourcePacksInScope };`,
    ) as (gameGlobal: object) => MacroExports;

    return factory({
        packs: {
            filter: (predicate: (pack: FakePack) => boolean) => {
                const kept = packs.filter(predicate);
                return Object.assign(kept, { sort: (fn: (a: FakePack, b: FakePack) => number) => [...kept].sort(fn) });
            },
        },
    });
}

const macro = loadMacro();

const pack = (overrides: Partial<FakePack["metadata"]>): FakePack => ({
    metadata: {
        id: "pf2e.spells-srd",
        name: "spells-srd",
        label: "Spells",
        type: "Item",
        packageType: "system",
        packageName: "pf2e",
        ...overrides,
    },
});

describe("Compendium snapshot", () => {
    describe("naming the copies", () => {
        test("derives a stable world pack name from the source", () => {
            expect(macro.targetName(pack({}))).toBe("acid-spells-srd");
            expect(macro.targetLabel(pack({}))).toBe("[Acid] Spells");
        });

        test("keeps a module's name in the copy, since pack names collide across packages", () => {
            const fromModule = pack({
                id: "sf2e-anachronism.equipment",
                name: "equipment",
                packageType: "module",
                packageName: "sf2e-anachronism",
            });
            const fromSystem = pack({ id: "pf2e.equipment", name: "equipment" });

            expect(macro.targetName(fromModule)).toBe("acid-sf2e-anachronism-equipment");
            expect(macro.targetName(fromSystem)).toBe("acid-equipment");
            expect(macro.targetName(fromModule)).not.toBe(macro.targetName(fromSystem));
        });

        test("produces a name Foundry will accept", () => {
            const awkward = pack({ name: "spells.srd v2", id: "pf2e.spells.srd v2" });
            expect(macro.targetName(awkward)).toMatch(/^[a-zA-Z0-9-]+$/);
        });

        test("is stable across runs, so an interrupted copy can resume", () => {
            expect(macro.targetName(pack({}))).toBe(macro.targetName(pack({})));
        });
    });

    describe("repointing links", () => {
        const packs = [pack({}), pack({ id: "pf2e.conditionitems", name: "conditionitems", label: "Conditions" })];
        const linkMap = macro.buildLinkMap(packs);

        test("points a link between copied documents at the copy", () => {
            const source = {
                name: "Fireball",
                system: {
                    description: {
                        value: "<p>See @UUID[Compendium.pf2e.conditionitems.Item.abc123]{Concealed} and this.</p>",
                    },
                },
            };
            const rewritten = macro.rewriteLinks(source, linkMap) as typeof source;

            expect(rewritten.system.description.value).toBe(
                "<p>See @UUID[Compendium.world.acid-conditionitems.Item.abc123]{Concealed} and this.</p>",
            );
        });

        test("leaves a link into a pack outside the run alone", () => {
            const source = { system: { description: { value: "@UUID[Compendium.pf2e.journals.JournalEntry.xyz]" } } };
            const rewritten = macro.rewriteLinks(source, linkMap) as typeof source;

            expect(rewritten.system.description.value).toBe("@UUID[Compendium.pf2e.journals.JournalEntry.xyz]");
        });

        test("repoints links buried in rule elements, not just prose", () => {
            const source = {
                system: {
                    rules: [{ key: "GrantItem", uuid: "Compendium.pf2e.spells-srd.Item.def456" }],
                },
            };
            const rewritten = macro.rewriteLinks(source, linkMap) as {
                system: { rules: { uuid: string }[] };
            };

            expect(rewritten.system.rules[0].uuid).toBe("Compendium.world.acid-spells-srd.Item.def456");
        });

        test("leaves _stats alone, so provenance still records the original", () => {
            const source = {
                name: "Fireball",
                _stats: { compendiumSource: "Compendium.pf2e.spells-srd.Item.abc123" },
                system: { description: { value: "@UUID[Compendium.pf2e.spells-srd.Item.abc123]" } },
            };
            const rewritten = macro.rewriteLinks(source, linkMap) as typeof source;

            expect(rewritten._stats.compendiumSource).toBe("Compendium.pf2e.spells-srd.Item.abc123");
            expect(rewritten.system.description.value).toBe("@UUID[Compendium.world.acid-spells-srd.Item.abc123]");
        });

        test("does not mutate the source it was given", () => {
            const source = { system: { description: { value: "@UUID[Compendium.pf2e.spells-srd.Item.abc]" } } };
            macro.rewriteLinks(source, linkMap);

            expect(source.system.description.value).toBe("@UUID[Compendium.pf2e.spells-srd.Item.abc]");
        });
    });

    describe("choosing packs", () => {
        test("takes actor and item packs from the configured packages only", () => {
            const packs = [
                pack({ id: "pf2e.spells-srd", name: "spells-srd" }),
                pack({ id: "pf2e.bestiary", name: "bestiary", type: "Actor" }),
                pack({ id: "pf2e.journals", name: "journals", type: "JournalEntry" }),
                pack({ id: "mod.extra", name: "extra", packageType: "module", packageName: "mod" }),
                pack({ id: "world.mine", name: "mine", packageType: "world", packageName: "world" }),
            ];

            expect(
                loadMacro(packs)
                    .sourcePacksInScope()
                    .map((p) => p.metadata.id),
            ).toEqual(["pf2e.bestiary", "pf2e.spells-srd"]);
        });
    });

    test("compiles the way Foundry compiles a script macro, with no imports", () => {
        const contents = fs.readFileSync(MACRO_PATH, "utf-8");
        const AsyncFunction = async function (): Promise<void> {}.constructor as new (...args: string[]) => unknown;

        expect(contents).not.toMatch(/^\s*import\s/m);
        expect(contents).not.toMatch(/^\s*export\s/m);
        expect(() => new AsyncFunction("speaker", "actor", "token", "character", "scope", contents)).not.toThrow();
    });

    test("never writes to the packs it copies from", () => {
        const contents = fs.readFileSync(MACRO_PATH, "utf-8");
        // Every write targets the newly created pack; the sources are only ever read
        expect(contents).not.toMatch(/\bpack\.(?:configure|deleteCompendium)\(/);
        expect(contents).not.toMatch(/pack: pack\.metadata\.id/);
        expect(contents).toMatch(/pack\.getDocuments\(\)/);
    });
});
