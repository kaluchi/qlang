// [QSNAM#reach]

import {
  isBinding, isBuiltinDescriptor, isDoc, isMap, isQuote, isVec, isTag, isTagged,
  isValueClass, isFn, isKind, makeTag, makeTagged, beneathTags,
  typeOf, bindingValueOf, makeKeyword, TAG_HEADER_SYMBOL, KINDS_OF_OWN_VECTORS, CORE_KIND
} from './types.mjs';
import { makeSet } from './ordering.mjs';
import { rootOf, isRootVerbScope } from './state.mjs';
import {
  splitAddress, ANY_KIND_NAME, TAGGED_KIND_NAME, subjectRefusalAddress, argsBeyondInputsAddress, notGivenAddress,
  kindsRefusalAddress, elementsRefusalAddress, payloadRefusalName
} from './address.mjs';
import { ROOT_KEY, WITHHELD_KEY } from './scope-keys.mjs';
import { declareRefusal } from './errors.mjs';
import { ANSWER_NAME, functionOfRecipe, chainOfKind, chainOfFn } from './chain.mjs';

function* bindingsOf(scope) {
  for (const [name, entry] of rootOf(scope)) if (!scope.has(name)) yield [name, entry];
  for (const [name, entry] of scope) if (isBinding(entry)) yield [name, entry];
}

// [QSDSP#residence], [QSLIT#keyword]
export function nodeOf(scope, tagName) {
  const rootEntry = rootOf(scope).get(tagName);
  if (isBinding(rootEntry) && declaresALabel(rootEntry)) return rootEntry;
  const entry = scope.get(tagName) ?? rootEntry;
  return isBinding(entry) ? entry : null;
}

// [QSQUO#held]
export const CallValueWithheldError = declareRefusal('call/ValueWithheldError');

export function refuseWithheld(scope, name, readByTag = false) {
  if (scope.has(name) || !scope.get(WITHHELD_KEY)?.has(name)) return;
  if (readByTag && declaresALabel(rootOf(scope).get(name))) return;
  throw new CallValueWithheldError({ name: makeKeyword(name) });
}

// [QSNAM#address]
export function declaresALabel(record) {
  const value = bindingValueOf(record);
  return isDoc(value) || isKind(value);
}

export function isLabel(scope, name) {
  return declaresALabel(nodeOf(scope, name));
}

// [QSNAM#verb]
export function isUnderLabel(scope, name) {
  const [labelName] = splitAddress(name);
  return labelName !== null && isLabel(scope, labelName);
}

export function declaresVerb(address, ofAVerb, isLabelName) {
  const [labelName] = splitAddress(address);
  return ofAVerb && labelName !== null && isLabelName(labelName);
}

function residesOn(record, scope) {
  return declaresVerb(record.get('name').name, isVerbValue(bindingValueOf(record)), labelName => isLabel(scope, labelName));
}

// [QSNAM#address], [QSBLD#input]
export function isVerb(scope, address) {
  const record = nodeOf(scope, address);
  return record !== null && residesOn(record, scope);
}

// [QSNAM#address]
export function isVerbValue(value) {
  return isFn(value) || isQuote(value) || isBuiltinDescriptor(value);
}

// [QSBLD#answer]
export function answerOf(scope, address) {
  const record = nodeOf(scope, `${address}/${ANSWER_NAME}`);
  return record === null ? null : { address: record.get('name').name, kinds: kindsNamedBy(bindingValueOf(record)) };
}

export const returnsItsLabel = (kinds, labelName) => kinds.includes(labelName);

// [QSBLD#answer], [QSLSP#offer]
export function answerKindsOf(scope, record, subjectKinds) {
  const address = record.get('name').name;
  const answer = answerOf(scope, address);
  if (answer === null || answer.kinds.includes(ANY_KIND_NAME)) return null;
  const [labelName] = splitAddress(address);
  const walked = kindsWalkedTo(subjectKinds, labelName);
  if (walked === null || !returnsItsLabel(answer.kinds, labelName)) return answer.kinds;
  return [...walked, ...answer.kinds.filter(kind => kind !== labelName)];
}

// [QSBLD#fn]
export function isInvariant(value) {
  return isValueClass(value, 'underTag') && value.tag.name === INVARIANT_TAG_NAME && isQuote(beneathTags(value.payload));
}

