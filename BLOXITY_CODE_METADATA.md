---
canDie: false
hasScore: true
---

# Boxity integration notes

Answers from the developer (2026-10-28) and what follows from them.

- **canDie: false.** Battles are won or lost by the spinners; the character never dies or
  respawns, so there is no death screen. Boxity's "Reset Character" (`respawn_request`)
  sends the player back to the lobby spawn.
- **hasScore: true.** Three boards, declared in `shared/platform.js` (`BOXITY_BOARDS`):
  - `wins`: Most Wins, lifetime wins earned (desc, best, compact)
  - `rebirths`: Most Rebirths (desc, best, number)
  - `playtime`: Minutes Played (desc, best, number)

  The client declares them (`Legion.SDK.leaderboard.define`, which shows the trophy
  button). The server submits the scores from its own state for players whose Boxity
  token it has verified, through the hosted report API (`server/src/bloxity.js`). It
  needs `BLOXITY_GAME_ID` and `BLOXITY_REPORT_TOKEN`, which Boxity hosting injects.
- **Hosting: not deployed yet.** The client already goes through
  `Legion.SDK.net.resolveEndpoint` as soon as `VITE_BLOXITY_HOSTING_ID` is set. Rooms
  hold 8 players (`maxClients`), so party play works once the game is hosted.
- **Gems: none.** Nothing is sold; `/api/legion-webhook` answers 2xx and grants nothing.
- **Rewarded ads: none.** No reward is earned by watching an ad. Ad breaks pause and mute
  the game; full-screen panels report a `panel` ad screen.
- **Emotes and chat:** Boxity draws the picker and the chat. The game plays emotes on the
  character (replicated to the room) and shows chat lines above heads.
