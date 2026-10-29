const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const JSZip = require('jszip');
const XLSX = require('xlsx');
let legacyDocInput = null;

const source = fs.readFileSync(path.resolve(__dirname, '..', 'src/services/resources/officePreview.ts'), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const officeModule = { exports: {} };
new Function('require', 'module', 'exports', code)((name) => {
  if (name === 'jszip') return { __esModule: true, default: JSZip };
  if (name === 'xlsx') return XLSX;
  if (name === '@mdgate/doc') {
    return { toMarkdown: async bytes => { legacyDocInput = bytes; return 'Legacy <script>content</script>'; } };
  }
  if (name === '../appLimits') {
    return {
      getAppLimits: async () => ({
        officeArchiveEntries: 10000,
        officeUnpackedMiB: 120,
        officeHtmlMiChars: 24,
        officeSlides: 300,
        officeSheets: 100,
        officeRows: 5000,
        officeColumns: 200,
      }),
    };
  }
  throw new Error(`Unexpected import: ${name}`);
}, officeModule, officeModule.exports);

function toBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

async function main() {
  const { renderOfficePreview } = officeModule.exports;
  const docx = new JSZip();
  docx.file('word/document.xml', '<w:document xmlns:w="word"><w:body><w:p><w:r><w:t>Word preview &amp; safety</w:t></w:r></w:p><w:p><w:r><w:t>&lt;script&gt;bad&lt;/script&gt;</w:t></w:r></w:p></w:body></w:document>');
  const wordHtml = await renderOfficePreview(toBase64(await docx.generateAsync({ type: 'uint8array' })), 'docx');
  assert.match(wordHtml, /Word preview &amp; safety/);
  assert.match(wordHtml, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(wordHtml, /<script>/);

  const deck = new JSZip();
  deck.file('ppt/presentation.xml', '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId r:id="second"/><p:sldId r:id="first"/></p:sldIdLst></p:presentation>');
  deck.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Id="first" Target="slides/slide1.xml"/><Relationship Id="second" Target="slides/slide2.xml"/></Relationships>');
  deck.file('ppt/slides/slide1.xml', '<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Slide one</a:t></a:r></a:p></p:sld>');
  deck.file('ppt/slides/slide2.xml', '<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Slide two</a:t></a:r></a:p></p:sld>');
  const deckHtml = await renderOfficePreview(toBase64(await deck.generateAsync({ type: 'uint8array' })), 'pptx');
  assert(deckHtml.indexOf('Slide two') < deckHtml.indexOf('Slide one'));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Header', 'Value'], ['日本語', 42], ['<script>bad</script>', 5]]), 'Sheet One');
  const sheetHtml = await renderOfficePreview(toBase64(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })), 'xlsx');
  assert.match(sheetHtml, /Sheet One/);
  assert.match(sheetHtml, /日本語/);
  assert.match(sheetHtml, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(sheetHtml, /<script>/);

  const docBytes = Buffer.from('legacy-doc-bytes');
  const docHtml = await renderOfficePreview(toBase64(docBytes), 'doc');
  assert.deepEqual(Buffer.from(legacyDocInput), docBytes);
  assert.match(docHtml, /Legacy &lt;script&gt;content&lt;\/script&gt;/);
  assert.doesNotMatch(docHtml, /<script>/);

  const csvHtml = await renderOfficePreview(toBase64(Buffer.from('Name,Value\nTest,12', 'utf8')), 'csv');
  assert.match(csvHtml, /Name,Value/);
  await assert.rejects(renderOfficePreview('bm90LWFuLW9mZmlsZQ==', 'unsupported'), /não pode ser pré-visualizado/);
  console.log('Passed: local DOC, DOCX, PPTX, XLSX, and CSV preview; safe escaping of document content.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
