# ABHEDYA

A smart solution for disaster prediction, emergency response, and faster recovery.

## Development

```sh
npm install
npm run dev
```

Vite prints the local URL after the development server starts. Use `npm run build` to create a production build and `npm run preview` to serve that build locally.

## Supabase configuration

Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and either `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY` for your Supabase project. These are public client credentials; never put a service-role key in the frontend or commit real environment values.

Authentication, role-based workspaces, helper approvals, and SANKET persistence use Supabase. The SQL files under `supabase/migrations/` are not run by the app or build. Review and apply them to the intended project only with explicit approval; the security-remediation migration deletes demo reports and changes report contact-data storage.

Without Supabase configuration, authentication and remote persistence are unavailable. A local-only prototype preview is available in development; it does not dispatch assistance. DRISHTI live weather and official alerts are not connected.

MEDHA reads original SANKET reports and offers advisory duplicate flags, explainable priority suggestions, reviewer decisions, and a verified-only JSON handoff for SENA. Its schema/RPC proposal and the priority-authority hardening migration (`20261105000100_medha_incident_intelligence.sql`, then `20261105000200_medha_priority_authority.sql`) are not active until reviewed and explicitly applied in order. The priority hardening moves authoritative scoring to PostgreSQL and separates append-only overrides. Local demonstration records are labeled and excluded from operational metrics and handoff.

See [supabase/STAGING.md](./supabase/STAGING.md) for staging-only Supabase CLI setup, safe environment configuration, migration procedure, and MEDHA validation cases. No staging project is configured by this repository.

## Stack

- React with TypeScript and Vite
- Tailwind CSS v4 through its Vite plugin
- React Router
- Lucide React
- Supabase JS client

## Source layout

- `src/app`: application entry and route configuration
- `src/pages`: route-level pages
- `src/components`: shared UI components
- `src/features`: feature-specific modules
- `src/lib`: shared utilities and integrations
- `src/types`: shared TypeScript types
- `src/assets`: static assets imported by the application
