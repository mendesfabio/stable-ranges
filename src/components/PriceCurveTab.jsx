import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

function PriceChart({ data, dataKey, nearestPct, title, color, yMin, yMax, refSymbol }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="refPct"
            type="number"
            domain={[5, 90]}
            label={{ value: `${refSymbol} % of Pool`, position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            tickFormatter={(v) => v.toFixed(4)}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
            labelFormatter={(v) => `${refSymbol}: ${v}%`}
            formatter={(value) => [value.toFixed(6)]}
          />
          <ReferenceLine
            x={nearestPct}
            stroke="#F59E0B"
            strokeDasharray="4 4"
            label={{ value: 'Now', fill: '#F59E0B', position: 'top', fontSize: 12 }}
          />
          <ReferenceLine
            y={1.0}
            stroke="#6B7280"
            strokeDasharray="4 4"
            label={{ value: '1.00', fill: '#6B7280', position: 'right', fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function computeYDomain(prices) {
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 0.0001;
  const padding = range * 0.15;
  return [minPrice - padding, maxPrice + padding];
}

export default function PriceCurveTab({ sweepData, currentRefPct, refSymbol, quoteTokens }) {
  if (!sweepData) return <p className="text-gray-400">Computing...</p>;

  const nearestPct = sweepData.reduce((best, d) =>
    Math.abs(d.refPct - currentRefPct) < Math.abs(best - currentRefPct) ? d.refPct : best
  , sweepData[0].refPct);

  return (
    <div className="bg-gray-900 rounded-lg p-4 space-y-6">
      {quoteTokens.map((qt, i) => {
        const prices = sweepData.map((d) => d[qt.symbol]);
        const [yMin, yMax] = computeYDomain(prices);
        return (
          <PriceChart
            key={qt.symbol}
            data={sweepData}
            dataKey={qt.symbol}
            nearestPct={nearestPct}
            title={`${refSymbol} Price in ${qt.symbol} vs Pool Composition`}
            color={COLORS[i % COLORS.length]}
            yMin={yMin}
            yMax={yMax}
            refSymbol={refSymbol}
          />
        );
      })}
    </div>
  );
}
