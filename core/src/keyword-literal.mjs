import { parse as peggyParse } from '../gen/grammar.mjs';

const literalCache = new Map();

export function canonicalKeywordLiteral(name) {
  const cached = literalCache.get(name);
  if (cached) return cached;
  const literal = computeLiteral(name);
  literalCache.set(name, literal);
  return literal;
}

function computeLiteral(name) {
  const bare = ':' + name;
  try {
    const ast = peggyParse(bare);
    if (ast.type === 'Keyword' && ast.name === name) return bare;
  } catch { /* bare unparseable */ }
  return ':"' + name
    .replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r')
    .replace(/[\b]/g, '\\b').replace(/\f/g, '\\f') + '"';
}
