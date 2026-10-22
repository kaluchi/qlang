// [QSQUO#step]

import { registerPrimitive } from '../primitives.mjs';
import { asPrinted } from '../print-value.mjs';
import { callOf, bindOf, constructOfData, failOf, groupOf } from '../steps.mjs';

registerPrimitive('call/construct', payload => callOf(payload, asPrinted));
registerPrimitive('bind/construct', payload => bindOf(payload, asPrinted));
registerPrimitive('construct/construct', payload => constructOfData(payload, asPrinted));
registerPrimitive('fail/construct', payload => failOf(payload, asPrinted));
registerPrimitive('group/construct', groupOf);
