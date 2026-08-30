import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
const c = new GoogleGenAI({ apiKey: 'test' });
console.log('keys', Object.keys(c));
console.log('files', c.files ? Object.keys(c.files) : 'no files');
console.log('models', c.models ? Object.keys(c.models).slice(0,10) : 'no models');
try {
  console.log('files upload?', typeof c.files?.upload);
} catch(e){console.log(e.message)}
