import {
  App, VStack, HStack, Text, Button, Spacer, Divider,
  TextField, ScrollView,
  textSetFontSize, textSetFontWeight, textSetColor, textSetString,
  textSetFontFamily,
  buttonSetBordered, buttonSetTextColor,
  widgetAddChild, widgetClearChildren, widgetSetHidden,
  widgetSetBackgroundColor,
  setCornerRadius, setPadding,
  scrollviewSetChild,
  textfieldSetString, textfieldGetString,
} from 'perry/ui';
import { isDarkMode } from 'perry/system';
import { MongoClient } from 'mongodb';

// --- Theme ---
const dark = isDarkMode();

// Backgrounds
const bgR = dark ? 0.137 : 0.949;
const bgG = dark ? 0.145 : 0.949;
const bgB = dark ? 0.208 : 0.957;

const sfR = dark ? 0.192 : 1.0;
const sfG = dark ? 0.200 : 1.0;
const sfB = dark ? 0.278 : 1.0;

// Sidebar / toolbar bg
const tbR = dark ? 0.161 : 0.937;
const tbG = dark ? 0.169 : 0.937;
const tbB = dark ? 0.239 : 0.945;

// Text
const txR = dark ? 0.910 : 0.133;
const txG = dark ? 0.914 : 0.137;
const txB = dark ? 0.929 : 0.192;

const tsR = dark ? 0.553 : 0.420;
const tsG = dark ? 0.600 : 0.443;
const tsB = dark ? 0.682 : 0.506;

const tmR = dark ? 0.420 : 0.553;
const tmG = dark ? 0.443 : 0.600;
const tmB = dark ? 0.506 : 0.682;

// Mango orange
const moR = 1.0;
const moG = 0.624;
const moB = 0.110;

// Orange hover / light accent bg
const oaBgR = dark ? 0.25 : 1.0;
const oaBgG = dark ? 0.20 : 0.953;
const oaBgB = dark ? 0.10 : 0.890;

// Error red
const erR = 0.910;
const erG = 0.341;
const erB = 0.165;

// Success green
const sgR = 0.180;
const sgG = 0.769;
const sgB = 0.714;

// Border
const brR = dark ? 0.255 : 0.890;
const brG = dark ? 0.263 : 0.894;
const brB = dark ? 0.353 : 0.910;

// Monospace font
const monoFont = 'Menlo';

// --- State ---
let connectionNames: string[] = [];
let connectionHosts: string[] = [];
let connectionPorts: string[] = [];
let connectionUris: string[] = [];

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
  if (bold) textSetFontWeight(t, size, 0.5);
  textSetColor(t, txR, txG, txB, 1.0);
  return t;
}

function makeMuted(text: string, size: number): any {
  const t = Text(text);
  textSetFontSize(t, size);
  textSetColor(t, tmR, tmG, tmB, 1.0);
  return t;
}

function makeSecondary(text: string, size: number): any {
  const t = Text(text);
  textSetFontSize(t, size);
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
    // Empty state
    const emptyCard = VStack(8, []);
    widgetSetBackgroundColor(emptyCard, sfR, sfG, sfB, 1.0);
    setCornerRadius(emptyCard, 12);
    setPadding(emptyCard, 32, 24, 32, 24);

    const emptyIcon = Text('No connections yet');
    textSetFontSize(emptyIcon, 16);
    textSetFontWeight(emptyIcon, 16, 0.5);
    textSetColor(emptyIcon, txR, txG, txB, 1.0);

    const emptyHint = Text('Click "+ New Connection" to add your first MongoDB server.');
    textSetFontSize(emptyHint, 13);
    textSetColor(emptyHint, tmR, tmG, tmB, 1.0);

    widgetAddChild(emptyCard, emptyIcon);
    widgetAddChild(emptyCard, emptyHint);
    widgetAddChild(connListContainer, emptyCard);
    return;
  }

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

    const deleteBtn = makeDangerBtn('Remove', () => {
      const newNames: string[] = [];
      const newHosts: string[] = [];
      const newPorts: string[] = [];
      const newUris: string[] = [];
      for (let j = 0; j < connectionNames.length; j++) {
        if (j !== connIdx) {
          newNames.push(connectionNames[j]);
          newHosts.push(connectionHosts[j]);
          newPorts.push(connectionPorts[j]);
          newUris.push(connectionUris[j]);
        }
      }
      connectionNames = newNames;
      connectionHosts = newHosts;
      connectionPorts = newPorts;
      connectionUris = newUris;
      refreshConnectionList();
    });

    const row = HStack(12, [accentBar, info, Spacer(), deleteBtn, connectBtn]);
    const card = VStack(0, [row]);
    widgetSetBackgroundColor(card, sfR, sfG, sfB, 1.0);
    setCornerRadius(card, 10);
    setPadding(card, 12, 16, 12, 16);

    widgetAddChild(connListContainer, card);
  }
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
    connectionNames.push(formName || 'Untitled');
    connectionHosts.push(formHost);
    connectionPorts.push(formPort);
    connectionUris.push(formUri);
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
}

