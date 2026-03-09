import {
  App, VStack, HStack, Text, Button, Spacer, Divider,
  TextField, ScrollView, ImageFile,
  textSetFontSize, textSetFontWeight, textSetColor, textSetString,
  textSetFontFamily,
  buttonSetBordered, buttonSetTextColor,
  widgetAddChild, widgetClearChildren, widgetSetHidden,
  widgetSetBackgroundColor, widgetSetBackgroundGradient,
  widgetMatchParentWidth, widgetSetHugging, widgetSetHeight, widgetSetWidth,
  stackSetDistribution, stackSetAlignment,
  setCornerRadius, setPadding,
  scrollviewSetChild,
  textfieldSetString, textfieldGetString,
} from 'perry/ui';
import { isDarkMode, keychainSave, keychainGet, keychainDelete } from 'perry/system';
import { MongoClient } from 'mongodb';
import { getAllConnections, createConnection, deleteConnection } from './data/connection-store';

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

// Monospace font
const monoFont = 'Menlo';

// UI font — Rubik matches the brand, SF Pro Display as fallback
const uiFont = 'Rubik';

// --- State ---
let connectionIds: string[] = [];
let connectionNames: string[] = [];
let connectionHosts: string[] = [];
let connectionPorts: string[] = [];
let connectionUris: string[] = [];

// Load saved connections from SQLite + Keychain
function loadConnections(): void {
  const profiles = getAllConnections();
  connectionIds = [];
  connectionNames = [];
  connectionHosts = [];
  connectionPorts = [];
  connectionUris = [];
  for (let i = 0; i < profiles.length; i++) {
    const p: any = profiles[i];
    connectionIds.push(p.id);
    connectionNames.push(p.name);
    connectionHosts.push(p.host);
    connectionPorts.push(String(p.port));
    // Connection URI stored securely in Keychain
    const uri = keychainGet('mango-conn-' + p.id);
    connectionUris.push(typeof uri === 'string' ? uri : '');
  }
}
loadConnections();

let formName = '';
let formHost = 'localhost';
let formPort = '27017';
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

// --- Helpers ---

// Make a styled label
function makeLabel(text: string, size: number, bold: boolean): any {
  const t = Text(text);
  textSetFontSize(t, size);
  textSetFontFamily(t, uiFont);
  if (bold) textSetFontWeight(t, size, 0.5);
  textSetColor(t, txR, txG, txB, 1.0);
  return t;
}

function makeMuted(text: string, size: number): any {
  const t = Text(text);
  textSetFontSize(t, size);
  textSetFontFamily(t, uiFont);
  textSetColor(t, tmR, tmG, tmB, 1.0);
  return t;
}

function makeSecondary(text: string, size: number): any {
  const t = Text(text);
  textSetFontSize(t, size);
  textSetFontFamily(t, uiFont);
  textSetColor(t, tsR, tsG, tsB, 1.0);
  return t;
}

function makeMono(text: string, size: number): any {
  const t = Text(text);
  textSetFontSize(t, size);
  textSetFontFamily(t, monoFont);
  textSetColor(t, txR, txG, txB, 1.0);
  return t;
}

