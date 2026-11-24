import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, aside }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="kindly-eyebrow">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.055em] text-kindly-ink sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-kindly-muted">{description}</p>
        )}
      </div>
      {aside}
    </header>
  );
}
