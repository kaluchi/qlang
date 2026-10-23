// [QSQUO#step]

import { registerPrimitive } from '../primitives.mjs';
import { asPrinted } from '../print-value.mjs';
import { callOf, bindOf, constructOfData, failOf, groupOf } from '../steps.mjs';

registerPrimitive('call', payload => callOf(payload, asPrinted));
registerPrimitive('bind', payload => bindOf(payload, asPrinted));
registerPrimitive('construct', payload => constructOfData(payload, asPrinted));
registerPrimitive('fail', payload => failOf(payload, asPrinted));
registerPrimitive('group', groupOf);
