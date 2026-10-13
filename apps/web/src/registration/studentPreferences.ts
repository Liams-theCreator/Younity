// Diagram mappings, in display order:
// academic_field: COMPUTER_SCIENCE, BUSINESS_MGMT, ENGINEERING_ROBOTICS,
// HEALTHCARE_BIOTECH, ARTS_DESIGN, LAW_SOCIAL_SCIENCES, ENVIRONMENT_ARGO.
// study_level: FIRST_YEAR, SECOND_YEAR, THIRD_YEAR, MASTER, PHD.
// interests: HACKATHONS, AI_DATA, STARTUPS_ENTR, ROBOTICS_IOT, UI_UX_DESIGN,
// PUBLIC_SPEAKING, SOCIAL_IMPACT_NGOS, FINTECH, SCIENTIFIC_RESEARCH,
// CAREER_FAIRS_NETWORKING. student_interests separately references categories.
// opportunity_format: IN_PERSON, ONLINE, HYBRID (diagram: OppotunityFormat).
// Multiple interest choices are local UI state; category IDs for student_interests
// need an explicit backend mapping, rather than writing an array to the enum.
// These local display values are not a submission DTO.
export const disciplines = [
  { label: 'Computer Science & AI', detail: 'Software, Cloud, Systems', icon: 'code' },
  { label: 'Business & Mgmt', detail: 'Finance, Marketing, Strategy', icon: 'chart' },
  { label: 'Engineering & Robotics', detail: 'Mechanical, Civil, Mechatronics', icon: 'tools' },
  { label: 'Healthcare & Biotech', detail: 'Medicine, Pharma, Genetics', icon: 'shield' },
  { label: 'Arts & Design', detail: 'Architecture, Graphic, Media', icon: 'palette' },
  { label: 'Law & Social Sciences', detail: 'Diplomacy, Policy, Human Rights', icon: 'balance' },
  { label: 'Environment & Agro', detail: 'Climate, Water, Sustainable Dev', icon: 'leaf' },
] as const
export const academicLevels = ['First Year (CPGE / L1)', 'Second Year (L2)', 'Third Year (L3)', 'Master / Ingénieur', 'PhD / Doctorate'] as const
export const interests = ['Hackathons & Coding Competitions', 'AI & Data Science', 'Startups & Entrepreneurship', 'Robotics & Smart IoT', 'UI/UX & Product Design', 'Public Speaking & Debate', 'Social Impact & Civic NGOs', 'Fintech, Banking & Consulting', 'Scientific Research & Publishing', 'Career Fairs & Executive Networking'] as const
export const opportunityFormats = [
  { label: 'In-person Campus Events', detail: 'Conferences, university amphitheatres & local meetups' },
  { label: 'Online Events', detail: 'Online sprints and nationwide challenges' },
  { label: 'Hybrid Events', detail: 'Events with in-person and online participation' },
] as const
export type StudentPreferences = {
  discipline: string
  academicLevel: string
  interests: string[]
  formats: string
}
export type PreferenceErrors = Partial<Record<keyof StudentPreferences, string>>
export const emptyPreferences: StudentPreferences = { discipline: '', academicLevel: '', interests: [], formats: '' }
export function validatePreferences(preferences: StudentPreferences): PreferenceErrors {
  const errors: PreferenceErrors = {}
  if (preferences.discipline && !disciplines.some(option => option.label === preferences.discipline)) errors.discipline = 'Choose your primary field of study.'
  if (preferences.academicLevel && !academicLevels.some(option => option === preferences.academicLevel)) errors.academicLevel = 'Choose your current academic level.'
  if (preferences.interests.some(value => !interests.some(option => option === value)) || new Set(preferences.interests).size !== preferences.interests.length) errors.interests = 'Choose a listed interest.'
  if (preferences.formats && !opportunityFormats.some(option => option.label === preferences.formats)) errors.formats = 'Choose a listed format.'
  return errors
}
