// The parts the parser read beside the records of the steps, the span of
// every step, modifier, element, key, name and segment, and the walks over
// them every reader of a text reads [D367].

import { splitAddress } from './address.mjs';
import { isPath, isTag } from './types.mjs';
import { isCallStep, isBindStep, isConstructStep, isFailStep, isGroupStep, isLiteral, declaresAName, declaresKind } from './steps.mjs';

// The two spellings of a name in source, which the editor passes to say
// which occurrences and declarations count: called by its name, `count`,
// or written as a tag, the address of a node, `::Box` [QSNAM#address].
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
export const partOf = value => (typeof value === 'object' && value !== null ? PARTS.get(value) : undefined);

// originOf(quote) — the source a quote was read from, the name its reader
// gave it, `quote` for one assembled from data [QSDSP#residence].
export const originOf = quote => partOf(quote)?.span.source ?? 'quote';

// walkParts(part, visit) → a walk of the parts, each before the parts it
// holds, which it skips for a part `visit(part, parent)` answers false for.
export function walkParts(read, visit, parent = null) {
  if (visit(read, parent) === false) return;
  for (const held of read.parts) walkParts(held, visit, read);
}

// partAtOffset(root, offset) → the narrowest part whose span holds the
// UTF-16 offset, a cursor inside `filter ~(gt 2)` landing on `gt 2`, or null.
export function partAtOffset(root, offset) {
  let narrowest = null;
  walkParts(root, (read) => {
    const { start, end } = read.span;
    if (start.offset <= offset && offset < end.offset) narrowest = read;
  });
  return narrowest;
}

// tagWrittenBy(part) → the name of the tag a tagged literal writes at its
// head, `::Tag[…]`, or null; an error literal holds the tag written before
// its bang as a part of it [QSERR#rest].
export function tagWrittenBy({ value }) {
  return isConstructStep(value) ? value.get('tag').name : null;
}

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

// visibleAt(declaration, offset) — whether a declaration is seen at an
// offset across the groups and the quotes around it, each holding the
// offset within its pipeline [D367].
export function visibleAt(declaration, offset) {
  for (let around = declaration.parent; around !== null; around = around.parent) {
    if (around.content !== undefined && (around.content.start.offset > offset || around.content.end.offset < offset)) return false;
  }
  return true;
}

// bindingNamesVisibleAt(root, offset, spelling?) → the names a step may
// call at the UTF-16 offset: the declarations that end at or before it and
// are visible there, under the spelling of a tag the labels alone
// [QSSLF#catalog].
export function bindingNamesVisibleAt(root, offset, spelling = CALL_SPELLING) {
  const visible = new Set();
  walkParts(root, (read) => {
    const { value } = read;
    if (!isBindStep(value) || (spelling === TAG_SPELLING && !declaresKind(value))) return;
    if (read.span.end.offset > offset || !visibleAt(read, offset)) return;
    const name = value.get('name').name;
    visible.add(spelling === TAG_SPELLING ? name : splitAddress(name)[1]);
  });
  return visible;
}

// readsItsSubject(quote) → whether a query reads the subject it is handed,
// which a host that lifts the subject from a stream waits on only then
// [QSHST#stdin]: where its first step that declares nothing reads it, or a
// declaration before that step runs a body that does; a group where its
// code reads it, a literal never, a call always, and so does a query of
// declarations alone.
export function readsItsSubject(steps) {
  for (const step of steps) {
    const held = isFailStep(step) ? step.payload[0] : step;
    if (!isBindStep(held)) return readsBy(held);
    if (held.has('body') && readsBy(held.get('body'))) return true;
  }
  return true;
}

const readsBy = step => (isGroupStep(step) ? readsItsSubject(step.payload) : !isLiteral(step) && !isConstructStep(step));

// Whether a declaration repeats a name an earlier step of its quote
// declared, the steps sharing one scope [D367].
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
