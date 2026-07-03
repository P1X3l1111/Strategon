"use client";

import { useState } from "react";
import { Overlay, Field, SuccessMessage, inputCls, primaryBtn, secondaryBtn } from "./ReportBugModal";

export default function SuggestionModal({ onClose }) {
  const [username, setUsername] = useState(
    typeof window !== "undefined" ? localStorage.getItem("rpg_username") || "" : ""
  );
  const [suggestion, setSuggestion] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-xl font-bold text-white mb-1">💡 Make a Suggestion</h2>
      <p className="text-zinc-400 text-sm mb-5">Have an idea to improve the game? Share it!</p>

      {submitted ? (
        <SuccessMessage message="Suggestion submitted! We appreciate your feedback." onClose={onClose} />
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
          <Field label="Your Suggestion" required>
            <textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Describe your suggestion..."
              required
              rows={4}
              className={inputCls + " resize-none"}
            />
          </Field>
          <div className="flex gap-3 mt-1">
            <button type="button" onClick={onClose} className={secondaryBtn}>Cancel</button>
            <button type="submit" className={primaryBtn}>Submit Suggestion</button>
          </div>
        </form>
      )}
    </Overlay>
  );
}
