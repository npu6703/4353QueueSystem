import { useState, useEffect } from 'react'
import { getServices, joinQueue, leaveQueue, getCurrentUser, getQueueForService, getUserQueueStatus } from '../services/localApi'
import '../styles/JoinQueue.css'

export default function JoinQueue() {
  const [services, setServices] = useState([])
  const [selected, setSelected] = useState('')
  const [toast, setToast] = useState(null)
  const user = getCurrentUser()

  useEffect(() => { setServices(getServices()) }, [])

  const currentStatus = user ? getUserQueueStatus(user.id) : null

  function refresh() {
    setServices(getServices())
  }

  function getQueueInfo(serviceId) {
    const q = getQueueForService(serviceId)
    const svc = services.find(s => s.id === serviceId)
    const userPos = user ? q.indexOf(user.id) : -1
    const waitMinutes = q.length * (svc?.expected || 10)
    return { length: q.length, userPos, waitMinutes }
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function handleJoin() {
    if (!selected) return showToast('Select a service first.', 'error')
    const svc = services.find(s => s.id === selected)
    if (svc && !svc.open) return showToast('This service is currently closed.', 'error')
    if (currentStatus) return showToast('You are already in a queue. Leave first.', 'error')
    joinQueue(selected, user.id)
    showToast(`Joined ${svc?.name || selected} queue.`)
    refresh()
  }

  function handleLeave() {
    if (!selected) return showToast('Select a service first.', 'error')
    const svc = services.find(s => s.id === selected)
    leaveQueue(selected, user.id)
    showToast(`Left ${svc?.name || selected} queue.`)
    refresh()
  }

  const selectedInfo = selected ? getQueueInfo(selected) : null
  const selectedService = selected ? services.find(s => s.id === selected) : null

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
          const info = getQueueInfo(s.id)
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
                <span className="jq-meta-item"><strong>{info.length}</strong> in queue</span>
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
          {selected && selectedInfo ? (
            <>
              <div className="jq-wait-box">
                <div className="jq-wait-number">
                  <strong>{selectedInfo.waitMinutes}</strong>
                  <span>min</span>
                </div>
                <div className="jq-wait-details">
                  <span className="jq-wait-title">Estimated Wait</span>
                  <span className="jq-wait-value">{selectedInfo.waitMinutes} minutes</span>
                  <span className="jq-wait-sub">{selectedInfo.length} {selectedInfo.length === 1 ? 'person' : 'people'} in queue</span>
                </div>
              </div>
              <div className="jq-btns">
                <button className="jq-btn-primary" onClick={handleJoin} disabled={!selectedService?.open || !!currentStatus}>
                  {currentStatus ? 'Already in Queue' : 'Join Queue'}
                </button>
                {selectedInfo.userPos >= 0 && (
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
