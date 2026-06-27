import { expect } from "chai";
import { ethers } from "hardhat";

describe("AttestationRegistry", function () {
  async function deployRegistry() {
    const [publisher, otherPublisher, treasury, secondTreasury] =
      await ethers.getSigners();
    const registry = await ethers.deployContract("AttestationRegistry");
    await registry.waitForDeployment();

    return {
      registry,
      publisher,
      otherPublisher,
      treasury,
      secondTreasury,
    };
  }

  it("stores the report hash, publisher, and block timestamp", async function () {
    const { registry, publisher, treasury } = await deployRegistry();
    const reportHash = ethers.id("treasury-report-1");

    const tx = await registry.publishAttestation(treasury.address, reportHash);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);

    const attestation = await registry.getAttestation(treasury.address, 0);
    expect(attestation.reportHash).to.equal(reportHash);
    expect(attestation.publisher).to.equal(publisher.address);
    expect(attestation.timestamp).to.equal(block!.timestamp);
  });

  it("emits AttestationPublished with indexed treasury, report hash, and publisher", async function () {
    const { registry, publisher, treasury } = await deployRegistry();
    const reportHash = ethers.id("treasury-report-2");

    await expect(registry.publishAttestation(treasury.address, reportHash))
      .to.emit(registry, "AttestationPublished")
      .withArgs(treasury.address, reportHash, publisher.address);
  });

  it("returns zero attestations before publishing and increments after each publish", async function () {
    const { registry, treasury } = await deployRegistry();

    expect(await registry.attestationCount(treasury.address)).to.equal(0);

    await registry.publishAttestation(treasury.address, ethers.id("first"));
    expect(await registry.attestationCount(treasury.address)).to.equal(1);

    await registry.publishAttestation(treasury.address, ethers.id("second"));
    expect(await registry.attestationCount(treasury.address)).to.equal(2);
  });

  it("returns the correct attestation struct for a given index", async function () {
    const { registry, publisher, treasury } = await deployRegistry();
    const reportHash = ethers.id("indexed-report");

    const tx = await registry.publishAttestation(treasury.address, reportHash);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);

    const attestation = await registry.getAttestation(treasury.address, 0);
    expect(attestation.reportHash).to.equal(reportHash);
    expect(attestation.publisher).to.equal(publisher.address);
    expect(attestation.timestamp).to.equal(block!.timestamp);
  });

  it("stores multiple attestations for the same treasury in order", async function () {
    const { registry, publisher, treasury } = await deployRegistry();
    const firstHash = ethers.id("ordered-report-1");
    const secondHash = ethers.id("ordered-report-2");

    await registry.publishAttestation(treasury.address, firstHash);
    await registry.publishAttestation(treasury.address, secondHash);

    const first = await registry.getAttestation(treasury.address, 0);
    const second = await registry.getAttestation(treasury.address, 1);

    expect(first.reportHash).to.equal(firstHash);
    expect(first.publisher).to.equal(publisher.address);
    expect(second.reportHash).to.equal(secondHash);
    expect(second.publisher).to.equal(publisher.address);
  });

  it("keeps attestation lists independent between treasury addresses", async function () {
    const { registry, treasury, secondTreasury } = await deployRegistry();
    const firstTreasuryHash = ethers.id("first-treasury-report");
    const secondTreasuryHash = ethers.id("second-treasury-report");

    await registry.publishAttestation(treasury.address, firstTreasuryHash);
    await registry.publishAttestation(secondTreasury.address, secondTreasuryHash);

    expect(await registry.attestationCount(treasury.address)).to.equal(1);
    expect(await registry.attestationCount(secondTreasury.address)).to.equal(1);

    const first = await registry.getAttestation(treasury.address, 0);
    const second = await registry.getAttestation(secondTreasury.address, 0);

    expect(first.reportHash).to.equal(firstTreasuryHash);
    expect(second.reportHash).to.equal(secondTreasuryHash);
  });

  it("allows any address to publish an attestation", async function () {
    const { registry, otherPublisher, treasury } = await deployRegistry();
    const reportHash = ethers.id("permissionless-report");

    await registry
      .connect(otherPublisher)
      .publishAttestation(treasury.address, reportHash);

    const attestation = await registry.getAttestation(treasury.address, 0);
    expect(attestation.reportHash).to.equal(reportHash);
    expect(attestation.publisher).to.equal(otherPublisher.address);
  });

  it("reverts with Solidity's default array bounds panic for an out-of-bounds index", async function () {
    const { registry, treasury } = await deployRegistry();

    await expect(registry.getAttestation(treasury.address, 0)).to.be
      .revertedWithPanic(0x32);
  });

  it("accepts and stores bytes32(0) as a report hash", async function () {
    const { registry, treasury } = await deployRegistry();
    const zeroHash = ethers.ZeroHash;

    await registry.publishAttestation(treasury.address, zeroHash);

    const attestation = await registry.getAttestation(treasury.address, 0);
    expect(attestation.reportHash).to.equal(zeroHash);
  });

  it("accepts and stores attestations for address(0)", async function () {
    const { registry, publisher } = await deployRegistry();
    const reportHash = ethers.id("zero-address-treasury");

    await registry.publishAttestation(ethers.ZeroAddress, reportHash);

    expect(await registry.attestationCount(ethers.ZeroAddress)).to.equal(1);
    const attestation = await registry.getAttestation(ethers.ZeroAddress, 0);
    expect(attestation.reportHash).to.equal(reportHash);
    expect(attestation.publisher).to.equal(publisher.address);
  });

  it("reports the approximate gas cost for a single publishAttestation call", async function () {
    const { registry, treasury } = await deployRegistry();

    const tx = await registry.publishAttestation(
      treasury.address,
      ethers.id("gas-report")
    );
    const receipt = await tx.wait();

    console.log(
      `publishAttestation gas used: ${receipt!.gasUsed.toString()} gas`
    );
    expect(receipt!.gasUsed).to.be.greaterThan(0);
  });
});
