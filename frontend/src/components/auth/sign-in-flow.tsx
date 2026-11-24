"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@/lib/api/client";
import {
  logout,
  requestOtp,
  restoreSession,
  saveConsent,
  updateProfile,
  verifyOtp,
  type UserProfile,
} from "@/lib/auth/session";

const AVATARS = [
  { code: "SPARK", label: "Spark" },
  { code: "CHAI", label: "Chai" },
  { code: "SUN", label: "Sun" },
  { code: "LEAF", label: "Leaf" },
  { code: "MOON", label: "Moon" },
  { code: "HEART", label: "Heart" },
] as const;

type Step = "restoring" | "phone" | "code" | "onboarding" | "done";

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Something went wrong. Try again.";
}

type SignInFlowProps = {
  forceReauth?: boolean;
};

export function SignInFlow({ forceReauth = false }: SignInFlowProps) {
  const [step, setStep] = useState<Step>(forceReauth ? "phone" : "restoring");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<string>("CHAI");
  const [city, setCity] = useState("");
  const [consent, setConsent] = useState({
    age: false,
    terms: false,
    privacy: false,
    guidelines: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (forceReauth) {
      return;
    }

    let cancelled = false;

    restoreSession().then((restored) => {
      if (cancelled) {
        return;
      }
      if (!restored) {
        setStep("phone");
        return;
      }
      setUser(restored);
      setDisplayName(restored.displayName ?? "");
      setAvatar(restored.avatar ?? "CHAI");
      setCity(restored.city ?? "");
      setStep(restored.onboardingRequired ? "onboarding" : "done");
    });

    return () => {
      cancelled = true;
    };
  }, [forceReauth]);

  async function handleRequestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestOtp(phone);
      setStep("code");
    } catch (requestError) {
      setError(messageFor(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const session = await verifyOtp(phone, code);
      setUser(session.user);
      setDisplayName(session.user.displayName ?? "");
      setAvatar(session.user.avatar ?? "CHAI");
      setCity(session.user.city ?? "");
      setStep(session.user.onboardingRequired ? "onboarding" : "done");
    } catch (verifyError) {
      setError(messageFor(verifyError));
    } finally {
      setBusy(false);
    }
  }

  async function handleOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!consent.age || !consent.terms || !consent.privacy || !consent.guidelines) {
      setError("All age and policy confirmations are required.");
      return;
    }
    if (displayName.trim().length < 3) {
      setError("Display name must be at least 3 characters.");
      return;
    }

    setBusy(true);
    try {
      await saveConsent({
        ageConfirmed: true,
        termsAccepted: true,
        privacyAccepted: true,
        guidelinesAccepted: true,
      });
      const updated = await updateProfile({
        displayName: displayName.trim(),
        avatar,
        ...(city.trim() ? { city: city.trim() } : {}),
      });
      setUser(updated);
      if (updated.onboardingRequired) {
        setError("Your profile is not complete yet. Check the display name and avatar.");
      } else {
        setStep("done");
      }
    } catch (onboardingError) {
      setError(messageFor(onboardingError));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
      setUser(null);
      setPhone("");
      setCode("");
      setStep("phone");
    } finally {
      setBusy(false);
    }
  }

  if (step === "restoring") {
    return (
      <section
        aria-busy="true"
        aria-live="polite"
        className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8"
      >
        <p className="text-sm text-kindly-muted">Checking your session…</p>
      </section>
    );
  }

  if (step === "done" && user) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-kindly-accent uppercase">
          Signed in
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Welcome, {user.displayName ?? "friend"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-kindly-muted">
          {user.status === "ACTIVE"
            ? "Your pseudonymous profile is ready. Your phone number is never shown publicly."
            : `Your account status is ${user.status}. Some actions are unavailable.`}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/me"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800"
          >
            My Kindness
          </Link>
          <Link
            href="/notifications"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-5 py-3 text-sm font-semibold hover:bg-kindly-accent-soft"
          >
            Notifications
          </Link>
          {user.status !== "ACTIVE" && (
            <Link
              href="/appeals"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-5 py-3 text-sm font-semibold hover:bg-kindly-accent-soft"
            >
              View moderation & appeals
            </Link>
          )}
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-5 py-3 text-sm font-semibold hover:bg-kindly-accent-soft"
          >
            Back to discovery
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-kindly-border px-5 py-3 text-sm font-semibold hover:bg-kindly-accent-soft disabled:opacity-60"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </section>
    );
  }

  if (step === "onboarding") {
    return (
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-kindly-accent uppercase">
          One last step
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Finish your profile</h1>
        <p className="mt-3 text-sm leading-6 text-kindly-muted">
          Kindly is 18+ only. These draft policies still require legal review; your acceptance is
          recorded with the current policy version.
        </p>
        <form className="mt-6 space-y-5" onSubmit={handleOnboarding}>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Confirm before continuing</legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={consent.age}
                onChange={(event) =>
                  setConsent((current) => ({ ...current, age: event.target.checked }))
                }
              />
              <span>I am 18 years or older.</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={consent.terms}
                onChange={(event) =>
                  setConsent((current) => ({ ...current, terms: event.target.checked }))
                }
              />
              <span>I accept the draft Terms of Use (legal review pending).</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={consent.privacy}
                onChange={(event) =>
                  setConsent((current) => ({ ...current, privacy: event.target.checked }))
                }
              />
              <span>I acknowledge the draft Privacy Notice (legal review pending).</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={consent.guidelines}
                onChange={(event) =>
                  setConsent((current) => ({
                    ...current,
                    guidelines: event.target.checked,
                  }))
                }
              />
              <span>I accept the draft Community Guidelines (legal review pending).</span>
            </label>
          </fieldset>

          <div>
            <label htmlFor="display-name" className="block text-sm font-medium">
              Display name
            </label>
            <input
              id="display-name"
              name="displayName"
              type="text"
              required
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9_]{3,24}"
              autoComplete="nickname"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
              aria-describedby="display-name-help"
            />
            <p id="display-name-help" className="mt-1 text-xs text-kindly-muted">
              3–24 letters, digits or underscores. This is public; never use your real name or phone
              number.
            </p>
          </div>

          <div>
            <label htmlFor="avatar" className="block text-sm font-medium">
              Avatar
            </label>
            <select
              id="avatar"
              name="avatar"
              value={avatar}
              onChange={(event) => setAvatar(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border bg-white px-3 py-2 text-sm"
            >
              {AVATARS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="city" className="block text-sm font-medium">
              City (optional)
            </label>
            <input
              id="city"
              name="city"
              type="text"
              maxLength={60}
              autoComplete="address-level2"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Finish setup"}
          </button>
        </form>
      </section>
    );
  }

  if (step === "code") {
    return (
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-kindly-accent uppercase">
          Verify your number
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Enter your one-time code</h1>
        <p className="mt-3 text-sm leading-6 text-kindly-muted">
          If this number can be verified, a six-digit code has been sent. The code expires in five
          minutes.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleVerify}>
          <div>
            <label htmlFor="otp-code" className="block text-sm font-medium">
              One-time code
            </label>
            <input
              id="otp-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={6}
              pattern="[0-9]{6}"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-lg tracking-[0.4em]"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
          >
            {busy ? "Verifying…" : "Verify code"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError(null);
            }}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-kindly-border px-5 py-3 text-sm font-semibold hover:bg-kindly-accent-soft"
          >
            Use a different number
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border sm:p-8">
      <p className="text-sm font-semibold tracking-wide text-kindly-accent uppercase">
        Authentication
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        Sign in with your mobile number
      </h1>
      <p className="mt-3 text-sm leading-6 text-kindly-muted">
        We send a one-time code to verify your Indian mobile number. Your phone number is private
        and is never shown on your public profile.
      </p>
      <form className="mt-6 space-y-4" onSubmit={handleRequestOtp}>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium">
            Mobile number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+91 98765 43210"
            className="mt-1 min-h-11 w-full rounded-xl border border-kindly-border px-3 py-2 text-sm"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-kindly-accent px-5 py-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send code"}
        </button>
      </form>
      <p className="mt-4 text-xs text-kindly-muted">
        By continuing you confirm you are 18+ and accept the draft Terms, Privacy Notice and
        Community Guidelines. Browsing remains available without an account.
      </p>
    </section>
  );
}
