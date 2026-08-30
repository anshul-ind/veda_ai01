import { Hono } from "hono";

export const healthRoute = new Hono();

healthRoute.get("/health", (c) => c.json({ status: "ok", service: "veda-ai-processor" }));
healthRoute.get("/api/health", (c) => c.json({ status: "ok", service: "veda-ai-processor" }));
