// [QSNAM#reach]

import {
  isBinding, isBuiltinDescriptor, isDoc, isMap, isQuote, isVec, isTag, isTagged,
  isValueClass, isFn, isKind, makeTag, makeTagged, wiringOf,
  tagOf, bindingValueOf, makeBinding, makeKeyword, commandsOf, TAG_HEADER_SYMBOL, KINDS_OF_OWN_VECTORS, CORE_KIND, TRACE_TAG
} from './types.mjs';
import { makeSet } from './ordering.mjs';
import { rootOf, isRootVerbScope } from './state.mjs';
import {
  splitAddress, ANY_KIND_NAME, TAGGED_KIND_NAME, subjectRefusalAddress, argsBeyondInputsAddress, notGivenAddress, notReadAddress,
  kindsRefusalAddress, elementsRefusalAddress, payloadRefusalName, SLOT_KIND_ADDRESS
} from './address.mjs';
import { ROOT_KEY, WITHHELD_KEY } from './scope-keys.mjs';
import { declareRefusal } from './errors.mjs';
import { ANSWER_NAME, SUBJECT_NAME, SURPLUS_NAME, REPAIR_NAME, functionOfRecipe, chainOfKind, chainOfFn, kindThrowsFinishes, kindOfAVerdict } from './chain.mjs';

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

// [QSDSP#walk], [QSDSP#residence]
function residesOn(record, scope) {
  return declaresVerb(record.get('name').name, isVerbValue(bindingValueOf(record)) || isNodeOfAPart(record, scope), labelName => isLabel(scope, labelName));
}

export function isNodeOfAPart(record, scope) {
  return !isVerbValue(bindingValueOf(record)) && fieldOfTheNode(record, scope) !== undefined;
}

function fieldOfTheNode(record, scope) {
  return fieldWiredAt(scope, record.get('name').name);
}

// [QSDSP#residence]
function fieldWiredAt(scope, address) {
  const [labelName, name] = splitAddress(address);
  const label = labelName === null ? null : kindOfAValueOf(scope, labelName);
  return label === null ? undefined : chainOfKind(label).wired.get(name);
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
  if (isNodeOfAPart(record, scope)) return fieldOfTheNode(record, scope).kinds;
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
  return isValueClass(value, 'underTag') && value.tag.name === INVARIANT_TAG_NAME && isQuote(value.payload);
}

export const INVARIANT_TAG = makeTag('invariant');
const INVARIANT_TAG_NAME = INVARIANT_TAG.name;

// [QSSLF#laws]
export function isLaw(value) {
  return isValueClass(value, 'underTag') && value.tag.name === LAW_TAG_NAME && isQuote(value.payload);
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

// [QSDSP#residence]
function residenceOf(scope, kindName, verbName) {
  const address = `${kindName}/${verbName}`;
  const ofTheReader = readsTheReaderUnder(scope, kindName);
  if (ofTheReader && pathNamesOf(scope).includes(address)) return residenceAt(scope, address);
  return onceForRoot(ROOT_RESIDENCES, scope, address, rootResidenceAt) ?? (ofTheReader ? partOfTheLabel(scope, address) : null);
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

// [QSDSP#residence]
function residenceAt(scope, address) {
  const record = nodeOf(scope, address);
  if (record !== null) return residesOn(record, scope) ? record : null;
  return partOfTheLabel(scope, address);
}

const PARTS_OF_A_LABEL = new WeakMap();

export function partOfTheLabel(scope, address) {
  const field = fieldWiredAt(scope, address);
  if (field === undefined) return null;
  let parts = PARTS_OF_A_LABEL.get(field);
  if (parts === undefined) PARTS_OF_A_LABEL.set(field, parts = new Map());
  let record = parts.get(address);
  if (record === undefined) parts.set(address, record = makeBinding({ name: makeKeyword(address), docs: [field.page], value: field.written ?? field.page }));
  return record;
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
    yield tagOf(value).name;
    if (isTag(value)) {
      yield value.name;
      return;
    }
    if (isTagged(value)) {
      yield TAGGED_KIND_NAME;
      if (wiringOf(value) !== undefined) return;
    }
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
      if (record !== null && !passesTheTagName(scope, record, kindName, subject, verbName)) return record;
    }
  }
  return residenceOf(scope, ANY_KIND_NAME, verbName);
}

