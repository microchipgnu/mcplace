import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { getCanvas, setPixel, setPixels, type CanvasState, getCanvasEvents, logToolUsed } from "@/lib/canvas";

export const runtime = "nodejs";
import { createUIResource } from "@mcp-ui/server";

function renderCanvasHtml(state: CanvasState): string {
    const metaJson = JSON.stringify(state.meta);
    const pixelsBase64 = state.pixelsBase64;
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Canvas</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; }
      canvas { image-rendering: pixelated; display: block; }
    </style>
  </head>
  <body>
    <canvas id="place"></canvas>
    <script>
      const META = ${metaJson};
      const PIXELS_BASE64 = ${JSON.stringify(pixelsBase64)};
      const SCALE = 8;

      function b64ToBytes(b64) {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
      }

      const pixels = b64ToBytes(PIXELS_BASE64);

      const canvas = document.getElementById('place');
      const ctx = canvas.getContext('2d');
      canvas.width = META.width * SCALE;
      canvas.height = META.height * SCALE;
      ctx.imageSmoothingEnabled = false;

      for (let y = 0; y < META.height; y++) {
        for (let x = 0; x < META.width; x++) {
          const idx = y * META.width + x;
          const cIdx = pixels[idx] || 0;
          ctx.fillStyle = META.palette[cIdx] || '#000';
          ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
        }
      }
    </script>
  </body>
</html>`;
}

const handler = createMcpHandler(
    (server) => {
        server.tool(
            "get_canvas",
            "Render the current canvas in an embedded UI or return JSON state",
            { showUI: z.boolean().optional().default(false) },
            async (args) => {
                await logToolUsed("get_canvas", args);
                const state = await getCanvas();
                if (args.showUI) {
                    const html = renderCanvasHtml(state);
                    const uri = (`ui://place`) as `ui://${string}`;
                    const resource = createUIResource({
                        uri,
                        content: { type: 'rawHtml', htmlString: html },
                        encoding: 'text',
                    });
                    return { content: [resource] } as const;
                }
                return { content: [{ type: 'text', text: JSON.stringify(state) }] } as const;
            }
        );

        server.tool(
            "set_pixel",
            "Set a single pixel to a palette color index",
            {
                x: z.number().int().min(0),
                y: z.number().int().min(0),
                color: z.string().default("#000000")

            },
            async ({ x, y, color }) => {
                await logToolUsed("set_pixel", { x, y, color });
                const updated = await setPixel({ x, y, color, source: "mcp" });
                return { content: [{ type: 'text', text: JSON.stringify(updated) }] } as const;
            }
        );

        server.tool(
            "set_pixels",
            "Set multiple pixels in one call",
            {
                updates: z.array(
                    z.object({
                        x: z.number().int().min(0),
                        y: z.number().int().min(0),
                        color: z.string().default("#000000"),
                    })
                ).min(1),
            },
            async ({ updates }) => {
                await logToolUsed("set_pixels", { updates });
                const updated = await setPixels({ updates, source: "mcp" });
                return { content: [{ type: 'text', text: JSON.stringify(updated) }] } as const;
            }
        );

        server.tool(
            "get_events",
            "Get pixel-set events for replay",
            { limit: z.number().int().positive().optional() },
            async ({ limit }) => {
                await logToolUsed("get_events", { limit });
                const events = await getCanvasEvents({ limit });
                return { content: [{ type: 'text', text: JSON.stringify(events) }] } as const;
            }
        );

    },
    {
        // Optional server options
    },
    {
        maxDuration: 60,
        verboseLogs: true,
    }
);
export { handler as GET, handler as POST };