export const INVARIANT_TAG = makeTag('invariant');
const INVARIANT_TAG_NAME = INVARIANT_TAG.name;

// [QSSLF#laws]
export function isLaw(value) {
  return isValueClass(value, 'underTag') && value.tag.name === LAW_TAG_NAME && isQuote(beneathTags(value.payload));
}

export const LAW_TAG = makeTag('law');
const LAW_TAG_NAME = LAW_TAG.name;

export function lawsUnder(scope, address) {
  return [...namesUnderOf(scope, address)].filter(([, record]) => isLaw(bindingValueOf(record)));
}

// [QSBLD#answer]
const kindsNamedBy = value => (isTag(value) ? [value.name] : value.map(tag => tag.name));

// [QSNAM#owner]
export function readsTheReaderUnder(scope, nounName) {
  return !isRootVerbScope(scope) || !rootOf(scope).has(nounName);
}

function residenceOf(scope, kindName, verbName) {
  const address = `${kindName}/${verbName}`;
  return readsTheReaderUnder(scope, kindName) && pathNamesOf(scope).includes(address) ? residenceAt(scope, address) : onceForRoot(ROOT_RESIDENCES, scope, address, rootResidenceAt);
}

const rootResidenceAt = (scope, address) => residenceAt(rootScopeOf(scope), address);

const ROOT_SCOPES = new WeakMap();

export function rootScopeOf(scope) {
  const root = rootOf(scope);
  let rootScope = ROOT_SCOPES.get(root);
  if (rootScope === undefined) ROOT_SCOPES.set(root, rootScope = new Map([[ROOT_KEY, root]]));
  return rootScope;
}

const ROOT_RESIDENCES = new WeakMap();

function residenceAt(scope, address) {
  const record = nodeOf(scope, address);
  return record !== null && residesOn(record, scope) ? record : null;
}

export function onceForRoot(table, scope, key, read) {
  const root = rootOf(scope);
  let byKey = table.get(root);
  if (byKey === undefined) table.set(root, byKey = new Map());
  let value = byKey.get(key);
  if (value === undefined) byKey.set(key, value = read(scope, key));
  return value;
}

export function pathNamesOf(scope) {
  let names = PATH_NAMES.get(scope);
  if (names === undefined) {
    names = [];
    for (const [name, entry] of scope) if (typeof name === 'string' && name.includes('/') && isBinding(entry)) names.push(name);
    PATH_NAMES.set(scope, names);
  }
  return names;
}

const PATH_NAMES = new WeakMap();

// [QSDSP#walk], [QSDSP#tagname]
export function* kindsOfWalk(subject) {
  let value = subject;
  for (;;) {
    yield typeOf(value).name;
    if (isTag(value)) {
      yield value.name;
      return;
    }
    if (isTagged(value)) yield TAGGED_KIND_NAME;
    if (isValueClass(value, 'underTag')) {
      value = value.payload;
      continue;
    }
    if (value?.[TAG_HEADER_SYMBOL] !== undefined && isVec(value)) yield 'vec';
    else if (value?.[TAG_HEADER_SYMBOL] !== undefined && isMap(value)) yield 'map';
    return;
  }
}

// [QSDSP#walk]
export function residenceOnSubject(scope, verbName, subject) {
  if (subject !== undefined) {
    for (const kindName of kindsOfWalk(subject)) {
      const record = residenceOf(scope, kindName, verbName);
      if (record !== null) return record;
    }
  }
  return residenceOf(scope, ANY_KIND_NAME, verbName);
}

// [QSNAM#reach]
export function bareNameReach(scope, name, subject) {
  if (scope.has(name) && isBinding(scope.get(name))) return { record: scope.get(name), underKind: false };
  const residence = residenceOnSubject(scope, name, subject);
  if (residence !== null) return { record: residence, underKind: true };
  const residences = residencesOf(isRootVerbScope(scope) ? rootScopeOf(scope) : scope, name);
  const root = rootOf(scope);
  if (residences.length === 0 && root.has(name) && !declaresALabel(root.get(name))) return { record: root.get(name), underKind: false };
  return residences.length === 1 ? { record: residences[0][1], underKind: true } : null;
}

