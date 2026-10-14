import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('merged registration and login routes', () => {
  it('keeps account selection at the root', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /I am a student/ })).toHaveAttribute('href', '/register/student')
    expect(screen.getByRole('link', { name: /I am an organizer/ })).toHaveAttribute('href', '/register/organizer')
  })

  it.each(['/register/student', '/register/organizer'])('opens login from %s', async (path) => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: 'Sign In' }))
    expect(screen.getByRole('heading', { name: 'Welcome back to Younity' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Sign in to Younity' })).toBeInTheDocument()
  })
})
