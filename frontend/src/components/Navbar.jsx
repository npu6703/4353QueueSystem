import { Link, useNavigate } from 'react-router-dom'
import { getCurrentUser, logout } from '../services/localApi'

export default function Navbar() {
  const user = getCurrentUser()
  const nav = useNavigate()
  function doLogout() {
    logout()
    nav('/login')
  }
  return (
    <nav className="nav">
      <div className="brand">Restaurant Queue</div>
      <div className="links">
        {user ? (
          <>
            <Link to="/">Dashboard</Link>
            <Link to="/join">Join Queue</Link>
            <Link to="/status">My Status</Link>
            <Link to="/history">History</Link>
            {user.isAdmin && <Link to="/admin">Admin</Link>}
            <button onClick={doLogout} className="link-btn">Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  )
}
