// In-memory mock database. Built once from a seeded generator, so every reload
// shows the same realistic data; mutations change it until the page reloads.
import type {
  ApplicationStatus,
  Availability,
  CohortStatus,
  CompanyMemberRole,
  CompanyVerificationStatus,
  DegreeClass,
  MatchStatus,
  NyscStatus,
  OpeningStatus,
  PlacementStatus,
  ProfileVisibility,
  SkillLevel,
  UserRole,
  WorkMode,
  WorkSchedule,
  AttemptStatus,
  CheckInAuthor,
} from "@siip/shared/enums";
import { scoreMatch, type MatchCandidate, type MatchOpening } from "@siip/shared/matching";
import type {
  AdminAssessment,
  AdminCourse,
  ApplicationNote,
  AuditEntry,
  Notification,
  ScoreBreakdown,
  TimelineEvent,
} from "@/client/api/types";
import {
  COMPANIES,
  COURSES,
  FIRST_NAMES,
  INSTITUTIONS,
  LAST_NAMES,
  NIGERIAN_STATES,
  OPENING_TITLES,
  SKILLS,
} from "./seed-lists";

// ─── Seeded randomness (stable across reloads) ────────────────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const pickN = <T>(xs: readonly T[], n: number) => [...xs].sort(() => rand() - 0.5).slice(0, n);
let seq = 0;
export const newId = (prefix: string) =>
  `${prefix}_${(++seq).toString(36).padStart(4, "0")}${Math.floor(rand() * 1e6).toString(36)}`;

const DAY = 86_400_000;
export const now = () => Date.now();
export const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

// ─── Record types ─────────────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  consentAt: string;
  createdAt: string;
}
export interface DbGraduate {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  phone: string | null;
  stateOfResidence: string | null;
  lga: string | null;
  institution: string | null;
  courseOfStudy: string | null;
  degreeClass: DegreeClass | null;
  graduationYear: number | null;
  nyscStatus: NyscStatus;
  currentPpa: string | null;
  availability: Availability | null;
  bio: string | null;
  cvUploadedAt: string | null;
  photoUrl: string | null;
  searchable: boolean;
  visibility: ProfileVisibility;
  skills: Array<{ skillId: string; level: SkillLevel }>;
  updatedAt: string;
}
export interface DbApplication {
  id: string;
  graduateId: string;
  cohortId: string;
  status: ApplicationStatus;
  motivation: string | null;
  rejectionReason: string | null;
  createdAt: string;
  statusChangedAt: string;
  events: Array<TimelineEvent & { actorId: string | null }>;
  notes: ApplicationNote[];
}
export interface DbCohort {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  applicationOpensAt: string;
  applicationClosesAt: string;
  trainingStartsAt: string;
  trainingEndsAt: string;
  internshipStartsAt: string;
  internshipEndsAt: string;
  capacity: number;
  status: CohortStatus;
  createdAt: string;
}
export type DbAssessment = Omit<AdminAssessment, "_count">;
export interface DbAttempt {
  id: string;
  assessmentId: string;
  graduateId: string;
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  layout: Array<{ questionId: string; optionIds: string[] }>;
  answers: Record<string, { selectedOptionIds: string[]; textAnswer: string | null }>;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  passed: boolean | null;
}
export interface DbCompany {
  id: string;
  name: string;
  rcNumber: string;
  industry: string;
  description: string | null;
  address: string;
  state: string;
  website: string | null;
  logoUrl: string | null;
  verificationStatus: CompanyVerificationStatus;
  verifiedAt: string | null;
  statusReason: string | null;
  createdAt: string;
}
export interface DbMember {
  id: string;
  companyId: string;
  userId: string;
  role: CompanyMemberRole;
  jobTitle: string | null;
  createdAt: string;
}
export interface DbInvitation {
  id: string;
  companyId: string;
  email: string;
  role: CompanyMemberRole;
  token: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}
