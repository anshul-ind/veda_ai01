import "server-only";
import { z } from "zod";

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
});

export function getServerEnv() {
  const parsed = envSchema.safeParse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment variables: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(", ")}`,
    );
  }

  return parsed.data;
}
