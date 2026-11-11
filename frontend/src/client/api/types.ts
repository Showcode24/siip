// Response shapes of the backend's /api/v1 endpoints (see backend/src/server/services).
// Enums come from the shared Prisma enums; request bodies use the shared Zod schemas.
import type {
  ApplicationStatus,
  AssessmentType,
  AttemptStatus,
  Availability,
  CheckInAuthor,
  CohortStatus,
  CompanyMemberRole,
  CompanyVerificationStatus,
  DegreeClass,
  InternType,
  ProfileReviewStatus,
  SkillDocumentKind,
  SkillStatus,
  MatchStatus,
  NyscStatus,
  OpeningStatus,
  PlacementStatus,
  ProfileVisibility,
  QuestionType,
  SkillLevel,
  UserRole,
  WorkMode,
  WorkSchedule,
} from "@siip/shared/enums";

export type ISODate = string;

export interface Me {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  consentAt: ISODate | null;
  graduateProfile: { id: string; completenessScore: number } | null;
  companyMember: {
    id: string;
    role: CompanyMemberRole;
    company: { id: string; name: string; verificationStatus: CompanyVerificationStatus };
  } | null;
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  category: string | null;
}

/** Proof for a skill. Files open through a short-lived link; `url` is set for links only. */
export interface SkillDocument {
  id: string;
  kind: SkillDocumentKind;
  fileName: string | null;
  format: string | null;
  bytes: number | null;
  url: string | null;
  createdAt: ISODate;
}

/** A skill as its owner and SIIP admins see it. Companies only see verified skills. */
export interface GraduateSkill {
  /** The intern's skill entry (not the catalogue skill). */
  id: string;
  /** Catalogue skill; null for "Other". */
  skillId: string | null;
  name: string;
  category: string;
  isOther: boolean;
  /** Claimed level. */
  level: SkillLevel;
  verifiedLevel: SkillLevel | null;
  status: SkillStatus;
  rejectionReason: string | null;
  issuingBody: string | null;
  issuedAt: ISODate | null;
  reviewedAt: ISODate | null;
  createdAt: ISODate;
  documents: SkillDocument[];
}

export interface GraduateProfile {
  id: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  phone: string | null;
  internType: InternType;
  country: string | null;
  city: string | null;
  workPreference: WorkMode | null;
  stateOfResidence: string | null;
  lga: string | null;
  institution: string | null;
  courseOfStudy: string | null;
  degreeClass: DegreeClass | null;
  graduationYear: number | null;
  nyscStatus: NyscStatus;
  nyscStateCode: string | null;
  nyscBatch: string | null;
  currentPpa: string | null;
  availability: Availability | null;
  bio: string | null;
  cv: { uploaded: boolean; uploadedAt: ISODate | null };
  photoUrl: string | null;
  completenessScore: number;
  searchable: boolean;
  visibility: ProfileVisibility;
  skills: GraduateSkill[];
  missingForApplication: string[];
  /** Names of skills that still need at least one document. */
  skillsWithoutProof: string[];
  reviewStatus: ProfileReviewStatus;
  submittedAt: ISODate | null;
  reviewedAt: ISODate | null;
  /** SIIP's note when more documents are requested. */
  reviewNote: string | null;
  updatedAt: ISODate;
}

export interface Cohort {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  applicationOpensAt: ISODate;
  applicationClosesAt: ISODate;
  trainingStartsAt: ISODate;
  trainingEndsAt: ISODate;
  internshipStartsAt: ISODate;
  internshipEndsAt: ISODate;
}

export interface AdminCohort extends Cohort {
  capacity: number;
  status: CohortStatus;
  createdAt: ISODate;
  _count: { applications: number };
  applicationCounts?: Partial<Record<ApplicationStatus, number>>;
}

export interface TimelineEvent {
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string | null;
  createdAt: ISODate;
}

export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  motivation: string | null;
  rejectionReason: string | null;
  createdAt: ISODate;
  statusChangedAt: ISODate;
  cohort: Pick<
    Cohort,
    "id" | "name" | "trainingStartsAt" | "trainingEndsAt" | "internshipStartsAt" | "internshipEndsAt"
  >;
  timeline: TimelineEvent[];
  canWithdraw: boolean;
}

