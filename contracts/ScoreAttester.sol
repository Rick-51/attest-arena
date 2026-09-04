// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IFactionRegistry.sol";
import "./IAttestation.sol";

/// @title ScoreAttester
/// @notice 积分权威账本 + 链上存证。只有授权后端能加减分，每次变动都生成一条存证记录。
contract ScoreAttester {
    // ---- 积分记录 ----
    struct ScoreRecord {
        uint256 teamId;
        uint256 taskId;
        int256 scoreChange; // 正数加分，负数扣分
        uint256 timestamp;
        bytes32 attestationId; // 存证证明 ID
    }

    // ---- 存储 ----
    mapping(uint256 => uint256) public teamScores; // teamId -> 总分
    mapping(uint256 => uint256) public factionScores; // factionId -> 总分
    mapping(uint256 => ScoreRecord[]) public teamRecords; // teamId -> 记录列表
    mapping(address => bool) public isBackend; // 授权后端

    address public owner;
    IFactionRegistry public immutable registry;
    IAttestation public immutable attestation;

    // ---- 事件 ----
    event ScoreAdded(uint256 indexed teamId, uint256 indexed taskId, int256 scoreChange, bytes32 indexed attestationId);
    event BackendAuthorized(address indexed backend, bool authorized);

    // ---- 修饰器 ----
    modifier onlyOwner() {
        require(msg.sender == owner, "SA: not owner");
        _;
    }
    modifier onlyBackend() {
        require(isBackend[msg.sender] || msg.sender == owner, "SA: not backend");
        _;
    }

    constructor(address _registry, address _attestation) {
        owner = msg.sender;
        registry = IFactionRegistry(_registry);
        attestation = IAttestation(_attestation);
    }

    // ---- 授权后端（部署后调用，把后端钱包地址加入授权列表）----
    function setBackend(address backend, bool authorized) external onlyOwner {
        isBackend[backend] = authorized;
        emit BackendAuthorized(backend, authorized);
    }

    // ---- 核心：加减分 + 存证 ----
    function addScore(uint256 teamId, uint256 taskId, int256 scoreChange) external onlyBackend returns (bytes32 attestationId) {
        require(registry.isActive(), "SA: game not active");
        require(registry.teamExists(teamId), "SA: bad team");

        uint256 factionId = registry.getTeamFaction(teamId);

        // 更新团队 & 阵营总分
        if (scoreChange >= 0) {
            teamScores[teamId] += uint256(scoreChange);
            factionScores[factionId] += uint256(scoreChange);
        } else {
            uint256 sub = uint256(-scoreChange); // 注意：scoreChange 为 int256 最小值时会溢出，MVP 忽略
            require(teamScores[teamId] >= sub, "SA: score underflow");
            teamScores[teamId] -= sub;
            factionScores[factionId] -= sub; // 阵营分 >= 团队分 >= sub，安全
        }

        // 生成链上存证（关键事实：团队/阵营/任务/积分变化/时间）
        bytes memory data = abi.encode(teamId, factionId, taskId, scoreChange, block.timestamp);
        attestationId = attestation.attest(data);

        // 存入记录
        teamRecords[teamId].push(
            ScoreRecord({
                teamId: teamId,
                taskId: taskId,
                scoreChange: scoreChange,
                timestamp: block.timestamp,
                attestationId: attestationId
            })
        );

        emit ScoreAdded(teamId, taskId, scoreChange, attestationId);
        return attestationId;
    }

    // ---- 只读 ----
    function getTeamScore(uint256 teamId) external view returns (uint256) {
        return teamScores[teamId];
    }

    function getFactionScore(uint256 factionId) external view returns (uint256) {
        return factionScores[factionId];
    }

    function getTeamRecordCount(uint256 teamId) external view returns (uint256) {
        return teamRecords[teamId].length;
    }

    function getTeamRecord(uint256 teamId, uint256 index) external view returns (ScoreRecord memory) {
        return teamRecords[teamId][index];
    }
}
