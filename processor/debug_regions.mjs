#!/usr/bin/env node
/**
 * Debug script to inspect answer block regions and mappings
 * Run: node debug_regions.mjs <json_file>
 * Or pipe extraction output: curl ... | node debug_regions.mjs
 */

import fs from 'fs';

// Read from file argument or stdin
let input;
if (process.argv[2]) {
  input = fs.readFileSync(process.argv[2], 'utf-8');
} else {
  // Read from stdin
  input = fs.readFileSync(0, 'utf-8');
}

const data = JSON.parse(input);

if (!data?.data?.canonical || !data?.data?.mappings) {
  console.error('Invalid data format. Expected extraction result with canonical and mappings.');
  process.exit(1);
}

const { answerBlocks } = data.data.canonical;
const { mappings } = data.data;

console.log('\n=== ANSWER BLOCKS ===');
for (const block of answerBlocks) {
  console.log(`\nBlock: ${block.id}`);
  console.log(`  Label: ${block.normalizedLabel ?? block.label ?? 'null'}`);
  console.log(`  Text: "${block.text?.slice(0, 60)}..."`);
  console.log(`  Regions:`, JSON.stringify(block.regions));
}

console.log('\n=== MAPPINGS ===');
for (const mapping of mappings) {
  if (!mapping.questionId) continue; // Skip unmatched
  const block = answerBlocks.find(b => b.id === mapping.answerBlockId);
  console.log(`\n${mapping.questionId} → ${mapping.answerBlockId} (${mapping.status})`);
  console.log(`  Block label: ${block?.normalizedLabel ?? block?.label ?? 'null'}`);
  console.log(`  Block regions:`, JSON.stringify(block?.regions));
}

console.log('\n=== REGION CHECK ===');
console.log('Do any answer blocks share the same region coordinates?');
const regionMap = new Map();
for (const block of answerBlocks) {
  const key = JSON.stringify(block.regions);
  if (regionMap.has(key)) {
    console.log(`  DUPLICATE: ${block.id} and ${regionMap.get(key)} have same regions!`);
  } else {
    regionMap.set(key, block.id);
  }
}
