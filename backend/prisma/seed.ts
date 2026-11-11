/* Seed data for local development and demos. Safe to re-run. */
import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import type {
  ApplicationStatus,
  Availability,
  DegreeClass,
  NyscStatus,
  SkillLevel,
  UserRole,
} from "../src/generated/prisma/enums";
import { db } from "../src/server/db";
import { computeCompleteness } from "../src/server/lib/profile-completeness";

const DEMO_PASSWORD = "Password123!";
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysFromNow = (d: number) => new Date(now + d * DAY);

// The skill catalogue, grouped so companies can find skills by area
// (kept in step with the skill_proof migration).
const SKILLS: Array<[string, string]> = [
  ["Graphic Design", "Design and media"],
  ["Video Editing", "Design and media"],
  ["Photo Editing", "Design and media"],
  ["Smartphone Videography", "Design and media"],
  ["Content Creation", "Design and media"],
  ["Social Media Management", "Marketing and sales"],
  ["Digital Marketing", "Marketing and sales"],
  ["Copywriting", "Marketing and sales"],
  ["Sales", "Marketing and sales"],
  ["Web Development", "Technology"],
  ["Basic Web Design", "Technology"],
  ["Accounting", "Business and finance"],
  ["Microsoft Excel", "Business and finance"],
  ["Data Entry", "Business and finance"],
  ["Administration", "Business and finance"],
  ["Research", "Business and finance"],
  ["Customer Service", "Business and finance"],
  ["Translation", "Languages"],
];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function upsertUser(email: string, name: string, role: UserRole, password: string) {
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      role,
      emailVerified: true,
      consentAt: new Date(),
      consentVersion: process.env.CONSENT_VERSION ?? "2026-11-01",
    },
  });
  const hasPassword = await db.account.findFirst({ where: { userId: user.id, providerId: "credential" } });
  if (!hasPassword) {
    await db.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: await hashPassword(password),
      },
    });
  }
  return user;
}

async function seedSkills() {
  for (const [name, category] of SKILLS) {
    await db.skill.upsert({
      where: { slug: slugify(name) },
      update: { category },
      create: { name, slug: slugify(name), category },
    });
  }
  const all = await db.skill.findMany();
  return new Map(all.map((s) => [s.name, s.id]));
}

async function seedCohort() {
  return db.cohort.upsert({
    where: { slug: "cohort-1-2027" },
    update: {},
    create: {
      name: "SIIP Cohort 1 (2027)",
      slug: "cohort-1-2027",
      description: "Pilot cohort: digital, creative and business support skills.",
      applicationOpensAt: daysFromNow(-30),
      applicationClosesAt: daysFromNow(30),
      trainingStartsAt: daysFromNow(40),
      trainingEndsAt: daysFromNow(80),
      internshipStartsAt: daysFromNow(90),
      internshipEndsAt: daysFromNow(180),
      capacity: 200,
      status: "APPLICATIONS_OPEN",
    },
  });
}

async function seedCourse(cohortId: string) {
  if (await db.course.findFirst({ where: { cohortId } })) return;
  await db.course.create({
    data: {
      cohortId,
      title: "Workplace Readiness & Digital Skills",
      description: "Core training every SIIP intern completes before placement.",
      order: 1,
      published: true,
      modules: {
        create: [
          {
            title: "Professional Foundations",
            order: 1,
            lessons: {
              create: [
                {
                  title: "Workplace etiquette in Nigerian organisations",
                  order: 1,
                  estimatedMinutes: 20,
                  content: "Punctuality, dress code, communication with supervisors, and handling feedback.",
                },
                {
                  title: "Writing professional emails",
                  order: 2,
                  estimatedMinutes: 15,
                  content: "Subject lines, tone, structure and follow-up.",
                },
              ],
            },
          },
          {
            title: "Digital Tools",
            order: 2,
            lessons: {
              create: [
                {
                  title: "Microsoft Excel essentials",
                  order: 1,
                  estimatedMinutes: 40,
                  videoUrl: "https://www.youtube.com/watch?v=Vl0H-qTclOg",
                },
                {
                  title: "Creating content with a smartphone",
                  order: 2,
                  estimatedMinutes: 30,
                  content: "Framing, lighting, audio and editing on mobile.",
                },
              ],
            },
          },
        ],
      },
    },
  });
}

