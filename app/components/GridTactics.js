"use client";

import React, { useState, useRef } from "react";
import {
  TROOP_ROSTER, MAX_SQUAD_SLOTS,
  BASE_MANA_PER_WIN, BASE_GEMS_PER_WIN,
  FACTORY_MANA_PER_WIN, OIL_PUMP_OIL_PER_WIN,
  getMana, spendMana, awardMana, getOil, spendOil, awardOil, awardGems,
  getUpgradedTroop,
} from "../data/troops";

const GRID_W = 8;
const GRID_H = 6;

const ENEMY_POOL = [
  { name: "Goblin",   icon: "👺", maxHp: 20, atk: 6,  mov: 3, atkRange: 1 },
  { name: "Orc",      icon: "👹", maxHp: 40, atk: 11, mov: 2, atkRange: 1 },
  { name: "Ranger",   icon: "🏹", maxHp: 22, atk: 8,  mov: 2, atkRange: 3 },
  { name: "Skeleton", icon: "💀", maxHp: 28, atk: 9,  mov: 2, atkRange: 1 },
  { name: "Warlock",  icon: "🧙", maxHp: 24, atk: 14, mov: 2, atkRange: 3 },
  { name: "Troll",    icon: "👾", maxHp: 55, atk: 12, mov: 2, atkRange: 1 },
  { name: "Demon",    icon: "👿", maxHp: 58, atk: 17, mov: 2, atkRange: 1 },
  { name: "Wraith",   icon: "👻", maxHp: 38, atk: 14, mov: 3, atkRange: 2 },
];

const ENEMY_SPAWN_POS = [[7,0],[7,2],[7,4],[6,1],[6,3],[5,2]];

const MODES = [
  { id: "classic",   name: "Classic",   icon: "⚔️",  color: "#6366f1", desc: "Standard battle. Defeat all enemies." },
  { id: "endless",   name: "Endless",   icon: "🌊",  color: "#16a34a", desc: "Survive escalating waves." },
  { id: "minefield", name: "Minefield", icon: "💣",  color: "#ea580c", desc: "Watch out for mines on the battlefield." },
];

const CATEGORIES = ["Infantry", "Armored", "Artillery", "Other"];
const MINE_DAMAGE = 20;

// ── Enemy generators ──────────────────────────────────────────────────────────
function classicEnemies() {
  return [
    { name: "Orc Brute",    icon: "👹", maxHp: 42, atk: 11, mov: 2, atkRange: 1, x: 7, y: 1 },
    { name: "Goblin Scout", icon: "👺", maxHp: 22, atk: 7,  mov: 3, atkRange: 1, x: 6, y: 3 },
    { name: "Archer",       icon: "🏹", maxHp: 20, atk: 8,  mov: 2, atkRange: 3, x: 7, y: 4 },
  ];
}

function endlessEnemies(wave) {
  const count    = Math.min(2 + Math.ceil(wave * 0.6), 6);
  const scale    = 1 + (wave - 1) * 0.2;
  const poolSize = Math.min(2 + Math.floor(wave / 2), ENEMY_POOL.length);
  const pool     = ENEMY_POOL.slice(0, poolSize);
  return ENEMY_SPAWN_POS.slice(0, count).map(([x, y], i) => {
    const t = pool[i % pool.length];
    return { ...t, maxHp: Math.round(t.maxHp * scale), atk: Math.round(t.atk * scale), x, y };
  });
}

function minefieldEnemies() {
  return [
    { name: "Orc Brute",    icon: "👹", maxHp: 42, atk: 11, mov: 2, atkRange: 1, x: 7, y: 1 },
    { name: "Goblin Scout", icon: "👺", maxHp: 22, atk: 7,  mov: 3, atkRange: 1, x: 6, y: 2 },
    { name: "Archer",       icon: "🏹", maxHp: 20, atk: 8,  mov: 2, atkRange: 3, x: 7, y: 3 },
    { name: "Skeleton",     icon: "💀", maxHp: 28, atk: 9,  mov: 2, atkRange: 1, x: 6, y: 4 },
  ];
}

// ── Unit factory ──────────────────────────────────────────────────────────────
function buildUnits(enemyTemplates, squad) {
  const mid    = (GRID_H - 1) / 2;
  const startY = Math.round(mid - (squad.length - 1) / 2);
  return [
    ...squad.map((t, i) => ({
      name: t.name, icon: t.icon, maxHp: t.maxHp, atk: t.atk, mov: t.mov,
      atkRange: t.atkRange, oilPerMove: t.oilPerMove || 0,
      id: `p${i}`, faction: "player", hp: t.maxHp,
      x: 0, y: Math.max(0, Math.min(GRID_H - 1, startY + i)), acted: false,
    })),
    ...enemyTemplates.map((e, i) => ({
      ...e, id: `e${i}`, faction: "enemy", hp: e.maxHp, acted: false, oilPerMove: 0,
    })),
  ];
}

