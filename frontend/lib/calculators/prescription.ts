import type {
  ClaimType,
  InterruptionEvent,
  PrescriptionInput,
  PrescriptionResult,
  SuspensionCause,
} from "./types";
import { adjustToNextWorkingDay, daysBetween } from "./tunisianHolidays";

type PrescriptionRule = {
  years: number;
  articleRef: string;
};

const RULES: Record<ClaimType, PrescriptionRule> = {
  civil_personal_general: { years: 10, articleRef: "COC - Action personnelle générale" },
  civil_liability: { years: 3, articleRef: "COC - Responsabilité civile" },
  civil_commercial: { years: 5, articleRef: "Code de commerce - Action commerciale" },
  civil_rent_payment: { years: 3, articleRef: "COC - Paiement de loyer" },
  civil_contract_nullity: { years: 5, articleRef: "COC - Nullité du contrat" },
  civil_alimony: { years: 1, articleRef: "CSP - Créances alimentaires" },
  penal_contravention: { years: 1, articleRef: "CPP Art. 5" },
  penal_delit: { years: 3, articleRef: "CPP Art. 5" },
  penal_crime: { years: 10, articleRef: "CPP Art. 5" },
};

function cloneDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addYears(base: Date, years: number): Date {
  const copy = cloneDate(base);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

function calculateSuspensionDays(fromDate: Date, expiryBeforeSuspension: Date, suspensions: SuspensionCause[]): number {
  let suspendedDays = 0;

  for (const suspension of suspensions) {
    const start = suspension.startDate ? cloneDate(suspension.startDate) : undefined;
    const end = suspension.endDate ? cloneDate(suspension.endDate) : undefined;

    if (!start || !end || end <= start) {
      continue;
    }

    const overlapStart = start > fromDate ? start : fromDate;
    const overlapEnd = end < expiryBeforeSuspension ? end : expiryBeforeSuspension;
    if (overlapEnd > overlapStart) {
      suspendedDays += daysBetween(overlapStart, overlapEnd);
    }
  }

  return Math.max(0, suspendedDays);
}

function latestInterruptionDate(startDate: Date, interruptions: InterruptionEvent[]): Date {
  const valid = interruptions
    .map((event) => cloneDate(event.date))
    .filter((eventDate) => eventDate >= startDate)
    .sort((a, b) => a.getTime() - b.getTime());
  return valid.length > 0 ? valid[valid.length - 1] : startDate;
}

export function calculatePrescription(input: PrescriptionInput): PrescriptionResult {
  const rule = RULES[input.claimType];
  const today = cloneDate(new Date());
  const originalStart = cloneDate(input.startDate);

  const adjustedStartDate = latestInterruptionDate(originalStart, input.interruptions);
  const baseExpiry = addYears(adjustedStartDate, rule.years);
  const suspensionDays = calculateSuspensionDays(adjustedStartDate, baseExpiry, input.suspensions);

  const expiryRaw = cloneDate(baseExpiry);
  expiryRaw.setDate(expiryRaw.getDate() + suspensionDays);
  const expiryDate = adjustToNextWorkingDay(expiryRaw);

  const daysRemaining = daysBetween(today, expiryDate);
  const status: PrescriptionResult["status"] = daysRemaining < 0 ? "expired" : daysRemaining <= 90 ? "warning" : "active";

  const suspensionNote =
    suspensionDays > 0
      ? `Delai prolonge de ${suspensionDays} jour(s) pour suspension(s).`
      : undefined;

  const interruptionCount = input.interruptions.filter((e) => cloneDate(e.date) >= originalStart).length;
  const interruptionNote =
    interruptionCount > 0
      ? `Point de depart reinitialise par ${interruptionCount} interruption(s).`
      : undefined;

  return {
    claimType: input.claimType,
    prescriptionYears: rule.years,
    articleRef: rule.articleRef,
    startDate: originalStart,
    adjustedStartDate,
    expiryDate,
    status,
    daysRemaining,
    suspensionNote,
    interruptionNote,
  };
}
