// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TreasuryVault is Ownable {
    mapping(address => uint256) public treasuryBalance;
    address[] public supportedTokens;
    mapping(address => bool) public supportedToken;
    address public executor;

    event Deposit(address indexed from, address indexed token, uint256 amount);
    event Withdraw(address indexed to, address indexed token, uint256 amount);
    event TransferExecuted(address indexed to, address indexed token, uint256 amount);
    event ExecutorUpdated(address indexed executor);

    modifier onlyExecutor() {
        require(msg.sender == executor, "TreasuryVault: caller is not executor");
        _;
    }

    function setExecutor(address executorAddress) external onlyOwner {
        require(executorAddress != address(0), "TreasuryVault: executor is zero address");
        executor = executorAddress;
        emit ExecutorUpdated(executorAddress);
    }

    function deposit(address token, uint256 amount) external {
        require(amount > 0, "TreasuryVault: amount must be greater than zero");
        require(token != address(0), "TreasuryVault: token is zero address");

        if (!supportedToken[token]) {
            supportedToken[token] = true;
            supportedTokens.push(token);
        }

        treasuryBalance[token] += amount;
        bool sent = IERC20(token).transferFrom(msg.sender, address(this), amount);
        require(sent, "TreasuryVault: transferFrom failed");

        emit Deposit(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount, address to) external onlyOwner {
        require(amount > 0, "TreasuryVault: amount must be greater than zero");
        require(to != address(0), "TreasuryVault: recipient is zero address");
        require(treasuryBalance[token] >= amount, "TreasuryVault: insufficient balance");

        treasuryBalance[token] -= amount;
        bool sent = IERC20(token).transfer(to, amount);
        require(sent, "TreasuryVault: transfer failed");

        emit Withdraw(to, token, amount);
    }

    function transfer(address token, uint256 amount, address to) external onlyOwner {
        require(amount > 0, "TreasuryVault: amount must be greater than zero");
        require(to != address(0), "TreasuryVault: recipient is zero address");
        require(treasuryBalance[token] >= amount, "TreasuryVault: insufficient balance");

        treasuryBalance[token] -= amount;
        bool sent = IERC20(token).transfer(to, amount);
        require(sent, "TreasuryVault: transfer failed");

        emit TransferExecuted(to, token, amount);
    }

    function executeTransfer(address token, address to, uint256 amount) external onlyExecutor {
        require(amount > 0, "TreasuryVault: amount must be greater than zero");
        require(to != address(0), "TreasuryVault: recipient is zero address");
        require(treasuryBalance[token] >= amount, "TreasuryVault: insufficient balance");

        treasuryBalance[token] -= amount;
        bool sent = IERC20(token).transfer(to, amount);
        require(sent, "TreasuryVault: transfer failed");

        emit TransferExecuted(to, token, amount);
    }

    function executeBatchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts) external onlyExecutor {
        require(recipients.length == amounts.length, "TreasuryVault: recipients and amounts length mismatch");

        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];
            require(recipient != address(0), "TreasuryVault: recipient is zero address");
            require(amount > 0, "TreasuryVault: amount must be greater than zero");
            require(treasuryBalance[token] >= amount, "TreasuryVault: insufficient balance");

            treasuryBalance[token] -= amount;
            bool success = IERC20(token).transfer(recipient, amount);
            require(success, "TreasuryVault: batch transfer failed");
            emit TransferExecuted(recipient, token, amount);
        }
    }

    function getBalances() external view returns (address[] memory tokens, uint256[] memory balances) {
        tokens = supportedTokens;
        balances = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            balances[i] = treasuryBalance[tokens[i]];
        }
    }
}
