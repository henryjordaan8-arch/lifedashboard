# Baseline: business plan (draft)

> **Baseline** is a working name. Change it in `site/index.html`, `site/dashboard.html`
> and the `BRAND` constant in `site/dashboard.js`.

A doctor-led optimisation service for busy, high-earning people: executives, founders,
specialists, other doctors. One physician advises on strength training, cardio,
nutrition, sleep, caffeine, recovery and supplements as one plan. Bloodwork sets the
baseline, and a dashboard app on the client's own phone tracks progress.

## Ground rules

These are fixed decisions, and the rest of the plan follows from them.

1. **Fully online.** Every consultation is a Zoom call. There are no in-person consultations
   and no clinic. Blood tests are done at any pathology lab near the client, and simple
   measures (blood pressure, waist, weight) at home.
2. **Information-based.** The service is advice, planning and accountability. It doesn't
   provide treatment that needs a physical examination.
3. **Never sell supplements** or other products, and take no commission or affiliate fees.
   Recommend generic, third-party-tested options only.
4. **No health data on our systems.** The dashboard runs on the client's own device and
   reads their wearable there. No server of ours stores wearable data or logs.
5. **Bloods are discussed only with the client, on Zoom.** Results never go into the
   dashboard, email threads or chat.

---

## 1. Positioning

| | |
|---|---|
| **Client** | 35–60, time-poor, used to paying for expertise. Wants to stay sharp, fit and healthy over the long term. Often already wears a Garmin, Whoop, Oura or Apple Watch and isn't sure what the data means. |
| **Problem** | Advice is split between a GP, a personal trainer, a dietitian, podcasts and a wearable app, and none of them talk to each other. Nobody owns the whole plan. |
| **Promise** | One doctor and one plan, reviewed on video every month or more. You spend under 30 minutes a week on admin, with no travel or waiting rooms. |
| **Edge over coaches** | Medical training: you read bloodwork, spot red flags, know when to send someone to their GP or a specialist, and know where the evidence actually is. |
| **Edge over longevity clinics** | Personal and continuous instead of a one-off scan package. No product sales, so the advice is independent. |
| **Privacy** | Health data stays on the client's phone. For a CEO, "we hold none of your health data" is a selling point. |

Keep the claims modest and measurable ("more zone 2 minutes", "consistent bedtime",
"ApoB down on your retest"). This audience distrusts hype, and medical regulators do too (see §7).

---

## 2. Pricing (suggestions)

Pricing is shown in **ZAR**, with approximate **USD** for international clients (≈ R18 / $).
Being online means you can take clients from anywhere you're allowed to advise, so a USD
price list is worth having. These are starting points to test, not market research.

### Entry: Baseline Assessment (one-off, required)

**R14,500** (≈ $800). The client pays lab fees directly to the lab.

- 90-minute Zoom consultation: history, goals, training, sleep, diet, caffeine, alcohol, medication and supplements
- A lab request form for baseline bloodwork (see §3), done at a lab near them
- Home measurements with a short guide: a week of BP readings, waist, weight
- Help installing the dashboard app and connecting their wearable
- A 45-minute Zoom results call and a written 12-week protocol

### Membership (monthly, 3-month minimum after the assessment)

| | **Essential** | **Performance** | **Executive** |
|---|---|---|---|
| Price / month | **R4,500** (≈ $250) | **R9,500** (≈ $525) | **R18,000–22,000** (≈ $1,000–1,200) |
| Zoom reviews | Monthly, 30 min | Every 2 weeks, 30 min | Weekly, 30–45 min |
| Dashboard | Reviewed together on calls (client shares their screen) | Same | Same |
| Messaging response (no health data in messages) | 48 h | 24 h | Same day |
| Protocol updates | Quarterly | Monthly | As needed |
| Training programme | Guidelines | Written programme (gym + cardio) | Programme, plus online briefing of their trainer |
| Nutrition | Targets (protein, alcohol, timing) | Targets and a meal framework | Plan, plus online briefing of their dietitian or chef |
| Blood tests (request + Zoom review) | Yearly | Every 6 months | Quarterly |
| Extras | | VO₂ max test referral yearly | DEXA and VO₂ max referrals; travel and jet-lag protocols |
| Cap | none | ~25 clients | **10–15 clients** |

- Because you can't see their data between calls, the higher tiers are about **more
  of your time and faster access**, not more monitoring.
- Without in-person extras, consider starting Executive at **R18,000** and raising it once
  you see demand.
- **Annual prepay:** 2 months free (about 15% off).
- **Founding clients:** the first 10 get 30% off for 12 months in exchange for feedback
  (feedback, not testimonials; see §7).