function makeMonoMuted(text: string, size: number): any {
  const t = Text(text);
  textSetFontSize(t, size);
  textSetFontFamily(t, monoFont);
  textSetColor(t, tmR, tmG, tmB, 1.0);
  return t;
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

// Extract a short display _id from a doc JSON string
function extractIdShort(docJson: string): string {
  const idKey = '"$oid":"';
  const oidStart = docJson.indexOf(idKey);
  if (oidStart >= 0) {
    const valStart = oidStart + idKey.length;
    const valEnd = docJson.indexOf('"', valStart);
    if (valEnd > 0) {
      const full = docJson.substring(valStart, valEnd);
      // Show first 4 and last 4 chars
      if (full.length > 10) {
        return full.substring(0, 6) + '...' + full.substring(full.length - 4);
      }
      return full;
    }
  }
  // Fallback: try simple string _id
  const simpleKey = '"_id":"';
  const simpleStart = docJson.indexOf(simpleKey);
  if (simpleStart >= 0) {
    const valStart = simpleStart + simpleKey.length;
    const valEnd = docJson.indexOf('"', valStart);
    if (valEnd > 0) return docJson.substring(valStart, valEnd);
  }
  return '?';
}

// Extract top-level fields from JSON string for display
// Returns array of [key, value] pairs (both as strings)
function extractFields(docJson: string): string[][] {
  const fields: string[][] = [];
  let i = 1; // skip opening {
  while (i < docJson.length) {
    // Skip whitespace
    while (i < docJson.length && (docJson[i] === ' ' || docJson[i] === ',')) i = i + 1;
    if (docJson[i] === '}' || i >= docJson.length) break;

    // Read key (expect "key":)
    if (docJson[i] !== '"') break;
    const keyStart = i + 1;
    i = i + 1;
    while (i < docJson.length && docJson[i] !== '"') i = i + 1;
    const key = docJson.substring(keyStart, i);
    i = i + 1; // skip closing "
    if (docJson[i] === ':') i = i + 1; // skip :

    // Read value
    let value = '';
    if (docJson[i] === '"') {
      // String value
      const valStart = i + 1;
      i = i + 1;
      while (i < docJson.length && docJson[i] !== '"') {
        if (docJson[i] === '\\') i = i + 1; // skip escaped char
        i = i + 1;
      }
      value = docJson.substring(valStart, i);
      i = i + 1; // skip closing "
    } else if (docJson[i] === '{') {
      // Object value — find matching }
      const valStart = i;
      let depth = 0;
      while (i < docJson.length) {
        if (docJson[i] === '{') depth = depth + 1;
        if (docJson[i] === '}') depth = depth - 1;
        i = i + 1;
        if (depth === 0) break;
      }
      value = docJson.substring(valStart, i);
    } else if (docJson[i] === '[') {
      // Array value — find matching ]
      const valStart = i;
      let depth = 0;
      while (i < docJson.length) {
        if (docJson[i] === '[') depth = depth + 1;
        if (docJson[i] === ']') depth = depth - 1;
        i = i + 1;
        if (depth === 0) break;
      }
      value = docJson.substring(valStart, i);
    } else {
      // Number, bool, null
      const valStart = i;
      while (i < docJson.length && docJson[i] !== ',' && docJson[i] !== '}') i = i + 1;
      value = docJson.substring(valStart, i);
    }

    fields.push([key, value]);
  }
  return fields;
}

// --- MongoDB ---
async function connectToMongo(uri: string): Promise<boolean> {
  try {
    mongoClient = await MongoClient.connect(uri);
    currentConnUri = uri;
    return true;
  } catch (e: any) {
    return false;
  }
}

async function queryCollection(dbName: string, collName: string, filter: string): Promise<string> {
  if (!mongoClient) return '{"error":"not connected"}';
  try {
    const db = mongoClient.db(dbName);
    const coll = db.collection(collName);
    const docs = await coll.find(filter || '{}');
    if (typeof docs === 'string') return docs;
    return JSON.stringify(docs);
  } catch (e: any) {
    return '{"error":"' + (e.message || 'query failed') + '"}';
  }
}

async function updateDocument(dbName: string, collName: string, filter: string, update: string): Promise<number> {
  if (!mongoClient) return 0;
  const db = mongoClient.db(dbName);
  const coll = db.collection(collName);
  return await coll.updateOne(filter, update);
}

async function deleteDocument(dbName: string, collName: string, filter: string): Promise<number> {
  if (!mongoClient) return 0;
  const db = mongoClient.db(dbName);
  const coll = db.collection(collName);
  return await coll.deleteOne(filter);
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
    valueEnd = docJson.indexOf('"', valueStart + 1) + 1;
  } else {
    for (let i = valueStart; i < docJson.length; i++) {
      if (docJson[i] === ',' || docJson[i] === '}') { valueEnd = i; break; }
    }
  }
  let before = docJson.substring(0, idStart);
  let after = docJson.substring(valueEnd);
  if (after[0] === ',') after = after.substring(1);
  else if (before[before.length - 1] === ',') before = before.substring(0, before.length - 1);
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
    setPadding(welcomeCard, 32, 36, 28, 36);

    const welcomeTitle = Text('Welcome to Mango');
    textSetFontSize(welcomeTitle, 24);
    textSetFontFamily(welcomeTitle, uiFont);
    textSetFontWeight(welcomeTitle, 24, 0.5);
    textSetColor(welcomeTitle, txR, txG, txB, 1.0);

    const welcomeHint = Text('Connect to your MongoDB instance to browse databases, query collections, and manage documents.');
    textSetFontSize(welcomeHint, 14);
    textSetFontFamily(welcomeHint, uiFont);
    textSetColor(welcomeHint, tmR, tmG, tmB, 1.0);

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

    const pillRow1 = HStack(8, [makePill('Databases & Collections'), makePill('Query & Filter')]);
    const pillRow2 = HStack(8, [makePill('Edit & Insert'), makePill('Index Viewer')]);
    const pillGrid = VStack(8, [pillRow1, pillRow2]);

    const ctaBtn = Button('+ New Connection', () => { showConnectionForm(); });
    buttonSetTextColor(ctaBtn, 1.0, 1.0, 1.0, 1.0);
    widgetSetBackgroundColor(ctaBtn, moR, moG, moB, 1.0);
    setCornerRadius(ctaBtn, 8);
    setPadding(ctaBtn, 10, 20, 10, 20);

    widgetAddChild(welcomeCard, welcomeTitle);
    widgetAddChild(welcomeCard, welcomeHint);
    widgetAddChild(welcomeCard, pillGrid);
    widgetAddChild(welcomeCard, ctaBtn);

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

    const nameText = makeLabel(connectionNames[i] || 'Untitled', 15, true);

    const hostPort = connectionUris[i] || `${connectionHosts[i]}:${connectionPorts[i]}`;
    const detailText = makeMonoMuted(hostPort, 11);

    const info = VStack(3, [nameText, detailText]);

    const connectBtn = Button('Connect', async () => {
      const uri = connectionUris[connIdx] || `mongodb://${connectionHosts[connIdx]}:${connectionPorts[connIdx]}`;
      showStatus('Connecting...', false);
      const ok = await connectToMongo(uri);
      if (ok) {
        currentConnName = connectionNames[connIdx] || 'Server';
        textSetString(connLabel, currentConnName);
        showScreen(1);
      } else {
        showStatus('Connection failed', true);
      }
    });

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

    const deleteBtn = makeDangerBtn('Remove', () => {
      textSetString(confirmLabel, 'Remove this connection?');
      widgetSetHidden(confirmLabel, 0);
      widgetSetHidden(confirmYes, 0);
      widgetSetHidden(confirmNo, 0);
    });

    const row = HStack(12, [accentBar, info, Spacer(), confirmLabel, confirmYes, confirmNo, deleteBtn, connectBtn]);
    const card = VStack(0, [row]);
    widgetSetBackgroundColor(card, sfR, sfG, sfB, 1.0);
    setCornerRadius(card, 10);
    setPadding(card, 12, 16, 12, 16);

    widgetAddChild(connListContainer, card);
    widgetMatchParentWidth(card);
  }

  // Add new connection button
  const addMoreBtn = Button('+ New Connection', () => { showConnectionForm(); });
  buttonSetTextColor(addMoreBtn, moR, moG, moB, 1.0);
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

  const nameLabel = makeSecondary('Name', 11);
  const nameField = TextField('e.g. Production, Local dev...', (val: string) => { formName = val; });

  const hostLabel = makeSecondary('Host', 11);
  const hostField = TextField('localhost', (val: string) => { formHost = val || 'localhost'; });

  const portLabel = makeSecondary('Port', 11);
  const portField = TextField('27017', (val: string) => { formPort = val || '27017'; });

  const divLabel = makeMuted('or connect via URI', 11);

  const uriLabel = makeSecondary('Connection String', 11);
  const uriField = TextField('mongodb://user:pass@host:port/db', (val: string) => { formUri = val; });

  const saveBtn = Button('Save Connection', () => {
    const name = formName || 'Untitled';
    const host = formHost;
    createConnection({ name: name, host: host });
    loadConnections();
    formName = '';
    formHost = 'localhost';
    formPort = '27017';
    formUri = '';
    widgetSetHidden(formContainer, 1);
    widgetSetHidden(connListContainer, 0);
    refreshConnectionList();
  });

  const cancelBtn = makeGhostBtn('Cancel', () => {
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
const heroLogo = ImageFile('logo/mango-app-icon-128.png');
widgetSetWidth(heroLogo, 56);
widgetSetHeight(heroLogo, 56);

const heroTitle = Text('Mango');
textSetFontSize(heroTitle, 38);
textSetFontFamily(heroTitle, uiFont);
textSetFontWeight(heroTitle, 38, 0.7);
textSetColor(heroTitle, 1.0, 1.0, 1.0, 1.0);

const heroSubtitle = Text('MongoDB, finally fast.');
textSetFontSize(heroSubtitle, 16);
textSetFontFamily(heroSubtitle, uiFont);
textSetColor(heroSubtitle, 1.0, 1.0, 1.0, 0.85);

const heroBox = VStack(8, [
  HStack(14, [heroLogo, heroTitle]),
  heroSubtitle,
]);
widgetSetBackgroundGradient(heroBox, moR, moG, moB, 1.0, myR, myG, myB, 1.0, 1);
setPadding(heroBox, 44, 380, 36, 380); // symmetric padding centers ~340px content in 1100px window

// --- Body content below hero ---
const connBody = VStack(16, [
  statusText,
  connListContainer,
  formContainer,
]);
setPadding(connBody, 28, 60, 32, 60);

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
setPadding(docsContainer, 4, 0, 16, 0);
const docsScroll = ScrollView();
scrollviewSetChild(docsScroll, docsContainer);

// Initial placeholder
const docInfoText = makeMuted('Enter a database and collection, then run a query.', 13);
widgetAddChild(docsContainer, docInfoText);

// --- Toolbar ---
const connLabel = Text('Connected');
textSetFontSize(connLabel, 11);
textSetFontFamily(connLabel, uiFont);
textSetFontWeight(connLabel, 11, 0.5);
textSetColor(connLabel, sgR, sgG, sgB, 1.0);

const disconnectBtn = makeDangerBtn('Disconnect', async () => {
  if (mongoClient) {
    try { await mongoClient.close(); } catch (e: any) {}
    mongoClient = null;
  }
  showScreen(0);
});

// Browser toolbar — logo + connection name + status
const browserLogo = ImageFile('logo/mango-app-icon-128.png');
widgetSetWidth(browserLogo, 24);
widgetSetHeight(browserLogo, 24);

const browserTitle = Text('Mango');
textSetFontSize(browserTitle, 18);
textSetFontFamily(browserTitle, uiFont);
textSetFontWeight(browserTitle, 18, 0.7);
textSetColor(browserTitle, moR, moG, moB, 1.0);

// --- Query bar ---
const dbField = TextField('database', (val: string) => { currentDbName = val; });
const collField = TextField('collection', (val: string) => { currentCollName = val; });
const filterField = TextField('filter: {}', (val: string) => { currentFilter = val || '{}'; });

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
    widgetAddChild(docsContainer, makeMuted('Not connected to MongoDB.', 13));
    return;
  }
  if (!dbName || !collName) {
    widgetAddChild(docsContainer, makeMuted('Enter both database and collection names.', 13));
    return;
  }

  activeDbName = dbName;
  activeCollName = collName;
  lastQueryFilter = filter;

  textSetString(breadcrumb, dbName + '.' + collName);
  widgetSetHidden(breadcrumb, 0);

  widgetAddChild(docsContainer, makeMuted('Querying...', 13));

  const result = await queryCollection(dbName, collName, filter);
  displayDocs(result);
}

