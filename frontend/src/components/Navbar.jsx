import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getCurrentUser, logout } from '../services/localApi'
import { getNotifications as getUserNotifs, markNotificationsRead as markUserRead } from '../services/userApi'
import { getNotifications as getAdminNotifs, markNotificationsRead as markAdminRead } from '../services/adminApi'

export default function Navbar() {
  const user = getCurrentUser()
  const nav = useNavigate()
  const location = useLocation()
  const [showNotifs, setShowNotifs] = useState(false)
  const [notifs, setNotifs] = useState([])
  const dropdownRef = useRef(null)

  const fetchNotifs = useCallback(async () => {
    if (!user?.id) {
      setNotifs([])
      return
    }
    try {
      const list = user.isAdmin ? await getAdminNotifs(user.id) : await getUserNotifs(user.id)
      setNotifs(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error('Failed to load notifications:', err)
      setNotifs([])
    }
  }, [user?.id, user?.isAdmin])

  useEffect(() => { fetchNotifs() }, [fetchNotifs, location])

  // Poll for new notifications while logged in so the bell updates without
  // requiring a page navigation.
  useEffect(() => {
    if (!user?.id) return
    const interval = setInterval(fetchNotifs, 5000)
    return () => clearInterval(interval)
  }, [fetchNotifs, user?.id])

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function doLogout() {
    logout()
    nav('/login')
  }

  async function handleMarkRead() {
    if (!user?.id) return
    try {
      if (user.isAdmin) await markAdminRead(user.id)
      else await markUserRead(user.id)
      await fetchNotifs()
    } catch (err) {
      console.error('Failed to mark notifications read:', err)
    }
  }

  const unreadCount = notifs.filter(n => n.status !== 'viewed' && !n.read).length

  function isActive(path) {
    if (path === '/admin') return location.pathname.startsWith('/admin')
    return location.pathname === path
  }

  return (
    <nav className="nav">
      <Link to={user ? (user.isAdmin ? '/admin' : '/') : '/login'} className="brand">QueueSmart</Link>
      <div className="nav-right">
        {user ? (
          <>
            <div className="nav-links">
              {user.isAdmin ? (
                <>
                  <Link to="/admin" className={isActive('/admin') && !location.pathname.includes('/services') && !location.pathname.includes('/queues') ? 'nav-link active' : 'nav-link'}>Dashboard</Link>
                  <Link to="/admin/services" className={location.pathname === '/admin/services' ? 'nav-link active' : 'nav-link'}>Services</Link>
                  <Link to="/admin/queues" className={location.pathname === '/admin/queues' ? 'nav-link active' : 'nav-link'}>Queues</Link>
                </>
              ) : (
                <>
                  <Link to="/" className={isActive('/') ? 'nav-link active' : 'nav-link'}>Dashboard</Link>
                  <Link to="/join" className={isActive('/join') ? 'nav-link active' : 'nav-link'}>Join Queue</Link>
                  <Link to="/status" className={isActive('/status') ? 'nav-link active' : 'nav-link'}>My Status</Link>
                  <Link to="/history" className={isActive('/history') ? 'nav-link active' : 'nav-link'}>History</Link>
                </>
              )}
            </div>

            <div className="nav-actions">
              <span className="nav-role-badge">{user.isAdmin ? 'Admin' : 'User'}</span>

              {/* Bell icon */}
              <div className="notif-wrapper" ref={dropdownRef}>
                <button className="notif-bell" onClick={() => setShowNotifs(!showNotifs)} title="Notifications">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                </button>

                {showNotifs && (
                  <div className="notif-dropdown">
                    <div className="notif-dropdown-header">
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <button className="notif-mark-btn" onClick={handleMarkRead}>Mark all read</button>
                      )}
                    </div>
                    {notifs.length === 0 ? (
                      <div className="notif-empty">No notifications</div>
                    ) : (
                      <ul className="notif-list">
                        {notifs.map(n => {
                          const id = n.notification_id ?? n.id
                          const unread = n.status !== 'viewed' && !n.read
                          return (
                            <li key={id} className={unread ? 'notif-item' : 'notif-item read'}>
                              <div className="notif-dot-wrapper">
                                {unread && <span className="notif-dot" />}
                              </div>
                              <span className="notif-message">{n.message}</span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <button onClick={doLogout} className="logout-btn">Logout</button>
            </div>
          </>
        ) : (
          <div className="nav-links">
            <Link to="/login" className={isActive('/login') ? 'nav-link active' : 'nav-link'}>Login</Link>
            <Link to="/register" className={isActive('/register') ? 'nav-link active' : 'nav-link'}>Register</Link>
          </div>
        )}
      </div>
    </nav>
  )
}
