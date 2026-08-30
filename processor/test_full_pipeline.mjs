import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const qPath = path.resolve(__dirname, '../class_10_science_question_paper.pdf');
const aPath = path.resolve(__dirname, '../science answer sheet.jpg');

async function main() {
  console.log('=== REAL END-TO-END VERIFICATION (SPRINT 4 + SPRINT 5) ===');

  const qBlob = new Blob([fs.readFileSync(qPath)], { type: 'application/pdf' });
  const aBlob = new Blob([fs.readFileSync(aPath)], { type: 'image/jpeg' });

  const formData = new FormData();
  formData.append('questionFile', qBlob, 'Class_10_Science_Question_Paper.pdf');
  formData.append('answerFile', aBlob, 'science answer sheet.jpg');

  console.log('[e2e] Sending POST http://localhost:10002/extract...');
  const res = await fetch('http://localhost:10002/extract', {
    method: 'POST',
    body: formData,
  });

  console.log('[e2e] Response HTTP status:', res.status);
  const json = await res.json();
  if (!json.success) {
    console.error('[e2e] Failed:', json);
    process.exit(1);
  }

  const { data } = json;
  console.log('\n--- EXTRACTION COUNTS ---');
  console.log(`- Extracted Question Count: ${data.questions.length}`);
  console.log(`- Extracted Answer Count: ${data.answers.length}`);
  console.log(`- Canonical Question Count: ${data.canonical.questions.length}`);
  console.log(`- Canonical Answer Block Count: ${data.canonical.answerBlocks.length}`);

  const mappings = data.mappings || [];
  const matched = mappings.filter((m) => m.status === 'matched');
  const uncertain = mappings.filter((m) => m.status === 'uncertain');
  const unanswered = mappings.filter((m) => m.status === 'unanswered');

  console.log('\n--- MAPPING SUMMARY ---');
  console.log(`- Total Mappings: ${mappings.length}`);
  console.log(`- Matched Count: ${matched.length}`);
  console.log(`- Uncertain Count: ${uncertain.length}`);
  console.log(`- Unanswered Count: ${unanswered.length}`);

  console.log('\n--- EXPLAINABLE MAPPING SAMPLE ---');
  const sample = mappings.find((m) => m.answerBlockId) || mappings[0];
  if (sample) {
    const q = data.canonical.questions.find((cq) => cq.id === sample.questionId);
    const a = data.canonical.answerBlocks.find((ca) => ca.id === sample.answerBlockId);

    console.log(`Question ID: ${sample.questionId}`);
    console.log(`Original Question Label: ${q?.label}`);
    console.log(`Normalized Question Label: ${q?.normalizedLabel}`);
    console.log(`Mapped Answer ID: ${sample.answerBlockId}`);
    console.log(`Mapped Answer Label: ${a?.label}`);
    console.log(`Confidence: ${sample.confidence}`);
    console.log(`Status: ${sample.status}`);
    console.log(`Label Evidence: ${sample.evidence.label}`);
    console.log(`Structural Evidence: ${sample.evidence.structural}`);
    console.log(`Semantic Evidence: ${sample.evidence.semantic}`);
    console.log(`Reasons: ${sample.evidence.reasons.join(', ')}`);
  }

  console.log('\n✅ REAL END-TO-END VERIFICATION SUCCESSFUL!');
}

main().catch((e) => {
  console.error('[e2e] Exception:', e);
  process.exit(1);
});
