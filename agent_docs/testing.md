# Testing

# Testing — Next.js

## Stack
- **Unit/Component**: Vitest + React Testing Library.
- **E2E**: Playwright (preferred) or Cypress.
- **API Routes**: direct handler invocation with mocked NextRequest.

## Principles
- Test behavior, not implementation. Query by role/label, not class names.
- Server Components: test the rendered output via a thin wrapper that calls the async component and renders the result.
- Client Components: render with `@testing-library/react`, simulate user events, assert on DOM changes.
- Mock `fetch` at the network layer (MSW) so server/client components both hit the same mock.

## File Layout
```
src/__tests__/
  components/       # Component unit tests
  app/              # Route-level integration tests
  lib/              # Utility tests
e2e/                # Playwright specs
```

## Commands
- `npm test` — run Vitest in watch mode.
- `npm run test:ci` — single run with coverage.
- `npx playwright test` — E2E suite.
