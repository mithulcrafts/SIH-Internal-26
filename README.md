# IIITM CampusPool

A mobile-first ride pooling app for ABV-IIITM Gwalior students. Students can request an Auto or Cab, select exact campus pickup coordinates, find nearby riders, split fares, chat with their pool, track a mock driver, and trigger SOS support.

The project is a monorepo:

- `src/` — Vite + React + TypeScript mobile-first client
- `server/` — Express + TypeScript API with Prisma ORM
- `server/prisma/schema.prisma` — PostgreSQL data model
- `supabase/` — optional legacy deployment artifacts from the initial prototype; the current production database path is Prisma + PostgreSQL

## Requirements

- Node.js 18+
- PostgreSQL 14+ (local, Neon, Supabase, or another managed PostgreSQL provider)
- npm

The app runs in demo mode without third-party credentials. Demo mode uses the hardcoded Gwalior locations, local mock payment confirmation, mock driver dispatch, and the server's in-memory fallback only when `DATABASE_URL` is not set.

## Quick start

```bash
npm install
npm run build

cd server
npm install
npm run prisma:generate
npm run build
npm run dev
```

The client uses Vite. The API uses Express on port `4000` by default.

## Environment variables

Create `server/.env` from `server/.env.example`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/campuspool?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"

GOOGLE_MAPS_API_KEY=""
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
UBER_CLIENT_ID=""
UBER_CLIENT_SECRET=""
UBER_WEBHOOK_SIGNING_KEY=""
```

For the Vite client, use a root `.env` file. Browser-visible values must use the `VITE_` prefix:

```env
VITE_GOOGLE_MAPS_API_KEY=""
VITE_RAZORPAY_KEY_ID=""
VITE_API_URL="http://localhost:4000"
```

Never put a PostgreSQL password, Razorpay secret, Uber secret, or service-role credential in a `VITE_` variable. Vite embeds `VITE_` values in the browser bundle.

---

## 1. PostgreSQL + Prisma setup

### Option A: Neon

1. Create an account at Neon and create a free PostgreSQL project.
2. Open the project's connection details and copy the pooled connection string.
3. Put the connection string in `server/.env` as `DATABASE_URL`.
4. Append `?schema=public` if the connection string does not already include a schema query parameter.

Example:

```env
DATABASE_URL="postgresql://user:password@ep-example.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public"
```

### Option B: Supabase PostgreSQL

1. Create a Supabase project.
2. Open Project Settings, Database, and copy the direct or pooled PostgreSQL connection string.
3. Put it in `server/.env` as `DATABASE_URL`.
4. Use the Prisma schema in this repository as the source of truth for the application tables.

Example:

```env
DATABASE_URL="postgresql://postgres:password@db.example.supabase.co:5432/postgres?schema=public"
```

### Generate the Prisma client

```bash
cd server
npx prisma generate
```

### Create a development migration

Use this when you want versioned SQL migrations:

```bash
cd server
npx prisma migrate dev --name init
```

For an existing database where you only want Prisma to synchronize the schema:

```bash
cd server
npx prisma db push
```

Inspect the database with:

```bash
cd server
npx prisma studio
```

The application creates a shared `PrismaClient` in `server/src/db.ts`. Every production route checks that Prisma is enabled and uses methods such as `prisma.user.create()`, `prisma.pool.findMany()`, and `prisma.chatMessage.create()`.

---

## 2. Google Maps pinning and route optimization

The adapter lives in:

- `src/services/maps.ts` — browser-side Places Autocomplete, geocoding, and Directions
- `server/src/services/routeOptimizer.ts` — server-side waypoint ordering and fare splitting

### Create the Google project

1. Open Google Cloud Console and create or select a project.
2. Enable billing for the project.
3. Enable these APIs:
   - Maps JavaScript API
   - Places API
   - Directions API
   - Geocoding API
4. Create one browser-restricted API key for the client.
5. Create one server-restricted API key for the Express server.
6. Restrict the browser key to the production domain and local development origins.
7. Restrict the server key to the server's IP or deployment environment.

Client configuration:

```env
VITE_GOOGLE_MAPS_API_KEY="your-browser-restricted-key"
```

Server configuration:

```env
GOOGLE_MAPS_API_KEY="your-server-restricted-key"
```

### Place search and geocoding

The browser adapter provides a stable interface, so the request UI does not need to know whether Google or mock data is active:

```ts
import { geocode, searchPlaces } from './services/maps'

