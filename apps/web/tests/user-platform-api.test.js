import assert from "node:assert/strict";

const calls = [];
let scenario = "warmup";
let loginAttempts = 0;

globalThis.fetch = async (pathname) => {
  calls.push(pathname);

  if (pathname === "/api/health") {
    return new Response(JSON.stringify({
      status: scenario === "warmup" ? "starting" : "ok"
    }), {
      status: scenario === "warmup" ? 502 : 200,
      headers: { "content-type": "application/json" }
    });
  }

  if (pathname === "/api/auth/login") {
    loginAttempts += 1;

    if (scenario === "retry" && loginAttempts === 1) {
      return new Response(JSON.stringify({
        status: "error",
        error: { code: "TEMPORARY_GATEWAY", message: "Backend is starting." }
      }), {
        status: 503,
        headers: { "content-type": "application/json" }
      });
    }

    if (scenario === "invalid") {
      return new Response(JSON.stringify({
        status: "error",
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." }
      }), {
        status: 401,
        headers: { "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      status: "ok",
      accessToken: "test-access-token",
      user: { id: "user-1", name: "Test User", email: "test@example.com" }
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  throw new Error(`Unexpected request: ${pathname}`);
};

const {
  isTransientAuthError,
  userPlatformApi,
  warmUserPlatformApi
} = await import("../src/utils/user-platform-api.js");

assert.equal(await warmUserPlatformApi(), true);
assert.deepEqual(calls, ["/api/health"]);

scenario = "retry";
calls.length = 0;
loginAttempts = 0;
const user = await userPlatformApi.login({
  email: "test@example.com",
  password: "Password1"
});
assert.equal(user.email, "test@example.com");
assert.equal(loginAttempts, 2);
assert.deepEqual(calls, [
  "/api/health",
  "/api/auth/login",
  "/api/health",
  "/api/auth/login"
]);

scenario = "invalid";
calls.length = 0;
loginAttempts = 0;
await assert.rejects(
  () => userPlatformApi.login({
    email: "test@example.com",
    password: "WrongPassword1"
  }),
  (error) => {
    assert.equal(error.status, 401);
    assert.equal(isTransientAuthError(error), false);
    return true;
  }
);
assert.equal(loginAttempts, 1);
assert.deepEqual(calls, ["/api/health", "/api/auth/login"]);

console.log("User platform API reliability tests passed.");
console.log("Proactive warm-up: passed");
console.log("Transient login retry: passed");
console.log("Credential error protection: passed");