export interface AdminApplicationRow {
  id: string;
  status: ApplicationStatus;
  createdAt: ISODate;
  statusChangedAt: ISODate;
  cohort: { id: string; name: string };
  graduate: {
    id: string;
    firstName: string;
    lastName: string;
    internType: InternType;
    country: string | null;
    city: string | null;
    stateOfResidence: string | null;
    institution: string | null;
    courseOfStudy: string | null;
    degreeClass: DegreeClass | null;
    graduationYear: number | null;
    nyscStatus: NyscStatus;
    completenessScore: number;
    reviewStatus: ProfileReviewStatus;
    skills: Array<{
      level: SkillLevel;
      verifiedLevel: SkillLevel | null;
      status: SkillStatus;
      otherName: string | null;
      skill: { id: string; name: string } | null;
    }>;
  };
}

export interface ApplicationNote {
  id: string;
  body: string;
  authorId: string;
  authorName: string | null;
  createdAt: ISODate;
}

export interface AdminApplicationDetail extends Omit<AdminApplicationRow, "graduate"> {
  motivation: string | null;
  rejectionReason: string | null;
  graduate: Omit<AdminApplicationRow["graduate"], "skills"> & {
    skills: GraduateSkill[];
    phone: string | null;
    lga: string | null;
    workPreference: WorkMode | null;
    nyscStateCode: string | null;
    nyscBatch: string | null;
    availability: Availability | null;
    bio: string | null;
    hasCv: boolean;
    user: { email: string; emailVerified: boolean; createdAt: ISODate };
  };
  events: TimelineEvent[];
  notes: ApplicationNote[];
  allowedNextStatuses: ApplicationStatus[];
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  readAt: ISODate | null;
  createdAt: ISODate;
}

// ─── Training ─────────────────────────────────────────────────────────────────

export interface LessonSummary {
  id: string;
  title: string;
  estimatedMinutes: number | null;
  completedAt: ISODate | null;
}

export interface Progress {
  completed: number;
  total: number;
  percent: number;
}

export interface MyCourse {
  id: string;
  title: string;
  description: string | null;
  modules: Array<{ id: string; title: string; lessons: LessonSummary[] }>;
  progress: Progress;
}

export interface MyTraining {
  applicationStatus: ApplicationStatus;
  courses: MyCourse[];
  progress: Progress;
}

export interface Lesson {
  id: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  attachmentUrl: string | null;
  estimatedMinutes: number | null;
  module: { id: string; title: string; course: { id: string; title: string } };
  completedAt: ISODate | null;
}

export interface AdminLesson {
  id: string;
  moduleId: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  attachmentUrl: string | null;
  estimatedMinutes: number | null;
  order: number;
}

export interface AdminCourse {
  id: string;
  cohortId: string;
  title: string;
  description: string | null;
  order: number;
  published: boolean;
  modules: Array<{ id: string; courseId: string; title: string; order: number; lessons: AdminLesson[] }>;
}

// ─── Assessments ──────────────────────────────────────────────────────────────

export interface MyAssessment {
  id: string;
  type: AssessmentType;
  title: string;
  description: string | null;
  timeLimitMinutes: number;
  passMark: number;
  maxAttempts: number;
  questionCount: number;
  attemptsAllowed: number;
  attemptsUsed: number;
  passed: boolean;
  inProgressAttemptId: string | null;
  canStart: boolean;
  attempts: Array<{
    id: string;
    attemptNumber: number;
    status: AttemptStatus;
    percentage: number | null;
    passed: boolean | null;
  }>;
}

export interface AttemptQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  options: Array<{ id: string; text: string }>;
}

export interface AttemptView {
  id: string;
  assessment: { id: string; title: string; type: AssessmentType; passMark: number; timeLimitMinutes: number };
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: ISODate;
  deadlineAt: ISODate;
  serverTime?: ISODate;
  submittedAt?: ISODate | null;
  questions?: AttemptQuestion[];
  answers?: Array<{ questionId: string; selectedOptionIds: string[]; textAnswer: string | null }>;
  result?: { percentage: number | null; passed: boolean | null };
}

export interface AdminQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  order: number;
  acceptedAnswers: string[];
  options: Array<{ id: string; text: string; isCorrect: boolean; order: number }>;
}

export interface AdminAssessment {
  id: string;
  cohortId: string | null;
  type: AssessmentType;
  title: string;
  description: string | null;
  timeLimitMinutes: number;
  passMark: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  published: boolean;
  createdAt: ISODate;
  questions: AdminQuestion[];
  _count: { questions: number; attempts: number };
}

