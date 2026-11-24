import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "arrow-right"
  | "bell"
  | "chevron-down"
  | "compass"
  | "cup"
  | "gift"
  | "heart"
  | "lock"
  | "plant"
  | "shield"
  | "sparkle"
  | "sun"
  | "user"
  | "x";

const paths: Record<IconName, ReactNode> = {
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2.2 5-4.8 2 2.2-5 4.8-2Z" />
    </>
  ),
  cup: (
    <>
      <path d="M5 8h10v4.5A5.5 5.5 0 0 1 9.5 18h0A4.5 4.5 0 0 1 5 13.5V8Z" />
      <path d="M15 9h1.5a2.5 2.5 0 0 1 0 5H15" />
      <path d="M7 3.5c0 .8-.8 1.2-.8 2s.8 1.2.8 2M11 3.5c0 .8-.8 1.2-.8 2s.8 1.2.8 2" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="2" />
      <path d="M12 9v11M3.5 9h17M8 9C6 9 4.5 7.6 4.5 5.7S5.9 2.5 7.8 2.5C10.2 2.5 12 9 12 9s1.8-6.5 4.2-6.5c1.9 0 3.3 1.3 3.3 3.2S18 9 16 9" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8Z" />
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  plant: (
    <path d="M12 21V10M12 13c-3.5 0-6-2.5-6-6 3.5 0 6 2.5 6 6ZM12 11c3.5 0 6-2.5 6-6-3.5 0-6 2.5-6 6Z" />
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4.4 2.9 8.4 7 10 4.1-1.6 7-5.6 7-10V6l-7-3Z" />
      <path d="m9.5 12 1.7 1.7 3.5-3.7" />
    </>
  ),
  sparkle: <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
};

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
};

export function Icon({ name, className = "h-5 w-5", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
