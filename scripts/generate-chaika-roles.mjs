import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const text = fs.readFileSync(path.join(__dirname, '../temp-chaika-text.txt'), 'utf8').split('\n');

function deriveShortName(line) {
  const lower = line.toLowerCase();
  if (lower.startsWith('маша,')) return 'Маша';
  if (lower.includes('аркадина')) return 'Аркадина';
  if (lower.includes('треплев') && lower.includes('константин')) return 'Треплев';
  if (lower.includes('заречная')) return 'Нина';
  if (lower.startsWith('полина')) return 'Полина Андреевна';
  if (lower.includes('тригорин')) return 'Тригорин';
  if (lower.includes('дорн')) return 'Дорн';
  if (lower.includes('медведенко')) return 'Медведенко';
  return line.split(',')[0]?.trim() ?? line;
}

const start = text.findIndex((line) => line.trim() === 'Действующие лица');
if (start < 0) {
  console.error('Раздел «Действующие лица» не найден');
  process.exit(1);
}

const roles = [];
for (let i = start + 1; i < text.length; i += 1) {
  const line = text[i].trim();
  if (!line) continue;
  if (/^Действие|^Между/.test(line) || line.includes('происходит')) break;

  const description = line.replace(/\.$/, '');
  roles.push({
    order: roles.length + 1,
    name: deriveShortName(description),
    description,
  });
}

const out = path.join(__dirname, '../src/data/chaikaRoles.generated.json');
fs.writeFileSync(out, JSON.stringify(roles, null, 2) + '\n', 'utf8');
console.log(`Wrote ${roles.length} roles to ${out}`);
