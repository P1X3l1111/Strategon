"use client";
import { useState, useRef, useEffect, useCallback } from "react";

const COLS = 32, ROWS = 18;

const TERRAIN = {
  G: { label:'Grass',    bg:'#243d10', pass:true,  icon:'🌿' },
  R: { label:'Road',     bg:'#7a6448', pass:true,  icon:'🛤️' },
  F: { label:'Forest',   bg:'#152e08', pass:false, icon:'🌲' },
  M: { label:'Mountain', bg:'#4a4545', pass:false, icon:'⛰️' },
  W: { label:'Water',    bg:'#173d60', pass:false, icon:'💧' },
};

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

function loadGrid(mode) {
  try {
    const raw = localStorage.getItem(`rpg_map_${mode}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveGrid(mode, grid) {
  localStorage.setItem(`rpg_map_${mode}`, JSON.stringify(grid));
}

function deleteGrid(mode) {
  localStorage.removeItem(`rpg_map_${mode}`);
}

export default function MapEditor({ mode, modeName, modeColor, onBack }) {
  const [grid, setGrid] = useState(() => loadGrid(mode) || makeDefaultGrid());
  const [selected, setSelected] = useState('G');
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

  function onCellDown(col, row) {
    paintRef.current = true;
    setPainting(true);
    paint(col, row);
  }
  function onCellEnter(col, row) {
    if (paintRef.current) paint(col, row);
  }
  function onMouseUp() {
    paintRef.current = false;
    setPainting(false);
  }

  function handleSave() {
    saveGrid(mode, grid);
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

  function handleDelete() {
    if (!confirm(`Delete the map for ${modeName} mode? Players won't be able to play until a new map is created.`)) return;
    deleteGrid(mode);
    onBack();
  }

  const C = cellSize;

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
            <button key={key} onClick={() => setSelected(key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${selected===key?'border-white text-white scale-105':'border-zinc-600 text-zinc-400 hover:border-zinc-400'}`}
              style={{background: selected===key ? t.bg+'cc' : t.bg+'44'}}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {!t.pass && <span className="text-red-400 text-[9px]">✕</span>}
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
            className={`px-4 py-1 text-xs font-black rounded-lg border transition-all ${saved?'bg-green-700 border-green-500 text-white':'bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white'}`}>
            {saved ? '✓ Saved!' : 'Save Map'}
          </button>
        </div>
      </div>

      {/* Map grid */}
      <div ref={containerRef} className="flex-1 overflow-hidden flex items-center justify-center bg-zinc-950">
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${COLS}, ${C}px)`, gap:0, cursor: painting?'crosshair':'cell', userSelect:'none' }}>
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
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-1.5 bg-zinc-900 border-t border-zinc-700 shrink-0">
        <span className="text-zinc-500 text-[10px] uppercase font-bold">Grid: {COLS}×{ROWS}</span>
        <span className="text-zinc-600 text-[10px]">Click or drag to paint · Red ✕ = impassable terrain</span>
      </div>
    </div>
  );
}
