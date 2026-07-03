"use client";
import { useState, useEffect } from "react";
import OnboardingModal from "./components/OnboardingModal";
import Navbar from "./components/Navbar";
import WarMap from "./components/WarMap";
import AdminPanel from "./components/AdminPanel";
import CampaignSelect from "./components/CampaignSelect";
import QuestPanel from "./components/QuestPanel";
import DailyRewardPanel from "./components/DailyRewardPanel";
import { makeDefaultGrid } from "./components/MapEditor";

const MODES = [
  { id: "classic", name: "Classic", icon: "⚔",  color: "#6366f1", desc: "Clear all enemies in one decisive battle." },
  { id: "endless", name: "Endless", icon: "∞",  color: "#16a34a", desc: "Enemies storm from the right wall forever." },
  { id: "siege",   name: "Siege",   icon: "🏯", color: "#dc2626", desc: "Your castle is surrounded — hold the line from every side." },
  { id: "turns",   name: "Turns",   icon: "♟️", color: "#0ea5e9", desc: "Move your troops manually, then watch the AI answer." },
];

// Map-seeding keys — includes campaign's shared battlefield in addition to the 3 modes above
const MAP_KEYS = [...MODES.map(m => m.id), "campaign"];

export default function Home() {
  const [mode,        setMode]        = useState(null);
  const [mission,     setMission]     = useState(null);
  const [view,        setView]        = useState("home"); // "home" | "admin" | "campaign"
  const [loginKey,    setLoginKey]    = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  // null = not yet checked (avoids hydration mismatch)
  const [mapStatus, setMapStatus] = useState(null);

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

  // Track logged-in user
  useEffect(() => {
    const read = () => setCurrentUser(localStorage.getItem("rpg_username") || null);
    read();
    window.addEventListener("rpg_profile_updated", read);
    return () => window.removeEventListener("rpg_profile_updated", read);
  }, []);

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

  // ── Admin view ──
  if (view === "admin") {
    return (
      <div className="bg-zinc-950 h-screen overflow-hidden">
        <AdminPanel
          currentUser={currentUser}
          onBack={() => setView("home")}
          onMapChange={() => {
            // Re-read map status after admin edits
            const status = {};
            MODES.forEach(m => { status[m.id] = !!localStorage.getItem(`rpg_map_${m.id}`); });
            setMapStatus(status);
          }}
        />
      </div>
    );
  }

  // ── Campaign mission-select view ──
  if (view === "campaign" && !mode) {
    return (
      <div className="bg-zinc-950 h-screen overflow-hidden flex flex-col">
        <Navbar onAdmin={() => setView("admin")} />
        <div className="flex-1 overflow-y-auto">
          <CampaignSelect onSelectMission={enterMission} onBack={() => setView("home")} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 h-screen overflow-hidden flex flex-col">
      {/* Navbar only on home */}
      {!mode && <Navbar onAdmin={() => setView("admin")} />}

      {!mode ? (
        /* ── Mode select ── */
        <div className="flex-1 overflow-y-auto px-8 py-10">
          <OnboardingModal key={loginKey} />

          <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-10 items-center">

            {/* Quests — pinned fully to the left, Daily Reward sits above Daily Quests */}
            <div className="flex justify-start order-2 lg:order-1 mt-12 lg:mt-0">
              <div className="w-full max-w-[640px] flex flex-col gap-4">
                <DailyRewardPanel />
                <QuestPanel type="daily" />
                <QuestPanel type="weekly" />
              </div>
            </div>

            {/* Modes — right half of the page, centered within that half */}
            <div className="flex justify-center order-1 lg:order-2">
              <div className="flex flex-col items-center gap-8">
                <div className="text-center">
                  <h1 className="text-5xl font-black text-white tracking-tight mb-2">MODES</h1>
                  <p className="text-zinc-500 text-sm">Choose a battle mode to deploy your forces</p>
                </div>

                {/* Classic and Campaign are the two default/primary modes, shown side by side;
                    Siege and Turns follow in their own row; Endless spans the full width as a line. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
                  <ModeCard m={MODES.find(m => m.id === "classic")} isReady={isModeReady("classic", mapStatus)} onClick={() => enterGame("classic")} />

                  <button
                    onClick={() => setView("campaign")}
                    className="group relative flex flex-col items-center justify-center gap-3 text-center border rounded-2xl p-6 h-56 transition-all duration-200 shadow-xl overflow-hidden bg-gradient-to-br from-zinc-900 to-amber-950/30 border-amber-800/60 hover:border-amber-500 hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98] cursor-pointer"
                  >
                    <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: "#f59e0b" }} />
                    <span className="text-6xl">🎖️</span>
                    <span className="text-white font-black text-2xl">Campaign</span>
                    <span className="text-zinc-400 text-sm leading-snug px-2">Win scripted missions — some require capturing enemy troops alive.</span>
                  </button>

                  <ModeCard m={MODES.find(m => m.id === "siege")} isReady={isModeReady("siege", mapStatus)} onClick={() => enterGame("siege")} />
                  <ModeCard m={MODES.find(m => m.id === "turns")} isReady={isModeReady("turns", mapStatus)} onClick={() => enterGame("turns")} />

                  <ModeLine m={MODES.find(m => m.id === "endless")} isReady={isModeReady("endless", mapStatus)} onClick={() => enterGame("endless")} />
                </div>

                <p className="text-zinc-700 text-xs text-center">
                  100 mana · 50 oil starting resources · Place a Factory to generate mana per second
                </p>
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

function ModeCard({ m, isReady, onClick }) {
  return (
    <button
      onClick={() => isReady && onClick()}
      disabled={!isReady}
      className={`group relative flex flex-col items-center justify-center gap-3 text-center border rounded-2xl p-6 h-56 transition-all duration-200 shadow-xl overflow-hidden ${
        isReady
          ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800 hover:border-zinc-500 hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98] cursor-pointer"
          : "bg-zinc-900/40 border-zinc-800 cursor-not-allowed opacity-50"
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: isReady ? m.color : "#3f3f46" }} />
      {!isReady && (
        <span className="absolute top-3 right-3 text-[10px] font-bold text-red-400 bg-red-950 border border-red-800 px-1.5 py-0.5 rounded-full">
          No Map
        </span>
      )}
      <span className="text-6xl font-black" style={{ color: isReady ? m.color : "#52525b", fontFamily: "monospace" }}>
        {isReady ? m.icon : "🔒"}
      </span>
      <span className="text-white font-black text-2xl">{m.name}</span>
      <span className="text-zinc-400 text-sm leading-snug px-2">
        {isReady ? m.desc : "Admin must create a map for this mode."}
      </span>
    </button>
  );
}

function ModeLine({ m, isReady, onClick }) {
  return (
    <button
      onClick={() => isReady && onClick()}
      disabled={!isReady}
      className={`group relative col-span-1 sm:col-span-2 flex items-center gap-4 text-left border rounded-2xl px-6 py-5 transition-all duration-200 shadow-xl overflow-hidden ${
        isReady
          ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800 hover:border-zinc-500 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          : "bg-zinc-900/40 border-zinc-800 cursor-not-allowed opacity-50"
      }`}
    >
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: isReady ? m.color : "#3f3f46" }} />
      {!isReady && (
        <span className="absolute top-3 right-3 text-[10px] font-bold text-red-400 bg-red-950 border border-red-800 px-1.5 py-0.5 rounded-full">
          No Map
        </span>
      )}
      <span className="text-4xl font-black shrink-0" style={{ color: isReady ? m.color : "#52525b", fontFamily: "monospace" }}>
        {isReady ? m.icon : "🔒"}
      </span>
      <div className="min-w-0">
        <span className="text-white font-black text-lg block">{m.name}</span>
        <span className="text-zinc-400 text-xs leading-snug">
          {isReady ? m.desc : "Admin must create a map for this mode."}
        </span>
      </div>
    </button>
  );
}
