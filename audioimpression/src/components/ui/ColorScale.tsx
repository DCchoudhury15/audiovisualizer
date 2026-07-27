import { getGradientCss, type ColormapName } from "~/lib/colors";

const ColorScale = ({
  width = 200,
  height = 16,
  min = -1,
  max = 1,
  colormap = "diverging",
}: {
  width?: number;
  height?: number;
  min?: number;
  max?: number;
  colormap?: ColormapName;
}) => {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500">{min}</span>
      <div
        className="rounded border border-slate-700/60"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          background: getGradientCss(colormap),
        }}
      />
      <span className="text-xs text-slate-500">{max}</span>
    </div>
  );
};

export default ColorScale;