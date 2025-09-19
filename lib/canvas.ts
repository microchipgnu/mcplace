import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export type CanvasMetadata = {
    width: number;
    height: number;
    palette: string[];
};

export type CanvasState = {
    meta: CanvasMetadata;
    pixelsBase64: string; // Base64-encoded Uint8Array of color indices
};

const CANVAS_KEY = "canvas:v1";
const EVENTS_LIST_KEY = "canvas:events:v1";

export type PixelSource = "mcp" | "api" | "script" | "system";
export type ToolName = "get_canvas" | "set_pixel" | "set_pixels" | "get_events";

export type PixelSetEvent = {
    type: "pixel_set";
    x: number;
    y: number;
    color: string; // normalized color as stored in palette
    colorIndex: number;
    timestampMs: number;
    source: PixelSource;
};

export type ToolUsedEvent = {
    type: "tool_used";
    toolName: ToolName;
    argsJson: string; // JSON string of tool arguments
    timestampMs: number;
};

export type CanvasEvent = PixelSetEvent | ToolUsedEvent;

// Small, opinionated default palette (inspired by r/place palettes)
export const DEFAULT_PALETTE: string[] = [
    "#FFFFFF",
    "#E4E4E4",
    "#888888",
    "#222222",
    "#FFA7D1",
    "#E50000",
    "#E59500",
    "#A06A42",
    "#E5D900",
    "#94E044",
    "#02BE01",
    "#00D3DD",
    "#0083C7",
    "#0000EA",
    "#CF6EE4",
    "#820080",
];

export function encodePixelsToBase64(pixels: Uint8Array): string {
    return Buffer.from(pixels).toString("base64");
}

export function decodePixelsFromBase64(base64: string, expectedLength: number): Uint8Array {
    const decoded = Buffer.from(base64, "base64");
    if (decoded.length !== expectedLength) {
        throw new Error(`Decoded pixels length ${decoded.length} does not match expected ${expectedLength}`);
    }
    return new Uint8Array(decoded);
}

export function createEmptyPixels(width: number, height: number, fillIndex: number = 0): Uint8Array {
    const total = width * height;
    const arr = new Uint8Array(total);
    arr.fill(fillIndex);
    return arr;
}

export function indexFor(x: number, y: number, width: number): number {
    return y * width + x;
}

