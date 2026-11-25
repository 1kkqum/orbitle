import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const configuredPath = process.env.DATABASE_PATH || './data/orbitle.sqlite';
const dbPath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(here, '..', configuredPath);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  interests TEXT NOT NULL DEFAULT '[]',
  goals TEXT NOT NULL DEFAULT '[]',
  looking_for TEXT NOT NULL DEFAULT '',
  onboarding_complete INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orbits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  accent TEXT NOT NULL DEFAULT '#d5fa6a'
);
CREATE TABLE IF NOT EXISTS orbit_members (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  orbit_id INTEGER NOT NULL REFERENCES orbits(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, orbit_id)
);
CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'Mongolia / Online',
  description TEXT NOT NULL,
  deadline TEXT,
  url TEXT,
  source_name TEXT NOT NULL DEFAULT 'Community listing',
  is_demo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS saved_opportunities (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, opportunity_id)
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  skills TEXT NOT NULL DEFAULT '[]',
  looking_for TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Recruiting',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS project_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id)
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS post_likes (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS connection_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','connected','declined')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(requester_id <> recipient_id),
  UNIQUE(requester_id, recipient_id)
);
CREATE TABLE IF NOT EXISTS orbit_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orbit_id INTEGER NOT NULL REFERENCES orbits(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1500),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS orbit_messages_recent ON orbit_messages(orbit_id, id DESC);
CREATE TABLE IF NOT EXISTS verification_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK(method IN ('portfolio','affiliation','project')),
  evidence_url TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS post_bookmarks (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id,user_id)
);
CREATE TABLE IF NOT EXISTS post_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 600),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS post_reposts (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id,user_id)
);
CREATE TABLE IF NOT EXISTS direct_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1500),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS direct_messages_pair ON direct_messages(sender_id,recipient_id,id DESC);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'Online',
  host TEXT NOT NULL DEFAULT 'ORBITLE Community'
);
CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(event_id,user_id)
);
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(blocker_id,blocked_id),
  CHECK(blocker_id <> blocked_id)
);
CREATE TABLE IF NOT EXISTS content_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK(target_type IN ('user','post')),
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK(length(reason) BETWEEN 3 AND 80),
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved','dismissed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS content_reports_status ON content_reports(status,id DESC);
CREATE TABLE IF NOT EXISTS project_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 120),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done')),
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS project_tasks_project ON project_tasks(project_id, id DESC);
CREATE TABLE IF NOT EXISTS project_contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 120),
  description TEXT NOT NULL CHECK(length(description) BETWEEN 10 AND 700),
  evidence_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','declined')),
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS project_contributions_user ON project_contributions(user_id, status, id DESC);
CREATE TABLE IF NOT EXISTS opportunity_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'interested' CHECK(status IN ('interested','preparing','applied','interview','accepted','rejected')),
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id,opportunity_id)
);
`);

// Additive migrations keep existing local databases usable after upgrades.
const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map(column => column.name));
if (!userColumns.has('goals')) db.exec("ALTER TABLE users ADD COLUMN goals TEXT NOT NULL DEFAULT '[]'");
if (!userColumns.has('looking_for')) db.exec("ALTER TABLE users ADD COLUMN looking_for TEXT NOT NULL DEFAULT ''");
if (!userColumns.has('onboarding_complete')) db.exec('ALTER TABLE users ADD COLUMN onboarding_complete INTEGER NOT NULL DEFAULT 0');

const orbitCount = db.prepare('SELECT COUNT(*) AS count FROM orbits').get().count;
if (orbitCount === 0) {
  const insert = db.prepare('INSERT INTO orbits (slug,name,category,description,member_count,accent) VALUES (?,?,?,?,?,?)');
  const seed = db.transaction(() => {
    [
      ['campus-builders','Campus Builders','Campus','Meet students who start things, share knowledge, and build beyond class.',128,'#d5fa6a'],
      ['future-finance','Future of Finance','Industry','Explore economics, finance, fintech, and data-driven decision making.',94,'#b7d9ff'],
      ['mongolian-alumni','Mongolian Alumni Network','Alumni','Learn from people who have studied or worked in different fields and countries.',76,'#d8ccff'],
      ['open-project-lab','Open Project Lab','Projects','Find teammates, test ideas, and publish projects with visible outcomes.',63,'#ffb8a5']
    ].forEach(row => insert.run(...row));
  }); seed();
}
const opportunityCount = db.prepare('SELECT COUNT(*) AS count FROM opportunities').get().count;
if (opportunityCount === 0) {
  const insert = db.prepare(`INSERT INTO opportunities (title,organization,category,location,description,deadline,url,source_name,is_demo) VALUES (?,?,?,?,?,?,?,?,1)`);
  const seed = db.transaction(() => {
    [
      ['Student Research Showcase','ORBITLE Community','Research','Online','Share a research idea, working paper, or data project and receive peer feedback.','2027-02-15','https://example.com/research-showcase','Demo listing'],
      ['Youth Innovation Challenge','Community opportunity example','Competition','Mongolia / Online','A sample listing for student teams working on practical solutions to local problems.','2027-03-01','https://example.com/youth-innovation','Demo listing'],
      ['Open Data Project Sprint','ORBITLE Project Lab','Hackathon','Online','Build a small data product with a team, document the method, and present the result.','2027-01-20','https://example.com/data-sprint','Demo listing'],
      ['University Application Peer Circle','ORBITLE Community','Mentorship','Online','Join a peer group to compare application timelines and share publicly available resources.','2027-01-10','https://example.com/peer-circle','Demo listing']
    ].forEach(row => insert.run(...row));
  }); seed();
}
const projectCount = db.prepare('SELECT COUNT(*) AS count FROM projects').get().count;
if (projectCount === 0) {
  const insert = db.prepare('INSERT INTO projects (title,summary,skills,looking_for,status) VALUES (?,?,?,?,?)');
  const seed = db.transaction(() => {
    [
      ['Mongolia Price Tracker','A student-built dashboard exploring how everyday prices change over time.','["Data analysis","Frontend","Research"]','Python/data researcher and UI developer','Recruiting'],
      ['Campus Skills Exchange','A small directory for students to trade lessons, study sessions, and project help.','["Product design","React","Community"]','Product-minded builder and designer','Recruiting'],
      ['Local Impact Map','Map public community projects and make their outcomes easier to discover.','["Mapping","Research","Web development"]','Researcher and frontend developer','Recruiting']
    ].forEach(row => insert.run(...row));
  }); seed();
}

const eventCount = db.prepare('SELECT COUNT(*) AS count FROM events').get().count;
if (eventCount === 0) {
  const insert = db.prepare('INSERT INTO events (title,category,description,starts_at,location,host) VALUES (?,?,?,?,?,?)');
  const seed = db.transaction(() => {
    [
      ['Build Night: Ship a Small Product','Build session','Bring a small idea, pair with another builder, and leave with a demo or a concrete next step.','2026-11-07T10:00:00.000Z','Online','Open Project Lab'],
      ['Research Reading Circle','Research','Discuss one paper, share the central argument, and practice giving useful peer feedback.','2026-11-12T11:00:00.000Z','Online','Student Research Orbit'],
      ['Careers in Economics & Data','Networking','A structured student conversation about economics, data analysis, and early career exploration.','2026-11-19T09:00:00.000Z','Ulaanbaatar / Online','Future of Finance']
    ].forEach(row => insert.run(...row));
  }); seed();
}
