"use client";
import { useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";

const PlaceCanvas = dynamic(() => import("@/components/PlaceCanvas"), { ssr: false });

function getMcpUrl(): string {
  if (typeof window === "undefined") return "/mcp";
  // Remove any trailing slash before appending "mcp"
  const base = window.location.href.replace(/\/+$/, "");
  return `${base}/mcp`;
}

export default function Home() {
  const [copied, setCopied] = useState(false);

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
      </footer>
    </div>
  );
}