- **Corporate / executive team:** 5+ people from one company. Quote an annual fee per head
  at Performance level with a 10–20% discount, billed to the company. The company sees
  attendance and nothing else.

### Why these numbers

Estimate your hours per client per month, including prep and messaging:

| Tier | Price | Your time / month | Effective rate |
|---|---|---|---|
| Essential | R4,500 | ~1.25 h | ~R3,600 / h |
| Performance | R9,500 | ~2.25 h | ~R4,200 / h |
| Executive | R20,000 | ~4.5 h | ~R4,400 / h |

**Example practice at about 20 hours a week of client time:** 20 Essential + 15 Performance +
6 Executive comes to about **R352,500 / month** in recurring revenue before costs.
Running costs are low: no rooms, no staff to start with, no data hosting.

---

## 3. Bloodwork

**Recommendation: make baseline bloodwork mandatory** as part of the assessment. It's
what makes this a doctor-led service rather than coaching.

### How it works when everything is remote

1. You send the client a lab request form after the first call.
2. They go to any branch of the pathology group you've set up an account with (e.g. a
   national group with many branches) and pay the lab directly.
3. The lab sends results to **you**, as the requesting doctor.
4. You go through them with the client **on a Zoom call only**: not in the app, not by
   email or chat.
5. Your notes go into your clinical records (see §7), not the dashboard.
6. Abnormal or urgent results: have a written process for contacting the client the same
   day by phone, and refer them to their GP or the right specialist.

### Core panel (everyone)

| Area | Tests | Why |
|---|---|---|
| General | FBC, U&E + creatinine/eGFR, LFTs, urine ACR | Safety baseline before training and supplements |
| Cardiometabolic | Lipid panel, **ApoB**, **Lp(a)** (once in a lifetime), fasting glucose, **HbA1c**, fasting insulin (→ HOMA-IR) | Main long-term risk levers |
| Inflammation | hs-CRP | Context for recovery and risk (repeat if raised after a hard session or illness) |
| Thyroid | TSH (+ free T4 if abnormal) | Energy, weight, heart rate |
| Iron | Ferritin, iron, transferrin saturation | Endurance athletes, fatigue, women of reproductive age |
| Vitamins | 25-OH vitamin D, B12, folate | Commonly low; guides supplement advice |
| Other | Uric acid | Gout and metabolic risk; relevant with high protein and alcohol |

### Add when indicated

- **Men:** total testosterone, SHBG (calculated free T), with LH/FSH and oestradiol if low.
  PSA after a shared decision, from about age 50 (45 with risk factors).
- **Women:** depends on cycle, contraception and life stage. For example: ferritin always;
  FSH/oestradiol in perimenopause; prolactin if indicated.
- **Endurance or heavy training:** CK (only in context), and repeat ferritin.
- **Optional, label as optional:** omega-3 index, homocysteine, cystatin C (heavy lifters
  with high creatinine from muscle mass).

### Other baseline measures (all remote-friendly)

- Home BP: a validated cuff, readings morning and evening for 7 days
- Waist, weight and photos, with a short how-to guide
- Questionnaires: sleep (STOP-BANG, ISI), PAR-Q before starting training
- Optional referrals: DEXA, VO₂ max or lactate test, resting ECG, home sleep study if
  apnoea is likely. Snoring CEOs are common.

**Avoid testing everything.** Panels with dozens of extra markers produce false positives and
expensive follow-up, and the evidence behind them is thin. A short panel that you explain
well looks more professional to this audience.

---

## 4. Dashboard parameters

The dashboard is an app on the client's phone. You choose which modules they see and
set their targets, the monthly focus and the next call date. Together that's a
**protocol**, and it contains no health data. You send it as a code, and they import it.
Their wearable data never leaves their phone.

**Start with a short list.** Start each client with 6–8 modules that match their goals,
and add more at reviews.