// Build connection screen
refreshConnectionList();

const connScroll = ScrollView();
const connScrollInner = VStack(10, [connListContainer, formContainer]);
scrollviewSetChild(connScroll, connScrollInner);

const addBtn = Button('+ New Connection', () => { showConnectionForm(); });

const connTitle = Text('Mango');
textSetFontSize(connTitle, 28);
textSetFontWeight(connTitle, 28, 0.7);
textSetColor(connTitle, moR, moG, moB, 1.0);

const connSubtitle = makeSecondary('MongoDB GUI', 13);

const connectionScreen = VStack(0, [
  // Header
  VStack(16, [
    HStack(8, [VStack(2, [connTitle, connSubtitle]), Spacer(), addBtn]),
    statusText,
  ]),
  Divider(),
  connScroll,
]);
setPadding(connectionScreen, 24, 32, 24, 32);
widgetSetBackgroundColor(connectionScreen, bgR, bgG, bgB, 1.0);

// ============================================================
//  BROWSER SCREEN
// ============================================================

const docsContainer = VStack(8, []);
const docsScroll = ScrollView();
scrollviewSetChild(docsScroll, docsContainer);

// Initial placeholder
const docInfoText = makeMuted('Enter a database and collection, then run a query.', 13);
widgetAddChild(docsContainer, docInfoText);

// --- Toolbar ---
const connLabel = Text('Connected');
textSetFontSize(connLabel, 11);
textSetFontWeight(connLabel, 11, 0.5);
textSetColor(connLabel, sgR, sgG, sgB, 1.0);

const connDot = Text('  ');
textSetFontSize(connDot, 11);
textSetColor(connDot, sgR, sgG, sgB, 1.0);

const disconnectBtn = makeDangerBtn('Disconnect', async () => {
  if (mongoClient) {
    try { await mongoClient.close(); } catch (e: any) {}
    mongoClient = null;
  }
  showScreen(0);
});

const browserTitle = Text('Mango');
textSetFontSize(browserTitle, 20);
textSetFontWeight(browserTitle, 20, 0.7);
textSetColor(browserTitle, moR, moG, moB, 1.0);

// --- Query bar ---
const dbField = TextField('database', (val: string) => { currentDbName = val; });
const collField = TextField('collection', (val: string) => { currentCollName = val; });
const filterField = TextField('filter: {}', (val: string) => { currentFilter = val || '{}'; });

// Context breadcrumb
const breadcrumb = Text('');
textSetFontSize(breadcrumb, 12);
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

// Query bar elements (placed directly in browser VStack for full-width fields)

// --- Browser screen layout ---
const toolbarRow = HStack(8, [browserTitle, Spacer(), connDot, connLabel, disconnectBtn]);

const browserScreen = VStack(8, [
  toolbarRow,
  Divider(),
  makeSecondary('Database', 10),
  dbField,
  makeSecondary('Collection', 10),
  collField,
  makeSecondary('Filter', 10),
  filterField,
  HStack(8, [breadcrumb, Spacer(), queryBtn]),
  Divider(),
  docsScroll,
]);
setPadding(browserScreen, 16, 24, 16, 24);
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
App({
  title: 'Mango',
  width: 1100,
  height: 750,
  body: VStack(0, [connectionScreen, browserScreen]),
});
