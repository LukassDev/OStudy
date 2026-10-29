import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { toMarkdown } from '@mdgate/doc';
import { getAppLimits, type AppLimits } from '../appLimits';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

function decodeXml(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, token: string) => {
    if (token[0] !== '#') {
      return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[token.toLowerCase()];
    }
    const codePoint = token[1].toLowerCase() === 'x'
      ? Number.parseInt(token.slice(2), 16)
      : Number.parseInt(token.slice(1), 10);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : '';
  });
}

function documentHtml(html: string, maxHtmlChars: number): string {
  if (html.length > maxHtmlChars) throw new Error('O documento é demasiado grande para pré-visualizar.');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{font:16px/1.6 system-ui,sans-serif;margin:0;padding:24px;color:#202020;background:#fff;overflow-wrap:anywhere}section{padding:16px 0;border-bottom:1px solid #ddd;overflow:auto}table{border-collapse:collapse;max-width:100%;font-size:14px}td,th{border:1px solid #ddd;padding:8px;min-width:48px}pre{white-space:pre-wrap}h1,h2,h3{line-height:1.3}@media(max-width:500px){body{padding:12px}}</style></head><body>${html}</body></html>`;
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, ''));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function loadZip(base64: string, limits: AppLimits): Promise<JSZip> {
  const bytes = base64ToBytes(base64);
  const zip = await JSZip.loadAsync(bytes);
  const entries = Object.values(zip.files).filter(entry => !entry.dir);
  if (entries.length > limits.officeArchiveEntries) throw new Error('O documento contém demasiados ficheiros internos.');
  let totalBytes = 0;
  for (const entry of entries) {
    const declaredSize = (entry as typeof entry & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
    if (Number.isFinite(declaredSize)) {
      totalBytes += declaredSize!;
      if (totalBytes > limits.officeUnpackedMiB * 1024 * 1024) throw new Error('O documento excede o limite de pré-visualização.');
    }
  }
  return zip;
}

async function renderDocx(zip: JSZip): Promise<string> {
  const document = zip.file('word/document.xml');
  if (!document) throw new Error('O documento Word está incompleto.');
  const xml = await document.async('string');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('O documento Word contém XML não suportado.');
  const paragraphs = [...xml.matchAll(/<(?:\w+:)?p\b[^>]*>([\s\S]*?)<\/(?:\w+:)?p>/g)]
    .map(([, paragraph]) => [...paragraph.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)]
      .map(([, text]) => decodeXml(text)).join(''))
    .filter(Boolean);
  return paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('');
}

