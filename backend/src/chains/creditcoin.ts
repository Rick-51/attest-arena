import { defineChain } from 'viem'

// Creditcoin 测试网 (cc3-testnet)
// chainId 102031，代币 tCTC，浏览器 creditcoin-testnet.blockscout.com
export const creditcoinTestnet = defineChain({
  id: 102031,
  name: 'Creditcoin Testnet',
  nativeCurrency: {
    name: 'Creditcoin Testnet',
    symbol: 'tCTC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.cc3-testnet.creditcoin.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: 'https://creditcoin-testnet.blockscout.com',
    },
  },
  testnet: true,
})
