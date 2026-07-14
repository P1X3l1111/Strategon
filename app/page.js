"use client";
import { useState, useEffect } from "react";
import { Swords, Infinity as InfinityIcon, Castle, ListOrdered, Trophy, Medal, Lock, ShoppingCart, Star, Ticket } from "lucide-react";
import OnboardingModal from "./components/OnboardingModal";
import Navbar from "./components/Navbar";
import WarMap from "./components/WarMap";
import CampaignSelect from "./components/CampaignSelect";
import RankedSelect from "./components/RankedSelect";
import QuestPanel from "./components/QuestPanel";
import DailyRewardPanel from "./components/DailyRewardPanel";
import { makeDefaultGrid } from "./components/MapEditor";

const MODES = [
  { id: "classic", name: "Classic", icon: Swords,       color: "#6366f1", desc: "Clear all enemies in one decisive battle." },
  { id: "endless", name: "Endless", icon: InfinityIcon, color: "#16a34a", desc: "Enemies storm from the right wall forever." },
  { id: "siege",   name: "Siege",   icon: Castle,       color: "#dc2626", desc: "Your castle is surrounded — hold the line from every side." },
  { id: "turns",   name: "Turns",   icon: ListOrdered,  color: "#0ea5e9", desc: "Move your troops manually, then watch the AI answer." },
];

const RANKED_MODE = { id: "ranked", name: "Ranked", icon: Trophy, color: "#f59e0b", desc: "Queue up against a similarly-skilled real opponent." };
const CAMPAIGN_MODE = { id: "campaign", name: "Campaign", icon: Medal, color: "#eab308", desc: "Win scripted missions — some require capturing enemy troops alive." };

// Map-seeding keys — includes campaign's shared battlefield in addition to the 3 modes above
const MAP_KEYS = [...MODES.map(m => m.id), "campaign"];