export interface AttemptRow {
  id: string;
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: ISODate;
  deadlineAt: ISODate;
  submittedAt: ISODate | null;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  passed: boolean | null;
  graduate: { id: string; firstName: string; lastName: string };
}

// ─── Companies & openings ─────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  /** Nigeria only (CAC). */
  rcNumber: string | null;
  businessRegNumber: string | null;
  country: string | null;
  city: string | null;
  timeZone: string | null;
  industry: string;
  description: string | null;
  address: string;
  /** Nigeria only. */
  state: string | null;
  website: string | null;
  logoUrl: string | null;
  verificationStatus: CompanyVerificationStatus;
  verifiedAt: ISODate | null;
  statusReason: string | null;
  createdAt: ISODate;
  myRole?: CompanyMemberRole;
  _count?: { openings: number; members: number };
}

export interface CompanyMember {
  id: string;
  role: CompanyMemberRole;
  jobTitle: string | null;
  createdAt: ISODate;
  user: { name: string; email: string };
  _count: { supervisedPlacements: number };
}

export interface Invitation {
  id: string;
  email: string;
  role: CompanyMemberRole;
  expiresAt: ISODate;
  createdAt: ISODate;
}

export interface Opening {
  id: string;
  companyId: string;
  cohortId: string | null;
  title: string;
  department: string | null;
  description: string;
  slots: number;
  preferredDisciplines: string[];
  country: string | null;
  city: string | null;
  state: string | null;
  location: string | null;
  workMode: WorkMode;
  schedule: WorkSchedule;
  openToNysc: boolean;
  durationWeeks: number | null;
  startDate: ISODate | null;
  mayLeadToFullTime: boolean;
  status: OpeningStatus;
  createdAt: ISODate;
  updatedAt: ISODate;
  skills: Array<{ required: boolean; minLevel: SkillLevel | null; skill: { id: string; name: string } }>;
  _count: { matches: number; placements: number };
  company?: { id: string; name: string; verificationStatus: CompanyVerificationStatus };
}

// ─── Matching & placement ─────────────────────────────────────────────────────

export type MatchFactor = "skills" | "assessment" | "discipline" | "location" | "availability" | "nysc";
export type ScoreBreakdown = Record<
  MatchFactor,
  { fit: number; weight: number; points: number; detail: string }
>;

/** What a company sees before accepting: no phone, email or CV. */
export interface LimitedGraduate {
  id: string;
  firstName: string;
  lastName: string;
  internType: InternType;
  country: string | null;
  city: string | null;
  workPreference: WorkMode | null;
  stateOfResidence: string | null;
  institution: string | null;
  courseOfStudy: string | null;
  degreeClass: DegreeClass | null;
  graduationYear: number | null;
  nyscStatus: NyscStatus;
  availability: Availability | null;
  bio: string | null;
  photoUrl: string | null;
  finalAssessmentPercent: number | null;
  skills: Array<{ id: string; name: string; level: SkillLevel }>;
}

export interface Suggestion {
  applicationId: string;
  cohortId: string;
  score: number;
  breakdown: ScoreBreakdown;
  graduate: LimitedGraduate;
}

export interface Suggestions {
  opening: {
    id: string;
    title: string;
    company: { id: string; name: string; verificationStatus: CompanyVerificationStatus };
    slots: number;
    filled: number;
    status: OpeningStatus;
    workMode: WorkMode;
    country: string | null;
    city: string | null;
    state: string | null;
    durationWeeks: number | null;
    startDate: ISODate | null;
    mayLeadToFullTime: boolean;
    skills: Array<{ name: string; minLevel: SkillLevel | null; required: boolean }>;
  };
  suggestions: Suggestion[];
}

export interface CompanyMatch {
  id: string;
  status: MatchStatus;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  createdAt: ISODate;
  decidedAt: ISODate | null;
  decisionReason: string | null;
  opening: { id: string; title: string };
  graduate: LimitedGraduate & { phone?: string | null; email?: string; hasCv?: boolean };
}

