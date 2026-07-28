

## Unified Plan: Account Dashboard + Session CRUD

### Account Dashboard — Rocycle-inspired layout with live session data

```text
┌──────────────────────────────────────────────────────────────────────┐
│  ACCOUNT PAGE (/account)                    clean white/light bg     │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────────────────────────────┐  │
│  │                  │  │                                          │  │
│  │  ○ JD            │  │  Upcoming                                │  │
│  │                  │  │  SESSIONS                                │  │
│  │  Good morning,   │  │                                          │  │
│  │  JANE            │  │  ┌──────────────────────────────────────┐│  │
│  │                  │  │  │ ○ MC  MORNING VINYASA FLOW           ││  │
│  │  ✏ Edit profile  │  │  │      Maya Chen · Sun 29 Mar · 6 AM  ││  │
│  │  ✏ Manage cards  │  │  │      📍 Downtown        [CANCEL]     ││  │
│  │                  │  │  └──────────────────────────────────────┘│  │
│  │  ────────────    │  │  ┌──────────────────────────────────────┐│  │
│  │                  │  │  │ ○ JW  HIIT & STRENGTH                ││  │
│  │  Level           │  │  │      Jordan · Apr 2 · 5:30 PM       ││  │
│  │  100 SESSIONS    │  │  │      📍 Downtown        [CANCEL]     ││  │
│  │                  │  │  └──────────────────────────────────────┘│  │
│  │  Sessions        │  │                                          │  │
│  │  24              │  │  ┌──────────────────────────────────────┐│  │
│  │                  │  │  │  + BOOK A NEW SESSION  →             ││  │
│  │  Referrals       │  │  └──────────────────────────────────────┘│  │
│  │  3               │  │                                          │  │
│  │                  │  │  Past                                    │  │
│  │  ────────────    │  │  SESSIONS                                │  │
│  │                  │  │                                          │  │
│  │  ┌────────────┐  │  │  ┌──────────────────────────────────────┐│  │
│  │  │  LOG OUT → │  │  │  │ ○ SM  PILATES REFORMER  ✓ ATTENDED  ││  │
│  │  └────────────┘  │  │  │      Sofia · Mar 25 · 10 AM         ││  │
│  │                  │  │  │      📍 Downtown     [BOOK AGAIN]    ││  │
│  └──────────────────┘  │  └──────────────────────────────────────┘│  │
│                        │                                          │  │
│                        │  Your                                    │  │
│                        │  DASHBOARD                               │  │
│                        │                                          │  │
│                        │  ┌──────────────────────────────────────┐│  │
│                        │  │  MEMBERSHIPS                         ││  │
│                        │  │                                      ││  │
│                        │  │  ↻ Automatic renewal / every 28 days ││  │
│                        │  │  ✕ Cancel anytime / from your account││  │
│                        │  │  $ Best deal / best price per session ││  │
│                        │  │                                      ││  │
│                        │  │  ┌──────────────────────────────┐    ││  │
│                        │  │  │   BECOME A MEMBER  →         │    ││  │
│                        │  │  └──────────────────────────────┘    ││  │
│                        │  │  Read our memberships FAQ             ││  │
│                        │  └──────────────────────────────────────┘│  │
│                        │                                          │  │
│                        │  ┌──────────────────────────────────────┐│  │
│                        │  │  No series          BUY SERIES →     ││  │
│                        │  └──────────────────────────────────────┘│  │
│                        └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### CREATE — Book a New Session (50vw sheet)

```text
User clicks [+ BOOK A NEW SESSION] or header "Book a session"
              │
              ▼
