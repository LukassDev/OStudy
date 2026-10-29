const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

let apiKey = null;
let userCount = 9;
let completionCalls = 0;
let checkpoint = null;
const writes = [];
const database = {
  getFirstAsync: async () => ({ count: userCount }),
  getAllAsync: async () => [
    { role: 'user', content: 'Tenho dificuldade com frações.', created_at: '2026-10-25T00:00:00.000Z' },
    { role: 'tutor', content: 'Vamos praticar.', created_at: '2026-10-25T00:00:01.000Z' },
  ],
  runAsync: async (...args) => { writes.push(args); },
  withTransactionAsync: async callback => callback(),
};
const mocks = {
  '../../db/client': { getDatabase: async () => database },
  '../../db/ids': { createId: () => `memory-${writes.length}`, nowIso: () => '2026-10-25T00:05:00.000Z' },
  '../../db/repositories/settings.repo': { getSetting: async () => checkpoint },
  '../ai/config': { DEFAULT_TEXT_MODEL: 'text-model' },
  '../ai/keyStore': { getApiKey: async () => apiKey },
  '../ai/openrouter': {
    completeText: async () => {
      completionCalls += 1;
      return '[{"type":"semantic","content":"O aluno tem dificuldade com frações."},{"type":"episodic","content":"O aluno está a estudar frações."}]';
    },
  },
};
const source = fs.readFileSync(path.resolve(__dirname, '..', 'src/services/memory/memory.ts'), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const memoryModule = { exports: {} };
new Function('require', 'module', 'exports', code)((name) => {
  if (name in mocks) return mocks[name];
  throw new Error(`Unexpected import: ${name}`);
}, memoryModule, memoryModule.exports);

async function main() {
  const { extractAndSaveMemory } = memoryModule.exports;
  await extractAndSaveMemory('chat-id', 'space-id');
  assert.equal(completionCalls, 0, 'Memory extraction is debounced until enough user messages accumulate.');
  assert.equal(writes.length, 0);

  apiKey = 'test-key';
  userCount = 10;
  await extractAndSaveMemory('chat-id', 'space-id');
  assert.equal(completionCalls, 1);
  assert.equal(writes.length, 3, 'Both memory types and the extraction checkpoint are saved.');
  assert.match(writes[0][0], /INSERT INTO semantic_memory/);
  assert.match(writes[1][0], /INSERT INTO episodic_memory/);
  assert.equal(writes[2][1], 'memory.checkpoint.chat-id');
  console.log('Passed: memory extraction debounce, local semantic/episodic persistence, and checkpointing.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
