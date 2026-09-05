import { network } from "hardhat";
import { parseEther, formatEther } from "viem";

// 本地测试网全流程演示（新架构：跨链币价 + 积分账本 + 结算）
// 运行：npx hardhat run scripts/demo.ts
async function main() {
  const { viem } = await network.create();
  const [owner, backend, playerA, playerB] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  console.log("=== 账号分工 ===");
  console.log("Owner(部署者):", owner.account.address);
  console.log("Backend(后端):", backend.account.address);
  console.log("玩家A:", playerA.account.address);
  console.log("玩家B:", playerB.account.address);

  console.log("\n=== 1. 部署合约 ===");
  const proofVerifier = await viem.deployContract("USCProofVerifier");
  const priceFeed = await viem.deployContract("PriceFeed", [
    proofVerifier.address,
    1n,
  ]);
  const points = await viem.deployContract("Points");
  const registry = await viem.deployContract("FactionRegistry", [
    points.address,
  ]);
  const pool = await viem.deployContract("PrizePool", [
    registry.address,
    points.address,
    priceFeed.address,
  ]);
  console.log("USCProofVerifier:", proofVerifier.address);
  console.log("PriceFeed       :", priceFeed.address);
  console.log("Points          :", points.address);
  console.log("FactionRegistry :", registry.address);
  console.log("PrizePool       :", pool.address);

  console.log("\n=== 2. 授权 ===");
  await points.write.setMinter([registry.address, true]);
  await priceFeed.write.setBackend([backend.account.address, true]);

  console.log("\n=== 3. Owner 建两个阵营：BTC(coinId 0)、ETH(coinId 1) ===");
  await registry.write.createFaction(["BTC阵营", 0n]);
  await registry.write.createFaction(["ETH阵营", 1n]);

  console.log("\n=== 4. 玩家入场（各铸 100 该阵营积分）===");
  await registry.write.joinFaction([1n], { account: playerA.account });
  await registry.write.joinFaction([2n], { account: playerB.account });
  console.log(
    "玩家A(BTC阵营) A积分:",
    (await points.read.balanceOf([0n, playerA.account.address])).toString(),
  );
  console.log(
    "玩家B(ETH阵营) B积分:",
    (await points.read.balanceOf([1n, playerB.account.address])).toString(),
  );

  console.log("\n=== 5. 喂起始价（BTC=1000, ETH=1000）===");
  await priceFeed.write.setPrice([0n, 1000n]);
  await priceFeed.write.setPrice([1n, 1000n]);
  await pool.write.captureStartPrices();

  console.log("\n=== 6. 开局 → 结束 ===");
  await registry.write.startGame();
  await registry.write.endGame();

  console.log("\n=== 7. 喂结束价（BTC +1%=1010, ETH 0%=1000）===");
  await priceFeed.write.setPrice([0n, 1010n]);
  await priceFeed.write.setPrice([1n, 1000n]);

  console.log("\n=== 8. 充值奖池 1 tCTC + 结算 ===");
  await pool.write.depositPrize({ value: parseEther("1") });
  await pool.write.settle();

  console.log("\n=== 9. 只读查询结果 ===");
  console.log(
    "玩家A分数:",
    (await pool.read.memberScores([playerA.account.address])).toString(),
  );
  console.log(
    "玩家B分数:",
    (await pool.read.memberScores([playerB.account.address])).toString(),
  );
  console.log("阵营1分数:", (await pool.read.factionScores([1n])).toString());
  console.log("阵营2分数:", (await pool.read.factionScores([2n])).toString());
  console.log(
    "玩家A奖励:",
    formatEther(await pool.read.rewards([playerA.account.address])),
    "tCTC",
  );
  console.log(
    "玩家B奖励:",
    formatEther(await pool.read.rewards([playerB.account.address])),
    "tCTC",
  );
  console.log("是否已结算:", await pool.read.settled());

  console.log("\n=== 10. 玩家A 领奖 ===");
  const before = await publicClient.getBalance({
    address: playerA.account.address,
  });
  await pool.write.claimReward({ account: playerA.account });
  const after = await publicClient.getBalance({
    address: playerA.account.address,
  });
  console.log("领奖前余额:", formatEther(before), "tCTC");
  console.log("领奖后余额:", formatEther(after), "tCTC");
  console.log("到账(扣gas):", formatEther(after - before), "tCTC");

  console.log("\n✅ 全流程跑通");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
