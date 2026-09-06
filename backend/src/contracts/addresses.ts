import { config } from '../config'

// 合约地址（部署后回填到 .env）
export const contractAddresses = {
  factionRegistry: config.factionRegistry as `0x${string}`,
  points: config.points as `0x${string}`,
  priceFeed: config.priceFeed as `0x${string}`,
  prizePool: config.prizePool as `0x${string}`,
  prediction: config.prediction as `0x${string}`,
}
