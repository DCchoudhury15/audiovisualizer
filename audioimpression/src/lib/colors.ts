export type ColormapName = "diverging" | "viridis" | "magma" | "grayscale";

export const COLORMAPS: { id: ColormapName; label: string }[] = [
  { id: "diverging", label: "Diverging" },
  { id: "viridis", label: "Viridis" },
  { id: "magma", label: "Magma" },
  { id: "grayscale", label: "Grayscale" },
];

// Sampled stops (0 → 1) approximating the matplotlib colormaps.
const VIRIDIS: [number, number, number][] = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];

const MAGMA: [number, number, number][] = [
  [0, 0, 4],
  [81, 18, 124],
  [183, 55, 121],
  [251, 150, 90],
  [252, 253, 191],
];

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function interpolate(
  stops: [number, number, number][],
  t: number,
): [number, number, number] {
  const ct = clamp01(t);
  const seg = ct * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = stops[i] ?? [0, 0, 0];
  const b = stops[i + 1] ?? [0, 0, 0];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

function diverging(value: number): [number, number, number] {
  // value in [-1, 1]; 0 → white, positive → blue, negative → orange.
  let r: number;
  let g: number;
  let b: number;
  if (value > 0) {
    r = 255 * (1 - value * 0.8);
    g = 255 * (1 - value * 0.5);
    b = 255;
  } else {
    r = 255;
    g = 255 * (1 + value * 0.5);
    b = 255 * (1 + value * 0.8);
  }
  return [Math.round(r), Math.round(g), Math.round(b)];
}

export const getColor = (
  value: number,
  colormap: ColormapName = "diverging",
): [number, number, number] => {
  switch (colormap) {
    case "viridis":
      return interpolate(VIRIDIS, (value + 1) / 2);
    case "magma":
      return interpolate(MAGMA, (value + 1) / 2);
    case "grayscale": {
      const g = Math.round(clamp01((value + 1) / 2) * 255);
      return [g, g, g];
    }
    case "diverging":
    default:
      return diverging(value);
  }
};

// CSS gradient string matching each colormap, used by the ColorScale legend.
const toRgb = ([r, g, b]: [number, number, number]) => `rgb(${r},${g},${b})`;

function gradientFromStops(stops: [number, number, number][]): string {
  const parts = stops.map(
    (c, i) => `${toRgb(c)} ${Math.round((i / (stops.length - 1)) * 100)}%`,
  );
  return `linear-gradient(to right, ${parts.join(", ")})`;
}

export const getGradientCss = (colormap: ColormapName): string => {
  switch (colormap) {
    case "viridis":
      return gradientFromStops(VIRIDIS);
    case "magma":
      return gradientFromStops(MAGMA);
    case "grayscale":
      return "linear-gradient(to right, rgb(0,0,0), rgb(255,255,255))";
    case "diverging":
    default:
      return "linear-gradient(to right, rgb(255, 128, 51), rgb(255, 255, 255), rgb(51,128, 255))";
  }
};