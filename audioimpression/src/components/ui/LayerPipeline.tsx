type LayerData = { shape: number[]; values: number[][] };

const LayerPipeline = ({ layers }: { layers: [string, LayerData][] }) => {
  if (!layers.length) return null;

  return (
    <div className="flex w-full items-stretch gap-2 overflow-x-auto pb-2">
      {layers.map(([name, data], i) => {
        const [h, w] = data.shape.slice(-2);
        return (
          <div key={name} className="flex items-stretch gap-2">
            <div className="flex min-w-[88px] flex-col justify-center rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-center">
              <span className="text-xs font-semibold text-cyan-300">{name}</span>
              <span className="mt-0.5 text-[10px] text-slate-500">
                {h && w ? `${h} × ${w}` : "—"}
              </span>
            </div>
            {i < layers.length - 1 && (
              <div className="flex items-center text-slate-600" aria-hidden>
                →
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default LayerPipeline;