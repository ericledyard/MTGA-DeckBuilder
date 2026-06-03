# Conventions

# Conventions — Next.js

## Naming
- Files: kebab-case (`user-profile.tsx`). Components: PascalCase.
- Route segments: lowercase with hyphens (`app/user-settings/page.tsx`).
- Server Actions: prefix with verb (`createUser`, `deletePost`).

## Component Guidelines
- One exported component per file. Co-locate types in the same file unless shared.
- Props interfaces named `<Component>Props` and exported.
- Avoid `useEffect` for data fetching — use Server Components instead.
- Wrap third-party client libs in a thin client component to keep the import boundary explicit.

## State Management
- Server state: fetch in RSC, pass as props. No global store needed for server data.
- Client state: React context or Zustand for cross-component client state. Avoid Redux unless already adopted.
- URL state: use `searchParams` and `useSearchParams` for filter/sort/page.

## Error Handling
- Every route segment should have an `error.tsx` boundary.
- API Route Handlers: return typed `NextResponse.json()` with explicit status codes. Never throw unhandled.
- Use `notFound()` from `next/navigation` — do not return 404 manually.
