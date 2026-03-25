// Pure computation helpers for JSON processing.
// These are safe to call from worker threads (no I/O, no UI, no native modules).

// Manual JSON pretty-printer (Perry's JSON.stringify ignores indent param)
export function prettyPrintJson(json: string): string {
  let out = '';
  let indent = 0;
  let inString = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (inString) {
      out = out + ch;
      if (ch === '"' && json[i - 1] !== '\\') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out = out + ch;
    } else if (ch === '{' || ch === '[') {
      out = out + ch + '\n';
      indent = indent + 2;
      for (let s = 0; s < indent; s++) out = out + ' ';
    } else if (ch === '}' || ch === ']') {
      out = out + '\n';
      indent = indent - 2;
      for (let s = 0; s < indent; s++) out = out + ' ';
      out = out + ch;
    } else if (ch === ',') {
      out = out + ',\n';
      for (let s = 0; s < indent; s++) out = out + ' ';
    } else if (ch === ':') {
      out = out + ': ';
    } else if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t') {
      out = out + ch;
    }
  }
  return out;
}

// Extract a short display _id from a doc JSON string
export function extractIdShort(docJson: string): string {
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
export function extractFields(docJson: string): string[][] {
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

// Pre-process a document for display (used by parallelMap in displayDocs)
export function processDocForDisplay(doc: any): any {
  const json = JSON.stringify(doc);
  const id = extractIdShort(json);
  const fields = extractFields(json);
  return { json, id, fields };
}
