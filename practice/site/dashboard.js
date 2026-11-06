/* Optimised client dashboard: prototype with demo data.
 *
 * The app runs on the client's own device and reads their wearable there, so no
 * server ever holds their health data. Blood results are never shown in the app;
 * they are discussed on video calls.
 *
 * Every card is a module in MODULES. The doctor builds a "protocol" for each client:
 * which modules they see, their targets, the monthly focus and the next call date.
 * A protocol contains no health data. The doctor exports it as a code, and the client
 * imports it into the app on their phone (Configure → Import protocol).
 */
(() => {
  "use strict";

  const BRAND = "Optimised";
  const STORE_KEY = "optimised.dashboard.v1";

  // ---------- Demo data (seeded so it looks the same on every load) ----------
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const noise = (amp) => (rnd() - 0.5) * 2 * amp;
  const series = (n, start, drift, amp) => Array.from({ length: n }, (_, i) => +(start + drift * i + noise(amp)).toFixed(1));

  const DATA = {
    hrv: series(30, 54, 0.32, 5),
    hrvBaseline: 58,
    rhr: series(30, 55, -0.08, 1.6).map(Math.round),
    sleepH: series(14, 6.6, 0.05, 0.55),
    bedMin: Array.from({ length: 14 }, () => Math.round(22 * 60 + 12 + noise(38))), // minutes after midnight
    wakeMin: Array.from({ length: 14 }, () => Math.round(5 * 60 + 40 + noise(15))),
    stages: { deep: 1.2, rem: 1.6, light: 3.8, awake: 0.3 },
    caffeineToday: [
      { t: "06:10", mg: 130, what: "Double espresso" },
      { t: "09:45", mg: 80, what: "Flat white" },
      { t: "13:20", mg: 95, what: "Americano" },
    ],
    caffeineMg: [420, 380, 310, 350, 290, 305, 260, 280, 300, 240, 310, 270, 255, 305],
    lastDoseMin: [16 * 60, 15 * 60 + 30, 15 * 60, 14 * 60 + 10, 13 * 60 + 40, 14 * 60, 12 * 60 + 50, 13 * 60, 12 * 60 + 30, 12 * 60 + 15, 13 * 60 + 45, 12 * 60 + 40, 12 * 60 + 5, 13 * 60 + 20],
    protein: [1.4, 1.7, 1.9, 1.6, 2.0, 1.3, 1.8],
    weight: series(12, 88.4, -0.32, 0.35),
    bodyFat: series(12, 24.1, -0.22, 0.2),
    leanKg: 64.2,
    alcohol: [14, 12, 9, 11, 6, 8, 5, 7],
    lifts: [
      { name: "Back squat", e1rm: [122, 124, 127, 127, 130, 133, 135, 136] },
      { name: "Bench press", e1rm: [92, 93, 94, 96, 96, 97, 99, 100] },
      { name: "Deadlift", e1rm: [150, 152, 155, 158, 158, 162, 165, 166] },
      { name: "Overhead press", e1rm: [58, 58, 59, 60, 60, 61, 61, 62] },
    ],
    sets: { Chest: 12, Back: 16, Quads: 10, Hamstrings: 8, Glutes: 9, Shoulders: 11, Arms: 7 },
    zone2: [95, 120, 110, 140, 150, 135, 165, 140],
    intensity: [[78, 12, 10], [74, 14, 12], [80, 9, 11], [72, 16, 12], [79, 11, 10], [81, 8, 11], [83, 7, 10], [80, 9, 11]],
    vo2: [44, 44, 45, 45, 45, 46, 46, 46, 47, 47, 47, 48],
    acwr: 1.12,
    stress: series(14, 38, -0.4, 6).map(Math.round),
    restDays: 1,
    steps: series(7, 8400, 120, 2200).map(Math.round),
    supplements: [
      { name: "Creatine monohydrate", dose: "5 g", when: "Any time", grade: "A", why: "Strength, lean mass", taken: 7 },
      { name: "Vitamin D3", dose: "2,000 IU", when: "With breakfast", grade: "B", why: "As agreed on your last call", taken: 6 },
      { name: "Omega-3 (EPA+DHA)", dose: "2 g", when: "With dinner", grade: "B", why: "Low oily-fish intake", taken: 5 },
      { name: "Magnesium glycinate", dose: "300 mg", when: "Before bed", grade: "C", why: "Trial for sleep, review in 8 wk", taken: 4 },
    ],
  };

  // ---------- Modules ----------
  const DOMAINS = [
    ["overview", "Overview"],
    ["recovery", "Recovery"],
    ["sleep", "Sleep"],
    ["caffeine", "Caffeine"],
    ["gym", "Gym"],
    ["cardio", "Cardio"],
    ["nutrition", "Nutrition"],
    ["supplements", "Supplements"],
  ];

  const DEFAULT_TARGETS = {
    sleepHours: 7.5,
    bedtime: "22:00",
    caffeineCutoffH: 9,
    caffeineCapMg: 300,
    proteinGkg: 1.8,
    zone2Min: 150,
    alcoholCap: 7,
    setsMin: 10,
    setsMax: 20,
    nextCall: "2026-11-12T07:30",
    nextBloods: "2026-12-07",
  };

  const TARGET_FIELDS = [
    ["sleepHours", "Sleep (hours)", "number", 0.25],
    ["bedtime", "Lights out", "time"],
    ["caffeineCutoffH", "Caffeine cut-off (h before bed)", "number", 0.5],
    ["caffeineCapMg", "Caffeine cap (mg/day)", "number", 10],
    ["proteinGkg", "Protein (g/kg/day)", "number", 0.1],
    ["zone2Min", "Zone 2 (min/week)", "number", 10],
    ["alcoholCap", "Alcohol cap (units/week)", "number", 1],
    ["setsMin", "Sets per muscle, min", "number", 1],
    ["setsMax", "Sets per muscle, max", "number", 1],
    ["nextCall", "Next video call", "datetime-local"],
    ["nextBloods", "Next blood test due", "date"],
  ];

  const MODULES = [
    { id: "focus", domain: "overview", title: "Doctor's focus", desc: "Your three priorities this month", wide: true, render: renderFocus },
    { id: "checklist", domain: "overview", title: "This week", desc: "Checklist that ticks itself", render: renderChecklist },
    { id: "nextup", domain: "overview", title: "Next steps", desc: "Your next call and blood test", render: renderNextUp },
    { id: "readiness", domain: "recovery", title: "Readiness", desc: "Daily score from HRV, sleep, RHR, load", render: renderReadiness },
    { id: "hrv", domain: "recovery", title: "HRV", desc: "Overnight HRV vs personal baseline", render: renderHrv },
    { id: "rhr", domain: "recovery", title: "Resting heart rate", desc: "30-day trend", render: renderRhr },
    { id: "stress", domain: "recovery", title: "Stress and rest", desc: "Stress score, rest days, steps", render: renderStress },
    { id: "sleep_duration", domain: "sleep", title: "Sleep duration", desc: "14 nights vs target", wide: true, render: renderSleepDuration },
    { id: "sleep_consistency", domain: "sleep", title: "Bedtime consistency", desc: "Lights-out vs target window", render: renderSleepConsistency },
    { id: "sleep_stages", domain: "sleep", title: "Sleep stages", desc: "Last night's deep, REM, light", render: renderStages },
    { id: "caffeine", domain: "caffeine", title: "Caffeine", desc: "Daily mg and last dose vs cut-off", wide: true, render: renderCaffeine },
    { id: "lifts", domain: "gym", title: "Key lifts", desc: "Estimated 1RM, 8 weeks", render: renderLifts },
    { id: "sets", domain: "gym", title: "Weekly sets", desc: "Hard sets per muscle group", render: renderSets },
    { id: "zone2", domain: "cardio", title: "Zone 2", desc: "Minutes per week vs target", render: renderZone2 },
    { id: "intensity", domain: "cardio", title: "Intensity balance", desc: "80/20 easy vs hard split", render: renderIntensity },
    { id: "vo2max", domain: "cardio", title: "VO₂ max", desc: "12-week trend", render: renderVo2 },
    { id: "load", domain: "cardio", title: "Training load", desc: "Acute:chronic ratio", render: renderLoad },
    { id: "protein", domain: "nutrition", title: "Protein", desc: "g/kg per day vs target", render: renderProtein },
    { id: "bodycomp", domain: "nutrition", title: "Body composition", desc: "Weight and body fat trend", render: renderBodyComp },
    { id: "alcohol", domain: "nutrition", title: "Alcohol", desc: "Units per week vs cap", render: renderAlcohol },
    { id: "supplements", domain: "supplements", title: "Supplement protocol", desc: "Dose, timing, evidence, adherence", wide: true, render: renderSupplements },
  ];

  const PRESETS = {
    "Executive essentials": ["focus", "checklist", "nextup", "readiness", "sleep_duration", "sleep_consistency", "caffeine", "zone2", "protein", "alcohol", "supplements"],
    "Endurance": ["focus", "checklist", "nextup", "readiness", "hrv", "rhr", "sleep_duration", "zone2", "intensity", "vo2max", "load", "protein", "bodycomp", "supplements"],
    "Strength and body comp": ["focus", "checklist", "nextup", "readiness", "sleep_duration", "lifts", "sets", "protein", "bodycomp", "alcohol", "supplements"],
    "Sleep reset": ["focus", "checklist", "nextup", "hrv", "rhr", "stress", "sleep_duration", "sleep_consistency", "sleep_stages", "caffeine", "alcohol"],
    "Everything": MODULES.map((m) => m.id),
  };

  const CLIENTS = [
    { id: "a", name: "Client A", role: "CEO, 46", preset: "Executive essentials", focus: [
      ["Move caffeine earlier", "Last coffee by 13:00. Bedtime drift should follow within two weeks."],
      ["Protect lights-out at 22:00", "Phone charges outside the bedroom on weeknights."],
      ["Three zone 2 sessions a week", "45 min each. Two can be on the bike at the hotel gym when travelling."],
    ] },
    { id: "b", name: "Client B", role: "Surgeon, 39, marathon in March", preset: "Endurance", focus: [
      ["Keep 80% of training easy", "Hard days are Tuesday intervals and Saturday long-run finish only."],
      ["Ramp mileage ≤ 10% a week", "Post-call days are rest or 30 min easy."],
      ["Iron on alternate days", "With vitamin C and away from coffee, as agreed on our last call."],
    ] },
    { id: "c", name: "Client C", role: "Founder, 52", preset: "Strength and body comp", focus: [
      ["Protein 1.8 g/kg every day", "Front-load it: 40 g at breakfast makes the target easy."],
      ["Progressive overload on 4 lifts", "Add 2.5 kg when all sets reach the top of the rep range."],
      ["Alcohol ≤ 7 units a week", "Alcohol-free Monday to Thursday."],
    ] },
  ];

  // ---------- Config (saved per client in this browser) ----------
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
  }
  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode: keep in memory */ }
  }
  const store = loadStore();
  let clientId = store.current && CLIENTS.some((c) => c.id === store.current) ? store.current : CLIENTS[0].id;

  function client() { return CLIENTS.find((c) => c.id === clientId); }
  function cfg() {
    const c = client();
    if (!store[c.id]) store[c.id] = { modules: [...PRESETS[c.preset]], targets: { ...DEFAULT_TARGETS } };
    store[c.id].targets = { ...DEFAULT_TARGETS, ...store[c.id].targets };
    if (!Array.isArray(store[c.id].focus)) store[c.id].focus = c.focus.map((f) => [...f]);
    return store[c.id];
  }
  const T = () => cfg().targets;

  // ---------- Helpers ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  const last = (a) => a[a.length - 1];
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const hhmm = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
  const fmt = (v, d = 0) => Number(v).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (a, b) => ((a - b) / b) * 100;
  const signed = (v, d = 0) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmt(Math.abs(v), d)}`;
  const status = (cls, text) => `<span class="pill ${cls}">${esc(text)}</span>`;
  const C = { cream: "#f1ece2", brass: "#b49d74", dim: "rgba(241,236,226,0.28)", grid: "rgba(241,236,226,0.1)", good: "#8fae86", warn: "#d6a957", bad: "#d07a6a" };
  const cutoffMin = () => toMin(T().bedtime) - T().caffeineCutoffH * 60;

  function line(vals, { w = 300, h = 80, band, ref, min, max, color = C.cream, labels } = {}) {
    const lo = min ?? Math.min(...vals, ...(band || []), ref ?? Infinity);
    const hi = max ?? Math.max(...vals, ...(band || []), ref ?? -Infinity);
    const pad = (hi - lo) * 0.12 || 1;
    const y = (v) => h - 4 - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (h - 8);
    const x = (i) => (i / (vals.length - 1)) * (w - 6) + 3;
    const d = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
    let s = `<svg class="chart" viewBox="0 0 ${w} ${h + (labels ? 14 : 0)}" role="img">`;
    if (band) s += `<rect x="0" y="${y(band[1])}" width="${w}" height="${Math.max(1, y(band[0]) - y(band[1]))}" fill="${C.brass}" fill-opacity=".12"/>`;
    if (ref != null) s += `<path d="M0 ${y(ref)}H${w}" stroke="${C.brass}" stroke-dasharray="3 4"/>`;
    s += `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/>`;
    s += `<circle cx="${x(vals.length - 1)}" cy="${y(last(vals))}" r="3.5" fill="${color}"/>`;
    if (labels) s += `<text x="0" y="${h + 12}">${esc(labels[0])}</text><text x="${w}" y="${h + 12}" text-anchor="end">${esc(labels[1])}</text>`;
    return s + "</svg>";
  }

  function bars(vals, { w = 300, h = 80, target, max, colorFn, labels, targetLabel } = {}) {
    const top = max ?? Math.max(...vals, target ?? 0) * 1.12;
    const n = vals.length, gap = 4, bw = (w - gap * (n - 1)) / n;
    const y = (v) => h - (v / top) * h;
    let s = `<svg class="chart" viewBox="0 0 ${w} ${h + (labels ? 14 : 0)}" role="img">`;
    vals.forEach((v, i) => {
      const fill = colorFn ? colorFn(v, i) : C.cream;
      s += `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(h - y(v)).toFixed(1)}" fill="${fill}"/>`;
    });
    if (target != null) {
      s += `<path d="M0 ${y(target)}H${w}" stroke="${C.brass}" stroke-dasharray="3 4"/>`;
      if (targetLabel) s += `<text x="${w}" y="${y(target) - 4}" text-anchor="end" style="fill:${C.brass}">${esc(targetLabel)}</text>`;
    }
    if (labels) s += `<text x="0" y="${h + 12}">${esc(labels[0])}</text><text x="${w}" y="${h + 12}" text-anchor="end">${esc(labels[1])}</text>`;
    return s + "</svg>";
  }

  function barRow(label, value, max, text, band) {
    const w = Math.min(100, (value / max) * 100);
    const b = band ? `<div class="band" style="left:${(band[0] / max) * 100}%;width:${((band[1] - band[0]) / max) * 100}%"></div>` : "";
    return `<div class="bar-row"><span class="label">${esc(label)}</span><div class="track">${b}<div class="fill" style="width:${w}%"></div></div><span class="val">${esc(text)}</span></div>`;
  }

  const domainLabel = (id) => (DOMAINS.find(([d]) => d === id) || [, ""])[1];
  const card = (m, body, aside = "") =>
    `<article class="card${m.wide ? " wide" : ""}" data-id="${m.id}"><span class="tag">${esc(domainLabel(m.domain))}</span><div class="card-head"><div><h3>${esc(m.title)}</h3><small>${esc(m.desc)}</small></div>${aside}</div>${body}</article>`;

  // ---------- Renderers ----------
  function renderFocus(m) {
    const items = cfg().focus.filter(([b]) => b.trim()).map(([b, s]) => `<li><div><b>${esc(b)}</b><span>${esc(s)}</span></div></li>`).join("");
    return card(m, `<ol class="focus">${items}</ol><p class="sig">Set by your doctor at your last call · next call ${esc(fmtCall(T().nextCall))}</p>`);
  }

  function fmtCall(v) {
    const d = new Date(v);
    if (isNaN(d)) return "not booked";
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function daysUntil(v) {
    const d = new Date(v);
    return isNaN(d) ? null : Math.ceil((d.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  }

  function renderNextUp(m) {
    const t = T(), dc = daysUntil(t.nextCall), db = daysUntil(t.nextBloods);
    const when = (n) => (n == null ? "" : n < 0 ? "overdue" : n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);
    const bd = new Date(t.nextBloods + "T00:00:00");
    const bloods = isNaN(bd) ? "not scheduled" : bd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return card(m, `<ul class="checks">
      <li><span class="dot-k"></span><span>Video call<br><span class="muted">${esc(fmtCall(t.nextCall))}</span></span><span class="muted">${when(dc)}</span></li>
      <li><span class="dot-k"></span><span>Blood test at your lab<br><span class="muted">${esc(bloods)} · fasting, before 09:00</span></span><span class="${db != null && db <= 7 ? "warn" : "muted"}">${when(db)}</span></li>
    </ul><p class="note">Blood results aren't stored in this app. We go through them together on your call.</p>`);
  }

  function renderChecklist(m) {
    const t = T();
    const sleepOk = DATA.sleepH.slice(-7).filter((h) => h >= t.sleepHours - 0.25).length;
    const items = [
      ["Gym sessions", 3, 3],
      ["Zone 2 minutes", last(DATA.zone2), t.zone2Min],
      [`Nights ≥ ${t.sleepHours} h`, sleepOk, 5],
      ["Caffeine before cut-off", DATA.lastDoseMin.slice(-7).filter((v) => v <= cutoffMin()).length, 6],
      ["Protein target days", DATA.protein.filter((p) => p >= t.proteinGkg).length, 5],
    ];
    const li = items.map(([l, v, g]) => `<li><span class="box${v >= g ? " on" : ""}"></span><span>${esc(l)}</span><span class="muted">${fmt(v)} / ${fmt(g)}</span></li>`).join("");
    const done = items.filter(([, v, g]) => v >= g).length;
    return card(m, `<ul class="checks">${li}</ul>`, status(done >= 4 ? "good" : "warn", `${done}/${items.length}`));
  }

  function readiness() {
    const hrvPts = Math.max(0, Math.min(40, 20 + pct(last(DATA.hrv), DATA.hrvBaseline) * 1.2));
    const sleepPts = Math.max(0, Math.min(30, (last(DATA.sleepH) / T().sleepHours) * 30));
    const rhrDelta = last(DATA.rhr) - avg(DATA.rhr.slice(-8, -1));
    const rhrPts = Math.max(0, Math.min(15, 15 - Math.max(0, rhrDelta) * 3));
    const loadPts = DATA.acwr >= 0.8 && DATA.acwr <= 1.3 ? 15 : 7;
    return { total: Math.round(hrvPts + sleepPts + rhrPts + loadPts), parts: [["HRV", hrvPts, 40], ["Sleep", sleepPts, 30], ["Resting HR", rhrPts, 15], ["Load", loadPts, 15]] };
  }

  function renderReadiness(m) {
    const r = readiness();
    const cls = r.total >= 75 ? "good" : r.total >= 55 ? "warn" : "bad";
    const word = r.total >= 75 ? "Train as planned" : r.total >= 55 ? "Train, keep it easy" : "Recovery day";
    const R = 34, circ = 2 * Math.PI * R;
    const ring = `<svg viewBox="0 0 84 84" width="84" height="84"><circle cx="42" cy="42" r="${R}" stroke="#252523" stroke-width="6" fill="none"/><circle cx="42" cy="42" r="${R}" stroke="${C[cls]}" stroke-width="6" fill="none" stroke-dasharray="${(r.total / 100) * circ} ${circ}" transform="rotate(-90 42 42)"/><text x="42" y="49" text-anchor="middle" style="fill:${C.cream};font-size:22px;font-family:Jost,sans-serif">${r.total}</text></svg>`;
    const rows = r.parts.map(([l, p, mx]) => barRow(l, p, mx, `${Math.round(p)}/${mx}`)).join("");
    return card(m, `<div class="row" style="align-items:center">${ring}<div><p class="note ${cls}" style="margin:0 0 4px">${word}</p><p class="note muted">Based on last night and your recent load.</p></div></div><div class="bars">${rows}</div>`);
  }

  function renderHrv(m) {
    const v = last(DATA.hrv), d = pct(v, DATA.hrvBaseline);
    const cls = d >= -5 ? "good" : d >= -15 ? "warn" : "bad";
    return card(m, `<div class="row"><div class="big">${fmt(v)}<small>ms</small></div><div class="stat"><b class="${cls}">${signed(d)}%</b><span>vs ${DATA.hrvBaseline} ms baseline</span></div></div>${line(DATA.hrv, { band: [DATA.hrvBaseline * 0.9, DATA.hrvBaseline * 1.1], labels: ["30 days ago", "last night"] })}`);
  }

  function renderRhr(m) {
    const v = last(DATA.rhr), base = Math.round(avg(DATA.rhr.slice(-8, -1)));
    const cls = v <= base + 2 ? "good" : v <= base + 5 ? "warn" : "bad";
    return card(m, `<div class="row"><div class="big">${v}<small>bpm</small></div><div class="stat"><b class="${cls}">${signed(v - base)}</b><span>vs 7-day average ${base}</span></div></div>${line(DATA.rhr, { ref: base, labels: ["30 days ago", "today"] })}`);
  }

  function renderStress(m) {
    const s = Math.round(avg(DATA.stress.slice(-7)));
    return card(m, `<div class="row"><div class="stat"><b>${s}</b><span>avg stress, 7 days</span></div><div class="stat"><b>${DATA.restDays}</b><span>rest days this week</span></div><div class="stat"><b>${fmt(avg(DATA.steps))}</b><span>steps / day</span></div></div>${line(DATA.stress, { max: 100, min: 0, ref: 25, labels: ["14 days ago", "today"] })}<p class="note">Below 25 counts as rest. Aim for one full rest day a week.</p>`);
  }

  function renderSleepDuration(m) {
    const t = T();
    const a = avg(DATA.sleepH.slice(-7));
    const met = DATA.sleepH.filter((h) => h >= t.sleepHours - 0.25).length;
    const debt = DATA.sleepH.slice(-7).reduce((s, h) => s + Math.max(0, t.sleepHours - h), 0);
    const cls = a >= t.sleepHours - 0.25 ? "good" : a >= t.sleepHours - 0.75 ? "warn" : "bad";
    return card(m, `<div class="row"><div class="big">${fmt(last(DATA.sleepH), 1)}<small>h last night</small></div><div class="stat"><b class="${cls}">${fmt(a, 1)} h</b><span>7-night average</span></div><div class="stat"><b>${met}/14</b><span>nights on target</span></div><div class="stat"><b>${fmt(debt, 1)} h</b><span>sleep debt this week</span></div></div>${bars(DATA.sleepH, { w: 620, h: 90, max: 9.5, target: t.sleepHours, targetLabel: `target ${t.sleepHours} h`, colorFn: (h) => (h >= t.sleepHours - 0.25 ? C.cream : C.dim), labels: ["14 nights ago", "last night"] })}`);
  }

  function renderSleepConsistency(m) {
    const target = toMin(T().bedtime);
    const offs = DATA.bedMin.map((b) => b - target);
    const within = offs.filter((o) => Math.abs(o) <= 30).length;
    const sd = Math.sqrt(avg(offs.map((o) => (o - avg(offs)) ** 2)));
    const w = 300, h = 90, rng = 90, x = (i) => (i / 13) * (w - 10) + 5, y = (o) => h / 2 + (Math.max(-rng, Math.min(rng, o)) / rng) * (h / 2 - 6);
    let s = `<svg class="chart" viewBox="0 0 ${w} ${h + 14}"><rect x="0" y="${y(-30)}" width="${w}" height="${y(30) - y(-30)}" fill="${C.brass}" fill-opacity=".12"/><path d="M0 ${y(0)}H${w}" stroke="${C.brass}" stroke-dasharray="3 4"/>`;
    offs.forEach((o, i) => { s += `<rect x="${x(i) - 4}" y="${y(o) - 4}" width="8" height="8" fill="${Math.abs(o) <= 30 ? C.cream : C.warn}" transform="rotate(45 ${x(i)} ${y(o)})"/>`; });
    s += `<text x="0" y="${h + 12}">earlier ↑ / later ↓</text><text x="${w}" y="${h + 12}" text-anchor="end">±30 min window</text></svg>`;
    const cls = within >= 10 ? "good" : within >= 7 ? "warn" : "bad";
    return card(m, `<div class="row"><div class="stat"><b>${hhmm(avg(DATA.bedMin))}</b><span>avg lights-out (target ${esc(T().bedtime)})</span></div><div class="stat"><b class="${cls}">${within}/14</b><span>within 30 min</span></div><div class="stat"><b>±${Math.round(sd)} min</b><span>variability</span></div></div>${s}`);
  }

  function renderStages(m) {
    const st = DATA.stages, tot = st.deep + st.rem + st.light + st.awake;
    const parts = [["Deep", st.deep, "#f1ece2"], ["REM", st.rem, "#b49d74"], ["Light", st.light, "#5d5a53"], ["Awake", st.awake, "#d07a6a"]];
    let x = 0;
    const segs = parts.map(([, v, c]) => { const w = (v / tot) * 300; const r = `<rect x="${x}" y="0" width="${Math.max(0, w - 2)}" height="22" fill="${c}"/>`; x += w; return r; }).join("");
    const legend = parts.map(([l, v, c]) => `<span><i style="background:${c}"></i>${l} ${fmt(v, 1)} h · ${Math.round((v / tot) * 100)}%</span>`).join("");
    return card(m, `<div class="big">${fmt(tot - st.awake, 1)}<small>h asleep</small></div><svg class="chart" viewBox="0 0 300 22">${segs}</svg><div class="legend">${legend}</div><p class="note">Typical: deep 13–23%, REM 20–25%. Single-night stage numbers from wearables are rough; trends matter more.</p>`);
  }

  function renderCaffeine(m) {
    const t = T(), cut = cutoffMin();
    const today = DATA.caffeineToday;
    const total = today.reduce((s, d) => s + d.mg, 0);
    const lastDose = toMin(last(today).t);
    const late = lastDose - cut;
    const hoursBefore = (toMin(t.bedtime) - lastDose) / 60;
    // Day timeline 05:00 → bedtime
    const start = 5 * 60, end = toMin(t.bedtime), w = 620, h = 54;
    const x = (min) => ((min - start) / (end - start)) * w;
    let tl = `<svg class="chart" viewBox="0 0 ${w} ${h + 14}"><path d="M0 ${h - 12}H${w}" stroke="${C.grid}"/><rect x="${x(cut)}" y="0" width="${w - x(cut)}" height="${h - 12}" fill="${C.bad}" fill-opacity=".08"/><path d="M${x(cut)} 0V${h - 12}" stroke="${C.brass}" stroke-dasharray="3 4"/><text x="${x(cut) + 6}" y="10" style="fill:${C.brass}">cut-off ${hhmm(cut)}</text>`;
    today.forEach((d) => { const r = 5 + d.mg / 25; tl += `<circle cx="${x(toMin(d.t))}" cy="${h - 12 - r - 2}" r="${r}" fill="${toMin(d.t) > cut ? C.warn : C.cream}"/>`; });
    for (let hr = 6; hr * 60 <= end; hr += 3) tl += `<text x="${x(hr * 60)}" y="${h + 10}" text-anchor="middle">${String(hr).padStart(2, "0")}:00</text>`;
    tl += "</svg>";
    const doses = today.map((d) => `<tr><td>${esc(d.t)}</td><td>${esc(d.what)}</td><td class="num">${d.mg} mg</td></tr>`).join("");
    const avgLast = avg(DATA.lastDoseMin.slice(-7));
    const cls = late <= 0 ? "good" : late <= 45 ? "warn" : "bad";
    const lateText = late <= 0 ? "Before cut-off" : `${Math.round(late)} min late`;
    return card(m,
      `<div class="row"><div class="stat"><b>${total} mg</b><span>today · cap ${t.caffeineCapMg} mg</span></div><div class="stat"><b class="${cls}">${esc(last(today).t)}</b><span>last dose · ${fmt(hoursBefore, 1)} h before bed</span></div><div class="stat"><b>${hhmm(avgLast)}</b><span>avg last dose, 7 days</span></div></div>
       ${tl}
       <div class="row" style="align-items:flex-start;gap:28px">
         <div style="flex:1;min-width:220px"><table><tbody>${doses}</tbody></table></div>
         <div style="flex:1;min-width:220px">${bars(DATA.caffeineMg, { h: 70, target: t.caffeineCapMg, targetLabel: `cap ${t.caffeineCapMg} mg`, colorFn: (v) => (v > t.caffeineCapMg ? C.warn : C.cream), labels: ["14 days ago", "today"] })}</div>
       </div>`,
      status(cls, lateText));
  }

  function renderLifts(m) {
    const rows = DATA.lifts.map((l) => {
      const d = last(l.e1rm) - l.e1rm[0];
      return `<tr><td>${esc(l.name)}</td><td style="width:90px">${line(l.e1rm, { w: 90, h: 24 })}</td><td class="num">${last(l.e1rm)} kg</td><td class="num good">${signed(d)}</td></tr>`;
    }).join("");
    return card(m, `<div class="table-scroll"><table><thead><tr><th>Lift</th><th>8 wk</th><th class="num">e1RM</th><th class="num">Δ</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  }

  function renderSets(m) {
    const t = T(), max = Math.max(t.setsMax + 4, ...Object.values(DATA.sets));
    const rows = Object.entries(DATA.sets).map(([k, v]) => barRow(k, v, max, `${v}`, [t.setsMin, t.setsMax])).join("");
    const under = Object.entries(DATA.sets).filter(([, v]) => v < t.setsMin).map(([k]) => k);
    return card(m, `<div class="bars">${rows}</div><p class="note">${under.length ? `Below ${t.setsMin} sets: ${esc(under.join(", "))}.` : "Every group in range."} Band: ${t.setsMin}–${t.setsMax} sets.</p>`);
  }

  function renderZone2(m) {
    const t = T(), v = last(DATA.zone2);
    const cls = v >= t.zone2Min ? "good" : v >= t.zone2Min * 0.7 ? "warn" : "bad";
    return card(m, `<div class="row"><div class="big">${v}<small>min this week</small></div><div class="stat"><b class="${cls}">${Math.round((v / t.zone2Min) * 100)}%</b><span>of ${t.zone2Min} min target</span></div></div>${bars(DATA.zone2, { target: t.zone2Min, targetLabel: `${t.zone2Min} min`, colorFn: (x) => (x >= t.zone2Min ? C.cream : C.dim), labels: ["8 weeks ago", "this week"] })}`);
  }

  function renderIntensity(m) {
    const w = 300, h = 80, n = DATA.intensity.length, gap = 4, bw = (w - gap * (n - 1)) / n;
    const cols = [C.cream, C.brass, C.bad];
    let s = `<svg class="chart" viewBox="0 0 ${w} ${h + 14}">`;
    DATA.intensity.forEach((parts, i) => {
      let y = h;
      parts.forEach((p, j) => { const ph = (p / 100) * h; y -= ph; s += `<rect x="${i * (bw + gap)}" y="${y}" width="${bw}" height="${Math.max(0, ph - 1)}" fill="${cols[j]}"/>`; });
    });
    s += `<path d="M0 ${h - 0.8 * h}H${w}" stroke="${C.brass}" stroke-width="1.5" stroke-dasharray="4 3"/><text x="0" y="${h + 12}">8 weeks ago</text><text x="${w}" y="${h + 12}" text-anchor="end">this week</text></svg>`;
    const easy = last(DATA.intensity)[0];
    const cls = easy >= 78 ? "good" : easy >= 70 ? "warn" : "bad";
    return card(m, `<div class="row"><div class="big">${easy}%<small>easy</small></div><div class="stat"><b class="${cls}">${easy >= 78 ? "On target" : "Too much grey zone"}</b><span>target ≥ 80% Z1–2</span></div></div>${s}<div class="legend"><span><i style="background:${cols[0]}"></i>Easy Z1–2</span><span><i style="background:${cols[1]}"></i>Moderate Z3</span><span><i style="background:${cols[2]}"></i>Hard Z4–5</span></div>`);
  }

  function renderVo2(m) {
    const v = last(DATA.vo2), d = v - DATA.vo2[0];
    return card(m, `<div class="row"><div class="big">${v}<small>ml/kg/min</small></div><div class="stat"><b class="good">${signed(d)}</b><span>in 12 weeks</span></div></div>${line(DATA.vo2, { labels: ["12 weeks ago", "now"] })}<p class="note">Wearable estimate. Confirm with a lab test once a year.</p>`);
  }

  function renderLoad(m) {
    const v = DATA.acwr, w = 300, x = (r) => (Math.min(2, r) / 2) * w;
    const cls = v >= 0.8 && v <= 1.3 ? "good" : v <= 1.5 ? "warn" : "bad";
    const g = `<svg class="chart" viewBox="0 0 ${w} 40"><rect x="0" y="12" width="${w}" height="10" fill="#252523"/><rect x="${x(0.8)}" y="12" width="${x(1.3) - x(0.8)}" height="10" fill="${C.good}" fill-opacity=".45"/><rect x="${x(1.3)}" y="12" width="${x(1.5) - x(1.3)}" height="10" fill="${C.warn}" fill-opacity=".45"/><rect x="${x(1.5)}" y="12" width="${w - x(1.5)}" height="10" fill="${C.bad}" fill-opacity=".35"/><path d="M${x(v)} 6V28" stroke="${C.cream}" stroke-width="2.5"/><text x="${x(0.8)}" y="38" text-anchor="middle">0.8</text><text x="${x(1.3)}" y="38" text-anchor="middle">1.3</text><text x="${x(1.5)}" y="38" text-anchor="middle">1.5</text></svg>`;
    return card(m, `<div class="row"><div class="big">${fmt(v, 2)}</div><div class="stat"><b class="${cls}">${cls === "good" ? "Productive range" : cls === "warn" ? "Ramping fast" : "Injury risk"}</b><span>7-day ÷ 28-day load</span></div></div>${g}`);
  }

  function renderProtein(m) {
    const t = T(), kg = last(DATA.weight);
    const hit = DATA.protein.filter((p) => p >= t.proteinGkg).length;
    const cls = hit >= 5 ? "good" : hit >= 3 ? "warn" : "bad";
    return card(m, `<div class="row"><div class="big">${fmt(avg(DATA.protein), 1)}<small>g/kg avg</small></div><div class="stat"><b class="${cls}">${hit}/7</b><span>days on target</span></div><div class="stat"><b>${Math.round(t.proteinGkg * kg)} g</b><span>daily target at ${fmt(kg, 1)} kg</span></div></div>${bars(DATA.protein, { max: Math.max(2.4, t.proteinGkg * 1.2), target: t.proteinGkg, targetLabel: `${t.proteinGkg} g/kg`, colorFn: (p) => (p >= t.proteinGkg ? C.cream : C.dim), labels: ["7 days ago", "today"] })}`);
  }

  function renderBodyComp(m) {
    const w = last(DATA.weight), bf = last(DATA.bodyFat);
    return card(m, `<div class="row"><div class="stat"><b>${fmt(w, 1)} kg</b><span>${signed(w - DATA.weight[0], 1)} kg in 12 wk</span></div><div class="stat"><b>${fmt(bf, 1)}%</b><span>body fat (${signed(bf - DATA.bodyFat[0], 1)})</span></div><div class="stat"><b>${fmt(DATA.leanKg, 1)} kg</b><span>lean mass, last DEXA</span></div></div>${line(DATA.weight, { labels: ["12 weeks ago", "this week"] })}`);
  }

  function renderAlcohol(m) {
    const t = T(), v = last(DATA.alcohol);
    const cls = v <= t.alcoholCap ? "good" : v <= t.alcoholCap * 1.5 ? "warn" : "bad";
    return card(m, `<div class="row"><div class="big">${v}<small>units this week</small></div><div class="stat"><b class="${cls}">${v <= t.alcoholCap ? "Within cap" : "Over cap"}</b><span>cap ${t.alcoholCap} units</span></div></div>${bars(DATA.alcohol, { target: t.alcoholCap, targetLabel: `cap ${t.alcoholCap}`, colorFn: (x) => (x > t.alcoholCap ? C.warn : C.cream), labels: ["8 weeks ago", "this week"] })}<p class="note">1 unit = 10 g alcohol. Alcohol within 3 h of bed lowers HRV and deep sleep.</p>`);
  }

  function renderSupplements(m) {
    const rows = DATA.supplements.map((s) => {
      const p = Math.round((s.taken / 7) * 100), cls = p >= 85 ? "good" : p >= 60 ? "warn" : "bad";
      return `<tr><td><b style="font-weight:500">${esc(s.name)}</b><br><span class="muted">${esc(s.why)}</span></td><td>${esc(s.dose)}</td><td>${esc(s.when)}</td><td><span class="pill" title="Evidence grade">${esc(s.grade)}</span></td><td class="num ${cls}">${s.taken}/7</td></tr>`;
    }).join("");
    return card(m, `<div class="table-scroll"><table><thead><tr><th>Supplement</th><th>Dose</th><th>When</th><th>Evidence</th><th class="num">Taken</th></tr></thead><tbody>${rows}</tbody></table></div><p class="note">Evidence: A strong · B moderate · C trial, review at your next call. Third-party-tested brands only. Optimised never sells supplements.</p>`);
  }

  // ---------- Page ----------
  const $ = (id) => document.getElementById(id);

  function renderDash() {
    const on = new Set(cfg().modules);
    const c = client();
    $("greeting").textContent = `${c.name} · ${c.role}`;
    $("today").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    $("intro-note").textContent = `${on.size} of ${MODULES.length} modules, chosen by your doctor to match your goals. Your data stays on this device.`;
    // One dense grid, in domain order, so a domain with a single card leaves no gap.
    const mods = DOMAINS.flatMap(([dom]) => MODULES.filter((m) => m.domain === dom && on.has(m.id)));
    $("dash").innerHTML = mods.length ? `<div class="grid">${mods.map((m) => m.render(m)).join("")}</div>` : "";
    $("empty").hidden = on.size > 0;
  }

  function renderConfig() {
    const conf = cfg();
    $("presets").innerHTML = Object.keys(PRESETS).map((p) => `<button type="button" data-preset="${esc(p)}">${esc(p)}</button>`).join("");
    $("count").textContent = `${conf.modules.length} on`;
    $("module-list").innerHTML = DOMAINS.map(([dom, label]) => {
      const items = MODULES.filter((m) => m.domain === dom).map((m) =>
        `<label class="toggle"><span><b>${esc(m.title)}</b><small>${esc(m.desc)}</small></span><input type="checkbox" data-mod="${m.id}" ${conf.modules.includes(m.id) ? "checked" : ""}/><span class="switch"></span></label>`).join("");
      return `<div class="mod-group"><p>${esc(label)}</p>${items}</div>`;
    }).join("");
    $("targets").innerHTML = TARGET_FIELDS.map(([k, label, type, step]) =>
      `<label class="${type.startsWith("date") ? "span2" : ""}">${esc(label)}<input id="t-${k}" type="${type}" data-target="${k}" value="${esc(conf.targets[k])}" ${step ? `step="${step}"` : ""}/></label>`).join("");
    $("focus-edit").innerHTML = [0, 1, 2].map((i) => {
      const [b, s] = conf.focus[i] || ["", ""];
      return `<div class="focus-row"><span>0${i + 1}</span><input id="f-${i}-0" data-focus="${i}" data-part="0" placeholder="Priority" value="${esc(b)}"/><input id="f-${i}-1" data-focus="${i}" data-part="1" placeholder="How, in one line" value="${esc(s)}"/></div>`;
    }).join("");
    $("export-code").value = "";
    $("import-msg").textContent = "";
  }

  function update() { saveStore(); renderDash(); renderConfig(); }

  function openDrawer(open) {
    $("drawer").classList.toggle("open", open);
    $("drawer").setAttribute("aria-hidden", String(!open));
    $("scrim").hidden = !open;
    if (open) renderConfig();
  }

  $("client").innerHTML = CLIENTS.map((c) => `<option value="${c.id}">${esc(c.name)}, ${esc(c.role)}</option>`).join("");
  $("client").value = clientId;
  $("client").addEventListener("change", (e) => { clientId = e.target.value; store.current = clientId; update(); });
  $("open-config").addEventListener("click", () => openDrawer(true));
  $("close-config").addEventListener("click", () => openDrawer(false));
  $("done").addEventListener("click", () => openDrawer(false));
  $("scrim").addEventListener("click", () => openDrawer(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") openDrawer(false); });
  $("reset").addEventListener("click", () => { delete store[clientId]; update(); });

  $("presets").addEventListener("click", (e) => {
    const p = e.target.closest("[data-preset]");
    if (!p) return;
    cfg().modules = [...PRESETS[p.dataset.preset]];
    update();
  });
  $("module-list").addEventListener("change", (e) => {
    const id = e.target.dataset.mod;
    if (!id) return;
    const conf = cfg();
    conf.modules = e.target.checked ? [...new Set([...conf.modules, id])] : conf.modules.filter((x) => x !== id);
    saveStore(); renderDash();
    $("count").textContent = `${conf.modules.length} on`;
  });
  $("targets").addEventListener("change", (e) => {
    const k = e.target.dataset.target;
    if (!k) return;
    const val = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    if (e.target.type === "number" && !(val > 0)) { e.target.value = cfg().targets[k]; return; }
    cfg().targets[k] = val;
    saveStore(); renderDash();
  });


  $("focus-edit").addEventListener("input", (e) => {
    const i = e.target.dataset.focus;
    if (i == null) return;
    const conf = cfg();
    while (conf.focus.length < 3) conf.focus.push(["", ""]);
    conf.focus[+i][+e.target.dataset.part] = e.target.value;
    saveStore(); renderDash();
  });

  // Protocol code: modules, targets and focus only. Never health data.
  const encode = (obj) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))));
  const decode = (code) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(code.trim()), (c) => c.charCodeAt(0))));

  $("export").addEventListener("click", async () => {
    const conf = cfg();
    const code = encode({ v: 1, modules: conf.modules, targets: conf.targets, focus: conf.focus });
    const box = $("export-code");
    box.value = code;
    try { await navigator.clipboard.writeText(code); $("import-msg").textContent = "Protocol code copied. Send it to your client."; }
    catch { box.focus(); box.select(); $("import-msg").textContent = "Select the code above and copy it."; }
  });

  $("import").addEventListener("click", () => {
    const msg = $("import-msg");
    try {
      const p = decode($("export-code").value);
      if (p.v !== 1 || !Array.isArray(p.modules)) throw new Error();
      const known = new Set(MODULES.map((m) => m.id));
      const conf = cfg();
      conf.modules = p.modules.filter((id) => known.has(id));
      conf.targets = { ...DEFAULT_TARGETS, ...p.targets };
      if (Array.isArray(p.focus)) conf.focus = p.focus.slice(0, 3).map((f) => [String(f[0] || ""), String(f[1] || "")]);
      update();
      $("import-msg").textContent = "Protocol imported.";
    } catch {
      msg.textContent = "That code isn't a valid protocol. Paste the whole code your doctor sent.";
    }
  });

  document.title = `${BRAND} Client Dashboard`;
  renderDash();
})();
