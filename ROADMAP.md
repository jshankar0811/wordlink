# Wordlink TODO and Handoff Log

Updated November 17, 2026.

## Current release

Wordlink is a playable two-player beta. The core flows have been exercised individually. A complete multi-device, interruption, security, and load-testing pass is still pending.

- [x] Deploy the app from GitHub to Railway with a health check.
- [x] Add a homepage with Create Game, Join Game, and Instructions views.
- [x] Add 36 enlarged head portraits and remove the six emoji choices.
- [x] Repair the avatar PNG transparency and visually check the artwork.
- [x] Create and join two-player rooms using room codes.
- [x] Synchronize turns, scores, and the chain with Server-Sent Events.
- [x] Support turn timers, target scores, and rematches.
- [x] Award 2 points for ending-word links and 1 point for starting-word links.
- [x] Validate curated open and closed compounds and block repeated links.
- [x] Let opponents accept or challenge unfamiliar links.
- [x] Remove word suggestions during play.
- [x] Let a player spend 6 points to choose a new starting word and pass the turn.
- [x] Add Mini Wordle, Anagram, and Missing Letters as ways to earn a free new word.
- [x] Pause the normal timer for one 60-second minigame attempt per turn.
- [x] Expand the puzzle pool to 121 Wordle answers, 40 Anagrams, and 40 Missing Letters puzzles.
- [x] Use each minigame's pool before repeating a puzzle within a round.
- [x] Fix the four-letter Wordle input after a six-letter minigame and verify the transition in Chrome.

The design uses warm off-white surfaces, green/gold accents, large word tiles, and compact controls. Preserve that direction when adding reliability improvements.

## First priorities for the next session

### 1. Protect player sessions

Current room responses expose player IDs, and those same IDs authorize game actions. Room reads and event subscriptions do not verify membership.

- [ ] Separate public player IDs from private session credentials.
- [ ] Validate room membership for room reads, event subscriptions, and every mutation.
- [ ] Ensure another client cannot act as either player using public room data.
- [ ] Cover invalid, missing, expired, and cross-room credentials with regression checks.

Completion means both players can play normally while an unauthorized client cannot read private room state or submit moves, guesses, reviews, resets, or rematches.

### 2. Restore a player after refresh or disconnection

The browser currently saves a player ID and avatar preference, but does not restore the current room on page load. The join form does not reclaim an existing seat.

- [ ] Save the information needed to restore the active room securely.
- [ ] Reclaim the same seat after refresh, closing/reopening a tab, or a short network outage.
- [ ] Restore the chain, score, selected prompt mode, review state, and minigame progress.
- [ ] Calculate the timer from the server deadline after reconnecting.
- [ ] Show connecting, disconnected, and recovered states, and clear stale connection errors.
- [ ] Handle full rooms, removed/expired rooms, and multiple tabs with clear messages.
- [ ] Define how an intentional Leave action affects seat reclamation and the opponent.

Completion means a player can refresh or briefly lose internet and resume the same round without occupying a second seat or receiving extra time.

### 3. Persist active games

Rooms and event clients currently live in memory in `server.js`. A restart or deployment clears the rooms. The current architecture assumes one server instance.

- [ ] Choose and configure durable shared storage for room state.
- [ ] Save players, scores, chain entries, used compounds, deadlines, pending reviews, minigame attempts, and free-word rewards.
- [ ] Keep updates consistent during retries and concurrent requests.
- [ ] Recover active rounds after a server restart or Railway deployment.
- [ ] Resolve elapsed turn and minigame deadlines correctly after recovery.
- [ ] Verify shared state and event delivery before enabling multiple server replicas.

Completion means restarting the application preserves a round and its remaining time, with each accepted action applied once.

## Reliability and operational TODOs

- [ ] Prevent duplicate actions from rapid submissions, retries, and competing tabs.
- [ ] Verify which actions remain valid at the exact turn or minigame deadline.
- [ ] Define and enforce rematch behavior during an active turn, review, or minigame.
- [ ] Handle an opponent leaving or abandoning a pending review so the room cannot wait indefinitely.
- [ ] Expire abandoned and finished rooms and remove their associated resources.
- [ ] Add appropriate limits to room creation, join attempts, guesses, and event connections.
- [ ] Validate malformed JSON, invalid numeric settings, oversized words, and non-letter input consistently.
- [ ] Keep long-lived event connections healthy and clean them up after disconnects.
- [ ] Log actionable server and connection failures while keeping private session credentials out of logs.
- [ ] Add a repeatable regression command and GitHub checks for the game rules and browser transitions.
- [ ] Document deployment verification and a rollback procedure after persistence is in place.

## Full test pass still to complete

Record the date, browser/device, outcome, and reproduction steps for any failure when running these checks.