async function seedAssessments(cohortId: string) {
  if (await db.assessment.findFirst({ where: { cohortId, type: "SCREENING" } })) return;
  await db.assessment.create({
    data: {
      cohortId,
      type: "SCREENING",
      title: "SIIP Screening Test",
      description: "General aptitude and workplace judgement. 15 minutes.",
      timeLimitMinutes: 15,
      passMark: 60,
      maxAttempts: 1,
      published: true,
      questions: {
        create: [
          {
            type: "SINGLE_CHOICE",
            prompt: "Your supervisor gives you a task you don't understand. What should you do first?",
            order: 1,
            acceptedAnswers: [],
            options: {
              create: [
                { text: "Ask clarifying questions", isCorrect: true, order: 1 },
                { text: "Guess and submit quickly", order: 2 },
                { text: "Ignore it until reminded", order: 3 },
              ],
            },
          },
          {
            type: "MULTIPLE_CHOICE",
            prompt: "Which of these are spreadsheet applications?",
            order: 2,
            points: 2,
            acceptedAnswers: [],
            options: {
              create: [
                { text: "Microsoft Excel", isCorrect: true, order: 1 },
                { text: "Google Sheets", isCorrect: true, order: 2 },
                { text: "Adobe Premiere", order: 3 },
              ],
            },
          },
          {
            type: "SINGLE_CHOICE",
            prompt: "What is 15% of 2,000?",
            order: 3,
            acceptedAnswers: [],
            options: {
              create: [
                { text: "150", order: 1 },
                { text: "300", isCorrect: true, order: 2 },
                { text: "30", order: 3 },
              ],
            },
          },
          {
            type: "SHORT_TEXT",
            prompt: "What does the abbreviation 'CV' stand for?",
            order: 4,
            acceptedAnswers: ["curriculum vitae"],
          },
        ],
      },
    },
  });
  await db.assessment.create({
    data: {
      cohortId,
      type: "FINAL",
      title: "SIIP Final Assessment",
      timeLimitMinutes: 30,
      passMark: 65,
      maxAttempts: 2,
      published: true,
      questions: {
        create: [
          {
            type: "SINGLE_CHOICE",
            prompt: "Which Excel function adds a range of cells?",
            order: 1,
            acceptedAnswers: [],
            options: {
              create: [
                { text: "SUM", isCorrect: true, order: 1 },
                { text: "COUNT", order: 2 },
                { text: "VLOOKUP", order: 3 },
              ],
            },
          },
        ],
      },
    },
  });
}

interface CompanySeed {
  name: string;
  rcNumber: string;
  industry: string;
  state: string;
  address: string;
  ownerEmail: string;
  ownerName: string;
  opening: {
    title: string;
    department: string;
    skills: string[];
    disciplines: string[];
    workMode: "ONSITE" | "REMOTE" | "HYBRID";
    schedule: "FULL_TIME" | "PART_TIME" | "WEEKENDS";
  };
}

const COMPANIES: CompanySeed[] = [
  {
    name: "Lagos Media Hub Ltd",
    rcNumber: "RC1234567",
    industry: "Media & Communications",
    state: "Lagos",
    address: "12 Admiralty Way, Lekki Phase 1, Lagos",
    ownerEmail: "owner@lagosmediahub.test",
    ownerName: "Tolu Adeyemi",
    opening: {
      title: "Social Media & Content Intern",
      department: "Marketing",
      skills: ["Social Media Management", "Content Creation", "Smartphone Videography", "Video Editing"],
      disciplines: ["Mass Communication", "Marketing", "English"],
      workMode: "HYBRID",
      schedule: "FULL_TIME",
    },
  },
  {
    name: "Abuja Business Services Plc",
    rcNumber: "RC7654321",
    industry: "Professional Services",
    state: "FCT",
    address: "Plot 45 Ahmadu Bello Way, Wuse 2, Abuja",
    ownerEmail: "owner@abujabiz.test",
    ownerName: "Ibrahim Musa",
    opening: {
      title: "Administrative & Data Intern",
      department: "Operations",
      skills: ["Microsoft Excel", "Data Entry", "Administration", "Customer Service"],
      disciplines: ["Business Administration", "Accounting", "Economics"],
      workMode: "ONSITE",
      schedule: "FULL_TIME",
    },
  },
];

