/**
 * Quick smoke-test for all /api/mobile/* routes.
 * Usage: node scripts/test-mobile-api.mjs
 * Requires .env.local with DATABASE_URL and MOBILE_JWT_SECRET.
 */
import { config } from "dotenv";
import { SignJWT } from "jose";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const BASE = process.env.NEXTAUTH_URL || "http://localhost:3000";
const SECRET = process.env.MOBILE_JWT_SECRET;
const DB_URL = process.env.DATABASE_URL;

if (!SECRET || !DB_URL) {
  console.error("❌ MOBILE_JWT_SECRET and DATABASE_URL must be set in .env.local");
  process.exit(1);
}

// 1. Find your user in the database
const sql = neon(DB_URL);
const [user] = await sql`SELECT id, email, name FROM users LIMIT 1`;
if (!user) {
  console.error("❌ No users found in the database. Sign in to the web app first.");
  process.exit(1);
}
console.log(`\n✅ Found user: ${user.email} (${user.id})\n`);

// 2. Sign a mobile JWT
const token = await new SignJWT({ sub: user.id })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("1d")
  .sign(new TextEncoder().encode(SECRET));

console.log(`🔑 Mobile JWT (valid 24h):\n${token}\n`);

const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function test(label, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  const icon = res.ok ? "✅" : "❌";
  console.log(`${icon} ${method} ${path} → ${res.status}`);
  if (!res.ok) console.log("   ", JSON.stringify(data));
  return data;
}

// 3. Run all route checks
await test("GET /me",          "GET",   "/api/mobile/auth/me");
const meetings = await test("GET meetings", "GET", "/api/mobile/meetings?page=1&limit=5");
console.log(`   ${meetings.data?.length ?? 0} meetings returned`);

const tasks = await test("GET tasks",    "GET", "/api/mobile/tasks?page=1&limit=5");
console.log(`   ${tasks.data?.length ?? 0} tasks returned`);

const todos = await test("GET todos",    "GET", "/api/mobile/todos?page=1&limit=5");
console.log(`   ${todos.data?.length ?? 0} todos returned`);

// Test meeting detail if any meetings exist
if (meetings.data?.length > 0) {
  await test("GET meeting detail", "GET", `/api/mobile/meetings/${meetings.data[0].id}`);
}

console.log("\n✅ All routes tested. Copy the JWT above to use in Postman/curl.");
