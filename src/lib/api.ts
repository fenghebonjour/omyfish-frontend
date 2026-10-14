// Default matches every backend's docker-compose gateway/origin port
// (Java api-gateway, .NET api-gateway, Django) — this frontend is shared
// verbatim across all three.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface PredictionDto {
  speciesName: string;
  scientificName: string;
  confidence: number;
  confidencePercent: string;
  rank: number;
  conservationStatus?: string;
}

export interface IdentifyFishResult {
  predictions: PredictionDto[];
  uncertain: boolean;
  imageKey: string;
  isFish?: boolean;
}

export interface ObservationDto {
  id: string;
  userId: string;
  speciesName: string;
  scientificName?: string;
  topConfidence: number;
  imageStorageKey: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  observedAt: string;
  createdAt: string;
}

export interface BiteHourlyScore {
  timestamp: string;
  score: number;
  breakdown: Record<string, number>;
  weightedContribution: Record<string, number>;
  timeOfDayMultiplier: number;
  safetyFlag?: string | null;
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface SunTimes {
  date: string; // ISO date
  sunrise: string;
  sunset: string;
}

export interface CurrentConditions {
  time: string;
  precipitationMm: number;
  isStorm: boolean;
  isHeavyPrecip: boolean;
}

export interface BiteForecast {
  species: string;
  lat: number;
  lon: number;
  hourly: BiteHourlyScore[];
  bestWindows: BiteHourlyScore[];
  majorWindows: TimeWindow[]; // per day: windows around the top-2 aggregate-score peaks
  minorWindows: TimeWindow[]; // per day: windows around the next-2 peaks
  sunTimes: SunTimes[]; // per-day sunrise/sunset (drives the dawn/dusk score boost)
  current: CurrentConditions | null; // live nowcast for "right now" alerts
}

export interface RegsSpeciesLimit {
  species: string;
  period: string;
  catchLimit: string;
  lengthLimit?: string | null;
  fishingDevice?: string | null;
  note?: string | null;
}

export interface RegsLimits {
  lat: number;
  lon: number;
  zoneName: string;
  zoneInfoUrl?: string | null;
  rules: RegsSpeciesLimit[];
  disclaimer: string;
}

export interface RegsStation {
  noBqma: string;
  hydronyme: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
}

export interface RegsConsumption {
  lat: number;
  lon: number;
  species: string;
  stationName: string;
  distanceKm: number;
  sizeClass?: string | null;
  mealsPerMonth?: number | null;
  fishingStatus?: string | null;
  note?: string | null;
  disclaimer: string;
}

export interface RegsAskResponse {
  question: string;
  answer: string;
  sources: string[];
  disclaimer: string;
}

export interface NotificationDto {
  id: string;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface TokenResponse {
  token: string;
  userId: string;
  email: string;
  role: string;
}

export interface UserDto {
  id: string;
  email: string;
  displayName?: string;
  role: string;
}

export interface SubscriptionDto {
  status: string; // trialing | active | canceled | expired | past_due
  plan: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  paymentProcessor: string | null; // "stripe" | "paypal" | "adyen" — only "stripe" has a self-service portal today
  cancelAtPeriodEnd: boolean; // true when status is still "active" but scheduled to cancel at currentPeriodEnd
}

export interface CheckoutResponse {
  processor: string; // "stripe" | "paypal" | "adyen" — only "stripe" is handled client-side today
  clientSecret: string;
  subscriptionId: string;
  status: string;
}

export interface AdminStats {
  users: number;
  subscriptions: Record<string, number>;
  activePlans: { monthly: number; yearly: number };
  mrrCad: number;
}

export interface AdminSubscriptionRow {
  userId: string;
  email: string;
  status: string;
  plan: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
}

export interface ProductDto {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  stockQuantity: number;
}

export interface CartItemDto {
  productId: string;
  quantity: number;
}

export interface CartDto {
  cartId: string;
  items: CartItemDto[];
}

export interface OrderLineDto {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
}

export interface ShippingAddressDto {
  recipientName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// Status: PENDING_PAYMENT | PAID | CANCELLED | RETURN_REQUESTED | RETURNED
export interface OrderDto {
  id: string;
  status: string;
  totalCents: number;
  lines: OrderLineDto[];
  createdAt: string;
  paidAt: string | null;
  returnRequestedAt: string | null;
  returnedAt: string | null;
  returnReason: string | null;
  // Set once Stripe Checkout collects it, i.e. once status reaches PAID — null before that.
  shippingAddress: ShippingAddressDto | null;
}

export interface CheckoutSessionResponse {
  orderId: string;
  checkoutUrl: string;
}

// AuthContext registers these so an expired access token can be silently
// refreshed (via the httpOnly refresh cookie) without every call site having
// to know about it, and so a truly-dead session can redirect to /login.
interface AuthHandlers {
  onTokenRefreshed?: (resp: TokenResponse) => void;
  onSessionExpired?: () => void;
}
let authHandlers: AuthHandlers = {};
export function setAuthHandlers(handlers: AuthHandlers) {
  authHandlers = handlers;
}

// Dedupes concurrent refresh attempts (e.g. several authenticated calls
// firing on the same page load) into a single /auth/refresh request.
let refreshPromise: Promise<TokenResponse | null> | null = null;
function refreshOnce(): Promise<TokenResponse | null> {
  if (!refreshPromise) {
    refreshPromise = api.auth
      .refresh()
      .then((resp) => {
        authHandlers.onTokenRefreshed?.(resp);
        return resp;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function cartIdentityHeaders(cartToken?: string): HeadersInit {
  return cartToken ? { "X-Cart-Token": cartToken } : {};
}

async function apiFetch<T>(path: string, init?: RequestInit, token?: string, isRetry = false): Promise<T> {
  const headers: HeadersInit = {
    ...(init?.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401 && token && !isRetry) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      return apiFetch<T>(path, init, refreshed.token, true);
    }
    authHandlers.onSessionExpired?.();
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiFetch<TokenResponse>("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      }),

    register: (email: string, password: string, displayName?: string) =>
      apiFetch<UserDto>("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      }),

    // Refresh token is an httpOnly cookie now, not a value the client holds — the browser
    // attaches it automatically as long as this request includes credentials
    // (BACKLOG.md item F, WEAKNESS_AUDIT.md §1.3).
    refresh: () =>
      apiFetch<TokenResponse>("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "include",
      }),

    logout: () =>
      apiFetch<void>("/api/v1/auth/logout", { method: "POST", credentials: "include" }),

    me: (token: string) =>
      apiFetch<UserDto>("/api/v1/auth/me", {}, token),

    changePassword: (currentPassword: string, newPassword: string, token: string) =>
      apiFetch<void>("/api/v1/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      }, token),
  },

  species: {
    identify: (image: File, topK = 5, token?: string) => {
      const form = new FormData();
      form.append("image", image);
      form.append("topK", String(topK));
      return apiFetch<IdentifyFishResult>("/api/v1/species/identify", {
        method: "POST",
        body: form,
      }, token);
    },

    getAll: (northAmericanFreshwater?: boolean) => {
      const params = northAmericanFreshwater !== undefined
        ? `?northAmericanFreshwater=${northAmericanFreshwater}`
        : "";
      return apiFetch<PredictionDto[]>(`/api/v1/species${params}`);
    },
  },

  biteScore: {
    // species accepts a profile key or any common/scientific name from a
    // confirmed fish ID — the backend resolves it (general fallback).
    today: (lat: number, lon: number, species = "general") =>
      apiFetch<BiteForecast>(
        `/api/v1/species/bite-score/today?lat=${lat}&lon=${lon}&species=${encodeURIComponent(species)}`),

    forecast: (lat: number, lon: number, species = "general", hours = 336) =>
      apiFetch<BiteForecast>(
        `/api/v1/species/bite-score/forecast?lat=${lat}&lon=${lon}&species=${encodeURIComponent(species)}&hours=${hours}`),
  },

  // Quebec fishing regs/consumption advisor — proxied from omyfish-ai by
  // every backend at the same path, chatbot/retrieval logic lives there only.
  regs: {
    limits: (lat: number, lon: number, species = "general") =>
      apiFetch<RegsLimits>(
        `/api/v1/species/regs/limits?lat=${lat}&lon=${lon}&species=${encodeURIComponent(species)}`),

    zonesGeoJson: () =>
      apiFetch<GeoJSON.FeatureCollection>("/api/v1/species/regs/zones/geojson"),

    consumptionStations: (lat: number, lon: number, limit = 5) =>
      apiFetch<RegsStation[]>(
        `/api/v1/species/regs/consumption/stations?lat=${lat}&lon=${lon}&limit=${limit}`),

    consumption: (lat: number, lon: number, species = "general") =>
      apiFetch<RegsConsumption>(
        `/api/v1/species/regs/consumption?lat=${lat}&lon=${lon}&species=${encodeURIComponent(species)}`),

    ask: (question: string) =>
      apiFetch<RegsAskResponse>("/api/v1/species/regs/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      }),
  },

  notifications: {
    getAll: (token: string) =>
      apiFetch<NotificationDto[]>("/api/v1/notifications", {}, token),

    markRead: (id: string, token: string) =>
      fetch(`${API_BASE}/api/v1/notifications/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); }),
  },

  billing: {
    me: (token: string) =>
      apiFetch<SubscriptionDto>("/api/v1/billing/me", {}, token),

    // idempotencyKey is the caller's responsibility, not generated here — a retry of the same
    // checkout attempt (e.g. after a timeout) must reuse the same key, or the backend's
    // idempotency protection (and Stripe's own) never actually engages. See AccountPage.
    checkout: (plan: "monthly" | "yearly", token: string, idempotencyKey: string) =>
      apiFetch<CheckoutResponse>("/api/v1/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ plan }),
      }, token),

    portalSession: (returnUrl: string, token: string) =>
      apiFetch<{ url: string }>("/api/v1/billing/portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl }),
      }, token),
  },

  admin: {
    stats: (token: string) =>
      apiFetch<AdminStats>("/api/v1/admin/stats", {}, token),

    subscriptions: (token: string) =>
      apiFetch<AdminSubscriptionRow[]>("/api/v1/admin/subscriptions", {}, token),

    grant: (userId: string, token: string, days = 365, plan = "yearly") =>
      apiFetch<SubscriptionDto>(`/api/v1/admin/subscriptions/${userId}/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, plan }),
      }, token),

    revoke: (userId: string, token: string) =>
      apiFetch<SubscriptionDto>(`/api/v1/admin/subscriptions/${userId}/revoke`, {
        method: "POST",
      }, token),

    extendTrial: (userId: string, token: string, days = 7) =>
      apiFetch<SubscriptionDto>(`/api/v1/admin/subscriptions/${userId}/extend-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      }, token),

    refund: (userId: string, token: string, idempotencyKey: string) =>
      apiFetch<{ refundId: string; status: string; amountCents: number | null }>(
        `/api/v1/admin/subscriptions/${userId}/refund`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      }, token),
  },

  observations: {
    create: (
      body: {
        speciesName: string;
        scientificName?: string;
        topConfidence: number;
        imageStorageKey: string;
        latitude?: number | null;
        longitude?: number | null;
      },
      token: string
    ) =>
      apiFetch<ObservationDto>("/api/v1/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, token),

    getAll: (token: string, myOnly = true) =>
      apiFetch<ObservationDto[]>(`/api/v1/observations?myOnly=${myOnly}`, {}, token),

    getById: (id: string, token: string) =>
      apiFetch<ObservationDto>(`/api/v1/observations/${id}`, {}, token),

    delete: (id: string, token: string) =>
      fetch(`${API_BASE}/api/v1/observations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => { if (!r.ok && r.status !== 204) throw new Error(`${r.status}`); }),

    getGeoJson: () =>
      apiFetch<object>("/api/v1/observations/geojson"),
  },

  shop: {
    products: {
      getAll: () =>
        apiFetch<ProductDto[]>("/api/v1/shop/products"),

      getById: (id: string) =>
        apiFetch<ProductDto>(`/api/v1/shop/products/${id}`),
    },

    // Cart calls accept either an account token or a guest cartToken (never both — see
    // CartOwnerResolver on the backend), never requiring login.
    cart: {
      get: (token?: string, cartToken?: string) =>
        apiFetch<CartDto>("/api/v1/shop/cart", { headers: cartIdentityHeaders(cartToken) }, token),

      addItem: (productId: string, quantity: number, token?: string, cartToken?: string) =>
        apiFetch<CartDto>("/api/v1/shop/cart/items", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...cartIdentityHeaders(cartToken) },
          body: JSON.stringify({ productId, quantity }),
        }, token),

      // quantity 0 removes the item.
      updateItem: (productId: string, quantity: number, token?: string, cartToken?: string) =>
        apiFetch<CartDto>(`/api/v1/shop/cart/items/${productId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...cartIdentityHeaders(cartToken) },
          body: JSON.stringify({ quantity }),
        }, token),

      // Folds a guest cart into the caller's account cart — called right after login/register
      // when a guest cart token is still in storage (see AuthContext.login).
      merge: (guestToken: string, token: string) =>
        apiFetch<CartDto>("/api/v1/shop/cart/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guestToken }),
        }, token),
    },

    // idempotencyKey follows the same caller-owns-it convention as billing.checkout — a retry
    // of the same checkout attempt must reuse the same key. guestEmail is required when
    // checking out as a guest (no token) and ignored otherwise.
    checkout: (
      successUrl: string, cancelUrl: string, idempotencyKey: string,
      token?: string, cartToken?: string, guestEmail?: string
    ) =>
      apiFetch<CheckoutSessionResponse>("/api/v1/shop/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          ...cartIdentityHeaders(cartToken),
        },
        body: JSON.stringify({ successUrl, cancelUrl, guestEmail }),
      }, token),

    orders: {
      getAll: (token: string) =>
        apiFetch<OrderDto[]>("/api/v1/shop/orders", {}, token),

      getById: (id: string, token: string) =>
        apiFetch<OrderDto>(`/api/v1/shop/orders/${id}`, {}, token),

      requestReturn: (id: string, reason: string, token: string) =>
        apiFetch<OrderDto>(`/api/v1/shop/orders/${id}/returns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }, token),

      // Admin-only; the backend has no cross-user order listing yet, so the caller must already
      // know the order id (e.g. from a support request) — see AdminApproveReturnPage.
      approveReturn: (id: string, token: string) =>
        apiFetch<OrderDto>(`/api/v1/shop/orders/${id}/returns/approve`, {
          method: "PATCH",
        }, token),

      // Public guest order tracking by orderId+email, no account needed.
      lookup: (orderId: string, email: string) =>
        apiFetch<OrderDto>(
          `/api/v1/shop/orders/lookup?orderId=${encodeURIComponent(orderId)}&email=${encodeURIComponent(email)}`),
    },
  },
};
