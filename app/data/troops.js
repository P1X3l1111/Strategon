// Shared unit/resource data

export const STARTING_MANA       = 100;
export const STARTING_OIL        = 50;
export const STARTING_GEMS       = 50;
export const MAX_SQUAD_SLOTS      = 5;
export const MAX_UPGRADE_LEVEL    = 5;
export const FACTORY_MANA_PER_WIN = 60;
export const OIL_PUMP_OIL_PER_WIN = 30;
export const BASE_MANA_PER_WIN    = 50;
export const BASE_GEMS_PER_WIN    = 5;

export const TROOP_ROSTER = [
  // ── Infantry ─────────────────────────────────────────────────────────────
  { name: "Light Infantry",     category: "Infantry",  icon: "🪖",  manaCost: 50,   maxHp: 30,  atk: 8,  mov: 3, atkRange: 1, oilPerMove: 0, desc: "Basic and cheap. Ignores terrain movement penalties." },
  { name: "Assault Infantry",   category: "Infantry",  icon: "💂",  manaCost: 60,   maxHp: 35,  atk: 10, mov: 3, atkRange: 1, oilPerMove: 0, desc: "Upgraded light infantry with landmine resistance." },
  { name: "Motorized Infantry", category: "Infantry",  icon: "🚛",  manaCost: 80,   maxHp: 32,  atk: 9,  mov: 5, atkRange: 1, oilPerMove: 1, desc: "Faster truck-mounted troops. Consumes oil to move." },
  { name: "Commandos",          category: "Infantry",  icon: "🎖️", manaCost: 100,  maxHp: 45,  atk: 16, mov: 4, atkRange: 2, oilPerMove: 0, desc: "Highly powerful, unstackable elite units." },
  // ── Armored ──────────────────────────────────────────────────────────────
  { name: "Armored Car",  category: "Armored",   icon: "🚗",  manaCost: 150,  maxHp: 50,  atk: 12, mov: 5, atkRange: 1, oilPerMove: 2, desc: "Fast armored vehicle." },
  { name: "Light Tank",   category: "Armored",   icon: "🛡️", manaCost: 180,  maxHp: 70,  atk: 15, mov: 3, atkRange: 2, oilPerMove: 2, desc: "Low cost early-game armor." },
  { name: "Heavy Tank",   category: "Armored",   icon: "🦾",  manaCost: 200,  maxHp: 100, atk: 22, mov: 2, atkRange: 2, oilPerMove: 3, desc: "High firepower and durability." },
  { name: "Armored Tank", category: "Armored",   icon: "🚂",  manaCost: 2500, maxHp: 200, atk: 45, mov: 2, atkRange: 3, oilPerMove: 5, desc: "Massive firepower and armor. Extremely expensive." },
  // ── Artillery ────────────────────────────────────────────────────────────
  { name: "Field Artillery",  category: "Artillery", icon: "💥",  manaCost: 140, maxHp: 28, atk: 18, mov: 2, atkRange: 4, oilPerMove: 1, desc: "Basic ranged unit for early campaigns." },
  { name: "Howitzer",         category: "Artillery", icon: "🔫",  manaCost: 170, maxHp: 32, atk: 22, mov: 1, atkRange: 5, oilPerMove: 1, desc: "Standard long-range fire support." },
  { name: "Rocket Artillery", category: "Artillery", icon: "🚀",  manaCost: 220, maxHp: 35, atk: 28, mov: 2, atkRange: 5, oilPerMove: 2, desc: "High damage, area of effect." },
  // ── Other ─────────────────────────────────────────────────────────────────
  { name: "Landmine",  category: "Other", icon: "💣",  manaCost: 30,  maxHp: 5,   atk: 25, mov: 0, atkRange: 0, oilPerMove: 0, desc: "Placed on the battlefield. Detonates when an enemy steps on it." },
  { name: "Factory",   category: "Other", icon: "🏭",  manaCost: 100, maxHp: 80,  atk: 0,  mov: 0, atkRange: 0, oilPerMove: 0, desc: `Passive structure. Earns +${FACTORY_MANA_PER_WIN} mana after each battle win.` },
  { name: "Oil Pump",  category: "Other", icon: "🛢️", manaCost: 150, maxHp: 60,  atk: 0,  mov: 0, atkRange: 0, oilPerMove: 0, desc: `Passive structure. Earns +${OIL_PUMP_OIL_PER_WIN} oil after each battle win.` },
  { name: "Barricade", category: "Other", icon: "🚧",  manaCost: 120, maxHp: 150, atk: 0,  mov: 0, atkRange: 0, oilPerMove: 0, desc: "High health, high durability defensive barrier." },
];

// ── Upgrade system ────────────────────────────────────────────────────────────
export function upgradeGemCost(currentLevel) { return currentLevel * 20; }

export function getUpgrades() {
  if (typeof window === "undefined") return {};
  const u = localStorage.getItem("rpg_username");
  if (!u) return {};
  try { return JSON.parse(localStorage.getItem(`rpg_upgrades_${u}`) || "{}"); }
  catch { return {}; }
}