const suggestions = await searchPlaces('Gwalior Railway Station')
const coordinates = await geocode('Gwalior Railway Station')
```

When `VITE_GOOGLE_MAPS_API_KEY` is absent, the adapter uses the built-in Gwalior destinations and campus coordinates.

### Waypoint route optimization

The server adapter requests optimized stop order with Google Directions' `optimize:true` waypoint flag:

```ts
import { optimizeWaypoints } from './services/routeOptimizer'

const orderedStops = await optimizeWaypoints([
  { name: 'BH-2', lat: 26.2488, lng: 78.1732 },
  { name: 'GH', lat: 26.2475, lng: 78.1718 },
  { name: 'Station', lat: 26.2183, lng: 78.1828 },
])
```

When the server key is absent or Google fails, a nearest-neighbour distance heuristic is used. Always validate and store the final latitude/longitude values on the server before sending them to a ride provider.

---

## 3. Razorpay payments

The adapter lives in:

- `server/src/services/razorpay.ts` — order creation and HMAC verification
- `src/services/payment.ts` — dynamic checkout script loading and mock fallback

### Create test keys

1. Create a Razorpay account.
2. Open the Test Mode dashboard.
3. Open Account and Settings, then API Keys.
4. Generate a Test Key ID and Test Key Secret.
5. Keep the secret only in the server environment.

```env
# server/.env
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."

# root .env — browser-safe key ID only
VITE_RAZORPAY_KEY_ID="rzp_test_..."
```

### Backend order creation

The adapter exposes a provider-neutral function:

```ts
import { createOrder } from './services/razorpay'

const order = await createOrder(68, 'INR')
// { orderId: 'order_...', amount: 68 }
```

With keys configured, the implementation calls `razorpay.orders.create` and stores only the provider order ID and amount in application records. Without keys, it returns a mock order ID.

### Frontend checkout handler

The frontend adapter dynamically loads the official checkout script only when `VITE_RAZORPAY_KEY_ID` is available:

```ts
import { openCheckout } from './services/payment'

await openCheckout({
  orderId: order.orderId,
  amount: order.amount,
  name: 'IIITM CampusPool',
  description: 'Shared campus ride',
  prefill: {
    name: 'Rishabh Kumar',
    email: 'student@iiitm.ac.in',
  },
  handler: async ({ success, paymentId, error }) => {
    if (!success) return console.error(error)
    await fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId }),
    })
  },
})
```

### Signature verification

Never trust a payment success event from the browser alone. Verify the checkout signature on the server:

```ts
import { verifySignature } from './services/razorpay'

const valid = verifySignature({
  orderId: req.body.razorpay_order_id,
  paymentId: req.body.razorpay_payment_id,
  signature: req.body.razorpay_signature,
})

if (!valid) return res.status(400).json({ error: 'Invalid payment signature' })
```

For webhooks, verify the raw request body with the webhook signature before changing payment state. Store provider IDs, not card details.

---

## 4. Uber for Business / Sandbox testing

The adapter lives in `server/src/services/uber.ts`. It manages OAuth 2.0 client-credentials tokens, dispatches guest trips, simulates sandbox status transitions, and parses webhook events.

### Create the Uber developer app

1. Open the Uber Developer dashboard.
2. Create a new application for sandbox testing.
3. Configure the app's redirect and webhook settings.
4. Copy the Sandbox Client ID and Client Secret.
5. Request or enable the guest trips scope for the application.

```env
UBER_CLIENT_ID="your-sandbox-client-id"
UBER_CLIENT_SECRET="your-sandbox-client-secret"
UBER_WEBHOOK_SIGNING_KEY="your-webhook-signing-key"
```

Keep both credentials server-side. The adapter calls:

```text
POST https://sandbox-api.uber.com/v1/guests/trips
```

with pickup and destination latitude/longitude values.

### Create a mock driver

Uber's sandbox tools vary by account and API version. Use the sandbox run endpoint shown in your Uber Developer dashboard. The typical flow is:

```bash
curl -X POST "https://sandbox-api.uber.com/v1/guests/sandbox/run" \
  -H "Authorization: Bearer $UBER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "driver": {
      "name": "Ramesh Sharma",
      "phone_number": "+919876543210",
      "vehicle": "White Swift Dzire",
      "vehicle_number": "MP-07-AB-1234"
    }
  }'
