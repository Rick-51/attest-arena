// scripts/deploy-prediction.ts
// 单独部署 Prediction（复用已部署的 Points + PriceFeed），并授权其铸/销毁积分。
// 运行（把地址换成实际的）：
//   POINTS=0x... PRICE_FEED=0x... npx hardhat run scripts/deploy-prediction.ts --network creditcoinTestnet
import { network } from "hardhat";

async function main() {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [owner] = await viem.getWalletClients();

  const points = (process.env.POINTS ?? "") as `0x${string}`;
  const priceFeed = (process.env.PRICE_FEED ?? "") as `0x${string}`;
  if (!points || !priceFeed) {
    throw new Error("请设置 POINTS 和 PRICE_FEED 环境变量");
  }

  // 部署 Prediction
  const prediction = await viem.deployContract("Prediction", [points, priceFeed]);
  console.log("Prediction:", prediction.address);

  // 授权 Prediction 铸/销毁积分（Points 的 minter）
  const pointsContract = await viem.getContractAt("Points", points);
  const hash = await pointsContract.write.setMinter([prediction.address, true], {
    account: owner.account,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("已授权 Prediction 铸/销毁积分");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
