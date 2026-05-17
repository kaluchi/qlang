// One-shot script — extract repro queries from conformance JSONLs
// and inject them as `~{<query> !| type | eq(::Tag)}` Quote
// examples into the catalog's `::Tag` doc-only declaration's
// attached doc-prefix.
//
// `runExamples(::Tag)` consumes these — each Quote evaluates to a
// boolean (true iff the query produces an error whose identity
// tag — `:kind` TagKeyword on the descriptor, surfaced through
// `type` — matches the catalog declaration). Conformance and
// catalog stay in lockstep: a repro that drifts in conformance
// rolls through here on next regeneration.
//
// Usage: `node core/scripts/inject-error-examples.mjs`. Run after
// conformance JSONL edits that add / change error-producing
// queries.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../src/parse.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const conformanceDir = join(here, '..', 'test', 'conformance');
const catalogDir = join(here, '..', 'lib', 'qlang');

// Step 1: scan conformance for `query` strings whose `expect` opens
// with `::TagName` — those are the queries that produce error
// values tagged with TagName.

const tagToQueries = new Map();

function walkConformance(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkConformance(path);
    else if (name.endsWith('.jsonl')) ingestConformance(path);
  }
}

function ingestConformance(path) {
  const lines = readFileSync(path, 'utf8').split('\n').filter(l => l.trim());
  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry.expect || !entry.query) continue;
    const trimmedExpect = entry.expect.trimStart();
    const tagMatch = /^::([A-Z][A-Za-z0-9_]*)/.exec(trimmedExpect);
    if (!tagMatch) continue;
    const tagName = tagMatch[1];
    if (!tagToQueries.has(tagName)) tagToQueries.set(tagName, []);
    tagToQueries.get(tagName).push(entry.query);
  }
}

walkConformance(conformanceDir);

// Step 2: pick the shortest repro per tag. Skip queries that
// already invoke `parse` / `eval` / `!| type` — those are
// derivative tests, not direct repros.

function pickRepros(tagName, queries) {
  const direct = queries.filter(q =>
    !q.includes('| parse') && !q.includes('| eval') &&
    !q.includes('!| type') && !q.includes('!| /')
  );
  const pool = direct.length > 0 ? direct : queries;
  pool.sort((a, b) => a.length - b.length);
  // The wrapped Quote `<query> !| type | eq(::Tag)` must
  // itself parse cleanly — runExamples evaluates the Quote, and
  // a Quote with unparseable body throws on entry. Test-parse
  // each candidate and drop the unparseable ones. ::ParseError
  // repros (sources like `"[1 2 3"` that ARE the parse error)
  // fall here; their Quote can never be a direct repro and
  // belongs in a `<string-source> | parse` form instead.
  const parseable = pool.filter(q => {
    try {
      parse(`${q} !| type | eq(::${tagName})`, { uri: 'repro-probe' });
      return true;
    } catch { return false; }
  });
  return parseable.slice(0, 1);
}

// Step 3: walk catalog .qlang files. For each `::TagName` BindStep,
// inject Quote example(s) into the doc-prefix's trailing block-doc
// segment. The injection target: any tag whose name shows up in
// tagToQueries.

function walkCatalog(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkCatalog(path);
    else if (name.endsWith('.qlang')) processCatalogFile(path);
  }
}

let totalInjected = 0;

function processCatalogFile(path) {
  // Normalise line endings on the in-memory copy used for matching
  // and rewriting. The catalog files mix CRLF / LF after various
  // migrations; the regex compares against a canonical LF form, and
  // the rewritten output is also LF-normal. Writing back only fires
  // when an injection actually lands — a no-op pass must leave the
  // on-disk bytes untouched so Windows working trees with
  // core.autocrlf=true do not surface every family file as modified.
  const rawSrc = readFileSync(path, 'utf8');
  let src = rawSrc.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const canonicalBefore = src;
  // Match a tag BindStep with its block-doc prefix:
  //
  //   ::TagName
  //     |~~ <prose>
  //     <maybe more lines> ~~|
  //
  // Optional `::builtin{…}` body trails the doc-prefix on
  // value-class tags (::conduit / ::qlang / ::json) but error tags
  // are doc-only — every entry the script targets is the
  // doc-only form (its `:trail` semantic rides through `!|`
  // dispatch, no constructor body required). The lookahead skips
  // any tag whose doc-prefix is immediately followed by an
  // `::builtin{` body so the script touches only error tags.
  //
  // Replace the doc-prefix's closing `~~|` with the injected
  // Quote examples followed by `~~|`. Skip injection when the tag
  // has no conformance queries OR the prose already pins the tag
  // identity through any of the recognised shape-check forms (see
  // `proseAlreadyPinsTagIdentity`). The script's injected weak form
  // (`!| type | eq(::Tag)`) is a baseline coverage seed — once a
  // hand-curated structured shape check lands in the prose, the
  // script must stay idle on that tag so re-runs do not stack
  // weak-and-structured pairs.

  const tagRe = /^::([A-Z][A-Za-z0-9_]*)\n {2}\|~~ ([\s\S]*?) ~~\|(?!\n {2}::builtin\{)/gm;
  src = src.replace(tagRe, (match, tagName, prose) => {
    const queries = tagToQueries.get(tagName);
    if (!queries || queries.length === 0) return match;
    if (proseAlreadyPinsTagIdentity(prose, tagName)) return match;
    const repros = pickRepros(tagName, queries);
    if (repros.length === 0) return match;
    totalInjected++;
    const injected = repros
      .map(q => `\n    ~{${q} !| type | eq(::${tagName})}`)
      .join('');
    const newProse = prose.trimEnd() + injected + '\n   ';
    return `::${tagName}\n  |~~ ${newProse} ~~|`;
  });

  if (src !== canonicalBefore) writeFileSync(path, src);
}

// Decide whether the prose already carries an identity-pinning
// shape check. Recognises both forms the catalog uses:
//
//   weak form       — `!| type | eq(::TagName)` (this script's
//                     own injection shape; a single re-run must
//                     not stack a duplicate).
//   structured form — `!| [type /field …] | eq([::TagName …])`
//                     (the hand-curated rich shape-pin form that
//                     dominates the current catalog — checks
//                     identity + the relevant descriptor fields in
//                     one Vec-equality step).
//
// A tag name appearing inside the Vec-equality literal counts as
// the identity anchor for both forms; matching by literal tag name
// keeps the check tied to the surrounding declaration so an
// unrelated `::OtherTag` mention in prose does not falsely suppress
// the inject pass.
function proseAlreadyPinsTagIdentity(prose, tagName) {
  if (prose.includes(`!| type | eq(::${tagName})`)) return true;
  const structuredEqRe = new RegExp(`!\\|\\s*\\[type\\b[\\s\\S]*?\\|\\s*eq\\(\\[::${tagName}\\b`);
  return structuredEqRe.test(prose);
}

walkCatalog(catalogDir);

console.log(`injected examples into ${totalInjected} error tag declarations`);
console.log(`total tags with conformance queries: ${tagToQueries.size}`);