┌─────────────────────────────────┐
│  BOOKING SHEET (50vw)           │
│                                 │
│  STEP 1: SELECT A DATE          │
│                                 │
│  ┌───────┐ ┌───┐ ┌───┐ ┌───┐   │
│  │ TODAY  │ │MON│ │TUE│ │WED│ → │
│  │ 29 Mar │ │30 │ │31 │ │ 1 │   │
│  └───────┘ └───┘ └───┘ └───┘   │
│   ▲ selected                    │
│                                 │
│  ┌─────────────────────────────┐│
│  │ 06:00  ○ Maya Chen          ││
│  │        Morning Vinyasa Flow ││
│  │        📍 Downtown Core   → ││
│  ├─────────────────────────────┤│
│  │ 10:00  ○ Sofia Martinez     ││
│  │        Pilates Reformer     ││
│  │        📍 Downtown Core   → ││
│  ├─────────────────────────────┤│
│  │ 17:30  ○ Jordan Williams    ││
│  │        HIIT & Strength      ││
│  │        📍 Downtown Core   → ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
              │ tap session
              ▼
┌─────────────────────────────────┐
│  BOOKING SHEET (50vw)           │
│  ← Back                    ✕   │
│                                 │
│  STEP 2: CONFIRM SESSION        │
│                                 │
│  MORNING VINYASA FLOW           │
│  with Maya Chen                 │
│  Sun 29 Mar · 06:00 AM          │
│  📍 Downtown Core · 60 min      │
│                                 │
│  Drop-in session         $30    │
│                                 │
│  ┌─────────────────────────┐    │
│  │  CONTINUE TO CHECKOUT → │    │  ← if not logged in
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │  CONFIRM BOOKING →      │    │  ← if logged in
│  └─────────────────────────┘    │
│                                 │
│  INSERT INTO bookings           │
│  (user_id, class, date, time)   │
│  ✓ Session added to dashboard   │
└─────────────────────────────────┘
```

### CHECKOUT — Unauthenticated (50vw sheet)

```text
┌──────────────────────────────────────────────────┐
│           CHECKOUT SHEET (50vw)                   │
│  ┌──────────────┬───────────────────────────────┐ │
│  │  ORDER       │  STEP 3: BILLING ADDRESS      │ │
│  │  SUMMARY     │                               │ │
│  │              │  ┌─────────────────────────┐   │ │
│  │  1× Drop-in  │  │ ADDRESS                 │   │ │
│  │  Vinyasa     │  └─────────────────────────┘   │ │
│  │  Sun 29 Mar  │  ┌───────────┐ ┌───────────┐   │ │
│  │              │  │ CITY      │ │ POSTAL    │   │ │
│  │  ──────────  │  └───────────┘ └───────────┘   │ │
│  │  Total: $30  │  ┌─────────────────────────┐   │ │
│  │              │  │ COUNTRY  ▾              │   │ │
│  │              │  └─────────────────────────┘   │ │
│  │              │  ┌─────────────────────────┐   │ │
│  │              │  │ SELECT PAYMENT METHOD → │   │ │
│  │              │  └─────────────────────────┘   │ │
│  └──────────────┴───────────────────────────────┘ │
│                         │                         │
│                         ▼                         │
│  ┌──────────────┬───────────────────────────────┐ │
│  │  ORDER       │  STEP 4: PAYMENT              │ │
│  │  SUMMARY     │  ✓ Billing address  EDIT      │ │
│  │              │                               │ │
│  │              │  ┌────────────┐┌────────────┐  │ │
│  │              │  │▓ CREDIT   ▓││  PAYPAL    │  │ │
│  │              │  └────────────┘└────────────┘  │ │
│  │              │  ┌─────────────────────────┐   │ │
│  │              │  │ CARD NUMBER              │   │ │
│  │              │  └─────────────────────────┘   │ │
│  │              │  ┌───────────┐ ┌───────────┐   │ │
│  │  ──────────  │  │ MM / YY   │ │ CVC       │   │ │
│  │  Total: $30  │  └───────────┘ └───────────┘   │ │
│  │              │  ┌─────────────────────────┐   │ │
│  │              │  │   COMPLETE PURCHASE  →   │   │ │
│  │              │  └─────────────────────────┘   │ │
│  └──────────────┴───────────────────────────────┘ │
│                         │                         │
│                         ▼                         │
│  ┌─────────────────────────────────────────────┐  │
│  │         gradient: coral → cream              │  │
│  │           Thank you                          │  │
│  │        FOR YOUR PURCHASE                     │  │
│  │                                              │  │
│  │  ┌───────────────────────────┐               │  │
│  │  │    BOOK A SESSION  →      │               │  │
│  │  └───────────────────────────┘               │  │
│  │  ┌───────────────────────────┐               │  │
│  │  │    BACK HOME  →           │               │  │
│  │  └───────────────────────────┘               │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### UPDATE — Reschedule (tap session row on dashboard)

