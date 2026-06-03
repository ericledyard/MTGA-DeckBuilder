---
description: Generate tests for specified code with coverage awareness
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

$ARGUMENTS

Generate tests for the specified code:

1. Read the target code. Identify public API, edge cases, and error paths.
2. Check existing tests to avoid duplication.
3. Write tests covering: happy path, error cases, boundary values, integration points.
4. Follow the project's test conventions (see agent_docs/testing.md).
5. Run the tests to verify they pass.
6. Report coverage of the new tests if possible.
