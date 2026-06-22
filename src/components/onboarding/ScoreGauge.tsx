// ScoreGauge — jauge ronde SVG autonome (0-100) pour le diagnostic et l'écran final.

type Props = {
  score: number;
  level?: string | null;
  size?: number;
  caption?: string;
};

function colorForScore(score: number): string {
  if (score >= 80) return '#10b981'; // emerald-500
  if (score >= 60) return '#06b6d4'; // cyan-500
  if (score >= 30) return '#6366f1'; // primary
  return '#f59e0b'; // amber-500
}

const LEVEL_LABEL: Record<string, string> = {
  emerging: 'Émergent',
  established: 'Établi',
  advanced: 'Avancé',
  optimized: 'Optimisé',
};

export default function ScoreGauge({ score, level, size = 140, caption }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const color = colorForScore(clamped);
  const strokeW = 10;
  const r = size / 2 - strokeW;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  const cx = size / 2;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Score de maturité ${clamped} sur 100`}
      >
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeW} />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: 'stroke-dashoffset 700ms ease' }}
        />
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          style={{ fontSize: size * 0.26, fontWeight: 700 }}
        >
          {clamped}
        </text>
        <text
          x="50%"
          y="64%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          style={{ fontSize: size * 0.1, opacity: 0.5 }}
        >
          / 100
        </text>
      </svg>
      {(level || caption) && (
        <div className="mt-1 text-center">
          {level && (
            <span className="text-sm font-semibold text-foreground">
              {LEVEL_LABEL[level] ?? level}
            </span>
          )}
          {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
        </div>
      )}
    </div>
  );
}
