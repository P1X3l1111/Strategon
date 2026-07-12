"use client";

import { useState, useEffect, useRef } from "react";
import ReportBugModal from "./modals/ReportBugModal";
import SuggestionModal from "./modals/SuggestionModal";
import ShopModal from "./modals/ShopModal";
import GeneralsModal from "./modals/GeneralsModal";
import StrategonPassModal from "./modals/StrategonPassModal";
import { getPassState, getPassLevel, PASS_LEVEL_XP, PASS_MAX_LEVEL } from "../data/quests";

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

// `modal`/`setModal` and `lockerOpen`/`setLockerOpen` are optional — pass them
// down to let something outside the navbar (e.g. home-screen shortcut cards)
// open the same Shop/Commanders modal or profile dropdown. Omit them and the
// navbar manages its own state as before.
export default function Navbar({ modal: modalProp, setModal: setModalProp, lockerOpen: lockerOpenProp, setLockerOpen: setLockerOpenProp }) {
  const [username,   setUsername]   = useState(null);
  const [coins,      setCoins]      = useState(0);
  const [gems,       setGems]       = useState(0);
  const [kills,      setKills]      = useState(0);
  const [onlineTime, setOnlineTime] = useState(0);
  const [passXp,     setPassXp]     = useState(0);
  const [lockerOpenState, setLockerOpenState] = useState(false);
  const [modalState,      setModalState]      = useState(null);
  const lockerOpen = lockerOpenProp !== undefined ? lockerOpenProp : lockerOpenState;
  const setLockerOpen = setLockerOpenProp || setLockerOpenState;
  const modal = modalProp !== undefined ? modalProp : modalState;
  const setModal = setModalProp || setModalState;
  const sessionStart = useRef(Date.now());

  function loadUser(u) {
    setUsername(u);
    setCoins(readCoins(u));
    setGems(readGems(u));
    setKills(readKills(u));
    setOnlineTime(readOnlineTime(u));
    setPassXp(getPassState()?.xp || 0);
  }

  useEffect(() => {
    const u = localStorage.getItem("rpg_username");
    if (u) loadUser(u);

    const onProfile  = () => { const u2 = localStorage.getItem("rpg_username"); if (u2) loadUser(u2); };
    const onCurrency = () => { const u2 = localStorage.getItem("rpg_username"); if (u2) { setCoins(readCoins(u2)); setGems(readGems(u2)); } };
    const onPass     = () => setPassXp(getPassState()?.xp || 0);

    window.addEventListener("rpg_profile_updated",  onProfile);
    window.addEventListener("rpg_currency_updated", onCurrency);
    window.addEventListener("rpg_pass_updated",     onPass);
    return () => {
      window.removeEventListener("rpg_profile_updated",  onProfile);
      window.removeEventListener("rpg_currency_updated", onCurrency);
      window.removeEventListener("rpg_pass_updated",     onPass);
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

  const passLevel = getPassLevel(passXp);
  const intoLevel = passXp - passLevel * PASS_LEVEL_XP;
  const xpPercent = passLevel >= PASS_MAX_LEVEL ? 100 : Math.min(100, (intoLevel / PASS_LEVEL_XP) * 100);

  return (
    <>
      <nav className="w-full bg-zinc-900 text-white shadow-lg border-b border-zinc-700 z-40 sticky top-0">

        {/* ── Row 1: community buttons ── */}
        <div className="border-b border-zinc-800">
          <div className="mx-auto w-full max-w-[1400px] flex items-center justify-center px-6 py-1.5 gap-6">
            <TopBarButton onClick={() => setModal("bug")}>Report Bug</TopBarButton>
            <span className="text-zinc-700">|</span>
            <TopBarButton onClick={() => setModal("suggestion")}>Make a Suggestion</TopBarButton>
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

            {/* Pass XP bar */}
            <div className="flex flex-col gap-0.5 flex-1 max-w-xs">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Pass Lv.{passLevel}{passLevel >= PASS_MAX_LEVEL ? " (MAX)" : ""}</span>
                <span>{passLevel >= PASS_MAX_LEVEL ? passXp : `${intoLevel} / ${PASS_LEVEL_XP}`} XP</span>
              </div>
              <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>

            <div className="flex-1" />
          </div>
        </div>

        {/* Profile panel — opened from the home screen's Profile card, centered on screen */}
        {lockerOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && setLockerOpen(false)}
          >
            <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3 bg-zinc-800/60 border-b border-zinc-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center text-xl font-bold">
                    {username ? username[0].toUpperCase() : "?"}
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">{username || "Guest"}</div>
                    <div className="text-zinc-400 text-xs">Pass Level {passLevel}{passLevel >= PASS_MAX_LEVEL ? " (MAX)" : ""}</div>
                  </div>
                </div>
                <button onClick={() => setLockerOpen(false)} className="text-zinc-500 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800">✕</button>
              </div>

              {/* Stats */}
              <div className="p-4 flex flex-col gap-2.5">
                <StatRow icon="⏱️" label="Time Online"  value={formatTime(onlineTime)} />
                <StatRow icon="💀" label="Mobs Killed"  value={kills.toLocaleString()} />
                <StatRow icon="💰" label="Coins"        value={coins.toLocaleString()} color="text-yellow-400" />
                <StatRow icon="💎" label="Gems"         value={gems.toLocaleString()}  color="text-cyan-400" />
                <StatRow icon="🎫" label="Pass XP"      value={passXp.toLocaleString()} color="text-amber-400" />
                <div className="pt-2 border-t border-zinc-800">
                  <StatRow icon="🕐" label="Session time" value={formatTime(Math.floor((Date.now() - sessionStart.current) / 1000))} color="text-zinc-400" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Row 3: currency ── */}
        <div className="mx-auto w-full max-w-[1400px] flex items-center justify-end px-6 py-2 gap-3">
          <CurrencyBadge icon="💰" label="Coins" value={coins} color="text-yellow-400" />
          <CurrencyBadge icon="💎" label="Gems"  value={gems}  color="text-cyan-400" />
        </div>
      </nav>

      {modal === "bug"        && <ReportBugModal        onClose={() => setModal(null)} />}
      {modal === "suggestion" && <SuggestionModal       onClose={() => setModal(null)} />}
      {modal === "shop"       && <ShopModal             onClose={() => setModal(null)} />}
      {modal === "generals"   && <GeneralsModal         onClose={() => setModal(null)} />}
      {modal === "pass"       && <StrategonPassModal    onClose={() => setModal(null)} />}
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