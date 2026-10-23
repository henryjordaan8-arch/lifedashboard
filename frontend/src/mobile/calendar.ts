/**
 * Google Calendar on the phone: the secret iCal addresses you paste in the app,
 * fetched natively and expanded (recurring events included) with ical.js.
 * Port of backend/app/calendar_feed.py; keep the keyword lists in step.
 */
import { CapacitorHttp } from "@capacitor/core";
import ICAL from "ical.js";
import type { CalEvent, Category, Sport } from "../types";
import { keyReason } from "./sport";

const URLS_KEY = "ld.calendar.urls";
const CACHE_MS = 15 * 60 * 1000;
const CATEGORIES: Category[] = ["training", "work", "study", "reading", "personal", "other"];

const KEYWORDS: Record<string, string[]> = {
  study: ["study", "lecture", "class", "exam", "revision", "revise", "tutorial", "assignment", "seminar", "lab",
    "course", "homework", "thesis"],
  reading: ["read", "reading", "book", "kindle", "audiobook"],
  personal: ["breakfast", "lunch", "dinner", "meal", "groceries", "shopping", "errands", "doctor", "dentist", "haircut",
    "family", "friends", "social", "date night", "chores", "cleaning", "cook", "cooking", "commute", "travel"],
  work: ["work", "meeting", "call", "standup", "stand-up", "sync", "1:1", "shift", "client", "interview", "review",
    "office", "deadline"],
};
const SPORT_BY_TITLE: [Sport, RegExp][] = [
  ["run", /\b(run|runs|running|jog|tempo|intervals?|parkrun|fartlek|strides|long run|easy run)\b/],
  ["ride", /\b(ride|bike|cycl\w*|zwift|spin|trainer|turbo|ftp|sweet\s?spot|over[\s-]?unders?)\b/],
  ["swim", /\b(swim\w*|pool|open water)\b/],
  ["strength", /\b(strength|gym|weights?|lift\w*|core|mobility|s&c)\b/],
];
const CALL_WORDS = ["call", "calls"];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text: string, words: string[]) =>
  words.some((w) => new RegExp(`(?<!\\w)${escape(w.toLowerCase())}(?!\\w)`).test(text));

function sportFromTitle(title: string): Sport | "other" {
  const text = title.toLowerCase();
  return SPORT_BY_TITLE.find(([, re]) => re.test(text))?.[0] ?? "other";
}

function classify(title: string): Category {
  if (sportFromTitle(title) !== "other") return "training";
  const text = title.toLowerCase();
  for (const cat of ["study", "work", "reading", "personal"] as const) if (hasWord(text, KEYWORDS[cat])) return cat;
  return "other";
}

export const isCall = (title: string) => hasWord(title.toLowerCase(), CALL_WORDS);

// ---------- settings: one address per line, optionally "study: https://…" ----------

export interface Source { category: Category | null; url: string }

export function sources(): Source[] {
  return parseSources(localStorage.getItem(URLS_KEY) ?? "");
}
export const sourcesText = () => localStorage.getItem(URLS_KEY) ?? "";
export function saveSources(text: string) {
  localStorage.setItem(URLS_KEY, text.trim());
  feeds.clear();
}
export function parseSources(text: string): Source[] {
  return text.split(/\n+/).map((l) => l.trim()).filter(Boolean).flatMap((line) => {
    const m = line.match(/^(\w+)\s*:\s*(https?:\/\/\S+)$/i);
    const cat = m && CATEGORIES.includes(m[1].toLowerCase() as Category) ? (m[1].toLowerCase() as Category) : null;
    const url = cat ? m![2] : line.replace(/^webcal:\/\//i, "https://");
    return /^https?:\/\//i.test(url) ? [{ category: cat, url }] : [];
  });
}

// ---------- fetch + expand ----------

const feeds = new Map<string, { at: number; comp: ICAL.Component }>();

async function feed(url: string): Promise<ICAL.Component> {
  const hit = feeds.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.comp;
  const res = await CapacitorHttp.get({ url, responseType: "text" });
  if (res.status >= 400) throw new Error(`calendar HTTP ${res.status}`);
  const comp = new ICAL.Component(ICAL.parse(String(res.data)));
  for (const tz of comp.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);
  feeds.set(url, { at: Date.now(), comp });
  return comp;
}

const pad = (n: number) => String(n).padStart(2, "0");
function local(t: ICAL.Time): string {
  if (t.isDate) return `${t.year}-${pad(t.month)}-${pad(t.day)}`;
  const d = t.toJSDate();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, "0");
}

function toEvent(item: ICAL.Event, start: ICAL.Time, end: ICAL.Time, category: Category | null): CalEvent {
  const title = item.summary || "Untitled";
  const s = local(start);
  const cat = category ?? classify(title);
  const sport = cat === "training" ? (sportFromTitle(title) as Sport) : null;
  return {
    id: hash(`${item.uid || title}|${s}`),
    title,
    start: s,
    end: local(end),
    all_day: start.isDate,
    category: cat,
    sport,
    key_reason: cat === "training" ? keyReason(title, sport) : title.includes("★") || title.includes("⭐") ? "starred" : null,
    description: item.description?.trim() || null,
    location: item.location?.trim() || null,
  };
}

/** Events overlapping [start, end) (local days, YYYY-MM-DD), from every calendar. */
export async function eventsBetween(start: string, end: string): Promise<CalEvent[]> {
  const from = new Date(`${start}T00:00:00`).getTime();
  const to = new Date(`${end}T00:00:00`).getTime();
  const out: CalEvent[] = [];
  for (const src of sources()) {
    let comp: ICAL.Component;
    try {
      comp = await feed(src.url);
    } catch {
      continue; // one broken calendar shouldn't hide the rest (and never log the secret URL)
    }
    const all = comp.getAllSubcomponents("vevent").map((v) => new ICAL.Event(v));
    const masters = new Map<string, ICAL.Event>();
    for (const e of all) if (!e.isRecurrenceException()) masters.set(e.uid, e);
    for (const e of all) if (e.isRecurrenceException()) masters.get(e.uid)?.relateException(e);

    for (const ev of masters.values()) {
      if (!ev.startDate) continue;
      if (!ev.isRecurring()) {
        const s = ev.startDate, e = ev.endDate ?? ev.startDate;
        if (e.toJSDate().getTime() > from && s.toJSDate().getTime() < to) out.push(toEvent(ev, s, e, src.category));
        continue;
      }
      const it = ev.iterator();
      for (let next = it.next(), n = 0; next && n < 5000; next = it.next(), n++) {
        if (next.toJSDate().getTime() >= to) break;
        const o = ev.getOccurrenceDetails(next);
        if (o.endDate.toJSDate().getTime() > from) out.push(toEvent(o.item, o.startDate, o.endDate, src.category));
      }
    }
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}
