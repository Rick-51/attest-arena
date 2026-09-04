// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FactionRegistry
/// @notice 身份底座：管理阵营、团队、玩家地址映射，以及比赛生命周期状态机。
///         积分不在此存储（由 ScoreAttester 唯一管理），避免双份数据不一致。
contract FactionRegistry {
    // ---- 状态机 ----
    enum GamePhase { NOT_STARTED, ACTIVE, FINISHED }
    GamePhase public gamePhase = GamePhase.NOT_STARTED;

    // ---- 数据结构 ----
    struct Faction {
        uint256 id;
        string name;
    }

    struct Team {
        uint256 id;
        string name;
        uint256 factionId; // 所属阵营
        address leader;
        address[] members; // 含 leader
    }

    // ---- 存储 ----
    mapping(uint256 => Faction) public factions;
    mapping(uint256 => Team) public teams;
    mapping(address => uint256) public playerTeam; // 地址 -> 团队ID（0 = 未加入）

    uint256 public factionCount;
    uint256 public teamCount;

    address public owner;

    // ---- 事件 ----
    event FactionCreated(uint256 indexed factionId, string name);
    event TeamCreated(uint256 indexed teamId, string name, uint256 indexed factionId, address indexed leader);
    event PlayerJoined(uint256 indexed teamId, address indexed player);
    event GameStarted();
    event GameEnded();

    // ---- 修饰器 ----
    modifier onlyOwner() {
        require(msg.sender == owner, "FR: not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ---- Owner：创建阵营（仅比赛开始前）----
    function createFaction(string calldata name) external onlyOwner {
        require(gamePhase == GamePhase.NOT_STARTED, "FR: factions locked");
        require(bytes(name).length > 0, "FR: empty name");
        factionCount++;
        factions[factionCount] = Faction({ id: factionCount, name: name });
        emit FactionCreated(factionCount, name);
    }

    // ---- 玩家：创建团队并自动加入 ----
    function createTeam(string calldata name, uint256 factionId) external returns (uint256 teamId) {
        require(gamePhase != GamePhase.FINISHED, "FR: game finished");
        require(bytes(name).length > 0, "FR: empty name");
        require(factionId > 0 && factionId <= factionCount, "FR: bad faction");
        require(playerTeam[msg.sender] == 0, "FR: already in a team");

        teamCount++;
        teams[teamCount] = Team({
            id: teamCount,
            name: name,
            factionId: factionId,
            leader: msg.sender,
            members: new address[](1)
        });
        teams[teamCount].members[0] = msg.sender;
        playerTeam[msg.sender] = teamCount;

        emit TeamCreated(teamCount, name, factionId, msg.sender);
        return teamCount;
    }

    // ---- 玩家：加入已有团队 ----
    function joinTeam(uint256 teamId) external {
        require(gamePhase != GamePhase.FINISHED, "FR: game finished");
        require(playerTeam[msg.sender] == 0, "FR: already in a team");
        require(teamId > 0 && teamId <= teamCount, "FR: bad team");

        teams[teamId].members.push(msg.sender);
        playerTeam[msg.sender] = teamId;

        emit PlayerJoined(teamId, msg.sender);
    }

    // ---- Owner：开启 / 结束比赛 ----
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

    // ---- 只读查询（供其它合约 / 前端）----
    function isActive() external view returns (bool) {
        return gamePhase == GamePhase.ACTIVE;
    }

    function isFinished() external view returns (bool) {
        return gamePhase == GamePhase.FINISHED;
    }

    function teamExists(uint256 teamId) external view returns (bool) {
        return teamId > 0 && teamId <= teamCount;
    }

    function getTeamFaction(uint256 teamId) external view returns (uint256) {
        require(teamId > 0 && teamId <= teamCount, "FR: bad team");
        return teams[teamId].factionId;
    }

    function getTeamLeader(uint256 teamId) external view returns (address) {
        require(teamId > 0 && teamId <= teamCount, "FR: bad team");
        return teams[teamId].leader;
    }

    function getTeamMemberCount(uint256 teamId) external view returns (uint256) {
        return teams[teamId].members.length;
    }
}
