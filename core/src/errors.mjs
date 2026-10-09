// qlang runtime errors — the category hierarchy, the throw-site
// spec registry, and the per-site declaration over both.
//
// A per-site class names its throw site and nothing else: one site,
// one class. The factories below build them, and each concrete class
// lives next to the site that raises it — an operand impl in
// runtime/*.mjs or a seam of the host. `operand-errors.mjs` narrows
// the same shape for the sites that check a slot's value-class, where
// the operand, the position and the expected type spell the diagnostic.
//
// The category roots this file declares:
//
//   QlangError                       — abstract root
//     QlangTypeError                 — abstract typeError class
//     NumericDomainError             — abstract numericDomain class
//     ArityError                     — captured-arg count the site refuses
//     QlangInvariantError            — registration-time invariant
//     EffectLaunderingError          — a call to outside under a name without @
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

// QlangInvariantError — abstract root of the defects of the runtime and
// of what a host handed: the table of implementations, the bootstrap,
// the root a host's sources declare. Per-site subclasses live next to
// the site that holds the invariant.
export class QlangInvariantError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'invariantError', context);
    this.name = 'QlangInvariantError';
  }
}

// EffectLaunderingError — abstract root of the mark of an effect: a
// name whose code calls a name marked `@`, which reaches outside the
// language, carries the mark itself, so every reader of the name sees it
// [D69]; `bind/EffectMarkMissingError` refuses a declaration without it
// where it stands.
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
// that operand checks, and the `:expectedType` it requires; the
// catalog declares the refusal's kind and its page beside its place
// [D152].

const throwSiteSpecs = new Map();

// One address, one throw site — the registry refuses a second
// recording the way `PRIMITIVE_REGISTRY.bind` refuses a second
// binding, and for the same reason: two classes answering to one
// address share one kind of the catalog, so whichever loads second
// speaks for both. A refusal's address is the name its kind is declared
// by, `number/add/SubjectNotNumberError`, and the tag it answers by [D158].
export function recordThrowSiteSpec(address, category, facts = {}) {
  if (throwSiteSpecs.has(address)) {
    throw new BuiltinThrowSiteSpecAlreadyRecordedError({ address });
  }
  throwSiteSpecs.set(address, Object.freeze({ category, ...facts }));
}

export function throwSiteSpecOf(address) {
  return throwSiteSpecs.get(address);
}

export function throwSiteSpecNames() {
  return throwSiteSpecs.keys();
}

// ── Per-site declaration ───────────────────────────────────────
//
// One throw site, one class. Every per-site class is built by a
// factory that names it once and records its throw-site spec from
// the same argument, so the class name, the `.kind` the instance
// carries and the `:category` the registry records cannot drift
// apart. `operand-errors.mjs` narrows the same shape
// for the four operand slot checks — subject, modifier, element,
// comparability — where the operand and the slot spell the wording
// as well as the spec. The factories here take a message builder
// instead, and cover every site the slot checks leave: a custom
// diagnostic, an arity refusal, a magnitude outside the
// finite-double domain, a runtime invariant, a name without the mark
// of its effect, the table of implementations, the bootstrap, a source
// the host cannot read.

// `name` is a non-writable own property of a class object, so a
// class built inside a factory reports the factory's local binding
// until redefined. Every per-site class is redefined to the last name
// of its address, which `constructor.name` and a stack frame read, and
// carries the address, which the tag of the error value is [D158].
export function brand(Cls, address) {
  Object.defineProperty(Cls, 'name', { value: lastNameOf(address) });
  Object.defineProperty(Cls.prototype, 'address', { value: address });
  return Cls;
}

export function lastNameOf(address) {
  return address.slice(address.lastIndexOf('/') + 1);
}

// Shared body of every factory whose base already stamps the kind
// and keeps the context bag: the base takes `(message, context)`,
// the per-site class adds its identity.
function declareUnder(BaseError, category, address, buildMessage, facts) {
  recordThrowSiteSpec(address, category, facts);
  const Cls = class extends BaseError {
    constructor(context = {}) {
      super(buildMessage(context), context);
      this.name = lastNameOf(address);
    }
  };
  return brand(Cls, address);
}

// declarePerSiteError — a site whose category names no `instanceof`
// family of its own. The class extends `QlangError` directly and
// stamps `category` as its kind.
export function declarePerSiteError(address, category, buildMessage, facts = {}) {
  recordThrowSiteSpec(address, category, facts);
  const Cls = class extends QlangError {
    constructor(context = {}) {
      super(buildMessage(context), category, context);
      this.name = lastNameOf(address);
    }
  };
  return brand(Cls, address);
}

// declareShapeError — a site whose diagnostic wording the operand
// slot-check factories in `operand-errors.mjs` cannot spell, because
// what it refuses is a shape rather than one slot's value-class. The
// class still carries structured context and a unique site name.
export function declareShapeError(address, buildMessage, facts = {}) {
  return declareUnder(QlangTypeError, 'typeError', address, buildMessage, facts);
}

