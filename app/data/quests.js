// Daily quests, weekly quests, and the daily-login reward streak.
import { awardMana, awardGems, awardOil } from "./troops";

const DAY_MS = 24 * 60 * 60 * 1000;

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekNumber(d = new Date()) { return Math.floor(d.getTime() / (7 * DAY_MS)); }
function weekKey(d = new Date())    { return String(weekNumber(d)); }

// Which of the 4 rotating weekly quest sets is live right now (1-4).
export function getActiveWeekIndex() { return (weekNumber() % 4) + 1; }

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
  battlesWon:        { icon: "🏆", label: "battles won" },
  battlesPlayed:     { icon: "⚔️", label: "battles played" },
  troopsDeployed:    { icon: "🪖", label: "troops deployed" },
  enemiesKilled:     { icon: "💀", label: "enemies defeated" },
  manaEarned:        { icon: "💜", label: "mana earned" },
  oilEarned:         { icon: "🛢️", label: "oil collected" },
  structuresBuilt:   { icon: "🏭", label: "structures built" },
  multiUnitCommands: { icon: "🖱️", label: "group commands issued" },
};

// ── Daily quests — easy, 3 drawn from this pool each day ──────────────────────
const DAILY_POOL = [
  { id: "d_win1",    statKey: "battlesWon",        target: 1,   desc: "Win 1 battle",                rewardMana: 40, rewardGems: 0  },
  { id: "d_win2",    statKey: "battlesWon",        target: 2,   desc: "Win 2 battles",                rewardMana: 60, rewardGems: 0  },
  { id: "d_play1",   statKey: "battlesPlayed",     target: 1,   desc: "Play 1 battle",                rewardMana: 15, rewardGems: 0  },
  { id: "d_deploy3", statKey: "troopsDeployed",    target: 3,   desc: "Deploy 3 troops",              rewardMana: 30, rewardGems: 0  },
  { id: "d_deploy5", statKey: "troopsDeployed",    target: 5,   desc: "Deploy 5 troops",               rewardMana: 45, rewardGems: 0  },
  { id: "d_kill5",   statKey: "enemiesKilled",     target: 5,   desc: "Defeat 5 enemies",             rewardMana: 35, rewardGems: 0  },
  { id: "d_kill10",  statKey: "enemiesKilled",     target: 10,  desc: "Defeat 10 enemies",            rewardMana: 50, rewardGems: 0  },
  { id: "d_build1",  statKey: "structuresBuilt",   target: 1,   desc: "Build 1 structure",            rewardMana: 25, rewardGems: 0  },
  { id: "d_mana100", statKey: "manaEarned",        target: 100, desc: "Earn 100 mana",                rewardMana: 0,  rewardGems: 10 },
  { id: "d_mana200", statKey: "manaEarned",        target: 200, desc: "Earn 200 mana",                rewardMana: 0,  rewardGems: 15 },
  { id: "d_oil20",   statKey: "oilEarned",         target: 20,  desc: "Collect 20 oil",               rewardMana: 0,  rewardGems: 10 },
  { id: "d_squad2",  statKey: "multiUnitCommands", target: 1,   desc: "Command 2+ units together",    rewardMana: 20, rewardGems: 5  },
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

// ── Weekly quests — harder, 9 per week (fits a 3x3 grid), rotating across a 4-week cycle ──
function buildWeekSet(w) {
  const mult = 1 + (w - 1) * 0.4; // week 4 pays ~2.2x week 1
  const R = (mana = 0, gems = 0) => ({ rewardMana: Math.round(mana * mult), rewardGems: Math.round(gems * mult) });
  return [
    { id: `w${w}_win`,     statKey: "battlesWon",        target: 2 * w + 1,   desc: `Win ${2 * w + 1} battles`,                ...R(150) },
    { id: `w${w}_winbig`,  statKey: "battlesWon",        target: 3 * w + 2,   desc: `Win ${3 * w + 2} battles (Champion)`,     ...R(0, 40) },
    { id: `w${w}_play`,    statKey: "battlesPlayed",     target: 4 * w + 3,   desc: `Play ${4 * w + 3} battles`,               ...R(90) },
    { id: `w${w}_deploy`,  statKey: "troopsDeployed",    target: 10 * w + 5,  desc: `Deploy ${10 * w + 5} troops`,             ...R(120) },
    { id: `w${w}_kill`,    statKey: "enemiesKilled",     target: 15 * w + 15, desc: `Defeat ${15 * w + 15} enemies`,           ...R(150) },
    { id: `w${w}_mana`,    statKey: "manaEarned",        target: 300 * w + 200, desc: `Earn ${300 * w + 200} mana`,            ...R(0, 40) },
    { id: `w${w}_oil`,     statKey: "oilEarned",         target: 50 * w + 50, desc: `Collect ${50 * w + 50} oil`,              ...R(0, 35) },
    { id: `w${w}_build`,   statKey: "structuresBuilt",   target: 2 * w + 1,   desc: `Build ${2 * w + 1} structures`,           ...R(100) },
    { id: `w${w}_squad`,   statKey: "multiUnitCommands", target: 3 * w + 2,   desc: `Issue ${3 * w + 2} group commands`,       ...R(90) },
  ];
}
export function getActiveWeeklyQuests() { return buildWeekSet(getActiveWeekIndex()); }

// ── Progress state (per user, resets on day/week rollover) ────────────────────
const QS_KEY = (u) => `rpg_quest_state_${u}`;

function loadState(user) {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(QS_KEY(user)) || "null"); } catch { raw = null; }
  if (!raw) raw = {};
  const day = todayKey(), week = weekKey();
  if (raw.day !== day)   { raw.day = day;   raw.dailyStats = {};  raw.dailyClaimed = [];  }
  if (raw.week !== week) { raw.week = week; raw.weeklyStats = {}; raw.weeklyClaimed = []; }
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
  if (quest.rewardMana) awardMana(quest.rewardMana);
  if (quest.rewardGems) awardGems(quest.rewardGems);
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
  if (quest.rewardMana) awardMana(quest.rewardMana);
  if (quest.rewardGems) awardGems(quest.rewardGems);
  return true;
}

