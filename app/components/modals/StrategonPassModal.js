"use client";

import { useState, useEffect } from "react";
import {
  PASS_REWARDS, PASS_LEVEL_XP, PASS_MAX_LEVEL,
  getPassState, getPassLevel, claimPassReward,
} from "../../data/quests";

export default function StrategonPassModal({ onClose }) {
  const [state, setState] = useState(null);
  const [toast, setToast] = useState(null);

  function refresh() { setState(getPassState()); }

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("rpg_pass_updated", onUpdate);
    window.addEventListener("rpg_quests_updated", onUpdate);
    return () => {
      window.removeEventListener("rpg_pass_updated", onUpdate);
      window.removeEventListener("rpg_quests_updated", onUpdate);
    };
  }, []);

  if (!state) return null;

  const xp = state.xp;
  const level = getPassLevel(xp);
  const intoLevel = xp - level * PASS_LEVEL_XP;
  const levelPercent = level >= PASS_MAX_LEVEL ? 100 : Math.min(100, (intoLevel / PASS_LEVEL_XP) * 100);

  function handleClaim(reward) {
    if (claimPassReward(reward.level)) {
      setToast(`Level ${reward.level} claimed! +${reward.rewardCoins || 0}💰${reward.rewardGems ? ` +${reward.rewardGems}💎` : ""}`);
      setTimeout(() => setToast(null), 2200);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-xl font-bold text-white">🎫 Strategon Pass</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800">✕</button>
        </div>

        {toast && (
          <div className="mx-6 mt-3 bg-amber-950/60 border border-amber-700 text-amber-300 text-xs font-bold rounded-lg px-3 py-1.5 text-center shrink-0">
            {toast}
          </div>
        )}

        {/* Progress summary */}
        <div className="px-6 pt-4 shrink-0">
          <p className="text-zinc-500 text-xs mb-3">
            Complete weekly quests to earn Pass XP — every {PASS_LEVEL_XP.toLocaleString()} XP unlocks the next level's reward. Resets with the weekly quest cycle.
          </p>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white font-bold">Level {level}{level >= PASS_MAX_LEVEL ? " (MAX)" : ` / ${PASS_MAX_LEVEL}`}</span>
            <span className="text-zinc-400">{level >= PASS_MAX_LEVEL ? xp.toLocaleString() : `${intoLevel.toLocaleString()} / ${PASS_LEVEL_XP.toLocaleString()}`} XP</span>
          </div>
          <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${levelPercent}%` }}
            />
          </div>
        </div>

        {/* Body — tier list */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {PASS_REWARDS.map((r) => {
              const unlocked = level >= r.level;
              const claimed  = state.claimed.includes(r.level);
              return (
                <div key={r.level} className={`rounded-xl border p-3 flex flex-col items-center gap-1.5 text-center ${
                  claimed ? "border-zinc-800 bg-zinc-900/40 opacity-50"
                  : unlocked ? "border-amber-600 bg-amber-950/30"
                  : "border-zinc-800 bg-zinc-800/30"
                }`}>
                  <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Lv.{r.level}</span>
                  <span className="text-2xl">{unlocked ? (r.rewardGems ? "💎" : "💰") : "🔒"}</span>
                  <span className="text-zinc-300 text-[11px] font-semibold">
                    {r.rewardCoins ? `+${r.rewardCoins} coins` : ""}{r.rewardGems ? `+${r.rewardGems} gems` : ""}
                  </span>
                  <button
                    onClick={() => handleClaim(r)}
                    disabled={!unlocked || claimed}
                    className={`mt-1 w-full py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 ${
                      claimed ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                      : unlocked ? "bg-amber-600 hover:bg-amber-500 text-white"
                      : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                    }`}
                  >
                    {claimed ? "✓ Claimed" : unlocked ? "Claim" : "Locked"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
