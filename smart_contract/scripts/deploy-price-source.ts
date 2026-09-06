// scripts/deploy-price-source.ts
// 部署 Sepolia 源链侧的 PriceSource（发 PricePublished 价格事件）。
// 注意：PriceSource 在 Sepolia，其它合约在 Creditcoin，两条链，不能放进同一个脚本。
//
// 运行：npx hardhat run scripts/deploy-price-source.ts --network sepolia
import { network } from "hardhat";

async function main() {
  const { viem } = await network.create();
  const priceSource = await viem.deployContract("PriceSource");
  console.log("PriceSource (Sepolia):", priceSource.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
