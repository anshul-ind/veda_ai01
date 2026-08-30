import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env like files.ts does
import dotenv from 'dotenv';
for (const p of [path.resolve(__dirname, '.env.local'), path.resolve(__dirname, '.env')]) {
  if (fs.existsSync(p)) dotenv.config({ path: p });
}

console.log('[test] GEMINI_API_KEY present:', !!process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY?.substring(0,12)+'...');

import { uploadToGemini, waitForFileActive } from './src/gemini/files.ts';
import { extractQuestions, extractAnswers } from './src/gemini/extract.ts';

async function main() {
  const qPath = path.resolve(__dirname, '../class_10_science_question_paper.pdf');
  const aPath = path.resolve(__dirname, '../science answer sheet.jpg');
  console.log('[test] q exists', fs.existsSync(qPath), qPath, fs.existsSync(qPath) ? fs.statSync(qPath).size : 'NA');
  console.log('[test] a exists', fs.existsSync(aPath), aPath, fs.existsSync(aPath) ? fs.statSync(aPath).size : 'NA');

  if (!fs.existsSync(qPath) || !fs.existsSync(aPath)) {
    console.error('[test] missing files');
    process.exit(1);
  }

  const qBuf = fs.readFileSync(qPath);
  const aBuf = fs.readFileSync(aPath);
  const qFile = new File([qBuf], 'Class_10_Science_Question_Paper.pdf', { type: 'application/pdf' });
  const aFile = new File([aBuf], 'science answer sheet.jpg', { type: 'image/jpeg' });

  console.log('[test] uploading question...');
  let qUp, aUp;
  try {
    qUp = await uploadToGemini(qFile);
    console.log('[test] qUp', qUp);
  } catch (e) {
    console.error('[test] q upload failed', e.message, e.cause ?? '', e.stack?.substring(0,1000));
    process.exit(1);
  }

  console.log('[test] uploading answer...');
  try {
    aUp = await uploadToGemini(aFile);
    console.log('[test] aUp', aUp);
  } catch (e) {
    console.error('[test] a upload failed', e.message, e.cause ?? '', e.stack?.substring(0,1000));
    process.exit(1);
  }

  console.log('[test] polling question...');
  try {
    await waitForFileActive(qUp.name, { signal: undefined });
    console.log('[test] q polling done');
  } catch (e) {
    console.error('[test] q poll failed', e.message);
  }

  console.log('[test] polling answer...');
  try {
    await waitForFileActive(aUp.name, { signal: undefined });
    console.log('[test] a polling done');
  } catch (e) {
    console.error('[test] a poll failed', e.message);
  }

  console.log('[test] extractQuestions start');
  let qRaw;
  try {
    qRaw = await extractQuestions(qUp.uri, qUp.mimeType);
    console.log('[test] qRaw type', typeof qRaw, JSON.stringify(qRaw).substring(0, 2000));
  } catch (e) {
    console.error('[test] extractQuestions failed', e.code ?? e.message, e.stack?.substring(0,2000));
    console.error('[test] full error', e);
    process.exit(1);
  }

  // For answer we need questionContext - derive from qRaw if possible
  let questionContext = [];
  try {
    const qs = (qRaw && (qRaw.data?.questions ?? qRaw.questions)) || [];
    questionContext = qs.map((q)=> ({ id: q.id, index: q.index, questionText: q.questionText, maxMarks: q.maxMarks }));
    console.log('[test] questionContext', questionContext.slice(0,2));
  } catch (e) {
    console.error('[test] context build failed', e);
  }

  console.log('[test] extractAnswers start');
  try {
    const aRaw = await extractAnswers(aUp.uri, aUp.mimeType, questionContext);
    console.log('[test] aRaw', JSON.stringify(aRaw).substring(0, 3000));
    console.log('[test] SUCCESS JSON extraction proven');
  } catch (e) {
    console.error('[test] extractAnswers failed', e.code ?? e.message, e.stack?.substring(0,2000));
    process.exit(1);
  }
}

main().catch(e=>{console.error(e); process.exit(1)});
