"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export function PasswordGate({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch(`/api/share/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError(true);
        setShake(true);
        setTimeout(() => setShake(false), 400);
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className={cn(
          "flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm transition-transform",
          shake && "animate-[shake_0.4s_ease-in-out]"
        )}
      >
        <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }`}</style>
        <div className="flex size-12 items-center justify-center rounded-full bg-slate-100">
          <Lock className="size-5 text-slate-500" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">This summary is password protected</h1>
          <p className="mt-1 text-sm text-slate-500">Enter the password to view this meeting summary.</p>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
        />
        {error && <p className="text-sm text-red-600">Incorrect password, try again.</p>}
        <button
          type="submit"
          disabled={submitting || !password}
          className="w-full rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
