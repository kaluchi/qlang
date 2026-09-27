// The descriptors under `::builtin` that bootstrap stamps: the loader's
// `use`, the one operand left a descriptor [D79], and the bindings of
// tags, which take the facts their throw sites recorded.

import {
  BUILTIN_TAG, TAG_HEADER_SYMBOL, isFunctionValue, isKeyword, typeKeyword, keyword, makeTagKeyword,
  stampBuiltinImpl, builtinImplOf
} from './types.mjs';
import { PRIMITIVE_REGISTRY } from './primitives.mjs';
import {
  throwSiteSpecOf,
  throwSiteTagsRaisedBy,
  declareShapeError
} from './errors.mjs';
import { stripTagBindingPrefix, isTagBindingName } from './env-keys.mjs';

// The `:impl` of a descriptor a query assembled is a handle keyword.
const BuiltinImplNotPrimitiveKeyError = declareShapeError('BuiltinImplNotPrimitiveKeyError',
  ({ actualType }) =>
    `::builtin descriptor :impl must be a :qlang/prim/<name> handle keyword, got ${actualType.name}`,
  { operand: '::builtin', expectedType: 'keyword' }
);

// stampStructuralFacts(descriptor, fn, bindingName) — the primitive of a
// descriptor beside its `:impl` handle, with the arity and the effect it
// declares and the refusals its sites record.
export function stampStructuralFacts(descriptor, fn, bindingName) {
  stampBuiltinImpl(descriptor, fn);
  descriptor.set('captured', [...fn.meta.captured]);
  descriptor.set('effectful', fn.effectful);
  stampRaisedTags(descriptor, bindingName);
  return descriptor;
}

// `:throws` is the reverse of the `:operand` each throw site records; a
// tag carries it only when something raises through it.
function stampRaisedTags(descriptor, bindingName, whenEmpty = 'stamp') {
  const raised = throwSiteTagsRaisedBy(bindingName).map(makeTagKeyword);
  if (raised.length === 0 && whenEmpty === 'omit') return descriptor;
  descriptor.set('throws', Object.freeze(raised));
  return descriptor;
}

// stampThrowSiteSpec(binding, envKey) — the facts a refusal's throw site
// recorded, `:category`, `:operand`, `:position` and `:expectedType`, on
// the binding of its tag, so `!| type | spec` reads them; a tag whose
// body is another literal, `::Box {}`, holds no descriptor to stamp.
export function stampThrowSiteSpec(binding, envKey) {
  if (!isTagBindingName(envKey)) return binding;
  if (binding[TAG_HEADER_SYMBOL]?.name !== BUILTIN_TAG.name) return binding;
  const tagDescriptor = binding;
  stampRaisedTags(tagDescriptor, envKey, 'omit');
  const spec = throwSiteSpecOf(stripTagBindingPrefix(envKey));
  if (spec === undefined) return tagDescriptor;
  tagDescriptor.set('category', keyword(spec.category));
  tagDescriptor.set('operand', operandIdentifier(spec.operand));
  if (spec.position !== undefined) {
    tagDescriptor.set('position', typeof spec.position === 'number'
      ? spec.position
      : keyword(spec.position));
  }
  if (spec.expectedType !== undefined) {
    tagDescriptor.set('expectedType', Array.isArray(spec.expectedType)
      ? Object.freeze(spec.expectedType.map(keyword))
      : keyword(spec.expectedType));
  }
  return tagDescriptor;
}

// `:operand` names an operand by its keyword, `:add`, and a constructor
// by its tag, `::verb`.
function operandIdentifier(operand) {
  return isTagBindingName(operand)
    ? makeTagKeyword(stripTagBindingPrefix(operand))
    : keyword(operand);
}

// The primitive of a built-in declared as a verb is called through the
// head of its declaration, which checks what it takes [D72]; a
// descriptor a query assembled from data names it and is refused [D73].
const BuiltinImplOfVerbError = declareShapeError('BuiltinImplOfVerbError',
  ({ impl }) => `::builtin :impl ${impl.literal} names the primitive of a verb, which its declaration calls through its head`,
  { operand: '::builtin' }
);

// resolveBuiltinImpl(descriptor) → the function value a descriptor
// applies: the one bootstrap stamped, or the one its handle names in
// the registry for a descriptor a query assembled.
export function resolveBuiltinImpl(descriptor) {
  const stampedImpl = builtinImplOf(descriptor);
  if (stampedImpl !== undefined) return stampedImpl;
  const implHandle = descriptor.get('impl');
  if (!isKeyword(implHandle)) {
    throw new BuiltinImplNotPrimitiveKeyError({
      actualType: typeKeyword(implHandle),
      actualValue: implHandle
    });
  }
  const resolvedImpl = PRIMITIVE_REGISTRY.resolve(implHandle.name);
  if (!isFunctionValue(resolvedImpl)) throw new BuiltinImplOfVerbError({ impl: implHandle });
  return resolvedImpl;
}
