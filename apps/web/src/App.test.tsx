import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from './App'
import AuthProvider, { type AuthService } from './auth/AuthProvider'
const service: AuthService = { getSession: async () => null, login: async () => ({ id: 1, email: 'test@example.test' }), logout: async () => {} }

describe('merged registration and login routes', () => {
  it('keeps account selection at the root', () => {
    render(<MemoryRouter initialEntries={['/']}><AuthProvider service={service}><App /></AuthProvider></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /I am a student/ })).toHaveAttribute('href', '/register/student')
    expect(screen.getByRole('link', { name: /I am an organizer/ })).toHaveAttribute('href', '/register/organizer')
  })

  it.each(['/register/student', '/register/organizer'])('opens login from %s', async (path) => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={[path]}><AuthProvider service={service}><App /></AuthProvider></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: 'Sign In' }))
    expect(screen.getByRole('heading', { name: 'Welcome back to Younity' })).toBeInTheDocument()
    expect(await screen.findByRole('form', { name: 'Sign in to Younity' })).toBeInTheDocument()
  })
})
