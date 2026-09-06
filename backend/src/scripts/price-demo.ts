// 价格链路 demo：Sepolia 发价 → 等 attest → 跨链验证存到 Creditcoin。
// 用法：
//   npx tsx src/scripts/price-demo.ts <coinId> <price>
//   例：npx tsx src/scripts/price-demo.ts 0 60000   （coinId 0=BTC, 1=ETH, 2=CTC）
// 可选子命令：
//   npx tsx src/scripts/price-demo.ts chains      （列出已公证源链，核对 chainKey）
//   npx tsx src/scripts/price-demo.ts get <coinId>（读链上最新价）
import { publishAndSync, getPrice, listSupportedChains } from '../lib/price'

async function main() {
  const [cmd, arg1, arg2] = process.argv.slice(2)

  if (cmd === 'chains') {
    const chains = await listSupportedChains()
    console.log('已公证的源链（找 Sepolia 对应的 chainKey / chainId=11155111）：')
    for (const c of chains) console.log(`  chainKey=${c.chainKey}  chainId=${c.chainId}  encoding=${c.chainEncoding}`)
    return
  }

  if (cmd === 'get') {
    const coinId = Number(arg1 ?? 0)
    const { price, timestamp } = await getPrice(coinId)
    console.log(`coinId=${coinId}  price=${price}  timestamp=${timestamp}`)
    return
  }

  const coinId = Number(cmd ?? 0)
  const price = BigInt(arg1 ?? '60000')

  console.log(`发布价格 coinId=${coinId} price=${price} ...`)
  const result = await publishAndSync(coinId, price)
  console.log('✅ 已发布并跨链验证上链：', result)

  const stored = await getPrice(coinId)
  console.log(`✅ 链上最新价：coinId=${coinId} price=${stored.price} timestamp=${stored.timestamp}`)
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
