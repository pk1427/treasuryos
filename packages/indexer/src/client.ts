import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

const RPC_TIMEOUT_MS = 5_000;

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL, {
    retryCount: 1,
    timeout: RPC_TIMEOUT_MS,
  }),
});
