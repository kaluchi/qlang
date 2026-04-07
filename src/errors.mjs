// qlang runtime errors.
//
// All evaluator errors derive from QlangError. Specific subclasses
// give callers a stable type tag for testing and error reporting.

export class QlangError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = 'QlangError';
    this.kind = kind;
  }
}

export class QlangTypeError extends QlangError {
  constructor(message) {
    super(message, 'type-error');
    this.name = 'QlangTypeError';
  }
}

export class UnresolvedIdentifierError extends QlangError {
  constructor(name) {
    super(`unresolved identifier: ${name}`, 'unresolved-identifier');
    this.name = 'QlangUnresolvedIdentifier';
    this.identifierName = name;
  }
}

export class DivisionByZeroError extends QlangError {
  constructor() {
    super('division by zero', 'division-by-zero');
    this.name = 'QlangDivisionByZero';
  }
}

export class ArityError extends QlangError {
  constructor(message) {
    super(message, 'arity-error');
    this.name = 'QlangArityError';
  }
}
