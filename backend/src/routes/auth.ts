import { Hono } from 'hono'
import { z } from 'zod'
import { createNonce, verifyLogin, type AppEnv } from '../lib/auth'

export const authApp = new Hono<AppEnv>()

const walletSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, '非法钱包地址')

// 获取 nonce
authApp.post('/nonce', async (c) => {
  const { wallet } = z.object({ wallet: walletSchema }).parse(await c.req.json())
  const nonce = await createNonce(wallet)
  return c.json({ wallet: wallet.toLowerCase(), nonce })
})

// 校验签名并登录，返回 token
authApp.post('/login', async (c) => {
  const { wallet, signature } = z
    .object({ wallet: walletSchema, signature: z.string().min(1) })
    .parse(await c.req.json())
  const token = await verifyLogin(wallet, signature)
  return c.json({ token, wallet: wallet.toLowerCase() })
})
