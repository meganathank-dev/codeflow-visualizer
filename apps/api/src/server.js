"use strict";

const {
  createApiApp
} = require("./app");
const { createMemoryUserRepository } = require("./user-platform/memory-repository");
const { connectUserDatabase } = require("./user-platform/mongoose-repository");

const DEFAULT_HOST = "127.0.0.1";

const DEFAULT_PORT = 4000;

async function resolveUserRepository(options) {
  if (options.userRepository) return options.userRepository;

  const mongoUri = options.mongoUri || process.env.MONGODB_URI;

  if (mongoUri) {
    return connectUserDatabase(mongoUri);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("MONGODB_URI is required in production");
  }

  console.warn(
    "CodeFlow user platform is using temporary in-memory storage. Set MONGODB_URI for persistence."
  );
  return createMemoryUserRepository();
}

async function startApiServer(options = {}) {
  const host = (
    options.host ||
    process.env.API_HOST ||
    DEFAULT_HOST
  );

  const port = Number(
    options.port ||
    process.env.API_PORT ||
    DEFAULT_PORT
  );

  const userRepository = await resolveUserRepository(options);
  const app = createApiApp({ ...options, userRepository });

  const server = app.listen(
    port,

    host,

    () => {
      console.log(
        `CodeFlow API running at http://${host}:${port}`
      );

      console.log(
        `Health endpoint: http://${host}:${port}/api/health`
      );

      console.log(`User platform storage: ${userRepository.kind}`);
    }
  );

  return server;
}

if (require.main === module) {
  startApiServer().catch((error) => {
    console.error(`CodeFlow API failed to start: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_HOST,

  DEFAULT_PORT,

  resolveUserRepository,

  startApiServer
};
