// 合约 ABI（human-readable，供 viem 使用）。新架构：阵营钉币 + 积分 + 跨链价格 + 结算。
import { parseAbi } from 'viem'

// FactionRegistry v2：阵营钉币 + 入场铸积分 + 金库 + 状态机（无 Team 层级）
export const factionRegistryAbi = parseAbi([
  'function createFaction(string name, uint256 coinId)',
  'function joinFaction(uint256 factionId) payable',
  'function setEntryFee(uint256 fee)',
  'function setMintAmount(uint256 amount)',
  'function startGame()',
  'function endGame()',
  'function isActive() view returns (bool)',
  'function isFinished() view returns (bool)',
  'function factionExists(uint256 factionId) view returns (bool)',
  'function getFactionCoin(uint256 factionId) view returns (uint256)',
  'function getFactionMemberCount(uint256 factionId) view returns (uint256)',
  'function getFactionMember(uint256 factionId, uint256 index) view returns (address)',
  'function factionCount() view returns (uint256)',
  'function factions(uint256) view returns (uint256 id, string name, uint256 coinId)',
  'function playerFaction(address) view returns (uint256)',
  'function factionTreasury(uint256) view returns (uint256)',
  'function entryFee() view returns (uint256)',
  'function mintAmount() view returns (uint256)',
  'function owner() view returns (address)',
])

// Points：三种积分账本（A/B/O，对应 BTC/ETH/CTC）+ 成员间 OTC 兑换
export const pointsAbi = parseAbi([
  'function mint(uint256 pointType, address to, uint256 amount)',
  'function burn(uint256 pointType, address from, uint256 amount)',
  'function setMinter(address minter, bool authorized)',
  'function proposeSwap(address counterparty, uint256 fromType, uint256 fromAmount, uint256 toType, uint256 toAmount) returns (uint256 proposalId)',
  'function acceptSwap(uint256 proposalId)',
  'function cancelSwap(uint256 proposalId)',
  'function balanceOf(uint256 pointType, address account) view returns (uint256)',
  'function proposalCount() view returns (uint256)',
  'function proposals(uint256) view returns (address proposer, address counterparty, uint256 fromType, uint256 fromAmount, uint256 toType, uint256 toAmount, bool accepted, bool cancelled)',
  'function owner() view returns (address)',
  'function isMinter(address) view returns (bool)',
])

// PriceFeed：Attestcoin 跨链验证价格（信任根）
export const priceFeedAbi = parseAbi([
  'function updatePrice(uint64 blockHeight, (uint8 kind, bytes32 root, bytes data) inclusionProof, (bytes32 lowerEndpointDigest, bytes32[] roots) continuityProof) returns (uint256 coinId, uint256 price, uint256 timestamp)',
  'function setBackend(address backend, bool authorized)',
  'function getPrice(uint256 coinId) view returns (uint256 price, uint256 timestamp)',
  'function getPriceAt(uint256 coinId, uint256 index) view returns (uint256 price, uint256 timestamp)',
  'function getPriceHistoryCount(uint256 coinId) view returns (uint256)',
  'function owner() view returns (address)',
  'function isBackend(address) view returns (bool)',
])

// PrizePool v2：结算（积分 × 币价涨跌幅）+ 两层级分配
export const prizePoolAbi = parseAbi([
  'function depositPrize() payable',
  'function captureStartPrices()',
  'function settle()',
  'function claimReward()',
  'function totalPrizePool() view returns (uint256)',
  'function settled() view returns (bool)',
  'function startPrices(uint256) view returns (uint256)',
  'function memberScores(address) view returns (uint256)',
  'function factionScores(uint256) view returns (uint256)',
  'function rewards(address) view returns (uint256)',
])

// Prediction：币价押注（方向 + 目标价，读 PriceFeed 判题）
export const predictionAbi = parseAbi([
  'function startRound(uint256 coinId) returns (uint256 roundId)',
  'function bet(uint256 roundId, bool isUp, uint256 targetPrice)',
  'function resolveRound(uint256 roundId)',
  'function setStakeAmount(uint256 amount)',
  'function setRewards(uint256 first, uint256 second, uint256 third, uint256 rest)',
  'function roundCount() view returns (uint256)',
  'function rounds(uint256) view returns (uint256 id, uint256 coinId, uint256 startPrice, bool resolved)',
  'function roundBets(uint256 roundId, uint256 index) view returns (address bettor, bool isUp, uint256 targetPrice)',
  'function getRoundBetCount(uint256 roundId) view returns (uint256)',
  'function hasBet(uint256 roundId, address bettor) view returns (bool)',
  'function stakeAmount() view returns (uint256)',
  'function rewardFirst() view returns (uint256)',
  'function rewardSecond() view returns (uint256)',
  'function rewardThird() view returns (uint256)',
  'function rewardRest() view returns (uint256)',
  'function owner() view returns (address)',
])
