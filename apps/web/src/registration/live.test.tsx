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
  vi.mocked(apiRequest).mockReset().mockImplementation(realRequest)
})

describe.skipIf(!base)('live registration UI using the isolated HTTPS API and database', () => {
  it.each(['student', 'organizer'] as const)('creates a real %s account, signs in and displays the expected destination', async (kind) => {
    render(<MemoryRouter initialEntries={[`/register/${kind}`]}><App /></MemoryRouter>)
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
    edit('Email Address', `auth04-ui-${randomUUID()}@example.test`)
    edit('Account Password', 'Real-api-password-2026!')
    edit('Confirm password', 'Real-api-password-2026!')
    await userEvent.click(screen.getByRole('checkbox'))
    if (kind === 'organizer') await userEvent.click(screen.getByRole('button', { name: 'Review application' }))
    await userEvent.click(screen.getByRole('button', { name: kind === 'student' ? 'Create student account' : 'Submit Organization for Verification' }))
    expect(await screen.findByRole('heading', { name: kind === 'student' ? 'Student dashboard' : 'Organization verification pending' }, { timeout: 10000 })).toBeVisible()
    expect(vi.mocked(apiRequest).mock.calls.some(([input]) => input === `/api/auth/register/${kind}`)).toBe(true)
  }, 15000)
})
