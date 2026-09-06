import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { creditcoinTestnet } from '../chains/creditcoin'
import { config } from '../config'

// 只读客户端（查积分、查状态）
export const publicClient = createPublicClient({
  chain: creditcoinTestnet,
  transport: http(config.rpcUrl),
})

// 写客户端（调 addScore / 结算等，需要后端钱包私钥）
export function getWalletClient() {
  if (!config.privateKey) {
    throw new Error('PRIVATE_KEY 未配置：请在 backend/.env 里填入有余额且被授权的后端钱包私钥')
  }
  return createWalletClient({
    chain: creditcoinTestnet,
    transport: http(config.rpcUrl),
    account: privateKeyToAccount(config.privateKey as `0x${string}`),
  })
}
