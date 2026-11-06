// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IX402PaywallReceipt
 * @notice Standard interface for on-chain x402 payment settlement and receipt verification.
 * Emitted when an autonomous agent or user purchases paywalled intelligence on Pharos Mainnet.
 */
interface IX402PaywallReceipt {
    enum FeedStatus {
        PendingAudit,
        Active,
        Suspended,
        Revoked
    }

    struct IntelligenceFeed {
        bytes32 feedId;
        address publisher;
        uint256 pricePerCall; // In USDC atomic units (e.g. 1,000 = 0.001 USDC with 6 decimals)
        string endpointPath;
        string schemaHash;
        FeedStatus status;
        uint256 totalPurchases;
        uint256 grossRevenue;
    }

    event FeedRegistered(bytes32 indexed feedId, address indexed publisher, uint256 pricePerCall, string endpointPath);
    event FeedCurated(bytes32 indexed feedId, FeedStatus newStatus, address indexed curator);
    event FeedPriceUpdated(bytes32 indexed feedId, uint256 previousPrice, uint256 newPrice);
    event PaymentSettled(
        bytes32 indexed feedId,
        address indexed buyerAgent,
        address indexed publisher,
        uint256 paymentAmount,
        bytes32 queryHash,
        uint256 nonce
    );

    function settlePayment(
        bytes32 feedId,
        address publisher,
        uint256 paymentAmount,
        bytes32 queryHash,
        uint256 nonce,
        bytes calldata authorizationSignature
    ) external returns (bytes32 receiptId);

    function getFeed(bytes32 feedId) external view returns (IntelligenceFeed memory);
}
