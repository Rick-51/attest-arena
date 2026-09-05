// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IPoints
/// @notice 积分账本最小接口，供 FactionRegistry / Prediction / PrizePool 跨合约读写。
interface IPoints {
    function mint(uint256 pointType, address to, uint256 amount) external;

    function burn(uint256 pointType, address from, uint256 amount) external;

    function balanceOf(
        uint256 pointType,
        address account
    ) external view returns (uint256);
}
