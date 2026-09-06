import { Hono } from 'hono'
import { read } from '../lib/chain'
import type { AppEnv } from '../lib/auth'

export const predictionApp = new Hono<AppEnv>()

// 押注配置（每注固定额度 + 前三名/其余奖励）
predictionApp.get('/config', async (c) => {
  const [stakeAmount, first, second, third, rest] = await Promise.all([
    read('prediction', 'stakeAmount'),
    read('prediction', 'rewardFirst'),
    read('prediction', 'rewardSecond'),
    read('prediction', 'rewardThird'),
    read('prediction', 'rewardRest'),
  ])
  return c.json({
    stakeAmount: (stakeAmount as bigint).toString(),
    rewards: {
      first: (first as bigint).toString(),
      second: (second as bigint).toString(),
      third: (third as bigint).toString(),
      rest: (rest as bigint).toString(),
    },
  })
})

// 轮次列表
predictionApp.get('/rounds', async (c) => {
  const count = Number(await read('prediction', 'roundCount'))
  const rounds: Record<string, unknown>[] = []
  for (let id = 1; id <= count; id++) {
    const [rid, coinId, startPrice, resolved] = (await read('prediction', 'rounds', [BigInt(id)])) as [bigint, bigint, bigint, boolean]
    rounds.push({ id: Number(rid), coinId: Number(coinId), startPrice: startPrice.toString(), resolved })
  }
  return c.json(rounds)
})

// 轮次详情
predictionApp.get('/rounds/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [rid, coinId, startPrice, resolved] = (await read('prediction', 'rounds', [BigInt(id)])) as [bigint, bigint, bigint, boolean]
  return c.json({ id: Number(rid), coinId: Number(coinId), startPrice: startPrice.toString(), resolved })
})

// 某地址在某轮是否已押注
predictionApp.get('/rounds/:id/has-bet/:address', async (c) => {
  const id = Number(c.req.param('id'))
  const address = c.req.param('address') as `0x${string}`
  const hasBet = (await read('prediction', 'hasBet', [BigInt(id), address])) as boolean
  return c.json({ roundId: id, address, hasBet })
})

// 某一轮的押注列表
predictionApp.get('/rounds/:id/bets', async (c) => {
  const id = Number(c.req.param('id'))
  const count = Number(await read('prediction', 'getRoundBetCount', [BigInt(id)]))
  const bets: Record<string, unknown>[] = []
  for (let i = 0; i < count; i++) {
    const [bettor, isUp, targetPrice] = (await read('prediction', 'roundBets', [BigInt(id), BigInt(i)])) as [string, boolean, bigint]
    bets.push({ bettor, isUp, targetPrice: targetPrice.toString() })
  }
  return c.json({ roundId: id, count, bets })
})