| Area | Scenarios | Passing result |
| --- | --- | --- |
| Entry and navigation | Homepage, each destination, Home buttons, invalid/full room codes, leaving and returning | Only the selected view appears, feedback is visible, and navigation remains usable |
| Real multiplayer | Two phones on different networks, alternating turns, different avatars | Both players see the same chain, score, active player, and game result |
| Mobile layout | iPhone Safari, Android Chrome, small screens, keyboard open, portrait/landscape | Inputs and actions remain reachable and portraits stay tightly framed |
| Core rules | Ending/start modes, repeated compounds, uppercase/whitespace, open and joined compounds | Correct validation, points, and prompts with no repeated compound accepted |
| Reviews and challenges | Accept/challenge unfamiliar links, challenges disabled, known/accepted/reset entries | Only eligible players can respond and the round outcome is correct |
| Paid new word | Fewer than 6 points, exactly 6, more than 6, repeat submission | Correct deduction, one reset, preserved used-word history, and a fresh opponent timer |
| Minigames | Every type, correct/incorrect/repeated guesses, guess exhaustion, timeout | Correct feedback and one attempt per turn with normal time restored correctly |
| Wordle transition | Wordle after Anagram and Missing Letters, then switch back | Four-letter and six-letter bounds, labels, and placeholders match each game |
| Free new word | Win and redeem, win and play a normal link, timeout before redemption | Reward belongs to the current turn, costs zero once, and expires appropriately |
| Rematches | Several rounds, rematch during other states, both players requesting it | State resets consistently and portraits remain selected |
| Interruptions | Refresh, lock/unlock phone, sleep/wake, Wi-Fi/mobile switch, brief offline period | Same seat and accurate state recover without extra time or duplicate actions |
| Race conditions | Double-tap Submit, delayed responses, requests near deadlines, multiple tabs | One authorized state transition and consistent results for both players |
| Session protection | Missing/forged credentials, another room's credentials, third client | Unauthorized reads and actions are rejected |
| Deployment recovery | Restart/redeploy while playing, reviewing, in a minigame, or holding a reward | Durable state and deadlines recover correctly |
| Load and isolation | Several concurrent rooms, repeated joins/leaves, abandoned rooms | Rooms remain isolated, updates stay responsive, and resources are reclaimed |

The interruption, session-protection, and deployment-recovery expectations depend on completing the first three priorities. Treat them as acceptance criteria for that work.

## Gameplay and content follow-up

- [ ] Run complete rounds with new players and collect confusing rules or interactions.
- [ ] Record valid compound words that real players expect but the dictionary misses.
- [ ] Expand and review the open/closed compound dictionaries from that feedback.
- [ ] Check clue clarity and difficulty across the minigame banks.
- [ ] Check starting compounds and the free/paid new-word mechanics for dead ends and balance.
- [ ] Improve copy/share room affordances based on two-device testing.
- [ ] Revisit mobile spacing and button ergonomics after the device pass.

## Optional future ideas

These are ideas to evaluate after the reliability work, with scope to be chosen when revisited.

- [ ] Pre-game confirmation once both players join.
- [ ] Subtle tile animations and optional sound.
- [ ] Post-game chain recap and shareable results.
- [ ] More minigame types, including Connections-style groups and mini crosswords.
- [ ] Accepted-word history, definition lookup, and clearer open/closed/hyphenated compound handling.
- [ ] Daily chain challenge and solo streak mode.
- [ ] Pass-and-play and party modes.
- [ ] Ranked play with a stricter dictionary.
- [ ] Friend invites, accounts, and stats.
- [ ] Custom word packs and an AI opponent.
- [ ] Hints, with their scoring and availability rules decided first.
- [ ] App icon, splash screen, and mobile packaging if demand warrants it.

## Domain decision

The existing Railway address is sufficient for now. A shorter Railway subdomain or a purchased custom domain can be revisited later. No domain purchase or domain change is pending for this checkpoint.

## Resume notes

- Live app — https://wordlink-production-e69b.up.railway.app
- Repository — https://github.com/jshankar0811/wordlink
- Local folder — `/Users/jsonexe/Projects/Personal Projects/wordlink`
- Start locally with `npm start`, then open `http://localhost:3000`.
- Check `git status --short --branch` before changing files.
- Start with private player sessions and reconnection, then durable room storage.
- Check the current GitHub and Railway deployment state when resuming. New deployments currently clear active rooms.
- The earlier checks were individual feature, browser-flow, and deployment checks. The full test matrix above is still open.

### Main files

| File | Purpose |
| --- | --- |
| `server.js` | Rooms, rules, scoring, timers, reviews, minigames, and event delivery |
| `public/app.js` | Browser state, navigation, inputs, and rendering |
| `public/index.html` | Homepage, create/join forms, instructions, and game markup |
| `public/styles.css` | Responsive layout, tiles, and portrait framing |
| `public/avatars.js` | The 36 avatar choices and per-character head framing |
| `public/avatars/` | Repaired PNG artwork |
| `data/compounds.json` | Open compound pairs |
| `data/joined-words.json` | Joined compound dictionary |
| `data/minigames.json` | Wordle answers and six-letter clue bank |
| `railway.json` | Build, start, and health-check settings |
