import { artifacts, ethers, network, run } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();

  if (!deployer) {
    throw new Error("No deployer signer configured.");
  }

  console.log("Deploying AttestationRegistry with account:", deployer.address);
  console.log("Network:", network.name);

  const registry = await ethers.deployContract("AttestationRegistry");
  const deploymentTx = registry.deploymentTransaction();
  await deploymentTx?.wait();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  const artifact = await artifacts.readArtifact("AttestationRegistry");
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  console.log("");
  console.log("AttestationRegistry deployed:");
  console.log(`ATTESTATION_REGISTRY_ADDRESS=${address}`);
  console.log(`Deployment transaction: ${deploymentTx?.hash ?? "unknown"}`);

  const deployment = {
    contractName: "AttestationRegistry",
    address,
    network: network.name,
    chainId,
    transactionHash: deploymentTx?.hash ?? null,
    abi: artifact.abi,
  };

  const deploymentsDir = path.resolve(__dirname, "../deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });

  const deploymentFile =
    network.name === "baseSepolia" ? "base-sepolia.json" : `${network.name}.json`;
  const outPath = path.join(deploymentsDir, deploymentFile);
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`Saved deployment artifact to ${outPath}`);

  if (network.name === "baseSepolia") {
    if (!process.env.BASESCAN_API_KEY) {
      throw new Error(
        "BASESCAN_API_KEY is required to verify AttestationRegistry on Base Sepolia."
      );
    }

    console.log("Verifying AttestationRegistry on Basescan...");
    await run("verify:verify", {
      address,
      constructorArguments: [],
    });
    console.log("Basescan verification completed.");
  } else {
    console.log("Skipping Basescan verification for local network.");
  }

  console.log("");
  console.log(
    "KeeperHub note: packages/attestation currently passes the ABI explicitly in the contract-call request."
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
