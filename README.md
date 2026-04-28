# Zellin Trees · Higuera Tree Care

Mobile-first tree mapping PWA. Walk a property, drop pins, generate a printable
client report. Built per the V1 spine design doc (single-user, browser-print
report, no photos yet — those land in V1.1).

Stack: Vite + React 18 + TypeScript + Tailwind + shadcn-style UI primitives +
Supabase + react-leaflet + ESRI World Imagery tiles.

## Local dev

```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_ANON_KEY from the Supabase dashboard
npm install
npm run dev
```

Open http://localhost:5173 — sign in with magic link, create a property,
start dropping pins.

## Supabase setup (one-time)

1. In the `tree_mapping` Supabase project SQL editor, run
   [`supabase/schema.sql`](./supabase/schema.sql). The script is idempotent —
   re-run it any time the schema changes (e.g. when the `color` column was
   added to `tree_pins`).
2. Auth → Providers → enable **Email (magic link)**.
3. Auth → URL Configuration:
   - Site URL: `https://zellin.ai`
   - Additional redirect URLs: `https://zellin.ai`, `http://localhost:5173`

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import into Vercel.
3. Set env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Add `zellin.ai` as a custom domain.
5. Push to `main` → auto-deploy in <2 min.

## Install on iPhone

Open `https://zellin.ai` in iPhone Safari → Share → **Add to Home Screen**.
Launches fullscreen via `apple-mobile-web-app-capable`.

> ⚠️ Geolocation requires HTTPS. Verify TLS is live on `zellin.ai` before the
> field walk, or `getCurrentPosition` will silently reject.

## What's in V1 (the spine)

- Magic-link auth (single user)
- Project list + new project form
- Map with satellite tiles (ESRI), GPS-and-tap pin drop
- Numbered pins, name + quantity + description per pin
- Linear list view (toggle in header)
- Print-optimized one-page report (`window.print()`, no PDF lib)
- Offline pin queue in `localStorage`, auto-flush on reconnect

## What's deferred to V1.1

- Per-pin photos + Supabase Storage bucket `tree_photos`
- Square (grid) view of pins
- Map snapshot embedded in the report
- Service-worker offline support
- Optional `client_id` foreign key into Spark OS

## Layout

```
src/
  App.tsx                       # Router + AuthGate wiring
  main.tsx                      # Vite entry
  index.css                     # Tailwind + print CSS
  lib/
    supabase.ts                 # Supabase client singleton
    types.ts                    # TreeProject, TreePin, PendingPin
    utils.ts                    # cn(), date formatting
    pinQueue.ts                 # localStorage offline queue
  components/
    AuthGate.tsx
    Header.tsx
    EmptyState.tsx
    MapView.tsx                 # react-leaflet wrapper
    PinHereButton.tsx           # tactile FAB
    PinSheet.tsx                # bottom drawer for pin form
    PinList.tsx                 # numbered list of pins
    ui/                         # shadcn-style primitives
  pages/
    LoginPage.tsx
    ProjectListPage.tsx
    NewProjectPage.tsx
    ProjectMapPage.tsx
    ReportPage.tsx
supabase/
  schema.sql
```
