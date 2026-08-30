import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const qPath = path.resolve(__dirname, '../class_10_science_question_paper.pdf');
const aPath = path.resolve(__dirname, '../science answer sheet.jpg');

async function testRoute() {
  console.log('[test_route] Sending POST request to http://localhost:10002/extract...');

  const qBlob = new Blob([fs.readFileSync(qPath)], { type: 'application/pdf' });
  const aBlob = new Blob([fs.readFileSync(aPath)], { type: 'image/jpeg' });

  const formData = new FormData();
  formData.append('questionFile', qBlob, 'Class_10_Science_Question_Paper.pdf');
  formData.append('answerFile', aBlob, 'science answer sheet.jpg');

  const res = await fetch('http://localhost:10002/extract', {
    method: 'POST',
    body: formData,
  });

  console.log('[test_route] Status:', res.status);
  const text = await res.text();
  console.log('[test_route] Response text preview:', text.substring(0, 1500));

  try {
    const json = JSON.parse(text);
    console.log('[test_route] Success:', json.success);
    console.log('[test_route] Schema Version:', json.schemaVersion);
    console.log('[test_route] Questions count:', json.data?.questions?.length);
    console.log('[test_route] Answers count:', json.data?.answers?.length);
    console.log('[test_route] Model:', json.data?.metadata?.model);
  } catch (e) {
    console.error('[test_route] Parse error:', e.message);
  }
}

testRoute();
