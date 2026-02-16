import { getServices, getQueueForService } from '../services/localApi'

export default function AdminDashboard(){
  const services = getServices()
  return (
    <div className="card">
      <h2>Admin Dashboard</h2>
      <ul>
        {services.map(s=> (
          <li key={s.id}>{s.name} — queue length: {getQueueForService(s.id).length} — {s.open? 'Open':'Closed'}</li>
        ))}
      </ul>
    </div>
  )
}
