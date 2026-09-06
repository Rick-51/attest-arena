import { Hono } from 'hono'
import { read } from '../lib/chain'
import type { AppEnv } from '../lib/auth'

export const leaderboardApp = new Hono<AppEnv>()

// 阵营排行榜：成员数 + 金库 + 阵营分（结算后才有分数，未结算为 0）
leaderboardApp.get('/', async (c) => {
  try {
    const count = Number(await read('factionRegistry', 'factionCount'))
    const factions: { id: number; name: string; coinId: number; memberCount: number; treasury: string; score: string }[] = []
    for (let id = 1; id <= count; id++) {
      const [, name, coinId] = (await read('factionRegistry', 'factions', [BigInt(id)])) as [bigint, string, bigint]
      const memberCount = (await read('factionRegistry', 'getFactionMemberCount', [BigInt(id)])) as bigint
      const treasury = (await read('factionRegistry', 'factionTreasury', [BigInt(id)])) as bigint
      const score = (await read('prizePool', 'factionScores', [BigInt(id)])) as bigint
      factions.push({
        id,
        name,
        coinId: Number(coinId),
        memberCount: Number(memberCount),
        treasury: treasury.toString(),
        score: score.toString(),
      })
    }
    factions.sort((a, b) => Number(b.score) - Number(a.score))
    return c.json({ factions })
  } catch (e) {
    return c.json({ error: String(e), hint: '确认已部署合约并在 .env 回填地址' }, 503)
  }
})
