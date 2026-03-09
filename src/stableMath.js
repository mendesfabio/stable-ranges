/**
 * StableMath — Balancer StableSwap invariant math using BigInt (18-decimal fixed point).
 *
 * Based on the official balancer-maths TypeScript implementation.
 * All internal computations use BigInt for precision; conversion to Number
 * happens only at the public API boundary for display purposes.
 */

const WAD = 10n ** 18n;
const AMP_PRECISION = 1000n;

// ─── Conversion helpers ─────────────────────────────────────────────────────

/**
 * Parse a numeric string (e.g. "1234.567") into an 18-decimal BigInt.
 * Avoids floating-point intermediaries.
 */
export function parseWad(s) {
  const str = String(s).trim();
  const negative = str.startsWith('-');
  const abs = negative ? str.slice(1) : str;
  const [intPart = '0', decPart = ''] = abs.split('.');
  const padded = decPart.padEnd(18, '0').slice(0, 18);
  const result = BigInt(intPart) * WAD + BigInt(padded);
  return negative ? -result : result;
}

/**
 * Convert an 18-decimal BigInt back to a JavaScript Number for display.
 */
export function fromWad(x) {
  if (x === 0n) return 0;
  const negative = x < 0n;
  const abs = negative ? -x : x;
  const intPart = abs / WAD;
  const decPart = abs % WAD;
  const result = Number(intPart) + Number(decPart) / 1e18;
  return negative ? -result : result;
}

export { WAD, AMP_PRECISION };

// ─── Internal BigInt math (from balancer-maths reference) ───────────────────

/** Division rounding up (raw, not fixed-point). */
function divUp(a, b) {
  if (a === 0n || b === 0n) return 0n;
  return 1n + (a - 1n) / b;
}

/** Fixed-point divUp: (a * WAD) / b, rounded up. */
function divUpFixed(a, b) {
  const product = a * WAD;
  if (product === 0n) return 0n;
  return (product - 1n) / b + 1n;
}

/**
 * Compute the StableSwap invariant D using Newton-Raphson.
 * amplificationParameter includes AMP_PRECISION (e.g. 200_000n for A=200).
 */
function _computeInvariant(amplificationParameter, balances) {
  let sum = 0n;
  const numTokens = balances.length;
  for (let i = 0; i < numTokens; i++) {
    sum += balances[i];
  }
  if (sum === 0n) return 0n;

  let prevInvariant;
  let invariant = sum;
  const ampTimesTotal = amplificationParameter * BigInt(numTokens);

  for (let i = 0; i < 255; i++) {
    let D_P = invariant;
    for (let j = 0; j < numTokens; j++) {
      D_P = (D_P * invariant) / (balances[j] * BigInt(numTokens));
    }

    prevInvariant = invariant;

    invariant =
      (((ampTimesTotal * sum) / AMP_PRECISION + D_P * BigInt(numTokens)) *
        invariant) /
      (((ampTimesTotal - AMP_PRECISION) * invariant) / AMP_PRECISION +
        (BigInt(numTokens) + 1n) * D_P);

    if (invariant > prevInvariant) {
      if (invariant - prevInvariant <= 1n) return invariant;
    } else if (prevInvariant - invariant <= 1n) {
      return invariant;
    }
  }

  throw new Error('StableInvariantDidntConverge');
}

/**
 * Solve for one token's balance given the invariant and all other balances.
 * Rounds result up.
 */
function _computeBalance(amplificationParameter, balances, invariant, tokenIndex) {
  const numTokens = balances.length;
  const ampTimesTotal = amplificationParameter * BigInt(numTokens);

  let sum = balances[0];
  let P_D = balances[0] * BigInt(numTokens);
  for (let j = 1; j < numTokens; j++) {
    P_D = (P_D * balances[j] * BigInt(numTokens)) / invariant;
    sum += balances[j];
  }
  sum -= balances[tokenIndex];

  const inv2 = invariant * invariant;
  const c =
    divUp(inv2 * AMP_PRECISION, ampTimesTotal * P_D) * balances[tokenIndex];

  const b = sum + (invariant * AMP_PRECISION) / ampTimesTotal;

  let prevTokenBalance = 0n;
  let tokenBalance = divUp(inv2 + c, invariant + b);

  for (let i = 0; i < 255; i++) {
    prevTokenBalance = tokenBalance;
    tokenBalance = divUp(
      tokenBalance * tokenBalance + c,
      tokenBalance * 2n + b - invariant,
    );

    if (tokenBalance > prevTokenBalance) {
      if (tokenBalance - prevTokenBalance <= 1n) return tokenBalance;
    } else if (prevTokenBalance - tokenBalance <= 1n) {
      return tokenBalance;
    }
  }

  throw new Error('StableGetBalanceDidntConverge');
}

