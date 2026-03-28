import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { ChartConfiguration } from 'chart.js';

const CHART_COLORS = ['#FFD700', '#4FC3F7', '#81C784', '#CE93D8', '#FF8A65'];

const renderer = new ChartJSNodeCanvas({ width: 800, height: 400, backgroundColour: '#2b2d31' });

export interface PlayerSeries {
  gameName: string;
  dataPoints: Array<{ time: string; normalizedLP: number }>;
}

export async function renderLpGraph(players: PlayerSeries[]): Promise<Buffer> {
  const datasets = players.map((player, i) => ({
    label: player.gameName,
    data: player.dataPoints.map((dp) => ({
      x: new Date(dp.time).getTime(),
      y: dp.normalizedLP,
    })),
    borderColor: CHART_COLORS[i % CHART_COLORS.length],
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 3,
    tension: 0.3,
  }));

  const config: ChartConfiguration = {
    type: 'line',
    data: { datasets },
    options: {
      animation: false as any,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#dcddde', font: { size: 13 } },
        },
        title: {
          display: true,
          text: 'Top 5 LP Progression',
          color: '#ffffff',
          font: { size: 16 },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'hour', displayFormats: { hour: 'HH:mm' } },
          ticks: { color: '#b9bbbe' },
          grid: { color: '#40444b' },
        },
        y: {
          ticks: { color: '#b9bbbe' },
          grid: { color: '#40444b' },
        },
      },
    },
  };

  return renderer.renderToBuffer(config);
}
