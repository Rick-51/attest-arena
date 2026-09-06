// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IPoints.sol";

/// @title Points
/// @notice 三种积分账本（A/B/O，对应 BTC/ETH/CTC），取代旧的单一分数 ScoreAttester。
///         只有授权 minter 能铸/销毁；成员间可 OTC 兑换（无汇率、纯自愿、原子结算）。
contract Points is IPoints {
    // 积分类型（与 coinId 一一对应）
    uint256 public constant POINT_A = 0; // BTC
    uint256 public constant POINT_B = 1; // ETH
    uint256 public constant POINT_O = 2; // CTC
    uint256 public constant POINT_COUNT = 3;

    // 账本：[pointType][address] = 余额
    mapping(uint256 => mapping(address => uint256)) public balances;

    // ---- OTC 兑换提议 ----
    struct SwapProposal {
        address proposer; // 提议方
        address counterparty; // 对方
        uint256 fromType; // 提议方给出什么积分
        uint256 fromAmount;
        uint256 toType; // 对方给出什么积分
        uint256 toAmount;
        bool accepted;
        bool cancelled;
    }
    uint256 public proposalCount;
    mapping(uint256 => SwapProposal) public proposals;

    address public owner;
    mapping(address => bool) public isMinter;

    event Minted(uint256 indexed pointType, address indexed to, uint256 amount);
    event Burned(uint256 indexed pointType, address indexed from, uint256 amount);
    event MinterSet(address indexed minter, bool authorized);
    event SwapProposed(
        uint256 indexed proposalId,
        address indexed proposer,
        address indexed counterparty
    );
    event SwapAccepted(uint256 indexed proposalId);
    event SwapCancelled(uint256 indexed proposalId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Points: not owner");
        _;
    }

    modifier onlyMinter() {
        require(isMinter[msg.sender], "Points: not minter");
        _;
    }

    modifier validType(uint256 pointType) {
        require(pointType < POINT_COUNT, "Points: bad type");
        _;
    }

    constructor() {
        owner = msg.sender;
        isMinter[msg.sender] = true;
    }

    // ---- 授权 ----

    function setMinter(address minter, bool authorized) external onlyOwner {
        isMinter[minter] = authorized;
        emit MinterSet(minter, authorized);
    }

    // ---- 铸 / 销毁 ----

    function mint(
        uint256 pointType,
        address to,
        uint256 amount
    ) external override onlyMinter validType(pointType) {
        balances[pointType][to] += amount;
        emit Minted(pointType, to, amount);
    }

    function burn(
        uint256 pointType,
        address from,
        uint256 amount
    ) external override onlyMinter validType(pointType) {
        require(balances[pointType][from] >= amount, "Points: insufficient");
        balances[pointType][from] -= amount;
        emit Burned(pointType, from, amount);
    }

    // ---- OTC 兑换（无汇率）----

    /// @notice 提议方托管 fromAmount，发起兑换提议
    function proposeSwap(
        address counterparty,
        uint256 fromType,
        uint256 fromAmount,
        uint256 toType,
        uint256 toAmount
    )
        external
        validType(fromType)
        validType(toType)
        returns (uint256 proposalId)
    {
        require(counterparty != address(0), "Points: zero addr");
        require(counterparty != msg.sender, "Points: self swap");
        require(fromAmount > 0 && toAmount > 0, "Points: zero amount");
        require(
            balances[fromType][msg.sender] >= fromAmount,
            "Points: insufficient"
        );

        // 托管提议方的 fromAmount（从余额扣除，由提议持有）
        balances[fromType][msg.sender] -= fromAmount;

        proposalCount++;
        proposalId = proposalCount;
        proposals[proposalId] = SwapProposal({
            proposer: msg.sender,
            counterparty: counterparty,
            fromType: fromType,
            fromAmount: fromAmount,
            toType: toType,
            toAmount: toAmount,
            accepted: false,
            cancelled: false
        });

        emit SwapProposed(proposalId, msg.sender, counterparty);
    }

    /// @notice 对方托管 toAmount，双方原子结算
    function acceptSwap(uint256 proposalId) external {
        SwapProposal storage p = proposals[proposalId];
        require(p.proposer != address(0), "Points: bad proposal");
        require(!p.accepted && !p.cancelled, "Points: already done");
        require(msg.sender == p.counterparty, "Points: not counterparty");
        require(
            balances[p.toType][msg.sender] >= p.toAmount,
            "Points: insufficient"
        );

        // 托管对方的 toAmount
        balances[p.toType][msg.sender] -= p.toAmount;
        // 原子结算
        balances[p.toType][p.proposer] += p.toAmount; // 提议方得到 toAmount 的 toType
        balances[p.fromType][p.counterparty] += p.fromAmount; // 对方得到 fromAmount 的 fromType

        p.accepted = true;
        emit SwapAccepted(proposalId);
    }

    /// @notice 未接受时，提议方撤回托管
    function cancelSwap(uint256 proposalId) external {
        SwapProposal storage p = proposals[proposalId];
        require(p.proposer != address(0), "Points: bad proposal");
        require(!p.accepted && !p.cancelled, "Points: already done");
        require(msg.sender == p.proposer, "Points: not proposer");

        // 释放托管
        balances[p.fromType][p.proposer] += p.fromAmount;

        p.cancelled = true;
        emit SwapCancelled(proposalId);
    }

    // ---- 只读 ----

    function balanceOf(
        uint256 pointType,
        address account
    ) external view override returns (uint256) {
        return balances[pointType][account];
    }
}
