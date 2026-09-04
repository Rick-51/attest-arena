// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IFactionRegistry.sol";
import "./IScoreAttester.sol";

/// @title PrizePool
/// @notice 托管 native 币奖池，比赛结束后按「获胜阵营 + 阵营内排名」自动分配。
///         规则：获胜阵营独得全部奖池；阵营内 第1 40% / 第2 30% / 第3 20% / 其余 10% 按积分占比分。
///         团队奖金统一打给 leader，由 leader 代领。
contract PrizePool {
    IFactionRegistry public immutable registry;
    IScoreAttester public immutable scores;

    address public owner;
    uint256 public totalPrizePool; // 实际存入的 native 币余额
    bool public settled;

    // 分配比例（%）
    uint256 public constant RATIO_1ST = 40;
    uint256 public constant RATIO_2ND = 30;
    uint256 public constant RATIO_3RD = 20;
    uint256 public constant RATIO_REST = 10;

    mapping(address => uint256) public rewards; // 团队 leader -> 可领取金额

    event Deposited(address indexed from, uint256 amount);
    event Settled(uint256 indexed winningFactionId, uint256 totalReward);
    event Claimed(address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "PP: not owner");
        _;
    }

    constructor(address _registry, address _scores) {
        owner = msg.sender;
        registry = IFactionRegistry(_registry);
        scores = IScoreAttester(_scores);
    }

    receive() external payable {}

    // ---- Owner：存入奖池（结算前随时可充）----
    function depositPrize() external payable onlyOwner {
        require(!settled, "PP: already settled");
        totalPrizePool += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    // ---- Owner：结算（只能一次）----
    function settlePrizes() external onlyOwner {
        require(!settled, "PP: already settled");
        require(registry.isFinished(), "PP: game not finished");
        require(totalPrizePool > 0, "PP: empty pool");

        uint256 winningFaction = _findWinningFaction();
        require(winningFaction > 0, "PP: no scores");

        uint256[3] memory topTeams = _findTopTeams(winningFaction);

        _allocate(winningFaction, topTeams);

        settled = true;
        emit Settled(winningFaction, totalPrizePool);
    }

    // ---- 团队 leader 代领 ----
    function claimReward(uint256 teamId) external {
        require(settled, "PP: not settled");
        address leader = registry.getTeamLeader(teamId);
        require(msg.sender == leader, "PP: only leader");

        uint256 amount = rewards[leader];
        require(amount > 0, "PP: nothing to claim");
        rewards[leader] = 0;

        (bool ok, ) = leader.call{ value: amount }("");
        require(ok, "PP: transfer failed");
        emit Claimed(leader, amount);
    }

    // ---- 内部：找积分最高的获胜阵营 ----
    function _findWinningFaction() internal view returns (uint256 winningFaction) {
        uint256 bestScore = 0;
        uint256 fc = registry.factionCount();
        for (uint256 f = 1; f <= fc; f++) {
            uint256 s = scores.getFactionScore(f);
            if (s > bestScore) {
                bestScore = s;
                winningFaction = f;
            }
        }
        return winningFaction;
    }

    // ---- 内部：获胜阵营内按团队积分选前 3 ----
    function _findTopTeams(uint256 factionId) internal view returns (uint256[3] memory topTeams) {
        uint256[3] memory topScores;
        uint256 tc = registry.teamCount();
        for (uint256 t = 1; t <= tc; t++) {
            if (registry.getTeamFaction(t) != factionId) continue;
            uint256 s = scores.getTeamScore(t);
            if (s > topScores[0]) {
                topScores[2] = topScores[1];
                topTeams[2] = topTeams[1];
                topScores[1] = topScores[0];
                topTeams[1] = topTeams[0];
                topScores[0] = s;
                topTeams[0] = t;
            } else if (s > topScores[1]) {
                topScores[2] = topScores[1];
                topTeams[2] = topTeams[1];
                topScores[1] = s;
                topTeams[1] = t;
            } else if (s > topScores[2]) {
                topScores[2] = s;
                topTeams[2] = t;
            }
        }
        return topTeams;
    }

    // ---- 内部：按比例分配 ----
    function _allocate(uint256 factionId, uint256[3] memory topTeams) internal {
        uint256 pool = totalPrizePool;
        uint256 first = pool * RATIO_1ST / 100;
        uint256 second = pool * RATIO_2ND / 100;
        uint256 third = pool * RATIO_3RD / 100;
        uint256 rest = pool * RATIO_REST / 100;

        // 前 3 名；空缺名次的份额并入第 1 名
        if (topTeams[0] != 0) {
            uint256 amount = first;
            if (topTeams[1] == 0) amount += second;
            if (topTeams[2] == 0) amount += third;
            _credit(topTeams[0], amount);
        }
        if (topTeams[1] != 0) _credit(topTeams[1], second);
        if (topTeams[2] != 0) _credit(topTeams[2], third);

        // 剩余 10% 按获胜阵营内其余团队积分占比分
        uint256 totalRestScore = 0;
        uint256 tc = registry.teamCount();
        for (uint256 t = 1; t <= tc; t++) {
            if (registry.getTeamFaction(t) != factionId) continue;
            if (t == topTeams[0] || t == topTeams[1] || t == topTeams[2]) continue;
            totalRestScore += scores.getTeamScore(t);
        }

        if (totalRestScore > 0) {
            for (uint256 t = 1; t <= tc; t++) {
                if (registry.getTeamFaction(t) != factionId) continue;
                if (t == topTeams[0] || t == topTeams[1] || t == topTeams[2]) continue;
                _credit(t, rest * scores.getTeamScore(t) / totalRestScore);
            }
        } else if (topTeams[0] != 0) {
            _credit(topTeams[0], rest); // 无其余团队，10% 给第 1
        }
    }

    function _credit(uint256 teamId, uint256 amount) internal {
        if (amount == 0) return;
        address leader = registry.getTeamLeader(teamId);
        rewards[leader] += amount;
    }
}
