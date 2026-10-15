// 로컬 테스트 전용 게이트웨이: Supabase의 로그인(구글 PKCE 흐름)과 RPC 호출을 흉내 낸다.
// 실제 배포에는 쓰지 않는다. 함수 실행은 실제 Supabase처럼 authenticated 역할 + JWT sub로 한다.
import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

const PORT = Number(process.env.GW_PORT ?? 54321);
const SECRET = 'local-test-secret';
const pool = new pg.Pool({ host: 'localhost', user: 'postgres', password: 'postgres', database: process.env.DB ?? 'olympus_e2e', max: 10 });
const codes = new Map<string, { uid: string; email: string; challenge: string }>();
const refresh = new Map<string, { uid: string; email: string }>();

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');
function jwt(payload: object) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify(payload));
  const s = b64u(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest());
  return `${h}.${p}.${s}`;
}
function verify(token: string): any | null {
  const [h, p, s] = token.split('.');
  if (!s) return null;
  const good = b64u(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest());
  if (good !== s) return null;
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  return payload.exp * 1000 > Date.now() ? payload : null;
}
const userObj = (uid: string, email: string) => ({ id: uid, aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { email }, created_at: new Date().toISOString() });
function session(uid: string, email: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const rt = crypto.randomBytes(16).toString('hex');
  refresh.set(rt, { uid, email });
  return { access_token: jwt({ sub: uid, email, role: 'authenticated', aud: 'authenticated', exp }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: rt, user: userObj(uid, email) };
}

function send(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
async function body(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString();
  if (!raw) return {};
  if ((req.headers['content-type'] ?? '').includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  return JSON.parse(raw);
}

http.createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', req.headers.origin ?? '*');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return send(res, 204, undefined);
  const url = new URL(req.url!, `http://localhost:${PORT}`);
  try {
    if (url.pathname === '/auth/v1/authorize') {
      // 가짜 구글 로그인 화면
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><meta name=viewport content="width=device-width"><title>Mock Google</title>
        <form method=post action="/mock/login"><p>테스트용 구글 로그인</p>
        <input name=email id=email placeholder=email>
        <input type=hidden name=redirect_to value="${url.searchParams.get('redirect_to')}">
        <input type=hidden name=challenge value="${url.searchParams.get('code_challenge')}">
        <button id=go>로그인</button></form>`);
    }
    if (url.pathname === '/mock/login' && req.method === 'POST') {
      const b = await body(req);
      const email = String(b.email).toLowerCase();
      const r = await pool.query('select id from auth.users where email = $1', [email]);
      const uid = r.rows[0]?.id ?? crypto.randomUUID();
      if (!r.rows[0]) await pool.query('insert into auth.users (id, email) values ($1, $2)', [uid, email]);
      const code = crypto.randomUUID();
      codes.set(code, { uid, email, challenge: b.challenge });
      const to = new URL(b.redirect_to);
      to.searchParams.set('code', code);
      res.writeHead(302, { location: to.toString() });
      return res.end();
    }
    if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
      const b = await body(req);
      const grant = url.searchParams.get('grant_type');
      if (grant === 'pkce') {
        const c = codes.get(b.auth_code);
        const ch = c && b64u(crypto.createHash('sha256').update(b.code_verifier).digest());
        if (!c || ch !== c.challenge) return send(res, 400, { error: 'invalid_grant', error_description: 'bad code' });
        codes.delete(b.auth_code);
        return send(res, 200, session(c.uid, c.email));
      }
      if (grant === 'refresh_token') {
        const r = refresh.get(b.refresh_token);
        if (!r) return send(res, 400, { error: 'invalid_grant' });
        return send(res, 200, session(r.uid, r.email));
      }
      return send(res, 400, { error: 'unsupported_grant_type' });
    }
    const auth = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const claims = verify(auth);
    if (url.pathname === '/auth/v1/user') return claims ? send(res, 200, userObj(claims.sub, claims.email)) : send(res, 401, { msg: 'no' });
    if (url.pathname === '/auth/v1/logout') return send(res, 204, undefined);
    const m = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
    if (m && req.method === 'POST') {
      const args = await body(req);
      const keys = Object.keys(args);
      const vals = keys.map((k) => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]));
      const c = await pool.connect();
      try {
        await c.query('begin');
        await c.query(`set local role ${claims ? 'authenticated' : 'anon'}`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims ?? { role: 'anon' })]);
        const r = await c.query(`select public.${m[1]}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, vals);
        await c.query('commit');
        return send(res, 200, r.rows[0].r ?? null);
      } catch (e: any) {
        await c.query('rollback').catch(() => {});
        return send(res, 400, { code: e.code, message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
      } finally { c.release(); }
    }
    send(res, 404, { message: 'not found' });
  } catch (e: any) {
    send(res, 500, { message: e.message });
  }
}).listen(PORT, () => console.log('gateway on', PORT));
