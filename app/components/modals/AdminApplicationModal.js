"use client";

import { useState } from "react";
import { Overlay, Field, SuccessMessage, inputCls, primaryBtn, secondaryBtn } from "./ReportBugModal";

export default function AdminApplicationModal({ onClose }) {
  const [form, setForm] = useState({
    name: "",
    age: "",
    why: "",
    devExperience: "",
    codingLanguage: "",
    createdGame: "",
  });
  const [submitted, setSubmitted] = useState(false);

  function set(key) {
    return (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-xl font-bold text-white mb-1">🛡️ Apply for Admin</h2>
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs font-semibold bg-red-600 text-white rounded-full px-2 py-0.5">LIMITED</span>
        <span className="text-xs font-semibold bg-zinc-700 text-zinc-300 rounded-full px-2 py-0.5">No Payment</span>
      </div>

      {submitted ? (
        <SuccessMessage message="Application submitted! We'll review it and get back to you." onClose={onClose} />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto max-h-[70vh] pr-1">
          <Field label="Name" required>
            <input type="text" value={form.name} onChange={set("name")} placeholder="Your real name" required className={inputCls} />
          </Field>

          <Field label="Age" required>
            <input type="number" value={form.age} onChange={set("age")} placeholder="Your age" required min={10} max={99} className={inputCls} />
          </Field>

          <Field label="Why do you want to be an admin?" required>
            <textarea value={form.why} onChange={set("why")} placeholder="Tell us your motivation..." required rows={3} className={inputCls + " resize-none"} />
          </Field>

          <Field label="Have you ever worked as a developer?" required>
            <div className="flex gap-4">
              {["Yes", "No"].map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
                  <input
                    type="radio"
                    name="devExperience"
                    value={opt.toLowerCase()}
                    checked={form.devExperience === opt.toLowerCase()}
                    onChange={set("devExperience")}
                    required
                    className="accent-indigo-500"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </Field>

          <Field label="What coding language are you most familiar with?" required>
            <input type="text" value={form.codingLanguage} onChange={set("codingLanguage")} placeholder="e.g. JavaScript, Python..." required className={inputCls} />
          </Field>

          <Field label="Have you ever created a game?" required>
            <div className="flex gap-4">
              {["Yes", "No"].map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
                  <input
                    type="radio"
                    name="createdGame"
                    value={opt.toLowerCase()}
                    checked={form.createdGame === opt.toLowerCase()}
                    onChange={set("createdGame")}
                    required
                    className="accent-indigo-500"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </Field>

          <div className="flex gap-3 mt-1">
            <button type="button" onClick={onClose} className={secondaryBtn}>Cancel</button>
            <button type="submit" className={primaryBtn}>Submit Application</button>
          </div>
        </form>
      )}
    </Overlay>
  );
}
