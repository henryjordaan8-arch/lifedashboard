import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { isoDay } from "../format";
import type { CalEvent, DayPlan, Week } from "../types";
import { DayTimeline } from "./DayTimeline";
import { KeySessionsCard } from "./KeySessionsCard";
import { WeeklyChecklist } from "./WeeklyChecklist";

export function TodayView({ refreshKey }: { refreshKey: number }) {
  const [day, setDay] = useState(() => isoDay(new Date()));
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [keys, setKeys] = useState<CalEvent[]>([]);
  const [week, setWeek] = useState<Week | null>(null);

  useEffect(() => {
    let live = true;
    api.day(day).then((p) => live && setPlan(p)).catch(() => live && setPlan(null));
    return () => {
      live = false;
    };
  }, [day, refreshKey]);

  useEffect(() => {
    api.keySessions(21).then(setKeys).catch(() => setKeys([]));
    api.week(isoDay(new Date())).then(setWeek).catch(() => setWeek(null));
  }, [refreshKey]);

  const tick = useCallback(
    (goalId: string, done: boolean) => {
      if (week) api.tick(week.week_start, goalId, done).then(setWeek);
    },
    [week],
  );

  return (
    <main className="grid">
      <div className="span-7">
        <DayTimeline plan={plan} day={day} onDay={setDay} />
      </div>
      <div className="span-5 stack">
        <KeySessionsCard events={keys} />
        <WeeklyChecklist week={week} onTick={tick} />
      </div>
    </main>
  );
}
