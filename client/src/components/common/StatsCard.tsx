import { useEffect, useState, type ReactNode } from 'react';
import { FaArrowUp, FaArrowDown } from 'react-icons/fa';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  trend?: 'up' | 'down';
  trendValue?: string;
  subtitle?: string;
}

const colorStyles: Record<string, { bg: string; gradient: string }> = {
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    gradient: 'from-blue-500 to-blue-600',
  },
  green: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    gradient: 'from-green-500 to-green-600',
  },
  yellow: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    gradient: 'from-yellow-500 to-yellow-600',
  },
  red: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    gradient: 'from-red-500 to-red-600',
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    gradient: 'from-purple-500 to-purple-600',
  },
};

function AnimatedValue({ value }: { value: string | number }) {
  const [display, setDisplay] = useState<string | number>(0);

  useEffect(() => {
    const target = typeof value === 'string' ? parseFloat(value) || 0 : value;
    const duration = 600;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);

      if (typeof value === 'string' && isNaN(Number(value))) {
        setDisplay(value);
      } else {
        setDisplay(current.toLocaleString());
      }

      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <>{display}</>;
}

export default function StatsCard({
  title,
  value,
  icon,
  color = 'blue',
  trend,
  trendValue,
  subtitle,
}: StatsCardProps) {
  const styles = colorStyles[color];

  return (
    <div className="stat-card group hover:shadow-md transition-shadow duration-200">
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br ${styles.gradient} text-white shadow-sm`}
      >
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          <AnimatedValue value={value} />
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {title}
        </p>

        {(trend || subtitle) && (
          <div className="flex items-center gap-2 mt-1">
            {trend && trendValue && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                  trend === 'up'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {trend === 'up' ? (
                  <FaArrowUp className="w-2.5 h-2.5" />
                ) : (
                  <FaArrowDown className="w-2.5 h-2.5" />
                )}
                {trendValue}
              </span>
            )}
            {subtitle && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
