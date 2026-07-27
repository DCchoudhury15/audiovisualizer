"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { env } from "~/env";
import ColorScale from "~/components/ui/ColorScale";
import FeatureMap from "~/components/ui/FeatureMap";
import LayerPipeline from "~/components/ui/LayerPipeline";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import Waveform from "~/components/Waveform";
import { COLORMAPS, type ColormapName } from "~/lib/colors";
import { useCountUp } from "~/lib/useCountUp";
import { cn } from "~/lib/utils";

// --- INTERFACES AND DATA ---

interface Prediction {
  class: string;
  confidence: number;
}

interface LayerData {
  shape: number[];
  values: number[][];
}

type VisualizationData = Record<string, LayerData>;

interface WaveformData {
  values: number[];
  sample_rate: number;
  duration: number;
}

interface ApiResponse {
  predictions: Prediction[];
  visualization: VisualizationData;
  input_spectrogram: LayerData;
  waveform: WaveformData;
}

const DEFAULT_API_URL =
  "https://dcchoudhury15--audio-cnn-inference-audioclassifier-inference.modal.run";

const API_URL = env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;

const ESC50_EMOJI_MAP: Record<string, string> = {
  dog: "🐕",
  rain: "🌧️",
  crying_baby: "👶",
  door_wood_knock: "🚪",
  helicopter: "🚁",
  rooster: "🐓",
  sea_waves: "🌊",
  sneezing: "🤧",
  mouse_click: "🖱️",
  chainsaw: "🪚",
  pig: "🐷",
  crackling_fire: "🔥",
  clapping: "👏",
  keyboard_typing: "⌨️",
  siren: "🚨",
  cow: "🐄",
  crickets: "🦗",
  breathing: "💨",
  door_wood_creaks: "🚪",
  car_horn: "📯",
  frog: "🐸",
  chirping_birds: "🐦",
  coughing: "😷",
  can_opening: "🥫",
  engine: "🚗",
  cat: "🐱",
  water_drops: "💧",
  footsteps: "👣",
  washing_machine: "🧺",
  train: "🚂",
  hen: "🐔",
  wind: "💨",
  laughing: "😂",
  vacuum_cleaner: "🧹",
  church_bells: "🔔",
  insects: "🦟",
  pouring_water: "🚰",
  brushing_teeth: "🪥",
  clock_alarm: "⏰",
  airplane: "✈️",
  sheep: "🐑",
  toilet_flush: "🚽",
  snoring: "😴",
  clock_tick: "⏱️",
  fireworks: "🎆",
  crow: "🐦‍⬛",
  thunderstorm: "⛈️",
  drinking_sipping: "🥤",
  glass_breaking: "🔨",
  hand_saw: "🪚",
};

const getEmojiForClass = (className: string): string => {
  return ESC50_EMOJI_MAP[className] ?? "🔈";
};

const humanize = (className: string): string =>
  className.replaceAll("_", " ");

function splitLayers(visualization: VisualizationData) {
  const main: [string, LayerData][] = [];
  const internals: Record<string, [string, LayerData][]> = {};

  for (const [name, data] of Object.entries(visualization)) {
    if (!name.includes(".")) {
      main.push([name, data]);
    } else {
      const [parent] = name.split(".");
      if (!parent) continue;
      (internals[parent] ??= []).push([name, data]);
    }
  }

  return { main, internals };
}

// FileReader.readAsDataURL gives us `data:<mime>;base64,<payload>` — pulling
// off the prefix is far faster and safer than building a binary string byte by
// byte (the old reduce() approach was O(n²) in string concatenation for large
// WAV files and could blow the stack on big inputs).
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read the file."));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error("Failed to read the file."));
    reader.readAsDataURL(file);
  });

type LightboxState = {
  title: string;
  data: number[][];
  spectrogram?: boolean;
} | null;

