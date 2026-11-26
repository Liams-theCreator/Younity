import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import OrganizerDashboardPage from './OrganizerDashboardPage'
import { EventUiError, type EventServices, type OrganizerDashboard } from '../events/model'

const request = vi.fn<typeof fetch>()
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { email: 'organizer@example.test' }, requestProtected: request }) }))
const snapshot: OrganizerDashboard = {
  organizationName: 'Campus club', organizerName: 'Sara',
  metrics: { activeEvents: 0, confirmedBookings: 0, capacityUtilization: null, draftCount: 0 },
  upcomingEvents: [], drafts: [], recentBookings: [],
}
function mount(service: EventServices) {
  return render(<MemoryRouter><OrganizerDashboardPage service={service} /></MemoryRouter>)
}
describe('organizer dashboard', () => {
  it('renders real zero metrics, empty sections, and working navigation', async () => {
    mount({ dashboard: vi.fn().mockResolvedValue(snapshot) })
    expect(await screen.findByText('Campus club')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Organizer dashboard' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Your next event starts here' })).toBeVisible()
    const metrics = screen.getByRole('region', { name: 'Organization overview' })
    expect(within(metrics).getAllByText('0')).toHaveLength(3)
    expect(within(metrics).getByText('—')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Create event' })).toHaveAttribute('href', '/organizer/events/new')
  })
  it('shows saved drafts, upcoming capacities, and participant activity from the snapshot', async () => {
    mount({ dashboard: vi.fn().mockResolvedValue({
      ...snapshot, metrics: { activeEvents: 1, confirmedBookings: 8, capacityUtilization: 80, draftCount: 1 },
      upcomingEvents: [{ id: 'event', title: 'Campus talk', startDate: '2027-06-10T10:00:00Z', endDate: '2027-06-10T12:00:00Z', format: 'ONLINE', imageUrl: null, location: null, capacity: 10, confirmedCount: 8 }],
      drafts: [{ id: 'draft', title: 'Next workshop', updatedAt: '2026-11-26T10:00:00Z', startDate: null, format: 'ONLINE' }],
      recentBookings: [{ id: 'booking', participantName: 'Aya Example', eventTitle: 'Campus talk', status: 'CONFIRMED', updatedAt: '2026-11-26T11:00:00Z' }],
    }) })
    expect(await screen.findByText('Aya Example')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Continue editing Next workshop' })).toHaveAttribute('href', '/organizer/events/draft/edit')
    expect(screen.getByRole('meter', { name: 'Capacity utilization' })).toHaveAttribute('aria-valuenow', '80')
    expect(screen.getByText('/ 10 capacity', { exact: false })).toBeVisible()
  })
  it('clears a denied refresh and removes participant information', async () => {
    const dashboard = vi.fn().mockResolvedValueOnce({ ...snapshot, recentBookings: [{ id: 'booking', participantName: 'Aya Example', eventTitle: 'Talk', status: 'CONFIRMED', updatedAt: '2026-11-26T11:00:00Z' }] }).mockRejectedValue(new EventUiError('forbidden'))
    mount({ dashboard })
    await screen.findByText('Aya Example')
    await userEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('permission')
    expect(screen.queryByText('Aya Example')).not.toBeInTheDocument()
  })
  it('offers retry after a request failure and loads the new snapshot', async () => {
    const dashboard = vi.fn().mockRejectedValueOnce(new EventUiError('unavailable')).mockResolvedValue(snapshot)
    mount({ dashboard })
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByText('Campus club')).toBeVisible())
    expect(dashboard).toHaveBeenCalledTimes(2)
  })
})
