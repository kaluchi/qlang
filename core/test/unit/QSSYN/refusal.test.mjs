import { describe, it, expect } from 'vitest';
import { parseSource, SourceParseError } from '../../../src/parse.mjs';
import { refusalOf } from '../../helpers/read-text.mjs';
import { evalQuery } from '../../../src/notebook.mjs';
import { printValue } from '../../../src/print-value.mjs';
import { EXCERPT_CHARACTERS } from '../../../src/elide.mjs';

describe('what a refusal of the parser says', () => {
  it('lists no class of characters among the continuations of a refusal', () => {
    for (const source of ['"\\u12"', '#"a', '#"a")', '(|~~| a', '(|~~| ``a', '[|~~ a', '|~~ ~("[.']) {
      let refusal = null;
      try { parseSource(source); } catch (e) { refusal = e; }
      expect(refusal, source).toBeInstanceOf(SourceParseError);
      expect(refusal.expected.filter(alternative => alternative.type === 'class'), source).toEqual([]);
    }
  });

  it('names the prose of a doc beside the literals it may meet, so a source cut short in its quote names the bracket it left open', () => {
    expect(refusalOf('|~~ mentions |').expected.map(alternative => alternative.text ?? alternative.description))
      .toEqual(expect.arrayContaining(['character of prose', '::', '~(', '`', '|~~|', '|~|', '|~~', '|~', '~|', '~~|']));
    expect(refusalOf('~(|~~ see ::vec~(').message).toBe('`~(` opened at line 1, column 16 is never closed; `)~~|)` completes the source');
  });

  it('says what could stand where the reading stopped as `:expected` names it, and what stood there', () => {
    expect(refusalOf('"a" | :').message).toBe('Expected "\\"" or name but end-of-source found.');
    expect(refusalOf('"\\u12"').message).toBe('Expected hexadecimal digit but "\\"" found.');
    expect(refusalOf('#"a")').message).toBe('Expected end-of-source, flag of a regex or whitespace but ")" found.');
  });

  it('names in the refusal the source its caller named', () => {
    try {
      parseSource('[1 2', { uri: 'cell-7' });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(SourceParseError);
      expect(e.uri).toBe('cell-7');
    }
  });
});

describe('the `:marker` beneath the `:source` of a refusal of a parse', () => {
  const markedOf = async query => {
    const refused = await evalQuery(query);
    return [refused.facts.get('source'), refused.facts.get('marker')];
  };
  const columnsOf = async query => {
    const [source, marker] = (await markedOf(query)).map(text => printValue(text));
    return { source, marker };
  };

  it('puts a caret under the character where the reading stopped and a tilde under each other of its span, spaces to the end of the line', async () => {
    expect(await markedOf('[mul(2) add(1)]')).toEqual(['[mul(2) add(1)]', '    ^~~        ']);
  });

  it('puts one caret past the line where the reading stopped at its end', async () => {
    expect(await markedOf('[1 2')).toEqual(['[1 2', '    ^']);
  });

  it('runs the tildes to the end of the line for a span that runs past it', async () => {
    expect(await markedOf('[1 2 (3 | add 1)\n]')).toEqual(['[1 2 (3 | add 1)', '^~~~~~~~~~~~~~~~']);
  });

  it('counts each character as its print writes it, so the caret stands under an escaped quote in the print', async () => {
    const { source, marker } = await columnsOf('{"a": 1 "b": 2}');
    expect([source, marker]).toEqual(['"{\\"a\\": 1 \\"b\\": 2}"', '"          ^~       "']);
  });

  it('cuts a line past the excerpt of an alert around the point by an ellipsis on each side it cuts, the two printing within the excerpt in one column', async () => {
    const { source, marker } = await columnsOf(`"${'x'.repeat(500)}" | add(1)(2) | "${'y'.repeat(500)}"`);
    expect([source.startsWith('"…x'), source.endsWith('y…"'), source.length, marker.length]).toEqual([true, true, EXCERPT_CHARACTERS - 1, EXCERPT_CHARACTERS - 1]);
    expect(marker.indexOf('^~~')).toBe(source.indexOf('(2)'));
  });

  it('cuts a line on the side away from a point at its end, the caret past it under the closing quote', async () => {
    const { source, marker } = await columnsOf(`[${'1 '.repeat(200)}`);
    expect([source.startsWith('"…'), source.endsWith('1 "'), marker.indexOf('^'), marker.length]).toEqual([true, true, source.length - 1, source.length + 1]);
  });
});

it('refuses a bare nest left open of groups, quotes and maps reading each depth once', () => {
  for (const nest of ['('.repeat(64) + 'x ]', '~('.repeat(64) + 'x', '{:a '.repeat(64) + '1']) expect(refusalOf(nest), nest.slice(0, 8)).toBeInstanceOf(SourceParseError);
});
