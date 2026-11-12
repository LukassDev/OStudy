import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  deserializeDatabaseAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';
import { getDatabase } from '../db/client';
import { DATABASE_VERSION, INITIAL_SCHEMA } from '../db/schema';
import { migrateDatabase } from '../db/migrations';
import { prepareDatabaseSnapshot } from '../db/serialization';

const TABLES = [
  'profile', 'spaces', 'active_spaces', 'content_topics', 'chats', 'messages',
  'resources', 'calendar_events', 'classroom_ignored_events', 'grade_modules', 'grades', 'student_model', 'topic_knowledge',
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
  return prepareDatabaseSnapshot(await database.serializeAsync());
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
  const snapshot = prepareDatabaseSnapshot(bytes);

  let imported: SQLiteDatabase;
  try {
    imported = await deserializeDatabaseAsync(snapshot);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`O ficheiro tem cabeçalho SQLite, mas não foi possível abri-lo. Pode estar incompleto, corrompido ou ser incompatível com o SQLite desta versão. Detalhe: ${reason}`);
  }
  let phase = 'ler a versão da base importada';
  let staged: SQLiteDatabase | null = null;
  try {
    const { user_version: version } = await imported.getFirstAsync<{ user_version: number }>('PRAGMA user_version') ?? { user_version: 0 };
    if (version > DATABASE_VERSION) {
      throw new Error(`Este ficheiro usa uma versão de dados mais recente (${version}). Atualize a aplicação antes de importar.`);
    }
    if (version < 1) throw new Error('O ficheiro não contém uma base OStudy reconhecida.');
    phase = 'verificar a integridade do ficheiro original';
    const sourceIntegrity = await imported.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    if (sourceIntegrity?.integrity_check !== 'ok') throw new Error('A base importada está danificada.');
    phase = `atualizar a base importada da versão ${version} para a versão ${DATABASE_VERSION}`;
    // Migrate a normal temporary database. Growing a deserialized WASM database
    // while adding the new grade tables can invalidate its serialized backing.
    staged = await openDatabaseAsync(':memory:', { useNewConnection: true });
    await staged.execAsync(INITIAL_SCHEMA);
    await staged.execAsync('PRAGMA foreign_keys = ON');
    const staging = staged;
    await staging.withTransactionAsync(async () => {
      await staging.execAsync('PRAGMA defer_foreign_keys = ON');
      await copyDatabaseTables(imported, staging);
      await staging.execAsync(`PRAGMA user_version = ${version}`);
    });
    await migrateDatabase(staging);
    phase = 'validar os dados da base importada';
    const rows = await staging.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const tableNames = new Set(rows.map(row => row.name));
    const missing = TABLES.filter(table => !tableNames.has(table));
    if (missing.length) throw new Error(`A base importada não contém as tabelas necessárias: ${missing.join(', ')}.`);
    const current = await getDatabase();
    for (const table of TABLES) {
      const [sourceColumns, currentColumns] = await Promise.all([
        staging.getAllAsync<{ name: string }>(`PRAGMA table_info("${table}")`),
        current.getAllAsync<{ name: string; notnull: number; dflt_value: string | null }>(`PRAGMA table_info("${table}")`),
      ]);
      const sourceNames = new Set(sourceColumns.map(column => column.name));
      // Older backups need not contain optional columns left in the local
      // schema by earlier builds. The copy omits them, allowing SQLite to use
      // NULL or the column default (e.g. grade_modules.qualitative_scores).
      const missingColumns = currentColumns.filter(column => !sourceNames.has(column.name)
        && column.notnull === 1 && column.dflt_value === null);
      if (missingColumns.length) {
        throw new Error(`A tabela "${table}" do ficheiro não contém as colunas obrigatórias: ${missingColumns.map(column => column.name).join(', ')}.`);
      }
    }
    const importedSettings = await staging.getAllAsync<{ key: string }>('SELECT key FROM settings');
    if (importedSettings.some(({ key }) => /api.?key|secret/i.test(key))) {
      throw new Error('O ficheiro contém uma chave ou segredo nas definições. Remova essa informação antes de importar.');
    }
    const integrity = await staging.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    if (integrity?.integrity_check !== 'ok') throw new Error('A base importada está danificada.');
    const foreignKeyErrors = await staging.getAllAsync<{ table: string }>('PRAGMA foreign_key_check');
    if (foreignKeyErrors.length) throw new Error('A base importada contém relações inválidas entre os dados.');
    await closeImportedDatabase(imported);
    return staging;
  } catch (error) {
    if (staged) await closeImportedDatabase(staged);
    await closeImportedDatabase(imported);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Não foi possível ${phase}. Detalhe: ${reason}`);
  }
}

async function copyDatabaseTables(source: SQLiteDatabase, destination: SQLiteDatabase): Promise<void> {
  const sourceTables = new Set((await source.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  )).map(row => row.name));
  for (const table of ['profile', 'spaces', 'grades']) {
    if (!sourceTables.has(table)) throw new Error(`A base importada não contém a tabela necessária "${table}".`);
  }
  for (const table of TABLES) {
    // Tables introduced after the backup version start empty. New columns keep
    // their current defaults (including NULL module/type for legacy grades).
    if (!sourceTables.has(table)) continue;
    const sourceColumns = new Set((await source.getAllAsync<{ name: string }>(`PRAGMA table_info("${table}")`)).map(column => column.name));
    const columns = await destination.getAllAsync<{ name: string }>(`PRAGMA table_info("${table}")`);
    const names = columns.map(column => column.name).filter(name => sourceColumns.has(name));
    const rows = await source.getAllAsync<Record<string, unknown>>(`SELECT * FROM "${table}"`);
    if (!rows.length || !names.length) continue;
    const placeholders = names.map(() => '?').join(', ');
    const sql = `INSERT INTO "${table}" (${names.map(name => `"${name}"`).join(', ')}) VALUES (${placeholders})`;
    for (const [index, row] of rows.entries()) {
      try {
        await destination.runAsync(sql, ...names.map(name => row[name] as string | number | null | Uint8Array));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Falha ao importar a tabela "${table}", registo ${index + 1}: ${reason}`);
      }
    }
  }
}

async function closeImportedDatabase(database: SQLiteDatabase): Promise<void> {
  try {
    await database.closeAsync();
  } catch (error) {
    // A failed statement finalization must not mask the original import error
    // or report a failed import after its transaction has already committed.
    console.error('Could not close the temporary imported database:', error);
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
      await current.execAsync('PRAGMA defer_foreign_keys = ON');
      for (const table of DELETE_ORDER) await current.runAsync(`DELETE FROM "${table}"`);
      await copyDatabaseTables(imported, current);
      const { user_version: version } = await imported.getFirstAsync<{ user_version: number }>('PRAGMA user_version') ?? { user_version: DATABASE_VERSION };
      await current.execAsync(`PRAGMA user_version = ${Math.min(version, DATABASE_VERSION)}`);
      await current.runAsync(
        "UPDATE settings SET value = 'false', updated_at = ? WHERE key = 'backup.automatic.enabled'",
        new Date().toISOString(),
      );
    });
  } finally {
    await closeImportedDatabase(imported);
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
