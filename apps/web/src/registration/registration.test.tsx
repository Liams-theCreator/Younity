import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import StudentRegisterPage from '../pages/StudentRegisterPage'
import { emptyDraft, validateStudentDraft } from './model'

describe('local registration', () => {
  it('validates email and confirmation with all password checks required', () => {
    const draft = {
      ...emptyDraft,
      firstName: 'A',
      lastName: 'B',
      university: 'ENSIAS',
      email: 'a@b.ma',
      password: 'Abcdefg1!',
      confirmPassword: 'Abcdefg1!',
      acceptedPolicies: true,
    }
    expect(validateStudentDraft(draft)).toEqual({})
    expect(validateStudentDraft({ ...draft, email: 'bad', confirmPassword: 'q' })).toMatchObject({
      email: expect.any(String),
      confirmPassword: 'Passwords must match.',
    })
  })
  it('focuses errors and preserves both student steps without fake success', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <StudentRegisterPage />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Create student account' }))
    expect(screen.getByLabelText('First Name')).toHaveFocus()
    expect(screen.getByLabelText('Last Name')).toHaveAccessibleDescription('Enter your last name.')
    for (const [label, value] of [
      ['First Name', 'Yassine'],
      ['Last Name', 'Amrani'],
      ['Email Address', 'a@b.ma'],
      ['Account Password', 'Abcdefg1!'],
      ['Confirm password', 'Abcdefg1!'],
    ])
      await user.type(screen.getByLabelText(label, { exact: true }), value)
    await user.selectOptions(screen.getByLabelText('University / Academic Institution'), 'Other')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Continue to preferences' }))
    expect(screen.getByLabelText('Custom University / Academic Institution')).toHaveFocus()
    expect(screen.getByText('Enter your institution name.')).toBeVisible()
    await user.type(screen.getByLabelText('Custom University / Academic Institution'), 'Custom Institute')
    await user.click(screen.getByRole('button', { name: 'Create student account' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Backend integration is not available')
    await user.click(screen.getByRole('button', { name: 'Continue to preferences' }))
    await user.click(screen.getByRole('checkbox', { name: /Computer Science & AI/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Second Year (L2)' }))
    await user.click(screen.getByRole('checkbox', { name: /AI & Data Science/ }))
    await user.click(screen.getByRole('checkbox', { name: /Hybrid Events/ }))
    await user.click(screen.getByRole('button', { name: 'Back to Account Info' }))
    expect(screen.getByLabelText('University / Academic Institution')).toHaveValue('Other')
    expect(screen.getByLabelText('Custom University / Academic Institution')).toHaveValue('Custom Institute')
    expect(screen.getByLabelText('Account Password', { exact: true })).toHaveValue('Abcdefg1!')
    await user.click(screen.getByRole('button', { name: 'Continue to preferences' }))
    expect(screen.getByRole('checkbox', { name: /Hybrid Events/ })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Review registration availability' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No account was created and no preferences were sent',
    )
  })
})
