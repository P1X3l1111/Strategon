"use client";

import { useState } from "react";
import { Coins, Wallet, Package, Landmark, Gem, Diamond, Shapes, Crown, Star, Unlock, TrendingUp, Medal, Castle, X, ShoppingCart } from "lucide-react";

// Real-money purchases, grouped into three sections. No payment processing yet —
// "Buy" just previews the price with a "Coming soon" toast.
const SECTIONS = {
  coins: {
    label: "Coins", icon: Coins,
    items: [
      { id: "coins_1000",  icon: Coins,    name: "Pouch of Coins",  desc: "+1,000 Coins",  price: "$1.99" },
      { id: "coins_3000",  icon: Wallet,   name: "Sack of Coins",   desc: "+3,000 Coins",  price: "$4.99", tag: "Popular" },
      { id: "coins_8000",  icon: Package,  name: "Chest of Coins",  desc: "+8,000 Coins",  price: "$9.99", tag: "Best Value" },
      { id: "coins_20000", icon: Landmark, name: "Vault of Coins",  desc: "+20,000 Coins", price: "$19.99" },
    ],
  },
  gems: {
    label: "Gems", icon: Gem,
    items: [
      { id: "gems_100",  icon: Gem,     name: "Handful of Gems", desc: "+100 Gems",   price: "$1.99" },
      { id: "gems_300",  icon: Diamond, name: "Pouch of Gems",   desc: "+300 Gems",   price: "$4.99", tag: "Popular" },
      { id: "gems_800",  icon: Shapes,  name: "Bag of Gems",     desc: "+800 Gems",   price: "$9.99", tag: "Best Value" },
      { id: "gems_2000", icon: Crown,   name: "Hoard of Gems",   desc: "+2,000 Gems", price: "$19.99" },
    ],
  },
  generals: {
    label: "Commanders", icon: Star,
    items: [
      { id: "gen_slot",   icon: Unlock,     name: "Instant Buff Slot",     desc: "Unlock an extra buff slot on any one commander, instantly.",  price: "$3.99" },
      { id: "gen_levels", icon: TrendingUp, name: "Veteran Bundle",        desc: "+2 instant levels for any one commander of your choice.",      price: "$6.99", tag: "Popular" },
      { id: "gen_chest",  icon: Medal,      name: "Commander's Warchest",  desc: "+1,500 Coins and a free buff for any one commander.",          price: "$9.99", tag: "Best Value" },
      { id: "gen_legion", icon: Castle,     name: "Legion Commander Pass", desc: "Every commander instantly boosted to level 3.",                price: "$14.99", tag: "Ultimate" },
    ],
  },
};

export default function ShopModal({ onClose }) {
  const [tab, setTab] = useState("coins");
  const [toast, setToast] = useState(null);

  function handleBuy(item) {
    setToast(`${item.name} — payments aren't live yet. Coming soon!`);
    setTimeout(() => setToast(null), 2200);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><ShoppingCart size={18}/> Shop</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800"><X size={16}/></button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-zinc-800 shrink-0">
          {Object.entries(SECTIONS).map(([id, sec]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === id ? "bg-indigo-700 text-white" : "text-zinc-500 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <sec.icon size={14}/>{sec.label}
            </button>
          ))}
        </div>

        {toast && (
          <div className="mx-6 mt-3 bg-amber-950/60 border border-amber-700 text-amber-300 text-xs font-bold rounded-lg px-3 py-1.5 text-center shrink-0">
            {toast}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <p className="text-zinc-500 text-xs mb-4">Purchases aren&apos;t live yet — browse away.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SECTIONS[tab].items.map((item) => (
              <div key={item.id} className="relative rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 flex flex-col gap-2">
                {item.tag && (
                  <span className="absolute top-3 right-3 text-[9px] font-bold text-indigo-300 bg-indigo-950 border border-indigo-800 rounded-full px-2 py-0.5">
                    {item.tag}
                  </span>
                )}
                <item.icon size={28} className="text-indigo-400"/>
                <p className="text-white font-black text-sm pr-16">{item.name}</p>
                <p className="text-zinc-400 text-xs leading-snug flex-1">{item.desc}</p>
                <button
                  onClick={() => handleBuy(item)}
                  className="mt-2 w-full py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all active:scale-95"
                >
                  {item.price}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
