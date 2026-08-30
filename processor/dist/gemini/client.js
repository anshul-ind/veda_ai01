import { GoogleGenAI } from "@google/genai";
let client = null;
export function getGeminiClient() {
    if (client) {
        return client;
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured.");
    }
    client = new GoogleGenAI({
        apiKey,
        httpOptions: {
            timeout: 60000,
        },
    });
    return client;
}
