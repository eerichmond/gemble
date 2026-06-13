# Git Commit (Conventional Commits)

Review the current git state and create a conventional commit with a scannable bullet-point body.

## Steps

1. Run these in parallel to understand the full picture:
   - `git status` — see staged, unstaged, and untracked files
   - `git diff HEAD` — see all changes (or `git diff --cached` if already staged)
   - `git log --oneline -5` — check existing commit style in this repo

2. Stage files that belong to this change. Prefer naming specific files over `git add .` to avoid accidentally staging secrets, `.env` files, or unrelated work-in-progress.

3. Pick the commit type:
   - `feat` — new user-facing feature
   - `fix` — bug fix
   - `chore` — tooling, config, deps, scaffolding (no production behavior change)
   - `refactor` — restructure with no behavior change
   - `test` — adding or updating tests only
   - `docs` — documentation only
   - `style` — formatting, whitespace (no logic change)
   - `perf` — performance improvement
   - `build` — build system or bundler changes
   - `ci` — CI/CD pipeline changes

4. Draft the commit message:

```
<type>(<optional scope>): <short imperative description, ≤72 chars>

- <what changed> — <why it was needed or what problem it solves>
- <what changed> — <why>
```

**Body rules:**
- Short fragments, not full sentences — written to scan, not to read
- Lead with *what* changed, explain the *why* after a dash
- Omit the why only when it is completely self-evident from the what
- Group related file changes into one bullet — do not list every file
- No trailing periods
- Blank line between subject and body (required for git to parse them separately)

5. Show the drafted message to the user, then create the commit.
