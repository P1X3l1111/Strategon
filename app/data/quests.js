// Daily quests, weekly quests, and the daily-login reward streak.
// Rewards pay out in coins/gems only — mana and oil are earned in battle, not from quests.
import { Trophy, Swords, User, Skull, Sparkles, Fuel, Factory, MousePointer2 } from "lucide-react";
import { awardCoins, awardGems } from "./troops";

const DAY_MS = 24 * 60 * 60 * 1000;

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekNumber(d = new Date()) { return Math.floor(d.getTime() / (7 * DAY_MS)); }

// A 4-week cycle: within a cycle, week N's quests stay visible when week N+1's
// are revealed (nothing disappears). Once week 4 passes, a new cycle begins —
// the whole pool reshuffles into fresh week-buckets and progress resets.
const CYCLE_EPOCH = Math.floor(new Date("2026-01-01T00:00:00Z").getTime() / (7 * DAY_MS));
function absoluteWeek(d = new Date()) { return weekNumber(d) - CYCLE_EPOCH; }
function cycleIndex(d = new Date())   { return Math.floor(absoluteWeek(d) / 4); }
function cycleKey(d = new Date())     { return String(cycleIndex(d)); }
// Which week (1-4) of the current cycle we're in.
export function getActiveWeekIndex(d = new Date()) {
  const w = absoluteWeek(d) % 4;
  return (w < 0 ? w + 4 : w) + 1;
}

function currentUser() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rpg_username");
}

