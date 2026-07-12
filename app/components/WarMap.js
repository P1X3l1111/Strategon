"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  spendMana, awardMana,
  spendOil,  awardOil,
  awardGems,
  STARTING_MANA, STARTING_OIL,
} from "../data/troops";
import { bumpQuestStat } from "../data/quests";
import { completeMission, getNextMission } from "../data/campaign";
import { GENERALS, applyGeneralBoost, getEffectiveGeneral, isCommanderOwned, getBattleSlotCount } from "../data/generals";
import { normalizeMapData } from "./MapEditor";

// ── Grid ──────────────────────────────────────────────────────────────────────
const COLS = 32, ROWS = 18;
const PLAYER_MAX_COL = COLS / 2; // matches the dividing road (col 16) and the enemy AI's build zone start

const TR = {
  B: { bg:'#243d10', pass:true  },
  E: { bg:'#243d10', pass:true  },
  G: { bg:'#243d10', pass:true  },
  R: { bg:'#7a6448', pass:true  },
  F: { bg:'#152e08', pass:false },
  M: { bg:'#4a4545', pass:false },
  W: { bg:'#173d60', pass:false },
};

function makeGrid() {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill('G'));
  for (let c = 0; c < COLS; c++) { g[3][c] = 'R'; g[14][c] = 'R'; }
  for (let r = 3; r <= 14; r++) g[r][16] = 'R';
  [[0,6],[1,6],[1,7],[0,7],[2,6]].forEach(([r,c])=>g[r][c]='F');
  [[4,9],[5,9],[5,10],[6,9],[4,10]].forEach(([r,c])=>g[r][c]='F');
  [[15,8],[16,8],[16,9],[17,8],[15,9]].forEach(([r,c])=>g[r][c]='F');
  [[1,22],[2,22],[1,23],[2,23],[0,22]].forEach(([r,c])=>g[r][c]='F');
  [[11,24],[12,24],[12,25],[11,25],[13,24]].forEach(([r,c])=>g[r][c]='F');
  [[4,27],[5,27],[5,28],[6,27],[4,28]].forEach(([r,c])=>g[r][c]='F');
  [[0,11],[0,12],[1,11],[1,12],[2,11]].forEach(([r,c])=>g[r][c]='M');
  [[15,20],[16,20],[17,20],[16,21],[17,21]].forEach(([r,c])=>g[r][c]='M');
  [[8,26],[9,26],[9,27],[10,26],[10,27]].forEach(([r,c])=>g[r][c]='M');
  for (let r = 6; r <= 11; r++) for (let c = 18; c <= 21; c++) g[r][c] = 'W';
  [[5,18],[5,19],[12,20],[12,21]].forEach(([r,c])=>g[r][c]='W');
  return g;
}
const GRID = makeGrid();

// ── Unit definitions ──────────────────────────────────────────────────────────
const UD = {
  factory:     { name:'Factory',          mana:100, hp:80,  atk:0,  mov:0, range:0, mpt:5,  cat:'struct'   },
  oil_pump:    { name:'Oil Pump',         mana:150, hp:60,  atk:0,  mov:0, range:0, opt:3,  cat:'struct'   },
  barricade:   { name:'Barricade',        mana:120, hp:150, atk:0,  mov:0, range:0,         cat:'struct'   },
  inf_light:   { name:'Light Infantry',   mana:50,  hp:30,  atk:8,  mov:3, range:1,         cat:'infantry' },
  inf_assault: { name:'Assault Infantry', mana:60,  hp:35,  atk:10, mov:3, range:1,         cat:'infantry' },
  inf_motor:   { name:'Motorized Inf.',   mana:80,  hp:32,  atk:9,  mov:5, range:1, opm:1, cat:'infantry' },
  commandos:   { name:'Commandos',        mana:100, hp:45,  atk:16, mov:4, range:2,         cat:'infantry' },
  armor_car:   { name:'Armored Car',      mana:150, hp:50,  atk:12, mov:5, range:1, opm:2, cat:'armor'    },
  tank_light:  { name:'Light Tank',       mana:180, hp:70,  atk:15, mov:3, range:2, opm:2, cat:'armor'    },
  tank_heavy:  { name:'Heavy Tank',       mana:200, hp:100, atk:22, mov:2, range:2, opm:3, cat:'armor'    },
  artillery:   { name:'Field Artillery',  mana:140, hp:28,  atk:18, mov:2, range:4, opm:1, cat:'artillery'},
  howitzer:    { name:'Howitzer',         mana:170, hp:32,  atk:22, mov:1, range:5, opm:1, cat:'artillery'},
  rocket:      { name:'Rocket Artillery', mana:220, hp:35,  atk:28, mov:2, range:5, opm:2, cat:'artillery'},
  landmine:    { name:'Landmine',         mana:30,  hp:5,   atk:25, mov:0, range:0,         cat:'trap'     },
};
const SHOP_CATS  = ['struct','infantry','armor','artillery','trap'];
const CAT_LABELS = { struct:'Struct', infantry:'Inf', armor:'Armor', artillery:'Arty', trap:'Trap' };
const MODES = [
  { id:'classic', name:'Classic', color:'#6366f1' },
  { id:'endless', name:'Endless', color:'#16a34a' },
  { id:'siege',   name:'Siege',   color:'#dc2626' },
  { id:'turns',   name:'Turns',   color:'#0ea5e9' },
];

// Victory rewards for non-mission modes (Campaign missions define their own
// rewardMana/rewardGems/rewardOil instead). Every win pays out all three so
// oil doesn't lag behind mana as an income source between battles.
const WIN_REWARDS = {
  classic: { mana: 200, gems: 10, oil: 100 },
  siege:   { mana: 220, gems: 15, oil: 110 },
  turns:   { mana: 200, gems: 10, oil: 100 },
};

// Enemy AI: tiers of what it reaches for as the battle drags on, so it grows its army
// like a human would (cheap chaff early, better hardware once its economy can support it)
// instead of looping the same single unit forever.
const ENEMY_TIER_EARLY = ['inf_light','inf_assault','barricade'];
const ENEMY_TIER_MID   = ['commandos','inf_motor','armor_car','artillery'];
const ENEMY_TIER_LATE  = ['tank_light','tank_heavy','howitzer','rocket'];
const ENEMY_MAX_FACTORIES = 4;

// Decides what the enemy should build next, or null to save up. `elapsed` is a rough
// clock (ticks in real-time modes, turn number in turns mode) used to widen the troop
// pool and grow the factory count over the course of the battle.
function enemyDecideBuild(cur, mana, elapsed) {
  const enemyFactories = cur.filter(u=>u.faction==='enemy'&&u.type==='factory'&&u.hp>0).length;
  const factoryTarget = Math.min(ENEMY_MAX_FACTORIES, 1 + Math.floor(elapsed/40));
  if (enemyFactories < factoryTarget && mana >= UD.factory.mana) return 'factory';

  const pool = elapsed<15 ? ENEMY_TIER_EARLY
             : elapsed<35 ? [...ENEMY_TIER_EARLY, ...ENEMY_TIER_MID]
             : [...ENEMY_TIER_EARLY, ...ENEMY_TIER_MID, ...ENEMY_TIER_LATE];
  const affordable = pool.filter(t=>UD[t].mana<=mana);
  if (!affordable.length) return null;
  // Lean towards the pricier/stronger options among what it can afford, not always the cheapest.
  affordable.sort((a,b)=>UD[b].mana-UD[a].mana);
  const top = affordable.slice(0, Math.max(1, Math.ceil(affordable.length/2)));
  return top[Math.floor(Math.random()*top.length)];
}

// ── Multi-cell helpers ────────────────────────────────────────────────────────
function unitCells(u) {
  const s = u.size || 1;
  const out = [];
  for (let dr = 0; dr < s; dr++)
    for (let dc = 0; dc < s; dc++)
      out.push([u.col+dc, u.row+dr]);
  return out;
}
function cellOccupied(col, row, units, excludeId=null) {
  return units.some(u => u.id!==excludeId && u.hp>0 &&
    unitCells(u).some(([c,r]) => c===col && r===row));
}
function unitDist(a, b) {
  let min = Infinity;
  for (const [ac,ar] of unitCells(a))
    for (const [bc,br] of unitCells(b))
      min = Math.min(min, Math.abs(ac-bc)+Math.abs(ar-br));
  return min;
}

// BFS pathfinding — returns first step toward (toCol,toRow), or null if unreachable
function findNextStep(fromCol, fromRow, toCol, toRow, allUnits, grid, excludeId=null) {
  if (fromCol===toCol && fromRow===toRow) return null;
  const occ = new Set(
    allUnits.filter(u => u.id!==excludeId && u.hp>0)
      .flatMap(u => unitCells(u).map(([c,r]) => `${c},${r}`))
  );
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (let i=dirs.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [dirs[i],dirs[j]]=[dirs[j],dirs[i]]; }
  const visited = new Set([`${fromCol},${fromRow}`]);
  const queue = [{col:fromCol, row:fromRow, first:null}];
  while (queue.length) {
    const {col, row, first} = queue.shift();
    for (const [dc,dr] of dirs) {
      const nc=col+dc, nr=row+dr;
      if (nc<0||nc>=COLS||nr<0||nr>=ROWS) continue;
      if (!TR[grid[nr]?.[nc]]?.pass) continue;
      const nk = `${nc},${nr}`;
      if (visited.has(nk)) continue;
      visited.add(nk);
      const step = first || {col:nc, row:nr};
      if (nc===toCol && nr===toRow) return step;
      if (!occ.has(nk)) queue.push({col:nc, row:nr, first:step});
    }
  }
  return null;
}

function findEnemySpot(allUnits, grid) {
  const candidates = [];
  for (let r=1; r<ROWS-1; r++) {
    for (let c=Math.floor(COLS/2); c<COLS-2; c++) {
      if (!TR[grid[r]?.[c]]?.pass) continue;
      if (cellOccupied(c, r, allUnits)) continue;
      candidates.push({col:c, row:r});
    }
  }
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random()*candidates.length)];
}

function getInRange(attacker, allUnits) {
  return allUnits.filter(u => u.faction!==attacker.faction && u.hp>0 && unitDist(attacker,u)<=attacker.range);
}
function rollDmg(atk) { return Math.max(1, atk-2+Math.floor(Math.random()*5)); }

