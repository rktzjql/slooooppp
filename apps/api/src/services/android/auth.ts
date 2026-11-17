import { createHmac, randomBytes } from "node:crypto";
import type { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import { AndroidLogin, SessionResult } from "@aimi/contracts";
import { ApiError } from "../../db.js";

export function registerAndroidAuth(app: FastifyInstance, pool: Pool, secret: string) {
  const hash = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
  async function limit(bucket: string, maximum: number) {
    const result = await pool.query(
      `INSERT INTO aimi.auth_rate_limits(bucket,window_start,requests) VALUES($1,now(),1)
       ON CONFLICT(bucket) DO UPDATE SET
        window_start=CASE WHEN aimi.auth_rate_limits.window_start < now()-interval '1 minute' THEN now() ELSE aimi.auth_rate_limits.window_start END,
        requests=CASE WHEN aimi.auth_rate_limits.window_start < now()-interval '1 minute' THEN 1 ELSE aimi.auth_rate_limits.requests+1 END
       RETURNING requests`, [bucket]);
    if (result.rows[0].requests > maximum) throw new ApiError("ANDROID_AUTH_RATE_LIMITED", 429);
  }
  app.post("/auth/android", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    // Database-backed limits apply across server instances; never store the raw IP/credential.
    try {
      await limit(hash("android-ip:" + request.ip), 30);
      const { installationSecret } = AndroidLogin.parse(request.body);
      const identity = hash("android-installation:" + installationSecret);
      await limit(hash("android-login:" + identity), 10);
      await pool.query("DELETE FROM aimi.auth_rate_limits WHERE window_start < now()-interval '1 day'");
      const token = randomBytes(32).toString("hex");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // UPSERT serializes first login and session creation for the same installation.
        const result = await client.query(
          "INSERT INTO aimi.users(android_identity_hash) VALUES($1) ON CONFLICT(android_identity_hash) DO UPDATE SET android_identity_hash=excluded.android_identity_hash RETURNING id", [identity]);
        const uid = result.rows[0].id;
        await client.query("INSERT INTO aimi.ep_wallets(user_id) VALUES($1) ON CONFLICT DO NOTHING", [uid]);
        await client.query("DELETE FROM aimi.sessions WHERE user_id=$1 AND expires_at<=now()", [uid]);
        await client.query("DELETE FROM aimi.sessions WHERE token_hash IN (SELECT token_hash FROM aimi.sessions WHERE user_id=$1 ORDER BY created_at DESC,token_hash OFFSET 4)", [uid]);
        await client.query("INSERT INTO aimi.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", [hash(token),uid]);
        await client.query("COMMIT");
        return { data: SessionResult.parse({ token, expiresIn: 3600 }) };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) reply.header("Retry-After", "60");
      throw error;
    }
  });
}
