# OMyFish — Your AI Fishing Companion (Frontend)

Next.js 15 frontend for the OMyFish family. Shared verbatim across the enterprise
backends — [omyfish-java](https://github.com/fenghebonjour/omyfish-java) and
[omyfish-dotnet](https://github.com/fenghebonjour/omyfish-dotnet) — via one REST
contract (`/api/v1/...`).

## Pages

| Route | Feature |
|---|---|
| `/` | Timing — Bite Score forecast (7-day outlook, hourly activity curve, peak windows) |
| `/identify` | Fish ID — photograph a fish for species identification, log the sighting |
| `/observations` | Map of logged catches (yours and others'), with a bite-score panel per card |
| `/regs` | Regs & Tips chatbot — catch limits, consumption advisories, zone lookups |
| `/notifications` | Notifications |
| `/login`, `/register` | Auth |
| `/account`, `/admin` | Account settings, admin pages (subscriptions, admin endpoints) |

## Development

```bash
npm install
npm run dev        # -> http://localhost:3000
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` to point at whichever backend you're running
(e.g. `http://localhost:8080` for the gateway of a locally running `omyfish-dotnet` or
`omyfish-java`).

## Other commands

```bash
npm run build       # production build
npm run start        # run the production build
npm run lint          # next lint
npm run test          # vitest run
```

## Docker

```bash
docker build -t omyfish-frontend --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 .
```

Multi-stage build producing a standalone Next.js server (`node server.js`, port 3000,
runs as a non-root user).

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS · Leaflet (maps) · Recharts · Vitest
