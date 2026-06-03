# Architecture

# Architecture — Next.js App Router

## Directory Layout
```
app/
  layout.tsx          # Root layout (html, body, providers)
  page.tsx            # Home route
  (auth)/             # Route group — shared auth layout
    login/page.tsx
    register/page.tsx
  api/
    route.ts          # API route handlers
  dashboard/
    layout.tsx        # Nested layout
    page.tsx
    loading.tsx       # Streaming fallback
    error.tsx         # Error boundary
lib/                  # Shared utilities, API clients, constants
components/
  ui/                 # Presentational / design-system components
  features/           # Feature-specific composite components
```

## Key Patterns
- **Server Components by default**: fetch data at the component level; no waterfall because requests are deduplicated and cached.
- **Client islands**: wrap interactive pieces in `"use client"` components and keep them as leaf nodes.
- **Parallel routes & intercepting routes**: use `@slot` and `(.)` conventions for modals and split layouts.
- **Server Actions**: colocate mutations in `"use server"` functions; call from forms or `startTransition`.
- **Middleware** (`middleware.ts` at project root): auth redirects, geo-routing, feature flags. Runs on the Edge.
- **Caching layers**: Request memoization → Data Cache → Full Route Cache. Use `revalidateTag` / `revalidatePath` to bust caches.
