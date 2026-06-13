import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const downloads = 'C:/Users/User/Downloads';
const docxName = fs.readdirSync(downloads).find((name) =>
  name.toLowerCase().includes('чайка') && name.endsWith('.docx')
);

if (!docxName) {
  console.error('DOCX not found');
  process.exit(1);
}

const docxPath = path.join(downloads, docxName);
const zipPath = path.join(__dirname, '../temp-chaika.zip');
const extractDir = path.join(__dirname, '../temp-chaika-docx');

fs.copyFileSync(docxPath, zipPath);

import { execSync } from 'node:child_process';
execSync(
  `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force"`,
  { stdio: 'inherit' }
);

const xml = fs.readFileSync(path.join(extractDir, 'word/document.xml'), 'utf8');
const text = xml
  .replace(/<w:tab\/>/g, '\t')
  .replace(/<w:br[^>]*\/>/g, '\n')
  .replace(/<\/w:p>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/\r/g, '')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const outPath = path.join(__dirname, '../temp-chaika-text.txt');
fs.writeFileSync(outPath, text.join('\n'), 'utf8');
console.log('Extracted', text.length, 'lines to', outPath);
