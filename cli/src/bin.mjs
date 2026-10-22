// [QSWRK#tooling]

import { main } from './main.mjs';

process.exit(await main(
  process.argv.slice(2),
  process.stdin,
  process.stdout,
  process.stderr,
  process.env
));
