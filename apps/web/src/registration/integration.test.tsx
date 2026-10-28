import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { apiRequest } from '../api/client'

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }))
const request = vi.mocked(apiRequest)
let kind: 'student' | 'organizer'
let session: object | null
let registrationError: { status: number; message: string[] } | null
let loginFails: boolean
let delayRegistration: Promise<void> | null
const email = 'sara@example.test'
const password = 'Abcdefg1!'

function Location() {
  return <output aria-label="Current route">{useLocation().pathname}</output>
}
function mount(account: 'student' | 'organizer') {
  kind = account
  return render(<MemoryRouter initialEntries={[`/register/${account}`]}><App /><Location /></MemoryRouter>)
}
function posts(path: string) {
  return request.mock.calls.filter(([input, options]) => input === path && options?.method === 'POST')
}
function edit(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } })
}
async function fill(account: 'student' | 'organizer') {
  if (account === 'student') {
    edit('First Name', 'Sara'); edit('Last Name', 'Test')
    fireEvent.change(screen.getByLabelText('University / Academic Institution'), { target: { value: 'Other' } })
    edit('Custom University / Academic Institution', 'Test Institute')
  } else {
    edit('Organization / University Entity Name', 'Campus Club')
    edit('Representative Full Name', 'Sara Test')
    edit('Title / Academic Position', 'Coordinator')
    edit('Direct Contact Phone', '+212612345678')
    fireEvent.change(screen.getByLabelText('Entity Category'), { target: { value: 'STUDENT_CLUB' } })
  }
  edit('Email Address', email)
  edit('Account Password', password)
  edit('Confirm password', password)
  await userEvent.click(screen.getByRole('checkbox'))
}
function submitButton(account: 'student' | 'organizer') {
  return screen.getByRole('button', { name: account === 'student' ? 'Create student account' : 'Submit Organization for Verification' })
}

async function submitRegistration(account: 'student' | 'organizer') {
  await userEvent.click(submitButton(account))
}

beforeEach(() => {
  session = null; registrationError = null; loginFails = false; delayRegistration = null
  request.mockReset().mockImplementation(async (input, options) => {
    if (input === '/api/auth/me') return session ? Response.json(session) : new Response(null, { status: 401 })
    if (String(input).startsWith('/api/auth/register/')) {
      if (delayRegistration) await delayRegistration
      if (registrationError) return Response.json({ message: registrationError.message }, { status: registrationError.status })
      return Response.json({ id: 'registered-user', email }, { status: 201 })
    }
    if (input === '/api/auth/login') {
      if (loginFails) return new Response(null, { status: 401 })
      expect(JSON.parse(String(options?.body))).toEqual({ email, password })
      session = { id: 'registered-user', email, role: kind === 'student' ? 'STUDENT' : 'ORGANIZER', status: kind === 'student' ? 'ACTIVE' : 'PENDING', organization: kind === 'student' ? null : { verificationStatus: 'PENDING' } }
      return Response.json({})
    }
    throw new Error(`Unexpected request: ${String(input)}`)
  })
})

