"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminPanel from "../components/AdminPanel";

// Standalone /admin route — no navbar entry point, reached by typing the URL directly.
export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    setCurrentUser(localStorage.getItem("rpg_username") || null);
  }, []);

  return (
    <div className="bg-zinc-950 h-screen overflow-hidden">
      <AdminPanel
        currentUser={currentUser}
        onBack={() => router.push("/")}
        onMapChange={() => {}}
      />
    </div>
  );
}
