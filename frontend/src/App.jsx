import { Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import './index.css'
import './styles/theme.css'
import Navbar from './components/Navbar'
import NotificationCenter from './components/NotificationCenter'
import Login from './pages/Login'
import Register from './pages/Register'
import UserDashboard from './pages/UserDashboard'
import JoinQueue from './pages/JoinQueue'
import QueueStatus from './pages/QueueStatus'
import History from './pages/History'
import AdminDashboard from './pages/AdminDashboard'
import ServiceManagement from './pages/ServiceManagement'
import QueueManagement from './pages/QueueManagement'
import { getCurrentUser } from './services/localApi'

function RequireAuth({ children, adminOnly }) {
  const user = getCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !user.isAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <div id="app-root">
      <Navbar />
      <NotificationCenter />
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/"
            element={
              <RequireAuth>
                <UserDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/join"
            element={
              <RequireAuth>
                <JoinQueue />
              </RequireAuth>
            }
          />
          <Route
            path="/status"
            element={
              <RequireAuth>
                <QueueStatus />
              </RequireAuth>
            }
          />
          <Route
            path="/history"
            element={
              <RequireAuth>
                <History />
              </RequireAuth>
            }
          />

          <Route
            path="/admin"
            element={
              <RequireAuth adminOnly>
                <AdminDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/services"
            element={
              <RequireAuth adminOnly>
                <ServiceManagement />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/queues"
            element={
              <RequireAuth adminOnly>
                <QueueManagement />
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
