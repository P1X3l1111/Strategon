// Ranked matchmaking + live match lifecycle, backed by Firebase Realtime
// Database. There is no server-side matching function (that would need a
// paid Firebase plan + Cloud Functions) — instead, every queued client races
// to pair the closest-MMR opponent itself, using a transaction so two clients
// can never claim each other at once (see watchQueueForMatch).
//
// NOTE: untested against a live Firebase project — wire up .env.local per
// .env.local.example and this becomes live. Nothing here runs unless
// isFirebaseConfigured is true.
import {
  ref, set, update, remove, get, onValue, runTransaction, push, onDisconnect,
} from "firebase/database";
import { getDb, isFirebaseConfigured } from "./firebaseClient";

const QUEUE_PATH = "rankedQueue";
const MATCH_PATH = "rankedMatches";

export function myUid(username) {
  return username.toLowerCase();
}

export async function joinQueue({ username, mmr, calibrated }) {
  const db = getDb();
  if (!db) throw new Error("Ranked matchmaking isn't set up yet.");
  const uid = myUid(username);
  const myRef = ref(db, `${QUEUE_PATH}/${uid}`);
  await set(myRef, { username, mmr, calibrated, joinedAt: Date.now(), matched: false, matchId: null, opponentUsername: null });
  onDisconnect(myRef).remove(); // closing the tab/losing connection drops you from the queue
  return uid;
}

export async function leaveQueue(username) {
  const db = getDb();
  if (!db) return;
  await remove(ref(db, `${QUEUE_PATH}/${myUid(username)}`));
}

// Subscribes to the whole queue and, on every change, tries to pair `username`
// with the closest-MMR waiting opponent — widening the search radius the
// longer they've waited. Calls onMatched(matchId, opponentUsername) once paired.
// Returns an unsubscribe function.
export function watchQueueForMatch({ username, mmr }, onMatched) {
  const db = getDb();
  if (!db) return () => {};
  const uid = myUid(username);

  const unsub = onValue(ref(db, QUEUE_PATH), async (snap) => {
    const all = snap.val() || {};
    const me = all[uid];
    if (!me) return;
    if (me.matched && me.matchId) {
      onMatched(me.matchId, me.opponentUsername);
      return;
    }

    const waitedSec = (Date.now() - me.joinedAt) / 1000;
    const radius = 100 + Math.floor(waitedSec / 5) * 50; // +50 MMR every 5s waited

    const candidates = Object.entries(all)
      .filter(([otherUid, o]) => otherUid !== uid && !o.matched && Math.abs(o.mmr - mmr) <= radius)
      .sort((a, b) => Math.abs(a[1].mmr - mmr) - Math.abs(b[1].mmr - mmr));
    if (!candidates.length) return;

    const [otherUid, other] = candidates[0];
    // Only the lexicographically smaller uid proposes, so two clients never
    // simultaneously try to claim each other and create duplicate matches.
    if (uid > otherUid) return;

    const matchId = push(ref(db, MATCH_PATH)).key;
    const claim = await runTransaction(ref(db, `${QUEUE_PATH}/${otherUid}`), (current) => {
      if (!current || current.matched) return current; // someone else got there first — abort
      return { ...current, matched: true, matchId, opponentUsername: username };
    });
    if (!claim.committed || claim.snapshot.val()?.matchId !== matchId) return;

    await update(ref(db, `${QUEUE_PATH}/${uid}`), { matched: true, matchId, opponentUsername: other.username });
    await set(ref(db, `${MATCH_PATH}/${matchId}`), {
      createdAt: Date.now(),
      status: "active",
      host: uid, // the proposer's client runs the authoritative simulation
      players: {
        [uid]:      { username, mmr, faction: "player" },
        [otherUid]: { username: other.username, mmr: other.mmr, faction: "enemy" },
      },
    });
  });

  return unsub;
}

export function subscribeToMatch(matchId, callback) {
  const db = getDb();
  if (!db) return () => {};
  return onValue(ref(db, `${MATCH_PATH}/${matchId}`), (snap) => callback(snap.val()));
}

// Host calls this each tick to broadcast the authoritative game state.
export function broadcastState(matchId, state) {
  const db = getDb();
  if (!db) return;
  set(ref(db, `${MATCH_PATH}/${matchId}/state`), state);
}

// Guest sends a command (purchase, placement, move/attack order) to the host.
export function sendCommand(matchId, uid, command) {
  const db = getDb();
  if (!db) return;
  push(ref(db, `${MATCH_PATH}/${matchId}/commands/${uid}`), { ...command, at: Date.now() });
}

export function watchCommands(matchId, uid, callback) {
  const db = getDb();
  if (!db) return () => {};
  return onValue(ref(db, `${MATCH_PATH}/${matchId}/commands/${uid}`), (snap) => {
    const val = snap.val();
    if (val) callback(Object.values(val));
  });
}

export async function reportLeave(matchId, uid) {
  const db = getDb();
  if (!db) return;
  await update(ref(db, `${MATCH_PATH}/${matchId}`), { status: "abandoned", leftBy: uid });
}

export async function reportResult(matchId, winnerUid) {
  const db = getDb();
  if (!db) return;
  await update(ref(db, `${MATCH_PATH}/${matchId}`), { status: "finished", winnerUid });
}

export async function cleanupMatch(matchId) {
  const db = getDb();
  if (!db) return;
  await remove(ref(db, `${MATCH_PATH}/${matchId}`));
}

export { isFirebaseConfigured };