// Deterministic per-user-per-day shuffle, so a user's daily quests stay put
// all day but differ from other users/days without needing server state.
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return function () {
    h = Math.imul(h ^ (h >>> 15), 1 | h);
    h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h;
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}
function pickN(pool, n, seed) {
  const rand = seededRandom(seed);
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

export const STAT_META = {
  battlesWon:        { icon: Trophy,        label: "battles won" },
  battlesPlayed:     { icon: Swords,        label: "battles played" },
  troopsDeployed:    { icon: User,          label: "troops deployed" },
  enemiesKilled:     { icon: Skull,         label: "enemies defeated" },
  manaEarned:        { icon: Sparkles,      label: "mana earned" },
  oilEarned:         { icon: Fuel,          label: "oil collected" },
  structuresBuilt:   { icon: Factory,       label: "structures built" },
  multiUnitCommands: { icon: MousePointer2, label: "group commands issued" },
};

// ── Daily quests — easy, 3 drawn from this pool each day ──────────────────────
const DAILY_POOL = [
  { id: "d_win1",    statKey: "battlesWon",        target: 1,   desc: "Win 1 battle",                rewardCoins: 40, rewardGems: 0  },
  { id: "d_win2",    statKey: "battlesWon",        target: 2,   desc: "Win 2 battles",                rewardCoins: 60, rewardGems: 0  },
  { id: "d_play1",   statKey: "battlesPlayed",     target: 1,   desc: "Play 1 battle",                rewardCoins: 15, rewardGems: 0  },
  { id: "d_deploy3", statKey: "troopsDeployed",    target: 3,   desc: "Deploy 3 troops",              rewardCoins: 30, rewardGems: 0  },
  { id: "d_deploy5", statKey: "troopsDeployed",    target: 5,   desc: "Deploy 5 troops",               rewardCoins: 45, rewardGems: 0  },
  { id: "d_kill5",   statKey: "enemiesKilled",     target: 5,   desc: "Defeat 5 enemies",             rewardCoins: 35, rewardGems: 0  },
  { id: "d_kill10",  statKey: "enemiesKilled",     target: 10,  desc: "Defeat 10 enemies",            rewardCoins: 50, rewardGems: 0  },
  { id: "d_build1",  statKey: "structuresBuilt",   target: 1,   desc: "Build 1 structure",            rewardCoins: 25, rewardGems: 0  },
  { id: "d_mana100", statKey: "manaEarned",        target: 100, desc: "Earn 100 mana",                rewardCoins: 0,  rewardGems: 10 },
  { id: "d_mana200", statKey: "manaEarned",        target: 200, desc: "Earn 200 mana",                rewardCoins: 0,  rewardGems: 15 },
  { id: "d_oil20",   statKey: "oilEarned",         target: 20,  desc: "Collect 20 oil",               rewardCoins: 0,  rewardGems: 10 },
  { id: "d_squad2",  statKey: "multiUnitCommands", target: 1,   desc: "Command 2+ units together",    rewardCoins: 20, rewardGems: 5  },
];
const DAILY_COUNT = 3;

export function getActiveDailyQuests() {
  const user = currentUser() || "guest";
  // Shuffle the whole pool, then take one quest per distinct stat so the
  // three offered each day never trivially overlap (e.g. "deploy 3" + "deploy 5").
  const shuffled = pickN(DAILY_POOL, DAILY_POOL.length, `${user}|${todayKey()}`);
  const chosen = [], usedStats = new Set();
  for (const q of shuffled) {
    if (usedStats.has(q.statKey)) continue;
    usedStats.add(q.statKey);
    chosen.push(q);
    if (chosen.length >= DAILY_COUNT) break;
  }
  return chosen;
}

// ── Weekly quests — 15 hard quests per week, 60 total across a 4-week cycle.
// Each week's 15 are revealed on top of the previous weeks' (nothing already
// unlocked disappears), so by week 4 all 60 are visible at once. Once the
// cycle completes, the whole pool is reshuffled into new week-buckets and
// progress resets.
const WEEKLY_POOL = [
  // battlesWon
  { id: "wk_win5",   statKey: "battlesWon", target: 5,  desc: "Win 5 battles",               rewardCoins: 150, rewardGems: 0  },
  { id: "wk_win8",   statKey: "battlesWon", target: 8,  desc: "Win 8 battles",               rewardCoins: 0,   rewardGems: 30 },
  { id: "wk_win10",  statKey: "battlesWon", target: 10, desc: "Win 10 battles (Champion)",   rewardCoins: 220, rewardGems: 0  },
  { id: "wk_win12",  statKey: "battlesWon", target: 12, desc: "Win 12 battles",              rewardCoins: 0,   rewardGems: 40 },
  { id: "wk_win15",  statKey: "battlesWon", target: 15, desc: "Win 15 battles",              rewardCoins: 280, rewardGems: 0  },
  { id: "wk_win18",  statKey: "battlesWon", target: 18, desc: "Win 18 battles",              rewardCoins: 0,   rewardGems: 55 },
  { id: "wk_win20",  statKey: "battlesWon", target: 20, desc: "Win 20 battles (Warlord)",    rewardCoins: 340, rewardGems: 0  },
  { id: "wk_win25",  statKey: "battlesWon", target: 25, desc: "Win 25 battles",              rewardCoins: 0,   rewardGems: 70 },

  // battlesPlayed
  { id: "wk_play10", statKey: "battlesPlayed", target: 10, desc: "Play 10 battles",          rewardCoins: 120, rewardGems: 0  },
  { id: "wk_play15", statKey: "battlesPlayed", target: 15, desc: "Play 15 battles",          rewardCoins: 0,   rewardGems: 25 },
  { id: "wk_play20", statKey: "battlesPlayed", target: 20, desc: "Play 20 battles",          rewardCoins: 180, rewardGems: 0  },
  { id: "wk_play25", statKey: "battlesPlayed", target: 25, desc: "Play 25 battles",          rewardCoins: 0,   rewardGems: 35 },
  { id: "wk_play30", statKey: "battlesPlayed", target: 30, desc: "Play 30 battles",          rewardCoins: 240, rewardGems: 0  },
  { id: "wk_play35", statKey: "battlesPlayed", target: 35, desc: "Play 35 battles",          rewardCoins: 0,   rewardGems: 45 },
  { id: "wk_play40", statKey: "battlesPlayed", target: 40, desc: "Play 40 battles",          rewardCoins: 300, rewardGems: 0  },

  // troopsDeployed
  { id: "wk_deploy20",  statKey: "troopsDeployed", target: 20,  desc: "Deploy 20 troops",             rewardCoins: 130, rewardGems: 0  },
  { id: "wk_deploy30",  statKey: "troopsDeployed", target: 30,  desc: "Deploy 30 troops",             rewardCoins: 0,   rewardGems: 25 },
  { id: "wk_deploy40",  statKey: "troopsDeployed", target: 40,  desc: "Deploy 40 troops",             rewardCoins: 170, rewardGems: 0  },
  { id: "wk_deploy50",  statKey: "troopsDeployed", target: 50,  desc: "Deploy 50 troops",             rewardCoins: 0,   rewardGems: 35 },
  { id: "wk_deploy60",  statKey: "troopsDeployed", target: 60,  desc: "Deploy 60 troops",             rewardCoins: 210, rewardGems: 0  },
  { id: "wk_deploy80",  statKey: "troopsDeployed", target: 80,  desc: "Deploy 80 troops",             rewardCoins: 0,   rewardGems: 45 },
  { id: "wk_deploy100", statKey: "troopsDeployed", target: 100, desc: "Deploy 100 troops",            rewardCoins: 260, rewardGems: 0  },
  { id: "wk_deploy120", statKey: "troopsDeployed", target: 120, desc: "Deploy 120 troops (Quartermaster)", rewardCoins: 0, rewardGems: 60 },

  // enemiesKilled
  { id: "wk_kill30",  statKey: "enemiesKilled", target: 30,  desc: "Defeat 30 enemies",            rewardCoins: 160, rewardGems: 0  },
  { id: "wk_kill50",  statKey: "enemiesKilled", target: 50,  desc: "Defeat 50 enemies",            rewardCoins: 0,   rewardGems: 30 },
  { id: "wk_kill75",  statKey: "enemiesKilled", target: 75,  desc: "Defeat 75 enemies",            rewardCoins: 210, rewardGems: 0  },
  { id: "wk_kill100", statKey: "enemiesKilled", target: 100, desc: "Defeat 100 enemies (Slayer)",  rewardCoins: 0,   rewardGems: 45 },
  { id: "wk_kill125", statKey: "enemiesKilled", target: 125, desc: "Defeat 125 enemies",           rewardCoins: 260, rewardGems: 0  },
  { id: "wk_kill150", statKey: "enemiesKilled", target: 150, desc: "Defeat 150 enemies",           rewardCoins: 0,   rewardGems: 55 },
  { id: "wk_kill175", statKey: "enemiesKilled", target: 175, desc: "Defeat 175 enemies",           rewardCoins: 310, rewardGems: 0  },
  { id: "wk_kill200", statKey: "enemiesKilled", target: 200, desc: "Defeat 200 enemies (Warmonger)", rewardCoins: 0, rewardGems: 70 },

  // manaEarned
  { id: "wk_mana500",  statKey: "manaEarned", target: 500,  desc: "Earn 500 mana",   rewardCoins: 140, rewardGems: 0  },
  { id: "wk_mana1000", statKey: "manaEarned", target: 1000, desc: "Earn 1000 mana",  rewardCoins: 0,   rewardGems: 30 },
  { id: "wk_mana1500", statKey: "manaEarned", target: 1500, desc: "Earn 1500 mana",  rewardCoins: 190, rewardGems: 0  },
  { id: "wk_mana2000", statKey: "manaEarned", target: 2000, desc: "Earn 2000 mana",  rewardCoins: 0,   rewardGems: 40 },
  { id: "wk_mana2500", statKey: "manaEarned", target: 2500, desc: "Earn 2500 mana",  rewardCoins: 240, rewardGems: 0  },
  { id: "wk_mana3000", statKey: "manaEarned", target: 3000, desc: "Earn 3000 mana",  rewardCoins: 0,   rewardGems: 50 },
  { id: "wk_mana4000", statKey: "manaEarned", target: 4000, desc: "Earn 4000 mana",  rewardCoins: 300, rewardGems: 0  },

  // oilEarned
  { id: "wk_oil100", statKey: "oilEarned", target: 100, desc: "Collect 100 oil", rewardCoins: 130, rewardGems: 0  },
  { id: "wk_oil200", statKey: "oilEarned", target: 200, desc: "Collect 200 oil", rewardCoins: 0,   rewardGems: 25 },
  { id: "wk_oil300", statKey: "oilEarned", target: 300, desc: "Collect 300 oil", rewardCoins: 170, rewardGems: 0  },
  { id: "wk_oil400", statKey: "oilEarned", target: 400, desc: "Collect 400 oil", rewardCoins: 0,   rewardGems: 35 },
  { id: "wk_oil500", statKey: "oilEarned", target: 500, desc: "Collect 500 oil", rewardCoins: 210, rewardGems: 0  },
  { id: "wk_oil600", statKey: "oilEarned", target: 600, desc: "Collect 600 oil", rewardCoins: 0,   rewardGems: 45 },
  { id: "wk_oil800", statKey: "oilEarned", target: 800, desc: "Collect 800 oil", rewardCoins: 270, rewardGems: 0  },

  // structuresBuilt
  { id: "wk_build3",  statKey: "structuresBuilt", target: 3,  desc: "Build 3 structures",             rewardCoins: 110, rewardGems: 0  },
  { id: "wk_build5",  statKey: "structuresBuilt", target: 5,  desc: "Build 5 structures",             rewardCoins: 0,   rewardGems: 20 },
  { id: "wk_build7",  statKey: "structuresBuilt", target: 7,  desc: "Build 7 structures",             rewardCoins: 150, rewardGems: 0  },
  { id: "wk_build10", statKey: "structuresBuilt", target: 10, desc: "Build 10 structures",            rewardCoins: 0,   rewardGems: 30 },
  { id: "wk_build12", statKey: "structuresBuilt", target: 12, desc: "Build 12 structures",            rewardCoins: 190, rewardGems: 0  },
  { id: "wk_build15", statKey: "structuresBuilt", target: 15, desc: "Build 15 structures",            rewardCoins: 0,   rewardGems: 40 },
  { id: "wk_build18", statKey: "structuresBuilt", target: 18, desc: "Build 18 structures",            rewardCoins: 230, rewardGems: 0  },
  { id: "wk_build20", statKey: "structuresBuilt", target: 20, desc: "Build 20 structures (Engineer)", rewardCoins: 0,   rewardGems: 50 },

  // multiUnitCommands
  { id: "wk_squad5",  statKey: "multiUnitCommands", target: 5,  desc: "Issue 5 group commands",             rewardCoins: 100, rewardGems: 0  },
  { id: "wk_squad10", statKey: "multiUnitCommands", target: 10, desc: "Issue 10 group commands",            rewardCoins: 0,   rewardGems: 20 },
  { id: "wk_squad15", statKey: "multiUnitCommands", target: 15, desc: "Issue 15 group commands",            rewardCoins: 150, rewardGems: 0  },
  { id: "wk_squad20", statKey: "multiUnitCommands", target: 20, desc: "Issue 20 group commands",            rewardCoins: 0,   rewardGems: 30 },
  { id: "wk_squad25", statKey: "multiUnitCommands", target: 25, desc: "Issue 25 group commands",            rewardCoins: 200, rewardGems: 0  },
  { id: "wk_squad30", statKey: "multiUnitCommands", target: 30, desc: "Issue 30 group commands",            rewardCoins: 0,   rewardGems: 40 },
  { id: "wk_squad40", statKey: "multiUnitCommands", target: 40, desc: "Issue 40 group commands (Tactician)", rewardCoins: 260, rewardGems: 0 },
];
const WEEK_BUCKET_SIZES = [15, 15, 15, 15]; // 60 quests split evenly across the 4 reveal-weeks

function chunkBySizes(arr, sizes) {
  const out = [];
  let i = 0;
  for (const n of sizes) { out.push(arr.slice(i, i + n)); i += n; }
  return out;
}

// The 15 quests shuffled into 4 week-buckets for a given cycle — deterministic
// per cycle so the grouping is stable across reloads and the same for everyone.
function getWeekBuckets(cycleIdx) {
  const shuffled = pickN(WEEKLY_POOL, WEEKLY_POOL.length, `weekly-cycle|${cycleIdx}`);
  return chunkBySizes(shuffled, WEEK_BUCKET_SIZES);
}

// All quests unlocked so far this cycle (used to validate claims regardless
// of which single week the player currently has open in the UI).
export function getActiveWeeklyQuests() {
  const buckets = getWeekBuckets(cycleIndex());
  return buckets.slice(0, getActiveWeekIndex()).flat();
}

// Just one week's 15 quests, for the week-tabbed display.
export function getWeeklyQuestsForWeek(weekNum) {
  const buckets = getWeekBuckets(cycleIndex());
  return buckets[weekNum - 1] || [];
}

// ── Progress state (per user, resets on day/week rollover) ────────────────────
const QS_KEY = (u) => `rpg_quest_state_${u}`;

function loadState(user) {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(QS_KEY(user)) || "null"); } catch { raw = null; }
  if (!raw) raw = {};
  const day = todayKey(), cycle = cycleKey();
  if (raw.day !== day)     { raw.day = day;     raw.dailyStats = {};  raw.dailyClaimed = [];  }
  // Weekly progress persists across all 4 weeks of a cycle — only a new cycle resets it.
  if (raw.cycle !== cycle) { raw.cycle = cycle; raw.weeklyStats = {}; raw.weeklyClaimed = []; }
  raw.dailyStats    ||= {};
  raw.dailyClaimed  ||= [];
  raw.weeklyStats   ||= {};
  raw.weeklyClaimed ||= [];
  return raw;
}
function saveState(user, state) {
  localStorage.setItem(QS_KEY(user), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("rpg_quests_updated"));
}

