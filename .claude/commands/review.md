---
description: Multi-dimensional code review of recent changes
allowed-tools: Read, Glob, Grep, Bash
---

$ARGUMENTS

Review the specified code or recent changes:

1. Run `git diff` to see current changes (or read the specified files).
2. Evaluate across six dimensions: correctness, security, performance, readability, testing, architecture.
3. For each issue, state: dimension, severity (critical/warning/nit), location, and concrete fix.
4. End with a verdict: approve, request-changes, or needs-discussion.
5. If approved, note any optional improvements as nits.