// ── Turns-mode helpers ──────────────────────────────────────────────────────────
// All cells a unit could stop on this turn, BFS-limited to its `mov` stat.
function getReachableCells(unit, allUnits, grid) {
  if (!unit.mov) return [];
  const occ = new Set(
    allUnits.filter(u => u.id!==unit.id && u.hp>0).flatMap(u => unitCells(u).map(([c,r]) => `${c},${r}`))
  );
  const visited = new Set([`${unit.col},${unit.row}`]);
  const queue = [{col:unit.col, row:unit.row, steps:0}];
  const result = [];
  while (queue.length) {
    const {col,row,steps} = queue.shift();
    if (steps>0 && !occ.has(`${col},${row}`)) result.push({col,row});
    if (steps>=unit.mov) continue;
    for (const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc=col+dc, nr=row+dr, nk=`${nc},${nr}`;
      if (nc<0||nc>=COLS||nr<0||nr>=ROWS||visited.has(nk)) continue;
      if (!TR[grid[nr]?.[nc]]?.pass) continue;
      visited.add(nk);
      queue.push({col:nc, row:nr, steps:steps+1});
    }
  }
  return result;
}
// Walks up to `mov` single steps toward a target, stopping early once in range —
// used for the enemy AI's turn so it uses its full movement in one animated glide.
function computeMultiStepDestination(unit, targetCol, targetRow, allUnits, grid) {
  let col = unit.col, row = unit.row;
  for (let i=0; i<unit.mov; i++) {
    if (Math.abs(col-targetCol)+Math.abs(row-targetRow) <= unit.range) break;
    const step = findNextStep(col, row, targetCol, targetRow, allUnits, grid, unit.id);
    if (!step) break;
    col = step.col; row = step.row;
  }
  return { col, row };
}

let UID = 1;
function mkUD(type, col, row, faction) {
  const def = UD[type];
  return {
    id:`u${UID++}`, type, faction, col, row, size:1,
    name:def.name, hp:def.hp, maxHp:def.hp,
    atk:def.atk||0, mov:def.mov||0, range:def.range||0,
    opm:def.opm||0, mpt:def.mpt||0, opt:def.opt||0,
    behavior: faction==='enemy' ? 'attack' : 'defend_spot',
  };
}


// Built-in fallbacks used whenever the admin hasn't customized a map's placements yet.
const DEFAULT_CP       = { classic: {col:1, row:8}, siege: {col:7, row:8} };
const DEFAULT_OUTPOSTS = {
  classic: [{col:2,row:4}, {col:2,row:13}],
  siege:   [{col:5,row:9}, {col:10,row:9}],
};
const DEFAULT_SIEGE_ENEMIES = [
  {type:'inf_light',   col:7,  row:2},  {type:'inf_light',  col:8,  row:2},  {type:'artillery',  col:9,  row:2},  // north
  {type:'inf_assault', col:6,  row:15}, {type:'tank_light', col:7,  row:15}, {type:'inf_light',  col:10, row:15}, // south
  {type:'armor_car',   col:13, row:8},  {type:'inf_assault',col:13, row:9},  {type:'artillery',  col:13, row:10}, // east
  {type:'inf_light',   col:3,  row:8},  {type:'commandos',  col:3,  row:9},  {type:'tank_light', col:3,  row:10}, // west
];

function makeInitialUnits(mode, mission, layout) {
  const cp       = layout?.commandPost || DEFAULT_CP[mode] || DEFAULT_CP.classic;
  const outposts = (layout?.outposts?.length ? layout.outposts : null) || DEFAULT_OUTPOSTS[mode] || DEFAULT_OUTPOSTS.classic;

  if (mode === 'siege') {
    // Castle sits in the middle of the player's own half, already encircled —
    // no enemy HQ to push toward, just a garrison to break on every side.
    const enemies = (layout?.enemyUnits?.length ? layout.enemyUnits : null) || DEFAULT_SIEGE_ENEMIES;
    return [
      { id:`b${UID++}`, type:'base_main', size:2, faction:'player', col:cp.col, row:cp.row, name:'Command Post', hp:1000, maxHp:1000, atk:5, mov:0, range:3, opm:0, mpt:0, opt:0, behavior:'defend_spot' },
      ...outposts.map(o => ({ id:`b${UID++}`, type:'base_fort', size:1, faction:'player', col:o.col, row:o.row, name:'Outpost', hp:250, maxHp:250, atk:8, mov:0, range:3, opm:0, mpt:0, opt:0, behavior:'defend_spot' })),
      ...enemies.map(e => mkUD(e.type, e.col, e.row, 'enemy')),
    ];
  }

  const units = [
    { id:`b${UID++}`, type:'base_main', size:2, faction:'player', col:cp.col, row:cp.row, name:'Command Post', hp:1000, maxHp:1000, atk:5, mov:0, range:3, opm:0, mpt:0, opt:0, behavior:'defend_spot' },
    ...outposts.map(o => ({ id:`b${UID++}`, type:'base_fort', size:1, faction:'player', col:o.col, row:o.row, name:'Outpost', hp:250, maxHp:250, atk:8, mov:0, range:3, opm:0, mpt:0, opt:0, behavior:'defend_spot' })),
  ];
  if (mission) {
    for (const e of mission.enemyUnits) {
      const nu = mkUD(e.type, e.col, e.row, 'enemy');
      if (e.capture) nu.capture = true;
      units.push(nu);
    }
  } else if (mode !== 'endless') {
    units.push(
      { id:`b${UID++}`, type:'enemy_hq',   size:2, faction:'enemy', col:29, row:7,  name:'Enemy HQ',   hp:600, maxHp:600, atk:6,  mov:0, range:2, opm:0, mpt:0, opt:0 },
      { id:`b${UID++}`, type:'enemy_fort', size:1, faction:'enemy', col:29, row:2,  name:'Enemy Post', hp:300, maxHp:300, atk:10, mov:0, range:4, opm:0, mpt:0, opt:0 },
      { id:`b${UID++}`, type:'enemy_fort', size:1, faction:'enemy', col:30, row:15, name:'Enemy Post', hp:300, maxHp:300, atk:10, mov:0, range:4, opm:0, mpt:0, opt:0 },
    );
  }
  return units;
}

