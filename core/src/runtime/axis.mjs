// Axis-operands — reflective navigation from a binding name to
// declarative metadata living on the binding's source AST.
//
// Each operand walks the `qlang/ast/<uri>` Quote-values in env to
// find the originating `def`-step for the named binding, then
// returns the field projected from that step (source text, docs,
// example Quotes, etc.).
//
// `source` returns a Quote of the def-step's source text.
// `docs`   returns a Vec of Doc-values built from each attached
//          doc-prefix on the def-step (one Doc-value per prefix).
// `examples` returns a Vec of Quote-values extracted from those
//          docs — every Quote segment in the doc-content stream
//          is a candidate test case for runExamples.

import { stateOp } from './dispatch.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';
import { withPipeValue } from '../state.mjs';
import {
  isKeyword, isQMap, isQuote, isTagKeyword, makeQuote, makeDoc
} from '../types.mjs';
import { declareSubjectError, declareShapeError } from '../operand-errors.mjs';
import { parseDocSegments } from '../doc-segments.mjs';

const SourceSubjectNotKeywordOrType   = declareSubjectError('SourceSubjectNotKeywordOrType',   'source',   ['keyword', 'tag-keyword']);
const DocsSubjectNotKeywordOrType     = declareSubjectError('DocsSubjectNotKeywordOrType',     'docs',     ['keyword', 'tag-keyword']);
const ExamplesSubjectNotKeywordOrType = declareSubjectError('ExamplesSubjectNotKeywordOrType', 'examples', ['keyword', 'tag-keyword']);
// `axisName` ('source' / 'docs' / 'examples') and `bindingName`
// (a value-namespace identifier or a `::`-prefixed type-binding
// reference) are identifier-shaped strings at the JS level; the
// JS→qlang lift in `error-convert.mjs::liftIdentifier` converts
// them to Keyword / TagKeyword respectively at descriptor build
// time, so the printed message body reads the same regardless of
// shape. The factory's template stringifies via `${value}` which
// produces the raw `name` half — the lifted-keyword printValue
// surface kicks in only when projection consumers (`!| /bindingName`)
// read the descriptor.
export const AxisBindingNotFound = declareShapeError('AxisBindingNotFound',
  ({ axisName, bindingName }) =>
    `${axisName}: no binding-step found for '${bindingName}' across loaded modules`);

// Walk a module AST for the binding-step that binds `bindingName`.
// Two surface forms produce a binding visible to axis lookup:
//
//   BindStep `:name … body` / `::Tag … body` — the AST node
//   carries `.key` (Keyword or BareTypeKeyword) and the
//   doc-prefix in `.docs`.
//
//   OperandCall `as(:name)` — the AST node carries `.args[0]`
//   (Keyword) and the doc-prefix in `.docs`.
//
// Both forms attach docs to the named binding and both answer to
// axis-operand lookups.
function matchesBindingStep(step, isTypeBinding, targetName) {
  if (step.type === 'BindStep') {
    const key = step.key;
    return isTypeBinding
      ? key.type === 'BareTypeKeyword' && key.tag === targetName
      : key.type === 'Keyword'         && key.name === targetName;
  }
  if (step.type === 'OperandCall' && step.name === 'as') {
    if (!Array.isArray(step.args) || step.args.length === 0) return false;
    const firstArg = step.args[0];
    return firstArg.type === 'Keyword' && firstArg.name === targetName;
  }
  return false;
}

// Walk the module AST front to back, return the LAST matching binding
// step. The last-match rule mirrors qlang's shadowing semantics: a
// later `:foo body` BindStep (or `as(:foo)`) shadows the earlier
// binding, so axis-operand lookups must surface the docs / source /
// examples of the binding shadowing-resolved at that point, not the
// first declaration.
function findBindingStepFor(moduleAst, bindingName) {
  const isTypeBinding = bindingName.startsWith('::');
  const targetName = isTypeBinding ? bindingName.slice(2) : bindingName;
  if (moduleAst.type === 'Pipeline') {
    let lastMatch = null;
    for (let i = 0; i < moduleAst.steps.length; i++) {
      const stepWrapper = moduleAst.steps[i];
      const step = i === 0 ? stepWrapper : stepWrapper.step;
      if (matchesBindingStep(step, isTypeBinding, targetName)) lastMatch = step;
    }
    return lastMatch;
  }
  // Single-step module — top-level AST is the step itself (BindStep
  // or an `as` OperandCall) rather than a Pipeline wrapper.
  return matchesBindingStep(moduleAst, isTypeBinding, targetName) ? moduleAst : null;
}

