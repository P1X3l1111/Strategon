"use client";
import { useState, useEffect } from "react";
import MapEditor, { makeDefaultGrid } from "./MapEditor";

const MODES = [
  { id:'classic', name:'Classic', color:'#6366f1', icon:'⚔',  desc:'Clear all enemy buildings.' },
  { id:'endless', name:'Endless', color:'#16a34a', icon:'∞',  desc:'Enemies storm from the right wall.' },
  { id:'siege',   name:'Siege',   color:'#dc2626', icon:'🏯', desc:'Castle surrounded on every side.' },
  { id:'turns',   name:'Turns',   color:'#0ea5e9', icon:'♟️', desc:'Turn-based tactics battlefield.' },
];

const ACCOUNTS_KEY = 'rpg_accounts';
const ADMIN_KEY    = 'rpg_admin_list';

function getAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}'); } catch { return {}; }
}
function getAdminList() {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEY) || '[]'); } catch { return []; }
}
function saveAdminList(list) { localStorage.setItem(ADMIN_KEY, JSON.stringify(list)); }
function hasMap(id) { return !!localStorage.getItem(`rpg_map_${id}`); }

function fmt(n) { return (n || 0).toLocaleString(); }
function fmtTime(s) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
}
function readStat(key, username) {
  return parseInt(localStorage.getItem(`rpg_${key}_${username.toLowerCase()}`) ?? '0') || 0;
}