export function getQuestState() {
  const user = currentUser();
  return user ? loadState(user) : null;
}

export function bumpQuestStat(statKey, amount = 1) {
  if (typeof window === "undefined") return;
  const user = currentUser();
  if (!user) return;
  const state = loadState(user);
  state.dailyStats[statKey]  = (state.dailyStats[statKey]  || 0) + amount;
  state.weeklyStats[statKey] = (state.weeklyStats[statKey] || 0) + amount;
  saveState(user, state);
}

export function claimDailyQuest(id) {
  const user = currentUser();
  if (!user) return false;
  const state = loadState(user);
  if (state.dailyClaimed.includes(id)) return false;
  const quest = DAILY_POOL.find((q) => q.id === id);
  if (!quest || (state.dailyStats[quest.statKey] || 0) < quest.target) return false;
  state.dailyClaimed.push(id);
  saveState(user, state);
  if (quest.rewardCoins) awardCoins(quest.rewardCoins);
  if (quest.rewardGems)  awardGems(quest.rewardGems);
  return true;
}

export function claimWeeklyQuest(id) {
  const user = currentUser();
  if (!user) return false;
  const state = loadState(user);
  if (state.weeklyClaimed.includes(id)) return false;
  const quest = getActiveWeeklyQuests().find((q) => q.id === id);
  if (!quest || (state.weeklyStats[quest.statKey] || 0) < quest.target) return false;
  state.weeklyClaimed.push(id);
  saveState(user, state);
  if (quest.rewardCoins) awardCoins(quest.rewardCoins);
  if (quest.rewardGems)  awardGems(quest.rewardGems);
  addPassXP(PASS_XP_PER_WEEKLY_CLAIM); // weekly quests are the only source of Pass XP
  return true;
}

