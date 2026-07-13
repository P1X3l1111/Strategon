"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sprout, Route, TreePine, Mountain as MountainIcon, Droplet,
  User, UserPlus, Truck, Medal, Car, Shield, ShieldAlert, Crosshair, Target, Rocket,
  X, CheckCircle2, Castle, Skull,
} from "lucide-react";

const COLS = 32, ROWS = 18;

const TERRAIN = {
  G: { label:'Grass',    bg:'#243d10', pass:true,  icon:Sprout },
  R: { label:'Road',     bg:'#7a6448', pass:true,  icon:Route },
  F: { label:'Forest',   bg:'#152e08', pass:false, icon:TreePine },
  M: { label:'Mountain', bg:'#4a4545', pass:false, icon:MountainIcon },
  W: { label:'Water',    bg:'#173d60', pass:false, icon:Droplet },
};

// Troop types an admin can hand-place as the enemy garrison on a Siege map.
export const ENEMY_TROOP_TYPES = [
  { key:'inf_light',   label:'Light Inf.',   icon:User },
  { key:'inf_assault', label:'Assault Inf.', icon:UserPlus },
  { key:'inf_motor',   label:'Motorized',    icon:Truck },
  { key:'commandos',   label:'Commandos',    icon:Medal },
  { key:'armor_car',   label:'Armored Car',  icon:Car },
  { key:'tank_light',  label:'Light Tank',   icon:Shield },
  { key:'tank_heavy',  label:'Heavy Tank',   icon:ShieldAlert },
  { key:'artillery',   label:'Artillery',    icon:Crosshair },
  { key:'howitzer',    label:'Howitzer',     icon:Target },
  { key:'rocket',      label:'Rocket Arty',  icon:Rocket },
];
const MAX_OUTPOSTS = 2;

