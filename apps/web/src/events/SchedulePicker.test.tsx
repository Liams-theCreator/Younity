import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SchedulePicker from './SchedulePicker'
import { dayKey, scheduleDuration } from './schedule'

function setup(start = '2028-02-29T10:00', end = '2028-02-29T12:00') {
  const onApply = vi.fn()
  const onEditingChange = vi.fn()
  render(
    <SchedulePicker
      start={start}
      end={end}
      disabled={false}
      onApply={onApply}
      onEditingChange={onEditingChange}
    />,
  )
  return { onApply, onEditingChange }
}
describe('event schedule picker', () => {
  it('stages calendar and time edits and cancels without changing the event', async () => {
    const { onApply, onEditingChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Wednesday, 1 March 2028' }))
    await userEvent.selectOptions(screen.getByLabelText('Start date & time'), '11:00')
    expect(onEditingChange).toHaveBeenLastCalledWith(true)
    expect(onApply).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    const trigger = screen.getByRole('button', { name: /Event Schedule & Timing/ })
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveTextContent('29 Feb 2028')
    expect(onEditingChange).toHaveBeenLastCalledWith(false)
    await userEvent.click(trigger)
    expect(screen.getByLabelText('Start date & time')).toHaveValue('10:00')
  })
  it('retains a saved overnight range without an end-date field and restores focus', async () => {
    const { onApply, onEditingChange } = setup('2028-02-29T23:00', '2028-03-01T01:00')
    expect(screen.queryByLabelText('Event end date')).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Start date & time'), '23:30')
    await userEvent.selectOptions(screen.getByLabelText('End date & time'), '01:00')
    expect(
      within(screen.getByRole('region', { name: 'Schedule picker' })).getByText('1h 30m'),
    ).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Apply Schedule' }))
    expect(onApply).toHaveBeenCalledExactlyOnceWith('2028-02-29T23:30', '2028-03-01T01:00')
    expect(onEditingChange).toHaveBeenLastCalledWith(false)
    expect(screen.queryByRole('region', { name: 'Schedule picker' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Event Schedule & Timing/ })).toHaveFocus()
  })
  it('supports keyboard navigation through leap days and across month boundaries', async () => {
    setup()
    const leapDay = screen.getByRole('button', { name: 'Tuesday, 29 February 2028' })
    leapDay.focus()
    await userEvent.keyboard('{ArrowRight}')
    const march = screen.getByRole('button', { name: 'Wednesday, 1 March 2028' })
    expect(march).toHaveFocus()
    expect(screen.getByRole('grid', { name: 'March 2028' })).toBeVisible()
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('button', { name: 'Monday, 28 February 2028' })).toHaveFocus()
    await userEvent.keyboard('{PageDown}')
    expect(screen.getByRole('button', { name: 'Tuesday, 28 March 2028' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('gridcell', { selected: true })).toHaveTextContent('28')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Schedule picker' })).not.toBeInTheDocument()
  })
  it('preserves a saved nonstandard time without offering custom time and rejects reversed ranges', async () => {
    const { onApply } = setup('2028-02-29T11:17', '2028-02-29T12:00')
    expect(screen.queryByRole('option', { name: /Custom time/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Start date & time')).toHaveValue('11:17')
    await userEvent.selectOptions(screen.getByLabelText('End date & time'), '10:00')
    await userEvent.click(screen.getByRole('button', { name: 'Apply Schedule' }))
    expect(screen.getByRole('alert')).toHaveTextContent('The end must be after the start.')
    expect(onApply).not.toHaveBeenCalled()
    await userEvent.selectOptions(screen.getByLabelText('End date & time'), '12:00')
    await userEvent.click(screen.getByRole('button', { name: 'Apply Schedule' }))
    expect(onApply).toHaveBeenCalledExactlyOnceWith('2028-02-29T11:17', '2028-02-29T12:00')
  })
  it('uses current dates for presets and never supplies default event times', async () => {
    const { onApply } = setup('', '')
    await userEvent.click(screen.getByRole('button', { name: 'Apply Schedule' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a date, start time and end time.')
    await userEvent.click(screen.getByRole('button', { name: 'Tomorrow' }))
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(screen.queryByLabelText('Event end date')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Start date & time')).toHaveValue('')
    expect(onApply).not.toHaveBeenCalled()
    await userEvent.selectOptions(screen.getByLabelText('Start date & time'), '10:00')
    await userEvent.selectOptions(screen.getByLabelText('End date & time'), '12:00')
    await userEvent.click(screen.getByRole('button', { name: 'Apply Schedule' }))
    expect(onApply).toHaveBeenCalledExactlyOnceWith(`${dayKey(tomorrow)}T10:00`, `${dayKey(tomorrow)}T12:00`)
  })
  it('computes valid short and multi-day durations without accepting reversed ranges', () => {
    expect(scheduleDuration('2028-02-29T10:00', '2028-02-29T10:30')).toBe('0h 30m')
    expect(scheduleDuration('2028-02-29T10:00', '2028-03-01T12:00')).toBe('26h')
    expect(scheduleDuration('2028-02-29T10:00', '2028-02-29T09:00')).toBeNull()
    expect(scheduleDuration('', '')).toBeNull()
  })
})
