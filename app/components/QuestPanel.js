"use client";

import { useEffect, useState } from "react";
import {
  STAT_META,
  getActiveDailyQuests, getWeeklyQuestsForWeek, getActiveWeekIndex,
  getQuestState, claimDailyQuest, claimWeeklyQuest,
  hoursUntilDailyReset, daysUntilWeeklyReset,
} from "../data/quests";

const WEEK_COUNT = 4;

// Self-contained daily/weekly quest list — reads its own progress, claims its
// own rewards, and refreshes on "rpg_quests_updated". Rendered inline on the home screen.
export default function QuestPanel({ type }) {
  const isDaily = type === "daily";
  const weekIdx = getActiveWeekIndex(); // how many weeks are unlocked this cycle (1-4)
  // Both the quest selection and progress are seeded/keyed off localStorage (the
  // logged-in user), so they must stay empty through the initial SSR/hydration
  // pass and only be read client-side — otherwise server and client render
  // different quests for the same slot and React flags a hydration mismatch.
  const [state, setState]     = useState(null);
  const [quests, setQuests]   = useState([]);
  const [flash, setFlash]     = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(weekIdx); // which week tab is open (weekly only)

  useEffect(() => {
    function refresh() {
      setState(getQuestState());
      setQuests(isDaily ? getActiveDailyQuests() : getWeeklyQuestsForWeek(selectedWeek));
    }
    refresh();
    window.addEventListener("rpg_quests_updated", refresh);
    window.addEventListener("rpg_profile_updated", refresh); // re-read on login/logout
    return () => {
      window.removeEventListener("rpg_quests_updated", refresh);
      window.removeEventListener("rpg_profile_updated", refresh);
    };
  }, [isDaily, selectedWeek]);

  const stats       = (isDaily ? state?.dailyStats   : state?.weeklyStats)   || {};
  const claimed     = (isDaily ? state?.dailyClaimed : state?.weeklyClaimed) || [];
  const resetLabel  = isDaily
    ? `Resets in ${hoursUntilDailyReset()}h`
    : weekIdx < WEEK_COUNT
      ? `More unlock in ${daysUntilWeeklyReset()}d`
      : `New cycle in ${daysUntilWeeklyReset()}d`;

  function handleClaim(q) {
    const ok = isDaily ? claimDailyQuest(q.id) : claimWeeklyQuest(q.id);
    if (ok) {
      setFlash(`+${q.rewardCoins || 0}💰${q.rewardGems ? ` +${q.rewardGems}💎` : ""}`);
      setTimeout(() => setFlash(null), 1600);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-3 flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-white font-black text-sm flex items-center gap-1.5 whitespace-nowrap">
          {isDaily ? "📅 Daily Quests" : "🗓️ Weekly Quests"}
        </h3>
        <span className="text-zinc-600 text-[9px] font-semibold shrink-0">{resetLabel}</span>
      </div>

      {/* Week tabs — a button per week, highlighted once that week has unlocked */}
      {!isDaily && (
        <div className="flex items-center gap-1.5">
          {Array.from({ length: WEEK_COUNT }, (_, i) => i + 1).map((w) => {
            const unlocked = w <= weekIdx;
            const isSelected = w === selectedWeek;
            return (
              <button
                key={w}
                onClick={() => unlocked && setSelectedWeek(w)}
                disabled={!unlocked}
                className={`flex-1 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                  !unlocked
                    ? "border-zinc-800 text-zinc-600 bg-zinc-900/40 cursor-not-allowed"
                    : isSelected
                    ? "border-amber-500 text-white bg-amber-950"
                    : "border-zinc-700 text-zinc-400 bg-zinc-800/50 hover:text-white hover:border-zinc-500"
                }`}
              >
                {unlocked ? `Week ${w}` : `🔒 Week ${w}`}
              </button>
            );
          })}
        </div>
      )}

      {flash && (
        <div className="bg-green-900/60 border border-green-700 text-green-300 text-[11px] font-bold rounded-lg px-2 py-1 text-center">
          {flash}
        </div>
      )}

      <div className={`grid grid-cols-3 gap-1.5 ${isDaily ? "" : "sm:grid-cols-5"}`}>
        {quests.map((q) => {
          const progress   = Math.min(stats[q.statKey] || 0, q.target);
          const isClaimed  = claimed.includes(q.id);
          const isComplete = progress >= q.target;
          const meta       = STAT_META[q.statKey];
          return (
            <div key={q.id} className={`rounded-xl border p-1.5 flex flex-col gap-0.5 h-[88px] ${isClaimed ? "border-zinc-800 bg-zinc-900/40 opacity-50" : "border-zinc-700 bg-zinc-800/50"}`}>
              <div className="flex items-start gap-1.5">
                <span className="text-sm shrink-0 leading-none">{meta?.icon || "⭐"}</span>
                <p className="text-white text-[10px] font-bold leading-snug line-clamp-2">{q.desc}</p>
              </div>
              <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${isComplete ? "bg-green-500" : "bg-indigo-500"}`}
                  style={{ width: `${Math.max(0, (progress / q.target) * 100)}%` }}
                />
              </div>
              <p className="text-zinc-500 text-[8px]">
                {progress}/{q.target} · +{q.rewardCoins || 0}💰{q.rewardGems ? ` +${q.rewardGems}💎` : ""}
              </p>
              <button
                onClick={() => handleClaim(q)}
                disabled={!isComplete || isClaimed}
                className={`mt-auto w-full py-1 rounded-lg text-[9px] font-bold transition-all active:scale-95 ${
                  isClaimed
                    ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                    : isComplete
                    ? "bg-green-600 hover:bg-green-500 text-white"
                    : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                }`}
              >
                {isClaimed ? "✓ Claimed" : isComplete ? "Claim" : "In progress"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