describe('registration handoff to shared AUTH-05 authentication', () => {
  it('registers all student preferences, signs in and reaches the student dashboard', async () => {
    mount('student'); await fill('student')
    await userEvent.click(screen.getByRole('button', { name: 'Continue to preferences' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Computer Science & AI/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Second Year (L2)' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /AI & Data Science/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Robotics & Smart IoT/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Hybrid Events/ }))
    await submitRegistration('student')
    expect(await screen.findByRole('heading', { name: 'Student dashboard' })).toBeVisible()
    const payload = JSON.parse(String(posts('/api/auth/register/student')[0][1]?.body))
    expect(payload).toEqual({ firstName: 'Sara', lastName: 'Test', email, password, university: 'Test Institute', interests: ['AI_DATA', 'ROBOTICS_IOT'], academicField: 'COMPUTER_SCIENCE', studyLevel: 'SECOND_YEAR', opportunityFormat: 'HYBRID' })
    expect(posts('/api/auth/login')).toHaveLength(1)
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/student/dashboard')
  })

  it('registers an organizer without a fabricated proof URL, then uses verified pending routing', async () => {
    mount('organizer'); await fill('organizer')
    await userEvent.upload(screen.getByLabelText('Affiliation or authorization document'), new File(['proof'], 'proof.pdf', { type: 'application/pdf' }))
    await submitRegistration('organizer')
    expect(await screen.findByRole('heading', { name: 'Organization verification pending' })).toBeVisible()
    const payload = JSON.parse(String(posts('/api/auth/register/organizer')[0][1]?.body))
    expect(payload).toEqual({ firstName: 'Sara', lastName: 'Test', email, password, organizationName: 'Campus Club', type: 'STUDENT_CLUB', representativeFullName: 'Sara Test', academicPosition: 'Coordinator', phoneNumber: '+212612345678' })
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/organizer/pending')
    expect(screen.queryByText(/YNT-ORG-2025/)).not.toBeInTheDocument()
  })

  it('shows duplicate-email errors without signing in, then supports correction', async () => {
    registrationError = { status: 409, message: ['Email already registered'] }
    mount('student'); await fill('student'); await submitRegistration('student')
    expect(await screen.findByRole('alert')).toHaveTextContent('This email is already registered')
    expect(screen.getByLabelText('Email Address')).toHaveAttribute('aria-invalid', 'true')
    expect(posts('/api/auth/login')).toHaveLength(0)
    registrationError = null
    edit('Email Address', email)
    await submitRegistration('student')
    expect(await screen.findByRole('heading', { name: 'Student dashboard' })).toBeVisible()
  })

  it('shows backend validation messages on the relevant organizer fields', async () => {
    registrationError = { status: 400, message: ['phoneNumber must be a valid phone number', 'lastName should not be empty'] }
    mount('organizer'); await fill('organizer'); await submitRegistration('organizer')
    expect(await screen.findByRole('alert')).toHaveTextContent('phoneNumber must be a valid phone number')
    expect(screen.getByLabelText('Direct Contact Phone')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Representative Full Name')).toHaveAttribute('aria-invalid', 'true')
    expect(posts('/api/auth/login')).toHaveLength(0)
  })

  it.each(['student', 'organizer'] as const)('does not repeat %s registration after successful creation but failed login', async (account) => {
    loginFails = true
    mount(account); await fill(account); await submitRegistration(account)
    expect(await screen.findByText(/Account created; please sign in/)).toBeVisible()
    const submit = submitButton(account)
    expect(submit).toBeDisabled()
    fireEvent.submit(submit.closest('form')!)
    await waitFor(() => expect(posts(`/api/auth/register/${account}`)).toHaveLength(1))
    loginFails = false
    await userEvent.click(screen.getByRole('link', { name: 'Sign in' }))
    edit('Email Address', email); edit('Password', password)
    await userEvent.click(screen.getByRole('button', { name: /^Sign In to Younity$/i }))
    expect(await screen.findByRole('heading', { name: account === 'student' ? 'Student dashboard' : 'Organization verification pending' })).toBeVisible()
    expect(posts(`/api/auth/register/${account}`)).toHaveLength(1)
  })

  it('locks duplicate submissions while registration is pending', async () => {
    let resolve!: () => void
    delayRegistration = new Promise<void>((done) => { resolve = done })
    mount('organizer'); await fill('organizer'); await submitRegistration('organizer')
    const submit = screen.getByRole('button', { name: 'Submitting...' })
    expect(submit).toBeDisabled()
    fireEvent.submit(submit.closest('form')!)
    expect(posts('/api/auth/register/organizer')).toHaveLength(1)
    await act(async () => { resolve(); await delayRegistration })
    expect(await screen.findByRole('heading', { name: 'Organization verification pending' })).toBeVisible()
  })


  it('cancels a registration when leaving and does not sign in from a stale response', async () => {
    let resolve!: () => void
    delayRegistration = new Promise<void>((done) => { resolve = done })
    const view = mount('student'); await fill('student'); await submitRegistration('student')
    const signal = posts('/api/auth/register/student')[0][1]?.signal
    view.unmount()
    expect(signal?.aborted).toBe(true)
    await act(async () => { resolve(); await delayRegistration })
    expect(posts('/api/auth/login')).toHaveLength(0)
  })

  it('skips optional preferences without losing account details', async () => {
    mount('student'); await fill('student')
    await userEvent.click(screen.getByRole('button', { name: 'Continue to preferences' }))
    await userEvent.click(screen.getByRole('button', { name: /Skip for now/ }))
    expect(await screen.findByRole('heading', { name: 'Student dashboard' })).toBeVisible()
    expect(JSON.parse(String(posts('/api/auth/register/student')[0][1]?.body)).interests).toEqual([])
  })
})
