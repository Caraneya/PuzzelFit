Save a checkpoint of the current conversation highlights.

The checkpoint label is: $ARGUMENTS (use "latest" if empty)

---

## What to do

1. Review the entire conversation so far and distill:
   - **Goal** — What is the user trying to build or solve?
   - **Decisions made** — Key choices that were agreed on (architecture, naming, approach)
   - **Work completed** — What files were created or changed, and what they now do
   - **Open threads** — Anything discussed but not yet implemented, or left as a follow-up
   - **Active constraints** — Rules, patterns, or preferences the user stated that must be respected going forward
   - **Next step** — The single most immediate next action before this checkpoint was called

2. Write the checkpoint to `.claude/checkpoints/$ARGUMENTS.md` (substitute "latest" if $ARGUMENTS is empty).
   Use this structure exactly:

```markdown
---
label: $ARGUMENTS
saved: {{ISO date, e.g. 2026-04-02}}
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

3. Confirm to the user: `Checkpoint saved to .claude/checkpoints/$ARGUMENTS.md` and list the **Next step** so they can see what was captured.

Do not ask clarifying questions. Synthesize from what you know.
