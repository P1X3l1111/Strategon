"use client";

import { useState, useEffect } from "react";
import {
  TROOP_ROSTER, STARTING_MANA, STARTING_OIL, STARTING_GEMS,
  MAX_UPGRADE_LEVEL, upgradeGemCost,
  getMana, getOil, getGems, spendGems,
  getUpgrades, saveUpgrades, getUpgradedTroop,
} from "../data/troops";

const CATEGORIES = ["Infantry", "Armored", "Artillery", "Other"];
const CATEGORY_ICONS = { Infantry: "🪖", Armored: "🛡️", Artillery: "💥", Other: "🏗️" };

export default function TroopsPanel({ onClose }) {
  const [mana,      setMana]      = useState(0);
  const [oil,       setOil]       = useState(0);
  const [gems,      setGems]      = useState(0);
  const [upgrades,  setUpgrades]  = useState({});
  const [toast,     setToast]     = useState(null);
  const [activeTab, setActiveTab] = useState("Infantry");

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    const h = () => loadAll();
    window.addEventListener("rpg_profile_updated", h);
    return () => window.removeEventListener("rpg_profile_updated", h);
  }, []);

  useEffect(() => {
    const h = () => { setMana(getMana()); setOil(getOil()); setGems(getGems()); };
    window.addEventListener("rpg_currency_updated", h);
    return () => window.removeEventListener("rpg_currency_updated", h);
  }, []);

  function loadAll() {
    const u = localStorage.getItem("rpg_username");
    if (!u) { setMana(0); setOil(0); setGems(0); setUpgrades({}); return; }

    if (localStorage.getItem(`rpg_mana_${u}`) === null)
      localStorage.setItem(`rpg_mana_${u}`, String(STARTING_MANA));
    if (localStorage.getItem(`rpg_oil_${u}`) === null)
      localStorage.setItem(`rpg_oil_${u}`, String(STARTING_OIL));
    if (localStorage.getItem(`rpg_gems_${u}`) === null)
      localStorage.setItem(`rpg_gems_${u}`, String(STARTING_GEMS));

    setMana(getMana());
    setOil(getOil());
    setGems(getGems());
    setUpgrades(getUpgrades());
  }

  function upgradeUnit(name) {
    const level = upgrades[name] || 1;
    if (level >= MAX_UPGRADE_LEVEL) return;
    const cost = upgradeGemCost(level);
    if (gems < cost) { showToast(`Need ${cost} 💎 gems!`, "error"); return; }
    if (!spendGems(cost)) { showToast("Upgrade failed.", "error"); return; }
    const next = { ...upgrades, [name]: level + 1 };
    setUpgrades(next);
    saveUpgrades(next);
    setGems(getGems());
    showToast(`${name} upgraded to Lv.${level + 1}! +15% stats`, "success");
  }

  function showToast(msg, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  const activeUnits = TROOP_ROSTER.filter(t => t.category === activeTab);

  return (
    <div className="flex flex-col bg-zinc-900 overflow-hidden relative h-full">

      {/* ── Header ── */}
      <div className="px-4 pt-3 pb-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-sm">🪖 Barracks</h2>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-zinc-800 rounded-lg px-2 py-1">
              <span className="text-purple-400">💜</span>
              <span className="text-purple-300 font-black text-sm">{mana.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1 bg-zinc-800 rounded-lg px-2 py-1">
              <span className="text-amber-400">🛢️</span>
              <span className="text-amber-300 font-black text-sm">{oil}</span>
            </div>
            <div className="flex items-center gap-1 bg-zinc-800 rounded-lg px-2 py-1">
              <span className="text-cyan-400">💎</span>
              <span className="text-cyan-300 font-black text-sm">{gems}</span>
            </div>
            {onClose && (
              <button onClick={onClose} className="text-zinc-500 hover:text-white px-1 ml-1">✕</button>
            )}
          </div>
        </div>

        <p className="text-zinc-600 text-[10px] mt-1">
          Upgrade troops with 💎 gems · Deploy them in-game with 💜 mana
        </p>

        {/* Category tabs */}
        <div className="flex gap-1 mt-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`flex-1 text-[10px] font-semibold py-1 rounded-md transition-all
                ${activeTab === cat ? "bg-indigo-700 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
            >
              {CATEGORY_ICONS[cat]}
            </button>
          ))}
        </div>
        <div className="text-center text-[10px] text-zinc-500 mt-0.5">{activeTab}</div>
      </div>

      {/* ── Unit list ── */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {activeUnits.map(troop => {
          const level     = upgrades[troop.name] || 1;
          const upgraded  = getUpgradedTroop(troop);
          const maxed     = level >= MAX_UPGRADE_LEVEL;
          const cost      = upgradeGemCost(level);
          const canAfford = gems >= cost;

          return (
            <div
              key={troop.name}
              className={`rounded-xl border p-3 flex flex-col gap-2 transition-all
                ${level > 1 ? "bg-indigo-950/25 border-indigo-800/50" : "bg-zinc-800/40 border-zinc-700/50"}`}
            >
              {/* Name + level */}
              <div className="flex items-start gap-2">
                <span className="text-2xl leading-none mt-0.5">{troop.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-xs font-bold">{troop.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold
                      ${maxed ? "bg-yellow-800/80 text-yellow-300" : "bg-zinc-700 text-zinc-300"}`}>
                      Lv.{level}
                    </span>
                    {troop.oilPerMove > 0 && (
                      <span className="text-[9px] text-amber-400">🛢️{troop.oilPerMove}/move</span>
                    )}
                  </div>
                  <p className="text-zinc-500 text-[10px] mt-0.5 leading-snug">{troop.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-purple-400 text-[10px] font-bold">💜{troop.manaCost}</div>
                  <div className="text-zinc-600 text-[9px]">deploy cost</div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-2 text-[10px] flex-wrap">
                {upgraded.maxHp > 0    && <span className="text-zinc-300">❤️ {upgraded.maxHp}{level > 1 ? <span className="text-green-400"> ↑</span> : ""}</span>}
                {upgraded.atk > 0      && <span className="text-zinc-300">⚔️ {upgraded.atk}{level > 1 ? <span className="text-green-400"> ↑</span> : ""}</span>}
                {troop.atkRange > 0    && <span className="text-zinc-400">🎯 {troop.atkRange}</span>}
                {troop.mov > 0         && <span className="text-zinc-400">👟 {troop.mov}</span>}
              </div>

              {/* Upgrade progress bar */}
              <div className="h-1 bg-zinc-700/80 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${maxed ? "bg-yellow-400" : "bg-cyan-500"}`}
                  style={{ width: `${(level / MAX_UPGRADE_LEVEL) * 100}%` }}
                />
              </div>

              {/* Upgrade button */}
              <button
                onClick={() => upgradeUnit(troop.name)}
                disabled={maxed}
                className={`w-full text-[11px] font-semibold rounded-lg py-1.5 transition-all active:scale-95
                  ${maxed
                    ? "bg-yellow-900/30 text-yellow-600 cursor-default"
                    : canAfford
                      ? "bg-cyan-700 hover:bg-cyan-600 text-white"
                      : "bg-zinc-700/40 text-zinc-600 cursor-not-allowed"}`}
              >
                {maxed ? "✓ MAX LEVEL" : `⬆ Upgrade — 💎${cost} gems (+15% stats)`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`absolute bottom-3 left-3 right-3 z-50 px-4 py-2 rounded-xl text-xs font-semibold text-center shadow-xl
          ${toast.type === "success" ? "bg-green-800 text-green-200 border border-green-600" :
            toast.type === "error"   ? "bg-red-900 text-red-200 border border-red-700" :
                                       "bg-zinc-700 text-zinc-200 border border-zinc-600"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
