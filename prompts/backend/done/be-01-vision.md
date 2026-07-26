# Backend Phase — Vision & Roadmap (Healthings.ai)

> North-star doc for the backend phase: accounts, sharing, sync, and the mentor dashboard.
> Everything below is the agreed direction; backend prompts (`be-02+`) derive from it.

---

## 1. Product thesis
Healthings is **not a meal recorder**. It is a **closed-loop personal metabolic system**:
body composition (Withings) + continuous glucose (CareSens/CGM) + 24/7 heart rate +
meals — reasoned about *together* by a team of AI mentors (nutritionist, coach, doctor),
with a bridge to share data with a real human professional.

The meal log is just one input to the loop. The differentiation is **integration +
continuity + an AI mentor team + hardware-agnostic** (uses devices the user already owns
via Health Connect — we don't sell hardware).

### The core magic (even without Withings): CGM + meals + mentors
The single most differentiated experience is **glucose tied to specific meals, explained
by an AI mentor**: "you ate X at 13:21 → glucose 86→106 over 30 min → here's why, and what
to change." No meal app does this; most CGM apps show curves but don't tie them to meals
with a mentor who knows your targets. **CGM alone (no Withings) already unlocks this** — a
CareSens-only user is a first-class target, not a second-class one. Withings adds body
composition, visceral fat, muscle, and 24/7 HR — richer, but additive on top of the magic.

### Progressive enhancement — meals is the entry, the rest is additive
The entry point is the lowest-friction action: **documenting meals**. Everything else is
optional and purely additive, in the user's own time. The three signals map to the loop:
- **Meals = energy IN.** Baseline rung; usable from day one.
- **+ CGM (user's choice) = glucose response.** Adds meal-glucose correlation; nothing
  breaks if absent.
- **+ Withings = energy OUT.** BMR + activity + workout burn → real energy balance
  (deficit/surplus). This is what truly **closes the loop** — without it the mentor is
  half-blind on expenditure. Also adds body composition + 24/7 HR.

Architecture rule: **graceful degradation** — the app works fully at each rung and lights
up more value as devices connect, never erroring or nagging about missing data (already
the behaviour in the mentor prompts: report empty categories, don't demand data).

### Cost structure (drives pricing): only AI recurs
- **Hardware integrations cost us nothing per use** — Withings, CareSens/CGM, and Health
  Connect data flow from the user's own devices. Connecting more devices is **free for us
  to support** and strictly better for the user → encourage it at every tier.
- **AI (Gemini) is the only recurring per-use cost.** Therefore the paywall sits on **AI
  usage, not on hardware**. A full closed-loop user costs us the same as a standalone user;
  "full closed loop" is a richer *experience*, not a more expensive *tier*.

## 2. Audience
Premium, self-selected quantified-self users who already invested $1000+ in home health
tech (Withings scale + watch, CareSens CGM). They have declared they pay for the best
tracking. Price sensitivity is low; they think in monthly memberships.

Mentors (nutritionists, coaches, trainers) are **both customers and power users** — they
want this service level for themselves first, then for their clients.

**Secondary segment — standalone (no hardware):** anyone wanting an AI meal/health coach
can use the app without Withings/CGM (manual meals + AI chat). Larger top-of-funnel and a
natural upsell path into the full closed-loop once they buy hardware.

## 3. Positioning — the real alternative is the clinic, and it loses
Replicating this via the professional route costs thousands/year for **intermittent,
delayed, gate-kept** data:
- CGM via prescription + endocrinologist visits
- DEXA scans (~$50–150 each) for body composition trend
- Clinical HR monitoring (short-term only)
- A nutritionist + doctor + trainer reviewing stale snapshots ($100–300/visit each)

Healthings gives the same signals **24/7, continuous, in context, forever** — a category
the clinic cannot offer. Tagline direction:
**"Your personal metabolic lab and care team — 24/7, for the price of one clinic visit a year."**

## 4. Competitive gap (no single app closes the loop)
- **MyFitnessPal / Cronometer** — meal logging only; no CGM, body comp, or AI reasoning.
- **Levels / Nutrisense / Veri** — CGM + coaching, but sell their own CGM, US-centric,
  pricey, no Withings body/visceral integration, no multi-mentor AI.
- **Withings Health Mate** — body + HR data; no glucose correlation, no meal AI, no mentor.
- **Whoop / Oura** — recovery/sleep; nothing on the meal→glucose loop.

Healthings unique combination: hardware-agnostic + closed loop + AI mentor team +
share-with-professional.

## 5. Business model
**Core principle: AI IS the experience; the ~$5 is the low bar of entry.**
Meal documentation *is* AI (photo analysis) — AI is not an optional add-on, it is the core
action. The ~$5 minimum top-up is a deliberately low **qualifying filter**, not a barrier:
someone unwilling to pay $5 simply isn't serious about the process. For this audience that's
a feature — it keeps the user base committed and filters out tire-kickers. The only "free"
is the **demo + a small taste** so people can *feel* the magic before paying — there is no
fully functional free tier.

### Two segments (one app)
- **Full closed-loop (ideal):** has Withings scale/watch + CareSens CGM → the complete
  metabolic system. The premium peak.
- **Standalone (broad base):** no hardware → still documents meals (via AI) + chats with
  AI. A feature, not a compromise — it widens the funnel and is an **upsell path** (a
  standalone user who loves the AI coach is the perfect future hardware buyer). Do NOT lock
  the app to Withings owners. (Still requires buying tokens — from ~$5 — to use AI on own data.)

### Open-app experience (conversion funnel)
- **Open app → demo data loads.** Anyone can explore the product immediately — no
  hardware, no payment, no signup wall.
- **Small free AI taste on demo data** (e.g. ~3 questions / 1 photo) so the user *feels
  the magic before paying*. Paywall comes AFTER the taste, never before (paying just to
  try kills conversion).
- Then pay (~$10) to use AI on **your own data** (meal documentation + mentor chat). AI on
  own data is the product; there is no functional free tier beyond the demo + taste.

### Tiers
| Tier | Who | Price (working) | What they get |
|------|-----|-----------------|----------------|
| **Demo** | Anyone | $0 | Open app, demo data, small free AI taste — to *feel* it, not a usable free tier. |
| **Premium** | Private user | **tokens, $5 min top-up (pay-per-use)** | AI on own data (meal documentation + mentor chat); $5 entry pack, top up again when it runs out. Full closed-loop if hardware connected. |
| **Pro / Mentor** | Nutritionist/coach | Dashboard + token packs | Dashboard to track shared patients; buys token packs (for self and/or to gift to clients). |

### Pricing model — DECIDED: prepaid tokens, pay-per-use (no subscription)
- **Buy tokens → a bucket.** Using AI (meal documentation, mentor chat) depletes tokens.
- **$5 minimum top-up (larger amounts available).** $5 is the entry pack and the floor;
  bigger top-ups ($10, $20…) are offered too. Low enough for easy conversion, high enough
  to filter out non-serious users AND to clear payment-processor fees cleanly (a $5 charge
  nets ~$4.55 after Stripe; $1 would net only ~$0.67 — why we avoid sub-$5).
- **Run out → AI service closes** until the user buys another pack. Pure pay-per-use.
- **Margin-safe by design.** The earlier risk was one-time-for-*unlimited* (would lose money
  as Gemini costs recur forever). A one-time-for-a-*depleting-bucket* has no such risk: when
  tokens run out, cost stops. Each pack must be priced above its Gemini + payment-fee cost.
- **Tokens are the gift unit for mentor-sponsored AI** — a mentor buys a pack and allocates
  it to a linked client (see B2B2C loop below).
- Non-AI features (viewing data, dashboards, device sync) are NOT token-gated — only AI is.
- **No free functional tier.** AI is the core action (meal documentation = AI), so there is
  no free manual-logging tier — only the demo + a small taste. The ~$10 qualifying bar is
  intentional; it keeps the user base serious.
- **The dashboard/CRM is its own product**, paid for independently of AI — the high-margin
  B2B play. A mentor pays for the time-saving tool even if they never use AI.
- **Mentor-sponsored AI (B2B2C gifting loop).** A mentor can **transfer tokens from their
  own balance to a linked client's account** (peer transfer, not just "buy for"). Lets a
  mentor pre-load one pack and distribute it across several clients as needed. Aligns
  incentives perfectly: the mentor has the budget and motivation (they want the client
  logging + engaged for richer data and better outcomes), the client gets AI free so they
  actually use it → more/better data → better results → retention. Strengthens the Pro tier
  ("manage your clients AND fund their AI so they stay engaged").
- **Mentor endorsement is the lowest-friction conversion path.** When a trusted
  professional says "this is the gold-standard app, I work with it," the $5 stops being a
  purchase decision and becomes part of onboarding with their mentor. Trust transfers from
  the human to the product; the low entry price makes saying yes trivial.
- Pricing has **upward room** given the clinical alternative; these are intro numbers.

Market: a premium core (closed-loop) + a broad standalone base + a high-value mentor tier.
A few thousand premium users + a few hundred mentors is already a sustainable solo-founder
business, with the standalone funnel feeding future hardware/premium conversion.

## 5a. Go-to-market (mentor-led, then organic, then paid)
Acquire **channels (mentors), not users one by one** — each mentor onboards many clients
and does the heavy lifting (endorsement + sensor + tokens).
1. **Seed with known mentors.** Founder already knows several. Warm trust, immediate real
   usage, tight feedback loop (they're also the best product critics).
2. **Word-of-mouth.** Clients tell friends; mentors tell other mentors (the higher-value
   spread). The mentor flywheel compounds.
3. **Social proof + light social media.** Amplify once there are real results/testimonials —
   not before product-market fit.

Classic high-touch → organic → paid. No ad spend before PMF; let mentors prove it first.
Fits a premium niche + solo founder.

**Distribution / landing:** `healthings.ai` is the public landing + **download** site
(app store links, the demo pitch, mentor sign-up). It's the single URL a mentor hands a
client ("download at healthings.ai"). Marketing site on the apex/`www`; API on
`api.healthings.ai`; realtime on `rt.healthings.ai`.

---

## 6. Architecture principles (carried from the app)
- **Local-first**: the phone stays the source of truth; the server **syncs/relays**, it
  does not own the data.
- **Privacy by default**: prefer **end-to-end encryption** so the server cannot read
  health data (zero-knowledge). This is a *product claim* with legal weight — designed
  in from day one, not bolted on.
- **Small, tested, committed steps** — same workflow as the app phase (build → phone test
  → commit only after confirmation).
- Domain: `api.healthings.ai` (REST) + `wss://rt.healthings.ai` (signaling / live updates).

### Sharing is NOT gated on full hardware
**CGM + meal tracking is already a dataset worth a real mentor's time** — continuous
glucose tied to logged meals is far more than the WhatsApp screenshots mentors get today.
So the moment a user has CGM + meals, they are a candidate to connect with a real-life
mentor account. Sharing/B2B value does not wait for Withings/full closed loop.

### Two onboarding paths (both converge on one account model)
**A) Mentor-led (the flywheel made literal):**
1. Client opens an account.
2. Mentor applies the **CGM sensor** (CareSens) on the client.
3. Mentor **transfers tokens** to the client's account (meal documentation + AI).
4. Good to go — closed loop on **glucose + meals from day one**.
5. **Withings is the client's choice** later (adds energy-out for the fuller loop).

The mentor is the distribution channel, the sensor applicator, AND the token funder. Make
each step frictionless (fast account creation, easy client link, one-tap token transfer).

**B) Self-serve:**
1. User discovers the app (word-of-mouth / social) → **downloads at healthings.ai**.
2. Explores the **demo + free AI taste** (no signup wall).
3. Opens an account, buys **$5 tokens**.
4. Documents meals via AI; optionally connects CGM and/or Withings.
5. **Optionally links to a mentor later** (share their data for human guidance).

**Design implication:** both paths land on the **same account + sharing model**. A self-serve
account must be able to link to a mentor afterwards, and a mentor-created client must be able
to go fully independent. Account linking is bidirectional and order-independent — never
assume which path created the account.

### The mentor drives hardware adoption + 24/7 course-correction (flywheel)
- **The mentor, not our marketing, sells the full loop.** A human mentor understands why
  energy-out (Withings) matters and advises the client whether full-loop is worth it for
  their goals — it genuinely affects results. The demo lets both see what the full loop
  looks like before committing.
- **24/7 course-correction.** With the full loop the mentor has continuous vision and can
  correct the client in real time, not at the next appointment — the thing the clinic
  structurally cannot do, and the mentor's strongest pitch to their own client.

### Sharing approach (decided direction)
Prefer **store-and-forward, end-to-end encrypted** over live P2P/WebRTC:
- Patient encrypts a data blob on-device, uploads ciphertext; server is blind to content.
- Dietitian (approved) downloads + decrypts locally, renders the existing charts.
- Works when the patient is offline (async) — fixes the fatal flaw of live-only P2P
  (both parties must be online at once; a mentor reviewing 20 patients can't rely on that).
- "Live update" added later as a lightweight WebSocket nudge ("new data, pull it").
- WebRTC only if a real need for continuous streaming emerges (likely never).

---

## 7. Phased roadmap (each phase: build → phone test → commit)
1. **Accounts + Auth** — the bedrock. User identity for patient and mentor; sign-up,
   login, session. Decide auth provider/stack first (see open decisions).
2. **Account relationships** — `account_shares` (patient_id, mentor_id, status
   pending/approved, created_at); request + approve/reject flow.
3. **Encrypted sync** — patient uploads an encrypted blob; approved mentor downloads it.
   Zero-knowledge to the server.
4. **Mentor dashboard** — patient list + viewing a shared patient's existing
   charts/metrics in the mentor's app.
5. **Billing / token wallet** — Stripe (or similar) for token-pack purchase; per-account
   token balance, debit on AI use, "out of tokens" gating, and mentor→client token gifting.
6. **(Optional) Live updates** — WebSocket nudge for real-time dashboard refresh.
7. **(Later, if ever) WebRTC** — true continuous P2P streaming.

---

## 8. Open decisions — **resolved (2026-06-22)**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Stack** | **Node.js (Fastify) + PostgreSQL** on Hetzner VPS | Max control; fits zero-knowledge relay later; no vendor lock-in |
| **Repo layout** | **Monorepo `/server`** alongside `/app` | One clone, shared prompts, deploy server independently |
| **Auth (MVP)** | **Email OTP** (passwordless) | Low friction for clinic alpha; no password reset flow |

Domains unchanged: `api.healthings.ai` (REST) · `rt.healthings.ai` (later).

> **Hosting update (2026-06-29):** Production runs on **Hetzner VPS** (`server/DEPLOY-HETZNER.md`, `scripts/hetzner-bootstrap.sh`). Original spec said Hostinger — same stack, different provider.
