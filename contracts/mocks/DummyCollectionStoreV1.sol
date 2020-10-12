// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../markets/v1/CollectionStoreV1.sol";

interface EventsInterface {
    event Issue(address indexed _beneficiary, uint256 indexed _tokenId, bytes32 indexed _wearableIdKey, string _wearableId, uint256 _issuedId);
    event Transfer(address indexed _from, address indexed _to, uint256 value);
}

contract DummyCollectionStoreV1 is CollectionStoreV1, EventsInterface {

    constructor(
        IERC20 _acceptedToken,
        address[] memory _collectionAddresses,
        address[] memory _collectionBeneficiaries,
        uint256[][] memory _collectionOptionIds,
        uint256[][] memory _collectionAvailableQtys,
        uint256[][] memory _collectionPrices
    )  CollectionStoreV1 (
        _acceptedToken,
        _collectionAddresses,
        _collectionBeneficiaries,
        _collectionOptionIds,
        _collectionAvailableQtys,
        _collectionPrices
    ) public {}
}