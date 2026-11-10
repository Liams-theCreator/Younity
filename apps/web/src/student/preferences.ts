import {
  academicLevels,
  disciplines,
  interests,
  opportunityFormats,
  type StudentPreferences,
} from '../registration/studentPreferences'

const interestCodes = [
  'HACKATHONS',
  'AI_DATA',
  'STARTUPS_ENTR',
  'ROBOTICS_IOT',
  'UI_UX_DESIGN',
  'PUBLIC_SPEAKING',
  'SOCIAL_IMPACT_NGOS',
  'FINTECH',
  'SCIENTIFIC_RESEARCH',
  'CAREER_FAIRS_NETWORKING',
] as const

const disciplineCodes = [
  'COMPUTER_SCIENCE',
  'BUSINESS_MGMT',
  'ENGINEERING_ROBOTICS',
  'HEALTHCARE_BIOTECH',
  'ARTS_DESIGN',
  'LAW_SOCIAL_SCIENCES',
  'ENVIRONMENT_ARGO',
] as const

const levelCodes = [
  'FIRST_YEAR',
  'SECOND_YEAR',
  'MASTER',
  'PHD',
] as const

const formatCodes = [
  'IN_PERSON',
  'ONLINE',
  'HYBRID',
] as const

export type PreferencesDraft = {
  university: string
  preferences: StudentPreferences
}

export class PreferencesError extends Error {}

function label(
  value: unknown,
  codes: readonly string[],
  labels: readonly string[],
) {
  if (value === null) return ''

  if (typeof value !== 'string' || !codes.includes(value)) {
    throw new PreferencesError(
      'The preferences response could not be verified. Please retry.',
    )
  }

  return labels[codes.indexOf(value)]
}

export function parsePreferences(value: unknown): PreferencesDraft {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('interests' in value) ||
    !Array.isArray(value.interests) ||
    value.interests.some(
      (item) =>
        typeof item !== 'string' ||
        !interestCodes.includes(
          item as typeof interestCodes[number],
        ),
    ) ||
    new Set(value.interests).size !== value.interests.length ||
    !('university' in value) ||
    !(value.university === null || typeof value.university === 'string') ||
    !('academicField' in value) ||
    !('studyLevel' in value) ||
    !('opportunityFormat' in value)
  ) {
    throw new PreferencesError(
      'The preferences response could not be verified. Please retry.',
    )
  }

  return {
    university: value.university ?? '',
    preferences: {
      interests: value.interests.map(
        (code) => interests[interestCodes.indexOf(code)],
      ),
      discipline: label(
        value.academicField,
        disciplineCodes,
        disciplines.map((item) => item.label),
      ),
      academicLevel: label(
        value.studyLevel,
        levelCodes,
        academicLevels,
      ),
      formats: label(
        value.opportunityFormat,
        formatCodes,
        opportunityFormats.map((item) => item.label),
      ),
    },
  }
}

export function preferencesPayload(draft: PreferencesDraft) {
  const selected = draft.preferences.interests.map(
    (name) =>
      interestCodes[
        interests.indexOf(name as typeof interests[number])
      ],
  )

  if (
    selected.length < 2 ||
    selected.some((code) => !code) ||
    new Set(selected).size !== selected.length
  ) {
    throw new PreferencesError(
      'Select at least two different interests.',
    )
  }

  function code(
    value: string,
    labels: readonly string[],
    codes: readonly string[],
  ) {
    if (!value) return null

    const result = codes[labels.indexOf(value)]

    if (!result) {
      throw new PreferencesError(
        'Choose one of the listed academic options.',
      )
    }

    return result
  }

  return {
    interests: selected,
    university: draft.university.trim() || null,
    academicField: code(
      draft.preferences.discipline,
      disciplines.map((item) => item.label),
      disciplineCodes,
    ),
    studyLevel: code(
      draft.preferences.academicLevel,
      academicLevels,
      levelCodes,
    ),
    opportunityFormat: code(
      draft.preferences.formats,
      opportunityFormats.map((item) => item.label),
      formatCodes,
    ),
  }
}

export async function requestPreferences(
  request: typeof fetch,
  signal: AbortSignal,
  draft?: PreferencesDraft,
) {
  let response: Response

  try {
    response = await request('/api/student/preferences', {
      method: draft ? 'PATCH' : 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal,
      ...(draft
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(preferencesPayload(draft)),
          }
        : {}),
    })
  } catch (cause) {
    if (signal.aborted || cause instanceof PreferencesError) {
      throw cause
    }

    throw new PreferencesError(
      'Could not connect. Your changes have not been confirmed; please retry.',
    )
  }

  if (response.status === 401) {
    throw new PreferencesError(
      'Your session expired. Please sign in again.',
    )
  }

  if (response.status === 403) {
    throw new PreferencesError(
      'Preferences require an active student account with a verified email. Verify your email before continuing.',
    )
  }

  if (response.status !== 200) {
    throw new PreferencesError(
      'Preferences could not be loaded or saved. Please retry.',
    )
  }

  return parsePreferences(
    await response.json().catch(() => null),
  )
}