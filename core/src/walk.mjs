// The parts the parser read beside the records of the steps, and the walks
// over them: the part at an offset, the end of the head of a tag, the
// occurrences of a name and its two spellings, the names visible at a place,
// whether a query reads its subject and the rule of a name declared twice
// [QSQUO#step], [QSHST#tools].

import { splitAddress } from './address.mjs';
import { isPath, isTag } from './types.mjs';
import { isCallStep, isBindStep, isConstructStep, isFailStep, isGroupStep, holdsALiteral, declaresAName, declaresKind } from './steps.mjs';

// The two spellings of a name, which tell the occurrences and the
// declarations of it that count: called by its name, `count`, or written as
// a tag, the address of a node, `::Box` [QSNAM#address].
export const CALL_SPELLING = 'call';
export const TAG_SPELLING   = 'tag';

// The part each value read stands at, the quote of a group and of a step of
// the fail track at the part of the step.
const PARTS = new WeakMap();

const keep = (value, read) => {
  if (typeof value === 'object' && value !== null) PARTS.set(value, read);
};

// keepParts(root) → the root of the parts of a text, each part holding its
// parent and kept by the value it read.
export function keepParts(root) {
  walkParts(root, (read, parent) => {
    read.parent = parent;
    keep(read.value, read);
    if (isGroupStep(read.value) || isFailStep(read.value)) keep(read.value.payload, read);
  });
  return root;
}

// partOf(value) → the part a value was read at, undefined for a value no
// text wrote.
export const partOf = value => PARTS.get(value);

// originOf(quote) — the source a quote was read from, the name its reader
// gave it, `quote` for one assembled from data [QSHST#source].
export const originOf = quote => partOf(quote)?.span.source ?? 'quote';

// walkParts(part, visit) → a walk of the parts, each before the parts it
// holds, which it skips for a part `visit(part, parent)` answers false for.
export function walkParts(read, visit, parent = null) {
  if (visit(read, parent) === false) return;
  for (const held of read.parts) walkParts(held, visit, read);
}

const holds = (span, offset) => span.start.offset <= offset && offset < span.end.offset;

// partAtOffset(root, offset) → the narrowest part whose span holds the
// UTF-16 offset, a cursor inside `filter ~(gt 2)` landing on `gt 2`, or null.
export function partAtOffset(root, offset) {
  let narrowest = null;
  walkParts(root, (read) => {
    if (holds(read.span, offset)) narrowest = read;
  });
  return narrowest;
}

// tagWrittenBy(part) → the name of the tag a tagged literal writes at its
// head, `::Tag[…]` and `::Tag!{…}`, or null; the kind of errors written
// before a bang is a part of its literal [QSERR#rest].
export function tagWrittenBy({ value }) {
  return isConstructStep(value) ? value.get('tag').name : null;
}

// tagHeadEnd(part) → where the tags a tagged literal, an error literal or a
// quote of a doc writes at its head end, which the parser records, or null
// [QSERR#rest], [QSHST#tools].
export const tagHeadEnd = read => read.head?.end.offset ?? null;

// findNameOccurrences(root, name, spelling?) → the parts that name it, a
// keyword written as a value none of them: called, a call of the name, its
// declaration and a path that reads it as a key; written as a tag
// [QSNAM#address], its declaration, a tagged literal that writes it and the
// tag name alone, the head of an error literal among them.
export function findNameOccurrences(root, name, spelling = CALL_SPELLING) {
  const occurrences = [];
  walkParts(root, (read) => {
    const { value } = read;
    if (spelling === TAG_SPELLING) {
      if (tagWrittenBy(read) === name || (isTag(value) && value.name === name) || (isBindStep(value) && declaresKind(value) && value.get('name').name === name)) occurrences.push(read);
    } else if ((isCallStep(value) || isBindStep(value)) && splitAddress(value.get('name').name)[1] === name) {
      occurrences.push(read);
    } else if (isPath(value) && value.segments.includes(name)) {
      occurrences.push(read);
    }
  });
  return occurrences;
}

