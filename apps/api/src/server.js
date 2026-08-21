"use strict";

const {
  createApiApp
} = require("./app");

const DEFAULT_HOST = "127.0.0.1";

const DEFAULT_PORT = 4000;

function startApiServer(options = {}) {
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

  const app = createApiApp(
    options
  );

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
    }
  );

  return server;
}

if (require.main === module) {
  startApiServer();
}

module.exports = {
  DEFAULT_HOST,

  DEFAULT_PORT,

  startApiServer
};