"use client";

import { FormEvent, useState } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

export function WaitlistForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong. Please try again.");
      }

      setState("success");
      setMessage(data.message || "You’re on the list — welcome aboard!");
      setEmail("");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className={compact ? "w-full" : "mx-auto w-full max-w-xl"}>
      <form
        className="waitlist-form"
        onSubmit={handleSubmit}
        aria-label="Join the Subframe waitlist"
      >
        <label className="sr-only" htmlFor={compact ? "footer-email" : "hero-email"}>
          Work email
        </label>
        <input
          id={compact ? "footer-email" : "hero-email"}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@studio.com"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={state === "submitting" || state === "success"}
        />
        <button type="submit" disabled={state === "submitting" || state === "success"}>
          {state === "submitting" ? (
            <span className="button-loading"><span className="spinner" /> Joining...</span>
          ) : state === "success" ? (
            <span className="button-loading"><CheckIcon /> Joined</span>
          ) : (
            <span className="button-loading">Join the Waitlist <ArrowIcon /></span>
          )}
        </button>
      </form>
      <div className="min-h-7 pt-2.5 text-left">
        {message ? (
          <p
            className={`text-sm ${state === "success" ? "text-emerald-400" : "text-rose-400"}`}
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        ) : !compact ? (
          <p className="flex items-center gap-2 text-sm text-zinc-500">
            <ShieldIcon /> Free early access. No spam, ever.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-9" /></svg>;
}

function ShieldIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5 16 5v4.5c0 3.6-2.3 6.5-6 8-3.7-1.5-6-4.4-6-8V5l6-2.5Z" stroke="currentColor" strokeWidth="1.5"/><path d="m7.5 10 1.6 1.6 3.5-3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
