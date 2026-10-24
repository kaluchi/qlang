import { describe, it, expect } from 'vitest';
import { commentRanges, linesOfComments } from '../../../../scripts/comments.mjs';

const said = (path, text, options) => commentRanges(path, text, options).map(({ start, end }) => text.slice(start, end));

describe('the comments of a file read by the parser of its language', () => {
  it('reads a module of JavaScript by acorn: a line, a block and a comment after code, none inside a string or a template', () => {
    const text = '// head\nconst a = 1; // after\n/* block */\nconst s = \'// no\';\nconst t = `/* no */`;\n';
    expect(said('x.mjs', text)).toEqual(['// head', '// after', '/* block */']);
  });

  it('reads a source of the catalog by the parser of the core: its comments, and its docs where they are asked for, none inside a string', () => {
    const text = '|~ The head. ~|\n:a |~~ A page holding `|~~ a doc ~~|` whole. ~~| "|~ no ~|" |~| a line\n';
    expect(said('x.qlang', text)).toEqual(['|~ The head. ~|', '|~| a line']);
    expect(said('x.qlang', text, { docs: true })).toEqual(['|~ The head. ~|', '|~~ A page holding `|~~ a doc ~~|` whole. ~~|', '|~| a line']);
  });

  it('reads the grammar by peggy: a comment between its rules and in its code, none inside a literal, a class or the name a rule is shown by', () => {
    const text = '{{ // top\nconst a = 1; }}\n// a rule\nStart = "//x" [/] { return 1; /* in code */ }\nShown "// no" = "y"\n';
    expect(said('x.peggy', text)).toEqual(['// top', '// a rule', '/* in code */']);
  });

  it('reads a file of a language the tree holds no parser of by the form of its comment line', () => {
    expect(said('x.yml', 'on: push\n# a comment\nrun: x # kept\n')).toEqual(['# a comment']);
    expect(said('x.astro', 'let a = 1; // after\n')).toEqual([' // after']);
  });
});

describe('the lines of a file parted into the code they hold and the comments they name', () => {
  it('parts each line into what it holds and what its comments name', () => {
    expect(linesOfComments('x.mjs', 'const a = 1; // a\n// b\n').map(({ holds, names }) => [holds, names])).toEqual([['const a = 1; ', '// a'], ['', '// b'], ['', '']]);
  });

  it('tells a line a comment runs over from the lines before to the lines after', () => {
    expect(linesOfComments('x.mjs', '/* one\n\n   two */\ncode();').map(({ within }) => within)).toEqual([false, true, false, false]);
  });
});
