"use client";

import { useState } from "react";
import { Overlay, Field, SuccessMessage, inputCls, primaryBtn, secondaryBtn } from "./ReportBugModal";

export default function ReportPlayerModal({ onClose }) {
  const [username, setUsername] = useState(
    typeof window !== "undefined" ? localStorage.getItem("rpg_username") || "" : ""
  );
  const [reportedPlayer, setReportedPlayer] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    // TODO: send to backend
    setSubmitted(true);
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-xl font-bold text-white mb-1">🚩 Report a Player</h2>
      <p className="text-zinc-400 text-sm mb-5">Cheating, abusive chat, leaving matches on purpose? Let us know.</p>

      {submitted ? (
        <SuccessMessage message="Report submitted! Our team will review it." onClose={onClose} />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Your Username" required>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              required
              className={inputCls}
            />
          </Field>
          <Field label="Player You're Reporting" required>
            <input
              type="text"
              value={reportedPlayer}
              onChange={(e) => setReportedPlayer(e.target.value)}
              placeholder="Their username"
              required
              className={inputCls}
            />
          </Field>
          <Field label="Message" required>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What happened?"
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
