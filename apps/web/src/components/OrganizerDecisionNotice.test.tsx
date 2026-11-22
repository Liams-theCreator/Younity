import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import OrganizerDecisionNotice from './OrganizerDecisionNotice'
import type { OrganizerDecisionNoticeProps } from './OrganizerDecisionNotice'

describe('OrganizerDecisionNotice', () => {
  it.each([
    ['PENDING', 'Pending review', 'Organization verification pending', 'waiting for review'],
    ['APPROVED', 'Approved', 'Your organizer application is approved', 'organizer dashboard'],
    ['NEEDS_CHANGES', 'Changes requested', 'Your application needs changes', 'resubmit'],
    ['REJECTED', 'Rejected', 'Your application was not approved', 'application is closed'],
  ] as const)('presents %s with an accessible heading, status, explanation and no invented actions', (status, label, title, description) => {
    render(<OrganizerDecisionNotice status={status} explanation="Your submitted details were reviewed." />)
    const region = screen.getByRole('region', { name: title })
    expect(within(region).getByRole('heading', { level: 2, name: title })).toBeVisible()
    expect(within(region).getByRole('status')).toHaveTextContent(label)
    expect(within(region).getByText(new RegExp(description))).toBeVisible()
    expect(within(region).getByText('Your submitted details were reviewed.')).toBeVisible()
    expect(within(region).queryByRole('button')).not.toBeInTheDocument()
  })

  it.each([undefined, null, '', ' \n\t '])('does not fabricate feedback when explanation is %s', (explanation) => {
    render(<OrganizerDecisionNotice status="REJECTED" explanation={explanation} />)
    expect(screen.queryByText('Reviewer feedback')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders only explicitly permitted action labels and calls the matching callbacks using the keyboard', async () => {
    const edit = vi.fn()
    const refresh = vi.fn()
    const user = userEvent.setup()
    render(<OrganizerDecisionNotice status="NEEDS_CHANGES" actions={[
      { id: 'edit', label: 'Edit application', onClick: edit },
      { id: 'refresh', label: 'Check status again', onClick: refresh },
    ]} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /dashboard|approve|resubmit/i })).not.toBeInTheDocument()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Edit application' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(edit).toHaveBeenCalledTimes(1)
    expect(refresh).not.toHaveBeenCalled()
    await user.tab()
    await user.keyboard(' ')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('uses non-submit buttons when embedded in a form', async () => {
    const submit = vi.fn((event) => event.preventDefault())
    const action = vi.fn()
    render(<form onSubmit={submit}><OrganizerDecisionNotice status="PENDING" actions={[
      { id: 'refresh', label: 'Check status again', onClick: action },
    ]} /></form>)
    await userEvent.click(screen.getByRole('button', { name: 'Check status again' }))
    expect(action).toHaveBeenCalledTimes(1)
    expect(submit).not.toHaveBeenCalled()
  })

  it('disables permitted actions while the parent is busy and enables them afterward', async () => {
    const callback = vi.fn()
    const actions = [{ id: 'enter', label: 'Enter organizer dashboard', onClick: callback }]
    const { rerender } = render(<OrganizerDecisionNotice status="APPROVED" actions={actions} busy busyLabel="Confirming your choice…" />)
    expect(screen.getByRole('group', { name: 'Available actions' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Confirming your choice…')).toHaveAttribute('role', 'status')
    const button = screen.getByRole('button', { name: actions[0].label })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(callback).not.toHaveBeenCalled()
    rerender(<OrganizerDecisionNotice status="APPROVED" actions={actions} />)
    expect(button).toBeEnabled()
    expect(screen.queryByText('Confirming your choice…')).not.toBeInTheDocument()
    await userEvent.click(button)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('expands and collapses long feedback by keyboard without losing focus', async () => {
    const explanation = `${'Please provide your current contact details. '.repeat(7)}Final instruction.`
    render(<OrganizerDecisionNotice status="NEEDS_CHANGES" explanation={explanation} />)
    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: 'Read full feedback' })
    const text = document.getElementById(button.getAttribute('aria-controls')!)!
    expect(text).toHaveTextContent(`${explanation.slice(0, 200)}…`)
    expect(text.textContent).not.toContain('Final instruction.')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await user.tab()
    await user.keyboard('{Enter}')
    expect(text.textContent).toBe(explanation)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAccessibleName('Show less feedback')
    expect(button).toHaveFocus()
    await user.keyboard(' ')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveFocus()
  })

  it('keeps short feedback fully visible without an expansion action', () => {
    render(<OrganizerDecisionNotice status="REJECTED" explanation={'a'.repeat(200)} />)
    expect(screen.getByText('a'.repeat(200))).toBeVisible()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('preserves complete Unicode characters in the feedback preview', () => {
    const explanation = `${'م'.repeat(199)}🎓 Please update the application.`
    render(<OrganizerDecisionNotice status="NEEDS_CHANGES" explanation={explanation} />)
    expect(screen.getByText(`${'م'.repeat(199)}🎓…`)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Read full feedback' }))
    expect(screen.getByText(explanation)).toBeVisible()
  })

  it('resets expanded feedback when a different decision or explanation arrives', () => {
    const { rerender } = render(<OrganizerDecisionNotice status="NEEDS_CHANGES" explanation={'a'.repeat(201)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Read full feedback' }))
    rerender(<OrganizerDecisionNotice status="NEEDS_CHANGES" explanation={'b'.repeat(201)} />)
    expect(screen.getByRole('button', { name: 'Read full feedback' })).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Read full feedback' }))
    rerender(<OrganizerDecisionNotice status="REJECTED" explanation={'b'.repeat(201)} />)
    expect(screen.getByRole('button', { name: 'Read full feedback' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows plain text safely, preserving line breaks rather than interpreting HTML', () => {
    const explanation = '<script>throw new Error("unsafe")</script>\nRead the instructions.'
    const { container } = render(<OrganizerDecisionNotice status="NEEDS_CHANGES" explanation={explanation} />)
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByText(/Read the instructions/).textContent).toBe(explanation)
  })

  it.each([1, 2, 3] as const)('supports heading level %i in an existing page', (headingLevel) => {
    render(<OrganizerDecisionNotice status="APPROVED" headingLevel={headingLevel} />)
    expect(screen.getByRole('heading', { level: headingLevel })).toHaveTextContent('Your organizer application is approved')
  })

  it('uses distinct accessible IDs for multiple notices', () => {
    render(<><OrganizerDecisionNotice status="PENDING" /><OrganizerDecisionNotice status="APPROVED" /></>)
    const labels = screen.getAllByRole('region').map((region) => region.getAttribute('aria-labelledby'))
    expect(new Set(labels).size).toBe(2)
    labels.forEach((id) => expect(document.getElementById(id!)).not.toBeNull())
  })

  it('updates status, explanation and permitted actions from parent props without fetching', () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const props: OrganizerDecisionNoticeProps = {
      status: 'PENDING',
      actions: [{ id: 'refresh', label: 'Check status again', onClick: vi.fn() }],
    }
    const { rerender } = render(<OrganizerDecisionNotice {...props} />)
    rerender(<OrganizerDecisionNotice status="REJECTED" explanation="The application is outside the supported scope." />)
    expect(screen.getByRole('status')).toHaveTextContent('Rejected')
    expect(screen.getByText('The application is outside the supported scope.')).toBeVisible()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    fetch.mockRestore()
  })
})
