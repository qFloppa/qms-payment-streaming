// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

interface IRillStream {
    function createStream(address recipient, uint64 duration) external payable returns (uint256);
    function withdraw(uint256 streamId) external;
    function cancel(uint256 streamId) external;
}

contract RejectingReceiver {
    bool public reject = true;

    function setReject(bool value) external { reject = value; }
    function open(address target, address recipient, uint64 duration) external payable {
        IRillStream(target).createStream{value: msg.value}(recipient, duration);
    }
    function claim(address target, uint256 id) external { IRillStream(target).withdraw(id); }
    function close(address target, uint256 id) external { IRillStream(target).cancel(id); }

    receive() external payable { require(!reject, "receiver rejected transfer"); }
}

contract ReentrantReceiver {
    IRillStream public target;
    uint256 public streamId;
    uint256 public callbacks;
    bool public withdrawReentered;
    bool public cancelReentered;
    bool public createReentered;

    function open(address contractAddress) external payable {
        target = IRillStream(contractAddress);
        streamId = target.createStream{value: msg.value}(address(this), 60);
    }
    function claim() external { target.withdraw(streamId); }
    function close() external { target.cancel(streamId); }

    receive() external payable {
        callbacks++;
        // Keep the attack bounded if the guard is removed so tests expose it.
        if (callbacks > 4) return;
        (bool withdrew,) = address(target).call(abi.encodeCall(IRillStream.withdraw, (streamId)));
        (bool cancelled,) = address(target).call(abi.encodeCall(IRillStream.cancel, (streamId)));
        (bool created,) = address(target).call{value: 1}(abi.encodeCall(IRillStream.createStream, (address(this), uint64(60))));
        withdrawReentered = withdrawReentered || withdrew;
        cancelReentered = cancelReentered || cancelled;
        createReentered = createReentered || created;
    }
}
