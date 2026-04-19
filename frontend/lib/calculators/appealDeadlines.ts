import type { AppealInput, AppealRemedy, AppealResult, CourtLevel, NotificationMethod } from "./types";
import { addDaysExclusive, daysBetween } from "./tunisianHolidays";

type RemedyTemplate = {
  name: string;
  nameAr: string;
  deadlineDays: number;
  articleRef: string;
};

const APPEAL_BY_COURT: Partial<Record<CourtLevel, RemedyTemplate>> = {
  cantonal: {
    name: "Appel",
    nameAr: "الاستئناف",
    deadlineDays: 20,
    articleRef: "CPC Art. 141",
  },
  first_instance: {
    name: "Appel",
    nameAr: "الاستئناف",
    deadlineDays: 30,
    articleRef: "CPC Art. 141",
  },
  correctionnel: {
    name: "Appel",
    nameAr: "الاستئناف",
    deadlineDays: 10,
    articleRef: "CPP Art. 213",
  },
};

const CASSATION_BY_COURT: Partial<Record<CourtLevel, RemedyTemplate>> = {
  cour_appel_civil: {
    name: "Pourvoi en cassation",
    nameAr: "الطعن بالتعقيب",
    deadlineDays: 60,
    articleRef: "CPC Art. 354",
  },
  cour_appel_penal: {
    name: "Pourvoi en cassation",
    nameAr: "الطعن بالتعقيب",
    deadlineDays: 30,
    articleRef: "CPP Art. 260",
  },
  cour_criminelle: {
    name: "Pourvoi en cassation",
    nameAr: "الطعن بالتعقيب",
    deadlineDays: 10,
    articleRef: "CPP Art. 260",
  },
};

const OPPOSITION_TEMPLATE: RemedyTemplate = {
  name: "Opposition",
  nameAr: "الاعتراض",
  deadlineDays: 10,
  articleRef: "CPC Art. 175 / CPP Art. 186",
};

function cloneDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function resolveStartDate(
  judgmentDate: Date,
  notificationMethod: NotificationMethod,
  notificationDate?: Date,
): Date | undefined {
  if (notificationMethod === "not_yet") {
    return undefined;
  }
  if (notificationDate) {
    return cloneDate(notificationDate);
  }
  return cloneDate(judgmentDate);
}

function statusForDeadline(deadline: Date): { status: AppealRemedy["status"]; daysRemaining: number } {
  const today = cloneDate(new Date());
  const daysRemaining = daysBetween(today, deadline);
  if (daysRemaining < 0) {
    return { status: "expired", daysRemaining };
  }
  if (daysRemaining <= 10) {
    return { status: "warning", daysRemaining };
  }
  return { status: "active", daysRemaining };
}

function buildUnavailable(template: RemedyTemplate, reason: string): AppealRemedy {
  return {
    name: template.name,
    nameAr: template.nameAr,
    available: false,
    deadlineDays: template.deadlineDays,
    articleRef: template.articleRef,
    unavailableReason: reason,
  };
}

function buildAvailable(template: RemedyTemplate, startDate: Date): AppealRemedy {
  const deadline = addDaysExclusive(startDate, template.deadlineDays);
  const { status, daysRemaining } = statusForDeadline(deadline);
  return {
    name: template.name,
    nameAr: template.nameAr,
    available: true,
    deadline,
    deadlineDays: template.deadlineDays,
    articleRef: template.articleRef,
    status,
    daysRemaining,
  };
}

export function calculateAppealDeadlines(input: AppealInput): AppealResult {
  const judgmentDate = cloneDate(input.judgmentDate);
  const startDate = resolveStartDate(judgmentDate, input.notificationMethod, input.notificationDate);

  const remedies: AppealRemedy[] = [];

  const appealTemplate = APPEAL_BY_COURT[input.courtLevel];
  if (appealTemplate) {
    if (!startDate) {
      remedies.push(buildUnavailable(appealTemplate, "Notification requise pour declencher le delai."));
    } else {
      remedies.push(buildAvailable(appealTemplate, startDate));
    }
  }

  if (input.judgmentNature === "par_defaut") {
    if (!startDate) {
      remedies.push(buildUnavailable(OPPOSITION_TEMPLATE, "Notification requise pour opposition."));
    } else {
      remedies.push(buildAvailable(OPPOSITION_TEMPLATE, startDate));
    }
  }

  const cassationTemplate = CASSATION_BY_COURT[input.courtLevel];
  if (cassationTemplate) {
    if (!startDate) {
      remedies.push(buildUnavailable(cassationTemplate, "Notification requise pour declencher le delai."));
    } else {
      remedies.push(buildAvailable(cassationTemplate, startDate));
    }
  }

  if (remedies.length === 0) {
    remedies.push({
      name: "Aucun recours standard",
      nameAr: "لا يوجد طعن معياري",
      available: false,
      deadlineDays: 0,
      articleRef: "Verification manuelle requise",
      unavailableReason: "Verifier la voie procedurale specifique a la matiere.",
    });
  }

  const timelinePoints: AppealResult["timelinePoints"] = [
    {
      date: judgmentDate,
      label: "Date du jugement",
      type: "start",
    },
  ];

  if (startDate) {
    timelinePoints.push({
      date: startDate,
      label: "Point de depart des delais",
      type: "info",
    });
  }

  for (const remedy of remedies) {
    if (remedy.available && remedy.deadline) {
      timelinePoints.push({
        date: remedy.deadline,
        label: `${remedy.name} (${remedy.deadlineDays} j)`,
        type: "deadline",
      });
    }
  }

  timelinePoints.sort((a, b) => a.date.getTime() - b.date.getTime());

  const activeDeadlines = remedies
    .filter((remedy) => remedy.available && remedy.daysRemaining !== undefined && remedy.daysRemaining >= 0)
    .sort((a, b) => (a.daysRemaining as number) - (b.daysRemaining as number));

  return {
    remedies,
    timelinePoints,
    nextUrgentDeadline: activeDeadlines[0],
  };
}
