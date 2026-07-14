"use client";

import { useState, useEffect, useRef } from "react";
import { Swords, X, Ticket, Coins, Gem, Skull, Clock, Timer, Bug, Lightbulb, Flag } from "lucide-react";
import ReportBugModal from "./modals/ReportBugModal";
import SuggestionModal from "./modals/SuggestionModal";
import ReportPlayerModal from "./modals/ReportPlayerModal";
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
      <nav className="w-full bg-gradient-to-b from-zinc-900 to-zinc-950 text-white shadow-lg z-40 sticky top-0">

        {/* ── Row 1: community buttons ── */}
        <div className="border-b border-zinc-800/80 bg-black/20">
          <div className="mx-auto w-full max-w-[1400px] flex items-center justify-center px-6 py-1.5 gap-2">
            <TopBarButton icon={Bug} onClick={() => setModal("bug")}>Report Bug</TopBarButton>
            <span className="text-zinc-800">•</span>
            <TopBarButton icon={Lightbulb} onClick={() => setModal("suggestion")}>Make a Suggestion</TopBarButton>
            <span className="text-zinc-800">•</span>
            <TopBarButton icon={Flag} onClick={() => setModal("reportplayer")}>Report a Player</TopBarButton>
          </div>
        </div>

        {/* ── Row 2: username · xp bar · currency ── */}
        <div className="mx-auto w-full max-w-[1400px] flex items-center px-6 py-2.5 gap-4">
          {/* Username — gradient avatar with an online pulse */}
          <div className="flex items-center gap-2.5 bg-zinc-800/80 border border-zinc-700 rounded-full pl-1.5 pr-4 py-1 shrink-0">
            <div className="relative w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center shrink-0 shadow-inner">
              <Swords size={13} className="text-white"/>
              {username && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-zinc-900 animate-pulse"/>
              )}
            </div>
            <span className="text-sm font-semibold text-zinc-100">
              {username || <span className="text-zinc-400 italic">No profile</span>}
            </span>
          </div>

          {/* Pass XP bar */}
          <div className="flex items-center gap-2.5 flex-1 max-w-xs">
            <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-600/40 flex items-center justify-center shrink-0">
              <Ticket size={14} className="text-amber-400"/>
            </div>
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Pass Lv.{passLevel}{passLevel >= PASS_MAX_LEVEL ? " (MAX)" : ""}</span>
                <span>{passLevel >= PASS_MAX_LEVEL ? passXp : `${intoLevel} / ${PASS_LEVEL_XP}`} XP</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 rounded-full transition-all duration-500"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex-1" />

          {/* Currency */}
          <div className="flex items-center gap-3">
            <CurrencyBadge icon={Coins} label="Coins" value={coins} color="text-yellow-400" />
            <CurrencyBadge icon={Gem}   label="Gems"  value={gems}  color="text-cyan-400" />
          </div>
        </div>

        {/* Accent line */}
        <div className="h-[2px] bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-500 opacity-70"/>

        {/* Profile panel — slides in from the right as a drawer. Always mounted
            (rather than conditionally rendered) so the open AND close motion
            both get to animate via the CSS transition below. */}
        <div
          className={`fixed inset-0 z-50 flex justify-end transition-colors duration-300 ${
            lockerOpen ? "bg-black/70 backdrop-blur-sm pointer-events-auto" : "bg-transparent pointer-events-none"
          }`}
          onClick={(e) => e.target === e.currentTarget && setLockerOpen(false)}
          aria-hidden={!lockerOpen}
        >
          <div
            className={`h-full w-full max-w-sm bg-zinc-900 border-l border-zinc-700 shadow-2xl overflow-y-auto transition-transform duration-300 ease-out ${
              lockerOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 bg-zinc-800/60 border-b border-zinc-700 sticky top-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-indigo-700 flex items-center justify-center text-xl font-bold shrink-0">
                  {username ? username[0].toUpperCase() : "?"}
                </div>
                <div>
                  <div className="text-white font-bold text-base leading-tight">{username || "Guest"}</div>
                  <div className="text-zinc-500 text-xs">Your account at a glance</div>
                </div>
              </div>
              <button onClick={() => setLockerOpen(false)} className="text-zinc-500 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800 shrink-0"><X size={16}/></button>
            </div>

            <div className="p-4 flex flex-col gap-4">
              {/* Strategon Pass progress — one clear line instead of two disconnected numbers */}
              <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-amber-300 font-bold flex items-center gap-1.5"><Ticket size={13}/> Strategon Pass — Level {passLevel}{passLevel >= PASS_MAX_LEVEL ? " (MAX)" : ""}</span>
                  <span className="text-zinc-400">{passLevel >= PASS_MAX_LEVEL ? `${passXp.toLocaleString()} XP` : `${intoLevel} / ${PASS_LEVEL_XP} XP`}</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500" style={{ width: `${xpPercent}%` }} />
                </div>
                <p className="text-zinc-500 text-[10px] mt-1.5">Earned by completing weekly quests — {passLevel >= PASS_MAX_LEVEL ? "you've reached the top level!" : "keep going to unlock the next reward."}</p>
              </div>

              {/* Currency — the two things you spend, front and center */}
              <div>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-1.5">Currency</p>
                <div className="grid grid-cols-2 gap-2">
                  <CurrencyTile icon={Coins} label="Coins" value={coins} color="text-yellow-400" />
                  <CurrencyTile icon={Gem}   label="Gems"  value={gems}  color="text-cyan-400" />
                </div>
              </div>

              {/* Activity — how much you've played */}
              <div>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-1.5">Activity</p>
                <div className="flex flex-col gap-2">
                  <StatRow icon={Skull} label="Enemies Defeated" value={kills.toLocaleString()} />
                  <StatRow icon={Clock} label="Total Time Online" value={formatTime(onlineTime)} />
                  <StatRow icon={Timer} label="This Session" value={formatTime(Math.floor((Date.now() - sessionStart.current) / 1000))} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {modal === "bug"        && <ReportBugModal        onClose={() => setModal(null)} />}
      {modal === "suggestion" && <SuggestionModal       onClose={() => setModal(null)} />}
      {modal === "reportplayer" && <ReportPlayerModal   onClose={() => setModal(null)} />}
      {/* Shop/Commanders/Pass stay mounted so they can slide in and out like the Profile drawer */}
      <ShopModal          open={modal === "shop"}     onClose={() => setModal(null)} />
      <GeneralsModal      open={modal === "generals"} onClose={() => setModal(null)} />
      <StrategonPassModal open={modal === "pass"}     onClose={() => setModal(null)} />
    </>
  );
}

function TopBarButton({ onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 px-2.5 py-1 rounded-full transition-colors font-medium"
    >
      <Icon size={12}/>
      {children}
    </button>
  );
}

function CurrencyBadge({ icon: Icon, label, value, color }) {
  return (
    <div className="group flex items-center gap-2 bg-zinc-800/80 border border-zinc-700 hover:border-zinc-600 rounded-full pl-1.5 pr-4 py-1 text-sm transition-colors" title={label}>
      <span className="w-6 h-6 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
        <Icon size={13} className={color}/>
      </span>
      <span className={`font-bold ${color}`}>{value.toLocaleString()}</span>
      <span className="text-zinc-500 text-xs hidden sm:inline">{label}</span>
    </div>
  );
}

function CurrencyTile({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2.5 bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2.5">
      <Icon size={22} className={color}/>
      <div className="min-w-0">
        <div className={`font-black text-base leading-tight ${color}`}>{value.toLocaleString()}</div>
        <div className="text-zinc-500 text-[10px]">{label}</div>
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value, color = "text-zinc-200" }) {
  return (
    <div className="flex items-center justify-between bg-zinc-800/40 rounded-lg px-2.5 py-1.5">
      <div className="flex items-center gap-2 text-zinc-400 text-xs">
        <Icon size={13}/>
        <span>{label}</span>
      </div>
      <span className={`text-xs font-bold ${color}`}>{value}</span>
    </div>
  );
}