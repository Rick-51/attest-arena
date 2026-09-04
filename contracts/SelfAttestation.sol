// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAttestation.sol";

/// @title SelfAttestation
/// @notice MVP 自建存证：对 data 做 keccak256，把哈希当作证明 ID。
///         积分记录与哈希都上链，游戏结束后不可篡改、公开可验。
///         用法：先部署本合约，把地址传给 ScoreAttester。
contract SelfAttestation is IAttestation {
    // 证明 ID -> 首次存证时间戳（0 表示未存证过）
    mapping(bytes32 => uint256) public attestedAt;

    event Attested(bytes32 indexed attestationId, uint256 timestamp);

    function attest(bytes calldata data) external override returns (bytes32 attestationId) {
        attestationId = keccak256(data);
        if (attestedAt[attestationId] == 0) {
            attestedAt[attestationId] = block.timestamp;
        }
        emit Attested(attestationId, block.timestamp);
        return attestationId;
    }
}