function xmlAttributes(value: string): Map<string, string> {
  return new Map([...value.matchAll(/([\w:.-]+)\s*=\s*(['"])(.*?)\2/g)]
    .map(([, key, , content]) => [key, decodeXml(content)]));
}

function resolveSlidePath(target: string): string {
  const parts: string[] = [];
  for (const part of target.replace(/^\/+/, '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) throw new Error('O documento PowerPoint contém um caminho inválido.');
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  const path = target.startsWith('/') ? parts.join('/') : ['ppt', ...parts].join('/');
  if (!path.startsWith('ppt/slides/')) throw new Error('O documento PowerPoint contém uma referência inválida.');
  return path;
}

async function renderPptx(zip: JSZip, limits: AppLimits): Promise<string> {
  const presentationFile = zip.file('ppt/presentation.xml');
  const relationshipsFile = zip.file('ppt/_rels/presentation.xml.rels');
  if (!presentationFile || !relationshipsFile) throw new Error('A apresentação PowerPoint está incompleta.');
  const [presentation, relationships] = await Promise.all([
    presentationFile.async('string'),
    relationshipsFile.async('string'),
  ]);
  if (/<!DOCTYPE|<!ENTITY/i.test(presentation) || /<!DOCTYPE|<!ENTITY/i.test(relationships)) {
    throw new Error('A apresentação PowerPoint contém XML não suportado.');
  }
  const targets = new Map([...relationships.matchAll(/<(?:\w+:)?Relationship\b([^>]*)\/?>/g)]
    .map(([, attributes]) => {
      const values = xmlAttributes(attributes);
      return [values.get('Id') || '', values.get('Target') || ''];
    }));
  const slideIds = [...presentation.matchAll(/<(?:\w+:)?sldId\b([^>]*)\/?>/g)];
  if (!slideIds.length || slideIds.length > limits.officeSlides) throw new Error('A apresentação não contém slides ou excede o limite de pré-visualização.');
  const slides: string[] = [];
  for (const [index, [, attributes]] of slideIds.entries()) {
    const relationshipId = xmlAttributes(attributes).get('r:id');
    const target = relationshipId ? targets.get(relationshipId) : undefined;
    if (!target) continue;
    const slide = zip.file(resolveSlidePath(target));
    if (!slide) throw new Error('Não foi possível ler um slide da apresentação.');
    const xml = await slide.async('string');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('O slide contém XML não suportado.');
    const paragraphs = [...xml.matchAll(/<(?:\w+:)?p\b[^>]*>([\s\S]*?)<\/(?:\w+:)?p>/g)]
      .map(([, paragraph]) => [...paragraph.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)]
        .map(([, text]) => decodeXml(text)).join(''))
      .filter(Boolean);
    slides.push(`<section><h2>Slide ${index + 1} de ${slideIds.length}</h2>${paragraphs.map(text => `<p>${escapeHtml(text)}</p>`).join('')}</section>`);
  }
  return slides.join('');
}

function renderSpreadsheet(bytes: Uint8Array, extension: string, limits: AppLimits, maxHtmlChars: number): string {
  const workbook = XLSX.read(bytes, { type: 'array', sheetRows: limits.officeRows + 1, cellHTML: false, cellFormula: false });
  if (workbook.SheetNames.length > limits.officeSheets) throw new Error('A folha de cálculo contém demasiadas páginas.');
  let html = '';
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref']) : null;
    if (range && (range.e.r - range.s.r + 1 > limits.officeRows || range.e.c - range.s.c + 1 > limits.officeColumns)) {
      throw new Error('A folha excede o limite de pré-visualização.');
    }
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, blankrows: false });
    html += `<section><h2>${escapeHtml(name || extension)}</h2><table><tbody>${rows.map(row =>
      `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`,
    ).join('')}</tbody></table></section>`;
    if (html.length > maxHtmlChars) throw new Error('A folha excede o limite de pré-visualização.');
  }
  return html;
}

export async function renderOfficePreview(base64: string, extension: string): Promise<string> {
  const limits = await getAppLimits();
  const maxHtmlChars = limits.officeHtmlMiChars * 1024 * 1024;
  const normalized = extension.toLowerCase();
  if (normalized === 'doc') {
    const markdown = await toMarkdown(base64ToBytes(base64));
    return documentHtml(`<pre>${escapeHtml(markdown)}</pre>`, maxHtmlChars);
  }
  if (normalized === 'docx') return documentHtml(await renderDocx(await loadZip(base64, limits)), maxHtmlChars);
  if (normalized === 'pptx') return documentHtml(await renderPptx(await loadZip(base64, limits), limits), maxHtmlChars);
  if (normalized === 'xlsx' || normalized === 'xls') {
    return documentHtml(renderSpreadsheet(base64ToBytes(base64), normalized, limits, maxHtmlChars), maxHtmlChars);
  }
  if (normalized === 'csv') {
    const text = new TextDecoder('utf-8').decode(base64ToBytes(base64)).replace(/^\uFEFF/, '');
    return documentHtml(`<pre>${escapeHtml(text)}</pre>`, maxHtmlChars);
  }
  throw new Error('Este formato Office não pode ser pré-visualizado neste dispositivo.');
}
