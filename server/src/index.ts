import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import routes, { matchPendingRides } from './routes'

const app = express()
const port = Number(process.env.PORT || 4000)

app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.get('/health', (_req, res) => res.json({ ok: true, database: process.env.DATABASE_URL ? 'postgresql' : 'memory-preview' }))
app.use('/api', routes)
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))

app.listen(port, () => {
  process.stdout.write(`CampusPool API listening on port ${port}\n`)
  
  // Background task to match prebooked rides periodically
  setInterval(() => {
    matchPendingRides('AUTO_3', true).catch(console.error)
    matchPendingRides('CAB_4', true).catch(console.error)
  }, 60 * 1000) // Every 1 minute
})
