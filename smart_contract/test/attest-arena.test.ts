import { network } from "hardhat";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const ETHER = 10n ** 18n;

describe("Attest Arena 完整游戏流程", async function () {
  const { viem } = await network.create();
  const [owner, backend, alice, bob] = await viem.getWalletClients();

  it("从部署到结算全链路", async function () {
    // 1. 部署（顺序：USCProofVerifier → PriceFeed → Points → FactionRegistry → PrizePool）
    const proofVerifier = await viem.deployContract("USCProofVerifier");
    const priceFeed = await viem.deployContract("PriceFeed", [
      proofVerifier.address,
      1n,
    ]);
    const points = await viem.deployContract("Points");
    const registry = await viem.deployContract("FactionRegistry", [
      points.address,
    ]);
    const prizePool = await viem.deployContract("PrizePool", [
      registry.address,
      points.address,
      priceFeed.address,
    ]);

    // 2. 授权
    await points.write.setMinter([registry.address, true], {
      account: owner.account,
    });
    await priceFeed.write.setBackend([backend.account.address, true], {
      account: owner.account,
    });

    // 3. 建两个阵营：1 = BTC(coinId 0)，2 = ETH(coinId 1)
    await registry.write.createFaction(["BTC队", 0n], { account: owner.account });
    await registry.write.createFaction(["ETH队", 1n], { account: owner.account });

    // 4. 玩家入场（默认铸 100 该阵营积分）
    await registry.write.joinFaction([1n], { account: alice.account });
    await registry.write.joinFaction([2n], { account: bob.account });

    // 5. 验证积分铸出（Alice 100 A，Bob 100 B）
    assert.equal(await points.read.balanceOf([0n, alice.account.address]), 100n);
    assert.equal(await points.read.balanceOf([1n, bob.account.address]), 100n);

    // 6. 起始价：BTC=1000，ETH=1000
    await priceFeed.write.setPrice([0n, 1000n], { account: owner.account });
    await priceFeed.write.setPrice([1n, 1000n], { account: owner.account });
    await prizePool.write.captureStartPrices({ account: owner.account });

    // 7. 开局 → 结束
    await registry.write.startGame({ account: owner.account });
    await registry.write.endGame({ account: owner.account });

    // 8. 结束价：BTC +1%（1010），ETH 0%（1000）
    await priceFeed.write.setPrice([0n, 1010n], { account: owner.account });
    await priceFeed.write.setPrice([1n, 1000n], { account: owner.account });

    // 9. 充值 + 结算
    await prizePool.write.depositPrize({ account: owner.account, value: ETHER });
    await prizePool.write.settle({ account: owner.account });

    // 10. 验证分数
    //     Alice: 100 A × 1100 = 110000（BTC 涨 1%，multiplier=1000+100）
    //     Bob:   100 B × 1000 = 100000（ETH 涨 0%，multiplier=1000）
    assert.equal(await prizePool.read.memberScores([alice.account.address]), 110000n);
    assert.equal(await prizePool.read.memberScores([bob.account.address]), 100000n);
    assert.equal(await prizePool.read.factionScores([1n]), 110000n);
    assert.equal(await prizePool.read.factionScores([2n]), 100000n);

    // 11. 验证奖励（两层级 pro-rata）
    const aliceReward = (ETHER * 110000n) / 210000n;
    const bobReward = (ETHER * 100000n) / 210000n;
    assert.equal(await prizePool.read.rewards([alice.account.address]), aliceReward);
    assert.equal(await prizePool.read.rewards([bob.account.address]), bobReward);

    // 12. 领奖（balance 变化 = 奖励，自动扣除 gas 后校验）
    await viem.assertions.balancesHaveChanged(
      prizePool.write.claimReward({ account: alice.account }),
      [{ address: alice.account.address, amount: aliceReward }],
    );
  });
});

describe("Points OTC 兑换", async function () {
  const { viem } = await network.create();
  const [owner, alice, bob] = await viem.getWalletClients();

  it("proposeSwap → acceptSwap 原子结算", async function () {
    const points = await viem.deployContract("Points");

    // 铸积分：alice 100 A，bob 50 B
    await points.write.mint([0n, alice.account.address, 100n], { account: owner.account });
    await points.write.mint([1n, bob.account.address, 50n], { account: owner.account });

    // alice 提议：给 100 A 换 50 B
    await points.write.proposeSwap([bob.account.address, 0n, 100n, 1n, 50n], {
      account: alice.account,
    });

    // 提议方积分被托管（A 余额归 0）
    assert.equal(await points.read.balanceOf([0n, alice.account.address]), 0n);

    // bob 接受
    await points.write.acceptSwap([1n], { account: bob.account });

    // 验证原子结算
    assert.equal(await points.read.balanceOf([0n, alice.account.address]), 0n); // alice 的 A 已给出
    assert.equal(await points.read.balanceOf([1n, alice.account.address]), 50n); // alice 得到 50 B
    assert.equal(await points.read.balanceOf([0n, bob.account.address]), 100n); // bob 得到 100 A
    assert.equal(await points.read.balanceOf([1n, bob.account.address]), 0n); // bob 的 B 已给出
  });

  it("proposeSwap → cancelSwap 撤回托管", async function () {
    const points = await viem.deployContract("Points");
    await points.write.mint([0n, alice.account.address, 100n], { account: owner.account });

    await points.write.proposeSwap([bob.account.address, 0n, 100n, 1n, 50n], {
      account: alice.account,
    });
    assert.equal(await points.read.balanceOf([0n, alice.account.address]), 0n);

    // alice 撤回
    await points.write.cancelSwap([1n], { account: alice.account });
    assert.equal(await points.read.balanceOf([0n, alice.account.address]), 100n);
  });
});
