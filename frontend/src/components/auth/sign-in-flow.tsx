"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import {
  requestOtp,
  restoreSession,
  saveConsent,
  updateProfile,
  verifyOtp,
  type UserProfile,
} from "@/lib/auth/session";

const AVATARS = [
  { code: "SPARK", label: "Spark", symbol: "✦" },
  { code: "CHAI", label: "Chai", symbol: "☕" },
  { code: "SUN", label: "Sun", symbol: "☀" },
  { code: "LEAF", label: "Leaf", symbol: "☘" },
  { code: "MOON", label: "Moon", symbol: "☾" },
  { code: "HEART", label: "Heart", symbol: "♥" },
] as const;

type Step = "restoring" | "phone" | "code" | "onboarding" | "done";

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Something went wrong. Try again.";
}

function postAuthDestination(user: UserProfile): string {
  if (user.status !== "ACTIVE") {
    return "/appeals";
  }
  if (typeof window === "undefined") {
    return "/me";
  }
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next) {
    return "/me";
  }
  try {
    const destination = new URL(next, window.location.origin);
    if (destination.origin !== window.location.origin) {
      return "/me";
    }
    if (destination.pathname === "/sign-in" || destination.pathname === "/reauth") {
      return "/me";
    }
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/me";
  }
}

function AuthVisual() {
  return (
    <div className="relative h-40 overflow-hidden bg-kindly-accent-soft sm:h-48">
      <div className="absolute -top-8 -right-6 grid h-32 w-32 place-items-center rounded-full bg-kindly-marigold text-kindly-ink shadow-[inset_-8px_-8px_0_rgb(255_255_255_/_18%)] sm:h-40 sm:w-40">
        <Icon name="sun" className="h-12 w-12 sm:h-14 sm:w-14" />
      </div>
      <div className="absolute right-32 bottom-5 h-12 w-12 rotate-[-10deg] rounded-full bg-kindly-blush" />
      <div className="absolute bottom-5 left-5 w-52 rotate-[-4deg] rounded-2xl border border-kindly-border bg-kindly-card p-4 shadow-[6px_6px_0_rgb(23_59_51_/_8%)] sm:left-8 sm:w-64">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-kindly-blush text-kindly-coral">
          <Icon name="cup" className="h-5 w-5" />
        </span>
        <p className="mt-2 font-hand text-2xl leading-none">come as you are</p>
      </div>
      <span className="absolute right-24 bottom-5 text-kindly-accent">
        <Icon name="plant" className="h-8 w-8" />
      </span>
    </div>
  );
}

function AuthPanel({ children, art = true }: { children: ReactNode; art?: boolean }) {
  return (
    <section className="mx-auto max-w-xl overflow-hidden rounded-[2rem] border border-kindly-border bg-kindly-card shadow-[0_2px_0_rgb(23_59_51_/_4%)]">
      {art && <AuthVisual />}
      <div className="p-5 sm:p-8">{children}</div>
    </section>
  );
}

type SignInFlowProps = {
  forceReauth?: boolean;
};

