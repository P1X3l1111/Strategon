import { spendCoins, spendGems } from "./troops";

// Generals — optional hero boosts. Each battle you may assign exactly one
// general to exactly one of your troops; the assignment is permanent for the
// rest of that battle (no reassigning, no swapping to a different unit).
//
// Outside of battle, generals are a persistent meta-progression: coins level
// them up (stronger base boosts) and gems buy buff slots + buffs (small extra
// stat bonuses layered on top).

export const GENERALS = [
  { id: "iron",     name: "Iron Commander",     icon: "🛡️", color: "#94a3b8", desc: "+50% max HP",                       boosts: { hpMult: 1.5 } },
  { id: "blitz",    name: "Blitz Commander",    icon: "⚡",  color: "#0ea5e9", desc: "+3 movement",                       boosts: { movAdd: 3 } },
  { id: "marksman", name: "Marksman Commander", icon: "🎯", color: "#ef4444", desc: "+50% attack damage",                boosts: { atkMult: 1.5 } },
  { id: "guardian", name: "Guardian Commander", icon: "🏰", color: "#22c55e", desc: "+2 attack range",                   boosts: { rangeAdd: 2 } },
  { id: "warlord",  name: "Warlord",            icon: "👑", color: "#f59e0b", desc: "+25% HP and +25% attack damage",    boosts: { hpMult: 1.25, atkMult: 1.25 } },
];

// ── Buffs — small extra boosts bought with gems and slotted onto a general ──
export const BUFFS = [
  { id: "vitality",   name: "Vitality Buff",   icon: "❤️", desc: "+15% max HP",                cost: 40, boosts: { hpMult: 1.15 } },
  { id: "ferocity",   name: "Ferocity Buff",   icon: "🔥", desc: "+15% attack damage",         cost: 40, boosts: { atkMult: 1.15 } },
  { id: "swift",      name: "Swift Buff",      icon: "🥾", desc: "+1 movement",                cost: 35, boosts: { movAdd: 1 } },
  { id: "eagle-eye",  name: "Eagle Eye Buff",  icon: "🦅", desc: "+1 attack range",            cost: 35, boosts: { rangeAdd: 1 } },
  { id: "juggernaut", name: "Juggernaut Buff", icon: "💪", desc: "+10% HP and +10% attack",    cost: 60, boosts: { hpMult: 1.1, atkMult: 1.1 } },
];

export const MAX_GENERAL_LEVEL = 5;
export const MAX_BUFF_SLOTS    = 3;
export const LEVEL_POWER_STEP  = 0.15; // each level makes the general's own boosts 15% stronger

// Coins needed to go from `level` to `level+1`.
export function getUpgradeCost(level) {
  return 150 * (level + 1);
}

// Gems needed to unlock buff slot number `slotNumber` (2 or 3 — slot 1 is free).
export function getSlotCost(slotNumber) {
  return slotNumber === 2 ? 80 : 150;
}

// ── Persistence ──────────────────────────────────────────────────────────────
function currentUser() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rpg_username");
}

function storageKey(u) { return `rpg_generals_${u}`; }

function defaultProgress() { return { level: 0, slots: 1, buffs: [] }; }

export function loadGeneralsProgress() {
  const u = currentUser();
  if (!u) return {};
  try { return JSON.parse(localStorage.getItem(storageKey(u)) || "{}"); }
  catch { return {}; }
}

function saveGeneralsProgress(all) {
  const u = currentUser();
  if (!u) return;
  localStorage.setItem(storageKey(u), JSON.stringify(all));
  window.dispatchEvent(new CustomEvent("rpg_generals_updated"));
}

export function getGeneralProgress(generalId) {
  const all = loadGeneralsProgress();
  return { ...defaultProgress(), ...(all[generalId] || {}) };
}

export function upgradeGeneral(generalId) {
  const all = loadGeneralsProgress();
  const prog = { ...defaultProgress(), ...(all[generalId] || {}) };
  if (prog.level >= MAX_GENERAL_LEVEL) return false;
  const cost = getUpgradeCost(prog.level);
  if (!spendCoins(cost)) return false;
  all[generalId] = { ...prog, level: prog.level + 1 };
  saveGeneralsProgress(all);
  return true;
}

export function buyGeneralSlot(generalId) {
  const all = loadGeneralsProgress();
  const prog = { ...defaultProgress(), ...(all[generalId] || {}) };
  if (prog.slots >= MAX_BUFF_SLOTS) return false;
  const cost = getSlotCost(prog.slots + 1);
  if (!spendGems(cost)) return false;
  all[generalId] = { ...prog, slots: prog.slots + 1 };
  saveGeneralsProgress(all);
  return true;
}

export function buyGeneralBuff(generalId, buffId) {
  const buff = BUFFS.find(b => b.id === buffId);
  if (!buff) return false;
  const all = loadGeneralsProgress();
  const prog = { ...defaultProgress(), ...(all[generalId] || {}) };
  if (prog.buffs.includes(buffId)) return false;
  if (prog.buffs.length >= prog.slots) return false;
  if (!spendGems(buff.cost)) return false;
  all[generalId] = { ...prog, buffs: [...prog.buffs, buffId] };
  saveGeneralsProgress(all);
  return true;
}

// Merges a general's base boosts with its level bonus and equipped buffs into one
// resolved boosts object, ready to hand to applyGeneralBoost.
export function getEffectiveGeneral(generalId) {
  const base = GENERALS.find(g => g.id === generalId);
  if (!base) return null;
  const prog = getGeneralProgress(generalId);
  const power = 1 + prog.level * LEVEL_POWER_STEP;

  let hpMult = 1 + ((base.boosts.hpMult || 1) - 1) * power;
  let atkMult = 1 + ((base.boosts.atkMult || 1) - 1) * power;
  let movAdd = (base.boosts.movAdd || 0) * power;
  let rangeAdd = (base.boosts.rangeAdd || 0) * power;

  for (const buffId of prog.buffs) {
    const buff = BUFFS.find(b => b.id === buffId);
    if (!buff) continue;
    hpMult *= (buff.boosts.hpMult || 1);
    atkMult *= (buff.boosts.atkMult || 1);
    movAdd += (buff.boosts.movAdd || 0);
    rangeAdd += (buff.boosts.rangeAdd || 0);
  }

  return {
    ...base,
    level: prog.level,
    slots: prog.slots,
    equippedBuffs: prog.buffs,
    boosts: { hpMult, atkMult, movAdd, rangeAdd },
  };
}

// Applies a general's stat boosts to a unit, returning a new unit object.
export function applyGeneralBoost(unit, general) {
  const b = general.boosts;
  const hpMult = b.hpMult || 1;
  return {
    ...unit,
    maxHp: Math.round(unit.maxHp * hpMult),
    hp:    Math.round(unit.hp    * hpMult),
    atk:   Math.round(unit.atk   * (b.atkMult || 1)),
    mov:   unit.mov   + Math.round(b.movAdd   || 0),
    range: unit.range + Math.round(b.rangeAdd || 0),
    general: general.id,
  };
}
