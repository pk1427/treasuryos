import "dotenv/config";
import fs from "fs";

const KEEPERHUB_API_URL = process.env.KEEPERHUB_API_URL ?? "https://app.keeperhub.com";
const KEEPERHUB_API_KEY = process.env.KEEPERHUB_API_KEY;

if (!KEEPERHUB_API_KEY) {
  console.error("Missing KEEPERHUB_API_KEY");
  process.exit(1);
}

const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const RECIPIENT = "0xa568860f02DEf6CC6420F6721B774aa3a71c71d9";
const AMOUNT = "260000000"; // 260 USDC (6 decimals)
const CHAIN_ID = 11155111; // Sepolia

const actionPlan = {
  contractAddress: USDC,
  chainId: CHAIN_ID,
  functionName: "transfer",
  functionArgs: JSON.stringify([RECIPIENT, AMOUNT]),
  abi: JSON.stringify([
    {
      name: "transfer",
      type: "function",
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ name: "", type: "bool" }],
      stateMutability: "nonpayable",
    },
  ]),
  simulate: false,
  value: "0",
};

async function main() {
  console.log("[usdc-transfer] Request:", JSON.stringify({
    endpoint: "/api/execute/contract-call",
    body: actionPlan,
  }, null, 2));

  const res = await fetch(`${KEEPERHUB_API_URL}/api/execute/contract-call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEEPERHUB_API_KEY}`,
    },
    body: JSON.stringify(actionPlan),
  });

  const data = await res.json().catch(() => ({}));
  console.log("[usdc-transfer] Response:", JSON.stringify({
    status: res.status,
    data,
  }, null, 2));

  if (!res.ok) {
    console.error("Transaction failed:", data);
    process.exit(1);
  }

  const txHash = data.transactionHash || data.txHash;
  if (txHash) {
    console.log(`\nTransaction sent: https://sepolia.etherscan.io/tx/${txHash}`);
  }

  fs.rmSync(__filename, { recursive: true, force: true });
  console.log("[usdc-transfer] Temp file deleted");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
