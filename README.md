# Wordlink

Wordlink is a multiplayer compound-word chain game. Players create a room, join from another browser, and take turns extending the chain with a valid compound.

## Run

```bash
npm start
```

Then open `http://localhost:3000`.

## Deploy on Railway

This repo includes `railway.json` so Railway can deploy the app from GitHub.

- Build command: `npm install`
- Start command: `npm start`
- Healthcheck path: `/api/health`

After deployment, use the Railway public domain as the shared game URL.

## Rules

- The game starts from a random compound word.
- The next player must use the ending word as the start of a new compound.
- Example: `side line` gives the prompt `line`; a player can submit `dance` to make `line dance`.
- Repeating a compound is not allowed.
- Using the ending word is worth 2 points.
- Using the starting word as a fallback is worth 1 point.
- On your turn, spend 6 points to choose a new starting word and pass the turn with a fresh timer. You must have at least 6 points. Previously used compounds still count as used.
- Alternatively, choose **Win a new word** for a random Mini Wordle (four letters, four guesses), Anagram, or Missing Letters (three guesses with a clue). You get one 60-second attempt per turn. Your normal timer pauses, then resumes after the minigame. Winning lets you choose a new starting word for free and pass the turn. Losing returns you to your original word.
- The puzzle pool includes 121 Mini Wordle answers, 40 Anagrams, and 40 Missing Letters puzzles. Each game type uses its full pool before repeating a puzzle within a round.
- Choose from 24 illustrated character avatars or six animal emojis before creating or joining a room.
- The host chooses the target score before creating the room.
- A turn can be challenged by the opponent.
- The timer can be configured per room.
