// Axis-operands — reflective navigation from a binding name to
// declarative metadata living on the binding's source AST.
//
// Each operand walks the `qlang/ast/<uri>` Quote-values in env to
// find the originating `def`-step for the named binding, then
// returns the field projected from that step (source text, docs,
// example assertions, etc.).
//
// `source` returns a Quote of the def-step's source text.
// `docs`   returns a Vec of Doc-values built from each attached
//          doc-prefix on the def-step (one Doc-value per prefix).
// `examples` returns a Vec of Assertion-values extracted from the
//          docs' `:segments` filtered by `:qlang/kind :assertion`.

import { stateOp } from './dispatch.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';
import { withPipeValue } from '../state.mjs';
import {
  isKeyword, isQMap, isQuote, isTagKeyword, makeQuote, makeDoc
} from '../types.mjs';
import { declareSubjectError, declareShapeError } from '../operand-errors.mjs';
import { parseDocSegments } from '../doc-segments.mjs';

const SourceSubjectNotKeywordOrType   = declareSubjectError('SourceSubjectNotKeywordOrType',   'source',   'Keyword or type-binding descriptor');
const DocsSubjectNotKeywordOrType     = declareSubjectError('DocsSubjectNotKeywordOrType',     'docs',     'Keyword or type-binding descriptor');
const ExamplesSubjectNotKeywordOrType = declareSubjectError('ExamplesSubjectNotKeywordOrType', 'examples', 'Keyword or type-binding descriptor');
export const AxisBindingNotFound = declareShapeError('AxisBindingNotFound',
  ({ axisName, bindingName }) => `${axisName}: no def-step found for binding '${bindingName}' across loaded modules`);

// Walk a module AST for the def-step that binds `bindingName`.
// Single-step modules collapse to a bare OperandCall at the root;
// multi-step modules carry a Pipeline. DocAttachedSequence stamps
// `.docs` on the OperandCall AST node directly, so the def step's
// name and args are reachable at the same depth as a bare def call.
function matchesDefStep(step, isTypeBinding, targetName) {
  if (step.type !== 'OperandCall' || step.name !== 'def') return false;
  if (!Array.isArray(step.args) || step.args.length === 0) return false;
  const firstArg = step.args[0];
  return isTypeBinding
    ? firstArg.type === 'BareTypeKeyword' && firstArg.tag === targetName
    : firstArg.type === 'Keyword'         && firstArg.name === targetName;
}

function findDefStepFor(moduleAst, bindingName) {
  const isTypeBinding = bindingName.startsWith('::');
  const targetName = isTypeBinding ? bindingName.slice(2) : bindingName;
  if (moduleAst.type === 'OperandCall') {
    return matchesDefStep(moduleAst, isTypeBinding, targetName) ? moduleAst : null;
  }
  if (moduleAst.type === 'Pipeline') {
    for (let i = 0; i < moduleAst.steps.length; i++) {
      const stepWrapper = moduleAst.steps[i];
      const step = i === 0 ? stepWrapper : stepWrapper.step;
      if (matchesDefStep(step, isTypeBinding, targetName)) return step;
    }
  }
  return null;
}

// Iterate every module Quote stored in env under `qlang/ast/<uri>`.
// langRuntime / use(:ns) put a Quote-value with a pre-parsed `.ast`
// at every such key, so the iterator trusts the shape.
function* moduleAstsIn(env) {
  for (const [k, v] of env) {
    if (k.startsWith('qlang/ast/') && isQuote(v)) yield v.ast;
  }
}

export function findDefStepAcrossModules(env, bindingName) {
  for (const moduleAst of moduleAstsIn(env)) {
    const step = findDefStepFor(moduleAst, bindingName);
    if (step !== null) return step;
  }
  return null;
}

// Resolve the subject to a binding name a def-step lives under.
// Keyword `:foo`             → `'foo'` (ordinary value/conduit binding).
// Type-descriptor Map (the value bound under a `::tag` env key, carrying
// `:qlang/kind :type`) → `'::<tag>'` recovered by reverse env lookup —
// the descriptor identity matches exactly one env entry.
// Tagged-instance Map (any value carrying `:qlang/kind` as a TagKeyword,
// e.g. `::assertion[…]` or `::conduit[…]`) → `'::<tag>'` taken straight
// from that TagKeyword's name — the instance's `docs` are the docs of
// the type binding it instantiates.
function bindingNameOf(subject, env, ErrorCls) {
  if (isKeyword(subject)) return subject.name;
  if (isQMap(subject)) {
    const kind = subject.get('qlang/kind');
    if (kind && kind.name === 'type') {
      for (const [envKey, envValue] of env) {
        if (envValue === subject && envKey.startsWith('::')) return envKey;
      }
    }
    if (isTagKeyword(kind)) return '::' + kind.name;
  }
  throw new ErrorCls(subject);
}

export const source = stateOp('source', 1, (state, _lambdas) => {
  const bindingName = bindingNameOf(state.pipeValue, state.env, SourceSubjectNotKeywordOrType);
  const step = findDefStepAcrossModules(state.env, bindingName);
  if (step === null) {
    throw new AxisBindingNotFound({ axisName: 'source', bindingName });
  }
  return withPipeValue(state, makeQuote(step.text));
});

export const docs = stateOp('docs', 1, (state, _lambdas) => {
  const bindingName = bindingNameOf(state.pipeValue, state.env, DocsSubjectNotKeywordOrType);
  const step = findDefStepAcrossModules(state.env, bindingName);
  if (step === null) {
    throw new AxisBindingNotFound({ axisName: 'docs', bindingName });
  }
  const docStrings = step.docs ?? [];
  return withPipeValue(state, Object.freeze(docStrings.map(s => makeDoc(s))));
});

export const examples = stateOp('examples', 1, async (state, _lambdas) => {
  const bindingName = bindingNameOf(state.pipeValue, state.env, ExamplesSubjectNotKeywordOrType);
  const step = findDefStepAcrossModules(state.env, bindingName);
  if (step === null) {
    throw new AxisBindingNotFound({ axisName: 'examples', bindingName });
  }
  const docStrings = step.docs ?? [];
  const collected = [];
  for (const docStr of docStrings) {
    const segments = await parseDocSegments(docStr, state.env);
    for (const seg of segments) {
      if (seg instanceof Map && seg.get('qlang/kind')?.name === 'assertion') {
        collected.push(seg);
      }
    }
  }
  return withPipeValue(state, Object.freeze(collected));
});

PRIMITIVE_REGISTRY.bind('qlang/prim/source',   source);
PRIMITIVE_REGISTRY.bind('qlang/prim/docs',     docs);
PRIMITIVE_REGISTRY.bind('qlang/prim/examples', examples);
