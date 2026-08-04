import fs from "fs";
import path from "path";
import { sluggify } from "@util";
import { DamageTypeConverter } from "@scripts/macros/convert-damage-type/conversion.ts";

/**
 * The standalone macro at `build/standalone-macros/convert-damage-type.js` is a hand-maintained port of the system
 * source, meant for pasting into a Foundry Script macro. These tests load that file and check its conversion output
 * against the source implementation, so the two cannot drift apart unnoticed.
 */

const MACRO_PATH = path.resolve(__dirname, "../../build/standalone-macros/convert-damage-type.js");

/** Load the macro's converter by evaluating everything above its executable tail. */
function loadStandaloneConverter(): new (options: { from: string; to: string; prose?: boolean }) => {
    convertItemSource(source: object): { updates: Record<string, unknown>; changes: number; proseRewritten: boolean };
    convertActorSource(source: object): { updates: Record<string, unknown>; changes: number; proseRewritten: boolean };
    convertPlainName(name: string): string;
} {
    const contents = fs.readFileSync(MACRO_PATH, "utf-8");
    const tail = contents.indexOf("if (!game.user.isGM) {");
    if (tail === -1) throw new Error("Could not find the macro's executable tail");
    const definitions = contents.slice(0, tail);

    // The macro reaches for two globals that a Foundry client provides
    const factory = new Function("foundry", "game", `${definitions}\nreturn DamageTypeConverter;`) as (
        foundryGlobal: object,
        gameGlobal: object,
    ) => ReturnType<typeof loadStandaloneConverter>;

    return factory(
        { utils: { deepClone: (value: unknown) => fu.deepClone(value) } },
        { pf2e: { system: { sluggify } } },
    );
}

const StandaloneConverter = loadStandaloneConverter();

let cachedSources: { file: string; source: Record<string, unknown> }[] | null = null;

/** Every document source in the compendium packs, which is far broader than any hand-written fixture. */
function packSources(): { file: string; source: Record<string, unknown> }[] {
    if (cachedSources) return cachedSources;
    const root = path.resolve(__dirname, "../../packs/pf2e");
    const walk = (dir: string): string[] =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) return walk(full);
            return entry.name.endsWith(".json") && entry.name !== "_folders.json" ? [full] : [];
        });

    cachedSources = walk(root).flatMap((file) => {
        const source = JSON.parse(fs.readFileSync(file, "utf-8"));
        return source && typeof source === "object" && "system" in source ? [{ file, source }] : [];
    });
    return cachedSources;
}

describe("Standalone damage type conversion macro", () => {
    test("its converter matches the system implementation across every pack document", () => {
        const sources = packSources();
        expect(sources.length).toBeGreaterThan(1000);

        const options = { from: "fire", to: "acid" } as const;
        const reference = new DamageTypeConverter(options);
        const standalone = new StandaloneConverter(options);
        const mismatches: string[] = [];

        for (const { file, source } of sources) {
            const isActor = "items" in source;
            const expected = isActor ? reference.convertActorSource(source) : reference.convertItemSource(source);
            const actual = isActor ? standalone.convertActorSource(source) : standalone.convertItemSource(source);

            if (
                JSON.stringify(expected.updates) !== JSON.stringify(actual.updates) ||
                expected.changes !== actual.changes ||
                expected.proseRewritten !== actual.proseRewritten
            ) {
                if (mismatches.length < 5) mismatches.push(path.basename(file));
            }
        }

        expect(mismatches).toEqual([]);
    });

    test("its converter matches the system implementation with prose rewriting disabled", () => {
        const options = { from: "fire", to: "acid", prose: false } as const;
        const reference = new DamageTypeConverter(options);
        const standalone = new StandaloneConverter(options);
        const mismatches: string[] = [];

        for (const { file, source } of packSources()) {
            const isActor = "items" in source;
            const expected = isActor ? reference.convertActorSource(source) : reference.convertItemSource(source);
            const actual = isActor ? standalone.convertActorSource(source) : standalone.convertItemSource(source);

            if (JSON.stringify(expected.updates) !== JSON.stringify(actual.updates)) {
                if (mismatches.length < 5) mismatches.push(path.basename(file));
            }
        }

        expect(mismatches).toEqual([]);
    });

    test("it carries no import or export statements, which a Foundry macro cannot use", () => {
        const contents = fs.readFileSync(MACRO_PATH, "utf-8");

        expect(contents).not.toMatch(/^\s*import\s/m);
        expect(contents).not.toMatch(/^\s*export\s/m);
        expect(contents).not.toMatch(/\brequire\(/);
    });

    test("it compiles the way Foundry compiles a script macro", () => {
        const contents = fs.readFileSync(MACRO_PATH, "utf-8");
        // Foundry wraps a macro's command in an async function body, which is what makes its top-level `await` and
        // early `return` statements legal. Compiling it the same way proves the file is pasteable as-is.
        const AsyncFunction = async function (): Promise<void> {}.constructor as new (...args: string[]) => unknown;

        expect(() => new AsyncFunction("speaker", "actor", "token", "character", "scope", contents)).not.toThrow();
    });
});