export default function HomePage() {
  const [vizData, setVizData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [colormap, setColormap] = useState<ColormapName>("diverging");
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const analyseFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setIsLoading(true);
    setError(null);
    setVizData(null);

    try {
      const base64String = await fileToBase64(file);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_data: base64String }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API Error: ${response.statusText}${errorText ? ` — ${errorText}` : ""}`,
        );
      }

      const data = (await response.json()) as ApiResponse;
      setVizData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) await analyseFile(file);
    // Allow re-selecting the same file (triggers change again)
    event.target.value = "";
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (isLoading) return;
    const file = event.dataTransfer.files?.[0];
    if (file) await analyseFile(file);
  };

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const { main, internals } = vizData
    ? splitLayers(vizData.visualization)
    : { main: [], internals: {} };

  const topPred = vizData?.predictions?.[0];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <header className="mb-12 text-center">
          <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-indigo-500/20 ring-1 ring-cyan-400/30">
            <span className="text-2xl" aria-hidden>
              🎧
            </span>
          </div>
          <h1 className="bg-gradient-to-r from-slate-100 via-cyan-200 to-indigo-200 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
            CNN Audio Visualizer
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-slate-400 sm:text-base">
            Upload a WAV file to see the model&apos;s predictions, the input
            spectrogram, waveform, and every convolutional layer&apos;s feature
            maps.
          </p>

          <div
            className={`relative mx-auto mt-8 max-w-md rounded-2xl border-2 border-dashed p-8 transition-colors ${
              isDragging
                ? "border-cyan-400 bg-cyan-400/5"
                : "border-slate-700 bg-slate-900/40 hover:border-slate-600"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              if (!isLoading) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".wav,audio/wav"
              id="file-upload"
              onChange={handleFileChange}
              disabled={isLoading}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <div className="flex flex-col items-center gap-3 text-center">
              <span
                className="text-sm font-medium text-slate-300"
                aria-hidden
              >
                {isLoading
                  ? "Analysing…"
                  : isDragging
                    ? "Drop to upload"
                    : "Drop a WAV file here"}
              </span>
              {!isLoading && (
                <span className="text-xs text-slate-500">
                  or{" "}
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="font-medium text-cyan-400 underline-offset-4 hover:underline"
                  >
                    browse your files
                  </button>
                </span>
              )}
            </div>
          </div>

          {fileName && (
            <Badge
              variant="secondary"
              className="mt-4 border-slate-700 bg-slate-800/80 font-normal text-slate-300"
            >
              {isLoading && (
                <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
              )}
              {fileName}
            </Badge>
          )}
        </header>

        {error && (
          <Card className="mb-10 border-red-500/30 bg-red-500/10 backdrop-blur">
            <CardContent className="flex items-start gap-3 p-4">
              <span className="mt-0.5 text-red-400" aria-hidden>
                ⚠️
              </span>
              <p className="text-sm text-red-300">{error}</p>
            </CardContent>
          </Card>
        )}

        {isLoading && !vizData && <LoadingSkeleton />}

        {vizData && (
          <div className="space-y-8">
            <StatsRow
              duration={vizData.waveform.duration}
              sampleRate={vizData.waveform.sample_rate}
              layerCount={main.length}
              topClass={topPred?.class}
            />

            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-slate-100">
                  Top Predictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {vizData.predictions.slice(0, 3).map((pred, i) => (
                    <PredictionRow
                      key={pred.class}
                      pred={pred}
                      rank={i}
                      colormap={colormap}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-slate-100">
                    Input Spectrogram
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FeatureMap
                    data={vizData.input_spectrogram.values}
                    title={`${vizData.input_spectrogram.shape.join(" × ")}`}
                    spectrogram
                    colormap={colormap}
                    onClick={() =>
                      setLightbox({
                        title: `Input Spectrogram · ${vizData.input_spectrogram.shape.join(" × ")}`,
                        data: vizData.input_spectrogram.values,
                        spectrogram: true,
                      })
                    }
                  />
                  <div className="mt-5 flex justify-end">
                    <ColorScale width={200} height={16} min={-1} max={1} colormap={colormap} />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-slate-100">
                    Audio Waveform
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Waveform
                    data={vizData.waveform.values}
                    title={`${vizData.waveform.duration.toFixed(2)}s · ${vizData.waveform.sample_rate} Hz`}
                  />
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-slate-100">
                  Network Architecture
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-slate-500">
                  Forward pass through the ResNet-style AudioCNN — each stage
                  shows the spatial size of its channel-averaged activation map.
                </p>
                <LayerPipeline layers={main} />
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="text-slate-100">
                  Convolutional Layer Outputs
                </CardTitle>
                <ColormapSelector value={colormap} onChange={setColormap} />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {main.map(([mainName, mainData]) => (
                    <div key={mainName} className="space-y-4">
                      <div>
                        <h4 className="mb-2 text-sm font-medium text-slate-300">
                          {mainName}
                        </h4>
                        <FeatureMap
                          data={mainData.values}
                          title={`${mainData.shape.join(" × ")}`}
                          colormap={colormap}
                          onClick={() =>
                            setLightbox({
                              title: `${mainName} · ${mainData.shape.join(" × ")}`,
                              data: mainData.values,
                            })
                          }
                        />
                      </div>

                      {internals[mainName] && (
                        <div className="h-80 overflow-y-auto rounded-lg border border-slate-700/60 bg-slate-950/60 p-2">
                          <div className="space-y-3">
                            {internals[mainName]
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([layerName, layerData]) => (
                                <FeatureMap
                                  key={layerName}
                                  data={layerData.values}
                                  title={layerName.replace(`${mainName}.`, "")}
                                  internal
                                  colormap={colormap}
                                  onClick={() =>
                                    setLightbox({
                                      title: `${layerName} · ${layerData.shape.join(" × ")}`,
                                      data: layerData.values,
                                    })
                                  }
                                />
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex justify-end">
                  <ColorScale width={200} height={16} min={-1} max={1} colormap={colormap} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <footer className="mt-16 text-center text-xs text-slate-600">
          ResNet-style AudioCNN · ESC-50 · inference on Modal A10G
        </footer>
      </div>

      {lightbox && (
        <Lightbox
          state={lightbox}
          colormap={colormap}
          onClose={() => setLightbox(null)}
        />
      )}
    </main>
  );
}

function PredictionRow({
  pred,
  rank,
  colormap,
}: {
  pred: Prediction;
  rank: number;
  colormap: ColormapName;
}) {
  const animated = useCountUp(pred.confidence * 100);
  const isTop = rank === 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <span className="text-lg">{getEmojiForClass(pred.class)}</span>
          <span className="capitalize">{humanize(pred.class)}</span>
          {isTop && (
            <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              top match
            </Badge>
          )}
        </div>
        <Badge
          variant={isTop ? "default" : "secondary"}
          className={
            isTop
              ? "border-transparent bg-cyan-400 text-slate-900"
              : "bg-slate-800 text-slate-300"
          }
        >
          {animated.toFixed(1)}%
        </Badge>
      </div>
      <Progress
        value={animated}
        className={cn(
          "h-2",
          isTop && "[&_[data-slot=progress-indicator]]:bg-cyan-400",
          colormap === "diverging"
            ? ""
            : "[&_[data-slot=progress-indicator]]:bg-indigo-400",
        )}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 backdrop-blur">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-100">{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function StatsRow({
  duration,
  sampleRate,
  layerCount,
  topClass,
}: {
  duration: number;
  sampleRate: number;
  layerCount: number;
  topClass?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatTile label="Duration" value={`${duration.toFixed(2)}s`} hint="audio length" />
      <StatTile
        label="Sample rate"
        value={`${sampleRate.toLocaleString()}`}
        hint="Hz"
      />
      <StatTile label="Conv stages" value={`${layerCount}`} hint="feature maps" />
      <StatTile
        label="Top class"
        value={topClass ? `${getEmojiForClass(topClass)} ${humanize(topClass)}` : "—"}
        hint={topClass ? "highest confidence" : undefined}
      />
    </div>
  );
}

function ColormapSelector({
  value,
  onChange,
}: {
  value: ColormapName;
  onChange: (c: ColormapName) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-slate-950/60 p-1">
      {COLORMAPS.map((cm) => (
        <button
          key={cm.id}
          type="button"
          onClick={() => onChange(cm.id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === cm.id
              ? "bg-cyan-400 text-slate-900"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          {cm.label}
        </button>
      ))}
    </div>
  );
}

function Lightbox({
  state,
  colormap,
  onClose,
}: {
  state: NonNullable<LightboxState>;
  colormap: ColormapName;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={state.title}
    >
      <div
        className="relative max-h-full w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-sm font-medium text-slate-200">{state.title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <FeatureMap
            data={state.data}
            title={state.title}
            spectrogram={state.spectrogram}
            colormap={colormap}
          />
        </div>
        <p className="mt-4 flex justify-end">
          <ColorScale width={260} height={16} min={-1} max={1} colormap={colormap} />
        </p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[78px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/60"
          />
        ))}
      </div>
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader>
          <div className="h-5 w-40 animate-pulse rounded bg-slate-800" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-1/2 animate-pulse rounded bg-slate-800" />
                <div className="h-2 w-full animate-pulse rounded-full bg-slate-800" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="border-slate-800 bg-slate-900/60">
            <CardHeader>
              <div className="h-5 w-32 animate-pulse rounded bg-slate-800" />
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full animate-pulse rounded-lg bg-slate-800/70" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}