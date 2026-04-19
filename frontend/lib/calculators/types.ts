// Inheritance
export type Gender = "male" | "female";

export type HeirType =
  | "husband"
  | "wife"
  | "son"
  | "daughter"
  | "father"
  | "mother"
  | "paternal_grandfather"
  | "paternal_grandmother"
  | "maternal_grandmother"
  | "full_brother"
  | "full_sister"
  | "paternal_half_brother"
  | "paternal_half_sister"
  | "maternal_half_brother"
  | "maternal_half_sister"
  | "sons_son"
  | "sons_daughter";

export type Heir = {
  type: HeirType;
  count: number;
  gender?: Gender;
};

export type InheritanceInput = {
  deceasedGender: Gender;
  heirs: Heir[];
  estateValue?: number;
};

export type HeirResult = {
  heir: Heir;
  shareNumerator: number;
  shareDenominator: number;
  shareType: "fard" | "asaba" | "blocked";
  articleRef: string;
  amountTND?: number;
  blockedBy?: HeirType;
};

export type InheritanceResult = {
  heirs: HeirResult[];
  awlApplied: boolean;
  raddApplied: boolean;
  hajbNotes: string[];
  totalVerification: string;
};

// Prescription
export type ClaimType =
  | "civil_personal_general"
  | "civil_liability"
  | "civil_commercial"
  | "civil_rent_payment"
  | "civil_contract_nullity"
  | "civil_alimony"
  | "penal_contravention"
  | "penal_delit"
  | "penal_crime";

export type SuspensionCause = {
  type: "minority" | "criminal_proceeding" | "force_majeure" | "marriage";
  startDate?: Date;
  endDate?: Date;
};

export type InterruptionEvent = {
  type: "legal_citation" | "debt_acknowledgment";
  date: Date;
};

export type PrescriptionInput = {
  claimType: ClaimType;
  startDate: Date;
  suspensions: SuspensionCause[];
  interruptions: InterruptionEvent[];
};

export type PrescriptionResult = {
  claimType: ClaimType;
  prescriptionYears: number;
  articleRef: string;
  startDate: Date;
  adjustedStartDate: Date;
  expiryDate: Date;
  status: "active" | "warning" | "expired";
  daysRemaining: number;
  suspensionNote?: string;
  interruptionNote?: string;
};

// Appeal deadlines
export type CourtLevel =
  | "first_instance"
  | "cour_appel"
  | "cour_cassation";

export type LegalMatter = "civil" | "penal" | "commercial" | "administratif";
export type JudgmentNature = "contradictoire" | "par_defaut" | "avant_dire_droit";
export type NotificationMethod = "direct_party" | "parquet" | "greffe";

export type AppealInput = {
  courtLevel: CourtLevel;
  matter: LegalMatter;
  judgmentNature: JudgmentNature;
  judgmentDate: Date;
  notificationMethod: NotificationMethod;
  notificationDate?: Date;
};

export type AppealRemedy = {
  name: string;
  nameAr: string;
  available: boolean;
  deadline?: Date;
  deadlineDays: number;
  articleRef: string;
  status?: "active" | "warning" | "expired";
  daysRemaining?: number;
  unavailableReason?: string;
};

export type TimelinePoint = {
  date: Date;
  label: string;
  type: "start" | "deadline" | "info";
};

export type AppealResult = {
  remedies: AppealRemedy[];
  timelinePoints: TimelinePoint[];
  nextUrgentDeadline?: AppealRemedy;
};
