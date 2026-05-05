import { nullaryOp } from './dispatch.mjs';
import { isString, isKeyword, keyword } from '../types.mjs';
import { declareSubjectError } from '../operand-errors.mjs';
import { PRIMITIVE_REGISTRY } from '../primitives.mjs';

const KeywordSubjectNotStringOrKeyword = declareSubjectError(
  'KeywordSubjectNotStringOrKeyword', 'keyword', 'String or Keyword');

export const keywordOp = nullaryOp('keyword', (subject) => {
  if (isString(subject)) return keyword(subject);
  if (isKeyword(subject)) return subject.name;
  throw new KeywordSubjectNotStringOrKeyword(subject);
});

PRIMITIVE_REGISTRY.bind('qlang/prim/keyword', keywordOp);
