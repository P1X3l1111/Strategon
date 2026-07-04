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
      {!mode && (
        <Navbar
          onAdmin={() => setView("admin")}
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

                {/* Row 1: Classic and Campaign are the two default/primary modes, shown side by side.
                    Row 2: Endless spans the full width as a line.
                    Row 3: every other mode plus an "Other" placeholder, evenly split into 3 columns. */}
                <div className="flex flex-col gap-5 w-full max-w-2xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                  </div>

                  <ModeLine m={MODES.find(m => m.id === "endless")} isReady={isModeReady("endless", mapStatus)} onClick={() => enterGame("endless")} />

                  <div className="grid grid-cols-3 gap-5">
                    {MODES.filter(m => m.id !== "classic" && m.id !== "endless").map(m => (
                      <ModeCard key={m.id} m={m} isReady={isModeReady(m.id, mapStatus)} onClick={() => enterGame(m.id)} compact />
                    ))}
                    <OtherModeCard />
                  </div>
                </div>

                <p className="text-zinc-700 text-xs text-center">
                  100 mana · 50 oil starting resources · Place a Factory to generate mana per second
                </p>
              </div>
            </div>

            {/* Profile / Shop / Commanders — quick-access shortcut cards, centered in
                half the column's height instead of stretched top-to-bottom */}
            <div className="flex flex-col justify-center h-full lg:w-[340px] lg:flex-none">
              <div className="flex flex-col gap-4 h-1/2">
                <SideCard onClick={() => setNavLockerOpen(o => !o)} icon="🔒" label="Profile" caret={navLockerOpen} />
                <SideCard onClick={() => setNavModal("shop")} icon="🛒" label="Shop" />
                <SideCard onClick={() => setNavModal("generals")} icon="⭐" label="Commanders" />
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

function ModeCard({ m, isReady, onClick, compact = false }) {
  return (
    <button
      onClick={() => isReady && onClick()}
      disabled={!isReady}
      className={`group relative flex flex-col items-center justify-center text-center border rounded-2xl transition-all duration-200 shadow-xl overflow-hidden w-full ${
        compact ? "gap-1.5 p-3 h-28" : "gap-3 p-6 h-56"
      } ${
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
      <span className={`font-black ${compact ? "text-3xl" : "text-6xl"}`} style={{ color: isReady ? m.color : "#52525b", fontFamily: "monospace" }}>
        {isReady ? m.icon : "🔒"}
      </span>
      <span className={`text-white font-black ${compact ? "text-base" : "text-2xl"}`}>{m.name}</span>
      {!compact && (
        <span className="text-zinc-400 text-sm leading-snug px-2">
          {isReady ? m.desc : "Admin must create a map for this mode."}
        </span>
      )}
    </button>
  );
}

// A placeholder tile completing Row 3's 3-column split until a real third mode exists.
function OtherModeCard() {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-1.5 border border-dashed border-zinc-800 rounded-2xl p-3 h-28 bg-zinc-900/20">
      <span className="text-3xl text-zinc-700 font-black">＋</span>
      <span className="text-zinc-600 font-bold text-sm">Other</span>
      <span className="text-zinc-700 text-[10px]">More modes soon</span>
    </div>
  );
}

// Big quick-access shortcut card for the right column (Profile / Shop / Commanders).
function SideCard({ onClick, icon, label, caret }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center bg-zinc-900 border border-zinc-700 hover:border-indigo-500 hover:bg-zinc-800 rounded-2xl transition-all"
    >
      <span className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-1.5 text-sm font-semibold">
        <span className="text-base">{icon}</span>
        <span className="text-zinc-200">{label}</span>
        {caret !== undefined && (
          <span className={`text-zinc-500 text-xs transition-transform duration-200 inline-block ${caret ? "rotate-180" : ""}`}>▼</span>
        )}
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
