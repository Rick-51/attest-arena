// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IPoints.sol";
import "./IPriceFeed.sol";

/// @title Prediction
/// @notice 币价押注（Phase 2）。一轮押一个币：成员预测「涨/跌」+ 目标价，押固定额度积分。
///         轮次结束读 PriceFeed 真实价判题：
///         - 方向对 → 按 |target - actual| 升序排名，前 3 名铸 30/20/15，其余正确铸 12（可配）
///         - 方向错 → 押注积分充公（burn，已被销毁）
///
/// MVP 简化：一轮一个币（设计文档原为 coins[]）；每人每轮一注；押注额度固定。
contract Prediction {
    IPoints public immutable points;
    IPriceFeed public immutable priceFeed;

    address public owner;

    // 可配置参数
    uint256 public stakeAmount = 10; // 每注固定押注积分
    uint256 public rewardFirst = 30; // 第 1 名奖励
    uint256 public rewardSecond = 20; // 第 2 名
    uint256 public rewardThird = 15; // 第 3 名
    uint256 public rewardRest = 12; // 其余方向正确者

    struct Round {
        uint256 id;
        uint256 coinId;
        uint256 startPrice; // 开局时快照的币价
        bool resolved;
    }

    struct Bet {
        address bettor;
        bool isUp; // true=涨，false=跌
        uint256 targetPrice;
    }

    uint256 public roundCount;
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => Bet[]) public roundBets; // roundId -> 押注列表
    mapping(uint256 => mapping(address => bool)) public hasBet; // roundId -> bettor 是否已押

    event RoundStarted(uint256 indexed roundId, uint256 indexed coinId, uint256 startPrice);
    event BetPlaced(
        uint256 indexed roundId,
        address indexed bettor,
        bool isUp,
        uint256 targetPrice,
        uint256 amount
    );
    event RoundResolved(uint256 indexed roundId, uint256 actualPrice);
    event RewardMinted(
        uint256 indexed roundId,
        address indexed bettor,
        uint256 amount
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Pred: not owner");
        _;
    }

    constructor(address _points, address _priceFeed) {
        owner = msg.sender;
        points = IPoints(_points);
        priceFeed = IPriceFeed(_priceFeed);
    }

    // ---- 配置 ----

    function setStakeAmount(uint256 amount) external onlyOwner {
        stakeAmount = amount;
    }

    function setRewards(
        uint256 first,
        uint256 second,
        uint256 third,
        uint256 rest
    ) external onlyOwner {
        rewardFirst = first;
        rewardSecond = second;
        rewardThird = third;
        rewardRest = rest;
    }

    // ---- 开轮（快照当前价作为起始价）----

    function startRound(uint256 coinId) external onlyOwner returns (uint256 roundId) {
        (uint256 startPrice, ) = priceFeed.getPrice(coinId);
        require(startPrice > 0, "Pred: no start price");

        roundCount++;
        roundId = roundCount;
        rounds[roundId] = Round({
            id: roundId,
            coinId: coinId,
            startPrice: startPrice,
            resolved: false
        });
        emit RoundStarted(roundId, coinId, startPrice);
    }

    // ---- 押注 ----

    function bet(uint256 roundId, bool isUp, uint256 targetPrice) external {
        Round storage round = rounds[roundId];
        require(round.startPrice > 0, "Pred: bad round");
        require(!round.resolved, "Pred: already resolved");
        require(!hasBet[roundId][msg.sender], "Pred: already bet");
        require(targetPrice > 0, "Pred: bad target");

        // 押注积分充公（burn，从 bettor 余额扣）
        points.burn(round.coinId, msg.sender, stakeAmount);

        hasBet[roundId][msg.sender] = true;
        roundBets[roundId].push(
            Bet({ bettor: msg.sender, isUp: isUp, targetPrice: targetPrice })
        );

        emit BetPlaced(roundId, msg.sender, isUp, targetPrice, stakeAmount);
    }

    // ---- 判题 ----

    function resolveRound(uint256 roundId) external onlyOwner {
        Round storage round = rounds[roundId];
        require(round.startPrice > 0, "Pred: bad round");
        require(!round.resolved, "Pred: already resolved");

        (uint256 actual, ) = priceFeed.getPrice(round.coinId);
        bool priceUp = actual > round.startPrice;

        Bet[] storage bets = roundBets[roundId];
        uint256 n = bets.length;

        // 方向对者按 |target - actual| 升序，找前 3
        address[3] memory top;
        uint256[3] memory topDist = [
            type(uint256).max,
            type(uint256).max,
            type(uint256).max
        ];

        for (uint256 i = 0; i < n; i++) {
            Bet storage b = bets[i];
            bool correct = (b.isUp && priceUp) || (!b.isUp && !priceUp);
            if (!correct) continue;

            uint256 dist = _dist(b.targetPrice, actual);
            if (dist < topDist[0]) {
                top[2] = top[1];
                topDist[2] = topDist[1];
                top[1] = top[0];
                topDist[1] = topDist[0];
                top[0] = b.bettor;
                topDist[0] = dist;
            } else if (dist < topDist[1]) {
                top[2] = top[1];
                topDist[2] = topDist[1];
                top[1] = b.bettor;
                topDist[1] = dist;
            } else if (dist < topDist[2]) {
                top[2] = b.bettor;
                topDist[2] = dist;
            }
        }

        // 发前 3 奖励
        if (top[0] != address(0)) {
            points.mint(round.coinId, top[0], rewardFirst);
            emit RewardMinted(roundId, top[0], rewardFirst);
        }
        if (top[1] != address(0)) {
            points.mint(round.coinId, top[1], rewardSecond);
            emit RewardMinted(roundId, top[1], rewardSecond);
        }
        if (top[2] != address(0)) {
            points.mint(round.coinId, top[2], rewardThird);
            emit RewardMinted(roundId, top[2], rewardThird);
        }

        // 其余方向正确者发 rewardRest
        for (uint256 i = 0; i < n; i++) {
            Bet storage b = bets[i];
            bool correct = (b.isUp && priceUp) || (!b.isUp && !priceUp);
            if (!correct) continue;
            if (b.bettor == top[0] || b.bettor == top[1] || b.bettor == top[2]) {
                continue;
            }
            points.mint(round.coinId, b.bettor, rewardRest);
            emit RewardMinted(roundId, b.bettor, rewardRest);
        }

        round.resolved = true;
        emit RoundResolved(roundId, actual);
    }

    // ---- 内部 ----

    function _dist(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a - b : b - a;
    }
}
