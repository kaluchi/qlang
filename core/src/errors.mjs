// qlang runtime errors — the category hierarchy, the throw-site
// spec registry, and the per-site declaration over both.
//
// A per-site class names its throw site and nothing else: one site,
// one class. The factories below build them, and each concrete class
// lives next to the site that raises it — an operand impl in
// runtime/*.mjs, a codec seam in codec.mjs, the session envelope in
// session.mjs. `operand-errors.mjs` narrows the same shape for the
// sites that check a slot's value-class, where the operand, the
// position and the expected type spell the diagnostic.
//
// The category roots this file declares:
//
//   QlangError                       — abstract root
//     QlangTypeError                 — abstract typeError class
//     NumericDomainError             — abstract numericDomain class
//     ArityError                     — captured-arg count the site refuses
//     QlangInvariantError            — registration-time invariant
//     EffectLaunderingError          — @-marker laundered past a name
//
// Declaration order follows that hierarchy: the roots, then the
// registry, then the factories over both, then the per-site classes
// grouped under the root each rides. A factory call evaluates at
// module load, so a class declared above its root would read the
// root through the temporal dead zone.
//
// The fields every QlangError carries besides its per-site name:
//   .location       — qlang source position (set by evalNode wrapper
//                     when the error bubbles past an AST node), so an
//                     editor squiggles the failing operand.
//   .context        — the structured bag the throw site hands the
//                     downstream catch. The root's constructor
//                     defaults it to `{}` and every factory routes
//                     through that constructor, so a reader walks it
//                     unconditionally, as `errorFromQlang` in
//                     error-convert.mjs does.

// ── Category roots ─────────────────────────────────────────────

export class QlangError extends Error {
  constructor(message, kind, context = {}) {
    super(message);
    this.name = 'QlangError';
    this.kind = kind;
    this.context = context;
    this.location = null;
  }
}

export class QlangTypeError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'typeError', context);
    this.name = 'QlangTypeError';
  }
}

// NumericDomainError — the value's type is right and its magnitude
// is not. `typeKeyword(Infinity)` answers `::number`, so a shape
// check has nothing to report; what the site refuses is the
// finite-double domain a qlang Number lives in. A zero divisor is
// the same refusal reached from the other side, and the reader
// repairs both the same way: by changing a value's magnitude.
export class NumericDomainError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'numericDomain', context);
    this.name = 'NumericDomainError';
  }
}

export class ArityError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'arityError', context);
    this.name = 'ArityError';
  }
}

// QlangInvariantError — abstract root for registration-time invariant
// violations raised when a runtime operand is constructed with
// incomplete or malformed metadata. These fire when langRuntime is
// assembled and signal that a runtime-module author forgot to
// provide a required meta field.
// Per-site subclasses live next to the dispatch wrapper that enforces
// the invariant (see runtime/dispatch.mjs).
export class QlangInvariantError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'invariantError', context);
    this.name = 'QlangInvariantError';
  }
}

// EffectLaunderingError — abstract root for the @-prefix effect-marker
// invariant: a BindStep declaration whose body references an
// @-prefixed identifier (the qlang convention for side-effectful host
// operands like @callers, @refs, @hierarchy) must itself be
// @-prefixed, so the effect propagates through every alias. Two
// concrete subclasses fire from two different points:
//
//   EffectLaunderingAtBindStepParseError — fired by `evalBindStep` when
//     a non-@-prefixed name declares a verb whose body calls an
//     @-prefixed OperandCall or reads an @-prefixed Projection key.
//
//   EffectLaunderingAtCallError — fired at runtime by
//     eval.mjs::evalOperandCall and runtime/verb.mjs::applyVerb when
//     a non-@-prefixed identifier resolves to an effectful function
//     value or verb (the laundering path where the binding was
//     installed via use, captured via as, or injected by the
//     embedding host, so the declaration could not detect the
//     effect).
export class EffectLaunderingError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'effectLaundering', context);
    this.name = 'EffectLaunderingError';
  }
}

// ── Throw-site specs ──────────────────────────────────────────
//
// A per-site error carries four structural facts: the `:category`
// its base names, the `:operand` that raises it, the `:position`
// that operand checks, and the `:expectedType` it requires. Each is
// a property of the throw site, so the site records it here and the
// bootstrap stamps it onto the `::Tag` binding the catalog declares
// under the same name. The catalog carries what an author writes —
// the prose and the `~(…)` examples.
//
// The facts stay plain strings and numbers at this layer; the lift
// into Keywords, TagKeywords and Vecs happens at the stamp site in
// `descriptor-ops.mjs`, which is where the value-class factories
// live. That keeps `errors.mjs` free of a `types.mjs` import, which
// would close a cycle.

