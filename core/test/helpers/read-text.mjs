// A text read by the parser: the part of its root and its first step, the
// kind of a part and the refusal of a text that reads as no pipeline
// [QSQUO#step].

import { parse } from '../../src/parse.mjs';
import { partOf } from '../../src/walk.mjs';
import { isBindStep, isCallStep, isConstructStep } from '../../src/steps.mjs';
import { isPath } from '../../src/types.mjs';

export const stepOf = source => parse(source)[0];

export const refusalOf = source => { try { parse(source); } catch (e) { return e; } return null; };

export const rootOf = (source, opts) => partOf(parse(source, opts));

export const kindOf = ({ value }) => (isBindStep(value) ? 'bind' : isCallStep(value) ? 'call' : isConstructStep(value) ? 'construct' : isPath(value) ? 'path' : 'literal');
