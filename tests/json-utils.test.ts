import { describe, test, expect } from 'bun:test';
import { prettyPrintJson, extractIdShort, extractFields, processDocForDisplay } from '../src/data/json-utils';

describe('prettyPrintJson', () => {
  test('empty object', () => {
    const result = prettyPrintJson('{}');
    expect(result).toContain('{');
    expect(result).toContain('}');
  });

  test('simple object', () => {
    const result = prettyPrintJson('{"a":1}');
    expect(result).toContain('"a": 1');
  });

  test('nested objects indent correctly', () => {
    const result = prettyPrintJson('{"a":{"b":2}}');
    expect(result).toContain('  "a": ');
    expect(result).toContain('    "b": 2');
  });

  test('strings with special characters preserved', () => {
    const result = prettyPrintJson('{"key":"value:with{braces}"}');
    expect(result).toContain('"key": "value:with{braces}"');
  });

  test('arrays', () => {
    const result = prettyPrintJson('{"arr":[1,2,3]}');
    expect(result).toContain('"arr": ');
    expect(result).toContain('1');
    expect(result).toContain('2');
    expect(result).toContain('3');
  });
});

describe('extractIdShort', () => {
  test('ObjectId format returns shortened id', () => {
    const json = '{"_id":{"$oid":"507f1f77bcf86cd799439011"},"name":"test"}';
    const result = extractIdShort(json);
    expect(result).toBe('507f1f...9011');
  });

  test('short ObjectId returns full value', () => {
    const json = '{"_id":{"$oid":"abc123"},"name":"test"}';
    const result = extractIdShort(json);
    expect(result).toBe('abc123');
  });

  test('simple string _id', () => {
    const json = '{"_id":"myid","name":"test"}';
    const result = extractIdShort(json);
    expect(result).toBe('myid');
  });

  test('missing _id returns ?', () => {
    const json = '{"name":"test"}';
    const result = extractIdShort(json);
    expect(result).toBe('?');
  });
});

describe('extractFields', () => {
  test('string values', () => {
    const fields = extractFields('{"name":"Alice","city":"NYC"}');
    expect(fields).toEqual([['name', 'Alice'], ['city', 'NYC']]);
  });

  test('number values', () => {
    const fields = extractFields('{"age":30,"score":99.5}');
    expect(fields.length).toBe(2);
    expect(fields[0][0]).toBe('age');
    expect(fields[0][1]).toBe('30');
  });

  test('boolean and null', () => {
    const fields = extractFields('{"active":true,"deleted":null}');
    expect(fields.length).toBe(2);
    expect(fields[0][1]).toBe('true');
    expect(fields[1][1]).toBe('null');
  });

  test('nested object as substring', () => {
    const fields = extractFields('{"meta":{"k":"v"}}');
    expect(fields.length).toBe(1);
    expect(fields[0][0]).toBe('meta');
    expect(fields[0][1]).toBe('{"k":"v"}');
  });

  test('array as substring', () => {
    const fields = extractFields('{"tags":["a","b"]}');
    expect(fields.length).toBe(1);
    expect(fields[0][0]).toBe('tags');
    expect(fields[0][1]).toBe('["a","b"]');
  });

  test('escaped quotes in string values', () => {
    const fields = extractFields('{"msg":"say \\"hello\\""}');
    expect(fields.length).toBe(1);
    expect(fields[0][0]).toBe('msg');
    expect(fields[0][1]).toContain('hello');
  });

  test('empty object', () => {
    const fields = extractFields('{}');
    expect(fields).toEqual([]);
  });
});

describe('processDocForDisplay', () => {
  test('returns json, id, and fields', () => {
    const doc = { _id: { $oid: '507f1f77bcf86cd799439011' }, name: 'test', age: 25 };
    const result = processDocForDisplay(doc);
    expect(result.json).toBe(JSON.stringify(doc));
    expect(result.id).toBe('507f1f...9011');
    expect(result.fields.length).toBeGreaterThan(0);
  });

  test('fields contain all top-level keys', () => {
    const doc = { _id: 'x', a: 1, b: 'two' };
    const result = processDocForDisplay(doc);
    const keys = result.fields.map((f: string[]) => f[0]);
    expect(keys).toContain('_id');
    expect(keys).toContain('a');
    expect(keys).toContain('b');
  });
});
