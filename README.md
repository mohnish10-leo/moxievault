# MoxieVault

Private vaults for your most important files. Public vaults are searchable by name, private vaults require an owner-shared token.

## Features
- Email/password auth
- Create vaults with unique names
- Public discovery by name
- Private access via token
- Upload, reorder, delete files
- Signed URL view and download
- 30 MB per vault limit

## Tech Stack
- Next.js (App Router)
- Supabase (Auth, Postgres, Storage)
- Tailwind CSS

## Setup
1. Install dependencies:
```bash
npm install
```

2. Create `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

3. Create a new Supabase project and run:
- `supabase/schema.sql`
- `supabase/upgrade.sql`

4. Create a private storage bucket named `vault-files`.

5. Run the app:
```bash
npm run dev
```

## Scripts
```bash
npm run dev
npm run build
npm run start
```

## Deployment (Vercel)
1. Push the repo to GitHub.
2. Import into Vercel.
3. Add environment variables from `.env.local`.
4. Deploy.
