# ORBITLE — Full-stack starter

A runnable full-stack foundation for ORBITLE: a student and early-career community platform focused on Orbits, opportunities, and project collaboration.

## Included

- **Frontend:** React + Vite, responsive dashboard UI, search, page navigation, Orbit cards, opportunity filters, project cards, community feed, profile editor, and modal forms.
- **Backend:** Node.js + Express JSON API.
- **Database:** SQLite through `better-sqlite3`; tables are created automatically and sample records are seeded on first run.
- **Authentication:** Register, login, logout, password hashing with bcrypt, signed HTTP-only session cookie, profile editing.
- **Core API:** Orbits join/leave, opportunity search and save/unsave, project creation and applications, community posts and likes.
- **Professional network:** member discovery by public profile details, connection requests, and accept/decline actions.
- **Orbit channels:** member-only group chat for each joined Orbit, with messages persisted in SQLite.
- **Trust center:** public-evidence review requests for portfolio work, project contributions, or school/community affiliation. Requests remain pending until a moderator review workflow exists; no badge is automatically granted.
- **Baseline safeguards:** Input validation with Zod, rate limits, Helmet security headers, HTTP-only cookies, same-site cookie policy, request-origin checks, and request size limits.

## Requirements

- Node.js 20 or newer (Node 22 recommended)
- npm

## Run locally on Windows (PowerShell)

1. Extract this folder somewhere convenient.
2. Open PowerShell in the `orbitle-fullstack` folder.
3. Install dependencies:

   ```powershell
   npm install
   ```

4. Create your local environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

5. Open `.env` and replace `JWT_SECRET` with a random secret of at least 32 characters. For example, create one with:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
   ```

   Copy the output into `.env` as the value of `JWT_SECRET`.

6. Start frontend and backend together:

   ```powershell
   npm run dev
   ```

7. Open **http://127.0.0.1:5173** in your browser. Keep the terminal open while using the site.

The API runs on `http://127.0.0.1:3000`. SQLite data is stored in `data/orbitle.sqlite` and persists between restarts.

## Production build (local smoke-test)

```powershell
npm run build
$env:NODE_ENV="production"
npm start
```

Then visit `http://127.0.0.1:3000`. In production, deploy behind HTTPS, set `JWT_SECRET`, set `CLIENT_ORIGIN` to the actual site origin, and use a persistent disk or managed database. If deploying to a platform that does not allow persistent local files, migrate SQLite to a managed database before launch.

## API overview

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/health` | Health check | No |
| POST | `/api/auth/register` | Create account | No |
| POST | `/api/auth/login` | Sign in | No |
| POST | `/api/auth/logout` | Sign out | No |
| GET | `/api/auth/me` | Current user | Yes |
| PATCH | `/api/profile` | Update profile | Yes |
| GET | `/api/orbits` | List Orbits | Optional |
| POST | `/api/orbits/:id/join` | Join/leave Orbit | Yes |
| GET | `/api/opportunities` | Search listings | Optional |
| POST | `/api/opportunities/:id/save` | Save/unsave listing | Yes |
| GET | `/api/saved-opportunities` | Saved listings | Yes |
| GET | `/api/projects` | Search projects | Optional |
| POST | `/api/projects` | Create project | Yes |
| POST | `/api/projects/:id/apply` | Apply to project | Yes |
| GET | `/api/posts` | Community feed | No |
| POST | `/api/posts` | Publish post | Yes |
| POST | `/api/posts/:id/like` | Like/unlike post | Yes |
| GET | `/api/network/people` | Search public member profiles | Yes |
| GET | `/api/network/requests` | List incoming connection requests | Yes |
| POST | `/api/network/requests` | Send a connection request | Yes |
| PATCH | `/api/network/requests/:id` | Accept/decline a request | Yes |
| GET | `/api/orbits/:id/messages` | Read a joined Orbit's channel | Yes + member |
| POST | `/api/orbits/:id/messages` | Send a channel message | Yes + member |
| GET | `/api/verification/me` | Read own verification requests | Yes |
| POST | `/api/verification/requests` | Request evidence review | Yes |

## Important limitations before public launch

This is a functional **starter**, not a fully production-audited social network. Before opening it to real users, add and test email verification, password reset, stronger CSRF protection, account deletion/export, moderation/report/block workflows, admin controls, verified opportunity sourcing, privacy policy and terms, database backups/migrations, automated tests, logging/monitoring, and a security review. The seeded opportunity and project records are examples. The sample external URLs use `example.com` and are not real opportunities. Do not advertise them as live listings.

For a platform with teenage users, establish age-appropriate defaults, data minimization, safe contact and messaging rules, clear reporting routes, and a moderation process before launch. Network discovery only exposes display name, bio, interests, and account creation date—not email addresses. Orbit channel messages require membership and authentication. Channel chat is currently request/refresh based rather than real-time push; direct one-to-one messaging, reporting/blocking, and moderator/admin review tools are not implemented yet. Verification requests are stored as pending; do not show a verified badge until a real reviewer workflow and evidence checks are implemented.

## Existing visual prototype

`orbitle-landing-prototype.html` is the earlier standalone landing page, kept for design reference. The runnable React application is in `client/`.

## Refined interface update

This edition keeps the existing React/Vite frontend and Express/SQLite API while refining the workspace UI. It adds:

- A Light/Dark mode control in the top bar; your choice is saved in browser local storage.
- Theme-aware cards, search, forms, dialogs, profile, community feed, and navigation surfaces.
- Improved spacing, hover feedback, focus-visible outlines, responsive theme control, and reduced visual clutter.
- Existing account, Orbits, opportunity saving, project collaboration, profile, and community-post flows are retained.

### Run on Windows PowerShell

From the extracted project folder:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:5173` in your browser. Use Node.js 22 LTS for the best compatibility with the SQLite native dependency. If `better-sqlite3` fails to install, share the full error before changing project files; the install may require a supported prebuilt binary or Visual Studio C++ Build Tools.

