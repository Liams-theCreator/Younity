import { useEffect, useState } from 'react'
import { checkHealth } from './lib/api'

export default function App() {
  const [status, setStatus] = useState('Connecting…')

  useEffect(() => {
    const controller = new AbortController()
    checkHealth(controller.signal)
      .then(() => setStatus('Ready to explore'))
      .catch(() => {
        if (!controller.signal.aborted) setStatus('Service temporarily unavailable')
      })
    return () => controller.abort()
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-white">
      <h1 className="text-4xl font-bold">Younity</h1>
      <p>Campus events and opportunities.</p>
      <p role="status" className="text-sm text-slate-300">{status}</p>
    </main>
  )
}
