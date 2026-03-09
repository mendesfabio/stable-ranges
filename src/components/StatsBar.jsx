import { useState } from 'react';
import { formatPrice, formatTvl, formatPercent, formatSwapFee } from '../format';

function StatCard({ label, value, children }) {
  return (
    <div className="bg-gray-900 rounded-lg px-4 py-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {children}
    </div>
  );
}

export default function StatsBar({ tvl, refPct, refSymbol, amp, spotPrices, quoteTokens, swapFee, ampError, onManualAmp }) {
  const [quoteIdx, setQuoteIdx] = useState(0);
  const selectedQuote = quoteTokens[quoteIdx]?.symbol || quoteTokens[0]?.symbol;
  const spotPrice = spotPrices?.[selectedQuote];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <StatCard label="TVL" value={formatTvl(tvl)} />
      <StatCard label={`${refSymbol} % of Pool`} value={formatPercent(refPct)} />
      <StatCard label="AMP" value={amp != null ? amp.toLocaleString() : '—'}>
        {ampError && (
          <div className="mt-1 flex items-center gap-1">
            <input
              type="number"
              min="1"
              max="10000"
              defaultValue={amp}
              onBlur={(e) => onManualAmp(Number(e.target.value))}
              className="w-20 bg-gray-800 border border-yellow-700 rounded px-1 py-0.5 text-xs text-white"
              title="Manual AMP override"
            />
            <span className="text-yellow-500 text-xs">manual</span>
          </div>
        )}
      </StatCard>
      <StatCard label={`${refSymbol} Price (${selectedQuote})`} value={formatPrice(spotPrice)}>
        {quoteTokens.length > 1 && (
          <div className="mt-1 flex gap-1">
            {quoteTokens.map((qt, i) => (
              <button
                key={qt.symbol}
                onClick={() => setQuoteIdx(i)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  quoteIdx === i
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                {qt.symbol}
              </button>
            ))}
          </div>
        )}
      </StatCard>
      <StatCard label="Swap Fee" value={formatSwapFee(swapFee)} />
    </div>
  );
}
