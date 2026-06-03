# Deployment

# Deployment — Next.js

## Build
- `next build` produces `.next/` with static + server bundles.
- Check `next build` output for route-level static/dynamic classification.

## Vercel (recommended)
- Zero-config: push to main, Vercel auto-deploys.
- Preview deployments on every PR branch.
- Environment variables set in Vercel dashboard, not `.env` in repo.

## Self-Hosted (Node.js)
- `next start` runs the production server on port 3000.
- Use `output: "standalone"` in `next.config.js` for Docker-friendly minimal builds.
- Reverse proxy (nginx/Caddy) in front for TLS termination.

## Environment Variables
- Build-time: `NEXT_PUBLIC_*` baked into client JS.
- Runtime: server-only vars read via `process.env` in Route Handlers and Server Components.
- Never commit `.env.local` — use `.env.example` as a template.
