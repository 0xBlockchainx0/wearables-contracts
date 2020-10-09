// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MinimalProxyFactory is Ownable {
    using Address for address;

    address public immutable implementation;
    bytes public code;
    bytes32 public codeHash;

    event ProxyCreated(address indexed _address, bytes32 _salt);

    constructor(address _implementation) public {
        require(
            _implementation != address(0) && _implementation.isContract(),
            "MinimalProxyFactoryV2#_setImplementation: INVALID_IMPLEMENTATION"
        );
        // Adapted from https://github.com/optionality/clone-factory/blob/32782f82dfc5a00d103a7e61a17a5dedbd1e8e9d/contracts/CloneFactory.sol
        code = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            _implementation,
            hex"5af43d82803e903d91602b57fd5bf3"
        );
        codeHash = keccak256(code);
        implementation = _implementation;
    }

    function createProxy(bytes32 _salt, bytes memory _data) public virtual returns (address addr) {
        bytes memory slotcode = code;
        bytes32 salt = keccak256(abi.encodePacked(_salt, msg.sender));

        // solium-disable-next-line security/no-inline-assembly
        assembly {
            addr := create2(0, add(slotcode, 0x20), mload(slotcode), salt)
        }
        require(addr != address(0), "MinimalProxyFactory#createProxy: CREATION_FAILED");

        emit ProxyCreated(addr, _salt);

        if (_data.length > 0) {
            (bool success,) = addr.call(_data);
            require(success, "MinimalProxyFactory#createProxy: CALL_FAILED");
        }
    }

    /**
    * @dev Get a deterministics collection.
    */
    function getAddress(bytes32 _salt, address _address) public view returns (address) {
        return _getAddress(keccak256(abi.encodePacked(_salt, _address)));
    }

    function _getAddress(bytes32 _salt) internal view returns (address) {
        return address(
            uint256(
                keccak256(
                    abi.encodePacked(
                        byte(0xff),
                        address(this),
                        _salt,
                        codeHash
                    )
                )
            )
        );
    }
}