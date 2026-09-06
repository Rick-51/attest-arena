import { randomBytes } from 'node:crypto'
import { recoverMessageAddress } from 'viem'
import { createMiddleware } from 'hono/factory'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users } from '../db/schema'
import { getWalletClient } from './viem'
import { config } from '../config'

const LOGIN_PREFIX = 'Attest Arena 登录验证'

// Hono 上下文里注入的变量类型
export type AppEnv = { Variables: { wallet: string } }

export function generateNonce() {
  return randomBytes(16).toString('hex')
}

// 生成（或刷新）某钱包的 nonce
export async function createNonce(wallet: string) {
  const nonce = generateNonce()
  await db
    .insert(users)
    .values({ wallet: wallet.toLowerCase(), nonce })
    .onConflictDoUpdate({ target: users.wallet, set: { nonce } })
  return nonce
}

// 校验签名并签发 token
export async function verifyLogin(wallet: string, signature: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.wallet, wallet.toLowerCase()),
  })
  if (!user) throw new Error('请先调用 /auth/nonce 获取 nonce')
  const message = `${LOGIN_PREFIX}: ${user.nonce}`
  const recovered = await recoverMessageAddress({
    message,
    signature: signature as `0x${string}`,
  })
  if (recovered.toLowerCase() !== wallet.toLowerCase()) {
    throw new Error('签名校验失败')
  }
  return signToken(wallet.toLowerCase())
}

// token = `${wallet}:${exp}:${签名}`，用后端私钥签名
async function signToken(wallet: string) {
  const walletClient = getWalletClient()
  const exp = Math.floor(Date.now() / 1000) + 24 * 3600 // 24 小时有效
  const payload = `${wallet}:${exp}`
  const signature = await walletClient.signMessage({
    message: payload,
    account: walletClient.account,
  })
  return `${payload}:${signature}`
}

// 校验 token，返回钱包地址
export async function verifyToken(token: string): Promise<string> {
  const parts = token.split(':')
  if (parts.length !== 3) throw new Error('无效 token')
  const [wallet, expStr, signature] = parts
  if (Date.now() / 1000 > Number(expStr)) throw new Error('token 已过期')
  const payload = `${wallet}:${expStr}`
  const backendAddress = getWalletClient().account!.address
  const recovered = await recoverMessageAddress({
    message: payload,
    signature: signature as `0x${string}`,
  })
  if (recovered.toLowerCase() !== backendAddress.toLowerCase()) {
    throw new Error('token 签名无效')
  }
  return wallet
}

// 鉴权中间件：要求 Authorization: Bearer <token>
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) return c.json({ error: '未登录' }, 401)
  try {
    const wallet = await verifyToken(token)
    c.set('wallet', wallet)
    await next()
  } catch {
    return c.json({ error: '登录已失效' }, 401)
  }
})

// 管理端鉴权：未配置 ADMIN_KEY 则跳过（本地开发）
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (!config.adminKey) return next()
  if (c.req.header('Authorization') !== `Bearer ${config.adminKey}`) {
    return c.json({ error: 'forbidden' }, 403)
  }
  await next()
})
