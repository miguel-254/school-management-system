import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import { useEffect, useState } from 'react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

function isDarkMode(): boolean {
  try {
    return localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark');
  } catch {
    return false;
  }
}

function useThemeColors() {
  const [dark, setDark] = useState(isDarkMode);

  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDarkMode()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return {
    gridColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    textColor: dark ? '#9ca3af' : '#6b7280',
    tooltipBg: dark ? '#1f2937' : '#ffffff',
    tooltipBorder: dark ? '#374151' : '#e5e7eb',
  };
}

interface ChartProps {
  data: ChartData<'line'> | ChartData<'bar'> | ChartData<'pie'> | ChartData<'doughnut'>;
  options?: ChartOptions<'line'> | ChartOptions<'bar'> | ChartOptions<'pie'> | ChartOptions<'doughnut'>;
  height?: number;
  wrapperClass?: string;
}

const defaultOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: { usePointStyle: true, padding: 16, font: { size: 12 } },
    },
    tooltip: {
      backgroundColor: '#1f2937',
      titleFont: { size: 13 },
      bodyFont: { size: 12 },
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(0,0,0,0.06)' },
      ticks: { color: '#6b7280', font: { size: 11 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.06)' },
      ticks: { color: '#6b7280', font: { size: 11 } },
    },
  },
};

export function LineChart({ data, options, height = 300, wrapperClass = '' }: ChartProps) {
  const colors = useThemeColors();
  const opts = options as ChartOptions<'line'> | undefined;

  const mergedOptions: ChartOptions<'line'> = {
    ...defaultOptions,
    ...opts,
    scales: {
      x: {
        ...defaultOptions.scales?.x,
        ...opts?.scales?.x,
        grid: { color: colors.gridColor },
        ticks: { color: colors.textColor, font: { size: 11 } },
      },
      y: {
        ...defaultOptions.scales?.y,
        ...opts?.scales?.y,
        grid: { color: colors.gridColor },
        ticks: { color: colors.textColor, font: { size: 11 } },
      },
    },
    plugins: {
      ...defaultOptions.plugins,
      ...opts?.plugins,
      legend: {
        ...defaultOptions.plugins?.legend,
        ...opts?.plugins?.legend,
        labels: {
          ...defaultOptions.plugins?.legend?.labels,
          ...(opts?.plugins?.legend as any)?.labels,
          color: colors.textColor,
        },
      },
      tooltip: {
        ...defaultOptions.plugins?.tooltip,
        ...opts?.plugins?.tooltip,
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
      },
    },
  };

  return (
    <div className={`w-full ${wrapperClass}`} style={{ height: `${height}px` }}>
      <Line data={data as ChartData<'line'>} options={mergedOptions} />
    </div>
  );
}

export function BarChart({ data, options, height = 300, wrapperClass = '' }: ChartProps) {
  const colors = useThemeColors();
  const opts = options as ChartOptions<'bar'> | undefined;

  const mergedOptions: ChartOptions<'bar'> = {
    ...defaultOptions,
    ...opts,
    scales: {
      x: {
        ...defaultOptions.scales?.x,
        ...opts?.scales?.x,
        grid: { color: colors.gridColor },
        ticks: { color: colors.textColor, font: { size: 11 } },
      },
      y: {
        ...defaultOptions.scales?.y,
        ...opts?.scales?.y,
        grid: { color: colors.gridColor },
        ticks: { color: colors.textColor, font: { size: 11 } },
      },
    },
    plugins: {
      ...defaultOptions.plugins,
      ...opts?.plugins,
      legend: {
        ...defaultOptions.plugins?.legend,
        ...opts?.plugins?.legend,
        labels: {
          ...defaultOptions.plugins?.legend?.labels,
          ...(opts?.plugins?.legend as any)?.labels,
          color: colors.textColor,
        },
      },
      tooltip: {
        ...defaultOptions.plugins?.tooltip,
        ...opts?.plugins?.tooltip,
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
      },
    },
  };

  return (
    <div className={`w-full ${wrapperClass}`} style={{ height: `${height}px` }}>
      <Bar data={data as ChartData<'bar'>} options={mergedOptions} />
    </div>
  );
}

export function PieChart({ data, options, height = 300, wrapperClass = '' }: ChartProps) {
  const colors = useThemeColors();
  const opts = options as ChartOptions<'pie'> | undefined;

  const mergedOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    ...opts,
    plugins: {
      ...defaultOptions.plugins,
      ...opts?.plugins,
      legend: {
        ...defaultOptions.plugins?.legend,
        ...opts?.plugins?.legend,
        labels: {
          ...defaultOptions.plugins?.legend?.labels,
          ...(opts?.plugins?.legend as any)?.labels,
          color: colors.textColor,
        },
      },
      tooltip: {
        ...defaultOptions.plugins?.tooltip,
        ...opts?.plugins?.tooltip,
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
      },
    },
  };

  return (
    <div className={`w-full ${wrapperClass}`} style={{ height: `${height}px` }}>
      <Pie data={data as ChartData<'pie'>} options={mergedOptions} />
    </div>
  );
}

export function DoughnutChart({ data, options, height = 300, wrapperClass = '' }: ChartProps) {
  const colors = useThemeColors();
  const opts = options as ChartOptions<'doughnut'> | undefined;

  const mergedOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    ...opts,
    plugins: {
      ...defaultOptions.plugins,
      ...opts?.plugins,
      legend: {
        ...defaultOptions.plugins?.legend,
        ...opts?.plugins?.legend,
        labels: {
          ...defaultOptions.plugins?.legend?.labels,
          ...(opts?.plugins?.legend as any)?.labels,
          color: colors.textColor,
        },
      },
      tooltip: {
        ...defaultOptions.plugins?.tooltip,
        ...opts?.plugins?.tooltip,
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
      },
    },
  };

  return (
    <div className={`w-full ${wrapperClass}`} style={{ height: `${height}px` }}>
      <Doughnut data={data as ChartData<'doughnut'>} options={mergedOptions} />
    </div>
  );
}