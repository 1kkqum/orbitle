import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET.includes('replace-this')) {
  if (isProduction) throw new Error('Set a strong JWT_SECRET in the environment before production deployment.');
  console.warn('WARNING: Set JWT_SECRET in .env to a random secret of at least 32 characters.');
}
const secret = JWT_SECRET && JWT_SECRET.length >= 32 && !JWT_SECRET.includes('replace-this') ? JWT_SECRET : 'local-development-only-secret-change-before-deploying';
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false }));

const safeUser = user => user ? ({ id: user.id, name: user.name, email: user.email, bio: user.bio, interests: JSON.parse(user.interests || '[]'), goals: JSON.parse(user.goals || '[]'), lookingFor: user.looking_for || '', onboardingComplete: Boolean(user.onboarding_complete), createdAt: user.created_at, isAdmin: Boolean(process.env.ORBITLE_ADMIN_EMAIL && user.email.toLowerCase() === process.env.ORBITLE_ADMIN_EMAIL.toLowerCase()) }) : null;
const makeToken = user => jwt.sign({ sub: String(user.id) }, secret, { expiresIn: '7d', issuer: 'orbitle' });
const setAuthCookie = (res, token) => res.cookie('orbitle_session', token, { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });
function authRequired(req, res, next) {
  const token = req.cookies.orbitle_session;
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  try {
    const payload = jwt.verify(token, secret, { issuer: 'orbitle' });
    const user = db.prepare('SELECT id,name,email,bio,interests,goals,looking_for,onboarding_complete,created_at FROM users WHERE id = ?').get(Number(payload.sub));
    if (!user) return res.status(401).json({ error: 'Session is no longer valid.' });
    req.user = user; next();
  } catch { return res.status(401).json({ error: 'Your session expired. Please sign in again.' }); }
}
function validate(schema, req, res) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message || 'Please check your input.' }); return null; }
  return parsed.data;
}
// Browser mutations are expected to come from this app. SameSite cookies provide an additional CSRF barrier.
app.use('/api', (req, res, next) => {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  const origin = req.get('origin');
  const allowed = new Set([process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173', `http://localhost:5173`, `http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);
  if (origin && !allowed.has(origin)) return res.status(403).json({ error: 'Request origin not allowed.' });
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'orbitle-api' }));
app.post('/api/auth/register', async (req, res) => {
  const data = validate(z.object({ name: z.string().trim().min(2).max(60), email: z.string().trim().email().max(254), password: z.string().min(10).max(72) }), req, res);
  if (!data) return;
  const email = data.email.toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'An account with this email already exists.' });
  const hash = await bcrypt.hash(data.password, 12);
  try {
    const result = db.prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)').run(data.name, email, hash);
    const user = db.prepare('SELECT id,name,email,bio,interests,goals,looking_for,onboarding_complete,created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    setAuthCookie(res, makeToken(user)); res.status(201).json({ user: safeUser(user) });
  } catch { res.status(500).json({ error: 'Could not create account. Please try again.' }); }
});
app.post('/api/auth/login', async (req, res) => {
  const data = validate(z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(72) }), req, res);
  if (!data) return;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email.toLowerCase());
  if (!user || !(await bcrypt.compare(data.password, user.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  setAuthCookie(res, makeToken(user)); res.json({ user: safeUser(user) });
});
app.post('/api/auth/logout', (_req, res) => { res.clearCookie('orbitle_session', { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' }); res.json({ ok: true }); });
app.get('/api/auth/me', authRequired, (req, res) => res.json({ user: safeUser(req.user) }));
app.patch('/api/profile', authRequired, (req, res) => {
  const data = validate(z.object({
    name: z.string().trim().min(2).max(60), bio: z.string().trim().max(280),
    interests: z.array(z.string().trim().min(1).max(30)).max(12),
    goals: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
    lookingFor: z.string().trim().max(160).optional(), onboardingComplete: z.boolean().optional()
  }), req, res);
  if (!data) return;
  db.prepare('UPDATE users SET name=?,bio=?,interests=?,goals=?,looking_for=?,onboarding_complete=? WHERE id=?').run(
    data.name, data.bio, JSON.stringify(data.interests), JSON.stringify(data.goals || JSON.parse(req.user.goals || '[]')),
    data.lookingFor ?? req.user.looking_for ?? '', data.onboardingComplete === undefined ? (req.user.onboarding_complete || 0) : Number(data.onboardingComplete), req.user.id
  );
  res.json({ user: safeUser(db.prepare('SELECT id,name,email,bio,interests,goals,looking_for,onboarding_complete,created_at FROM users WHERE id=?').get(req.user.id)) });
});

app.get('/api/orbits', (req, res) => {
  const userId = req.cookies.orbitle_session ? (() => { try { return Number(jwt.verify(req.cookies.orbitle_session, secret, { issuer: 'orbitle' }).sub); } catch { return 0; } })() : 0;
  const rows = db.prepare(`SELECT o.*, EXISTS(SELECT 1 FROM orbit_members m WHERE m.orbit_id=o.id AND m.user_id=?) AS joined FROM orbits o ORDER BY o.id`).all(userId);
  res.json({ orbits: rows });
});
app.post('/api/orbits/:id/join', authRequired, (req, res) => {
  const id = Number(req.params.id); if (!Number.isInteger(id) || !db.prepare('SELECT id FROM orbits WHERE id=?').get(id)) return res.status(404).json({ error: 'Orbit not found.' });
  const existing = db.prepare('SELECT 1 FROM orbit_members WHERE user_id=? AND orbit_id=?').get(req.user.id, id);
  if (existing) { db.prepare('DELETE FROM orbit_members WHERE user_id=? AND orbit_id=?').run(req.user.id,id); db.prepare('UPDATE orbits SET member_count=MAX(0,member_count-1) WHERE id=?').run(id); }
  else { db.prepare('INSERT INTO orbit_members (user_id,orbit_id) VALUES (?,?)').run(req.user.id,id); db.prepare('UPDATE orbits SET member_count=member_count+1 WHERE id=?').run(id); }
  res.json({ joined: !existing, orbit: db.prepare('SELECT * FROM orbits WHERE id=?').get(id) });
});

app.get('/api/opportunities', (req, res) => {
  const q = String(req.query.q || '').slice(0,100); const category = String(req.query.category || 'All').slice(0,40);
  const userId = (() => { try { return Number(jwt.verify(req.cookies.orbitle_session || '', secret, { issuer: 'orbitle' }).sub); } catch { return 0; } })();
  const rows = db.prepare(`SELECT o.*, CASE WHEN s.user_id IS NULL THEN 0 ELSE 1 END AS saved FROM opportunities o LEFT JOIN saved_opportunities s ON s.opportunity_id=o.id AND s.user_id=? WHERE (?='' OR o.title LIKE ? OR o.organization LIKE ? OR o.description LIKE ?) AND (?='All' OR o.category=?) ORDER BY CASE WHEN o.deadline IS NULL THEN 1 ELSE 0 END, o.deadline, o.id DESC`).all(userId,q,`%${q}%`,`%${q}%`,`%${q}%`,category,category);
  res.json({ opportunities: rows.map(o => ({ ...o, isDemo: Boolean(o.is_demo), saved: Boolean(o.saved) })) });
});
app.post('/api/opportunities/:id/save', authRequired, (req, res) => {
  const id = Number(req.params.id); if (!Number.isInteger(id) || !db.prepare('SELECT id FROM opportunities WHERE id=?').get(id)) return res.status(404).json({ error: 'Opportunity not found.' });
  const exists = db.prepare('SELECT 1 FROM saved_opportunities WHERE user_id=? AND opportunity_id=?').get(req.user.id,id);
  if (exists) db.prepare('DELETE FROM saved_opportunities WHERE user_id=? AND opportunity_id=?').run(req.user.id,id);
  else db.prepare('INSERT INTO saved_opportunities (user_id,opportunity_id) VALUES (?,?)').run(req.user.id,id);
  res.json({ saved: !exists });
});
app.get('/api/saved-opportunities', authRequired, (req, res) => {
  const rows = db.prepare(`SELECT o.*,1 AS saved FROM opportunities o JOIN saved_opportunities s ON s.opportunity_id=o.id WHERE s.user_id=? ORDER BY s.saved_at DESC`).all(req.user.id);
  res.json({ opportunities: rows.map(o => ({ ...o, isDemo: Boolean(o.is_demo), saved: true })) });
});

app.get('/api/projects', (req, res) => {
  const q = String(req.query.q || '').slice(0,100);
  const userId = (() => { try { return Number(jwt.verify(req.cookies.orbitle_session || '', secret, { issuer: 'orbitle' }).sub); } catch { return 0; } })();
  const rows = db.prepare(`SELECT p.*,u.name AS owner_name,(SELECT COUNT(*) FROM project_applications a WHERE a.project_id=p.id) AS applicant_count,CASE WHEN p.owner_id=? THEN 1 ELSE 0 END AS is_owner,EXISTS(SELECT 1 FROM project_applications a WHERE a.project_id=p.id AND a.user_id=?) AS has_applied FROM projects p LEFT JOIN users u ON u.id=p.owner_id WHERE (?='' OR p.title LIKE ? OR p.summary LIKE ? OR p.skills LIKE ?) ORDER BY p.id DESC`).all(userId,userId,q,`%${q}%`,`%${q}%`,`%${q}%`);
  res.json({ projects: rows.map(p => ({ ...p, skills: JSON.parse(p.skills || '[]'), isOwner:Boolean(p.is_owner), hasApplied:Boolean(p.has_applied) })) });
});
app.post('/api/projects', authRequired, (req, res) => {
  const data = validate(z.object({ title: z.string().trim().min(4).max(100), summary: z.string().trim().min(15).max(700), skills: z.array(z.string().trim().min(1).max(30)).min(1).max(8), lookingFor: z.string().trim().min(3).max(200) }), req, res);
  if (!data) return;
  const result = db.prepare('INSERT INTO projects (owner_id,title,summary,skills,looking_for) VALUES (?,?,?,?,?)').run(req.user.id,data.title,data.summary,JSON.stringify(data.skills),data.lookingFor);
  res.status(201).json({ project: db.prepare('SELECT * FROM projects WHERE id=?').get(result.lastInsertRowid) });
});
app.post('/api/projects/:id/apply', authRequired, (req, res) => {
  const id = Number(req.params.id); const project = db.prepare('SELECT id,owner_id,status FROM projects WHERE id=?').get(id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  if (project.owner_id === req.user.id) return res.status(400).json({ error: 'You cannot apply to your own project.' });
  if (project.status !== 'Recruiting') return res.status(400).json({ error: 'This project is not accepting applications.' });
  const data = validate(z.object({ message: z.string().trim().max(500).default('I would like to contribute to this project.') }), req, res); if (!data) return;
  try { db.prepare('INSERT INTO project_applications (project_id,user_id,message) VALUES (?,?,?)').run(id,req.user.id,data.message); res.status(201).json({ ok: true, message: 'Application submitted.' }); }
  catch { res.status(409).json({ error: 'You have already applied to this project.' }); }
});

app.get('/api/posts', (req, res) => {
  const userId = (() => { try { return Number(jwt.verify(req.cookies.orbitle_session || '', secret, { issuer: 'orbitle' }).sub); } catch { return 0; } })();
  const posts = db.prepare(`SELECT p.id,p.user_id AS userId,p.body,p.created_at AS createdAt,u.name AS author,
    (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes,
    EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=?) AS liked,
    EXISTS(SELECT 1 FROM post_bookmarks b WHERE b.post_id=p.id AND b.user_id=?) AS bookmarked,
    EXISTS(SELECT 1 FROM post_reposts r WHERE r.post_id=p.id AND r.user_id=?) AS reposted,
    (SELECT COUNT(*) FROM post_comments c WHERE c.post_id=p.id) AS commentCount,
    (SELECT COUNT(*) FROM post_reposts r WHERE r.post_id=p.id) AS repostCount
    FROM posts p JOIN users u ON u.id=p.user_id WHERE NOT EXISTS(SELECT 1 FROM user_blocks b WHERE b.blocker_id=? AND b.blocked_id=p.user_id) AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE b.blocker_id=p.user_id AND b.blocked_id=?) ORDER BY p.id DESC LIMIT 50`).all(userId,userId,userId,userId,userId);
  res.json({ posts: posts.map(p => ({ ...p, liked: Boolean(p.liked), bookmarked: Boolean(p.bookmarked), reposted: Boolean(p.reposted) })) });
});
app.post('/api/posts', authRequired, (req, res) => {
  const data = validate(z.object({ body: z.string().trim().min(2).max(1000) }), req, res); if (!data) return;
  const result = db.prepare('INSERT INTO posts (user_id,body) VALUES (?,?)').run(req.user.id,data.body);
  res.status(201).json({ post: { id: result.lastInsertRowid, body: data.body, author: req.user.name, likes: 0, createdAt: new Date().toISOString() } });
});
app.post('/api/posts/:id/like', authRequired, (req, res) => {
  const id = Number(req.params.id); if (!Number.isInteger(id) || !db.prepare('SELECT id FROM posts WHERE id=?').get(id)) return res.status(404).json({ error: 'Post not found.' });
  const exists = db.prepare('SELECT 1 FROM post_likes WHERE post_id=? AND user_id=?').get(id,req.user.id);
  if (exists) db.prepare('DELETE FROM post_likes WHERE post_id=? AND user_id=?').run(id,req.user.id); else db.prepare('INSERT INTO post_likes (post_id,user_id) VALUES (?,?)').run(id,req.user.id);
  res.json({ liked: !exists, likes: db.prepare('SELECT COUNT(*) AS count FROM post_likes WHERE post_id=?').get(id).count });
});

app.post('/api/posts/:id/bookmark', authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || !db.prepare('SELECT id FROM posts WHERE id=?').get(id)) return res.status(404).json({ error: 'Post not found.' });
  const exists = db.prepare('SELECT 1 FROM post_bookmarks WHERE post_id=? AND user_id=?').get(id,req.user.id);
  if (exists) db.prepare('DELETE FROM post_bookmarks WHERE post_id=? AND user_id=?').run(id,req.user.id);
  else db.prepare('INSERT INTO post_bookmarks (post_id,user_id) VALUES (?,?)').run(id,req.user.id);
  res.json({ bookmarked: !exists });
});
app.post('/api/posts/:id/repost', authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || !db.prepare('SELECT id FROM posts WHERE id=?').get(id)) return res.status(404).json({ error: 'Post not found.' });
  const exists = db.prepare('SELECT 1 FROM post_reposts WHERE post_id=? AND user_id=?').get(id,req.user.id);
  if (exists) db.prepare('DELETE FROM post_reposts WHERE post_id=? AND user_id=?').run(id,req.user.id);
  else db.prepare('INSERT INTO post_reposts (post_id,user_id) VALUES (?,?)').run(id,req.user.id);
  res.json({ reposted: !exists });
});
app.get('/api/posts/:id/comments', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || !db.prepare('SELECT id FROM posts WHERE id=?').get(id)) return res.status(404).json({ error: 'Post not found.' });
  const comments = db.prepare(`SELECT c.id,c.body,c.created_at AS createdAt,u.id AS userId,u.name AS author FROM post_comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.id ASC LIMIT 100`).all(id);
  res.json({ comments });
});
app.post('/api/posts/:id/comments', authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || !db.prepare('SELECT id FROM posts WHERE id=?').get(id)) return res.status(404).json({ error: 'Post not found.' });
  const data = validate(z.object({ body: z.string().trim().min(1).max(600) }), req, res); if (!data) return;
  const result = db.prepare('INSERT INTO post_comments (post_id,user_id,body) VALUES (?,?,?)').run(id,req.user.id,data.body);
  res.status(201).json({ comment: { id: result.lastInsertRowid, body: data.body, createdAt: new Date().toISOString(), userId: req.user.id, author: req.user.name } });
});

