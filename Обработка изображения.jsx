import React, { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Download, Sparkles, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PALETTES = {
  original: {
    label: "Original",
    map: (r: number, g: number, b: number) => ({ r, g, b }),
  },
  warm: {
    label: "Warm",
    map: (r: number, g: number, b: number) => {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return {
        r: Math.min(255, l * 1.08 + 28),
        g: Math.min(255, l * 0.86 + 8),
        b: Math.min(255, l * 0.45),
      };
    },
  },
  lime: {
    label: "Lime",
    map: (r: number, g: number, b: number) => {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return {
        r: Math.min(255, l * 0.9 + 18),
        g: Math.min(255, l * 1.12 + 36),
        b: Math.min(255, l * 0.22),
      };
    },
  },
  mono: {
    label: "Mono",
    map: (r: number, g: number, b: number) => {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return { r: l, g: l, b: l };
    },
  },
  ocean: {
    label: "Ocean",
    map: (r: number, g: number, b: number) => {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return {
        r: l * 0.2,
        g: Math.min(255, l * 0.72 + 22),
        b: Math.min(255, l * 1.12 + 40),
      };
    },
  },
  candy: {
    label: "Candy",
    map: (r: number, g: number, b: number) => {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return {
        r: Math.min(255, l * 1.18 + 34),
        g: Math.min(255, l * 0.62 + 14),
        b: Math.min(255, l * 0.95 + 52),
      };
    },
  },
  custom: {
    label: "Custom",
    map: (r: number, g: number, b: number) => ({ r, g, b }),
  },
} as const;

type PaletteKey = keyof typeof PALETTES;
type RGB = { r: number; g: number; b: number };
type Point = {
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  radius: number;
  r: number;
  g: number;
  b: number;
};

function hexToRgb(hex: string): RGB {
  const normalized = hex.replace("#", "");
  const safeHex = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized.padEnd(6, "0").slice(0, 6);

  const value = parseInt(safeHex, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function mixColor(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function mapCustomPalette(luminance: number, shadowHex: string, midHex: string, lightHex: string): RGB {
  const shadow = hexToRgb(shadowHex);
  const mid = hexToRgb(midHex);
  const light = hexToRgb(lightHex);
  const t = Math.max(0, Math.min(1, luminance / 255));

  if (t < 0.5) {
    return mixColor(shadow, mid, t / 0.5);
  }

  return mixColor(mid, light, (t - 0.5) / 0.5);
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export default function HalftoneImageProcessorTool() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [dotSpacing, setDotSpacing] = useState([12]);
  const [maxDotSize, setMaxDotSize] = useState([10]);
  const [blurAmount, setBlurAmount] = useState([2]);
  const [glowAmount, setGlowAmount] = useState([10]);
  const [noiseAmount, setNoiseAmount] = useState([0.08]);
  const [backgroundGray, setBackgroundGray] = useState([228]);
  const [renderScale, setRenderScale] = useState([1]);
  const [transparentBg, setTransparentBg] = useState(false);
  const [palette, setPalette] = useState<PaletteKey>("original");
  const [alphaCutoff, setAlphaCutoff] = useState([0.08]);
  const [luminanceCutoff, setLuminanceCutoff] = useState([242]);
  const [customShadow, setCustomShadow] = useState("#2d1700");
  const [customMid, setCustomMid] = useState("#d9ff1f");
  const [customLight, setCustomLight] = useState("#fff7b0");
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [animationDuration, setAnimationDuration] = useState([2.2]);
  const [scatterStrength, setScatterStrength] = useState([180]);
  const [autoReplay, setAutoReplay] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const rafRef = useRef<number | null>(null);
  const animationStartRef = useRef<number>(0);

  const controls = useMemo(
    () => ({
      dotSpacing: dotSpacing[0],
      maxDotSize: maxDotSize[0],
      blurAmount: blurAmount[0],
      glowAmount: glowAmount[0],
      noiseAmount: noiseAmount[0],
      backgroundGray: backgroundGray[0],
      renderScale: renderScale[0],
      transparentBg,
      palette,
      alphaCutoff: alphaCutoff[0],
      luminanceCutoff: luminanceCutoff[0],
      customShadow,
      customMid,
      customLight,
      animationEnabled,
      animationDuration: animationDuration[0],
      scatterStrength: scatterStrength[0],
      autoReplay,
    }),
    [
      dotSpacing,
      maxDotSize,
      blurAmount,
      glowAmount,
      noiseAmount,
      backgroundGray,
      renderScale,
      transparentBg,
      palette,
      alphaCutoff,
      luminanceCutoff,
      customShadow,
      customMid,
      customLight,
      animationEnabled,
      animationDuration,
      scatterStrength,
      autoReplay,
    ]
  );

  const stopAnimation = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsAnimating(false);
  };

  const drawFrame = (progress: number) => {
    const canvas = outputCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const eased = easeOutCubic(progress);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!controls.transparentBg) {
      ctx.fillStyle = `rgb(${controls.backgroundGray}, ${controls.backgroundGray}, ${controls.backgroundGray})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.save();
    ctx.filter = `blur(${controls.blurAmount}px)`;

    for (const point of pointsRef.current) {
      const x = point.startX + (point.targetX - point.startX) * eased;
      const y = point.startY + (point.targetY - point.startY) * eased;
      const revealRadius = point.radius * (0.2 + eased * 0.8);
      const alpha = 0.15 + eased * 0.85;

      ctx.shadowColor = `rgba(${point.r}, ${point.g}, ${point.b}, ${0.42 * eased})`;
      ctx.shadowBlur = controls.glowAmount;
      ctx.fillStyle = `rgba(${point.r}, ${point.g}, ${point.b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, revealRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const playAnimation = () => {
    if (!pointsRef.current.length) return;
    stopAnimation();
    setIsAnimating(true);
    animationStartRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - animationStartRef.current) / 1000;
      const progress = Math.min(1, elapsed / Math.max(0.2, controls.animationDuration));
      drawFrame(progress);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        setIsAnimating(false);
        if (controls.autoReplay) {
          animationStartRef.current = performance.now() + 350;
          rafRef.current = requestAnimationFrame(function delayedRestart(time) {
            if (time >= animationStartRef.current) {
              animationStartRef.current = performance.now();
              setIsAnimating(true);
              rafRef.current = requestAnimationFrame(tick);
            } else {
              rafRef.current = requestAnimationFrame(delayedRestart);
            }
          });
        }
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (!imageSrc) return;

    const img = new Image();
    img.onload = () => {
      const outputCanvas = outputCanvasRef.current;
      if (!outputCanvas) return;

      const maxPreviewWidth = 640;
      const previewScale = Math.min(1, maxPreviewWidth / img.width);
      const width = Math.max(1, Math.round(img.width * previewScale * controls.renderScale));
      const height = Math.max(1, Math.round(img.height * previewScale * controls.renderScale));

      outputCanvas.width = width;
      outputCanvas.height = height;

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
      if (!tempCtx) return;

      tempCtx.clearRect(0, 0, width, height);
      tempCtx.drawImage(img, 0, 0, width, height);

      const sourceData = tempCtx.getImageData(0, 0, width, height);
      const src = sourceData.data;
      const paletteMapper = PALETTES[controls.palette].map;
      const spacing = Math.max(4, controls.dotSpacing);
      const radiusCap = Math.max(1, controls.maxDotSize);
      const centerX = width / 2;
      const centerY = height / 2;
      const builtPoints: Point[] = [];

      for (let y = 0; y < height; y += spacing) {
        for (let x = 0; x < width; x += spacing) {
          const px = Math.min(width - 1, Math.floor(x));
          const py = Math.min(height - 1, Math.floor(y));
          const idx = (py * width + px) * 4;

          const r = src[idx];
          const g = src[idx + 1];
          const b = src[idx + 2];
          const a = src[idx + 3] / 255;
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const isNearWhiteBackground = a <= controls.alphaCutoff || luminance >= controls.luminanceCutoff;
          if (isNearWhiteBackground) continue;

          const darkness = 1 - luminance / 255;
          const radius = Math.max(0.8, radiusCap * (0.25 + darkness * 0.9));
          const jitter = spacing * controls.noiseAmount;
          const targetX = x + (Math.random() - 0.5) * jitter;
          const targetY = y + (Math.random() - 0.5) * jitter;
          const mapped = controls.palette === "custom"
            ? mapCustomPalette(luminance, controls.customShadow, controls.customMid, controls.customLight)
            : paletteMapper(r, g, b);

          const angle = Math.random() * Math.PI * 2;
          const distance = controls.scatterStrength * (0.45 + Math.random() * 0.8);
          const startX = centerX + Math.cos(angle) * distance + (Math.random() - 0.5) * controls.scatterStrength * 0.35;
          const startY = centerY + Math.sin(angle) * distance + (Math.random() - 0.5) * controls.scatterStrength * 0.35;

          builtPoints.push({
            targetX,
            targetY,
            startX,
            startY,
            radius,
            r: mapped.r,
            g: mapped.g,
            b: mapped.b,
          });
        }
      }

      pointsRef.current = builtPoints;

      if (controls.animationEnabled) {
        drawFrame(0);
        playAnimation();
      } else {
        drawFrame(1);
      }
    };

    img.src = imageSrc;

    return () => {
      stopAnimation();
    };
  }, [imageSrc, controls]);

  useEffect(() => {
    return () => stopAnimation();
  }, []);

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDownload = () => {
    const canvas = outputCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = controls.transparentBg ? "halftone-transparent.png" : "halftone-processed.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-black p-6 md:p-10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        <Card className="bg-white border border-gray-200 rounded-3xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-4 h-4" />
              Halftone Tool
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Изображение</Label>
              <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition px-4 py-6 cursor-pointer text-sm">
                <Upload className="w-4 h-4" />
                Загрузить
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
            </div>

            <div className="space-y-3">
              <Label>Палитра</Label>
              <Select value={palette} onValueChange={(value: PaletteKey) => setPalette(value)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Выбери палитру" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Original</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="lime">Lime</SelectItem>
                  <SelectItem value="mono">Mono</SelectItem>
                  <SelectItem value="ocean">Ocean</SelectItem>
                  <SelectItem value="candy">Candy</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {palette === "custom" && (
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div>
                  <Label className="mb-2 block">Тёмный цвет</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={customShadow} onChange={(e) => setCustomShadow(e.target.value)} className="h-10 w-14 rounded-lg border border-gray-200 bg-white" />
                    <div className="text-sm text-gray-600 font-mono">{customShadow}</div>
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Средний цвет</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={customMid} onChange={(e) => setCustomMid(e.target.value)} className="h-10 w-14 rounded-lg border border-gray-200 bg-white" />
                    <div className="text-sm text-gray-600 font-mono">{customMid}</div>
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Светлый цвет</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={customLight} onChange={(e) => setCustomLight(e.target.value)} className="h-10 w-14 rounded-lg border border-gray-200 bg-white" />
                    <div className="text-sm text-gray-600 font-mono">{customLight}</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Палитра раскладывается по светлоте: тени берут первый цвет, средние тона — второй, светлые участки — третий.
                </p>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-2"><span>Шаг точек</span><span>{dotSpacing[0]}</span></div>
                <Slider value={dotSpacing} min={4} max={28} step={1} onValueChange={setDotSpacing} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2"><span>Размер точек</span><span>{maxDotSize[0]}</span></div>
                <Slider value={maxDotSize} min={2} max={18} step={1} onValueChange={setMaxDotSize} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2"><span>Blur</span><span>{blurAmount[0]}</span></div>
                <Slider value={blurAmount} min={0} max={10} step={0.5} onValueChange={setBlurAmount} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2"><span>Glow</span><span>{glowAmount[0]}</span></div>
                <Slider value={glowAmount} min={0} max={30} step={1} onValueChange={setGlowAmount} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2"><span>Noise</span><span>{noiseAmount[0].toFixed(2)}</span></div>
                <Slider value={noiseAmount} min={0} max={0.4} step={0.01} onValueChange={setNoiseAmount} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2"><span>Удаление светлого фона</span><span>{luminanceCutoff[0]}</span></div>
                <Slider value={luminanceCutoff} min={180} max={255} step={1} onValueChange={setLuminanceCutoff} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2"><span>Alpha threshold</span><span>{alphaCutoff[0].toFixed(2)}</span></div>
                <Slider value={alphaCutoff} min={0} max={0.5} step={0.01} onValueChange={setAlphaCutoff} />
              </div>
              {!transparentBg && (
                <div>
                  <div className="flex justify-between text-sm mb-2"><span>Фон</span><span>{backgroundGray[0]}</span></div>
                  <Slider value={backgroundGray} min={180} max={245} step={1} onValueChange={setBackgroundGray} />
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Анимация сборки</p>
                  <p className="text-xs text-gray-500">Точки собираются в форму</p>
                </div>
                <Switch checked={animationEnabled} onCheckedChange={setAnimationEnabled} />
              </div>

              {animationEnabled && (
                <>
                  <div>
                    <div className="flex justify-between text-sm mb-2"><span>Скорость / длительность</span><span>{animationDuration[0].toFixed(1)} s</span></div>
                    <Slider value={animationDuration} min={0.4} max={6} step={0.1} onValueChange={setAnimationDuration} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2"><span>Сила разлёта точек</span><span>{scatterStrength[0]} px</span></div>
                    <Slider value={scatterStrength} min={40} max={420} step={10} onValueChange={setScatterStrength} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Автоповтор</p>
                      <p className="text-xs text-gray-500">Проигрывать анимацию по кругу</p>
                    </div>
                    <Switch checked={autoReplay} onCheckedChange={setAutoReplay} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={playAnimation}>
                      <Play className="w-4 h-4 mr-2" />
                      Запустить
                    </Button>
                    <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={stopAnimation}>
                      <Pause className="w-4 h-4 mr-2" />
                      Стоп
                    </Button>
                    <Button type="button" variant="outline" className="rounded-xl px-3" onClick={() => drawFrame(0)}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Прозрачный фон</p>
                <p className="text-xs text-gray-500">Оставить только фигуру</p>
              </div>
              <Switch checked={transparentBg} onCheckedChange={setTransparentBg} />
            </div>

            <Button onClick={handleDownload} className="w-full rounded-xl h-11">
              <Download className="w-4 h-4 mr-2" />
              Скачать PNG
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
          <CardContent className="p-6">
            <div className={`relative rounded-3xl min-h-[500px] flex items-center justify-center overflow-hidden ${transparentBg ? "bg-[linear-gradient(45deg,#f2f2f2_25%,#e7e7e7_25%,#e7e7e7_50%,#f2f2f2_50%,#f2f2f2_75%,#e7e7e7_75%,#e7e7e7_100%)] bg-[length:24px_24px]" : "bg-[#e5e5e5]"}`}>
              {imageSrc ? (
                <>
                  <canvas ref={outputCanvasRef} className="max-w-full h-auto rounded-2xl" />
                  {animationEnabled && (
                    <div className="absolute right-4 top-4 rounded-full bg-white/80 backdrop-blur px-3 py-1.5 text-xs text-gray-700 border border-gray-200">
                      {isAnimating ? "animating" : "ready"}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-gray-400 text-sm">Загрузи изображение</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
