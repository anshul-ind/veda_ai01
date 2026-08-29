import "server-only";

import { GoogleGenAI } from "@google/genai";
import { getServerEnv } from "@/config/env";

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const env = getServerEnv();

    client = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
    });
  }

  return client;
}
