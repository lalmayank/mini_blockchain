// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CrossBank FraudAudit Contract (Multi-Sig Consortium Edition)
 * @notice Maintains an immutable, tamper-evident audit ledger for federated fraud detection rounds.
 * Supports decentralized multi-bank quorum approval (M-of-N consensus), individual bank update submissions,
 * coordinator defense screening records, and on-chain verification.
 */
contract FraudAudit {
    address public coordinator;
    uint256 public requiredApprovals;
    uint256 public latestRoundId;
    string public activeGlobalModelHash;

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
        bool isProposed;
        bool isFinalized;
        uint256 approvalCount;
        uint256 rejectionCount;
        Submission[] submissions;
    }

    // Registered banks: address => bankId ("bank_a", "bank_b", "bank_c")
    mapping(address => string) public registeredBanks;
    mapping(string => address) public bankIdToAddress;

    // Mapping: roundId => RoundAudit
    mapping(uint256 => RoundAudit) private rounds;

    // Mapping: roundId => bankAddress => hasApproved
    mapping(uint256 => mapping(address => bool)) public hasApproved;
    mapping(uint256 => address[]) private roundApprovers;

    // Mapping: roundId => bankAddress => rejectionReason
    mapping(uint256 => mapping(address => string)) public rejectionReasons;
    mapping(uint256 => address[]) private roundRejectors;

    // Events
    event BankRegistered(address indexed bankAddress, string bankId);
    event RoundProposed(uint256 indexed roundId, string globalModelHash, string defenseStrategy, uint256 timestamp);
    event BankUpdateSubmitted(uint256 indexed roundId, address indexed bankAddress, string bankId, string weightsHash);
    event UpdateRecorded(uint256 indexed roundId, string bankId, string weightsHash, string decision, string reason);
    event RoundApproved(uint256 indexed roundId, address indexed bankAddress, string bankId, uint256 currentApprovals);
    event RoundChallenged(uint256 indexed roundId, address indexed bankAddress, string bankId, string reason);
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

    modifier onlyRegisteredBank() {
        require(bytes(registeredBanks[msg.sender]).length > 0, "Only registered consortium bank can perform this action");
        _;
    }

    modifier onlyMember() {
        require(
            msg.sender == coordinator || bytes(registeredBanks[msg.sender]).length > 0,
            "Caller is neither coordinator nor registered bank"
        );
        _;
    }

    constructor(
        address _bankA,
        address _bankB,
        address _bankC,
        uint256 _requiredApprovals
    ) {
        coordinator = msg.sender;
        requiredApprovals = _requiredApprovals > 0 ? _requiredApprovals : 2;

        if (_bankA != address(0)) _registerBankInternal(_bankA, "bank_a");
        if (_bankB != address(0)) _registerBankInternal(_bankB, "bank_b");
        if (_bankC != address(0)) _registerBankInternal(_bankC, "bank_c");
    }

    function _registerBankInternal(address _bank, string memory _bankId) internal {
        registeredBanks[_bank] = _bankId;
        bankIdToAddress[_bankId] = _bank;
        emit BankRegistered(_bank, _bankId);
    }

    /**
     * @notice Register a new bank address or update existing member key.
     */
    function registerBank(address _bank, string memory _bankId) external onlyCoordinator {
        require(_bank != address(0), "Invalid bank address");
        require(bytes(_bankId).length > 0, "Invalid bank id");
        _registerBankInternal(_bank, _bankId);
    }

    /**
     * @notice Individual bank submits its local model weights hash directly to the ledger.
     */
    function submitBankUpdate(
        uint256 _roundId,
        string memory _weightsHash,
        uint256 _sampleCount
    ) external onlyRegisteredBank {
        string memory bankId = registeredBanks[msg.sender];
        emit BankUpdateSubmitted(_roundId, msg.sender, bankId, _weightsHash);
    }

    /**
     * @notice Coordinator proposes a completed federated round for multi-bank approval.
     */
    function proposeRound(
        uint256 _roundId,
        string memory _defenseStrategy,
        string memory _globalModelHash,
        string[] memory _bankIds,
        string[] memory _weightsHashes,
        uint256[] memory _sampleCounts,
        string[] memory _decisions,
        string[] memory _reasons
    ) public onlyCoordinator {
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
        r.isProposed = true;
        r.isFinalized = false;

        if (_roundId > latestRoundId) {
            latestRoundId = _roundId;
        }

        // Clear previous submissions if re-proposed
        delete r.submissions;

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

        emit RoundProposed(_roundId, _globalModelHash, _defenseStrategy, block.timestamp);
    }

    /**
     * @notice Bank member casts its cryptographic on-chain approval for a proposed round.
     * When approval count reaches requiredApprovals, the round is automatically finalized.
     */
    function approveRound(uint256 _roundId) external onlyRegisteredBank {
        RoundAudit storage r = rounds[_roundId];
        require(r.isProposed, "Round not proposed yet");
        require(!r.isFinalized, "Round already finalized");
        require(!hasApproved[_roundId][msg.sender], "Bank already approved this round");

        hasApproved[_roundId][msg.sender] = true;
        roundApprovers[_roundId].push(msg.sender);
        r.approvalCount++;

        string memory bankId = registeredBanks[msg.sender];
        emit RoundApproved(_roundId, msg.sender, bankId, r.approvalCount);

        // Check if consensus threshold reached
        if (r.approvalCount >= requiredApprovals) {
            r.isFinalized = true;
            activeGlobalModelHash = r.globalModelHash;

            uint256 acceptedCount = 0;
            for (uint256 i = 0; i < r.submissions.length; i++) {
                if (keccak256(bytes(r.submissions[i].decision)) == keccak256(bytes("ACCEPTED"))) {
                    acceptedCount++;
                }
            }

            emit RoundFinalized(
                _roundId,
                r.globalModelHash,
                r.defenseStrategy,
                r.submissions.length,
                acceptedCount,
                block.timestamp
            );
        }
    }

    /**
     * @notice Bank member rejects/challenges a proposed round (e.g., if local validation fails).
     */
    function rejectRound(uint256 _roundId, string memory _reason) external onlyRegisteredBank {
        RoundAudit storage r = rounds[_roundId];
        require(r.isProposed, "Round not proposed");
        require(!r.isFinalized, "Round already finalized");

        rejectionReasons[_roundId][msg.sender] = _reason;
        roundRejectors[_roundId].push(msg.sender);
        r.rejectionCount++;

        string memory bankId = registeredBanks[msg.sender];
        emit RoundChallenged(_roundId, msg.sender, bankId, _reason);
    }

    /**
     * @notice Backward-compatible direct record by coordinator (or emergency notarization).
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
        proposeRound(
            _roundId,
            _defenseStrategy,
            _globalModelHash,
            _bankIds,
            _weightsHashes,
            _sampleCounts,
            _decisions,
            _reasons
        );

        RoundAudit storage r = rounds[_roundId];
        r.isFinalized = true;
        activeGlobalModelHash = _globalModelHash;

        uint256 acceptedCount = 0;
        for (uint256 i = 0; i < r.submissions.length; i++) {
            if (keccak256(bytes(r.submissions[i].decision)) == keccak256(bytes("ACCEPTED"))) {
                acceptedCount++;
            }
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
        bool isProposed,
        bool isFinalized,
        uint256 approvalCount,
        uint256 totalSubmissions
    ) {
        RoundAudit storage r = rounds[_roundId];
        return (
            r.roundId,
            r.globalModelHash,
            r.defenseStrategy,
            r.timestamp,
            r.isProposed,
            r.isFinalized,
            r.approvalCount,
            r.submissions.length
        );
    }

    /**
     * @notice Get list of bank addresses that approved this round.
     */
    function getRoundApprovers(uint256 _roundId) external view returns (address[] memory) {
        return roundApprovers[_roundId];
    }

    /**
     * @notice Get list of bank addresses that challenged this round.
     */
    function getRoundRejectors(uint256 _roundId) external view returns (address[] memory) {
        return roundRejectors[_roundId];
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

    /**
     * @notice Check whether an address is registered and return its bankId.
     */
    function isBankRegistered(address _bank) external view returns (bool isRegistered, string memory bankId) {
        string memory id = registeredBanks[_bank];
        return (bytes(id).length > 0, id);
    }
}
