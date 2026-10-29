export const DATABASE_VERSION = 1;

export const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS profile (
  id TEXT PRIMARY KEY NOT NULL CHECK (id = 'local'),
  name TEXT NOT NULL DEFAULT '',
  goal TEXT,
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  avatar_style TEXT NOT NULL DEFAULT 'initials',
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  language TEXT NOT NULL,
  language_set_manually INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY NOT NULL,
  parent_id TEXT REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'folder-outline',
  color TEXT NOT NULL DEFAULT 'blue',
  is_favorite INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS spaces_parent_position_idx ON spaces(parent_id, position, id);

CREATE TABLE IF NOT EXISTS active_spaces (
  space_id TEXT PRIMARY KEY NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS content_topics (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES content_topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  importance TEXT NOT NULL DEFAULT 'medium',
  last_reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS content_topics_space_idx ON content_topics(space_id, created_at, id);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  last_message_preview TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chats_space_updated_idx ON chats(space_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'tutor')),
  content TEXT NOT NULL,
  attachments TEXT NOT NULL DEFAULT '[]',
  image_url TEXT,
  image_urls TEXT,
  quiz TEXT,
  sources TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_chat_created_idx ON messages(chat_id, created_at, id);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  kind TEXT,
  mime TEXT,
  size INTEGER,
  file_uri TEXT,
  text_content TEXT,
  storage_path TEXT,
  original_size_bytes INTEGER,
  stored_size_bytes INTEGER,
  compression TEXT,
  original_name TEXT,
  url TEXT,
  topic_id TEXT REFERENCES content_topics(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS resources_space_position_idx ON resources(space_id, position, created_at DESC);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS calendar_events_space_date_idx ON calendar_events(space_id, event_date, id);

CREATE TABLE IF NOT EXISTS grades (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  score REAL NOT NULL,
  max_score REAL NOT NULL,
  weight REAL NOT NULL DEFAULT 1,
  topic_id TEXT REFERENCES content_topics(id) ON DELETE SET NULL,
  graded_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS grades_space_created_idx ON grades(space_id, created_at, id);

CREATE TABLE IF NOT EXISTS student_model (
  space_id TEXT PRIMARY KEY NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  goal TEXT,
  model_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS topic_knowledge (
  topic_id TEXT PRIMARY KEY NOT NULL REFERENCES content_topics(id) ON DELETE CASCADE,
  knowledge REAL NOT NULL DEFAULT 0,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS episodic_memory (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS episodic_memory_space_created_idx ON episodic_memory(space_id, created_at);
CREATE TABLE IF NOT EXISTS semantic_memory (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS semantic_memory_space_updated_idx ON semantic_memory(space_id, updated_at);
CREATE TABLE IF NOT EXISTS safety_log (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS timetable_classes (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT REFERENCES spaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  room TEXT NOT NULL DEFAULT '',
  weekday INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS timetable_weekday_start_idx ON timetable_classes(weekday, start_time, id);
`;
