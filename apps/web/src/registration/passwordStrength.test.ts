import { describe, expect, it } from 'vitest'
import { meetsMinimumPasswordStrength } from './passwordStrength'
import { emptyDraft, validateDraft } from './model'

describe('minimum password strength', () => {
  it.each(['', 'p', 'abcdefgh', '        ', 'abcdefgh1', 'Abcdefgh', 'Abcdefg1', 'abcdefg1!', 'Abcdefg!', 'Ab1!'])('rejects passwords missing any required check: %j', (password) => {
    expect(meetsMinimumPasswordStrength(password)).toBe(false)
    expect(validateDraft({ ...emptyDraft, password, confirmPassword: password }).password).toBeDefined()
  })
  it.each(['Abcdefg1!', 'AnotherStrong2#'])('accepts passwords meeting all checks: %j', (password) => {
    expect(meetsMinimumPasswordStrength(password)).toBe(true)
    expect(validateDraft({ ...emptyDraft, password, confirmPassword: password }).password).toBeUndefined()
  })
})
