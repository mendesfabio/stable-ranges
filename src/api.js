import { parseWad, WAD } from './stableMath';

const BALANCER_API = 'https://api-v3.balancer.fi/graphql';

const RPC_URLS = {
  MAINNET: 'https://ethereum-rpc.publicnode.com',
  ARBITRUM: 'https://arbitrum-one-rpc.publicnode.com',
};

export const POOLS = [
  { id: '0x85b2b559bc2d21104c4defdd6efca8a20343361d', chain: 'MAINNET', label: 'GHO/USDC/USDT (Ethereum)' },
  { id: '0x19b001e6bc2d89154c18e2216eec5c8c6047b6d8', chain: 'ARBITRUM', label: 'GHO/USDC/USDT (Arbitrum)' },
];

export async function fetchPoolData(poolId, chain) {
  const query = `{
    poolGetPool(id: "${poolId}", chain: ${chain}) {
      id
      name
      dynamicData {
        totalLiquidity
        swapFee
      }
      poolTokens {
        id
        symbol
        balance
        decimals
        isErc4626
        priceRate
        underlyingToken {
          symbol
          address
          logoURI
        }
      }
    }
  }`;

  const res = await fetch(BALANCER_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error(`Balancer API error: ${res.status}`);

  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);

  return json.data.poolGetPool;
}

/**
 * Fetch the raw amplification parameter from the pool contract.
 * Returns a BigInt that includes the AMP_PRECISION factor (e.g. 200_000n for A=200).
 */
export async function fetchAmp(poolId, chain) {
  const rpcUrl = RPC_URLS[chain];
  if (!rpcUrl) throw new Error(`No RPC for chain: ${chain}`);

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [
        {
          to: poolId,
          data: '0x6daccffa', // getAmplificationParameter()
        },
        'latest',
      ],
    }),
  });

  if (!res.ok) throw new Error(`RPC error: ${res.status}`);

  const json = await res.json();
  if (json.error) throw new Error(json.error.message);

  // Decode: (uint256 value, bool isUpdating, uint256 precision)
  const data = json.result;
  const hex = data.slice(2);
  const value = BigInt('0x' + hex.slice(0, 64));

  // Return raw value (includes AMP_PRECISION factor).
  // The reference stable math divides by AMP_PRECISION internally.
  return value;
}

/**
 * Process raw pool data into a normalized format.
 * Produces both display-friendly floats and computation-ready BigInt values.
 */
export function processPoolData(pool) {
  const tokens = pool.poolTokens.map((t) => {
    const wrappedBalance = parseFloat(t.balance);
    const priceRate = parseFloat(t.priceRate);
    const underlyingBalance = wrappedBalance * priceRate;
    const symbol = t.underlyingToken?.symbol || t.symbol.replace('wa', '');

    // BigInt live balance: wrappedBalance * rate, computed without float multiplication
    const wrappedBalanceWad = parseWad(t.balance);
    const rateWad = parseWad(t.priceRate);
    const liveBalance = (wrappedBalanceWad * rateWad) / WAD;

    return {
      symbol,
      wrappedSymbol: t.symbol,
      wrappedBalance,
      underlyingBalance,
      priceRate,
      decimals: t.decimals,
      logoURI: t.underlyingToken?.logoURI,
      liveBalance,
    };
  });

  const totalUnderlying = tokens.reduce((sum, t) => sum + t.underlyingBalance, 0);
  const liveBalances = tokens.map((t) => t.liveBalance);
  let totalLive = 0n;
  for (const b of liveBalances) totalLive += b;

  // Swap fee as 18-decimal BigInt
  const swapFee = parseFloat(pool.dynamicData.swapFee);
  const swapFeeWad = parseWad(pool.dynamicData.swapFee);

  // Default ref index: first token named GHO, otherwise index 0
  const defaultRefIndex = tokens.findIndex((t) => t.symbol === 'GHO');

  return {
    name: pool.name,
    tvl: parseFloat(pool.dynamicData.totalLiquidity),
    swapFee,
    swapFeeWad,
    tokens,
    totalUnderlying,
    liveBalances,
    totalLive,
    defaultRefIndex: defaultRefIndex >= 0 ? defaultRefIndex : 0,
  };
}
