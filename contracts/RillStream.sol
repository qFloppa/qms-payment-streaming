// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

/// @notice Native-currency streams with no administrator, fees, or upgradeability.
contract RillStream {
    struct Stream {
        address sender;
        address recipient;
        uint256 deposit;
        uint256 withdrawn;
        uint256 refunded;
        uint64 startTime;
        uint64 endTime;
        uint64 cancelledAt;
    }
    event StreamCreated(uint256 indexed streamId, address indexed sender, address indexed recipient, uint256 deposit, uint64 startTime, uint64 endTime);
    event Withdrawal(uint256 indexed streamId, address indexed recipient, uint256 amount);
    event StreamCancelled(uint256 indexed streamId, address indexed sender, uint256 refund, uint64 cancelledAt);
    error InvalidRecipient();
    error InvalidDeposit();
    error InvalidDuration();
    error InvalidPageLimit();
    error StreamNotFound();
    error Unauthorized();
    error NothingToWithdraw();
    error StreamEnded();
    error TransferFailed();
    error ReentrantCall();

    mapping(uint256 => Stream) private _streams;
    mapping(address => uint256[]) private _walletStreams;
    uint256 private _nextId = 1;
    bool private _entered;

    modifier nonReentrant() {
        if (_entered) revert ReentrantCall();
        _entered = true;
        _;
        _entered = false;
    }

    function createStream(address recipient, uint64 duration) external payable nonReentrant returns (uint256 streamId) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (msg.value == 0) revert InvalidDeposit();
        if (duration < 60 || duration > 365 days || block.timestamp > type(uint64).max - duration) revert InvalidDuration();
        streamId = _nextId++;
        uint64 startTime = uint64(block.timestamp);
        uint64 endTime = startTime + duration;
        _streams[streamId] = Stream(msg.sender, recipient, msg.value, 0, 0, startTime, endTime, 0);
        _walletStreams[msg.sender].push(streamId);
        if (recipient != msg.sender) _walletStreams[recipient].push(streamId);
        emit StreamCreated(streamId, msg.sender, recipient, msg.value, startTime, endTime);
    }

    function getStream(uint256 streamId) external view returns (Stream memory) { return _stream(streamId); }

    function _stream(uint256 streamId) private view returns (Stream storage data) {
        data = _streams[streamId];
        if (data.sender == address(0)) revert StreamNotFound();
    }

    function balances(uint256 streamId) external view returns (uint256 unlocked, uint256 available, uint256 scheduled) {
        Stream storage data = _stream(streamId);
        unlocked = _unlocked(data);
        available = unlocked - data.withdrawn;
        scheduled = data.deposit - unlocked - data.refunded;
    }

    function _unlocked(Stream storage data) private view returns (uint256) {
        uint256 effectiveTime = data.cancelledAt == 0 ? block.timestamp : data.cancelledAt;
        if (effectiveTime >= data.endTime) return data.deposit;
        if (effectiveTime <= data.startTime) return 0;
        uint256 elapsed = effectiveTime - data.startTime;
        uint256 duration = data.endTime - data.startTime;
        // Equivalent to deposit * elapsed / duration without an overflowing product.
        // The first product is <= deposit; the second is < (365 days)^2.
        return (data.deposit / duration) * elapsed + ((data.deposit % duration) * elapsed) / duration;
    }
    function streamCount(address wallet) external view returns (uint256) { return _walletStreams[wallet].length; }

    function streamsFor(address wallet, uint256 cursor, uint256 limit) external view returns (uint256[] memory ids, uint256 nextCursor) {
        if (limit == 0 || limit > 100) revert InvalidPageLimit();
        uint256[] storage all = _walletStreams[wallet];
        if (cursor >= all.length) return (new uint256[](0), all.length);
        uint256 size = all.length - cursor;
        if (size > limit) size = limit;
        ids = new uint256[](size);
        for (uint256 i; i < size; i++) ids[i] = all[cursor + i];
        nextCursor = cursor + size;
    }
    function withdraw(uint256 streamId) external nonReentrant {
        Stream storage data = _stream(streamId);
        if (msg.sender != data.recipient) revert Unauthorized();
        uint256 amount = _unlocked(data) - data.withdrawn;
        if (amount == 0) revert NothingToWithdraw();
        data.withdrawn += amount;
        emit Withdrawal(streamId, data.recipient, amount);
        (bool sent,) = data.recipient.call{value: amount}("");
        if (!sent) revert TransferFailed();
    }

    function cancel(uint256 streamId) external nonReentrant {
        Stream storage data = _stream(streamId);
        if (msg.sender != data.sender) revert Unauthorized();
        if (data.cancelledAt != 0 || block.timestamp >= data.endTime) revert StreamEnded();
        uint256 refund = data.deposit - _unlocked(data);
        data.cancelledAt = uint64(block.timestamp);
        data.refunded = refund;
        emit StreamCancelled(streamId, data.sender, refund, data.cancelledAt);
        (bool sent,) = data.sender.call{value: refund}("");
        if (!sent) revert TransferFailed();
    }
}
