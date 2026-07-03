"use client";
import { useEffect, useState } from "react";
import { MISSIONS, getCampaignProgress, isMissionUnlocked, isMissionComplete } from "../data/campaign";

export default function CampaignSelect({ onSelectMission, onBack }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener("rpg_campaign_updated", refresh);
    return () => window.removeEventListener("rpg_campaign_updated", refresh);
  }, []);

  const progress = getCampaignProgress();
  const doneCount = MISSIONS.filter((m) => progress.completed.includes(m.id)).length;

  return (
    <div className="flex flex-col items-center min-h-screen gap-8 px-8 py-10 overflow-y-auto select-none">
      <button onClick={onBack} className="self-start text-sm text-zinc-400 hover:text-white px-3 py-1 rounded-lg hover:bg-zinc-800 transition-colors">
        ← Back to Modes
      </button>

      <div className="text-center">
        <h1 className="text-4xl font-black text-white mb-2">🎖️ Campaign</h1>
        <p className="text-zinc-500 text-sm">Win scripted battles. Some missions demand you capture enemy troops alive.</p>
        <p className="text-zinc-600 text-xs mt-2">{doneCount}/{MISSIONS.length} missions complete</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-2xl">
        {MISSIONS.map((m, i) => {
          const unlocked = isMissionUnlocked(m.id);
          const complete = isMissionComplete(m.id);
          return (
            <button
              key={m.id}
              onClick={() => unlocked && onSelectMission(m)}
              disabled={!unlocked}
              className={`group relative flex items-center gap-5 border rounded-2xl p-5 text-left transition-all duration-200 overflow-hidden ${
                unlocked
                  ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800 hover:border-zinc-500 hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-xl"
                  : "bg-zinc-900/40 border-zinc-800 cursor-not-allowed opacity-50"
              }`}
            >
              <span className="text-3xl font-black w-10 text-center shrink-0" style={{ color: unlocked ? (complete ? "#22c55e" : "#f59e0b") : "#52525b" }}>
                {complete ? "✓" : unlocked ? i + 1 : "🔒"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-white font-black text-lg">{m.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                    m.objective === "capture"
                      ? "text-cyan-300 bg-cyan-950 border-cyan-800"
                      : "text-red-300 bg-red-950 border-red-800"
                  }`}>
                    {m.objective === "capture" ? `CAPTURE ${m.captureCount}` : "ELIMINATE ALL"}
                  </span>
                  {complete && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border text-green-300 bg-green-950 border-green-800">COMPLETE</span>}
                </div>
                <p className="text-zinc-400 text-sm">{unlocked ? m.briefing : "Complete the previous mission to unlock."}</p>
                <p className="text-zinc-600 text-xs mt-1">
                  Reward: {m.rewardMana}💜{m.rewardGems ? ` +${m.rewardGems}💎` : ""}{m.rewardOil ? ` +${m.rewardOil}🛢️` : ""}
                </p>
              </div>
              {unlocked && <span className="text-2xl text-zinc-600 group-hover:text-white transition-all shrink-0">→</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