export interface DbOpening {
  id: string;
  companyId: string;
  cohortId: string | null;
  title: string;
  department: string | null;
  description: string;
  slots: number;
  preferredDisciplines: string[];
  state: string;
  location: string | null;
  workMode: WorkMode;
  schedule: WorkSchedule;
  openToNysc: boolean;
  status: OpeningStatus;
  createdAt: string;
  updatedAt: string;
  skills: Array<{ skillId: string; minLevel: SkillLevel | null; required: boolean }>;
}
export interface DbMatch {
  id: string;
  graduateId: string;
  applicationId: string;
  openingId: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  status: MatchStatus;
  createdAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
}
export interface DbPlacement {
  id: string;
  matchId: string;
  applicationId: string;
  graduateId: string;
  openingId: string;
  companyId: string;
  supervisorId: string | null;
  startDate: string;
  endDate: string;
  status: PlacementStatus;
  endedAt: string | null;
  endReason: string | null;
  offeredPermanentRole: boolean;
  permanentOfferDate: string | null;
  createdAt: string;
}
export interface DbCheckIn {
  id: string;
  placementId: string;
  authorType: CheckInAuthor;
  month: number;
  progressNote: string;
  challenges: string | null;
  rating: number | null;
  createdAt: string;
}
export interface DbEvaluation {
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
  createdAt: string;
}
export interface DbCertificate {
  id: string;
  placementId: string;
  graduateId: string;
  serialNumber: string;
  verificationCode: string;
  issuedAt: string;
}

export const db = {
  users: [] as DbUser[],
  skills: SKILLS.map(([name, category], i) => ({
    id: `skill_${i + 1}`,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    category,
  })),
  graduates: [] as DbGraduate[],
  cohorts: [] as DbCohort[],
  applications: [] as DbApplication[],
  courses: [] as AdminCourse[],
  lessonProgress: new Map<string, string>(), // `${graduateId}:${lessonId}` → completedAt
  assessments: [] as DbAssessment[],
  attempts: [] as DbAttempt[],
  retakeGrants: new Map<string, number>(), // `${assessmentId}:${graduateId}` → extra attempts
  companies: [] as DbCompany[],
  members: [] as DbMember[],
  invitations: [] as DbInvitation[],
  openings: [] as DbOpening[],
  matches: [] as DbMatch[],
  placements: [] as DbPlacement[],
  checkIns: [] as DbCheckIn[],
  evaluations: [] as DbEvaluation[],
  programmeEvaluations: new Map<
    string,
    { notes: string | null; approvedForCertificate: boolean; approvedAt: string | null }
  >(),
  certificates: [] as DbCertificate[],
  notifications: [] as Array<Notification & { userId: string }>,
  audit: [] as AuditEntry[],
};

/** Named demo accounts for the role switcher. */
export const personas: Record<string, { userId: string; label: string; description: string }> = {};

// ─── Small helpers used by seed and API mocks ─────────────────────────────────

export const skillName = (id: string) => db.skills.find((s) => s.id === id)?.name ?? "Unknown skill";
export const userById = (id: string) => db.users.find((u) => u.id === id);
export const graduateById = (id: string) => db.graduates.find((g) => g.id === id);
export const companyById = (id: string) => db.companies.find((c) => c.id === id);
export const openingById = (id: string) => db.openings.find((o) => o.id === id);
export const cohortById = (id: string) => db.cohorts.find((c) => c.id === id);

export function notify(
  userId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, string> | null = null,
) {
  db.notifications.unshift({
    id: newId("ntf"),
    userId,
    type,
    title,
    body,
    data,
    readAt: null,
    createdAt: new Date().toISOString(),
  });
}

export function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  before: Record<string, unknown> | null = null,
  after: Record<string, unknown> | null = null,
) {
  const actor = actorId ? userById(actorId) : undefined;
  db.audit.unshift({
    id: newId("aud"),
    actorId,
    actorName: actor?.name ?? null,
    actorRole: actor?.role ?? null,
    action,
    entityType,
    entityId,
    before,
    after,
    createdAt: new Date().toISOString(),
  });
}

export function bestFinal(graduateId: string): number | null {
  const finals = new Set(db.assessments.filter((a) => a.type === "FINAL").map((a) => a.id));
  const scores = db.attempts
    .filter((t) => t.graduateId === graduateId && finals.has(t.assessmentId) && t.percentage !== null)
    .map((t) => t.percentage!);
  return scores.length ? Math.max(...scores) : null;
}

export function candidateOf(g: DbGraduate): MatchCandidate {
  return { ...g, skills: g.skills, finalAssessmentPercent: bestFinal(g.id) };
}

