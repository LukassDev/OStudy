import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  deserializeDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';
import { getDatabase } from '../db/client';
import { DATABASE_VERSION } from '../db/schema';
import { migrateDatabase } from '../db/migrations';

const TABLES = [
  'profile', 'spaces', 'active_spaces', 'content_topics', 'chats', 'messages',
  'resources', 'calendar_events', 'grades', 'student_model', 'topic_knowledge',
  'episodic_memory', 'semantic_memory', 'safety_log', 'settings', 'timetable_classes',
] as const;
const DELETE_ORDER = [...TABLES].reverse();

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    encoded += alphabet[a >> 2];
    encoded += alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)];
    encoded += b === undefined ? '=' : alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)];
    encoded += c === undefined ? '=' : alphabet[c & 63];
  }
  return encoded;
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/\s/g, ''));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export async function exportLocalDatabase(): Promise<void> {
  const bytes = await serializeLocalDatabase();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `ostudy-${date}.db`;
  if (Platform.OS === 'web') {
    const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  if (!FileSystem.documentDirectory) throw new Error('A pasta local de documentos não está disponível.');
  const uri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
  if (!(await Sharing.isAvailableAsync())) throw new Error('A partilha de ficheiros não está disponível neste aparelho.');
  await Sharing.shareAsync(uri, { mimeType: 'application/x-sqlite3', dialogTitle: 'Exportar dados OStudy' });
}

export async function serializeLocalDatabase(): Promise<Uint8Array> {
  const database = await getDatabase();
  return database.serializeAsync();
}

async function readPickedBytes(asset: DocumentPicker.DocumentPickerAsset): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    if (!asset.file) throw new Error('Não foi possível ler o ficheiro selecionado no navegador.');
    return new Uint8Array(await asset.file.arrayBuffer());
  }
  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  return base64ToBytes(base64);
}

async function validateImport(bytes: Uint8Array): Promise<SQLiteDatabase> {
  let imported: SQLiteDatabase;
  try {
    imported = await deserializeDatabaseAsync(bytes);
  } catch {
    throw new Error('O ficheiro selecionado não é uma base de dados SQLite válida.');
  }
  try {
    const { user_version: version } = await imported.getFirstAsync<{ user_version: number }>('PRAGMA user_version') ?? { user_version: 0 };
    if (version > DATABASE_VERSION) {
      throw new Error(`Este ficheiro usa uma versão de dados mais recente (${version}). Atualize a aplicação antes de importar.`);
    }
    if (version < 1) throw new Error('O ficheiro não contém uma base OStudy reconhecida.');
    await migrateDatabase(imported);
    const rows = await imported.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const tableNames = new Set(rows.map(row => row.name));
    const missing = TABLES.filter(table => !tableNames.has(table));
    if (missing.length) throw new Error(`A base importada não contém as tabelas necessárias: ${missing.join(', ')}.`);
    const current = await getDatabase();
    for (const table of TABLES) {
      const [sourceColumns, currentColumns] = await Promise.all([
        imported.getAllAsync<{ name: string }>(`PRAGMA table_info("${table}")`),
        current.getAllAsync<{ name: string }>(`PRAGMA table_info("${table}")`),
      ]);
      const sourceNames = new Set(sourceColumns.map(column => column.name));
      const missingColumns = currentColumns.filter(column => !sourceNames.has(column.name));
      if (missingColumns.length) {
        throw new Error(`A tabela "${table}" do ficheiro não é compatível com esta versão.`);
      }
    }
    const importedSettings = await imported.getAllAsync<{ key: string }>('SELECT key FROM settings');
    if (importedSettings.some(({ key }) => /api.?key|secret/i.test(key))) {
      throw new Error('O ficheiro contém uma chave ou segredo nas definições. Remova essa informação antes de importar.');
    }
    const integrity = await imported.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    if (integrity?.integrity_check !== 'ok') throw new Error('A base importada está danificada.');
    const foreignKeyErrors = await imported.getAllAsync<{ table: string }>('PRAGMA foreign_key_check');
    if (foreignKeyErrors.length) throw new Error('A base importada contém relações inválidas entre os dados.');
    return imported;
  } catch (error) {
    await imported.closeAsync();
    throw error;
  }
}

export async function pickAndImportLocalDatabase(
  confirmReplacement: (message: string) => Promise<boolean>,
): Promise<boolean> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/x-sqlite3', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return false;
  const asset = result.assets[0];
  const bytes = await readPickedBytes(asset);
  const imported = await validateImport(bytes);
  let confirmed = false;
  try {
    confirmed = await confirmReplacement('Isto substitui todos os dados locais atuais. Continuar?');
    if (!confirmed) return false;
    const current = await getDatabase();
    await current.withTransactionAsync(async () => {
      for (const table of DELETE_ORDER) await current.runAsync(`DELETE FROM "${table}"`);
      for (const table of TABLES) {
        const columns = await current.getAllAsync<{ name: string }>(`PRAGMA table_info("${table}")`);
        const names = columns.map(column => column.name);
        const rows = await imported.getAllAsync<Record<string, unknown>>(`SELECT * FROM "${table}"`);
        if (!rows.length || !names.length) continue;
        const placeholders = names.map(() => '?').join(', ');
        const sql = `INSERT INTO "${table}" (${names.map(name => `"${name}"`).join(', ')}) VALUES (${placeholders})`;
        for (const row of rows) await current.runAsync(sql, ...names.map(name => row[name] as string | number | null | Uint8Array));
      }
      const { user_version: version } = await imported.getFirstAsync<{ user_version: number }>('PRAGMA user_version') ?? { user_version: DATABASE_VERSION };
      await current.execAsync(`PRAGMA user_version = ${Math.min(version, DATABASE_VERSION)}`);
      await current.runAsync(
        "UPDATE settings SET value = 'false', updated_at = ? WHERE key = 'backup.automatic.enabled'",
        new Date().toISOString(),
      );
    });
  } finally {
    await imported.closeAsync();
  }
  return true;
}

export async function clearLocalDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    for (const table of DELETE_ORDER) await database.runAsync(`DELETE FROM "${table}"`);
  });
  if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
    for (const folder of ['chat-attachments', 'resources', 'backups']) {
      await FileSystem.deleteAsync(`${FileSystem.documentDirectory}${folder}/`, { idempotent: true });
    }
  }
}
