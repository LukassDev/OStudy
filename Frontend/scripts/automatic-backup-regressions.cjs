const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const settings = new Map([
  ['backup.automatic.enabled', true],
  ['backup.automatic.intervalHours', 24],
  ['backup.automatic.lastAt', new Date().toISOString()],
]);
const writtenFiles = [];
const removedFiles = [];
const existingBackups = Array.from({ length: 10 }, (_, index) =>
  `orenstudy-auto-2000-01-${String(index + 1).padStart(2, '0')}.db`,
);
const source = fs.readFileSync(path.resolve(process.cwd(), 'src/services/automaticBackup.ts'), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const backupModule = { exports: {} };
const mocks = {
  'react-native': {
    AppState: { addEventListener: () => ({ remove: () => {} }) },
    Platform: { OS: 'ios' },
  },
  'expo-file-system/legacy': {
    documentDirectory: 'file:///documents/',
    EncodingType: { Base64: 'base64' },
    makeDirectoryAsync: async () => {},
    readDirectoryAsync: async () => [...existingBackups, ...writtenFiles.map(file => file.uri.split('/').pop())],
    writeAsStringAsync: async (uri, contents, options) => writtenFiles.push({ uri, contents, options }),
    deleteAsync: async uri => removedFiles.push(uri),
  },
  '../db/repositories/settings.repo': {
    getSetting: async (key, fallback) => settings.has(key) ? settings.get(key) : fallback,
    setSetting: async (key, value) => settings.set(key, value),
  },
  './localDataTransfer': {
    serializeLocalDatabase: async () => Uint8Array.from([1, 2, 3]),
  },
};

new Function('require', 'module', 'exports', code)((name) => {
  if (name in mocks) return mocks[name];
  throw new Error(`Unexpected import: ${name}`);
}, backupModule, backupModule.exports);

async function main() {
  const { runAutomaticBackupIfDue } = backupModule.exports;
  assert.equal(await runAutomaticBackupIfDue(), null, 'A recent backup should not run again before the interval.');
  assert.equal(writtenFiles.length, 0);

  settings.set('backup.automatic.lastAt', new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString());
  const savedAt = await runAutomaticBackupIfDue();
  assert.ok(savedAt);
  assert.equal(writtenFiles.length, 1);
  assert.match(writtenFiles[0].uri, /\/backups\/ostudy-auto-.*\.db$/);
  assert.equal(writtenFiles[0].options.encoding, 'base64');
  assert.equal(settings.get('backup.automatic.lastAt'), savedAt);
  assert.equal(removedFiles.length, 1, 'The oldest file should be removed when more than 10 backups exist.');

  assert.equal(await runAutomaticBackupIfDue(), null, 'The successful backup timestamp must prevent an immediate duplicate.');
  assert.equal(writtenFiles.length, 1);
  console.log('Passed: interval gating, device backup creation, last-backup tracking, and 10-file retention.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
