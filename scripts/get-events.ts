import "dotenv/config";
import { getCanvasEvents } from "@/lib/canvas";

const arg = Number(process.argv[2]);
const limit = Number.isFinite(arg) && arg > 0 ? arg : 100;
const events = await getCanvasEvents({ limit });
console.log(JSON.stringify(events, null, 2));