const queryBtn = Button('Run Query', async () => {
  await runQuery(currentDbName, currentCollName, currentFilter);
});

// --- Edit view ---
function showEditView(docJson: string): void {
  widgetClearChildren(docsContainer);

  const idFilter = extractIdFilter(docJson);
  const editableJson = removeIdFromJson(docJson);
  const idShort = extractIdShort(docJson);

  // Header
  const editHeader = HStack(8, [
    makeLabel('Edit Document', 16, true),
    Spacer(),
    makeMonoMuted(idShort, 11),
  ]);

  const editCard = VStack(10, []);
  widgetSetBackgroundColor(editCard, sfR, sfG, sfB, 1.0);
  setCornerRadius(editCard, 10);
  setPadding(editCard, 16, 20, 16, 20);

  const fieldLabel = makeSecondary('Document JSON (without _id)', 11);

  const editField = TextField('{ ... }', (val: string) => { editDocJson = val; });
  textfieldSetString(editField, editableJson);
  editDocJson = editableJson;

  const saveBtn = Button('Save Changes', async () => {
    const currentJson = textfieldGetString(editField);
    const updateStr = '{"$set":' + currentJson + '}';
    await updateDocument(activeDbName, activeCollName, idFilter, updateStr);
    const result = await queryCollection(activeDbName, activeCollName, lastQueryFilter);
    displayDocs(result);
  });

  const deleteBtn = makeDangerBtn('Delete Document', async () => {
    const deleted = await deleteDocument(activeDbName, activeCollName, idFilter);
    if (deleted > 0) {
      showStatus('Document deleted', false);
    } else {
      showStatus('Delete failed', true);
    }
    const result = await queryCollection(activeDbName, activeCollName, lastQueryFilter);
    displayDocs(result);
  });

  const backBtn = makeGhostBtn('Back to results', async () => {
    const result = await queryCollection(activeDbName, activeCollName, lastQueryFilter);
    displayDocs(result);
  });

  widgetAddChild(editCard, editHeader);
  widgetAddChild(editCard, Divider());
  widgetAddChild(editCard, fieldLabel);
  widgetAddChild(editCard, editField);
  widgetAddChild(editCard, HStack(8, [deleteBtn, Spacer(), backBtn, saveBtn]));

  widgetAddChild(docsContainer, editCard);
}

