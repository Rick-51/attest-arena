// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PriceSource
/// @notice Sepolia 源链上的价格发布合约。
///         后端 worker 定期调 publishPrice 发 PricePublished 事件，
///         供 Creditcoin 侧 PriceFeed 通过 Attestcoin 跨链验证读取。
contract PriceSource {
    address public owner;

    /// @notice 价格发布事件。topic0 = keccak256("PricePublished(uint256,uint256,uint256)")
    event PricePublished(uint256 coinId, uint256 price, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "PS: not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice 发布某币的最新价格（仅 owner = 后端 worker 的 Sepolia 地址）
    function publishPrice(uint256 coinId, uint256 price) external onlyOwner {
        emit PricePublished(coinId, price, block.timestamp);
    }
}
