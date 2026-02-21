import { useState, useEffect } from 'react'
import { getCurrentUser, getUserQueueStatus, leaveQueue } from '../services/localApi'
import { useNavigate } from 'react-router-dom'

export default function QueueStatus() {
  const user = getCurrentUser()
  const nav = useNavigate()
  const [status, setStatus] = useState(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    setStatus(user ? getUserQueueStatus(user.id) : null)
  }, [])

  // Refresh every 10s to show live score changes from aging
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(user ? getUserQueueStatus(user.id) : null)
      setTick(t => t + 1)
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  function handleLeave() {
    if (!status) return
    leaveQueue(status.serviceId, user.id)
    setStatus(null)
  }

  function getStatusLabel(position) {
    if (position === 1) return { text: 'You are NEXT!', className: 'queue-status-next' }
    if (position === 2) return { text: 'Almost ready', className: 'queue-status-almost' }
    return { text: 'Waiting', className: 'queue-status-waiting' }
  }

  function getWaitedTime() {
    if (!status?.joinedAt) return '0 min'
    const mins = Math.round((Date.now() - new Date(status.joinedAt).getTime()) / 60000)
    if (mins < 1) return 'Just joined'
    return `${mins} min`
  }

  return (
    <div className="card">
      <h2>Queue Status</h2>
      {status ? (() => {
        const label = getStatusLabel(status.position)
        return (
          <div className="queue-status-detail">
            {/* Status banner */}
            <div className={`queue-status-label ${label.className}`}>
              {label.text}
            </div>

            <div className="queue-status-grid">
              <div className="queue-stat-box">
                <div className="queue-stat-number">{status.position}</div>
                <div className="queue-stat-title">Position</div>
                <div className="queue-stat-sub">of {status.total} in queue</div>
              </div>
              <div className="queue-stat-box">
                <div className="queue-stat-number">{status.expectedWait}</div>
                <div className="queue-stat-title">Est. Minutes</div>
                <div className="queue-stat-sub">until your turn</div>
              </div>
              <div className="queue-stat-box">
                <div className="queue-stat-number">{status.score}</div>
                <div className="queue-stat-title">Your Score</div>
                <div className="queue-stat-sub">priority + aging</div>
              </div>
            </div>

            <div className="queue-status-info-list">
              <div className="queue-status-info-row">
                <span>Service:</span> <strong>{status.serviceName}</strong>
              </div>
              <div className="queue-status-info-row">
                <span>Priority:</span>
                <span className={`priority-badge priority-${status.priority}`}>{status.priority}</span>
              </div>
              <div className="queue-status-info-row">
                <span>Time waiting:</span> {getWaitedTime()}
              </div>
              <div className="queue-status-info-row">
                <span>Joined at:</span> {new Date(status.joinedAt).toLocaleTimeString()}
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
              <button className="admin-btn admin-btn-danger" onClick={handleLeave}>Leave Queue</button>
            </div>
          </div>
        )
      })() : (
        <div className="queue-empty-state">
          <p>You're not in any queue right now.</p>
          <button className="primary" onClick={() => nav('/join')}>Join a Queue</button>
        </div>
      )}
    </div>
  )
}
