import dns from 'node:dns';
try { dns.setDefaultResultOrder('ipv4first'); } catch {}

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const envFile = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) dotenv.config({ path: envFile });

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const modelsToTest = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
];

async function main() {
  for (const m of modelsToTest) {
    try {
      console.log(`Testing model: ${m}...`);
      const res = await client.models.generateContent({
        model: m,
        contents: [{ role: 'user', parts: [{ text: 'Hello, respond with OK' }] }]
      });
      console.log(`✅ SUCCESS with ${m}:`, res.text?.trim());
      process.exit(0);
    } catch (e) {
      console.error(`❌ FAILED with ${m}:`, e.message);
    }
  }
}

main();
