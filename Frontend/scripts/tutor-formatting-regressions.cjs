const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name === '../appLimits') return { DEFAULT_APP_LIMITS: { quizMaxItems: 30 } };
    throw new Error(`Unexpected import: ${name}`);
  }, module, module.exports);
  return module.exports;
}

const { parseTutorReply } = load('src/services/tutor/actionParser.ts');
const quiz = count => JSON.stringify({
  type: 'quiz_flashcards',
  data: {
    mode: 'quiz',
    title: 'Kana',
    items: Array.from({ length: count }, () => ({
      question: 'Qual a leitura?',
      options: ['a', 'e', 'o'],
      correct_index: 0,
    })),
  },
});

for (const count of [1, 10, 30]) {
  const parsed = parseTutorReply(`Introdução\n\`\`\`json_action\n${quiz(count)}\n\`\`\`\nFim.`);
  assert.equal(parsed.quiz.items.length, count);
  assert.equal(parsed.reply, 'Introdução\n\nFim.');
}
for (const count of [0, 31]) {
  assert.throws(() => parseTutorReply(`\`\`\`json_action\n${quiz(count)}\n\`\`\``), /quiz inválido/i);
}
assert.throws(() => parseTutorReply(`\`\`\`json_action\n${quiz(3)}\n\`\`\``, 2), /quiz inválido/i);
const action = parseTutorReply('Plano aprovado.\n```json_action\n{"type":"create_grade","data":{"items":[{"title":"Teste","score":18}]}}\n```');
assert.equal(action.actions[0].type, 'create_grade');
assert.equal(action.reply, 'Plano aprovado.');
const example = 'Exemplo:\n```json\n{"hello":"world"}\n```';
assert.equal(parseTutorReply(example).reply, example);
assert.equal(parseTutorReply('{"type":"delete_grade","data":{"ids":["x"]}}').actions.length, 0);
assert.throws(() => parseTutorReply('```json_action\n{invalid}\n```'), /ação estruturada inválida/i);

require('./math-rendering-regressions.cjs');
require('./tutor-local-regressions.cjs');
require('./memory-local-regressions.cjs');
console.log('Passed: tutor quiz/action parsing, JSON examples, malformed actions, and math rendering.');
