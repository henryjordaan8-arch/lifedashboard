# Operations: international clients, payments, bookings, legal risk, partnerships

Research notes from November 2026. This isn't legal, tax or insurance advice. Each
section ends with the questions to put to a lawyer, accountant or your indemnity provider.

---

## 1. Can you take international clients?

**Yes, but not for the medical part straight away.** Two things block it:

1. **Registration where the client is.**
   - HPCSA telehealth guidance (Booklet 10) deals mainly with practitioners serving
     *South African* patients. It expects you to follow the rules of the country your
     patient is in, and many countries require local registration when the patient is located there.
   - **United States:** a licence in the state where the patient is.
   - **United Kingdom:** remote GP roles serving UK patients ask for GMC registration
     with a licence to practise. The GMC has floated allowing overseas doctors, but that
     is still a proposal.
2. **Indemnity.** South African indemnity is generally tied to claims brought in South
   Africa. Insurers commonly decline cover for consultations with patients outside South
   Africa, except sometimes to support *existing* patients who are travelling. A claim
   from a foreign client could be completely uninsured.

### Recommended approach, in stages

| Stage | Who | What you offer |
|---|---|---|
| **1. Launch** | People living in South Africa, including South Africans travelling for work | Full service: assessment, bloods, membership |
| **2. After 6–12 months** | South Africans abroad and other international clients | **Baseline Coaching**, a separate *non-medical* product: training, sleep, caffeine, nutrition habits, the dashboard and Zoom check-ins. No bloodwork, diagnosis or prescriptions; their own doctor handles anything medical. Separate terms, priced in USD |
| **3. If demand justifies it** | One chosen country (e.g. the UK) | Register there (e.g. GMC licence plus UK indemnity) and offer the full service in that country |

**Stage 2 risk:** a doctor giving health advice can still be seen as practising medicine,
whatever the product is called. Keep the coaching product strictly non-medical, say so in
the terms, and get your lawyer and insurer to approve it **before** launching.

**Ask:** your indemnity provider (cover for travelling SA clients, and for a non-medical
coaching product abroad), and a health lawyer (wording of the coaching terms).

**Ready now:** the booking pre-screen asks which country the client lives in and where they
will be during calls, so you can apply this automatically.

---

## 2. Business structure

- **Two entities is the common pattern:**
  1. **The medical practice**, as a sole practitioner or an incorporated practice (HPCSA
     rules restrict how doctors may practise through companies; Rule 18 was amended in
     November 2025, so get current advice). It holds your practice number, clinical
     records, consultation fees and indemnity.
  2. **A separate company for the non-medical side:** the app, content, the international
     coaching product and corporate or gym partnerships. This keeps commercial contracts
     and IP away from your medical practice.
- **A company doesn't protect you from negligence claims as a doctor.** Professional
  liability stays personal, which is why indemnity matters most.
- **VAT:** compulsory registration from **R2.3m** taxable turnover a year (from 1 April
  2026; voluntary from R120,000). At the projected ~R3.4m you'll be over it.
  - Private medical fees are generally standard-rated at 15%. If so, **your prices must
    include VAT**, so R7,500 brings in R6,522.
  - Ask your accountant whether to raise prices by 15% once you register, or absorb it.

**Ask:** an accountant (structure, VAT, provisional tax) and a health lawyer (current Rule
18 position for a practice plus a separate company).

---

## 3. Payments

| Need | Recommended | Notes |
|---|---|---|
| Card payments and subscriptions in rand | **Paystack** or **PayFast** | Both are South African and support recurring billing. Paystack is owned by Stripe, which serves South Africa through Paystack rather than signing up South African businesses directly |
| International clients (coaching, later) | Charge in rand through Paystack or PayFast (international cards work and the bank converts), or invoice in USD through a business account (e.g. Wise) | Show a USD guide price on the site |
| Lab fees | Client pays the lab directly | You never handle lab money |
| Invoices | Itemised, with your practice number and procedure codes | Some clients may claim part from medical savings. Don't promise it |

**Billing rules**
- **Assessment:** paid in full when booking. Free reschedule with 48 h notice; after that the fee is kept.
- **Membership:** card subscription billed on the same day each month. Annual plans are paid up front.
- **Minimum term and the Consumer Protection Act:** clients on a fixed term can cancel with
  **20 business days' written notice**. You may charge only a *reasonable* cancellation
  penalty: a Tribunal found a 75% penalty unreasonable. The simplest compliant approach:
  - a 3-month minimum, and if someone cancels inside it, charge at most the next month's
    fee (or the unused part of the annual discount);
  - rolling monthly after that.
