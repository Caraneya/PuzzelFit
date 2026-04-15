---
label: latest
saved: 2026-04-15
---

## Goal
Update the claude-behavior skill to enforce critical thinking before coding, alignment gates, and caveman speech style.

## Decisions
- claude-behavior runs at the start of every conversation (not just coding sessions)
- Claude must challenge ideas before executing them — not all ideas are good ideas
- Pre-code gate: challenge → confirm confidence → state plan → wait for go-ahead
- Caveman speech is always active (short sentences, no filler, saves credits)

## Work completed
- `.claude/commands/claude-behavior.md` — Rewritten with Step 0 mindset block, pre-code alignment gate, caveman speech rule, trimmed all steps to short sentences

## Open threads
- None

## Constraints
- Speak like a caveman in all responses (short, direct, no filler)
- Never write code without confirming user is confident and aligned
- Apply critical thinking — challenge first, execute second

## Next step
Run `/claude-behavior` at the start of the next session to set workspace permissions.
