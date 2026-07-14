"use client";

import { useState, useEffect } from "react";
import { Ticket, X, Coins, Gem, Lock, CheckCircle2 } from "lucide-react";
import {
  PASS_REWARDS, PASS_LEVEL_XP, PASS_MAX_LEVEL,
  getPassState, getPassLevel, claimPassReward,
} from "../../data/quests";

export default function StrategonPassModal({ open, onClose }) {
  const [state, setState] = useState(null);
  const [toast, setToast] = useState(null);

  function refresh() { setState(getPassState()); }

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    // Now that this modal stays mounted from page load (for the slide-in
    // animation), its first read can land before login sets a username —
    // re-read on rpg_profile_updated too, not just pass/quest changes.
    window.addEventListener("rpg_pass_updated", onUpdate);
    window.addEventListener("rpg_quests_updated", onUpdate);
    window.addEventListener("rpg_profile_updated", onUpdate);
    return () => {
      window.removeEventListener("rpg_pass_updated", onUpdate);
      window.removeEventListener("rpg_quests_updated", onUpdate);
      window.removeEventListener("rpg_profile_updated", onUpdate);
    };
  }, []);

  if (!state) return null;

  const xp = state.xp;
  const level = getPassLevel(xp);
  const intoLevel = xp - level * PASS_LEVEL_XP;
  const levelPercent = level >= PASS_MAX_LEVEL ? 100 : Math.min(100, (intoLevel / PASS_LEVEL_XP) * 100);

  function handleClaim(reward) {
    if (claimPassReward(reward.level)) {
      setToast({ level: reward.level, coins: reward.rewardCoins || 0, gems: reward.rewardGems || 0 });
      setTimeout(() => setToast(null), 2200);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end transition-colors duration-300 ${
        open ? "bg-black/70 backdrop-blur-sm pointer-events-auto" : "bg-transparent pointer-events-none"
      }`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-hidden={!open}
    >
      <div className={`h-full w-full max-w-2xl bg-zinc-900 border-l border-zinc-700 shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Ticket size={18}/> Strategon Pass</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800"><X size={16}/></button>
        </div>

        {toast && (
          <div className="mx-6 mt-3 bg-amber-950/60 border border-amber-700 text-amber-300 text-xs font-bold rounded-lg px-3 py-1.5 text-center shrink-0 flex items-center justify-center gap-1.5">
            Level {toast.level} claimed!
            {toast.coins > 0 && <span className="flex items-center gap-0.5">+{toast.coins}<Coins size={12}/></span>}
            {toast.gems > 0 && <span className="flex items-center gap-0.5">+{toast.gems}<Gem size={12}/></span>}
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
                  <span className={unlocked ? (r.rewardGems ? "text-cyan-400" : "text-yellow-400") : "text-zinc-600"}>
                    {unlocked ? (r.rewardGems ? <Gem size={22}/> : <Coins size={22}/>) : <Lock size={22}/>}
                  </span>
                  <span className="text-zinc-300 text-[11px] font-semibold">
                    {r.rewardCoins ? `+${r.rewardCoins} coins` : ""}{r.rewardGems ? `+${r.rewardGems} gems` : ""}
                  </span>
                  <button
                    onClick={() => handleClaim(r)}
                    disabled={!unlocked || claimed}
                    className={`mt-1 w-full py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1 ${
                      claimed ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                      : unlocked ? "bg-amber-600 hover:bg-amber-500 text-white"
                      : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                    }`}
                  >
                    {claimed ? <><CheckCircle2 size={11}/> Claimed</> : unlocked ? "Claim" : "Locked"}
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
