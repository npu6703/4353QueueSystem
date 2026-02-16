import { useState, useEffect } from 'react'
import { getNotifications, markNotifsRead } from '../services/localApi'

export default function NotificationCenter(){
  const [notifs, setNotifs] = useState([])
  useEffect(()=>{
    setNotifs(getNotifications())
  },[])
  function markAll(){
    markNotifsRead()
    setNotifs(getNotifications())
  }
  if(notifs.length===0) return null
  return (
    <div className="notifs">
      <div className="notifs-header">
        Notifications <button onClick={markAll}>Mark read</button>
      </div>
      <ul>
        {notifs.map(n=> (
          <li key={n.id} className={n.read? 'read':''}>{n.message}</li>
        ))}
      </ul>
    </div>
  )
}
