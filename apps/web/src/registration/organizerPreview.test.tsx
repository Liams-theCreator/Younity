import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { emptyOrganizationDetails, validateOrganization } from './organizationDraft'
import OrganizerRegisterPage from '../pages/OrganizerRegisterPage'
import OrganizerPendingPage from '../pages/OrganizerPendingPage'
import OrganizerApplicationStatus from '../components/OrganizerApplicationStatus'

function Location() {
  return <output aria-label="Current route">{useLocation().pathname}</output>
}
function setup() {
  render(
    <MemoryRouter initialEntries={['/register/organizer']}>
      <OrganizerRegisterPage />
      <Location />
    </MemoryRouter>,
  )
  return userEvent.setup()
}
async function fillDetails(user: ReturnType<typeof userEvent.setup>) {
  for (const [label, value] of [
    ['Organization / University Entity Name', 'Campus Club'],
    ['Representative Full Name', 'Yasmine'],
    ['Title / Academic Position', 'Coordinator'],
    ['Direct Contact Phone', '+212600000000'],
    ['Email Address', 'organizer@example.test'],
    ['Account Password', 'Abcdefg1!'],
    ['Confirm password', 'Abcdefg1!'],
  ]) {
    await user.type(screen.getByLabelText(label, { exact: true }), value)
  }
  await user.selectOptions(screen.getByLabelText('Entity Category'), 'STUDENT_CLUB')
}
const submitName = 'Submit Organization for Verification'