// --- Document list ---
function displayDocs(jsonStr: string): void {
  widgetClearChildren(docsContainer);
  let docArray: any[] = [];
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.error) {
      const errCard = makeCard([makeMuted('Error: ' + parsed.error, 13)], 4);
      widgetAddChild(docsContainer, errCard);
      return;
    }
    docArray = parsed;
  } catch (e: any) {
    widgetAddChild(docsContainer, makeCard([makeMuted('Failed to parse response', 13)], 4));
    return;
  }

  // Results header
  const countLabel = Text(`${docArray.length} document${docArray.length === 1 ? '' : 's'}`);
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
    const emptyCard = makeCard([makeMuted('No documents match the query.', 13)], 4);
    widgetAddChild(docsContainer, emptyCard);
    return;
  }

  // Document cards
  for (let i = 0; i < docArray.length; i++) {
    const doc = docArray[i];
    const docJsonStr = JSON.stringify(doc);
    const idShort = extractIdShort(docJsonStr);
    const fields = extractFields(docJsonStr);

    const card = VStack(0, []);
    widgetSetBackgroundColor(card, sfR, sfG, sfB, 1.0);
    setCornerRadius(card, 10);
    setPadding(card, 12, 16, 12, 16);

    // Header: _id + edit button
    const idLabel = makeMonoMuted(idShort, 10);

    const editBtn = Button('Edit', () => { showEditView(docJsonStr); });
    buttonSetBordered(editBtn, 0);
    buttonSetTextColor(editBtn, moR, moG, moB, 1.0);

    const docHeader = HStack(6, [idLabel, Spacer(), editBtn]);
    widgetAddChild(card, docHeader);

    // Field rows (skip _id)
    for (let f = 0; f < fields.length; f++) {
      const key = fields[f][0];
      const val = fields[f][1];
      if (key === '_id') continue;

      const keyText = makeSecondary(key, 12);
      const valText = makeMono(val, 12);

      const fieldRow = HStack(8, [keyText, valText]);
      widgetAddChild(card, fieldRow);
    }

    widgetAddChild(docsContainer, card);
  }
}

