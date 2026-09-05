import { network } from "hardhat";
import { parseEther, formatEther } from "viem";

// 本地测试网全流程演示（对应「业务流程操作手册」）
// 运行：npx hardhat run scripts/demo.ts
async function main() {
  const { viem } = await network.create();
  const [owner, backend, playerA, playerB] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  console.log("=== 账号分工 ===");
  console.log("Owner(部署者):", owner.account.address);
  console.log("Backend(后端):", backend.account.address);
  console.log("玩家A(队1 leader):", playerA.account.address);
  console.log("玩家B(队2 leader):", playerB.account.address);

  console.log("\n=== 1. 部署合约 ===");
  const attestation = await viem.deployContract("SelfAttestation");
  const registry = await viem.deployContract("FactionRegistry");
  const scores = await viem.deployContract("ScoreAttester", [
    registry.address,
    attestation.address,
  ]);
  const pool = await viem.deployContract("PrizePool", [
    registry.address,
    scores.address,
  ]);
  console.log("SelfAttestation:", attestation.address);
  console.log("FactionRegistry:", registry.address);
  console.log("ScoreAttester:", scores.address);
  console.log("PrizePool:", pool.address);

  console.log("\n=== 2. Owner 建两个阵营 ===");
  await registry.write.createFaction(["阵营A"]);
  await registry.write.createFaction(["阵营B"]);
  console.log("阵营 1、2 已创建");

  console.log("\n=== 3. Owner 授权后端 ===");
  await scores.write.setBackend([backend.account.address, true]);
  console.log("后端已授权:", backend.account.address);

  console.log("\n=== 4. 玩家建队 ===");
  await registry.write.createTeam(["队1", 1n], { account: playerA.account });
  await registry.write.createTeam(["队2", 2n], { account: playerB.account });
  console.log("队1(阵营1)、队2(阵营2) 已创建");

  console.log("\n=== 5. Owner 开局 ===");
  await registry.write.startGame();

  console.log("\n=== 6. 后端给队1 +100 分 ===");
  await scores.write.addScore([1n, 1001n, 100n], { account: backend.account });
  console.log("队1 +100 分（已上链存证）");

  console.log("\n=== 7. Owner 结束比赛 ===");
  await registry.write.endGame();

  console.log("\n=== 8. Owner 充值奖池 1 tCTC ===");
  await pool.write.depositPrize({ value: parseEther("1") });

  console.log("\n=== 9. Owner 结算 ===");
  await pool.write.settlePrizes();

  console.log("\n=== 10. 只读查询结果 ===");
  console.log("队1积分:", (await scores.read.getTeamScore([1n])).toString());
  console.log("阵营1积分:", (await scores.read.getFactionScore([1n])).toString());
  console.log("阵营2积分:", (await scores.read.getFactionScore([2n])).toString());
  console.log("是否已结算:", await pool.read.settled());
  console.log("奖池总额:", formatEther(await pool.read.totalPrizePool()), "tCTC");

  console.log("\n=== 11. 队1 leader 领奖 ===");
  const before = await publicClient.getBalance({
    address: playerA.account.address,
  });
  await pool.write.claimReward([1n], { account: playerA.account });
  const after = await publicClient.getBalance({
    address: playerA.account.address,
  });
  console.log("领奖前余额:", formatEther(before), "tCTC");
  console.log("领奖后余额:", formatEther(after), "tCTC");
  console.log("到账(约1，扣gas):", formatEther(after - before), "tCTC");

  console.log("\n✅ 全流程跑通");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
