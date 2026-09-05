// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./attestcoin/IUSCProofVerifier.sol";
import "./attestcoin/BlockProverTypes.sol";
import "./attestcoin/EvmV1Decoder.sol";

/// @title PriceFeed
/// @notice Creditcoin 侧的「价格喂价」合约（整个项目的信任根）。
///         通过 Attestcoin 跨链验证 Sepolia PriceSource 发的 PricePublished 事件，
///         把币价可信地搬到 Creditcoin 上存好，供预测/结算合约读取。
contract PriceFeed {
    /// 跨链证明验证器（复用官方 USCProofVerifier）
    IUSCProofVerifier public immutable proofVerifier;

    address public owner;
    mapping(address => bool) public isBackend;

    /// 源链 key（Sepolia = 1，Creditcoin 内部对已公证链的编号，不是 EVM chainId）
    uint64 public immutable sourceChainKey;

    /// PricePublished(uint256,uint256,uint256) 的事件签名（topic0）
    bytes32 public constant PRICE_PUBLISHED_SIG =
        keccak256("PricePublished(uint256,uint256,uint256)");

    struct Price {
        uint256 price;
        uint256 timestamp;
    }

    /// coinId -> 最新价格
    mapping(uint256 => Price) public prices;
    /// coinId -> 价格历史
    mapping(uint256 => Price[]) public priceHistory;

    /// 防重放：每个 (chainKey, blockHeight, txIndex) 只消费一次
    mapping(bytes32 => bool) public processedQueries;

    event PriceUpdated(uint256 indexed coinId, uint256 price, uint256 timestamp);
    event BackendAuthorized(address indexed backend, bool authorized);

    modifier onlyOwner() {
        require(msg.sender == owner, "PF: not owner");
        _;
    }

    modifier onlyBackend() {
        require(isBackend[msg.sender] || msg.sender == owner, "PF: not backend");
        _;
    }

    constructor(address _proofVerifier, uint64 _sourceChainKey) {
        owner = msg.sender;
        proofVerifier = IUSCProofVerifier(_proofVerifier);
        sourceChainKey = _sourceChainKey;
    }

    function setBackend(address backend, bool authorized) external onlyOwner {
        isBackend[backend] = authorized;
        emit BackendAuthorized(backend, authorized);
    }

    /// @notice 验证 Sepolia 价格事件并上链。仅后端 worker 可调。
    /// @return coinId 币种编号；price 价格；timestamp 时间戳
    function updatePrice(
        uint64 blockHeight,
        BlockProverTypes.InclusionProof calldata inclusionProof,
        BlockProverTypes.ContinuityProof calldata continuityProof
    )
        external
        onlyBackend
        returns (uint256 coinId, uint256 price, uint256 timestamp)
    {
        // 1. 防重放：先算 txIndex，同一个源链交易只能消费一次
        uint64 txIndex = proofVerifier.calculateTxIndex(inclusionProof);
        bytes32 queryKey = keccak256(
            abi.encode(sourceChainKey, blockHeight, txIndex)
        );
        require(!processedQueries[queryKey], "PF: replay");
        processedQueries[queryKey] = true;

        // 2. 验证交易确实在已公证的 Sepolia 区块里，返回被证明的交易字节
        bytes memory encodedTransaction = proofVerifier.verifyProofs(
            bytes32(uint256(sourceChainKey)),
            blockHeight,
            inclusionProof,
            continuityProof
        );

        // 3. 解码 receipt，确认交易成功（precompile 不校验 status）
        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder
            .decodeReceiptFields(encodedTransaction);
        require(receipt.receiptStatus == 0x1, "PF: tx failed");

        // 4. 过滤出 PricePublished 事件
        EvmV1Decoder.LogEntry[] memory logs = EvmV1Decoder
            .getLogsByEventSignature(receipt, PRICE_PUBLISHED_SIG);
        require(logs.length == 1, "PF: price event not found");

        // 5. 解码事件数据 (coinId, price, timestamp)
        (coinId, price, timestamp) = abi.decode(
            logs[0].data,
            (uint256, uint256, uint256)
        );

        // 6. 存最新价 + 历史
        prices[coinId] = Price({ price: price, timestamp: timestamp });
        priceHistory[coinId].push(Price({ price: price, timestamp: timestamp }));

        emit PriceUpdated(coinId, price, timestamp);
    }

    // ---- 只读查询 ----

    function getPrice(
        uint256 _coinId
    ) external view returns (uint256 price, uint256 timestamp) {
        Price memory p = prices[_coinId];
        return (p.price, p.timestamp);
    }

    function getPriceAt(
        uint256 _coinId,
        uint256 index
    ) external view returns (uint256 price, uint256 timestamp) {
        Price memory p = priceHistory[_coinId][index];
        return (p.price, p.timestamp);
    }

    function getPriceHistoryCount(
        uint256 _coinId
    ) external view returns (uint256) {
        return priceHistory[_coinId].length;
    }
}
