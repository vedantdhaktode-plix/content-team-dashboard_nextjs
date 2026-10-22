# Content Team realtime dashboard

A Next.js frontend and backend for moving scripts, approvals, videos, Drive links, and final Live links between Brand, Content, Video, and Performance teams in realtime. The visible dashboard remains focused on the Content Team.

## Local run

```bash
npm install
npm run dev
```

Open [http://localhost:4174](http://localhost:4174).

Without Supabase environment variables the dashboard runs in clearly isolated fixture mode. With the variables below it switches to authenticated database and realtime mode.

## Connect Supabase

1. Create or choose the Supabase project intended for this application.
2. Copy `.env.example` to `.env.local` and provide the Project URL and publishable key. Never place a secret/service-role key in a `NEXT_PUBLIC_` variable.
3. Link the CLI and deploy the committed migration:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

4. In the Supabase Data API settings, expose the `public` schema if the project uses the newer opt-in exposure model.
5. Restart Next.js, sign in with a magic link, and complete first-time workspace setup.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

## Backend model

- `workspaces` and `workspace_members`: team isolation and roles.
- `profiles`: authenticated team member display data.
- `tasks`: workflow ownership and state.
- `task_assets`: scripts, uploaded videos, references, Drive links, and Live links.
- `approvals`: pending and completed script/video decisions.
- `task_activity`: append-only workflow history.
- `workflow-assets`: private Storage bucket with signed downloads.

All exposed tables have RLS. Mutations require an authenticated workspace member and are constrained by workflow team. The browser only receives the publishable key; privileged keys are not used by the application.

## API routes

- `GET/POST /api/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/tasks/:id/script`
- `POST /api/tasks/:id/video`
- `POST /api/tasks/:id/live`
- `POST /api/approvals/:id`
- `POST /api/assets/upload`
- `GET /api/assets/:id` (five-minute signed URL for private files)

Script, video, approval, and Live transitions run through database functions so each state change, asset, approval, and activity entry is committed atomically. The dashboard subscribes to `tasks`, `task_assets`, `approvals`, and `task_activity` through Supabase Realtime.

## Production check

```bash
npm run build
npm start
```
