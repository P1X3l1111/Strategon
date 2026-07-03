// Campaign mode: a fixed sequence of scripted missions, each a war situation
// the player must win. Most missions win by eliminating the enemy garrison;
// some instead require capturing specific enemy troops alive.

export const MISSIONS = [
  {
    id: "c1", name: "First Contact",
    briefing: "Enemy scouts have crossed the river. Wipe them out.",
    objective: "eliminate",
    enemyUnits: [
      { type: "inf_light", col: 22, row: 2 },
      { type: "inf_light", col: 25, row: 9 },
      { type: "inf_light", col: 21, row: 13 },
    ],
    rewardMana: 80, rewardGems: 5, rewardOil: 0,
  },
  {
    id: "c2", name: "Armored Probe",
    briefing: "A light armored patrol is testing our defenses. Destroy it before it reports back.",
    objective: "eliminate",
    enemyUnits: [
      { type: "inf_light", col: 20, row: 1 },
      { type: "inf_light", col: 27, row: 12 },
      { type: "armor_car",  col: 24, row: 15 },
    ],
    rewardMana: 120, rewardGems: 8, rewardOil: 0,
  },
  {
    id: "c3", name: "Artillery Line",
    briefing: "Enemy guns are dug in across the field. Push through and silence them.",
    objective: "eliminate",
    enemyUnits: [
      { type: "inf_assault", col: 19, row: 2 },
      { type: "inf_assault", col: 30, row: 5 },
      { type: "artillery",   col: 23, row: 9 },
      { type: "artillery",   col: 26, row: 13 },
    ],
    rewardMana: 160, rewardGems: 10, rewardOil: 10,
  },
  {
    id: "c4", name: "Prisoner Extraction",
    briefing: "Intelligence says an enemy Commando squad is carrying vital intel. Capture them alive — do not let them be destroyed.",
    objective: "capture",
    captureCount: 1,
    enemyUnits: [
      { type: "commandos", col: 25, row: 8, capture: true },
      { type: "inf_light",  col: 22, row: 6  },
      { type: "inf_light",  col: 22, row: 11 },
      { type: "tank_light", col: 27, row: 9  },
    ],
    rewardMana: 200, rewardGems: 20, rewardOil: 0,
  },
  {
    id: "c5", name: "Tank Column",
    briefing: "A heavy armored column is massing for a counterattack. Break it before it forms up.",
    objective: "eliminate",
    enemyUnits: [
      { type: "tank_light", col: 21, row: 2  },
      { type: "tank_light", col: 29, row: 4  },
      { type: "tank_heavy", col: 25, row: 9  },
      { type: "inf_motor",  col: 19, row: 13 },
      { type: "inf_motor",  col: 28, row: 15 },
    ],
    rewardMana: 260, rewardGems: 18, rewardOil: 20,
  },
  {
    id: "c6", name: "High-Value Targets",
    briefing: "Two prototype vehicles are in the field. Capture both before enemy command orders them scuttled.",
    objective: "capture",
    captureCount: 2,
    enemyUnits: [
      { type: "tank_heavy",  col: 24, row: 3,  capture: true },
      { type: "rocket",      col: 26, row: 14, capture: true },
      { type: "commandos",   col: 22, row: 8  },
      { type: "inf_assault", col: 20, row: 5  },
      { type: "inf_assault", col: 29, row: 12 },
      { type: "armor_car",   col: 23, row: 16 },
    ],
    rewardMana: 350, rewardGems: 30, rewardOil: 40,
  },
];

// ── Progress (per user) ────────────────────────────────────────────────────────
function currentUser() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rpg_username");
}
const CP_KEY = (u) => `rpg_campaign_${u}`;

export function getCampaignProgress() {
  const user = currentUser();
  if (!user) return { completed: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(CP_KEY(user)) || "null");
    return raw && Array.isArray(raw.completed) ? raw : { completed: [] };
  } catch { return { completed: [] }; }
}

export function isMissionComplete(missionId) {
  return getCampaignProgress().completed.includes(missionId);
}

export function isMissionUnlocked(missionId) {
  const idx = MISSIONS.findIndex((m) => m.id === missionId);
  if (idx <= 0) return true; // first mission always open
  return isMissionComplete(MISSIONS[idx - 1].id);
}

export function completeMission(missionId) {
  const user = currentUser();
  if (!user) return;
  const progress = getCampaignProgress();
  if (!progress.completed.includes(missionId)) {
    progress.completed.push(missionId);
    localStorage.setItem(CP_KEY(user), JSON.stringify(progress));
    window.dispatchEvent(new CustomEvent("rpg_campaign_updated"));
  }
}

export function getNextMission(missionId) {
  const idx = MISSIONS.findIndex((m) => m.id === missionId);
  return idx >= 0 && idx < MISSIONS.length - 1 ? MISSIONS[idx + 1] : null;
}
