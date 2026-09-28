// The effect marker on the parser's tree: every call and projection is
// stamped with whether it names an effect, and a declaration finds the
// first effectful name its body calls [D69].

import { walkAst } from './walk.mjs';
import { classifyEffect } from './effect.mjs';

// Stamps `.effectful` on every call and projection of the tree.
export function decorateAstWithEffectMarkers(ast) {
  walkAst(ast, (node) => {
    switch (node.type) {
      case 'OperandCall':
        // A call by address carries the marker on the verb it names,
        // `any/@out`.
        node.effectful = classifyEffect(node.address?.verb ?? node.name);
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

// The first effectful name a subtree calls, or null.
export function findFirstEffectfulIdentifier(node) {
  let offender = null;
  walkAst(node, (n) => {
    if (offender !== null) return false;
    // A quote literal is data, its steps running where it is applied;
    // the modifier of a command is applied by that command.
    if (n.type === 'QuoteLit' && n.parent?.type !== 'OperandCall') return false;
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