```

Use the response's driver or sandbox session ID when creating a guest trip. Confirm the exact request body against the current Uber dashboard documentation before deploying; sandbox payloads can differ by product access.

### Dispatch a mock trip

The server adapter handles OAuth and the guest trip call:

```ts
import { dispatchTrip } from './services/uber'

const trip = await dispatchTrip({
  pickupLat: 26.2495,
  pickupLng: 78.1740,
  dropoffLat: 26.2183,
  dropoffLng: 78.1828,
})
```

### Simulate driver milestones

Use the sandbox controls or the adapter's status method to simulate:

```ts
import { simulateStatus } from './services/uber'

await simulateStatus(tripId, 'ACCEPT')
await simulateStatus(tripId, 'ARRIVED')
await simulateStatus(tripId, 'BEGIN_TRIP')
await simulateStatus(tripId, 'DROPOFF')
```

These transitions let the tracking screen be tested without a real driver.

### Webhooks with ngrok

1. Install ngrok and authenticate it with your account.
2. Start the Express server.
3. Expose the API:

```bash
ngrok http 4000
```

4. Copy the HTTPS forwarding address.
5. Set the Uber webhook URL to:

```text
https://YOUR-NGROK-DOMAIN.ngrok-free.app/api/uber/webhook
```

6. Add a webhook handler that verifies the provider signature before processing `trip.status_changed`.
7. Keep the ngrok URL only for local testing; use a stable HTTPS endpoint in production.

---

## 5. PWA configuration

To make the client installable on mobile devices:

```bash
npm install -D vite-plugin-pwa
```

Update `vite.config.ts`:

```ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'IIITM CampusPool',
        short_name: 'CampusPool',
        description: 'Shared rides for ABV-IIITM students',
        theme_color: '#8C3A36',
        background_color: '#FFFFFF',
        display: 'standalone',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
```

Then build and preview:

```bash
npm run build
npm run preview
```

Serve the built app over HTTPS in production so browsers can install the service worker. Add offline caching only for safe static assets; ride status, payments, SOS alerts, and dispatch must remain online and server-authoritative.

---

## API overview

The Express server exposes:

- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `POST /api/rides/request`
- `POST /api/pools/match`
- `POST /api/pools/:id/sequence`
- `POST /api/pools/:id/split`
- `POST /api/payments/mock-order`
- `POST /api/payments/verify`
- `POST /api/uber/mock-dispatch`
- `POST /api/safety/trigger-sos`
- `GET /api/chat/:poolId`
- `POST /api/chat/:poolId`

For a production deployment, replace mock OTP validation with a short-lived server-side OTP flow, scope Prisma records to authenticated users, validate all coordinates and fare values on the server, and keep third-party secrets out of the client bundle.

---

## Stop-Order Optimizer & Grouping Algorithm Integration

This section explains the three backend modules that power pool formation, stop sequencing, and fare allocation.

### How the Matching Engine Works

The grouping engine (`server/src/services/groupingEngine.ts`) clusters pending ride requests into capacity-safe pools using a three-stage greedy algorithm:

1. **Temporal window overlap** — Two riders are compatible only if their flexible departure windows overlap within a configurable tolerance. The engine computes the intersection of all `flexTimeStart`/`flexTimeEnd` windows in a candidate cluster, then checks that a new rider's window falls within ±15 minutes of that intersection. The tolerance is controlled by `GROUPING_TIME_TOLERANCE_MINUTES` in `server/src/config.ts`.

2. **Angular direction filtering** — Each ride request has an implicit travel direction vector from pickup to dropoff (latitude-corrected). The engine computes the angle between the seed rider's direction vector and each candidate's direction vector using the dot-product formula. If the angular difference exceeds 55 degrees, the rider is rejected — they are heading in a fundamentally different direction and would create excessive detour. The tolerance is `GROUPING_DIRECTION_TOLERANCE_DEGREES`.

3. **Spatial bounding box** — The engine builds a lat/lng bounding box around all existing cluster pickups and dropoffs, padded by 4 km. A candidate's pickup and dropoff must both fall inside this padded box. This prevents matching riders whose endpoints are spatially distant even if their direction and timing align. The padding is `GROUPING_ROUTE_PADDING_KM`.

4. **Greedy detour minimization** — Among all compatible candidates, the engine picks the one that adds the smallest incremental detour distance to the cluster. Detour is estimated as the difference between the shared route distance (pickup centroid → dropoff centroid plus average dispersion) and the sum of individual direct distances. This greedily minimizes total group travel overhead.

5. **Capacity constraint** — Clusters are capped at 3 riders for Auto Rickshaw (`AUTO_3`) and 4 riders for Cab (`CAB_4`). Once a cluster reaches capacity, no more riders are added.

The engine runs automatically in two places: when `POST /api/pools/match` is called (explicit match attempt) and when a new `RideRequest` is submitted via `POST /api/rides/request` (automatic background match if ≥2 compatible rides exist).

### Google Maps Directions API Wiring

The route optimizer (`server/src/services/routeOptimizer.ts`) sequences all pickups and dropoffs into an optimal driving order.

#### Enabling the Directions API

1. Open Google Cloud Console and select your project.
2. Navigate to APIs & Services → Library.
3. Search for and enable the **Directions API**.
4. Ensure `GOOGLE_MAPS_API_KEY` is set in `server/.env` (server-restricted key).
5. Set `USE_LIVE_GOOGLE_MAPS=true` in `server/.env` to activate live mode.

#### Request schema

When live mode is active, the optimizer constructs this request:

```
GET https://maps.googleapis.com/maps/api/directions/json
  ?origin={origin.lat},{origin.lng}
  &destination={destination.lat},{destination.lng}
  &waypoints=optimize:true|{wp1.lat},{wp1.lng}|{wp2.lat},{wp2.lng}|...
  &key={GOOGLE_MAPS_API_KEY}
