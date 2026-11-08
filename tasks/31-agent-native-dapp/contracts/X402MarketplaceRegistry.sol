// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IX402PaywallReceipt.sol";

interface IERC20Token {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title X402MarketplaceRegistry
 * @notice On-chain settlement and curation engine for the Pharos x402 Intelligence Mesh.
 * Facilitates sub-cent micro-payments (e.g. 0.001 USDC) between autonomous AI agents
 * and curated data publishers on Pharos Mainnet.
 *
 * Security Architecture:
 * 1. Strict Whitelisting: feeds only become Active once approved by designated curator (wakanda-soul).
 * 2. Mutation Lockdown: altering endpoint path or payload schema automatically resets status to PendingAudit.
 * 3. EIP-712 Cryptographic Pre-Authorization: prevents front-running and replay attacks.
 */
contract X402MarketplaceRegistry is IX402PaywallReceipt {
    // Official Pharos Mainnet native USDC address (6 decimals)
    address public constant PHAROS_USDC = 0xc879c018db60520f4355c26ed1a6d572cdac1815;

    // Default base fee: 0.001 USDC = 1,000 micro-units (6 decimals)
    uint256 public constant DEFAULT_FEED_PRICE = 1000;

    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant PAYMENT_TYPEHASH = keccak256(
        "PaymentAuthorization(bytes32 feedId,address publisher,uint256 paymentAmount,bytes32 queryHash,uint256 nonce,uint256 deadline)"
    );

    address public curator;
    mapping(bytes32 => IntelligenceFeed) public feeds;
    bytes32[] public feedIndex;

    // Track buyer agent nonces to eliminate transaction replay
    mapping(address => mapping(uint256 => bool)) public executedNonces;

    modifier onlyCurator() {
        require(msg.sender == curator, "X402: caller is not designated curator");
        _;
    }

    modifier onlyPublisher(bytes32 feedId) {
        require(feeds[feedId].publisher == msg.sender, "X402: caller does not own this feed");
        _;
    }

    constructor(address initialCurator) {
        require(initialCurator != address(0), "X402: invalid curator address");
        curator = initialCurator;

        uint256 chainId;
        assembly {
            chainId := chainid()
        }

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Pharos-x402-Intelligence-Mesh")),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }

    /**
     * @notice Registers a fresh intelligence endpoint. New feeds always begin in PendingAudit.
     * @param feedId Unique identifier for the feed (e.g. keccak256("pharos.whale-radar"))
     * @param pricePerCall Micro-unit price (minimum 100 = 0.0001 USDC, default 1,000 = 0.001 USDC)
     * @param endpointPath Relative API route or verified URI
     * @param schemaHash SHA-256 fingerprint of the expected payload response schema
     */
    function registerFeed(
        bytes32 feedId,
        uint256 pricePerCall,
        string calldata endpointPath,
        string calldata schemaHash
    ) external returns (bytes32) {
        require(feeds[feedId].publisher == address(0), "X402: feed ID already registered");
        require(pricePerCall >= 100, "X402: price too low (< 0.0001 USDC)");

        // Note: New endpoints never bypass audit. This strictly stops rogue actors from slipping scam feeds in.
        feeds[feedId] = IntelligenceFeed({
            feedId: feedId,
            publisher: msg.sender,
            pricePerCall: pricePerCall,
            endpointPath: endpointPath,
            schemaHash: schemaHash,
            status: FeedStatus.PendingAudit,
            totalPurchases: 0,
            grossRevenue: 0
        });

        feedIndex.push(feedId);
        emit FeedRegistered(feedId, msg.sender, pricePerCall, endpointPath);
        return feedId;
    }

    /**
     * @notice Updates price for an active feed. Does not invalidate curation status.
     */
    function updateFeedPrice(bytes32 feedId, uint256 newPrice) external onlyPublisher(feedId) {
        require(newPrice >= 100, "X402: price too low");
        uint256 previous = feeds[feedId].pricePerCall;
        feeds[feedId].pricePerCall = newPrice;
        emit FeedPriceUpdated(feedId, previous, newPrice);
    }

    /**
     * @notice Mutates endpoint route or schema. Automatically resets status to PendingAudit to prevent bait-and-switch.
     */
    function mutateFeedEndpoint(
        bytes32 feedId,
        string calldata newEndpointPath,
        string calldata newSchemaHash
    ) external onlyPublisher(feedId) {
        // Crucial defense: If publisher changes code, audit is revoked immediately
        feeds[feedId].endpointPath = newEndpointPath;
        feeds[feedId].schemaHash = newSchemaHash;
        feeds[feedId].status = FeedStatus.PendingAudit;

        emit FeedCurated(feedId, FeedStatus.PendingAudit, curator);
    }

    /**
     * @notice Curator approval or suspension of an endpoint.
     */
    function curateFeed(bytes32 feedId, FeedStatus newStatus) external onlyCurator {
        require(feeds[feedId].publisher != address(0), "X402: nonexistent feed");
        feeds[feedId].status = newStatus;
        emit FeedCurated(feedId, newStatus, msg.sender);
    }

    /**
     * @notice Transfers curation administration (e.g. to multi-sig or governance contract).
     */
    function transferCuratorship(address newCurator) external onlyCurator {
        require(newCurator != address(0), "X402: zero address curator");
        curator = newCurator;
    }

    /**
     * @notice Settles atomic micro-payment from buyer agent to publisher using an EIP-712 pre-authorization ticket.
     */
    function settlePayment(
        bytes32 feedId,
        address publisher,
        uint256 paymentAmount,
        bytes32 queryHash,
        uint256 nonce,
        bytes calldata authorizationSignature
    ) external override returns (bytes32 receiptId) {
        IntelligenceFeed storage targetFeed = feeds[feedId];
        require(targetFeed.status == FeedStatus.Active, "X402: feed is not whitelisted/active");
        require(targetFeed.publisher == publisher, "X402: publisher mismatch");
        require(paymentAmount >= targetFeed.pricePerCall, "X402: insufficient payment for feed");

        // Verify signature and recover buyer agent address
        bytes32 structHash = keccak256(
            abi.encode(
                PAYMENT_TYPEHASH,
                feedId,
                publisher,
                paymentAmount,
                queryHash,
                nonce,
                block.timestamp + 1 hours
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address buyerAgent = recoverSigner(digest, authorizationSignature);

        require(buyerAgent != address(0), "X402: invalid buyer signature");
        require(!executedNonces[buyerAgent][nonce], "X402: nonce already consumed");
        executedNonces[buyerAgent][nonce] = true;

        // Perform atomic USDC transfer from buyer embedded wallet to publisher
        bool success = IERC20Token(PHAROS_USDC).transferFrom(buyerAgent, publisher, paymentAmount);
        require(success, "X402: USDC payment transfer failed");

        targetFeed.totalPurchases += 1;
        targetFeed.grossRevenue += paymentAmount;

        receiptId = keccak256(abi.encodePacked(feedId, buyerAgent, publisher, paymentAmount, nonce, block.timestamp));
        emit PaymentSettled(feedId, buyerAgent, publisher, paymentAmount, queryHash, nonce);
        return receiptId;
    }

    function getFeed(bytes32 feedId) external view override returns (IntelligenceFeed memory) {
        return feeds[feedId];
    }

    function totalFeedsCount() external view returns (uint256) {
        return feedIndex.length;
    }

    function recoverSigner(bytes32 digest, bytes memory sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(digest, v, r, s);
    }
}
