---
description: End-to-end: reproduce, diagnose, fix, test, commit
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

$ARGUMENTS

Follow these steps to fix the issue described above:

1. **Reproduce**: Find or write a test that demonstrates the bug. Run it to confirm failure.
2. **Diagnose**: Read the relevant code. Trace the execution path. Identify the root cause.
3. **Fix**: Make the minimal change that fixes the root cause. Do not refactor unrelated code.
4. **Test**: Run the failing test. Confirm it passes. Run the full test suite to check for regressions.
5. **Commit**: Create a focused commit with a message that explains what was wrong and why the fix works.
