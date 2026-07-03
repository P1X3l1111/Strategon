"use client";

import { useEffect, useState } from "react";
import { getDailyRewardStatus, claimDailyReward, DAILY_REWARD_TIERS } from "../data/quests";

// Self-contained daily-login streak panel — mirrors QuestPanel's pattern.
// Rendered inline on the home screen.
export default function DailyRewardPanel() {
  const [reward, setReward] = useState(null);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    function refresh() { setReward(getDailyRewardStatus()); }
    refresh();
    window.addEventListener("rpg_quests_updated", refresh);
    window.addEventListener("rpg_profile_updated", refresh);
    return () => {
      window.removeEventListener("rpg_quests_updated", refresh);
      window.removeEventListener("rpg_profile_updated", refresh);
    };
  }, []);

  function handleClaim() {
    const tier = claimDailyReward();
    if (tier) {
      setFlash(`Day ${tier.day} reward claimed!`);
      setTimeout(() => setFlash(null), 1800);
    }
  }

  // Stays empty through SSR/hydration (status depends on localStorage) and while logged out.
  if (!reward) return null;

  const cyclePos = (reward.nextStreak - 1) % 7; // 0-indexed slot about to be claimed/just claimed

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-3 flex flex-col gap-2 w-full shrink-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-white font-black text-sm whitespace-nowrap">🎁 Daily Reward</h3>
        <span className="text-amber-300 text-xs font-bold flex items-center gap-1 shrink-0">🔥 {reward.streak}-day streak</span>
      </div>

      {flash && (
        <div className="bg-green-900/60 border border-green-700 text-green-300 text-[11px] font-bold rounded-lg px-2 py-1 text-center">
          {flash}
        </div>
      )}

      <div className="grid grid-cols-7 gap-1.5">
        {DAILY_REWARD_TIERS.map((tier, i) => {
          const isDone   = i < cyclePos || (i === cyclePos && reward.claimedToday);
          const isActive = i === cyclePos && !reward.claimedToday;
          return (
            <div
              key={tier.day}
              className={`rounded-lg border p-1 flex flex-col items-center gap-0.5 text-center ${
                isActive ? "border-indigo-500 bg-indigo-950/50" : isDone ? "border-green-800 bg-green-950/30" : "border-zinc-800 bg-zinc-800/40"
              }`}
            >
              <span className="text-[8px] uppercase font-bold text-zinc-500">D{tier.day}</span>
              <span className="text-sm">{isDone ? "✅" : tier.gems ? "💎" : "💰"}</span>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleClaim}
        disabled={reward.claimedToday}
        className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
          reward.claimedToday
            ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-500 text-white"
        }`}
      >
        {reward.claimedToday ? "✓ Claimed today" : `Claim Day ${cyclePos + 1} Reward`}
      </button>
    </div>
  );
}
