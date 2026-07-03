"use client";

import { useEffect, useState } from "react";
import {
  getActiveWeekIndex,
  getDailyRewardStatus, claimDailyReward, DAILY_REWARD_TIERS,
} from "../../data/quests";
import QuestPanel from "../QuestPanel";

export default function QuestsModal({ onClose }) {
  const [tab, setTab] = useState("rewards"); // "rewards" | "daily" | "weekly"
  const [reward, setReward] = useState(() => getDailyRewardStatus());
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    const refresh = () => setReward(getDailyRewardStatus());
    refresh();
    window.addEventListener("rpg_quests_updated", refresh);
    window.addEventListener("rpg_profile_updated", refresh);
    return () => {
      window.removeEventListener("rpg_quests_updated", refresh);
      window.removeEventListener("rpg_profile_updated", refresh);
    };
  }, []);

  function handleClaimReward() {
    const tier = claimDailyReward();
    if (tier) {
      setFlash(`Day ${tier.day} reward claimed!`);
      setTimeout(() => setFlash(null), 1800);
    }
  }

  const weekIdx = getActiveWeekIndex();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-xl font-bold text-white">🎯 Quests &amp; Rewards</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 shrink-0 px-2">
          {[
            { id: "rewards", label: "🎁 Daily Reward" },
            { id: "daily",   label: "📅 Daily Quests" },
            { id: "weekly",  label: `🗓️ Weekly (Wk ${weekIdx}/4)` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 ${
                tab === t.id ? "text-white border-indigo-500" : "text-zinc-500 border-transparent hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {tab === "rewards" && (
            <>
              {flash && (
                <div className="mb-3 bg-green-900/60 border border-green-700 text-green-300 text-xs font-bold rounded-lg px-3 py-1.5 text-center">
                  {flash}
                </div>
              )}
              <RewardsTab reward={reward} onClaim={handleClaimReward} />
            </>
          )}
          {tab === "daily"  && <QuestPanel type="daily" />}
          {tab === "weekly" && <QuestPanel type="weekly" />}
        </div>
      </div>
    </div>
  );
}

function RewardsTab({ reward, onClaim }) {
  if (!reward) {
    return <p className="text-zinc-500 text-sm text-center py-6">Log in to track your daily streak.</p>;
  }
  const cyclePos = (reward.nextStreak - 1) % 7; // 0-indexed slot about to be claimed/just claimed

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔥</span>
          <div>
            <p className="text-white font-black text-lg leading-none">{reward.streak}-day streak</p>
            <p className="text-zinc-500 text-xs mt-0.5">Come back daily to keep it going</p>
          </div>
        </div>
        <button
          onClick={onClaim}
          disabled={reward.claimedToday}
          className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 ${
            reward.claimedToday
              ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-500 text-white hover:scale-[1.03]"
          }`}
        >
          {reward.claimedToday ? "✓ Claimed today" : "Claim"}
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {DAILY_REWARD_TIERS.map((tier, i) => {
          const isDone   = i < cyclePos || (i === cyclePos && reward.claimedToday);
          const isActive = i === cyclePos && !reward.claimedToday;
          return (
            <div
              key={tier.day}
              className={`rounded-xl border p-2 flex flex-col items-center gap-1 text-center ${
                isActive ? "border-indigo-500 bg-indigo-950/50" : isDone ? "border-green-800 bg-green-950/30" : "border-zinc-800 bg-zinc-800/40"
              }`}
            >
              <span className="text-[9px] uppercase font-bold text-zinc-500">Day {tier.day}</span>
              <span className="text-lg">{isDone ? "✅" : tier.gems ? "💎" : tier.oil && !tier.mana ? "🛢️" : "💜"}</span>
              <span className="text-[10px] text-zinc-300 font-semibold leading-tight">
                {tier.mana ? `${tier.mana}💜` : ""}{tier.gems ? ` ${tier.gems}💎` : ""}{tier.oil ? ` ${tier.oil}🛢️` : ""}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-zinc-600 text-[11px] text-center">Miss a day and your streak resets — Day 7 pays out the jackpot.</p>
    </div>
  );
}
