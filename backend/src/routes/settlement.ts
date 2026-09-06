import { Hono } from 'hono'
import { read } from '../lib/chain'
import type { AppEnv } from '../lib/auth'

export const settlementApp = new Hono<AppEnv>()

// 结算状态
settlementApp.get('/status', async (c) => {
  const [totalPrizePool, settled] = await Promise.all([
    read('prizePool', 'totalPrizePool'),
    read('prizePool', 'settled'),
  ])
  return c.json({ totalPrizePool: (totalPrizePool as bigint).toString(), settled: settled as boolean })
})

// 某地址可领取奖励 + 结算分数
settlementApp.get('/rewards/:address', async (c) => {
  const address = c.req.param('address') as `0x${string}`
  const [reward, score] = await Promise.all([
    read('prizePool', 'rewards', [address]),
    read('prizePool', 'memberScores', [address]),
  ])
  return c.json({ address, reward: (reward as bigint).toString(), score: (score as bigint).toString() })
})
