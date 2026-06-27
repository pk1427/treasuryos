// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITreasuryVault {
    function executeTransfer(address token, address to, uint256 amount) external;
    function executeBatchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts) external;
}

contract TreasuryExecutor is Ownable {
    event ExecutionRequested(address indexed requestedBy, address indexed token, address indexed to, uint256 amount);
    event ExecutionCompleted(address indexed executor, address indexed token, address indexed to, uint256 amount);

    address public vault;

    function setVault(address vaultAddress) external onlyOwner {
        require(vaultAddress != address(0), "TreasuryExecutor: vault is zero address");
        vault = vaultAddress;
    }

    function executeTransfer(address token, address to, uint256 amount) external onlyOwner {
        require(vault != address(0), "TreasuryExecutor: vault not configured");
        require(to != address(0), "TreasuryExecutor: recipient is zero address");
        require(amount > 0, "TreasuryExecutor: amount must be greater than zero");

        emit ExecutionRequested(msg.sender, token, to, amount);
        ITreasuryVault(vault).executeTransfer(token, to, amount);
        emit ExecutionCompleted(msg.sender, token, to, amount);
    }

    function executeBatchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(vault != address(0), "TreasuryExecutor: vault not configured");
        require(recipients.length == amounts.length, "TreasuryExecutor: recipients and amounts length mismatch");

        emit ExecutionRequested(msg.sender, token, address(0), 0);
        ITreasuryVault(vault).executeBatchTransfer(token, recipients, amounts);
        emit ExecutionCompleted(msg.sender, token, address(0), 0);
    }
}
