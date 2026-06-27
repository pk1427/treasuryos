import { expect } from "chai";
import { ethers } from "hardhat";

describe("TreasuryExecutor", function () {
  it("should only allow vault to execute transfers", async function () {
    const [owner, user, recipient] = await ethers.getSigners();
    const token = await ethers.deployContract("contracts/test/MockERC20.sol:MockERC20", ["Test USDC", "TUSDC", 6]);
    await token.waitForDeployment();

    const vault = await ethers.deployContract("TreasuryVault");
    await vault.waitForDeployment();

    const executor = await ethers.deployContract("TreasuryExecutor");
    await executor.waitForDeployment();

    await executor.connect(owner).setVault(vault.target);
    await vault.connect(owner).setExecutor(executor.target);

    await token.mint(user.address, ethers.parseUnits("1000", 6));
    await token.connect(user).approve(vault.target, ethers.parseUnits("500", 6));
    await vault.connect(user).deposit(token.target, ethers.parseUnits("500", 6));

    await executor.connect(owner).executeTransfer(token.target, recipient.address, ethers.parseUnits("200", 6));
    expect(await token.balanceOf(recipient.address)).to.equal(ethers.parseUnits("200", 6));

    const [tokens, balances] = await vault.getBalances();
    expect(tokens[0]).to.equal(token.target);
    expect(balances[0]).to.equal(ethers.parseUnits("300", 6));
  });
});
