import { formatPrice } from '../format';

export default function PriceRangeTable({ tableData, currentRefPct, bandData, refSymbol, quoteTokens }) {
  if (!tableData) return <p className="text-gray-400">Computing...</p>;

  let closestIdx = 0;
  let minDist = Infinity;
  tableData.forEach((row, i) => {
    const dist = Math.abs(row.pct - currentRefPct);
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
    }
  });

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">
        {refSymbol} Price at Composition Breakpoints
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-3 text-gray-400 font-medium">{refSymbol} % of Pool</th>
              {quoteTokens.map((qt) => (
                <th key={qt.symbol} className="text-right py-2 px-3 text-gray-400 font-medium">
                  Price ({qt.symbol})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, i) => (
              <tr
                key={row.pct}
                className={`border-b border-gray-800 ${
                  i === closestIdx ? 'bg-blue-900/30' : ''
                }`}
              >
                <td className="py-2 px-3">
                  {row.pct}%
                  {i === closestIdx && (
                    <span className="ml-2 text-xs text-yellow-400">current</span>
                  )}
                </td>
                {quoteTokens.map((qt) => (
                  <td key={qt.symbol} className="text-right py-2 px-3 font-mono">
                    {formatPrice(row[qt.symbol])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bandData && (
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">
            Trading Band Summary (5%–50% {refSymbol})
          </h4>
          <div className={`grid grid-cols-1 md:grid-cols-${quoteTokens.length} gap-4 text-sm`}>
            {quoteTokens.map((qt) => (
              <div key={qt.symbol}>
                <div className="text-xs text-gray-400 mb-1">{refSymbol} / {qt.symbol}</div>
                <div className="font-mono">
                  {formatPrice(bandData[qt.symbol].low)} – {formatPrice(bandData[qt.symbol].high)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Width: {formatPrice(bandData[qt.symbol].width)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
