
import "dotenv/config";
import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
      },
    ],
  },

  networks: {
    hardhat: {},

    sepolia: {
      url:
        process.env.SEPOLIA_RPC_URL ||
        "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },

    // Uncomment later if you want Base again
    // baseSepolia: {
    //   url:
    //     process.env.BASE_SEPOLIA_RPC_URL ||
    //     "https://base-sepolia.publicnode.com",
    //   accounts: process.env.DEPLOYER_PRIVATE_KEY
    //     ? [process.env.DEPLOYER_PRIVATE_KEY]
    //     : [],
    // },
  },

  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
    },

    customChains: [
      // Uncomment later if you want Base again
      // {
      //   network: "baseSepolia",
      //   chainId: 84532,
      //   urls: {
      //     apiURL: "https://api-sepolia.basescan.org/api",
      //     browserURL: "https://sepolia.basescan.org",
      //   },
      // },
    ],
  },

  gasReporter: {
    enabled: true,
    currency: "USD",
    showTimeSpent: true,
  },
};

export default config;