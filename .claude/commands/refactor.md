---
description: Safe refactoring: plan, apply, verify
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

$ARGUMENTS

Refactor the specified code safely:

1. **Verify tests exist** for the code. If not, write them first.
2. **Plan** the refactoring in small steps.
3. **Apply** one step at a time:
   a. Make the change.
   b. Run tests.
   c. Commit if green.
4. **Verify** the final result is measurably better (fewer lines, clearer names, less coupling).

Never change behavior during a refactoring commit. If tests break, revert and rethink.
