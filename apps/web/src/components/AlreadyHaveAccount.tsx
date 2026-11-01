import { Link } from 'react-router'

export default function AlreadyHaveAccount({ signInPath }: { signInPath?: string }) {
  return (
    <div className="sign-in-footer">
      <p>
        Already have an account?{' '}
        {signInPath ? (
          <Link to={signInPath}>Sign In</Link>
        ) : (
          <span className="sign-in-unavailable" aria-disabled="true">
            Sign In
          </span>
        )}
      </p>
      {!signInPath && <p className="sign-in-note">Sign in is not available yet.</p>}
    </div>
  )
}
