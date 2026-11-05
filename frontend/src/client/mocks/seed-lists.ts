// Static reference data for the mock dataset.
import { NIGERIAN_STATES } from "@siip/shared/nigeria";

export { NIGERIAN_STATES };

export const SKILLS: Array<[string, string]> = [
  ["Social Media Management", "Digital"],
  ["Content Creation", "Creative"],
  ["Smartphone Videography", "Creative"],
  ["Video Editing", "Creative"],
  ["Photo Editing", "Creative"],
  ["Graphic Design", "Creative"],
  ["Digital Marketing", "Digital"],
  ["Customer Service", "Business"],
  ["Data Entry", "Office"],
  ["Microsoft Excel", "Office"],
  ["Copywriting", "Creative"],
  ["Basic Web Design", "Digital"],
  ["Sales", "Business"],
  ["Administration", "Office"],
  ["Research", "Business"],
];

export const FIRST_NAMES = [
  "Amaka",
  "Chidinma",
  "Emeka",
  "Aisha",
  "Tunde",
  "Ngozi",
  "Ifeanyi",
  "Zainab",
  "Olumide",
  "Fatima",
  "Chukwuemeka",
  "Funmilayo",
  "Ibrahim",
  "Adaeze",
  "Segun",
  "Halima",
  "Obinna",
  "Yetunde",
  "Musa",
  "Kemi",
  "Uche",
  "Bisola",
  "Abdullahi",
  "Chiamaka",
  "Femi",
  "Hauwa",
  "Nnamdi",
  "Temitope",
  "Usman",
  "Ebere",
  "Dayo",
  "Amina",
  "Kelechi",
  "Folake",
  "Sani",
  "Nkechi",
  "Bolaji",
  "Maryam",
  "Chinedu",
  "Ronke",
  "Tolu",
];

export const LAST_NAMES = [
  "Okafor",
  "Nwosu",
  "Bello",
  "Bakare",
  "Adeyemi",
  "Eze",
  "Musa",
  "Okonkwo",
  "Abubakar",
  "Ogunleye",
  "Obi",
  "Lawal",
  "Danjuma",
  "Nwachukwu",
  "Ojo",
  "Usman",
  "Chukwu",
  "Adebayo",
  "Ibrahim",
  "Afolabi",
  "Onyeka",
  "Salisu",
  "Ekwueme",
  "Olaniyan",
  "Garba",
  "Udeh",
  "Oyelaran",
  "Yakubu",
  "Anyanwu",
  "Fashola",
];

export const INSTITUTIONS = [
  "University of Lagos",
  "University of Ibadan",
  "Obafemi Awolowo University",
  "University of Nigeria, Nsukka",
  "Ahmadu Bello University",
  "Bayero University Kano",
  "University of Benin",
  "University of Port Harcourt",
  "Covenant University",
  "Lagos State University",
  "Nnamdi Azikiwe University",
  "University of Ilorin",
  "Federal University of Technology, Akure",
  "Yaba College of Technology",
  "Auchi Polytechnic",
  "Babcock University",
];

export const COURSES = [
  "Mass Communication",
  "Marketing",
  "Economics",
  "Business Administration",
  "Computer Science",
  "Accounting",
  "English Language",
  "Fine and Applied Arts",
  "Sociology",
  "Statistics",
  "Banking and Finance",
  "Theatre Arts",
  "Office Technology and Management",
  "Political Science",
];

export const COMPANIES: Array<{
  name: string;
  industry: string;
  state: string;
  address: string;
  website: string;
}> = [
  {
    name: "Lagos Media Hub",
    industry: "Media and entertainment",
    state: "Lagos",
    address: "14 Admiralty Way, Lekki Phase 1",
    website: "https://lagosmediahub.ng",
  },
  {
    name: "Kudi Pay",
    industry: "Financial technology",
    state: "Lagos",
    address: "3 Adeola Odeku Street, Victoria Island",
    website: "https://kudipay.ng",
  },
  {
    name: "Zuma Foods",
    industry: "FMCG",
    state: "FCT",
    address: "Plot 112 Idu Industrial Area, Abuja",
    website: "https://zumafoods.ng",
  },
  {
    name: "Niger Delta Energy Services",
    industry: "Oil and gas services",
    state: "Rivers",
    address: "21 Aba Road, Port Harcourt",
    website: "https://ndes.ng",
  },
  {
    name: "Abuja Business Partners",
    industry: "Consulting",
    state: "FCT",
    address: "5 Aminu Kano Crescent, Wuse 2",
    website: "https://abp.ng",
  },
  {
    name: "Eko Creative Studio",
    industry: "Design and advertising",
    state: "Lagos",
    address: "9 Herbert Macaulay Way, Yaba",
    website: "https://ekocreative.ng",
  },
  {
    name: "Ìrètí Foundation",
    industry: "Non-profit",
    state: "FCT",
    address: "17 Gana Street, Maitama",
    website: "https://ireti.org.ng",
  },
  {
    name: "Garden City Retail",
    industry: "Retail",
    state: "Rivers",
    address: "40 Trans-Amadi Road, Port Harcourt",
    website: "https://gardencityretail.ng",
  },
];

export const OPENING_TITLES: Array<{
  title: string;
  department: string;
  skills: string[];
  disciplines: string[];
}> = [
  {
    title: "Social Media Intern",
    department: "Marketing",
    skills: ["Social Media Management", "Content Creation", "Copywriting"],
    disciplines: ["Mass Communication", "Marketing"],
  },
  {
    title: "Video Content Intern",
    department: "Studio",
    skills: ["Smartphone Videography", "Video Editing", "Content Creation"],
    disciplines: ["Theatre Arts", "Mass Communication"],
  },
  {
    title: "Customer Success Intern",
    department: "Operations",
    skills: ["Customer Service", "Data Entry"],
    disciplines: [],
  },
  {
    title: "Finance Operations Intern",
    department: "Finance",
    skills: ["Microsoft Excel", "Data Entry", "Research"],
    disciplines: ["Accounting", "Banking and Finance", "Economics"],
  },
  {
    title: "Graphic Design Intern",
    department: "Creative",
    skills: ["Graphic Design", "Photo Editing"],
    disciplines: ["Fine and Applied Arts"],
  },
  {
    title: "Sales Associate Intern",
    department: "Sales",
    skills: ["Sales", "Customer Service"],
    disciplines: ["Marketing", "Business Administration"],
  },
  {
    title: "Admin and Office Intern",
    department: "Admin",
    skills: ["Administration", "Microsoft Excel"],
    disciplines: ["Office Technology and Management", "Business Administration"],
  },
  {
    title: "Digital Marketing Intern",
    department: "Growth",
    skills: ["Digital Marketing", "Social Media Management", "Copywriting"],
    disciplines: ["Marketing", "Mass Communication"],
  },
  {
    title: "Research Assistant Intern",
    department: "Programmes",
    skills: ["Research", "Data Entry", "Microsoft Excel"],
    disciplines: ["Sociology", "Economics", "Statistics"],
  },
  {
    title: "Web Content Intern",
    department: "Digital",
    skills: ["Basic Web Design", "Copywriting"],
    disciplines: ["Computer Science", "English Language"],
  },
];
