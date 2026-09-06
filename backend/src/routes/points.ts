import { Hono } from 'hono'
import { read } from '../lib/chain'
import type { AppEnv } from '../lib/auth'

export const pointsApp = new Hono<AppEnv>()

type SwapProposal = [string, string, bigint, bigint, bigint, bigint, boolean, boolean]

function shapeProposal(id: number, p: SwapProposal) {
  return {
    id,
    proposer: p[0],
    counterparty: p[1],
    fromType: Number(p[2]),
    fromAmount: p[3].toString(),
    toType: Number(p[4]),
    toAmount: p[5].toString(),
    accepted: p[6],
    cancelled: p[7],
  }
}

// 某地址的三种积分余额（A/B/O）
pointsApp.get('/balance/:address', async (c) => {
  const address = c.req.param('address') as `0x${string}`
  const [a, b, o] = await Promise.all([
    read('points', 'balanceOf', [0n, address]),
    read('points', 'balanceOf', [1n, address]),
    read('points', 'balanceOf', [2n, address]),
  ])
  return c.json({
    address,
    A: (a as bigint).toString(),
    B: (b as bigint).toString(),
    O: (o as bigint).toString(),
  })
})

// OTC 兑换提议列表
pointsApp.get('/proposals', async (c) => {
  const count = Number(await read('points', 'proposalCount'))
  const proposals: Record<string, unknown>[] = []
  for (let id = 1; id <= count; id++) {
    const p = (await read('points', 'proposals', [BigInt(id)])) as SwapProposal
    proposals.push(shapeProposal(id, p))
  }
  return c.json(proposals)
})

// 单个提议
pointsApp.get('/proposals/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const p = (await read('points', 'proposals', [BigInt(id)])) as SwapProposal
  return c.json(shapeProposal(id, p))
})
