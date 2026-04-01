import {
  App, VStack, HStack, Text, Button, Spacer, Divider,
  TextField, TextArea, ScrollView, ImageFile,
  textSetFontSize, textSetFontWeight, textSetColor, textSetString,
  textSetFontFamily,
  buttonSetBordered, buttonSetTextColor, buttonSetTitle, textSetWraps,
  widgetAddChild, widgetClearChildren, widgetSetHidden,
  widgetSetBackgroundColor, widgetSetBackgroundGradient,
  widgetMatchParentWidth, widgetMatchParentHeight, widgetSetHugging, widgetSetHeight, widgetSetWidth,
  stackSetDistribution, stackSetAlignment,
  setCornerRadius, setPadding,
  scrollviewSetChild,
  textfieldSetString, textfieldGetString, textfieldSetNextKeyView,
  textareaSetString, textareaGetString,
  menuCreate, menuAddItem, menuAddSeparator, menuAddSubmenu, menuAddStandardAction,
  menuBarCreate, menuBarAddMenu, menuBarAttach,
  Window,
} from 'perry/ui';
import { isDarkMode, keychainSave, keychainGet, keychainDelete, getDeviceIdiom } from 'perry/system';
import { t } from 'perry/i18n';
import { MongoClient } from 'mongodb';
import { HoneCodeEditorWidget } from '@honeide/editor/perry';
import { getAllConnections, createConnection, deleteConnection, saveState, getState, setWebTransient } from './data/connection-store';
import { trackAppLaunch, trackConnect, trackQuery } from './data/telemetry';
import { parallelMap, spawn } from 'perry/thread';
import { prettyPrintJson, extractIdShort, extractFields, processDocForDisplay } from './data/json-utils';

// --- Platform detection (compile-time: 0=macOS, 1=iOS, 2=Android, 3=Windows, 4=Linux, 5=Web) ---
declare const __platform__: number;
const isIOS = __platform__ === 1;
const isWeb = __platform__ === 5;
const iPad = isIOS && getDeviceIdiom() === 1;
// iPad uses desktop layout (sidebar always visible, wider padding); iPhone/Android use mobile layout
const mobile = (__platform__ === 1 || __platform__ === 2) && !iPad;

// --- Screenshot mode (0=off, 1=welcome, 2=browse, 3=query, 4=edit, 5=about) ---
// Patched via sed by screenshots/capture-ios.sh before each compile
const SCREENSHOT_MODE = 0;

// --- Theme (matches brand: mangoquery.com) ---
const dark = isDarkMode();

// Background: cream #FFF8F0 / charcoal #2B2D42
const bgR = dark ? 0.169 : 1.0;
const bgG = dark ? 0.176 : 0.973;
const bgB = dark ? 0.259 : 0.941;

// Surface: white #FFFFFF / dark surface #3A3D56
const sfR = dark ? 0.227 : 1.0;
const sfG = dark ? 0.239 : 1.0;
const sfB = dark ? 0.337 : 1.0;

// Sidebar bg: warm #F5EDE3 / dark #232538
const tbR = dark ? 0.137 : 0.961;
const tbG = dark ? 0.145 : 0.929;
const tbB = dark ? 0.220 : 0.890;

// Text primary: charcoal #2B2D42 / light #E8E9ED
const txR = dark ? 0.910 : 0.169;
const txG = dark ? 0.914 : 0.176;
const txB = dark ? 0.929 : 0.259;

// Text secondary: #6B7194 / #8D99AE
const tsR = dark ? 0.553 : 0.420;
const tsG = dark ? 0.600 : 0.443;
const tsB = dark ? 0.682 : 0.580;

// Text muted: slate #8D99AE / #6B7194
const tmR = dark ? 0.420 : 0.553;
const tmG = dark ? 0.443 : 0.600;
const tmB = dark ? 0.580 : 0.682;

// Mango orange #FF9F1C
const moR = 1.0;
const moG = 0.624;
const moB = 0.110;

// Mango yellow #FFBF69 (secondary accent)
const myR = 1.0;
const myG = 0.749;
const myB = 0.412;

// Error / deep red #E8572A
const erR = 0.910;
const erG = 0.341;
const erB = 0.165;

// Success / tropical green #2EC4B6
const sgR = 0.180;
const sgG = 0.769;
const sgB = 0.714;

// Border: #E8E9ED / #4A4D6A
const brR = dark ? 0.290 : 0.910;
const brG = dark ? 0.302 : 0.914;
const brB = dark ? 0.416 : 0.929;

// Monospace font — platform-specific
const monoFont = isWeb ? 'ui-monospace, Menlo, Monaco, Consolas, monospace' :
                 isIOS ? 'Menlo' : (__platform__ === 2 ? 'monospace' : 'JetBrains Mono');

// UI font — system font on iOS/iPad, system-ui on web, Rubik on desktop
const uiFont = isWeb ? 'system-ui, -apple-system, sans-serif' :
               isIOS ? '.AppleSystemUIFont' : 'Rubik';

// --- State ---
let connectionIds: string[] = [];
let connectionNames: string[] = [];
let connectionHosts: string[] = [];
let connectionPorts: string[] = [];
let connectionUris: string[] = [];

// Load saved connections from SQLite (URI in connection_string column, Keychain as fallback)
function loadConnections(): void {
  let profiles: any[] = [];
  try {
    const result = getAllConnections();
    if (Array.isArray(result)) profiles = result;
  } catch (e: any) {
    // Database may not be available
  }
  connectionIds = [];
  connectionNames = [];
  connectionHosts = [];
  connectionPorts = [];
  connectionUris = [];
  for (let i = 0; i < profiles.length; i++) {
    const p: any = profiles[i];
    if (!p || !p.id) continue; // Skip invalid entries
    connectionIds.push(p.id);
    connectionNames.push(p.name || t('Untitled'));
    connectionHosts.push(p.host || 'localhost');
    connectionPorts.push(String(p.port || 27017));
    // URI from SQLite, fall back to Keychain for backward compat (not on web)
    let uri = p.connectionString || '';
    if (!uri && !isWeb) {
      try { const k = keychainGet('mango-conn-' + p.id); if (typeof k === 'string') uri = k; } catch (e: any) {}
    }
    connectionUris.push(uri);
  }
}
loadConnections();

let formName = '';
let formHost = 'localhost';
let formPort = '27017';
let formUser = '';
let formPass = '';
let formUri = '';

let currentDbName = '';
let currentCollName = '';
let currentFilter = '{}';

let mongoClient: any = null;
let currentConnUri = '';
let currentConnName = '';

let activeDbName = '';
let activeCollName = '';
let lastQueryFilter = '{}';

let editDocJson = '';

// --- Explorer state ---
let sidebarDbNames: string[] = [];
let expandedDbIdx = -1;
// Flat parallel arrays: collDbIdx[k] tells which db index collection collNames[k] belongs to
let collDbIdx: number[] = [];
let collNames: string[] = [];

// --- Helpers ---


// Make a styled label
function makeLabel(text: string, size: number, bold: boolean): any {
  const w = Text(text);
  textSetFontSize(w, size);
  textSetFontFamily(w, uiFont);
  if (bold) textSetFontWeight(w, size, 0.5);
  textSetColor(w, txR, txG, txB, 1.0);
  return w;
}

function makeMuted(text: string, size: number): any {
  const w = Text(text);
  textSetFontSize(w, size);
  textSetFontFamily(w, uiFont);
  textSetColor(w, tmR, tmG, tmB, 1.0);
  return w;
}

function makeSecondary(text: string, size: number): any {
  const w = Text(text);
  textSetFontSize(w, size);
  textSetFontFamily(w, uiFont);
  textSetColor(w, tsR, tsG, tsB, 1.0);
  return w;
}

function makeMono(text: string, size: number): any {
  const w = Text(text);
  textSetFontSize(w, size);
  textSetFontFamily(w, monoFont);
  textSetColor(w, txR, txG, txB, 1.0);
  return w;
}

function makeMonoMuted(text: string, size: number): any {
  const w = Text(text);
  textSetFontSize(w, size);
  textSetFontFamily(w, monoFont);
  textSetColor(w, tmR, tmG, tmB, 1.0);
  return w;
}

function makeCard(children: any[], gap: number): any {
  const card = VStack(gap, children);
  widgetSetBackgroundColor(card, sfR, sfG, sfB, 1.0);
  setCornerRadius(card, 10);
  setPadding(card, 14, 16, 14, 16);
  return card;
}

function makePrimaryBtn(label: string, handler: () => void): any {
  const btn = Button(label, handler);
  // Perry buttons with bordered style get the orange bg
  buttonSetTextColor(btn, moR, moG, moB, 1.0);
  return btn;
}

function makeGhostBtn(label: string, handler: () => void): any {
  const btn = Button(label, handler);
  buttonSetBordered(btn, 0);
  buttonSetTextColor(btn, tsR, tsG, tsB, 1.0);
  return btn;
}

function makeDangerBtn(label: string, handler: () => void): any {
  const btn = Button(label, handler);
  buttonSetBordered(btn, 0);
  buttonSetTextColor(btn, erR, erG, erB, 1.0);
  return btn;
}

