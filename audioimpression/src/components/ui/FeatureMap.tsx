import { getColor, type ColormapName } from "~/lib/colors";

type FeatureMapProps = {
  data: number[][];
  title: string;
  internal?: boolean;
  spectrogram?: boolean;
  colormap?: ColormapName;
  onClick?: () => void;
};

const FeatureMap = ({
  data,
  title,
  internal,
  spectrogram,
  colormap = "diverging",
  onClick,
}: FeatureMapProps) => {
  if (!data?.length || !data[0]?.length) return null;

  const mapHeight = data.length;
  const mapWidth = data[0].length;

  const absMax = data
    .flat()
    .reduce((acc, val) => Math.max(acc, Math.abs(val ?? 0)), 0);

  const interactive = !!onClick;

  return (
    <div className="group w-full text-center">
      <svg
        viewBox={`0 0 ${mapWidth} ${mapHeight}`}
        preserveAspectRatio="none"
        className={`mx-auto block rounded-lg border border-slate-700/60 bg-slate-950 ${onClick ? "cursor-zoom-in transition-opacity group-hover:opacity-90" : ""} ${internal ? "w-full max-w-32" : spectrogram ? "w-full object-contain" : "max-h-[300px] w-full max-w-[500px] object-contain"}`}
        onClick={onClick}
        role={interactive ? "button" : undefined}
        aria-label={interactive ? `Zoom into ${title}` : undefined}
      >
        {data.flatMap((row, i) =>
          row.map((value, j) => {
            const normalizedValues = absMax === 0 ? 0 : value / absMax;
            const [r, g, b] = getColor(normalizedValues, colormap);
            return (
              <rect
                key={`${i}-${j}`}
                x={j}
                y={i}
                width={1}
                height={1}
                fill={`rgb(${r},${g},${b})`}
              />
            );
          }),
        )}
      </svg>
      <p className="mt-1 text-xs text-slate-500">
        {title}
        {interactive && (
          <span className="ml-1 text-slate-600 group-hover:text-slate-400">
            🔍
          </span>
        )}
      </p>
    </div>
  );
};

export default FeatureMap;