// Professional network: public profile basics only; never expose emails or private account data.
app.get('/api/network/people', authRequired, (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  const rows = db.prepare(`SELECT u.id,u.name,u.bio,u.interests,u.created_at AS createdAt,
    CASE WHEN EXISTS(SELECT 1 FROM connection_requests c WHERE c.status='connected' AND ((c.requester_id=? AND c.recipient_id=u.id) OR (c.requester_id=u.id AND c.recipient_id=?))) THEN 'connected'
    WHEN EXISTS(SELECT 1 FROM connection_requests c WHERE c.status='pending' AND c.requester_id=? AND c.recipient_id=u.id) THEN 'outgoing_pending'
    WHEN EXISTS(SELECT 1 FROM connection_requests c WHERE c.status='pending' AND c.requester_id=u.id AND c.recipient_id=?) THEN 'incoming_pending'
    ELSE 'none' END AS connectionStatus
    FROM users u WHERE u.id<>? AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE b.blocker_id=? AND b.blocked_id=u.id) AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE b.blocker_id=u.id AND b.blocked_id=?) AND (?='' OR u.name LIKE ? OR u.bio LIKE ? OR u.interests LIKE ?) ORDER BY u.name LIMIT 100`).all(req.user.id,req.user.id,req.user.id,req.user.id,req.user.id,req.user.id,req.user.id,q,`%${q}%`,`%${q}%`,`%${q}%`);
  res.json({ people: rows.map(p => ({ ...p, interests: JSON.parse(p.interests || '[]') })) });
});
app.get('/api/network/requests', authRequired, (req, res) => {
  const incoming = db.prepare(`SELECT c.id,c.created_at AS createdAt,u.id AS userId,u.name,u.bio,u.interests FROM connection_requests c JOIN users u ON u.id=c.requester_id WHERE c.recipient_id=? AND c.status='pending' ORDER BY c.id DESC`).all(req.user.id);
  res.json({ requests: incoming.map(r => ({ ...r, interests: JSON.parse(r.interests || '[]') })) });
});
app.post('/api/network/requests', authRequired, (req, res) => {
  const data = validate(z.object({ userId: z.number().int().positive() }), req, res); if (!data) return;
  if (data.userId === req.user.id) return res.status(400).json({ error: 'You cannot connect with yourself.' });
  if (!db.prepare('SELECT id FROM users WHERE id=?').get(data.userId)) return res.status(404).json({ error: 'Profile not found.' });
  const existing = db.prepare(`SELECT id,status FROM connection_requests WHERE (requester_id=? AND recipient_id=?) OR (requester_id=? AND recipient_id=?)`).get(req.user.id,data.userId,data.userId,req.user.id);
  if (existing?.status === 'connected') return res.status(409).json({ error: 'You are already connected.' });
  if (existing?.status === 'pending') return res.status(409).json({ error: 'A connection request is already pending.' });
  if (existing) db.prepare(`UPDATE connection_requests SET requester_id=?,recipient_id=?,status='pending',created_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(req.user.id,data.userId,existing.id);
  else db.prepare('INSERT INTO connection_requests (requester_id,recipient_id) VALUES (?,?)').run(req.user.id,data.userId);
  res.status(201).json({ ok: true, message: 'Connection request sent.' });
});
app.patch('/api/network/requests/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const data = validate(z.object({ action: z.enum(['accept','decline']) }), req, res); if (!data) return;
  const request = db.prepare(`SELECT id FROM connection_requests WHERE id=? AND recipient_id=? AND status='pending'`).get(id,req.user.id);
  if (!request) return res.status(404).json({ error: 'Pending request not found.' });
  db.prepare('UPDATE connection_requests SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(data.action === 'accept' ? 'connected' : 'declined',id);
  res.json({ ok: true, status: data.action === 'accept' ? 'connected' : 'declined' });
});

// Orbit chat is available only to authenticated members of the selected Orbit.
app.get('/api/orbits/:id/messages', authRequired, (req, res) => {
  const orbitId = Number(req.params.id);
  if (!Number.isInteger(orbitId) || !db.prepare('SELECT id FROM orbits WHERE id=?').get(orbitId)) return res.status(404).json({ error: 'Orbit not found.' });
  if (!db.prepare('SELECT 1 FROM orbit_members WHERE user_id=? AND orbit_id=?').get(req.user.id,orbitId)) return res.status(403).json({ error: 'Join this Orbit to read its channel.' });
  const messages = db.prepare(`SELECT m.id,m.body,m.created_at AS createdAt,u.id AS userId,u.name AS author FROM orbit_messages m JOIN users u ON u.id=m.user_id WHERE m.orbit_id=? ORDER BY m.id DESC LIMIT 100`).all(orbitId).reverse();
  res.json({ messages });
});
app.post('/api/orbits/:id/messages', authRequired, (req, res) => {
  const orbitId = Number(req.params.id);
  if (!Number.isInteger(orbitId) || !db.prepare('SELECT id FROM orbits WHERE id=?').get(orbitId)) return res.status(404).json({ error: 'Orbit not found.' });
  if (!db.prepare('SELECT 1 FROM orbit_members WHERE user_id=? AND orbit_id=?').get(req.user.id,orbitId)) return res.status(403).json({ error: 'Join this Orbit before sending messages.' });
  const data = validate(z.object({ body: z.string().trim().min(1).max(1500) }), req, res); if (!data) return;
  const result = db.prepare('INSERT INTO orbit_messages (orbit_id,user_id,body) VALUES (?,?,?)').run(orbitId,req.user.id,data.body);
  res.status(201).json({ message: { id: result.lastInsertRowid, body: data.body, createdAt: new Date().toISOString(), userId: req.user.id, author: req.user.name } });
});

// Trust center: request review of public evidence. No identity documents are collected.
app.get('/api/verification/me', authRequired, (req, res) => {
  const requests = db.prepare('SELECT id,method,evidence_url AS evidenceUrl,note,status,created_at AS createdAt FROM verification_requests WHERE user_id=? ORDER BY id DESC').all(req.user.id);
  res.json({ requests });
});
app.post('/api/verification/requests', authRequired, (req, res) => {
  const data = validate(z.object({ method: z.enum(['portfolio','affiliation','project']), evidenceUrl: z.string().trim().max(500).default(''), note: z.string().trim().max(500).default('') }), req, res); if (!data) return;
  if (data.evidenceUrl && !/^https:\/\//i.test(data.evidenceUrl)) return res.status(400).json({ error: 'Evidence links must use HTTPS.' });
  if (!data.evidenceUrl && data.note.length < 20) return res.status(400).json({ error: 'Add a public HTTPS link or a short explanation of at least 20 characters.' });
  const pending = db.prepare(`SELECT id FROM verification_requests WHERE user_id=? AND status='pending'`).get(req.user.id);
  if (pending) return res.status(409).json({ error: 'You already have a request awaiting review.' });
  const result = db.prepare('INSERT INTO verification_requests (user_id,method,evidence_url,note) VALUES (?,?,?,?)').run(req.user.id,data.method,data.evidenceUrl,data.note);
  res.status(201).json({ request: db.prepare('SELECT id,method,evidence_url AS evidenceUrl,note,status,created_at AS createdAt FROM verification_requests WHERE id=?').get(result.lastInsertRowid), message: 'Review request submitted. Your profile is not verified while this request is pending.' });
});

// One-to-one inbox: only mutually connected members can message each other.
function areConnected(a, b) {
  return Boolean(db.prepare(`SELECT 1 FROM connection_requests WHERE status='connected' AND ((requester_id=? AND recipient_id=?) OR (requester_id=? AND recipient_id=?))`).get(a,b,b,a));
}
app.get('/api/inbox', authRequired, (req, res) => {
  const conversations = db.prepare(`SELECT u.id AS userId,u.name,u.bio,u.interests,
    (SELECT body FROM direct_messages m WHERE (m.sender_id=u.id AND m.recipient_id=?) OR (m.sender_id=? AND m.recipient_id=u.id) ORDER BY m.id DESC LIMIT 1) AS lastMessage,
    (SELECT created_at FROM direct_messages m WHERE (m.sender_id=u.id AND m.recipient_id=?) OR (m.sender_id=? AND m.recipient_id=u.id) ORDER BY m.id DESC LIMIT 1) AS lastMessageAt
    FROM users u WHERE u.id<>? AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE b.blocker_id=? AND b.blocked_id=u.id) AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE b.blocker_id=u.id AND b.blocked_id=?) AND EXISTS(SELECT 1 FROM connection_requests c WHERE c.status='connected' AND ((c.requester_id=? AND c.recipient_id=u.id) OR (c.requester_id=u.id AND c.recipient_id=?)))
    ORDER BY COALESCE(lastMessageAt,'') DESC,u.name`).all(req.user.id,req.user.id,req.user.id,req.user.id,req.user.id,req.user.id,req.user.id,req.user.id,req.user.id);
  res.json({ conversations: conversations.map(c => ({ ...c, interests: JSON.parse(c.interests || '[]') })) });
});
app.get('/api/inbox/:userId', authRequired, (req, res) => {
  const otherId = Number(req.params.userId);
  if (!Number.isInteger(otherId) || otherId === req.user.id || !areConnected(req.user.id, otherId)) return res.status(403).json({ error: 'Direct messages are available only between connected members.' });
  const messages = db.prepare(`SELECT m.id,m.body,m.created_at AS createdAt,m.sender_id AS senderId,m.recipient_id AS recipientId,u.name AS author FROM direct_messages m JOIN users u ON u.id=m.sender_id WHERE (m.sender_id=? AND m.recipient_id=?) OR (m.sender_id=? AND m.recipient_id=?) ORDER BY m.id DESC LIMIT 100`).all(req.user.id,otherId,otherId,req.user.id).reverse();
  res.json({ messages });
});
app.post('/api/inbox/:userId', authRequired, (req, res) => {
  const otherId = Number(req.params.userId);
  if (!Number.isInteger(otherId) || otherId === req.user.id || !areConnected(req.user.id, otherId)) return res.status(403).json({ error: 'Connect with this member before sending a direct message.' });
  const data = validate(z.object({ body: z.string().trim().min(1).max(1500) }), req, res); if (!data) return;
  const result = db.prepare('INSERT INTO direct_messages (sender_id,recipient_id,body) VALUES (?,?,?)').run(req.user.id,otherId,data.body);
  res.status(201).json({ message: { id: result.lastInsertRowid, body: data.body, createdAt: new Date().toISOString(), senderId: req.user.id, recipientId: otherId, author: req.user.name } });
});

function adminRequired(req,res,next) {
  const configured=String(process.env.ORBITLE_ADMIN_EMAIL||'').trim().toLowerCase();
  if(!configured || !req.user || req.user.email.toLowerCase()!==configured) return res.status(403).json({error:'Moderator access is not enabled for this account.'});
  next();
}
app.get('/api/moderation/queue', authRequired, adminRequired, (req,res) => {
  const reports=db.prepare(`SELECT r.id,r.target_type AS targetType,r.target_id AS targetId,r.reason,r.details,r.status,r.created_at AS createdAt,u.name AS reporterName,CASE WHEN r.target_type='user' THEN (SELECT name FROM users WHERE id=r.target_id) ELSE (SELECT body FROM posts WHERE id=r.target_id) END AS targetPreview FROM content_reports r JOIN users u ON u.id=r.reporter_id ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,r.id DESC LIMIT 200`).all();
  const verifications=db.prepare(`SELECT v.id,v.user_id AS userId,v.method,v.evidence_url AS evidenceUrl,v.note,v.status,v.created_at AS createdAt,u.name AS memberName,u.email AS memberEmail FROM verification_requests v JOIN users u ON u.id=v.user_id ORDER BY CASE v.status WHEN 'pending' THEN 0 ELSE 1 END,v.id DESC LIMIT 200`).all();
  res.json({reports,verifications});
});
app.patch('/api/moderation/reports/:id', authRequired, adminRequired, (req,res) => {
  const id=Number(req.params.id); const data=validate(z.object({status:z.enum(['reviewing','resolved','dismissed'])}),req,res); if(!data)return;
  const result=db.prepare('UPDATE content_reports SET status=? WHERE id=?').run(data.status,id); if(!result.changes)return res.status(404).json({error:'Report not found.'}); res.json({ok:true});
});
app.patch('/api/moderation/verifications/:id', authRequired, adminRequired, (req,res) => {
  const id=Number(req.params.id); const data=validate(z.object({action:z.enum(['approve','decline'])}),req,res); if(!data)return;
  const result=db.prepare("UPDATE verification_requests SET status=? WHERE id=? AND status='pending'").run(data.action==='approve'?'approved':'declined',id); if(!result.changes)return res.status(404).json({error:'Pending verification request not found.'}); res.json({ok:true,status:data.action==='approve'?'approved':'declined'});
});

// Member safety: block controls and reports are stored for moderator review.
app.get('/api/safety/blocks', authRequired, (req,res) => {
  const rows=db.prepare('SELECT b.blocked_id AS userId,u.name,b.created_at AS createdAt FROM user_blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=? ORDER BY b.created_at DESC').all(req.user.id);
  res.json({blocks:rows});
});
app.post('/api/safety/blocks', authRequired, (req,res) => {
  const data=validate(z.object({userId:z.number().int().positive()}),req,res); if(!data)return;
  if(data.userId===req.user.id) return res.status(400).json({error:'You cannot block your own account.'});
  if(!db.prepare('SELECT id FROM users WHERE id=?').get(data.userId)) return res.status(404).json({error:'Member not found.'});
  db.prepare('INSERT OR IGNORE INTO user_blocks (blocker_id,blocked_id) VALUES (?,?)').run(req.user.id,data.userId);
  res.json({ok:true,message:'Member blocked. Their profile and posts are hidden from your workspace, and direct messages are disabled.'});
});
app.delete('/api/safety/blocks/:userId', authRequired, (req,res) => {
  const id=Number(req.params.userId); if(!Number.isInteger(id)) return res.status(400).json({error:'Invalid member.'});
  db.prepare('DELETE FROM user_blocks WHERE blocker_id=? AND blocked_id=?').run(req.user.id,id); res.json({ok:true});
});
app.post('/api/safety/reports', authRequired, (req,res) => {
  const data=validate(z.object({targetType:z.enum(['user','post']),targetId:z.number().int().positive(),reason:z.string().trim().min(3).max(80),details:z.string().trim().max(500).default('')}),req,res); if(!data)return;
  if(data.targetType==='user' && (!db.prepare('SELECT id FROM users WHERE id=?').get(data.targetId) || data.targetId===req.user.id)) return res.status(404).json({error:'Member not found.'});
  if(data.targetType==='post' && !db.prepare('SELECT id FROM posts WHERE id=?').get(data.targetId)) return res.status(404).json({error:'Post not found.'});
  const prior=db.prepare("SELECT id FROM content_reports WHERE reporter_id=? AND target_type=? AND target_id=? AND status='open'").get(req.user.id,data.targetType,data.targetId);
  if(prior) return res.status(409).json({error:'You have already reported this item. It remains queued for review.'});
  db.prepare('INSERT INTO content_reports (reporter_id,target_type,target_id,reason,details) VALUES (?,?,?,?,?)').run(req.user.id,data.targetType,data.targetId,data.reason,data.details);
  res.status(201).json({ok:true,message:'Report submitted for moderator review. If you feel unsafe, block the member as well.'});
});

// Project workspaces: tasks and evidence-backed contribution records.
function projectAccess(projectId, userId) {
  const project = db.prepare('SELECT id,owner_id,title FROM projects WHERE id=?').get(projectId);
  if (!project) return { error: 'Project not found.', status: 404 };
  const hasApplication = Boolean(db.prepare('SELECT 1 FROM project_applications WHERE project_id=? AND user_id=?').get(projectId,userId));
  if (Number(project.owner_id) !== Number(userId) && !hasApplication) return { error: 'Apply to this project before opening its workspace.', status: 403 };
  return { project };
}
app.get('/api/projects/:id/workspace', authRequired, (req,res) => {
  const id=Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({error:'Project not found.'});
  const access=projectAccess(id,req.user.id); if(access.error) return res.status(access.status).json({error:access.error});
  const tasks=db.prepare(`SELECT t.id,t.project_id AS projectId,t.title,t.description,t.status,t.created_by AS createdBy,t.assignee_id AS assigneeId,t.created_at AS createdAt,t.updated_at AS updatedAt,u.name AS creatorName,a.name AS assigneeName FROM project_tasks t JOIN users u ON u.id=t.created_by LEFT JOIN users a ON a.id=t.assignee_id WHERE t.project_id=? ORDER BY CASE t.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,t.id DESC`).all(id);
  const contributions=db.prepare(`SELECT c.id,c.project_id AS projectId,c.user_id AS userId,c.title,c.description,c.evidence_url AS evidenceUrl,c.status,c.created_at AS createdAt,c.reviewed_at AS reviewedAt,u.name AS contributorName,r.name AS reviewerName FROM project_contributions c JOIN users u ON u.id=c.user_id LEFT JOIN users r ON r.id=c.reviewed_by WHERE c.project_id=? ORDER BY c.id DESC`).all(id);
  res.json({project:access.project,isOwner:Number(access.project.owner_id)===Number(req.user.id),tasks,contributions});
});
app.post('/api/projects/:id/tasks', authRequired, (req,res) => {
  const id=Number(req.params.id); if(!Number.isInteger(id)) return res.status(404).json({error:'Project not found.'});
  const access=projectAccess(id,req.user.id); if(access.error) return res.status(access.status).json({error:access.error});
  const data=validate(z.object({title:z.string().trim().min(3).max(120),description:z.string().trim().max(500).default('')}),req,res); if(!data)return;
  const result=db.prepare('INSERT INTO project_tasks (project_id,title,description,created_by) VALUES (?,?,?,?)').run(id,data.title,data.description,req.user.id);
  res.status(201).json({task:db.prepare(`SELECT t.id,t.project_id AS projectId,t.title,t.description,t.status,t.created_by AS createdBy,t.assignee_id AS assigneeId,t.created_at AS createdAt,t.updated_at AS updatedAt,u.name AS creatorName,NULL AS assigneeName FROM project_tasks t JOIN users u ON u.id=t.created_by WHERE t.id=?`).get(result.lastInsertRowid)});
});
app.patch('/api/projects/:projectId/tasks/:taskId', authRequired, (req,res) => {
  const projectId=Number(req.params.projectId), taskId=Number(req.params.taskId);
  const access=projectAccess(projectId,req.user.id); if(access.error) return res.status(access.status).json({error:access.error});
  const task=db.prepare('SELECT * FROM project_tasks WHERE id=? AND project_id=?').get(taskId,projectId); if(!task) return res.status(404).json({error:'Task not found.'});
  if(Number(access.project.owner_id)!==Number(req.user.id) && Number(task.created_by)!==Number(req.user.id) && Number(task.assignee_id)!==Number(req.user.id)) return res.status(403).json({error:'Only the project owner, task creator, or assignee can update this task.'});
  const data=validate(z.object({status:z.enum(['todo','in_progress','done'])}),req,res); if(!data)return;
  db.prepare('UPDATE project_tasks SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(data.status,taskId);
  res.json({ok:true});
});
app.post('/api/projects/:id/contributions', authRequired, (req,res) => {
  const id=Number(req.params.id); if(!Number.isInteger(id)) return res.status(404).json({error:'Project not found.'});
  const access=projectAccess(id,req.user.id); if(access.error) return res.status(access.status).json({error:access.error});
  const data=validate(z.object({title:z.string().trim().min(3).max(120),description:z.string().trim().min(10).max(700),evidenceUrl:z.string().trim().max(500).default('')}),req,res); if(!data)return;
  if(data.evidenceUrl){try{const u=new URL(data.evidenceUrl);if(u.protocol!=='https:')return res.status(400).json({error:'Evidence links must use HTTPS.'});}catch{return res.status(400).json({error:'Enter a valid HTTPS evidence link.'});}}
  const result=db.prepare('INSERT INTO project_contributions (project_id,user_id,title,description,evidence_url) VALUES (?,?,?,?,?)').run(id,req.user.id,data.title,data.description,data.evidenceUrl);
  res.status(201).json({contribution:db.prepare(`SELECT c.id,c.project_id AS projectId,c.user_id AS userId,c.title,c.description,c.evidence_url AS evidenceUrl,c.status,c.created_at AS createdAt,u.name AS contributorName FROM project_contributions c JOIN users u ON u.id=c.user_id WHERE c.id=?`).get(result.lastInsertRowid),message:'Contribution submitted for project-owner review.'});
});
app.patch('/api/projects/:projectId/contributions/:contributionId', authRequired, (req,res) => {
  const projectId=Number(req.params.projectId), contributionId=Number(req.params.contributionId);
  const project=db.prepare('SELECT id,owner_id FROM projects WHERE id=?').get(projectId); if(!project) return res.status(404).json({error:'Project not found.'});
  if(Number(project.owner_id)!==Number(req.user.id)) return res.status(403).json({error:'Only the project owner can review contributions.'});
  const data=validate(z.object({action:z.enum(['confirm','decline'])}),req,res); if(!data)return;
  const item=db.prepare('SELECT id FROM project_contributions WHERE id=? AND project_id=?').get(contributionId,projectId); if(!item) return res.status(404).json({error:'Contribution not found.'});
  db.prepare('UPDATE project_contributions SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?').run(data.action==='confirm'?'confirmed':'declined',req.user.id,contributionId);
  res.json({ok:true,status:data.action==='confirm'?'confirmed':'declined'});
});
app.get('/api/portfolio/me', authRequired, (req,res) => {
  const projects=db.prepare(`SELECT p.id,p.title,p.summary,p.skills,p.status,p.created_at AS createdAt,'owner' AS relationship,NULL AS contributionStatus FROM projects p WHERE p.owner_id=? ORDER BY p.id DESC`).all(req.user.id).map(p=>({...p,skills:JSON.parse(p.skills||'[]')}));
  const contributions=db.prepare(`SELECT c.id,c.project_id AS projectId,p.title AS projectTitle,c.title,c.description,c.evidence_url AS evidenceUrl,c.status,c.created_at AS createdAt FROM project_contributions c JOIN projects p ON p.id=c.project_id WHERE c.user_id=? AND c.status='confirmed' ORDER BY c.id DESC`).all(req.user.id);
  const confirmedCount=db.prepare(`SELECT COUNT(*) AS count FROM project_contributions WHERE user_id=? AND status='confirmed'`).get(req.user.id).count;
  res.json({projects,contributions,confirmedCount});
});

// Community events and RSVP.
app.get('/api/events', (req, res) => {
  const userId = (() => { try { return Number(jwt.verify(req.cookies.orbitle_session || '', secret, { issuer: 'orbitle' }).sub); } catch { return 0; } })();
  const events = db.prepare(`SELECT e.*,(SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id=e.id) AS attendeeCount,EXISTS(SELECT 1 FROM event_rsvps r WHERE r.event_id=e.id AND r.user_id=?) AS attending FROM events e ORDER BY e.starts_at`).all(userId);
  res.json({ events: events.map(e => ({ ...e, attending: Boolean(e.attending) })) });
});
app.post('/api/events/:id/rsvp', authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || !db.prepare('SELECT id FROM events WHERE id=?').get(id)) return res.status(404).json({ error: 'Event not found.' });
  const exists = db.prepare('SELECT 1 FROM event_rsvps WHERE event_id=? AND user_id=?').get(id,req.user.id);
  if (exists) db.prepare('DELETE FROM event_rsvps WHERE event_id=? AND user_id=?').run(id,req.user.id);
  else db.prepare('INSERT INTO event_rsvps (event_id,user_id) VALUES (?,?)').run(id,req.user.id);
  res.json({ attending: !exists, attendeeCount: db.prepare('SELECT COUNT(*) AS count FROM event_rsvps WHERE event_id=?').get(id).count });
});

// Opportunity application tracker: personal status, separate from the listing's source status.
app.get('/api/opportunity-tracker', authRequired, (req, res) => {
  const applications = db.prepare(`SELECT a.id,a.opportunity_id AS opportunityId,a.status,a.notes,a.updated_at AS updatedAt,o.title,o.organization,o.category,o.deadline,o.url FROM opportunity_applications a JOIN opportunities o ON o.id=a.opportunity_id WHERE a.user_id=? ORDER BY a.updated_at DESC`).all(req.user.id);
  res.json({ applications });
});
app.post('/api/opportunities/:id/track', authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || !db.prepare('SELECT id FROM opportunities WHERE id=?').get(id)) return res.status(404).json({ error: 'Opportunity not found.' });
  const data = validate(z.object({ status: z.enum(['interested','preparing','applied','interview','accepted','rejected']), notes: z.string().trim().max(500).default('') }), req, res); if (!data) return;
  db.prepare(`INSERT INTO opportunity_applications (user_id,opportunity_id,status,notes,updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id,opportunity_id) DO UPDATE SET status=excluded.status,notes=excluded.notes,updated_at=CURRENT_TIMESTAMP`).run(req.user.id,id,data.status,data.notes);
  res.json({ ok: true, message: 'Application tracker updated.' });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../client/dist');
if (isProduction) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Unexpected server error.' }); });
app.listen(PORT, '0.0.0.0', () => console.log(`ORBITLE API listening on 0.0.0.0:${PORT}`));