// A category names who repairs the failure, and only the categories
// a reader repairs reach the `:throws` of a place — the Vec answers
// what a query can provoke there, which is the half a reader can act
// on: a verb's slot, and a step's unresolved name, unreadable text or
// laundered effect [D64].
const QUERY_FAULT_CATEGORIES = new Set([
  'typeError', 'arityError', 'numericDomain', 'unresolvedIdentifier', 'parseError', 'effectLaundering'
]);

const throwSiteSpecs = new Map();

// One name, one throw site — the registry refuses a second
// recording the way `PRIMITIVE_REGISTRY.bind` refuses a second
// binding, and for the same reason: two classes answering to one
// name share a catalog tag and a stamped spec, so whichever loads
// second speaks for both.
export function recordThrowSiteSpec(className, category, facts = {}) {
  if (throwSiteSpecs.has(className)) {
    throw new ThrowSiteSpecAlreadyRecordedError({ className });
  }
  throwSiteSpecs.set(className, Object.freeze({
    category,
    isQueryFault: QUERY_FAULT_CATEGORIES.has(category),
    ...facts
  }));
}

// The `:throws` Vec of a binding, read back off the sites that name
// it, ordered by the slot each site guards: the subject, then the
// captured positions in order, then the refusals that guard no one
// slot — a magnitude, a comparability, an arity. Registry insertion
// is module-load order, which says nothing about an operand whose
// sites are spread across modules, so the recorded `:position` is
// what the reading rests on.
const SUBJECT_SLOT = -1;
const NO_SLOT = Number.MAX_SAFE_INTEGER;

function slotOf(spec) {
  if (spec.position === 'subject') return SUBJECT_SLOT;
  if (typeof spec.position === 'number') return spec.position;
  return NO_SLOT;
}

export function throwSiteTagsRaisedBy(bindingName) {
  const raised = [];
  // Every site names the place it guards, a verb, a noun or a step of
  // the language [D64].
  for (const [className, spec] of throwSiteSpecs) {
    if (spec.isQueryFault && spec.operand === bindingName) raised.push([className, spec]);
  }
  return raised
    .sort(([, left], [, right]) => slotOf(left) - slotOf(right))
    .map(([className]) => className);
}

export function throwSiteSpecOf(className) {
  return throwSiteSpecs.get(className);
}

export function throwSiteSpecNames() {
  return throwSiteSpecs.keys();
}

// ── Per-site declaration ───────────────────────────────────────
//
// One throw site, one class. Every per-site class is built by a
// factory that names it once and records its throw-site spec from
// the same argument, so the class name, the `.kind` the instance
// carries and the `:category` the catalog binding gets stamped with
// cannot drift apart. `operand-errors.mjs` narrows the same shape
// for the four operand slot checks — subject, modifier, element,
// comparability — where the operand and the slot spell the wording
// as well as the spec. The factories here take a message builder
// instead, and cover every site the slot checks leave: a custom
// diagnostic, an arity refusal, a magnitude outside the
// finite-double domain, a runtime invariant, an @-marker laundered
// past a name, a codec seam, the session envelope, the primitive
// registry, the bootstrap, a source the host cannot read.

// `name` is a non-writable own property of a class object, so a
// class built inside a factory reports the factory's local binding
// until redefined. Every per-site class is redefined to its declared
// name, which is what `constructor.name`, a stack frame, and the
// `::Tag` the catalog binds all read.
export function brand(Cls, className) {
  Object.defineProperty(Cls, 'name', { value: className });
  return Cls;
}

// Shared body of every factory whose base already stamps the kind
// and keeps the context bag: the base takes `(message, context)`,
// the per-site class adds its identity.
function declareUnder(BaseError, category, className, buildMessage, facts) {
  recordThrowSiteSpec(className, category, facts);
  const Cls = class extends BaseError {
    constructor(context = {}) {
      super(buildMessage(context), context);
      this.name = className;
    }
  };
  return brand(Cls, className);
}

// declarePerSiteError — a site whose category names no `instanceof`
// family of its own. The class extends `QlangError` directly and
// stamps `category` as its kind.
export function declarePerSiteError(className, category, buildMessage, facts = {}) {
  recordThrowSiteSpec(className, category, facts);
  const Cls = class extends QlangError {
    constructor(context = {}) {
      super(buildMessage(context), category, context);
      this.name = className;
    }
  };
  return brand(Cls, className);
}

// declareShapeError — a site whose diagnostic wording the operand
// slot-check factories in `operand-errors.mjs` cannot spell, because
// what it refuses is a shape rather than one slot's value-class. The
// class still carries structured context and a unique site name.
export function declareShapeError(className, buildMessage, facts = {}) {
  return declareUnder(QlangTypeError, 'typeError', className, buildMessage, facts);
}