export function makeDefaultGrid() {
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

// Saved maps used to be just the raw terrain grid (a plain array). Newer saves
// are `{ terrain, commandPost, outposts, enemyUnits }`. This normalizes either
// shape into the full object so old maps keep working untouched.
export function normalizeMapData(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return { terrain: raw, commandPost: null, outposts: [], enemyUnits: [] };
  return {
    terrain: raw.terrain || makeDefaultGrid(),
    commandPost: raw.commandPost || null,
    outposts: raw.outposts || [],
    enemyUnits: raw.enemyUnits || [],
  };
}

export function loadMapData(mode) {
  try {
    const raw = localStorage.getItem(`rpg_map_${mode}`);
    if (raw) return normalizeMapData(JSON.parse(raw));
  } catch {}
  return null;
}

function saveMapData(mode, data) {
  localStorage.setItem(`rpg_map_${mode}`, JSON.stringify(data));
}

function deleteGrid(mode) {
  localStorage.removeItem(`rpg_map_${mode}`);
}

export default function MapEditor({ mode, modeName, modeColor, onBack }) {
  const initial = loadMapData(mode);
  const [grid,        setGrid]        = useState(() => initial?.terrain || makeDefaultGrid());
  const [commandPost, setCommandPost] = useState(() => initial?.commandPost || null);
  const [outposts,    setOutposts]    = useState(() => initial?.outposts || []);
  const [enemyUnits,  setEnemyUnits]  = useState(() => initial?.enemyUnits || []);

  const [selected, setSelected] = useState('G');
  const [tool,     setTool]     = useState('terrain'); // terrain | commandpost | outpost | enemy
  const [enemyType, setEnemyType] = useState(ENEMY_TROOP_TYPES[0].key);
  const [painting, setPainting] = useState(false);
  const [cellSize, setCellSize] = useState(28);
  const [saved, setSaved] = useState(false);
  const containerRef = useRef(null);
  const paintRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const measure = () => {
      const el = containerRef.current; if (!el) return;
      const w = el.clientWidth, h = el.clientHeight - 48;
      const cs = Math.max(Math.min(Math.floor(w / COLS), Math.floor(h / ROWS)), 14);
      setCellSize(cs);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const paint = useCallback((col, row) => {
    setGrid(prev => {
      const next = prev.map(r => [...r]);
      next[row][col] = selected;
      return next;
    });
  }, [selected]);

  function placeAt(col, row) {
    if (tool === 'commandpost') {
      setCommandPost({ col, row });
    } else if (tool === 'outpost') {
      setOutposts(prev => {
        const idx = prev.findIndex(o => o.col === col && o.row === row);
        if (idx >= 0) return prev.filter((_, i) => i !== idx);
        if (prev.length >= MAX_OUTPOSTS) return prev;
        return [...prev, { col, row }];
      });
    } else if (tool === 'enemy') {
      setEnemyUnits(prev => {
        const idx = prev.findIndex(e => e.col === col && e.row === row);
        if (idx >= 0) return prev.filter((_, i) => i !== idx);
        return [...prev, { type: enemyType, col, row }];
      });
    }
  }

  function onCellDown(col, row) {
    if (tool !== 'terrain') { placeAt(col, row); return; }
    paintRef.current = true;
    setPainting(true);
    paint(col, row);
  }
  function onCellEnter(col, row) {
    if (tool === 'terrain' && paintRef.current) paint(col, row);
  }
  function onMouseUp() {
    paintRef.current = false;
    setPainting(false);
  }

  function handleSave() {
    saveMapData(mode, { terrain: grid, commandPost, outposts, enemyUnits });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    if (!confirm('Reset to default terrain? Unsaved changes will be lost.')) return;
    setGrid(makeDefaultGrid());
  }

  function handleClear() {
    if (!confirm('Clear all terrain to grass?')) return;
    setGrid(Array.from({ length: ROWS }, () => Array(COLS).fill('G')));
  }

  function handleResetPlacements() {
    if (!confirm('Reset Command Post, Outposts and enemy troops back to the built-in default positions?')) return;
    setCommandPost(null);
    setOutposts([]);
    setEnemyUnits([]);
  }

  function handleDelete() {
    if (!confirm(`Delete the map for ${modeName} mode? Players won't be able to play until a new map is created.`)) return;
    deleteGrid(mode);
    onBack();
  }

  const C = cellSize;
  const isSiege = mode === 'siege';

  return (
    <div className="flex flex-col h-full bg-zinc-950 select-none" onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-zinc-900 border-b border-zinc-700 shrink-0 flex-wrap">
        <button onClick={onBack} className="text-zinc-400 hover:text-white text-sm font-semibold flex items-center gap-1">
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{background:modeColor}}/>
          <span className="text-white font-black text-sm">{modeName} — Map Editor</span>
        </div>

        {/* Terrain palette */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(TERRAIN).map(([key, t]) => (
            <button key={key} onClick={() => { setTool('terrain'); setSelected(key); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${tool==='terrain'&&selected===key?'border-white text-white scale-105':'border-zinc-600 text-zinc-400 hover:border-zinc-400'}`}
              style={{background: tool==='terrain'&&selected===key ? t.bg+'cc' : t.bg+'44'}}>
              <t.icon size={13}/>
              <span>{t.label}</span>
              {!t.pass && <X size={9} className="text-red-400"/>}
            </button>
          ))}
        </div>

        <div className="flex-1"/>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={handleClear}
            className="px-3 py-1 text-xs font-bold bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg border border-zinc-600">
            Clear
          </button>
          <button onClick={handleReset}
            className="px-3 py-1 text-xs font-bold bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg border border-zinc-600">
            Default
          </button>
          <button onClick={handleDelete}
            className="px-3 py-1 text-xs font-bold bg-red-900 hover:bg-red-800 text-red-300 rounded-lg border border-red-700">
            Delete Map
          </button>
          <button onClick={handleSave}
            className={`px-4 py-1 text-xs font-black rounded-lg border transition-all flex items-center gap-1 ${saved?'bg-green-700 border-green-500 text-white':'bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white'}`}>
            {saved ? <><CheckCircle2 size={13}/> Saved!</> : 'Save Map'}
          </button>
        </div>
      </div>

      {/* Placements bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/60 border-b border-zinc-800 shrink-0 flex-wrap">
        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest shrink-0">Placements</span>

        <button onClick={() => setTool(t => t === 'commandpost' ? 'terrain' : 'commandpost')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${tool==='commandpost'?'border-blue-400 text-white bg-blue-900/60 scale-105':'border-zinc-600 text-zinc-400 hover:border-zinc-400'}`}>
          <Castle size={13}/> Command Post {commandPost ? '(set)' : '(default)'}
        </button>

        <button onClick={() => setTool(t => t === 'outpost' ? 'terrain' : 'outpost')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${tool==='outpost'?'border-blue-400 text-white bg-blue-900/60 scale-105':'border-zinc-600 text-zinc-400 hover:border-zinc-400'}`}>
          <Shield size={13}/> Outposts ({outposts.length}/{MAX_OUTPOSTS}{outposts.length===0?', default':''})
        </button>

        {isSiege && (
          <>
            <div className="w-px h-5 bg-zinc-700"/>
            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest shrink-0">Enemy Garrison</span>
            <select value={enemyType} onChange={e => setEnemyType(e.target.value)}
              className="bg-zinc-800 border border-zinc-600 text-zinc-200 text-xs rounded-lg px-2 py-1">
              {ENEMY_TROOP_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <button onClick={() => setTool(t => t === 'enemy' ? 'terrain' : 'enemy')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${tool==='enemy'?'border-red-400 text-white bg-red-900/60 scale-105':'border-zinc-600 text-zinc-400 hover:border-zinc-400'}`}>
              <Skull size={13}/> Place Enemy ({enemyUnits.length}{enemyUnits.length===0?', default':''})
            </button>
          </>
        )}

        <button onClick={handleResetPlacements}
          className="ml-auto px-2.5 py-1 text-[11px] font-bold text-zinc-500 hover:text-red-400 rounded-lg border border-zinc-700 hover:border-red-800 transition-all">
          Reset Placements
        </button>
      </div>
      {tool !== 'terrain' && (
        <div className="px-4 py-1 bg-zinc-900/40 border-b border-zinc-800 shrink-0">
          <p className="text-zinc-500 text-[10px]">
            {tool === 'commandpost' && 'Click a tile to move the Command Post there.'}
            {tool === 'outpost' && `Click a tile to add an Outpost (max ${MAX_OUTPOSTS}) — click an existing one to remove it.`}
            {tool === 'enemy' && 'Click a tile to add the selected enemy troop — click an existing one to remove it.'}
          </p>
        </div>
      )}

      {/* Map grid */}
      <div ref={containerRef} className="flex-1 overflow-hidden flex items-center justify-center bg-zinc-950">
        <div style={{ position:'relative' }}>
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${COLS}, ${C}px)`, gap:0, cursor: tool==='terrain'&&painting?'crosshair':'cell', userSelect:'none' }}>
            {Array.from({length:ROWS}, (_,row) =>
              Array.from({length:COLS}, (_,col) => {
                const t = TERRAIN[grid[row]?.[col] || 'G'];
                return (
                  <div key={`${col},${row}`}
                    onMouseDown={() => onCellDown(col, row)}
                    onMouseEnter={() => onCellEnter(col, row)}
                    style={{
                      width:C, height:C,
                      background: t.bg,
                      boxSizing:'border-box',
                      border:'1px solid rgba(0,0,0,0.18)',
                      transition:'background 0.05s',
                    }}
                  />
                );
              })
            )}
          </div>

          {/* Placement overlays */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
            {commandPost && (
              <div title="Command Post" style={{ position:'absolute', left:commandPost.col*C, top:commandPost.row*C, width:C*2, height:C*2, display:'flex', alignItems:'center', justifyContent:'center', color:'#60a5fa', background:'rgba(59,130,246,0.35)', border:'2px solid #60a5fa', borderRadius:4 }}>
                <Castle size={Math.max(C*1.1,14)}/>
              </div>
            )}
            {outposts.map((o,i) => (
              <div key={i} title="Outpost" style={{ position:'absolute', left:o.col*C, top:o.row*C, width:C, height:C, display:'flex', alignItems:'center', justifyContent:'center', color:'#93c5fd', background:'rgba(96,165,250,0.3)', border:'2px solid #93c5fd', borderRadius:4 }}>
                <Shield size={Math.max(C*0.8,12)}/>
              </div>
            ))}
            {enemyUnits.map((e,i) => {
              const t = ENEMY_TROOP_TYPES.find(x => x.key === e.type);
              const EnemyIcon = t?.icon || Skull;
              return (
                <div key={i} title={t?.label||e.type} style={{ position:'absolute', left:e.col*C, top:e.row*C, width:C, height:C, display:'flex', alignItems:'center', justifyContent:'center', color:'#f87171', background:'rgba(239,68,68,0.3)', border:'2px solid #f87171', borderRadius:4 }}>
                  <EnemyIcon size={Math.max(C*0.8,12)}/>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-1.5 bg-zinc-900 border-t border-zinc-700 shrink-0">
        <span className="text-zinc-500 text-[10px] uppercase font-bold">Grid: {COLS}×{ROWS}</span>
        <span className="text-zinc-600 text-[10px]">Click or drag to paint terrain · Use Placements above to set Command Post, Outposts{isSiege ? ' and enemy troops' : ''} · Red X = impassable terrain</span>
      </div>
    </div>
  );
}