| Domain | Module | Source (on the client's device) | Essential | Performance | Executive |
|---|---|---|:-:|:-:|:-:|
| **Overview** | Doctor's focus (your 3 priorities this month) | You, via protocol | ● | ● | ● |
| | Weekly checklist (auto-ticked) | Wearable + logs | ● | ● | ● |
| | Next steps (next Zoom call, next blood test due) | You, via protocol | ● | ● | ● |
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
| | VO₂ max trend | Wearable | ○ | ● | ● |
| | Training load (ACWR) | Wearable | | ○ | ● |
| **Nutrition** | Protein (g/kg) vs target | Client log | ● | ● | ● |
| | Weight and body composition | Smart scale / log | ○ | ● | ● |
| | Alcohol (units/week) | Client log | ○ | ● | ● |
| **Supplements** | Protocol, adherence and evidence grade | Client tick-off | ● | ● | ● |

● on by default  ○ available, off by default

**Bloodwork isn't a module.** The dashboard shows only the date the next blood test is due.
Results are discussed on Zoom.

**Targets you set for each client** (they appear on the cards): sleep hours, bedtime, caffeine
cut-off (e.g. 9 h before bed) and daily cap (e.g. 300 mg), protein in g/kg, zone 2
minutes, weekly sets, alcohol cap, next call, next blood test.

---

## 5. Building the client app (on-device, no health-data server)

Your own Life Dashboard is a good starting point. It already has an Android app that signs
in and works without a computer, and the client prototype follows the same idea.

**Design**

- **Runs on the client's phone** as an installable app: Android first, then iOS. It reads
  the wearable on the device and keeps manual logs (caffeine, protein, alcohol,
  supplements) on the device.
- **Wearable data through the phone's own health store:** **Health Connect** on Android
  and **Apple Health** on iOS. Garmin, Oura, Whoop, Polar and most scales already write to
  these. The data stays on the device, uses official APIs and needs one integration per
  platform.
  - Don't ship the unofficial Garmin login that your personal dashboard uses. It's fine for
    you, but not for a paid product.
- **Protocol in, nothing out.** The app receives your protocol code (modules, targets,
  focus, dates) and never sends data back. The prototype's Configure panel already does
  this: **Copy protocol code** and **Import**.
- **Reviews:** the client shares their screen on Zoom. You see their trends live, and
  nothing is copied to you.
- **Backups:** an encrypted export file the client keeps (e.g. in their own iCloud or
  Google Drive), so a new phone doesn't lose their history.

**Trade-off to accept:** you can't look at a client's data between calls. That's the price
of holding no health data, and it's why the tiers differ in call frequency rather than
monitoring.

**Suggested route**

1. Start your first clients on the browser prototype plus Zoom screen-share.
2. Build the Android app with Health Connect once you have 10 or more paying clients and
   know which modules they actually use.
3. Add iOS with Apple Health after that.

---

## 6. Launch checklist

1. **Name and company:** pick a name, register the company, and confirm your indemnity
   cover includes telehealth and this scope of work.
2. **Lab account:** open an account with a pathology group with branches nationwide,
   and agree how results are delivered to you.
3. **Tools:** set up Zoom (with a business agreement and recording off by default), a
   clinical records system, and a booking and payment tool (Cal.com or Calendly, plus
   Paystack or Stripe).
4. **Assessment workflow:** intake form, consent (telehealth, information-based scope,
   no data held), the lab request set, the home-measurement guide and the protocol template.
5. **Prices:** finalise them, then offer the founding-client rate to 10 people from your
   own network.
6. **Website:** publish `site/index.html` on your domain with the booking link (later).
7. **Founding clients:** run them for 3 months. Measure your hours, which modules they
   use, and why anyone left.
8. **Then:** corporate packages, referral relationships (GPs, cardiologists,
   physiotherapists), and the Android app.

---

## 7. Regulatory notes (check, don't assume)

These assume you practise in **South Africa**. Check each with the HPCSA, SAMA or your
indemnity provider before launch:

- **Telehealth:** follow the HPCSA telehealth guidance: consent, identity checks, and
  knowing when a patient needs to be seen in person and referring them.
- **"Information-based" still means you're acting as a doctor** once you request and
  interpret an individual's blood tests and advise them. Indemnity, consent and record
  keeping all apply. Say clearly on the site and in the consent form what the service
  does and doesn't do.
- **Clinical records:** you must keep consultation notes and lab results for each client.
  "No health data" applies to the dashboard and website. Your records still need a
  secure clinical records system, separate from the app.
- **Patients outside South Africa:** advising someone in another country may need
  registration there. Check before taking international clients.
- **Advertising:** HPCSA ethical rules limit what doctors may advertise. Claims must be
  factual and not misleading. Testimonials and claims of being better than other
  practitioners are not allowed. The site copy avoids both.
- **No product sales:** you won't sell supplements, which avoids the HPCSA concerns about
  selling health products. Declare that you have no financial interest in any brand
  you mention.
- **Fees:** be transparent. State that the service is private and generally not
  claimable from medical aid.
- **POPIA:** you'll still process some personal information (contact and billing
  details, and clinical records). That needs a privacy notice and an information officer
  (you, to start with).
