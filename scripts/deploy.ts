// scripts/deploy.ts
// 一键部署 4 个合约并授权后端，打印各合约地址。
//
// 运行（临时内存链，脚本结束即销毁，适合快速验证）：
//   npx hardhat run scripts/deploy.ts
//
// 运行（持久本地节点，供后端连接）：
//   先开一个终端：  npx hardhat node
//   再开一个终端：  npx hardhat run scripts/deploy.ts --network localhost
import { network } from "hardhat";

async function main() {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();

  // 默认账号：index 0 = owner（部署者），index 1 = 后端
  const [owner, backend] = await viem.getWalletClients();
  console.log("owner   :", owner.account.address);
  console.log("backend :", backend.account.address);

  // 1. 存证（自建 hash 存证，MVP 先跑通）
  const selfAttestation = await viem.deployContract("SelfAttestation");
  console.log("[1] SelfAttestation (AT):", selfAttestation.address);

  // 2. 身份底座（阵营 / 团队 / 成员 + 状态机）
  const factionRegistry = await viem.deployContract("FactionRegistry");
  console.log("[2] FactionRegistry  (FR):", factionRegistry.address);

  // 3. 积分账本，构造参数 (registry, attestation)
  const scoreAttester = await viem.deployContract("ScoreAttester", [
    factionRegistry.address,
    selfAttestation.address,
  ]);
  console.log("[3] ScoreAttester    (SA):", scoreAttester.address);

  // 4. 奖池，构造参数 (registry, scores)
  const prizePool = await viem.deployContract("PrizePool", [
    factionRegistry.address,
    scoreAttester.address,
  ]);
  console.log("[4] PrizePool        (PP):", prizePool.address);

  // 5. 授权后端（只有 owner 能调 setBackend）
  const hash = await scoreAttester.write.setBackend(
    [backend.account.address, true],
    { account: owner.account },
  );
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("[5] 已授权后端:", backend.account.address);

  console.log("\n=== 部署完成，地址如下 ===");
  console.log("AT =", selfAttestation.address);
  console.log("FR =", factionRegistry.address);
  console.log("SA =", scoreAttester.address);
  console.log("PP =", prizePool.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
