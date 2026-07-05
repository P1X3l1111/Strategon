"use client";

import { useState, useEffect, useRef } from "react";
import {
  CALIBRATION_GAMES, getRankForMmr, getRankState, getBanMinutesRemaining, isBanned,
} from "../data/ranked";
import { isFirebaseConfigured, joinQueue, leaveQueue, watchQueueForMatch } from "../data/realtime";

// Full-screen Ranked landing: rank/calibration status, leaver-ban notice, and
// the matchmaking queue. Once matched, hands off to the caller — live in-battle
// sync against the opponent is the next phase of work, not wired up yet.
export default function RankedSelect({ onBack, onMatchFound }) {
  const [rankState, setRankState] = useState(null);
  const [banMinutes, setBanMinutes] = useState(0);
  const [queueState, setQueueState] = useState("idle"); // idle | searching | matched
  const [waitSec, setWaitSec] = useState(0);
  const [opponent, setOpponent] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const unsubRef = useRef(null);
  const waitTimerRef = useRef(null);
  const usernameRef = useRef(null);

  function refresh() {
    setRankState(getRankState());
    setBanMinutes(getBanMinutesRemaining());
  }

  useEffect(() => {
    usernameRef.current = localStorage.getItem("rpg_username");
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("rpg_ranked_updated", onUpdate);
    window.addEventListener("rpg_ranked_ban_updated", onUpdate);
    return () => {
      window.removeEventListener("rpg_ranked_updated", onUpdate);
      window.removeEventListener("rpg_ranked_ban_updated", onUpdate);
    };
  }, []);

  // Tick the ban countdown down while one is active
  useEffect(() => {
    if (banMinutes <= 0) return;
    const id = setInterval(() => setBanMinutes(getBanMinutesRemaining()), 30000);
    return () => clearInterval(id);
  }, [banMinutes]);

  // Clean up any live subscriptions/timers on unmount
  useEffect(() => () => {
    if (unsubRef.current) unsubRef.current();
    if (waitTimerRef.current) clearInterval(waitTimerRef.current);
  }, []);

  async function handleFindMatch() {
    setErrorMsg(null);
    if (!isFirebaseConfigured) {
      setErrorMsg("Ranked matchmaking isn't set up yet — this needs a live server connection that hasn't been configured.");
      return;
    }
    if (isBanned() || !usernameRef.current) return;
    try {
      setQueueState("searching");
      setWaitSec(0);
      await joinQueue({ username: usernameRef.current, mmr: rankState.mmr, calibrated: rankState.calibrated });
      waitTimerRef.current = setInterval(() => setWaitSec((s) => s + 1), 1000);
      unsubRef.current = watchQueueForMatch({ username: usernameRef.current, mmr: rankState.mmr }, (matchId, opponentUsername) => {
        clearInterval(waitTimerRef.current);
        setQueueState("matched");
        setOpponent(opponentUsername);
        onMatchFound?.(matchId, opponentUsername);
      });
    } catch (e) {
      setQueueState("idle");
      setErrorMsg(e.message || "Couldn't reach the matchmaking server.");
    }
  }

  async function handleCancel() {
    if (unsubRef.current) unsubRef.current();
    if (waitTimerRef.current) clearInterval(waitTimerRef.current);
    await leaveQueue(usernameRef.current);
    setQueueState("idle");
  }

  if (!rankState) return null;

  const rank = getRankForMmr(rankState.mmr);

  return (
    <div className="relative flex flex-col items-center justify-center h-full gap-8 px-6">
      <button onClick={onBack} className="absolute top-6 left-6 text-zinc-400 hover:text-white text-sm font-semibold flex items-center gap-1">
        ← Back to Menu
      </button>

      <div className="text-center">
        <h1 className="text-5xl font-black text-white tracking-tight mb-2">🏆 RANKED</h1>
        <p className="text-zinc-500 text-sm">Queue up against a similarly-skilled real opponent</p>
      </div>

      {/* Rank card */}
      <div className="rounded-2xl border p-6 flex flex-col items-center gap-2 w-full max-w-sm"
        style={{ borderColor: `${rank.color}66`, background: `${rank.color}11` }}>
        {rankState.calibrated ? (
          <>
            <span className="text-5xl">{rank.icon}</span>
            <span className="text-2xl font-black" style={{ color: rank.color }}>{rank.name}</span>
            <span className="text-zinc-400 text-xs">{rankState.mmr} MMR · {rankState.wins}W {rankState.losses}L</span>
          </>
        ) : (
          <>
            <span className="text-5xl">🎯</span>
            <span className="text-xl font-black text-white">Calibrating</span>
            <span className="text-zinc-400 text-xs">{rankState.calibrationGames}/{CALIBRATION_GAMES} placement games played</span>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${(rankState.calibrationGames / CALIBRATION_GAMES) * 100}%` }} />
            </div>
            <p className="text-zinc-500 text-[10px] text-center mt-1">Play well in these to start at a higher rank.</p>
          </>
        )}
      </div>

      {banMinutes > 0 && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-center max-w-sm">
          <p className="text-red-300 font-bold text-sm">⛔ Ranked queue locked</p>
          <p className="text-red-400/80 text-xs mt-1">You left a match early. Try again in {banMinutes} minute{banMinutes === 1 ? "" : "s"}.</p>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-center max-w-sm">
          <p className="text-amber-300 text-xs font-semibold">{errorMsg}</p>
        </div>
      )}

      {queueState === "idle" && (
        <button onClick={handleFindMatch} disabled={banMinutes > 0}
          className={`px-8 py-3 rounded-xl font-black text-lg transition-all ${
            banMinutes > 0 ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95"
          }`}>
          🔍 Find Match
        </button>
      )}
      {queueState === "searching" && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-white font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
            Searching for an opponent... {waitSec}s
          </div>
          <button onClick={handleCancel} className="px-5 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-bold">Cancel</button>
        </div>
      )}
      {queueState === "matched" && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-green-400 font-black text-lg">⚔️ Matched vs {opponent}!</p>
          <p className="text-zinc-500 text-xs">Live match sync is still being wired up — hang tight.</p>
        </div>
      )}

      <p className="text-center text-zinc-700 text-[11px] max-w-sm leading-relaxed">
        Leaving a ranked match early locks you out of queueing again: 10 minutes the first time, then 30 minutes, then 1 hour, then 10 hours for repeat offenses.
      </p>
    </div>
  );
}
