// scripts/deploy.ts
// 一键部署新架构合约（PriceFeed 信任根 + Points 积分账本 + FactionRegistry 身份底座）。
//
// 运行（临时内存链）：
//   npx hardhat run scripts/deploy.ts
//
// 运行（持久本地节点）：
//   终端 A：npx hardhat node
//   终端 B：npx hardhat run scripts/deploy.ts --network localhost
import { network } from "hardhat";

async function main() {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();

  const [owner, backend] = await viem.getWalletClients();
  console.log("owner   :", owner.account.address);
  console.log("backend :", backend.account.address);

  // 1. USCProofVerifier（官方证明验证器，复用）
  const proofVerifier = await viem.deployContract("USCProofVerifier");
  console.log("[1] USCProofVerifier:", proofVerifier.address);

  // 2. PriceFeed（价格喂价，sourceChainKey 表示 Sepolia，可用环境变量覆盖）
  const SOURCE_CHAIN_KEY = BigInt(process.env.SEPOLIA_CHAIN_KEY ?? "1");
  const priceFeed = await viem.deployContract("PriceFeed", [
    proofVerifier.address,
    SOURCE_CHAIN_KEY,
  ]);
  console.log("[2] PriceFeed       :", priceFeed.address);

  // 3. Points（积分账本）
  const points = await viem.deployContract("Points");
  console.log("[3] Points          :", points.address);

  // 4. FactionRegistry（身份底座，钉币 + 入场铸积分）
  const factionRegistry = await viem.deployContract("FactionRegistry", [
    points.address,
  ]);
  console.log("[4] FactionRegistry :", factionRegistry.address);

  // 5. 授权 FactionRegistry 铸积分
  const h1 = await points.write.setMinter(
    [factionRegistry.address, true],
    { account: owner.account },
  );
  await publicClient.waitForTransactionReceipt({ hash: h1 });

  // 6. 授权后端（PriceFeed）
  const h2 = await priceFeed.write.setBackend(
    [backend.account.address, true],
    { account: owner.account },
  );
  await publicClient.waitForTransactionReceipt({ hash: h2 });

  // 7. PrizePool（结算 + 奖池）
  const prizePool = await viem.deployContract("PrizePool", [
    factionRegistry.address,
    points.address,
    priceFeed.address,
  ]);
  console.log("[7] PrizePool       :", prizePool.address);

  console.log("\n=== 部署完成，地址如下 ===");
  console.log("proofVerifier  =", proofVerifier.address);
  console.log("priceFeed      =", priceFeed.address);
  console.log("points         =", points.address);
  console.log("factionRegistry=", factionRegistry.address);
  console.log("prizePool      =", prizePool.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
