// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CrossBank FraudAudit Contract
 * @notice Maintains an immutable, tamper-evident audit ledger for federated fraud detection rounds.
 * Stores model update hashes, coordinator validation decisions, and global model hashes.
 */
contract FraudAudit {
    address public coordinator;

    struct Submission {
        string bankId;
        string weightsHash;
        uint256 sampleCount;
        string decision; // "ACCEPTED" or "REJECTED"
        string reason;
        uint256 timestamp;
    }

    struct RoundAudit {
        uint256 roundId;
        string globalModelHash;
        string defenseStrategy;
        uint256 timestamp;
        bool isFinalized;
        Submission[] submissions;
    }

    // Mapping: roundId => RoundAudit
    mapping(uint256 => RoundAudit) private rounds;
    uint256 public latestRoundId;

    // Events
    event RoundStarted(uint256 indexed roundId, uint256 timestamp);
    event UpdateRecorded(
        uint256 indexed roundId,
        string bankId,
        string weightsHash,
        string decision,
        string reason
    );
    event RoundFinalized(
        uint256 indexed roundId,
        string globalModelHash,
        string defenseStrategy,
        uint256 totalSubmissions,
        uint256 acceptedSubmissions,
        uint256 timestamp
    );

    modifier onlyCoordinator() {
        require(msg.sender == coordinator, "Only coordinator can perform this action");
        _;
    }

    constructor() {
        coordinator = msg.sender;
    }

    /**
     * @notice Records a complete federated training round with all participant submissions and resulting global model.
     */
    function recordRound(
        uint256 _roundId,
        string memory _defenseStrategy,
        string memory _globalModelHash,
        string[] memory _bankIds,
        string[] memory _weightsHashes,
        uint256[] memory _sampleCounts,
        string[] memory _decisions,
        string[] memory _reasons
    ) external onlyCoordinator {
        require(!rounds[_roundId].isFinalized, "Round already finalized");
        require(
            _bankIds.length == _weightsHashes.length &&
            _bankIds.length == _decisions.length &&
            _bankIds.length == _reasons.length,
            "Mismatched array lengths"
        );

        RoundAudit storage r = rounds[_roundId];
        r.roundId = _roundId;
        r.defenseStrategy = _defenseStrategy;
        r.globalModelHash = _globalModelHash;
        r.timestamp = block.timestamp;
        r.isFinalized = true;

        if (_roundId > latestRoundId) {
            latestRoundId = _roundId;
        }

        uint256 acceptedCount = 0;
        for (uint256 i = 0; i < _bankIds.length; i++) {
            r.submissions.push(Submission({
                bankId: _bankIds[i],
                weightsHash: _weightsHashes[i],
                sampleCount: _sampleCounts[i],
                decision: _decisions[i],
                reason: _reasons[i],
                timestamp: block.timestamp
            }));

            if (keccak256(bytes(_decisions[i])) == keccak256(bytes("ACCEPTED"))) {
                acceptedCount++;
            }

            emit UpdateRecorded(
                _roundId,
                _bankIds[i],
                _weightsHashes[i],
                _decisions[i],
                _reasons[i]
            );
        }

        emit RoundFinalized(
            _roundId,
            _globalModelHash,
            _defenseStrategy,
            _bankIds.length,
            acceptedCount,
            block.timestamp
        );
    }

    /**
     * @notice Get summary details of a recorded round.
     */
    function getRoundSummary(uint256 _roundId) external view returns (
        uint256 roundId,
        string memory globalModelHash,
        string memory defenseStrategy,
        uint256 timestamp,
        bool isFinalized,
        uint256 totalSubmissions
    ) {
        RoundAudit storage r = rounds[_roundId];
        require(r.isFinalized, "Round not finalized or not found");
        return (
            r.roundId,
            r.globalModelHash,
            r.defenseStrategy,
            r.timestamp,
            r.isFinalized,
            r.submissions.length
        );
    }

    /**
     * @notice Get a specific submission from a round by index.
     */
    function getRoundSubmission(uint256 _roundId, uint256 index) external view returns (
        string memory bankId,
        string memory weightsHash,
        uint256 sampleCount,
        string memory decision,
        string memory reason,
        uint256 timestamp
    ) {
        RoundAudit storage r = rounds[_roundId];
        require(r.isFinalized, "Round not finalized");
        require(index < r.submissions.length, "Index out of bounds");
        Submission storage s = r.submissions[index];
        return (s.bankId, s.weightsHash, s.sampleCount, s.decision, s.reason, s.timestamp);
    }

    /**
     * @notice Verify if a provided global model hash matches the on-chain recorded hash for that round.
     */
    function verifyGlobalModel(uint256 _roundId, string memory _modelHash) external view returns (bool) {
        RoundAudit storage r = rounds[_roundId];
        if (!r.isFinalized) return false;
        return (keccak256(bytes(r.globalModelHash)) == keccak256(bytes(_modelHash)));
    }
}
