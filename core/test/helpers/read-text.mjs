// [QSQUO#step]

import { parseSource } from '../../src/parse.mjs';
import { partOf } from '../../src/parsed-parts.mjs';
import { isBindStep, isCallStep, isConstructStep } from '../../src/steps.mjs';
import { isPath } from '../../src/types.mjs';

export const stepOf = source => parseSource(source)[0];

export const refusalOf = source => { try { parseSource(source); } catch (e) { return e; } return null; };

export const rootOf = (source, opts) => partOf(parseSource(source, opts));

export const kindOf = ({ value }) => (isBindStep(value) ? 'bind' : isCallStep(value) ? 'call' : isConstructStep(value) ? 'construct' : isPath(value) ? 'path' : 'literal');
