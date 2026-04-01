import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { ChartConfiguration } from 'chart.js';
import { loadImage, createCanvas } from 'canvas';
import type { Image } from 'canvas';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHART_COLORS = ['#FFD700', '#4FC3F7', '#81C784', '#CE93D8', '#FF8A65'];

const bgPath = path.join(__dirname, '..', 'assets', 'pass_background.tft_set17.png');
const RANK_ICONS_DIR = path.join(__dirname, '..', 'assets', 'ranks');

const RANK_ASSETS: Record<string, string> = {
  IRON: '1_iron.png',
  BRONZE: '2_bronze.png',
  SILVER: '3_silver.png',
  GOLD: '4_gold.png',
  PLATINUM: '5_platinum.png',
  EMERALD: '6_emerald.png',
  DIAMOND: '7_diamond.png',
  MASTER: '8_master.png',
  GRANDMASTER: '9_grandmaster.png',
  CHALLENGER: '10_challenger.png',
  UNRANKED: '0_unranked.png',
};

const rankImagesCache: Record<string, Image> = {};

async function getRankImage(tier: string): Promise<Image | null> {
  const t = tier.toUpperCase();
  if (!RANK_ASSETS[t]) return null;
  if (!rankImagesCache[t]) {
    try {
      const filepath = path.join(RANK_ICONS_DIR, RANK_ASSETS[t]);
      rankImagesCache[t] = await loadImage(filepath);
    } catch (e) {
      console.error('getRankImage error for', tier, e);
      return null;
    }
  }
  return rankImagesCache[t];
}

async function loadAvatarCanvas(url: string): Promise<Image | null> {
  try {
    const pngUrl = url.replace(/\.webp($|\?)/, '.png$1');
    const res = await fetch(pngUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const img = await loadImage(buffer);
    // Draw into a circular-clipped canvas
    const size = 32;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, 0, 0, size, size);
    // Return as a loadable image
    return await loadImage(canvas.toBuffer());
  } catch (e) {
    console.error('loadAvatarCanvas error:', e);
    return null;
  }
}

export interface PlayerSeries {
  gameName: string;
  tagLine: string;
  discordAvatarUrl?: string;
  dataPoints: Array<{ 
    time: string; 
    normalizedLP: number;
    tier: string;
    rank: string;
    leaguePoints: number;
  }>;
}

interface ProcessedDataset {
  label: string;
  data: { x: number; y: number }[];
  borderColor: string;
  backgroundColor: string;
  borderWidth: number;
  tension: number;
  // Per-point metadata for custom drawing
  _pointMeta: Array<{
    rankImg: Image | null;
    isOutlier: boolean;
    labelText: string;
  }>;
  _avatarImg: Image | null;
  _color: string;
}