export default function AdminPanel({ currentUser, onBack, onMapChange }) {
  const [tab,         setTab]         = useState('players');
  const [editingMode, setEditingMode] = useState(null);
  const [accounts,    setAccounts]    = useState({});
  const [adminList,   setAdminList]   = useState([]);
  const [tick,        setTick]        = useState(0);
  const [sortBy,      setSortBy]      = useState('name');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // This panel reads localStorage directly during render (hasMap/readStat), so it
  // must not render that content until after mount — reachable via a direct /admin
  // URL now, which means an initial server-rendered pass with no localStorage.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAccounts(getAccounts());
    setAdminList(getAdminList());
  }, [tick]);

  if (!mounted) {
    return <div className="flex items-center justify-center h-full bg-zinc-950 text-zinc-500 text-sm">Loading…</div>;
  }

  function refresh() { setTick(t => t + 1); }

  function toggleAdmin(username) {
    const u = username.toLowerCase();
    const list = [...adminList];
    const idx = list.indexOf(u);
    if (idx >= 0) list.splice(idx, 1); else list.push(u);
    saveAdminList(list);
    setAdminList(list);
  }

  function confirmDelete(username) { setDeleteConfirm(username); }
  function doDelete(username) {
    const u = username.toLowerCase();
    const accs = { ...accounts }; delete accs[u];
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accs));
    ['mana','oil','gems','kills','online','coins'].forEach(k => localStorage.removeItem(`rpg_${k}_${u}`));
    setDeleteConfirm(null);
    refresh();
  }

  function openEditor(modeId) { setEditingMode(modeId); }
  function closeEditor() {
    setEditingMode(null);
    onMapChange?.();
    refresh();
  }

  // Full-screen map editor
  if (editingMode) {
    const m = MODES.find(x => x.id === editingMode);
    return <MapEditor mode={m.id} modeName={m.name} modeColor={m.color} onBack={closeEditor} />;
  }

  // Build player rows
  const users = Object.entries(accounts).map(([key, acc]) => {
    return {
      key,
      name: acc.displayName || key,
      isAdmin: adminList.includes(key),
      isSelf: key === (currentUser || '').toLowerCase(),
      mana:   readStat('mana',   key),
      oil:    readStat('oil',    key),
      gems:   readStat('gems',   key),
      kills:  readStat('kills',  key),
      online: readStat('online', key),
    };
  }).sort((a, b) => {
    if (sortBy === 'name')   return a.name.localeCompare(b.name);
    if (sortBy === 'mana')   return b.mana - a.mana;
    if (sortBy === 'kills')  return b.kills - a.kills;
    if (sortBy === 'online') return b.online - a.online;
    return 0;
  });

  const mapsReady  = MODES.filter(m => hasMap(m.id)).length;
  const totalUsers = users.length;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">

      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <button onClick={onBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-semibold transition-all px-3 py-1.5 rounded-lg hover:bg-zinc-800">
          ← Back to Home
        </button>
        <div className="w-px h-5 bg-zinc-700"/>
        <h1 className="text-white font-black text-xl flex items-center gap-2">
          <span className="text-yellow-400">★</span> Admin Panel
        </h1>
        <div className="flex-1"/>
        {/* Summary stats */}
        <div className="flex items-center gap-3">
          <StatChip label="Players" value={totalUsers} color="text-indigo-400"/>
          <StatChip label="Maps Ready" value={`${mapsReady}/${MODES.length}`} color={mapsReady===MODES.length?"text-green-400":"text-amber-400"}/>
        </div>
        <button onClick={refresh}
          className="text-zinc-500 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800 transition-all">
          ↻
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-6 pt-4 pb-0 shrink-0 bg-zinc-950 border-b border-zinc-800">
        <TabBtn active={tab==='players'} onClick={()=>setTab('players')}>👥 Players ({totalUsers})</TabBtn>
        <TabBtn active={tab==='modes'}   onClick={()=>setTab('modes')}>🗺️ Modes &amp; Maps</TabBtn>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── PLAYERS ── */}
        {tab === 'players' && (
          <div className="flex flex-col gap-4">

            {totalUsers === 0 ? (
              <EmptyState icon="👤" text="No accounts registered yet." />
            ) : (
              <>
                {/* Sort bar */}
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-xs">Sort by:</span>
                  {[['name','Name'],['mana','Mana'],['kills','Kills'],['online','Online']].map(([k,l])=>(
                    <button key={k} onClick={()=>setSortBy(k)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-all ${sortBy===k?'border-indigo-500 text-indigo-300 bg-indigo-950':'border-zinc-700 text-zinc-500 hover:text-white'}`}>
                      {l}
                    </button>
                  ))}
                </div>

                {/* Player cards */}
                <div className="flex flex-col gap-2">
                  {users.map(u => (
                    <div key={u.key}
                      className={`rounded-2xl border p-4 transition-all ${u.isSelf?'border-indigo-600 bg-indigo-950/20':'border-zinc-800 bg-zinc-900'}`}>
                      <div className="flex items-start gap-4">

                        {/* Avatar + name */}
                        <div className="w-10 h-10 rounded-full bg-indigo-800 flex items-center justify-center text-base font-black text-white shrink-0">
                          {u.name[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-white font-black text-base">{u.name}</span>
                            {u.isSelf && <Badge color="indigo">You</Badge>}
                            {u.isAdmin && <Badge color="yellow">Admin</Badge>}
                          </div>

                          {/* Stats grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            <Stat icon="💜" label="Mana"   value={fmt(u.mana)}         color="text-purple-300"/>
                            <Stat icon="🟡" label="Oil"    value={fmt(u.oil)}           color="text-amber-300"/>
                            <Stat icon="💎" label="Gems"   value={fmt(u.gems)}          color="text-cyan-300"/>
                            <Stat icon="💀" label="Kills"  value={fmt(u.kills)}         color="text-red-300"/>
                            <Stat icon="⏱"  label="Online" value={fmtTime(u.online)}    color="text-zinc-300"/>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button onClick={() => toggleAdmin(u.key)}
                            className={`text-[11px] font-bold px-3 py-1 rounded-lg border transition-all ${u.isAdmin?'border-red-700 text-red-400 hover:bg-red-950':'border-zinc-600 text-zinc-400 hover:border-yellow-600 hover:text-yellow-400'}`}>
                            {u.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                          </button>
                          {!u.isSelf && (
                            deleteConfirm === u.key ? (
                              <div className="flex gap-1">
                                <button onClick={() => doDelete(u.key)}
                                  className="text-[11px] font-bold px-2 py-1 rounded-lg bg-red-700 text-white hover:bg-red-600">
                                  Confirm
                                </button>
                                <button onClick={() => setDeleteConfirm(null)}
                                  className="text-[11px] font-bold px-2 py-1 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600">
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => confirmDelete(u.key)}
                                className="text-[11px] font-bold px-3 py-1 rounded-lg border border-zinc-700 text-zinc-500 hover:border-red-700 hover:text-red-400 transition-all">
                                Delete
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── MODES & MAPS ── */}
        {tab === 'modes' && (
          <div className="flex flex-col gap-4 max-w-2xl">
            <p className="text-zinc-500 text-sm">Click <strong className="text-white">Edit Map</strong> to open the terrain editor for that mode. Deleting a map locks the mode until a new one is created.</p>

            {MODES.map(m => {
              const ready = hasMap(m.id);
              return (
                <div key={m.id} className={`rounded-2xl border p-5 flex items-center gap-5 transition-all ${ready?'border-zinc-700 bg-zinc-900':'border-red-900 bg-red-950/10'}`}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-black shrink-0"
                    style={{background:`${m.color}18`, border:`2px solid ${m.color}44`, color:m.color}}>
                    {m.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-white font-black text-lg">{m.name}</span>
                      {ready
                        ? <span className="text-[10px] font-black text-green-300 bg-green-950 border border-green-800 px-2 py-0.5 rounded-full">✓ Map Ready</span>
                        : <span className="text-[10px] font-black text-red-300 bg-red-950 border border-red-800 px-2 py-0.5 rounded-full">✕ No Map — Locked</span>
                      }
                    </div>
                    <p className="text-zinc-500 text-xs">{m.desc}</p>
                  </div>
                  <button onClick={() => openEditor(m.id)}
                    className="px-5 py-2 text-sm font-bold rounded-xl border transition-all shrink-0 bg-indigo-700 hover:bg-indigo-600 border-indigo-500 text-white">
                    {ready ? '✏️ Edit Map' : '+ Create Map'}
                  </button>
                </div>
              );
            })}

            <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-zinc-400 text-xs font-bold mb-2">Map Editor Quick Tips</p>
              <ul className="text-zinc-500 text-xs space-y-1 list-disc list-inside">
                <li>Click or drag on tiles to paint terrain</li>
                <li>Forest, Mountain, Water are impassable (red ✕)</li>
                <li>Use <strong className="text-zinc-300">Default</strong> to load the built-in terrain template</li>
                <li><strong className="text-zinc-300">Save Map</strong> makes the mode immediately playable</li>
                <li><strong className="text-red-400">Delete Map</strong> locks the mode until a new map is saved</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-5 py-2.5 text-sm font-bold rounded-t-xl border-b-2 transition-all ${active?'border-indigo-500 text-white bg-zinc-900':'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'}`}>
      {children}
    </button>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div className="flex items-center gap-1.5 bg-zinc-800 px-3 py-1 rounded-full border border-zinc-700">
      <span className={`font-black text-sm ${color}`}>{value}</span>
      <span className="text-zinc-500 text-xs">{label}</span>
    </div>
  );
}

function Badge({ color, children }) {
  const colors = {
    indigo: 'bg-indigo-900 text-indigo-300 border-indigo-700',
    yellow: 'bg-yellow-900 text-yellow-300 border-yellow-700',
  };
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${colors[color]||''}`}>{children}</span>
  );
}

function Stat({ icon, label, value, color }) {
  return (
    <div className="flex items-center gap-1.5 bg-zinc-800/60 rounded-lg px-2 py-1">
      <span className="text-xs">{icon}</span>
      <div className="flex flex-col">
        <span className={`text-xs font-bold leading-tight ${color}`}>{value}</span>
        <span className="text-zinc-600 text-[9px] leading-tight">{label}</span>
      </div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
      <div className="text-5xl mb-3">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}