// ── SVG shapes ────────────────────────────────────────────────────────────────
function UShape({ type, color='#3b82f6', size=38 }) {
  const c=color, s='rgba(0,0,0,0.45)', v='0 0 38 38';
  switch(type) {
    case 'base_main':  return <svg width={size} height={size} viewBox={v}><rect x="2" y="16" width="34" height="20" fill={c} rx="2"/><rect x="7" y="9" width="24" height="9" fill={c} rx="2"/><rect x="13" y="4" width="12" height="7" fill={c} rx="1"/><rect x="5" y="22" width="5" height="9" fill={s} rx="1"/><rect x="17" y="22" width="4" height="9" fill={s} rx="1"/><rect x="28" y="22" width="5" height="9" fill={s} rx="1"/><line x1="19" y1="4" x2="19" y2="0" stroke="#9ca3af" strokeWidth="1.5"/><polygon points="19,0 24,2 19,4" fill="#ef4444"/></svg>;
    case 'base_fort':  return <svg width={size} height={size} viewBox={v}><rect x="4" y="16" width="30" height="20" fill={c} rx="2"/><rect x="4" y="12" width="7" height="6" fill={c}/><rect x="27" y="12" width="7" height="6" fill={c}/><rect x="14" y="10" width="10" height="8" fill={c} rx="1"/><rect x="8" y="22" width="5" height="9" fill={s} rx="1"/><rect x="25" y="22" width="5" height="9" fill={s} rx="1"/></svg>;
    case 'enemy_hq':   return <svg width={size} height={size} viewBox={v}><rect x="3" y="15" width="32" height="21" fill={c} rx="1"/><rect x="8" y="8" width="22" height="9" fill={c} rx="1"/><polygon points="8,8 14,1 20,8" fill={c}/><polygon points="18,8 24,1 30,8" fill={c}/><rect x="7" y="21" width="5" height="10" fill={s}/><rect x="17" y="21" width="4" height="10" fill={s}/><rect x="26" y="21" width="5" height="10" fill={s}/></svg>;
    case 'enemy_fort': return <svg width={size} height={size} viewBox={v}><rect x="5" y="17" width="28" height="19" fill={c} rx="1"/><rect x="5" y="12" width="7" height="7" fill={c}/><rect x="26" y="12" width="7" height="7" fill={c}/><polygon points="5,12 9,6 13,12" fill={c}/><polygon points="25,12 29,6 33,12" fill={c}/><rect x="11" y="23" width="5" height="8" fill={s}/><rect x="22" y="23" width="5" height="8" fill={s}/></svg>;
    case 'factory':    return <svg width={size} height={size} viewBox={v}><rect x="3" y="18" width="32" height="17" fill={c} rx="1"/><rect x="6" y="9" width="5" height="11" fill={c}/><rect x="16" y="7" width="5" height="13" fill={c}/><rect x="26" y="11" width="4" height="9" fill={c}/><rect x="6" y="23" width="4" height="7" fill={s}/><rect x="16" y="23" width="4" height="7" fill={s}/><rect x="26" y="23" width="4" height="7" fill={s}/><line x1="8" y1="9" x2="8" y2="4" stroke="#9ca3af" strokeWidth="2"/><line x1="18" y1="7" x2="18" y2="2" stroke="#9ca3af" strokeWidth="2"/><line x1="28" y1="11" x2="28" y2="6" stroke="#9ca3af" strokeWidth="2"/></svg>;
    case 'oil_pump':   return <svg width={size} height={size} viewBox={v}><rect x="16" y="20" width="6" height="16" fill={c}/><rect x="9" y="28" width="20" height="4" fill={c} rx="1"/><path d="M 7 20 L 19 7 L 31 20" fill="none" stroke={c} strokeWidth="3.5"/><rect x="15" y="5" width="8" height="5" fill={c} rx="1"/><rect x="4" y="18" width="30" height="4" fill={c} rx="1"/><circle cx="19" cy="15" r="4" fill={s}/></svg>;
    case 'barricade':  return <svg width={size} height={size} viewBox={v}><rect x="1" y="13" width="36" height="12" fill={c} rx="1"/><rect x="3" y="13" width="5" height="12" fill={s} rx="1"/><rect x="16" y="13" width="5" height="12" fill={s} rx="1"/><rect x="29" y="13" width="5" height="12" fill={s} rx="1"/></svg>;
    case 'inf_light':  return <svg width={size} height={size} viewBox={v}><circle cx="19" cy="9" r="5.5" fill={c}/><rect x="13" y="16" width="12" height="13" fill={c} rx="2"/><line x1="10" y1="18" x2="12" y2="24" stroke={c} strokeWidth="3.5" strokeLinecap="round"/><line x1="28" y1="18" x2="26" y2="24" stroke={c} strokeWidth="3.5" strokeLinecap="round"/><line x1="15" y1="29" x2="13" y2="37" stroke={c} strokeWidth="3.5" strokeLinecap="round"/><line x1="23" y1="29" x2="25" y2="37" stroke={c} strokeWidth="3.5" strokeLinecap="round"/></svg>;
    case 'inf_assault':return <svg width={size} height={size} viewBox={v}><circle cx="19" cy="8" r="5" fill={c}/><rect x="13" y="14" width="12" height="13" fill={c} rx="2"/><rect x="6" y="15" width="8" height="10" fill={c} rx="1" opacity="0.85"/><line x1="6" y1="15" x2="6" y2="28" stroke={c} strokeWidth="3.5" strokeLinecap="round"/><line x1="30" y1="17" x2="28" y2="23" stroke={c} strokeWidth="3.5" strokeLinecap="round"/><line x1="15" y1="27" x2="13" y2="37" stroke={c} strokeWidth="3.5" strokeLinecap="round"/><line x1="23" y1="27" x2="25" y2="37" stroke={c} strokeWidth="3.5" strokeLinecap="round"/></svg>;
    case 'inf_motor':  return <svg width={size} height={size} viewBox={v}><rect x="2" y="13" width="34" height="15" fill={c} rx="3"/><rect x="6" y="7" width="22" height="8" fill={c} rx="2" opacity="0.9"/><circle cx="9" cy="30" r="4.5" fill={s}/><circle cx="29" cy="30" r="4.5" fill={s}/><circle cx="9" cy="30" r="2" fill="#6b7280"/><circle cx="29" cy="30" r="2" fill="#6b7280"/></svg>;
    case 'commandos':  return <svg width={size} height={size} viewBox={v}><polygon points="19,2 35,19 19,36 3,19" fill={c}/><circle cx="19" cy="19" r="7" fill={s}/></svg>;
    case 'armor_car':  return <svg width={size} height={size} viewBox={v}><rect x="2" y="14" width="34" height="14" fill={c} rx="4"/><rect x="6" y="9" width="24" height="7" fill={c} rx="3" opacity="0.9"/><circle cx="9" cy="30" r="4" fill={s}/><circle cx="29" cy="30" r="4" fill={s}/><circle cx="9" cy="30" r="2" fill="#6b7280"/><circle cx="29" cy="30" r="2" fill="#6b7280"/><rect x="27" y="11" width="8" height="3" fill={c} rx="1"/></svg>;
    case 'tank_light': return <svg width={size} height={size} viewBox={v}><rect x="0" y="18" width="38" height="13" fill={c} rx="2"/><rect x="4" y="12" width="30" height="8" fill={c} rx="2"/><rect x="10" y="7" width="18" height="7" fill={c} rx="2"/><rect x="22" y="8" width="12" height="4" fill={c} rx="1"/><rect x="0" y="20" width="38" height="4" fill={s}/><circle cx="6" cy="32" r="3.5" fill={s}/><circle cx="14" cy="32" r="3.5" fill={s}/><circle cx="24" cy="32" r="3.5" fill={s}/><circle cx="32" cy="32" r="3.5" fill={s}/></svg>;
    case 'tank_heavy': return <svg width={size} height={size} viewBox={v}><rect x="0" y="19" width="38" height="14" fill={c} rx="2"/><rect x="3" y="12" width="32" height="9" fill={c} rx="2"/><rect x="8" y="7" width="22" height="7" fill={c} rx="2"/><rect x="19" y="5" width="16" height="5" fill={c} rx="1"/><rect x="0" y="22" width="38" height="5" fill={s}/><circle cx="5" cy="34" r="4" fill={s}/><circle cx="13" cy="34" r="4" fill={s}/><circle cx="25" cy="34" r="4" fill={s}/><circle cx="33" cy="34" r="4" fill={s}/></svg>;
    case 'artillery':  return <svg width={size} height={size} viewBox={v}><rect x="2" y="20" width="30" height="11" fill={c} rx="2"/><rect x="7" y="14" width="22" height="8" fill={c} rx="2"/><rect x="13" y="6" width="20" height="5" fill={c} rx="2" transform="rotate(-8,13,8)"/><circle cx="8" cy="32" r="4.5" fill={s}/><circle cx="24" cy="32" r="4.5" fill={s}/></svg>;
    case 'howitzer':   return <svg width={size} height={size} viewBox={v}><rect x="1" y="22" width="32" height="12" fill={c} rx="2"/><rect x="6" y="16" width="24" height="8" fill={c} rx="2"/><rect x="9" y="4" width="24" height="5" fill={c} rx="2" transform="rotate(-12,9,7)"/><circle cx="6" cy="35" r="5" fill={s}/><circle cx="26" cy="35" r="5" fill={s}/></svg>;
    case 'rocket':     return <svg width={size} height={size} viewBox={v}><rect x="2" y="23" width="30" height="11" fill={c} rx="2"/><rect x="6" y="8" width="6" height="17" fill={c} rx="2"/><rect x="14" y="8" width="6" height="17" fill={c} rx="2"/><rect x="22" y="8" width="6" height="17" fill={c} rx="2"/><polygon points="6,8 9,2 12,8" fill={c}/><polygon points="14,8 17,2 20,8" fill={c}/><polygon points="22,8 25,2 28,8" fill={c}/><circle cx="9" cy="34" r="4" fill={s}/><circle cx="25" cy="34" r="4" fill={s}/></svg>;
    case 'landmine':   return <svg width={size} height={size} viewBox={v}><circle cx="19" cy="22" r="12" fill={c}/><circle cx="19" cy="22" r="7" fill={s}/><line x1="19" y1="10" x2="19" y2="5" stroke={c} strokeWidth="3" strokeLinecap="round"/><line x1="28" y1="13" x2="31" y2="10" stroke={c} strokeWidth="3" strokeLinecap="round"/><line x1="31" y1="22" x2="36" y2="22" stroke={c} strokeWidth="3" strokeLinecap="round"/><line x1="10" y1="13" x2="7" y2="10" stroke={c} strokeWidth="3" strokeLinecap="round"/></svg>;
    case 'goblin':     return <svg width={size} height={size} viewBox={v}><circle cx="19" cy="10" r="7" fill={c}/><polygon points="12,10 6,38 32,38" fill={c}/><circle cx="16" cy="9" r="2" fill={s}/><circle cx="22" cy="9" r="2" fill={s}/></svg>;
    case 'orc':        return <svg width={size} height={size} viewBox={v}><rect x="7" y="6" width="24" height="28" fill={c} rx="4"/><rect x="2" y="12" width="8" height="16" fill={c} rx="2"/><rect x="28" y="12" width="8" height="16" fill={c} rx="2"/><rect x="11" y="10" width="5" height="6" fill={s}/><rect x="22" y="10" width="5" height="6" fill={s}/></svg>;
    default:           return <svg width={size} height={size} viewBox={v}><circle cx="19" cy="19" r="14" fill={c}/></svg>;
  }
}

