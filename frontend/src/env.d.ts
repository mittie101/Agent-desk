/// <reference types="vite/client" />

interface Window {
  agentdesk?: Readonly<{
    name: string;
    phase: number;
    getApiKey: () => Promise<string>;
    setApiKey: (key: string) => Promise<{ ok: boolean }>;
  }>;
}

