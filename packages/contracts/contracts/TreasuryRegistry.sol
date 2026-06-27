// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TreasuryRegistry {
    struct TreasuryInfo {
        string protocolName;
        address treasuryAddress;
        uint256 chainId;
    }

    mapping(address => TreasuryInfo) private registry;
    address[] public treasuryList;

    event TreasuryRegistered(string indexed protocolName, address indexed treasuryAddress, uint256 indexed chainId);

    function registerTreasury(string calldata protocolName, address treasuryAddress, uint256 chainId) external {
        require(bytes(protocolName).length > 0, "TreasuryRegistry: protocolName must not be empty");
        require(treasuryAddress != address(0), "TreasuryRegistry: treasury address is zero");
        require(registry[treasuryAddress].treasuryAddress == address(0), "TreasuryRegistry: treasury already registered");

        registry[treasuryAddress] = TreasuryInfo({
            protocolName: protocolName,
            treasuryAddress: treasuryAddress,
            chainId: chainId
        });

        treasuryList.push(treasuryAddress);
        emit TreasuryRegistered(protocolName, treasuryAddress, chainId);
    }

    function getTreasury(address treasuryAddress) external view returns (TreasuryInfo memory) {
        require(registry[treasuryAddress].treasuryAddress != address(0), "TreasuryRegistry: treasury not found");
        return registry[treasuryAddress];
    }
}
