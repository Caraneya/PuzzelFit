Stage all changes, generate a commit message, commit, and push to GitHub.

The optional hint is: $ARGUMENTS

---

## What to do

1. Run `git status` to see what has changed.
2. Run `git diff` to understand the nature of the changes.
3. Run `git log --oneline -5` to match the repo's commit style.

4. Based on the diff, compose:
   - **Title** — one concise line (≤72 chars), imperative mood, matching the project's style (e.g. "Add tutorial step 3 overlay")
   - **Description** — 2–5 bullet points covering *what* changed and *why*, grouped by area if needed. Skip obvious or trivial points.
   - If $ARGUMENTS is provided, treat it as a hint or override for the commit subject.

5. Stage all modified and untracked files relevant to the changes:
   ```
   git add <specific files>
   ```
   Do NOT use `git add .` or `git add -A` — add files explicitly to avoid accidentally staging `.env`, secrets, or unrelated files. If unsure about a file, skip it and mention it to the user.

6. Commit with the composed message:
   ```
   git commit -m "Title

   - bullet 1
   - bullet 2"
   ```

7. Push to the remote:
   ```
   git push
   ```

8. Report back:
   - The commit hash and title
   - Files that were staged
   - Confirmation that the push succeeded (or any error)
   - Any files that were intentionally skipped

Do not ask clarifying questions. Act on the current state of the repo.
