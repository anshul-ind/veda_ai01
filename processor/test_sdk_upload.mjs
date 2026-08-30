import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
for (const p of [path.resolve('./.env.local'), path.resolve('./.env')]) if (fs.existsSync(p)) dotenv.config({path:p});
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions:{timeout:60000}});
const qPath = path.resolve('../class_10_science_question_paper.pdf');
console.log('testing SDK upload', qPath);
try {
  const f = await ai.files.upload({ file: qPath, config: { displayName: 'test.pdf', mimeType: 'application/pdf' } });
  console.log('sdk upload result', JSON.stringify(f, null, 2).substring(0,2000));
} catch(e){
  console.error('sdk upload failed', e.message, e.stack?.substring(0,2000));
  if (e.response) console.error('response', e.response);
}