// declareNumericDomainError — a site whose subject and modifiers
// carry the right value-class and whose result leaves the
// finite-double domain a qlang Number lives in. Extends
// `NumericDomainError` so `.kind` reads `numericDomain` and the
// recorded `:category` matches — a shape category would claim
// a type violation the values do not have, since
// `typeKeyword(Infinity)` answers `::number`.
export function declareNumericDomainError(address, buildMessage, facts = {}) {
  return declareUnder(NumericDomainError, 'numericDomain', address, buildMessage, facts);
}

// declareArityError — a site whose failure is the captured-arg
// count: too few, too many, or an unsupported specific count.
// Extends ArityError so `.kind === 'arityError'` and `instanceof
// ArityError` both match, while the concrete per-site class still
// identifies the throw location uniquely.
export function declareArityError(address, buildMessage, facts = {}) {
  return declareUnder(ArityError, 'arityError', address, buildMessage, facts);
}

// declareInvariantError — a registration-time or render-time
// invariant the runtime itself holds. Extends `QlangInvariantError`
// so `evalNode`'s rethrow guard keeps letting it past the deflect
// machinery: an invariant violation is a defect in the runtime or in
// what a host installed, never a value the fail track should carry.
export function declareInvariantError(address, buildMessage, facts = {}) {
  return declareUnder(QlangInvariantError, 'invariantError', address, buildMessage, facts);
}

// declareEffectLaunderingError — a site that caught an @-prefixed
// effect reaching a name that does not carry the marker. Extends
// `EffectLaunderingError` so a host can catch the whole family.
export function declareEffectLaunderingError(address, buildMessage, facts = {}) {
  return declareUnder(EffectLaunderingError, 'effectLaundering', address, buildMessage, facts);
}

// declareForeignError — a failure of the embedding rather than of
// the query: the host could not hand the runtime something it asked
// for. The class extends `Error`, so the deflect combinators never
// see it and it rides out to the host that can act on it, while the
// record of its site gives its `::Tag` an address as every other
// per-site error's.
export function declareForeignError(address, buildMessage, facts = {}) {
  recordThrowSiteSpec(address, 'foreignError', facts);
  const Cls = class extends Error {
    constructor(context = {}) {
      super(buildMessage(context));
      this.name = lastNameOf(address);
      this.context = context;
    }
  };
  return brand(Cls, address);
}

// ── Per-site classes under QlangInvariantError ─────────────────

// First among the per-site classes: `recordThrowSiteSpec` reaches
// for it on a repeated name, and every later declaration in the tree
// records after this one resolves.
export const BuiltinThrowSiteSpecAlreadyRecordedError = declareInvariantError(
  'builtin/ThrowSiteSpecAlreadyRecordedError',
  ({ address }) => `${address} records a second throw-site spec; two classes under ` +
    'one address share one kind of the catalog',
  { operand: '::builtin' }
);

// ── Per-site classes under QlangError ──────────────────────────

export const CallUnknownNameError = declarePerSiteError(
  'call/UnknownNameError', 'unresolvedIdentifier',
  ({ name }) => `no name ${name.name} is declared, and no word of the kinds of the subject answers it`,
  { operand: '::call' }
);

// CallUnknownAddressError — a name with a path that no declaration names
// [D62], [D153]. `context.address` is the address as a tag name, and
// `context.nearest` the addresses it was likely meant to be.
export const CallUnknownAddressError = declarePerSiteError(
  'call/UnknownAddressError', 'unresolvedIdentifier',
  ({ address }) => `no name is declared at the address ${address.literal}`,
  { operand: '::call' }
);

// CallEvaluationDepthExceededError — `nestState` (state.mjs) refused one
// more nested evaluation frame past `EVAL_DEPTH_LIMIT`. Kind
// `resourceLimit`: the runaway sits in the query's recursion.
// `context.depth` is the refused frame, `context.limit` the budget.
export const CallEvaluationDepthExceededError = declarePerSiteError(
  'call/EvaluationDepthExceededError', 'resourceLimit',
  ({ depth, limit }) => `evaluation depth ${depth} exceeds the budget of ${limit} nested frames`,
  { operand: '::call' }
);

// BindNameDeclaredTwiceError — a declaration of a name an earlier step
// of its scope declared [D44], [D71], or of an address the root holds
// [D153]: `evalBindStep` refuses it where it stands, and the root a
// source that declares it again. `context.name` is the name the
// declarations share.
export const BindNameDeclaredTwiceError = declareShapeError('bind/NameDeclaredTwiceError',
  ({ name }) => `${name.literal} is declared once, and this declaration declares it again`,
  { operand: '::bind' }
);

// ── Per-site classes under EffectLaunderingError ───────────────

export const BindEffectMarkMissingError = declareEffectLaunderingError(
  'bind/EffectMarkMissingError',
  ({ name, calls }) =>
    `${name.literal} declares code that calls ${calls.literal}, which reaches outside the language; ` +
    'its name carries the mark too',
  { operand: '::bind' }
);
