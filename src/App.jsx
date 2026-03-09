import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchPoolData, fetchAmp, processPoolData, POOLS } from './api';
import { getSpotPrice, getBalancesForGhoPercent, AMP_PRECISION } from './stableMath';
import StatsBar from './components/StatsBar';
import PriceCurveTab from './components/PriceCurveTab';
import PriceRangeTable from './components/PriceRangeTable';
import SpotPriceTab from './components/SpotPriceTab';

const TABS = ['Price Curve', 'Price Table', 'Spot Price'];

function App() {
  const [poolIdx, setPoolIdx] = useState(0);
  const [pool, setPool] = useState(null);
  const [amp, setAmp] = useState(null); // BigInt (raw, includes AMP_PRECISION)
  const [refIndex, setRefIndex] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState(null);
  const [ampError, setAmpError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Display-friendly amp value (Number)
  const ampDisplay = amp != null ? Number(amp / AMP_PRECISION) : null;

  const loadData = useCallback(async (idx) => {
    const { id, chain } = POOLS[idx];
    setLoading(true);
    setError(null);
    setAmpError(null);
    setPool(null);
    setAmp(null);
    setRefIndex(null);

    try {
      const rawPool = await fetchPoolData(id, chain);
      const processed = processPoolData(rawPool);
      setPool(processed);
      setRefIndex(processed.defaultRefIndex);

      try {
        const ampValue = await fetchAmp(id, chain);
        setAmp(ampValue);
      } catch (e) {
        console.error('AMP fetch failed:', e);
        setAmpError(e.message);
        setAmp(200n * AMP_PRECISION); // fallback A=200
      }
    } catch (e) {
      console.error('Pool data fetch failed:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(poolIdx);
  }, [poolIdx, loadData]);

  // Derived: reference token symbol, quote tokens, current ref %
  const refSymbol = pool && refIndex != null ? pool.tokens[refIndex].symbol : null;
  const quoteTokens = useMemo(() => {
    if (!pool || refIndex == null) return [];
    return pool.tokens
      .map((t, i) => ({ symbol: t.symbol, index: i }))
      .filter((t) => t.index !== refIndex)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [pool, refIndex]);
  const refPct = useMemo(() => {
    if (!pool || refIndex == null) return null;
    return pool.tokens[refIndex].underlyingBalance / pool.totalUnderlying;
  }, [pool, refIndex]);

  // Compute spot prices for ref token against each quote
  const spotPrices = useMemo(() => {
    if (!pool || amp == null || refIndex == null) return null;
    const result = {};
    for (const qt of quoteTokens) {
      result[qt.symbol] = getSpotPrice(amp, pool.liveBalances, refIndex, qt.index, pool.swapFeeWad);
    }
    return result;
  }, [pool, amp, refIndex, quoteTokens]);

  // Compute price sweep data
  const sweepData = useMemo(() => {
    if (!pool || amp == null || refIndex == null) return null;
    const otherIndices = quoteTokens.map((q) => q.index);

    const points = [];
    for (let pct = 5; pct <= 90; pct += 1) {
      const frac = pct / 100;
      const balances = getBalancesForGhoPercent(pool.totalLive, frac, refIndex, otherIndices, pool.liveBalances);
      const point = { refPct: pct };
      for (const qt of quoteTokens) {
        point[qt.symbol] = getSpotPrice(amp, balances, refIndex, qt.index, pool.swapFeeWad);
      }
      points.push(point);
    }
    return points;
  }, [pool, amp, refIndex, quoteTokens]);

  // Compute band widths for each quote token
  const bandData = useMemo(() => {
    if (!pool || amp == null || refIndex == null) return null;
    const otherIndices = quoteTokens.map((q) => q.index);

    const result = {};
    for (const qt of quoteTokens) {
      const getPrice = (pct) => {
        const balances = getBalancesForGhoPercent(pool.totalLive, pct, refIndex, otherIndices, pool.liveBalances);
        return getSpotPrice(amp, balances, refIndex, qt.index, pool.swapFeeWad);
      };
      const at5 = getPrice(0.05);
      const at90 = getPrice(0.90);
      result[qt.symbol] = {
        low: Math.min(at5, at90),
        high: Math.max(at5, at90),
        width: Math.abs(at5 - at90),
      };
    }
    return result;
  }, [pool, amp, refIndex, quoteTokens]);

  // Price table data
  const tableData = useMemo(() => {
    if (!pool || amp == null || refIndex == null) return null;
    const otherIndices = quoteTokens.map((q) => q.index);

    const breakpoints = [];
    for (let p = 5; p <= 50; p += 5) breakpoints.push(p);
    return breakpoints.map((pct) => {
      const frac = pct / 100;
      const balances = getBalancesForGhoPercent(pool.totalLive, frac, refIndex, otherIndices, pool.liveBalances);
      const row = { pct };
      for (const qt of quoteTokens) {
        row[qt.symbol] = getSpotPrice(amp, balances, refIndex, qt.index, pool.swapFeeWad);
      }
      return row;
    });
  }, [pool, amp, refIndex, quoteTokens]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">Failed to load pool data: {error}</p>
          <button
            onClick={() => loadData(poolIdx)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || !pool || amp == null || refIndex == null) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading pool data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-2">Stable Pool Price Explorer</h1>
        <p className="text-sm text-gray-400 mb-1">
          Visualize how spot prices between tokens evolve as pool composition shifts in Balancer StableSwap pools.
        </p>
        <p className="text-sm text-gray-400 mb-6">
          Select a pool and a reference asset to see price curves, breakpoint tables, and trading band widths across different compositions.
        </p>

        {/* Pool selector + reference asset */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Pool:</span>
            <select
              value={poolIdx}
              onChange={(e) => setPoolIdx(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white cursor-pointer"
            >
              {POOLS.map((p, i) => (
                <option key={p.id} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Reference asset:</span>
            <div className="flex gap-1">
              {[...pool.tokens]
                .map((token, i) => ({ token, i }))
                .sort((a, b) => a.token.symbol.localeCompare(b.token.symbol))
                .map(({ token, i }) => (
                  <button
                    key={token.symbol}
                    onClick={() => setRefIndex(i)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      refIndex === i
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {token.symbol}
                  </button>
                ))}
            </div>
          </div>
        </div>

        <StatsBar
          tvl={pool.tvl}
          refPct={refPct}
          refSymbol={refSymbol}
          amp={ampDisplay}
          spotPrices={spotPrices}
          quoteTokens={quoteTokens}
          swapFee={pool.swapFee}
          ampError={ampError}
          onManualAmp={(val) => setAmp(BigInt(val) * AMP_PRECISION)}
        />

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-800">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === i
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 0 && (
          <PriceCurveTab
            sweepData={sweepData}
            currentRefPct={refPct * 100}
            refSymbol={refSymbol}
            quoteTokens={quoteTokens}
          />
        )}
        {activeTab === 1 && (
          <PriceRangeTable
            tableData={tableData}
            currentRefPct={refPct * 100}
            bandData={bandData}
            refSymbol={refSymbol}
            quoteTokens={quoteTokens}
          />
        )}
        {activeTab === 2 && (
          <SpotPriceTab
            spotPrices={spotPrices}
            refSymbol={refSymbol}
            quoteTokens={quoteTokens}
            tokens={pool.tokens}
            totalUnderlying={pool.totalUnderlying}
          />
        )}
      </div>
    </div>
  );
}

export default App;
