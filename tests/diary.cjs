const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const output = ts.transpileModule(fs.readFileSync('src/model.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(output, context);
const { diaryEntries, emptyRecord } = context.exports;
const legacy = { ...emptyRecord('2026-09-08'), diary: 'An older memory' };
const migrated = diaryEntries(legacy);
assert.equal(migrated.length, 1);
assert.equal(migrated[0].text, legacy.diary);
assert.equal(migrated[0].savedAt, undefined, 'Do not invent a timestamp for older entries');
assert.equal(legacy.diaryEntries, undefined, 'Reading must not mutate stored data');
const saved = { ...legacy, diaryEntries: [...migrated, { id: 'new', text: 'A new memory', savedAt: '2026-09-08T15:30:00.000Z' }] };
const reloaded = JSON.parse(JSON.stringify(saved));
assert.equal(diaryEntries(reloaded).length, 2, 'Reload must not duplicate legacy text');
assert.equal(diaryEntries(reloaded)[1].savedAt, saved.diaryEntries[1].savedAt);
assert.equal(diaryEntries({ ...legacy, diaryEntries: [] }).length, 0);
assert.equal(diaryEntries({ ...emptyRecord('2026-09-08'), diary: '  ' }).length, 0);
console.log('Diary compatibility and persistence checks passed.');
