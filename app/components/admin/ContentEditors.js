"use client";
import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Check } from "lucide-react";
import { ICON_KEYS, resolveIcon } from "../../data/icons";
import {
  getCustomShopItems, addShopItem, updateShopItem, deleteShopItem,
} from "../../data/shopItems";
import {
  GENERALS, getCustomGenerals, addCustomGeneral, updateCustomGeneral, deleteCustomGeneral,
} from "../../data/generals";

const SHOP_CATEGORIES = [
  { id: "coins",    label: "Coins" },
  { id: "gems",     label: "Gems" },
  { id: "generals", label: "Commanders" },
];

const BONUS_STATS = [
  { id: "hpMult",    label: "Max HP",       kind: "percent" },
  { id: "atkMult",   label: "Attack Damage", kind: "percent" },
  { id: "movAdd",    label: "Movement",     kind: "flat" },
  { id: "rangeAdd",  label: "Attack Range", kind: "flat" },
];

function emptyShopForm() {
  return { category: "coins", name: "", desc: "", price: "", tag: "", iconKey: ICON_KEYS[0] };
}
function emptyGeneralForm() {
  return { name: "", desc: "", price: "", color: "#6366f1", iconKey: ICON_KEYS[0], statId: "hpMult", statValue: "" };
}

// ── Shop items ────────────────────────────────────────────────────────────
export function ShopItemsEditor() {
  const [items, setItems] = useState([]);
  // Kept always-populated (never null) — the React Compiler's auto-memoization
  // reads form.category etc. to decide whether to re-create <ShopItemForm>,
  // and it does so unconditionally, even though that element creation is
  // itself gated behind `formOpen &&`. A null form crashes that check.
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyShopForm());
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const refresh = () => setItems(getCustomShopItems());
    refresh();
    window.addEventListener("rpg_admin_shop_items_updated", refresh);
    return () => window.removeEventListener("rpg_admin_shop_items_updated", refresh);
  }, []);

  function startAdd() { setForm(emptyShopForm()); setFormOpen(true); }
  function startEdit(item) {
    setForm({ category: item.category, name: item.name, desc: item.desc, price: item.price, tag: item.tag || "", iconKey: item.iconKey, id: item.id });
    setFormOpen(true);
  }
  function closeForm() { setFormOpen(false); }
  function save() {
    if (!form.name.trim() || !form.price.toString().trim()) return;
    if (form.id) updateShopItem(form.id, { category: form.category, name: form.name, desc: form.desc, price: form.price, tag: form.tag, iconKey: form.iconKey });
    else addShopItem({ category: form.category, name: form.name, desc: form.desc, price: form.price, tag: form.tag, iconKey: form.iconKey });
    setFormOpen(false);
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-zinc-500 text-sm">Items you add here appear in the Shop, in the matching category tab, alongside the built-in ones.</p>
        {!formOpen && (
          <button onClick={startAdd} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-700 hover:bg-indigo-600 text-white transition-all">
            <Plus size={14}/> Add Item
          </button>
        )}
      </div>

      {formOpen && (
        <ShopItemForm form={form} setForm={setForm} onCancel={closeForm} onSave={save} />
      )}

      {items.length === 0 && !formOpen && (
        <p className="text-zinc-600 text-sm py-8 text-center">No custom shop items yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {items.map(item => (
          <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 flex items-center gap-3">
            <span className="text-indigo-400 shrink-0"><item.icon size={22}/></span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm flex items-center gap-1.5">
                {item.name}
                <span className="text-[9px] font-bold text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-full px-1.5 py-0.5">
                  {SHOP_CATEGORIES.find(c => c.id === item.category)?.label}
                </span>
              </p>
              <p className="text-zinc-500 text-xs truncate">{item.desc}</p>
            </div>
            <span className="text-zinc-300 text-sm font-bold shrink-0">{item.price}</span>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={() => startEdit(item)} className="text-zinc-500 hover:text-white p-1.5 rounded hover:bg-zinc-800"><Pencil size={13}/></button>
              {confirmDelete === item.id ? (
                <>
                  <button onClick={() => { deleteShopItem(item.id); setConfirmDelete(null); }} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-red-700 text-white hover:bg-red-600">Confirm</button>
                  <button onClick={() => setConfirmDelete(null)} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600">Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(item.id)} className="text-zinc-500 hover:text-red-400 p-1.5 rounded hover:bg-zinc-800"><Trash2 size={13}/></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShopItemForm({ form, setForm, onCancel, onSave }) {
  return (
    <div className="rounded-xl border border-indigo-700 bg-indigo-950/20 p-4 flex flex-col gap-3">
      <div className="flex gap-2">
        {SHOP_CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setForm({ ...form, category: c.id })}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${form.category === c.id ? "border-indigo-500 bg-indigo-700 text-white" : "border-zinc-700 text-zinc-400 hover:text-white"}`}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <LabeledInput label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Sack of Coins" />
        <LabeledInput label="Price" value={form.price} onChange={v => setForm({ ...form, price: v })} placeholder="$4.99" />
      </div>
      <LabeledInput label="Description" value={form.desc} onChange={v => setForm({ ...form, desc: v })} placeholder="+3,000 Coins" />
      <LabeledInput label="Tag (optional)" value={form.tag} onChange={v => setForm({ ...form, tag: v })} placeholder="Popular" />
      <IconPicker value={form.iconKey} onChange={v => setForm({ ...form, iconKey: v })} />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Cancel</button>
        <button onClick={onSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-700 hover:bg-indigo-600 text-white"><Check size={13}/> {form.id ? "Save" : "Add"}</button>
      </div>
    </div>
  );
}

// ── Commanders ────────────────────────────────────────────────────────────
export function CommandersEditor() {
  const [customGenerals, setCustomGenerals] = useState([]);
  // See the matching comment in ShopItemsEditor — form must never be null.
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyGeneralForm());
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const refresh = () => setCustomGenerals(getCustomGenerals());
    refresh();
    window.addEventListener("rpg_admin_generals_updated", refresh);
    return () => window.removeEventListener("rpg_admin_generals_updated", refresh);
  }, []);

  function startAdd() { setForm(emptyGeneralForm()); setFormOpen(true); }
  function startEdit(g) {
    const statId = Object.keys(g.boosts || {})[0] || "hpMult";
    const raw = (g.boosts || {})[statId];
    const stat = BONUS_STATS.find(s => s.id === statId);
    const statValue = stat?.kind === "percent" ? Math.round(((raw ?? 1) - 1) * 100) : (raw ?? 0);
    setForm({ id: g.id, name: g.name, desc: g.desc, price: g.price, color: g.color, iconKey: g.iconKey, statId, statValue: String(statValue) });
    setFormOpen(true);
  }
  function closeForm() { setFormOpen(false); }
  function save() {
    if (!form.name.trim()) return;
    const stat = BONUS_STATS.find(s => s.id === form.statId);
    const val = parseFloat(form.statValue) || 0;
    const boosts = { [form.statId]: stat.kind === "percent" ? 1 + val / 100 : val };
    const payload = { name: form.name, desc: form.desc || describeBoost(form.statId, val), price: parseInt(form.price) || 0, color: form.color, iconKey: form.iconKey, boosts };
    if (form.id) updateCustomGeneral(form.id, payload);
    else addCustomGeneral(payload);
    setFormOpen(false);
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-zinc-500 text-sm">Commanders added here show up in the Commanders shop tab, purchasable with gems and usable in battle just like the built-in ones.</p>
        {!formOpen && (
          <button onClick={startAdd} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-700 hover:bg-indigo-600 text-white transition-all">
            <Plus size={14}/> Add Commander
          </button>
        )}
      </div>

      {formOpen && (
        <GeneralForm form={form} setForm={setForm} onCancel={closeForm} onSave={save} />
      )}

      {/* Built-in roster — reference only, not editable here */}
      <div className="flex flex-col gap-2">
        <p className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest">Built-in (not editable)</p>
        {GENERALS.map(g => (
          <div key={g.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 flex items-center gap-3 opacity-60">
            <span style={{ color: g.color }} className="shrink-0"><g.icon size={22}/></span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">{g.name}</p>
              <p className="text-zinc-500 text-xs">{g.desc}</p>
            </div>
            <span className="text-zinc-400 text-xs font-bold shrink-0">{g.price === 0 ? "Free" : `${g.price} gems`}</span>
          </div>
        ))}
      </div>

      {customGenerals.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest">Custom</p>
          {customGenerals.map(g => (
            <div key={g.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 flex items-center gap-3">
              <span style={{ color: g.color }} className="shrink-0"><g.icon size={22}/></span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">{g.name}</p>
                <p className="text-zinc-500 text-xs truncate">{g.desc}</p>
              </div>
              <span className="text-zinc-300 text-xs font-bold shrink-0">{g.price === 0 ? "Free" : `${g.price} gems`}</span>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => startEdit(g)} className="text-zinc-500 hover:text-white p-1.5 rounded hover:bg-zinc-800"><Pencil size={13}/></button>
                {confirmDelete === g.id ? (
                  <>
                    <button onClick={() => { deleteCustomGeneral(g.id); setConfirmDelete(null); }} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-red-700 text-white hover:bg-red-600">Confirm</button>
                    <button onClick={() => setConfirmDelete(null)} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDelete(g.id)} className="text-zinc-500 hover:text-red-400 p-1.5 rounded hover:bg-zinc-800"><Trash2 size={13}/></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function describeBoost(statId, value) {
  const stat = BONUS_STATS.find(s => s.id === statId);
  if (!stat) return "";
  return stat.kind === "percent" ? `+${value}% ${stat.label.toLowerCase()}` : `+${value} ${stat.label.toLowerCase()}`;
}

function GeneralForm({ form, setForm, onCancel, onSave }) {
  const stat = BONUS_STATS.find(s => s.id === form.statId);
  return (
    <div className="rounded-xl border border-indigo-700 bg-indigo-950/20 p-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <LabeledInput label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Storm Commander" />
        <LabeledInput label="Price (gems)" value={form.price} onChange={v => setForm({ ...form, price: v })} placeholder="150" type="number" />
      </div>
      <LabeledInput label="Description (optional — auto-filled from bonus)" value={form.desc} onChange={v => setForm({ ...form, desc: v })} placeholder="Leave blank to auto-generate" />

      <div className="grid grid-cols-2 gap-3 items-end">
        <div className="flex flex-col gap-1">
          <span className="text-zinc-500 text-[10px] uppercase font-bold">Bonus Stat</span>
          <select value={form.statId} onChange={e => setForm({ ...form, statId: e.target.value })}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm text-white">
            {BONUS_STATS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <LabeledInput label={`Amount (${stat.kind === "percent" ? "%" : "flat"})`} value={form.statValue} onChange={v => setForm({ ...form, statValue: v })} placeholder={stat.kind === "percent" ? "25" : "2"} type="number" />
      </div>

      <div className="flex items-center gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500 text-[10px] uppercase font-bold">Color</span>
          <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-10 h-8 rounded border border-zinc-700 bg-zinc-900" />
        </label>
      </div>

      <IconPicker value={form.iconKey} onChange={v => setForm({ ...form, iconKey: v })} />

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Cancel</button>
        <button onClick={onSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-700 hover:bg-indigo-600 text-white"><Check size={13}/> {form.id ? "Save" : "Add"}</button>
      </div>
    </div>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────
function LabeledInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-zinc-500 text-[10px] uppercase font-bold">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </label>
  );
}

function IconPicker({ value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-zinc-500 text-[10px] uppercase font-bold">Icon</span>
      <div className="flex flex-wrap gap-1.5">
        {ICON_KEYS.map(key => {
          const Icon = resolveIcon(key);
          const active = value === key;
          return (
            <button key={key} type="button" onClick={() => onChange(key)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${active ? "border-indigo-500 bg-indigo-700 text-white" : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"}`}>
              <Icon size={15}/>
            </button>
          );
        })}
      </div>
    </div>
  );
}
