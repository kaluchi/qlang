#!/usr/bin/env node
// [QSGAT#hosts]

import { main } from './main.mjs';

const code = await main(
  process.argv.slice(2),
  process.stdin,
  process.stdout,
  process.stderr,
  process.env
);

// [D419]
const written = stream => new Promise(resolve => {
  stream.once('error', resolve);
  stream.write('', resolve);
});
await Promise.all([written(process.stdout), written(process.stderr)]);
process.exit(code);