export function residencesOf(scope, verbName) {
  const residences = [];
  for (const [name, record, kindName] of rootNamesOfAVerb(scope, verbName)) {
    if (!scope.has(name) && residesOn(record, scope)) residences.push([kindName, record]);
  }
  for (const name of pathNamesOf(scope)) {
    const [kindName, lastName] = splitAddress(name);
    if (kindName !== ANY_KIND_NAME && lastName === verbName && residesOn(scope.get(name), scope)) residences.push([kindName, scope.get(name)]);
  }
  return residences;
}

// [D417]
const ROOT_NAMES_OF_A_VERB = new WeakMap();

function rootNamesOfAVerb(scope, verbName) {
  return onceForRoot(ROOT_NAMES_OF_A_VERB, scope, verbName, (from, verb) => {
    const named = [];
    for (const [name, record] of rootOf(from)) {
      const [kindName, lastName] = splitAddress(name);
      if (kindName !== ANY_KIND_NAME && lastName === verb) named.push([name, record, kindName]);
    }
    return named;
  });
}

// [QSDSP#residence]
export function scopeNamesOf(scope) {
  const scopeNames = new Map();
  for (const [name, record] of bindingsOf(scope)) {
    if (splitAddress(name)[0] === null) scopeNames.set(name, record);
  }
  return scopeNames;
}

// [QSNAM#binding]
export function readerNamesOf(scope) {
  const readerNames = new Map();
  for (const [name, entry] of scope) if (isBinding(entry)) readerNames.set(name, entry);
  return readerNames;
}

// [QSNAM#root]
export function kindNamesOf(scope) {
  const names = [...rootOf(scope).keys(), ...[...scope.keys()].filter(name => !rootOf(scope).has(name))];
  return names.filter(name => typeof name === 'string' && splitAddress(name)[0] === null && isLabel(scope, name));
}

// [QSDSP#refusal]
export function addressesOf(scope, verbName) {
  const addresses = residencesOf(scope, verbName).map(([kindName]) => makeTag(`${kindName}/${verbName}`));
  if (residenceOf(scope, ANY_KIND_NAME, verbName) !== null) addresses.push(makeTag(`${ANY_KIND_NAME}/${verbName}`));
  return makeSet(addresses);
}

// [QSDSP#walk]
export function verbsReaching(scope, kindNames) {
  const reached = new Map();
  for (const kindName of new Set([...kindNames.flatMap(kindsWalkedFrom), ANY_KIND_NAME])) {
    for (const [name, record] of namesUnderOf(scope, kindName)) {
      const verb = bindingValueOf(record);
      if (!residesOn(record, scope) || reached.has(name)) continue;
      reached.set(name, { address: makeTag(`${kindName}/${name}`), verb });
    }
  }
  return reached;
}

const kindsWalkedFrom = kindName => (KINDS_OF_OWN_VECTORS.includes(kindName)
  ? [...kindsOfWalk(makeTagged(makeTag(kindName), []))]
  : [kindName]);

// [QSDSP#walk], [QSDSP#tagname]
function kindsWalkedTo(kindNames, labelName) {
  const at = kindNames.findIndex((kindName, index) => kindNames[index - 1] !== CORE_KIND.tag.name && kindsWalkedFrom(kindName).includes(labelName));
  if (at === -1) return null;
  return kindNames.slice(0, kindNames[at + 1] === TAGGED_KIND_NAME ? at + 2 : at + 1);
}

// [QSERR#site]
export function ruleRefusalsOf(scope, address) {
  const [labelName] = splitAddress(address);
  const value = bindingValueOf(nodeOf(scope, address));
  if (isKind(value)) return kindRuleRefusalsOf(chainOfKind(value), address);
  return functionRuleRefusalsOf(chainOfFn(isFn(value) ? value : functionOfRecipe(value)), address, labelName);
}

