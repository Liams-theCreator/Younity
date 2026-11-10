import { act, fireEvent, render, screen } from '@testing-library/react'
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
let mailFails: boolean
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
  sessionStorage.clear()
  session = null; registrationError = null; mailFails = false; delayRegistration = null
  request.mockReset().mockImplementation(async (input, options) => {
    if (input === '/api/auth/me') return session ? Response.json(session) : new Response(null, { status: 401 })
    if (String(input).startsWith('/api/auth/register/')) {
      if (delayRegistration) await delayRegistration
      if (registrationError) return Response.json({ message: registrationError.message }, { status: registrationError.status })
      return Response.json({ id: 'registered-user', email, verificationEmailSent: !mailFails }, { status: 201 })
    }
    if (input === '/api/auth/resend-verification') return Response.json({ message: 'If this address belongs to an account awaiting verification, check your inbox.' })
    if (input === '/api/auth/login') {
      expect(JSON.parse(String(options?.body))).toEqual({ email, password })
      session = { id: 'registered-user', email, role: kind === 'student' ? 'STUDENT' : 'ORGANIZER', status: kind === 'student' ? 'ACTIVE' : 'PENDING', organization: kind === 'student' ? null : { verificationStatus: 'PENDING' } }
      return Response.json({})
    }
    throw new Error(`Unexpected request: ${String(input)}`)
  })
})

describe('registration handoff to email verification', () => {
  it('registers all student preferences and waits for email verification', async () => {
    mount('student'); await fill('student')
    await userEvent.click(screen.getByRole('button', { name: 'Continue to preferences' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Computer Science & AI/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Second Year (L2)' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /AI & Data Science/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Robotics & Smart IoT/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Hybrid Events/ }))
    await submitRegistration('student')
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible()
    const payload = JSON.parse(String(posts('/api/auth/register/student')[0][1]?.body))
    expect(payload).toEqual({ firstName: 'Sara', lastName: 'Test', email, password, university: 'Test Institute', interests: ['AI_DATA', 'ROBOTICS_IOT'], academicField: 'COMPUTER_SCIENCE', studyLevel: 'SECOND_YEAR', opportunityFormat: 'HYBRID' })
    expect(posts('/api/auth/login')).toHaveLength(0)
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/verify-email')
  })

  it('registers an organizer without a fabricated proof URL and waits for email verification', async () => {
    mount('organizer'); await fill('organizer')
    await userEvent.upload(screen.getByLabelText('Affiliation or authorization document'), new File(['proof'], 'proof.pdf', { type: 'application/pdf' }))
    await submitRegistration('organizer')
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible()
    const payload = JSON.parse(String(posts('/api/auth/register/organizer')[0][1]?.body))
    expect(payload).toEqual({ firstName: 'Sara', lastName: 'Test', email, password, organizationName: 'Campus Club', type: 'STUDENT_CLUB', representativeFullName: 'Sara Test', academicPosition: 'Coordinator', phoneNumber: '+212612345678' })
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/verify-email')
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
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible()
  })

  it('shows backend validation messages on the relevant organizer fields', async () => {
    registrationError = { status: 400, message: ['phoneNumber must be a valid phone number', 'lastName should not be empty'] }
    mount('organizer'); await fill('organizer'); await submitRegistration('organizer')
    expect(await screen.findByRole('alert')).toHaveTextContent('phoneNumber must be a valid phone number')
    expect(screen.getByLabelText('Direct Contact Phone')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Representative Full Name')).toHaveAttribute('aria-invalid', 'true')
    expect(posts('/api/auth/login')).toHaveLength(0)
  })

  it.each(['student', 'organizer'] as const)('recovers a created %s account when email delivery fails', async (account) => {
    mailFails = true
    mount(account); await fill(account); await submitRegistration(account)
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible()
    expect(screen.getByText(/Your account was created, but we could not send/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry sending' })).toBeVisible()
    expect(screen.getByText('s***@example.test')).toBeVisible()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('younity.emailVerification')).not.toContain(password)
    await userEvent.click(screen.getByRole('button', { name: 'Retry sending' }))
    expect(JSON.parse(String(posts('/api/auth/resend-verification')[0][1]?.body))).toEqual({ email })
    expect(posts(`/api/auth/register/${account}`)).toHaveLength(1)
    expect(posts('/api/auth/login')).toHaveLength(0)
  })

  it.each(['student', 'organizer'] as const)('hands off a successful %s registration with only email context', async (account) => {
    mount(account); await fill(account); await submitRegistration(account)
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible()
    expect(screen.getByText('s***@example.test')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Resend email' })).not.toBeInTheDocument()
    const context = JSON.parse(sessionStorage.getItem('younity.emailVerification')!)
    expect(context.email).toBe(email)
    expect(context.deliveryFailed).toBe(false)
    expect(context.resendAvailableAt).toBeGreaterThan(Date.now() + 58000)
    expect(JSON.stringify(context)).not.toContain(password)
    expect(posts('/api/auth/login')).toHaveLength(0)
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
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible()
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
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible()
    expect(JSON.parse(String(posts('/api/auth/register/student')[0][1]?.body)).interests).toEqual([])
  })
})