// --- Browser screen layout ---

// Branded toolbar
const toolbarRow = HStack(10, [browserLogo, browserTitle, Spacer(), connLabel, disconnectBtn]);
const toolbarBox = VStack(0, [toolbarRow]);
setPadding(toolbarBox, 12, 24, 12, 24);
widgetSetBackgroundColor(toolbarBox, sfR, sfG, sfB, 1.0);

// Query card
const queryCard = VStack(8, []);
widgetSetBackgroundColor(queryCard, sfR, sfG, sfB, 1.0);
setCornerRadius(queryCard, 12);
setPadding(queryCard, 16, 20, 16, 20);

const queryTitle = makeLabel('Query', 14, true);

// Inline target: db.collection
const dbColRow = HStack(8, [dbField, makeSecondary('.', 13), collField]);

widgetAddChild(queryCard, queryTitle);
widgetAddChild(queryCard, makeSecondary('Database . Collection', 10));
widgetAddChild(queryCard, dbColRow);
widgetAddChild(queryCard, makeSecondary('Filter', 10));
widgetAddChild(queryCard, filterField);
widgetAddChild(queryCard, HStack(8, [breadcrumb, Spacer(), queryBtn]));

// Main browser body with query + results
const browserBody = VStack(16, [queryCard, docsScroll]);
setPadding(browserBody, 20, 24, 16, 24);

const browserScreen = VStack(0, [
  toolbarBox,
  Divider(),
  browserBody,
]);
widgetSetBackgroundColor(browserScreen, bgR, bgG, bgB, 1.0);
widgetSetHidden(browserScreen, 1);

// --- Screen switching ---
function showScreen(idx: number): void {
  if (idx === 0) {
    widgetSetHidden(connectionScreen, 0);
    widgetSetHidden(browserScreen, 1);
  } else {
    widgetSetHidden(connectionScreen, 1);
    widgetSetHidden(browserScreen, 0);
  }
}

// --- Launch ---
const appBody = VStack(0, [connectionScreen, browserScreen]);
widgetSetBackgroundColor(appBody, bgR, bgG, bgB, 1.0);

// Force screens to fill full window width
widgetMatchParentWidth(connectionScreen);
widgetMatchParentWidth(browserScreen);

App({
  title: 'Mango',
  width: 1100,
  height: 750,
  body: appBody,
});
