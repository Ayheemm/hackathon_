import type { ClaimType, CourtLevel, HeirType, JudgmentNature, LegalMatter, NotificationMethod } from "./types";

export const HEIR_LABELS: Record<HeirType, { fr: string; ar: string }> = {
  husband: { fr: "Epoux", ar: "الزوج" },
  wife: { fr: "Epouse", ar: "الزوجة" },
  son: { fr: "Fils", ar: "الابن" },
  daughter: { fr: "Fille", ar: "البنت" },
  father: { fr: "Pere", ar: "الأب" },
  mother: { fr: "Mere", ar: "الأم" },
  paternal_grandfather: { fr: "Grand-pere paternel", ar: "الجد لأب" },
  paternal_grandmother: { fr: "Grand-mere paternelle", ar: "الجدة لأب" },
  maternal_grandmother: { fr: "Grand-mere maternelle", ar: "الجدة لأم" },
  full_brother: { fr: "Frere germain", ar: "الأخ الشقيق" },
  full_sister: { fr: "Soeur germaine", ar: "الأخت الشقيقة" },
  paternal_half_brother: { fr: "Frere consanguin", ar: "الأخ لأب" },
  paternal_half_sister: { fr: "Soeur consanguine", ar: "الأخت لأب" },
  maternal_half_brother: { fr: "Frere uterin", ar: "الأخ لأم" },
  maternal_half_sister: { fr: "Soeur uterine", ar: "الأخت لأم" },
  sons_son: { fr: "Petit-fils (fils du fils)", ar: "ابن الابن" },
  sons_daughter: { fr: "Petite-fille (fille du fils)", ar: "بنت الابن" },
};

export const CLAIM_LABELS: Record<ClaimType, { fr: string; ar: string }> = {
  civil_tort: { fr: "Responsabilite delictuelle", ar: "المسؤولية التقصيرية" },
  civil_contract: { fr: "Action contractuelle", ar: "دعوى عقدية" },
  contract_nullity: { fr: "Nullite de contrat", ar: "بطلان العقد" },
  unpaid_wages: { fr: "Salaires impayes", ar: "أجور غير مدفوعة" },
  cnss: { fr: "Cotisations CNSS", ar: "مساهمات الصندوق الاجتماعي" },
  penal_contravention: { fr: "Infraction contraventionnelle", ar: "مخالفة" },
  penal_delit: { fr: "Infraction delictuelle", ar: "جنحة" },
  penal_crime: { fr: "Crime", ar: "جناية" },
  real_estate: { fr: "Droit immobilier", ar: "حق عقاري" },
  loan_repayment: { fr: "Remboursement de pret", ar: "استرجاع دين" },
  hidden_defects: { fr: "Vices caches", ar: "العيوب الخفية" },
  debt_acknowledgment: { fr: "Reconnaissance de dette", ar: "إقرار بالدين" },
  divorce_maintenance: { fr: "Pension apres divorce", ar: "نفقة بعد الطلاق" },
  filiation: { fr: "Filiation", ar: "النسب" },
};

export const COURT_LABELS: Record<CourtLevel, { fr: string; ar: string }> = {
  cantonal: { fr: "Tribunal cantonal", ar: "المحكمة الناحية" },
  first_instance: { fr: "Tribunal de premiere instance", ar: "المحكمة الابتدائية" },
  correctionnel: { fr: "Chambre correctionnelle", ar: "الدائرة الجناحية" },
  cour_appel_civil: { fr: "Cour d'appel (civil)", ar: "محكمة الاستئناف (مدني)" },
  cour_appel_penal: { fr: "Cour d'appel (penal)", ar: "محكمة الاستئناف (جزائي)" },
  cour_criminelle: { fr: "Chambre criminelle", ar: "الدائرة الجنائية" },
};

export const MATTER_LABELS: Record<LegalMatter, { fr: string; ar: string }> = {
  civil: { fr: "Civil", ar: "مدني" },
  penal: { fr: "Penal", ar: "جزائي" },
  commercial: { fr: "Commercial", ar: "تجاري" },
  administratif: { fr: "Administratif", ar: "إداري" },
};

export const JUDGMENT_NATURE_LABELS: Record<JudgmentNature, { fr: string; ar: string }> = {
  contradictoire: { fr: "Contradictoire", ar: "حضوري" },
  par_defaut: { fr: "Par defaut", ar: "غيابي" },
  sur_opposition: { fr: "Sur opposition", ar: "بعد الاعتراض" },
};

export const NOTIFICATION_LABELS: Record<NotificationMethod, { fr: string; ar: string }> = {
  direct_party: { fr: "Signification a la partie", ar: "تبليغ للطرف" },
  to_lawyer: { fr: "Signification a l'avocat", ar: "تبليغ للمحامي" },
  public_pronouncement: { fr: "Prononce public", ar: "النطق العلني" },
  not_yet: { fr: "Pas encore notifie", ar: "لم يقع التبليغ" },
};
