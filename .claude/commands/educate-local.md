Resume a conversation from a game-specific checkpoint.

The checkpoint label is: $ARGUMENTS (use "latest" if empty)

---

## What to do

1. Run `ls Games/` via Bash first. Capture the output — these are the real game folders. Do NOT invent or assume game names. Use the `AskUserQuestion` tool with the question "Which game do you want to resume?" and build the options array directly from the `ls` output: take the first 4 folders (label = exact folder name from `ls`, description = `Games/{name}/`). The tool adds "Other" automatically for any remaining games. Wait for the answer before continuing.

2. Read the file `Games/{GameName}/checkpoints/$ARGUMENTS.md` (substitute "latest" if $ARGUMENTS is empty).
   - If the file does not exist, tell the user: "No checkpoint found at `Games/{GameName}/checkpoints/$ARGUMENTS.md`. Run `/checkpoint-local` first to save one." Then stop.

3. Internalize every section of the checkpoint fully — goal, decisions, completed work, open threads, constraints, and next step.

4. Read any files mentioned in **Work completed** to confirm their current state matches what the checkpoint describes. Note any drift.

5. Reply with a short briefing in this format:

---

**Resuming [{GameName}] from checkpoint: $ARGUMENTS**

**Where we left off:** {{1–2 sentence summary of goal + what was last done}}

**Ready to continue with:** {{the Next step from the checkpoint}}

{{If any files drifted from what the checkpoint described, list them here as a warning}}

---

Then ask: "Want to pick up right there, or is there something else first?"

Do not re-explain what checkpoints are. Do not summarize decisions the user already made. Jump straight into context.