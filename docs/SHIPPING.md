# Shipping with ShipStation

Shipped rentals get two prepaid labels: a **send** label (owner → renter) and a **return** label (renter → owner).
Rentaleze buys them through the ShipStation API v2 and charges the renter a round-trip shipping price at booking.

## How it works

1. **Owner lists an item** with "Shipping available" and must enter the packed size (L × W × H in inches, weight in lb)
   and a ship-from address. The address is private: only the owner (and the carrier label) sees it.
   Renters see the box size and weight on the listing.
2. **Renter picks "Ship to me"** and types a delivery address. The booking card asks `/api/shipping/quote` for a
   live estimate (send + return, from the package size). The server re-quotes when the booking is created, so the
   price can't be edited in the browser. If live rates aren't available it falls back to the flat fee (`SHIPPING_FLAT_FEE`, $24).
3. **Owner accepts** (or the listing is Instant Book) → the server rate-shops the full shipment, buys the cheapest
   allowed outbound label, then creates the return label from it (`POST /v2/labels/{id}/return`, which swaps the addresses).
4. **Bookings page**: the owner sees both labels (print PDF, tracking). The renter sees tracking and their return label.
   If a label fails (bad address, missing size), the owner sees the reason and a "Try again" button.
5. **Cancel / decline** → unused labels are voided so the carrier refunds them.
6. **Tracking webhook**: when the send label is delivered, the booking moves to "In progress" automatically.
   Returns are *not* auto-completed — the owner still marks it returned after checking the item.

## Setup

| Env var | What it is |
|---|---|
| `SHIPSTATION_API_KEY` | ShipStation → Settings → API Settings → **API v2** key. Without it: mock labels in dev, flat fee + no labels in production. |
| `SHIPSTATION_CARRIER_IDS` | Comma list of carrier IDs to buy from, e.g. `se-123456,se-789012`. Get them from `GET https://api.shipstation.com/v2/carriers`. |
| `SHIPSTATION_SERVICE_CODES` | Optional. Limit which services are bought, e.g. `usps_ground_advantage,ups_ground`. Empty = cheapest of all. |
| `SHIPSTATION_MAX_TRANSIT_DAYS` | Optional, default `5`. Skips slower services. |
| `SHIPPING_FLAT_FEE` | Optional, default `24`. Used when an exact quote isn't possible. |
| `SHIPPING_HANDLING_FEE` | Optional, default `0`. Added once per round trip (covers boxes, rate changes). |
| `SHIPSTATION_WEBHOOK_TOKEN` | Random secret. Register the webhook (event **Track**) at `https://beta.rentaleze.com/api/shipping/webhook?token=<value>`. |

**Funding**: labels are paid from the ShipStation account balance (or the carrier account you connect). Keep the
balance topped up — when a purchase fails, the owner sees the error and can retry.

**Return labels**: most carriers (USPS, UPS) only charge a return label when it is scanned, so unused returns cost nothing.

## Test it

```
node server/scripts/smoke-shipping.js
```

Runs 42 checks against a throwaway database in mock mode (no API key, no money spent): dimension validation,
address privacy, quotes, label creation on accept and Instant Book, idempotent retry, voiding on cancel,
webhook auth and tracking, and error reporting.

To try real labels without being charged, use a ShipStation **sandbox** API key in `SHIPSTATION_API_KEY` locally.

## API

| Route | Who | What |
|---|---|---|
| `GET /api/shipping/status` | anyone | `{ mode: 'live' \| 'mock' \| 'off' }` |
| `GET /api/shipping/quote?listingId&zip&city&state` | anyone | `{ fee, estimated, outbound, return, deliveryDays }` |
| `GET /api/shipping/bookings/:id` | owner / renter | Labels + tracking (refreshes tracking every 30 min) |
| `POST /api/shipping/bookings/:id/labels` | owner | Create or retry missing labels (idempotent) |
| `POST /api/shipping/webhook?token=…` | ShipStation | Tracking updates |

Bookings (`/api/bookings/...`) also include `shipments`, `shippingFee` and `shippingEstimated`.

## Data

- `listings`: `ship_weight_oz`, `ship_length_in`, `ship_width_in`, `ship_height_in`, `ship_from` (JSON address)
- `bookings`: `shipping_name`, `shipping_phone`, `shipping_estimated` (plus the existing address columns)
- `shipments`: one row per label (`outbound` / `return`), with label ID, tracking, cost, status (`created` / `error` / `voided`)

Migrations run automatically on start.
