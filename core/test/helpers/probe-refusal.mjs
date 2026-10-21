// A refusal a test declares at its own address, which a host throws at the
// door [QSERR#site].

import { declareRefusal } from '../../src/errors.mjs';

// A refusal no page of the catalog declares facts for: the facts it
// carries are those every refusal shares under `::error`.
export const TestsProbeTypeError = declareRefusal('tests/ProbeTypeError');
