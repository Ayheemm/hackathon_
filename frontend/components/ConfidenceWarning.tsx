import { AlertTriangle } from "lucide-react";

interface ConfidenceWarningProps {
  message: string;
  lang: "ar" | "fr";
}

export default function ConfidenceWarning({ message, lang }: ConfidenceWarningProps) {
  const text =
    lang === "ar"
      ? "تحذير: قد تكون هذه الإجابة مبنية على مصادر ذات صلة جزئية."
      : "Avertissement : Cette réponse est basée sur des sources partiellement pertinentes.";

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="flex w-full items-start gap-2 rounded-md border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-[rgba(212,160,80,0.13)] px-3 py-2 text-sm text-[var(--bg-dark)]"
      aria-label={lang === "ar" ? "تنبيه ثقة منخفضة / Alerte de confiance" : "Alerte de confiance / تنبيه الثقة"}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className={lang === "ar" ? "font-ar text-right" : "font-fr text-left"}>
        <p>{text}</p>
        {message ? <p className="mt-0.5 text-xs opacity-80">{message}</p> : null}
      </div>
    </div>
  );
}