export function SignInFlow({ forceReauth = false }: SignInFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(forceReauth ? "phone" : "restoring");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
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
      setDisplayName(restored.displayName ?? "");
      setAvatar(restored.avatar ?? "CHAI");
      setCity(restored.city ?? "");
      if (restored.onboardingRequired) {
        setStep("onboarding");
        return;
      }
      setStep("done");
      router.replace(postAuthDestination(restored));
    });

    return () => {
      cancelled = true;
    };
  }, [forceReauth, router]);

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
      setDisplayName(session.user.displayName ?? "");
      setAvatar(session.user.avatar ?? "CHAI");
      setCity(session.user.city ?? "");
      if (session.user.onboardingRequired) {
        setStep("onboarding");
      } else {
        setStep("done");
        router.replace(postAuthDestination(session.user));
      }
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
      if (updated.onboardingRequired) {
        setError("Your profile is not complete yet. Check the display name and avatar.");
      } else {
        setStep("done");
        router.replace(postAuthDestination(updated));
      }
    } catch (onboardingError) {
      setError(messageFor(onboardingError));
    } finally {
      setBusy(false);
    }
  }

  if (step === "restoring") {
    return (
      <AuthPanel art={false}>
        <p aria-busy="true" aria-live="polite" className="text-sm text-kindly-muted">
          Checking your session…
        </p>
      </AuthPanel>
    );
  }

  if (step === "done") {
    return (
      <AuthPanel art={false}>
        <p aria-busy="true" aria-live="polite" className="text-sm text-kindly-muted">
          Opening your account…
        </p>
      </AuthPanel>
    );
  }

  if (step === "onboarding") {
    return (
      <AuthPanel>
        <p className="kindly-eyebrow">One last step</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
          Finish your profile
        </h1>
        <p className="mt-3 text-sm leading-6 text-kindly-muted">
          Kindly is 18+ only. These draft policies still require legal review; your acceptance is
          recorded with the current policy version.
        </p>
        <form className="mt-6 space-y-5" onSubmit={handleOnboarding}>
          <fieldset className="space-y-2 rounded-2xl border border-kindly-border bg-kindly-cream/60 p-4">
            <legend className="text-sm font-bold">Confirm before continuing</legend>
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
            <label htmlFor="display-name" className="kindly-label">
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
              className="kindly-input mt-1"
              aria-describedby="display-name-help"
            />
            <p id="display-name-help" className="kindly-help">
              3–24 letters, digits or underscores. This is public; never use your real name or phone
              number.
            </p>
          </div>

          <fieldset>
            <legend className="text-sm font-bold">Choose your avatar</legend>
            <p id="avatar-help" className="kindly-help">
              A small symbol shown beside your pseudonym. Pick one of six preset symbols — there is
              no photo upload, and it should not reveal your identity.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AVATARS.map((option) => {
                const selected = avatar === option.code;
                return (
                  <label
                    key={option.code}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                      selected
                        ? "border-kindly-accent bg-kindly-accent-soft"
                        : "border-kindly-border bg-kindly-card hover:border-kindly-accent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="avatar"
                      value={option.code}
                      checked={selected}
                      onChange={() => setAvatar(option.code)}
                      aria-describedby="avatar-help"
                      className="h-4 w-4 accent-kindly-accent"
                    />
                    <span aria-hidden="true" className="text-lg leading-none">
                      {option.symbol}
                    </span>
                    <span className="font-medium">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="city" className="kindly-label">
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
              className="kindly-input mt-1"
            />
          </div>

          {error && (
            <p role="alert" className="kindly-status-error">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="kindly-btn-primary mt-1 w-full">
            {busy ? "Saving…" : "Finish setup"}
          </button>
        </form>
      </AuthPanel>
    );
  }

  if (step === "code") {
    return (
      <AuthPanel>
        <p className="kindly-eyebrow">Verify your number</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
          Enter your one-time code
        </h1>
        <p className="mt-3 text-sm leading-6 text-kindly-muted">
          If this number can be verified, a six-digit code has been sent. The code expires in five
          minutes.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleVerify}>
          <div>
            <label htmlFor="otp-code" className="kindly-label">
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
              className="kindly-input mt-1 text-lg tracking-[0.4em]"
            />
          </div>

          {error && (
            <p role="alert" className="kindly-status-error">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="kindly-btn-primary w-full">
            {busy ? "Verifying…" : "Verify code"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError(null);
            }}
            className="kindly-btn-secondary w-full"
          >
            Use a different number
          </button>
        </form>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel>
      <p className="kindly-eyebrow">A little kindness starts here</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
        Sign in with your mobile number
      </h1>
      <p className="mt-3 text-sm leading-6 text-kindly-muted">
        We send a one-time code to verify your Indian mobile number. Your phone number is private
        and is never shown on your public profile.
      </p>
      <form className="mt-6 space-y-4" onSubmit={handleRequestOtp}>
        <div>
          <label htmlFor="phone" className="kindly-label">
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
            className="kindly-input mt-1"
          />
        </div>

        {error && (
          <p role="alert" className="kindly-status-error">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="kindly-btn-primary w-full">
          {busy ? "Sending…" : "Send code"}
          <Icon name="arrow-right" className="h-4 w-4" />
        </button>
      </form>
      <p className="mt-4 text-xs leading-5 text-kindly-muted">
        By continuing you confirm you are 18+ and accept the draft Terms, Privacy Notice and
        Community Guidelines. Browsing remains available without an account.
      </p>
    </AuthPanel>
  );
}