// Mask password in a MongoDB URI for display
function maskPassword(uri: string): string {
  // Handle mongodb:// and mongodb+srv://
  const schemeEnd = uri.indexOf('://');
  if (schemeEnd < 0) return uri;
  const afterScheme = uri.substring(schemeEnd + 3);
  const atIdx = afterScheme.indexOf('@');
  if (atIdx < 0) return uri; // no credentials
  const userInfo = afterScheme.substring(0, atIdx);
  const colonIdx = userInfo.indexOf(':');
  if (colonIdx < 0) return uri; // no password
  const user = userInfo.substring(0, colonIdx);
  const scheme = uri.substring(0, schemeEnd + 3);
  const hostPart = afterScheme.substring(atIdx); // includes @
  return scheme + user + ':••••••' + hostPart;
}


// --- Web MongoDB proxy (inline — only compiled for web target) ---
let _ws: any = null;
let _wsReqId = 0;
let _wsPending: any = {};
let _wsConnected = false;
let _wsServerUp = false;
let _wsOnStatus: ((up: boolean) => void) | null = null;

function _wsSend(action: string, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!_ws || !_wsServerUp) { reject(new Error('Not connected to server')); return; }
    const id = ++_wsReqId;
    _wsPending[id] = { resolve, reject };
    _ws.send(JSON.stringify({ id, action, params }));
  });
}

function _wsOpen(): void {
  if (_ws) return;
  try {
    const loc = (globalThis as any).location;
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = proto + '//' + loc.host + '/ws';
    _ws = new ((globalThis as any).WebSocket)(url);
  } catch (e: any) { return; }

  _ws.onopen = () => { _wsServerUp = true; if (_wsOnStatus) _wsOnStatus(true); };
  _ws.onclose = () => {
    _ws = null; _wsServerUp = false;
    if (_wsOnStatus) _wsOnStatus(false);
    setTimeout(() => { _wsOpen(); }, 3000);
  };
  _ws.onmessage = (ev: any) => {
    let m: any;
    try { m = JSON.parse(ev.data); } catch (e: any) { return; }
    if (m.type === 'config') { if (m.transient) setWebTransient(true); return; }
    const p = _wsPending[m.id];
    if (p) { delete _wsPending[m.id]; m.error ? p.reject(new Error(m.error)) : p.resolve(m.data); }
  };
}

// --- MongoDB ---
let lastConnError = '';

async function connectToMongo(uri: string): Promise<boolean> {
  lastConnError = '';
  if (isWeb) {
    try { await _wsSend('connect', { uri }); currentConnUri = uri; trackConnect(); return true; }
    catch (e: any) { lastConnError = e.message || 'Connection failed via server'; return false; }
  }
  try {
    const client = await MongoClient.connect(uri);
    // Validate the connection by listing databases
    const result = await client.listDatabases();
    if (typeof result === 'string') {
      // Connection works
      mongoClient = client;
      currentConnUri = uri;
      trackConnect();
      return true;
    }
    lastConnError = 'Connected but could not list databases';
    return false;
  } catch (e: any) {
    const msg = (e as any).message || e;
    lastConnError = typeof msg === 'string' ? msg : 'Connection failed';
    return false;
  }
}

async function queryCollection(dbName: string, collName: string, filter: string): Promise<string> {
  if (isWeb) { try { const r = await _wsSend('find', { dbName, collName, filter }); return typeof r === 'string' ? r : JSON.stringify(r); } catch (e: any) { return '{"error":"' + (e.message || 'query failed') + '"}'; } }
  if (!mongoClient) return '{"error":"not connected"}';
  try {
    const db = mongoClient.db(dbName);
    const coll = db.collection(collName);
    const docs = await coll.find(filter || '{}');
    if (typeof docs === 'string') return docs;
    return JSON.stringify(docs);
  } catch (e: any) {
    const msg = (e.message || 'query failed').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return '{"error":"' + msg + '"}';
  }
}

async function updateDocument(dbName: string, collName: string, filter: string, update: string): Promise<number> {
  if (isWeb) { try { const r = await _wsSend('updateOne', { dbName, collName, filter, update }); return typeof r === 'number' ? r : 0; } catch (e: any) { return 0; } }
  if (!mongoClient) return 0;
  try {
    const db = mongoClient.db(dbName);
    const coll = db.collection(collName);
    return await coll.updateOne(filter, update);
  } catch (e: any) {
    showStatus(t('Update failed') + ': ' + (e.message || 'unknown error'), true);
    return 0;
  }
}

async function deleteDocument(dbName: string, collName: string, filter: string): Promise<number> {
  if (isWeb) { try { const r = await _wsSend('deleteOne', { dbName, collName, filter }); return typeof r === 'number' ? r : 0; } catch (e: any) { return 0; } }
  if (!mongoClient) return 0;
  try {
    const db = mongoClient.db(dbName);
    const coll = db.collection(collName);
    return await coll.deleteOne(filter);
  } catch (e: any) {
    showStatus(t('Delete failed') + ': ' + (e.message || 'unknown error'), true);
    return 0;
  }
}

