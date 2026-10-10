import { Link, Route, Routes } from 'react-router'
import RegisterPage from './pages/RegisterPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RegisterPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/register/student"
        element={
          <main className="min-h-screen bg-[#101417] p-8 text-white">
            <h1 className="text-3xl font-bold">Student registration</h1>
            <Link
              to="/register"
              className="mt-6 inline-block text-[#A6DDF5] underline"
            >
              Back to account selection
            </Link>
          </main>
        }
      />

      <Route
        path="/register/organizer"
        element={
          <main className="min-h-screen bg-[#101417] p-8 text-white">
            <h1 className="text-3xl font-bold">Organizer registration</h1>
            <Link
              to="/register"
              className="mt-6 inline-block text-[#A6DDF5] underline"
            >
              Back to account selection
            </Link>
          </main>
        }
      />

      <Route path="*" element={<h1>Page not found</h1>} />
    </Routes>
  )
}