export async function renderLpGraph(players: PlayerSeries[], dateStr: string = new Date().toISOString().split('T')[0]): Promise<Buffer> {
  const bgImage = await loadImage(bgPath).catch(() => null);

  // Parse date — treat dateStr as UTC midnight to avoid timezone shifts
  const [y, m, d] = dateStr.split('-').map(Number);
  const titleDateObj = new Date(Date.UTC(y, m - 1, d));
  const weekday = titleDateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const monthDay = titleDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const chartTitle = `Top Rankers for ${weekday}, ${monthDay}`;

  // Pre-load all rank images and avatars
  const processedDatasets: ProcessedDataset[] = await Promise.all(
    players.map(async (player, i) => {
      const avatarImg = player.discordAvatarUrl
        ? await loadAvatarCanvas(player.discordAvatarUrl)
        : null;

      const pointMeta: ProcessedDataset['_pointMeta'] = [];

      for (let j = 0; j < player.dataPoints.length; j++) {
        const dp = player.dataPoints[j];
        const tier = dp.tier.toUpperCase();
        const tierFormatted = dp.tier.charAt(0).toUpperCase() + dp.tier.slice(1).toLowerCase();

        let labelText = '';
        if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier)) {
          labelText = `${tierFormatted} • ${dp.leaguePoints} LP`;
        } else if (tier === 'UNRANKED') {
          labelText = 'Unranked';
        } else {
          labelText = `${tierFormatted} ${dp.rank} • ${dp.leaguePoints} LP`;
        }

        // Outlier = first point, last point, or tier changes
        const prevTier = j > 0 ? player.dataPoints[j - 1].tier : null;
        const nextTier = j < player.dataPoints.length - 1 ? player.dataPoints[j + 1].tier : null;
        const isOutlier = j === 0 || j === player.dataPoints.length - 1 || prevTier !== dp.tier || nextTier !== dp.tier;

        const rankImg = isOutlier ? await getRankImage(dp.tier) : null;
        pointMeta.push({ rankImg, isOutlier, labelText });
      }

      return {
        label: `${player.gameName}#${player.tagLine}`,
        data: player.dataPoints.map(dp => ({
          x: new Date(dp.time).getTime(),
          y: dp.normalizedLP,
        })),
        borderColor: CHART_COLORS[i % CHART_COLORS.length],
        backgroundColor: 'transparent',
        borderWidth: 3,
        tension: 0.3,
        _pointMeta: pointMeta,
        _avatarImg: avatarImg,
        _color: CHART_COLORS[i % CHART_COLORS.length],
      };
    })
  );

  // 10% x-axis padding
  const allTimes = players.flatMap(p => p.dataPoints.map(dp => new Date(dp.time).getTime()));
  const minTime = allTimes.length ? Math.min(...allTimes) : Date.now() - 86400000;
  const maxTime = allTimes.length ? Math.max(...allTimes) : Date.now();
  const timeSpan = maxTime - minTime || 3600000;
  const paddedMin = minTime - timeSpan * 0.1;
  const paddedMax = maxTime + timeSpan * 0.1;

  // Plugin: draw background image
  const backgroundPlugin = {
    id: 'backgroundPlugin',
    beforeDraw: (chart: any) => {
      if (bgImage) {
        const { ctx, width, height } = chart;
        ctx.save();
        ctx.drawImage(bgImage, 0, 0, width, height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    },
  };

  // Plugin: draw rank icons and dots on each data point
  const pointDrawPlugin = {
    id: 'pointDrawPlugin',
    afterDatasetsDraw: (chart: any) => {
      const { ctx } = chart;
      chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        const processed = processedDatasets[datasetIndex];
        if (!processed) return;

        meta.data.forEach((point: any, index: number) => {
          const pm = processed._pointMeta[index];
          if (!pm) return;

          const { x, y } = point.getProps(['x', 'y'], true);

          ctx.save();
          if (pm.rankImg && pm.isOutlier) {
            // Draw rank icon centered on the point
            const iconSize = 28;
            ctx.drawImage(pm.rankImg, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
          } else {
            // Draw a simple colored dot
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = processed._color;
            ctx.fill();
          }
          ctx.restore();
        });
      });
    },
  };

  // Plugin: draw custom right-side legend with avatars
  const legendPlugin = {
    id: 'legendPlugin',
    afterDraw: (chart: any) => {
      const { ctx, chartArea } = chart;
      const legendX = chartArea.right + 15;
      let legendY = chartArea.top + 20;

      processedDatasets.forEach((dataset) => {
        ctx.save();
        const avatarSize = 28;
        const textX = legendX + avatarSize + 8;

        if (dataset._avatarImg) {
          // Circular clip for avatar
          ctx.beginPath();
          ctx.arc(legendX + avatarSize / 2, legendY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(dataset._avatarImg, legendX, legendY, avatarSize, avatarSize);
          ctx.restore();
          ctx.save();
        } else {
          // Colored circle placeholder
          ctx.beginPath();
          ctx.arc(legendX + avatarSize / 2, legendY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = dataset._color;
          ctx.fill();
          ctx.restore();
          ctx.save();
        }

        ctx.fillStyle = dataset._color;
        ctx.font = 'bold 12px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(dataset.label, textX, legendY + avatarSize / 2);
        ctx.restore();

        legendY += avatarSize + 12;
      });
    },
  };

  const config: ChartConfiguration = {
    type: 'line',
    data: {
      datasets: processedDatasets.map(ds => ({
        label: ds.label,
        data: ds.data,
        borderColor: ds.borderColor,
        backgroundColor: 'transparent',
        borderWidth: ds.borderWidth,
        tension: ds.tension,
        // Hide default Chart.js points — we draw them ourselves
        pointRadius: 0,
        pointHoverRadius: 0,
      })) as any,
    },
    options: {
      animation: false as any,
      layout: {
        padding: { top: 10, right: 160, bottom: 20, left: 10 },
      },
      plugins: {
        legend: { display: false }, // Use our custom legend plugin
        title: {
          display: true,
          text: chartTitle,
          color: '#ffffff',
          font: { size: 20, weight: 'bold' },
          padding: { top: 10, bottom: 10 },
        },
        datalabels: {
          color: ((context: any) => processedDatasets[context.datasetIndex]?._color ?? '#fff') as any,
          font: { weight: 'bold', size: 10 } as any,
          formatter: ((_value: any, context: any) => {
            const pm = processedDatasets[context.datasetIndex]?._pointMeta[context.dataIndex];
            return pm?.labelText ?? '';
          }) as any,
          align: 'top',
          offset: 16,
          backgroundColor: 'rgba(0,0,0,0.6)',
          borderRadius: 4,
          padding: { top: 3, bottom: 3, left: 5, right: 5 },
          display: ((context: any) => {
            const pm = processedDatasets[context.datasetIndex]?._pointMeta[context.dataIndex];
            return pm?.isOutlier ? true : false;
          }) as any,
        },
      } as any,
      scales: {
        x: {
          type: 'time',
          min: paddedMin,
          max: paddedMax,
          time: { unit: 'hour', displayFormats: { hour: 'HH:mm' } },
          ticks: { color: '#ffffff', font: { weight: 'bold', size: 10 } },
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
        },
        y: {
          ticks: {
            color: '#b9bbbe',
            font: { weight: 'bold', size: 10 },
            callback: (value: any) => {
              const num = Number(value);
              if (num >= 3200) return `Master+ ${num - 3200}LP`;
              const tiers = ['Unranked', 'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond'];
              const t = Math.floor(num / 400);
              const tierStr = tiers[t] || 'Unknown';
              const rem = num % 400;
              const ds = ['IV', 'III', 'II', 'I'];
              const div = ds[Math.floor(rem / 100)] || 'IV';
              const lp = rem % 100;
              return `${tierStr} ${div} ${lp}LP`;
            },
          },
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
        },
      },
    },
    plugins: [backgroundPlugin as any, pointDrawPlugin as any, legendPlugin as any],
  };

  const renderer = new ChartJSNodeCanvas({
    width: 1000,
    height: 500,
    backgroundColour: '#2b2d31',
    plugins: {
      requireLegacy: ['chartjs-adapter-date-fns'],
      modern: [ChartDataLabels],
    },
  });

  return renderer.renderToBuffer(config);
}