export default function Home() {
  const [mode,        setMode]        = useState(null);
  const [mission,     setMission]     = useState(null);
  const [view,        setView]        = useState("home"); // "home" | "campaign" | "ranked"
  const [loginKey,    setLoginKey]    = useState(0);
  // null = not yet checked (avoids hydration mismatch)
  const [mapStatus, setMapStatus] = useState(null);
  // Lifted up so the home screen's Profile/Shop/Commanders shortcut cards can
  // trigger the same navbar modal/dropdown as the navbar's own buttons.
  const [navModal,       setNavModal]       = useState(null);
  const [navLockerOpen,  setNavLockerOpen]  = useState(false);

  // After mount: seed missing maps (including campaign's shared battlefield) with default terrain, then read status
  useEffect(() => {
    const defaultGrid = makeDefaultGrid();
    const status = {};
    MAP_KEYS.forEach(id => {
      if (!localStorage.getItem(`rpg_map_${id}`)) {
        localStorage.setItem(`rpg_map_${id}`, JSON.stringify(defaultGrid));
      }
      status[id] = true; // all seeded → all ready
    });
    setMapStatus(status);
  }, []);

  // Re-check map status whenever we return to home (admin may have changed maps)
  useEffect(() => {
    if (view === "home" && !mode && mapStatus !== null) {
      const status = {};
      MODES.forEach(m => { status[m.id] = !!localStorage.getItem(`rpg_map_${m.id}`); });
      setMapStatus(status);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, mode]);

  // Browser back/forward → return to home + re-show login
  useEffect(() => {
    const onPop = () => { setMode(null); setView("home"); setLoginKey(k => k + 1); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function enterGame(modeId) {
    history.pushState({ inGame: true }, "");
    setMode(modeId);
  }

  function enterMission(m) {
    setMission(m);
    enterGame("campaign");
  }

  function goHome() {
    setMode(null);
    setMission(null);
    setView("home");
    setLoginKey(k => k + 1);
  }

  // From an in-progress mission, "back" returns to the mission list rather than all the way home
  function backToCampaign() {
    setMode(null);
    setMission(null);
    setView("campaign");
  }

  // ── Campaign mission-select view ──
  if (view === "campaign" && !mode) {
    return (
      <div className="bg-zinc-950 h-screen overflow-hidden flex flex-col">
        <Navbar />
        <div className="flex-1 overflow-y-auto">
          <CampaignSelect onSelectMission={enterMission} onBack={() => setView("home")} />
        </div>
      </div>
    );
  }

  // ── Ranked matchmaking view ──
  if (view === "ranked" && !mode) {
    return (
      <div className="bg-zinc-950 h-screen overflow-hidden flex flex-col">
        <Navbar />
        <div className="flex-1 overflow-hidden">
          <RankedSelect onBack={() => setView("home")} onMatchFound={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 h-screen overflow-hidden flex flex-col">
      {/* Navbar only on home */}
      {!mode && (
        <Navbar
          modal={navModal} setModal={setNavModal}
          lockerOpen={navLockerOpen} setLockerOpen={setNavLockerOpen}
        />
      )}

      {!mode ? (
        /* ── Mode select — 3 columns: Quests | Modes (centered) | Profile/Shop/Commanders ── */
        <div className="flex-1 overflow-hidden px-8 py-4 flex">
          <OnboardingModal key={loginKey} />

          <div className="w-full h-full flex flex-col lg:flex-row gap-6 items-stretch">

            {/* Quests — Daily Reward sits above Daily Quests; Weekly Quests grows to
                fill whatever height is left over. */}
            <div className="flex justify-start mt-12 lg:mt-0 h-full min-h-0 lg:flex-1 lg:max-w-[680px]">
              <div className="w-full h-full flex flex-col gap-3 min-h-0">
                <DailyRewardPanel />
                <QuestPanel type="daily" />
                <QuestPanel type="weekly" fill />
              </div>
            </div>

            {/* Modes — centered in the middle column, the widest section */}
            <div className="flex justify-center items-center h-full lg:flex-[1.6] min-w-0">
              <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
                <div className="text-center">
                  <h1 className="text-5xl font-black text-white tracking-tight mb-2">MODES</h1>
                  <p className="text-zinc-500 text-sm">Choose a battle mode to deploy your forces</p>
                </div>

                {/* Classic & Ranked sit in a line, barely touching. Three of the
                    remaining modes sit above that line, one sits below — all
                    tilted the opposite way from the center pair. */}
                <div className="flex flex-col items-center gap-10 w-full">
                  <div className="flex items-center justify-center gap-3">
                    <FlankCard m={CAMPAIGN_MODE} isReady={true} onClick={() => setView("campaign")} fade="top" />
                    <FlankCard m={MODES.find(m => m.id === "endless")} isReady={isModeReady("endless", mapStatus)} onClick={() => enterGame("endless")} fade="top" />
                    <FlankCard m={MODES.find(m => m.id === "siege")} isReady={isModeReady("siege", mapStatus)} onClick={() => enterGame("siege")} fade="top" />
                  </div>

                  {/* Precisely offset (not just flexed side by side) so the two
                      tilted rectangles continue one straight diagonal line,
                      with a small gap between them along that same line. */}
                  <div className="relative" style={{ width: 433, height: 330 }}>
                    <div className="absolute" style={{ left: 0, top: 115 }}>
                      <CenterCard m={MODES.find(m => m.id === "classic")} isReady={isModeReady("classic", mapStatus)} onClick={() => enterGame("classic")} fade="left" />
                    </div>
                    <div className="absolute" style={{ left: 198, top: 0 }}>
                      <CenterCard m={RANKED_MODE} isReady={true} onClick={() => setView("ranked")} fade="right" />
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-5">
                    <FlankCard m={MODES.find(m => m.id === "turns")} isReady={isModeReady("turns", mapStatus)} onClick={() => enterGame("turns")} fade="bottom" />
                  </div>
                </div>

                <p className="text-zinc-700 text-xs text-center">
                  100 mana · 50 oil starting resources · Place a Factory to generate mana per second
                </p>
              </div>
            </div>

            {/* Profile / Shop / Commanders / Strategon Pass — quick-access shortcut cards */}
            <div className="flex flex-col justify-center h-full lg:w-[340px] lg:flex-none">
              <div className="flex flex-col gap-4 h-2/3">
                <SideCard onClick={() => setNavLockerOpen(o => !o)} icon={Lock} label="Profile" caret={navLockerOpen} />
                <SideCard onClick={() => setNavModal("shop")} icon={ShoppingCart} label="Shop" />
                <SideCard onClick={() => setNavModal("generals")} icon={Star} label="Commanders" />
                <SideCard onClick={() => setNavModal("pass")} icon={Ticket} label="Strategon Pass" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Game ── */
        <div className="flex-1 overflow-hidden">
          <WarMap
            key={mode + (mission?.id || "")}
            mode={mode}
            mission={mission}
            onBack={mode === "campaign" ? backToCampaign : goHome}
            onNextMission={enterMission}
          />
        </div>
      )}
    </div>
  );
}

// mapStatus is null on first SSR render → treat as "loading/ready" so server+client match
function isModeReady(id, mapStatus) {
  return mapStatus === null ? true : (mapStatus[id] ?? false);
}

// Fade direction → CSS gradient, always transparent on the named edge and
// solid on the opposite edge (so cards never fade on the side facing a neighbor).
const EDGE_FADE = {
  left:   "linear-gradient(to right, transparent 0%, black 40%, black 100%)",
  right:  "linear-gradient(to left, transparent 0%, black 40%, black 100%)",
  top:    "linear-gradient(to bottom, transparent 0%, black 40%, black 100%)",
  bottom: "linear-gradient(to top, transparent 0%, black 40%, black 100%)",
};

// Center-stage mode card — Classic & Ranked. Elongated and tilted -30°,
// positioned (by the caller) so the two cards continue one straight
// diagonal line, with the fade always facing outward, never on the
// meeting edge.
function CenterCard({ m, isReady, onClick, fade }) {
  const gradient = EDGE_FADE[fade];
  return (
    <button
      onClick={() => isReady && onClick()}
      disabled={!isReady}
      title={isReady ? m.desc : "Admin must create a map for this mode."}
      className={`group relative shrink-0 w-[235px] h-[215px] ${isReady ? "cursor-pointer" : "cursor-not-allowed"}`}
    >
      <div
        className="absolute inset-0 rounded-full blur-2xl transition-opacity duration-200"
        style={{ background: m.color, opacity: isReady ? 0.22 : 0 }}
      />
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-200"
        style={{ background: m.color }}
      />
      <div
        className={`absolute left-1/2 top-1/2 w-[215px] h-[150px] -translate-x-1/2 -translate-y-1/2 -rotate-[30deg] border rounded-2xl shadow-2xl transition-colors duration-200 ${
          isReady
            ? "bg-zinc-900 border-zinc-700 group-hover:border-zinc-400"
            : "bg-zinc-900/40 border-zinc-800 opacity-50"
        }`}
        style={{ WebkitMaskImage: gradient, maskImage: gradient }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center pointer-events-none">
        <span style={{ color: isReady ? m.color : "#52525b" }}>
          {isReady ? <m.icon size={44}/> : <Lock size={44}/>}
        </span>
        <span className="text-white font-black text-xl">{m.name}</span>
      </div>
      {!isReady && (
        <span className="absolute top-1 right-1 text-[9px] font-bold text-red-400 bg-red-950 border border-red-800 px-1.5 py-0.5 rounded-full z-10">
          No Map
        </span>
      )}
    </button>
  );
}

// Supporting-cast mode card — the rest of the modes, above and below the
// center pair. Tilted +30° the opposite way from CenterCard, kept clear of it,
// and faded on the edge pointing away from the center row.
function FlankCard({ m, isReady, onClick, fade }) {
  const gradient = EDGE_FADE[fade];
  return (
    <button
      onClick={() => isReady && onClick()}
      disabled={!isReady}
      title={isReady ? m.desc : "Admin must create a map for this mode."}
      className={`group relative shrink-0 w-[132px] h-[132px] ${isReady ? "cursor-pointer" : "cursor-not-allowed"}`}
    >
      <div
        className="absolute inset-0 rounded-full blur-xl transition-opacity duration-200"
        style={{ background: m.color, opacity: isReady ? 0.14 : 0 }}
      />
      <div
        className="absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-200"
        style={{ background: m.color }}
      />
      <div
        className={`absolute left-1/2 top-1/2 w-[98px] h-[98px] -translate-x-1/2 -translate-y-1/2 rotate-[30deg] border rounded-xl shadow-lg transition-colors duration-200 ${
          isReady
            ? "bg-zinc-900 border-zinc-700 group-hover:border-zinc-500"
            : "bg-zinc-900/40 border-zinc-800 opacity-50"
        }`}
        style={{ WebkitMaskImage: gradient, maskImage: gradient }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center pointer-events-none">
        <span style={{ color: isReady ? m.color : "#52525b" }}>
          {isReady ? <m.icon size={22}/> : <Lock size={22}/>}
        </span>
        <span className="text-white font-bold text-[11px]">{m.name}</span>
      </div>
      {!isReady && (
        <span className="absolute top-0 right-0 text-[8px] font-bold text-red-400 bg-red-950 border border-red-800 px-1 py-0.5 rounded-full z-10">
          No Map
        </span>
      )}
    </button>
  );
}

// Big quick-access shortcut card for the right column (Profile / Shop / Commanders).
function SideCard({ onClick, icon: Icon, label, caret }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center bg-zinc-900 border border-zinc-700 hover:border-indigo-500 hover:bg-zinc-800 rounded-2xl transition-all"
    >
      <span className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-1.5 text-sm font-semibold">
        <Icon size={15}/>
        <span className="text-zinc-200">{label}</span>
        {caret !== undefined && (
          <span className={`text-zinc-500 text-xs transition-transform duration-200 inline-block ${caret ? "rotate-180" : ""}`}>▼</span>
        )}
      </span>
    </button>
  );
}
