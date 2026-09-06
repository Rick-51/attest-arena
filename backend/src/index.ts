import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { z } from 'zod'
import { config } from './config'
import { authApp } from './routes/auth'
import { factionsApp } from './routes/factions'
import { pointsApp } from './routes/points'
import { priceApp } from './routes/price'
import { settlementApp } from './routes/settlement'
import { predictionApp } from './routes/prediction'
import { adminApp } from './routes/admin'
import { leaderboardApp } from './routes/leaderboard'

const app = new Hono()

app.route('/api/auth', authApp)
app.route('/api/factions', factionsApp)
app.route('/api/points', pointsApp)
app.route('/api/price', priceApp)
app.route('/api/settlement', settlementApp)
app.route('/api/prediction', predictionApp)
app.route('/api/admin', adminApp)
app.route('/api/leaderboard', leaderboardApp)

app.get('/health', (c) =>
  c.json({ ok: true, network: 'creditcoin-testnet', chainId: config.chainId }),
)

app.onError((err, c) => {
  if (err instanceof z.ZodError) {
    return c.json({ error: '参数错误', details: err.issues }, 400)
  }
  console.error(err)
  return c.json({ error: err.message ?? 'internal error' }, 500)
})

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`✅ Attest Arena backend listening on http://localhost:${info.port}`)
})
