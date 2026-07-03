// Daily quests, weekly quests, and the daily-login reward streak.
// Rewards pay out in coins/gems only — mana and oil are earned in battle, not from quests.
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

// ── Weekly quests — 15 hard quests total, revealed cumulatively across a
// 4-week cycle: week 2's quests are added on top of week 1's (nothing already
// unlocked disappears), and so on through week 4. Once the cycle completes,
// the whole pool is reshuffled into new week-buckets and progress resets.
const WEEKLY_POOL = [
  { id: "wk_win5",     statKey: "battlesWon",        target: 5,    desc: "Win 5 battles",               rewardCoins: 150, rewardGems: 0  },
  { id: "wk_win10",    statKey: "battlesWon",        target: 10,   desc: "Win 10 battles (Champion)",   rewardCoins: 0,   rewardGems: 40 },
  { id: "wk_play15",   statKey: "battlesPlayed",     target: 15,   desc: "Play 15 battles",             rewardCoins: 120, rewardGems: 0  },
  { id: "wk_deploy30", statKey: "troopsDeployed",    target: 30,   desc: "Deploy 30 troops",            rewardCoins: 150, rewardGems: 0  },
  { id: "wk_deploy60", statKey: "troopsDeployed",    target: 60,   desc: "Deploy 60 troops",            rewardCoins: 0,   rewardGems: 35 },
  { id: "wk_kill50",   statKey: "enemiesKilled",     target: 50,   desc: "Defeat 50 enemies",           rewardCoins: 180, rewardGems: 0  },
  { id: "wk_kill100",  statKey: "enemiesKilled",     target: 100,  desc: "Defeat 100 enemies (Slayer)", rewardCoins: 0,   rewardGems: 50 },
  { id: "wk_mana1000", statKey: "manaEarned",        target: 1000, desc: "Earn 1000 mana",              rewardCoins: 0,   rewardGems: 45 },
  { id: "wk_mana2000", statKey: "manaEarned",        target: 2000, desc: "Earn 2000 mana",              rewardCoins: 200, rewardGems: 0  },
  { id: "wk_oil200",   statKey: "oilEarned",         target: 200,  desc: "Collect 200 oil",             rewardCoins: 0,   rewardGems: 35 },
  { id: "wk_oil400",   statKey: "oilEarned",         target: 400,  desc: "Collect 400 oil",             rewardCoins: 220, rewardGems: 0  },
  { id: "wk_build5",   statKey: "structuresBuilt",   target: 5,    desc: "Build 5 structures",          rewardCoins: 130, rewardGems: 0  },
  { id: "wk_build10",  statKey: "structuresBuilt",   target: 10,   desc: "Build 10 structures",         rewardCoins: 0,   rewardGems: 30 },
  { id: "wk_squad10",  statKey: "multiUnitCommands", target: 10,   desc: "Issue 10 group commands",     rewardCoins: 120, rewardGems: 0  },
  { id: "wk_squad20",  statKey: "multiUnitCommands", target: 20,   desc: "Issue 20 group commands",     rewardCoins: 0,   rewardGems: 35 },
];
const WEEK_BUCKET_SIZES = [4, 4, 4, 3]; // 15 quests split across the 4 reveal-weeks

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

export function getActiveWeeklyQuests() {
  const buckets = getWeekBuckets(cycleIndex());
  return buckets.slice(0, getActiveWeekIndex()).flat();
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
