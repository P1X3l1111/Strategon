"use client";

import { useState } from "react";
import { getActiveWeekIndex } from "../../data/quests";
import QuestPanel from "../QuestPanel";
import DailyRewardPanel from "../DailyRewardPanel";

export default function QuestsModal({ onClose }) {
  const [tab, setTab] = useState("rewards"); // "rewards" | "daily" | "weekly"
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
            { id: "weekly",  label: `🗓️ Weekly (Week ${weekIdx})` },
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
          {tab === "rewards" && <DailyRewardPanel />}
          {tab === "daily"   && <QuestPanel type="daily" />}
          {tab === "weekly"  && <QuestPanel type="weekly" />}
        </div>
      </div>
    </div>
  );
}
