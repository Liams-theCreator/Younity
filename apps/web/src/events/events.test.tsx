import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { apiRequest } from '../api/client'
import { discoveryQuery, getEvent, getEvents, getMyBooking } from './service'
import { EventsError } from './model'

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }))
const request = vi.mocked(apiRequest)
const category = { id: 'category-1', name: 'AI & Data', slug: 'ai-data' }
const event = {
  id: 'event-1', title: 'Campus AI meetup', organization: { id: 'org-1', name: 'Campus Club' },
  startDate: '2027-01-12T10:00:00Z', endDate: '2027-01-12T12:00:00Z', format: 'HYBRID',
  location: 'Rabat campus', categories: [category], registrationMode: 'AUTOMATIC',
  registrationDeadline: '2027-01-11T18:00:00Z', availability: 'OPEN',
  description: 'Meet students and build something together.', externalRegistrationUrl: null,
  onlineUrl: 'https://private.example.test/join',
}
let session: Record<string, unknown> | null
let booking: { id: string; status: string } | null
let bookingFailure: boolean
let missing: boolean
let external: boolean
function results(page = 1, items = [event], total = 25) {
  return { items, categories: [category], page, pageSize: 12, total }
}
function mount(path = '/events') {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}
function student(complete = true) {
  return { id: 'student-1', email: 'student@example.test', role: 'STUDENT', status: 'ACTIVE', organization: null,
    onboarding: { complete, nextStep: complete ? 'NONE' : 'SELECT_INTERESTS' } }
}
function bookingCalls() {
  return request.mock.calls.filter(([path]) => String(path).endsWith('/my-booking'))
}

beforeEach(() => {
  session = null; booking = null; bookingFailure = false; missing = false; external = false
  request.mockReset().mockImplementation(async input => {
    const path = String(input)
    if (path === '/api/auth/me') return session ? Response.json(session) : new Response(null, { status: 401 })
    if (path === '/api/categories') return Response.json({ categories: [category] })
    if (path === '/api/student/profile') return Response.json({ firstName: 'Sara', lastName: 'Student' })
    if (path === '/api/student/preferences') return Response.json({
      interests: ['AI_DATA', 'ROBOTICS_IOT'], university: null, academicField: null, studyLevel: null, opportunityFormat: null,
    })
    if (path.startsWith('/api/events?')) {
      const params = new URL(path, 'https://example.test').searchParams
      return Response.json(results(Number(params.get('page') ?? 1), params.get('q') === 'none' ? [] : [event], params.get('q') === 'none' ? 0 : 25))
    }
    if (path.endsWith('/my-booking')) return bookingFailure ? new Response(null, { status: 503 }) : Response.json({ booking })
    if (path === '/api/events/event-1') {
      if (missing) return new Response(null, { status: 404 })
      return Response.json({ event: external ? { ...event, registrationMode: 'EXTERNAL', registrationDeadline: null, externalRegistrationUrl: 'https://organizer.example.test/register' } : event })
    }
    throw new Error(`Unexpected request: ${path}`)
  })
})

