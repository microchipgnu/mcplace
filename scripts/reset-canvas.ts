import { DEFAULT_PALETTE, resetCanvas } from "@/lib/canvas";

await resetCanvas({width: 100, height: 100, palette: DEFAULT_PALETTE});

console.log("Canvas reset");