function buildMines(units) {
  const occupied = new Set(units.map(u => `${u.x},${u.y}`));
  const candidates = [];
  for (let x = 1; x < GRID_W - 1; x++)
    for (let y = 0; y < GRID_H; y++)
      if (!occupied.has(`${x},${y}`)) candidates.push(`${x},${y}`);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return new Set(candidates.slice(0, 7));
}

// ── Pathfinding ───────────────────────────────────────────────────────────────
function getReachable(unit, allUnits) {
  const occupied = new Set(allUnits.filter(u => u.id !== unit.id && u.hp > 0).map(u => `${u.x},${u.y}`));
  const visited  = new Set([`${unit.x},${unit.y}`]);
  const queue    = [{ x: unit.x, y: unit.y, steps: 0 }];
  const result   = [];
  while (queue.length) {
    const { x, y, steps } = queue.shift();
    if (steps > 0 && !occupied.has(`${x},${y}`)) result.push({ x, y });
    if (steps >= unit.mov) continue;
    for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nx = x + dx, ny = y + dy, nk = `${nx},${ny}`;
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H || visited.has(nk)) continue;
      visited.add(nk); queue.push({ x: nx, y: ny, steps: steps + 1 });
    }
  }
  return result;
}

function getAttackTargets(unit, allUnits) {
  return allUnits.filter(u =>
    u.faction !== unit.faction && u.hp > 0 &&
    Math.abs(u.x - unit.x) + Math.abs(u.y - unit.y) <= unit.atkRange
  );
}

