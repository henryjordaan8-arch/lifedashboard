# Baseline: business plan (draft)

> **Baseline** is a working name. Change it in `site/index.html`, `site/dashboard.html`
> and the `BRAND` constant in `site/dashboard.js`.

A doctor-led optimisation practice for busy, high-earning people: executives, founders,
specialists, other doctors. One physician looks after strength training, cardio,
nutrition, sleep, caffeine, recovery and supplements as one system. Bloodwork sets the
baseline and a personal dashboard tracks progress.

---

## 1. Positioning

| | |
|---|---|
| **Client** | 35–60, time-poor, used to paying for expertise. Wants to stay sharp, fit and healthy over the long term. Often already wears a Garmin, Whoop, Oura or Apple Watch and isn't sure what the data means. |
| **Problem** | Advice is split between a GP, a personal trainer, a dietitian, podcasts and a wearable app, and none of them talk to each other. Nobody owns the whole plan. |
| **Promise** | One doctor and one plan, measured and adjusted every month. You spend under 30 minutes a week on admin. |
| **Edge over coaches** | Medical training: you read bloodwork, spot red flags, interact with their GP and specialists, and know where the evidence actually is. |
| **Edge over longevity clinics** | Personal and continuous instead of a one-off scan package. You see the daily data and adjust the plan. |