// Iterate every module Quote stored in env under `qlang/ast/<uri>`.
// langRuntime / use(:ns) put a Quote-value with a pre-parsed `.ast`
// at every such key, so the iterator trusts the shape.
function* moduleAstsIn(env) {
  for (const [k, v] of env) {
    if (k.startsWith('qlang/ast/') && isQuote(v)) yield v.ast;
  }
}

export function findBindingStepAcrossModules(env, bindingName) {
  for (const moduleAst of moduleAstsIn(env)) {
    const step = findBindingStepFor(moduleAst, bindingName);
    if (step !== null) return step;
  }
  return null;
}

// Resolve the subject to a binding name a def-step lives under.
// Keyword `:foo`         → `'foo'` (ordinary value/conduit binding).
// TagKeyword `::Tag`     → `'::Tag'` (type-binding subject — the form
// `::Tag | source` lands here once BareTypeKeyword evaluation returns
// a TagKeyword identifier).
// Tagged-instance Map (`:qlang/kind` is a TagKeyword, e.g.
// `::assertion[…]` or `::conduit[…]`) → `'::<tag>'` taken from that
// kind's name — the instance's `docs` are the docs of the type
// binding it instantiates.
function bindingNameOf(subject, env, ErrorCls) {
  if (isKeyword(subject)) return subject.name;
  if (isTagKeyword(subject)) return '::' + subject.name;
  if (isQMap(subject)) {
    const kind = subject.get('qlang/kind');
    if (isTagKeyword(kind)) return '::' + kind.name;
  }
  throw new ErrorCls(subject);
}

export const source = stateOp('source', 1, (state, _lambdas) => {
  const bindingName = bindingNameOf(state.pipeValue, state.env, SourceSubjectNotKeywordOrType);
  const step = findBindingStepAcrossModules(state.env, bindingName);
  if (step === null) {
    throw new AxisBindingNotFound({ axisName: 'source', bindingName });
  }
  return withPipeValue(state, makeQuote(step.text));
});

export const docs = stateOp('docs', 1, (state, _lambdas) => {
  const bindingName = bindingNameOf(state.pipeValue, state.env, DocsSubjectNotKeywordOrType);
  const step = findBindingStepAcrossModules(state.env, bindingName);
  if (step === null) {
    throw new AxisBindingNotFound({ axisName: 'docs', bindingName });
  }
  const docStrings = step.docs ?? [];
  return withPipeValue(state, Object.freeze(docStrings.map(s => makeDoc(s))));
});

export const examples = stateOp('examples', 1, async (state, _lambdas) => {
  const bindingName = bindingNameOf(state.pipeValue, state.env, ExamplesSubjectNotKeywordOrType);
  const step = findBindingStepAcrossModules(state.env, bindingName);
  if (step === null) {
    throw new AxisBindingNotFound({ axisName: 'examples', bindingName });
  }
  const docStrings = step.docs ?? [];
  const collected = [];
  for (const docStr of docStrings) {
    const segments = await parseDocSegments(docStr, state.env);
    for (const seg of segments) {
      if (isQuote(seg)) collected.push(seg);
    }
  }
  return withPipeValue(state, Object.freeze(collected));
});

PRIMITIVE_REGISTRY.bind('qlang/prim/source',   source);
PRIMITIVE_REGISTRY.bind('qlang/prim/docs',     docs);
PRIMITIVE_REGISTRY.bind('qlang/prim/examples', examples);
