"use client";

import { useEffect, useState } from "react";
import {
  STAT_META,
  getActiveDailyQuests, getActiveWeeklyQuests, getActiveWeekIndex,
  getQuestState, claimDailyQuest, claimWeeklyQuest,
  hoursUntilDailyReset, daysUntilWeeklyReset,
} from "../data/quests";

// Self-contained daily/weekly quest list — reads its own progress, claims its
// own rewards, and refreshes on "rpg_quests_updated". Used both inline on the
// home screen and inside QuestsModal so the two never drift apart.
export default function QuestPanel({ type }) {
  const isDaily = type === "daily";
  // Both the quest selection and progress are seeded/keyed off localStorage (the
  // logged-in user), so they must stay empty through the initial SSR/hydration
  // pass and only be read client-side — otherwise server and client render
  // different quests for the same slot and React flags a hydration mismatch.
  const [state, setState]   = useState(null);
  const [quests, setQuests] = useState([]);
  const [flash, setFlash]   = useState(null);

  useEffect(() => {
    function refresh() {
      setState(getQuestState());
      setQuests(isDaily ? getActiveDailyQuests() : getActiveWeeklyQuests());
    }
    refresh();
    window.addEventListener("rpg_quests_updated", refresh);
    window.addEventListener("rpg_profile_updated", refresh); // re-read on login/logout
    return () => {
      window.removeEventListener("rpg_quests_updated", refresh);
      window.removeEventListener("rpg_profile_updated", refresh);
    };
  }, [isDaily]);

  const stats       = (isDaily ? state?.dailyStats   : state?.weeklyStats)   || {};
  const claimed     = (isDaily ? state?.dailyClaimed : state?.weeklyClaimed) || [];
  const resetLabel  = isDaily ? `Resets in ${hoursUntilDailyReset()}h` : `New set in ${daysUntilWeeklyReset()}d`;
  const weekIdx     = getActiveWeekIndex();

  function handleClaim(q) {
    const ok = isDaily ? claimDailyQuest(q.id) : claimWeeklyQuest(q.id);
    if (ok) {
      setFlash(`+${q.rewardMana || 0}💜${q.rewardGems ? ` +${q.rewardGems}💎` : ""}`);
      setTimeout(() => setFlash(null), 1600);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-white font-black text-sm flex items-center gap-1.5 whitespace-nowrap">
          {isDaily ? "📅 Daily Quests" : "🗓️ Weekly Quests"}
          {!isDaily && <span className="text-amber-400 text-[10px] font-bold bg-amber-950 border border-amber-800 rounded-full px-1.5 py-0.5">Week {weekIdx}</span>}
        </h3>
        <span className="text-zinc-600 text-[9px] font-semibold shrink-0">{resetLabel}</span>
      </div>

      {flash && (
        <div className="bg-green-900/60 border border-green-700 text-green-300 text-[11px] font-bold rounded-lg px-2 py-1 text-center">
          {flash}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {quests.map((q) => {
          const progress   = Math.min(stats[q.statKey] || 0, q.target);
          const isClaimed  = claimed.includes(q.id);
          const isComplete = progress >= q.target;
          const meta       = STAT_META[q.statKey];
          return (
            <div key={q.id} className={`rounded-xl border p-2.5 flex flex-col gap-1.5 min-h-[110px] ${isClaimed ? "border-zinc-800 bg-zinc-900/40 opacity-50" : "border-zinc-700 bg-zinc-800/50"}`}>
              <div className="flex items-center gap-1.5">
                <span className="text-lg shrink-0">{meta?.icon || "⭐"}</span>
                <p className="text-white text-[11px] font-bold leading-snug">{q.desc}</p>
              </div>
              <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${isComplete ? "bg-green-500" : "bg-indigo-500"}`}
                  style={{ width: `${Math.max(0, (progress / q.target) * 100)}%` }}
                />
              </div>
              <p className="text-zinc-500 text-[9px]">
                {progress}/{q.target} · +{q.rewardMana || 0}💜{q.rewardGems ? ` +${q.rewardGems}💎` : ""}
              </p>
              <button
                onClick={() => handleClaim(q)}
                disabled={!isComplete || isClaimed}
                className={`mt-auto w-full py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95 ${
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
