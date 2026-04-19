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
  civil_personal_general: { fr: "Action personnelle générale", ar: "دعوى شخصية عامة" },
  civil_liability: { fr: "Action en responsabilité civile", ar: "دعوى المسؤولية المدنية" },
  civil_commercial: { fr: "Action commerciale", ar: "دعوى تجارية" },
  civil_rent_payment: { fr: "Action en paiement de loyer", ar: "دعوى خلاص معلوم الكراء" },
  civil_contract_nullity: { fr: "Action en nullité de contrat", ar: "دعوى بطلان العقد" },
  civil_alimony: { fr: "Créances alimentaires", ar: "ديون النفقة" },
  penal_contravention: { fr: "Infraction contraventionnelle", ar: "مخالفة" },
  penal_delit: { fr: "Infraction delictuelle", ar: "جنحة" },
  penal_crime: { fr: "Crime", ar: "جناية" },
};

export const COURT_LABELS: Record<CourtLevel, { fr: string; ar: string }> = {
  first_instance: { fr: "Tribunal de premiere instance", ar: "المحكمة الابتدائية" },
  cour_appel: { fr: "Cour d'appel", ar: "محكمة الاستئناف" },
  cour_cassation: { fr: "Cour de cassation", ar: "محكمة التعقيب" },
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
  avant_dire_droit: { fr: "Avant dire droit", ar: "قبل الفصل في الأصل" },
};

export const NOTIFICATION_LABELS: Record<NotificationMethod, { fr: string; ar: string }> = {
  direct_party: { fr: "Signification a la partie", ar: "تبليغ للطرف" },
  parquet: { fr: "Signification a parquet", ar: "تبليغ للنيابة" },
  greffe: { fr: "Depot au greffe", ar: "إيداع بالكتابة" },
};
