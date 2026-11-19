import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
const uk = read('../src/i18n/ui.uk.json');
const en = read('../src/i18n/ui.en.json');
assert.deepEqual(Object.keys(en).sort(), Object.keys(uk).sort());
for (const [key, text] of Object.entries(en)) {
  assert.ok(text.trim(), `${key}: empty translation`);
  assert.ok(!/\p{Script=Cyrillic}/u.test(text), `${key}: Cyrillic in English UI`);
  assert.deepEqual([...text.matchAll(/\{\d+\}/g)].map(m => m[0]).sort(),
    [...uk[key].matchAll(/\{\d+\}/g)].map(m => m[0]).sort(), `${key}: interpolation mismatch`);
}
const original = read('../normy.json');
const norms = read('../src/i18n/norms.en.json');
assert.equal(Object.keys(norms.normy).length, original.normy.length);
for (const norm of original.normy) {
  const english = norms.normy[norm.id];
  for (const key of ['id', 'posylannia', 'status_zvirky', 'data_zvirky', 'typ']) {
    assert.equal(english[key], norm[key], `${norm.id}: changed source metadata ${key}`);
  }
  for (const key of ['akt', 'punkt', 'korotko', 'redaktsiia', 'dzherelo_zvirky']) {
    assert.ok(english[key].length > 0);
    assert.ok(!/\p{Script=Cyrillic}/u.test(english[key]), `${norm.id}: untranslated ${key}`);
  }
  assert.equal(english.tsytaty.length, norm.tsytaty.length, `${norm.id}: lost quotation`);
  assert.ok(english.tsytaty.every(q => !/\p{Script=Cyrillic}/u.test(q)));
}
const scorm = read('../src/i18n/scorm.json');
assert.deepEqual(Object.keys(scorm.uk), Object.keys(scorm.en));
assert.ok(!/\p{Script=Cyrillic}/u.test(JSON.stringify(scorm.en)));
console.log(`PASS: ${Object.keys(en).length} UI translations, ${original.normy.length} legal norms, SCORM labels and interpolation parity`);
const overlays = read('../src/i18n/scenarios.en.json');
assert.deepEqual(Object.keys(overlays).sort(), ['S01', 'S02', 'S03']);
for (const overlay of Object.values(overlays)) {
  assert.ok(!/\p{Script=Cyrillic}/u.test(JSON.stringify(overlay)));
  assert.ok(overlay.nazva && overlay.kontekst && overlay.sytuatsiia && overlay.audytoriia.length);
}
console.log('PASS: English briefing overlays for S01–S03');

// Every leaf must be present: checking rendered headings alone misses branches,
// actor descriptions, feedback and verification/AI metadata.
function assertSameStructure(source, translated, path) {
  if (Array.isArray(source)) {
    assert.ok(Array.isArray(translated), `${path}: missing translated array`);
    assert.equal(translated.length, source.length, `${path}: omitted entries`);
    source.forEach((item, i) => assertSameStructure(item, translated[i], `${path}[${i}]`));
  } else if (source !== null && typeof source === 'object') {
    assert.deepEqual(Object.keys(translated).sort(), Object.keys(source).sort(), `${path}: omitted fields`);
    for (const key of Object.keys(source)) assertSameStructure(source[key], translated[key], `${path}.${key}`);
  } else if (typeof source === 'string') {
    assert.equal(typeof translated, 'string', `${path}: missing translation`);
    assert.ok(!/\p{Script=Cyrillic}/u.test(translated), `${path}: untranslated content`);
    if (source.length) assert.ok(translated.trim(), `${path}: empty translation`);
    // Identifiers, links, theme enum keys, graph edges and dates are machine data.
    if (!/\p{Script=Cyrillic}/u.test(source)) assert.equal(translated, source, `${path}: changed machine data`);
  } else {
    assert.equal(translated, source, `${path}: changed score, flag or null`);
  }
}
const scenarioFiles = fs.readdirSync(new URL('../stsenarii/', import.meta.url));
for (const id of ['S01', 'S02', 'S03']) {
  const source = read(`../stsenarii/${scenarioFiles.find(name => name.startsWith(`${id}-`))}`);
  assertSameStructure(source, overlays[id], id);
  assert.equal(overlays[id].dzherelo_vypadku.typ, 'fictional');
  assert.equal(overlays[id].perevirka_zmistu.fakhivets_dzpk, 'pending');
}
console.log('PASS: S01–S03 complete English content, all branches, IDs, edges, scores and metadata');

for (const name of ['accounts', 'group', 'themes', 'design', 'brand', 'caseBadges', 'builderStudio', 'polish', 'product']) {
  const dictionary = read(`../src/i18n/${name}.json`);
  assert.deepEqual(Object.keys(dictionary.uk).sort(), Object.keys(dictionary.en).sort());
  assert.ok(!/\p{Script=Cyrillic}/u.test(JSON.stringify(dictionary.en)));
}
console.log('PASS: local account and classroom UI language parity');

for (const file of fs.readdirSync(new URL('../stsenarii/', import.meta.url)).filter(f=>f.endsWith('.json'))) {
  const bytes=fs.readFileSync(new URL('../stsenarii/'+file,import.meta.url));
  assert.notEqual(bytes.subarray(0,3).toString('hex'),'efbbbf');
  const scenario=JSON.parse(bytes.toString('utf8'));
  const translated=overlays[scenario.id];
  assert.equal(scenario.perevirka_zmistu.fakhivets_dzpk,'не проведено');
  assert.doesNotMatch(JSON.stringify(scenario),/docs\/cases-source\.pdf/);
  assert.deepEqual(translated.normy.map(n=>n.id),scenario.normy.map(n=>n.id));
  for(const [i,node] of scenario.vuzly.entries()) {
    if(scenario.id==='S02') {
      assert.match(node.tekst,/^Етап [1-8] · [^\n]+\n\n\S/);
      assert.match(translated.vuzly[i].tekst,/^Stage [1-8] · [^\n]+\n\n\S/);
    }
    for(const [j,variant] of node.varianty.entries()) {
      assert.deepEqual(translated.vuzly[i].varianty[j].normy,variant.normy);
      if(scenario.id==='S01')assert.ok(!variant.normy.includes('KZPP-201'));
    }
  }
}
console.log('PASS edited case encoding, stage headings and translated norm references');
