// format-operands coverage. Three operands, each round-tripped
// through runQuery so the bind reaches the runtime correctly and
// every per-site error site fires through real eval.

import { describe, it, expect } from 'vitest';
import { runQuery } from '../src/run.mjs';

const noopIo = {
  stdinReader: () => Promise.resolve(''),
  stdoutWrite: () => {},
  stderrWrite: () => {}
};

function thrownClassName(errorValue) {
  const descriptor = errorValue.descriptor;
  return [...descriptor].find(([k]) => k.name === 'thrown')[1].name;
}

describe('pretty', () => {
  it('renders a number as its qlang literal form', async () => {
    const cellEntry = await runQuery('42 | pretty', noopIo);
    expect(cellEntry.result).toBe('42');
  });

  it('renders a String quoted as a qlang String literal', async () => {
    const cellEntry = await runQuery('"hello" | pretty', noopIo);
    expect(cellEntry.result).toBe('"hello"');
  });

  it('renders a Vec as the literal `[1 2 3]`', async () => {
    const cellEntry = await runQuery('[1 2 3] | pretty', noopIo);
    expect(cellEntry.result).toBe('[1 2 3]');
  });

  it('renders a keyword with the leading colon', async () => {
    const cellEntry = await runQuery(':active | pretty', noopIo);
    expect(cellEntry.result).toBe(':active');
  });
});

describe('tjson', () => {
  it('renders a number as its plain JSON form', async () => {
    const cellEntry = await runQuery('42 | tjson', noopIo);
    expect(cellEntry.result).toBe('42');
  });

  it('renders a keyword as the $keyword tagged form', async () => {
    const cellEntry = await runQuery(':role | tjson', noopIo);
    expect(cellEntry.result).toBe('{"$keyword":"role"}');
  });

  it('renders a Set as the $set tagged form', async () => {
    const cellEntry = await runQuery('#{:a :b} | tjson', noopIo);
    expect(cellEntry.result).toBe('{"$set":[{"$keyword":"a"},{"$keyword":"b"}]}');
  });

  it('renders a Map with keyword keys as the $map tagged form', async () => {
    const cellEntry = await runQuery('{:role :admin} | tjson', noopIo);
    expect(cellEntry.result).toBe('{"$map":[[{"$keyword":"role"},{"$keyword":"admin"}]]}');
  });
});

describe('template — `{{.}}` whole-subject substitution', () => {
  it('embeds a String subject as raw characters without surrounding quotes', async () => {
    const cellEntry = await runQuery('"alice" | template("user: {{.}}")', noopIo);
    expect(cellEntry.result).toBe('user: alice');
  });

  it('renders a non-String subject via printValue', async () => {
    const cellEntry = await runQuery('42 | template("count: {{.}}")', noopIo);
    expect(cellEntry.result).toBe('count: 42');
  });
});

describe('template — `{{key}}` Map projection', () => {
  it('projects a single keyword field from a Map subject', async () => {
    const cellEntry = await runQuery(
      '{:name "alice"} | template("got {{name}}")', noopIo);
    expect(cellEntry.result).toBe('got alice');
  });

  it('chains nested projections via slash separators', async () => {
    const cellEntry = await runQuery(
      '{:user {:name "alice"}} | template("name={{user/name}}")', noopIo);
    expect(cellEntry.result).toBe('name=alice');
  });

  it('renders a missing field as null', async () => {
    const cellEntry = await runQuery(
      '{:name "alice"} | template("age={{age}}")', noopIo);
    expect(cellEntry.result).toBe('age=null');
  });

  it('renders null when a projection segment hits a non-Map value', async () => {
    const cellEntry = await runQuery(
      '"plain" | template("x={{any/thing}}")', noopIo);
    expect(cellEntry.result).toBe('x=null');
  });

  it('renders a non-String projected value via printValue', async () => {
    const cellEntry = await runQuery(
      '{:n 42} | template("count={{n}}")', noopIo);
    expect(cellEntry.result).toBe('count=42');
  });
});

describe('template — error sites', () => {
  it('lifts TemplateModifierNotString when the captured arg is not a String', async () => {
    const cellEntry = await runQuery('"x" | template(42)', noopIo);
    expect(thrownClassName(cellEntry.result)).toBe('TemplateModifierNotString');
  });
});
