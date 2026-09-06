import { Hono } from 'hono'
import { read } from '../lib/chain'
import type { AppEnv } from '../lib/auth'

export const factionsApp = new Hono<AppEnv>()

// 阵营列表（读链上）
factionsApp.get('/', async (c) => {
  const count = Number(await read('factionRegistry', 'factionCount'))
  const factions: Record<string, unknown>[] = []
  for (let id = 1; id <= count; id++) {
    const [, name, coinId] = (await read('factionRegistry', 'factions', [BigInt(id)])) as [bigint, string, bigint]
    const treasury = (await read('factionRegistry', 'factionTreasury', [BigInt(id)])) as bigint
    const memberCount = (await read('factionRegistry', 'getFactionMemberCount', [BigInt(id)])) as bigint
    factions.push({
      id,
      name,
      coinId: Number(coinId),
      treasury: treasury.toString(),
      memberCount: Number(memberCount),
    })
  }
  return c.json(factions)
})

// 阵营详情
factionsApp.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [, name, coinId] = (await read('factionRegistry', 'factions', [BigInt(id)])) as [bigint, string, bigint]
  const treasury = (await read('factionRegistry', 'factionTreasury', [BigInt(id)])) as bigint
  const memberCount = (await read('factionRegistry', 'getFactionMemberCount', [BigInt(id)])) as bigint
  return c.json({
    id,
    name,
    coinId: Number(coinId),
    treasury: treasury.toString(),
    memberCount: Number(memberCount),
  })
})

// 某地址所属阵营（0 = 未加入）
factionsApp.get('/member/:address', async (c) => {
  const address = c.req.param('address') as `0x${string}`
  const factionId = (await read('factionRegistry', 'playerFaction', [address])) as bigint
  return c.json({ address, factionId: Number(factionId) })
})