describe('S3-07 proposed discovery contract', () => {
  it('browses real routes without authentication or a booking mutation', async () => {
    mount()
    expect(await screen.findByRole('link', { name: event.title })).toBeVisible()
    await userEvent.click(screen.getByRole('link', { name: event.title }))
    expect(await screen.findByRole('heading', { name: event.title })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Create student account' })).toBeVisible()
    expect(document.body).not.toHaveTextContent(event.onlineUrl)
    expect(bookingCalls()).toHaveLength(0)
    expect(request.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true)
  })

  it('combines filters, resets pagination, and clears an empty result', async () => {
    mount('/events?page=2')
    await screen.findByRole('link', { name: event.title })
    await userEvent.type(screen.getByLabelText('Keyword'), 'none')
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'ai-data')
    await userEvent.type(screen.getByLabelText('City'), 'Rabat')
    await userEvent.selectOptions(screen.getByLabelText('Format'), 'HYBRID')
    await userEvent.click(screen.getByRole('button', { name: 'Search events' }))
    expect(await screen.findByRole('heading', { name: 'No events found' })).toBeVisible()
    const url = request.mock.calls.map(([p]) => String(p)).find(p => p.includes('q=none'))!
    const params = new URL(url, 'https://example.test').searchParams
    expect(Object.fromEntries(params)).toMatchObject({ q: 'none', category: 'ai-data', city: 'Rabat', format: 'HYBRID', page: '1', pageSize: '12' })
    await userEvent.click(screen.getByRole('button', { name: 'Show all events' }))
    expect(await screen.findByRole('link', { name: event.title })).toBeVisible()
    expect(screen.getByLabelText('Keyword')).toHaveValue('')
  })

  it('keeps filters during pagination and supports keyboard submission', async () => {
    mount('/events?city=Rabat')
    await screen.findByRole('link', { name: event.title })
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Page 2')
    expect(request.mock.calls.some(([p]) => String(p).includes('city=Rabat&page=2'))).toBe(true)
    await userEvent.type(screen.getByLabelText('Keyword'), 'none{Enter}')
    expect(await screen.findByRole('heading', { name: 'No events found' })).toBeVisible()
  })

  it('removes an applied filter independently and clears unsent filter changes', async () => {
    mount('/events?q=meetup&city=Rabat&category=ai-data&page=2')
    await screen.findByRole('link', { name: event.title })
    await userEvent.click(screen.getByRole('button', { name: 'Remove Category filter: AI & Data' }))

    await screen.findByText('Page 1')
    expect(screen.getByLabelText('Category')).toHaveValue('')
    expect(screen.getByLabelText('Keyword')).toHaveValue('meetup')
    expect(screen.getByLabelText('City')).toHaveValue('Rabat')
    expect(request.mock.calls.some(([path]) => String(path).includes('q=meetup&city=Rabat&page=1'))).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    await screen.findByRole('link', { name: event.title })
    await userEvent.type(screen.getByLabelText('Keyword'), 'unsent search')
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(screen.getByLabelText('Keyword')).toHaveValue('')
    expect(request.mock.calls.some(([path]) => String(path).includes('unsent'))).toBe(false)
  })

  it('explains invalid dates before sending a search and allows correction', async () => {
    mount()
    await screen.findByRole('link', { name: event.title })
    const callsBeforeSearch = request.mock.calls.length
    const from = screen.getByLabelText('From')
    const to = screen.getByLabelText('To')
    fireEvent.change(from, { target: { value: '2027-01-12' } })
    fireEvent.change(to, { target: { value: '2027-01-10' } })
    await userEvent.click(screen.getByRole('button', { name: 'Search events' }))

    expect(screen.getByRole('alert')).toHaveTextContent('End date must be on or after start date.')
    expect(to).toHaveFocus()
    expect(request).toHaveBeenCalledTimes(callsBeforeSearch)

    fireEvent.change(to, { target: { value: '2027-01-14' } })
    await userEvent.click(screen.getByRole('button', { name: 'Search events' }))
    await screen.findByRole('link', { name: event.title })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(request.mock.calls.some(([path]) => String(path).includes('from=2027-01-12&to=2027-01-14'))).toBe(true)
  })

  it('shows a missing event without claiming a reservation', async () => {
    missing = true; mount('/events/event-1')
    expect(await screen.findByRole('heading', { name: 'Event unavailable' })).toBeVisible()
    expect(bookingCalls()).toHaveLength(0)
  })

  it.each([
    [null, 'You have no booking for this event.'],
    [{ id: 'booking-1', status: 'CONFIRMED' }, 'Your place is confirmed.'],
    [{ id: 'booking-1', status: 'CANCELLED' }, 'Your booking is cancelled.'],
  ])('shows the current student booking: %j', async (value, message) => {
    session = student(); booking = value; mount('/events/event-1')
    expect(await screen.findByText(message)).toBeVisible()
    expect(bookingCalls().length).toBeGreaterThan(0)
  })

  it('does not treat a booking request failure as no booking and supports retry', async () => {
    session = student(); bookingFailure = true; booking = { id: 'booking-1', status: 'CONFIRMED' }
    mount('/events/event-1')
    const retry = await screen.findByRole('button', { name: 'Retry booking status' })
    expect(screen.queryByText('You have no booking for this event.')).not.toBeInTheDocument()
    bookingFailure = false; await userEvent.click(retry)
    expect(await screen.findByText('Your place is confirmed.')).toBeVisible()
  })

  it('keeps incomplete students and organizers out of booking reads', async () => {
    session = student(false); const view = mount('/events/event-1')
    expect(await screen.findByRole('link', { name: 'Continue onboarding' })).toHaveAttribute('href', '/student/preferences')
    expect(bookingCalls()).toHaveLength(0)
    view.unmount()
    session = { ...student(), role: 'ORGANIZER', organization: { verificationStatus: 'PENDING' } }
    mount('/events/event-1')
    expect(await screen.findByText('Only student accounts can reserve places through Younity.')).toBeVisible()
    expect(bookingCalls()).toHaveLength(0)
  })

  it('offers an external link without making a Younity booking', async () => {
    session = student(); external = true; mount('/events/event-1')
    expect(await screen.findByRole('link', { name: /Open external registration/ })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(bookingCalls()).toHaveLength(0)
  })

  it('opens discovery on the student dashboard and keeps preference editing on the profile', async () => {
    session = student(); mount('/student/dashboard')
    expect(await screen.findByRole('link', { name: event.title })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Your account' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    await userEvent.click(screen.getByRole('link', { name: 'Edit profile' }))
    expect(await screen.findByRole('heading', { name: 'Student profile' })).toBeVisible()
    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeVisible()
    expect(screen.queryByRole('link', { name: event.title })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Back to events' }))
    expect(await screen.findByRole('link', { name: event.title })).toBeVisible()
  })

  it('ignores a stale response after filters change', async () => {
    let release!: (response: Response) => void
    const normal = request.getMockImplementation()!
    request.mockImplementation((input, options) => String(input).includes('q=slow')
      ? new Promise(resolve => { release = resolve }) : normal(input, options))
    mount('/events?q=slow')
    await waitFor(() => expect(release).toBeDefined())
    await userEvent.clear(screen.getByLabelText('Keyword'))
    await userEvent.type(screen.getByLabelText('Keyword'), 'none{Enter}')
    await screen.findByRole('heading', { name: 'No events found' })
    await act(async () => release(Response.json(results())))
    expect(screen.queryByRole('link', { name: event.title })).not.toBeInTheDocument()
  })

  it('offers database categories when the event list fails, then retries the list', async () => {
    const normal = request.getMockImplementation()!
    let fail = true
    request.mockImplementation((input, options) => String(input).startsWith('/api/events?') && fail
      ? Promise.resolve(new Response(null, { status: 503 })) : normal(input, options))
    mount()
    const retry = await screen.findByRole('button', { name: 'Retry events' })
    expect(screen.queryByRole('heading', { name: 'No events found' })).not.toBeInTheDocument()
    const option = await screen.findByRole('option', { name: category.name })
    expect(option).toHaveValue(category.slug)
    fail = false; await userEvent.click(retry)
    expect(await screen.findByRole('link', { name: event.title })).toBeVisible()
  })
})

describe('S3-07 response validation', () => {
  it('drops private fields and rejects unsafe external URLs', async () => {
    const signal = new AbortController().signal
    expect(await getEvent('event-1', signal)).not.toHaveProperty('onlineUrl')
    request.mockResolvedValue(Response.json({ event: { ...event, registrationMode: 'EXTERNAL', externalRegistrationUrl: 'javascript:alert(1)' } }))
    await expect(getEvent('event-1', signal)).rejects.toBeInstanceOf(EventsError)
  })
  it.each([
    { ...event, registrationDeadline: null },
    { ...event, startDate: 'invalid' },
    { ...event, format: 'UNKNOWN' },
    { ...event, endDate: event.startDate },
    { ...event, categories: [] },
  ])('rejects invalid event data', async value => {
    request.mockResolvedValue(Response.json({ event: value }))
    await expect(getEvent('event-1', new AbortController().signal)).rejects.toBeInstanceOf(EventsError)
  })
  it('rejects malformed lists and missing booking envelopes', async () => {
    request.mockResolvedValue(Response.json({ items: [], total: '0' }))
    await expect(getEvents('page=1', new AbortController().signal)).rejects.toBeInstanceOf(EventsError)
    request.mockResolvedValue(Response.json({}))
    await expect(getMyBooking('event-1', new AbortController().signal, request)).rejects.toBeInstanceOf(EventsError)
  })
  it('encodes IDs, normalizes pagination and strips unrecognized query fields', async () => {
    request.mockResolvedValue(Response.json({ booking: null }))
    await getMyBooking('a/b', new AbortController().signal, request)
    expect(request).toHaveBeenCalledWith('/api/events/a%2Fb/my-booking', expect.objectContaining({ method: 'GET', cache: 'no-store', credentials: 'include' }))
    expect(discoveryQuery(new URLSearchParams('page=-1&admin=true&q= hello ')).toString()).toBe('q=hello&page=1&pageSize=12')
  })
  it('shows a full event in discovery instead of hiding it', async () => {
    request.mockImplementation(async input => String(input) === '/api/auth/me'
      ? new Response(null, { status: 401 }) : Response.json(results(1, [{ ...event, availability: 'FULL' }])))
    mount()
    const card = (await screen.findByRole('link', { name: event.title })).closest('li')!
    expect(within(card).getByText(/Full/)).toBeVisible()
  })
})
