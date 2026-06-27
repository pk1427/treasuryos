// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AttestationRegistry {
    struct Attestation {
        bytes32 reportHash;
        address publisher;
        uint256 timestamp;
    }

    mapping(address => Attestation[]) private attestations;

    event AttestationPublished(address indexed treasury, bytes32 indexed reportHash, address indexed publisher);

    function publishAttestation(address treasury, bytes32 reportHash) external {
        attestations[treasury].push(Attestation({
            reportHash: reportHash,
            publisher: msg.sender,
            timestamp: block.timestamp
        }));

        emit AttestationPublished(treasury, reportHash, msg.sender);
    }

    function attestationCount(address treasury) external view returns (uint256) {
        return attestations[treasury].length;
    }

    function getAttestation(address treasury, uint256 index) external view returns (Attestation memory) {
        return attestations[treasury][index];
    }
}
