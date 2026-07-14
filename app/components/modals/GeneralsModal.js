"use client";

import { useState, useEffect } from "react";
import { Star, Coins, Gem, X, Medal, Lock, ArrowUp } from "lucide-react";
import {
  BUFFS, MAX_GENERAL_LEVEL, MAX_BUFF_SLOTS, MAX_BATTLE_SLOTS,
  getAllGenerals, getGeneralProgress, getUpgradeCost, getSlotCost,
  upgradeGeneral, buyGeneralSlot, buyGeneralBuff, buyCommander,
  getBattleSlotCount, getBattleSlotCost, buyBattleSlot,
} from "../../data/generals";
import { getCoins, getGems } from "../../data/troops";

export default function GeneralsModal({ open, onClose }) {
  const [coins, setCoins] = useState(0);
  const [gems, setGems] = useState(0);
  const [progress, setProgress] = useState({});
  const [battleSlots, setBattleSlots] = useState(1);
  const [toast, setToast] = useState(null);
  const [pickingFor, setPickingFor] = useState(null); // generalId currently choosing a buff
  const [allGenerals, setAllGenerals] = useState([]);

  function refresh() {
    setCoins(getCoins());
    setGems(getGems());
    setBattleSlots(getBattleSlotCount());
    const generals = getAllGenerals();
    setAllGenerals(generals);
    const p = {};
    generals.forEach(g => { p[g.id] = getGeneralProgress(g.id); });
    setProgress(p);
  }

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("rpg_currency_updated", onUpdate);
    window.addEventListener("rpg_generals_updated", onUpdate);
    window.addEventListener("rpg_admin_generals_updated", onUpdate);
    return () => {
      window.removeEventListener("rpg_currency_updated", onUpdate);
      window.removeEventListener("rpg_generals_updated", onUpdate);
      window.removeEventListener("rpg_admin_generals_updated", onUpdate);
    };
  }, []);

  function flash(msg) { setToast(msg); setTimeout(() => setToast(null), 2200); }

  function handleBuyCommander(g) {
    if (gems < g.price) { flash(`Need ${g.price} gems to unlock ${g.name}.`); return; }
    if (buyCommander(g.id)) flash(`${g.name} unlocked!`);
  }

  function handleBuyBattleSlot() {
    if (battleSlots >= MAX_BATTLE_SLOTS) return;
    const cost = getBattleSlotCost(battleSlots + 1);
    if (gems < cost) { flash(`Need ${cost} gems for battle slot ${battleSlots + 1}.`); return; }
    if (buyBattleSlot()) flash(`Battle slot ${battleSlots + 1} unlocked — bring more commanders into one battle!`);
  }

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

  const ownedCount = Object.values(progress).filter(p => p.owned).length;

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
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Star size={18}/> Commanders</h2>
          <div className="flex items-center gap-3">
            <span className="text-yellow-400 text-sm font-bold flex items-center gap-1"><Coins size={15}/> {coins.toLocaleString()}</span>
            <span className="text-cyan-400 text-sm font-bold flex items-center gap-1"><Gem size={15}/> {gems.toLocaleString()}</span>
            <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800"><X size={16}/></button>
          </div>
        </div>

        {toast && (
          <div className="mx-6 mt-3 bg-amber-950/60 border border-amber-700 text-amber-300 text-xs font-bold rounded-lg px-3 py-1.5 text-center shrink-0">
            {toast}
          </div>
        )}

        {/* Battle slots — account-wide cap on commanders per battle */}
        <div className="mx-6 mt-4 p-3 rounded-xl border border-indigo-800 bg-indigo-950/30 flex items-center justify-between gap-3 shrink-0">
          <div>
            <p className="text-white text-sm font-bold flex items-center gap-1.5"><Medal size={15}/> Battle Slots — {battleSlots}/{MAX_BATTLE_SLOTS}</p>
            <p className="text-zinc-400 text-[11px]">How many different commanders you can lead troops with in one battle.</p>
          </div>
          <button
            onClick={handleBuyBattleSlot}
            disabled={battleSlots >= MAX_BATTLE_SLOTS || gems < getBattleSlotCost(battleSlots + 1)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              battleSlots >= MAX_BATTLE_SLOTS ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              : gems < getBattleSlotCost(battleSlots + 1) ? "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95"
            }`}
          >
            {battleSlots >= MAX_BATTLE_SLOTS ? "MAX" : <span className="flex items-center gap-1">+1 Slot — <Gem size={12}/>{getBattleSlotCost(battleSlots + 1)}</span>}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <p className="text-zinc-500 text-xs mb-4">
            Own {ownedCount}/{allGenerals.length} commanders. Level up owned commanders with coins for stronger boosts, and spend gems on buff slots (max {MAX_BUFF_SLOTS}) plus the buffs that fill them.
          </p>
          <div className="flex flex-col gap-4">
            {allGenerals.map((g) => {
              const prog = progress[g.id] || { owned: g.price === 0, level: 0, slots: 1, buffs: [] };

              if (!prog.owned) {
                return (
                  <div key={g.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 flex items-center gap-3">
                    <span className="text-zinc-600"><g.icon size={28}/></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-300 font-black text-sm flex items-center gap-1.5"><Lock size={12}/> {g.name}</p>
                      <p className="text-zinc-500 text-xs">{g.desc}</p>
                    </div>
                    <button
                      onClick={() => handleBuyCommander(g)}
                      disabled={gems < g.price}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        gems < g.price ? "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed"
                        : "bg-cyan-600 hover:bg-cyan-500 text-white active:scale-95"
                      }`}
                    >
                      Buy — <Gem size={12}/>{g.price}
                    </button>
                  </div>
                );
              }

              const maxed = prog.level >= MAX_GENERAL_LEVEL;
              const upgradeCost = getUpgradeCost(prog.level);
              const equippedBuffs = prog.buffs.map(id => BUFFS.find(b => b.id === id)).filter(Boolean);
              const availableBuffs = BUFFS.filter(b => !prog.buffs.includes(b.id));

              return (
                <div key={g.id} className="rounded-xl border p-4 flex flex-col gap-3" style={{ borderColor: `${g.color}55`, background: `${g.color}0d` }}>
                  {/* Header row */}
                  <div className="flex items-center gap-3">
                    <span style={{ color: g.color }}><g.icon size={28}/></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-sm" style={{ color: g.color }}>{g.name} <span className="text-zinc-400 font-semibold">· Lv.{prog.level}/{MAX_GENERAL_LEVEL}</span></p>
                      <p className="text-zinc-400 text-xs">{g.desc}</p>
                    </div>
                    <button
                      onClick={() => handleUpgrade(g)}
                      disabled={maxed || coins < upgradeCost}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        maxed ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                        : coins < upgradeCost ? "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed"
                        : "bg-yellow-600 hover:bg-yellow-500 text-white active:scale-95"
                      }`}
                    >
                      {maxed ? "MAX LEVEL" : <><ArrowUp size={12}/> Upgrade — <Coins size={12}/>{upgradeCost}</>}
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
                            <buff.icon size={12}/>
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
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                            gems < slotCost ? "border-zinc-800 text-zinc-600 cursor-not-allowed" : "border-cyan-800 text-cyan-300 hover:bg-cyan-950"
                          }`}>
                          <Lock size={10}/> Slot {slotNum} — <Gem size={10}/>{slotCost}
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
                          <span className="text-xs font-semibold flex items-center gap-1.5"><buff.icon size={13}/> {buff.name}<span className="text-zinc-400 font-normal">— {buff.desc}</span></span>
                          <span className="text-cyan-300 text-xs font-bold shrink-0 flex items-center gap-0.5"><Gem size={11}/>{buff.cost}</span>
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
