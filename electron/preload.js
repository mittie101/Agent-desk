const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentdesk', {
  name: 'AgentDesk',
  phase: 10,
  getApiKey: () => ipcRenderer.invoke('agentdesk:get-api-key'),
  setApiKey: (key) => ipcRenderer.invoke('agentdesk:set-api-key', key)
});

