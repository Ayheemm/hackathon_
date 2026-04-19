import clsx from "clsx";

interface LanguageBadgeProps {
  lang: "ar" | "fr";
}

export default function LanguageBadge({ lang }: LanguageBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border border-[0.5px] border-[rgba(36,92,154,0.3)] bg-[rgba(36,92,154,0.11)] px-2 py-0.5 text-xs font-semibold text-[var(--state-info)]",
        lang === "ar" ? "font-ar" : "font-fr",
      )}
      aria-label={lang === "ar" ? "اللغة العربية / Langue arabe" : "Langue française / اللغة الفرنسية"}
    >
      {lang.toUpperCase()}
    </span>
  );
}