async function seedCompanies(skillIds: Map<string, string>, cohortId: string) {
  const result: Array<{ companyId: string; openingId: string; ownerMemberId: string }> = [];
  for (const c of COMPANIES) {
    const owner = await upsertUser(c.ownerEmail, c.ownerName, "COMPANY_MEMBER", DEMO_PASSWORD);
    const company = await db.company.upsert({
      where: { rcNumber: c.rcNumber },
      update: {},
      create: {
        name: c.name,
        rcNumber: c.rcNumber,
        industry: c.industry,
        country: "NG",
        city: c.state === "FCT" ? "Abuja" : c.state,
        timeZone: "Africa/Lagos",
        state: c.state,
        address: c.address,
        verificationStatus: "VERIFIED",
        verifiedAt: new Date(),
      },
    });
    const member = await db.companyMember.upsert({
      where: { userId: owner.id },
      update: {},
      create: { companyId: company.id, userId: owner.id, role: "OWNER", jobTitle: "HR Manager" },
    });
    let opening = await db.internshipOpening.findFirst({
      where: { companyId: company.id, title: c.opening.title },
    });
    opening ??= await db.internshipOpening.create({
      data: {
        companyId: company.id,
        cohortId,
        title: c.opening.title,
        department: c.opening.department,
        description: `Join ${c.name} for a 3-month internship in ${c.opening.department}.`,
        slots: 3,
        preferredDisciplines: c.opening.disciplines,
        ...(c.opening.workMode === "REMOTE"
          ? {}
          : { country: "NG", city: c.state === "FCT" ? "Abuja" : c.state, state: c.state }),
        workMode: c.opening.workMode,
        schedule: c.opening.schedule,
        openToNysc: true,
        durationWeeks: 12,
        mayLeadToFullTime: c.opening.workMode !== "REMOTE",
        status: "OPEN",
        createdById: owner.id,
        skills: {
          create: c.opening.skills.map((name, i) => ({ skillId: skillIds.get(name)!, required: i < 2 })),
        },
      },
    });
    result.push({ companyId: company.id, openingId: opening.id, ownerMemberId: member.id });
  }
  return result;
}

interface GraduateSeed {
  first: string;
  last: string;
  state: string;
  institution: string;
  course: string;
  degreeClass: DegreeClass;
  nysc: NyscStatus;
  availability: Availability;
  skills: Array<[string, SkillLevel]>;
  status: ApplicationStatus;
}

