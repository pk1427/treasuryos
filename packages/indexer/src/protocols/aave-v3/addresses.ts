import { getAddress, type Address } from "viem";

export type AaveV3Reserve = {
  symbol: string;
  decimals: number;
  underlying: Address;
  aToken: Address;
  variableDebtToken: Address;
};

export const AAVE_V3 = {
  sepolia: {
    poolAddressesProvider: checksum(
      "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A"
    ),
    pool: checksum("0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951"),
    protocolDataProvider: checksum(
      "0x3e9708d80f7B3e43118013075F7e95CE3AB31F31"
    ),
    reserves: [
      {
        symbol: "DAI",
        decimals: 18,
        underlying: checksum("0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357"),
        aToken: checksum("0x29598b72eb5CeBd806C5dCD549490FdA35B13cD8"),
        variableDebtToken: checksum(
          "0x22675C506A8FC26447aFFfa33640f6af5d4D4cF0"
        ),
      },
      {
        symbol: "USDC",
        decimals: 6,
        underlying: checksum("0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8"),
        aToken: checksum("0x16dA4541aD1807f4443d92D26044C1147406EB80"),
        variableDebtToken: checksum(
          "0x36B5dE936eF1710E1d22EabE5231b28581a92ECc"
        ),
      },
      {
        symbol: "WETH",
        decimals: 18,
        underlying: checksum("0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c"),
        aToken: checksum("0x5b071b590a59395fE4025A0Ccc1FcC931AAc1830"),
        variableDebtToken: checksum(
          "0x22a35DB253f4F6D0029025D6312A3BdAb20C2c6A"
        ),
      },
      {
        symbol: "USDT",
        decimals: 6,
        underlying: checksum("0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0"),
        aToken: checksum("0xAF0F6e8b0Dc5c913bbF4d14c22B4E78Dd14310B6"),
        variableDebtToken: checksum(
          "0x9844386d29EEd970B9F6a2B9a676083b0478210e"
        ),
      },
    ] satisfies AaveV3Reserve[],
  },
} as const;

function checksum(address: string): Address {
  return getAddress(address);
}
