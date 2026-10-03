// Net-profit arbitrage math for DEX-to-DEX and multi-hop cyclic routes.
// BigInt throughout.
// Profit is NEVER raw spread: it subtracts pool fees, price impact, gas,
// slippage buffer, and execution overhead.

const BPS = 10_000n;

/** Uniswap-V2 style constant product getAmountOut. feeBps e.g. 30 = 0.30%. */
export function getAmountOut(amountIn, reserveIn, reserveOut, feeBps) {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const inWithFee = amountIn * (BPS - BigInt(feeBps));
  return (inWithFee * reserveOut) / (reserveIn * BPS + inWithFee);
}

/**
 * Hop representation matching on-chain RiskExecutor.Hop:
 * {
 *   adapter: string (address or adapter identifier),
 *   tokenIn: string,
 *   tokenOut: string,
 *   pool: { reserveIn: bigint, reserveOut: bigint, feeBps: number },
 *   data: string (hex encoded venue params, e.g. V3 fee tier)
 * }
 */
export function simulateHop(amountIn, hop) {
  return getAmountOut(amountIn, hop.pool.reserveIn, hop.pool.reserveOut, hop.pool.feeBps);
}

/**
 * Evaluate an arbitrary hop cycle:
 * Base Asset (USDC) -> Hop 1 -> ... -> Hop N -> Base Asset (USDC)
 * costs: { gasBase: bigint, overheadBase: bigint, slippageBps: number }
 */
export function evaluateHops(amountIn, hops, costs) {
  let currentAmt = amountIn;
  const intermediates = [];

  for (const hop of hops) {
    currentAmt = simulateHop(currentAmt, hop);
    intermediates.push({ tokenOut: hop.tokenOut, amountOut: currentAmt, adapter: hop.adapter });
  }

  const grossOut = currentAmt;
  const slippageBuffer = (grossOut * BigInt(costs.slippageBps)) / BPS;
  const expectedProfit = grossOut - amountIn - costs.gasBase - costs.overheadBase - slippageBuffer;
  const minAmountOut = grossOut - slippageBuffer;

  return {
    amountIn,
    intermediates,
    grossOut,
    grossProfit: grossOut - amountIn,
    expectedProfit,
    minAmountOut,
    hops
  };
}

/**
 * 2-hop cyclic route helper:
 * Hop 0: Base -> Intermediate on DEX A / pool A
 * Hop 1: Intermediate -> Base on DEX B / pool B
 */
export function evaluateCycle(amountIn, buyPool, sellPool, costs, adapterA = "adapterA", adapterB = "adapterB", intermediateToken = "WMON") {
  const hops = [
    {
      adapter: adapterA,
      tokenIn: "USDC",
      tokenOut: intermediateToken,
      pool: { reserveIn: buyPool.reserveBase, reserveOut: buyPool.reserveToken, feeBps: buyPool.feeBps },
      data: "0x"
    },
    {
      adapter: adapterB,
      tokenIn: intermediateToken,
      tokenOut: "USDC",
      pool: { reserveIn: sellPool.reserveToken, reserveOut: sellPool.reserveBase, feeBps: sellPool.feeBps },
      data: "0x"
    }
  ];

  const evalRes = evaluateHops(amountIn, hops, costs);
  return {
    amountIn,
    tokenOut: evalRes.intermediates[0].amountOut,
    grossOut: evalRes.grossOut,
    grossProfit: evalRes.grossProfit,
    expectedProfit: evalRes.expectedProfit,
    minAmountOut: evalRes.minAmountOut,
    hops
  };
}

/** Search input sizes for max expected profit. */
export function bestSize(maxIn, buyPool, sellPool, costs, steps = 200, adapterA = "adapterA", adapterB = "adapterB") {
  let best = null;
  for (let i = 1n; i <= BigInt(steps); i++) {
    const amt = (maxIn * i) / BigInt(steps);
    if (amt <= 0n) continue;
    const r = evaluateCycle(amt, buyPool, sellPool, costs, adapterA, adapterB);
    if (!best || r.expectedProfit > best.expectedProfit) best = r;
  }
  return best;
}
