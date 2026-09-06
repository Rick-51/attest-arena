import { Hono } from 'hono'
import { read } from '../lib/chain'
import type { AppEnv } from '../lib/auth'

export const priceApp = new Hono<AppEnv>()

// 某币最新价
priceApp.get('/:coinId', async (c) => {
  const coinId = Number(c.req.param('coinId'))
  const [price, timestamp] = (await read('priceFeed', 'getPrice', [BigInt(coinId)])) as [bigint, bigint]
  return c.json({ coinId, price: price.toString(), timestamp: timestamp.toString() })
})

// 某币历史价（按 index）
priceApp.get('/:coinId/at/:index', async (c) => {
  const coinId = Number(c.req.param('coinId'))
  const index = Number(c.req.param('index'))
  const [price, timestamp] = (await read('priceFeed', 'getPriceAt', [BigInt(coinId), BigInt(index)])) as [bigint, bigint]
  return c.json({ coinId, index, price: price.toString(), timestamp: timestamp.toString() })
})

// 某币价格历史条数
priceApp.get('/:coinId/history/count', async (c) => {
  const coinId = Number(c.req.param('coinId'))
  const count = (await read('priceFeed', 'getPriceHistoryCount', [BigInt(coinId)])) as bigint
  return c.json({ coinId, count: Number(count) })
})
