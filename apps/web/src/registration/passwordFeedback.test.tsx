import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import PasswordFeedback from '../components/PasswordFeedback'
import StudentRegisterPage from '../pages/StudentRegisterPage'
import OrganizerRegisterPage from '../pages/OrganizerRegisterPage'

// This destination is a test fixture, not an approved production login route.
const testSignInPath = '/approved-test-sign-in'

describe('password feedback and sign-in footer', () => {
  it('starts empty and updates every suggestion as the password changes', () => {
    const { rerender } = render(<PasswordFeedback password="" />)
    expect(screen.getByRole('status')).toHaveTextContent('Not entered')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    rerender(<PasswordFeedback password="abcdefgh" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByText('8+ characters').closest('li')).toHaveTextContent('Met:')
    rerender(<PasswordFeedback password="abcdefgh1" />)
    expect(screen.getByRole('status')).toHaveTextContent('Medium')
    rerender(<PasswordFeedback password="Abcdefg1!" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4')
    expect(screen.getByRole('status')).toHaveTextContent('All checks met')
    expect(screen.getByText('Special symbol').closest('li')).toHaveTextContent('Met:')
    expect(screen.getByText('1 uppercase letter').closest('li')).toHaveTextContent('Met:')
    rerender(<PasswordFeedback password="a" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByText('8+ characters').closest('li')).toHaveTextContent('Not yet met:')
  })
  it('treats spaces as neither symbols nor numbers', () => {
    render(<PasswordFeedback password="        " />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByText('Special symbol').closest('li')).toHaveTextContent('Not yet met:')
    expect(screen.getByText('At least 1 number').closest('li')).toHaveTextContent('Not yet met:')
  })
  it('updates feedback while typing and toggles visibility without submitting or losing input', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><StudentRegisterPage policies={{ terms: 'https://example.test/terms', privacy: 'https://example.test/privacy' }} /></MemoryRouter>)
    const password = screen.getByLabelText('Account Password', { exact: true })
    await user.type(password, 'Abcdefg1!')
    expect(within(screen.getByRole('region', { name: 'Password guidance' })).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('Abcdefg1!')
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveValue('Abcdefg1!')
  })
  it('keeps suggested checks advisory rather than imposing unapproved validation rules', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><StudentRegisterPage policies={{ terms: 'https://example.test/terms', privacy: 'https://example.test/privacy' }} /></MemoryRouter>)
    await user.type(screen.getByLabelText('First Name'), 'Yassine')
    await user.type(screen.getByLabelText('Last Name'), 'Amrani')
    await user.selectOptions(screen.getByLabelText('University / Academic Institution'), 'Mohammed V University (Rabat - ENSIAS, FSR, EMI)')
    await user.type(screen.getByLabelText('Email Address'), 'student@example.test')
    await user.type(screen.getByLabelText('Account Password', { exact: true }), 'p')
    await user.type(screen.getByLabelText('Confirm password'), 'p')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Create student account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Backend integration is not available')
  })
  it.each(['student', 'organizer'])('shows the %s sign-in footer without a broken link when login is not ready', type => {
    render(<MemoryRouter>{type === 'student' ? <StudentRegisterPage /> : <OrganizerRegisterPage />}</MemoryRouter>)
    expect(screen.getByText(/Already have an account/)).toBeVisible()
    expect(screen.getByText('Sign In')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('link', { name: 'Sign In' })).not.toBeInTheDocument()
    expect(screen.getByText('Sign in is not available yet.')).toBeVisible()
  })
  it('navigates to the supplied login destination when it is configured', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/register/student']}><Routes>
      <Route path="/register/student" element={<StudentRegisterPage signInPath={testSignInPath} />} />
      <Route path={testSignInPath} element={<h1>Test login page</h1>} />
    </Routes></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', testSignInPath)
    await user.click(screen.getByRole('link', { name: 'Sign In' }))
    expect(screen.getByRole('heading', { name: 'Test login page' })).toBeVisible()
  })
})
