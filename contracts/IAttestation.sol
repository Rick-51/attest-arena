// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IAttestation
/// @notice 存证抽象：ScoreAttester 只依赖此接口，不关心底层用哪种存证实现。
///         这样可在「自建 hash 存证」与「Creditcoin Attestcoin 跨链验证」之间无缝切换。
interface IAttestation {
    /// @notice 为一段关键事实数据生成一个链上可验的证明 ID
    /// @param data 关键事实（比赛/团队/阵营/任务/积分/时间等编码）
    /// @return attestationId 证明 ID，前端可用它去对应存证实现里核验
    function attest(bytes calldata data) external returns (bytes32 attestationId);
}
