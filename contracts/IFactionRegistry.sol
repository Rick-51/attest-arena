// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IFactionRegistry
/// @notice ScoreAttester / PrizePool 跨合约读取身份层的最小接口。
///         用 bool 查询代替 enum，避免跨文件 enum 类型不一致导致的编译问题。
interface IFactionRegistry {
    function isActive() external view returns (bool);
    function isFinished() external view returns (bool);
    function teamExists(uint256 teamId) external view returns (bool);
    function getTeamFaction(uint256 teamId) external view returns (uint256);
    function getTeamLeader(uint256 teamId) external view returns (address);
    function teamCount() external view returns (uint256);
    function factionCount() external view returns (uint256);
}