## ORBITLE Studio Edition (visual refresh)
This package includes a refined editorial-style interface inspired by contemporary digital studio websites: oversized typography, layered orbit artwork, more spacious cards, subtle motion, responsive layouts, and coordinated light/dark themes. The design is original rather than a pixel-for-pixel copy of the referenced website. Existing API routes and app features are retained.

## Scroll-reactive orbital globe

The Overview page includes a stylized Earth and three orbital tracks that rotate at different speeds and in opposite directions as the visitor scrolls. The globe includes community labels, responsive styling, and reduced-motion support. This visual is self-contained and does not require a third-party map API.


## Mono Studio Edition — professional network update

This update uses a restrained black-and-white interface with persistent light/dark themes and a scroll-reactive monochrome globe. New interactive areas include:

- **Network:** searchable public member cards, outgoing request status, incoming connection requests, and accept/decline actions.
- **Messages:** member-only chat channels for each joined Orbit, backed by SQLite. Messages persist, but there is no websocket/live push yet.
- **Community feed:** existing post creation and reactions remain available.
- **Verification Center:** submits a review request against a public HTTPS portfolio/project link or affiliation context. It explicitly does not auto-verify accounts; moderator review and badge approval are future work. Never upload government IDs or private documents.

New tables are created automatically when the backend starts. Existing `data/orbitle.sqlite` data is retained.

## Mono Studio feature expansion

This edition extends the monochrome workspace with working interactions backed by SQLite:

- **Command menu:** use `Ctrl+K` / `Cmd+K` or click the search field to search workspace pages, Orbits, opportunities, and projects. Arrow keys move selection, Enter opens it, Escape closes the menu.
- **Professional feed:** like, comment, repost, and bookmark posts. The feed has For You, Following (your accepted connections and your own posts), Research, Projects, and Saved filters. Saved posts have their own page.
- **Direct inbox:** one-to-one messages are available only after two accounts are connected. Conversations persist in SQLite and refresh while open.
- **Orbit channels:** joined members can message in a community channel; messages refresh while the channel is open.
- **Events:** browse sample community events and RSVP; attendance is stored per account.
- **Opportunity tracker:** track an opportunity through Interested, Preparing, Applied, Interview, Accepted, or Not selected. This is a private personal status and does not submit applications to third-party organizations.
- **Proof of work:** profile pages list projects owned by the signed-in user.
- **Monochrome system:** high-contrast black/white design with light/dark themes.

### Beta limitations

- Events are seeded example records, not a live external calendar.
- Direct messages and Orbit channels poll every five seconds while open; they do not use WebSockets or push notifications.
- Reposts are recorded as a per-user repost action; this beta does not duplicate the post into a separate reshare timeline.
- Verification submissions remain pending until a moderator workflow is implemented. No automatic verified badge is awarded.
- Opportunity records labelled DEMO remain illustrative. The tracker records your own progress and cannot verify whether an external application was submitted.


## Project Studio, contribution records, and moderation

The expanded build adds project task boards and an evidence-backed contribution workflow:

