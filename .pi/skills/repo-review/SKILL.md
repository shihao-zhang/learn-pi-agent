---
name: repo-review
description: Reviews a repository change for correctness, safety, test coverage, and product clarity. Use when asked to inspect local changes, review a PR-sized patch, or assess whether a learning chapter is complete.
license: MIT
---

# Repo Review

## Workflow

1. Inspect the current diff and changed files.
2. Identify behavior changes before style issues.
3. Check whether tests or runnable examples cover the changed behavior.
4. Report findings first, ordered by severity.
5. Keep explanations plain enough for an AI product manager.

## Output Shape

- Findings
- Open Questions
- Verification

If there are no findings, say so directly and list residual risk.
