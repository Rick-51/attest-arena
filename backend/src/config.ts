import 'dotenv/config'

export const config = {
  // ---- Creditcoin（目标链）----
  rpcUrl: process.env.RPC_URL ?? 'https://rpc.cc3-testnet.creditcoin.network',
  chainId: Number(process.env.CHAIN_ID ?? 102031),
  privateKey: process.env.PRIVATE_KEY ?? '', // 后端钱包（PriceFeed 的 backend，已 setBackend 授权）
  port: Number(process.env.PORT ?? 3000),
  adminKey: process.env.ADMIN_KEY ?? '',

  // ---- 合约地址（部署后回填到 .env）----
  factionRegistry: process.env.FACTION_REGISTRY ?? '',
  points: process.env.POINTS ?? '',
  prizePool: process.env.PRIZE_POOL ?? '',
  prediction: process.env.PREDICTION ?? '',

  // ---- Attestcoin 价格链路 ----
  // 源链 Sepolia（发价）
  sepoliaRpc: process.env.SEPOLIA_RPC_URL ?? '',
  sepoliaPrivateKey: process.env.SEPOLIA_PRIVATE_KEY ?? '', // worker 的 Sepolia 钱包（PriceSource 的 owner）
  // prover 服务（跨链证明）
  proverUrl: process.env.PROVER_URL ?? 'https://prover.cc3-testnet.creditcoin.network',
  // 源链 key：Creditcoin 内部对已公证链的编号，Sepolia 需用 SDK getSupportedChains() 复核
  sourceChainKey: Number(process.env.SOURCE_CHAIN_KEY ?? 1),
  // 合约地址
  priceSource: process.env.PRICE_SOURCE ?? '', // Sepolia 上的 PriceSource
  priceFeed: process.env.PRICE_FEED ?? '', // Creditcoin 上的 PriceFeed
}
