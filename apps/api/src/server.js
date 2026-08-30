"use strict";

const {
  createApiApp
} = require("./app");
const { createMemoryUserRepository } = require("./user-platform/memory-repository");
const { connectUserDatabase } = require("./user-platform/mongoose-repository");
const {
  createPasswordResetMailjetDelivery,
  createPasswordResetSmtpDelivery,
  createPasswordResetWebhookDelivery
} = require("./auth/password-reset-delivery");

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
  const mailjetPasswordResetDelivery = createPasswordResetMailjetDelivery({
    apiKey: process.env.PASSWORD_RESET_MAILJET_API_KEY,
    secretKey: process.env.PASSWORD_RESET_MAILJET_SECRET_KEY,
    fromAddress: process.env.PASSWORD_RESET_FROM_ADDRESS,
    fromName: process.env.PASSWORD_RESET_FROM_NAME,
    resetPageUrl: process.env.PASSWORD_RESET_PAGE_URL
  });
  const smtpPasswordResetDelivery = createPasswordResetSmtpDelivery({
    username: process.env.PASSWORD_RESET_SMTP_USER,
    password: process.env.PASSWORD_RESET_SMTP_APP_PASSWORD,
    fromAddress: process.env.PASSWORD_RESET_FROM_ADDRESS,
    fromName: process.env.PASSWORD_RESET_FROM_NAME,
    host: process.env.PASSWORD_RESET_SMTP_HOST,
    port: process.env.PASSWORD_RESET_SMTP_PORT,
    resetPageUrl: process.env.PASSWORD_RESET_PAGE_URL
  });
  const webhookPasswordResetDelivery = createPasswordResetWebhookDelivery({
    webhookUrl: process.env.PASSWORD_RESET_WEBHOOK_URL,
    webhookSecret: process.env.PASSWORD_RESET_WEBHOOK_SECRET,
    resetPageUrl: process.env.PASSWORD_RESET_PAGE_URL
  });
  const passwordResetDelivery = (
    options.passwordResetDelivery ||
    mailjetPasswordResetDelivery ||
    smtpPasswordResetDelivery ||
    webhookPasswordResetDelivery
  );
  if (process.env.NODE_ENV === "production" && !passwordResetDelivery) {
    throw new Error("Password-reset API, SMTP, or webhook delivery must be configured in production");
  }
  const app = createApiApp({ ...options, userRepository, passwordResetDelivery });

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

  server.codeflowCloseResources = () => userRepository.close?.();

  return server;
}

function installShutdownHandlers(server, label = "CodeFlow API") {
  let stopping = false;
  function stop(signal) {
    if (stopping) return;
    stopping = true;
    console.log(`${label} received ${signal}; finishing active requests.`);
    const forcedExit = setTimeout(() => {
      console.error(`${label} shutdown exceeded 10 seconds.`);
      process.exitCode = 1;
    }, 10_000);
    forcedExit.unref();
    server.close(async (error) => {
      clearTimeout(forcedExit);
      if (error) {
        console.error(`${label} shutdown failed: ${error.message}`);
        process.exitCode = 1;
      }
      try {
        await server.codeflowCloseResources?.();
      } catch (resourceError) {
        console.error(`${label} resource shutdown failed: ${resourceError.message}`);
        process.exitCode = 1;
      }
    });
  }
  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));
}

if (require.main === module) {
  startApiServer().then((server) => installShutdownHandlers(server)).catch((error) => {
    console.error(`CodeFlow API failed to start: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_HOST,

  DEFAULT_PORT,

  resolveUserRepository,

  installShutdownHandlers,

  startApiServer
};
