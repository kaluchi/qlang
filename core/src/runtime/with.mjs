// [QSPTH#template], [QSNAM#letters]

import { registerStateReader } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { kindsExpected } from '../ordering.mjs';
import { templateClosedIn } from '../eval.mjs';
import { readsAsName } from '../name-chars.mjs';
import { isPath, isMap, isQuote, isErrorValue, makeKeyword } from '../types.mjs';
import { readTemplate, readByPath } from './path-primitives.mjs';

const AnyWithNamesElementKindNotTakenError = declareRefusal('any/with/names/ElementKindNotTakenError');
const AnyWithNamesSelectorKindNotTakenError = declareRefusal('any/with/names/SelectorKindNotTakenError');
const AnyWithNamesKeyNotNameError = declareRefusal('any/with/names/KeyNotNameError');
const AnyWithNamesNameWrittenTwiceError = declareRefusal('any/with/names/NameWrittenTwiceError');

function selectorsOf(names) {
  const selectors = new Map();
  const select = (name, selector) => {
    if (!readsAsName(name)) throw new AnyWithNamesKeyNotNameError({ name: makeKeyword(name), actualValue: names });
    if (selectors.has(name)) throw new AnyWithNamesNameWrittenTwiceError({ name: makeKeyword(name), actualValue: names });
    selectors.set(name, selector);
  };
  for (const [index, part] of (isMap(names) ? [names] : names).entries()) {
    if (isPath(part)) select(part.segments[part.segments.length - 1], part);
    else if (!isMap(part)) throw new AnyWithNamesElementKindNotTakenError({ index, expected: kindsExpected('map', 'path'), actualValue: part });
    else for (const [name, selector] of part) {
      if (!isPath(selector) && !isQuote(selector)) throw new AnyWithNamesSelectorKindNotTakenError({ name: makeKeyword(name), expected: kindsExpected('path', 'quote'), actualValue: selector });
      select(name, selector);
    }
  }
  return selectors;
}

registerStateReader('any/with', async (subject, names, body, state) => {
  const read = await readTemplate(subject, templateClosedIn(selectorsOf(names), state), false, null, state);
  return isErrorValue(read) ? read : await readByPath(subject, templateClosedIn(body, state, read), false, null, state);
});
