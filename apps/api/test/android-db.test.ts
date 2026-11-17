import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHmac, randomUUID } from "node:crypto";
import { loadRemoteContent } from "../src/services/content/remote.js";
import { createApp } from "../src/app.js";
import { createPool } from "../src/db.js";
import { parseConfig } from "../src/config.js";

test("Android anonymous: persistent isolated accounts, concurrent login, expiry, logout, deletion and rate limits", async () => {
  const config = parseConfig({ ...process.env, NODE_ENV: "production", SESSION_SIGNING_KEY: randomBytes(32).toString("hex"), ENABLE_DEV_AUTH: "false", LOG_LEVEL: "silent" });
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(config.DATABASE_URL).hostname), "isolated local DB required");
  const pool = createPool(config.DATABASE_URL);
  const previous = { NODE_ENV: process.env.NODE_ENV, AIMI_RELEASE_VERSION: process.env.AIMI_RELEASE_VERSION, AIMI_CONTENT_SOURCE: process.env.AIMI_CONTENT_SOURCE };
  process.env.NODE_ENV = "production";
  process.env.AIMI_RELEASE_VERSION = "prototype-v1-reviewed";
  process.env.AIMI_CONTENT_SOURCE = "bundled";
  await loadRemoteContent(pool);
  let app = createApp(config, pool);
  const secrets = [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")];
  const hash = (v: string) => createHmac("sha256", config.SESSION_SIGNING_KEY).update(v).digest("hex");
  const headers = (token: string) => ({ authorization: "Bearer " + token });
  const login = async (installationSecret: string) => {
    const r = await app.inject({ method: "POST", url: "/auth/android", payload: { installationSecret } });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.headers['cache-control'], 'no-store');
    return r.json().data.token as string;
  };
  const get = async (path: string, token: string) => {
    const r = await app.inject({ url: path, headers: headers(token) });
    assert.equal(r.statusCode, 200, r.body); return r.json().data;
  };
  const action = async (token: string, url: string, payload: object, method: "POST" | "PUT" = "POST") => {
    const r = await app.inject({ method, url, headers: { ...headers(token), 'idempotency-key': randomUUID() }, payload });
    assert.equal(r.statusCode, 200, r.body); return r.json().data;
  };
  try {
    delete process.env.AIMI_RELEASE_VERSION;
    assert.equal((await app.inject({ url: '/health/ready' })).statusCode, 503);
    process.env.AIMI_RELEASE_VERSION = 'prototype-v1-reviewed';
    assert.equal((await app.inject({ url: '/health/ready' })).statusCode, 200);
    const [a1,a2,b] = await Promise.all([login(secrets[0]),login(secrets[0]),login(secrets[1])]);
    const rows = await pool.query("SELECT id,android_identity_hash FROM aimi.users WHERE android_identity_hash=ANY($1)", [secrets.map(s=>hash('android-installation:'+s))]);
    assert.equal(rows.rowCount, 2);
    assert.ok(rows.rows.every(r => !secrets.includes(r.android_identity_hash)));
    const content = await get('/v1/content', a1);
    assert.equal(content.reviewStatus, 'approved');
    assert.ok(content.target.startsWith('/content/challenges/'));
    const a = await get('/v1/state',a1), other = await get('/v1/state',b);
    assert.equal(a.balance,0); assert.equal(a.nicknameSet,false);
    assert.equal((await get('/v1/state',a2)).code,a.code); assert.notEqual(other.code,a.code);
    await action(a1,'/v1/profile',{name:'초록별'},'PUT');
    await action(a1,'/daily-rewards/attendance/claim',{});
    const earned = (await get('/v1/state',a1)).balance;
    assert.ok(earned>0); assert.equal((await get('/v1/state',b)).balance,0);
    await action(a1,'/v1/social/actions',{action:'request',code:other.code});
    await action(b,'/v1/social/actions',{action:'accept',code:a.code});
    const friends = await get('/v1/social',b);
    assert.equal(friends.people[0].name,'초록별');
    assert.equal((await get('/v1/friends/'+friends.people[0].id+'/garden',b)).name,'초록별');
    // Server restart retains identities and progress in PostgreSQL.
    await app.close(); app = createApp(config,pool);
    await pool.query("UPDATE aimi.sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[hash(a1)]);
    assert.equal((await app.inject({url:'/v1/state',headers:headers(a1)})).statusCode,401);
    const renewed = await login(secrets[0]);
    assert.equal((await get('/v1/state',renewed)).balance,earned);
    assert.equal((await get('/v1/state',renewed)).name,'초록별');
    await action(renewed,'/auth/logout',{});
    assert.equal((await app.inject({url:'/v1/state',headers:headers(renewed)})).statusCode,401);
    const restored = await login(secrets[0]);
    assert.equal((await get('/v1/state',restored)).code,a.code);
    const deleted = await app.inject({method:'DELETE',url:'/v1/account',headers:headers(restored)});
    assert.equal(deleted.statusCode,200,deleted.body);
    assert.equal((await app.inject({url:'/v1/state',headers:headers(a2)})).statusCode,401);
    assert.equal((await get('/v1/social',b)).people.length,0);
    const fresh = await login(secrets[0]);
    assert.notEqual((await get('/v1/state',fresh)).code,a.code);
    assert.equal((await get('/v1/state',fresh)).balance,0);
    for (const payload of [{userId:randomUUID()}, {installationSecret:'short'}, {installationSecret:secrets[1],userId:randomUUID()}])
      assert.equal((await app.inject({method:'POST',url:'/auth/android',payload})).statusCode,400);
    const cors = await app.inject({method:'OPTIONS',url:'/auth/android',headers:{origin:'https://localhost','access-control-request-method':'POST','access-control-request-headers':'content-type,authorization,idempotency-key'}});
    assert.equal(cors.headers['access-control-allow-origin'],'https://localhost');
    assert.equal((await app.inject({method:'POST',url:'/auth/local',payload:{name:'player'}})).statusCode,404);
    // Same credential cannot be used to generate unlimited sessions, even from another IP.
    for (let i=0;i<9;i++) await login(secrets[1]);
    const limited = await app.inject({method:'POST',url:'/auth/android',remoteAddress:'192.0.2.55',payload:{installationSecret:secrets[1]}});
    assert.equal(limited.statusCode,429); assert.equal(limited.headers['retry-after'],'60');
    const count = await pool.query('SELECT count(*)::int AS n FROM aimi.sessions s JOIN aimi.users u ON u.id=s.user_id WHERE u.android_identity_hash=$1',[hash('android-installation:'+secrets[1])]);
    assert.ok(count.rows[0].n<=5);
    for (let i=0; i<31; i++) {
      const r = await app.inject({method:'POST',url:'/auth/android',remoteAddress:'192.0.2.99',headers:{'x-forwarded-for':'198.51.100.'+i},payload:{installationSecret:'invalid'}});
      assert.equal(r.statusCode, i<30 ? 400 : 429, 'untrusted forwarded IP cannot bypass the limiter');
    }
  } finally {
    await pool.query('DELETE FROM aimi.users WHERE android_identity_hash=ANY($1)',[secrets.map(s=>hash('android-installation:'+s))]);
    await app.close(); await pool.end();
    for (const [key,value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
