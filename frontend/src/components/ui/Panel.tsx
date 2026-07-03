import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  variant?: "default" | "feature" | "archive" | "support";
};

export default function Panel({
  title,
  subtitle,
  children,
  className = "",
  variant = "default",
}: PanelProps) {
  const variantClassName =
    variant === "feature"
      ? "panel-feature"
      : variant === "archive"
      ? "panel-archive"
      : variant === "support"
      ? "panel-support"
      : "panel-default";

  return (
    <section
      className={`ops-panel ${variantClassName} p-4 sm:p-5 ${className}`.trim()}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold leading-7 text-[var(--text-main)] sm:text-lg">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1.5 max-w-[54ch] text-sm leading-6 text-[var(--text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {children}
    </section>
  );
}
