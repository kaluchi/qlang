#!/usr/bin/env node
// Node-runtime adapter — the only file in the CLI package that
// touches `process.*` directly. main.mjs holds every branch worth
// covering; this file forwards the arguments, the streams and the
// environment and exits with the resolved code.
// The decisions it exists for: [QSWRK#tooling].

import { main } from './main.mjs';

process.exit(await main(
  process.argv.slice(2),
  process.stdin,
  process.stdout,
  process.stderr,
  process.env
));
