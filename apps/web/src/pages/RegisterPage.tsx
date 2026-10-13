import { Link } from 'react-router'
import { RegistrationLayout } from '../components/RegistrationForm'

export default function RegisterPage() {
  return <RegistrationLayout title="Create your account" introduction="Choose how you want to use Younity.">
    <div className="account-options">
      <Link className="account-option" to="/register/student"><span className="account-symbol" aria-hidden="true">S</span><h2>I am a student</h2><p>Discover campus events and opportunities.</p><span className="option-action">Register as a student →</span></Link>
      <Link className="account-option" to="/register/organizer"><span className="account-symbol" aria-hidden="true">O</span><h2>I am an organizer</h2><p>Create an account to organize events.</p><span className="option-action">Register as an organizer →</span></Link>
    </div>
  </RegistrationLayout>
}
