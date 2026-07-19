# Custom Macros

## NPC Strike → Playlist trigger

`npc-strike-playlist.js` makes a **specific playlist start immediately when a
specific NPC rolls to Strike** (melee or ranged) during play.

### How it works

Every PF2e Strike posts a chat message whose flags contain
`flags.pf2e.context.type === "attack-roll"` along with the id of the acting
actor. The script registers a `createChatMessage` hook, matches that acting NPC
against the one you configured, and starts your chosen playlist. Because it uses
a hook instead of editing the system source, it survives PF2e system updates.

### Setup

1. In Foundry, open the **Macro Directory → Create Macro** and set **Type:
   Script**.
2. Paste the full contents of `npc-strike-playlist.js` into the command box.
3. Edit the `CONFIG_NPC_PLAYLIST` block at the top:
   - **Which NPC** — set `actorUuid` (most precise) *or* `npcName`. `npcName`
     matches the actor's name or the token's name, case-insensitively.
   - **Which playlist** — set `playlistName` *or* `playlistId`.
   - `gmOnly` (default `true`) — only the GM client starts the playlist, so it
     plays exactly once. `stopOthers` (default `true`) stops other playing
     playlists first.
4. **Save**, then **double-click the macro once** to arm the hook. You'll see a
   "NPC Strike Playlist armed" notification.

### Notes

- The hook stays active until the world is reloaded/reconnected. Run the macro
  once each time you (re)load the world. To arm it automatically every session,
  keep it on your hotbar and click after login, or load the file on the `ready`
  hook via a world-script module such as **World Scripter**.
- Only one user (the GM) needs to run it. Running it again re-registers cleanly
  rather than stacking duplicate hooks.
