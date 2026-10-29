# +1 Spinner Evolution

A browser remake of the Roblox game *+1 Spinner Evolution*: train your spinners, battle
through stages for wins, buy better spinners, level up to equip more, rebirth for
multipliers. Nothing is sold for Bux - everything is earned with wins and rebirths.

- `client/` - React + react-three-fiber game (Vite). Boxity SDK (`window.Legion.SDK`) for
  login, avatars, ads, leaderboards, emotes and chat.
- `server/` - Colyseus 0.18 authoritative game server (saves, economy, battles).
- `shared/` - game data, formulas, map layout and network protocol, used by both.

## Run it

```bash
# 1. Game server (port 3000)
cd server
npm install
npm run dev

# 2. Client (port 5173), in another terminal
cd client
npm install
cp .env.example .env      # then set VITE_GAME_SLUG
npm run dev
```

Production: `cd client && npm run build`, then `cd server && npm start` - the server also
serves `client/dist`, gzipped, on the same port. Saves are written to `server/data/`
(set `DATA_DIR` to move them).

## Layout

From the spawn point: the Stage 1 gate straight ahead with every Grassland stage lined up
behind it, the TRAIN POWER arch behind you with the eight training rings in one row past it
(each ring's pad in front of it), the Spinners Shop on the left (one pad per
spinner, four per tier; stand at a pad and press E, or tap, to buy the spinner spinning on
it), the leaderboards on the right and the Worlds portal (Lava, Galaxy) front-left. Stone
mountains ring the island, open at the front
where the stage line runs out.

The team's slots sit under the level bar: click one to choose the spinner in it; locked
ones say what unlocks them. AUTO WIN is switched on and off in the Rebirth panel.

Each lobby is one Colyseus `world` room of up to 8 players (`maxClients` in
`server/src/rooms/WorldRoom.js`); `joinOrCreate` opens a fresh lobby for the ninth.

The server is built not to go down: every message handler and every player's tick runs
in its own try/catch, rooms log anything else through `onUncaughtException`, and the
process logs (and saves) on uncaught errors instead of exiting. In production run
`npm run start:safe`, which restarts the server if the process itself ever dies.

The HUD has three arrangements (`client/src/ui/kit/layout.js`), all following Slide
Downhill: desktop, phone landscape and portrait. The top-left corner is kept clear for
the platform's logos.

Walk into a stage and stand on its blue pad to fight. Winning opens the next stage's gate;
the yellow Return pad before it cashes out the run. Each stage's champion stands on the red
pad: a Bloxity avatar (the same `player.glb` rig players use) whose jersey, cap and number
are painted at runtime in `client/src/game/world/parts/championParts.js`.

The look is shared with the studio's +1 Slide Downhill: every world colour comes from
`client/src/game/sceneStyle.js`, and the HUD is built from the same UI kit
(`client/src/ui/kit/`: chunky buttons, outlined Fredoka One text, SVG icons). Change colours
and buttons there, not in individual files.

## Boxity

All of it is in `client/src/bloxity/` (`platform.js` wires ads, leaderboards, emotes,
chat and settings) and `server/src/bloxity.js`. Notes and answers are in
`BLOXITY_CODE_METADATA.md`.

- **Environment:** Boxity tells the game whether it is on prod, stage or local
  (`client/src/bloxity/environment.js`; on the server, `BLOXITY_*` variables). Never
  write a Boxity host name anywhere else. The Vite dev server says "local".
- **Hosting:** set `VITE_BLOXITY_HOSTING_ID` and every connect goes through Boxity's
  matchmaker. Never point the client at `<id>.host.bloxity.io`.
- **Sign-in:** the server checks each player's Boxity token with Boxity (`onAuth`). A
  guest who signs in keeps their progress if the account has none here yet.
- **Deploy:** `.github/workflows/deploy.yml`. `main` ships production and `dev` the
  playtest channel, to prod and (with the stage token) stage.
  - Secret `LEGION_DEPLOY_TOKEN` (from hosting.bloxity.io).
  - Secret `LEGION_DEPLOY_TOKEN_STAGE` (optional, from hosting.stage.bloxity.io).
  - Variables `BLOXITY_GAME_ID` (the hosting id) and `BLOXITY_GAME_SLUG`.
  - After the first push, make the `<gameId>-server` package on GHCR public.

## Checks

```bash
cd server && npm test                       # smoke test (needs the server running)
cd server && npm run test:fuzz              # floods every message with junk; server must survive
node scripts/simulate-balance.mjs 40        # plays 40h of progression, prints the pacing
cd server && node scripts/battle-calibration.js
cd client && npm run perf                   # draw calls / triangles / FPS / load time
```

`npm run perf` needs the server started with `ALLOW_CHEATS=1` (to unlock late worlds in
the test) and serving a build: `GAME_URL=http://localhost:3000/?debug npm run perf`.
Never set `ALLOW_CHEATS` in production.

## Tuning

Every number lives in `shared/content.js` (spinners, shop tiers and prices, trails, auras, worlds,
gifts) and `shared/formulas.js` (`TUNING`: level curve, stage strength, rewards). Run the
balance simulator after changing them.
