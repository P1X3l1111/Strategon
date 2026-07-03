"use client";

import { useState } from "react";

export default function ReportBugModal({ onClose }) {
  const [username, setUsername] = useState(
    typeof window !== "undefined" ? localStorage.getItem("rpg_username") || "" : ""
  );
  const [bug, setBug] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    // TODO: send to backend
    setSubmitted(true);
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-xl font-bold text-white mb-1">🐛 Report a Bug</h2>
      <p className="text-zinc-400 text-sm mb-5">Found something broken? Let us know.</p>

      {submitted ? (
        <SuccessMessage message="Bug report submitted! Thank you." onClose={onClose} />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Username" required>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              required
              className={inputCls}
            />
          </Field>
          <Field label="Bug Description" required>
            <textarea
              value={bug}
              onChange={(e) => setBug(e.target.value)}
              placeholder="Describe the bug in detail..."
              required
              rows={4}
              className={inputCls + " resize-none"}
            />
          </Field>
          <div className="flex gap-3 mt-1">
            <button type="button" onClick={onClose} className={secondaryBtn}>Cancel</button>
            <button type="submit" className={primaryBtn}>Submit Report</button>
          </div>
        </form>
      )}
    </Overlay>
  );
}

export function Overlay({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-7 flex flex-col">
        {children}
      </div>
    </div>
  );
}

export function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-zinc-300">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

export function SuccessMessage({ message, onClose }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <span className="text-4xl">✅</span>
      <p className="text-zinc-200 font-medium text-center">{message}</p>
      <button onClick={onClose} className={primaryBtn}>Close</button>
    </div>
  );
}

export const inputCls =
  "rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm w-full";

export const primaryBtn =
  "flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-2 transition-colors text-sm";

export const secondaryBtn =
  "flex-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-semibold py-2 transition-colors text-sm";
