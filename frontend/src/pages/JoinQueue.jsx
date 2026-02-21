import { useState, useEffect } from 'react'
import { getServices, joinQueue, leaveQueue, getCurrentUser, getSortedQueue, getUserQueueStatus } from '../services/localApi'

export default function JoinQueue() {
  const [services, setServices] = useState([])
  const [selectedSvc, setSelectedSvc] = useState('')
  const [priority, setPriority] = useState('')
  const [message, setMessage] = useState(null)
  const [, setTick] = useState(0) // force re-render for live updates
  const user = getCurrentUser()

  useEffect(() => { setServices(getServices()) }, [])

  // Refresh every 15s to update scores and positions
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 15000)
    return () => clearInterval(interval)
  }, [])

  // Set default priority to the service's priority when selection changes
  useEffect(() => {
    if (selectedSvc) {
      const svc = services.find(s => s.id === selectedSvc)
      if (svc) setPriority(svc.priority)
    }
  }, [selectedSvc, services])

  const currentStatus = user ? getUserQueueStatus(user.id) : null
  const alreadyInQueue = currentStatus !== null

  function handleJoin() {
    if (!selectedSvc) { setMessage({ type: 'error', text: 'Please select a service' }); return }
    const svc = services.find(s => s.id === selectedSvc)
    if (!svc?.open) { setMessage({ type: 'error', text: 'This service is currently closed' }); return }
    if (alreadyInQueue) { setMessage({ type: 'error', text: 'You are already in a queue. Leave your current queue first.' }); return }
    joinQueue(selectedSvc, user.id, priority)
    setMessage({ type: 'success', text: `Joined ${svc.name} queue with ${priority} priority!` })
  }

  function handleLeave() {
    if (!currentStatus) { setMessage({ type: 'error', text: 'You are not in any queue' }); return }
    leaveQueue(currentStatus.serviceId, user.id)
    setMessage({ type: 'success', text: 'You left the queue' })
  }

  function getQueueInfo(serviceId) {
    const sorted = getSortedQueue(serviceId)
    const svc = services.find(s => s.id === serviceId)
    return {
      length: sorted.length,
      estWait: sorted.length * (svc?.expected || 10)
    }
  }

  return (
    <div className="card">
      <h2>Join Queue</h2>

      {/* Current status banner */}
      {alreadyInQueue && (
        <div className="queue-status-banner">
          <div className="queue-status-banner-text">
            You are in <strong>{currentStatus.serviceName}</strong> — Position #{currentStatus.position} of {currentStatus.total}
            <span className={`priority-badge priority-${currentStatus.priority}`} style={{ marginLeft: '0.5rem' }}>
              {currentStatus.priority}
            </span>
          </div>
          <button className="admin-btn admin-btn-danger" onClick={handleLeave}>Leave Queue</button>
        </div>
      )}

      {message && (
        <div className={message.type === 'error' ? 'form-error' : 'form-success'}>
          {message.text}
        </div>
      )}

      {!alreadyInQueue && (
        <>
          <div className="form-row">
            <label>Select Service <span className="required">*</span></label>
            <select value={selectedSvc} onChange={e => setSelectedSvc(e.target.value)}>
              <option value="">-- Choose a service --</option>
              {services.filter(s => s.open).map(s => {
                const info = getQueueInfo(s.id)
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} — {info.length} in queue (~{info.estWait} min wait)
                  </option>
                )
              })}
            </select>
          </div>

          {selectedSvc && (
            <>
              <div className="form-row">
                <label>Priority Level</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="low">Low — Standard queue</option>
                  <option value="medium">Medium — Somewhat urgent</option>
                  <option value="high">High — Urgent / Emergency</option>
                </select>
                <span className="field-hint">
                  Higher priority gives you a head start in the queue. Score: {priority === 'high' ? '30' : priority === 'medium' ? '15' : '0'} base + 1pt/min waiting.
                </span>
              </div>

              {/* Service info card */}
              {(() => {
                const svc = services.find(s => s.id === selectedSvc)
                const info = getQueueInfo(selectedSvc)
                return svc ? (
                  <div className="queue-service-info">
                    <div className="queue-service-info-row">
                      <span>Service:</span> <strong>{svc.name}</strong>
                    </div>
                    <div className="queue-service-info-row">
                      <span>Description:</span> {svc.description}
                    </div>
                    <div className="queue-service-info-row">
                      <span>Expected duration:</span> {svc.expected} min per person
                    </div>
                    <div className="queue-service-info-row">
                      <span>People in queue:</span> {info.length}
                    </div>
                    <div className="queue-service-info-row">
                      <span>Estimated wait:</span> ~{info.estWait} min
                    </div>
                  </div>
                ) : null
              })()}

              <button className="primary" onClick={handleJoin} style={{ marginTop: '1rem' }}>
                Join Queue
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
