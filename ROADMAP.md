# Wordlink Roadmap

## Vision

Wordlink is a fast, social word game built around compound-word chains.

Players take turns extending the chain by using the ending word from the previous compound as the starting word for a new one.

Example:

```text
side line -> line dance -> dance off -> off road -> road rage
```

The goal is to make Wordlink feel like a modern word board game: simple rules, quick turns, satisfying tiles, and enough flexibility that valid-but-unexpected words do not kill the fun.

## Current State

The app currently supports:

- two-player rooms
- room codes
- live turn sync with Server-Sent Events
- randomized starting compounds
- timers
- target score selection
- 2-point ending-word plays
- 1-point starting-word fallback plays
- repeated-link blocking
- known compound validation
- closed-compound validation, such as `out + side = outside`
- opponent review for unknown links
- accept/challenge flow for unknown links
- rematches
- Railway deployment config
- health endpoint at `/api/health`

Local app path:

```text
C:\Users\json\Project Folder\wordlink
```

GitHub repo:

```text
https://github.com/jshankar0811/wordlink
```

## Game Rules

- The game starts with a random compound.
- The active prompt is the second part of that compound.
- The next player submits one word to complete a new compound.
- Using the ending word from the previous compound is worth 2 points.
- If a player is stuck, they can use the starting word from the previous compound for 1 point.
- If the app recognizes the link, it is accepted automatically.
- If the app does not recognize the link, the opponent can accept or challenge it.
- If accepted, the chain continues.
- If challenged, the submitter loses the round.
- Reusing a link is not allowed.
- The first player to reach the agreed target score wins.
- Running out of time loses the round.

## Validation Model

Wordlink currently validates a move using three layers:

1. Curated compound pairs in `data/compounds.json`
2. Closed joined compounds in `data/joined-words.json`
3. Opponent acceptance for unknown links

This is intentionally flexible. A perfect dictionary is not required for the MVP because social acceptance keeps the round moving.

Future validation improvements:

- expand the closed-compound dictionary
- add an admin-reviewed accepted-word history
- add a stricter ranked mode dictionary
- optionally check definitions through a dictionary API
- distinguish open, closed, and hyphenated compounds in the UI

## Product Direction

The current frontend direction is Wordle-inspired, but not a clone.

Style goals:

- clean word tiles
- large active prompt
- warm off-white background
- green/gold/blue status colors
- tactile board-game feel
- mobile-first layout
- minimal decoration

Core UX improvements to consider next:

- disable the play input while waiting for Player B
- show clearer copy/share room affordances
- add a pre-game confirmation step once both players join
- add a visible "waiting for opponent" state after submitting an unknown link
- add sound and subtle tile animations
- add a short rules modal
- add a post-game chain recap
- improve mobile spacing and button ergonomics

## Multiplayer Notes

Rooms are currently stored in memory on the Node server.

This is fine for MVP testing, but it means:

- rooms disappear if the server restarts
- only one running server instance should be used
- horizontal scaling would need shared state

Before a real launch, move room state to one of:

- Redis
- Supabase
- Firebase
- Postgres with realtime updates

## Deployment

Railway is the current intended deployment target.

The repo includes `railway.json`.

Expected Railway settings:

```text
Build command: npm install
Start command: npm start
Healthcheck path: /api/health
```

After Railway deployment, use the public Railway domain as the shared game URL.

## Near-Term Next Steps

1. Deploy the GitHub repo to Railway.
2. Generate a public Railway domain.
3. Test a full two-device game from the public URL.
4. Fix any live sync or mobile UI issues.
5. Add clearer waiting/review states.
6. Expand the word banks based on real playtesting misses.
7. Decide whether to build mobile packaging with Capacitor.

## Longer-Term Ideas

- daily chain challenge
- solo streak mode
- pass-and-play mode
- party room with looser validation
- ranked strict mode
- friend invites
- accounts and stats
- custom word packs
- AI opponent
- hints
- shareable game recap
- app icon and splash screen
- App Store / Google Play packaging

## Handoff Notes For Future Codex Sessions

Start by checking:

```bash
cd "C:\Users\json\Project Folder\wordlink"
git status -sb
npm start
```

Then open:

```text
http://localhost:3000
```

Important files:

- `server.js`: game server, rooms, validation, review flow
- `public/app.js`: browser-side game state and controls
- `public/index.html`: lobby and game markup
- `public/styles.css`: visual design
- `data/compounds.json`: open compound pair bank
- `data/joined-words.json`: closed compound dictionary
- `railway.json`: Railway deployment config

Current design philosophy:

Keep the MVP simple, playable, and social. Prefer improving the live game loop over adding accounts, stores, or monetization too early.
