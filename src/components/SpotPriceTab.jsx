import { formatPrice, formatPercent, formatBalance } from '../format';

export default function SpotPriceTab({ spotPrices, refSymbol, quoteTokens, tokens, totalUnderlying }) {
  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className={`grid grid-cols-1 md:grid-cols-${quoteTokens.length} gap-6 mb-8`}>
        {quoteTokens.map((qt) => (
          <div key={qt.symbol} className="text-center">
            <div className="text-xs text-gray-400 mb-2">{refSymbol} Price in {qt.symbol}</div>
            <div className="text-4xl font-bold font-mono">{formatPrice(spotPrices?.[qt.symbol])}</div>
          </div>
        ))}
      </div>

      <h4 className="text-sm font-semibold text-gray-300 mb-3">Pool Composition</h4>
      <div className="space-y-3">
        {tokens.map((token) => {
          const pct = token.underlyingBalance / totalUnderlying;
          return (
            <div key={token.symbol}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">{token.symbol}</span>
                <span className="text-gray-400">
                  {formatBalance(token.underlyingBalance)} ({formatPercent(pct)})
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
