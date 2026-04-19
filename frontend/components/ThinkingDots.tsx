interface ThinkingDotsProps {
  lang: "ar" | "fr";
}

export default function ThinkingDots({ lang }: ThinkingDotsProps) {
  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className={lang === "ar" ? "font-ar text-right" : "font-fr text-left"}
      aria-label={lang === "ar" ? "جارٍ التفكير / Réflexion en cours" : "Réflexion en cours / جارٍ التفكير"}
    >
      <div className="flex items-center gap-1">
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        <span className="thinking-dot" />
      </div>
      <p className="mt-2 text-xs text-[var(--bg-mid)]">
        {lang === "ar" ? "جارٍ البحث في النصوص القانونية..." : "Recherche dans les textes juridiques..."}
      </p>
    </div>
  );
}
