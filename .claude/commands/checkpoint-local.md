Save a checkpoint scoped to a specific game's folder.

The checkpoint label is: $ARGUMENTS (use "latest" if empty)

---

## What to do

1. Infer the game name from the current conversation context (e.g., references to game files, folder names like "Dobbelaar", game-specific code). If you cannot determine the game with confidence, ask: "Which game is this checkpoint for?" and wait for the answer before continuing.

2. Derive the game folder: `Games/{GameName}/` (match the casing of the actual folder name in `Games/`). Use Bash `ls Games/` to confirm the folder exists.

3. Check if `Games/{GameName}/checkpoints/` exists. If not, create it by writing the checkpoint file directly (the directory will be created implicitly via the Write tool).

4. Review the entire conversation so far and distill:
   - **Goal** — What is the user trying to build or solve in this game?
   - **Decisions made** — Key choices that were agreed on (architecture, naming, approach)
   - **Work completed** — What files were created or changed, and what they now do
   - **Open threads** — Anything discussed but not yet implemented, or left as a follow-up
   - **Active constraints** — Rules, patterns, or preferences the user stated that must be respected going forward
   - **Next step** — The single most immediate next action before this checkpoint was called

5. Write the checkpoint to `Games/{GameName}/checkpoints/$ARGUMENTS.md` (substitute "latest" if $ARGUMENTS is empty).
   Use this structure exactly:

```markdown
---
label: $ARGUMENTS
game: {GameName}
saved: {{ISO date, e.g. 2026-04-09}}
---

## Goal
{{1–3 sentences on what we're building}}

## Decisions
- {{decision 1}}
- {{decision 2}}

## Work completed
- {{file or feature}} — {{what it does now}}

## Open threads
- {{unfinished idea or pending question}}

## Constraints
- {{rule or preference that must carry forward}}

## Next step
{{The immediate next thing to do when resuming}}
```

6. Confirm to the user: `Checkpoint saved to Games/{GameName}/checkpoints/$ARGUMENTS.md` and list the **Next step** so they can see what was captured.

Do not ask clarifying questions beyond the game name if needed. Synthesize from what you know.