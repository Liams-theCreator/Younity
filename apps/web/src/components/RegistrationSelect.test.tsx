import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RegistrationSelect from './RegistrationSelect'

describe('registration dropdown opening', () => {
  it.each(['University / Academic Institution', 'Entity Category'])(
    'opens %s on click release without committing an option', (label) => {
      const onChange = vi.fn()
      render(<RegistrationSelect id="choice" label={label} placeholder="Choose an option"
        options={[{ value: 'first', label: 'First' }, { value: 'other', label: 'Other' }]}
        value="" onChange={onChange} />)
      const select = screen.getByRole('combobox') as HTMLSelectElement
      const showPicker = vi.fn()
      Object.defineProperty(select, 'showPicker', { value: showPicker, configurable: true })
      expect(fireEvent.mouseDown(select, { button: 0 })).toBe(false)
      expect(select).toHaveFocus()
      expect(showPicker).not.toHaveBeenCalled()
      fireEvent.mouseUp(select)
      fireEvent.click(select, { detail: 1 })
      expect(showPicker).toHaveBeenCalledOnce()
      expect(select).toHaveValue('')
      expect(onChange).not.toHaveBeenCalled()
      fireEvent.change(select, { target: { value: 'other' } })
      expect(onChange).toHaveBeenCalledWith('other')
    },
  )

  it('preserves native opening when showPicker is unavailable', () => {
    render(<RegistrationSelect id="choice" label="Choice" placeholder="Choose"
      options={[]} value="" onChange={vi.fn()} />)
    const select = screen.getByRole('combobox')
    Object.defineProperty(select, 'showPicker', { value: undefined, configurable: true })
    expect(fireEvent.mouseDown(select, { button: 0 })).toBe(true)
    expect(() => fireEvent.click(select, { detail: 1 })).not.toThrow()
  })
})
