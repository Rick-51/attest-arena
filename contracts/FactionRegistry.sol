// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IPoints.sol";

/// @title FactionRegistry
/// @notice 身份底座（v2）：阵营钉币 + 成员交 tCTC 入场铸积分 + 金库托管 + 比赛状态机。
///         砍掉 Team 层级；一个地址只能进一个阵营（防女巫）。
contract FactionRegistry {
    enum GamePhase { NOT_STARTED, ACTIVE, FINISHED }
    GamePhase public gamePhase = GamePhase.NOT_STARTED;

    // 钉的币（全局枚举，与 Points 积分类型一一对应）
    uint256 public constant COIN_BTC = 0;
    uint256 public constant COIN_ETH = 1;
    uint256 public constant COIN_CTC = 2;

    struct Faction {
        uint256 id;
        string name;
        uint256 coinId; // 钉的币（0=BTC,1=ETH,2=CTC）
    }

    mapping(uint256 => Faction) public factions;
    uint256 public factionCount;

    /// 地址 -> 阵营 id（0 = 未加入）
    mapping(address => uint256) public playerFaction;
    /// 阵营 id -> 成员地址列表
    mapping(uint256 => address[]) public factionMembers;
    /// 阵营金库（tCTC 入场费）
    mapping(uint256 => uint256) public factionTreasury;

    /// 积分账本（joinFaction 时铸积分）
    IPoints public immutable points;

    /// 入场费（tCTC，可配，默认 0 便于测试）
    uint256 public entryFee;
    /// 入场铸的积分数量（可配，默认 100）
    uint256 public mintAmount = 100;

    address public owner;

    event FactionCreated(
        uint256 indexed factionId,
        string name,
        uint256 indexed coinId
    );
    event PlayerJoined(uint256 indexed factionId, address indexed player);
    event EntryFeeSet(uint256 fee);
    event MintAmountSet(uint256 amount);
    event GameStarted();
    event GameEnded();

    modifier onlyOwner() {
        require(msg.sender == owner, "FR: not owner");
        _;
    }

    constructor(address _points) {
        owner = msg.sender;
        points = IPoints(_points);
    }

    // ---- 配置 ----

    function setEntryFee(uint256 fee) external onlyOwner {
        entryFee = fee;
        emit EntryFeeSet(fee);
    }

    function setMintAmount(uint256 amount) external onlyOwner {
        mintAmount = amount;
        emit MintAmountSet(amount);
    }

    // ---- Owner：创建阵营（仅比赛开始前）----

    function createFaction(
        string calldata name,
        uint256 coinId
    ) external onlyOwner {
        require(gamePhase == GamePhase.NOT_STARTED, "FR: factions locked");
        require(bytes(name).length > 0, "FR: empty name");
        require(coinId <= COIN_CTC, "FR: bad coin");

        factionCount++;
        factions[factionCount] = Faction({
            id: factionCount,
            name: name,
            coinId: coinId
        });
        emit FactionCreated(factionCount, name, coinId);
    }

    // ---- 成员：交 tCTC 入场费进阵营，铸积分 ----

    function joinFaction(uint256 factionId) external payable {
        require(gamePhase != GamePhase.FINISHED, "FR: game finished");
        require(factionId > 0 && factionId <= factionCount, "FR: bad faction");
        require(playerFaction[msg.sender] == 0, "FR: already in a faction");
        require(msg.value >= entryFee, "FR: insufficient fee");

        playerFaction[msg.sender] = factionId;
        factionMembers[factionId].push(msg.sender);
        if (msg.value > 0) {
            factionTreasury[factionId] += msg.value;
        }

        // 铸该阵营钉币对应的积分（coinId == pointType）
        points.mint(factions[factionId].coinId, msg.sender, mintAmount);

        emit PlayerJoined(factionId, msg.sender);
    }

    // ---- 状态机 ----

    function startGame() external onlyOwner {
        require(gamePhase == GamePhase.NOT_STARTED, "FR: already started");
        gamePhase = GamePhase.ACTIVE;
        emit GameStarted();
    }

    function endGame() external onlyOwner {
        require(gamePhase == GamePhase.ACTIVE, "FR: not active");
        gamePhase = GamePhase.FINISHED;
        emit GameEnded();
    }

    // ---- 只读 ----

    function isActive() external view returns (bool) {
        return gamePhase == GamePhase.ACTIVE;
    }

    function isFinished() external view returns (bool) {
        return gamePhase == GamePhase.FINISHED;
    }

    function factionExists(uint256 factionId) external view returns (bool) {
        return factionId > 0 && factionId <= factionCount;
    }

    function getFactionCoin(uint256 factionId) external view returns (uint256) {
        return factions[factionId].coinId;
    }

    function getFactionMemberCount(
        uint256 factionId
    ) external view returns (uint256) {
        return factionMembers[factionId].length;
    }

    function getFactionMember(
        uint256 factionId,
        uint256 index
    ) external view returns (address) {
        return factionMembers[factionId][index];
    }
}
