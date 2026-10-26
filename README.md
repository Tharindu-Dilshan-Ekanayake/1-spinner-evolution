# +1 Spinner Evolution

A browser remake of the Roblox game *+1 Spinner Evolution*: train your spinners, battle
through stages for wins, unbox better spinners, level up to equip more, rebirth for
multipliers. Includes a Halloween event world. Nothing is sold for Bux - everything is
earned with wins, candy and rebirths.

- `client/` - React + react-three-fiber game (Vite). Bloxity SDK for login and avatars.
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
behind it, the TRAIN POWER rings behind you, the Wins Shop on the left, the leaderboards
on the right, and the Worlds portal (Lava, Galaxy, Halloween) beside the Stage 1 gate.

Touch a gate's glass to fight that stage from the blue pad behind it. Winning opens the
gate; the yellow Return pad before the next gate cashes out the run.

## Checks

```bash
cd server && npm test                       # smoke test (needs the server running)
node scripts/simulate-balance.mjs 40        # plays 40h of progression, prints the pacing
cd server && node scripts/battle-calibration.js
cd client && npm run perf                   # draw calls / triangles / FPS / load time
```

`npm run perf` needs the server started with `ALLOW_CHEATS=1` (to unlock late worlds in
the test) and serving a build: `GAME_URL=http://localhost:3000/?debug npm run perf`.
Never set `ALLOW_CHEATS` in production.

## Tuning

Every number lives in `shared/content.js` (spinners, capsules, trails, auras, worlds,
gifts) and `shared/formulas.js` (`TUNING`: level curve, stage strength, rewards). Run the
balance simulator after changing them.
