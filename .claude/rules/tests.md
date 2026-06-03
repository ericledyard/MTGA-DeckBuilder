---
paths:
  - "tests/**/*.{ts,tsx}"
  - "**/*.test.{ts,tsx}"
  - "**/__tests__/**/*"
---

# Test-file rules

When editing tests in this project:

- Run `npm test` after every change. A test you cannot run is a test you cannot trust.
- One assertion per test where practical. Multiple assertions are fine when they cover the same behavior; avoid bundling unrelated checks.
- Test names describe behavior, not implementation: `test_user_cannot_delete_others_posts`, not `test_delete_function`.
- Prefer real fixtures over mocks for the system under test. Mock only at trust boundaries (network, time, randomness).
- New code paths require new tests. If you cannot easily write one, the design probably needs work.
