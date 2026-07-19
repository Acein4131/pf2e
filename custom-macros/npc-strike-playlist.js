/**
 * NPC Strike -> Playlist trigger (PF2e / Foundry VTT)
 * ---------------------------------------------------
 * When a SPECIFIC NPC rolls to Strike (any attack roll), a SPECIFIC playlist
 * immediately starts playing.
 *
 * HOW IT WORKS
 * Every PF2e Strike creates a chat message whose flags contain
 * `flags.pf2e.context.type === "attack-roll"` together with the id of the actor
 * who made the attack. This script registers a `createChatMessage` hook, watches
 * for that signal, matches the acting NPC against your configured target, and
 * starts the configured playlist.
 *
 * INSTALL (as a Script Macro)
 *   1. In Foundry, open the Macro Directory -> Create Macro -> Type: "Script".
 *   2. Paste this entire file into the command box.
 *   3. Fill in the CONFIG section below (NPC + playlist).
 *   4. Save, then execute the macro ONCE (double-click it). It registers the
 *      hook and keeps running for the rest of the session.
 *
 *   The hook is cleared automatically on world reload/reconnect, so run the
 *   macro once each time you (re)load the world. To auto-run it every session,
 *   drag the macro to your hotbar and click it after login, or use a
 *   world-script module (e.g. "World Scripter") to load this file on `ready`.
 *
 * NOTES
 *   - Only ONE user needs to run this (recommend the GM) so the playlist starts
 *     once. By default it only fires for the GM to avoid every client starting
 *     the playlist; see `gmOnly` below.
 *   - Works for melee and ranged Strikes (both are attack rolls).
 */

// ============================ CONFIG ============================
const CONFIG_NPC_PLAYLIST = {
    // Identify the NPC. Use EITHER an actor UUID (most precise) OR a name match.
    // - Actor UUID example: "Actor.aBcD1234EfGh5678" or a token actor uuid.
    //   Right-click the actor in a sidebar -> "Copy Document UUID" (enable via
    //   the "Additional Core UUIDs" / dev context menu), or use the token.
    // - If actorUuid is left null, matching falls back to `npcName`
    //   (case-insensitive, matches the actor's name OR the token's name).
    actorUuid: null,
    npcName: "Boss Goblin", // <-- change to your NPC's name

    // The playlist to start. Use EITHER a playlist name OR its id.
    playlistName: "Boss Battle", // <-- change to your playlist's name
    playlistId: null,

    // If true (recommended), only the GM client triggers playback, so the
    // playlist starts exactly once. Set false to let any user trigger it.
    gmOnly: true,

    // If true, stop all other currently-playing playlists first.
    stopOthers: true,
};
// ===============================================================

(() => {
    const cfg = CONFIG_NPC_PLAYLIST;

    // Avoid registering the hook twice if the macro is run again this session.
    if (globalThis.__npcStrikePlaylistHookId != null) {
        Hooks.off("createChatMessage", globalThis.__npcStrikePlaylistHookId);
    }

    const findPlaylist = () => {
        if (cfg.playlistId) return game.playlists.get(cfg.playlistId) ?? null;
        if (cfg.playlistName) {
            return game.playlists.getName(cfg.playlistName)
                ?? game.playlists.find((p) => p.name?.toLowerCase() === cfg.playlistName.toLowerCase())
                ?? null;
        }
        return null;
    };

    const matchesNpc = (actor, message) => {
        if (!actor) return false;
        if (cfg.actorUuid) {
            // Match the base actor uuid or the synthetic token-actor's base actor.
            const baseUuid = actor.token?.baseActor?.uuid ?? actor.uuid;
            return actor.uuid === cfg.actorUuid || baseUuid === cfg.actorUuid;
        }
        if (cfg.npcName) {
            const want = cfg.npcName.toLowerCase();
            const actorName = actor.name?.toLowerCase();
            const tokenName = message?.speaker?.alias?.toLowerCase();
            return actorName === want || tokenName === want;
        }
        return false;
    };

    const hookId = Hooks.on("createChatMessage", async (message) => {
        try {
            if (cfg.gmOnly && !game.user.isGM) return;

            const ctx = message?.flags?.pf2e?.context;
            if (!ctx || ctx.type !== "attack-roll") return;

            // Resolve the acting actor: prefer the context actor id, fall back to speaker.
            const actor =
                (ctx.actor ? game.actors.get(ctx.actor) : null) ??
                ChatMessage.getSpeakerActor?.(message.speaker) ??
                (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null);

            if (!matchesNpc(actor, message)) return;

            const playlist = findPlaylist();
            if (!playlist) {
                ui.notifications.warn(
                    `NPC Strike Playlist: playlist "${cfg.playlistName ?? cfg.playlistId}" not found.`,
                );
                return;
            }

            if (cfg.stopOthers) {
                for (const p of game.playlists.playing) {
                    if (p.id !== playlist.id) await p.stopAll();
                }
            }

            if (!playlist.playing) await playlist.playAll();
        } catch (err) {
            console.error("NPC Strike Playlist trigger error:", err);
        }
    });

    globalThis.__npcStrikePlaylistHookId = hookId;

    const label = cfg.actorUuid ?? cfg.npcName ?? "(unset)";
    ui.notifications.info(
        `NPC Strike Playlist armed: "${label}" -> "${cfg.playlistName ?? cfg.playlistId}".`,
    );
})();