// [QSDSP#tagname]
function passesTheTagName(scope, record, kindName, subject, verbName) {
  if (!isTag(subject) || kindName !== subject.name || residenceOf(scope, ANY_KIND_NAME, verbName) === null) return false;
  const value = bindingValueOf(record);
  return isVerbValue(value) && !(chainOfFn(isFn(value) ? value : functionOfRecipe(value)).subject?.kinds ?? []).includes(CORE_KIND.tag.name);
}

// [QSNAM#reach], [QSNAM#root]
export function bareNameReach(scope, name, subject) {
  if (scope.has(name) && isBinding(scope.get(name)) && !(isRootVerbScope(scope) && declaresALabel(scope.get(name)))) return { record: scope.get(name), underKind: false };
  const residence = residenceOnSubject(scope, name, subject);
  if (residence !== null) return { record: residence, underKind: true };
  const residences = residencesOf(isRootVerbScope(scope) ? rootScopeOf(scope) : scope, name);
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
    const kind = kindOfAValueOf(scope, kindName);
    for (const name of kind === null ? [] : chainOfKind(kind).wired.keys()) {
      if (!reached.has(name)) reached.set(name, { address: makeTag(`${kindName}/${name}`), verb: bindingValueOf(partOfTheLabel(scope, `${kindName}/${name}`)) });
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
  const value = bindingValueOf(nodeOf(scope, address));
  if (isKind(value)) return [...kindRulesOf(chainOfKind(value), address).keys()];
  return [...functionRulesOf(chainOfFn(isFn(value) ? value : functionOfRecipe(value)), address, splitAddress(address)[0]).keys()];
}

// [QSBLD#fn]
export function kindsSharedBy(scope, address) {
  const value = bindingValueOf(nodeOf(scope, address));
  return [...(isKind(value) ? chainOfKind(value) : chainOfFn(isFn(value) ? value : functionOfRecipe(value))).kindsShared.values()];
}

// [QSERR#site]
const VERDICT_OF_A_VERB = Symbol('verdictOfAVerb');
const VERDICT_OF_A_KIND = Symbol('verdictOfAKind');

function functionRulesOf(chain, address, labelName) {
  const rules = new Map([[subjectRefusalAddress(address, labelName), VERDICT_OF_A_VERB]]);
  if (chain.arity !== null) rules.set(argsBeyondInputsAddress(address), VERDICT_OF_A_VERB);
  for (const { name, kinds, each, reading } of chain.inputs) {
    const inputAddress = `${address}/${name.name}`;
    if (!reading.readsArgs && (reading.strict || !reading.oneArg)) rules.set(notGivenAddress(inputAddress), VERDICT_OF_A_VERB);
    if (each && !reading.readsArgs) rules.set(kindsRefusalAddress(inputAddress), VERDICT_OF_A_VERB);
    if (kinds !== null) rules.set(each ? elementsRefusalAddress(inputAddress) : kindsRefusalAddress(inputAddress), VERDICT_OF_A_VERB);
  }
  const kinds = chain.answer?.kinds ?? null;
  if (kinds !== null && kinds.length > 1 && !returnsItsLabel(kinds, labelName)) rules.set(kindsRefusalAddress(`${address}/${ANSWER_NAME}`), VERDICT_OF_A_VERB);
  return rules;
}

// [QSBLD#kind]
function kindRulesOf({ payload, fields }, address) {
  const rules = new Map();
  if (payload?.each) rules.set(`${address}/${payloadRefusalName(false)}`, VERDICT_OF_A_KIND);
  if (payload?.kinds) rules.set(`${address}/${payloadRefusalName(payload.each)}`, VERDICT_OF_A_KIND);
  for (const { name, kinds, each } of fields) {
    const fieldAddress = `${address}/${name.name}`;
    rules.set(notGivenAddress(fieldAddress), VERDICT_OF_A_KIND).set(notReadAddress(fieldAddress), VERDICT_OF_A_KIND);
    if (each) rules.set(kindsRefusalAddress(fieldAddress), VERDICT_OF_A_KIND);
    if (kinds !== null) rules.set(each ? elementsRefusalAddress(fieldAddress) : kindsRefusalAddress(fieldAddress), VERDICT_OF_A_KIND);
  }
  return rules;
}

// [QSERR#site], [QSERR#rest]
const OWN_KIND = Symbol('ownKind');
const REFUSALS_OF_CHAINS = new WeakMap();

function refusalsOfAChain(chain, address, rulesOf, familyOfAnInvariant) {
  let byAddress = REFUSALS_OF_CHAINS.get(chain);
  if (byAddress === undefined) REFUSALS_OF_CHAINS.set(chain, byAddress = new Map());
  let refusals = byAddress.get(address);
  if (refusals === undefined) {
    refusals = rulesOf(address);
    for (const { name } of chain.invariants) refusals.set(`${address}/${name}`, familyOfAnInvariant(name));
    for (const name of chain.pages.keys()) if (!refusals.has(`${address}/${name}`)) refusals.set(`${address}/${name}`, chain.kindsShared.get(name) ?? OWN_KIND);
    byAddress.set(address, refusals);
  }
  return refusals;
}

function refusalsHeldAt(scope, holder) {
  const value = bindingValueOf(nodeOf(scope, holder));
  const [labelName] = splitAddress(holder);
  if (isVerbValue(value)) {
    if (labelName === null || !isLabel(scope, labelName)) return null;
    const chain = chainOfFn(isFn(value) ? value : functionOfRecipe(value));
    return refusalsOfAChain(chain, holder, address => answerRefusedOf(chain, address, functionRulesOf(chain, address, labelName)), () => VERDICT_OF_A_VERB);
  }
  if (isSlotOfAVerb(scope, holder)) return null;
  const kind = kindOfAValueOf(scope, holder);
  if (kind === null) return null;
  const chain = chainOfKind(kind);
  return refusalsOfAChain(chain, holder, address => kindRulesOf(chain, address), () => VERDICT_OF_A_KIND);
}

// [QSBLD#answer]
function answerRefusedOf(chain, address, rules) {
  if (chain.answer?.kinds) rules.set(kindsRefusalAddress(`${address}/${ANSWER_NAME}`), VERDICT_OF_A_VERB);
  return rules;
}

// [QSERR#site]
const KINDS_OF_VALUES = new WeakMap();

export function kindOfAValueOf(scope, tagName) {
  let byTag = KINDS_OF_VALUES.get(scope);
  if (byTag === undefined) KINDS_OF_VALUES.set(scope, byTag = new Map());
  let kind = byTag.get(tagName);
  if (kind === undefined) byTag.set(tagName, null).set(tagName, kind = closingKindAt(scope, tagName));
  return kind;
}

function closingKindAt(scope, tagName) {
  if (isSlotOfAVerb(scope, tagName)) return kindOfAValueOf(scope, SLOT_KIND_ADDRESS);
  const value = bindingValueOf(nodeOf(scope, tagName));
  for (let [holder] = splitAddress(tagName); holder !== null; [holder] = splitAddress(holder)) {
    const refusals = refusalsHeldAt(scope, holder);
    if (refusals === null) continue;
    const family = refusals.get(tagName);
    if (family === undefined) break;
    if (family === VERDICT_OF_A_VERB) return verdictKindOfAVerb(scope, holder);
    if (family === VERDICT_OF_A_KIND) return verdictKindOfAKind(scope, holder);
    const shared = family === OWN_KIND ? null : family;
    const facts = factsOfARefusal(scope, shared === null ? value : bindingValueOf(nodeOf(scope, shared)), shared);
    if (isVerbValue(bindingValueOf(nodeOf(scope, holder)))) return verdictKindOfAVerb(scope, holder, facts);
    return verdictKindOfAKind(scope, holder, facts);
  }
  return isKind(value) ? value : null;
}

// [QSERR#site]
const SLOTS_OF_EVERY_VERB = new Set([SUBJECT_NAME, SURPLUS_NAME, ANSWER_NAME]);

function isSlotOfAVerb(scope, address) {
  const [holder, name] = splitAddress(address);
  if (holder === null) return false;
  const value = bindingValueOf(nodeOf(scope, holder));
  if (!isVerbValue(value) || !isUnderLabel(scope, holder)) return false;
  return SLOTS_OF_EVERY_VERB.has(name) || chainOfFn(isFn(value) ? value : functionOfRecipe(value)).inputs.some(input => input.name.name === name);
}

const pageAt = (scope, address) => nodeOf(scope, address).get('docs')[0];

const VERDICT_KINDS = new WeakMap();
const SLOTS_OF_VERDICTS = new WeakMap();

export const slotsOfAVerdict = kind => SLOTS_OF_VERDICTS.get(kind);

function verdictKindOf(declaring, holder, build) {
  let byHolder = VERDICT_KINDS.get(declaring);
  if (byHolder === undefined) VERDICT_KINDS.set(declaring, byHolder = new Map());
  let kind = byHolder.get(holder);
  if (kind === undefined) byHolder.set(holder, kind = build());
  return kind;
}

// [QSERR#site]
const NO_SLOTS = new Map();
const NO_FACTS = { commands: [], fields: [], slots: NO_SLOTS, wired: new Set() };

const fieldsAsWired = fields => fields.map(({ name, page, written }) => ({ name: name.name, page, kinds: written }));

function factsOfARefusal(scope, declared, shared) {
  if (isKind(declared)) return { key: declared, commands: [...commandsOf(declared)], fields: [], slots: NO_SLOTS, wired: chainOfKind(kindThrowsFinishes(declared)).wired };
  const kind = shared === null ? null : kindOfAValueOf(scope, shared);
  if (kind === null) return null;
  const fields = fieldsAsWired(chainOfKind(kind).fields.filter(({ name }) => name.name !== TRACE_TAG.name));
  return { key: kind, commands: [], fields, slots: slotsOfAVerdict(kind) ?? NO_SLOTS, wired: new Set(fields.map(({ name }) => name)) };
}

// [QSERR#site]
export const probesOfASlot = scope => chainOfKind(kindOfAValueOf(scope, SLOT_KIND_ADDRESS)).fields;

function verdictKindOfAVerb(scope, verbAddress, facts = null) {
  const value = bindingValueOf(nodeOf(scope, verbAddress));
  const chain = chainOfFn(isFn(value) ? value : functionOfRecipe(value));
  return verdictKindOf(facts?.key ?? chain, verbAddress, () => verdictKindBuilt(scope, verbAddress, chain, facts ?? NO_FACTS));
}

function verdictKindBuilt(scope, verbAddress, chain, { commands, fields, slots: sharedSlots }) {
  const slots = [
    [SUBJECT_NAME, chain.subject?.page ?? pageAt(scope, `fn/${SUBJECT_NAME}`)],
    ...chain.inputs.map(({ name, page }) => [name.name, page]),
    ...(chain.arity === null ? [] : [[SURPLUS_NAME, pageAt(scope, `fn/${SURPLUS_NAME}`)]]),
    [ANSWER_NAME, chain.answer?.page ?? pageAt(scope, `fn/${ANSWER_NAME}`)]
  ];
  const ofTheVerb = [
    ...slots.map(([name, page]) => ({ name, page, kinds: makeTag(`${verbAddress}/${name}`) })),
    { name: REPAIR_NAME, page: pageAt(scope, `fn/${REPAIR_NAME}`), kinds: CORE_KIND.quote }
  ];
  const named = new Set(ofTheVerb.map(({ name }) => name));
  const kind = kindOfAVerdict([...ofTheVerb, ...fields.filter(({ name }) => !named.has(name))], commands);
  SLOTS_OF_VERDICTS.set(kind, new Map([...slots.map(([name]) => [name, `${verbAddress}/${name}`]), ...[...sharedSlots].filter(([name]) => !named.has(name))]));
  return kind;
}

function verdictKindOfAKind(scope, kindAddress, facts = null) {
  const { commands, fields, wired } = facts ?? NO_FACTS;
  const probes = probesOfASlot(scope).filter(({ name }) => name.name !== ANSWER_NAME && !wired.has(name.name));
  return verdictKindOf(facts?.key ?? chainOfKind(kindOfAValueOf(scope, kindAddress)), kindAddress, () => kindOfAVerdict([...fieldsAsWired(probes), ...fields], commands));
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
  const kind = kindOfAValueOf(scope, tagName);
  return makeSet([...namesUnderOf(scope, tagName)]
    .filter(([, record]) => !isLaw(bindingValueOf(record)))
    .map(([name]) => makeTag(`${tagName}/${name}`))
    .concat(kind === null ? [] : [...chainOfKind(kind).wired.keys()].map(name => makeTag(`${tagName}/${name}`))));
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

// [QSLSP#server], [QSLSP#offer]
export function shownFor(scope, name, kindNames = null) {
  const reached = kindNames === null ? undefined : verbsReaching(scope, kindNames).get(name);
  const record = reached === undefined
    ? bareNameReach(scope, name)?.record ?? residencesOf(scope, name)[0]?.[1]
    : nodeOf(scope, reached.address.name) ?? partOfTheLabel(scope, reached.address.name);
  if (record === undefined) return undefined;
  const value = bindingValueOf(record);
  if (!isVerbValue(value) && !isNodeOfAPart(record, scope)) return undefined;
  const inputs = isFn(value) ? chainOfFn(value).inputs.map(({ name: input }) => input.name) : [];
  return { address: makeTag(record.get('name').name), inputs };
}