```text
User clicks session row on /account
              │
              ▼
┌─────────────────────────────────┐
│  SESSION DETAIL SHEET (50vw)    │
│                                 │
│  MORNING VINYASA FLOW           │
│  Maya Chen                      │
│  Sun 29 Mar · 06:00 AM          │
│  📍 Downtown Core               │
│                                 │
│  ┌─────────────────────────┐    │
│  │    RESCHEDULE  →        │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │    CANCEL SESSION       │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
              │
  "Reschedule" → opens BOOKING SHEET
  (same as CREATE, but UPDATE row)
```

### DELETE — Cancel Session

```text
User clicks [CANCEL] on session
              │
              ▼
┌─────────────────────────────────┐
│  CANCEL CONFIRMATION            │
│                                 │
│  Are you sure you want to       │
│  cancel this session?           │
│                                 │
│  MORNING VINYASA FLOW           │
│  Sun 29 Mar · 06:00 AM          │
│                                 │
│  ┌─────────────────────────┐    │
│  │   YES, CANCEL SESSION   │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │   KEEP SESSION          │    │
│  └─────────────────────────┘    │
│                                 │
│  UPDATE bookings                │
│  SET status = 'cancelled'       │
│  WHERE id = booking_id          │
└─────────────────────────────────┘
```

### Database

```text
bookings
├── id            uuid PK
├── user_id       uuid FK → auth.users
├── class_name    text
├── practitioner  text
├── date          date
├── time          time
├── location      text   default 'Downtown Core'
├── status        text   default 'confirmed'
├── created_at    timestamptz
└── updated_at    timestamptz

RLS: all ops WHERE user_id = auth.uid()
```

### Implementation — Files

| File | Action | What |
|------|--------|------|
| `src/pages/AccountPage.tsx` | Modify | Rocycle-inspired layout: clean bg, bare stats sidebar, time-based greeting, pencil-icon links, memberships card with icon rows, no-series row, live session data from DB |
| `src/components/BookingSheet.tsx` | New | 50vw sheet: date strip + session list → confirm → insert/update booking |
| `src/components/SessionDetailSheet.tsx` | New | 50vw sheet: view session details, reschedule/cancel buttons |
| `src/components/CancelDialog.tsx` | New | Confirmation dialog for cancellation |
| `src/components/CheckoutSheet.tsx` | Modify | 50vw width, accept session metadata for order summary |
| `src/contexts/CheckoutContext.tsx` | Modify | Add `openBooking()`, pass session data between sheets |
| `src/data/studios.ts` | Modify | Trim classes to 3 practitioners only |
| Migration | New | Create `bookings` table with RLS |

### Flow Summary

```text
ACTION    AUTH?   TRIGGER                  PATH
────────────────────────────────────────────────────────
CREATE    No      Header btn / pricing  →  BookingSheet → CheckoutSheet → confirm
CREATE    Yes     Header btn / dashboard → BookingSheet → confirm (skip billing)
READ      Yes     /account load         →  Query bookings → upcoming/past
UPDATE    Yes     Tap session row       →  SessionDetailSheet → BookingSheet → update
DELETE    Yes     [CANCEL] btn          →  CancelDialog → soft-delete
```

