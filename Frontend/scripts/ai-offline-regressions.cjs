const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadOpenRouter(getApiKey, fetchImpl) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'src/services/ai/openrouter.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const mocks = {
    './keyStore': { getApiKey },
    './config': {
      AI_KEY_REQUIRED_MESSAGE: 'Para usar IA, defina a sua chave de API nas Definições',
      OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    },
    '../appLimits': {
      getAppLimits: async () => ({ aiTimeoutSeconds: 90, tutorReplyTokens: 4096 }),
    },
  };
  new Function('require', 'module', 'exports', 'fetch', code)(
    name => {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import: ${name}`);
    },
    module,
    module.exports,
    fetchImpl,
  );
  return module.exports;
}

async function main() {
  let requests = 0;
  const noKey = loadOpenRouter(async () => null, async () => { requests += 1; throw new Error('Unexpected network request'); });
  await assert.rejects(noKey.completeText('model', 'system', [{ role: 'user', content: 'hi' }]), /defina a sua chave/i);
  assert.equal(requests, 0, 'Missing key must prevent all network requests');

  let requestBody;
  let authorization;
  const provider = loadOpenRouter(async () => 'secret-test-key', async (_url, init) => {
    requests += 1;
    requestBody = JSON.parse(init.body);
    authorization = init.headers.Authorization;
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Resposta útil' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  const history = [{ role: 'user', content: 'Ajuda-me' }];
  assert.equal(await provider.completeText('model/text', 'system prompt', history), 'Resposta útil');
  assert.equal(requestBody.messages[0].role, 'system');
  assert.equal(requestBody.messages[1].role, 'user');
  assert.equal(authorization, 'Bearer secret-test-key');

  requestBody = undefined;
  await provider.completeWithImages('model/vision', 'system prompt', history, [
    { mimeType: 'image/jpeg', base64: 'aW1hZ2U=' },
  ]);
  assert.equal(requestBody.model, 'model/vision');
  assert.deepEqual(requestBody.messages[1].content[1], {
    type: 'image_url',
    image_url: { url: 'data:image/jpeg;base64,aW1hZ2U=' },
  });
  assert.equal(history[0].content, 'Ajuda-me', 'Preparing image messages does not mutate chat history');

  requestBody = undefined;
  await provider.completeWithAttachments('model/pdf', 'system prompt', history, {
    pdfs: [{ name: 'worksheet.pdf', base64: 'cGRm' }],
  });
  assert.deepEqual(requestBody.plugins, [{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }]);
  assert.deepEqual(requestBody.messages[1].content[1], {
    type: 'file',
    file: { filename: 'worksheet.pdf', file_data: 'data:application/pdf;base64,cGRm' },
  });
  assert.equal(history[0].content, 'Ajuda-me', 'Preparing PDF messages does not mutate chat history');
  assert.equal(requests, 3);
  console.log('Passed: no-key network guard, OpenRouter text/image/PDF requests, OCR plugin, and immutable history.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