/**
 * Compute amount out for an exact-in swap (rounds down).
 */
function _computeOutGivenExactIn(
  amplificationParameter,
  balances,
  tokenIndexIn,
  tokenIndexOut,
  tokenAmountIn,
  invariant,
) {
  const bals = [...balances];
  bals[tokenIndexIn] += tokenAmountIn;

  const finalBalanceOut = _computeBalance(
    amplificationParameter,
    bals,
    invariant,
    tokenIndexOut,
  );

  return balances[tokenIndexOut] - finalBalanceOut - 1n;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Calculate amount out for a swap, with optional swap fee.
 *
 * @param {bigint} amp           – raw amplification parameter (includes AMP_PRECISION, e.g. 200_000n)
 * @param {bigint[]} liveBalances – token balances in 18-decimal BigInt
 * @param {number} tokenIndexIn
 * @param {number} tokenIndexOut
 * @param {bigint} amountInWad   – amount in, 18-decimal BigInt
 * @param {bigint} [swapFeeWad=0n] – swap fee as 18-decimal fraction (e.g. parseWad("0.0001") for 0.01%)
 * @returns {bigint} amount out in 18-decimal BigInt
 */
export function calcOutGivenIn(amp, liveBalances, tokenIndexIn, tokenIndexOut, amountInWad, swapFeeWad = 0n) {
  const invariant = _computeInvariant(amp, liveBalances);
  let amountOut = _computeOutGivenExactIn(
    amp,
    liveBalances,
    tokenIndexIn,
    tokenIndexOut,
    amountInWad,
    invariant,
  );

  if (swapFeeWad > 0n) {
    const feeAmount = (amountOut * swapFeeWad) / WAD;
    amountOut -= feeAmount;
  }

  return amountOut;
}

/**
 * Compute spot price of refToken in terms of quoteToken.
 * Returns a JavaScript Number for display.
 *
 * Uses a small epsilon swap to approximate the instantaneous rate.
 */
export function getSpotPrice(amp, liveBalances, refIndex, quoteIndex, swapFeeWad = 0n) {
  const eps = WAD / 1000n; // 0.001 in 18 decimals
  const out = calcOutGivenIn(amp, liveBalances, refIndex, quoteIndex, eps, swapFeeWad);
  // price = out / eps;  scale up to WAD first to preserve precision
  const priceWad = (out * WAD) / eps;
  return fromWad(priceWad);
}

/**
 * Distribute total liquidity across tokens for a given ref-token percentage.
 * All inputs and outputs are 18-decimal BigInt.
 *
 * @param {bigint} totalLive       – total live balance (sum of all tokens)
 * @param {number} ghoPercent      – fraction 0–1 (JavaScript number)
 * @param {number} ghoIndex
 * @param {number[]} otherIndices
 * @param {bigint[]} currentBalances – current live balances (BigInt)
 * @returns {bigint[]} new balances
 */
export function getBalancesForGhoPercent(totalLive, ghoPercent, ghoIndex, otherIndices, currentBalances) {
  // Convert fraction to WAD to avoid float multiplication on BigInt
  const pctWad = BigInt(Math.round(ghoPercent * 1e18));
  const ghoBalance = (totalLive * pctWad) / WAD;
  const remainder = totalLive - ghoBalance;

  const n = otherIndices.length + 1;
  const result = new Array(n);
  result[ghoIndex] = ghoBalance;

  if (currentBalances) {
    let otherTotal = 0n;
    for (const i of otherIndices) otherTotal += currentBalances[i];
    for (const idx of otherIndices) {
      result[idx] = (remainder * currentBalances[idx]) / otherTotal;
    }
  } else {
    const share = remainder / BigInt(otherIndices.length);
    for (const idx of otherIndices) {
      result[idx] = share;
    }
  }

  return result;
}
