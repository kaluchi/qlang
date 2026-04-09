// Effect-marker AST decoration.
//
// Pairs with src/effect.mjs (which owns the EFFECT_MARKER_PREFIX
// constant and the `classifyEffect` effect-marker classifier) and
// src/eval.mjs (which hosts the runtime call-site safety net).
//
// Exports:
//
//   decorateAstWithEffectMarkers(ast) — post-parse pass that stamps
//     a boolean `.effectful` field on every OperandCall and Projection
//     node. Downstream consumers (editor highlight, refactor,
//     autocomplete, reify descriptors, runtime safety net) read
//     `.effectful` and never re-derive the property from the source
//     name.
//
//   findFirstEffectfulIdentifier(node) — returns the first effectful
//     identifier in a subtree, or null. Used by the `let` operand
//     impl (runtime/intro.mjs) for eval-time effect validation.

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
        node.effectful = classifyEffect(node.name);
        break;
      case 'Projection':
        node.effectful = node.keys.some(classifyEffect);
        break;
      default:
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

