// WebSocket client that proxies MongoDB operations to the companion server.
// Connects to ws://<current-page-origin>/ws

import { setWebTransient } from './connection-store';

let ws: any = null;
let requestId = 0;
const pending: any = {};
let connected = false;
let serverConnected = false;

// Callbacks for server status changes
let onStatusChange: ((connected: boolean) => void) | null = null;

export function webSetStatusCallback(cb: (connected: boolean) => void): void {
  onStatusChange = cb;
}

export function webIsServerConnected(): boolean {
  return serverConnected;
}

function getWsUrl(): string {
  // Derive from current page location
  const loc = (globalThis as any).location;
  const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return proto + '//' + loc.host + '/ws';
}

export function webConnect(): void {
  if (ws) return;
  try {
    const WS = (globalThis as any).WebSocket;
    ws = new WS(getWsUrl());
  } catch (e: any) {
    return;
  }

  ws.onopen = () => {
    serverConnected = true;
    if (onStatusChange) onStatusChange(true);
  };

  ws.onclose = () => {
    ws = null;
    serverConnected = false;
    connected = false;
    if (onStatusChange) onStatusChange(false);
    // Reconnect after 3 seconds
    setTimeout(() => { webConnect(); }, 3000);
  };

  ws.onmessage = (event: any) => {
    let msg: any;
    try { msg = JSON.parse(event.data); } catch (e: any) { return; }

    // Server config message
    if (msg.type === 'config') {
      if (msg.transient) setWebTransient(true);
      return;
    }

    // Response to a pending request
    const id = msg.id;
    if (id !== undefined && pending[id]) {
      const p = pending[id];
      delete pending[id];
      if (msg.error) {
        p.reject(new Error(msg.error));
      } else {
        p.resolve(msg.data);
      }
    }
  };
}

function send(action: string, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!ws || !serverConnected) {
      reject(new Error('Not connected to server'));
      return;
    }
    const id = ++requestId;
    pending[id] = { resolve, reject };
    ws.send(JSON.stringify({ id, action, params }));
  });
}

export async function webConnectToMongo(uri: string): Promise<boolean> {
  try {
    await send('connect', { uri });
    connected = true;
    return true;
  } catch (e: any) {
    return false;
  }
}

export async function webDisconnect(): Promise<void> {
  try {
    await send('disconnect', {});
  } catch (e: any) {}
  connected = false;
}

export async function webListDatabases(): Promise<string[]> {
  try {
    const result = await send('listDatabases', {});
    if (Array.isArray(result)) return result;
    if (typeof result === 'string') {
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch (e: any) {
    return [];
  }
}

export async function webListCollections(dbName: string): Promise<string[]> {
  try {
    const result = await send('listCollections', { dbName });
    if (Array.isArray(result)) return result;
    if (typeof result === 'string') {
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch (e: any) {
    return [];
  }
}

export async function webQueryCollection(dbName: string, collName: string, filter: string): Promise<string> {
  try {
    const result = await send('find', { dbName, collName, filter });
    if (typeof result === 'string') return result;
    return JSON.stringify(result);
  } catch (e: any) {
    return '{"error":"' + (e.message || 'query failed') + '"}';
  }
}

export async function webUpdateDocument(dbName: string, collName: string, filter: string, update: string): Promise<number> {
  try {
    const result = await send('updateOne', { dbName, collName, filter, update });
    return typeof result === 'number' ? result : 0;
  } catch (e: any) {
    return 0;
  }
}

export async function webDeleteDocument(dbName: string, collName: string, filter: string): Promise<number> {
  try {
    const result = await send('deleteOne', { dbName, collName, filter });
    return typeof result === 'number' ? result : 0;
  } catch (e: any) {
    return 0;
  }
}

export async function webInsertDocument(dbName: string, collName: string, doc: string): Promise<string> {
  try {
    const result = await send('insertOne', { dbName, collName, doc });
    if (typeof result === 'string') return result;
    return JSON.stringify(result);
  } catch (e: any) {
    return '{"error":"' + (e.message || 'insert failed') + '"}';
  }
}
