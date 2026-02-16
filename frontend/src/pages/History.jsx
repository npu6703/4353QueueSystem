import { getCurrentUser, getHistoryForUser, getServices } from '../services/localApi'

export default function History(){
  const user = getCurrentUser()
  const history = user ? getHistoryForUser(user.id) : []
  const services = getServices()

  function svcName(id){
    return services.find(s=>s.id===id)?.name || id
  }

  return (
    <div className="card">
      <h2>History</h2>
      {history.length===0 ? <div>No past queues</div> : (
        <ul>
          {history.map(h=> (
            <li key={h.id}>{new Date(h.date).toLocaleString()} — {svcName(h.serviceId)} — {h.outcome}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
