import { Link, Route, Routes } from 'react-router'
import RegisterPage from './pages/RegisterPage'
import StudentRegisterPage from './pages/StudentRegisterPage'
import OrganizerRegisterPage from './pages/OrganizerRegisterPage'
import OrganizerPendingPage from './pages/OrganizerPendingPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RegisterPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/student" element={<StudentRegisterPage />} />
      <Route path="/register/organizer" element={<OrganizerRegisterPage />} />
      <Route path="/organizer/pending" element={<OrganizerPendingPage />} />
      <Route path="*" element={<main className="registration-shell"><section className="registration-card"><h1>Page not found</h1><Link to="/register">Back to account selection</Link></section></main>} />
    </Routes>
  )
}
