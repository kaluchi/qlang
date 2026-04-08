// Effect-marker AST decoration and parse-time validation.
//
// Pairs with src/effect.mjs (which owns the EFFECT_MARKER_PREFIX
// constant and `classifyEffect` helper) and src/eval.mjs (which
// hosts the runtime call-site safety net) to enforce the @-effect-
// marker invariant described in src/effect.mjs.
//
// Two passes are exported:
//
//   decorateAstWithEffectMarkers(ast) — post-parse pass that stamps
//     a boolean `.effectful` field on every node whose source token
//     can carry the marker:
//       - OperandCall .effectful = classifyEffect(name)
//       - LetStep / AsStep .effectful = classifyEffect(name)
//       - Projection .effectful = true iff any key segment classifies
//         as effectful
//     Downstream consumers (editor highlight, refactor, autocomplete,
//     reify descriptors, runtime safety net) read `.effectful` and
//     never re-derive the property from the source name.
//
//   validateEffectMarkers(ast) — walks every LetStep and rejects any
//     non-effectful let whose body contains an effectful read site
//     (OperandCall.effectful or Projection.effectful). Throws
//     EffectLaunderingAtLetParse on the first violation, carrying
//     the offending binding's source location for editor diagnostics.
//
// `decorateAstWithEffectMarkers` runs first so the validator can
// rely on the field being present everywhere.

import { walkAst } from './walk.mjs';
import { classifyEffect } from './effect.mjs';
import { EffectLaunderingAtLetParse } from './errors.mjs';

// decorateAstWithEffectMarkers(ast) → ast
//
// Walks the AST and stamps `.effectful` (boolean) on every node
// whose surface form admits an effect marker. Mutates the tree
// and returns the same reference for chaining.
export function decorateAstWithEffectMarkers(ast) {
  walkAst(ast, (node) => {
    switch (node.type) {
      case 'OperandCall':
      case 'LetStep':
      case 'AsStep':
        node.effectful = classifyEffect(node.name);
        break;
      case 'Projection':
        node.effectful = node.keys.some(classifyEffect);
        break;
      default:
        // Other node types do not carry an effect marker.
        break;
    }
  });
  return ast;
}

// findFirstEffectfulIdentifier(node) → string | null
//
// Recursively walks `node` and returns the first effectful identifier
// name encountered, or null if the subtree is effect-clean. Used by
// the validator to embed the offending name in the diagnostic message.
// Walking stops at the first hit. For Projection nodes the offender
// is the first segment whose classifyEffect returns true.
export function findFirstEffectfulIdentifier(node) {
  let offender = null;
  walkAst(node, (n) => {
    if (offender !== null) return false;
    if (n.type === 'OperandCall' && n.effectful) {
      offender = n.name;
      return false;
    }
    if (n.type === 'Projection' && n.effectful) {
      offender = n.keys.find(classifyEffect);
      return false;
    }
  });
  return offender;
}

// validateEffectMarkers(ast) → ast
//
// Visits every LetStep in the tree. Each non-effectful let must
// have an effect-clean body; otherwise we throw
// EffectLaunderingAtLetParse with the binding's source location
// and the offending identifier so the editor can squiggle the
// exact spot. Returns the AST unchanged on success.
export function validateEffectMarkers(ast) {
  walkAst(ast, (node) => {
    if (node.type !== 'LetStep') return;
    if (node.effectful) return;
    const offender = findFirstEffectfulIdentifier(node.body);
    if (offender !== null) {
      throw new EffectLaunderingAtLetParse({
        letName: node.name,
        effectfulName: offender,
        location: node.location
      });
    }
  });
  return ast;
}