// declareNumericDomainError — a site whose subject and modifiers
// carry the right value-class and whose result leaves the
// finite-double domain a qlang Number lives in. Extends
// `NumericDomainError` so `.kind` reads `numericDomain` and the
// tag-binding's `:category` matches — a shape category would claim
// a type violation the values do not have, since
// `typeKeyword(Infinity)` answers `::number`.
export function declareNumericDomainError(className, buildMessage, facts = {}) {
  return declareUnder(NumericDomainError, 'numericDomain', className, buildMessage, facts);
}

// declareArityError — a site whose failure is the captured-arg
// count: too few, too many, or an unsupported specific count.
// Extends ArityError so `.kind === 'arityError'` and `instanceof
// ArityError` both match, while the concrete per-site class still
// identifies the throw location uniquely.
export function declareArityError(className, buildMessage, facts = {}) {
  return declareUnder(ArityError, 'arityError', className, buildMessage, facts);
}

// declareInvariantError — a registration-time or render-time
// invariant the runtime itself holds. Extends `QlangInvariantError`
// so `evalNode`'s rethrow guard keeps letting it past the deflect
// machinery: an invariant violation is a defect in the runtime or in
// what a host installed, never a value the fail track should carry.
export function declareInvariantError(className, buildMessage, facts = {}) {
  return declareUnder(QlangInvariantError, 'invariantError', className, buildMessage, facts);
}

// declareEffectLaunderingError — a site that caught an @-prefixed
// effect reaching a name that does not carry the marker. Extends
// `EffectLaunderingError` so a host can catch the whole family.
export function declareEffectLaunderingError(className, buildMessage, facts = {}) {
  return declareUnder(EffectLaunderingError, 'effectLaundering', className, buildMessage, facts);
}

// declareForeignError — a failure of the embedding rather than of
// the query: the host could not hand the runtime something it asked
// for. The class extends `Error`, so the deflect combinators never
// see it and it rides out to the host that can act on it, while the
// spec it records gives its `::Tag` the same `spec` reading every
// other per-site error answers with.
export function declareForeignError(className, buildMessage, facts = {}) {
  recordThrowSiteSpec(className, 'foreignError', facts);
  const Cls = class extends Error {
    constructor(context = {}) {
      super(buildMessage(context));
      this.name = className;
      this.context = context;
    }
  };
  return brand(Cls, className);
}

// ── Per-site classes under QlangInvariantError ─────────────────

// First among the per-site classes: `recordThrowSiteSpec` reaches
// for it on a repeated name, and every later declaration in the tree
// records after this one resolves.
export const ThrowSiteSpecAlreadyRecordedError = declareInvariantError(
  'ThrowSiteSpecAlreadyRecordedError',
  ({ className }) => `${className} records a second throw-site spec; two classes under ` +
    'one name share a catalog tag and a stamped spec',
  { operand: '::qlang' }
);

// ── Per-site classes under QlangError ──────────────────────────

export const UnresolvedIdentifierError = declarePerSiteError(
  'UnresolvedIdentifierError', 'unresolvedIdentifier',
  ({ identifierName }) => `unresolved identifier: ${identifierName}`,
  { operand: '::call' }
);

// UnresolvedAddressError — a name with a path names no verb that lives
// on the noun of its path [D62]. `context.address` is the address as a
// tag name, written short.
export const UnresolvedAddressError = declarePerSiteError(
  'UnresolvedAddressError', 'unresolvedIdentifier',
  ({ address }) => `no verb lives at the address ${address.literal}`,
  { operand: '::call' }
);

// EvaluationDepthExceededError — `nestState` (state.mjs) refused one
// more nested evaluation frame past `EVAL_DEPTH_LIMIT`. Kind
// `resourceLimit`: the runaway sits in the query's recursion.
// `context.depth` is the refused frame, `context.limit` the budget.
export const EvaluationDepthExceededError = declarePerSiteError(
  'EvaluationDepthExceededError', 'resourceLimit',
  ({ depth, limit }) => `evaluation depth ${depth} exceeds the budget of ${limit} nested frames`,
  { operand: '::qlang' }
);

// ── Per-site classes under EffectLaunderingError ───────────────

export const EffectLaunderingAtBindStepParseError = declareEffectLaunderingError(
  'EffectLaunderingAtBindStepParseError',
  ({ bindingName, effectfulName }) =>
    `binding '${bindingName}' has an effectful body (references '${effectfulName}') ` +
    `but its name is not @-prefixed; rename to '@${bindingName}' or remove the effectful reference`,
  { operand: '::bind' }
);

export const EffectLaunderingAtCallError = declareEffectLaunderingError(
  'EffectLaunderingAtCallError',
  ({ bindingName, effectfulName }) =>
    `identifier '${bindingName}' resolved to effectful function '${effectfulName}' ` +
    `but '${bindingName}' is not @-prefixed; the binding was laundered through env, ` +
    `use, or as — rename to '@${bindingName}' to mark the effect`,
  { operand: '::call' }
);
