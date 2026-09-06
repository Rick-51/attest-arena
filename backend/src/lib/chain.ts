import { publicClient, getWalletClient } from './viem'
import { contractAddresses } from '../contracts/addresses'
import { factionRegistryAbi, pointsAbi, priceFeedAbi, prizePoolAbi, predictionAbi } from '../contracts/abi'

type ContractKey = 'factionRegistry' | 'points' | 'priceFeed' | 'prizePool' | 'prediction'

const specs = {
  factionRegistry: { abi: factionRegistryAbi },
  points: { abi: pointsAbi },
  priceFeed: { abi: priceFeedAbi },
  prizePool: { abi: prizePoolAbi },
  prediction: { abi: predictionAbi },
} as const

function getAddress(key: ContractKey): `0x${string}` {
  const addr = contractAddresses[key]
  if (!addr || addr === '0x') {
    throw new Error(`合约地址未配置：请在 backend/.env 填入 ${key.toUpperCase()}（部署合约后回填）`)
  }
  return addr
}

// 读：调用合约 view 函数
export async function read(contract: ContractKey, functionName: string, args: unknown[] = []) {
  const { abi } = specs[contract]
  // 泛型 string functionName 下 viem 回退到宽泛重载，返回 unknown；用 any 规避类型摩擦
  return publicClient.readContract({
    address: getAddress(contract),
    abi,
    functionName,
    args,
  } as any)
}

// 写：用后端私钥签名发交易，并等待回执。
// ⚠️ 仅用于后端特权操作（管理端 / 价格 worker）。用户自己的操作（joinFaction/proposeSwap/claimReward
//    等依赖 msg.sender 的交易）必须由前端用用户钱包签名，不能走后端钱包。
export async function write(
  contract: ContractKey,
  functionName: string,
  args: unknown[] = [],
  value?: bigint,
) {
  const { abi } = specs[contract]
  const wallet = getWalletClient()
  const hash = await wallet.writeContract({
    address: getAddress(contract),
    abi,
    functionName,
    args,
    value,
  } as any)
  return publicClient.waitForTransactionReceipt({ hash })
}
