/**
 * StableMath — Balancer/Curve StableSwap invariant math.
 *
 * Invariant:  A·n^n·Σxᵢ + D = A·D·n^n + D^(n+1) / (n^n · Πxᵢ)
 */

const MAX_ITERATIONS = 255;
const CONVERGENCE = 1e-7;

/**
 * Compute the StableSwap invariant D given balances and amp factor.
 */
export function calculateInvariant(amp, balances) {
  const n = balances.length;
  const sum = balances.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;

  let D = sum;
  const Ann = amp * n ** n;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let D_P = D;
    for (const x of balances) {
      D_P = (D_P * D) / (x * n);
    }

    const Dprev = D;
    const numerator = (Ann * sum + D_P * n) * D;
    const denominator = (Ann - 1) * D + (n + 1) * D_P;
    D = numerator / denominator;

    if (Math.abs(D - Dprev) < CONVERGENCE) {
      return D;
    }
  }

  return D;
}

/**
 * Given the invariant D and the known balances (with tokenOut balance being a
 * placeholder), solve for the balance of tokenOut using Newton's method.
 *
 * Derivation:
 *   S' = sum of balances except tokenOut
 *   P' = D^n / (n^(n-1) * prod(balances except tokenOut))  [computed iteratively]
 *   c  = D * P' / (Ann * n)  =  D^(n+1) / (n^n * prod_excl * Ann)
 *   b  = S' + D / Ann
 *
 *   y^2 + (b - D) * y = c
 *   Newton:  y_new = (y^2 + c) / (2y + b - D)
 */
function getTokenBalanceGivenInvariantAndOtherBalances(amp, balances, D, tokenIndex) {
  const n = balances.length;
  const Ann = amp * n ** n;

  let S_prime = 0;
  let P_prime = D;
  for (let i = 0; i < n; i++) {
    if (i === tokenIndex) continue;
    S_prime += balances[i];
    P_prime = (P_prime * D) / (balances[i] * n);
  }

  const c = (D * P_prime) / (Ann * n);
  const b = S_prime + D / Ann;

  let y = D;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const yPrev = y;
    y = (y * y + c) / (2 * y + b - D);
    if (Math.abs(y - yPrev) < CONVERGENCE) {
      return y;
    }
  }

  return y;
}

/**
 * Calculate the amount of tokenOut received for a given amountIn of tokenIn.
 */
export function calcOutGivenIn(amp, balances, tokenIndexIn, tokenIndexOut, amountIn) {
  const newBalances = [...balances];
  newBalances[tokenIndexIn] = balances[tokenIndexIn] + amountIn;

  const D = calculateInvariant(amp, balances);
  const newBalanceOut = getTokenBalanceGivenInvariantAndOtherBalances(
    amp,
    newBalances,
    D,
    tokenIndexOut
  );

  return balances[tokenIndexOut] - newBalanceOut;
}

/**
 * Compute GHO spot price in terms of another token using numerical derivative.
 * Returns how much quoteToken you get per 1 GHO.
 */
export function getSpotPrice(amp, balances, ghoIndex, quoteIndex) {
  const eps = 0.01;
  const out = calcOutGivenIn(amp, balances, ghoIndex, quoteIndex, eps);
  return out / eps;
}

/**
 * Compute balances for a given GHO percentage, keeping total liquidity constant.
 * Distributes the remainder among other tokens proportionally to their current balances.
 */
export function getBalancesForGhoPercent(totalUnderlying, ghoPercent, ghoIndex, otherIndices, currentBalances) {
  const ghoBalance = totalUnderlying * ghoPercent;
  const remainder = totalUnderlying - ghoBalance;

  const n = otherIndices.length + 1;
  const result = new Array(n);
  result[ghoIndex] = ghoBalance;

  if (currentBalances) {
    const otherTotal = otherIndices.reduce((sum, i) => sum + currentBalances[i], 0);
    for (const idx of otherIndices) {
      result[idx] = remainder * (currentBalances[idx] / otherTotal);
    }
  } else {
    const otherBalance = remainder / otherIndices.length;
    for (const idx of otherIndices) {
      result[idx] = otherBalance;
    }
  }

  return result;
}
