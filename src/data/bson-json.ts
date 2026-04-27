// Extended-JSON serialization/parsing for BSON values.
//
// The UI layer roundtrips documents as JSON strings. Plain JSON.stringify
// would lose type info: ObjectId.toJSON() / Date.toJSON() collapse to
// plain strings with no way to distinguish them from regular strings on
// parse. We walk the value tree manually and emit a relaxed subset of
// MongoDB Extended JSON v2 ($oid, $date) so filters can roundtrip.

import { ObjectId } from '@perryts/mongodb';

export function bsonStringify(value: unknown, indent?: number): string {
  return JSON.stringify(toExtended(value), undefined, indent);
}

export function bsonParse(text: string): any {
  return JSON.parse(text, reviver);
}

function toExtended(value: any): any {
  if (value === null || value === undefined) return value;
  if (value instanceof ObjectId) {
    return { $oid: value.toHexString() };
  }
  if (value instanceof Date) {
    return { $date: value.toISOString() };
  }
  if (Array.isArray(value)) {
    const out: any[] = [];
    for (let i = 0; i < value.length; i++) out.push(toExtended(value[i]));
    return out;
  }
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      out[k] = toExtended(value[k]);
    }
    return out;
  }
  return value;
}

function reviver(_key: string, value: any): any {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const keys = Object.keys(value);
  if (keys.length === 1) {
    if (keys[0] === '$oid' && typeof value.$oid === 'string') {
      return new ObjectId(value.$oid);
    }
    if (keys[0] === '$date' && typeof value.$date === 'string') {
      return new Date(value.$date);
    }
  }
  return value;
}
