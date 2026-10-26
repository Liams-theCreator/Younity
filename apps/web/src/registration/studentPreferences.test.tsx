import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StudentPreferencesForm from '../components/StudentPreferencesForm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  emptyPreferences,
  validatePreferences,
  disciplines,
  opportunityFormats,
} from './studentPreferences'
describe('database preference options', () => {
  it('allows field of study and academic level to be omitted', () => {
    expect(validatePreferences(emptyPreferences)).toEqual({})
    expect(
      validatePreferences({ ...emptyPreferences, discipline: 'Computer Science & AI' }),
    ).toEqual({})
    expect(
      validatePreferences({ ...emptyPreferences, academicLevel: 'Master / Ingénieur' }),
    ).toEqual({})
  })
  it('rejects unsupported values without requiring a minimum interest count', () => {
    expect(
      validatePreferences({
        ...emptyPreferences,
        discipline: 'Computer Science & AI',
        academicLevel: 'Master / Ingénieur',
      }),
    ).toEqual({})
    expect(
      validatePreferences({
        ...emptyPreferences,
        discipline: 'unknown',
        academicLevel: 'unknown',
        interests: ['unknown'],
        formats: 'unknown',
      }),
    ).toEqual({
      discipline: expect.any(String),
      academicLevel: expect.any(String),
      interests: expect.any(String),
      formats: expect.any(String),
    })
    expect(disciplines.some((option) => String(option.label) === 'Interdisciplinary')).toBe(false)
    expect(
      opportunityFormats.some((option) => String(option.label) === 'Certified Bootcamps'),
    ).toBe(false)
  })
})

const onSubmit = vi.fn()
const onSkip = vi.fn()
beforeEach(() => { onSubmit.mockClear(); onSkip.mockClear() })

function PreferencesHarness() {
  const [preferences, setPreferences] = useState({ ...emptyPreferences })
  return (
    <StudentPreferencesForm preferences={preferences} onChange={setPreferences} onBack={() => {}} onSubmit={onSubmit} onSkip={onSkip} />
  )
}

it('labels academic preferences optional and allows submission without selections', async () => {
  const user = userEvent.setup()
  render(<PreferencesHarness />)
  expect(screen.getAllByText('OPTIONAL')).toHaveLength(2)
  await user.click(screen.getByRole('button', { name: 'Create student account' }))
  expect(onSubmit).toHaveBeenCalledOnce()
  await user.click(screen.getByRole('button', { name: /Skip for now/ }))
  expect(onSkip).toHaveBeenCalledOnce()
  expect(screen.queryByText('Choose your primary field of study.')).not.toBeInTheDocument()
  expect(screen.queryByText('Choose your current academic level.')).not.toBeInTheDocument()
})

it('toggles choices off and allows multiple interests with mouse and keyboard', async () => {
  const user = userEvent.setup()
  render(<PreferencesHarness />)
  for (const name of [/Computer Science & AI/, 'Second Year (L2)', /Hybrid Events/]) {
    const option = screen.getByRole('checkbox', { name })
    await user.click(option)
    expect(option).toBeChecked()
    await user.click(option)
    expect(option).not.toBeChecked()
  }
  const ai = screen.getByRole('checkbox', { name: /AI & Data Science/ })
  const coding = screen.getByRole('checkbox', { name: /Hackathons & Coding/ })
  await user.click(ai)
  await user.click(coding)
  expect(ai).toBeChecked()
  expect(coding).toBeChecked()
  await user.keyboard(' ')
  expect(coding).not.toBeChecked()
  expect(ai).toBeChecked()
  await user.click(ai)
  expect(ai).not.toBeChecked()
})

it('keeps discipline and level exclusive while allowing deselection', async () => {
  const user = userEvent.setup()
  render(<PreferencesHarness />)
  await user.click(screen.getByRole('checkbox', { name: /Computer Science & AI/ }))
  await user.click(screen.getByRole('checkbox', { name: /Business & Mgmt/ }))
  expect(screen.getByRole('checkbox', { name: /Computer Science & AI/ })).not.toBeChecked()
  expect(screen.getByRole('checkbox', { name: /Business & Mgmt/ })).toBeChecked()
})
