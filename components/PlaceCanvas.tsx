"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CanvasMetadata = {
  width: number;
  height: number;
  palette: string[];
};

type CanvasState = {
  meta: CanvasMetadata;
  pixelsBase64: string;
};

function decodePixelsFromBase64(base64: string): Uint8Array {
  if (typeof window === "undefined") return new Uint8Array();
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

export default function PlaceCanvas() {
  const [state, setState] = useState<CanvasState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number>(4);

  const fetchState = useCallback(async () => {
    const res = await fetch("/api/canvas", { cache: "no-store" });
    const json = (await res.json()) as CanvasState;
    setState(json);
  }, []);

  useEffect(() => {
    void fetchState();
    const id = setInterval(fetchState, 2000);
    return () => clearInterval(id);
  }, [fetchState]);

  // Compute a responsive integer scale so the canvas fits its container across screen sizes
  useEffect(() => {
    if (!state || !containerRef.current) return;
    const element = containerRef.current;

    const updateScale = () => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const { width, height } = state.meta;
      // Leave a small margin so borders/shadows don't trigger scrollbars
      const availableWidth = Math.max(0, rect.width - 8);
      const availableHeight = Math.max(0, rect.height - 8);
      const nextScale = Math.max(1, Math.floor(Math.min(availableWidth / width, availableHeight / height)));
      setScale((prev) => (prev !== nextScale ? nextScale : prev));
    };

    updateScale();
    const resizeObserver = new ResizeObserver(() => updateScale());
    resizeObserver.observe(element);
    window.addEventListener("resize", updateScale);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [state]);

  const pixels = useMemo(() => {
    if (!state) return null;
    return decodePixelsFromBase64(state.pixelsBase64);
  }, [state]);

  useEffect(() => {
    if (!state || !pixels || !canvasRef.current) return;
    const { width, height, palette } = state.meta;
    const canvas = canvasRef.current;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const colorIndex = pixels[idx] ?? 0;
        ctx.fillStyle = palette[colorIndex] ?? "#000000";
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }, [state, pixels, scale]);

  if (!state) return <div>Loading canvas…</div>;

  return (
    <div ref={containerRef} className="flex flex-col gap-4 items-center w-full h-full">
      <canvas
        ref={canvasRef}
        className="border border-black/20 rounded shadow-sm bg-white"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}


