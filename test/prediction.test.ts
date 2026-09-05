import { network } from "hardhat";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Prediction 币价押注", async function () {
  const { viem } = await network.create();
  const [owner, , alice, bob, charlie, dave] = await viem.getWalletClients();

  it("startRound → bet → resolveRound 判题与奖励", async function () {
    // 部署
    const proofVerifier = await viem.deployContract("USCProofVerifier");
    const priceFeed = await viem.deployContract("PriceFeed", [
      proofVerifier.address,
      1n,
    ]);
    const points = await viem.deployContract("Points");
    const prediction = await viem.deployContract("Prediction", [
      points.address,
      priceFeed.address,
    ]);

    // 授权 Prediction 铸/销毁积分
    await points.write.setMinter([prediction.address, true], {
      account: owner.account,
    });

    // 给 4 个玩家各 100 积分（pointType 0 = BTC）
    for (const p of [alice, bob, charlie, dave]) {
      await points.write.mint([0n, p.account.address, 100n], {
        account: owner.account,
      });
    }

    // 起始价 BTC=1000，开一轮
    await priceFeed.write.setPrice([0n, 1000n], { account: owner.account });
    await prediction.write.startRound([0n], { account: owner.account });

    // 押注：三人押涨、目标价不同，一人押跌
    await prediction.write.bet([1n, true, 1010n], { account: alice.account }); // dist 0
    await prediction.write.bet([1n, true, 1015n], { account: bob.account }); // dist 5
    await prediction.write.bet([1n, true, 1020n], { account: charlie.account }); // dist 10
    await prediction.write.bet([1n, false, 900n], { account: dave.account }); // 押跌（错）

    // 实际价 BTC=1010（涨），判题
    await priceFeed.write.setPrice([0n, 1010n], { account: owner.account });
    await prediction.write.resolveRound([1n], { account: owner.account });

    // 验证积分：每人先扣 10 押注，再按排名铸奖励
    // alice   100 - 10 + 30 = 120（第1）
    // bob     100 - 10 + 20 = 110（第2）
    // charlie 100 - 10 + 15 = 105（第3）
    // dave    100 - 10 + 0  = 90 （方向错，充公）
    assert.equal(await points.read.balanceOf([0n, alice.account.address]), 120n);
    assert.equal(await points.read.balanceOf([0n, bob.account.address]), 110n);
    assert.equal(await points.read.balanceOf([0n, charlie.account.address]), 105n);
    assert.equal(await points.read.balanceOf([0n, dave.account.address]), 90n);
  });
});
