// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IPriceFeed
/// @notice 价格喂价最小接口，供结算（PrizePool）跨合约读取验证后的币价。
interface IPriceFeed {
    function getPrice(
        uint256 coinId
    ) external view returns (uint256 price, uint256 timestamp);
}
