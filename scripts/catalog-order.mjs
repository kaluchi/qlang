// The order of the declarations of a source of the catalog [QSSLF#catalog]: a noun
// before the names under it and the names under a noun together, in the one
// order of their addresses, which `manifest` lists them in, as the parser
// reads the source, so a reader finds a verb where its name puts it.

import { declarationsOf } from './catalog-kinds.mjs';
import { compareValues } from '../core/src/ordering.mjs';
import { makeTag } from '../core/src/types.mjs';

const nounOf = name => name.split('/')[0];

// declarationsOutOfOrder(sources) → each declaration of the sources, each
// `{ path, text }`, that stands out of that order, `{ path, line, name,
// problem }`, the problem naming the declaration it stands after or the noun
// it stands apart from.
export function declarationsOutOfOrder(sources) {
  return sources.flatMap(source => {
    const declared = declarationsOf([source]).map(({ value, span }) => ({ name: value.get('name').name, line: span.start.line }));
    const met = new Set();
    return declared.flatMap(({ name, line }, at) => {
      const before = declared[at - 1]?.name;
      const together = before !== undefined && nounOf(before) === nounOf(name);
      const apart = met.has(nounOf(name)) && !together;
      met.add(nounOf(name));
      if (apart) return [{ path: source.path, line, name, problem: `stands apart from the names under ::${nounOf(name)} before it` }];
      return together && compareValues(makeTag(before), makeTag(name)) > 0 ? [{ path: source.path, line, name, problem: `stands after ::${before}` }] : [];
    });
  });
}
