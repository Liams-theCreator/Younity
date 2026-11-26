import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { apiRequest } from '../api/client'
import {
  baselineRules,
  unavailableEventServices,
  emptyEvent,
  EventUiError,
  type EventDraft,
  type DraftSummary,
  type EventServices,
  type EventValues,
} from './model'
import { safeImageUrl, validateEvent } from './validation'

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }))
const request = vi.mocked(apiRequest)
// Frontend fixtures test the callback boundary only, not an agreed API schema.
const values: EventValues = {
  ...emptyEvent,
  title: 'Campus robotics showcase',
  description: 'Meet student makers.',
  categoryIds: ['category-fixture'],
  format: 'IN_PERSON',
  location: 'Engineering hall',
  startDate: '2026-12-10T10:00',
  endDate: '2026-12-10T12:00',
  registrationMode: 'AUTOMATIC',
  registrationDeadline: '2026-12-09T18:00',
  capacity: '120',
}
const draft: EventDraft = { id: 'draft-fixture', values, updatedAt: '2026-11-20T10:00:00Z' }
let session: Record<string, unknown> | null
function services() {
  return {
    registrationMode: 'AUTOMATIC',
    rules: { ...baselineRules, categoryRequired: true, automaticDeadlineRequired: true },
    categories: vi
      .fn<NonNullable<EventServices['categories']>>()
      .mockResolvedValue([{ id: 'category-fixture', label: 'Robotics' }]),
    draft: vi.fn<NonNullable<EventServices['draft']>>().mockResolvedValue(draft),
    drafts: vi.fn<NonNullable<EventServices['drafts']>>().mockResolvedValue([
      {
        id: draft.id,
        title: values.title,
        updatedAt: draft.updatedAt,
        startDate: values.startDate,
        format: values.format,
      },
    ]),
    saveDraft: vi
      .fn<NonNullable<EventServices['saveDraft']>>()
      .mockImplementation(async (input) => ({
        id: input.id ?? draft.id,
        values: input.values,
        updatedAt: draft.updatedAt,
      })),
    publish: vi
      .fn<NonNullable<EventServices['publish']>>()
      .mockResolvedValue({ message: 'Publication request confirmed.' }),
    bookings: vi
      .fn<NonNullable<EventServices['bookings']>>()
      .mockImplementation(async (selection) => ({
        items: [
          {
            id: 'booking-fixture',
            eventTitle: 'Campus robotics showcase',
            participantName: 'Sara Example',
            email: 'sara@example.test',
            registeredAt: '2026-11-20T10:00:00Z',
            status: selection.status,
            cancellationReason: selection.status === 'CANCELLED' ? 'Unable to attend.' : null,
          },
        ],
        previousPage: null,
        nextPage: 'page-two-fixture',
        label: 'Page 1',
      })),
  } satisfies EventServices
}
function mount(service: EventServices = unavailableEventServices, path = '/organizer/events/new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App eventServices={service} />
    </MemoryRouter>,
  )
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
async function openDraft(service = services()) {
  mount(service, `/organizer/events/${draft.id}/edit`)
  await screen.findByDisplayValue(values.title)
  return service
}
beforeEach(() => {
  session = {
    id: 'organizer-fixture',
    email: 'organizer@example.test',
    role: 'ORGANIZER',
    status: 'ACTIVE',
    organization: { verificationStatus: 'APPROVED', approvalAcknowledged: true },
    onboarding: { complete: true, nextStep: 'NONE' },
  }
  request.mockReset().mockImplementation(async (input) => {
    if (input === '/api/auth/me')
      return session ? Response.json(session) : new Response(null, { status: 401 })
    throw new Error(`No production event API is guessed: ${String(input)}`)
  })
})

