# Attest Arena — 智能合约

Creditcoin EVM 上的「阵营对抗 + 积分链上存证 + 奖池自动分配」项目，Solidity 合约层。

## 合约文件

| 文件 | 作用 |
|------|------|
| `IFactionRegistry.sol` | 身份层最小接口（跨合约读取） |
| `IScoreAttester.sol` | 积分账本最小接口 |
| `IAttestation.sol` | 存证抽象接口 |
| `FactionRegistry.sol` | 阵营 / 团队 / 成员 + 状态机（身份底座） |
| `ScoreAttester.sol` | 积分权威账本 + 存证（核心） |
| `PrizePool.sol` | native 币奖池 + 自动分配 |
| `SelfAttestation.sol` | 自建 hash 存证（可立即跑通） |
| `CreditcoinAttestation.sol` | 真实对接 Attestcoin（ABI 待核对） |

## 部署顺序（Remix）

1. 部署 `SelfAttestation` → 得地址 `AT`
2. 部署 `FactionRegistry` → 得地址 `FR`
3. 部署 `ScoreAttester(FR, AT)` → 得地址 `SA`
4. 部署 `PrizePool(FR, SA)` → 得地址 `PP`
5. 在 `ScoreAttester` 调 `setBackend(后端地址, true)` 授权后端加分

> 之后若换成真实 Attestcoin：部署 `CreditcoinAttestation` 代替 `SelfAttestation`，
> 重新部署 `ScoreAttester` 时传新地址即可，核心逻辑不改。

## Remix 测试流程（完整跑一遍）

1. Owner 调 `FR.createFaction("阵营A")`、`FR.createFaction("阵营B")`
2. 用两个玩家地址分别 `FR.createTeam("队1", 1)`、`FR.createTeam("队2", 2)`
3. Owner 调 `FR.startGame()`
4. 后端地址调 `SA.addScore(1, 任务ID, 100)` 给队 1 加 100 分
5. Owner 调 `FR.endGame()`
6. Owner 往 `PP` 充值：调 `depositPrize()` 并填 `value`（如 1 ether）
7. Owner 调 `PP.settlePrizes()`
8. 队 leader 用对应地址调 `PP.claimReward(teamId)` 领奖

## 分配规则（写死在 PrizePool）

- 获胜阵营独得全部奖池（失败阵营无奖励，增加对抗性）
- 获胜阵营内：第 1 名 40% / 第 2 名 30% / 第 3 名 20% / 其余团队按积分占比分 10%
- 团队奖金统一打给 leader（简化，MVP）

## ⚠️ 待确认（连 Creditcoin 测试网）

- 网络 RPC：`https://rpc.cc3-testnet.creditcoin.network`（cc3 测试网）
- **chainId**：需去官方文档确认（尚未抓取到准确值）
- 测试币水龙头地址
- `CreditcoinAttestation.sol` 里 `INativeQueryVerifier` 的精确 ABI
  （`MerkleProofEntry` 字段、`verify` 签名）—— 参考 https://github.com/gluwa/usc-testnet-bridge-examples

## 设计要点

- **积分单一权威源**：分数只存在 `ScoreAttester`，`FactionRegistry` 不存分，避免不一致。
- **存证解耦**：核心合约只依赖 `IAttestation` 接口，换存证实现无需改核心逻辑。
- **防女巫**：`playerTeam` 映射保证一个地址只能加入一个团队。
- **状态机**：`NOT_STARTED → ACTIVE → FINISHED`，比赛结束后积分锁定、无法再加分。