function dist(a, b)   { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function rollDmg(atk) { return Math.max(1, atk - 2 + Math.floor(Math.random() * 5)); }

// ── Enemy AI ──────────────────────────────────────────────────────────────────
function runEnemyTurn(units) {
  let cur = units.map(u => ({ ...u }));
  const hits = [];
  for (const enemy of cur.filter(u => u.faction === "enemy" && u.hp > 0)) {
    const players = cur.filter(u => u.faction === "player" && u.hp > 0);
    if (!players.length) break;
    const target = players.reduce((a, b) => dist(enemy, a) < dist(enemy, b) ? a : b);
    const me = () => cur.find(u => u.id === enemy.id);
    if (dist(me(), target) > enemy.atkRange) {
      const reachable = getReachable(me(), cur);
      if (reachable.length) {
        const best = reachable.reduce((a, b) => dist(a, target) < dist(b, target) ? a : b);
        cur = cur.map(u => u.id === enemy.id ? { ...u, x: best.x, y: best.y } : u);
      }
    }
    const inRange = cur.filter(u => u.faction === "player" && u.hp > 0 && dist(me(), u) <= me().atkRange);
    if (inRange.length) {
      const t   = inRange[0];
      const dmg = rollDmg(me().atk);
      hits.push({ id: t.id, dmg, x: t.x, y: t.y });
      cur = cur.map(u => u.id === t.id ? { ...u, hp: Math.max(0, u.hp - dmg) } : u);
    }
  }
  return { units: cur.map(u => u.faction === "player" ? { ...u, acted: false } : u), hits };
}

// ── Mode Select ───────────────────────────────────────────────────────────────
export default function GridTactics() {
  const [screen, setScreen] = useState("select");
  const [mode,   setMode]   = useState(null);
  const [squad,  setSquad]  = useState([]);

  if (screen === "game" && mode && squad.length > 0) {
    return (
      <GameBoard
        mode={mode}
        squad={squad}
        onBack={() => { setSquad([]); setScreen("select"); }}
      />
    );
  }

  if (screen === "deploy" && mode) {
    return (
      <DeployScreen
        mode={mode}
        onStart={(s) => { setSquad(s); setScreen("game"); }}
        onBack={() => setScreen("select")}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10 px-8 select-none">
      <div className="text-center">
        <h1 className="text-4xl font-black text-white mb-2">Choose Mode</h1>
        <p className="text-zinc-500 text-sm">Select a battle mode to begin</p>
      </div>
      <div className="flex flex-col gap-5 w-full max-w-xl">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setScreen("deploy"); }}
            className="group relative flex items-center gap-5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 rounded-2xl p-6 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-xl overflow-hidden"
          >
            <span className="text-5xl">{m.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-white font-black text-xl">{m.name}</div>
              <div className="text-zinc-400 text-sm mt-1">{m.desc}</div>
            </div>
            <span className="text-zinc-600 group-hover:text-white text-2xl transition-colors">→</span>
            <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: m.color }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Deploy Screen ─────────────────────────────────────────────────────────────
function DeployScreen({ mode, onStart, onBack }) {
  const modeConfig = MODES.find(m => m.id === mode);
  const [mana,     setMana]     = useState(() => getMana());
  const [oil,      setOil]      = useState(() => getOil());
  const [squad,    setSquad]    = useState([]);
  const [tab,      setTab]      = useState("Infantry");
  const [errMsg,   setErrMsg]   = useState(null);

  const roster = TROOP_ROSTER.map(t => getUpgradedTroop(t));

  function addUnit(troop) {
    if (squad.length >= MAX_SQUAD_SLOTS) { flash("Squad full! (max 5)"); return; }
    if (mana < troop.manaCost)           { flash(`Need 💜${troop.manaCost} mana!`); return; }
    if (!spendMana(troop.manaCost))      { flash("Not enough mana!"); return; }
    setMana(getMana());
    setSquad(prev => [...prev, { ...troop }]);
  }

  function removeUnit(idx) {
    const removed = squad[idx];
    awardMana(removed.manaCost);
    setMana(getMana());
    setSquad(prev => prev.filter((_, i) => i !== idx));
  }

  function flash(msg) {
    setErrMsg(msg);
    setTimeout(() => setErrMsg(null), 1800);
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <button onClick={onBack} className="text-sm text-zinc-400 hover:text-white px-3 py-1 rounded-lg hover:bg-zinc-800 transition-colors">
          ← Back
        </button>
        <div className="flex items-center gap-2 text-sm font-bold">
          <span>{modeConfig.icon}</span>
          <span className="text-white">{modeConfig.name}</span>
          <span className="text-zinc-500">— Deploy</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg px-2 py-1 text-sm">
            <span>💜</span><span className="text-purple-300 font-black">{mana}</span>
          </div>
          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg px-2 py-1 text-sm">
            <span>🛢️</span><span className="text-amber-300 font-black">{oil}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden">

        {/* Left: unit roster */}
        <div className="flex flex-col flex-1 overflow-hidden border-r border-zinc-800">
          {/* Category tabs */}
          <div className="flex border-b border-zinc-800 shrink-0">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setTab(cat)}
                className={`flex-1 py-2 text-xs font-semibold transition-all
                  ${tab === cat ? "bg-indigo-800 text-white" : "text-zinc-500 hover:text-white hover:bg-zinc-800"}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {roster.filter(t => t.category === tab).map(troop => {
              const canAfford   = mana >= troop.manaCost;
              const squadFull   = squad.length >= MAX_SQUAD_SLOTS;
              const disabled    = !canAfford || squadFull;
              return (
                <div key={troop.name} className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 rounded-xl p-3">
                  <span className="text-3xl shrink-0">{troop.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-bold">{troop.name}</span>
                      {troop.level > 1 && (
                        <span className="text-[9px] bg-cyan-900/60 text-cyan-300 border border-cyan-700/40 px-1.5 rounded-full">Lv.{troop.level}</span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-[10px] mt-0.5 leading-snug truncate">{troop.desc}</p>
                    <div className="flex gap-3 mt-1 text-[10px] text-zinc-400">
                      {troop.maxHp  > 0 && <span>❤️{troop.maxHp}</span>}
                      {troop.atk    > 0 && <span>⚔️{troop.atk}</span>}
                      {troop.atkRange > 0 && <span>🎯{troop.atkRange}</span>}
                      {troop.mov    > 0 && <span>👟{troop.mov}</span>}
                      {troop.oilPerMove > 0 && <span className="text-amber-400">🛢️{troop.oilPerMove}/mv</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => addUnit(troop)}
                    disabled={disabled}
                    className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95
                      ${disabled
                        ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                        : "bg-indigo-700 hover:bg-indigo-600 text-white"}`}
                  >
                    <span className="text-purple-300">💜{troop.manaCost}</span>
                    <span className="block text-[9px] mt-0.5 text-indigo-200">Deploy</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: squad slots + start */}
        <div className="w-64 flex flex-col bg-zinc-900 shrink-0">
          <div className="px-4 pt-4 pb-2 border-b border-zinc-800 shrink-0">
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">
              Squad <span className="text-white">{squad.length}</span>/{MAX_SQUAD_SLOTS}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {Array.from({ length: MAX_SQUAD_SLOTS }, (_, i) => {
              const unit = squad[i];
              return unit ? (
                <div key={i} className="flex items-center gap-2 bg-indigo-900/30 border border-indigo-700/40 rounded-xl p-2">
                  <span className="text-2xl">{unit.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-bold truncate">{unit.name}</p>
                    <p className="text-indigo-300 text-[9px]">💜{unit.manaCost}</p>
                  </div>
                  <button
                    onClick={() => removeUnit(i)}
                    className="text-zinc-500 hover:text-red-400 text-xs px-1.5 py-0.5 rounded hover:bg-red-900/20 transition-all"
                    title="Remove (refund)"
                  >✕</button>
                </div>
              ) : (
                <div key={i} className="flex items-center justify-center h-12 rounded-xl border border-dashed border-zinc-700 text-zinc-700 text-xs">
                  empty slot
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-zinc-800 shrink-0 flex flex-col gap-2">
            {errMsg && (
              <div className="bg-red-900/60 border border-red-700 text-red-300 text-xs rounded-lg px-3 py-1.5 text-center">
                {errMsg}
              </div>
            )}
            <p className="text-zinc-600 text-[9px] text-center">Removing a unit refunds its mana cost</p>
            <button
              onClick={() => squad.length > 0 && onStart(squad)}
              disabled={squad.length === 0}
              className={`w-full py-3 rounded-xl font-black text-sm transition-all active:scale-95
                ${squad.length > 0
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.02]"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}
            >
              {squad.length > 0 ? `Enter Battle →` : "Add troops to deploy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Game Board ────────────────────────────────────────────────────────────────
function GameBoard({ mode, squad, onBack }) {
  const modeConfig = MODES.find(m => m.id === mode);
  const [wave, setWave] = useState(1);
  const [oil,  setOilDisplay] = useState(() => getOil());

  const [units, setUnitsRaw] = useState(() => {
    const e = mode === "classic" ? classicEnemies() : mode === "endless" ? endlessEnemies(1) : minefieldEnemies();
    return buildUnits(e, squad);
  });
  const unitsRef = useRef(units);
  function setUnits(next) { unitsRef.current = next; setUnitsRaw(next); }

  const [mines, setMines] = useState(() => {
    if (mode !== "minefield") return new Set();
    const e = minefieldEnemies();
    return buildMines(buildUnits(e, squad));
  });

  const [selected, setSelectedRaw] = useState(null);
  const selectedRef = useRef(null);
  function setSelected(id) { selectedRef.current = id; setSelectedRaw(id); }

  const [movedTo, setMovedToRaw] = useState(null);
  const movedToRef = useRef(null);
  function setMovedTo(pos) { movedToRef.current = pos; setMovedToRaw(pos); }

  const [validMoves,   setValidMoves]   = useState([]);
  const [validAttacks, setValidAttacks] = useState([]);

  const [phase, setPhaseRaw] = useState("player");
  const phaseRef = useRef("player");
  function setPhase(p) { phaseRef.current = p; setPhaseRaw(p); }

  const [flashing, setFlashing] = useState(new Set());
  const [shaking,  setShaking]  = useState(new Set());
  const [dmgNums,  setDmgNums]  = useState([]);
  const dmgKey = useRef(0);

  const [log,          setLog]          = useState([`${modeConfig.icon} ${modeConfig.name} — battle start!`]);
  const [battleEarned, setBattleEarned] = useState({ mana: 0, gems: 0, oil: 0 });

  function addLog(msg) { setLog(prev => [msg, ...prev].slice(0, 14)); }

  function flashCell(x, y) {
    const k = `${x},${y}`;
    setFlashing(prev => new Set([...prev, k]));
    setTimeout(() => setFlashing(prev => { const n = new Set(prev); n.delete(k); return n; }), 420);
  }

  function shakeUnit(id) {
    setShaking(prev => new Set([...prev, id]));
    setTimeout(() => setShaking(prev => { const n = new Set(prev); n.delete(id); return n; }), 450);
  }

  function spawnDmg(x, y, dmg) {
    const key = `d${dmgKey.current++}`;
    setDmgNums(prev => [...prev, { x, y, dmg, key }]);
    setTimeout(() => setDmgNums(prev => prev.filter(d => d.key !== key)), 950);
  }

  function givePostBattleRewards(baseMana) {
    const hasFactory  = squad.some(u => u.name === "Factory");
    const hasOilPump  = squad.some(u => u.name === "Oil Pump");
    const totalMana   = baseMana + (hasFactory ? FACTORY_MANA_PER_WIN : 0);
    const bonusOil    = hasOilPump ? OIL_PUMP_OIL_PER_WIN : 0;
    const gems        = BASE_GEMS_PER_WIN;
    awardMana(totalMana);
    awardGems(gems);
    if (bonusOil > 0) awardOil(bonusOil);
    setBattleEarned({ mana: totalMana, gems, oil: bonusOil });
    return { mana: totalMana, gems, oil: bonusOil };
  }

  function doSelect(unitId) {
    const all  = unitsRef.current;
    const unit = all.find(u => u.id === unitId);
    if (!unit || unit.faction !== "player" || unit.acted || unit.hp <= 0) return;
    setSelected(unitId);
    setMovedTo(null);
    setValidMoves(unit.mov > 0 ? getReachable(unit, all) : []);
    setValidAttacks(unit.atkRange > 0 ? getAttackTargets(unit, all).map(u => ({ x: u.x, y: u.y })) : []);
  }

  function doEnemyTurn(currentUnits) {
    setPhase("enemy");
    setSelected(null); setMovedTo(null); setValidMoves([]); setValidAttacks([]);
    addLog("👾 Enemy turn...");
    setTimeout(() => {
      const { units: after, hits } = runEnemyTurn(currentUnits);
      hits.forEach(({ id, dmg, x, y }, i) => {
        setTimeout(() => { flashCell(x, y); shakeUnit(id); spawnDmg(x, y, dmg); }, i * 220);
      });
      setTimeout(() => {
        setUnits(after);
        if (after.filter(u => u.faction === "player" && u.hp > 0).length === 0) {
          const consolation = Math.round(BASE_MANA_PER_WIN * 0.2);
          awardMana(consolation);
          setBattleEarned({ mana: consolation, gems: 0, oil: 0 });
          addLog("💀 Your squad was wiped out.");
          setPhase("lost");
        } else {
          setPhase("player");
          addLog("⚔️ Your turn!");
        }
      }, Math.max(700, hits.length * 220 + 350));
    }, 500);
  }

  function checkPlayerDone(nextUnits) {
    if (nextUnits.filter(u => u.faction === "player" && u.hp > 0).every(u => u.acted))
      doEnemyTurn(nextUnits);
  }

  function startNextWave() {
    const nextWave = wave + 1;
    setWave(nextWave);
    const bonusGems = BASE_GEMS_PER_WIN;
    awardGems(bonusGems);
    const newEnemies = endlessEnemies(nextWave).map((e, i) => ({
      ...e, id: `e${i}`, faction: "enemy", hp: e.maxHp, acted: false, oilPerMove: 0,
    }));
    const survivors = unitsRef.current
      .filter(u => u.faction === "player" && u.hp > 0)
      .map(u => ({ ...u, acted: false }));
    setUnits([...survivors, ...newEnemies]);
    setPhase("player");
    setSelected(null); setMovedTo(null); setValidMoves([]); setValidAttacks([]);
    addLog(`🌊 Wave ${nextWave} begins! +${bonusGems}💎`);
  }

  function restartMode() {
    const e = mode === "classic" ? classicEnemies() : mode === "endless" ? endlessEnemies(1) : minefieldEnemies();
    const newUnits = buildUnits(e, squad);
    setUnits(newUnits);
    setWave(1);
    setBattleEarned({ mana: 0, gems: 0, oil: 0 });
    if (mode === "minefield") setMines(buildMines(newUnits));
    setPhase("player");
    setSelected(null); setMovedTo(null); setValidMoves([]); setValidAttacks([]);
    setLog([`${modeConfig.icon} ${modeConfig.name} — battle start!`]);
    setOilDisplay(getOil());
  }

  function handleCellClick(x, y) {
    if (phaseRef.current !== "player") return;
    const all     = unitsRef.current;
    const selId   = selectedRef.current;
    const moved   = movedToRef.current;
    const clicked = all.find(u => u.x === x && u.y === y && u.hp > 0);

    if (clicked && clicked.faction === "player") {
      if (clicked.acted) return;
      if (clicked.id === selId && moved) {
        const next = all.map(u => u.id === selId ? { ...u, acted: true } : u);
        setUnits(next); setSelected(null); setMovedTo(null); setValidMoves([]); setValidAttacks([]);
        checkPlayerDone(next);
      } else { doSelect(clicked.id); }
      return;
    }

    if (!selId) return;
    const selUnit       = all.find(u => u.id === selId);
    if (!selUnit) return;
    const pos           = moved || { x: selUnit.x, y: selUnit.y };
    const effectiveUnit = { ...selUnit, ...pos };

    if (clicked && clicked.faction === "enemy") {
      if (!getAttackTargets(effectiveUnit, all).find(u => u.id === clicked.id)) return;
      const dmg = rollDmg(selUnit.atk);
      addLog(`${selUnit.icon} ${selUnit.name} → ${clicked.icon} ${clicked.name}: -${dmg}`);
      flashCell(x, y); shakeUnit(clicked.id); spawnDmg(x, y, dmg);
      const next = all
        .map(u => u.id === selId      ? { ...u, ...pos, acted: true }          : u)
        .map(u => u.id === clicked.id ? { ...u, hp: Math.max(0, u.hp - dmg) } : u);
      setUnits(next); setSelected(null); setMovedTo(null); setValidMoves([]); setValidAttacks([]);
      if (next.filter(u => u.faction === "enemy" && u.hp > 0).length === 0) {
        const baseMana = mode === "endless" ? wave * 40 + BASE_MANA_PER_WIN : BASE_MANA_PER_WIN;
        const earned   = givePostBattleRewards(baseMana);
        addLog(`🏆 Victory! +${earned.mana}💜 +${earned.gems}💎${earned.oil > 0 ? ` +${earned.oil}🛢️` : ""}`);
        setPhase("won");
        return;
      }
      checkPlayerDone(next);
      return;
    }

    if (!moved && validMoves.find(m => m.x === x && m.y === y)) {
      if (selUnit.oilPerMove > 0) {
        const currentOil = getOil();
        if (currentOil < selUnit.oilPerMove) {
          addLog(`⛽ No oil! ${selUnit.name} needs ${selUnit.oilPerMove} 🛢️ to move.`);
          return;
        }
        spendOil(selUnit.oilPerMove);
        setOilDisplay(getOil());
      }

      let next     = all.map(u => u.id === selId ? { ...u, x, y } : u);
      let curMines = mines;

      if (mode === "minefield" && curMines.has(`${x},${y}`)) {
        flashCell(x, y); shakeUnit(selId); spawnDmg(x, y, MINE_DAMAGE);
        addLog(`💥 Mine! ${selUnit.name} hit for ${MINE_DAMAGE} damage!`);
        const newMines = new Set(curMines); newMines.delete(`${x},${y}`);
        setMines(newMines); curMines = newMines;
        next = next.map(u => u.id === selId ? { ...u, hp: Math.max(0, u.hp - MINE_DAMAGE) } : u);
        if (next.find(u => u.id === selId).hp <= 0) {
          const dead = next.map(u => u.id === selId ? { ...u, acted: true } : u);
          setUnits(dead); setSelected(null); setMovedTo(null); setValidMoves([]); setValidAttacks([]);
          if (dead.filter(u => u.faction === "player" && u.hp > 0).length === 0) {
            const consolation = Math.round(BASE_MANA_PER_WIN * 0.2);
            awardMana(consolation);
            setBattleEarned({ mana: consolation, gems: 0, oil: 0 });
            setPhase("lost");
          } else { checkPlayerDone(dead); }
          return;
        }
      }

      setUnits(next);
      setMovedTo({ x, y });
      setValidMoves([]);
      setValidAttacks(selUnit.atkRange > 0
        ? getAttackTargets({ ...selUnit, x, y }, next).map(u => ({ x: u.x, y: u.y }))
        : []);
    }
  }

  function endTurnManually() {
    if (phaseRef.current !== "player") return;
    const next = unitsRef.current.map(u => u.faction === "player" ? { ...u, acted: true } : u);
    setUnits(next); setSelected(null); setMovedTo(null); setValidMoves([]); setValidAttacks([]);
    doEnemyTurn(next);
  }

  const players  = units.filter(u => u.faction === "player");
  const enemies  = units.filter(u => u.faction === "enemy");
  const allActed = players.filter(u => u.hp > 0).every(u => u.acted);

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 py-6 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1 rounded-lg hover:bg-zinc-800">
          ← Modes
        </button>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          {modeConfig.icon} {modeConfig.name}
          {mode === "endless" && <span className="text-green-400 text-base font-semibold">Wave {wave}</span>}
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-800/80 rounded-lg px-2 py-1">
            <span className="text-amber-400 text-sm">🛢️</span>
            <span className="text-amber-300 font-bold text-sm">{oil}</span>
          </div>
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-full transition-all ${
            phase === "player" ? "bg-indigo-700 text-white" :
            phase === "enemy"  ? "bg-red-900/80 text-red-300 animate-pulse" :
            phase === "won"    ? "bg-green-700 text-white" :
                                 "bg-zinc-700 text-zinc-300"
          }`}>
            {phase === "player" ? "⚔️ Your Turn" : phase === "enemy" ? "👾 Enemy Acting..." : phase === "won" ? "🏆 Victory!" : "💀 Defeated"}
          </span>
          {phase === "player" && (
            <button
              onClick={endTurnManually}
              className={`text-sm px-3 py-1.5 rounded-full font-semibold transition-all
                ${allActed ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"}`}
            >
              End Turn →
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-5 flex-col xl:flex-row">

        {/* Grid */}
        <div className="flex-1 relative">
          <div className="grid gap-0.5 w-full" style={{ gridTemplateColumns: `repeat(${GRID_W}, minmax(0,1fr))` }}>
            {Array.from({ length: GRID_H * GRID_W }, (_, idx) => {
              const x      = idx % GRID_W;
              const y      = Math.floor(idx / GRID_W);
              const key    = `${x},${y}`;
              const unit   = units.find(u => u.x === x && u.y === y && u.hp > 0);
              const isSel  = unit?.id === selected;
              const isMove = !unit && !!validMoves.find(m => m.x === x && m.y === y);
              const isAtk  = !!validAttacks.find(m => m.x === x && m.y === y);
              const isFlsh = flashing.has(key);
              const isSh   = unit && shaking.has(unit.id);
              const isMine = mode === "minefield" && mines.has(key) && !unit;

              const bg =
                isFlsh ? "bg-yellow-500" :
                isSel  ? "bg-indigo-600" :
                (isAtk && unit?.faction === "enemy") ? "bg-red-700/70" :
                isAtk  ? "bg-red-900/40" :
                isMove ? "bg-indigo-900/50" :
                isMine ? "bg-orange-950/60" :
                (x + y) % 2 === 0 ? "bg-zinc-800" : "bg-zinc-900";

              return (
                <div
                  key={key}
                  onClick={() => handleCellClick(x, y)}
                  className={`relative aspect-square rounded-sm cursor-pointer flex items-center justify-center border transition-colors duration-100
                    ${isSel ? "border-indigo-400" : isAtk ? "border-red-500" : isMove ? "border-indigo-700/70" : isMine ? "border-orange-700/60" : "border-zinc-700/20"}
                    ${bg}`}
                >
                  {unit && (
                    <div className={`w-full h-full flex flex-col items-center justify-center relative ${isSh ? "anim-shake" : ""}`}>
                      <span className="text-base leading-none select-none">{unit.icon}</span>
                      <div className="absolute bottom-0.5 left-0.5 right-0.5 h-1 bg-zinc-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            unit.faction === "player"
                              ? unit.hp > unit.maxHp * 0.5 ? "bg-green-400" : unit.hp > unit.maxHp * 0.25 ? "bg-yellow-400" : "bg-red-400"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${Math.max(0, (unit.hp / unit.maxHp) * 100)}%` }}
                        />
                      </div>
                      {unit.acted && unit.faction === "player" && (
                        <div className="absolute inset-0 bg-black/55 rounded-sm flex items-center justify-center pointer-events-none">
                          <span className="text-zinc-400 text-[9px] font-bold uppercase tracking-widest">done</span>
                        </div>
                      )}
                      {unit.oilPerMove > 0 && (
                        <div className="absolute top-0.5 right-0.5 text-[8px] text-amber-400 leading-none">⛽</div>
                      )}
                    </div>
                  )}
                  {isMove && !isMine && <div className="w-2 h-2 rounded-full bg-indigo-400 opacity-75" />}
                  {isMine && <span className="text-lg select-none">💣</span>}
                  {isFlsh && <div className="absolute inset-0 bg-yellow-300/40 rounded-sm pointer-events-none" />}
                </div>
              );
            })}
          </div>

          {/* Floating damage numbers */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {dmgNums.map(({ x, y, dmg, key }) => (
              <div
                key={key}
                className="absolute anim-float-up font-black text-sm text-yellow-300 drop-shadow-lg"
                style={{ left: `${(x / GRID_W) * 100 + (50 / GRID_W)}%`, top: `${(y / GRID_H) * 100 + (50 / GRID_H)}%`, transform: "translate(-50%, -50%)" }}
              >
                -{dmg}
              </div>
            ))}
          </div>

          <p className="text-xs text-zinc-500 mt-2 text-center">
            Select → blue = move · red = attack · click self after move to wait ·{" "}
            <span className="text-indigo-400">End Turn</span> when done
            {mode === "minefield" && <span className="text-orange-400"> · 💣 = {MINE_DAMAGE} dmg</span>}
          </p>
        </div>

        {/* Side Panel */}
        <div className="w-full xl:w-64 flex flex-col gap-3 text-sm">

          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Your Squad</p>
            <div className="flex flex-col gap-2">
              {players.map(u => (
                <div
                  key={u.id}
                  onClick={() => phase === "player" && !u.acted && doSelect(u.id)}
                  className={`flex items-center gap-2 rounded-lg p-2 transition-all
                    ${u.hp <= 0 ? "opacity-20" : u.acted ? "opacity-40 cursor-default" :
                      selected === u.id ? "bg-indigo-900/60 border border-indigo-500 cursor-pointer" : "hover:bg-zinc-800 cursor-pointer"}`}
                >
                  <span className="text-xl">{u.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-xs flex items-center gap-1">
                      {u.name}
                      {u.oilPerMove > 0 && <span className="text-amber-400 text-[9px]">⛽{u.oilPerMove}</span>}
                    </div>
                    <div className="h-1.5 bg-zinc-700 rounded-full mt-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${u.hp > u.maxHp * 0.5 ? "bg-green-500" : u.hp > u.maxHp * 0.25 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${Math.max(0, (u.hp / u.maxHp) * 100)}%` }}
                      />
                    </div>
                    <div className="text-zinc-400 text-xs mt-0.5">{Math.max(0, u.hp)}/{u.maxHp} HP</div>
                  </div>
                  {u.acted && <span className="text-green-600 text-xs shrink-0">✓</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Turn Order</p>
            <div className="flex gap-1.5 flex-wrap items-center">
              {players.filter(u => u.hp > 0).map(u => (
                <div
                  key={u.id}
                  title={u.name}
                  onClick={() => phase === "player" && !u.acted && doSelect(u.id)}
                  className={`text-xl rounded-md px-1.5 py-1 transition-all cursor-pointer
                    ${u.acted ? "opacity-25 grayscale" : selected === u.id ? "bg-indigo-800 ring-2 ring-indigo-400 scale-110" : "bg-zinc-800 hover:bg-zinc-700"}`}
                >
                  {u.icon}
                </div>
              ))}
              <span className="text-xs text-zinc-500 ml-1">{players.filter(u => u.hp > 0 && !u.acted).length} remaining</span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Enemies</p>
            <div className="flex flex-col gap-2">
              {enemies.map(u => (
                <div key={u.id} className={`flex items-center gap-2 rounded-lg p-2 ${u.hp <= 0 ? "opacity-15" : ""}`}>
                  <span className="text-xl">{u.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-xs">{u.name}</div>
                    <div className="h-1.5 bg-zinc-700 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full transition-all duration-300" style={{ width: `${Math.max(0, (u.hp / u.maxHp) * 100)}%` }} />
                    </div>
                    <div className="text-zinc-400 text-xs mt-0.5">{u.hp <= 0 ? "💀 Defeated" : `${Math.max(0, u.hp)}/${u.maxHp} HP`}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 flex-1 overflow-hidden">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Battle Log</p>
            <div className="flex flex-col gap-1">
              {log.map((entry, i) => (
                <p key={i} className={`text-xs ${i === 0 ? "text-zinc-100" : "text-zinc-500"}`}>{entry}</p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Win / Lose Overlay */}
      {(phase === "won" || phase === "lost") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="anim-bounce-in bg-zinc-900 border border-zinc-700 rounded-2xl p-10 flex flex-col items-center gap-5 shadow-2xl max-w-sm w-full mx-4">
            <span className="text-7xl">{phase === "won" ? (mode === "endless" ? "🌊" : "🏆") : "💀"}</span>
            <h2 className={`text-3xl font-black ${phase === "won" ? "text-yellow-300" : "text-red-400"}`}>
              {phase === "won"
                ? mode === "endless" ? `Wave ${wave} Cleared!` : "Victory!"
                : mode === "endless" ? `Fell on Wave ${wave}` : "Defeated..."}
            </h2>
            <div className="flex flex-col gap-2 items-center w-full">
              <div className="flex items-center gap-2 bg-purple-900/40 border border-purple-700 rounded-xl px-5 py-2 w-full justify-center">
                <span>💜</span>
                <span className="text-purple-300 font-black">
                  {phase === "lost" ? "consolation: " : "+"}{battleEarned.mana} mana
                </span>
              </div>
              {phase === "won" && (
                <div className="flex items-center gap-2 bg-cyan-900/40 border border-cyan-700 rounded-xl px-5 py-2 w-full justify-center">
                  <span>💎</span>
                  <span className="text-cyan-300 font-black">+{battleEarned.gems} gems</span>
                </div>
              )}
              {battleEarned.oil > 0 && (
                <div className="flex items-center gap-2 bg-amber-900/40 border border-amber-700 rounded-xl px-5 py-2 w-full justify-center">
                  <span>🛢️</span>
                  <span className="text-amber-300 font-black">+{battleEarned.oil} oil</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-1">
              <button onClick={onBack} className="px-5 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-semibold text-sm transition-all hover:scale-105">
                ← Modes
              </button>
              {phase === "won" && mode === "endless" && (
                <button onClick={startNextWave} className="px-5 py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-xl font-semibold text-sm transition-all hover:scale-105">
                  Next Wave →
                </button>
              )}
              <button onClick={restartMode} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all hover:scale-105">
                {phase === "lost" ? "Try Again" : "Play Again"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
