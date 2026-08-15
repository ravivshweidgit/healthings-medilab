/**
 * One-shot: language select navigates on change; remove help-lang-go buttons.
 */
import fs from 'node:fs';
import path from 'node:path';

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const root = path.resolve('website');
const files = walk(root).filter((f) => fs.readFileSync(f, 'utf8').includes('help-lang'));
let updated = 0;

for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const before = s;

  s = s.replace(
    /<form class="help-lang" action="#" method="get" onsubmit="var s=this\.elements\.namedItem\('lang'\); if\(s&amp;&amp;s\.value\)\{location\.href=s\.value;\} return false;">/g,
    '<form class="help-lang" action="#" method="get" onsubmit="return false;">',
  );

  s = s.replace(
    /(<select id="help-lang-select" name="lang")(?![^>]*onchange)/g,
    '$1 onchange="if(this.value)location.href=this.value;"',
  );

  s = s.replace(/\n?\s*<button type="submit" class="help-lang-go">[^<]*<\/button>/g, '');

  if (s !== before) {
    fs.writeFileSync(f, s);
    updated++;
  }
}

console.log(`updated ${updated} / ${files.length} html files`);
