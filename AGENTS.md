# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

ProviderFlo is an NDIS & Aged Care management platform. This repository contains only the **frontend** React SPA, originally extracted from a Replit monorepo. The backend API is not included.

### Workspace structure

The repo uses a **pnpm workspace** with the following layout:

- `/workspace/package.json` — root workspace config
- `/workspace/pnpm-workspace.yaml` — workspace packages + catalog versions
- `/workspace/tsconfig.base.json` — shared TypeScript config
- `/workspace/lib/api-client-react/` — stub of the `@workspace/api-client-react` package (provides React Query hooks for API calls)
- `/workspace/ndis-management/ndis-management/` — the main frontend app (Vite + React + TailwindCSS v4)

### Running the dev server

```bash
cd /workspace/ndis-management/ndis-management
PORT=21511 BASE_PATH=/app/ pnpm dev
```

The app is served at `http://localhost:21511/app/`. Both `PORT` and `BASE_PATH` environment variables are **required** by `vite.config.ts`.

### Commands

| Task | Command | Working directory |
|------|---------|-------------------|
| Install deps | `pnpm install` | `/workspace` |
| Dev server | `PORT=21511 BASE_PATH=/app/ pnpm dev` | `ndis-management/ndis-management` |
| Build | `PORT=21511 BASE_PATH=/app/ pnpm build` | `ndis-management/ndis-management` |
| Typecheck | `pnpm typecheck` | `ndis-management/ndis-management` |
| Rebuild api-client-react stub | `pnpm exec tsc -b` | `lib/api-client-react` |

### Important caveats

- **No backend**: This repo has no backend API server. All `/api/*` calls will fail at runtime. The frontend handles this gracefully (showing error toasts). For full end-to-end testing, a backend would need to be provided.
- **`@workspace/api-client-react` stub**: The `lib/api-client-react` package is a local stub that provides typed React Query hooks. If you add new imports from `@workspace/api-client-react` in the frontend, you must also add the corresponding export to `lib/api-client-react/index.ts` and rebuild with `pnpm exec tsc -b` from that directory.
- **Replit plugins**: The Vite config imports `@replit/vite-plugin-runtime-error-modal` unconditionally, and conditionally imports `@replit/vite-plugin-cartographer` and `@replit/vite-plugin-dev-banner` only when `REPL_ID` is set (which it won't be in this environment).
- **`catalog:` versions**: Dependencies in `package.json` that use `catalog:` are resolved from the `catalog` section in `pnpm-workspace.yaml`.
- **Tailwind CSS v4**: Uses the new Vite plugin (`@tailwindcss/vite`) rather than PostCSS.
