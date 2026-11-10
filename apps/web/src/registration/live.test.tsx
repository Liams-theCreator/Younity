import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import https from 'node:https'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import App from '../App'
import { apiRequest } from '../api/client'

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }))

const base = process.env.AUTH_TEST_BASE_URL
let cookie = ''
function realRequest(input: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  const url = new URL(String(input), base)
  if (url.protocol !== 'https:' || url.hostname !== 'localhost') throw new Error('Use an isolated localhost HTTPS test stack')
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: options?.method ?? 'GET', family: 4,
      ca: readFileSync(process.env.AUTH_TEST_CA_FILE!),
      headers: { ...Object.fromEntries(new Headers(options?.headers)), ...(cookie ? { Cookie: cookie } : {}) },
    }, (response) => {
      const session = response.headers['set-cookie']?.find((value) => value.startsWith('access_token='))
      if (session) cookie = session.split(';')[0]
      let text = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { text += chunk })
      response.on('end', () => resolve(new Response(text || null, { status: response.statusCode })))
    })
    request.on('error', reject)
    request.setTimeout(10000, () => request.destroy(new Error('Live API timeout')))
    if (options?.signal) options.signal.addEventListener('abort', () => request.destroy(), { once: true })
    request.end(options?.body ? String(options.body) : undefined)
  })
}
function edit(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } })
}

beforeEach(() => {
  cookie = ''
  sessionStorage.clear()
  vi.mocked(apiRequest).mockReset().mockImplementation(realRequest)
})

describe.skipIf(!base)('live registration UI using the isolated HTTPS API and database', () => {
  it.each(['student', 'organizer'] as const)('registers, receives mail, verifies and signs in a real %s account', async (kind) => {
    const view = render(<MemoryRouter initialEntries={[`/register/${kind}`]}><App /></MemoryRouter>)
    const email = `auth04-ui-${randomUUID()}@example.test`
    const password = 'Real-api-password-2026!'
    if (kind === 'student') {
      edit('First Name', 'Sara'); edit('Last Name', 'Verification')
      fireEvent.change(screen.getByLabelText('University / Academic Institution'), { target: { value: 'Other' } })
      edit('Custom University / Academic Institution', 'Live Verification Institute')
    } else {
      edit('Organization / University Entity Name', 'Live Verification Club')
      edit('Representative Full Name', 'Sara Verification')
      edit('Title / Academic Position', 'Coordinator')
      edit('Direct Contact Phone', '+212612345678')
      fireEvent.change(screen.getByLabelText('Entity Category'), { target: { value: 'STUDENT_CLUB' } })
    }
    edit('Email Address', email)
    edit('Account Password', 'Real-api-password-2026!')
    edit('Confirm password', 'Real-api-password-2026!')
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: kind === 'student' ? 'Create student account' : 'Submit Organization for Verification' }))
    expect(await screen.findByRole('heading', { name: 'Check your email' }, { timeout: 10000 })).toBeVisible()
    expect(vi.mocked(apiRequest).mock.calls.some(([input]) => input === `/api/auth/register/${kind}`)).toBe(true)
    expect(screen.getByText('a***@example.test')).toBeVisible()
    await userEvent.click(screen.getByRole('link', { name: 'Back to sign in' }))
    edit('Email Address', email); edit('Password', password)
    await userEvent.click(screen.getByRole('button', { name: 'Sign In to Younity' }))
    expect(await screen.findByRole('alert', {}, { timeout: 10000 })).toHaveTextContent('Verify your email before signing in')
    expect(cookie).toBe('')
    const search = new URL('http://127.0.0.1:8025/api/v1/search')
    search.searchParams.set('query', `to:${email}`)
    const inbox = await (await fetch(search)).json() as { messages: { ID: string; Subject: string }[] }
    const message = inbox.messages.find((item) => item.Subject === 'Verify your Younity email')
    expect(message).toBeDefined()
    const mail = await (await fetch(`http://127.0.0.1:8025/api/v1/message/${message!.ID}`)).json() as { Text: string }
    expect(mail.Text).toContain('expires in 10 minutes')
    const link = new URL(mail.Text.match(/https?:\/\/\S+\/verify-email\?token=[a-f0-9]{64}/)![0])
    expect(link.origin).toBe(base)
    view.unmount()
    // A link opened on a fresh device has no registration context or password.
    sessionStorage.clear()
    render(<MemoryRouter initialEntries={[`${link.pathname}${link.search}`]}><App /></MemoryRouter>)
    const before = vi.mocked(apiRequest).mock.calls.filter(([input]) => input === '/api/email-verification/verify-email').length
    expect(before).toBe(0)
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }))
    expect(await screen.findByRole('heading', { name: 'Email verified' }, { timeout: 10000 })).toBeVisible()
    await userEvent.click(screen.getByRole('link', { name: 'Go to sign in' }))
    edit('Email Address', email); edit('Password', password)
    await userEvent.click(screen.getByRole('button', { name: 'Sign In to Younity' }))
    if (kind === 'student') expect(await screen.findByRole('heading', { name: 'Student dashboard' }, { timeout: 10000 })).toBeVisible()
    else {
      expect(await screen.findByRole('heading', { name: 'Organization verification pending' }, { timeout: 10000 })).toBeVisible()
      expect((await realRequest('/api/auth/organizer-check')).status).toBe(403)
    }
    expect(cookie).toMatch(/^access_token=/)
  }, 30000)
})
