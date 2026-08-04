import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.db');
const db = new Database(dbPath);

// Enable foreign keys & WAL mode for performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize Tables
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      audio_url TEXT NOT NULL,
      duration REAL NOT NULL,
      voice TEXT NOT NULL,
      style TEXT NOT NULL,
      pacing TEXT,
      is_multi_speaker INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      global_voice TEXT DEFAULT 'Kore',
      global_style TEXT DEFAULT 'didatico',
      global_pacing TEXT DEFAULT 'normal',
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS slides (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      slide_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      script TEXT,
      image_url TEXT,
      audio_url TEXT,
      duration REAL,
      voice TEXT,
      style TEXT,
      pacing TEXT,
      status TEXT DEFAULT 'idle',
      error_message TEXT,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
  `);
  console.log('✅ Banco de dados SQLite inicializado com sucesso em:', dbPath);
}

// ----------------------------------------------------
// History Queries
// ----------------------------------------------------
export function getHistory() {
  const stmt = db.prepare('SELECT * FROM history ORDER BY created_at DESC');
  const rows = stmt.all();
  return rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    text: r.text,
    audioUrl: r.audio_url,
    duration: r.duration,
    voice: r.voice,
    style: r.style,
    pacing: r.pacing,
    isMultiSpeaker: Boolean(r.is_multi_speaker),
    createdAt: r.created_at,
  }));
}

export function addHistoryItem(item: {
  id?: string;
  title: string;
  text: string;
  audioUrl: string;
  duration: number;
  voice: string;
  style: string;
  pacing?: string;
  isMultiSpeaker?: boolean;
}) {
  const id = item.id || Date.now().toString();
  const stmt = db.prepare(`
    INSERT INTO history (id, title, text, audio_url, duration, voice, style, pacing, is_multi_speaker)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    item.title,
    item.text,
    item.audioUrl,
    item.duration,
    item.voice,
    item.style,
    item.pacing || 'normal',
    item.isMultiSpeaker ? 1 : 0
  );
  return id;
}

export function deleteHistoryItem(id: string) {
  const stmt = db.prepare('DELETE FROM history WHERE id = ?');
  stmt.run(id);
}

export function clearHistory() {
  const stmt = db.prepare('DELETE FROM history');
  stmt.run();
}

// ----------------------------------------------------
// Course & Slide Queries
// ----------------------------------------------------
export function getCourses() {
  const coursesStmt = db.prepare('SELECT * FROM courses ORDER BY updated_at DESC');
  const slidesStmt = db.prepare('SELECT * FROM slides WHERE course_id = ? ORDER BY slide_number ASC');

  const courses = coursesStmt.all() as any[];
  return courses.map((c) => {
    const slides = slidesStmt.all(c.id) as any[];
    return {
      id: c.id,
      title: c.title,
      globalVoice: c.global_voice,
      globalStyle: c.global_style,
      globalPacing: c.global_pacing,
      updatedAt: c.updated_at,
      slides: slides.map((s) => ({
        id: s.id,
        slideNumber: s.slide_number,
        title: s.title,
        script: s.script || '',
        imageUrl: s.image_url || undefined,
        audioUrl: s.audio_url || undefined,
        duration: s.duration || undefined,
        voice: s.voice || undefined,
        style: s.style || undefined,
        pacing: s.pacing || undefined,
        status: s.status || 'idle',
        errorMessage: s.error_message || undefined,
      })),
    };
  });
}

export function saveCourse(courseData: {
  id: string;
  title: string;
  globalVoice?: string;
  globalStyle?: string;
  globalPacing?: string;
  slides: Array<{
    id: string;
    slideNumber: number;
    title: string;
    script: string;
    imageUrl?: string;
    audioUrl?: string;
    duration?: number;
    voice?: string;
    style?: string;
    pacing?: string;
    status?: string;
    errorMessage?: string;
  }>;
}) {
  const saveTransaction = db.transaction(() => {
    // 1. Upsert Course
    const upsertCourse = db.prepare(`
      INSERT INTO courses (id, title, global_voice, global_style, global_pacing, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        global_voice = excluded.global_voice,
        global_style = excluded.global_style,
        global_pacing = excluded.global_pacing,
        updated_at = datetime('now', 'localtime')
    `);
    upsertCourse.run(
      courseData.id,
      courseData.title,
      courseData.globalVoice || 'Kore',
      courseData.globalStyle || 'didatico',
      courseData.globalPacing || 'normal'
    );

    // 2. Delete existing slides for course
    const deleteSlides = db.prepare('DELETE FROM slides WHERE course_id = ?');
    deleteSlides.run(courseData.id);

    // 3. Insert new slides
    const insertSlide = db.prepare(`
      INSERT INTO slides (
        id, course_id, slide_number, title, script, image_url, audio_url,
        duration, voice, style, pacing, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of courseData.slides) {
      insertSlide.run(
        s.id,
        courseData.id,
        s.slideNumber,
        s.title,
        s.script,
        s.imageUrl || null,
        s.audioUrl || null,
        s.duration || null,
        s.voice || null,
        s.style || null,
        s.pacing || null,
        s.status || 'idle',
        s.errorMessage || null
      );
    }
  });

  saveTransaction();
}

export function deleteCourse(id: string) {
  const stmt = db.prepare('DELETE FROM courses WHERE id = ?');
  stmt.run(id);
}