Keep the claims modest and measurable ("lower ApoB", "more zone 2 minutes", "consistent
bedtime"). This audience distrusts hype, and medical regulators do too (see §7).

---

## 2. Pricing (suggestions)

Pricing is shown in **ZAR**, with approximate **USD** for international clients (≈ R18 / $).
These are starting points to test, not market research. Adjust them once the first 5–10
clients show you how long each one actually takes.

### Entry: Baseline Assessment (one-off, required)

**R14,500** (≈ $800). Lab fees are passed through at cost, or bundled in for **R18,500**.

- 90-minute consultation: history, goals, training, sleep, diet, caffeine, alcohol, medication and supplements
- Baseline bloodwork (see §3), BP, waist, weight; body composition (DEXA if you partner with a provider)
- Wearable onboarding and dashboard setup
- Written 12-week protocol, with a 45-minute results review

A paid entry point filters out the merely curious and gives every client the same
starting data. It also works as a stand-alone product for people who don't want a membership.

### Membership (monthly, 3-month minimum after the assessment)

| | **Essential** | **Performance** | **Executive** |
|---|---|---|---|
| Price / month | **R4,500** (≈ $250) | **R9,500** (≈ $525) | **R22,000** (≈ $1,200) |
| Review calls | Monthly, 30 min | Every 2 weeks, 30 min | Weekly, 30–45 min |
| You check their dashboard | Monthly | Weekly | Several times a week |
| Messaging response | 48 h | 24 h | Same day |
| Protocol updates | Quarterly | Monthly | As needed |
| Training programme | Guidelines | Written programme (gym + cardio) | Programme, plus coordination with their trainer |
| Nutrition | Targets (protein, alcohol, timing) | Targets and a meal framework | Plan, plus coordination with a dietitian or chef |
| Bloodwork | Yearly | Every 6 months | Quarterly, home phlebotomy |
| Extras | | VO₂ max / lactate test yearly | DEXA and VO₂ max yearly; travel and jet-lag protocols; referral and specialist coordination |
| Cap | none | ~25 clients | **10–15 clients** |

- **Annual prepay:** 2 months free (about 15% off).
- **Founding clients:** the first 10 get 30% off for 12 months in exchange for feedback.
  (Under HPCSA rules, ask for feedback, not testimonials; see §7.)
- **Corporate / executive team:** 5+ people from one company. Quote an annual fee per head
  at Performance level with a 10–20% discount, billed to the company. Each person's
  medical data stays private from the employer; the company sees attendance and nothing else.

### Why these numbers

Estimate your hours per client per month, including prep and messaging:

| Tier | Price | Your time / month | Effective rate |
|---|---|---|---|
| Essential | R4,500 | ~1.25 h | ~R3,600 / h |
| Performance | R9,500 | ~2.5 h | ~R3,800 / h |
| Executive | R22,000 | ~5 h | ~R4,400 / h |

**Example practice at 20 hours a week of client time:** 20 Essential + 15 Performance +
6 Executive comes to about **R365,000 / month** in recurring revenue (R4.4m a year) before
costs, using about 85 h a month. Assessments and corporate deals come on top.

**Things to decide**

- Whether to charge per tier or one premium price for a single offer. One offer (e.g.
  Performance only) is simpler to sell when you're starting.
- Whether lab fees are included. Passing them through at cost is more honest and keeps
  the tier price stable. Bundling them in feels more premium.
- What happens after the 3-month minimum: rolling monthly, or 6-month terms.

---

## 3. Bloodwork

**Recommendation: yes. Make baseline bloodwork mandatory** as part of the assessment. It
separates a medical practice from a coaching service, it catches the occasional serious
finding, and it gives you objective numbers to show progress (ApoB, HbA1c, ferritin) that
clients care about. Retest 8–12 weeks after a major protocol change, then at the cadence
of their tier.

### Core panel (everyone)

| Area | Tests | Why |
|---|---|---|
| General | FBC, U&E + creatinine/eGFR, LFTs, urine ACR | Safety baseline before training and supplements |
| Cardiometabolic | Lipid panel, **ApoB**, **Lp(a)** (once in a lifetime), fasting glucose, **HbA1c**, fasting insulin (→ HOMA-IR) | Main long-term risk levers |
| Inflammation | hs-CRP | Context for recovery and risk (repeat if raised after a hard session or illness) |
| Thyroid | TSH (+ free T4 if abnormal) | Energy, weight, heart rate |
| Iron | Ferritin, iron, transferrin saturation | Endurance athletes, fatigue, women of reproductive age |
| Vitamins | 25-OH vitamin D, B12, folate | Commonly low; guides supplements |
| Other | Uric acid | Gout and metabolic risk; relevant with high protein and alcohol |

### Add when indicated

- **Men:** total testosterone, SHBG (calculated free T), with LH/FSH and oestradiol if low.
  PSA after a shared decision, from about age 50 (45 with risk factors).
- **Women:** depends on cycle, contraception and life stage. For example: ferritin always;
  FSH/oestradiol in perimenopause; prolactin if indicated.
- **Endurance or heavy training:** CK (only in context), and repeat ferritin.
- **Optional, label as optional:** omega-3 index, homocysteine, cystatin C (heavy lifters
  with high creatinine from muscle mass), cortisol only for a clinical question.

### Other baseline measures worth offering

BP (home readings for a week), resting ECG, body composition (DEXA), VO₂ max or lactate
test, grip strength, sleep questionnaire (STOP-BANG, ISI), and a home sleep study if apnoea
is likely. Snoring CEOs are common.

**Avoid testing everything.** Panels with dozens of extra markers produce false positives and
expensive follow-up, and the evidence behind them is thin. A short panel that you explain
well looks more professional to this audience.

---

## 4. Dashboard parameters

Every client gets the dashboard, but you choose which modules they see. Too much data
makes a busy client stop looking. The prototype (`site/dashboard.html`) has a
**Configure** panel that switches each module on or off and offers presets.

**Start with a short list.** Start each client with the 6–8 modules that match their
goals. Add more at reviews.

| Domain | Module | Source | Essential | Performance | Executive |
|---|---|---|:-:|:-:|:-:|
| **Overview** | Doctor's focus (your 3 priorities this month) | You | ● | ● | ● |
| | Weekly checklist (auto-ticked) | Wearable + calendar | ● | ● | ● |
| **Recovery** | Readiness score | Wearable | ● | ● | ● |
| | HRV vs personal baseline | Wearable | ○ | ● | ● |
| | Resting heart rate | Wearable | ○ | ● | ● |
| | Stress and rest days | Wearable | | ○ | ● |
| **Sleep** | Duration vs target | Wearable | ● | ● | ● |
| | Bedtime consistency | Wearable | ○ | ● | ● |
| | Sleep stages | Wearable | | ○ | ○ |
| **Caffeine** | Daily mg and last-dose time vs cut-off | Client log | ○ | ● | ● |
| **Gym** | Key lifts (estimated 1RM trend) | Training app / log | ○ | ● | ● |
| | Weekly sets per muscle group | Training app / log | | ○ | ● |
| **Cardio** | Zone 2 minutes per week | Wearable | ● | ● | ● |
| | 80/20 intensity balance | Wearable | | ○ | ● |
| | VO₂ max trend | Wearable / lab test | ○ | ● | ● |
| | Training load (ACWR) | Wearable | | ○ | ● |
| **Nutrition** | Protein (g/kg) vs target | Client log / app | ● | ● | ● |
| | Weight and body composition | Smart scale / DEXA | ○ | ● | ● |
| | Alcohol (units/week) | Client log | ○ | ● | ● |
| **Supplements** | Protocol, adherence and evidence grade | Client tick-off | ● | ● | ● |
| **Bloodwork** | Latest results vs range, trend, next test date | Lab | ● | ● | ● |

● on by default  ○ available, off by default

**Targets you set per client** (they appear on the cards): sleep hours, bedtime, caffeine
cut-off (e.g. 10 h before bed) and daily cap (e.g. 300 mg), protein in g/kg, zone 2
minutes, weekly sets, alcohol cap, weight or body-fat range.

---

## 5. Turning your dashboard into a client product

Your current Life Dashboard is single-user and connects to Garmin through its
**unofficial** API with your own login. That's fine for you, but **not for a paid service**:

1. **Data connections.** Use official routes:
   - the Garmin Health API (needs approval as a business)
   - an aggregator such as Terra, Rook or Vital, which connects Garmin, Whoop, Oura,
     Apple Health and Polar through one integration and suits a mixed client base
2. **Manual logs.** Caffeine, protein, alcohol and supplements need a 10-second mobile
   check-in. Few wearables track these.
3. **Multi-client backend.** Accounts, a client list for you, per-client module settings
   and targets (the prototype's config is already shaped this way), and audit logs.
4. **Hosting and security.** Health data is special personal information under POPIA:
   encryption at rest and in transit, access control, consent and an information officer.
   Use hosting in South Africa or a provider whose cross-border transfers POPIA allows.
   The free GitHub Pages approach isn't suitable for client data.

**Suggested route:** launch with the first clients on a no-code stack (aggregator +
simple forms + the prototype filled in by hand for each review). Build the multi-client
version once you have 10+ paying clients and know which modules they actually use.

---

## 6. Launch checklist

1. Pick a name, register the company, get a separate practice number if needed, and
   check professional indemnity cover for this scope of work
2. Choose a lab partner (pathology group account, home phlebotomy for Executive) and a
   DEXA / VO₂ max partner
3. Write the assessment workflow: intake form, consent, bloodwork order set, report template
4. Finalise prices, then offer the founding-client rate to 10 people from your own network
5. Publish the website (`site/index.html`) on your domain with a booking link (Calendly or Cal.com)
6. Run the founding clients for 3 months, then measure your hours, which modules they
   open, and why anyone left
7. Then: corporate packages, referral relationships with GPs, cardiologists and
   physiotherapists, and building the multi-client dashboard

---

## 7. Regulatory notes (check, don't assume)

These assume you practise in **South Africa**. Check each with the HPCSA, SAMA or your
indemnity provider before launch:

- **Advertising:** HPCSA ethical rules limit what doctors may advertise. Claims must be
  factual and not misleading. Testimonials and claims of being better than other
  practitioners are not allowed. The site copy avoids testimonials and superlatives for that reason.
- **Selling supplements or products:** there are rules on doctors selling health products
  and on financial interests. The safe default is to recommend generic products and
  third-party-tested brands without selling them, and to declare any affiliation.
- **Fees:** be transparent. State clearly that the service is private and not claimable
  from medical aid (or which parts are).
- **Scope:** the practice complements the client's GP. Share results with their GP if they
  consent, and have a clear process for abnormal findings.
- **Data:** POPIA consent for health data, data from wearables, and any messaging channel.
  WhatsApp is convenient but is a poor place to keep clinical records.
