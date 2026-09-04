// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IScoreAttester
/// @notice PrizePool 跨合约读取积分账本的最小接口。
interface IScoreAttester {
    function getTeamScore(uint256 teamId) external view returns (uint256);
    function getFactionScore(uint256 factionId) external view returns (uint256);
}