// ── Strategon Pass — a seasonal reward track fed entirely by weekly-quest XP.
// Claiming a weekly quest also grants Pass XP; every PASS_LEVEL_XP banked unlocks
// the next level's reward. Resets alongside the weekly quest cycle.
export const PASS_XP_PER_WEEKLY_CLAIM = 100;
export const PASS_LEVEL_XP            = 1000;
export const PASS_MAX_LEVEL           = 10;

export const PASS_REWARDS = [
  { level: 1,  rewardCoins: 100, rewardGems: 0  },
  { level: 2,  rewardCoins: 0,   rewardGems: 20 },
  { level: 3,  rewardCoins: 150, rewardGems: 0  },
  { level: 4,  rewardCoins: 0,   rewardGems: 25 },
  { level: 5,  rewardCoins: 200, rewardGems: 0  },
  { level: 6,  rewardCoins: 0,   rewardGems: 30 },
  { level: 7,  rewardCoins: 250, rewardGems: 0  },
  { level: 8,  rewardCoins: 0,   rewardGems: 40 },
  { level: 9,  rewardCoins: 300, rewardGems: 0  },
  { level: 10, rewardCoins: 500, rewardGems: 60 },
];

const PASS_KEY = (u) => `rpg_pass_${u}`;

function loadPassState(user) {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(PASS_KEY(user)) || "null"); } catch { raw = null; }
  if (!raw) raw = {};
  const cycle = cycleKey();
  if (raw.cycle !== cycle) { raw.cycle = cycle; raw.xp = 0; raw.claimed = []; }
  raw.xp      ||= 0;
  raw.claimed ||= [];
  return raw;
}
function savePassState(user, state) {
  localStorage.setItem(PASS_KEY(user), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("rpg_pass_updated"));
}