export function saveUpgrades(upgrades) {
  const u = localStorage.getItem("rpg_username");
  if (!u) return;
  localStorage.setItem(`rpg_upgrades_${u}`, JSON.stringify(upgrades));
}

export function getTroopLevel(name) {
  const upgrades = getUpgrades();
  return upgrades[name] || 1;
}

export function getUpgradedTroop(troop) {
  const level = getTroopLevel(troop.name);
  const mult  = 1 + (level - 1) * 0.15;
  return {
    ...troop,
    maxHp: Math.round(troop.maxHp * mult),
    atk:   troop.atk > 0 ? Math.round(troop.atk * mult) : 0,
    level,
  };
}

// ── Mana ──────────────────────────────────────────────────────────────────────
export function getMana() {
  if (typeof window === "undefined") return STARTING_MANA;
  const u = localStorage.getItem("rpg_username");
  if (!u) return 0;
  const raw = localStorage.getItem(`rpg_mana_${u}`);
  return raw !== null ? (parseInt(raw) || 0) : STARTING_MANA;
}

export function spendMana(amount) {
  if (typeof window === "undefined") return false;
  const u = localStorage.getItem("rpg_username");
  if (!u) return false;
  const cur = parseInt(localStorage.getItem(`rpg_mana_${u}`) ?? String(STARTING_MANA));
  if (cur < amount) return false;
  localStorage.setItem(`rpg_mana_${u}`, String(cur - amount));
  window.dispatchEvent(new CustomEvent("rpg_currency_updated"));
  return true;
}

export function awardMana(amount) {
  if (typeof window === "undefined") return;
  const u = localStorage.getItem("rpg_username");
  if (!u) return;
  const cur = parseInt(localStorage.getItem(`rpg_mana_${u}`) ?? String(STARTING_MANA));
  localStorage.setItem(`rpg_mana_${u}`, String(cur + amount));
  window.dispatchEvent(new CustomEvent("rpg_currency_updated"));
}

// ── Gems ──────────────────────────────────────────────────────────────────────
export function getGems() {
  if (typeof window === "undefined") return STARTING_GEMS;
  const u = localStorage.getItem("rpg_username");
  if (!u) return 0;
  const raw = localStorage.getItem(`rpg_gems_${u}`);
  return raw !== null ? (parseInt(raw) || 0) : STARTING_GEMS;
}

export function spendGems(amount) {
  if (typeof window === "undefined") return false;
  const u = localStorage.getItem("rpg_username");
  if (!u) return false;
  const cur = parseInt(localStorage.getItem(`rpg_gems_${u}`) ?? String(STARTING_GEMS));
  if (cur < amount) return false;
  localStorage.setItem(`rpg_gems_${u}`, String(cur - amount));
  window.dispatchEvent(new CustomEvent("rpg_currency_updated"));
  return true;
}

export function awardGems(amount) {
  if (typeof window === "undefined") return;
  const u = localStorage.getItem("rpg_username");
  if (!u) return;
  const cur = parseInt(localStorage.getItem(`rpg_gems_${u}`) ?? String(STARTING_GEMS));
  localStorage.setItem(`rpg_gems_${u}`, String(cur + amount));
  window.dispatchEvent(new CustomEvent("rpg_currency_updated"));
}

// ── Oil ───────────────────────────────────────────────────────────────────────
export function getOil() {
  if (typeof window === "undefined") return STARTING_OIL;
  const u = localStorage.getItem("rpg_username");
  if (!u) return 0;
  const raw = localStorage.getItem(`rpg_oil_${u}`);
  return raw !== null ? (parseInt(raw) || 0) : STARTING_OIL;
}

export function spendOil(amount) {
  if (typeof window === "undefined") return false;
  const u = localStorage.getItem("rpg_username");
  if (!u) return false;
  const cur = parseInt(localStorage.getItem(`rpg_oil_${u}`) ?? String(STARTING_OIL));
  if (cur < amount) return false;
  localStorage.setItem(`rpg_oil_${u}`, String(cur - amount));
  window.dispatchEvent(new CustomEvent("rpg_currency_updated"));
  return true;
}

export function awardOil(amount) {
  if (typeof window === "undefined") return;
  const u = localStorage.getItem("rpg_username");
  if (!u) return;
  const cur = parseInt(localStorage.getItem(`rpg_oil_${u}`) ?? String(STARTING_OIL));
  localStorage.setItem(`rpg_oil_${u}`, String(cur + amount));
  window.dispatchEvent(new CustomEvent("rpg_currency_updated"));
}

// ── Backward compat ───────────────────────────────────────────────────────────
export function awardCoins(amount) { awardMana(amount); }
export function getCoins()         { return getMana(); }
export const LEVEL_REWARDS         = [];
export const STARTING_COINS        = STARTING_MANA;

// ── Post-battle reward helper ─────────────────────────────────────────────────
export function awardPostBattle(baseMana, baseGems = BASE_GEMS_PER_WIN) {
  awardMana(baseMana);
  awardGems(baseGems);
  window.dispatchEvent(new CustomEvent("rpg_currency_updated"));
  return { mana: baseMana, gems: baseGems };
}