// The groups and the quotes around a part, the nearest first.
function* forksAround(read) {
  for (let around = read.parent; around !== null; around = around.parent) if (around.content !== undefined) yield around;
}

// visibleAt(declaration, offset) — whether a declaration is seen at an
// offset across the groups and the quotes around it, each holding the
// offset within its pipeline [QSNAM#scope].
export function visibleAt(declaration, offset) {
  for (const { content } of forksAround(declaration)) if (content.start.offset > offset || content.end.offset < offset) return false;
  return true;
}

// bindingNamesVisibleAt(root, offset, spelling?, declaresAVerb?) → the names a
// step may call at the UTF-16 offset, a name with a path by its address and its
// last name, each with the part of its nearest declaration visible there: one
// that ends at or before it, and in the body of the innermost verb
// `declaresAVerb` holds of, the last part of its declaration, of those outside
// the body the nodes and the labels wherever they stand, the verb among them;
// under the spelling of a tag the labels alone [QSSLF#catalog], [QSNAM#address],
// [QSNAM#verb], [QSHST#tools].
export function bindingNamesVisibleAt(root, offset, spelling = CALL_SPELLING, declaresAVerb = () => false) {
  const declarations = [];
  walkParts(root, (read) => {
    if (isBindStep(read.value)) declarations.push(read);
  });
  const body = declarations.findLast(read => holds(read.parts.at(-1).span, offset) && declaresAVerb(read))?.parts.at(-1);
  const visible = new Map();
  const depths = new Map();
  for (const read of declarations) {
    const { value, span } = read;
    if (spelling === TAG_SPELLING && !declaresKind(value)) continue;
    const outside = body !== undefined && (span.start.offset < body.span.start.offset || span.end.offset > body.span.end.offset);
    if ((outside ? !declaresANodeOrALabel(value) : span.end.offset > offset) || !visibleAt(read, offset)) continue;
    const name = value.get('name').name;
    const depth = [...forksAround(read)].length;
    for (const key of spelling === CALL_SPELLING ? [name, splitAddress(name)[1]] : [name]) {
      if (depths.get(key) > depth) continue;
      visible.set(key, read);
      depths.set(key, depth);
    }
  }
  return visible;
}

// Whether a declaration writes a node, a name with a path, or a label, the
// names the scope a call opens keeps [QSNAM#verb].
const declaresANodeOrALabel = bind => splitAddress(bind.get('name').name)[0] !== null || declaresKind(bind);

// readsItsSubject(quote, verbsOfNoSubject?) → whether a query reads the subject
// it is handed, which a host lifting it from a stream waits on only then
// [QSHST#stdin]: by its first step on the success track that declares nothing,
// a group as its code, a literal and a verb `verbsOfNoSubject` names reading
// none, a bare name of one a declaration before it shadows, or by the body of
// such a declaration; a query of declarations alone reads it [D402].
export function readsItsSubject(steps, verbsOfNoSubject = new Set()) {
  let unread = verbsOfNoSubject;
  const readsBy = step => (isGroupStep(step) ? readsItsSubject(step.payload, unread) : !holdsALiteral(step) && !unread.has(step.get('name').name));
  for (const step of steps) {
    if (isFailStep(step)) continue;
    if (!isBindStep(step)) return readsBy(step);
    if (step.has('body') && readsBy(step.get('body'))) return true;
    unread = new Set([...unread].filter(name => name !== splitAddress(step.get('name').name)[1]));
  }
  return true;
}

// Whether a declaration repeats a name an earlier step of its quote
// declared, the steps sharing one scope [QSNAM#scope].
const REPEATED_DECLARATIONS = new WeakMap();

export function repeatsDeclarationAt(steps, index) {
  let repeated = REPEATED_DECLARATIONS.get(steps);
  if (repeated === undefined) {
    repeated = new Set();
    const declared = new Set();
    steps.forEach((step, at) => {
      if (!declaresAName(step)) return;
      const name = (isFailStep(step) ? step.payload[0] : step).get('name').name;
      if (declared.has(name)) repeated.add(at);
      declared.add(name);
    });
    REPEATED_DECLARATIONS.set(steps, repeated);
  }
  return repeated.has(index);
}