- **Refunds:** pro-rata for annual plans, minus the discount they received.

---

## 4. Bookings and client journey

| Step | What happens | Tool |
|---|---|---|
| 1. Free 15-min call | Booked from the website. A short pre-screen asks for country of residence, goals, current medication, and red-flag symptoms (if they have chest pain, fainting or similar, they're told to see a doctor now) | Calendly or Cal.com, with Zoom links added automatically |
| 2. Pay for assessment | Payment link sent after the call if it's a good fit | Paystack / PayFast payment page |
| 3. Intake and consent | Consent (telehealth, information-based scope, no health data held by the app, data-source changes), health history, medication, PAR-Q+ exercise screening | Your clinical records system's patient forms, *not* Google Forms or email |
| 4. Assessment (90 min, Zoom) | History, goals, then you send the lab request form | Zoom + records system |
| 5. Labs | Client goes to a lab near them; results come to you | Pathology group account |
| 6. Results call (45 min, Zoom) | Discuss bloods, set up the app together (screen share), send the protocol code | Zoom + dashboard |
| 7. Membership | Subscription link; client books calls through a members-only booking page for their tier | Paystack / PayFast + Calendly / Cal.com |
| 8. Ongoing | Calls, protocol updates, retests | |

**Records:** use a South African clinical records / practice management system (ask
colleagues which telehealth-friendly ones they use) for notes, results, consent and
invoices. That's where health information legally has to live. The dashboard stays
data-free.

**Messaging:** use a business messaging channel for logistics only. Tell clients not to
send symptoms or results there; those go to a call.

---

## 5. Risk of being sued

Complaints to the HPCSA and fee disputes are far more likely than lawsuits.

| Risk | Example | How to reduce it |
|---|---|---|
| **Abnormal result not acted on** | Raised PSA, anaemia, abnormal liver tests, HbA1c in the diabetic range | Written results protocol. Critical results get a phone call the same day; abnormal ones get a referral to their GP or a specialist. Document everything and, with consent, copy their GP |
| **Exercise harm** | A cardiac event or injury on your programme | PAR-Q+ screening and ACSM risk stratification. ECG or cardiology clearance before vigorous training for higher-risk clients. Gradual progression, and referral for injuries |
| **Supplement harm** | Interactions, iron overload, too much vitamin D, kidney issues with creatinine | Medication review, bloods before recommending, conservative doses. No sales, so there's no conflict of interest |
| **Nutrition harm** | Fasting while on diabetes medication; triggering disordered eating | Screen for both. Refer to a dietitian where needed |
| **Scope creep** | A client wants testosterone or other prescriptions | **Policy: no prescribing.** Refer to their GP or a specialist. Put it in the terms |
| **Limits of remote care** | Missing something a physical exam would find | Not a symptom service: new symptoms mean seeing their GP. Say so in the consent and on calls |
| **Practising across borders** | Advising a foreign resident without registration or cover | Stage 1 is South African residents only (§1) |
| **Dashboard advice** | The readiness score says "train" while the client is getting ill | The app shows information, not diagnoses or treatment. Keep the wording that way, partly because software giving individual medical recommendations can count as a regulated medical device (SAHPRA) |
| **Consumer complaints** | Cancellation and refund disputes | Compliant terms (§3), clear prices, written terms accepted before payment |
| **Advertising complaints** | Testimonials, superlatives, before-and-after claims | Keep the current site style: factual, no testimonials |
| **Data breach** | Leaked emails or forms | No health data in the app; health data only in the records system; Zoom recording off |

**Essentials before the first client**
1. **Indemnity:** tell your provider exactly what you do (remote, lifestyle and exercise
   advice, bloods interpretation, no prescribing) and get written confirmation it's covered.
2. **Terms of service and consent form,** reviewed by a health lawyer, covering:
   - scope (information-based, no treatment or prescribing, not an emergency service);
   - South African residents only;
   - telehealth limits;
   - data-source changes;
   - cancellation and refunds.
3. A **written results protocol**, and a **referral list** (GPs, cardiologist, dietitian, physio).

---

## 6. Partnering with Planet Fitness (South Africa)

**About the chain:**
- South African owned, and unrelated to the US Planet Fitness.
- Privately held, with local founders.
- About 50 clubs since August 2025, with plans to grow by 50% over five years.
- Single-club memberships cost R400–900 a month, and national access about R1,500.
- It has partnered before (a Discovery Vitality loyalty link).

**Fit:** its members are mostly mid-market, so most won't buy R3,500–15,000 a month. A
partnership works best as a **scalable, mostly non-medical product**, with your premium
service as the top step:

| Layer | For Planet Fitness members | Price idea |
|---|---|---|
| Baseline app + programme | Dashboard, training blocks, sleep and caffeine programmes, monthly group webinars run by you | R149–299 / month, or bundled into a premium club membership |
| Group sessions | In-club or online talks: sleep, zone 2, nutrition for training | Fee paid by Planet Fitness |
| Staff training | Teach trainers the method and when to refer | Fee paid by Planet Fitness |
| Upgrade path | Members who want a doctor book the Baseline Assessment (discount allowed) | Your normal rates |

**Ethics: structure it carefully**
- **No per-referral commissions in either direction.** HPCSA rules on fee sharing and
  perverse incentives (Rule 7; the HPCSA has treated profit-sharing linked to referrals as
  kickbacks) mean you can't pay Planet Fitness per client or take a cut of memberships for
  sending people to them.
- **What works:**
  - Planet Fitness pays your **non-medical company** a fixed fee for content, the app licence,
    talks and staff training.
  - Members who want medical services buy them from your practice at published prices.
- Co-branded marketing must still follow HPCSA advertising rules: no testimonials and no
  superiority claims.
- **This is how the business gets past your own time limit:** the app and group content
  scale, and your one-to-one hours are the premium tier.

**Before approaching them:** have 6–12 months of results with your own clients (retention,
outcomes measured with consent and anonymised), a working app, and the two-entity
structure in place.

---

## Sources

- [HPCSA Booklet 10: Telehealth guidelines (Dec 2021)](https://www.hpcsa-blogs.co.za/wp-content/uploads/2022/08/Booklet-10_Telehealth__Dec_2021_.pdf)
- [CMS: Digital health apps and telemedicine in South Africa](https://cms.law/en/int/expert-guides/cms-expert-guide-to-digital-health-apps-and-telemedicine/south-africa)
- [DLA Piper: Telehealth around the world, South Africa](https://www.dlapiperintelligence.com/telehealth/countries/handbook.pdf?c=ZA)
- [Caderco: telemedicine and cross-border liability](https://www.caderco.co.za/articles/telemedicine-remote-consultations-cross-border-liability)
- [Bizcommunity: indemnity and patients outside South Africa](https://www.bizcommunity.com/Article/196/716/230414.html)
- [MedicalBrief: MPS membership and South African claims](https://stage7800.medicalbrief.co.za/?p=105189)
- [Pulse: GMC on overseas doctors consulting online](https://www.pulsetoday.co.uk/news/regulation/gps-overseas-could-provide-online-consultations-says-gmc/)
- [Stripe in South Africa (2026)](https://www.lilachbullock.com/stripe-in-south-africa/)
- [Stripe alternatives for South African founders](https://www.vektorindex.com/blog/stripe-alternatives-for-south-africa)
- [SARS: new VAT registration threshold](https://www.sars.gov.za/faq/what-is-the-new-threshold-for-vat-registration/)
- [VAT Update: South Africa raises VAT thresholds](https://www.vatupdate.com/2026/03/04/south-africa-raises-vat-registration-thresholds-in-2026-2027-budget-proposals/)
- [CPA section 14: expiry and renewal of fixed-term agreements](https://www.acts.co.za/consumer-protection/14_expiry_and_renewal_of_fixed_term_agreements)
- [Polity: termination of agreements and reasonable costs](https://polity.org.za/article/termination-of-agreements-and-reasonable-costs-2023-11-01)
- [HPCSA and SAMA joint release on ethical rules (2024)](https://www.hpcsa.co.za/Content/upload/publications/Media-Release/2024/Joint_media_release_between_the_HPCSA_and_SAMA.pdf)
- [Bowmans: amendments to HPCSA ethical rules](https://bowmanslaw.com/insights/south-africa-amendments-to-the-hpcsa-ethical-rules-of-conduct/)
- [HPCSA Booklet 2: generic ethical rules](https://www.hpcsa.co.za/Uploads/professional_practice/ethics/Booklet_2_Generic_Ethical_Rules_with_anexures.pdf)
- [BusinessTech: Planet Fitness expansion](https://businesstech.co.za/news/?p=834100)
- [BusinessTech: gym prices 2026, Virgin Active vs Planet Fitness](https://businesstech.co.za/news/lifestyle/847540/gym-prices-in-2026-virgin-active-vs-planet-fitness/)
- [Kaya Biz: the business of gyms in South Africa](https://kaya-biz-inside-your-business.castos.com/episodes/inside-your-business-the-business-of-gyms-in-the-south-african-context)
