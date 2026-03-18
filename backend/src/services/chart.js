export function generateChartData(stockType) {
  const points = [];
  let current = 30;

  const params = {
    'Blue Chip': { trend: 0.3, volatility: 2 },
    'Growth Stock': { trend: 0.5, volatility: 5 },
    'Concept Stock': { trend: 0.2, volatility: 8 },
    'Defensive Stock': { trend: 0.1, volatility: 1 }
  };

  const { trend, volatility } = params[stockType] || params['Growth Stock'];

  for (let i = 0; i < 30; i++) {
    current -= trend;

    const change = (Math.random() - 0.5) * volatility * 2;
    current += change;

    current = Math.max(0, Math.min(52, current));
    points.push(Math.round(current));
  }

  return points;
}

