"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import CalculatorCard from "./CalculatorCard";
import ExportPdfButton from "./ExportPdfButton";
import { HEIR_LABELS } from "../../lib/calculators/labels";
import { calculateInheritance } from "../../lib/calculators/inheritance";
import type { Gender, HeirType, InheritanceResult } from "../../lib/calculators/types";

const HEIR_ORDER: HeirType[] = [
  "husband",
  "wife",
  "father",
  "mother",
  "son",
  "daughter",
  "sons_son",
  "sons_daughter",
  "full_brother",
  "full_sister",
  "paternal_half_brother",
  "paternal_half_sister",
  "maternal_half_brother",
  "maternal_half_sister",
  "paternal_grandfather",
  "paternal_grandmother",
  "maternal_grandmother",
];

const PIE_COLORS = [
  "#8f5c2a",
  "#a56b32",
  "#bc7a2f",
  "#d49f52",
  "#6a4b2f",
  "#9e6c43",
  "#7f5a36",
  "#b88b5b",
  "#4f3a24",
];

function formatCurrency(value?: number): string {
  if (value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return `${new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 3 }).format(value)} TND`;
}

function buildInitialCounts(): Record<HeirType, number> {
  return HEIR_ORDER.reduce(
    (acc, type) => {
      acc[type] = 0;
      return acc;
    },
    {} as Record<HeirType, number>,
  );
}

function toPercent(numerator: number, denominator: number): number {
  if (!denominator) {
    return 0;
  }
  return (numerator / denominator) * 100;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export default function InheritanceCalculator() {
  const [deceasedGender, setDeceasedGender] = useState<Gender>("male");
  const [estateValue, setEstateValue] = useState("");
  const [heirCounts, setHeirCounts] = useState<Record<HeirType, number>>(buildInitialCounts);
  const [result, setResult] = useState<InheritanceResult | null>(null);
  const [error, setError] = useState("");

  const totalHeirs = useMemo(
    () => Object.values(heirCounts).reduce((sum, count) => sum + count, 0),
    [heirCounts],
  );

  const nonBlockedRows = useMemo(
    () => (result ? result.heirs.filter((row) => row.shareType !== "blocked") : []),
    [result],
  );

  const totalPercent = useMemo(
    () => nonBlockedRows.reduce((sum, row) => sum + toPercent(row.shareNumerator, row.shareDenominator), 0),
    [nonBlockedRows],
  );

  const pieSegments = useMemo(() => {
    if (!result || nonBlockedRows.length === 0) {
      return [] as Array<{ color: string; dash: number; offset: number; label: string }>;
    }

    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    let cumulative = 0;

    return nonBlockedRows.map((row, index) => {
      const ratio = row.shareNumerator / row.shareDenominator;
      const dash = Math.max(0, ratio * circumference);
      const segment = {
        color: PIE_COLORS[index % PIE_COLORS.length],
        dash,
        offset: cumulative,
        label: HEIR_LABELS[row.heir.type].fr,
      };
      cumulative += dash;
      return segment;
    });
  }, [nonBlockedRows, result]);

  const explanationSeed = useMemo(() => {
    if (!result) {
      return "";
    }
    const summary = result.heirs
      .filter((item) => item.shareType !== "blocked")
      .slice(0, 5)
      .map((item) => {
        const label = HEIR_LABELS[item.heir.type].fr;
        return `${label}: ${item.shareNumerator}/${item.shareDenominator}`;
      })
      .join("; ");
    return `Explique ce resultat de succession tunisienne (${result.totalVerification}): ${summary}`;
  }, [result]);

  const pdfLines = useMemo(() => {
    if (!result) {
      return [];
    }

    const lines: string[] = [
      `Verification: ${result.totalVerification}`,
      `Awl applique: ${result.awlApplied ? "Oui" : "Non"}`,
      `Radd applique: ${result.raddApplied ? "Oui" : "Non"}`,
      "",
      "Details des heritiers:",
    ];

    for (const row of result.heirs) {
      const label = HEIR_LABELS[row.heir.type].fr;
      const share = `${row.shareNumerator}/${row.shareDenominator}`;
      const amount = row.amountTND !== undefined ? ` - ${formatCurrency(row.amountTND)}` : "";
      lines.push(`${label} x${row.heir.count}: ${share} (${row.shareType})${amount}`);
    }

    if (result.hajbNotes.length > 0) {
      lines.push("", "Notes Hajb:");
      for (const note of result.hajbNotes) {
        lines.push(`- ${note}`);
      }
    }

    return lines;
  }, [result]);

  const handleCalculate = () => {
    if (totalHeirs === 0) {
      setError("Ajoutez au moins un heritier.");
      setResult(null);
      return;
    }

    const inputEstate = estateValue.trim() ? Number(estateValue) : undefined;
    if (inputEstate !== undefined && (!Number.isFinite(inputEstate) || inputEstate <= 0)) {
      setError("Valeur de succession invalide.");
      setResult(null);
      return;
    }

    setError("");
    const input = {
      deceasedGender,
      estateValue: inputEstate,
      heirs: HEIR_ORDER.map((type) => ({
        type,
        count: heirCounts[type],
      })),
    };
    setResult(calculateInheritance(input));
  };

  return (
    <div className="space-y-4">
      <CalculatorCard
        title="Mirath Calculator"
        subtitle="Calcul des parts héréditaires selon le droit musulman tunisien."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--text-dark)]">Sexe du defunt</span>
            <select
              value={deceasedGender}
              onChange={(event) => setDeceasedGender(event.target.value as Gender)}
              className="w-full rounded-lg border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-3 py-2 text-sm"
            >
              <option value="male">Male / ذكر</option>
              <option value="female">Femelle / أنثى</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--text-dark)]">Masse successorale (TND) - optionnel</span>
            <input
              type="number"
              min={0}
              step="0.001"
              value={estateValue}
              onChange={(event) => setEstateValue(event.target.value)}
              className="w-full rounded-lg border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-3 py-2 text-sm"
              placeholder="Ex: 125000"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {HEIR_ORDER.map((type) => {
            const labels = HEIR_LABELS[type];
            return (
              <label key={type} className="rounded-lg border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-main)] p-2">
                <div className="text-xs font-medium text-[var(--text-dark)]">{labels.fr}</div>
                <div className="font-ar text-xs text-[var(--bg-mid)]">{labels.ar}</div>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={heirCounts[type]}
                  onChange={(event) => {
                    const next = Math.max(0, Math.min(20, Number(event.target.value) || 0));
                    setHeirCounts((previous) => ({
                      ...previous,
                      [type]: next,
                    }));
                  }}
                  className="mt-1 w-full rounded border border-[rgba(212,160,80,0.27)] bg-[var(--bg-card)] px-2 py-1 text-sm"
                />
              </label>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
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
              setEstateValue("");
              setHeirCounts(buildInitialCounts());
            }}
            className="rounded-lg border border-[rgba(212,160,80,0.33)] bg-[var(--bg-card)] px-4 py-2 text-sm font-semibold text-[var(--bg-dark)] transition hover:bg-[rgba(212,160,80,0.07)]"
          >
            Reinitialiser
          </button>
          <p className="text-xs text-[var(--text-muted)]">Heritiers saisis: {totalHeirs}</p>
        </div>

        {error ? <p className="mt-3 text-sm font-medium text-[var(--bg-dark)]">{error}</p> : null}
      </CalculatorCard>

      {result ? (
        <CalculatorCard title="Resultat" subtitle={`Verification totale: ${result.totalVerification}`}>
          {(result.awlApplied || result.raddApplied) ? (
            <div className="mb-4 rounded-[12px] border border-[0.5px] border-[rgba(166,90,0,0.34)] bg-[rgba(166,90,0,0.12)] p-3 text-sm text-[var(--text-dark)]">
              {result.awlApplied ? "Attention: cas d'Awl applique (reduction proportionnelle des parts). " : ""}
              {result.raddApplied ? "Attention: cas de Radd applique (redistribution du reliquat)." : ""}
            </div>
          ) : null}

          {pieSegments.length > 0 ? (
            <div className="mb-4 rounded-[12px] border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-card)] p-3">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="mx-auto w-[180px] shrink-0">
                  <svg viewBox="0 0 120 120" role="img" aria-label="Répartition des parts">
                    <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(212,160,80,0.2)" strokeWidth="18" />
                    {pieSegments.map((segment, index) => (
                      <circle
                        key={`${segment.label}-${index}`}
                        cx="60"
                        cy="60"
                        r="42"
                        fill="none"
                        stroke={segment.color}
                        strokeWidth="18"
                        strokeLinecap="butt"
                        strokeDasharray={`${segment.dash} 264`}
                        strokeDashoffset={-segment.offset}
                        transform="rotate(-90 60 60)"
                      />
                    ))}
                    <text x="60" y="56" textAnchor="middle" className="fill-[var(--text-dark)] text-[10px] font-semibold">
                      Total
                    </text>
                    <text x="60" y="70" textAnchor="middle" className="fill-[var(--text-dark)] text-[12px] font-bold">
                      {formatPercent(totalPercent)}
                    </text>
                  </svg>
                </div>

                <div className="grid flex-1 gap-1 sm:grid-cols-2">
                  {pieSegments.map((segment, index) => (
                    <div key={`${segment.label}-legend-${index}`} className="flex items-center gap-2 text-xs text-[var(--text-dark)]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true" />
                      <span className="truncate">{segment.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-1 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="px-2 py-1">Heritier</th>
                  <th className="px-2 py-1">Part (fraction)</th>
                  <th className="px-2 py-1">%</th>
                  <th className="px-2 py-1">Montant (TND)</th>
                </tr>
              </thead>
              <tbody>
                {result.heirs.map((row, index) => {
                  const labels = HEIR_LABELS[row.heir.type];
                  const percent = row.shareType === "blocked" ? 0 : toPercent(row.shareNumerator, row.shareDenominator);
                  return (
                    <tr key={`${row.heir.type}-${index}`} className="rounded-lg border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-card)]">
                      <td className="px-2 py-2">
                        <div className="font-medium text-[var(--text-dark)]">{labels.fr}</div>
                        <div className="font-ar text-xs text-[var(--bg-mid)]">{labels.ar}</div>
                        <div className="text-xs text-[var(--text-muted)]">x{row.heir.count}</div>
                      </td>
                      <td className="px-2 py-2 font-mono-legal">
                        {row.shareType === "blocked" ? "0/1" : `${row.shareNumerator}/${row.shareDenominator}`}
                      </td>
                      <td className="px-2 py-2">{formatPercent(percent)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.amountTND)}</td>
                    </tr>
                  );
                })}

                <tr className="rounded-lg border border-[0.5px] border-[var(--border-gold)] bg-[rgba(212,160,80,0.08)] font-semibold text-[var(--text-dark)]">
                  <td className="px-2 py-2">Total</td>
                  <td className="px-2 py-2 font-mono-legal">{result.totalVerification}</td>
                  <td className="px-2 py-2">{formatPercent(totalPercent)}</td>
                  <td className="px-2 py-2">{formatCurrency(result.heirs.reduce((sum, row) => sum + (row.amountTND ?? 0), 0) || undefined)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {result.hajbNotes.length > 0 ? (
            <div className="mt-4 rounded-[12px] border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-[rgba(212,160,80,0.07)] p-3 text-sm text-[var(--text-dark)]">
              <p className="mb-1 font-semibold">Notes Hajb</p>
              <ul className="space-y-1 text-sm">
                {result.hajbNotes.map((note, index) => (
                  <li key={`${note}-${index}`}>- {note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-main)] px-3 py-1 text-xs text-[var(--bg-dark)]">
              Awl: {result.awlApplied ? "Oui" : "Non"}
            </span>
            <span className="rounded-full border border-[0.5px] border-[var(--border-gold)] bg-[var(--bg-main)] px-3 py-1 text-xs text-[var(--bg-dark)]">
              Radd: {result.raddApplied ? "Oui" : "Non"}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/chat?q=${encodeURIComponent(explanationSeed)}`}
              className="inline-flex rounded-lg border border-[0.5px] border-[rgba(212,160,80,0.27)] bg-[rgba(212,160,80,0.13)] px-3 py-2 text-sm font-semibold text-[var(--text-dark)] transition hover:bg-[rgba(212,160,80,0.09)]"
            >
              Explain with AI
            </Link>
            <ExportPdfButton fileName="9anouni-succession" title="Rapport de succession - 9anouni" lines={pdfLines} />
          </div>
        </CalculatorCard>
      ) : null}
    </div>
  );
}
