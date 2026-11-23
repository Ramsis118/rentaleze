# Notifications & help desk

## Notifications

Every event goes through one function, `notify(userId, type, data)` in `server/services/notify.js`.
It creates the in-app notification (bell icon + Dashboard → Notifications), then sends the email
(Resend) and/or text (Twilio) the event calls for. Every send attempt is recorded in
`notification_deliveries`, which support can see on a customer's profile.

**Preferences** (Dashboard → Notifications): email on/off, texts on/off. Security, account and support
emails are always sent. Texts only go to a **verified** phone.

### Triggers

| When | Who | In-app | Email | Text |
|---|---|:-:|:-:|:-:|
| Sign up | new user | ✓ | ✓ | |
| ID verified / ID check failed | user | ✓ | ✓ | |
| Forgot password (reset link) | user | | ✓ always | |
| Password changed | user | ✓ | ✓ always | ✓ |
| Account suspended / reinstated | user | ✓ | ✓ always | |
| New booking request | owner | ✓ | ✓ | ✓ |
| Instant Book booking | owner + renter | ✓ | ✓ | ✓ |
| Request accepted | renter | ✓ | ✓ | ✓ |
| Request declined | renter | ✓ | ✓ | |
| Booking cancelled | other side (both if support cancels) | ✓ | ✓ | ✓ |
| Rental finished → leave a review | both | ✓ | ✓ | |
| Shipping labels ready | owner | ✓ | ✓ | |
| Shipping label problem | owner | ✓ | ✓ | |
| Item delivered to renter | renter (+ owner in-app) | ✓ | | ✓ |
| Return shipped / return delivered | owner | ✓ | delivered only | ✓ |
| Support ticket received / replied / solved | customer | ✓ | ✓ always | |
| Ticket assigned / customer replied | support agent | ✓ | | |

**Scheduled reminders** (every 15 minutes, each sent once):

| Reminder | Who |
|---|---|
| Pickup rental starts tomorrow | renter + owner (in-app + text) |
| Shipped rental starts within 3 days and the send label hasn't been scanned | owner |
| Return due tomorrow | renter |
| Return overdue | renter + owner |
| Signed up over a day ago and still not verified | user (once) |
| Solved tickets with no reply for 7 days | closed automatically |

Admins can run them on demand: `POST /api/notifications/run-jobs`.

## Help desk (`/helpdesk`)

For customer service workers (`support` role) and admins.

- **Queue**: Open, Assigned to me, Unassigned, Waiting on customer, Solved, All, sorted by priority
  then oldest first. A blue dot means the customer is waiting on us.
- **Ticket**: conversation, internal notes (staff only), reply with "then set to…" status, change
  status, priority, category and assignee. Shows the customer card and booking (with labels) beside it.
- **Search**: email, name, phone, booking ID, tracking number, item title or `#ticket`.
- **Customer profile**: verification, bookings (as renter and owner), listings, tickets, every
  email and text sent (including failures), and staff activity.
- **Actions** (all logged in the activity log; risky ones need a reason): cancel a booking (voids labels
  and tells both sides), retry or void shipping labels, send a password reset link, send a verification
  reminder, suspend or reinstate an account (agents can't suspend staff), and open a ticket for a customer
  (for example after a phone call).
- **Support team**: admins add an agent by account email, or remove one. Their open tickets become unassigned.

Customers use **Dashboard → Help & Support** to open tickets (optionally about a booking), reply and
mark them solved. Suspended accounts can still contact support. Damage tickets and tickets about a
live rental start as high priority.

## Setup (Render → Environment)

| Variable | What it is |
|---|---|
| `RESEND_API_KEY` | From resend.com → API Keys. Add and verify the `rentaleze.com` domain in Resend first (DNS records go in Cloudflare). |
| `EMAIL_FROM` | e.g. `Rentaleze <notifications@rentaleze.com>` (must be on the verified domain). |
| `APP_URL` | Links in emails, e.g. `https://beta.rentaleze.com` (falls back to `FRONTEND_URL`). |
| `TWILIO_MESSAGING_SERVICE_SID` | Twilio → Messaging → Services. Recommended: handles STOP replies and US A2P 10DLC registration. Or set `TWILIO_FROM_NUMBER`. Uses the same `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` as phone verification. |
| `SUPPORT_EMAILS` | Optional comma list of support agent emails. You can also add agents in the help desk. |

Without these, development logs emails and texts instead of sending them (shown as `dev` in the
customer profile). In production, a missing key shows as a `failed` delivery, and the action that
triggered it still completes.

**US texting note**: before Twilio delivers texts from a 10-digit number you must register the brand
and campaign (A2P 10DLC) in the Twilio console. That takes a few days. A toll-free number needs toll-free verification instead.

## Tests

```
node server/scripts/smoke-helpdesk.js   # 85 checks: notifications, reminders, password reset, tickets, help desk
node server/scripts/smoke-shipping.js   # 42 checks
node server/scripts/smoke-trust.js      # 45 checks
```
