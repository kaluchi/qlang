// The descriptors under `::builtin` that bootstrap stamps: the bindings
// of tags, which take the facts their throw sites recorded.

import { isBuiltinDescriptor, keyword, makeTagKeyword } from './types.mjs';
import { throwSiteSpecOf, throwSiteTagsRaisedBy } from './errors.mjs';
import { stripTagBindingPrefix, isTagBindingName } from './env-keys.mjs';

// `:throws` is the reverse of the `:operand` each throw site records; a
// tag carries it only when something raises through it.
function stampRaisedTags(descriptor, bindingName) {
  const raised = throwSiteTagsRaisedBy(bindingName).map(makeTagKeyword);
  if (raised.length > 0) descriptor.set('throws', Object.freeze(raised));
  return descriptor;
}

// stampThrowSiteSpec(binding, envKey) — the facts a refusal's throw site
// recorded, `:category`, `:operand`, `:position` and `:expectedType`, on
// the binding of its tag, so `!| type | spec` reads them; a tag whose
// body is another literal, `::Box {}`, holds no descriptor to stamp.
export function stampThrowSiteSpec(binding, envKey) {
  if (!isTagBindingName(envKey) || !isBuiltinDescriptor(binding)) return binding;
  const tagDescriptor = binding;
  stampRaisedTags(tagDescriptor, envKey);
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
