const WebSocket = require('ws');

function createWebSocketManager() {
  const clients = new Set();
  let server = null;

  function broadcast(type, payload) {
    const message = JSON.stringify({ type, payload });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  return {
    attach(httpServer) {
      server = new WebSocket.Server({ server: httpServer, path: '/ws' });
      server.on('connection', (socket) => {
        clients.add(socket);
        socket.on('close', () => clients.delete(socket));
        socket.send(JSON.stringify({ type: 'connected', payload: { ok: true } }));
      });
      return server;
    },

    broadcast,

    close() {
      for (const client of clients) {
        client.close();
      }
      clients.clear();
      if (server) {
        server.close();
      }
    }
  };
}

module.exports = {
  createWebSocketManager
};
