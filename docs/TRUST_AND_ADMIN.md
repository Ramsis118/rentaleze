# Trust & safety and the admin panel

This branch (`feature/trust-and-admin`) adds four things:

1. **Real ID + phone verification.** Stripe Identity checks a photo ID and a matching selfie. Twilio Verify sends the text-message codes. Rentaleze no longer stores pictures of anyone's ID.
2. **Condition photos.** Owner and renter add photos at pickup and at return. Only the two of them and admins can see these photos, through signed links that expire after one hour.
3. **Reviews and claims.** After a rental, renter and owner review each other. Reviews are double-blind: neither sees the other's until both have posted or 14 days pass. During a rental, or up to 72 hours after the item comes back, either side can file a claim (damage, missing parts, late return, or an item that wasn't as described). Both sides can reply, and an admin makes the decision.
4. **Admin panel at `/admin`.** Growth numbers, a claims queue, users (approve an ID by hand, suspend, reinstate), listing moderation (pause or remove), bookings, the waitlist with CSV export, and an activity log of every admin action.

## Setup (Render → rentaleze-app → Environment)

| Setting | Where to get it |
|---|---|
| `ADMIN_EMAILS` | Your own email, e.g. `you@example.com`. Several emails can go in one line, separated by commas. Nobody can sign up as an admin. |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys. Use the test-mode key on beta. You must also fill in the Identity application at dashboard.stripe.com/identity/application. |
| `STRIPE_IDENTITY_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → Add endpoint `https://beta.rentaleze.com/api/webhooks/identity` with the `identity.verification_session.*` events, then copy its signing secret. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Twilio Console home page. |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Console → Verify → Services → create a service named "Rentaleze". |
| `FILE_URL_SECRET` | Created by Render automatically. |

**Running on your computer without keys:** the app runs in development mode. The ID check is simulated with one click and the text code is always `123456`. In production, verification stays off until the keys are set. It never falls back to fake checks.

## One-time cleanup

The old flow saved photos of people's IDs to `uploads/ids`. Delete them once on every server:

```
node server/scripts/purge-id-photos.js
```

On Render: Shell tab → run the command above.

Anyone who used the old demo phone code (stored as `is_verified = 2`) is reset to "not ID-verified" and has to finish the real ID check.

## New API routes

- `GET /api/verification/status`, `POST /api/verification/identity/start`, `POST /api/verification/phone/send`, `POST /api/verification/phone/check`
- `POST /api/webhooks/identity` (Stripe-signed; let through the beta password gate)
- `GET /api/bookings/:id/trust`: photos, reviews and claims for one booking
- `POST /api/bookings/:id/photos?stage=pickup|return|claim` (multipart field `photos`)
- `POST /api/bookings/:id/review` `{ rating, text }`
- `POST /api/bookings/:id/claims` `{ type, description, amountRequested }`, plus `/claims/:claimId/comment` and `/claims/:claimId/withdraw`
- `GET /api/users/:id/public`: public profile with verification badges and reviews
- `/api/admin/*`: stats, users, listings, bookings, claims, waitlist, audit, config (admins only)

## Database

All changes are added automatically when the server starts (`upgradeDatabase()`). Existing data is kept.

New columns: `users.id_status`, `identity_session_id`, `id_verified_at`, `id_last_error`, `phone_verified_at`, `suspended`, `suspended_reason`; `reviews.booking_id`, `reviewer_role`, `subject_user_id`; `bookings.picked_up_at`, `returned_at`; `listings.moderation_note`.

New tables: `booking_photos`, `claims`, `claim_events`, `admin_actions`.

## Connects to payments later

When the Stripe payments work is merged, approved claim amounts need to be collected. Look for `TODO(payments)` in `server/routers/admin.js` (`PUT /api/admin/claims/:id`). That's where you either capture the renter's deposit hold or send a Stripe invoice. `server/services/identity.js` creates its own Stripe client. Once `server/utils/stripe.js` lands on main, switch it to use that shared client.

## Not built yet (next steps)

- Email or text alerts for new requests, claims and review reminders. Today these only show inside the app.
- Storing photos in cloud storage (Cloudflare R2 or S3) in place of the Render disk.
- An appeal flow for removed listings.