const GRADUATES: GraduateSeed[] = [
  {
    first: "Chidinma",
    last: "Okafor",
    state: "Lagos",
    institution: "University of Lagos",
    course: "Mass Communication",
    degreeClass: "SECOND_CLASS_UPPER",
    nysc: "COMPLETED",
    availability: "FULL_TIME",
    skills: [
      ["Social Media Management", "ADVANCED"],
      ["Content Creation", "INTERMEDIATE"],
    ],
    status: "SUBMITTED",
  },
  {
    first: "Emeka",
    last: "Nwosu",
    state: "Enugu",
    institution: "University of Nigeria, Nsukka",
    course: "Marketing",
    degreeClass: "SECOND_CLASS_LOWER",
    nysc: "NOT_YET",
    availability: "FULL_TIME",
    skills: [
      ["Digital Marketing", "INTERMEDIATE"],
      ["Sales", "BEGINNER"],
    ],
    status: "SCREENING",
  },
  {
    first: "Aisha",
    last: "Bello",
    state: "Kano",
    institution: "Bayero University Kano",
    course: "Economics",
    degreeClass: "SECOND_CLASS_UPPER",
    nysc: "SERVING",
    availability: "PART_TIME",
    skills: [
      ["Microsoft Excel", "ADVANCED"],
      ["Research", "INTERMEDIATE"],
    ],
    status: "SHORTLISTED",
  },
  {
    first: "Tunde",
    last: "Bakare",
    state: "Oyo",
    institution: "University of Ibadan",
    course: "English",
    degreeClass: "SECOND_CLASS_UPPER",
    nysc: "COMPLETED",
    availability: "FLEXIBLE",
    skills: [
      ["Copywriting", "ADVANCED"],
      ["Content Creation", "INTERMEDIATE"],
    ],
    status: "IN_TRAINING",
  },
  {
    first: "Ngozi",
    last: "Eze",
    state: "Anambra",
    institution: "Nnamdi Azikiwe University",
    course: "Accounting",
    degreeClass: "FIRST_CLASS",
    nysc: "EXEMPTED",
    availability: "FULL_TIME",
    skills: [
      ["Microsoft Excel", "EXPERT"],
      ["Data Entry", "ADVANCED"],
    ],
    status: "FINAL_ASSESSMENT",
  },
  {
    first: "Ibrahim",
    last: "Sule",
    state: "FCT",
    institution: "University of Abuja",
    course: "Business Administration",
    degreeClass: "SECOND_CLASS_LOWER",
    nysc: "COMPLETED",
    availability: "FULL_TIME",
    skills: [
      ["Administration", "ADVANCED"],
      ["Microsoft Excel", "INTERMEDIATE"],
      ["Customer Service", "ADVANCED"],
      ["Data Entry", "INTERMEDIATE"],
    ],
    status: "QUALIFIED",
  },
  {
    first: "Funke",
    last: "Adebayo",
    state: "Lagos",
    institution: "Lagos State University",
    course: "Mass Communication",
    degreeClass: "SECOND_CLASS_UPPER",
    nysc: "SERVING",
    availability: "FULL_TIME",
    skills: [
      ["Social Media Management", "ADVANCED"],
      ["Smartphone Videography", "ADVANCED"],
      ["Video Editing", "INTERMEDIATE"],
    ],
    status: "QUALIFIED",
  },
  {
    first: "Yusuf",
    last: "Abdullahi",
    state: "Kaduna",
    institution: "Ahmadu Bello University",
    course: "Accounting",
    degreeClass: "SECOND_CLASS_UPPER",
    nysc: "COMPLETED",
    availability: "FULL_TIME",
    skills: [
      ["Microsoft Excel", "ADVANCED"],
      ["Data Entry", "ADVANCED"],
      ["Administration", "INTERMEDIATE"],
    ],
    status: "MATCHED",
  },
  {
    first: "Blessing",
    last: "Udo",
    state: "Lagos",
    institution: "Covenant University",
    course: "Marketing",
    degreeClass: "SECOND_CLASS_UPPER",
    nysc: "COMPLETED",
    availability: "FULL_TIME",
    skills: [
      ["Content Creation", "ADVANCED"],
      ["Social Media Management", "ADVANCED"],
      ["Graphic Design", "INTERMEDIATE"],
    ],
    status: "PLACED",
  },
  {
    first: "Kelechi",
    last: "Obi",
    state: "FCT",
    institution: "University of Abuja",
    course: "Economics",
    degreeClass: "FIRST_CLASS",
    nysc: "COMPLETED",
    availability: "FULL_TIME",
    skills: [
      ["Microsoft Excel", "EXPERT"],
      ["Customer Service", "ADVANCED"],
      ["Administration", "ADVANCED"],
    ],
    status: "COMPLETED",
  },
];

// Ordered path through the programme; used to build a realistic timeline.
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

