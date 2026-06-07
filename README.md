# LogQ — Construction Labour Tracking

Web app for logging and reporting labour hours on construction sites, with role-based access for Admins, Site Managers, and Quantity Surveyors (QS).

## Features

- **Roles**: Admin (full access), Site Manager (assigned sites only), QS (read-only + exports)
- **Fast daily timesheet**: crew list, + per worker, category → task → hours, single save
- **Dashboard**: hours by site, stacked category chart, worker and task breakdowns
- **Admin**: sites, workers, categories, tasks/cost codes, users
- **Exports**: payroll CSV, per-site PDF summary

## Setup

**Quick start** (uses bundled Node in `.tools/` if present):

```bash
cd ~/Projects/logq
./scripts/dev.sh
```

Or with [Node.js](https://nodejs.org/) 18+ installed globally:

```bash
cd ~/Projects/logq
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Connection refused?** Nothing is listening on port 3000 until `npm run dev` (or `./scripts/dev.sh`) is running. Keep that terminal open while you use the app.

### Demo accounts


| Role         | Email                                             | Password    |
| ------------ | ------------------------------------------------- | ----------- |
| Admin        | [admin@example.com](mailto:admin@example.com)     | password123 |
| Site Manager | [manager@example.com](mailto:manager@example.com) | password123 |
| QS           | [qs@example.com](mailto:qs@example.com)           | password123 |


## Environment

Copy `.env.example` to `.env` and set:

- `DATABASE_URL` — SQLite path (default `file:./dev.db`)
- `AUTH_SECRET` — long random string for session signing

## Deploy to Railway (shareable test link)

Deploy once and share the HTTPS URL with testers on Mac, Windows, or phone — no terminal or installs on their side.

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Prepare Railway deployment"
# Create a repo on GitHub, then:
git remote add origin https://github.com/YOUR_USER/construction-timesheets.git
git push -u origin main
```

### 2. Create the Railway project

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → select this repository.
3. Open the service → **Variables** and add:

   | Variable | Value |
   | -------- | ----- |
   | `DATABASE_URL` | `file:/data/prod.db` |
   | `AUTH_SECRET` | Generate with: `openssl rand -base64 32` |
   | `NODE_ENV` | `production` |

4. **Settings** → **Volumes** → **Add Volume**:
   - Mount path: `/data`
   - Size: 1 GB (enough for testing)

5. Redeploy after adding the volume (Railway menu → **Redeploy**).

On first boot, the app applies the schema and seeds demo data automatically.

### 3. Share the link

Railway assigns a public URL (e.g. `https://logq-production.up.railway.app`). Share it with testers along with the demo logins above.

### Demo accounts (same as local)

| Role         | Email             | Password    |
| ------------ | ----------------- | ----------- |
| Admin        | admin@example.com | password123 |
| Site Manager | manager@example.com | password123 |
| QS           | qs@example.com    | password123 |

## Scripts


| Command            | Description                  |
| ------------------ | ---------------------------- |
| `npm run dev`      | Development server           |
| `npm run build`    | Production build             |
| `npm run db:setup` | Push schema + seed demo data |
| `npm run start:production` | Production server (schema + seed + start) |


## Tech stack

- Next.js 15 (App Router), React 19, TypeScript
- Prisma + SQLite
- Tailwind CSS 4
- Recharts, jsPDF

```bash
cd ~/Projects/logq
npm install
npm run db:setup
npm run dev

```

