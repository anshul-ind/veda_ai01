import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { healthRoute } from "./routes/health.js";
import { extractRoute } from "./routes/extract.js";
import { gradeRoute } from "./routes/grade.js";

const app = new Hono();

// CORS
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "*";
app.use(
  "*",
  cors({
    origin: allowedOrigin === "*" ? "*" : allowedOrigin.split(",").map((s) => s.trim()),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 600,
  }),
);

// Simple rate limit: 10 req/min per IP
const hits = new Map<string, { count: number; reset: number }>();
app.use("/extract", async (c, next) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? "unknown";
  const now = Date.now();
  const windowMs = 60_000;
  const max = Number(process.env.RATE_LIMIT_MAX ?? "10");
  const entry = hits.get(ip);
  if (!entry || now > entry.reset) {
    hits.set(ip, { count: 1, reset: now + windowMs });
  } else {
    entry.count++;
    if (entry.count > max) {
      return c.json({ success: false, code: "RATE_LIMITED", error: "Too many requests." }, 429);
    }
  }
  await next();
});

// Body limit via Hono is not multipart-aware; validation handles 20/35 MiB. Transport headroom ~40 MiB is handled by Node.

app.route("/", healthRoute);
app.route("/", extractRoute);
app.route("/", gradeRoute);

app.notFound((c) => c.json({ success: false, code: "INVALID_REQUEST", error: "Not found." }, 404));

const port = Number(process.env.PORT ?? "10000");
console.log(`veda-processor listening on ${port} allowedOrigin=${allowedOrigin}`);

// Node server via @hono/node-server
import { serve } from "@hono/node-server";
serve({ fetch: app.fetch, port });
