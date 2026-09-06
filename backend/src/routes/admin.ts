import { Hono } from 'hono'
import { z } from 'zod'
import { parseEther } from 'viem'
import { read, write } from '../lib/chain'
import { requireAdmin, type AppEnv } from '../lib/auth'

export const adminApp = new Hono<AppEnv>()
adminApp.use('*', requireAdmin)

// 建阵营（钉币：0=BTC, 1=ETH, 2=CTC）
adminApp.post('/factions', async (c) => {
  const { name, coinId } = z
    .object({ name: z.string().min(1), coinId: z.number().int().min(0).max(2) })
    .parse(await c.req.json())
  await write('factionRegistry', 'createFaction', [name, BigInt(coinId)])
  return c.json({ ok: true })
})

// 配置入场费（tCTC，wei）与铸积分数量
adminApp.post('/config/entry-fee', async (c) => {
  const { fee } = z.object({ fee: z.string() }).parse(await c.req.json())
  await write('factionRegistry', 'setEntryFee', [BigInt(fee)])
  return c.json({ ok: true })
})
adminApp.post('/config/mint-amount', async (c) => {
  const { amount } = z.object({ amount: z.string() }).parse(await c.req.json())
  await write('factionRegistry', 'setMintAmount', [BigInt(amount)])
  return c.json({ ok: true })
})

// 开局 / 结束
adminApp.post('/game/start', async (c) => {
  await write('factionRegistry', 'startGame')
  return c.json({ ok: true })
})
adminApp.post('/game/end', async (c) => {
  await write('factionRegistry', 'endGame')
  return c.json({ ok: true })
})

// 记录起始价（结算前调用，供算涨跌幅）
adminApp.post('/prize/capture-start', async (c) => {
  await write('prizePool', 'captureStartPrices')
  return c.json({ ok: true })
})

// 充值奖池（amount 单位 tCTC，如 "1"）
adminApp.post('/prize/deposit', async (c) => {
  const { amount } = z.object({ amount: z.string() }).parse(await c.req.json())
  await write('prizePool', 'depositPrize', [], parseEther(amount))
  return c.json({ ok: true })
})

// 结算（只能一次，读价格算涨跌幅 → 两层级分配）
adminApp.post('/prize/settle', async (c) => {
  await write('prizePool', 'settle')
  return c.json({ ok: true })
})

// 开预测轮（押某币，快照当前价为起始价）
adminApp.post('/prediction/rounds', async (c) => {
  const { coinId } = z.object({ coinId: z.number().int().min(0).max(2) }).parse(await c.req.json())
  await write('prediction', 'startRound', [BigInt(coinId)])
  const roundId = Number(await read('prediction', 'roundCount'))
  return c.json({ ok: true, roundId })
})

// 判题（结算一轮，读 PriceFeed 真实价排名发奖）
adminApp.post('/prediction/rounds/:id/resolve', async (c) => {
  const id = Number(c.req.param('id'))
  await write('prediction', 'resolveRound', [BigInt(id)])
  return c.json({ ok: true })
})

// 配置押注额度 + 前三名/其余奖励
adminApp.post('/prediction/config', async (c) => {
  const { stakeAmount, first, second, third, rest } = z
    .object({
      stakeAmount: z.string(),
      first: z.string(),
      second: z.string(),
      third: z.string(),
      rest: z.string(),
    })
    .parse(await c.req.json())
  await write('prediction', 'setStakeAmount', [BigInt(stakeAmount)])
  await write('prediction', 'setRewards', [BigInt(first), BigInt(second), BigInt(third), BigInt(rest)])
  return c.json({ ok: true })
})

// 比赛状态
adminApp.get('/status', async (c) => {
  const [isActive, isFinished, settled] = await Promise.all([
    read('factionRegistry', 'isActive'),
    read('factionRegistry', 'isFinished'),
    read('prizePool', 'settled'),
  ])
  return c.json({ isActive, isFinished, settled })
})