export function scoreFor(g: DbGraduate, o: DbOpening) {
  return scoreMatch(candidateOf(g), o as MatchOpening);
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

function addUser(name: string, email: string, role: UserRole, daysAgo = 60): DbUser {
  const u: DbUser = {
    id: newId("usr"),
    name,
    email,
    role,
    emailVerified: true,
    consentAt: iso(-daysAgo),
    createdAt: iso(-daysAgo),
  };
  db.users.push(u);
  return u;
}

function seedCohorts() {
  db.cohorts.push(
    {
      id: "coh_2",
      name: "Cohort 2 · 2026",
      slug: "cohort-2-2026",
      description: "Lagos, Abuja and Port Harcourt placements.",
      applicationOpensAt: iso(-120),
      applicationClosesAt: iso(-90),
      trainingStartsAt: iso(-85),
      trainingEndsAt: iso(-40),
      internshipStartsAt: iso(-35),
      internshipEndsAt: iso(60),
      capacity: 60,
      status: "IN_PROGRESS",
      createdAt: iso(-130),
    },
    {
      id: "coh_3",
      name: "Cohort 3 · 2027",
      slug: "cohort-3-2027",
      description: "Our largest cohort yet, with new trades and digital tracks.",
      applicationOpensAt: iso(-10),
      applicationClosesAt: iso(25),
      trainingStartsAt: iso(32),
      trainingEndsAt: iso(80),
      internshipStartsAt: iso(88),
      internshipEndsAt: iso(180),
      capacity: 120,
      status: "APPLICATIONS_OPEN",
      createdAt: iso(-20),
    },
  );
}

function seedCourses() {
  const lesson = (
    moduleId: string,
    order: number,
    title: string,
    minutes: number,
    content: string,
    videoUrl: string | null = null,
  ) => ({
    id: newId("les"),
    moduleId,
    title,
    content,
    videoUrl,
    attachmentUrl: null,
    estimatedMinutes: minutes,
    order,
  });
  const mk = (
    title: string,
    description: string,
    modules: Array<[string, Array<[string, number, string, string | null]>]>,
    order: number,
  ): AdminCourse => {
    const id = newId("crs");
    return {
      id,
      cohortId: "coh_2",
      title,
      description,
      order,
      published: true,
      modules: modules.map(([mt, lessons], mi) => {
        const mid = newId("mod");
        return {
          id: mid,
          courseId: id,
          title: mt,
          order: mi,
          lessons: lessons.map(([lt, min, body, video], li) => lesson(mid, li, lt, min, body, video)),
        };
      }),
    };
  };
  const p = (s: string) => s; // lesson bodies are plain paragraphs separated by blank lines
  db.courses.push(
    mk(
      "Workplace Essentials",
      "The habits, communication and tools every new professional needs.",
      [
        [
          "Professional communication",
          [
            [
              "Writing a great work email",
              12,
              p(
                "A good work email has one clear purpose, a specific subject line and a polite, direct tone.\n\nStart with the point, give the context in two or three sentences, and end with exactly what you need and by when.\n\nBefore you send, read it once as the receiver: is it clear what you are asking?",
              ),
              null,
            ],
            [
              "Speaking up in meetings",
              10,
              p(
                "Prepare one point before the meeting. When you speak, lead with your conclusion, then give your reason.\n\nIf you disagree, ask a question first: 'Have we considered…?' keeps the conversation open.",
              ),
              "https://www.youtube.com/embed/aqz-KE-bpKQ",
            ],
            [
              "Phone and WhatsApp etiquette",
              8,
              p(
                "Introduce yourself and your company. Keep work chats in working hours, and confirm decisions in writing.",
              ),
              null,
            ],
          ],
        ],
        [
          "Getting things done",
          [
            [
              "Planning your week",
              10,
              p(
                "List your three most important tasks every Monday. Block time for them before the week fills up.",
              ),
              null,
            ],
            [
              "Asking for help the right way",
              9,
              p(
                "Show what you tried, what happened, and what you think the next step is. Your supervisor will thank you.",
              ),
              null,
            ],
            [
              "Receiving feedback",
              8,
              p(
                "Listen fully, thank the person, and ask one clarifying question. Act on it, then show what changed.",
              ),
              null,
            ],
          ],
        ],
      ],
      0,
    ),
    mk(
      "Digital Skills for Work",
      "Practical tools you'll use from day one: spreadsheets, social media and content.",
      [
        [
          "Spreadsheets",
          [
            [
              "Excel basics: tables and formatting",
              15,
              p(
                "Turn your data into a table (Ctrl+T). Freeze the header row and use consistent formats for dates and money.",
              ),
              null,
            ],
            [
              "SUM, AVERAGE and IF",
              18,
              p(
                '=SUM(B2:B20) adds a column. =AVERAGE works the same way. =IF(C2>50,"Pass","Fail") makes a decision.',
              ),
              null,
            ],
          ],
        ],
        [
          "Content and social media",
          [
            [
              "Planning a content calendar",
              12,
              p(
                "Plan two weeks ahead. Mix educational, behind-the-scenes and promotional posts. Track what performs best.",
              ),
              null,
            ],
            [
              "Shooting good video on your phone",
              14,
              p(
                "Clean your lens, shoot in landscape for YouTube and portrait for Reels, face the light, and keep the phone steady.",
              ),
              "https://www.youtube.com/embed/aqz-KE-bpKQ",
            ],
          ],
        ],
      ],
      1,
    ),
  );
}

function seedAssessments() {
  const opt = (text: string, isCorrect = false, order = 0) => ({ id: newId("opt"), text, isCorrect, order });
  const q = (
    type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "SHORT_TEXT",
    prompt: string,
    options: ReturnType<typeof opt>[] = [],
    acceptedAnswers: string[] = [],
    order = 0,
  ) => ({
    id: newId("q"),
    type,
    prompt,
    points: 1,
    order,
    acceptedAnswers,
    options: options.map((o, i) => ({ ...o, order: i })),
  });
  db.assessments.push(
    {
      id: "asm_screen",
      cohortId: null,
      type: "SCREENING",
      title: "SIIP screening test",
      description: "Ten short questions on reasoning, English and workplace judgement.",
      timeLimitMinutes: 20,
      passMark: 50,
      maxAttempts: 1,
      shuffleQuestions: true,
      shuffleOptions: true,
      published: true,
      createdAt: iso(-140),
      questions: [
        q(
          "SINGLE_CHOICE",
          "A colleague sends you a message at 11pm about a task due next week. What is the most professional response?",
          [
            opt("Reply immediately so they know you're committed"),
            opt("Reply the next morning during working hours", true),
            opt("Ignore it completely"),
            opt("Forward it to your supervisor"),
          ],
        ),
        q("SINGLE_CHOICE", "Which sentence is written correctly?", [
          opt("Their going to the office tomorrow."),
          opt("They're going to the office tomorrow.", true),
          opt("There going to the office tomorrow."),
        ]),
        q(
          "SINGLE_CHOICE",
          "If 3 interns can file 60 documents in 2 hours, how many documents can 5 interns file in 2 hours?",
          [opt("80"), opt("100", true), opt("120"), opt("90")],
        ),
        q(
          "MULTIPLE_CHOICE",
          "Which of these are good habits in your first week at a new job? (Select all that apply)",
          [
            opt("Taking notes when you're shown how things work", true),
            opt("Asking questions when you're unsure", true),
            opt("Waiting to be told every single task"),
            opt("Learning colleagues' names", true),
          ],
        ),
        q("SHORT_TEXT", "What is the capital city of Nigeria?", [], ["Abuja"]),
        q(
          "SINGLE_CHOICE",
          "You made a mistake in a report your supervisor has already shared. What should you do first?",
          [
            opt("Hope nobody notices"),
            opt("Tell your supervisor and offer a corrected version", true),
            opt("Blame the template"),
          ],
        ),
      ],
    },
    {
      id: "asm_final",
      cohortId: "coh_2",
      type: "FINAL",
      title: "Final assessment · Cohort 2",
      description: "Covers Workplace Essentials and Digital Skills for Work.",
      timeLimitMinutes: 30,
      passMark: 60,
      maxAttempts: 2,
      shuffleQuestions: true,
      shuffleOptions: true,
      published: true,
      createdAt: iso(-60),
      questions: [
        q("SINGLE_CHOICE", "What should the first line of a work email do?", [
          opt("Greet everyone individually"),
          opt("State the purpose of the email", true),
          opt("Apologise for the interruption"),
        ]),
        q("SINGLE_CHOICE", "Which Excel formula adds the values in B2 to B20?", [
          opt("=ADD(B2:B20)"),
          opt("=SUM(B2:B20)", true),
          opt("=TOTAL(B2,B20)"),
        ]),
        q("MULTIPLE_CHOICE", "Which make a phone video look more professional? (Select all that apply)", [
          opt("Cleaning the lens", true),
          opt("Facing the light source", true),
          opt("Using digital zoom heavily"),
          opt("Keeping the phone steady", true),
        ]),
        q("SINGLE_CHOICE", "When asking your supervisor for help, what should you include?", [
          opt("Only the question"),
          opt("What you tried and what you think the next step is", true),
          opt("A list of everything that went wrong this week"),
        ]),
        q(
          "SHORT_TEXT",
          "Which spreadsheet application do most Nigerian offices use?",
          [],
          ["Excel", "Microsoft Excel"],
        ),
        q("SINGLE_CHOICE", "A good content calendar is usually planned…", [
          opt("The morning of each post"),
          opt("About two weeks ahead", true),
          opt("Once a year"),
        ]),
      ],
    },
  );
}

const STAGES: Array<[ApplicationStatus, number, string]> = [
  // status, count, cohort
  ["IN_TRAINING", 6, "coh_2"],
  ["FINAL_ASSESSMENT", 4, "coh_2"],
  ["QUALIFIED", 5, "coh_2"],
  ["MATCHED", 4, "coh_2"],
  ["PLACED", 6, "coh_2"],
  ["COMPLETED", 4, "coh_2"],
  ["REJECTED", 2, "coh_2"],
  ["WITHDRAWN", 1, "coh_2"],
  ["SUBMITTED", 4, "coh_3"],
  ["SCREENING", 3, "coh_3"],
  ["SHORTLISTED", 1, "coh_3"],
];
const PATH: ApplicationStatus[] = [
  "SUBMITTED",
  "SCREENING",
  "SHORTLISTED",
  "IN_TRAINING",
  "FINAL_ASSESSMENT",
  "QUALIFIED",
  "MATCHED",
  "PLACED",
  "COMPLETED",
];

function makeGraduate(i: number, complete = true): DbGraduate {
  const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
  const lastName = LAST_NAMES[(i * 7) % LAST_NAMES.length];
  const user = addUser(
    `${firstName} ${lastName}`,
    `${firstName}.${lastName}${i}@example.ng`.toLowerCase(),
    "GRADUATE",
    140 - i,
  );
  const state =
    i < 8 ? (["Lagos", "FCT", "Rivers"] as const)[i % 3] : NIGERIAN_STATES[i % NIGERIAN_STATES.length];
  const nysc: NyscStatus = (["COMPLETED", "SERVING", "NOT_YET", "COMPLETED", "EXEMPTED"] as const)[i % 5];
  const g: DbGraduate = {
    id: newId("grd"),
    userId: user.id,
    firstName,
    lastName,
    otherNames: null,
    phone: complete ? `+23480${String(31000000 + i * 1371).padStart(8, "0")}` : null,
    stateOfResidence: complete ? state : null,
    lga: complete ? "Ikeja" : null,
    institution: complete ? pick(INSTITUTIONS) : null,
    courseOfStudy: complete ? pick(COURSES) : null,
    degreeClass: complete
      ? pick([
          "SECOND_CLASS_UPPER",
          "SECOND_CLASS_LOWER",
          "FIRST_CLASS",
          "SECOND_CLASS_UPPER",
          "UPPER_CREDIT",
        ] as const)
      : null,
    graduationYear: complete ? pick([2023, 2024, 2025, 2025]) : null,
    nyscStatus: nysc,
    currentPpa: nysc === "SERVING" ? "Ministry of Youth Development" : null,
    availability: complete ? pick(["FULL_TIME", "FULL_TIME", "FLEXIBLE", "PART_TIME"] as const) : null,
    bio: complete ? "Hardworking graduate who enjoys learning new tools and working with people." : null,
    cvUploadedAt: complete ? iso(-100 + i) : null,
    photoUrl: null,
    searchable: i % 3 === 0,
    visibility: i % 3 === 0 ? "VERIFIED_COMPANIES" : "PRIVATE",
    skills: complete
      ? pickN(db.skills, 2 + (i % 3)).map((s) => ({
          skillId: s.id,
          level: pick(["BEGINNER", "INTERMEDIATE", "ADVANCED", "INTERMEDIATE"] as const),
        }))
      : [],
    updatedAt: iso(-5),
  };
  db.graduates.push(g);
  return g;
}

function seedCompanies(adminId: string) {
  COMPANIES.forEach((c, i) => {
    const status: CompanyVerificationStatus = i === 7 ? "PENDING" : i === 6 ? "PENDING" : "VERIFIED";
    const company: DbCompany = {
      id: newId("cmp"),
      name: c.name,
      rcNumber: `RC${1200000 + i * 4111}`,
      industry: c.industry,
      description: `${c.name} is a growing ${c.industry.toLowerCase()} business.`,
      address: c.address,
      state: c.state,
      website: c.website,
      logoUrl: null,
      verificationStatus: status,
      verifiedAt: status === "VERIFIED" ? iso(-150 + i) : null,
      statusReason: null,
      createdAt: iso(-160 + i),
    };
    db.companies.push(company);
    const slug = c.name.toLowerCase().replace(/[^a-z]+/g, "");
    const owner = addUser(
      pick([
        "Tola Adewale",
        "Kemi Bankole",
        "Ibrahim Sule",
        "Grace Etim",
        "Chuka Ude",
        "Aminat Yusuf",
        "Bayo Ojo",
        "Ese Ighodaro",
      ]),
      `owner@${slug}.ng`,
      "COMPANY_MEMBER",
      160 - i,
    );
    db.members.push({
      id: newId("mbr"),
      companyId: company.id,
      userId: owner.id,
      role: "OWNER",
      jobTitle: "HR Manager",
      createdAt: iso(-160 + i),
    });
    if (i < 3) {
      const sup = addUser(
        pick(["Femi Alade", "Ngozi Umeh", "Sadiq Bello"]),
        `supervisor@${slug}.ng`,
        "COMPANY_MEMBER",
        120,
      );
      db.members.push({
        id: newId("mbr"),
        companyId: company.id,
        userId: sup.id,
        role: "SUPERVISOR",
        jobTitle: "Team Lead",
        createdAt: iso(-120),
      });
    }
    if (status === "VERIFIED")
      audit(
        adminId,
        "company.status_changed",
        "Company",
        company.id,
        { verificationStatus: "PENDING" },
        { verificationStatus: "VERIFIED" },
      );
  });
  db.invitations.push({
    id: newId("inv"),
    companyId: db.companies[0].id,
    email: "tobi@lagosmediahub.ng",
    role: "SUPERVISOR",
    token: "demo-token",
    expiresAt: iso(5),
    createdAt: iso(-2),
    acceptedAt: null,
    revokedAt: null,
  });
}

function seedOpenings() {
  const verified = db.companies.filter((c) => c.verificationStatus === "VERIFIED");
  for (let i = 0; i < 15; i++) {
    const company = verified[i % verified.length];
    const t = OPENING_TITLES[i % OPENING_TITLES.length];
    const status: OpeningStatus = i < 11 ? "OPEN" : i < 13 ? "CLOSED" : "DRAFT";
    db.openings.push({
      id: newId("opn"),
      companyId: company.id,
      cohortId: i % 4 === 0 ? null : "coh_2",
      title: t.title,
      department: t.department,
      description: `Join ${company.name}'s ${t.department.toLowerCase()} team for three months. You'll work on real projects with a dedicated supervisor and get hands-on experience in ${t.skills[0].toLowerCase()}.`,
      slots: 1 + (i % 3),
      preferredDisciplines: t.disciplines,
      state: company.state,
      location: company.address,
      workMode: (["ONSITE", "HYBRID", "REMOTE", "ONSITE"] as const)[i % 4],
      schedule: i % 5 === 4 ? "PART_TIME" : "FULL_TIME",
      openToNysc: i % 3 !== 2,
      status,
      createdAt: iso(-70 + i),
      updatedAt: iso(-20 + i),
      skills: t.skills.map((name, k) => ({
        skillId: db.skills.find((s) => s.name === name)!.id,
        minLevel: k === 0 ? "INTERMEDIATE" : null,
        required: k < 2,
      })),
    });
  }
}

function seedJourney(adminId: string) {
  let i = 0;
  const firstOf: Partial<Record<ApplicationStatus, DbGraduate>> = {};
  for (const [status, count, cohortId] of STAGES) {
    for (let k = 0; k < count; k++, i++) {
      const g = makeGraduate(i);
      firstOf[status] ??= g;
      const steps =
        status === "REJECTED" || status === "WITHDRAWN"
          ? (["SUBMITTED", "SCREENING", status] as ApplicationStatus[])
          : PATH.slice(0, PATH.indexOf(status) + 1);
      const base = cohortId === "coh_2" ? -110 : -8;
      const events = steps.map((to, idx) => ({
        fromStatus: idx === 0 ? null : steps[idx - 1],
        toStatus: to,
        actorId: idx === 0 ? g.userId : adminId,
        note:
          to === "REJECTED"
            ? "Thank you for applying. Your screening score was below what this cohort needed."
            : null,
        createdAt: iso(base + idx * (cohortId === "coh_2" ? 12 : 2)),
      }));
      const app: DbApplication = {
        id: newId("app"),
        graduateId: g.id,
        cohortId,
        status,
        motivation: "I want real workplace experience and to grow my skills.",
        rejectionReason: status === "REJECTED" ? events.at(-1)!.note : null,
        createdAt: events[0].createdAt,
        statusChangedAt: events.at(-1)!.createdAt,
        events,
        notes:
          k === 0 && cohortId === "coh_3"
            ? [
                {
                  id: newId("note"),
                  body: "Strong CV, strong communication skills.",
                  authorId: adminId,
                  authorName: "SIIP Admin",
                  createdAt: iso(-3),
                },
              ]
            : [],
      };
      db.applications.push(app);
      seedProgressFor(g, app);
    }
  }
  return firstOf;
}

function lessonsOf(cohortId: string) {
  return db.courses
    .filter((c) => c.cohortId === cohortId && c.published)
    .flatMap((c) => c.modules.flatMap((m) => m.lessons));
}

function seedProgressFor(g: DbGraduate, app: DbApplication) {
  const idx = PATH.indexOf(app.status);
  if (idx < PATH.indexOf("IN_TRAINING")) return;
  const lessons = lessonsOf(app.cohortId);
  const done =
    app.status === "IN_TRAINING" ? Math.floor(lessons.length * (0.2 + rand() * 0.6)) : lessons.length;
  lessons.slice(0, done).forEach((l, n) => db.lessonProgress.set(`${g.id}:${l.id}`, iso(-80 + n)));
  // Screening attempt for everyone past screening.
  addFinishedAttempt("asm_screen", g.id, 60 + Math.floor(rand() * 35));
  if (idx >= PATH.indexOf("QUALIFIED")) addFinishedAttempt("asm_final", g.id, 62 + Math.floor(rand() * 35));
}

function addFinishedAttempt(assessmentId: string, graduateId: string, percentage: number) {
  const a = db.assessments.find((x) => x.id === assessmentId)!;
  const passed = percentage >= a.passMark;
  db.attempts.push({
    id: newId("att"),
    assessmentId,
    graduateId,
    attemptNumber: 1,
    status: "SUBMITTED",
    startedAt: iso(-70),
    deadlineAt: iso(-70),
    submittedAt: iso(-70),
    layout: a.questions.map((q) => ({ questionId: q.id, optionIds: q.options.map((o) => o.id) })),
    answers: {},
    score: Math.round((percentage / 100) * a.questions.length),
    maxScore: a.questions.length,
    percentage,
    passed,
  });
}

function seedMatching(adminId: string) {
  const open = db.openings.filter((o) => o.status !== "DRAFT");
  const appsAt = (s: ApplicationStatus) => db.applications.filter((a) => a.status === s);
  let n = 0;
  for (const app of [...appsAt("MATCHED"), ...appsAt("PLACED"), ...appsAt("COMPLETED")]) {
    const g = graduateById(app.graduateId)!;
    const opening = open[n++ % open.length];
    const score = scoreFor(g, opening);
    const status: MatchStatus = app.status === "MATCHED" ? "PROPOSED" : "COMPANY_ACCEPTED";
    const createdAt = app.status === "MATCHED" ? iso(-(1 + (n % 5))) : iso(-40);
    const match: DbMatch = {
      id: newId("mch"),
      graduateId: g.id,
      applicationId: app.id,
      openingId: opening.id,
      score: score.total,
      scoreBreakdown: score.breakdown,
      status,
      createdAt,
      decidedAt: status === "PROPOSED" ? null : iso(-38),
      decisionReason: null,
    };
    db.matches.push(match);
    audit(adminId, "match.proposed", "Match", match.id, null, { status: "PROPOSED", score: score.total });
    if (status === "PROPOSED") continue;

    const supervisor =
      db.members.find((m) => m.companyId === opening.companyId && m.role === "SUPERVISOR") ??
      db.members.find((m) => m.companyId === opening.companyId)!;
    const completed = app.status === "COMPLETED";
    const start = completed ? iso(-130) : iso(-35);
    const end = completed ? iso(-40) : iso(57);
    const placement: DbPlacement = {
      id: newId("plc"),
      matchId: match.id,
      applicationId: app.id,
      graduateId: g.id,
      openingId: opening.id,
      companyId: opening.companyId,
      supervisorId: supervisor.id,
      startDate: start,
      endDate: end,
      status: completed ? "COMPLETED" : "ACTIVE",
      endedAt: completed ? end : null,
      endReason: null,
      offeredPermanentRole: completed && n % 2 === 0,
      permanentOfferDate: completed && n % 2 === 0 ? iso(-42) : null,
      createdAt: start,
    };
    db.placements.push(placement);
    const months = completed ? 3 : 1;
    for (let m = 1; m <= months; m++) {
      db.checkIns.push({
        id: newId("chk"),
        placementId: placement.id,
        authorType: "INTERN",
        month: m,
        progressNote:
          "I'm learning a lot and contributing to weekly content planning. My supervisor gives clear feedback.",
        challenges: m === 1 ? "Getting used to the commute." : null,
        rating: 4,
        createdAt: iso(-30 + m * 28),
      });
      if (completed || n % 2 === 0)
        db.checkIns.push({
          id: newId("chk"),
          placementId: placement.id,
          authorType: "SUPERVISOR",
          month: m,
          progressNote: "Punctual and eager to learn. Improving quickly with our tools.",
          challenges: null,
          rating: 4,
          createdAt: iso(-29 + m * 28),
        });
    }
    if (completed) {
      const scores = [5, 4, 4, 5, 4].map((v, k) => Math.max(3, v - ((n + k) % 2)));
      db.evaluations.push({
        id: newId("evl"),
        placementId: placement.id,
        punctuality: scores[0],
        skill: scores[1],
        communication: scores[2],
        teamwork: scores[3],
        initiative: scores[4],
        overallScore: scores.reduce((a, b) => a + b, 0) / 5,
        comments: "A dependable intern who grew in confidence every month.",
        wouldHire: n % 2 === 0,
        createdAt: iso(-41),
      });
      const certified = n % 4 !== 1; // leave one completed placement waiting for approval
      db.programmeEvaluations.set(placement.id, {
        notes: certified ? "Strong evaluation." : null,
        approvedForCertificate: certified,
        approvedAt: certified ? iso(-39) : null,
      });
      if (certified) {
        const code =
          `${String.fromCharCode(65 + (n % 26))}${"K7QX".slice(0, 3)}${n}-${(29 + n).toString(36).toUpperCase()}MD`.slice(
            0,
            11,
          );
        db.certificates.push({
          id: newId("crt"),
          placementId: placement.id,
          graduateId: g.id,
          serialNumber: `SIIP-2026-${(8000 + n * 37).toString(36).toUpperCase().padStart(8, "0")}`,
          verificationCode: code,
          issuedAt: iso(-38),
        });
      }
    }
  }
}

function seedNotifications() {
  for (const app of db.applications) {
    const g = graduateById(app.graduateId)!;
    for (const e of app.events.slice(-3)) {
      db.notifications.push({
        id: newId("ntf"),
        userId: g.userId,
        type: "application.status_changed",
        title: `Application ${e.toStatus.toLowerCase().replace(/_/g, " ")}`,
        body: `Your application to ${cohortById(app.cohortId)!.name} moved to a new stage.`,
        data: { applicationId: app.id, status: e.toStatus },
        readAt: e === app.events.at(-1) ? null : e.createdAt,
        createdAt: e.createdAt,
      });
    }
  }
  db.notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function seed() {
  const admin = addUser("SIIP Admin", "admin@siip.ng", "SUPER_ADMIN", 200);
  seedCohorts();
  seedCourses();
  seedAssessments();
  seedCompanies(admin.id);
  seedOpenings();
  const firstOf = seedJourney(admin.id);
  seedMatching(admin.id);
  const fresh = makeGraduate(40, false); // signed up, profile not finished, no application
  seedNotifications();

  const owner = db.members.find((m) => m.companyId === db.companies[0].id && m.role === "OWNER")!;
  const supervisor = db.members.find((m) => m.companyId === db.companies[0].id && m.role === "SUPERVISOR")!;
  const pendingOwner = db.members.find((m) => m.companyId === db.companies[7].id && m.role === "OWNER")!;
  const grad = (s: ApplicationStatus) => firstOf[s]!.userId;
  Object.assign(personas, {
    "graduate-new": {
      userId: fresh.userId,
      label: "Graduate · just signed up",
      description: "Profile incomplete, no application yet",
    },
    "graduate-submitted": {
      userId: grad("SUBMITTED"),
      label: "Graduate · applied",
      description: "Application submitted to Cohort 3",
    },
    "graduate-training": {
      userId: grad("IN_TRAINING"),
      label: "Graduate · in training",
      description: "Working through lessons",
    },
    "graduate-assessment": {
      userId: grad("FINAL_ASSESSMENT"),
      label: "Graduate · final assessment",
      description: "Ready to take the final test",
    },
    "graduate-matched": {
      userId: grad("MATCHED"),
      label: "Graduate · matched",
      description: "Waiting for a company decision",
    },
    "graduate-placed": {
      userId: grad("PLACED"),
      label: "Graduate · on internship",
      description: "Month 2 of a 3-month internship",
    },
    "graduate-certified": {
      userId: grad("COMPLETED"),
      label: "Graduate · certified",
      description: "Completed with a certificate",
    },
    "company-owner": {
      userId: owner.userId,
      label: "Company owner",
      description: `${db.companies[0].name} (verified)`,
    },
    "company-pending": {
      userId: pendingOwner.userId,
      label: "Company owner · pending",
      description: `${db.companies[7].name} (awaiting verification)`,
    },
    supervisor: { userId: supervisor.userId, label: "Supervisor", description: `${db.companies[0].name}` },
    admin: { userId: admin.id, label: "SIIP admin", description: "Full admin portal" },
  });
}

seed();