function functionRuleRefusalsOf(chain, address, labelName) {
  const refusals = [subjectRefusalAddress(address, labelName)];
  if (chain.places !== null) refusals.push(argsBeyondInputsAddress(address));
  for (const { name, kinds, each, reading } of chain.inputs) {
    const inputAddress = `${address}/${name.name}`;
    if (!reading.readsArgs && (reading.strict || !reading.onePlace)) refusals.push(notGivenAddress(inputAddress));
    if (each && !reading.readsArgs) refusals.push(kindsRefusalAddress(inputAddress));
    if (kinds !== null) refusals.push(each ? elementsRefusalAddress(inputAddress) : kindsRefusalAddress(inputAddress));
  }
  const kinds = chain.answer?.kinds ?? null;
  if (kinds !== null && kinds.length > 1 && !returnsItsLabel(kinds, labelName)) refusals.push(kindsRefusalAddress(`${address}/${ANSWER_NAME}`));
  return refusals;
}

// [QSBLD#kind]
function kindRuleRefusalsOf({ payload, fields }, address) {
  const refusals = [];
  if (payload?.each) refusals.push(`${address}/${payloadRefusalName(false)}`);
  if (payload?.kinds) refusals.push(`${address}/${payloadRefusalName(payload.each)}`);
  for (const { name, kinds, each } of fields) {
    const fieldAddress = `${address}/${name.name}`;
    refusals.push(notGivenAddress(fieldAddress));
    if (each) refusals.push(kindsRefusalAddress(fieldAddress));
    if (kinds !== null) refusals.push(each ? elementsRefusalAddress(fieldAddress) : kindsRefusalAddress(fieldAddress));
  }
  return refusals;
}

function namesUnderOf(scope, nounName) {
  const fromRoot = rootIndexOf(rootOf(scope)).get(nounName) ?? NO_NAMES;
  let under = fromRoot;
  for (const [name, entry] of scope) {
    if (!isBinding(entry) || !isOneNameUnder(name, nounName)) continue;
    if (under === fromRoot) under = new Map(fromRoot);
    under.set(name.slice(nounName.length + 1), entry);
  }
  return under;
}

const NO_NAMES = new Map();

function isOneNameUnder(name, nounName) {
  return name.length > nounName.length && name.startsWith(nounName)
    && name[nounName.length] === '/' && !name.includes('/', nounName.length + 1);
}

const ROOT_INDEXES = new WeakMap();

function rootIndexOf(root) {
  let index = ROOT_INDEXES.get(root);
  if (index === undefined) {
    index = new Map();
    for (const [name, record] of root) {
      const [nounName, lastName] = splitAddress(name);
      if (nounName === null) continue;
      if (!index.has(nounName)) index.set(nounName, new Map());
      index.get(nounName).set(lastName, record);
    }
    ROOT_INDEXES.set(root, index);
  }
  return index;
}

// [QSDSP#walk], [QSSLF#laws]
export function namesUnder(scope, tagName) {
  return makeSet([...namesUnderOf(scope, tagName)]
    .filter(([, record]) => !isLaw(bindingValueOf(record)))
    .map(([name]) => makeTag(`${tagName}/${name}`)));
}

// [QSSLF#catalog]
export function declarationsUnder(scope, address) {
  const prefix = `${address}/`;
  return [...bindingsOf(scope)].filter(([name]) => name.startsWith(prefix)).map(([, record]) => record);
}

export function namesDeclaredUnder(scope, address) {
  return [...namesUnderOf(scope, address).keys()];
}

// [QSSLF#near]
export function nodeAddresses(scope) {
  return [...bindingsOf(scope)].map(([name]) => name);
}

// [QSNAM#verb], [QSLSP#server]
export function verbNames(scope) {
  const names = new Set();
  for (const [name, record] of bindingsOf(scope)) {
    const [nounName, lastName] = splitAddress(name);
    if (nounName !== null && residesOn(record, scope)) names.add(lastName).add(name);
  }
  return names;
}

// [QSLSP#server]
export function shownFor(scope, name, kindNames = null) {
  const reached = kindNames === null ? undefined : verbsReaching(scope, kindNames).get(name);
  const record = reached === undefined
    ? bareNameReach(scope, name)?.record ?? residencesOf(scope, name)[0]?.[1]
    : nodeOf(scope, reached.address.name);
  const value = bindingValueOf(record);
  if (!isVerbValue(value)) return undefined;
  const inputs = isFn(value) ? chainOfFn(value).inputs.map(({ name: input }) => input.name) : [];
  return { address: makeTag(record.get('name').name), inputs };
}
