import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthDestination } from '../auth/getAuthDestination'
import LogoutButton from './LogoutButton'

const auth = vi.hoisted(() => ({
  status: 'authenticated',
  user: { email: 'organizer@example.test' },
  destination: '/organizer/dashboard' as AuthDestination,
  signOut: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../auth/useAuth', () => ({ useAuth: () => auth }))

function mount(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><LogoutButton /></MemoryRouter>)
}

beforeEach(() => {
  auth.status = 'authenticated'
  auth.destination = '/organizer/dashboard'
  auth.signOut.mockClear()
})

describe('account navigation after merging organizer and discovery pages', () => {
  it.each(['/organizer/dashboard', '/organizer/events', '/organizer/events/new', '/organizer/events/draft/edit', '/organizer/bookings'])(
    'keeps the organizer workspace navigation on %s', path => {
      mount(path)
      expect(screen.getByRole('navigation', { name: 'Organizer workspace' })).toBeVisible()
      expect(screen.queryByRole('button', { name: 'Account menu' })).not.toBeInTheDocument()
    },
  )

  it.each(['/events', '/events/event-id'])(
    'lets an organizer use the discovery account menu on %s', async path => {
      mount(path)
      expect(screen.queryByRole('navigation', { name: 'Organizer workspace' })).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
      expect(screen.getByRole('link', { name: 'Organizer dashboard' })).toHaveAttribute('href', '/organizer/dashboard')
      await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
      expect(auth.signOut).toHaveBeenCalledTimes(1)
    },
  )

  it('limits the admin header to admin routes while preserving discovery navigation', async () => {
    auth.destination = '/admin/applications'
    const view = mount('/admin/applications/application-id')
    expect(screen.getByRole('link', { name: /Younity Admin/ })).toBeVisible()
    view.unmount()
    mount('/events')
    expect(screen.queryByRole('link', { name: /Younity Admin/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.getByRole('link', { name: 'Application reviews' })).toHaveAttribute('href', '/admin/applications')
  })

  it('leaves account navigation to the status page layout', () => {
    auth.destination = '/organizer/pending'
    const { container } = mount('/organizer/pending')
    expect(container).toBeEmptyDOMElement()
  })
})
