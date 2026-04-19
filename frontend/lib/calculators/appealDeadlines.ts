import type { AppealInput, AppealRemedy, AppealResult, NotificationMethod } from "./types";
import { adjustToNextWorkingDay, daysBetween } from "./tunisianHolidays";

type RemedyTemplate = {
  name: string;
  nameAr: string;
  articleRef: string;
  days?: number;
  months?: number;
};

const APPEL_CIVIL_TEMPLATE: RemedyTemplate = {
  name: "Appel",
  nameAr: "الاستئناف",
  articleRef: "CPC - Recours en appel",
  days: 30,
};

const OPPOSITION_TEMPLATE: RemedyTemplate = {
  name: "Opposition",
  nameAr: "الاعتراض",
  articleRef: "CPC - Jugement par défaut",
  days: 15,
};

const APPEL_PENAL_TEMPLATE: RemedyTemplate = {
  name: "Appel",
  nameAr: "الاستئناف",
  articleRef: "CPP - Voie d'appel pénale",
  days: 10,
};

const APPEL_ADMIN_TEMPLATE: RemedyTemplate = {
  name: "Appel",
  nameAr: "الاستئناف",
  articleRef: "Contentieux administratif",
  months: 2,
};

const CASSATION_CIVIL_TEMPLATE: RemedyTemplate = {
  name: "Pourvoi en cassation",
  nameAr: "الطعن بالتعقيب",
  articleRef: "CPC - Cassation civile",
  days: 60,
};

const CASSATION_PENAL_TEMPLATE: RemedyTemplate = {
  name: "Pourvoi en cassation",
  nameAr: "الطعن بالتعقيب",
  articleRef: "CPP - Cassation pénale",
  days: 10,
};

function cloneDate(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number): Date {
  const next = cloneDate(value);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(value: Date, months: number): Date {
  const next = cloneDate(value);
  next.setMonth(next.getMonth() + months);
  return next;
}

function applyStartRule(baseDate: Date, notificationMethod: NotificationMethod): Date {
  if (notificationMethod === "direct_party") {
    return addDays(baseDate, 1);
  }
  return cloneDate(baseDate);
}

function notificationModifierDays(notificationMethod: NotificationMethod): number {
  if (notificationMethod === "parquet") {
    return 10;
  }

  if (notificationMethod === "greffe") {
    return 3;
  }

  return 0;
}

function statusForDeadline(deadline: Date): { status: AppealRemedy["status"]; daysRemaining: number } {
  const today = cloneDate(new Date());
  const daysRemaining = daysBetween(today, deadline);

  if (daysRemaining < 0) {
    return { status: "expired", daysRemaining };
  }

  if (daysRemaining <= 15) {
    return { status: "warning", daysRemaining };
  }

  return { status: "active", daysRemaining };
}

function buildAvailableRemedy(
  template: RemedyTemplate,
  startDate: Date,
  notificationMethod: NotificationMethod,
  options?: { extraDays?: number },
): AppealRemedy {
  const extraDays = options?.extraDays ?? 0;
  const modifierDays = notificationModifierDays(notificationMethod) + extraDays;
  const dayDelta = (template.days ?? (template.months ?? 0) * 30) + modifierDays;

  const rawDeadline = template.months
    ? addDays(addMonths(startDate, template.months), modifierDays)
    : addDays(startDate, dayDelta);
  const adjustedDeadline = adjustToNextWorkingDay(rawDeadline);
  const { status, daysRemaining } = statusForDeadline(adjustedDeadline);

  return {
    name: template.name,
    nameAr: template.nameAr,
    available: true,
    deadline: adjustedDeadline,
    deadlineDays: dayDelta,
    articleRef: template.articleRef,
    status,
    daysRemaining,
  };
}

function buildUnavailable(name: string, nameAr: string, reason: string): AppealRemedy {
  return {
    name,
    nameAr,
    available: false,
    deadlineDays: 0,
    articleRef: "Vérification manuelle",
    unavailableReason: reason,
  };
}

export function calculateAppealDeadlines(input: AppealInput): AppealResult {
  const judgmentDate = cloneDate(input.judgmentDate);
  const notificationDate = input.notificationDate ? cloneDate(input.notificationDate) : judgmentDate;

  const remedies: AppealRemedy[] = [];

  if (input.courtLevel === "first_instance") {
    if (input.matter === "penal") {
      remedies.push(buildAvailableRemedy(APPEL_PENAL_TEMPLATE, judgmentDate, input.notificationMethod));
    } else if (input.matter === "administratif") {
      const start = applyStartRule(notificationDate, input.notificationMethod);
      remedies.push(buildAvailableRemedy(APPEL_ADMIN_TEMPLATE, start, input.notificationMethod));
    } else if (input.matter === "civil" || input.matter === "commercial") {
      const start = applyStartRule(notificationDate, input.notificationMethod);

      if (input.judgmentNature === "par_defaut") {
        const opposition = buildAvailableRemedy(OPPOSITION_TEMPLATE, start, input.notificationMethod);
        remedies.push(opposition);
        remedies.push(buildAvailableRemedy(APPEL_CIVIL_TEMPLATE, start, input.notificationMethod, { extraDays: 15 }));
      } else {
        remedies.push(buildAvailableRemedy(APPEL_CIVIL_TEMPLATE, start, input.notificationMethod));
      }
    }
  }

  if (input.courtLevel === "cour_appel") {
    if (input.matter === "civil" || input.matter === "commercial") {
      const start = applyStartRule(notificationDate, input.notificationMethod);
      remedies.push(buildAvailableRemedy(CASSATION_CIVIL_TEMPLATE, start, input.notificationMethod));
    } else if (input.matter === "penal") {
      remedies.push(buildAvailableRemedy(CASSATION_PENAL_TEMPLATE, judgmentDate, input.notificationMethod));
    } else {
      remedies.push(
        buildUnavailable(
          "Pourvoi en cassation",
          "الطعن بالتعقيب",
          "Matière non prévue dans ce simulateur pour la cassation.",
        ),
      );
    }
  }

  if (input.courtLevel === "cour_cassation") {
    remedies.push(
      buildUnavailable(
        "Recours ordinaire",
        "طعن عادي",
        "Aucune voie de recours ordinaire supplémentaire depuis la Cour de cassation.",
      ),
    );
  }

  if (remedies.length === 0) {
    remedies.push(
      buildUnavailable(
        "Aucun recours standard",
        "لا يوجد طعن معياري",
        "Vérifiez la combinaison juridiction/matière/nature du jugement.",
      ),
    );
  }

  const timelinePoints: AppealResult["timelinePoints"] = [
    {
      date: judgmentDate,
      label: "Date du jugement",
      type: "start",
    },
    {
      date: notificationDate,
      label: "Date de notification",
      type: "info",
    },
  ];

  for (const remedy of remedies) {
    if (remedy.available && remedy.deadline) {
      timelinePoints.push({
        date: remedy.deadline,
        label: `${remedy.name} (${remedy.deadlineDays} j)`,
        type: "deadline",
      });
    }
  }

  timelinePoints.sort((first, second) => first.date.getTime() - second.date.getTime());

  const nextUrgentDeadline = remedies
    .filter((item) => item.available && typeof item.daysRemaining === "number" && item.daysRemaining >= 0)
    .sort((first, second) => (first.daysRemaining as number) - (second.daysRemaining as number))[0];

  return {
    remedies,
    timelinePoints,
    nextUrgentDeadline,
  };
}
