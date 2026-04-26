import { useState, useEffect } from 'react'
import { getCurrentUser } from '../services/localApi'
import { joinQueue, leaveQueue, getQueueStatus, getServices } from '../services/userApi'
import '../styles/JoinQueue.css'

export default function JoinQueue() {
  const [services, setServices] = useState([])
  const [selected, setSelected] = useState('')
  const [currentStatus, setCurrentStatus] = useState(null)
  const [toast, setToast] = useState(null)
  const user = getCurrentUser()

  useEffect(() => {
    getServices().then(setServices).catch(() => setServices([]))
    if (!user) return
    getQueueStatus(user.id).then(setCurrentStatus).catch(() => setCurrentStatus(null))
    const interval = setInterval(() => {
      getQueueStatus(user.id).then(setCurrentStatus).catch(() => setCurrentStatus(null))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  async function refreshStatus() {
    if (user) {
      const s = await getQueueStatus(user.id).catch(() => null)
      setCurrentStatus(s)
    }
    getServices().then(setServices).catch(() => {})
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleJoin() {
    if (!selected) return showToast('Select a service first.', 'error')
    const svc = services.find(s => s.id === selected)
    if (svc && !svc.open) return showToast('This service is currently closed.', 'error')
    if (currentStatus) return showToast('You are already in a queue. Leave first.', 'error')
    try {
      await joinQueue(selected, user.id, user.name)
      showToast(`Joined ${svc?.name || selected} queue.`)
      await refreshStatus()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleLeave() {
    if (!selected) return showToast('Select a service first.', 'error')
    const svc = services.find(s => s.id === selected)
    try {
      await leaveQueue(selected, user.id)
      showToast(`Left ${svc?.name || selected} queue.`)
      await refreshStatus()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const selectedService = selected ? services.find(s => s.id === selected) : null
  const userInSelected = currentStatus?.serviceId === selected

  return (
    <div className="jq-page">
      <div className="jq-header">
        <h2>Join a Queue</h2>
        <p>Select a service to view wait times and join.</p>
      </div>

      {/* Banner if already in queue */}
      {currentStatus && (
        <div className="jq-banner">
          <span>You are currently <strong>#{currentStatus.position}</strong> in the <strong>{services.find(s => s.id === currentStatus.serviceId)?.name || currentStatus.serviceId}</strong> queue.</span>
        </div>
      )}

      {/* Service cards */}
      <div className="jq-grid">
        {services.map(s => {
          const isDisabled = !s.open
          return (
            <div
              key={s.id}
              className={`jq-card ${selected === s.id ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => !isDisabled && setSelected(s.id)}
            >
              <div className="jq-radio"></div>
              <div className="jq-card-top">
                <h4 className="jq-card-name">{s.name}</h4>
              </div>
              <p className="jq-card-desc">{s.description}</p>
              <div className="jq-card-meta">
                <span className={`jq-status-tag ${s.open ? 'open' : 'closed'}`}>
                  <span className="jq-status-dot"></span>
                  {s.open ? 'Open' : 'Closed'}
                </span>
                <span className="jq-meta-item"><strong>{s.expected}</strong> min avg</span>
                <span className={`jq-priority-tag ${s.priority}`}>{s.priority}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Action panel */}
      <div className="jq-action-panel">
        <div className="jq-action-head">
          <h3>{selectedService ? selectedService.name : 'Queue Details'}</h3>
        </div>
        <div className="jq-action-body">
          {selected && selectedService ? (
            <>
              <div className="jq-wait-box">
                <div className="jq-wait-number">
                  <strong>{userInSelected ? Math.round(currentStatus.expectedWait) : selectedService.expected}</strong>
                  <span>min</span>
                </div>
                <div className="jq-wait-details">
                  <span className="jq-wait-title">Estimated Wait</span>
                  <span className="jq-wait-value">{userInSelected ? Math.round(currentStatus.expectedWait) : selectedService.expected} minutes</span>
                  {userInSelected && <span className="jq-wait-sub">{currentStatus.total} {currentStatus.total === 1 ? 'person' : 'people'} in queue</span>}
                </div>
              </div>
              <div className="jq-btns">
                <button className="jq-btn-primary" onClick={handleJoin} disabled={!selectedService?.open || !!currentStatus}>
                  {currentStatus ? 'Already in Queue' : 'Join Queue'}
                </button>
                {userInSelected && (
                  <button className="jq-btn-danger" onClick={handleLeave}>Leave Queue</button>
                )}
              </div>
            </>
          ) : (
            <div className="jq-placeholder">Select a service above to view details.</div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`jq-toast ${toast.type}`}>{toast.message}</div>
      )}
    </div>
  )
}
