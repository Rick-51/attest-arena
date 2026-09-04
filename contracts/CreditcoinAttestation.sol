// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAttestation.sol";

/// @notice 官方 Creditcoin Block Prover Precompile 接口（字段待核对）
interface INativeQueryVerifier {
    struct MerkleProofEntry {
        // ⚠️ 字段待确认：官方通常为 (hash + 方向/位置标记)，此处是重建示例
        bytes32 hash;
        bool isLeft;
    }

    /// @dev 验证一条源链交易确实被包含在已确认区块中，返回 bool。
    /// ⚠️ 不校验交易是否成功，需自行解析 receipt.status。
    function verify(
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots
    ) external returns (bool);
}

/// @title CreditcoinAttestation
/// @notice 真实对接 Creditcoin Attestcoin Protocol（ASC + Block Prover Precompile）。
///         用于「链上交互」类任务：验证用户在其它链上真的完成了某笔交易，才给分。
///
/// @dev  ⚠️ 重要警告：本文件的 INativeQueryVerifier 接口按官方资料重建，
///      MerkleProofEntry 字段与 verify 的精确签名尚未完全核对（官方仓库与文档被网络策略阻挡）。
///      请按官方示例仓库补全：
///        https://github.com/gluwa/usc-testnet-bridge-examples
///        （参考 contracts/sol/USCMinter.sol 与 INativeQueryVerifier 定义）
contract CreditcoinAttestation is IAttestation {
    // Block Prover Precompile（Native Query Verifier）地址
    address public constant VERIFIER = address(0x0FD2);

    // 防重放：每个跨链证明只能被消费一次
    mapping(bytes32 => bool) public processedQueries;

    /// @notice 存证入口：对关键事实做 keccak 作为证明 ID。
    ///         （跨链交易验证请用 verifyOnchainTask）
    function attest(bytes calldata data) external override returns (bytes32 attestationId) {
        attestationId = keccak256(data);
        return attestationId;
    }

    /// @notice 验证某用户在源链上完成了一笔交易；成功则返回该笔交易的证明 ID。
    ///         典型调用方：ScoreAttester 针对「链上交互」任务先验证再加分。
    function verifyOnchainTask(
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots
    ) external returns (bytes32 queryId) {
        queryId = keccak256(abi.encode(chainKey, blockHeight, encodedTransaction));
        require(!processedQueries[queryId], "CA: replay");

        bool ok = INativeQueryVerifier(VERIFIER).verify(
            chainKey,
            blockHeight,
            encodedTransaction,
            merkleRoot,
            siblings,
            lowerEndpointDigest,
            continuityRoots
        );
        require(ok, "CA: verification failed");

        // ⚠️ precompile 不校验交易是否成功，需用 EvmV1Decoder 从 encodedTransaction
        //    解析出 receipt.status，并 require(status == 0x1, "CA: tx failed")。
        //    此处为 MVP 简化，暂未实现状态校验。

        processedQueries[queryId] = true;
        return queryId;
    }
}
