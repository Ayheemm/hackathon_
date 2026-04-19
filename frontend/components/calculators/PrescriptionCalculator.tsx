"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import CalculatorCard from "./CalculatorCard";
import ExportPdfButton from "./ExportPdfButton";
import StatusPill from "./StatusPill";
import { CLAIM_LABELS } from "../../lib/calculators/labels";
import { calculatePrescription } from "../../lib/calculators/prescription";
import type { ClaimType, InterruptionEvent, PrescriptionResult, SuspensionCause } from "../../lib/calculators/types";

type ClaimCategory = "civil" | "penal";

const CIVIL_CLAIMS: ClaimType[] = [
  "civil_personal_general",
  "civil_liability",
  "civil_commercial",
  "civil_rent_payment",
  "civil_contract_nullity",
  "civil_alimony",
];

const PENAL_CLAIMS: ClaimType[] = ["penal_crime", "penal_delit", "penal_contravention"];

type SuspensionForm = {
  id: string;
  type: SuspensionCause["type"];
  startDate: string;
  endDate: string;
};

type InterruptionForm = {
  id: string;
  type: InterruptionEvent["type"];
  date: string;
};

function todayString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-TN", { dateStyle: "medium" }).format(date);
}

export default function PrescriptionCalculator() {
  const [claimCategory, setClaimCategory] = useState<ClaimCategory>("civil");
  const [claimType, setClaimType] = useState<ClaimType>("civil_personal_general");
  const [startDate, setStartDate] = useState(todayString());
  const [adjustmentsEnabled, setAdjustmentsEnabled] = useState(false);
  const [suspensions, setSuspensions] = useState<SuspensionForm[]>([]);
  const [interruptions, setInterruptions] = useState<InterruptionForm[]>([]);
  const [result, setResult] = useState<PrescriptionResult | null>(null);
  const [error, setError] = useState("");

  const availableClaims = claimCategory === "civil" ? CIVIL_CLAIMS : PENAL_CLAIMS;

  useEffect(() => {
    if (!availableClaims.includes(claimType)) {
      setClaimType(availableClaims[0]);
    }
  }, [availableClaims, claimType]);

  const explanationSeed = useMemo(() => {
    if (!result) {
      return "";
    }
    const claim = CLAIM_LABELS[result.claimType].fr;
    return `Explique ce calcul de prescription en droit tunisien pour '${claim}': debut ${formatDate(result.adjustedStartDate)}, expiration ${formatDate(result.expiryDate)}, statut ${result.status}.`;
  }, [result]);

  const pdfLines = useMemo(() => {
    if (!result) {
      return [];
    }
    const claim = CLAIM_LABELS[result.claimType].fr;
    const lines = [
      `Type de demande: ${claim}`,
      `Reference: ${result.articleRef}`,
      `Delai legal: ${result.prescriptionYears} an(s)`,
      `Date de depart initiale: ${formatDate(result.startDate)}`,
      `Date de depart ajustee: ${formatDate(result.adjustedStartDate)}`,
      `Date d'expiration: ${formatDate(result.expiryDate)}`,
      `Jours restants: ${result.daysRemaining}`,
      `Statut: ${result.status}`,
    ];
    if (result.suspensionNote) {
      lines.push(result.suspensionNote);
    }
    if (result.interruptionNote) {
      lines.push(result.interruptionNote);
    }
    return lines;
  }, [result]);

  const handleCalculate = () => {
    if (!startDate) {
      setError("Date de depart obligatoire.");
      setResult(null);
      return;
    }

    const parsedStart = new Date(startDate);
    if (Number.isNaN(parsedStart.getTime())) {
      setError("Date de depart invalide.");
      setResult(null);
      return;
    }

    const parsedSuspensions: SuspensionCause[] = suspensions
      .filter((entry) => entry.startDate && entry.endDate)
      .map((entry) => ({
        type: entry.type,
        startDate: new Date(entry.startDate),
        endDate: new Date(entry.endDate),
      }))
      .filter(
        (entry) =>
          entry.startDate !== undefined &&
          entry.endDate !== undefined &&
          !Number.isNaN(entry.startDate.getTime()) &&
          !Number.isNaN(entry.endDate.getTime()),
      );

    const parsedInterruptions: InterruptionEvent[] = interruptions
      .filter((entry) => entry.date)
      .map((entry) => ({
        type: entry.type,
        date: new Date(entry.date),
      }))
      .filter((entry) => !Number.isNaN(entry.date.getTime()));

    setError("");
    setResult(
      calculatePrescription({
        claimType,
        startDate: parsedStart,
        suspensions: adjustmentsEnabled ? parsedSuspensions : [],
        interruptions: adjustmentsEnabled ? parsedInterruptions : [],
      }),
    );
  };

  return (
    <div className="space-y-4">
      <CalculatorCard
        title="Calculateur de prescription"
        subtitle="Calcule le delai, les interruptions et l'echeance procedurale selon le type de demande."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--text-dark)]">Type</span>
            <select
              value={claimCategory}
              onChange={(event) => {
                const nextCategory = event.target.value as ClaimCategory;
                setClaimCategory(nextCategory);
                setClaimType((nextCategory === "civil" ? CIVIL_CLAIMS : PENAL_CLAIMS)[0]);
              }}
              className="w-full rounded-lg border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-3 py-2 text-sm"
            >
              <option value="civil">Civil / مدني</option>
              <option value="penal">Penal / جزائي</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--text-dark)]">Nature de l'action</span>
            <select
              value={claimType}
              onChange={(event) => setClaimType(event.target.value as ClaimType)}
              className="w-full rounded-lg border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-3 py-2 text-sm"
            >
              {availableClaims.map((value) => (
                <option key={value} value={value}>
                  {CLAIM_LABELS[value].fr} / {CLAIM_LABELS[value].ar}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--text-dark)]">Date du fait generateur</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-lg border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--text-dark)]">Interruptions / Suspensions</span>
            <button
              type="button"
              onClick={() => setAdjustmentsEnabled((previous) => !previous)}
              className="inline-flex w-full items-center justify-between rounded-lg border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-3 py-2 text-left text-sm"
            >
              <span>{adjustmentsEnabled ? "Actives" : "Inactives"}</span>
              <span className="text-xs text-[var(--text-muted)]">{adjustmentsEnabled ? "ON" : "OFF"}</span>
            </button>
          </label>
        </div>

        {adjustmentsEnabled ? (
          <div className="mt-4 rounded-[12px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-main)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-dark)]">Suspensions</p>
            <button
              type="button"
              onClick={() =>
                setSuspensions((previous) => [
                  ...previous,
                  {
                    id: crypto.randomUUID(),
                    type: "force_majeure",
                    startDate: "",
                    endDate: "",
                  },
                ])
              }
              className="rounded border border-[rgba(212,160,80,0.33)] bg-[var(--bg-card)] px-2 py-1 text-xs font-semibold text-[var(--bg-dark)]"
            >
              + Ajouter
            </button>
          </div>

          <div className="space-y-2">
            {suspensions.map((entry) => (
              <div key={entry.id} className="grid gap-2 rounded-[12px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-card)] p-2 md:grid-cols-4">
                <select
                  value={entry.type}
                  onChange={(event) => {
                    const next = event.target.value as SuspensionCause["type"];
                    setSuspensions((previous) => previous.map((item) => (item.id === entry.id ? { ...item, type: next } : item)));
                  }}
                  className="rounded border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-2 py-1 text-xs"
                >
                  <option value="minority">Minorite</option>
                  <option value="criminal_proceeding">Procedure penale</option>
                  <option value="force_majeure">Force majeure</option>
                  <option value="marriage">Mariage</option>
                </select>
                <input
                  type="date"
                  value={entry.startDate}
                  onChange={(event) =>
                    setSuspensions((previous) => previous.map((item) => (item.id === entry.id ? { ...item, startDate: event.target.value } : item)))
                  }
                  className="rounded border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-2 py-1 text-xs"
                />
                <input
                  type="date"
                  value={entry.endDate}
                  onChange={(event) =>
                    setSuspensions((previous) => previous.map((item) => (item.id === entry.id ? { ...item, endDate: event.target.value } : item)))
                  }
                  className="rounded border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setSuspensions((previous) => previous.filter((item) => item.id !== entry.id))}
                  className="rounded border border-[rgba(212,160,80,0.33)] bg-[rgba(212,160,80,0.07)] px-2 py-1 text-xs font-semibold text-[var(--bg-dark)]"
                >
                  Supprimer
                </button>
              </div>
            ))}
            {suspensions.length === 0 ? <p className="text-xs text-[var(--text-muted)]">Aucune suspension ajoutee.</p> : null}
          </div>
          </div>
        ) : null}

        {adjustmentsEnabled ? (
          <div className="mt-3 rounded-[12px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-main)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-dark)]">Interruptions</p>
            <button
              type="button"
              onClick={() =>
                setInterruptions((previous) => [
                  ...previous,
                  {
                    id: crypto.randomUUID(),
                    type: "legal_citation",
                    date: "",
                  },
                ])
              }
              className="rounded border border-[rgba(212,160,80,0.33)] bg-[var(--bg-card)] px-2 py-1 text-xs font-semibold text-[var(--bg-dark)]"
            >
              + Ajouter
            </button>
          </div>

          <div className="space-y-2">
            {interruptions.map((entry) => (
              <div key={entry.id} className="grid gap-2 rounded-[12px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-card)] p-2 md:grid-cols-3">
                <select
                  value={entry.type}
                  onChange={(event) => {
                    const next = event.target.value as InterruptionEvent["type"];
                    setInterruptions((previous) => previous.map((item) => (item.id === entry.id ? { ...item, type: next } : item)));
                  }}
                  className="rounded border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-2 py-1 text-xs"
                >
                  <option value="legal_citation">Assignation / Citation</option>
                  <option value="debt_acknowledgment">Reconnaissance de dette</option>
                </select>
                <input
                  type="date"
                  value={entry.date}
                  onChange={(event) =>
                    setInterruptions((previous) => previous.map((item) => (item.id === entry.id ? { ...item, date: event.target.value } : item)))
                  }
                  className="rounded border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setInterruptions((previous) => previous.filter((item) => item.id !== entry.id))}
                  className="rounded border border-[rgba(212,160,80,0.33)] bg-[rgba(212,160,80,0.07)] px-2 py-1 text-xs font-semibold text-[var(--bg-dark)]"
                >
                  Supprimer
                </button>
              </div>
            ))}
            {interruptions.length === 0 ? <p className="text-xs text-[var(--text-muted)]">Aucune interruption ajoutee.</p> : null}
          </div>
          </div>
        ) : null}

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
              setResult(null);
              setError("");
              setClaimCategory("civil");
              setClaimType("civil_personal_general");
              setStartDate(todayString());
              setAdjustmentsEnabled(false);
              setSuspensions([]);
              setInterruptions([]);
            }}
            className="rounded-lg border border-[rgba(212,160,80,0.33)] bg-[var(--bg-card)] px-4 py-2 text-sm font-semibold text-[var(--bg-dark)] transition hover:bg-[rgba(212,160,80,0.07)]"
          >
            Reinitialiser
          </button>
        </div>

        {error ? <p className="mt-3 text-sm font-semibold text-[var(--bg-dark)]">{error}</p> : null}
      </CalculatorCard>

      {result ? (
        <CalculatorCard title="Resultat prescription" subtitle={result.articleRef}>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[12px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-card)] p-3">
              <p className="text-xs text-[var(--text-muted)]">Delai legal</p>
              <p className="text-lg font-semibold text-[var(--text-dark)]">{result.prescriptionYears} an(s)</p>
            </div>
            <div className="rounded-[12px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-card)] p-3">
              <p className="text-xs text-[var(--text-muted)]">Date d'expiration</p>
              <p className="text-lg font-semibold text-[var(--text-dark)]">{formatDate(result.expiryDate)}</p>
            </div>
            <div className="rounded-[12px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-card)] p-3">
              <p className="text-xs text-[var(--text-muted)]">Jours restants</p>
              <p className="text-lg font-semibold text-[var(--text-dark)]">{result.daysRemaining}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <StatusPill status={result.status} />
            <span className="rounded-full border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-main)] px-3 py-1 text-xs text-[var(--bg-dark)]">
              Debut effectif: {formatDate(result.adjustedStartDate)}
            </span>
          </div>

          <div className="mt-3 rounded-[12px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-card)] p-3 text-sm text-[var(--text-dark)]">
            <p>
              {formatDate(result.adjustedStartDate)} -&gt; {formatDate(result.expiryDate)}
            </p>
          </div>

          {result.suspensionNote ? (
            <p className="mt-3 rounded-[12px] border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-[rgba(212,160,80,0.07)] p-2 text-sm text-[var(--text-dark)]">{result.suspensionNote}</p>
          ) : null}
          {result.interruptionNote ? (
            <p className="mt-2 rounded-[12px] border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-[rgba(212,160,80,0.07)] p-2 text-sm text-[var(--text-dark)]">{result.interruptionNote}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/chat?q=${encodeURIComponent(explanationSeed)}`}
              className="inline-flex rounded-lg border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-[rgba(212,160,80,0.13)] px-3 py-2 text-sm font-semibold text-[var(--text-dark)] transition hover:bg-[rgba(212,160,80,0.09)]"
            >
              Explain with AI
            </Link>
            <ExportPdfButton fileName="9anouni-prescription" title="Rapport de prescription - 9anouni" lines={pdfLines} />
          </div>
        </CalculatorCard>
      ) : null}
    </div>
  );
}
