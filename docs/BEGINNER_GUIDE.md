# Beginner's Guide to the Frontend — Next.js/React vs Angular

This repo (`omyfish-frontend`) and its twin, [`omyfish-frontend-angular`](https://github.com/fenghebonjour/omyfish-frontend-angular),
are the same app — same pages, same REST contract against the gateway, same
features — built twice in two different frameworks. If you're new to one or
both, this doc walks through where the same idea lands in each, using real
files from both repos rather than toy examples.

Neither framework is "correct" here; the point of keeping both alive is to
make the tradeoffs visible side by side.

## At a glance

| | This repo (React) | Angular twin |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 | Angular 22 |
| Language | TypeScript | TypeScript |
| Styling | Tailwind CSS 3 | Tailwind CSS 4 |
| HTTP | `fetch` in `src/lib/api.ts` | `HttpClient` in `src/app/core/api.service.ts` |
| Routing | File-system based (`src/app/**/page.tsx`) | Explicit array (`src/app/app.routes.ts`) |
| State/reactivity | `useState` / `useEffect` / Context | `signal()` / `computed()` / DI services |
| Auth | `contexts/AuthContext.tsx` + `useAuth()` hook | `core/auth.service.ts`, injected directly |

Both talk to the same backend (`NEXT_PUBLIC_API_URL` / Angular's `environment.apiBase`,
default `http://localhost:8080`) and ship the same pages: `/` (Timing), `/identify`,
`/observations`, `/regs`, `/notifications`, `/login`, `/register`, `/account`, `/admin`.

## Project structure

React's structure is inferred from the filesystem; Angular's is declared explicitly.

```
React (this repo)                       Angular twin
src/app/page.tsx        → "/"           src/app/features/timing/timing-page.ts
src/app/identify/       → "/identify"   src/app/features/identify/identify-page.ts
src/app/regs/           → "/regs"       src/app/features/regs/regs-page.ts
src/components/         (shared UI)     src/app/features/**/*  (co-located per feature)
src/contexts/           (React Context) src/app/core/          (injectable services)
src/lib/api.ts          (fetch client)  src/app/core/api.service.ts (HttpClient)
```

A React page is just whatever `page.tsx` sits at that path — the *folder path
is* the route. Angular has no such convention: every route is one line in
`src/app/app.routes.ts` mapping a path to a component. Compare:

```ts
// omyfish-frontend-angular/src/app/app.routes.ts
export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/timing/timing-page').then(m => m.TimingPage) },
  { path: 'identify', loadComponent: () => import('./features/identify/identify-page').then(m => m.IdentifyPage) },
  { path: 'account', loadComponent: () => import('./features/account/account-page').then(m => m.AccountPage), canActivate: [authGuard] },
  // ...
];
```

`loadComponent` is Angular's explicit version of what Next.js does for every
page automatically: each route's component, and everything only it imports,
ships as its own lazy-loaded chunk. `canActivate: [authGuard]` replaces the
`if (!isAuthenticated) router.push('/login')` guard clause that protected
React pages (`/account`, `/admin`, `/notifications`, `/observations`) each
repeat inline.

## State and reactivity

React's building blocks here are `useState` (a value that triggers a
re-render when it changes) and `useEffect` (code that runs after render, in
response to a dependency changing). Cross-cutting state — auth, in this app —
is shared via a React Context so any descendant component can read it without
prop-drilling:

```tsx
// omyfish-frontend/src/contexts/AuthContext.tsx
const [auth, setAuth] = useState<AuthState>({ token: null, userId: null, email: null });
// ...
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
```

Every component that needs auth state calls `useAuth()`, and the whole app is
wrapped in `<AuthProvider>` in `layout.tsx` so the context exists.

Angular's equivalent is a singleton service plus signals — no wrapper
component and no "did you forget the Provider" runtime check, because the DI
container always has exactly one instance:

```ts
// omyfish-frontend-angular/src/app/core/auth.service.ts
@Injectable({ providedIn: 'root' })
export class AuthService {
  token = signal<string | null>(null);
  isAuthenticated = computed(() => !!this.token());
  // any component: private auth = inject(AuthService);
}
```

