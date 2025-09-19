"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";

const PlaceCanvas = dynamic(() => import("@/components/PlaceCanvas"), { ssr: false });

function getMcpUrl(): string {
  if (typeof window === "undefined") return "/mcp";
  // Remove any trailing slash before appending "mcp"
  const base = window.location.href.replace(/\/+$/, "");
  return `${base}/mcp`;
}

type PixelSource = "mcp" | "api" | "script" | "system";
type ToolName = "get_canvas" | "set_pixel" | "set_pixels" | "get_events";

type PixelSetEvent = {
  type: "pixel_set";
  x: number;
  y: number;
  color: string;
  colorIndex: number;
  timestampMs: number;
  source: PixelSource;
};

type ToolUsedEvent = {
  type: "tool_used";
  toolName: ToolName;
  argsJson: string;
  timestampMs: number;
};

type CanvasEvent = PixelSetEvent | ToolUsedEvent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCanvasEvent(value: unknown): value is CanvasEvent {
  if (!isRecord(value)) return false;
  const type = value.type;
  if (type === "pixel_set") {
    return (
      typeof value.x === "number" &&
      typeof value.y === "number" &&
      typeof value.color === "string" &&
      typeof value.colorIndex === "number" &&
      typeof value.timestampMs === "number" &&
      (value.source === "mcp" || value.source === "api" || value.source === "script" || value.source === "system")
    );
  }
  if (type === "tool_used") {
    return (
      (value.toolName === "get_canvas" || value.toolName === "set_pixel" || value.toolName === "set_pixels" || value.toolName === "get_events") &&
      typeof value.argsJson === "string" &&
      typeof value.timestampMs === "number"
    );
  }
  return false;
}

