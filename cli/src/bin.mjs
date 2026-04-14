#!/usr/bin/env node
// Node-runtime adapter — the only file in the CLI package that
// touches `process.*` directly. main.mjs holds every branch worth
// covering; this file forwards stdout / stderr writers and exits
// with the resolved code.

import { main } from './main.mjs';

process.exit(await main(
  process.argv.slice(2),
  (text) => process.stdout.write(text),
  (text) => process.stderr.write(text)
));