- Open a project workspace after creating the project or submitting a project application.
- Add tasks and move them between To do, In progress, and Done.
- Submit a contribution with a description and optional public HTTPS evidence link.
- The project owner can confirm or decline another member's contribution. Only confirmed contributions appear in that member's profile portfolio.
- Member blocking hides blocked profiles/posts from network discovery, removes blocked members from the inbox, and disables direct messages between the two accounts.
- Reports about users or posts are saved for moderator review.

### Enable the moderator dashboard

Set `ORBITLE_ADMIN_EMAIL` in `.env` to the exact email address of the account that should moderate the local instance. Restart the server and sign in with that account. A **Moderation** page will appear with report statuses and pending public-evidence verification requests. Leave this variable blank to disable moderator access. Use only an account you control. Approval confirms a specific submitted evidence item; it should not be presented as universal identity verification.

These controls are an MVP foundation, not a substitute for a staffed moderation process, audited authorization, abuse escalation, and security review before a public launch.


## Scroll-linked 3D universe (Mono Studio)

The Overview now opens with a scroll-pinned, WebGL-rendered cinematic sequence. The scene is implemented with native WebGL shaders and geometry, so it does not add a third-party 3D dependency:

- **Void → planet birth → orbital descent → network expansion** is driven by the actual scroll position of the pinned section. The progress indicator and scene narrative follow the same normalized scroll progress.
- A procedural spherical mesh is shaded in WebGL; layered star particles, orbital paths, network lines, and selectable node points are rendered in the same scene.
- The transition is reversible: scrolling upward drives the camera and scene back through the earlier phases.
- The network explorer searches and filters the current application data for communities, projects, and opportunities. The People entry routes to the existing Network page; community actions use the existing join flow.
- Accessible HTML controls accompany the canvas. The existing Overview content and app workflows remain below the cinematic sequence.
- A reduced-motion media query shortens the cinematic section, and the canvas is responsive with a capped device pixel ratio.

### Verification notes for this source package

The JSX/JavaScript syntax was checked with the installed TypeScript parser, the CSS brace balance was checked, and the existing server JavaScript files passed `node --check`. A production Vite build and browser interaction tests could not be run in the implementation environment because `npm install` did not complete (the package registry request timed out). Run `npm install` and `npm run build` locally before deployment, then verify downward/reverse scrolling and node actions in a WebGL-enabled browser.

## Profile matching and guided onboarding additions

The updated scroll-experience branch also adds profile fields for goals and current collaboration needs. These fields are stored in the local SQLite database through additive migrations, so an existing database is upgraded without being replaced.

After registration, users can complete a short onboarding step with interests/skills, goals, a current collaboration need, and an optional bio. The same information can be edited later from My Profile. The Network page shows transparent, keyword-overlap suggestions for people; Projects and My Orbits surface relevant project/community matches; Opportunities surfaces listings whose text overlaps with the user's stated direction. These are simple explainable text matches, not AI predictions or guarantees.

Existing project applications/workspaces, direct inbox messages, community channels, saved opportunities, opportunity tracking, and confirmed project contributions remain part of the app. No new backend actions are simulated by the recommendation cards: they route into the existing connection, join, project-application, and listing flows.

## ORBITLE product-launch experience

The Overview opening experience now uses a restrained, Apple-inspired editorial direction: warm-white surfaces, oversized typography, a polished sculptural object built from CSS 3D layers, and a pinned scroll journey. Its object rotation, tilt, scale, vertical travel, chapter copy, and progress indicator are mapped to the actual section scroll position; reverse scrolling retraces the same states. The existing workspace routes, API, database, and feature pages remain in place. This is an original ORBITLE design direction, not an Apple asset or template.


## Visual update
The landing-page hero replaces the static CSS globe/orbital rings with a scroll-linked network sculpture inspired by the Nexora prototype. Its point field morphs through a single signal, orbital network, branching graph, and connected ecosystem. The scene is rendered on a 2D canvas with a perspective projection and is driven directly by page scroll.

## Railway trial deployment

This repository includes `railway.json` for a Railway deployment. Deploy the repository root (the folder containing `package.json`). Configure these service variables in Railway:

- `NODE_ENV=production`
- `JWT_SECRET` = a unique random secret of at least 32 characters
- `DATABASE_PATH=/data/orbitle.sqlite`
- `CLIENT_ORIGIN` = the exact public HTTPS origin Railway assigns to this service

Attach a Railway Volume mounted at `/data` to keep the SQLite database across deploys/restarts. Without a persistent volume, user accounts and platform data can be lost when the container is replaced. Generate a public domain in the Railway service Networking settings. The app listens on `0.0.0.0` and Railway's assigned `PORT`.
