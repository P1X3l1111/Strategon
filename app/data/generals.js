import { Shield, Zap, Target, Castle, Crown, Heart, Flame, Footprints, Eye, Dumbbell } from "lucide-react";
import { spendCoins, spendGems } from "./troops";

// Generals — optional hero boosts, each ownable and independently upgradable.
// Owning a commander (gems, one-time) is separate from battle slots (gems,
// account-wide): battle slots cap how many *different* commanders you can
// assign to troops in a single battle — one commander per troop, and once
// assigned to a troop that assignment is permanent for the rest of the battle.
//
// Outside of battle, owned generals are a persistent meta-progression: coins
// level them up (stronger base boosts) and gems buy buff slots + buffs (small
// extra stat bonuses layered on top).

export const GENERALS = [
  { id: "iron",     name: "Iron Commander",     icon: Shield, color: "#94a3b8", desc: "+50% max HP",                       boosts: { hpMult: 1.5 },  price: 0   },
  { id: "blitz",    name: "Blitz Commander",    icon: Zap,    color: "#0ea5e9", desc: "+3 movement",                       boosts: { movAdd: 3 },    price: 100 },
  { id: "marksman", name: "Marksman Commander", icon: Target, color: "#ef4444", desc: "+50% attack damage",                boosts: { atkMult: 1.5 }, price: 120 },
  { id: "guardian", name: "Guardian Commander", icon: Castle, color: "#22c55e", desc: "+2 attack range",                   boosts: { rangeAdd: 2 },  price: 120 },
  { id: "warlord",  name: "Warlord",            icon: Crown,  color: "#f59e0b", desc: "+25% HP and +25% attack damage",    boosts: { hpMult: 1.25, atkMult: 1.25 }, price: 200 },
];
// Iron Commander is free so a new account has at least one usable commander.

// ── Buffs — small extra boosts bought with gems and slotted onto a general ──
export const BUFFS = [
  { id: "vitality",   name: "Vitality Buff",   icon: Heart,      desc: "+15% max HP",                cost: 40, boosts: { hpMult: 1.15 } },
  { id: "ferocity",   name: "Ferocity Buff",   icon: Flame,      desc: "+15% attack damage",         cost: 40, boosts: { atkMult: 1.15 } },
  { id: "swift",      name: "Swift Buff",      icon: Footprints, desc: "+1 movement",                cost: 35, boosts: { movAdd: 1 } },
  { id: "eagle-eye",  name: "Eagle Eye Buff",  icon: Eye,        desc: "+1 attack range",            cost: 35, boosts: { rangeAdd: 1 } },
  { id: "juggernaut", name: "Juggernaut Buff", icon: Dumbbell,   desc: "+10% HP and +10% attack",    cost: 60, boosts: { hpMult: 1.1, atkMult: 1.1 } },
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

function defaultProgress(generalId) {
  const base = GENERALS.find(g => g.id === generalId);
  return { owned: !!base && base.price === 0, level: 0, slots: 1, buffs: [] };
}

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
  return { ...defaultProgress(generalId), ...(all[generalId] || {}) };
}

export function isCommanderOwned(generalId) {
  return getGeneralProgress(generalId).owned;
}

// One-time gem purchase that unlocks a commander for use/upgrades.
export function buyCommander(generalId) {
  const base = GENERALS.find(g => g.id === generalId);
  if (!base) return false;
  const all = loadGeneralsProgress();
  const prog = { ...defaultProgress(generalId), ...(all[generalId] || {}) };
  if (prog.owned) return false;
  if (!spendGems(base.price)) return false;
  all[generalId] = { ...prog, owned: true };
  saveGeneralsProgress(all);
  return true;
}

export function upgradeGeneral(generalId) {
  const all = loadGeneralsProgress();
  const prog = { ...defaultProgress(generalId), ...(all[generalId] || {}) };
  if (!prog.owned || prog.level >= MAX_GENERAL_LEVEL) return false;
  const cost = getUpgradeCost(prog.level);
  if (!spendCoins(cost)) return false;
  all[generalId] = { ...prog, level: prog.level + 1 };
  saveGeneralsProgress(all);
  return true;
}

export function buyGeneralSlot(generalId) {
  const all = loadGeneralsProgress();
  const prog = { ...defaultProgress(generalId), ...(all[generalId] || {}) };
  if (!prog.owned || prog.slots >= MAX_BUFF_SLOTS) return false;
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
  const prog = { ...defaultProgress(generalId), ...(all[generalId] || {}) };
  if (!prog.owned || prog.buffs.includes(buffId)) return false;
  if (prog.buffs.length >= prog.slots) return false;
  if (!spendGems(buff.cost)) return false;
  all[generalId] = { ...prog, buffs: [...prog.buffs, buffId] };
  saveGeneralsProgress(all);
  return true;
}

// ── Battle slots — account-wide cap on how many *different* commanders can be
// assigned to troops in a single battle (separate from each commander's own
// buff slots above). Everyone starts with 1; up to MAX_BATTLE_SLOTS purchasable.
export const MAX_BATTLE_SLOTS = 3;

export function getBattleSlotCost(slotNumber) {
  return slotNumber === 2 ? 150 : 300;
}

const BATTLE_SLOTS_KEY = (u) => `rpg_commander_battle_slots_${u}`;

export function getBattleSlotCount() {
  const u = currentUser();
  if (!u) return 1;
  const raw = parseInt(localStorage.getItem(BATTLE_SLOTS_KEY(u)) ?? "1");
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

export function buyBattleSlot() {
  const u = currentUser();
  if (!u) return false;
  const current = getBattleSlotCount();
  if (current >= MAX_BATTLE_SLOTS) return false;
  const cost = getBattleSlotCost(current + 1);
  if (!spendGems(cost)) return false;
  localStorage.setItem(BATTLE_SLOTS_KEY(u), String(current + 1));
  window.dispatchEvent(new CustomEvent("rpg_generals_updated"));
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