function addPassXP(amount) {
  const user = currentUser();
  if (!user) return;
  const state = loadPassState(user);
  state.xp += amount;
  savePassState(user, state);
}

export function getPassState() {
  const user = currentUser();
  return user ? loadPassState(user) : null;
}

export function getPassLevel(xp) {
  return Math.min(PASS_MAX_LEVEL, Math.floor(xp / PASS_LEVEL_XP));
}

export function claimPassReward(level) {
  const user = currentUser();
  if (!user) return false;
  const state = loadPassState(user);
  const reward = PASS_REWARDS.find((r) => r.level === level);
  if (!reward || state.claimed.includes(level)) return false;
  if (getPassLevel(state.xp) < level) return false;
  state.claimed.push(level);
  savePassState(user, state);
  if (reward.rewardCoins) awardCoins(reward.rewardCoins);
  if (reward.rewardGems)  awardGems(reward.rewardGems);
  return true;
}

// ── Daily reward streak (7-day tier cycle) ─────────────────────────────────────
const DR_KEY = (u) => `rpg_daily_reward_${u}`;

export const DAILY_REWARD_TIERS = [
  { day: 1, coins: 20,  gems: 0  },
  { day: 2, coins: 30,  gems: 0  },
  { day: 3, coins: 0,   gems: 5  },
  { day: 4, coins: 50,  gems: 0  },
  { day: 5, coins: 0,   gems: 8  },
  { day: 6, coins: 80,  gems: 0  },
  { day: 7, coins: 150, gems: 25 },
];