describe('organizer event access and unavailable integration', () => {
  it('reports an unavailable publish callback without claiming draft saving is unavailable', async () => {
    const service = services()
    mount({ ...service, publish: undefined })
    expect(
      await screen.findByText('Publishing is currently unavailable. You can still save a draft.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Draft saved.')).toBeVisible()
    expect(screen.queryByText(/Changes made here have not been saved/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
  })

  it('shows the real empty editor without fake sample data or guessed API requests', async () => {
    mount()
    expect(await screen.findByRole('heading', { name: 'Create Event' })).toBeVisible()
    expect(screen.getByRole('textbox', { name: /Event title/ })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    expect(screen.getByText(/Saving and publishing are currently unavailable/)).toBeVisible()
    expect(screen.queryByText('Alex Rivera')).not.toBeInTheDocument()
    expect(request.mock.calls.every(([url]) => url === '/api/auth/me')).toBe(true)
  })
  it.each([
    '/organizer/events',
    '/organizer/events/new',
    '/organizer/events/private/edit',
    '/organizer/bookings',
  ])('redirects anonymous visits to %s without reads', async (path) => {
    session = null
    const service = services()
    mount(service, path)
    expect(await screen.findByLabelText('Email Address')).toBeVisible()
    expect(service.categories).not.toHaveBeenCalled()
    expect(service.draft).not.toHaveBeenCalled()
    expect(service.bookings).not.toHaveBeenCalled()
    expect(service.drafts).not.toHaveBeenCalled()
  })
  it.each([
    ['STUDENT', 'ACTIVE', null],
    ['ADMIN', 'ACTIVE', null],
    ['ORGANIZER', 'PENDING', 'PENDING'],
    ['ORGANIZER', 'ACTIVE', 'REJECTED'],
    ['ORGANIZER', 'SUSPENDED', 'APPROVED'],
  ])('blocks %s/%s from event reads', async (role, status, organizationStatus) => {
    session = {
      ...session!,
      role,
      status,
      organization: organizationStatus ? { verificationStatus: organizationStatus } : null,
    }
    const service = services()
    mount(service)
    await waitFor(() =>
      expect(screen.queryByText('Checking your session…')).not.toBeInTheDocument(),
    )
    expect(screen.queryByRole('form', { name: 'Event creation' })).not.toBeInTheDocument()
    expect(service.categories).not.toHaveBeenCalled()
  })
})

describe('creation reference design and write handoff', () => {
  it('keeps the live preview distinct from confirmed saves and restores the last saved values on discard', async () => {
    const service = services()
    const response = deferred<EventDraft>()
    service.saveDraft.mockReturnValueOnce(response.promise)
    mount(service)
    const panel = await screen.findByRole('complementary', { name: 'Event preview' })
    const title = screen.getByRole('textbox', { name: /Event title/ })
    await userEvent.type(title, 'My event')
    expect(within(panel).getByRole('heading', { name: 'My event' })).toBeVisible()
    expect(screen.queryByText('Draft saved.')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save draft from action dock' })).toBeDisabled()
    await act(async () =>
      response.resolve({ ...draft, values: { ...values, title: 'Server-confirmed title' } }),
    )
    expect(
      await within(panel).findByRole('heading', { name: 'Server-confirmed title' }),
    ).toBeVisible()
    expect(await screen.findByText('Draft saved.')).toBeVisible()
    await userEvent.type(title, ' edited')
    expect(
      within(panel).getByRole('heading', { name: 'Server-confirmed title edited' }),
    ).toBeVisible()
    expect(screen.getByText(/Unsaved changes/)).toBeVisible()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(title).toHaveValue('Server-confirmed title')
    expect(service.saveDraft).toHaveBeenCalledTimes(1)
    confirm.mockRestore()
  })
  it('renders the three sections and focuses category and schedule errors', async () => {
    const service = services()
    mount(service)
    expect(await screen.findByRole('heading', { name: 'Event Details' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Format & Venue' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Registration & Ticketing' })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Online' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    const summary = await screen.findByRole('alert')
    expect(summary).toHaveFocus()
    await userEvent.click(
      within(summary).getByRole('link', { name: 'Choose at least one category.' }),
    )
    expect(document.getElementById('event-categoryIds')).toHaveFocus()
    const dateLink = within(summary)
      .getAllByRole('link', { name: 'Required before publishing.' })
      .find((link) => link.getAttribute('href') === '#event-startDate')!
    await userEvent.click(dateLink)
    expect(screen.getByLabelText('Start date & time')).toHaveFocus()
    expect(service.publish).not.toHaveBeenCalled()
  })
  it('validates optional banner URLs and keeps the reference artwork outside saved values', async () => {
    const service = services()
    mount(service)
    await userEvent.click(await screen.findByText('Use image URL'))
    const banner = screen.getByRole('textbox', { name: /Event banner image URL/ })
    await userEvent.type(banner, 'javascript:alert(1)')
    await userEvent.tab()
    expect(
      screen.getByText('Enter a complete http:// or https:// link without credentials.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeDisabled()
    expect(screen.getAllByRole('img', { name: 'Example event cover' })).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Remove banner' }))
    expect(banner).toHaveValue('')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() =>
      expect(service.saveDraft).toHaveBeenCalledWith(
        expect.objectContaining({ values: expect.objectContaining({ imageUrl: '' }) }),
        expect.anything(),
      ),
    )
  })
  it('updates conditional format and registration fields without inventing modes', async () => {
    const service = services()
    mount(service)
    await userEvent.type(
      await screen.findByRole('textbox', { name: /Event title/ }),
      'Robotics workshop',
    )
    expect(
      within(screen.getByRole('complementary', { name: 'Event preview' })).getByRole('heading', {
        name: 'Robotics workshop',
      }),
    ).toBeVisible()
    await userEvent.click(screen.getByRole('radio', { name: 'Online' }))
    expect(screen.getByRole('textbox', { name: /Online event link/ })).toBeRequired()
    expect(screen.queryByRole('textbox', { name: /Venue/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Hybrid' }))
    expect(screen.getByRole('textbox', { name: /Venue/ })).toBeRequired()
    expect(screen.queryByLabelText(/Registration mode/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Registration deadline/)).toBeRequired()
    expect(screen.queryByRole('option', { name: /Approval Required/ })).not.toBeInTheDocument()
  })
  it('retains external registration on a loaded draft without exposing a mode selector', async () => {
    const service = services()
    service.draft.mockResolvedValueOnce({
      ...draft,
      values: {
        ...values,
        registrationMode: 'EXTERNAL',
        externalRegistrationUrl: 'https://example.test/register',
      },
    })
    await openDraft(service)
    expect(screen.queryByLabelText(/Registration mode/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Registration deadline/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/External registration link/)).toHaveValue(
      'https://example.test/register',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() =>
      expect(service.saveDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.objectContaining({ registrationMode: 'EXTERNAL' }),
        }),
        expect.anything(),
      ),
    )
  })
  it('allows partial saving but does not guess registration settings for new events', async () => {
    const service = services()
    mount({ ...service, registrationMode: undefined })
    expect(await screen.findByRole('button', { name: 'Publish' })).toBeDisabled()
    expect(screen.queryByLabelText(/Registration mode/i)).not.toBeInTheDocument()
    fireEvent.submit(screen.getByRole('form'))
    expect(service.publish).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() =>
      expect(service.saveDraft).toHaveBeenCalledWith(
        expect.objectContaining({ values: expect.objectContaining({ registrationMode: '' }) }),
        expect.anything(),
      ),
    )
  })
  it('requires schedule changes to be applied or cancelled before either action can save them', async () => {
    const service = await openDraft()
    await userEvent.selectOptions(screen.getByLabelText('Start date & time'), '11:00')
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publish event from action dock' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form'))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Apply or cancel your schedule changes',
    )
    expect(service.publish).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Apply Schedule' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save draft from action dock' }))
    await waitFor(() =>
      expect(service.saveDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.objectContaining({
            startDate: '2026-12-10T11:00',
            endDate: values.endDate,
          }),
        }),
        expect.anything(),
      ),
    )
  })
  it('uses only the supplied banner uploader and blocks writes and duplicate uploads while pending', async () => {
    const service = services()
    const response = deferred<{ url: string }>()
    const uploadBanner = vi
      .fn<NonNullable<EventServices['uploadBanner']>>()
      .mockReturnValue(response.promise)
    mount({ ...service, uploadBanner })
    const input = await screen.findByLabelText('Select event banner')
    const file = new File(['image bytes'], 'banner.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.submit(screen.getByRole('form'))
    expect(uploadBanner).toHaveBeenCalledTimes(1)
    expect(uploadBanner).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ request: expect.any(Function), signal: expect.any(AbortSignal) }),
    )
    expect(service.saveDraft).not.toHaveBeenCalled()
    expect(service.publish).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
    await act(async () => response.resolve({ url: 'https://example.test/confirmed-banner.png' }))
    expect(screen.getByRole('img', { name: 'Event banner preview' })).toHaveAttribute(
      'src',
      'https://example.test/confirmed-banner.png',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() =>
      expect(service.saveDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.objectContaining({
            imageUrl: 'https://example.test/confirmed-banner.png',
          }),
        }),
        expect.anything(),
      ),
    )
  })
  it('rejects unsupported uploads and aborts the upload callback when leaving the page', async () => {
    const response = deferred<{ url: string }>()
    const uploadBanner = vi
      .fn<NonNullable<EventServices['uploadBanner']>>()
      .mockReturnValue(response.promise)
    const view = mount({ ...services(), uploadBanner })
    const input = await screen.findByLabelText('Select event banner')
    fireEvent.change(input, {
      target: { files: [new File(['text'], 'file.txt', { type: 'text/plain' })] },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a PNG, JPG or WebP image up to 5 MB.',
    )
    expect(uploadBanner).not.toHaveBeenCalled()
    fireEvent.change(input, {
      target: { files: [new File(['bytes'], 'cover.jpg', { type: 'image/jpeg' })] },
    })
    const signal = uploadBanner.mock.calls[0][1].signal
    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => response.resolve({ url: 'https://example.test/late.jpg' }))
  })
  it('validates required publish fields, focuses feedback and links to fields', async () => {
    const service = services()
    mount(service)
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }))
    const summary = await screen.findByRole('alert')
    expect(summary).toHaveFocus()
    await userEvent.click(
      within(summary).getAllByRole('link', { name: 'Required before publishing.' })[0],
    )
    expect(screen.getByRole('textbox', { name: /Event title/ })).toHaveFocus()
    expect(service.publish).not.toHaveBeenCalled()
  })
  it('saves an incomplete draft only through the supplied callback and reuses its identity', async () => {
    const service = services()
    mount(service)
    await userEvent.type(
      await screen.findByRole('textbox', { name: /Event title/ }),
      'Unfinished event',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('Draft saved.')
    expect(service.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({ title: 'Unfinished event', description: '' }),
      }),
      expect.objectContaining({ request: expect.any(Function), signal: expect.any(AbortSignal) }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() =>
      expect(service.saveDraft).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: draft.id }),
        expect.anything(),
      ),
    )
    expect(service.publish).not.toHaveBeenCalled()
  })
  it('locks duplicate submit events and displays only the integration-confirmed publication outcome', async () => {
    const service = await openDraft()
    const response = deferred<{ message: string }>()
    service.publish.mockReturnValueOnce(response.promise)
    fireEvent.submit(screen.getByRole('form'))
    fireEvent.submit(screen.getByRole('form'))
    expect(service.publish).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Publishing…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
    await act(async () => response.resolve({ message: 'Event sent for review.' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Event sent for review.')
    expect(screen.getByRole('status')).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
  })
  it('preserves entered values after server validation errors', async () => {
    const service = await openDraft()
    service.publish.mockRejectedValueOnce(
      new EventUiError('validation', { title: 'Choose another title.' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Check the highlighted information')
    expect(screen.getByRole('textbox', { name: /Event title/ })).toHaveValue(values.title)
    expect(screen.getByText('Choose another title.', { selector: 'p' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled()
  })
  it.each([new Error('lost response'), new EventUiError('conflict')])(
    'requires a reload after uncertain/conflicting writes',
    async (cause) => {
      const service = await openDraft()
      service.publish.mockRejectedValueOnce(cause)
      await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        cause instanceof EventUiError ? 'draft changed' : 'could not confirm',
      )
      expect(screen.getByRole('textbox', { name: /Event title/ })).toHaveValue(values.title)
      expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
      await userEvent.click(screen.getByRole('button', { name: 'Reload saved draft' }))
      expect(await screen.findByRole('button', { name: 'Publish' })).toBeEnabled()
      expect(service.publish).toHaveBeenCalledTimes(1)
    },
  )
  it('removes event data and controls after backend denial', async () => {
    const service = await openDraft()
    service.publish.mockRejectedValueOnce(new EventUiError('forbidden'))
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission')
    expect(screen.queryByDisplayValue(values.title)).not.toBeInTheDocument()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })
  it('expires the session when the shared authenticated transport receives 401', async () => {
    const service = await openDraft()
    request.mockImplementation(async (input) =>
      input === '/api/auth/me' ? Response.json(session) : new Response(null, { status: 401 }),
    )
    service.publish.mockImplementation(async (_input, context) => {
      await context.request('/test-only/event-publish')
      throw new EventUiError('unavailable')
    })
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('Your session expired. Please sign in again.')).toBeVisible()
    expect(screen.queryByRole('form', { name: 'Event creation' })).not.toBeInTheDocument()
  })
})

describe('saved drafts and participant screens', () => {
  it('loads draft information and provides a working continue-editing link', async () => {
    const service = services()
    mount(service, '/organizer/events')
    await userEvent.click(
      await screen.findByRole('link', { name: `Continue editing ${values.title}` }),
    )
    expect(await screen.findByDisplayValue(values.title)).toBeVisible()
    expect(service.draft).toHaveBeenCalledWith(draft.id, expect.anything())
  })
  it('shows a genuine empty result only after the draft adapter returns no data', async () => {
    const service = services()
    service.drafts.mockResolvedValue([])
    mount(service, '/organizer/events')
    expect(await screen.findByRole('heading', { name: 'No drafts in progress' })).toBeVisible()
  })
  it('searches actual drafts by title, format and location, clears with focus and sorts without mutating data', async () => {
    const service = services()
    const items: DraftSummary[] = [
      {
        id: 'a',
        title: 'Art workshop',
        format: 'IN_PERSON',
        location: 'Studio',
        startDate: '2026-12-15T10:00',
        updatedAt: '2026-11-10T10:00Z',
      },
      {
        id: 'z',
        title: 'Zoology talk',
        format: 'ONLINE',
        startDate: '2026-12-01T10:00',
        updatedAt: '2026-11-20T10:00Z',
      },
      { id: 'empty', title: '', format: '', startDate: null, updatedAt: 'invalid' },
    ]
    service.drafts.mockResolvedValue(items)
    mount(service, '/organizer/events')
    const list = await screen.findByRole('list')
    const names = () =>
      within(list)
        .getAllByRole('heading')
        .map((heading) => heading.textContent)
    expect(names()).toEqual(['Zoology talk', 'Art workshop', 'Untitled event'])
    expect(screen.getByRole('button', { name: 'Drafts 3' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort drafts' }), 'title')
    expect(names()).toEqual(['Art workshop', 'Untitled event', 'Zoology talk'])
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort drafts' }), 'date')
    expect(names()).toEqual(['Zoology talk', 'Art workshop', 'Untitled event'])
    const search = screen.getByRole('searchbox', { name: 'Search saved drafts' })
    await userEvent.type(search, '  STUDIO  ')
    expect(within(list).getAllByRole('heading')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('1 draft matching your search')
    await userEvent.clear(search)
    await userEvent.type(search, 'online')
    expect(within(list).getByRole('heading')).toHaveTextContent('Zoology talk')
    await userEvent.clear(search)
    await userEvent.type(search, 'missing')
    expect(screen.getByRole('heading', { name: 'No matching drafts' })).toBeVisible()
    expect(screen.queryByText('No drafts in progress')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(search).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('3 drafts available')
    expect(items.map((item) => item.id)).toEqual(['a', 'z', 'empty'])
    expect(service.drafts).toHaveBeenCalledTimes(1)
  })
  it('does not invent event counts, draft samples or unsupported actions when reads are unavailable', async () => {
    mount(undefined, '/organizer/events')
    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable')
    expect(screen.getByRole('button', { name: 'Published' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Past' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Drafts' })).toHaveTextContent(/^Drafts$/)
    expect(screen.queryByRole('button', { name: /Delete|More draft/ })).not.toBeInTheDocument()
    expect(
      screen.queryByText(/No drafts in progress|Alex Rivera|Resiliency Patterns/),
    ).not.toBeInTheDocument()
    expect(request.mock.calls.every(([url]) => url === '/api/auth/me')).toBe(true)
  })
  it('only displays the genuine empty state after loading completes', async () => {
    const service = services()
    const response = deferred<DraftSummary[]>()
    service.drafts.mockReturnValueOnce(response.promise)
    mount(service, '/organizer/events')
    expect(await screen.findByText('Loading…')).toBeVisible()
    expect(screen.queryByText('No drafts in progress')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh drafts' })).toBeDisabled()
    await act(async () => response.resolve([]))
    expect(await screen.findByRole('heading', { name: 'No drafts in progress' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Drafts 0' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Create your first event' })).toHaveAttribute(
      'href',
      '/organizer/events/new',
    )
  })
  it('retries failed reads and removes stale drafts immediately when a refresh is denied', async () => {
    const service = services()
    service.drafts.mockRejectedValueOnce(new EventUiError('unavailable'))
    mount(service, '/organizer/events')
    await userEvent.click(await screen.findByRole('button', { name: 'Retry connection' }))
    expect(await screen.findByRole('heading', { name: values.title })).toBeVisible()
    const response = deferred<DraftSummary[]>()
    service.drafts.mockReturnValueOnce(response.promise)
    await userEvent.click(screen.getByRole('button', { name: 'Refresh drafts' }))
    expect(screen.queryByRole('heading', { name: values.title })).not.toBeInTheDocument()
    await act(async () => response.resolve([]))
    expect(await screen.findByRole('heading', { name: 'No drafts in progress' })).toBeVisible()
    service.drafts.mockRejectedValueOnce(new EventUiError('forbidden'))
    await userEvent.click(screen.getByRole('button', { name: 'Refresh drafts' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission')
    expect(screen.queryByText('No drafts in progress')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Continue editing/ })).not.toBeInTheDocument()
  })
  it('uses safe artwork with a fallback, incomplete metadata and encoded draft navigation', async () => {
    const service = services()
    service.drafts.mockResolvedValue([
      {
        id: 'id/with space',
        title: ' ',
        format: '',
        startDate: 'invalid',
        updatedAt: 'invalid',
        imageUrl: 'javascript:alert(1)',
      },
      {
        id: 'image',
        title: 'Artwork test',
        format: 'ONLINE',
        startDate: null,
        updatedAt: draft.updatedAt,
        imageUrl: 'https://example.test/banner.png',
      },
    ])
    mount(service, '/organizer/events')
    const link = await screen.findByRole('link', { name: 'Continue editing Untitled event' })
    expect(link).toHaveAttribute('href', '/organizer/events/id%2Fwith%20space/edit')
    expect(screen.getByText('No artwork')).toBeVisible()
    expect(screen.getByText('Update time unavailable')).toBeVisible()
    expect(screen.getByText('Format not set')).toBeVisible()
    const drafts = screen.getByRole('list')
    const image = drafts.querySelector('img')!
    expect(image).toHaveAttribute('src', 'https://example.test/banner.png')
    fireEvent.error(image)
    expect(await screen.findByText('Artwork unavailable')).toBeVisible()
    expect(drafts.querySelector('img')).toBeNull()
  })
  it('shows loading and error/retry without inventing drafts', async () => {
    const service = services()
    const response = deferred<EventDraft>()
    service.draft.mockReturnValueOnce(response.promise)
    const view = mount(service, '/organizer/events/draft-fixture/edit')
    expect(await screen.findByText('Loading…')).toBeVisible()
    view.unmount()
    expect(service.draft.mock.calls[0][1].signal.aborted).toBe(true)
    service.draft.mockRejectedValueOnce(new EventUiError('not-found'))
    mount(service, '/organizer/events/missing/edit')
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be found')
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })
  it('shows confirmed/cancelled bookings, searches the page and passes pagination selection', async () => {
    const service = services()
    mount(service, '/organizer/bookings')
    await screen.findByText('Sara Example')
    await userEvent.type(screen.getByRole('searchbox'), 'missing')
    expect(await screen.findByRole('heading', { name: 'No matching bookings' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() =>
      expect(service.bookings).toHaveBeenLastCalledWith(
        { status: 'CONFIRMED', page: 'page-two-fixture' },
        expect.anything(),
      ),
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Cancelled' }))
    expect(await screen.findByText('Unable to attend.')).toBeVisible()
    expect(service.bookings).toHaveBeenLastCalledWith(
      { status: 'CANCELLED', page: null },
      expect.anything(),
    )
    expect(screen.queryByRole('button', { name: /Cancel booking/ })).not.toBeInTheDocument()
  })
  it('removes participants when a refreshed request is denied', async () => {
    const service = services()
    mount(service, '/organizer/bookings')
    await screen.findByText('Sara Example')
    service.bookings.mockRejectedValueOnce(new EventUiError('forbidden'))
    await userEvent.click(screen.getByRole('button', { name: 'Refresh bookings' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission')
    expect(screen.queryByText('Sara Example')).not.toBeInTheDocument()
  })
  it('supports keyboard booking tabs and shows optional ticket/cancellation data only when supplied', async () => {
    const service = services()
    service.bookings.mockImplementation(async (selection) => ({
      items: [
        {
          id: 'ticket-fixture',
          eventTitle: 'Robotics',
          participantName: 'Sara Example',
          email: 'sara@example.test',
          registeredAt: '2026-11-20T10:00:00Z',
          status: selection.status,
          cancellationReason: selection.status === 'CANCELLED' ? 'Unable to attend.' : null,
          ticketCode: 'YN-TEST',
          cancelledAt: selection.status === 'CANCELLED' ? '2026-11-21T10:00:00Z' : null,
        },
      ],
      previousPage: null,
      nextPage: null,
      label: 'Page 1',
    }))
    mount(service, '/organizer/bookings')
    expect(await screen.findByText('YN-TEST')).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Ticket' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeVisible()
    const confirmed = screen.getByRole('tab', { name: /Confirmed/ })
    confirmed.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(await screen.findByText('Unable to attend.')).toBeVisible()
    const cancelled = screen.getByRole('tab', { name: /Cancelled/ })
    expect(cancelled).toHaveFocus()
    expect(cancelled).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'bookings-cancelled')
    expect(screen.getByRole('columnheader', { name: 'Cancelled' })).toBeVisible()
    expect(service.bookings).toHaveBeenLastCalledWith(
      { status: 'CANCELLED', page: null },
      expect.anything(),
    )
    await userEvent.keyboard('{Home}')
    expect(confirmed).toHaveFocus()
    await screen.findByText('YN-TEST')
    expect(screen.queryByRole('columnheader', { name: 'Cancelled' })).not.toBeInTheDocument()
  })
})

describe('frontend field rules pending S3-01 confirmation', () => {
  it('accepts partial drafts while requiring complete publication fields', () => {
    expect(validateEvent(emptyEvent, 'draft')).toEqual({})
    expect(validateEvent(emptyEvent, 'publish')).toHaveProperty('title')
    expect(validateEvent(values, 'publish')).toEqual({})
  })
  it('validates date order, supported links and positive capacity', () => {
    expect(
      validateEvent(
        { ...values, endDate: values.startDate, capacity: '0', imageUrl: 'javascript:alert(1)' },
        'publish',
      ),
    ).toMatchObject({
      endDate: expect.any(String),
      capacity: expect.any(String),
      imageUrl: expect.any(String),
    })
    expect(safeImageUrl('https://user:password@example.test/image.png')).toBeNull()
  })
  it('uses supplied deadline/category policy and ignores inactive mode fields', () => {
    expect(
      validateEvent({ ...values, registrationDeadline: '', categoryIds: [] }, 'publish', {
        ...baselineRules,
        automaticDeadlineRequired: true,
        categoryRequired: true,
      }),
    ).toMatchObject({ registrationDeadline: expect.any(String), categoryIds: expect.any(String) })
    expect(
      validateEvent(
        {
          ...values,
          registrationMode: 'EXTERNAL',
          registrationDeadline: 'invalid-hidden-value',
          externalRegistrationUrl: 'https://example.test/register',
        },
        'publish',
      ),
    ).toEqual({})
  })
})

describe('event integration response safeguards', () => {
  it('hides the editor and write actions when category access is denied', async () => {
    const service = services()
    service.categories.mockRejectedValueOnce(new EventUiError('forbidden'))
    mount(service)
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission')
    expect(screen.queryByRole('form', { name: 'Event creation' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument()
    expect(service.saveDraft).not.toHaveBeenCalled()
  })

  it('preserves entered values and locks writes when save returns another draft identity', async () => {
    const service = await openDraft()
    service.saveDraft.mockResolvedValueOnce({ ...draft, id: 'different-draft' })
    await userEvent.type(screen.getByLabelText(/Event title/), ' updated')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not confirm')
    expect(screen.getByLabelText(/Event title/)).toHaveValue(`${values.title} updated`)
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    expect(screen.queryByText('Draft saved.')).not.toBeInTheDocument()
  })

  it('uses a readable fallback for an invalid booking timestamp', async () => {
    const service = services()
    service.bookings.mockResolvedValueOnce({
      items: [
        {
          id: 'invalid-time',
          eventTitle: 'Robotics',
          participantName: 'Sara Example',
          email: 'sara@example.test',
          registeredAt: 'invalid',
          status: 'CONFIRMED',
          cancellationReason: null,
        },
      ],
      previousPage: null,
      nextPage: null,
      label: 'Page 1',
    })
    mount(service, '/organizer/bookings')
    expect(await screen.findByText('Booking time unavailable')).toBeVisible()
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument()
  })
})

it('requires an explicit save before publishing an edited persisted draft', async () => {
  const service = services()
  mount({ ...service, publishSavedOnly: true }, `/organizer/events/${draft.id}/edit`)
  await screen.findByDisplayValue(values.title)
  await userEvent.type(screen.getByRole('textbox', { name: 'Event title' }), ' updated')
  expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
  expect(service.publish).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  expect(await screen.findByText('Draft saved.', { exact: true })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
  await waitFor(() => expect(service.publish).toHaveBeenCalledTimes(1))
  expect(service.saveDraft).toHaveBeenCalledTimes(1)
})
