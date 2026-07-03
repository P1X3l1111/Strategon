"use client";

import { useState, useEffect } from "react";
import {
  GENERALS, BUFFS, MAX_GENERAL_LEVEL, MAX_BUFF_SLOTS,
  getGeneralProgress, getUpgradeCost, getSlotCost,
  upgradeGeneral, buyGeneralSlot, buyGeneralBuff,
} from "../../data/generals";
import { getCoins, getGems } from "../../data/troops";

export default function GeneralsModal({ onClose }) {
  const [coins, setCoins] = useState(0);
  const [gems, setGems] = useState(0);
  const [progress, setProgress] = useState({});
  const [toast, setToast] = useState(null);
  const [pickingFor, setPickingFor] = useState(null); // generalId currently choosing a buff

  function refresh() {
    setCoins(getCoins());
    setGems(getGems());
    const p = {};
    GENERALS.forEach(g => { p[g.id] = getGeneralProgress(g.id); });
    setProgress(p);
  }

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("rpg_currency_updated", onUpdate);
    window.addEventListener("rpg_generals_updated", onUpdate);
    return () => {
      window.removeEventListener("rpg_currency_updated", onUpdate);
      window.removeEventListener("rpg_generals_updated", onUpdate);
    };
  }, []);

  function flash(msg) { setToast(msg); setTimeout(() => setToast(null), 2200); }

  function handleUpgrade(g) {
    const prog = progress[g.id];
    if (!prog || prog.level >= MAX_GENERAL_LEVEL) return;
    const cost = getUpgradeCost(prog.level);
    if (coins < cost) { flash(`Need ${cost} coins to level up ${g.name}.`); return; }
    if (upgradeGeneral(g.id)) flash(`${g.name} is now level ${prog.level + 1}!`);
  }

  function handleBuySlot(g) {
    const prog = progress[g.id];
    if (!prog || prog.slots >= MAX_BUFF_SLOTS) return;
    const cost = getSlotCost(prog.slots + 1);
    if (gems < cost) { flash(`Need ${cost} gems to unlock that slot.`); return; }
    if (buyGeneralSlot(g.id)) flash(`Unlocked buff slot ${prog.slots + 1} for ${g.name}!`);
  }

  function handleEquipBuff(g, buff) {
    if (gems < buff.cost) { flash(`Need ${buff.cost} gems for ${buff.name}.`); return; }
    if (buyGeneralBuff(g.id, buff.id)) { flash(`${buff.name} equipped on ${g.name}!`); setPickingFor(null); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-xl font-bold text-white">⭐ Generals</h2>
          <div className="flex items-center gap-3">
            <span className="text-yellow-400 text-sm font-bold">💰 {coins.toLocaleString()}</span>
            <span className="text-cyan-400 text-sm font-bold">💎 {gems.toLocaleString()}</span>
            <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800">✕</button>
          </div>
        </div>

        {toast && (
          <div className="mx-6 mt-3 bg-amber-950/60 border border-amber-700 text-amber-300 text-xs font-bold rounded-lg px-3 py-1.5 text-center shrink-0">
            {toast}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <p className="text-zinc-500 text-xs mb-4">
            Level up generals with coins for stronger boosts, and spend gems on buff slots (max {MAX_BUFF_SLOTS}) plus the buffs that fill them.
          </p>
          <div className="flex flex-col gap-4">
            {GENERALS.map((g) => {
              const prog = progress[g.id] || { level: 0, slots: 1, buffs: [] };
              const maxed = prog.level >= MAX_GENERAL_LEVEL;
              const upgradeCost = getUpgradeCost(prog.level);
              const equippedBuffs = prog.buffs.map(id => BUFFS.find(b => b.id === id)).filter(Boolean);
              const availableBuffs = BUFFS.filter(b => !prog.buffs.includes(b.id));

              return (
                <div key={g.id} className="rounded-xl border p-4 flex flex-col gap-3" style={{ borderColor: `${g.color}55`, background: `${g.color}0d` }}>
                  {/* Header row */}
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{g.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-sm" style={{ color: g.color }}>{g.name} <span className="text-zinc-400 font-semibold">· Lv.{prog.level}/{MAX_GENERAL_LEVEL}</span></p>
                      <p className="text-zinc-400 text-xs">{g.desc}</p>
                    </div>
                    <button
                      onClick={() => handleUpgrade(g)}
                      disabled={maxed || coins < upgradeCost}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        maxed ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                        : coins < upgradeCost ? "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed"
                        : "bg-yellow-600 hover:bg-yellow-500 text-white active:scale-95"
                      }`}
                    >
                      {maxed ? "MAX LEVEL" : `⬆ Upgrade — 💰${upgradeCost}`}
                    </button>
                  </div>

                  {/* Buff slots */}
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: MAX_BUFF_SLOTS }).map((_, i) => {
                      const slotNum = i + 1;
                      if (slotNum <= prog.slots) {
                        const buff = equippedBuffs[i];
                        return buff ? (
                          <div key={i} title={buff.desc} className="flex items-center gap-1.5 bg-zinc-800/80 border border-zinc-700 rounded-lg px-2 py-1">
                            <span>{buff.icon}</span>
                            <span className="text-zinc-300 text-[10px] font-semibold">{buff.name}</span>
                          </div>
                        ) : (
                          <button key={i} onClick={() => setPickingFor(pickingFor === g.id ? null : g.id)}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg border border-dashed border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-400 transition-all">
                            + Equip Buff
                          </button>
                        );
                      }
                      const slotCost = getSlotCost(slotNum);
                      return (
                        <button key={i} onClick={() => handleBuySlot(g)} disabled={gems < slotCost}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                            gems < slotCost ? "border-zinc-800 text-zinc-600 cursor-not-allowed" : "border-cyan-800 text-cyan-300 hover:bg-cyan-950"
                          }`}>
                          🔒 Slot {slotNum} — 💎{slotCost}
                        </button>
                      );
                    })}
                  </div>

                  {/* Buff picker */}
                  {pickingFor === g.id && (
                    <div className="rounded-lg border border-zinc-700 bg-zinc-950/60 p-2 flex flex-col gap-1.5">
                      {availableBuffs.length === 0 && <p className="text-zinc-500 text-[10px] px-1">All buffs already equipped.</p>}
                      {availableBuffs.map(buff => (
                        <button key={buff.id} onClick={() => handleEquipBuff(g, buff)} disabled={gems < buff.cost}
                          className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left transition-all ${
                            gems < buff.cost ? "bg-zinc-900 text-zinc-600 cursor-not-allowed" : "bg-zinc-800 hover:bg-zinc-700 text-white"
                          }`}>
                          <span className="text-xs font-semibold flex items-center gap-1.5">{buff.icon} {buff.name}<span className="text-zinc-400 font-normal">— {buff.desc}</span></span>
                          <span className="text-cyan-300 text-xs font-bold shrink-0">💎{buff.cost}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