function loadDailyReward(user) {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(DR_KEY(user)) || "null"); } catch { raw = null; }
  return raw || { lastClaim: null, streak: 0 };
}
function saveDailyReward(user, state) {
  localStorage.setItem(DR_KEY(user), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("rpg_quests_updated"));
}

export function getDailyRewardStatus() {
  const user = currentUser();
  if (!user) return null;
  const state = loadDailyReward(user);
  const today = todayKey();
  const claimedToday = state.lastClaim === today;

  let nextStreak = 1;
  if (state.lastClaim) {
    const diffDays = Math.round((new Date(`${today}T00:00:00`) - new Date(`${state.lastClaim}T00:00:00`)) / DAY_MS);
    if (diffDays === 0) nextStreak = state.streak;      // already claimed today
    else if (diffDays === 1) nextStreak = state.streak + 1; // consecutive day
    else nextStreak = 1;                                 // missed a day
  }
  const tier = DAILY_REWARD_TIERS[(nextStreak - 1) % 7];
  return { streak: state.streak, claimedToday, nextStreak, tier };
}

export function claimDailyReward() {
  const user = currentUser();
  if (!user) return null;
  const status = getDailyRewardStatus();
  if (!status || status.claimedToday) return null;
  const state = loadDailyReward(user);
  state.streak = status.nextStreak;
  state.lastClaim = todayKey();
  saveDailyReward(user, state);
  const { tier } = status;
  if (tier.coins) awardCoins(tier.coins);
  if (tier.gems)  awardGems(tier.gems);
  return tier;
}

// ── Reset countdown helpers for UI ─────────────────────────────────────────────
export function hoursUntilDailyReset() {
  const now = new Date();
  const next = new Date(now); next.setHours(24, 0, 0, 0);
  return Math.max(0, Math.ceil((next - now) / (60 * 60 * 1000)));
}
export function daysUntilWeeklyReset() {
  const now = Date.now();
  const next = (weekNumber() + 1) * 7 * DAY_MS;
  return Math.max(0, Math.ceil((next - now) / DAY_MS));
}
