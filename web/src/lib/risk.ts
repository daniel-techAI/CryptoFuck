export function calculateTradeRisk(entry: number, stopLoss: number, sizeUsd: number) {
  const quantity = entry > 0 ? sizeUsd / entry : 0;
  const riskUsd = Math.abs(entry - stopLoss) * quantity;
  const riskPercent = sizeUsd > 0 ? riskUsd / sizeUsd * 100 : 0;
  return { quantity, riskUsd, riskPercent };
}
