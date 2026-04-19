"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import CalculatorCard from "./CalculatorCard";
import ExportPdfButton from "./ExportPdfButton";
import StatusPill from "./StatusPill";
import { COURT_LABELS, JUDGMENT_NATURE_LABELS, MATTER_LABELS, NOTIFICATION_LABELS } from "../../lib/calculators/labels";
import { calculateAppealDeadlines } from "../../lib/calculators/appealDeadlines";
import type { AppealResult, CourtLevel, JudgmentNature, LegalMatter, NotificationMethod } from "../../lib/calculators/types";

function todayString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDate(value?: Date): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("fr-TN", { dateStyle: "medium" }).format(value);
}

function daysRemainingBadge(daysRemaining?: number): { label: string; className: string } {
  if (daysRemaining === undefined) {
    return {
      label: "-",
      className: "border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-[rgba(212,160,80,0.07)] text-[var(--bg-dark)]",
    };
  }

  if (daysRemaining < 5) {
    return {
      label: `${daysRemaining} j`,
      className: "border border-[0.5px] border-[rgba(143,29,29,0.35)] bg-[rgba(143,29,29,0.13)] text-[var(--state-danger)]",
    };
  }

  if (daysRemaining <= 15) {
    return {
      label: `${daysRemaining} j`,
      className: "border border-[0.5px] border-[rgba(166,90,0,0.34)] bg-[rgba(166,90,0,0.13)] text-[var(--state-warning)]",
    };
  }

  return {
    label: `${daysRemaining} j`,
    className: "border border-[0.5px] border-[rgba(31,107,70,0.32)] bg-[rgba(31,107,70,0.11)] text-[var(--state-success)]",
  };
}