export interface Placement {
  id: string;
  status: PlacementStatus;
  startDate: ISODate;
  endDate: ISODate;
  endedAt: ISODate | null;
  endReason: string | null;
  offeredPermanentRole: boolean;
  permanentOfferDate: ISODate | null;
  createdAt: ISODate;
  opening: {
    id: string;
    title: string;
    workMode: WorkMode;
    country: string | null;
    city: string | null;
    state: string | null;
    location: string | null;
  };
  company: {
    id: string;
    name: string;
    address?: string;
    country?: string | null;
    city?: string | null;
    state?: string | null;
    website?: string | null;
    logoUrl?: string | null;
    industry?: string;
  };
  supervisor: { id: string; jobTitle: string | null; user: { name: string; email: string } } | null;
  graduate: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    institution?: string | null;
    courseOfStudy?: string | null;
    photoUrl?: string | null;
    user?: { email: string };
  };
}

export interface CheckIn {
  id: string;
  authorType: CheckInAuthor;
  month: number;
  progressNote: string;
  challenges: string | null;
  rating: number | null;
  createdAt: ISODate;
}

export interface Evaluation {
  id: string;
  placementId: string;
  punctuality: number;
  skill: number;
  communication: number;
  teamwork: number;
  initiative: number;
  overallScore: number;
  comments: string | null;
  wouldHire: boolean;
  createdAt: ISODate;
}

export interface AdminPlacement extends Placement {
  match: { id: string; score: number; scoreBreakdown: ScoreBreakdown };
  application: { id: string; status: ApplicationStatus; cohort: { id: string; name: string } };
  checkIns: CheckIn[];
  evaluation: Evaluation | null;
  programmeEvaluation: {
    notes: string | null;
    approvedForCertificate: boolean;
    approvedAt: ISODate | null;
  } | null;
  certificate?: { id: string; serialNumber: string; verificationCode: string } | null;
}

export interface MyPlacement {
  match: {
    id: string;
    status: MatchStatus;
    createdAt: ISODate;
    opening: { title: string; company: { name: string } };
  } | null;
  placement: Placement | null;
}

export interface Certificate {
  id: string;
  serialNumber: string;
  verificationCode: string;
  issuedAt: ISODate;
  ready: boolean;
  verifyUrl: string;
  placement: { company: { name: string }; opening: { title: string } };
}

export interface CertificateVerification {
  valid: boolean;
  graduateName: string;
  cohortName: string;
  companyName: string;
  roleTitle: string;
  issuedAt: ISODate;
  serialNumber: string;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface Analytics {
  stagesByCohort: Array<{
    cohortId: string;
    cohortName: string | null;
    stages: Partial<Record<ApplicationStatus, number>>;
  }>;
  totals: { applications: number; byStage: Partial<Record<ApplicationStatus, number>> };
  rates: {
    assessmentPassRate: number | null;
    placementRate: number | null;
    completionRate: number | null;
    permanentOfferRate: number | null;
  };
  counts: {
    assessmentAttempts: number;
    assessmentPasses: number;
    placements: Partial<Record<PlacementStatus, number>>;
    permanentOffers: number;
  };
  skills: Array<{ skillId: string; name: string; demand: number; supply: number; gap: number }>;
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: UserRole | null;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  /** Context such as the reason given for a decision. */
  metadata?: Record<string, unknown> | null;
  createdAt: ISODate;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// ─── SIIP's review of intern skills ───────────────────────────────────────────

export interface ReviewQueueRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  internType: InternType;
  country: string | null;
  city: string | null;
  reviewStatus: ProfileReviewStatus;
  submittedAt: ISODate | null;
  reviewedAt: ISODate | null;
  removedAt: ISODate | null;
  skills: { total: number; pending: number; verified: number; rejected: number; documents: number };
}

export interface ReviewHistoryItem {
  id: string;
  action: string;
  actorName: string | null;
  skillName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: ISODate;
}

export interface ReviewDetail {
  id: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  phone: string | null;
  internType: InternType;
  country: string | null;
  city: string | null;
  stateOfResidence: string | null;
  workPreference: WorkMode | null;
  availability: Availability | null;
  institution: string | null;
  courseOfStudy: string | null;
  degreeClass: DegreeClass | null;
  graduationYear: number | null;
  nyscStateCode: string | null;
  nyscBatch: string | null;
  bio: string | null;
  hasCv: boolean;
  reviewStatus: ProfileReviewStatus;
  submittedAt: ISODate | null;
  reviewedAt: ISODate | null;
  reviewNote: string | null;
  removedAt: ISODate | null;
  removalReason: string | null;
  deleteAfter: ISODate | null;
  user: { id: string; email: string; createdAt: ISODate };
  skills: GraduateSkill[];
  history: ReviewHistoryItem[];
}