// ── Daily reward streak (7-day tier cycle) ─────────────────────────────────────
const DR_KEY = (u) => `rpg_daily_reward_${u}`;

export const DAILY_REWARD_TIERS = [
  { day: 1, mana: 20,  gems: 0,  oil: 0  },
  { day: 2, mana: 30,  gems: 0,  oil: 10 },
  { day: 3, mana: 0,   gems: 5,  oil: 15 },
  { day: 4, mana: 50,  gems: 0,  oil: 0  },
  { day: 5, mana: 0,   gems: 8,  oil: 20 },
  { day: 6, mana: 80,  gems: 0,  oil: 0  },
  { day: 7, mana: 150, gems: 25, oil: 30 },
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
  if (tier.mana) awardMana(tier.mana);
  if (tier.gems) awardGems(tier.gems);
  if (tier.oil)  awardOil(tier.oil);
  return tier;
}

// ── Badge count for nav UI ─────────────────────────────────────────────────────
export function getClaimableCount() {
  const user = currentUser();
  if (!user) return 0;
  const state = loadState(user);
  const daily = getActiveDailyQuests().filter(
    (q) => !state.dailyClaimed.includes(q.id) && (state.dailyStats[q.statKey] || 0) >= q.target
  ).length;
  const weekly = getActiveWeeklyQuests().filter(
    (q) => !state.weeklyClaimed.includes(q.id) && (state.weeklyStats[q.statKey] || 0) >= q.target
  ).length;
  const reward = getDailyRewardStatus();
  return daily + weekly + (reward && !reward.claimedToday ? 1 : 0);
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