async function seedGraduates(
  skillIds: Map<string, string>,
  cohortId: string,
  companies: Array<{ companyId: string; openingId: string; ownerMemberId: string }>,
  adminId: string,
) {
  for (const [i, g] of GRADUATES.entries()) {
    const email = `${g.first}.${g.last}@graduate.test`.toLowerCase();
    const user = await upsertUser(email, `${g.first} ${g.last}`, "GRADUATE", DEMO_PASSWORD);
    if (await db.graduateProfile.findUnique({ where: { userId: user.id } })) continue;

    const fields = {
      phone: `+23480${String(10000000 + i).padStart(8, "0")}`,
      country: "NG",
      city: g.state === "FCT" ? "Abuja" : g.state,
      workPreference: (["HYBRID", "ONSITE", "REMOTE"] as const)[i % 3],
      stateOfResidence: g.state,
      lga: null,
      institution: g.institution,
      courseOfStudy: g.course,
      degreeClass: g.degreeClass,
      graduationYear: 2025,
      availability: g.availability,
      bio: `${g.course} graduate from ${g.institution}.`,
    };
    const verified = ["FINAL_ASSESSMENT", "QUALIFIED", "MATCHED", "PLACED", "COMPLETED"].includes(g.status);
    const profile = await db.graduateProfile.create({
      data: {
        userId: user.id,
        firstName: g.first,
        lastName: g.last,
        nyscStatus: g.nysc,
        internType: g.nysc === "SERVING" ? "NYSC_CORPS_MEMBER" : "GRADUATE",
        ...fields,
        // Demo profiles have no CV or photo (no Cloudinary assets in the seed).
        completenessScore: computeCompleteness({
          ...fields,
          cvPublicId: null,
          photoUrl: null,
          skillCount: g.skills.length,
        }),
        // Interns further along have proof that SIIP has checked; earlier ones are pending.
        reviewStatus: verified ? "APPROVED" : g.status === "SUBMITTED" ? "DRAFT" : "SUBMITTED",
        submittedAt: g.status === "SUBMITTED" ? null : new Date(now - 20 * DAY),
        reviewedAt: verified ? new Date(now - 15 * DAY) : null,
        skills: {
          create: g.skills.map(([name, level]) => ({
            skillId: skillIds.get(name)!,
            level,
            ...(verified ? { status: "VERIFIED" as const, verifiedLevel: level, reviewedAt: new Date(now - 15 * DAY) } : {}),
            documents: {
              create: { kind: "LINK" as const, url: `https://www.coursera.org/verify/${slugify(`${g.first}-${name}`)}` },
            },
          })),
        },
      },
    });

    const steps = PATH.slice(0, PATH.indexOf(g.status) + 1);
    const application = await db.application.create({
      data: {
        graduateId: profile.id,
        cohortId,
        status: g.status,
        motivation: "I want to gain real workplace experience.",
        events: {
          create: steps.map((to, idx) => ({
            fromStatus: idx === 0 ? null : steps[idx - 1],
            toStatus: to,
            actorId: idx === 0 ? user.id : adminId,
            createdAt: new Date(now - (steps.length - idx) * 3 * DAY),
          })),
        },
      },
    });

    if (["MATCHED", "PLACED", "COMPLETED"].includes(g.status)) {
      // Lagos media graduates go to the Lagos company; everyone else to Abuja.
      const target =
        g.course === "Marketing" || g.course === "Mass Communication" ? companies[0] : companies[1];
      const match = await db.match.create({
        data: {
          graduateId: profile.id,
          applicationId: application.id,
          openingId: target.openingId,
          score: 78,
          scoreBreakdown: { note: "seeded" },
          status: g.status === "MATCHED" ? "PROPOSED" : "COMPANY_ACCEPTED",
          proposedById: adminId,
          decidedAt: g.status === "MATCHED" ? null : daysFromNow(-60),
        },
      });
      if (g.status !== "MATCHED") {
        const completed = g.status === "COMPLETED";
        const placement = await db.placement.create({
          data: {
            matchId: match.id,
            applicationId: application.id,
            graduateId: profile.id,
            openingId: target.openingId,
            companyId: target.companyId,
            supervisorId: target.ownerMemberId,
            startDate: daysFromNow(completed ? -100 : -30),
            endDate: daysFromNow(completed ? -10 : 60),
            status: completed ? "COMPLETED" : "ACTIVE",
            endedAt: completed ? daysFromNow(-10) : null,
          },
        });
        if (completed) {
          await db.evaluation.create({
            data: {
              placementId: placement.id,
              submittedById: adminId,
              punctuality: 5,
              skill: 4,
              communication: 5,
              teamwork: 4,
              initiative: 5,
              overallScore: 4.6,
              comments: "Excellent intern. Reliable and proactive.",
              wouldHire: true,
            },
          });
        }
      }
    }
  }
}

async function main() {
  const adminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@siip.local";
  const adminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (!adminPassword) throw new Error("Set SEED_SUPER_ADMIN_PASSWORD before seeding");

  const admin = await upsertUser(adminEmail, "SIIP Super Admin", "SUPER_ADMIN", adminPassword);
  const skillIds = await seedSkills();
  const cohort = await seedCohort();
  await seedCourse(cohort.id);
  await seedAssessments(cohort.id);
  const companies = await seedCompanies(skillIds, cohort.id);
  await seedGraduates(skillIds, cohort.id, companies, admin.id);

  console.log(
    `Seed complete. Super admin: ${adminEmail}. Demo graduates and company owners use password "${DEMO_PASSWORD}".`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
