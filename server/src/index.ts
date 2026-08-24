import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import routes from './routes'

const app = express()
const port = Number(process.env.PORT || 4000)

app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.get('/health', (_req, res) => res.json({ ok: true, database: process.env.DATABASE_URL ? 'postgresql' : 'memory-preview' }))
app.use('/api', routes)
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))

app.listen(port, () => {
  process.stdout.write(`CampusPool API listening on port ${port}\n`)
})
