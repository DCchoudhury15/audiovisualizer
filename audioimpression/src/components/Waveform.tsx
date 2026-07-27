const Waveform = ({ data, title }: { data: number[]; title: string }) => {
  if (!data || data.length === 0) return null;

  const width = 600;
  const height = 300;
  const centerY = height / 2;

  const validData = data.filter((val) => !isNaN(val) && isFinite(val));
  if (validData.length === 0) return null;

  const min = Math.min(...validData);
  const max = Math.max(...validData);
  const range = max - min;
  const scaleY = height * 0.45;

  const pathData = validData
    .map((sample, i) => {
      const x = (i / (validData.length - 1)) * width;
      let y = centerY;

      if (range > 0) {
        const normalizedSample = (sample - min) / range; // 0 - 1
        y = centerY - (normalizedSample - 0.5) * 2 * scaleY;
      }

      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  // Close the path back to the baseline so we can fill the area underneath.
  const areaData = `${pathData} L ${width} ${centerY} L 0 ${centerY} Z`;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-1 items-center justify-center">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="block max-h-[300px] max-w-full rounded-lg border border-slate-700/60 bg-slate-950"
        >
          <defs>
            <linearGradient id="waveform-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`M 0 ${centerY} H ${width}`}
            stroke="#1e293b"
            strokeWidth="1"
          />
          {range > 0 && <path d={areaData} fill="url(#waveform-fill)" />}
          <path
            d={pathData}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">{title}</p>
    </div>
  );
};

export default Waveform;