function normalizeColorString(input: string): string {
    const trimmed = input.trim().toLowerCase();
    // Expand #rgb → #rrggbb
    const shortHexMatch = trimmed.match(/^#([0-9a-f]{3})$/i);
    if (shortHexMatch) {
        const [r, g, b] = shortHexMatch[1].split("");
        return `#${r}${r}${g}${g}${b}${b}`;
    }
    // Accept #rrggbb or #rrggbbaa or other css color strings as-is (lowercased)
    return trimmed;
}

function ensureColorInPalette(palette: string[], color: string): { updatedPalette: string[]; colorIndex: number } {
    const normalized = normalizeColorString(color);
    const existingIndex = palette.findIndex((c) => normalizeColorString(c) === normalized);
    if (existingIndex !== -1) {
        return { updatedPalette: palette, colorIndex: existingIndex };
    }
    if (palette.length >= 256) {
        throw new Error("Palette is full (max 256 colors due to Uint8Array storage)");
    }
    const updatedPalette = [...palette, normalized];
    return { updatedPalette, colorIndex: updatedPalette.length - 1 };
}

async function appendEventToLog(event: CanvasEvent): Promise<void> {
    await redis.rpush(EVENTS_LIST_KEY, JSON.stringify(event));
}

export async function getCanvasEvents(params?: { limit?: number }): Promise<CanvasEvent[]> {
    const limit = params?.limit;
    if (typeof limit === "number" && limit > 0) {
        const length = await redis.llen(EVENTS_LIST_KEY);
        const start = Math.max(0, length - limit);
        const values: unknown[] = await redis.lrange(EVENTS_LIST_KEY, start, length - 1);
        return values
            .map((raw): CanvasEvent | undefined => {
                let value: unknown = raw;
                // Handle strings (possibly double-encoded JSON) and already-parsed objects
                for (let i = 0; i < 2; i++) {
                    if (typeof value === "string") {
                        try {
                            value = JSON.parse(value);
                            continue;
                        } catch {
                            break;
                        }
                    }
                    break;
                }
                if (!value || typeof value !== "object") return undefined;
                const type = (value as { type?: string }).type;
                if (type === "pixel_set") return value as PixelSetEvent;
                if (type === "tool_used") return value as ToolUsedEvent;
                return undefined;
            })
            .filter((e): e is CanvasEvent => Boolean(e));
    }
    const all: unknown[] = await redis.lrange(EVENTS_LIST_KEY, 0, -1);
    return all
        .map((raw): CanvasEvent | undefined => {
            let value: unknown = raw;
            for (let i = 0; i < 2; i++) {
                if (typeof value === "string") {
                    try {
                        value = JSON.parse(value);
                        continue;
                    } catch {
                        break;
                    }
                }
                break;
            }
            if (!value || typeof value !== "object") return undefined;
            const type = (value as { type?: string }).type;
            if (type === "pixel_set") return value as PixelSetEvent;
            if (type === "tool_used") return value as ToolUsedEvent;
            return undefined;
        })
        .filter((e): e is CanvasEvent => Boolean(e));
}

export async function logToolUsed(toolName: ToolName, args: unknown): Promise<void> {
    let argsJson = "{}";
    try {
        argsJson = JSON.stringify(args);
    } catch {
        argsJson = '"[unserializable]"';
    }
    const event: ToolUsedEvent = {
        type: "tool_used",
        toolName,
        argsJson,
        timestampMs: Date.now(),
    };
    await appendEventToLog(event);
}

export async function getCanvas(): Promise<CanvasState> {
    const state = (await redis.get<CanvasState>(CANVAS_KEY));
    if (state) {
        return state;
    }
    // Initialize a default canvas if none exists
    const meta: CanvasMetadata = {
        width: 64,
        height: 64,
        palette: DEFAULT_PALETTE,
    };
    const pixels = createEmptyPixels(meta.width, meta.height, 0);
    const pixelsBase64 = encodePixelsToBase64(pixels);
    const initial: CanvasState = { meta, pixelsBase64 };
    await redis.set(CANVAS_KEY, initial);
    return initial;
}

export async function setPixel(params: {
    x: number;
    y: number;
    color: string;
    source?: PixelSource;
}): Promise<CanvasState> {
    const { x, y, color, source } = params;
    const current = await getCanvas();
    const { width, height } = current.meta;
    let { palette } = current.meta;

    if (x < 0 || y < 0 || x >= width || y >= height) {
        throw new Error("Pixel coordinates out of bounds");
    }

    if (typeof color !== "string" || color.trim().length === 0) {
        throw new Error("Color must be a non-empty string");
    }

    const ensured = ensureColorInPalette(palette, color);
    palette = ensured.updatedPalette;
    const indexToSet = ensured.colorIndex;

    const pixels = decodePixelsFromBase64(current.pixelsBase64, width * height);
    pixels[indexFor(x, y, width)] = indexToSet;

    const updated: CanvasState = {
        meta: { ...current.meta, palette },
        pixelsBase64: encodePixelsToBase64(pixels),
    };
    await redis.set(CANVAS_KEY, updated);
    // Append event to log for replay
    const normalizedColor = palette[indexToSet];
    const event: PixelSetEvent = {
        type: "pixel_set",
        x,
        y,
        color: normalizedColor,
        colorIndex: indexToSet,
        timestampMs: Date.now(),
        source: source ?? "system",
    };
    await appendEventToLog(event);
    return updated;
}

export type PixelUpdate = {
    x: number;
    y: number;
    color: string;
};

export async function setPixels(params: {
    updates: PixelUpdate[];
    source?: PixelSource;
}): Promise<CanvasState> {
    const { updates, source } = params;
    if (!Array.isArray(updates) || updates.length === 0) {
        throw new Error("'updates' must be a non-empty array");
    }

    const current = await getCanvas();
    const { width, height } = current.meta;
    let { palette } = current.meta;

    // Decode once and apply all writes
    const pixels = decodePixelsFromBase64(current.pixelsBase64, width * height);

    for (const update of updates) {
        const { x, y, color } = update;
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
            throw new Error(`Pixel coordinates out of bounds: (${x}, ${y})`);
        }
        if (typeof color !== "string" || color.trim().length === 0) {
            throw new Error("Color must be a non-empty string");
        }

        const ensured = ensureColorInPalette(palette, color);
        palette = ensured.updatedPalette;
        const indexToSet = ensured.colorIndex;
        pixels[indexFor(x, y, width)] = indexToSet;
    }

    const updated: CanvasState = {
        meta: { ...current.meta, palette },
        pixelsBase64: encodePixelsToBase64(pixels),
    };
    await redis.set(CANVAS_KEY, updated);

    // Append an event per pixel for replay
    const now = Date.now();
    for (const update of updates) {
        const ensured = ensureColorInPalette(palette, update.color);
        const colorIndex = ensured.colorIndex;
        const normalizedColor = palette[colorIndex];
        const event: PixelSetEvent = {
            type: "pixel_set",
            x: update.x,
            y: update.y,
            color: normalizedColor,
            colorIndex,
            timestampMs: now,
            source: source ?? "system",
        };
        await appendEventToLog(event);
    }

    return updated;
}

export async function resetCanvas(params?: {
    width?: number;
    height?: number;
    palette?: string[];
}): Promise<CanvasState> {
    const existing = await getCanvas();
    const width = params?.width ?? existing.meta.width;
    const height = params?.height ?? existing.meta.height;
    const palette = params?.palette ?? existing.meta.palette;

    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
        throw new Error("Width and height must be positive integers");
    }

    const meta: CanvasMetadata = { width, height, palette };
    const pixels = createEmptyPixels(width, height, 0);
    const updated: CanvasState = {
        meta,
        pixelsBase64: encodePixelsToBase64(pixels),
    };
    await redis.set(CANVAS_KEY, updated);
    return updated;
}


