import { it, expect } from 'vitest';
import { parseDocument, semanticTokensFor, SEMANTIC_TOKEN_TYPES } from '../../src/features.mjs';
import { decodeSemanticTokens } from '../helpers/semantic-tokens.mjs';
// Docs whose quote stands under the tag of a group or of the fail track, in a
// literal, as a modifier and in the quote of a doc.
const DOCS_OF_STEP_TAGS = ['|~~ see ::group~(add 1) ~~|', '[|~~ ::group~(add 1) ~~|]', 'f |~~ ::fail~(add 1) ~~|', '|~~ ~([|~~ ::group~(add 1) ~~|]) ~~|'];

it('reads a doc whose quote stands under the tag of a group or of the fail track with no diagnostic', () => {
  for (const src of DOCS_OF_STEP_TAGS) {
    const { root, diagnostics } = parseDocument(src, 'test.qlang');
    expect(diagnostics, src).toEqual([]);
    expect(root, src).not.toBeNull();
  }
});

it('paints a doc whose quote stands under the tag of a group or of the fail track, its verb as `function`', async () => {
  for (const src of DOCS_OF_STEP_TAGS) {
    const tokens = decodeSemanticTokens((await semanticTokensFor(src)).data, SEMANTIC_TOKEN_TYPES);
    expect(tokens.some(t => t.type === 'function'), src).toBe(true);
  }
});
