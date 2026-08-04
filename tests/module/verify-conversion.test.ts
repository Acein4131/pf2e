import fs from "fs";
import path from "path";
import { sluggify } from "@util";

/**
 * `build/standalone-macros/verify-conversion.js` finds documents left behind by a damage-type conversion, so that a
 * package reinstall can be confirmed. It leans on one fingerprint — an explicit slug that no longer matches the
 * document's name — so these tests check that signal against every document the system ships, where it must never
 * fire, as well as against the shapes a conversion produces.
 */

const MACRO_PATH = path.resolve(__dirname, "../../build/standalone-macros/verify-conversion.js");

interface MacroExports {
    looksConverted(name: unknown, slug: unknown): boolean;
}

function loadMacro(): MacroExports {
    const contents = fs.readFileSync(MACRO_PATH, "utf-8");
    const tail = contents.indexOf("if (!game.user.isGM) {");
    if (tail === -1) throw new Error("Could not find the macro's executable tail");

    const factory = new Function("game", `${contents.slice(0, tail)}\nreturn { looksConverted };`) as (
        gameGlobal: object,
    ) => MacroExports;

    return factory({ pf2e: { system: { sluggify } } });
}

const macro = loadMacro();

describe("Leftover conversion detection", () => {
    test("recognizes a renamed document by its pinned slug", () => {
        // The conversion renames the document and pins the slug its old name derived
        expect(macro.looksConverted("Acidball", "fireball")).toBe(true);
        expect(macro.looksConverted("Corrosive Bolt", "blazing-bolt")).toBe(true);
    });

    test("does not fire on an untouched document", () => {
        expect(macro.looksConverted("Fireball", "fireball")).toBe(false);
        expect(macro.looksConverted("Alchemist's Fire (Lesser)", "alchemists-fire-lesser")).toBe(false);
    });

    test("does not fire when there is no explicit slug to compare against", () => {
        // Most documents derive their slug from their name, so the index reports nothing
        expect(macro.looksConverted("Fireball", null)).toBe(false);
        expect(macro.looksConverted("Fireball", undefined)).toBe(false);
        expect(macro.looksConverted("Fireball", "")).toBe(false);
    });

    test("does not fire on missing or malformed names", () => {
        expect(macro.looksConverted(undefined, "fireball")).toBe(false);
        expect(macro.looksConverted("", "fireball")).toBe(false);
    });

    const packDocuments = (): { name: string; slug: unknown; embedded: boolean }[] => {
        const root = path.resolve(__dirname, "../../packs/pf2e");
        const walk = (dir: string): string[] =>
            fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) return walk(full);
                return entry.name.endsWith(".json") && entry.name !== "_folders.json" ? [full] : [];
            });

        return walk(root).flatMap((file) => {
            const source = JSON.parse(fs.readFileSync(file, "utf-8"));
            if (!source?.system) return [];
            const own = { name: source.name, slug: source.system?.slug, embedded: false };
            const owned = (source.items ?? []).map((i: { name: string; system?: { slug?: unknown } }) => ({
                name: i.name,
                slug: i.system?.slug,
                embedded: true,
            }));
            return [own, ...owned];
        });
    };

    test("never fires on any top-level document the system ships", () => {
        // These are exactly what a compendium index returns, and so exactly what the macro checks
        const documents = packDocuments().filter((d) => !d.embedded);
        const falsePositives = documents
            .filter((d) => macro.looksConverted(d.name, d.slug))
            .map((d) => `${d.name} (${String(d.slug)})`);

        expect(documents.length).toBeGreaterThan(20000);
        expect(falsePositives).toEqual([]);
    });

    test("would fire on items owned by an actor, which is why those are never checked", () => {
        // A graveknight's abilities are namespaced, and some slugs outlive a rename: the fingerprint cannot apply here
        const embedded = packDocuments().filter((d) => d.embedded);
        const wouldMisfire = embedded.filter((d) => macro.looksConverted(d.name, d.slug));

        expect(wouldMisfire.length).toBeGreaterThan(0);
        // The macro reads compendium indexes, which never list owned items, and skips actor items in the world
        const contents = fs.readFileSync(MACRO_PATH, "utf-8");
        expect(contents).not.toMatch(/for\s*\(\s*const\s+item\s+of\s+actor\.items\s*\)/);
    });

    test("is read-only: it never updates, creates, or deletes anything", () => {
        const contents = fs.readFileSync(MACRO_PATH, "utf-8");

        expect(contents).not.toMatch(/updateDocuments\(/);
        expect(contents).not.toMatch(/createDocuments\(/);
        expect(contents).not.toMatch(/deleteDocuments\(/);
        expect(contents).not.toMatch(/updateEmbeddedDocuments\(/);
        expect(contents).not.toMatch(/\.configure\(/);
        expect(contents).not.toMatch(/\.updateSource\(/);

        // The only `update` calls belong to the progress notification, not to any document
        const updateCalls = contents.match(/([A-Za-z_$][\w$]*)\??\.update\(/g) ?? [];
        expect(updateCalls.every((call) => call.startsWith("notification"))).toBe(true);
    });

    test("compiles the way Foundry compiles a script macro, with no imports", () => {
        const contents = fs.readFileSync(MACRO_PATH, "utf-8");
        const AsyncFunction = async function (): Promise<void> {}.constructor as new (...args: string[]) => unknown;

        expect(contents).not.toMatch(/^\s*import\s/m);
        expect(contents).not.toMatch(/^\s*export\s/m);
        expect(() => new AsyncFunction("speaker", "actor", "token", "character", "scope", contents)).not.toThrow();
    });
});