// ── Unit sprite ───────────────────────────────────────────────────────────────
// Troops render as small round tokens and glide continuously toward their
// logical grid cell (via rAF) instead of snapping cell-to-cell; combat,
// pathfinding and occupancy all still key off the logical col/row untouched.
function UnitSprite({ u, C, isSel, isShaking, isActed, onSelect }) {
  const posRef = useRef({ col: u.col, row: u.row });
  const rafRef = useRef(null);
  const [, bump] = useState(0);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const target = { col: u.col, row: u.row };
    const speed = 0.85 + (u.mov || 0) * 0.12; // cells/sec
    let last = performance.now();
    function step(now) {
      const dt = (now - last) / 1000; last = now;
      const p = posRef.current;
      const dx = target.col - p.col, dy = target.row - p.row;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.015) {
        posRef.current = target;
        rafRef.current = null;
        bump(n => n + 1);
        return;
      }
      const move = Math.min(dist, speed * dt);
      posRef.current = { col: p.col + (dx / dist) * move, row: p.row + (dy / dist) * move };
      bump(n => n + 1);
      rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u.col, u.row]);

  const { col, row } = posRef.current;
  const sz = u.size || 1, w = sz * C, h = sz * C;
  const isPlayer = u.faction === 'player';
  const uCol = isPlayer ? (isSel ? '#818cf8' : '#3b82f6') : '#ef4444';
  const isTroop = u.mov > 0;

  return (
    <div
      onClick={() => onSelect(u.col, u.row)}
      className={isShaking ? 'anim-shake' : ''}
      style={{
        position: 'absolute', left: col * C, top: row * C, width: w, height: h,
        zIndex: 10, cursor: 'pointer', boxSizing: 'border-box',
        outline: isSel ? '2px solid #818cf8' : u.capture ? '2px dashed #facc15' : 'none', outlineOffset: '-2px',
        boxShadow: u.general ? '0 0 0 2px #f59e0b, 0 0 6px 1px rgba(245,158,11,0.7)' : 'none',
      }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isTroop
          ? <div style={{
              width: Math.min(w, h) * 0.5, height: Math.min(w, h) * 0.5, borderRadius: '50%',
              background: uCol, border: '2px solid rgba(0,0,0,0.5)', boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }} />
          : <UShape type={u.type} color={uCol} size={Math.min(w, h) - 6} />}
      </div>
      <div style={{ position: 'absolute', bottom: 2, left: 4, right: 4, height: 3, background: 'rgba(55,65,81,0.85)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: u.hp > u.maxHp * .5 ? '#22c55e' : u.hp > u.maxHp * .25 ? '#eab308' : '#ef4444',
          width: `${Math.max(0, u.hp / u.maxHp * 100)}%`,
        }} />
      </div>
      {isPlayer && u.mov > 0 && u.behavior && u.behavior !== 'defend_spot' && (
        <div style={{
          position: 'absolute', top: 1, right: 1, fontSize: 7, fontWeight: 900, lineHeight: 1,
          background: 'rgba(0,0,0,0.8)', borderRadius: 2, padding: '1px 2px',
          color: u.behavior === 'attack' ? '#f87171' : u.behavior === 'defend_castle' ? '#67e8f9' : '#9ca3af',
        }}>
          {u.behavior === 'attack' ? 'ATK' : u.behavior === 'defend_castle' ? 'DEF' : 'IDLE'}
        </div>
      )}
      {isActed && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <span style={{ fontSize:7, fontWeight:900, color:'#a1a1aa', textTransform:'uppercase', letterSpacing:'0.05em' }}>done</span>
        </div>
      )}
      {u.general && (
        <div style={{ position:'absolute', top:-6, left:'50%', transform:'translateX(-50%)', fontSize:10, lineHeight:1, pointerEvents:'none' }}>⭐</div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function WarMap({ mode, mission, onBack, onNextMission }) {
  return <GameBoard mode={mode} mission={mission} onBack={onBack} onNextMission={onNextMission} />;
}

function GameBoard({ mode, mission, onBack, onNextMission }) {
  const [mana, setMana] = useState(STARTING_MANA);
  const [oil,  setOil]  = useState(STARTING_OIL);
  const [ready, setReady] = useState(false);

  // Load custom map for this mode from localStorage (set by admin map editor) —
  // terrain plus admin-placed Command Post / Outposts / (Siege) enemy garrison.
  const [mapData] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' && localStorage.getItem(`rpg_map_${mode}`);
      if (saved) return normalizeMapData(JSON.parse(saved));
    } catch {}
    return null;
  });
  const activeGrid = mapData?.terrain || null;

  useEffect(() => { setReady(true); }, []);

  const unitsRef = useRef(null);
  const [units, setUnitsRaw] = useState(() => {
    const init = makeInitialUnits(mode, mission, mapData);
    unitsRef.current = init;
    return init;
  });
  function setUnits(u) {
    const next = typeof u==='function' ? u(unitsRef.current) : u;
    unitsRef.current = next; setUnitsRaw(next);
  }

  // Campaign: how many "capture" flagged enemy units have been taken so far
  const [capturedCount, setCapturedCount] = useState(0);
  const capturedRef = useRef(0);
  function addCaptured(n=1) { capturedRef.current += n; setCapturedCount(capturedRef.current); }

  const phaseRef = useRef('setup');
  const [phase, setPhaseRaw] = useState('setup');
  function setPhase(p) { phaseRef.current = p; setPhaseRaw(p); }

  const mapRef  = useRef(null);
  const gridRef = useRef(null);
  const [cellSize, setCellSize] = useState(40);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const measure = () => {
      const el = mapRef.current; if (!el) return;
      setCellSize(Math.max(Math.min(Math.floor(el.clientWidth/COLS), Math.floor(el.clientHeight/ROWS)), 18));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(mapRef.current);
    return () => ro.disconnect();
  }, [ready]);

  // Enemy AI state
  const enemyManaRef     = useRef(STARTING_MANA);
  const enemyAITimer     = useRef(0);

  // Turns-mode state — the real-time loop below is skipped entirely for mode==='turns'
  const [turnPhase, setTurnPhase]   = useState('player'); // 'player' | 'enemy'
  const turnNumberRef = useRef(1);
  const [turnNumber, setTurnNumberRaw] = useState(1);
  function setTurnNumber(n) { turnNumberRef.current = n; setTurnNumberRaw(n); }
  const actedIdsRef = useRef(new Set());
  const [actedIds, setActedIdsRaw] = useState(new Set());
  function setActedIds(s) { actedIdsRef.current = s; setActedIdsRaw(s); }
  const [moveTargets, setMoveTargets]     = useState([]); // [{col,row}]
  const [attackTargets, setAttackTargets] = useState([]); // [{col,row,id}]
  const enemyTurnRunningRef = useRef(false);

  // Commanders — arm one at a time, assign each to a different troop, up to
  // however many battle slots the player has bought (see data/generals.js).
  const [selectedGeneral, setSelectedGeneral] = useState(null); // armed commander awaiting a target click
  const [assignedGenerals, setAssignedGenerals] = useState([]); // [{generalId,unitId,level,name,icon,color}]
  const [battleSlotCount, setBattleSlotCount] = useState(() => getBattleSlotCount());
  const [winReward, setWinReward] = useState(null); // non-mission victory payout, shown on the win overlay

  // Placement hover — track which cell cursor is over during pending placement
  const [hoverCell, setHoverCell] = useState(null);

  // Selection — Set of unit IDs
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [pendingType, setPending]  = useState(null);
  const [shopCat,     setShopCat]  = useState('struct');

  // Drag-select
  const dragStart = useRef(null);
  const [dragBox, setDragBox]     = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [flashCells, setFlashCells] = useState(new Set());
  const [shakingIds, setShakingIds] = useState(new Set());
  const [dmgPopups,  setDmgPopups]  = useState([]);
  const dmgKey = useRef(0);

  const [log, setLog] = useState(['Deploy your Factory — the battle begins the instant you place it.']);
  const addLog = useCallback((msg) => setLog(p => [msg,...p].slice(0,20)), []);

  function flashCell(col, row) {
    const k=`${col},${row}`;
    setFlashCells(p=>new Set([...p,k]));
    setTimeout(()=>setFlashCells(p=>{const n=new Set(p);n.delete(k);return n;}),450);
  }
  function shakeUnit(id) {
    setShakingIds(p=>new Set([...p,id]));
    setTimeout(()=>setShakingIds(p=>{const n=new Set(p);n.delete(id);return n;}),450);
  }
  function popDmg(col, row, dmg) {
    const key=`d${dmgKey.current++}`;
    setDmgPopups(p=>[...p,{key,col,row,dmg}]);
    setTimeout(()=>setDmgPopups(p=>p.filter(d=>d.key!==key)),950);
  }

  const modeConfig    = MODES.find(m=>m.id===mode);
  const factoryPlaced = units.some(u=>u.type==='factory'&&u.faction==='player'&&u.hp>0);
  const oilPumpPlaced = units.some(u=>u.type==='oil_pump'&&u.faction==='player'&&u.hp>0);
  const G = activeGrid; // shorthand — null means no map configured

  // ── Game loop (real-time modes only — turns mode uses the turn engine below) ──
  useEffect(() => {
    if (phase !== 'battle' || mode === 'turns') return;
    let tick = 0;
    const id = setInterval(() => {
      if (phaseRef.current !== 'battle') return;
      tick++;
      let cur = unitsRef.current.map(u=>({...u}));
      const events = [];

      // Player resources
      const playerFactories = cur.filter(u=>u.faction==='player'&&u.type==='factory'&&u.hp>0).length;
      const playerPumps     = cur.filter(u=>u.faction==='player'&&u.type==='oil_pump'&&u.hp>0).length;
      if (playerFactories) { awardMana(playerFactories*5); setMana(m=>m+playerFactories*5); bumpQuestStat('manaEarned', playerFactories*5); }
      if (playerPumps)     { awardOil(playerPumps*3);     setOil(v=>v+playerPumps*3);      bumpQuestStat('oilEarned', playerPumps*3);     }

      // Enemy resources
      const enemyFactories = cur.filter(u=>u.faction==='enemy'&&u.type==='factory'&&u.hp>0).length;
      enemyManaRef.current += enemyFactories * 5;

      // Enemy AI: try to buy and place something every 6 ticks (scripted garrisons — campaign missions and the siege — don't reinforce)
      enemyAITimer.current++;
      if (!mission && mode!=='siege' && enemyAITimer.current >= 6) {
        enemyAITimer.current = 0;
        const buildType = enemyDecideBuild(cur, enemyManaRef.current, tick);
        if (buildType) {
          const spot = findEnemySpot(cur, G);
          if (spot) {
            const nu = mkUD(buildType, spot.col, spot.row, 'enemy');
            cur = [...cur, nu];
            enemyManaRef.current -= UD[buildType].mana;
            addLog(`Enemy built ${UD[buildType].name}!`);
          }
        }
      }

      // Auto-combat
      for (const att of [...cur].filter(u=>u.hp>0&&u.atk>0&&u.range>0)) {
        const live = cur.find(u=>u.id===att.id);
        if (!live||live.hp<=0) continue;
        const foes = cur.filter(u=>u.faction!==live.faction&&u.hp>0&&unitDist(live,u)<=live.range);
        if (!foes.length) continue;
        const t = foes[0];
        const dmg = rollDmg(live.atk);
        cur = cur.map(u=>u.id===t.id?{...u,hp:Math.max(0,u.hp-dmg)}:u);
        events.push({id:t.id,col:t.col,row:t.row,dmg});
        if (live.faction==='player' && t.hp>0 && t.hp-dmg<=0) {
          if (t.capture) { addCaptured(); addLog(`🎯 Captured ${t.name}!`); }
          else bumpQuestStat('enemiesKilled');
        }
      }

      // Enemy movement: BFS every 2 ticks
      if (tick%2===0) {
        for (let i=0;i<cur.length;i++) {
          const en=cur[i];
          if (en.faction!=='enemy'||en.hp<=0||!en.mov) continue;
          const friends=cur.filter(u=>u.faction==='player'&&u.hp>0);
          if (!friends.length) break;
          const nearest=friends.reduce((best,t)=>{const d=unitDist(en,t);return d<best.d?{d,t}:best},{d:Infinity,t:null}).t;
          if (!nearest||unitDist(en,nearest)<=en.range) continue;
          const step=findNextStep(en.col,en.row,nearest.col,nearest.row,cur,G,en.id);
          if (step) cur=cur.map(u=>u.id===en.id?{...u,col:step.col,row:step.row}:u);
        }
      }

      // Player unit AI: BFS movement based on behavior
      for (let i=0;i<cur.length;i++) {
        const pu=cur[i];
        if (pu.faction!=='player'||pu.hp<=0||!pu.mov) continue;
        if (!pu.behavior||pu.behavior==='defend_spot') continue;
        const enemies=cur.filter(u=>u.faction==='enemy'&&u.hp>0);
        if (enemies.some(e=>unitDist(pu,e)<=pu.range)) continue;
        let tc=pu.col, tr=pu.row;
        if (pu.behavior==='attack') {
          if (!enemies.length) continue;
          const ne=enemies.reduce((best,e)=>{const d=unitDist(pu,e);return d<best.d?{d,e}:best},{d:Infinity,e:null}).e;
          if (!ne) continue;
          tc=ne.col; tr=ne.row;
        } else if (pu.behavior==='defend_castle') {
          const castle=cur.find(u=>u.type==='base_main'&&u.faction==='player'&&u.hp>0);
          if (!castle||unitDist(pu,castle)<=3) continue;
          tc=castle.col; tr=castle.row;
        }
        const step=findNextStep(pu.col,pu.row,tc,tr,cur,G,pu.id);
        if (step) cur=cur.map(u=>u.id===pu.id?{...u,col:step.col,row:step.row}:u);
      }

      // Win/lose
      const playerHQ=cur.find(u=>u.type==='base_main');
      if (!playerHQ||playerHQ.hp<=0) {
        setPhase('lost');unitsRef.current=cur;setUnitsRaw(cur);
        addLog('Command Post destroyed — Defeat!');return;
      }
      if (mission) {
        const won = mission.objective==='capture'
          ? capturedRef.current >= mission.captureCount
          : cur.filter(u=>u.faction==='enemy'&&u.hp>0).length===0;
        if (won) {
          setPhase('won');unitsRef.current=cur;setUnitsRaw(cur);
          awardMana(mission.rewardMana||0);awardGems(mission.rewardGems||0);
          if (mission.rewardOil) awardOil(mission.rewardOil);
          setMana(m=>m+(mission.rewardMana||0));
          setOil(o=>o+(mission.rewardOil||0));
          bumpQuestStat('battlesWon');
          if (mission.rewardMana) bumpQuestStat('manaEarned',mission.rewardMana);
          if (mission.rewardOil) bumpQuestStat('oilEarned',mission.rewardOil);
          completeMission(mission.id);
          addLog(`🎖️ ${mission.name} complete — Victory!`);return;
        }
      } else if (mode==='siege') {
        if (cur.filter(u=>u.faction==='enemy'&&u.hp>0).length===0) {
          setPhase('won');unitsRef.current=cur;setUnitsRaw(cur);
          const r=WIN_REWARDS.siege;
          awardMana(r.mana);awardGems(r.gems);awardOil(r.oil);setMana(m=>m+r.mana);setOil(o=>o+r.oil);
          bumpQuestStat('battlesWon');bumpQuestStat('manaEarned',r.mana);bumpQuestStat('oilEarned',r.oil);
          setWinReward(r);
          addLog('Siege broken — Victory!');return;
        }
      } else if (mode!=='endless') {
        const enemyHQ=cur.find(u=>u.type==='enemy_hq');
        if (!enemyHQ||enemyHQ.hp<=0) {
          setPhase('won');unitsRef.current=cur;setUnitsRaw(cur);
          const r=WIN_REWARDS.classic;
          awardMana(r.mana);awardGems(r.gems);awardOil(r.oil);setMana(m=>m+r.mana);setOil(o=>o+r.oil);
          bumpQuestStat('battlesWon');bumpQuestStat('manaEarned',r.mana);bumpQuestStat('oilEarned',r.oil);
          setWinReward(r);
          addLog('Enemy HQ destroyed — Victory!');return;
        }
      }

      unitsRef.current=cur;setUnitsRaw(cur);
      events.slice(0,6).forEach(({col,row,id,dmg})=>{flashCell(col,row);shakeUnit(id);popDmg(col,row,dmg);});
    }, 1000);
    return ()=>clearInterval(id);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Turn engine (mode === 'turns') ────────────────────────────────────────
  function checkTurnsWinLose(cur) {
    const playerHQ = cur.find(u=>u.type==='base_main');
    if (!playerHQ || playerHQ.hp<=0) {
      setPhase('lost'); addLog('Command Post destroyed — Defeat!');
      return true;
    }
    const enemyHQ = cur.find(u=>u.type==='enemy_hq');
    if (!enemyHQ || enemyHQ.hp<=0) {
      setPhase('won');
      const r=WIN_REWARDS.turns;
      awardMana(r.mana); awardGems(r.gems); awardOil(r.oil); setMana(m=>m+r.mana); setOil(o=>o+r.oil);
      bumpQuestStat('battlesWon'); bumpQuestStat('manaEarned',r.mana); bumpQuestStat('oilEarned',r.oil);
      setWinReward(r);
      addLog('Enemy HQ destroyed — Victory!');
      return true;
    }
    return false;
  }

  function collectTurnIncome() {
    const cur = unitsRef.current;
    const playerFactories = cur.filter(u=>u.faction==='player'&&u.type==='factory'&&u.hp>0).length;
    const playerPumps     = cur.filter(u=>u.faction==='player'&&u.type==='oil_pump'&&u.hp>0).length;
    if (playerFactories) { awardMana(playerFactories*10); setMana(m=>m+playerFactories*10); bumpQuestStat('manaEarned', playerFactories*10); }
    if (playerPumps)     { awardOil(playerPumps*6);       setOil(v=>v+playerPumps*6);        bumpQuestStat('oilEarned', playerPumps*6);      }
    const enemyFactories = cur.filter(u=>u.faction==='enemy'&&u.type==='factory'&&u.hp>0).length;
    enemyManaRef.current += enemyFactories*10;
  }

  // Stationary turrets (structures) fire once per side per round — no manual action needed.
  function structuresVolley(faction) {
    let cur = unitsRef.current.map(u=>({...u}));
    const events = [];
    for (const att of cur.filter(u=>u.faction===faction&&u.hp>0&&!u.mov&&u.atk>0&&u.range>0)) {
      const live = cur.find(u=>u.id===att.id);
      if (!live||live.hp<=0) continue;
      const foes = cur.filter(u=>u.faction!==faction&&u.hp>0&&unitDist(live,u)<=live.range);
      if (!foes.length) continue;
      const t = foes[0];
      const dmg = rollDmg(live.atk);
      cur = cur.map(u=>u.id===t.id?{...u,hp:Math.max(0,u.hp-dmg)}:u);
      events.push({id:t.id,col:t.col,row:t.row,dmg});
      if (faction==='player' && t.hp>0 && t.hp-dmg<=0) bumpQuestStat('enemiesKilled');
    }
    setUnits(cur);
    events.forEach(({col,row,id,dmg})=>{flashCell(col,row);shakeUnit(id);popDmg(col,row,dmg);});
    return cur;
  }

  function startPlayerTurn() {
    collectTurnIncome();
    const cur = structuresVolley('player');
    if (checkTurnsWinLose(cur)) return;
    setActedIds(new Set());
    setTurnPhase('player');
    addLog(`Turn ${turnNumberRef.current} — your move.`);
  }

  function endPlayerTurn() {
    if (turnPhase!=='player' || enemyTurnRunningRef.current) return;
    setSelectedIds(new Set()); setMoveTargets([]); setAttackTargets([]);
    runEnemyTurn();
  }

  function markActed(id) {
    const next = new Set(actedIdsRef.current); next.add(id);
    setActedIds(next);
    setSelectedIds(new Set()); setMoveTargets([]); setAttackTargets([]);
    const stillToAct = unitsRef.current.some(u=>u.faction==='player'&&u.hp>0&&u.mov>0&&!next.has(u.id));
    if (!stillToAct) runEnemyTurn();
  }

  function runEnemyTurn() {
    if (enemyTurnRunningRef.current) return;
    enemyTurnRunningRef.current = true;
    setTurnPhase('enemy');
    setSelectedIds(new Set()); setMoveTargets([]); setAttackTargets([]);
    addLog('Enemy turn...');

    // Enemy attempts one purchase per turn, same tiered logic as real-time modes
    let cur = unitsRef.current.map(u=>({...u}));
    const buildType = enemyDecideBuild(cur, enemyManaRef.current, turnNumberRef.current);
    if (buildType) {
      const spot = findEnemySpot(cur, G);
      if (spot) {
        cur = [...cur, mkUD(buildType, spot.col, spot.row, 'enemy')];
        enemyManaRef.current -= UD[buildType].mana;
        addLog(`Enemy built ${UD[buildType].name}!`);
      }
    }
    setUnits(cur);

    cur = structuresVolley('enemy');
    if (checkTurnsWinLose(cur)) { enemyTurnRunningRef.current = false; return; }

    const mobileEnemyIds = cur.filter(u=>u.faction==='enemy'&&u.hp>0&&u.mov>0).map(u=>u.id);
    processEnemyUnit(mobileEnemyIds, 0);
  }

  // Resolves one enemy unit's move+attack per call, then schedules the next after a
  // short delay — the delay is what makes each unit's glide (via UnitSprite) visible
  // one at a time instead of everything jumping at once.
  function processEnemyUnit(ids, idx) {
    if (idx >= ids.length) {
      if (checkTurnsWinLose(unitsRef.current)) { enemyTurnRunningRef.current = false; return; }
      enemyTurnRunningRef.current = false;
      setTurnNumber(turnNumberRef.current + 1);
      startPlayerTurn();
      return;
    }
    setTimeout(() => {
      let cur = unitsRef.current.map(u=>({...u}));
      const en = cur.find(u=>u.id===ids[idx]);
      if (!en || en.hp<=0) { processEnemyUnit(ids, idx+1); return; }
      const friends = cur.filter(u=>u.faction==='player'&&u.hp>0);
      if (!friends.length) { processEnemyUnit(ids, idx+1); return; }
      const nearest = friends.reduce((best,t)=>{const d=unitDist(en,t);return d<best.d?{d,t}:best;},{d:Infinity,t:null}).t;

      if (unitDist(en,nearest) > en.range) {
        const dest = computeMultiStepDestination(en, nearest.col, nearest.row, cur, G);
        if (dest.col!==en.col || dest.row!==en.row) {
          cur = cur.map(u=>u.id===en.id?{...u,col:dest.col,row:dest.row}:u);
        }
      }
      const moved = cur.find(u=>u.id===en.id);
      if (moved.atk>0) {
        const foes = cur.filter(u=>u.faction==='player'&&u.hp>0&&unitDist(moved,u)<=moved.range);
        if (foes.length) {
          const t = foes[0];
          const dmg = rollDmg(moved.atk);
          cur = cur.map(u=>u.id===t.id?{...u,hp:Math.max(0,u.hp-dmg)}:u);
          flashCell(t.col,t.row); shakeUnit(t.id); popDmg(t.col,t.row,dmg);
        }
      }
      setUnits(cur);
      processEnemyUnit(ids, idx+1);
    }, 650);
  }

  function handleTurnsClick(col, row) {
    if (turnPhase!=='player' || enemyTurnRunningRef.current) return;
    const all = unitsRef.current;
    const clicked = all.find(u=>u.hp>0 && unitCells(u).some(([c,r])=>c===col&&r===row));
    const selId = [...selectedIds][0];

    if (clicked && clicked.faction==='player') {
      if (actedIdsRef.current.has(clicked.id)) return;
      if (clicked.id===selId) { markActed(clicked.id); return; }
      if (!clicked.mov) return; // stationary structures/turrets act automatically each round
      setSelectedIds(new Set([clicked.id]));
      setMoveTargets(clicked.mov>0 ? getReachableCells(clicked, all, G) : []);
      setAttackTargets(clicked.range>0 ? getInRange(clicked, all).map(u=>({col:u.col,row:u.row,id:u.id})) : []);
      return;
    }

    if (!selId || actedIdsRef.current.has(selId)) return;
    const selUnit = all.find(u=>u.id===selId);
    if (!selUnit) return;

    if (clicked && clicked.faction==='enemy') {
      if (!attackTargets.find(t=>t.id===clicked.id)) return;
      const dmg = rollDmg(selUnit.atk);
      const wasAlive = clicked.hp>0;
      const next = all.map(u=>u.id===clicked.id?{...u,hp:Math.max(0,u.hp-dmg)}:u);
      addLog(`${selUnit.name} attacks ${clicked.name}: -${dmg}`);
      flashCell(col,row); shakeUnit(clicked.id); popDmg(col,row,dmg);
      if (wasAlive && clicked.hp-dmg<=0) bumpQuestStat('enemiesKilled');
      setUnits(next);
      if (checkTurnsWinLose(next)) return;
      markActed(selId);
      return;
    }

    const dest = moveTargets.find(m=>m.col===col&&m.row===row);
    if (dest) {
      const next = all.map(u=>u.id===selId?{...u,col,row}:u);
      setUnits(next);
      setMoveTargets([]);
      setAttackTargets(selUnit.range>0 ? getInRange({...selUnit,col,row}, next).map(u=>({col:u.col,row:u.row,id:u.id})) : []);
    }
  }

  // ── Shop ──────────────────────────────────────────────────────────────────
  function tryBuy(type) {
    const def=UD[type];if(!def)return;
    if(!factoryPlaced&&type!=='factory'){addLog('Build Factory first!');return;}
    if(mana<def.mana){addLog(`Need ${def.mana} mana.`);return;}
    spendMana(def.mana);setMana(m=>m-def.mana);
    setSelectedGeneral(null);
    setPending(type);addLog(`${def.name} — click map to place.`);
  }
  function cancelPending() {
    if(!pendingType)return;
    awardMana(UD[pendingType]?.mana||0);setMana(m=>m+(UD[pendingType]?.mana||0));
    setPending(null);setHoverCell(null);addLog('Cancelled — refunded.');
  }
  function tryPlace(col, row) {
    if(!pendingType)return;
    if(col>=PLAYER_MAX_COL){addLog('Can only place on your side of the field.');return;}
    if(!TR[G[row]?.[col]]?.pass){addLog('Cannot place there.');return;}
    if(cellOccupied(col,row,unitsRef.current)){addLog('Cell occupied.');return;}
    const nu=mkUD(pendingType,col,row,'player');
    setUnits([...unitsRef.current,nu]);
    setPending(null);setHoverCell(null);addLog(`${nu.name} deployed.`);
    if(UD[pendingType]?.cat==='struct') bumpQuestStat('structuresBuilt');
    else if(nu.mov>0) bumpQuestStat('troopsDeployed');
    if(pendingType==='factory'){addLog('Factory active — +5 mana/sec.');startBattle();}
  }
  function startBattle() {
    if(!unitsRef.current.some(u=>u.type==='factory'&&u.faction==='player'&&u.hp>0)){addLog('Place a Factory first!');return;}
    setPhase('battle');
    setBattleSlotCount(getBattleSlotCount());
    enemyManaRef.current=STARTING_MANA;
    enemyAITimer.current=0;
    bumpQuestStat('battlesPlayed');
    addLog(`${mission ? mission.name : modeConfig?.name} — Battle begins!`);
    if(mode==='turns'){
      enemyTurnRunningRef.current=false;
      turnNumberRef.current=1;setTurnNumberRaw(1);
      setActedIds(new Set());setTurnPhase('player');
      setMoveTargets([]);setAttackTargets([]);
    }
  }
  function resetGame() {
    const init=makeInitialUnits(mode, mission, mapData);
    unitsRef.current=init;setUnitsRaw(init);
    setPhase('setup');
    setSelectedGeneral(null);setAssignedGenerals([]);setBattleSlotCount(getBattleSlotCount());setWinReward(null);
    setPending(null);setHoverCell(null);setSelectedIds(new Set());
    setLog(['Deploy your Factory — the battle begins the instant you place it.']);
    enemyManaRef.current=STARTING_MANA;
    enemyAITimer.current=0;
    capturedRef.current=0;setCapturedCount(0);
    setMana(STARTING_MANA);setOil(STARTING_OIL);
    enemyTurnRunningRef.current=false;
    turnNumberRef.current=1;setTurnNumberRaw(1);
    setActedIds(new Set());setTurnPhase('player');
    setMoveTargets([]);setAttackTargets([]);
  }

  // ── Selection & behavior ──────────────────────────────────────────────────
  function selectUnit(id) {
    setSelectedIds(new Set([id]));
  }
  function setBehavior(beh) {
    const ids=selectedIds;
    setUnits(unitsRef.current.map(u=>ids.has(u.id)?{...u,behavior:beh}:u));
    if(ids.size>=2) bumpQuestStat('multiUnitCommands');
  }

  // ── Commanders — arm one, then click a troop to bind it (up to battleSlotCount per battle) ──
  function chooseGeneral(id) {
    if(assignedGenerals.length>=battleSlotCount)return;
    if(assignedGenerals.some(a=>a.generalId===id))return;
    if(!isCommanderOwned(id)){addLog('You don’t own that commander yet.');return;}
    const g=getEffectiveGeneral(id);
    if(!g)return;
    setPending(null);setHoverCell(null);
    setSelectedGeneral(g);
    addLog(`${g.name}${g.level>0?` (Lv.${g.level})`:''} ready — click one of your troops to assign.`);
  }
  function cancelGeneral() {
    setSelectedGeneral(null);
  }
  function assignGeneralToUnit(unitId) {
    if(assignedGenerals.length>=battleSlotCount)return;
    const u=unitsRef.current.find(x=>x.id===unitId);
    if(!u||u.faction!=='player'||u.hp<=0||!(u.mov>0)){addLog('Commanders can only lead a mobile troop.');return;}
    if(u.general){addLog('That troop already has a commander.');return;}
    const boosted=applyGeneralBoost(u,selectedGeneral);
    setUnits(unitsRef.current.map(x=>x.id===unitId?boosted:x));
    setAssignedGenerals(prev=>[...prev,{generalId:selectedGeneral.id,unitId,level:selectedGeneral.level||0,name:selectedGeneral.name,icon:selectedGeneral.icon,color:selectedGeneral.color}]);
    addLog(`⭐ ${selectedGeneral.name}${selectedGeneral.level>0?` (Lv.${selectedGeneral.level})`:''} now leads ${u.name}!`);
    setSelectedGeneral(null);
  }

  // ── Click handler (no manual movement) ───────────────────────────────────
  function handleCellClick(col, row) {
    if(selectedGeneral){
      const hit=unitsRef.current.find(u=>unitCells(u).some(([c,r])=>c===col&&r===row)&&u.hp>0);
      if(hit&&hit.faction==='player')assignGeneralToUnit(hit.id);
      return;
    }
    if(pendingType){tryPlace(col,row);return;}
    if(mode==='turns'&&phase==='battle'){handleTurnsClick(col,row);return;}
    const hit=unitsRef.current.find(u=>unitCells(u).some(([c,r])=>c===col&&r===row)&&u.hp>0);
    if(hit&&hit.faction==='player'){
      if(selectedIds.has(hit.id)&&selectedIds.size===1)setSelectedIds(new Set());
      else selectUnit(hit.id);
    } else {
      setSelectedIds(new Set());
    }
  }

  // ── Drag-select ───────────────────────────────────────────────────────────
  function onMapPointerDown(e) {
    if(pendingType||selectedGeneral||e.button!==0||(mode==='turns'&&phase==='battle'))return;
    const rect=gridRef.current?.getBoundingClientRect();
    if(!rect)return;
    const x=e.clientX-rect.left, y=e.clientY-rect.top;
    dragStart.current={x,y};
    setDragBox({x1:x,y1:y,x2:x,y2:y});
    setIsDragging(false);
  }
  function onMapPointerMove(e) {
    if(!dragStart.current)return;
    const rect=gridRef.current?.getBoundingClientRect();
    if(!rect)return;
    const x=e.clientX-rect.left, y=e.clientY-rect.top;
    const dx=Math.abs(x-dragStart.current.x), dy=Math.abs(y-dragStart.current.y);
    if(dx>6||dy>6)setIsDragging(true);
    setDragBox({x1:dragStart.current.x,y1:dragStart.current.y,x2:x,y2:y});
  }
  function onMapPointerUp(e) {
    if(!dragStart.current)return;
    if(isDragging&&dragBox){
      const C=cellSize;
      const minC=Math.floor(Math.min(dragBox.x1,dragBox.x2)/C);
      const maxC=Math.floor(Math.max(dragBox.x1,dragBox.x2)/C);
      const minR=Math.floor(Math.min(dragBox.y1,dragBox.y2)/C);
      const maxR=Math.floor(Math.max(dragBox.y1,dragBox.y2)/C);
      const inBox=unitsRef.current.filter(u=>
        u.faction==='player'&&u.hp>0&&
        u.col>=minC&&u.col<=maxC&&u.row>=minR&&u.row<=maxR
      ).map(u=>u.id);
      if(inBox.length>0)setSelectedIds(new Set(inBox));
    }
    dragStart.current=null;
    setDragBox(null);
    setIsDragging(false);
  }

  const C = cellSize;
  const selList = units.filter(u=>selectedIds.has(u.id)&&u.hp>0);
  const selMobile = selList.filter(u=>u.mov>0);
  const primarySel = selList[0];

  if(!ready) return <div className="flex items-center justify-center h-full bg-zinc-950 text-zinc-500 text-sm">Loading…</div>;

  if(!G) return (
    <div className="flex flex-col items-center justify-center h-full bg-zinc-950 gap-6">
      <div className="text-5xl">🗺️</div>
      <div className="text-center">
        <h2 className="text-white font-black text-2xl mb-2">No Map Configured</h2>
        <p className="text-zinc-400 text-sm max-w-xs">An admin must create a map for <span className="text-indigo-400 font-bold capitalize">{mode}</span> mode before it can be played.</p>
      </div>
      <button onClick={()=>{onBack();}} className="px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-semibold text-sm">← Back to Menu</button>
    </div>
  );

  return (
    <div className="flex h-full bg-zinc-950 overflow-hidden select-none">

      {/* ── LEFT PANEL ── */}
      <div className="w-56 shrink-0 bg-zinc-900 border-r border-zinc-700 flex flex-col overflow-hidden">

        {/* Back button + mode label */}
        <div className="px-3 pt-2 pb-2 border-b border-zinc-700 shrink-0">
          <button onClick={()=>{resetGame();onBack();}}
            className="w-full py-1.5 mb-2 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 text-white text-xs font-bold rounded-lg border border-zinc-500 transition-all">
            ← Back to Menu
          </button>
          <div className="flex items-center justify-between">
            <span className="text-sm font-black" style={{color:mission?'#f59e0b':modeConfig?.color}}>{mission?mission.name:modeConfig?.name}</span>
            {phase==='battle'&&mode==='turns'&&(
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full animate-pulse ${turnPhase==='player'?'bg-sky-400':'bg-red-400'}`}/>
                <span className={`text-[10px] font-bold ${turnPhase==='player'?'text-sky-400':'text-red-400'}`}>{turnPhase==='player'?'YOUR TURN':'ENEMY TURN'}</span>
              </div>
            )}
            {phase==='battle'&&mode!=='turns'&&<div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/><span className="text-green-400 text-[10px] font-bold">LIVE</span></div>}
          </div>
        </div>

        {/* Turns objective */}
        {mode==='turns'&&(
          <div className="px-3 py-2 border-b border-zinc-700 shrink-0 bg-sky-950/30">
            <p className="text-sky-300 text-[10px] font-bold uppercase tracking-widest mb-1">♟️ Turn {turnNumber}</p>
            <p className="text-zinc-400 text-[10px] leading-snug mb-1.5">Move each unit, then end your turn — the AI answers move for move.</p>
            <p className="text-sky-200 text-xs font-bold">{units.filter(u=>u.faction==='enemy'&&u.hp>0).length} enemies remaining</p>
          </div>
        )}

        {/* Campaign objective */}
        {mission&&(
          <div className="px-3 py-2 border-b border-zinc-700 shrink-0 bg-amber-950/30">
            <p className="text-amber-300 text-[10px] font-bold uppercase tracking-widest mb-1">
              🎯 {mission.objective==='capture'?`Capture ${mission.captureCount} Troops`:'Eliminate All Enemies'}
            </p>
            <p className="text-zinc-400 text-[10px] leading-snug mb-1.5">{mission.briefing}</p>
            {mission.objective==='capture'?(
              <p className="text-amber-200 text-xs font-bold">{capturedCount}/{mission.captureCount} captured</p>
            ):(
              <p className="text-amber-200 text-xs font-bold">{units.filter(u=>u.faction==='enemy'&&u.hp>0).length} enemies remaining</p>
            )}
          </div>
        )}

        {/* Siege objective */}
        {!mission&&mode==='siege'&&(
          <div className="px-3 py-2 border-b border-zinc-700 shrink-0 bg-red-950/30">
            <p className="text-red-300 text-[10px] font-bold uppercase tracking-widest mb-1">🏯 Break the Siege</p>
            <p className="text-zinc-400 text-[10px] leading-snug mb-1.5">Your castle is surrounded on every side. Defeat every attacker to win.</p>
            <p className="text-red-200 text-xs font-bold">{units.filter(u=>u.faction==='enemy'&&u.hp>0).length} enemies remaining</p>
          </div>
        )}

        {/* Resources */}
        <div className="px-3 py-2 border-b border-zinc-700 shrink-0 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 bg-purple-950 border border-purple-700 rounded-lg px-3 py-1.5">
            <span className="text-purple-300 font-black text-base leading-none">{mana}</span>
            <span className="text-purple-400 text-xs flex-1">Mana</span>
            {factoryPlaced&&<span className="text-green-400 text-[10px] font-bold">{mode==='turns'?'+10/turn':'+5/s'}</span>}
          </div>
          <div className="flex items-center gap-2 bg-amber-950 border border-amber-700 rounded-lg px-3 py-1.5">
            <span className="text-amber-300 font-black text-base leading-none">{oil}</span>
            <span className="text-amber-400 text-xs flex-1">Oil</span>
            {oilPumpPlaced&&<span className="text-green-400 text-[10px] font-bold">{mode==='turns'?'+6/turn':'+3/s'}</span>}
          </div>
        </div>

        {/* Commanders — up to battleSlotCount, one per troop, each locked in for the rest of the battle */}
        <div className="px-3 py-2 border-b border-zinc-700 shrink-0">
          <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-semibold mb-1.5">
            Commanders — {assignedGenerals.length}/{battleSlotCount}
          </p>

          {assignedGenerals.length>0 && (
            <div className="flex flex-col gap-1 mb-1.5">
              {assignedGenerals.map(a=>{
                const leadUnit = units.find(u=>u.id===a.unitId);
                return (
                  <div key={a.generalId} className="rounded-lg border px-2 py-1.5" style={{borderColor:a.color,background:`${a.color}22`}}>
                    <p className="text-xs font-bold" style={{color:a.color}}>{a.icon} {a.name}{a.level>0?` · Lv.${a.level}`:''}</p>
                    <p className="text-zinc-400 text-[9px]">{leadUnit?`leads ${leadUnit.name}`:'that unit has fallen'}</p>
                  </div>
                );
              })}
            </div>
          )}

          {assignedGenerals.length>=battleSlotCount ? (
            assignedGenerals.length===0 && <p className="text-zinc-600 text-[10px]">No battle slots — buy some in the Commanders shop.</p>
          ) : selectedGeneral ? (
            <div className="rounded-lg border px-2 py-1.5 flex items-center justify-between gap-2" style={{borderColor:selectedGeneral.color,background:`${selectedGeneral.color}22`}}>
              <p className="text-[10px] font-bold" style={{color:selectedGeneral.color}}>Click a troop to assign {selectedGeneral.name}</p>
              <button onClick={cancelGeneral} className="text-zinc-400 hover:text-red-400 text-xs font-bold shrink-0">✕</button>
            </div>
          ) : (() => {
            const available = GENERALS.filter(g=>isCommanderOwned(g.id) && !assignedGenerals.some(a=>a.generalId===g.id));
            return available.length>0 ? (
              <div className="flex gap-1.5 flex-wrap">
                {available.map(g=>(
                  <button key={g.id} onClick={()=>chooseGeneral(g.id)} title={`${g.name} — ${g.desc}`}
                    className="w-8 h-8 rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700 flex items-center justify-center text-base transition-all active:scale-95">
                    {g.icon}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-zinc-600 text-[10px]">No more owned commanders — buy more in the Commanders shop.</p>
            );
          })()}
        </div>

        {/* Battle button */}
        <div className="px-3 py-2 border-b border-zinc-700 shrink-0">
          {phase==='setup'&&(
            <p className="text-center text-zinc-500 text-xs font-semibold py-1">Place your Factory to begin — the battle starts instantly.</p>
          )}
          {phase==='battle'&&mode==='turns'&&(
            <button onClick={endPlayerTurn} disabled={turnPhase!=='player'}
              className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${turnPhase==='player'?'bg-sky-600 hover:bg-sky-500 text-white border border-sky-400':'bg-zinc-700 text-zinc-500 border border-zinc-600 cursor-not-allowed'}`}>
              {turnPhase==='player'?'End Turn →':'Enemy acting…'}
            </button>
          )}
          {(phase==='won'||phase==='lost')&&(
            <div className="flex flex-col gap-1.5">
              <p className={`text-center font-black text-sm ${phase==='won'?'text-yellow-400':'text-red-400'}`}>{phase==='won'?'★ Victory!':'✕ Defeat'}</p>
              <button onClick={resetGame} className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg">Play Again</button>
              <button onClick={()=>{resetGame();onBack();}} className="w-full py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold rounded-lg">← Menu</button>
            </div>
          )}
        </div>

        {/* Shop */}
        <div className="px-3 pt-1.5 pb-1 border-b border-zinc-700 shrink-0 flex items-center justify-between">
          <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-semibold">Shop</p>
          {pendingType&&<button onClick={cancelPending} className="text-red-400 text-[10px] hover:text-red-300 font-bold">✕ Cancel</button>}
        </div>

        {factoryPlaced&&(
          <div className="flex border-b border-zinc-700 shrink-0">
            {SHOP_CATS.map(cat=>(
              <button key={cat} onClick={()=>setShopCat(cat)}
                className={`flex-1 py-1 text-[9px] font-bold transition-all ${shopCat===cat?'bg-indigo-700 text-white':'text-zinc-500 hover:text-white'}`}>
                {CAT_LABELS[cat]}
              </button>
            ))}
          </div>
        )}

        {!factoryPlaced&&(
          <div className="mx-2 mt-1.5 px-2 py-1.5 rounded-lg bg-amber-950/60 border border-amber-800">
            <p className="text-amber-300 text-[10px] font-bold">Place a Factory to generate mana and unlock all units.</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
          {Object.entries(UD)
            .filter(([id,d])=>factoryPlaced?d.cat===shopCat:id==='factory')
            .map(([id,def])=>{
              const active=pendingType===id, canBuy=mana>=def.mana;
              return (
                <div key={id} className={`rounded-lg border p-1.5 ${active?'border-cyan-500 bg-cyan-950/40':'border-zinc-700 bg-zinc-800/50'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <UShape type={id} color={active?'#22d3ee':'#3b82f6'} size={20}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-[10px] font-bold truncate">{def.name}</p>
                      <p className="text-purple-400 text-[9px]">{def.mana}m{def.mpt?` +${def.mpt}/s`:''}{def.opt?` +${def.opt}oil/s`:''}</p>
                    </div>
                  </div>
                  <button onClick={()=>active?cancelPending():tryBuy(id)} disabled={!canBuy&&!active}
                    className={`w-full text-[10px] font-bold py-0.5 rounded transition-all ${active?'bg-cyan-700 text-white':canBuy?'bg-indigo-700 hover:bg-indigo-600 text-white':'bg-zinc-700 text-zinc-500 cursor-not-allowed'}`}>
                    {active?'✕ Cancel':canBuy?'Buy & Place':'Need mana'}
                  </button>
                </div>
              );
            })}
        </div>

        {/* Unit list */}
        <div className="h-32 border-t border-zinc-700 overflow-y-auto p-1.5 flex flex-col gap-0.5 shrink-0">
          <p className="text-zinc-500 text-[9px] uppercase font-bold px-1 mb-0.5">Your Units</p>
          {units.filter(u=>u.faction==='player'&&u.hp>0).map(u=>(
            <div key={u.id} onClick={()=>selectedGeneral?assignGeneralToUnit(u.id):selectUnit(u.id)}
              className={`flex items-center gap-1.5 rounded p-1 cursor-pointer transition-all ${selectedIds.has(u.id)?'bg-indigo-900/60 border border-indigo-500':'bg-zinc-800/50 border border-transparent hover:bg-zinc-800'}`}>
              <UShape type={u.type} color={selectedIds.has(u.id)?'#818cf8':'#3b82f6'} size={13}/>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[9px] font-bold truncate">{u.general&&'⭐ '}{u.name}</p>
                {u.mov>0&&<span style={{fontSize:7,color:u.behavior==='attack'?'#f87171':u.behavior==='defend_castle'?'#67e8f9':'#86efac'}}>
                  {u.behavior==='attack'?'ATK':u.behavior==='defend_castle'?'DEF':u.behavior==='defend_spot'?'HOLD':'IDLE'}
                </span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAP ── */}
      <div ref={mapRef}
        className="flex-1 relative overflow-hidden bg-zinc-900 flex items-center justify-center"
        style={{ cursor: pendingType?'crosshair':'default' }}
        onPointerDown={onMapPointerDown}
        onPointerMove={onMapPointerMove}
        onPointerUp={onMapPointerUp}
        onPointerLeave={()=>{dragStart.current=null;setDragBox(null);setIsDragging(false);}}>

        {/* background matches grass so zero hairline gaps show */}
        <div ref={gridRef} style={{ position:'relative', width:COLS*C, height:ROWS*C, flexShrink:0, background:'#243d10' }}>

          {/* Grid overlay — thin lines marking each cell, so drag-select boundaries are visible */}
          <div style={{
            position:'absolute',inset:0,zIndex:1,pointerEvents:'none',
            backgroundImage:'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize:`${C}px ${C}px`,
          }}/>

          {/* Terrain tiles */}
          {Array.from({length:ROWS},(_,row)=>Array.from({length:COLS},(_,col)=>{
            const terrain=G[row]?.[col]||'G';
            const ts=TR[terrain];
            const key=`${col},${row}`;
            const isFlash=flashCells.has(key);
            const isHover=pendingType&&hoverCell?.col===col&&hoverCell?.row===row;
            const canPlace=isHover&&ts.pass&&!cellOccupied(col,row,units)&&col<PLAYER_MAX_COL;
            const isMoveTarget=mode==='turns'&&moveTargets.some(m=>m.col===col&&m.row===row);
            const isAttackTarget=mode==='turns'&&attackTargets.some(t=>t.col===col&&t.row===row);
            return (
              <div key={key}
                onClick={()=>handleCellClick(col,row)}
                onMouseEnter={()=>pendingType&&setHoverCell({col,row})}
                onMouseLeave={()=>pendingType&&setHoverCell(null)}
                style={{
                  position:'absolute',left:col*C,top:row*C,width:C,height:C,
                  backgroundColor:isFlash?'#ca8a04':ts.bg,
                }}>
                {terrain==='F'&&<svg width={C} height={C} viewBox={`0 0 ${C} ${C}`} style={{position:'absolute',inset:0,opacity:0.55,pointerEvents:'none'}}><circle cx={C*.27} cy={C*.46} r={C*.17} fill="#166534"/><circle cx={C*.54} cy={C*.35} r={C*.15} fill="#14532d"/><circle cx={C*.69} cy={C*.54} r={C*.15} fill="#166534"/></svg>}
                {terrain==='M'&&<svg width={C} height={C} viewBox={`0 0 ${C} ${C}`} style={{position:'absolute',inset:0,opacity:0.4,pointerEvents:'none'}}><polygon points={`${C/2},${C*.1} ${C*.92},${C*.92} ${C*.08},${C*.92}`} fill="#78716c"/></svg>}
                {terrain==='W'&&<svg width={C} height={C} viewBox={`0 0 ${C} ${C}`} style={{position:'absolute',inset:0,opacity:0.4,pointerEvents:'none'}}><path d={`M 0 ${C*.5} Q ${C*.25} ${C*.3} ${C*.5} ${C*.5} Q ${C*.75} ${C*.7} ${C} ${C*.5}`} fill="none" stroke="#60a5fa" strokeWidth="2"/></svg>}
                {terrain==='R'&&<div style={{position:'absolute',inset:0,background:'repeating-linear-gradient(90deg,transparent,transparent 6px,rgba(0,0,0,0.12) 6px,rgba(0,0,0,0.12) 7px)',pointerEvents:'none'}}/>}
                {/* Single-cell placement highlight — no grid, just the hovered cell */}
                {isHover&&<div style={{position:'absolute',inset:0,pointerEvents:'none',
                  background:canPlace?'rgba(255,255,255,0.18)':'rgba(239,68,68,0.25)',
                  boxShadow:canPlace?'inset 0 0 0 2px rgba(255,255,255,0.5)':'inset 0 0 0 2px rgba(239,68,68,0.7)'
                }}/>}
                {isMoveTarget&&<div style={{position:'absolute',inset:0,pointerEvents:'none',background:'rgba(56,189,248,0.28)',boxShadow:'inset 0 0 0 2px rgba(56,189,248,0.7)'}}/>}
                {isAttackTarget&&<div style={{position:'absolute',inset:0,pointerEvents:'none',background:'rgba(239,68,68,0.32)',boxShadow:'inset 0 0 0 2px rgba(239,68,68,0.8)'}}/>}
              </div>
            );
          }))}

          {/* Barricade wall connectors */}
          {units.filter(u=>u.type==='barricade'&&u.hp>0).flatMap(u=>{
            const conns=[];
            // Right connector
            if(units.some(n=>n.type==='barricade'&&n.col===u.col+1&&n.row===u.row&&n.hp>0))
              conns.push(<div key={`br-${u.id}`} style={{position:'absolute',left:u.col*C+C*.5,top:u.row*C+C*.38,width:C,height:C*.24,background:'#3b82f6',zIndex:8,pointerEvents:'none'}}/>);
            // Down connector
            if(units.some(n=>n.type==='barricade'&&n.col===u.col&&n.row===u.row+1&&n.hp>0))
              conns.push(<div key={`bd-${u.id}`} style={{position:'absolute',left:u.col*C+C*.38,top:u.row*C+C*.5,width:C*.24,height:C,background:'#3b82f6',zIndex:8,pointerEvents:'none'}}/>);
            return conns;
          })}

          {/* Units — troops glide continuously (see UnitSprite) rather than snapping cell-to-cell */}
          {units.filter(u=>u.hp>0).map(u=>(
            <UnitSprite
              key={u.id}
              u={u}
              C={C}
              isSel={selectedIds.has(u.id)}
              isShaking={shakingIds.has(u.id)}
              isActed={mode==='turns'&&phase==='battle'&&u.faction==='player'&&u.mov>0&&actedIds.has(u.id)}
              onSelect={handleCellClick}
            />
          ))}

          {/* Damage popups */}
          {dmgPopups.map(({key,col,row,dmg})=>(
            <div key={key} className="anim-float-up"
              style={{position:'absolute',pointerEvents:'none',zIndex:20,fontWeight:900,fontSize:12,
                color:'#fde047',textShadow:'0 0 6px #000',
                left:col*C+C/2,top:row*C+C/2,transform:'translate(-50%,-50%)'}}>
              -{dmg}
            </div>
          ))}

          {/* Drag-select box */}
          {isDragging&&dragBox&&(
            <div style={{
              position:'absolute',
              left:Math.min(dragBox.x1,dragBox.x2),top:Math.min(dragBox.y1,dragBox.y2),
              width:Math.abs(dragBox.x2-dragBox.x1),height:Math.abs(dragBox.y2-dragBox.y1),
              border:'2px solid #3b82f6',background:'rgba(59,130,246,0.12)',
              zIndex:30,pointerEvents:'none',
            }}/>
          )}
        </div>

        {/* Placement hint */}
        {pendingType&&(
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-cyan-950/95 border border-cyan-600 rounded-xl px-4 py-2.5 flex items-center gap-3 z-20 shadow-2xl">
            <UShape type={pendingType} color="#22d3ee" size={20}/>
            <span className="text-cyan-200 text-xs font-semibold">Click anywhere on the map to place {UD[pendingType]?.name}</span>
            <button onClick={cancelPending} className="text-zinc-400 hover:text-red-400 text-sm ml-1 font-bold">✕</button>
          </div>
        )}

        {/* Drag-select hint — shown until the player has selected units at least once */}
        {mode!=='turns'&&selList.length===0&&!pendingType&&(
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-zinc-700 rounded-xl px-4 py-2 flex items-center gap-2 z-20 shadow-xl pointer-events-none">
            <span className="text-sm">🖱️</span>
            <span className="text-zinc-300 text-xs font-semibold">Click-drag on the grid to box-select multiple units, then command them together</span>
          </div>
        )}

        {/* Selected unit panel — prominent bottom-left */}
        {selList.length>0&&!pendingType&&(
          <div className="absolute bottom-4 left-4 z-20 bg-zinc-800 border-2 border-indigo-500 rounded-2xl p-4 shadow-2xl min-w-[220px] max-w-xs"
            onClick={e=>e.stopPropagation()}>

            {/* Unit info */}
            {selList.length===1&&primarySel?(
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-indigo-900/60 rounded-xl p-2">
                  <UShape type={primarySel.type} color="#818cf8" size={32}/>
                </div>
                <div>
                  <p className="text-white font-black text-sm">{primarySel.name}</p>
                  <p className="text-zinc-300 text-xs">{Math.max(0,primarySel.hp)}/{primarySel.maxHp} HP</p>
                  {primarySel.atk>0&&<p className="text-red-300 text-xs">ATK {primarySel.atk} · RNG {primarySel.range}</p>}
                </div>
              </div>
            ):(
              <div className="mb-3">
                <p className="text-white font-black text-sm">{selList.length} units selected</p>
                <p className="text-zinc-400 text-xs">{selMobile.length} mobile</p>
              </div>
            )}

            {/* HP bar (single unit) */}
            {selList.length===1&&primarySel&&(
              <div className="mb-3 h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div style={{height:'100%',width:`${primarySel.hp/primarySel.maxHp*100}%`,
                  background:primarySel.hp>primarySel.maxHp*.5?'#22c55e':primarySel.hp>primarySel.maxHp*.25?'#eab308':'#ef4444',
                  borderRadius:9999,transition:'width 0.3s'}}/>
              </div>
            )}

            {/* AI behavior — real-time modes only; turns mode uses click-to-move/attack instead */}
            {mode!=='turns'&&selMobile.length>0&&(
              <div>
                <p className="text-zinc-400 text-[10px] uppercase font-bold mb-1.5">Behavior</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    {key:'defend_spot',   label:'Hold Position', color:'#86efac', icon:'🛡'},
                    {key:'defend_castle', label:'Guard Castle',   color:'#67e8f9', icon:'🏰'},
                    {key:'attack',        label:'Attack Enemy',   color:'#f87171', icon:'⚔'},
                    {key:'idle',          label:'Idle',           color:'#9ca3af', icon:'·'},
                  ].map(b=>{
                    const allMatch=selMobile.every(u=>u.behavior===b.key);
                    return (
                      <button key={b.key} onClick={()=>setBehavior(b.key)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${allMatch?'border-opacity-100 bg-zinc-700':'border-zinc-600 bg-zinc-800/60 opacity-70 hover:opacity-100'}`}
                        style={{borderColor:allMatch?b.color:'',color:allMatch?b.color:'#9ca3af'}}>
                        <span>{b.icon}</span>{b.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Turns mode — click a highlighted cell to move, or an enemy in red to attack */}
            {mode==='turns'&&primarySel&&primarySel.faction==='player'&&(
              <p className="text-sky-300 text-[10px] leading-snug">
                {actedIds.has(primarySel.id)
                  ? 'This unit has acted this turn.'
                  : moveTargets.length||attackTargets.length
                    ? 'Click a blue cell to move, or a red enemy to attack. Click this unit again to end its turn.'
                    : 'No moves or targets available. Click this unit again to end its turn.'}
              </p>
            )}

            {/* Deselect */}
            <button onClick={()=>setSelectedIds(new Set())}
              className="absolute top-2 right-2 text-zinc-500 hover:text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded">✕</button>
          </div>
        )}

        {/* Battle log — top right */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-0.5 pointer-events-none">
          {log.slice(0,4).map((l,i)=>(
            <div key={i} className={`text-xs px-2 py-0.5 rounded ${i===0?'text-zinc-100 bg-black/80':'text-zinc-500 bg-black/40'}`}>{l}</div>
          ))}
        </div>
      </div>

      {/* Win/Lose overlay */}
      {(phase==='won'||phase==='lost')&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border-2 border-zinc-600 rounded-2xl p-10 flex flex-col items-center gap-5 shadow-2xl max-w-sm w-full mx-4">
            <div className="text-7xl font-black" style={{fontFamily:'monospace',color:phase==='won'?'#fde047':'#ef4444'}}>
              {phase==='won'?'★':'✕'}
            </div>
            <h2 className={`text-3xl font-black ${phase==='won'?'text-yellow-300':'text-red-400'}`}>{phase==='won'?'Victory!':'Defeat'}</h2>
            <p className="text-zinc-400 text-sm text-center">{log[0]}</p>
            {mission&&phase==='won'&&(
              <div className="flex items-center gap-2 bg-amber-950/50 border border-amber-800 rounded-xl px-4 py-2 text-xs font-bold text-amber-200">
                +{mission.rewardMana}💜{mission.rewardGems?` +${mission.rewardGems}💎`:''}{mission.rewardOil?` +${mission.rewardOil}🛢️`:''}
              </div>
            )}
            {!mission&&phase==='won'&&winReward&&(
              <div className="flex items-center gap-2 bg-amber-950/50 border border-amber-800 rounded-xl px-4 py-2 text-xs font-bold text-amber-200">
                +{winReward.mana}💜 +{winReward.oil}🛢️{winReward.gems?` +${winReward.gems}💎`:''}
              </div>
            )}
            <div className="flex gap-3 flex-wrap justify-center">
              <button onClick={()=>{resetGame();onBack();}} className="px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-semibold text-sm">
                {mission?'← Campaign':'← Menu'}
              </button>
              {mission&&phase==='won'&&getNextMission(mission.id)&&onNextMission?(
                <button onClick={()=>onNextMission(getNextMission(mission.id))} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold text-sm">
                  Next Mission →
                </button>
              ):(
                <button onClick={resetGame} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm">
                  {phase==='lost'?'Retry Mission':'Play Again'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
