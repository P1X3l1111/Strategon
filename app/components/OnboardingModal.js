"use client";

import { useState, useEffect } from "react";

const ACCOUNTS_KEY = "rpg_accounts"; // { [username]: hashedPassword }

// Simple hash (not cryptographic, but better than plain text for localStorage)
async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
  } catch {
    return {};
  }
}

export default function OnboardingModal() {
  const [mode, setMode] = useState("register"); // "register" | "login"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    localStorage.removeItem("rpg_username");
    // If accounts already exist, default to login
    const accounts = getAccounts();
    if (Object.keys(accounts).length > 0) setMode("login");
    setVisible(true);
  }, []);

  // When user finishes typing username, auto-switch mode
  function handleUsernameBlur() {
    const accounts = getAccounts();
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) return;
    if (accounts[trimmed]) {
      setMode("login");
      setError("");
    } else {
      setMode("register");
      setError("");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const accounts = getAccounts();
    const trimmed = username.trim();

    if (mode === "register") {
      if (accounts[trimmed.toLowerCase()]) {
        setError("Username already taken. Please log in or choose another.");
        return;
      }
      const hashed = await hashPassword(password);
      accounts[trimmed.toLowerCase()] = { displayName: trimmed, hash: hashed };
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      localStorage.setItem("rpg_username", trimmed);
      setVisible(false);
      window.dispatchEvent(new Event("rpg_profile_updated"));
    } else {
      const account = accounts[trimmed.toLowerCase()];
      if (!account) {
        setError("Username not found. Please register first.");
        return;
      }
      const hashed = await hashPassword(password);
      if (hashed !== account.hash) {
        setError("Incorrect password.");
        return;
      }
      localStorage.setItem("rpg_username", account.displayName);
      setVisible(false);
      window.dispatchEvent(new Event("rpg_profile_updated"));
    }
  }

  if (!visible) return null;

  const isLogin = mode === "login";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {isLogin ? "Welcome back! ⚔️" : "Welcome, adventurer! ⚔️"}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isLogin ? "Log in to continue your journey." : "Create your profile to begin your journey."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="username">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              onBlur={handleUsernameBlur}
              placeholder="Enter your username"
              required
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="password">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder={isLogin ? "Enter your password" : "Create a password"}
              required
              minLength={isLogin ? 1 : 6}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            className="mt-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-2.5 transition-colors"
          >
            {isLogin ? "Log In" : "Start Adventure"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          {isLogin ? (
            <>New here?{" "}
              <button onClick={() => { setMode("register"); setError(""); }} className="text-indigo-500 hover:underline font-medium">
                Create an account
              </button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button onClick={() => { setMode("login"); setError(""); }} className="text-indigo-500 hover:underline font-medium">
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
