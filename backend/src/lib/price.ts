import { Contract, JsonRpcProvider, Wallet, AbiCoder } from 'ethers'
// @gluwa/usc-sdk 是 CJS 包，命名导入在 tsx/ESM 下依赖 cjs-module-lexer；
// 用命名导入与官方示例一致，若运行时解析异常可改 `import * as uscSdk from '@gluwa/usc-sdk'`。
import { proofProvider, chainInfo } from '@gluwa/usc-sdk'
import { config } from '../config'

// ---- ABI（human-readable，供 ethers v6 使用）----

const PRICE_SOURCE_ABI = [
  'function publishPrice(uint256 coinId, uint256 price) external',
]

// InclusionProof = (uint8 kind, bytes32 root, bytes data)
// ContinuityProof = (bytes32 lowerEndpointDigest, bytes32[] roots)
// enum ProofKind.BinaryMerkle = 0
const PRICE_FEED_ABI = [
  'function updatePrice(uint64 blockHeight, (uint8 kind, bytes32 root, bytes data) inclusionProof, (bytes32 lowerEndpointDigest, bytes32[] roots) continuityProof) returns (uint256 coinId, uint256 price, uint256 timestamp)',
  'function getPrice(uint256 coinId) view returns (uint256 price, uint256 timestamp)',
  'function getPriceAt(uint256 coinId, uint256 index) view returns (uint256 price, uint256 timestamp)',
  'function getPriceHistoryCount(uint256 coinId) view returns (uint256)',
  'function setBackend(address backend, bool authorized)',
  'function isBackend(address) view returns (bool)',
  'function owner() view returns (address)',
]

// ---- 钱包 / 合约实例 ----

function getSepoliaWallet() {
  if (!config.sepoliaRpc) throw new Error('SEPOLIA_RPC_URL 未配置')
  if (!config.sepoliaPrivateKey) throw new Error('SEPOLIA_PRIVATE_KEY 未配置')
  return new Wallet(config.sepoliaPrivateKey, new JsonRpcProvider(config.sepoliaRpc))
}

function getCreditcoinWallet() {
  if (!config.privateKey) throw new Error('PRIVATE_KEY 未配置（Creditcoin 后端钱包）')
  return new Wallet(config.privateKey, new JsonRpcProvider(config.rpcUrl))
}

function getPriceFeed() {
  if (!config.priceFeed) throw new Error('PRICE_FEED 地址未配置')
  return new Contract(config.priceFeed, PRICE_FEED_ABI, getCreditcoinWallet())
}

// ---- 核心流程 ----

/// 在 Sepolia 上发布某币价格，返回 txHash 和所在区块高度
export async function publishPrice(coinId: number | bigint, price: number | bigint) {
  if (!config.priceSource) throw new Error('PRICE_SOURCE 地址未配置')
  const source = new Contract(config.priceSource, PRICE_SOURCE_ABI, getSepoliaWallet())
  const tx = await source.publishPrice(coinId, price)
  const receipt = await tx.wait()
  return { txHash: tx.hash as string, blockHeight: Number(receipt.blockNumber) }
}

/// 用 txHash 去 prover 服务拿证明，映射成合约参数，调 PriceFeed.updatePrice 存价
export async function syncPrice(txHash: string) {
  const proofBuilder = new proofProvider.service.ProofBuilder(config.sourceChainKey, config.proverUrl)
  const result = await proofBuilder.getProof(txHash)
  if (!result.success || !result.data) throw new Error(`拿证明失败: ${result.error}`)

  const proofData = result.data

  // inclusionProof.data = abi.encode(txBytes, [{sibling, isLeft}...])
  // 注意：SDK 的 sibling 字段叫 hash，合约 BlockProverTypes.MerkleProofEntry 叫 sibling
  const coder = AbiCoder.defaultAbiCoder()
  const inclusionData = coder.encode(
    ['bytes', 'tuple(bytes32 sibling, bool isLeft)[]'],
    [
      proofData.txBytes,
      proofData.merkleProof.siblings.map((s) => ({ sibling: s.hash, isLeft: s.isLeft })),
    ],
  )

  const feed = getPriceFeed()
  const tx = await feed.updatePrice(
    proofData.headerNumber, // blockHeight (uint64)
    [0, proofData.merkleProof.root, inclusionData], // InclusionProof (kind=0 BinaryMerkle, root, data)
    [proofData.continuityProof.lowerEndpointDigest, proofData.continuityProof.roots], // ContinuityProof
  )
  const receipt = await tx.wait()
  return { txHash: tx.hash as string, receipt }
}

/// 一步到位：Sepolia 发价 → 等 attest → 拿证明 → Creditcoin 存价
export async function publishAndSync(coinId: number | bigint, price: number | bigint) {
  const { txHash, blockHeight } = await publishPrice(coinId, price)

  const proofBuilder = new proofProvider.service.ProofBuilder(config.sourceChainKey, config.proverUrl)
  await proofBuilder.waitUntilHeightAttested(config.sourceChainKey, blockHeight)

  const { receipt } = await syncPrice(txHash)
  return { coinId, price, sourceTxHash: txHash, updateTxHash: receipt.hash as string }
}

// ---- 只读查询 ----

export async function getPrice(coinId: number | bigint) {
  const feed = getPriceFeed()
  const [price, timestamp] = await feed.getPrice(coinId)
  return { price: price as bigint, timestamp: timestamp as bigint }
}

/// 核对源链 chainKey：列出 Creditcoin 上所有已公证的源链
export async function listSupportedChains() {
  const provider = new JsonRpcProvider(config.rpcUrl)
  const info = new chainInfo.PrecompileChainInfoProvider(provider)
  return info.getSupportedChains()
}
