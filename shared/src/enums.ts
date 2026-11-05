// GENERATED from backend/prisma/schema.prisma by backend/scripts/sync-shared-enums.mjs. Do not edit.

export const UserRole = {
  GRADUATE: 'GRADUATE',
  COMPANY_MEMBER: 'COMPANY_MEMBER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN'
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]


export const NyscStatus = {
  NOT_YET: 'NOT_YET',
  SERVING: 'SERVING',
  COMPLETED: 'COMPLETED',
  EXEMPTED: 'EXEMPTED'
} as const

export type NyscStatus = (typeof NyscStatus)[keyof typeof NyscStatus]


export const Availability = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  WEEKENDS: 'WEEKENDS',
  FLEXIBLE: 'FLEXIBLE'
} as const

export type Availability = (typeof Availability)[keyof typeof Availability]


export const DegreeClass = {
  FIRST_CLASS: 'FIRST_CLASS',
  SECOND_CLASS_UPPER: 'SECOND_CLASS_UPPER',
  SECOND_CLASS_LOWER: 'SECOND_CLASS_LOWER',
  THIRD_CLASS: 'THIRD_CLASS',
  PASS: 'PASS',
  DISTINCTION: 'DISTINCTION',
  UPPER_CREDIT: 'UPPER_CREDIT',
  LOWER_CREDIT: 'LOWER_CREDIT',
  OTHER: 'OTHER'
} as const

export type DegreeClass = (typeof DegreeClass)[keyof typeof DegreeClass]


export const ProfileVisibility = {
  PRIVATE: 'PRIVATE',
  VERIFIED_COMPANIES: 'VERIFIED_COMPANIES'
} as const

export type ProfileVisibility = (typeof ProfileVisibility)[keyof typeof ProfileVisibility]


export const SkillLevel = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
  EXPERT: 'EXPERT'
} as const

export type SkillLevel = (typeof SkillLevel)[keyof typeof SkillLevel]


export const CohortStatus = {
  DRAFT: 'DRAFT',
  APPLICATIONS_OPEN: 'APPLICATIONS_OPEN',
  APPLICATIONS_CLOSED: 'APPLICATIONS_CLOSED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED'
} as const

export type CohortStatus = (typeof CohortStatus)[keyof typeof CohortStatus]


export const ApplicationStatus = {
  SUBMITTED: 'SUBMITTED',
  SCREENING: 'SCREENING',
  SHORTLISTED: 'SHORTLISTED',
  IN_TRAINING: 'IN_TRAINING',
  FINAL_ASSESSMENT: 'FINAL_ASSESSMENT',
  QUALIFIED: 'QUALIFIED',
  MATCHED: 'MATCHED',
  PLACED: 'PLACED',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN'
} as const

export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus]


export const AssessmentType = {
  SCREENING: 'SCREENING',
  FINAL: 'FINAL'
} as const

export type AssessmentType = (typeof AssessmentType)[keyof typeof AssessmentType]


export const QuestionType = {
  SINGLE_CHOICE: 'SINGLE_CHOICE',
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  SHORT_TEXT: 'SHORT_TEXT'
} as const

export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType]


export const AttemptStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  EXPIRED: 'EXPIRED'
} as const

export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus]


export const CompanyVerificationStatus = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED'
} as const

export type CompanyVerificationStatus = (typeof CompanyVerificationStatus)[keyof typeof CompanyVerificationStatus]


export const CompanyMemberRole = {
  OWNER: 'OWNER',
  SUPERVISOR: 'SUPERVISOR'
} as const

export type CompanyMemberRole = (typeof CompanyMemberRole)[keyof typeof CompanyMemberRole]


export const OpeningStatus = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  CLOSED: 'CLOSED'
} as const

export type OpeningStatus = (typeof OpeningStatus)[keyof typeof OpeningStatus]


export const WorkMode = {
  ONSITE: 'ONSITE',
  REMOTE: 'REMOTE',
  HYBRID: 'HYBRID'
} as const

export type WorkMode = (typeof WorkMode)[keyof typeof WorkMode]


export const WorkSchedule = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  WEEKENDS: 'WEEKENDS'
} as const

export type WorkSchedule = (typeof WorkSchedule)[keyof typeof WorkSchedule]


export const MatchStatus = {
  PROPOSED: 'PROPOSED',
  COMPANY_ACCEPTED: 'COMPANY_ACCEPTED',
  COMPANY_REJECTED: 'COMPANY_REJECTED',
  WITHDRAWN: 'WITHDRAWN'
} as const

export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus]


export const MatchSource = {
  ADMIN: 'ADMIN',
  COMPANY_REQUEST: 'COMPANY_REQUEST'
} as const

export type MatchSource = (typeof MatchSource)[keyof typeof MatchSource]


export const PlacementStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  TERMINATED: 'TERMINATED'
} as const

export type PlacementStatus = (typeof PlacementStatus)[keyof typeof PlacementStatus]


export const CheckInAuthor = {
  INTERN: 'INTERN',
  SUPERVISOR: 'SUPERVISOR'
} as const

export type CheckInAuthor = (typeof CheckInAuthor)[keyof typeof CheckInAuthor]


export const EmailStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED'
} as const

export type EmailStatus = (typeof EmailStatus)[keyof typeof EmailStatus]


export const DataRequestType = {
  EXPORT: 'EXPORT',
  DELETION: 'DELETION'
} as const

export type DataRequestType = (typeof DataRequestType)[keyof typeof DataRequestType]


export const DataRequestStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
} as const

export type DataRequestStatus = (typeof DataRequestStatus)[keyof typeof DataRequestStatus]
