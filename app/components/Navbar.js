"use client";

import { useState, useEffect, useRef } from "react";
import ReportBugModal from "./modals/ReportBugModal";
import SuggestionModal from "./modals/SuggestionModal";
import AdminApplicationModal from "./modals/AdminApplicationModal";
import QuestsModal from "./modals/QuestsModal";
import { getClaimableCount } from "../data/quests";

const XP_MAX = 1000;

function readCoins(u) {
  const raw = localStorage.getItem(`rpg_coins_${u}`);
  return raw !== null ? (parseInt(raw) || 0) : 500;
}
function readGems(u) {
  const raw = localStorage.getItem(`rpg_gems_${u}`);
  return raw !== null ? (parseInt(raw) || 0) : 0;
}
function readKills(u) {
  const raw = localStorage.getItem(`rpg_kills_${u}`);
  return raw !== null ? (parseInt(raw) || 0) : 0;
}
function readOnlineTime(u) {
  const raw = localStorage.getItem(`rpg_online_${u}`);
  return raw !== null ? (parseInt(raw) || 0) : 0;
}
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function Navbar({ onAdmin }) {
  const [username,   setUsername]   = useState(null);
  const [coins,      setCoins]      = useState(0);
  const [gems,       setGems]       = useState(0);
  const [kills,      setKills]      = useState(0);
  const [onlineTime, setOnlineTime] = useState(0);
  const [xp]                        = useState(0);
  const [lockerOpen, setLockerOpen] = useState(false);
  const [modal,      setModal]      = useState(null);
  const [claimable,  setClaimable]  = useState(0);
  const lockerRef    = useRef(null);
  const sessionStart = useRef(Date.now());

  function loadUser(u) {
    setUsername(u);
    setCoins(readCoins(u));
    setGems(readGems(u));
    setKills(readKills(u));
    setOnlineTime(readOnlineTime(u));
    setClaimable(getClaimableCount());
  }

  useEffect(() => {
    const u = localStorage.getItem("rpg_username");
    if (u) loadUser(u);

    const onProfile  = () => { const u2 = localStorage.getItem("rpg_username"); if (u2) loadUser(u2); };
    const onCurrency = () => { const u2 = localStorage.getItem("rpg_username"); if (u2) { setCoins(readCoins(u2)); setGems(readGems(u2)); } };
    const onQuests   = () => setClaimable(getClaimableCount());

    window.addEventListener("rpg_profile_updated",  onProfile);
    window.addEventListener("rpg_currency_updated", onCurrency);
    window.addEventListener("rpg_quests_updated",   onQuests);
    return () => {
      window.removeEventListener("rpg_profile_updated",  onProfile);
      window.removeEventListener("rpg_currency_updated", onCurrency);
      window.removeEventListener("rpg_quests_updated",   onQuests);
    };
  }, []);

  // Track online time — increment every 60s and save
  useEffect(() => {
    if (!username) return;
    const interval = setInterval(() => {
      const base = readOnlineTime(username);
      const newVal = base + 60;
      localStorage.setItem(`rpg_online_${username}`, String(newVal));
      setOnlineTime(newVal);
    }, 60000);
    return () => clearInterval(interval);
  }, [username]);

  // Close locker when clicking outside
  useEffect(() => {
    function handle(e) {
      if (lockerRef.current && !lockerRef.current.contains(e.target)) setLockerOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const xpPercent = Math.min((xp / XP_MAX) * 100, 100);

  return (
    <>
      <nav className="w-full bg-zinc-900 text-white shadow-lg border-b border-zinc-700 z-40 sticky top-0">

        {/* ── Row 1: community buttons ── */}
        <div className="border-b border-zinc-800">
          <div className="mx-auto w-full max-w-[1400px] flex items-center justify-center px-6 py-1.5 gap-6">
            <TopBarButton onClick={() => setModal("bug")}>Report Bug</TopBarButton>
            <span className="text-zinc-700">|</span>
            <TopBarButton onClick={() => setModal("suggestion")}>Make a Suggestion</TopBarButton>
            <span className="text-zinc-700">|</span>
            <TopBarButton onClick={() => setModal("admin")}>
              Apply for Admin
              <span className="ml-1 text-xs font-semibold bg-red-600 text-white rounded-full px-1.5 py-0.5">LIMITED</span>
              <span className="ml-1 text-xs font-semibold bg-zinc-600 text-zinc-300 rounded-full px-1.5 py-0.5">No Payment</span>
            </TopBarButton>
            {onAdmin && (
              <>
                <span className="text-zinc-700">|</span>
                <TopBarButton onClick={onAdmin}>
                  🔑 Admin Panel
                </TopBarButton>
              </>
            )}
          </div>
        </div>

        {/* ── Row 2: username · xp bar · locker ── */}
        <div className="border-b border-zinc-800">
          <div className="mx-auto w-full max-w-[1400px] flex items-center px-6 py-2 gap-4">
            {/* Username */}
            <div className="flex items-center gap-2 bg-zinc-800 rounded-full px-4 py-1.5 text-sm font-semibold shrink-0">
              <span className="text-lg">⚔️</span>
              <span className="text-zinc-100">
                {username || <span className="text-zinc-400 italic">No profile</span>}
              </span>
            </div>

            {/* XP bar */}
            <div className="flex flex-col gap-0.5 flex-1 max-w-xs">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>XP</span>
                <span>{xp} / {XP_MAX}</span>
              </div>
              <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>

            <div className="flex-1" />

            {/* Quests & rewards */}
            <button
              onClick={() => setModal("quests")}
              className="relative flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-indigo-500 rounded-full px-4 py-1.5 text-sm font-semibold transition-all"
              title="Quests & daily rewards"
            >
              <span className="text-base">🎯</span>
              <span className="text-zinc-300 hidden sm:inline">Quests</span>
              {claimable > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {claimable}
                </span>
              )}
            </button>

            {/* Locker button + dropdown */}
            <div className="relative" ref={lockerRef}>
              <button
                onClick={() => setLockerOpen(o => !o)}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-indigo-500 rounded-full px-4 py-1.5 text-sm font-semibold transition-all"
                title="Player profile"
              >
                <span className="text-base">🔒</span>
                <span className="text-zinc-300 hidden sm:inline">Profile</span>
                <span className={`text-zinc-500 text-xs transition-transform duration-200 inline-block ${lockerOpen ? "rotate-180" : ""}`}>▼</span>
              </button>

              {/* Locker dropdown */}
              {lockerOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
                  {/* Header */}
                  <div className="px-4 pt-4 pb-3 bg-zinc-800/60 border-b border-zinc-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center text-xl font-bold">
                        {username ? username[0].toUpperCase() : "?"}
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">{username || "Guest"}</div>
                        <div className="text-zinc-400 text-xs">Adventure rank · LVL 1</div>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="p-4 flex flex-col gap-2.5">
                    <StatRow icon="⏱️" label="Time Online"  value={formatTime(onlineTime)} />
                    <StatRow icon="💀" label="Mobs Killed"  value={kills.toLocaleString()} />
                    <StatRow icon="💰" label="Coins"        value={coins.toLocaleString()} color="text-yellow-400" />
                    <StatRow icon="💎" label="Gems"         value={gems.toLocaleString()}  color="text-cyan-400" />
                    <StatRow icon="📊" label="XP"           value={`${xp} / ${XP_MAX}`}   color="text-indigo-400" />
                    <div className="pt-2 border-t border-zinc-800">
                      <StatRow icon="🕐" label="Session time" value={formatTime(Math.floor((Date.now() - sessionStart.current) / 1000))} color="text-zinc-400" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Row 3: currency ── */}
        <div className="mx-auto w-full max-w-[1400px] flex items-center justify-end px-6 py-2 gap-3">
          <CurrencyBadge icon="💰" label="Coins" value={coins} color="text-yellow-400" />
          <CurrencyBadge icon="💎" label="Gems"  value={gems}  color="text-cyan-400" />
        </div>
      </nav>

      {modal === "bug"        && <ReportBugModal        onClose={() => setModal(null)} />}
      {modal === "suggestion" && <SuggestionModal       onClose={() => setModal(null)} />}
      {modal === "admin"      && <AdminApplicationModal onClose={() => setModal(null)} />}
      {modal === "quests"     && <QuestsModal            onClose={() => { setModal(null); setClaimable(getClaimableCount()); }} />}
    </>
  );
}

function TopBarButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors font-medium"
    >
      {children}
    </button>
  );
}

function CurrencyBadge({ icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2 bg-zinc-800 rounded-full px-4 py-1.5 text-sm" title={label}>
      <span className="text-base">{icon}</span>
      <span className={`font-bold ${color}`}>{value.toLocaleString()}</span>
      <span className="text-zinc-400 text-xs hidden sm:inline">{label}</span>
    </div>
  );
}

function StatRow({ icon, label, value, color = "text-zinc-200" }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-zinc-400 text-xs">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <span className={`text-xs font-bold ${color}`}>{value}</span>
    </div>
  );
}