// Ranked mode — MMR/rank tracking, 5-game calibration, and escalating leaver
// penalties. All purely client-side (per-account, like coins/mana/quests).
// Matchmaking + live match sync against a real opponent live in ./realtime.js.
import { Medal, Trophy, Award, Gem, Crown } from "lucide-react";

function currentUser() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rpg_username");
}

export const RANKS = [
  { name: "Bronze",   minMmr: 0,    color: "#a16207", icon: Medal },
  { name: "Silver",   minMmr: 1000, color: "#94a3b8", icon: Medal },
  { name: "Gold",     minMmr: 1300, color: "#eab308", icon: Trophy },
  { name: "Platinum", minMmr: 1600, color: "#22d3ee", icon: Award },
  { name: "Diamond",  minMmr: 1900, color: "#818cf8", icon: Gem },
  { name: "Champion", minMmr: 2200, color: "#f43f5e", icon: Crown },
];

export const CALIBRATION_GAMES = 5;
const STARTING_MMR = 1000; // internal seed while uncalibrated — rank isn't shown until calibration ends

export function getRankForMmr(mmr) {
  let rank = RANKS[0];
  for (const r of RANKS) if (mmr >= r.minMmr) rank = r;
  return rank;
}

const RK_KEY = (u) => `rpg_ranked_${u}`;

function defaultRankState() {
  return { mmr: STARTING_MMR, calibrationGames: 0, calibrated: false, wins: 0, losses: 0, calibrationScore: 0 };
}

export function getRankState() {
  const u = currentUser();
  if (!u) return defaultRankState();
  try {
    const raw = JSON.parse(localStorage.getItem(RK_KEY(u)) || "null");
    return raw ? { ...defaultRankState(), ...raw } : defaultRankState();
  } catch { return defaultRankState(); }
}

function saveRankState(state) {
  const u = currentUser();
  if (!u) return;
  localStorage.setItem(RK_KEY(u), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("rpg_ranked_updated"));
}

// Call after every ranked match. `performance` (0-1) captures how decisive the
// result was (kills dealt vs lost, objective progress...) and only shapes the
// calibration score — once calibrated, MMR moves via a standard Elo update.
export function recordRankedResult({ won, performance = 0.5, opponentMmr = STARTING_MMR }) {
  const state = getRankState();

  if (!state.calibrated) {
    state.calibrationGames += 1;
    const gameScore = won ? 0.5 + performance * 0.5 : 0.5 - performance * 0.5; // 0..1
    state.calibrationScore += gameScore;
    if (won) state.wins++; else state.losses++;
    if (state.calibrationGames >= CALIBRATION_GAMES) {
      const avg = state.calibrationScore / CALIBRATION_GAMES; // 0..1 average performance
      const minMmr = RANKS[0].minMmr, maxMmr = RANKS[RANKS.length - 1].minMmr + 300;
      state.mmr = Math.round(minMmr + avg * (maxMmr - minMmr));
      state.calibrated = true;
    }
    saveRankState(state);
    return state;
  }

  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (opponentMmr - state.mmr) / 400));
  state.mmr = Math.max(0, state.mmr + Math.round(K * ((won ? 1 : 0) - expected)));
  if (won) state.wins++; else state.losses++;
  saveRankState(state);
  return state;
}

// ── Leaver penalty — escalating bans for abandoning a live ranked match ─────
export const LEAVE_PENALTY_TIERS_MIN = [10, 30, 60, 600]; // 10m, 30m, 1h, 10h — caps at 10h for the 4th+ offense

const BAN_KEY = (u) => `rpg_ranked_ban_${u}`;

function defaultBanState() { return { strikes: 0, banUntil: 0 }; }

export function getBanState() {
  const u = currentUser();
  if (!u) return defaultBanState();
  try {
    const raw = JSON.parse(localStorage.getItem(BAN_KEY(u)) || "null");
    return raw ? { ...defaultBanState(), ...raw } : defaultBanState();
  } catch { return defaultBanState(); }
}

function saveBanState(state) {
  const u = currentUser();
  if (!u) return;
  localStorage.setItem(BAN_KEY(u), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("rpg_ranked_ban_updated"));
}

export function getBanMinutesRemaining() {
  const remainingMs = getBanState().banUntil - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 60000) : 0;
}

export function isBanned() {
  return getBanMinutesRemaining() > 0;
}

// Call when a player abandons a live ranked match (quits mid-battle, closes the tab, etc).
export function recordLeave() {
  const state = getBanState();
  const minutes = LEAVE_PENALTY_TIERS_MIN[Math.min(state.strikes, LEAVE_PENALTY_TIERS_MIN.length - 1)];
  state.strikes += 1;
  state.banUntil = Date.now() + minutes * 60000;
  saveBanState(state);
  return { minutes, strikes: state.strikes };
}
