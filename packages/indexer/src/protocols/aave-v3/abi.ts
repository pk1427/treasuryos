export const erc20BalanceAbi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Aave V3 Pool — real contract reads for account-level risk data.
// https://github.com/aave/aave-v3-core/blob/master/contracts/interfaces/IPool.sol
export const aavePoolAbi = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getUserAccountData",
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// https://github.com/aave/aave-v3-core/blob/master/contracts/interfaces/IPoolAddressesProvider.sol
export const aavePoolAddressesProviderAbi = [
  {
    inputs: [],
    name: "getPriceOracle",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// https://github.com/aave/aave-v3-core/blob/master/contracts/interfaces/IAaveOracle.sol
export const aaveOracleAbi = [
  {
    inputs: [],
    name: "BASE_CURRENCY_UNIT",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Reserve interest rates — real supply/borrow rates, not hardcoded.
// Struct layout matches DataTypes.ReserveData, stable since Aave V3 launch:
// https://github.com/aave/aave-v3-core/blob/master/contracts/protocol/libraries/types/DataTypes.sol
export const aavePoolReserveDataAbi = [
  {
    inputs: [{ name: "asset", type: "address" }],
    name: "getReserveData",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          {
            name: "configuration",
            type: "tuple",
            components: [{ name: "data", type: "uint256" }],
          },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "currentStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// https://github.com/aave/aave-v3-periphery/blob/master/contracts/rewards/interfaces/IRewardsController.sol
export const aaveRewardsControllerAbi = [
  {
    inputs: [
      { name: "assets", type: "address[]" },
      { name: "user", type: "address" },
    ],
    name: "getAllUserRewards",
    outputs: [
      { name: "rewardsList", type: "address[]" },
      { name: "unclaimedAmounts", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Aave V3 IncentivizedERC20 — getIncentivesController returns the rewards
// controller for a given aToken / variableDebtToken. Used to auto-discover
// the incentives controller rather than hardcoding it.
export const aaveIncentivesControllerAbi = [
  {
    inputs: [],
    name: "getIncentivesController",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const erc20MetadataAbi = [
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;