`signal()` is the rough analog of `useState`, but fine-grained: a template
that reads `token()` only re-renders when `token` itself changes, not
whenever *any* state in the component changes (React's default is the
opposite — a state update re-renders the whole component function, and you
opt out of that with memoization rather than opting in). `computed()` plays
the role React uses `useMemo` for.

One more Angular-specific note: this app's `app.config.ts` never calls
`provideZoneChangeDetection()` — it's zoneless. Nothing re-renders "just in
case" after every async event the way zone.js used to trigger; only a
component that actually reads a changed signal updates. That's the same
instinct behind React re-rendering only components whose state or props
changed, achieved by a different mechanism.

## Talking to the backend

Same endpoints, same shapes, different primitive for "a request in flight":

```ts
// omyfish-frontend/src/lib/api.ts — fetch, returns a Promise
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
// caller: const resp = await api.auth.login(email, password);
```

```ts
// omyfish-frontend-angular/src/app/core/api.service.ts — HttpClient, returns an Observable
login: (email: string, password: string): Observable<M.TokenResponse> =>
  this.http.post<M.TokenResponse>(`${this.base}/api/v1/auth/login`, { email, password }),
// caller: const resp = await firstValueFrom(this.api.auth.login(email, password));
```

The practical differences:
- A `Promise` starts running the instant you call the function ("hot"). An
  `Observable` does nothing until something calls `.subscribe()` — or, as
  Angular code here does when it wants `await`-style code,
  `firstValueFrom(...)` subscribes and resolves a Promise from the first
  emitted value.
- `fetch` requires you to check `res.ok` and throw yourself on a bad status.
  `HttpClient` pushes non-2xx responses down a separate error channel
  automatically.
- `fetch`'s body must be parsed by hand (`res.json()`). `HttpClient` parses
  it into the generic type you declared on the call.

## Components

A React component is a function returning JSX, in one `.tsx` file. An
Angular component is a class decorated with `@Component`, its markup usually
split into a sibling `.html` file:

```tsx
// omyfish-frontend/src/app/identify/page.tsx
export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <FishUploader />
    </div>
  );
}
```

```ts
// omyfish-frontend-angular/src/app/features/identify/identify-page.ts
@Component({
  selector: 'app-identify-page',
  imports: [FishUploader],
  templateUrl: './identify-page.html',
})
export class IdentifyPage {}
```

`imports: [FishUploader]` in the decorator is Angular's version of a JSX
file's `import { FishUploader } from ...` plus using `<FishUploader />` in
the return — Angular components are standalone by default here (no
`NgModule` layer to register them in).

## Styling

Both use Tailwind CSS utility classes directly in markup (`className="..."`
in React, `class="..."` in Angular templates) — no CSS-in-JS, no component
stylesheets beyond the odd Tailwind `@layer` tweak. React pins Tailwind 3;
Angular uses Tailwind 4 via `@tailwindcss/postcss`. Class names read the same
in both once you're looking at rendered markup.

## Running either one

```bash
npm install
npm run dev     # React: http://localhost:3000 (Next.js dev server)
# or, in the Angular repo:
npm start       # Angular: http://localhost:4200 (ng serve)
```

Both need `NEXT_PUBLIC_API_URL` (React, `.env.local`) or `environment.apiBase`
(Angular) pointed at a running gateway — `http://localhost:8080` for a local
`omyfish-java`, `omyfish-dotnet`, or `omyfish-python-web` backend.

## Where to go next

- Pick one feature (e.g. Timing, on `/`) and read it end to end in both
  repos — `src/app/page.tsx` + `src/components/timing/*` here, versus
  `src/app/features/timing/*` in the Angular twin. Same six-factor bite-score
  breakdown, same peak-window chips, two different ways of building the same
  screen.
- `src/app/core/*.ts` in the Angular repo has unusually dense doc comments
  explicitly cross-referencing their React equivalents — worth reading
  directly if this guide's summary isn't enough.