```

- **Origin**: The driver's start point or the first campus pickup.
- **Waypoints**: All passenger pickup and dropoff coordinates, prefixed with `optimize:true` so Google solves the TSP ordering.
- **Destination**: The farthest dropoff coordinate.

#### Parsing the response

Google returns a `waypoint_order` array — an index mapping that reorders the intermediate waypoints into the optimal driving sequence. The optimizer:

1. Reorders waypoints according to `waypoint_order`.
2. Reads `legs[].distance.value` (in meters) for each leg between consecutive stops.
3. Assigns each stop an explicit `stopSequence` number (1-indexed).
4. Computes `distanceFromPreviousKm` and `cumulativeDistanceKm` for each stop.
5. Returns the total route distance.

These `stopSequence` values map directly to the student stop cards shown in the pool view — each rider sees their pickup and dropoff in the order the driver will actually visit them.

### Distance-Weighted Fare Split

The fare splitter (`server/src/services/fareSplitter.ts`) uses the ordered distances from the route optimizer:

```
Individual Fare = Base Fare × (Rider Distance / Σ All Riders Distances)
```

When all rider distances are zero (no route data yet), the base fare is split equally. The module rounds to 2 decimal places and applies a penny-level correction to the last rider so the shares always sum to exactly the base fare. When a Prisma client is available, shares are persisted to `PoolMember.individualFare` via `updatePoolMemberFares()`.

### Switching from Mock to Live

The single config flag is in `server/src/config.ts`:

```ts
export const USE_LIVE_GOOGLE_MAPS = process.env.USE_LIVE_GOOGLE_MAPS === 'true' && Boolean(process.env.GOOGLE_MAPS_API_KEY)
```

**Mock mode** (default, no config needed): The optimizer uses a deterministic nearest-neighbor heuristic based on Haversine distance. Starting from the origin, it repeatedly visits the nearest unvisited waypoint until all stops are sequenced. This works out of the box for the demo prototype.

**Live mode** (production): Set both environment variables in `server/.env`:

```env
GOOGLE_MAPS_API_KEY="your-server-restricted-key"
USE_LIVE_GOOGLE_MAPS="true"
```

The optimizer will call the Google Maps Directions API with `optimize:true` waypoint ordering. If the API call fails for any reason (network error, invalid key, quota exceeded), the optimizer automatically falls back to the nearest-neighbor heuristic so the app never breaks.

The grouping engine parameters are also configurable in the same file:

```env
GROUPING_TIME_TOLERANCE_MINUTES=15
GROUPING_DIRECTION_TOLERANCE_DEGREES=55
GROUPING_ROUTE_PADDING_KM=4
```