describe('organizer local registration', () => {
  it('requires a custom category only for Other and retains it when switching options', async () => {
    const user = setup()
    const select = screen.getByLabelText('Entity Category')
    expect(screen.queryByLabelText('Custom Entity Category')).not.toBeInTheDocument()
    await user.selectOptions(select, 'OTHER')
    expect(screen.getByLabelText('Custom Entity Category')).toBeRequired()
    await user.click(screen.getByRole('button', { name: submitName }))
    expect(screen.getByText('Enter your entity category.')).toBeVisible()
    await user.type(screen.getByLabelText('Custom Entity Category'), 'Research Network')
    await user.selectOptions(select, 'UNIVERSITY')
    expect(screen.queryByLabelText('Custom Entity Category')).not.toBeInTheDocument()
    await user.selectOptions(select, 'OTHER')
    expect(screen.getByLabelText('Custom Entity Category')).toHaveValue('Research Network')
    expect(validateOrganization({ ...emptyOrganizationDetails, category: 'OTHER', customCategory: '   ' }).customCategory).toBeDefined()
    expect(validateOrganization({ ...emptyOrganizationDetails, category: 'OTHER', customCategory: 'Research Network' }).customCategory).toBeUndefined()
    expect(validateOrganization({ ...emptyOrganizationDetails, category: 'UNIVERSITY' }).customCategory).toBeUndefined()
  })
  it('validates required fields and policies before simulating submission', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: submitName }))
    expect(screen.getByLabelText('Organization / University Entity Name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('Status: Queued')).not.toBeInTheDocument()
    await fillDetails(user)
    await user.click(screen.getByRole('button', { name: submitName }))
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('Status: Queued')).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: submitName }))
    expect(screen.getByRole('button', { name: 'Submitting...' })).toBeDisabled()
    expect(screen.getByText('Submitting...', { selector: '[role="status"]' })).toBeVisible()
    expect(screen.queryByText('Status: Queued')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Institutional Dossier Submitted' }, { timeout: 3000 })).toBeVisible()
    expect(screen.getByText('Status: Queued')).toBeVisible()
    expect(screen.getByRole('heading', { name: /Validation Pipeline/ })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Academic Liaison Desk' })).toBeVisible()
    expect(
      screen.queryByRole('navigation', { name: 'Preview application state' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/Preview only/)).toBeVisible()
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register/organizer')
  })

  it('submits a revised dossier back to pending', async () => {
    const user = userEvent.setup()
    const onStateChange = vi.fn()
    render(
      <MemoryRouter>
        <OrganizerApplicationStatus state="needs_edit" onStateChange={onStateChange} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Official Dean Endorsement Missing / Incomplete')).toBeVisible()
    await user.upload(
      screen.getByLabelText('Replacement affiliation document'),
      new File(['revised'], 'revised.pdf', { type: 'application/pdf' }),
    )
    expect(screen.getByText('Selected: revised.pdf')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Submit Revised Dossier' }))
    expect(onStateChange).toHaveBeenCalledWith('pending')
  })

  it('supports keyboard browsing, dropping, replacement, cancellation, removal and reselecting a file', async () => {
    const user = setup()
    await fillDetails(user)
    const input = screen.getByLabelText('Affiliation or authorization document') as HTMLInputElement
    const browse = screen.getByRole('button', { name: 'Browse files' })
    const click = vi.spyOn(input, 'click')
    browse.focus()
    await user.keyboard('{Enter}')
    expect(click).toHaveBeenCalledTimes(1)
    click.mockRestore()
    const file = new File(['local'], 'mandate.txt', { type: 'text/plain' })
    fireEvent.drop(input.closest('.document-dropzone')!, { dataTransfer: { files: [file] } })
    expect(screen.getByText('Selected: mandate.txt')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Replace document' })).toBeVisible()
    fireEvent.change(input, { target: { files: [] } })
    expect(screen.getByText('Selected: mandate.txt')).toBeVisible()
    await user.upload(input, new File(['other'], 'replacement.pdf', { type: 'application/pdf' }))
    expect(screen.getByText('Selected: replacement.pdf')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Remove document' }))
    expect(screen.queryByText('Selected: replacement.pdf')).not.toBeInTheDocument()
    await user.upload(input, file)
    expect(screen.getByText('Selected: mandate.txt')).toBeVisible()
    expect(input).not.toHaveAttribute('accept')
    expect(input).not.toBeRequired()
  })

  it('opens the picker once from any non-control area and keeps nested file controls independent', async () => {
    const user = setup()
    const input = screen.getByLabelText('Affiliation or authorization document') as HTMLInputElement
    const click = vi.spyOn(input, 'click')
    const zone = screen.getByRole('group', { name: 'Upload affiliation document' })
    for (const target of [
      zone,
      screen.getByText(/Drop Faculty Endorsement/),
      screen.getByText(/Optional preview selection only/),
      zone.querySelector('.document-icon')!,
    ]) {
      click.mockClear()
      await user.click(target)
      expect(click).toHaveBeenCalledTimes(1)
    }
    click.mockClear()
    await user.click(screen.getByRole('button', { name: 'Browse files' }))
    expect(click).toHaveBeenCalledTimes(1)
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['test'], 'mandate.pdf')] } })
    click.mockClear()
    await user.click(screen.getByRole('button', { name: 'Replace document' }))
    expect(click).toHaveBeenCalledTimes(1)
    click.mockClear()
    await user.click(screen.getByRole('button', { name: 'Remove document' }))
    expect(click).not.toHaveBeenCalled()
    expect(screen.queryByText('Selected: mandate.pdf')).not.toBeInTheDocument()
    click.mockRestore()
  })

  it('allows an empty optional file selection for preview submission', async () => {
    const user = setup()
    await fillDetails(user)
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: submitName }))
    expect(await screen.findByText('Status: Queued', {}, { timeout: 3000 })).toBeVisible()
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register/organizer')
  })

  it('renders the same detailed pending screen on the standalone route', () => {
    render(
      <MemoryRouter initialEntries={['/organizer/pending']}>
        <OrganizerPendingPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('Status: Queued')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Academic Liaison Desk' })).toBeVisible()
    expect(screen.getByText('Credential & Mandate Review')).toBeVisible()
    expect(screen.getByText('Event Management Console Activation')).toBeVisible()
    expect(screen.getByText(/preview only/i)).toBeVisible()
  })
})
