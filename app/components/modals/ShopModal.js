"use client";

import { useState } from "react";

// Boosts are meaningful but capped (20% income bumps, one free unit, currency
// bundles) — strong enough to feel worth buying, not strong enough to trivialize
// the game. No payment processing yet — "Buy" just previews the price.
const SHOP_ITEMS = [
  { id: "starter",    icon: "🎁", name: "Starter Pack",  desc: "+1,000 Coins and +100 Gems to kickstart your army.",  price: "$2.99",  tag: "New Commander" },
  { id: "mana_boost", icon: "💜", name: "Mana Surge",    desc: "Permanent +20% mana income from all Factories.",      price: "$4.99",  tag: "Permanent" },
  { id: "oil_boost",  icon: "🛢️", name: "Oil Surge",     desc: "Permanent +20% oil income from all Oil Pumps.",       price: "$4.99",  tag: "Permanent" },
  { id: "elite",      icon: "🎖️", name: "Elite Squad",   desc: "Start every battle with a free Commandos unit.",      price: "$5.99",  tag: "Popular" },
  { id: "coin_vault", icon: "💰", name: "Coin Vault",    desc: "+5,000 Coins added to your balance.",                 price: "$9.99",  tag: "Best Value" },
  { id: "gem_chest",  icon: "💎", name: "Gem Chest",     desc: "+300 Gems added to your balance.",                    price: "$9.99",  tag: "Best Value" },
  { id: "vip",        icon: "👑", name: "VIP Pass",      desc: "+15% coins and gems from every quest, forever.",      price: "$14.99", tag: "Ultimate" },
];

export default function ShopModal({ onClose }) {
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
          <h2 className="text-xl font-bold text-white">🛒 Shop</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800">✕</button>
        </div>

        {toast && (
          <div className="mx-6 mt-3 bg-amber-950/60 border border-amber-700 text-amber-300 text-xs font-bold rounded-lg px-3 py-1.5 text-center shrink-0">
            {toast}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <p className="text-zinc-500 text-xs mb-4">Boosts and bundles to speed up your campaign. Purchases aren&apos;t live yet — browse away.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SHOP_ITEMS.map((item) => (
              <div key={item.id} className="relative rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 flex flex-col gap-2">
                {item.tag && (
                  <span className="absolute top-3 right-3 text-[9px] font-bold text-indigo-300 bg-indigo-950 border border-indigo-800 rounded-full px-2 py-0.5">
                    {item.tag}
                  </span>
                )}
                <span className="text-3xl">{item.icon}</span>
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
