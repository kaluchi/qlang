// [QSQUO#step], [QSLSP#server]

import { splitAddress } from './address.mjs';
import { isPath, isTag } from './types.mjs';
import { isCallStep, isBindStep, isConstructStep, isFailStep, isGroupStep, holdsALiteral, declaresAName, declaresKind } from './steps.mjs';

// [QSNAM#address]
export const CALL_SPELLING = 'call';
export const TAG_SPELLING   = 'tag';

const PARTS = new WeakMap();

const keep = (value, read) => {
  if (typeof value === 'object' && value !== null) PARTS.set(value, read);
};

export function keepParts(root) {
  walkParts(root, (read, parent) => {
    read.parent = parent;
    keep(read.value, read);
    if (isGroupStep(read.value) || isFailStep(read.value)) keep(read.value.payload, read);
  });
  return root;
}

export const partOf = value => PARTS.get(value);

// [QSHST#source]
export const originOf = quote => partOf(quote)?.span.source ?? 'quote';

export function walkParts(read, visit, parent = null) {
  if (visit(read, parent) === false) return;
  for (const held of read.parts) walkParts(held, visit, read);
}

const holds = (span, offset) => span.start.offset <= offset && offset < span.end.offset;

export function partAtOffset(root, offset) {
  let narrowest = null;
  walkParts(root, (read) => {
    if (holds(read.span, offset)) narrowest = read;
  });
  return narrowest;
}

// [QSERR#rest]
export function tagWrittenBy({ value }) {
  return isConstructStep(value) ? value.get('tag').name : null;
}

// [QSERR#rest], [QSLSP#server]
export const tagHeadEnd = read => read.head?.end.offset ?? null;

// [QSNAM#address]
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

function* forksAround(read) {
  for (let around = read.parent; around !== null; around = around.parent) if (around.content !== undefined) yield around;
}

// [QSNAM#scope]
export function visibleAt(declaration, offset) {
  for (const { content } of forksAround(declaration)) if (content.start.offset > offset || content.end.offset < offset) return false;
  return true;
}

// [QSSLF#catalog], [QSNAM#address], [QSNAM#verb], [QSLSP#server]
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

// [QSNAM#verb]
const declaresANodeOrALabel = bind => splitAddress(bind.get('name').name)[0] !== null || declaresKind(bind);

// [QSCLI#stdin]
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

// [QSNAM#scope]
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