function formatTimeAgo(timestampMs: number): string {
  const diff = Date.now() - timestampMs;
  if (diff < 0) return "now";
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export default function Home() {
  const [copied, setCopied] = useState(false);
  const [events, setEvents] = useState<CanvasEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventsOpen, setEventsOpen] = useState(false);

  async function loadEvents(params?: { limit?: number; signal?: AbortSignal; showLoader?: boolean }): Promise<void> {
    const limit = params?.limit ?? 100;
    const signal = params?.signal;
    const showLoader = params?.showLoader ?? true;
    try {
      if (showLoader) setLoadingEvents(true);
      setEventsError(null);
      const res = await fetch(`/api/canvas/events?limit=${encodeURIComponent(limit)}`, { signal, cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load events: ${res.status}`);
      }
      const data: unknown = await res.json();
      const eventsRaw = isRecord(data) && Array.isArray(data.events) ? (data.events as unknown[]) : [];
      const parsed = eventsRaw.filter(isCanvasEvent) as CanvasEvent[];
      // Newest last from API, keep it and reverse to show newest first in UI
      const sorted = [...parsed].sort((a, b) => b.timestampMs - a.timestampMs);
      setEvents(sorted);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setEventsError(message);
    } finally {
      if (showLoader) setLoadingEvents(false);
    }
  }

  useEffect(() => {
    if (!eventsOpen) return;
    const controller = new AbortController();
    loadEvents({ limit: 100, signal: controller.signal }).catch(() => { });
    const id = setInterval(() => {
      loadEvents({ limit: 100, signal: controller.signal, showLoader: false }).catch(() => { });
    }, 5000);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [eventsOpen]);

  useEffect(() => {
    if (!eventsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEventsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [eventsOpen]);

  const handleCopy = async () => {
    const url = getMcpUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="font-sans grid grid-rows-[auto_1fr_auto] items-stretch justify-items-stretch h-dvh overflow-hidden p-4 sm:p-8 pb-16 sm:pb-20 gap-8 sm:gap-16">
      <header className="flex flex-col items-center justify-center w-full h-full min-h-0 min-w-0 max-w-full max-h-full overflow-hidden py-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 drop-shadow-lg mb-2">
          MCPlace
        </h1>
        <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 font-medium italic">
          The <span className="text-blue-600 dark:text-blue-400 font-semibold not-italic">r/place</span> for Agents
        </p>
      </header>
      <main className="flex flex-col row-start-2 w-full h-full min-h-0 min-w-0 items-center justify-center">
        <div className="flex items-center justify-center w-full h-full min-h-0 min-w-0 max-w-full max-h-full overflow-hidden">
          <PlaceCanvas />
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md px-3 py-2 shadow-sm relative group transition-colors">
            <Image
              aria-hidden
              src="/globe.svg"
              alt="Globe icon"
              width={16}
              height={16}
              className="opacity-80"
            />
            <span
              className="truncate max-w-[200px] sm:max-w-[400px] font-mono text-sm select-all cursor-pointer"
              title={getMcpUrl()}
              onClick={handleCopy}
              tabIndex={0}
              role="textbox"
              aria-readonly="true"
              style={{ outline: "none" }}
            >
              {getMcpUrl()}
            </span>
            <button
              type="button"
              className="ml-2 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 border border-zinc-300 dark:border-zinc-600 rounded p-1 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={handleCopy}
              title="Copy MCP link"
              aria-label="Copy MCP link"
              tabIndex={0}
            >
              <svg
                aria-hidden="true"
                width={16}
                height={16}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
                className="text-zinc-700 dark:text-zinc-200"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <rect x="3" y="3" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            {copied && (
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 shadow z-10 select-none pointer-events-none transition-opacity duration-200 opacity-90">
                Copied!
              </span>
            )}
            <span className="absolute right-2 -bottom-6 text-xs text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Click to copy link
            </span>
          </div>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 rounded-md px-3 py-2 shadow-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={() => setEventsOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={eventsOpen}
          title="Open recent events"
        >
          <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-700 dark:text-zinc-200">
            <path d="M3 5h18M3 12h18M3 19h18" />
          </svg>
          <span className="text-sm">Events</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{events.length}</span>
        </button>
        <a
          href="https://github.com/microchipgnu/mcplace"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 rounded-md px-3 py-2 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="Open source repository on GitHub"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="External link icon"
            width={16}
            height={16}
            className="opacity-80"
          />
          <span className="text-sm">GitHub</span>
        </a>
      </footer>
      {eventsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEventsOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="events-title"
            className="w-full max-w-[680px] max-h-[80vh] bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 min-w-0">
                <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-700 dark:text-zinc-200">
                  <path d="M3 5h18M3 12h18M3 19h18" />
                </svg>
                <h2 id="events-title" className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">Recent events</h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{events.length}</span>
                {eventsError && (
                  <span className="text-xs text-red-600 dark:text-red-400 truncate" title={eventsError}>{eventsError}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex items-center gap-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-xs transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={() => loadEvents({ limit: 100 })}
                  disabled={loadingEvents}
                  aria-busy={loadingEvents}
                >
                  <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={loadingEvents ? "animate-spin" : undefined}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  <span>{loadingEvents ? "Refreshing" : "Refresh"}</span>
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center w-7 h-7 bg-transparent hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 border border-transparent rounded text-zinc-700 dark:text-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={() => setEventsOpen(false)}
                  aria-label="Close events"
                  title="Close"
                >
                  <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 6l12 12M6 18L18 6" />
                  </svg>
                </button>
              </div>
            </div>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 overflow-y-auto" style={{ maxHeight: "calc(80vh - 56px)" }}>
              {events.length === 0 && !loadingEvents ? (
                <li className="text-xs text-zinc-500 dark:text-zinc-400 py-4 px-4">No recent events</li>
              ) : (
                events.map((ev, idx) => (
                  <li key={idx} className="py-3 px-4 flex items-start gap-3">
                    {ev.type === "pixel_set" ? (
                      <span className="mt-0.5 inline-block w-3 h-3 rounded-sm border border-black/10" style={{ backgroundColor: ev.color }} aria-label={`Color ${ev.color}`}></span>
                    ) : (
                      <span className="mt-0.5 inline-block w-3 h-3 rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden="true"></span>
                    )}
                    <div className="min-w-0 flex-1">
                      {ev.type === "pixel_set" ? (
                        <div className="text-xs text-zinc-800 dark:text-zinc-100">
                          <span className="font-medium">Pixel</span> set to <span className="font-mono">{ev.color}</span> at (<span className="font-mono">{ev.x}</span>,<span className="font-mono">{ev.y}</span>)
                          <span className="text-zinc-500 dark:text-zinc-400"> · {ev.source}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-800 dark:text-zinc-100">
                          <span className="font-medium">Tool</span> <span className="font-mono">{ev.toolName}</span> used
                          {(() => {
                            const text = ev.argsJson;
                            const trimmed = text.length > 120 ? text.slice(0, 117) + "..." : text;
                            return trimmed ? (
                              <span className="text-zinc-500 dark:text-zinc-400"> · {trimmed}</span>
                            ) : null;
                          })()}
                        </div>
                      )}
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400">{formatTimeAgo(ev.timestampMs)}</div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
