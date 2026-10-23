// [QSPTH#template], [QSNAM#letters]

import { registerStateReader } from '../primitives.mjs';
import { declareRefusal } from '../errors.mjs';
import { kindsExpected } from '../ordering.mjs';
import { templateClosedIn } from '../eval.mjs';
import { readsAsName } from '../name-chars.mjs';
import { isPath, isMap, isQuote, isErrorValue, keyword } from '../types.mjs';
import { readTemplate, readByPath } from './path.mjs';

const AnyWithNamesElementKindNotTakenError = declareRefusal('any/with/names/ElementKindNotTakenError');
const AnyWithNamesPlaceKindNotTakenError = declareRefusal('any/with/names/PlaceKindNotTakenError');
const AnyWithNamesKeyNotNameError = declareRefusal('any/with/names/KeyNotNameError');
const AnyWithNamesNameWrittenTwiceError = declareRefusal('any/with/names/NameWrittenTwiceError');

function placesOf(names) {
  const places = new Map();
  const place = (name, where) => {
    if (!readsAsName(name)) throw new AnyWithNamesKeyNotNameError({ name: keyword(name), actualValue: names });
    if (places.has(name)) throw new AnyWithNamesNameWrittenTwiceError({ name: keyword(name), actualValue: names });
    places.set(name, where);
  };
  for (const [index, part] of (isMap(names) ? [names] : names).entries()) {
    if (isPath(part)) place(part.segments[part.segments.length - 1], part);
    else if (!isMap(part)) throw new AnyWithNamesElementKindNotTakenError({ index, expected: kindsExpected('map', 'path'), actualValue: part });
    else for (const [name, where] of part) {
      if (!isPath(where) && !isQuote(where)) throw new AnyWithNamesPlaceKindNotTakenError({ name: keyword(name), expected: kindsExpected('path', 'quote'), actualValue: where });
      place(name, where);
    }
  }
  return places;
}

registerStateReader('any/with', async (subject, names, body, state) => {
  const read = await readTemplate(subject, templateClosedIn(placesOf(names), state), false, null, state);
  return isErrorValue(read) ? read : await readByPath(subject, templateClosedIn(body, state, read), false, null, state);
});