async function listDatabases(): Promise<string[]> {
  if (isWeb) { try { const r = await _wsSend('listDatabases', {}); if (Array.isArray(r)) return r; if (typeof r === 'string') { const p = JSON.parse(r); if (Array.isArray(p)) return p; } return []; } catch (e: any) { return []; } }
  if (!mongoClient) return [];
  try {
    const result = await mongoClient.listDatabases();
    if (typeof result === 'string') {
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch (e: any) {
    showStatus(t('Failed to list databases') + ': ' + (e.message || 'unknown error'), true);
    return [];
  }
}

async function listCollections(dbName: string): Promise<string[]> {
  if (isWeb) { try { const r = await _wsSend('listCollections', { dbName }); if (Array.isArray(r)) return r; if (typeof r === 'string') { const p = JSON.parse(r); if (Array.isArray(p)) return p; } return []; } catch (e: any) { return []; } }
  if (!mongoClient) return [];
  try {
    const db = mongoClient.db(dbName);
    const result = await db.listCollections();
    if (typeof result === 'string') {
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch (e: any) {
    showStatus(t('Failed to list collections') + ': ' + (e.message || 'unknown error'), true);
    return [];
  }
}

function extractIdFilter(docJson: string): string {
  const idKey = '"_id":';
  const idStart = docJson.indexOf(idKey);
  if (idStart < 0) return '{}';
  const valueStart = idStart + idKey.length;
  if (docJson[valueStart] === '{') {
    let depth = 0;
    for (let i = valueStart; i < docJson.length; i++) {
      if (docJson[i] === '{') depth = depth + 1;
      if (docJson[i] === '}') depth = depth - 1;
      if (depth === 0) return '{' + idKey + docJson.substring(valueStart, i + 1) + '}';
    }
  } else if (docJson[valueStart] === '"') {
    const endQuote = docJson.indexOf('"', valueStart + 1);
    if (endQuote > 0) return '{' + idKey + docJson.substring(valueStart, endQuote + 1) + '}';
  }
  return '{}';
}

function removeIdFromJson(docJson: string): string {
  const idKey = '"_id":';
  const idStart = docJson.indexOf(idKey);
  if (idStart < 0) return docJson;
  const valueStart = idStart + idKey.length;
  let valueEnd = valueStart;
  if (docJson[valueStart] === '{') {
    let depth = 0;
    for (let i = valueStart; i < docJson.length; i++) {
      if (docJson[i] === '{') depth = depth + 1;
      if (docJson[i] === '}') depth = depth - 1;
      if (depth === 0) { valueEnd = i + 1; break; }
    }
  } else if (docJson[valueStart] === '"') {
    const endQuote = docJson.indexOf('"', valueStart + 1);
    valueEnd = endQuote >= 0 ? endQuote + 1 : docJson.length;
  } else {
    for (let i = valueStart; i < docJson.length; i++) {
      if (docJson[i] === ',' || docJson[i] === '}') { valueEnd = i; break; }
    }
  }
  let before = docJson.substring(0, idStart);
  let after = docJson.substring(valueEnd);
  if (after.length > 0 && after[0] === ',') after = after.substring(1);
  else if (before.length > 0 && before[before.length - 1] === ',') before = before.substring(0, before.length - 1);
  return before + after;
}

// --- Status ---
const statusText = Text('');
textSetFontSize(statusText, 12);
textSetFontFamily(statusText, uiFont);
widgetSetHidden(statusText, 1);

function showStatus(msg: string, isError: boolean): void {
  textSetString(statusText, msg);
  textSetColor(statusText, isError ? erR : sgR, isError ? erG : sgG, isError ? erB : sgB, 1.0);
  widgetSetHidden(statusText, 0);
}

// --- Web server status indicator (only created on web platform) ---
let webStatusText: any = null;
let webServerUp = false;

if (isWeb) {
  webStatusText = Text('Server unavailable \u2014 run mango-serve');
  textSetFontSize(webStatusText, 12);
  textSetFontFamily(webStatusText, uiFont);
  textSetColor(webStatusText, erR, erG, erB, 1.0);

  _wsOnStatus = (up: boolean) => {
    webServerUp = up;
    if (up) {
      textSetString(webStatusText, t('Connected to Mango Server'));
      textSetColor(webStatusText, sgR, sgG, sgB, 1.0);
    } else {
      textSetString(webStatusText, t('Server unavailable \u2014 run mango-serve'));
      textSetColor(webStatusText, erR, erG, erB, 1.0);
    }
  };
  _wsOpen();
}

// ============================================================
//  CONNECTION SCREEN
// ============================================================

const connListContainer = VStack(10, []);
function refreshConnectionList(): void {
  widgetClearChildren(connListContainer);

  if (connectionNames.length === 0) {
    // Welcome card with warm styling
    const welcomeCard = VStack(16, []);
    widgetSetBackgroundColor(welcomeCard, sfR, sfG, sfB, 1.0);
    setCornerRadius(welcomeCard, 14);
    setPadding(welcomeCard, mobile ? 20 : 32, mobile ? 16 : 36, mobile ? 16 : 28, mobile ? 16 : 36);

    const welcomeTitle = Text('Welcome to Mango');
    textSetFontSize(welcomeTitle, 24);
    textSetFontFamily(welcomeTitle, uiFont);
    textSetFontWeight(welcomeTitle, 24, 0.5);
    textSetColor(welcomeTitle, txR, txG, txB, 1.0);

    const welcomeHint = Text(t('Connect to your MongoDB instance to browse databases, query collections, and manage documents.'));
    textSetFontSize(welcomeHint, 14);
    textSetFontFamily(welcomeHint, uiFont);
    textSetColor(welcomeHint, tmR, tmG, tmB, 1.0);
    textSetWraps(welcomeHint, 0);

    // Feature pills with orange accent
    function makePill(label: string): any {
      const pillLabel = Text(label);
      textSetFontSize(pillLabel, 12);
      textSetFontFamily(pillLabel, uiFont);
      textSetFontWeight(pillLabel, 12, 0.4);
      textSetColor(pillLabel, moR, moG, moB, 1.0);

      const pill = VStack(0, [pillLabel]);
      widgetSetBackgroundColor(pill, dark ? 0.2 : 1.0, dark ? 0.15 : 0.96, dark ? 0.1 : 0.92, 1.0);
      setCornerRadius(pill, 8);
      setPadding(pill, 6, 14, 6, 14);
      return pill;
    }

    const pillRow1 = HStack(8, [makePill(t('Databases & Collections')), makePill(t('Query & Filter'))]);
    const pillRow2 = HStack(8, [makePill(t('Edit & Insert')), makePill(t('Index Viewer'))]);
    const pillGrid = VStack(8, [pillRow1, pillRow2]);

    const ctaBtn = Button('+ New Connection', () => { showConnectionForm(); });
    buttonSetTextColor(ctaBtn, 1.0, 1.0, 1.0, 1.0);
    widgetSetBackgroundColor(ctaBtn, moR, moG, moB, 1.0);
    setCornerRadius(ctaBtn, 8);
    setPadding(ctaBtn, 12, 20, 12, 20);

    widgetAddChild(welcomeCard, welcomeTitle);
    widgetAddChild(welcomeCard, welcomeHint);
    widgetAddChild(welcomeCard, pillGrid);
    widgetAddChild(welcomeCard, ctaBtn);

    // First-launch analytics notice
    if (!getState('analyticsNoticeShown')) {
      const noticeText = Text(t('Mango sends anonymous usage statistics to help improve the app. You can change this in About.'));
      textSetFontSize(noticeText, 11);
      textSetFontFamily(noticeText, uiFont);
      textSetColor(noticeText, tmR, tmG, tmB, 0.8);
      textSetWraps(noticeText, 0);
      widgetAddChild(welcomeCard, noticeText);
      saveState('analyticsNoticeShown', '1');
    }

    widgetAddChild(connListContainer, welcomeCard);
    widgetMatchParentWidth(welcomeCard);
    return;
  }

  // Section header
  const sectionTitle = makeLabel('Your Connections', 16, true);
  widgetAddChild(connListContainer, sectionTitle);

  for (let i = 0; i < connectionNames.length; i++) {
    const connIdx = i;

    // Orange accent bar
    const accentBar = VStack(0, []);
    widgetSetBackgroundColor(accentBar, moR, moG, moB, 1.0);
    setCornerRadius(accentBar, 3);
    setPadding(accentBar, 20, 3, 20, 3);

    const nameText = makeLabel(maskPassword(connectionNames[i]) || t('Untitled'), 15, true);

    const rawUri = connectionUris[i];
    const hostPort = rawUri ? maskPassword(rawUri) : `${connectionHosts[i]}:${connectionPorts[i]}`;
    const detailText = makeMonoMuted(hostPort, 11);

    const info = VStack(3, [nameText, detailText]);

    let connecting = false;
    const connectBtn = Button('Connect', async () => {
      if (connecting) return;
      connecting = true;
      buttonSetTitle(connectBtn, t('Connecting...'));
      const uri = connectionUris[connIdx] || `mongodb://${connectionHosts[connIdx]}:${connectionPorts[connIdx]}`;
      const ok = await connectToMongo(uri);
      if (ok) {
        widgetSetHidden(statusText, 1);
        currentConnName = connectionNames[connIdx] || 'Server';
        textSetString(connLabel, currentConnName);
        saveState('lastConnId', connectionIds[connIdx]);
        saveState('lastConnUri', uri);
        saveState('lastConnName', currentConnName);
        showScreen(1);
        await loadDatabases();
        if (mobile && !sidebarVisible) { showSidebar(); }
      } else {
        showStatus(t('Connection failed') + ': ' + lastConnError, true);
      }
      buttonSetTitle(connectBtn, t('Connect'));
      connecting = false;
    });
    buttonSetBordered(connectBtn, 0);
    buttonSetTextColor(connectBtn, moR, moG, moB, 1.0);

    const connId = connectionIds[i];
    const confirmLabel = Text('');
    textSetFontSize(confirmLabel, 11);
    textSetFontFamily(confirmLabel, uiFont);
    textSetColor(confirmLabel, erR, erG, erB, 1.0);
    widgetSetHidden(confirmLabel, 1);

    const confirmYes = Button('Yes, delete', () => {
      deleteConnection(connId);
      loadConnections();
      refreshConnectionList();
    });
    buttonSetBordered(confirmYes, 0);
    buttonSetTextColor(confirmYes, erR, erG, erB, 1.0);
    widgetSetHidden(confirmYes, 1);

    const confirmNo = Button('Cancel', () => {
      widgetSetHidden(confirmLabel, 1);
      widgetSetHidden(confirmYes, 1);
      widgetSetHidden(confirmNo, 1);
    });
    buttonSetBordered(confirmNo, 0);
    buttonSetTextColor(confirmNo, tsR, tsG, tsB, 1.0);
    widgetSetHidden(confirmNo, 1);

    const deleteBtn = makeDangerBtn(t('Remove'), () => {
      textSetString(confirmLabel, t('Remove this connection?'));
      widgetSetHidden(confirmLabel, 0);
      widgetSetHidden(confirmYes, 0);
      widgetSetHidden(confirmNo, 0);
    });

    let card: any;
    if (mobile) {
      // Mobile: stack vertically — info on top, buttons below
      const btnRow = HStack(8, [deleteBtn, Spacer(), connectBtn]);
      const confirmRow = HStack(8, [confirmLabel, confirmYes, confirmNo]);
      card = VStack(10, [info, confirmRow, btnRow]);
    } else {
      const row = HStack(12, [accentBar, info, Spacer(), confirmLabel, confirmYes, confirmNo, deleteBtn, connectBtn]);
      card = VStack(0, [row]);
    }
    widgetSetBackgroundColor(card, sfR, sfG, sfB, 1.0);
    setCornerRadius(card, 10);
    setPadding(card, 12, 16, 12, 16);

    widgetAddChild(connListContainer, card);
    widgetMatchParentWidth(card);
  }

  // Add new connection button
  const addMoreBtn = Button('+ New Connection', () => { showConnectionForm(); });
  buttonSetTextColor(addMoreBtn, 1.0, 1.0, 1.0, 1.0);
  widgetSetBackgroundColor(addMoreBtn, moR, moG, moB, 1.0);
  setCornerRadius(addMoreBtn, 8);
  setPadding(addMoreBtn, 10, 16, 10, 16);
  widgetAddChild(connListContainer, addMoreBtn);
}

// --- Connection form ---
const formContainer = VStack(12, []);
widgetSetHidden(formContainer, 1);

function showConnectionForm(): void {
  widgetClearChildren(formContainer);
  widgetSetHidden(connListContainer, 1);
  widgetSetHidden(formContainer, 0);

  const formCard = VStack(12, []);
  widgetSetBackgroundColor(formCard, sfR, sfG, sfB, 1.0);
  setCornerRadius(formCard, 12);
  setPadding(formCard, 20, 24, 20, 24);

  const title = makeLabel('New Connection', 18, true);

  const nameLabel = makeSecondary(t('Name'), 11);
  const nameField = TextField('e.g. Production, Local dev...', (val: string) => { formName = val; });

  const hostLabel = makeSecondary(t('Host'), 11);
  const hostField = TextField('localhost', (val: string) => { formHost = val || 'localhost'; });

  const portLabel = makeSecondary(t('Port'), 11);
  const portField = TextField('27017', (val: string) => { formPort = val || '27017'; });

  const userLabel = makeSecondary(t('Username (optional)'), 11);
  const userField = TextField('', (val: string) => { formUser = val; });

  const passLabel = makeSecondary(t('Password (optional)'), 11);
  const passField = TextField('', (val: string) => { formPass = val; });

  const divLabel = makeMuted(t('or connect via full URI (overrides above)'), 11);

  const uriLabel = makeSecondary(t('Connection String'), 11);
  const uriField = TextField('mongodb+srv://user:pass@cluster.example.com/db', (val: string) => { formUri = val; });

  // Tab key navigation: name → host → port → user → pass → uri
  textfieldSetNextKeyView(nameField, hostField);
  textfieldSetNextKeyView(hostField, portField);
  textfieldSetNextKeyView(portField, userField);
  textfieldSetNextKeyView(userField, passField);
  textfieldSetNextKeyView(passField, uriField);

  const saveBtn = Button('Save Connection', () => {
    try {
      const nameRaw = textfieldGetString(nameField);
      const name = (typeof nameRaw === 'string' && nameRaw.length > 0) ? nameRaw : (formName || t('Untitled'));
      const hostRaw = textfieldGetString(hostField);
      const host = (typeof hostRaw === 'string' && hostRaw.length > 0) ? hostRaw : (formHost || 'localhost');
      const portRaw = textfieldGetString(portField);
      const port = (typeof portRaw === 'string' && portRaw.length > 0) ? portRaw : (formPort || '27017');
      // Build URI using string concatenation (+) which Perry's codegen handles
      // correctly for is_string locals. encodeURIComponent and || fail due to
      // NaN-boxing being stripped (see PerryTS/perry#10, #12).
      // Read user/pass into string variables via + '' (forces string concat path)
      const userStr = textfieldGetString(userField) + '';
      const passStr = textfieldGetString(passField) + '';
      const uriStr = textfieldGetString(uriField) + '';

      let uri = '';
      if (uriStr.length > 0) {
        uri = uriStr;
      } else if (userStr.length > 0 && passStr.length > 0) {
        // Note: not using encodeURIComponent — it corrupts NaN-boxed strings.
        // Users with special chars in user/pass should use the URI field instead.
        uri = 'mongodb://' + userStr + ':' + passStr + '@' + host + ':' + port;
      } else {
        uri = 'mongodb://' + host + ':' + port;
      }

      // Extract host (without port) from URI for display in connection list
      let displayHost = host;
      let displayPort = port;
      const schemeIdx = uri.indexOf('://');
      if (schemeIdx >= 0) {
        const afterScheme = uri.substring(schemeIdx + 3);
        const atIdx = afterScheme.indexOf('@');
        const hostPart = atIdx >= 0 ? afterScheme.substring(atIdx + 1) : afterScheme;
        const slashIdx = hostPart.indexOf('/');
        const hostPortStr = slashIdx >= 0 ? hostPart.substring(0, slashIdx) : hostPart;
        const colonIdx = hostPortStr.lastIndexOf(':');
        if (colonIdx >= 0) {
          displayHost = hostPortStr.substring(0, colonIdx);
          displayPort = hostPortStr.substring(colonIdx + 1);
        } else {
          displayHost = hostPortStr;
        }
      }

      // Parse port number (avoid parseInt which may not work in Perry AOT)
      let portNum = 27017;
      if (displayPort.length > 0) {
        const p = Number(displayPort);
        if (p > 0) portNum = p;
      }

      // Create the connection profile in SQLite
      const profile: any = createConnection({ name: name, host: displayHost, port: portNum, connectionString: uri });
      // Also try Keychain as backup
      if (!isWeb) keychainSave('mango-conn-' + profile.id, uri);

      formName = '';
      formHost = 'localhost';
      formPort = '27017';
      formUser = '';
      formPass = '';
      saveState('_fu', '');
      saveState('_fp', '');
      formUri = '';
      widgetSetHidden(formContainer, 1);
      widgetSetHidden(connListContainer, 0);
      loadConnections();
      refreshConnectionList();
    } catch (e: any) {
      showStatus(t('Error saving') + ': ' + (e.message || e), true);
    }
  });

  buttonSetTextColor(saveBtn, moR, moG, moB, 1.0);

  const cancelBtn = makeGhostBtn(t('Cancel'), () => {
    widgetSetHidden(formContainer, 1);
    widgetSetHidden(connListContainer, 0);
  });

  widgetAddChild(formCard, title);
  widgetAddChild(formCard, nameLabel);
  widgetAddChild(formCard, nameField);
  widgetAddChild(formCard, hostLabel);
  widgetAddChild(formCard, hostField);
  widgetAddChild(formCard, portLabel);
  widgetAddChild(formCard, portField);
  widgetAddChild(formCard, userLabel);
  widgetAddChild(formCard, userField);
  widgetAddChild(formCard, passLabel);
  widgetAddChild(formCard, passField);
  widgetAddChild(formCard, Divider());
  widgetAddChild(formCard, divLabel);
  widgetAddChild(formCard, uriLabel);
  widgetAddChild(formCard, uriField);
  widgetAddChild(formCard, HStack(8, [cancelBtn, Spacer(), saveBtn]));

  widgetAddChild(formContainer, formCard);
  widgetMatchParentWidth(formCard);
}

// Build connection screen
refreshConnectionList();

// --- Hero banner (full-width via ScrollView Width alignment) ---
const heroLogo = ImageFile(mobile ? 'assets/mango-app-icon-40.png' : 'assets/mango-app-icon-44.png');
heroLogo.setSize(mobile ? 40 : 44, mobile ? 40 : 44);

const heroTitle = Text('Mango');
textSetFontSize(heroTitle, mobile ? 28 : 38);
textSetFontFamily(heroTitle, uiFont);
textSetFontWeight(heroTitle, mobile ? 28 : 38, 0.7);
textSetColor(heroTitle, 1.0, 1.0, 1.0, 1.0); // white on gradient bg

const heroSubtitle = Text('MongoDB, finally fast.');
textSetFontSize(heroSubtitle, mobile ? 14 : 16);
textSetFontFamily(heroSubtitle, uiFont);
textSetColor(heroSubtitle, 1.0, 1.0, 1.0, 0.85); // white on gradient bg

const heroRow = HStack(14, [heroLogo, heroTitle]);
const heroBox = VStack(8, [
  heroRow,
  heroSubtitle,
]);
widgetSetBackgroundGradient(heroBox, moR, moG, moB, 1.0, myR, myG, myB, 1.0, 1);
if (mobile) {
  setPadding(heroBox, 60, 24, 28, 24); // top padding for status bar safe area
} else if (iPad) {
  setPadding(heroBox, 60, 120, 36, 120); // safe area top + iPad-width horizontal padding
} else {
  setPadding(heroBox, 44, 380, 36, 380); // symmetric padding centers ~340px content in 1100px window
}

// --- Body content below hero ---
const connBody = VStack(16, [
  statusText,
  connListContainer,
  formContainer,
]);
setPadding(connBody, mobile ? 20 : 28, mobile ? 16 : 60, 32, mobile ? 16 : 60);

// On web, add server status indicator at the top of connection body
if (isWeb) widgetAddChild(connBody, webStatusText);

// Force containers to fill width (must be after connBody creation so parent exists)
widgetMatchParentWidth(connListContainer);
widgetMatchParentWidth(formContainer);

// All content in ScrollView — hero + body
const connContent = VStack(0, [heroBox, connBody]);

const connectionScreen = ScrollView();
scrollviewSetChild(connectionScreen, connContent);
widgetSetBackgroundColor(connectionScreen, bgR, bgG, bgB, 1.0);

// Force hero to fill full width
widgetMatchParentWidth(heroBox);
widgetMatchParentWidth(connBody);

// ============================================================
//  BROWSER SCREEN
// ============================================================

const docsContainer = VStack(10, []);
setPadding(docsContainer, 4, 4, 16, 4);
const docsScroll = ScrollView();
scrollviewSetChild(docsScroll, docsContainer);
// ScrollView sets distribution=-1 (GravityAreas) and alignment=7 (.width)
// Don't override — GravityAreas uses intrinsic heights, .width fills cross-axis
widgetSetHugging(docsScroll, 1); // expand to fill

// Edit container: lives OUTSIDE browserBody to avoid .fill distribution stretching
const editContainer = VStack(16, []);
setPadding(editContainer, mobile ? 12 : 20, mobile ? 10 : 24, 16, mobile ? 10 : 24);
stackSetDistribution(editContainer, 0); // .fill so Spacer absorbs remaining height
widgetSetHidden(editContainer, 1);

// Initial placeholder
const docInfoText = makeMuted(t('Enter a database and collection, then run a query.'), 13);
widgetAddChild(docsContainer, docInfoText);

// --- Toolbar ---
const connLabel = Text('Connected');
textSetFontSize(connLabel, 11);
textSetFontFamily(connLabel, uiFont);
textSetFontWeight(connLabel, 11, 0.5);
textSetColor(connLabel, sgR, sgG, sgB, 1.0);

const disconnectBtn = makeDangerBtn(t('Disconnect'), async () => {
  if (mongoClient) {
    try { await mongoClient.close(); } catch (e: any) {}
    mongoClient = null;
  }
  // Clear sidebar state (don't call renderSidebar — crashes due to Perry NaN-boxing
  // bug #13, and sidebar isn't visible on screen 0 anyway)
  sidebarDbNames = [];
  expandedDbIdx = -1;
  collDbIdx = [];
  collNames = [];
  widgetClearChildren(sidebarContainer);
  saveState('lastConnId', '');
  saveState('lastConnUri', '');
  saveState('lastConnName', '');
  saveState('lastDb', '');
  saveState('lastColl', '');
  showScreen(0);
});

// Browser toolbar — logo + connection name + status
const browserLogo = ImageFile('assets/mango-app-icon-24.png');
browserLogo.setSize(24, 24);

const browserTitle = Text('Mango');
textSetFontSize(browserTitle, 18);
textSetFontFamily(browserTitle, uiFont);
textSetFontWeight(browserTitle, 18, 0.7);
textSetColor(browserTitle, moR, moG, moB, 1.0);

// --- Query bar ---
const dbField = TextField('database', (val: string) => { currentDbName = val; });
const collField = TextField('collection', (val: string) => { currentCollName = val; });
const filterField = TextField('filter: {}', (val: string) => { currentFilter = val || '{}'; });

// Tab navigation: database → collection → filter
textfieldSetNextKeyView(dbField, collField);
textfieldSetNextKeyView(collField, filterField);

// Context breadcrumb
const breadcrumb = Text('');
textSetFontSize(breadcrumb, 12);
textSetFontFamily(breadcrumb, uiFont);
textSetFontWeight(breadcrumb, 12, 0.5);
textSetColor(breadcrumb, moR, moG, moB, 1.0);
widgetSetHidden(breadcrumb, 1);

async function runQuery(dbName: string, collName: string, filter: string): Promise<void> {
  widgetClearChildren(docsContainer);
  if (!mongoClient) {
    widgetAddChild(docsContainer, makeMuted(t('Not connected to MongoDB.'), 13));
    return;
  }
  if (!dbName || !collName) {
    widgetAddChild(docsContainer, makeMuted(t('Enter both database and collection names.'), 13));
    return;
  }

  activeDbName = dbName;
  activeCollName = collName;
  lastQueryFilter = filter;

  textSetString(breadcrumb, dbName + '.' + collName);
  widgetSetHidden(breadcrumb, 0);

  widgetAddChild(docsContainer, makeMuted(t('Querying...'), 13));

  trackQuery();
  const result = await queryCollection(dbName, collName, filter);
  displayDocs(result);
}

const queryBtn = Button('Run Query', async () => {
  const db = textfieldGetString(dbField);
  const coll = textfieldGetString(collField);
  const filter = textfieldGetString(filterField) || '{}';
  await runQuery(db, coll, filter);
});

// --- Edit view ---
async function showEditView(docJson: string): Promise<void> {
  // Hide browser body, show edit container with loading state
  widgetSetHidden(browserBody, 1);
  widgetClearChildren(editContainer);
  widgetSetHidden(editContainer, 0);

  const loadingLabel = makeMuted(t('Formatting document...'), 13);
  widgetAddChild(editContainer, loadingLabel);

  const idFilter = extractIdFilter(docJson);
  const editableJson = removeIdFromJson(docJson);
  const idShort = extractIdShort(docJson);

  // Pretty-print on background thread to keep UI responsive
  const prettyJson = await spawn(() => prettyPrintJson(editableJson));

  // Build the edit UI now that formatting is done
  widgetClearChildren(editContainer);

  // Header
  const editHeader = HStack(8, [
    makeLabel('Edit Document', 16, true),
    Spacer(),
    makeMonoMuted(idShort, 11),
  ]);

  const fieldLabel = makeSecondary(t('Document JSON (without _id)'), 11);

  const jsonEditor = new HoneCodeEditorWidget(600, 200, {
    content: prettyJson,
    language: 'json',
    theme: dark ? 'dark' : 'light',
    fontSize: 13,
    fontFamily: 'Menlo',
  });
  // Match editor colors to Mango's theme
  const ed = jsonEditor.editor;
  ed.setBgColor(sfR, sfG, sfB);
  ed.setFgColor(txR, txG, txB);
  ed.setGutterFgColor(tsR, tsG, tsB);
  ed.setCursorColor(moR, moG, moB);
  ed.setSelectionColor(moR, moG, moB, 0.2);
  // Wrap editor in a fixed-height container (embedded NSViews resist height constraints)
  const editorBox = VStack(0, []);
  widgetSetHeight(editorBox, 200);
  widgetAddChild(editorBox, jsonEditor.widget);
  widgetMatchParentWidth(jsonEditor.widget);
  widgetMatchParentHeight(jsonEditor.widget);

  const saveBtn = makePrimaryBtn(t('Save Changes'), async () => {
    showStatus(t('Saving...'), false);
    const editorContent = jsonEditor.content;
    let compactJson = editorContent;
    try { compactJson = JSON.stringify(JSON.parse(editorContent)); } catch (e: any) {
      showStatus(t('Invalid JSON') + ': ' + (e.message || 'parse error'), true);
      return;
    }
    const updateStr = '{"$set":' + compactJson + '}';
    await updateDocument(activeDbName, activeCollName, idFilter, updateStr);
    showStatus(t('Document saved'), false);
    // Switch back to doc list
    widgetSetHidden(editContainer, 1);
    widgetSetHidden(browserBody, 0);
    const result = await queryCollection(activeDbName, activeCollName, lastQueryFilter);
    displayDocs(result);
  });

  const deleteBtn = makeDangerBtn(t('Delete Document'), async () => {
    showStatus(t('Deleting...'), false);
    const deleted = await deleteDocument(activeDbName, activeCollName, idFilter);
    if (deleted > 0) {
      showStatus(t('Document deleted'), false);
    } else {
      showStatus(t('Delete failed'), true);
    }
    widgetSetHidden(editContainer, 1);
    widgetSetHidden(browserBody, 0);
    const result = await queryCollection(activeDbName, activeCollName, lastQueryFilter);
    displayDocs(result);
  });

  const backBtn = makeGhostBtn(t('Back to results'), () => {
    widgetSetHidden(editContainer, 1);
    widgetSetHidden(browserBody, 0);
  });

  // Build a compact inner card for the edit UI
  const editCard = VStack(12, []);
  widgetSetBackgroundColor(editCard, sfR, sfG, sfB, 1.0);
  setCornerRadius(editCard, 12);
  setPadding(editCard, 16, 20, 16, 20);
  widgetAddChild(editCard, editHeader);
  widgetAddChild(editCard, Divider());
  widgetAddChild(editCard, fieldLabel);
  widgetAddChild(editCard, editorBox);
  widgetAddChild(editCard, HStack(8, [deleteBtn, Spacer(), backBtn, saveBtn]));

  // editContainer is full-height (HStack .fill), so put card at top + spacer absorbs rest
  widgetAddChild(editContainer, editCard);
  widgetMatchParentWidth(editCard); // fill the available width so buttons aren't clipped
  widgetSetHugging(editCard, 750); // card stays compact vertically
  widgetAddChild(editContainer, Spacer());
}

// --- Document list ---
function displayDocs(jsonStr: string): void {
  // Ensure browser body is visible (might be hidden if coming from edit view)
  widgetSetHidden(browserBody, 0);
  widgetSetHidden(editContainer, 1);
  widgetClearChildren(docsContainer);
  let docArray: any[] = [];
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.error) {
      const errCard = makeCard([makeMuted(t('Error') + ': ' + parsed.error, 13)], 4);
      widgetAddChild(docsContainer, errCard);
      return;
    }
    docArray = parsed;
  } catch (e: any) {
    widgetAddChild(docsContainer, makeCard([makeMuted(t('Failed to parse response'), 13)], 4));
    return;
  }

  // Results header
  const countLabel = Text(docArray.length + ' ' + (docArray.length === 1 ? t('document') : t('documents')));
  textSetFontSize(countLabel, 13);
  textSetFontFamily(countLabel, uiFont);
  textSetFontWeight(countLabel, 13, 0.5);
  textSetColor(countLabel, tsR, tsG, tsB, 1.0);

  const headerRow = HStack(8, [
    makeLabel(activeDbName + '.' + activeCollName, 14, true),
    Spacer(),
    countLabel,
  ]);
  widgetAddChild(docsContainer, headerRow);

  if (docArray.length === 0) {
    const emptyCard = makeCard([makeMuted(t('No documents match the query.'), 13)], 4);
    widgetAddChild(docsContainer, emptyCard);
    return;
  }

  // Pre-process documents (parallel for large result sets, sequential for small)
  let processed: any[];
  if (docArray.length > 10) {
    processed = parallelMap(docArray, processDocForDisplay);
  } else {
    processed = [];
    for (let p = 0; p < docArray.length; p++) {
      processed.push(processDocForDisplay(docArray[p]));
    }
  }

  // Document cards (UI construction — main thread only)
  for (let i = 0; i < processed.length; i++) {
    const item = processed[i] as any;
    const docJsonStr: string = item.json;
    const idShort: string = item.id;
    const fields: string[][] = item.fields;

    const card = VStack(0, []);
    widgetSetBackgroundColor(card, sfR, sfG, sfB, 1.0);
    setCornerRadius(card, 10);
    setPadding(card, 12, 16, 12, 16);

    // Header: _id + delete/edit buttons
    const idLabel = makeMonoMuted(idShort, 10);

    const editBtn = Button('Edit', async () => { await showEditView(docJsonStr); });
    buttonSetBordered(editBtn, 0);
    buttonSetTextColor(editBtn, moR, moG, moB, 1.0);

    // Inline delete with confirmation
    const delConfirmLabel = makeMuted(t('Delete this document?'), 11);
    widgetSetHidden(delConfirmLabel, 1);

    const delConfirmYes = makeDangerBtn(t('Yes, delete'), async () => {
      textSetString(delConfirmLabel, t('Deleting...'));
      textSetColor(delConfirmLabel, tmR, tmG, tmB, 1.0);
      const idFilter = extractIdFilter(docJsonStr);
      const deleted = await deleteDocument(activeDbName, activeCollName, idFilter);
      if (deleted > 0) {
        showStatus(t('Document deleted'), false);
      } else {
        showStatus(t('Delete failed'), true);
      }
      const result = await queryCollection(activeDbName, activeCollName, lastQueryFilter);
      displayDocs(result);
    });
    widgetSetHidden(delConfirmYes, 1);

    const delConfirmNo = makeGhostBtn(t('Cancel'), () => {
      widgetSetHidden(delConfirmLabel, 1);
      widgetSetHidden(delConfirmYes, 1);
      widgetSetHidden(delConfirmNo, 1);
    });
    widgetSetHidden(delConfirmNo, 1);

    const cardDelBtn = makeDangerBtn(t('Delete'), () => {
      widgetSetHidden(delConfirmLabel, 0);
      widgetSetHidden(delConfirmYes, 0);
      widgetSetHidden(delConfirmNo, 0);
    });

    const docHeader = HStack(6, [idLabel, Spacer(), delConfirmLabel, delConfirmYes, delConfirmNo, editBtn, cardDelBtn]);
    widgetAddChild(card, docHeader);

    // Field rows (skip _id)
    for (let f = 0; f < fields.length; f++) {
      const key = fields[f][0];
      const val = fields[f][1];
      if (key === '_id') continue;

      const keyText = makeSecondary(key, 12);
      const valText = makeMono(val, 12);

      const fieldRow = HStack(8, [keyText, Spacer(), valText]);
      widgetAddChild(card, fieldRow);
    }

    widgetAddChild(docsContainer, card);
    widgetMatchParentWidth(card);
  }
}

// --- Sidebar ---
const sidebarContainer = VStack(2, []);
setPadding(sidebarContainer, 8, 8, 8, 8);

const sidebarScroll = ScrollView();
scrollviewSetChild(sidebarScroll, sidebarContainer);
widgetSetBackgroundColor(sidebarScroll, tbR, tbG, tbB, 1.0);
if (!mobile) widgetSetWidth(sidebarScroll, 240);
if (mobile) widgetSetHidden(sidebarScroll, 1);
let sidebarVisible = !mobile;

async function loadDatabases(): Promise<void> {
  // Show loading in sidebar
  widgetClearChildren(sidebarContainer);
  const loadingLabel = makeMuted(t('Loading databases...'), 12);
  setPadding(loadingLabel, 8, 12, 8, 12);
  widgetAddChild(sidebarContainer, loadingLabel);

  sidebarDbNames = await listDatabases();
  expandedDbIdx = -1;
  collDbIdx = [];
  collNames = [];
  renderSidebar();
}

async function loadCollectionsFor(dbIdx: number): Promise<void> {
  const dbName = sidebarDbNames[dbIdx];
  // Sidebar already shows "Loading..." via renderSidebar (hasCollectionsFor returns false)
  const colls = await listCollections(dbName);
  // Remove old entries for this db
  const nextIdx: number[] = [];
  const nextNames: string[] = [];
  for (let k = 0; k < collDbIdx.length; k++) {
    if (collDbIdx[k] !== dbIdx) {
      nextIdx.push(collDbIdx[k]);
      nextNames.push(collNames[k]);
    }
  }
  // Add new entries
  for (let k = 0; k < colls.length; k++) {
    nextIdx.push(dbIdx);
    nextNames.push(colls[k]);
  }
  collDbIdx = nextIdx;
  collNames = nextNames;
  renderSidebar();
}

function hasCollectionsFor(dbIdx: number): boolean {
  for (let k = 0; k < collDbIdx.length; k++) {
    if (collDbIdx[k] === dbIdx) return true;
  }
  return false;
}

function getCollectionsFor(dbIdx: number): string[] {
  const result: string[] = [];
  for (let k = 0; k < collDbIdx.length; k++) {
    if (collDbIdx[k] === dbIdx) {
      result.push(collNames[k]);
    }
  }
  return result;
}

function renderSidebar(): void {
  widgetClearChildren(sidebarContainer);

  // Header
  const hdr = makeLabel('Explorer', 13, true);
  setPadding(hdr, 6, 12, 10, 12);
  widgetAddChild(sidebarContainer, hdr);

  if (sidebarDbNames.length === 0) {
    const empty = makeMuted(t('No databases'), 12);
    setPadding(empty, 4, 12, 4, 12);
    widgetAddChild(sidebarContainer, empty);
    return;
  }

  for (let i = 0; i < sidebarDbNames.length; i++) {
    const dbIdx = i;
    const dbName = sidebarDbNames[i];
    const isExpanded = (expandedDbIdx === i);

    // Database row — use db icon with chevron in the button label
    const dbIcon = Text(isExpanded ? '⌄' : '›');
    textSetFontSize(dbIcon, 14);
    textSetFontWeight(dbIcon, 14, 0.3);
    textSetColor(dbIcon, tmR, tmG, tmB, 1.0);

    const dbBtn = Button(dbName, () => {
      if (expandedDbIdx === dbIdx) {
        expandedDbIdx = -1;
        renderSidebar();
      } else {
        expandedDbIdx = dbIdx;
        renderSidebar();
        // Load collections in background if not cached
        if (!hasCollectionsFor(dbIdx)) {
          loadCollectionsFor(dbIdx);
        }
      }
    });
    buttonSetBordered(dbBtn, 0);
    buttonSetTextColor(dbBtn, txR, txG, txB, 1.0);

    const dbRow = HStack(6, [dbIcon, dbBtn, Spacer()]);
    setPadding(dbRow, 5, 12, 5, 12);

    widgetAddChild(sidebarContainer, dbRow);

    // Collections (if expanded)
    if (isExpanded) {
      const colls = getCollectionsFor(dbIdx);
      if (colls.length === 0) {
        const loading = makeMuted(t('Loading...'), 11);
        setPadding(loading, 3, 36, 3, 36);
        widgetAddChild(sidebarContainer, loading);
      } else {
        for (let c = 0; c < colls.length; c++) {
          const collName = colls[c];
          const collIcon = Text('◦');
          textSetFontSize(collIcon, 10);
          textSetColor(collIcon, tsR, tsG, tsB, 1.0);

          const collBtn = Button(collName, async () => {
            activeDbName = dbName;
            activeCollName = collName;
            currentDbName = dbName;
            currentCollName = collName;
            saveState('lastDb', dbName);
            saveState('lastColl', collName);
            textfieldSetString(dbField, dbName);
            textfieldSetString(collField, collName);
            // On mobile, close sidebar and show main content
            if (mobile) { hideSidebar(); }
            showStatus(t('Loading') + ' ' + dbName + '.' + collName + '...', false);
            await runQuery(dbName, collName, '{}');
            widgetSetHidden(statusText, 1);
          });
          buttonSetBordered(collBtn, 0);
          buttonSetTextColor(collBtn, txR, txG, txB, 1.0);

          const collRow = HStack(6, [collIcon, collBtn, Spacer()]);
          setPadding(collRow, 3, 36, 3, 36);

          widgetAddChild(sidebarContainer, collRow);
        }
      }
    }
  }

  // Refresh button at bottom
  const refreshBtn = makeGhostBtn(t('Refresh'), async () => {
    await loadDatabases();
  });
  setPadding(refreshBtn, 8, 12, 8, 12);
  widgetAddChild(sidebarContainer, refreshBtn);
}

// --- Browser screen layout ---

// Sidebar toggle for mobile
function showSidebar(): void {
  sidebarVisible = true;
  widgetSetHidden(sidebarScroll, 0);
  if (mobile) {
    widgetSetHidden(browserBody, 1);
    widgetSetHidden(editContainer, 1);
    widgetSetHugging(sidebarScroll, 1); // expand to fill on mobile
  }
}
function hideSidebar(): void {
  sidebarVisible = false;
  widgetSetHidden(sidebarScroll, 1);
  if (mobile) {
    widgetSetHidden(browserBody, 0);
    widgetSetHugging(sidebarScroll, 750); // restore compact
  }
}
const sidebarToggle = Button('Explorer', () => {
  if (sidebarVisible) { hideSidebar(); } else { showSidebar(); }
});
buttonSetBordered(sidebarToggle, 0);
buttonSetTextColor(sidebarToggle, moR, moG, moB, 1.0);
if (!mobile) widgetSetHidden(sidebarToggle, 1);

// About button only shown on mobile toolbar (desktop uses menu bar)
const browserInfoBtn = Button('About', () => { saveState('previousScreen', '1'); showScreen(2); });
buttonSetBordered(browserInfoBtn, 0);
buttonSetTextColor(browserInfoBtn, tmR, tmG, tmB, 1.0);
if (!mobile) widgetSetHidden(browserInfoBtn, 1);

// Branded toolbar — must use inline array literals (Perry codegen doesn't support variable arrays)
let toolbarRow: any;
if (mobile) {
  toolbarRow = HStack(10, [sidebarToggle, Spacer(), connLabel, browserInfoBtn, disconnectBtn]);
} else {
  toolbarRow = HStack(10, [browserLogo, browserTitle, Spacer(), connLabel, disconnectBtn]);
}
const toolbarBox = VStack(0, [toolbarRow]);
setPadding(toolbarBox, isIOS ? 52 : (__platform__ === 4 ? 6 : 12), mobile ? 16 : 24, __platform__ === 4 ? 6 : 12, mobile ? 16 : 24); // iOS/iPad top safe area; Linux: tighter padding
if (__platform__ === 4) {
  // Linux/GTK4: use orange gradient so the toolbar stands out against the beige window background
  widgetSetBackgroundGradient(toolbarBox, moR, moG, moB, 1.0, myR, myG, myB, 1.0, 1);
  textSetColor(browserTitle, 1.0, 1.0, 1.0, 1.0);
  textSetColor(connLabel, 1.0, 1.0, 1.0, 0.9);
  buttonSetTextColor(disconnectBtn, 1.0, 1.0, 1.0, 0.9);
  widgetSetHeight(toolbarBox, 44);
  browserLogo.setSize(28, 28);
} else {
  widgetSetBackgroundColor(toolbarBox, sfR, sfG, sfB, 1.0);
}

// Query card
const queryCard = VStack(8, []);
widgetSetBackgroundColor(queryCard, sfR, sfG, sfB, 1.0);
setCornerRadius(queryCard, 12);
setPadding(queryCard, 16, 20, 16, 20);

const queryTitle = makeLabel('Query', 14, true);

// Inline target: db.collection
const dotSep = makeSecondary('.', 13);
let dbColRow: any;
if (mobile) {
  dbColRow = VStack(6, [dbField, collField]);
} else {
  dbColRow = HStack(4, [dbField, dotSep, collField, Spacer()]);
  widgetSetWidth(dbField, 250);
  widgetSetWidth(collField, 250);
}

widgetAddChild(queryCard, queryTitle);
widgetAddChild(queryCard, makeSecondary(t('Database . Collection'), 10));
widgetAddChild(queryCard, dbColRow);
widgetAddChild(queryCard, makeSecondary(t('Filter'), 10));
widgetAddChild(queryCard, filterField);
widgetAddChild(queryCard, HStack(8, [breadcrumb, Spacer(), queryBtn]));

// Main browser body with query + results
const browserBody = VStack(16, [queryCard, docsScroll]);
setPadding(browserBody, mobile ? 12 : 20, mobile ? 10 : 24, 16, mobile ? 10 : 24);
stackSetDistribution(browserBody, 0);   // .fill — docsScroll fills remaining height
widgetSetHugging(queryCard, 750);        // query card stays compact

// Sidebar + main content layout (editContainer is sibling of browserBody, toggled on edit)
const browserContent = HStack(0, [sidebarScroll, browserBody, editContainer]);
stackSetDistribution(browserContent, 0); // .fill
stackSetAlignment(browserContent, 0);    // .fill cross-axis — children fill height (iOS HStack defaults to center)
widgetSetHugging(sidebarScroll, 750); // sidebar stays fixed
widgetSetHugging(browserBody, 1);     // body expands to fill
widgetSetHugging(editContainer, 1);   // edit panel expands to fill when visible

const browserScreen = VStack(0, [
  toolbarBox,
  Divider(),
  browserContent,
]);
widgetSetBackgroundColor(browserScreen, bgR, bgG, bgB, 1.0);
widgetSetHidden(browserScreen, 1);
stackSetDistribution(browserScreen, 0);   // .fill — children stretch to fill
widgetSetHugging(toolbarBox, 750);         // toolbar stays compact
widgetSetHugging(browserContent, 1);       // content area expands to fill remaining space

// ============================================================
//  INFO / ABOUT SCREEN
// ============================================================
// Analytics preference: use saveState/getState (connection-store) to avoid
// instantiating PreferencesStore at module scope which crashes on iOS.
function isAnalyticsEnabled(): boolean {
  const val = getState('analyticsEnabled');
  if (val === '0' || val === 'false') return false;
  return true; // default: enabled
}
function setAnalyticsEnabled(enabled: boolean): void {
  saveState('analyticsEnabled', enabled ? '1' : '0');
}

const infoLogo = ImageFile('assets/mango-app-icon-80.png');
infoLogo.setSize(80, 80);

const infoTitle = Text('Mango');
textSetFontSize(infoTitle, 32);
textSetFontFamily(infoTitle, uiFont);
textSetFontWeight(infoTitle, 32, 0.7);
textSetColor(infoTitle, txR, txG, txB, 1.0);

const infoVersion = Text('Version 1.0.0');
textSetFontSize(infoVersion, 13);
textSetFontFamily(infoVersion, uiFont);
textSetColor(infoVersion, tsR, tsG, tsB, 1.0);

const infoTagline = Text('MongoDB, finally fast.');
textSetFontSize(infoTagline, 15);
textSetFontFamily(infoTagline, uiFont);
textSetColor(infoTagline, moR, moG, moB, 1.0);

const infoAuthor = Text('Made by Skelpo GmbH');
textSetFontSize(infoAuthor, 13);
textSetFontFamily(infoAuthor, uiFont);
textSetColor(infoAuthor, tmR, tmG, tmB, 1.0);

const infoUrl = Text('mangoquery.com');
textSetFontSize(infoUrl, 13);
textSetFontFamily(infoUrl, uiFont);
textSetColor(infoUrl, tsR, tsG, tsB, 1.0);

// Settings section header
const settingsHeader = Text('Settings');
textSetFontSize(settingsHeader, 12);
textSetFontFamily(settingsHeader, uiFont);
textSetFontWeight(settingsHeader, 12, 0.5);
textSetColor(settingsHeader, tmR, tmG, tmB, 1.0);

// Analytics toggle
const analyticsLabel = Text('Anonymous usage statistics');
textSetFontSize(analyticsLabel, 14);
textSetFontFamily(analyticsLabel, uiFont);
textSetColor(analyticsLabel, txR, txG, txB, 1.0);

const analyticsHint = Text('Helps improve Mango. No personal data is collected.');
textSetFontSize(analyticsHint, 12);
textSetFontFamily(analyticsHint, uiFont);
textSetColor(analyticsHint, tmR, tmG, tmB, 0.7);

const analyticsStatusText = Text(isAnalyticsEnabled() ? 'Enabled' : 'Disabled');
textSetFontSize(analyticsStatusText, 13);
textSetFontFamily(analyticsStatusText, uiFont);
textSetColor(analyticsStatusText, moR, moG, moB, 1.0);

// Wrap each button in a VStack so we can toggle visibility via the wrapper.
// Perry closures capture by value, so buttons can't reference each other directly.
const disableWrap = VStack(0, []);
const enableWrap = VStack(0, []);

const disableBtn = Button('Disable', () => {
  setAnalyticsEnabled(false);
  textSetString(analyticsStatusText, t('Disabled'));
  widgetSetHidden(disableWrap, 1);
  widgetSetHidden(enableWrap, 0);
});
buttonSetBordered(disableBtn, 0);
buttonSetTextColor(disableBtn, erR, erG, erB, 1.0);
widgetAddChild(disableWrap, disableBtn);

const enableBtn = Button('Enable', () => {
  setAnalyticsEnabled(true);
  textSetString(analyticsStatusText, t('Enabled'));
  widgetSetHidden(enableWrap, 1);
  widgetSetHidden(disableWrap, 0);
});
buttonSetBordered(enableBtn, 0);
buttonSetTextColor(enableBtn, sgR, sgG, sgB, 1.0);
widgetAddChild(enableWrap, enableBtn);

widgetSetHidden(disableWrap, isAnalyticsEnabled() ? 0 : 1);
widgetSetHidden(enableWrap, isAnalyticsEnabled() ? 1 : 0);

let analyticsRow: any;
if (mobile) {
  const analyticsControls = HStack(8, [analyticsStatusText, disableWrap, enableWrap]);
  analyticsRow = VStack(8, [analyticsLabel, analyticsControls]);
} else {
  analyticsRow = HStack(8, [analyticsLabel, Spacer(), analyticsStatusText, disableWrap, enableWrap]);
}

// Header card with centered logo, title, tagline
const infoLogoRow = HStack(16, [infoLogo, VStack(4, [infoTitle, infoVersion])]);
if (mobile) stackSetAlignment(infoLogoRow, 0); // Fill — prevent VStack child from collapsing on Android
const infoHeaderCard = VStack(12, [
  infoLogoRow,
  infoTagline,
  Divider(),
  infoAuthor,
  infoUrl,
]);
widgetSetBackgroundColor(infoHeaderCard, sfR, sfG, sfB, 1.0);
setCornerRadius(infoHeaderCard, 14);
setPadding(infoHeaderCard, 28, 32, 24, 32);

// Settings card
const infoSettingsCard = VStack(10, [
  analyticsRow,
  analyticsHint,
]);
widgetSetBackgroundColor(infoSettingsCard, sfR, sfG, sfB, 1.0);
setCornerRadius(infoSettingsCard, 14);
setPadding(infoSettingsCard, 20, 28, 20, 28);

// Mobile: inline About screen
const backBtn = Button('< Back', () => {
  const prev = getState('previousScreen');
  showScreen(prev === '1' ? 1 : 0);
});
buttonSetBordered(backBtn, 0);
buttonSetTextColor(backBtn, moR, moG, moB, 1.0);
if (mobile) setPadding(backBtn, 8, 4, 8, 4);

const infoBody = VStack(12, [
  HStack(8, [backBtn, Spacer()]),
  infoHeaderCard,
  settingsHeader,
  infoSettingsCard,
]);
const infoPadH = mobile ? 16 : 280;
setPadding(infoBody, mobile ? 20 : 40, infoPadH, 32, infoPadH);
widgetMatchParentWidth(infoHeaderCard);
widgetMatchParentWidth(infoSettingsCard);

const infoContent = VStack(0, [infoBody]);
widgetMatchParentWidth(infoBody);
const infoScreen = ScrollView();
widgetSetBackgroundColor(infoScreen, bgR, bgG, bgB, 1.0);
widgetSetHidden(infoScreen, 1);

if (mobile) {
  // Mobile: inline About screen inside scrollview
  scrollviewSetChild(infoScreen, infoContent);
} else {
  // Desktop: About in a separate window (don't share widget with scrollview)
  var aboutWindow = Window('About Mango', 420, 380);
  aboutWindow.setBody(infoContent);
}

// About button for mobile (no menu bar)
if (mobile) {
  const connInfoBtn = Button('About', () => { saveState('previousScreen', '0'); showScreen(2); });
  buttonSetBordered(connInfoBtn, 0);
  buttonSetTextColor(connInfoBtn, tmR, tmG, tmB, 1.0);
  widgetAddChild(connBody, HStack(0, [Spacer(), connInfoBtn, Spacer()]));
}

// --- Screen switching ---
function showScreen(idx: number): void {
  widgetSetHidden(connectionScreen, idx === 0 ? 0 : 1);
  widgetSetHidden(browserScreen, idx === 1 ? 0 : 1);
  widgetSetHidden(infoScreen, idx === 2 ? 0 : 1);
}

// --- Restore last session ---
async function restoreLastSession(): Promise<void> {
  const lastUri = getState('lastConnUri');
  const lastName = getState('lastConnName');
  if (!lastUri) return;

  showStatus(t('Reconnecting...'), false);
  const ok = await connectToMongo(lastUri);
  if (!ok) {
    if (lastConnError) {
      showStatus(t('Reconnect failed') + ': ' + lastConnError, true);
    } else {
      widgetSetHidden(statusText, 1);
    }
    return;
  }
  widgetSetHidden(statusText, 1);

  currentConnName = lastName || 'Server';
  textSetString(connLabel, currentConnName);
  showScreen(1);
  await loadDatabases();
  // On mobile, auto-show sidebar so user sees databases
  if (mobile && !sidebarVisible) { showSidebar(); }

  // Restore last db/collection
  const lastDb = getState('lastDb');
  const lastColl = getState('lastColl');
  if (lastDb && lastColl) {
    activeDbName = lastDb;
    activeCollName = lastColl;
    currentDbName = lastDb;
    currentCollName = lastColl;
    textfieldSetString(dbField, lastDb);
    textfieldSetString(collField, lastColl);
    await runQuery(lastDb, lastColl, '{}');
  }
}
// --- Screenshot mode ---
async function setupScreenshotMode(mode: number): Promise<void> {
  if (mode === 1) {
    // Welcome screen with mock saved connections
    createConnection({ name: 'Production', host: 'prod.cluster.example.net', port: 27017, connectionString: 'mongodb+srv://admin:****@prod.cluster.example.net' } as any);
    createConnection({ name: 'Staging', host: 'staging.example.com', port: 27017, connectionString: 'mongodb://staging.example.com:27017' } as any);
    createConnection({ name: 'Local dev', host: 'localhost', port: 27017, connectionString: 'mongodb://localhost:27017' } as any);
    loadConnections();
    refreshConnectionList();
    // Screen 0 is already shown by default
  } else if (mode === 2) {
    // Browser with sidebar + document list
    showScreen(1);
    currentConnName = 'Production';
    textSetString(connLabel, 'Production');
    sidebarDbNames = ['admin', 'config', 'shop_db', 'analytics'];
    expandedDbIdx = 2;
    collDbIdx = [2, 2, 2, 2];
    collNames = ['customers', 'orders', 'products', 'inventory'];
    renderSidebar();
    if (mobile && !sidebarVisible) { showSidebar(); }
    activeDbName = 'shop_db';
    activeCollName = 'customers';
    textfieldSetString(dbField, 'shop_db');
    textfieldSetString(collField, 'customers');
    displayDocs(JSON.stringify([
      {"_id":{"$oid":"69b26f3a8c1d4e5f7a2b63b1"},"name":"Alice","email":"alice@example.com","age":30,"role":"admin"},
      {"_id":{"$oid":"69b26f3a8c1d4e5f7a2b63b2"},"name":"Bob","email":"bob@example.com","age":25,"role":"user"},
      {"_id":{"$oid":"69b26f3a8c1d4e5f7a2b63b3"},"name":"Charlie","email":"charlie@example.com","age":35,"role":"editor"},
    ]));
  } else if (mode === 3) {
    // Query with filter and results
    showScreen(1);
    currentConnName = 'Production';
    textSetString(connLabel, 'Production');
    sidebarDbNames = ['admin', 'config', 'users_db'];
    expandedDbIdx = -1;
    renderSidebar();
    if (mobile && !sidebarVisible) { showSidebar(); }
    activeDbName = 'users_db';
    activeCollName = 'profiles';
    textfieldSetString(dbField, 'users_db');
    textfieldSetString(collField, 'profiles');
    textfieldSetString(filterField, '{ "role": "admin" }');
    displayDocs(JSON.stringify([
      {"_id":{"$oid":"5f4d8a2e9c3b7f1a2e8da1b2"},"name":"Sarah Chen","email":"sarah@company.com","role":"admin","active":true},
      {"_id":{"$oid":"5f4d8a2e9c3b7f1a2e8dc3d4"},"name":"James Park","email":"james@company.com","role":"admin","active":true},
    ]));
  } else if (mode === 4) {
    // Document edit view
    showScreen(1);
    currentConnName = 'Production';
    textSetString(connLabel, 'Production');
    activeDbName = 'shop_db';
    activeCollName = 'customers';
    await showEditView(JSON.stringify({"_id":{"$oid":"69b26f3a8c1d4e5f7a2b63b1"},"name":"Alice Johnson","email":"alice@example.com","age":30,"role":"admin","department":"Engineering","active":true,"permissions":["read","write","delete"]}));
  } else if (mode === 5) {
    // About/Info screen
    showScreen(2);
  }
}

if (SCREENSHOT_MODE > 0) {
  setupScreenshotMode(SCREENSHOT_MODE);
} else {
  restoreLastSession();
}
trackAppLaunch();

// --- Launch ---
const appBody = VStack(0, [connectionScreen, browserScreen, infoScreen]);
widgetSetBackgroundColor(appBody, bgR, bgG, bgB, 1.0);

// Force screens to fill full window
widgetMatchParentWidth(connectionScreen);
widgetMatchParentWidth(browserScreen);
widgetMatchParentWidth(infoScreen);
// On Android, LinearLayout needs explicit MATCH_PARENT height (UIStackView Fill handles this on Apple)
if (mobile) {
  widgetMatchParentHeight(connectionScreen);
  widgetMatchParentHeight(browserScreen);
  widgetMatchParentHeight(infoScreen);
}
// Pin HStack to browserScreen's full width so sidebar+body stretch
widgetMatchParentWidth(browserContent);
widgetMatchParentWidth(toolbarBox);
// Pin browserBody children to fill width
widgetMatchParentWidth(queryCard);
widgetMatchParentWidth(docsScroll);

// --- Menu bar (macOS/Linux/Windows) ---
if (!mobile) {
  const appMenu = menuCreate();
  menuAddItem(appMenu, 'About Mango', () => { aboutWindow.show(); });

  const menuBar = menuBarCreate();
  menuBarAddMenu(menuBar, 'Mango', appMenu);

  // macOS requires Edit menu for CMD+A/C/V/X to reach NSTextField.
  // GTK4 (Linux) and Win32 (Windows) handle Ctrl+C/V/A natively.
  if (__platform__ === 0) {
    const editMenu = menuCreate();
    menuAddStandardAction(editMenu, 'Undo', 'undo:', 'z');
    menuAddStandardAction(editMenu, 'Redo', 'redo:', 'Cmd+Shift+z');
    menuAddSeparator(editMenu);
    menuAddStandardAction(editMenu, 'Cut', 'cut:', 'x');
    menuAddStandardAction(editMenu, 'Copy', 'copy:', 'c');
    menuAddStandardAction(editMenu, 'Paste', 'paste:', 'v');
    menuAddStandardAction(editMenu, 'Select All', 'selectAll:', 'a');
    menuBarAddMenu(menuBar, 'Edit', editMenu);
  }

  menuBarAttach(menuBar);
}

App({
  title: 'Mango',
  width: 1100,
  height: 750,
  icon: 'assets/mango-app-icon-512.png',
  body: appBody,
});
