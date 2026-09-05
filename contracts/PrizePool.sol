// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IFactionRegistry.sol";
import "./IPoints.sol";
import "./IPriceFeed.sol";

/// @title PrizePool
/// @notice 结算 + 奖池（v2）。结算依据 = 成员「最终分数」（积分 × 币价涨跌幅），不再是原始积分。
///
/// 分配规则（MVP，两层级按占比 pro-rata，无需排序）：
///   1. finalScore[成员] = Σ_t points[t] × multiplier[t]，其中 multiplier[t] = 1000 + deltaBps[t]
///   2. factionScore[阵营] = Σ 该阵营成员 finalScore
///   3. 阵营份额 = 总奖池 × factionScore / totalFactionScore
///   4. 成员份额 = 阵营份额 × memberFinalScore / factionScore
///
/// 注：设计文档写的是「按排名分（比例可配置）」，MVP 先用 pro-rata（等价于按分数占比，
/// 更公平且免去链上排序），排名比例留到 Phase 2。
contract PrizePool {
    IFactionRegistry public immutable registry;
    IPoints public immutable points;
    IPriceFeed public immutable priceFeed;

    address public owner;
    uint256 public totalPrizePool;
    bool public settled;

    uint256 public constant BASIS = 1000; // 涨跌 0% 的基准
    uint256 public constant COIN_COUNT = 3; // BTC/ETH/CTC

    /// 每种币开局时的价格（captureStartPrices 时记录）
    uint256[3] public startPrices;

    /// 结算后存下的分数（供查询 / 前端展示）
    mapping(address => uint256) public memberScores;
    mapping(uint256 => uint256) public factionScores;
    /// 成员 -> 可领取奖励
    mapping(address => uint256) public rewards;

    event Deposited(address indexed from, uint256 amount);
    event StartPricesCaptured(uint256[3] prices);
    event Settled(uint256 totalReward);
    event Claimed(address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "PP: not owner");
        _;
    }

    constructor(address _registry, address _points, address _priceFeed) {
        owner = msg.sender;
        registry = IFactionRegistry(_registry);
        points = IPoints(_points);
        priceFeed = IPriceFeed(_priceFeed);
    }

    receive() external payable {}

    // ---- 充奖池（结算前随时可充）----

    function depositPrize() external payable onlyOwner {
        require(!settled, "PP: already settled");
        totalPrizePool += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    // ---- 开局后由 owner 调用，记录每种币的起始价 ----

    function captureStartPrices() external onlyOwner {
        require(!settled, "PP: settled");
        for (uint256 t = 0; t < COIN_COUNT; t++) {
            (uint256 p, ) = priceFeed.getPrice(t);
            startPrices[t] = p;
        }
        emit StartPricesCaptured(startPrices);
    }

    // ---- 结算（只能一次）----

    function settle() external onlyOwner {
        require(!settled, "PP: already settled");
        require(registry.isFinished(), "PP: game not finished");
        require(totalPrizePool > 0, "PP: empty pool");

        // 1. 算每种币的 multiplier = 1000 + deltaBps
        int256[3] memory multipliers;
        for (uint256 t = 0; t < COIN_COUNT; t++) {
            (uint256 endPrice, ) = priceFeed.getPrice(t);
            multipliers[t] = _multiplier(startPrices[t], endPrice);
        }

        // 2. 第一遍：算每个成员 finalScore + 每个阵营 factionScore + 总阵营分
        uint256 fc = registry.factionCount();
        uint256 totalFactionScore = 0;
        for (uint256 f = 1; f <= fc; f++) {
            uint256 n = registry.getFactionMemberCount(f);
            uint256 factionScore = 0;
            for (uint256 i = 0; i < n; i++) {
                address member = registry.getFactionMember(f, i);
                uint256 s = _finalScore(member, multipliers);
                memberScores[member] = s;
                factionScore += s;
            }
            factionScores[f] = factionScore;
            totalFactionScore += factionScore;
        }
        require(totalFactionScore > 0, "PP: no scores");

        // 3. 第二遍：两层级按占比分配
        for (uint256 f = 1; f <= fc; f++) {
            uint256 factionShare = (totalPrizePool * factionScores[f]) /
                totalFactionScore;
            if (factionShare == 0) continue;

            uint256 n = registry.getFactionMemberCount(f);
            for (uint256 i = 0; i < n; i++) {
                address member = registry.getFactionMember(f, i);
                uint256 s = memberScores[member];
                if (s == 0) continue;
                rewards[member] += (factionShare * s) / factionScores[f];
            }
        }

        settled = true;
        emit Settled(totalPrizePool);
    }

    // ---- 领奖 ----

    function claimReward() external {
        require(settled, "PP: not settled");
        uint256 amount = rewards[msg.sender];
        require(amount > 0, "PP: nothing to claim");
        rewards[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{ value: amount }("");
        require(ok, "PP: transfer failed");
        emit Claimed(msg.sender, amount);
    }

    // ---- 内部 ----

    /// @dev multiplier = 1000 + deltaBps；deltaBps = (end-start)*10000/start（单位基点，1bp=0.01%）
    function _multiplier(
        uint256 startPrice,
        uint256 endPrice
    ) internal pure returns (int256) {
        if (startPrice == 0) return int256(BASIS); // 价格未初始化，按 0% 涨跌
        int256 deltaBps = ((int256(endPrice) - int256(startPrice)) * 10000) /
            int256(startPrice);
        return int256(BASIS) + deltaBps;
    }

    /// @dev finalScore = Σ points[t] × multiplier[t]；跌超 10%（multiplier<0）的那类积分按 0 计
    function _finalScore(
        address member,
        int256[3] memory multipliers
    ) internal view returns (uint256) {
        int256 total = 0;
        for (uint256 t = 0; t < COIN_COUNT; t++) {
            uint256 bal = points.balanceOf(t, member);
            if (bal == 0) continue;
            int256 m = multipliers[t];
            if (m <= 0) continue; // 跌超 10%，该积分不计分（钳制到 0）
            total += int256(bal) * m;
        }
        return uint256(total);
    }
}
