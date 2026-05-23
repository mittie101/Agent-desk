const path = require('node:path');
const { loadEnvFile } = require('./env-loader');
const { startServer } = require('./server');

let handle = null;

loadEnvFile({ envPath: path.join(process.cwd(), '.env') });

async function shutdown() {
  if (handle?.server?.listening) {
    await new Promise((resolve) => handle.server.close(resolve));
  }
  if (handle?.database?.open) {
    handle.database.close();
  }
}

startServer()
  .then((started) => {
    handle = started;
    console.log(`AgentDesk backend listening on ${started.host}:${started.port}`);
  })
  .catch((error) => {
    console.error('AgentDesk backend failed to start:', error);
    process.exit(1);
  });

process.once('SIGTERM', () => {
  shutdown().finally(() => process.exit(0));
});

process.once('SIGINT', () => {
  shutdown().finally(() => process.exit(0));
});