export default function AppealCalculator() {
  const [courtLevel, setCourtLevel] = useState<CourtLevel>("first_instance");
  const [matter, setMatter] = useState<LegalMatter>("civil");
  const [judgmentNature, setJudgmentNature] = useState<JudgmentNature>("contradictoire");
  const [judgmentDate, setJudgmentDate] = useState(todayString());
  const [notificationMethod, setNotificationMethod] = useState<NotificationMethod>("direct_party");
  const [notificationDate, setNotificationDate] = useState(todayString());

  const [result, setResult] = useState<AppealResult | null>(null);
  const [error, setError] = useState("");

  const explanationSeed = useMemo(() => {
    if (!result) {
      return "";
    }
    const summary = result.remedies
      .filter((item) => item.available)
      .map((item) => `${item.name}: ${item.daysRemaining ?? "?"} jours`)
      .join("; ");
    return `Explique ces delais de recours en procedure tunisienne: ${summary}`;
  }, [result]);

  const pdfLines = useMemo(() => {
    if (!result) {
      return [];
    }

    const lines: string[] = [
      `Juridiction: ${COURT_LABELS[courtLevel].fr}`,
      `Matiere: ${MATTER_LABELS[matter].fr}`,
      `Nature du jugement: ${JUDGMENT_NATURE_LABELS[judgmentNature].fr}`,
      `Mode de notification: ${NOTIFICATION_LABELS[notificationMethod].fr}`,
      "",
      "Voies de recours:",
    ];

    for (const remedy of result.remedies) {
      const deadlineLabel = remedy.deadline ? formatDate(remedy.deadline) : "N/A";
      lines.push(`${remedy.name}: ${deadlineLabel} - ${remedy.available ? remedy.status : "indisponible"}`);
    }

    lines.push("", "Timeline:");
    for (const point of result.timelinePoints) {
      lines.push(`${formatDate(point.date)} - ${point.label}`);
    }

    return lines;
  }, [result, courtLevel, matter, judgmentNature, notificationMethod]);

  const handleCalculate = () => {
    if (!judgmentDate) {
      setError("Date du jugement obligatoire.");
      setResult(null);
      return;
    }

    const parsedJudgmentDate = new Date(judgmentDate);
    if (Number.isNaN(parsedJudgmentDate.getTime())) {
      setError("Date du jugement invalide.");
      setResult(null);
      return;
    }

    const parsedNotificationDate = notificationDate ? new Date(notificationDate) : undefined;
    if (parsedNotificationDate && Number.isNaN(parsedNotificationDate.getTime())) {
      setError("Date de notification invalide.");
      setResult(null);
      return;
    }

    setError("");
    setResult(
      calculateAppealDeadlines({
        courtLevel,
        matter,
        judgmentNature,
        judgmentDate: parsedJudgmentDate,
        notificationMethod,
        notificationDate: parsedNotificationDate,
      }),
    );
  };

  return (
    <div className="space-y-4">
      <CalculatorCard
        title="Delais de recours"
        subtitle="Simulation des voies de recours (appel, opposition, cassation) avec ajustement jour ouvrable."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--text-dark)]">Niveau de juridiction</span>
            <select
              value={courtLevel}
              onChange={(event) => setCourtLevel(event.target.value as CourtLevel)}
              className="w-full rounded-lg border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-3 py-2 text-sm"
            >
              {Object.entries(COURT_LABELS).map(([value, labels]) => (
                <option key={value} value={value}>
                  {labels.fr} / {labels.ar}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--text-dark)]">Matiere</span>
            <select
              value={matter}
              onChange={(event) => setMatter(event.target.value as LegalMatter)}
              className="w-full rounded-lg border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-3 py-2 text-sm"
            >
              {Object.entries(MATTER_LABELS).map(([value, labels]) => (
                <option key={value} value={value}>
                  {labels.fr} / {labels.ar}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--text-dark)]">Nature du jugement</span>
            <select
              value={judgmentNature}
              onChange={(event) => setJudgmentNature(event.target.value as JudgmentNature)}
              className="w-full rounded-lg border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-3 py-2 text-sm"
            >
              {Object.entries(JUDGMENT_NATURE_LABELS).map(([value, labels]) => (
                <option key={value} value={value}>
                  {labels.fr} / {labels.ar}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--text-dark)]">Date du jugement</span>
            <input
              type="date"
              value={judgmentDate}
              onChange={(event) => setJudgmentDate(event.target.value)}
              className="w-full rounded-lg border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--text-dark)]">Mode de notification</span>
            <select
              value={notificationMethod}
              onChange={(event) => setNotificationMethod(event.target.value as NotificationMethod)}
              className="w-full rounded-lg border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-3 py-2 text-sm"
            >
              {Object.entries(NOTIFICATION_LABELS).map(([value, labels]) => (
                <option key={value} value={value}>
                  {labels.fr} / {labels.ar}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--text-dark)]">Date de notification</span>
            <input
              type="date"
              value={notificationDate}
              onChange={(event) => setNotificationDate(event.target.value)}
              className="w-full rounded-lg border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleCalculate}
            className="rounded-lg bg-[var(--bg-deep)] px-4 py-2 text-sm font-semibold text-[var(--text-light)] transition hover:bg-[var(--bg-dark)]"
          >
            Calculer
          </button>
          <button
            type="button"
            onClick={() => {
              setCourtLevel("first_instance");
              setMatter("civil");
              setJudgmentNature("contradictoire");
              setJudgmentDate(todayString());
              setNotificationMethod("direct_party");
              setNotificationDate(todayString());
              setResult(null);
              setError("");
            }}
            className="rounded-lg border border-[rgba(212,160,80,0.33)] bg-[var(--bg-card)] px-4 py-2 text-sm font-semibold text-[var(--bg-dark)] transition hover:bg-[rgba(212,160,80,0.07)]"
          >
            Reinitialiser
          </button>
        </div>

        {error ? <p className="mt-3 text-sm font-semibold text-[var(--bg-dark)]">{error}</p> : null}
      </CalculatorCard>

      {result ? (
        <CalculatorCard title="Recours disponibles" subtitle="Les delais sont ajustes au prochain jour ouvrable en cas de week-end/jour ferie.">
          <div className="space-y-2">
            {result.remedies.map((remedy, index) => (
              <article key={`${remedy.name}-${index}`} className="rounded-[12px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-card)] p-3">
                {(() => {
                  const badge = daysRemainingBadge(remedy.daysRemaining);
                  return (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-[var(--text-dark)]">{remedy.name}</h3>
                    <p className="font-ar text-sm text-[var(--bg-mid)]">{remedy.nameAr}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {remedy.available && remedy.status ? <StatusPill status={remedy.status} /> : null}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                  </div>
                </div>
                  );
                })()}

                <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
                  <p>
                    <span className="text-[var(--text-muted)]">Delai:</span> {remedy.deadlineDays} jour(s)
                  </p>
                  <p>
                    <span className="text-[var(--text-muted)]">Echeance:</span> {formatDate(remedy.deadline)}
                  </p>
                  <p>
                    <span className="text-[var(--text-muted)]">Restant:</span> {remedy.daysRemaining ?? "-"} jour(s)
                  </p>
                </div>

                <p className="mt-2 text-xs text-[var(--bg-dark)]">{remedy.articleRef}</p>
                {!remedy.available && remedy.unavailableReason ? (
                  <p className="mt-2 rounded-[12px] border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-[rgba(212,160,80,0.07)] p-2 text-xs text-[var(--text-dark)]">{remedy.unavailableReason}</p>
                ) : null}
              </article>
            ))}
          </div>

          <div className="mt-4 rounded-[12px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-card)] p-3">
            <p className="mb-1 text-sm font-semibold text-[var(--text-dark)]">Timeline</p>
            <ul className="space-y-1 text-sm text-[var(--text-dark)]">
              {result.timelinePoints.map((point, index) => (
                <li key={`${point.label}-${index}`}>
                  {formatDate(point.date)} - {point.label}
                </li>
              ))}
            </ul>
          </div>

          {result.nextUrgentDeadline ? (
            <p className="mt-3 rounded-[12px] border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-[rgba(212,160,80,0.07)] p-2 text-sm text-[var(--text-dark)]">
              Prochain delai urgent: {result.nextUrgentDeadline.name} ({result.nextUrgentDeadline.daysRemaining} jour(s)).
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/chat?q=${encodeURIComponent(explanationSeed)}`}
              className="inline-flex rounded-lg border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-[rgba(212,160,80,0.13)] px-3 py-2 text-sm font-semibold text-[var(--text-dark)] transition hover:bg-[rgba(212,160,80,0.09)]"
            >
              Explain with AI
            </Link>
            <ExportPdfButton fileName="9anouni-recours" title="Rapport delais de recours - 9anouni" lines={pdfLines} />
          </div>
        </CalculatorCard>
      ) : null}
    </div>
  );
}
