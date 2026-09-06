// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IFactionRegistry
/// @notice 身份层最小接口，供结算（PrizePool）等跨合约读取阵营与成员。
interface IFactionRegistry {
    function isFinished() external view returns (bool);

    function factionCount() external view returns (uint256);

    function getFactionCoin(uint256 factionId) external view returns (uint256);

    function getFactionMemberCount(
        uint256 factionId
    ) external view returns (uint256);

    function getFactionMember(
        uint256 factionId,
        uint256 index
    ) external view returns (address);
}
