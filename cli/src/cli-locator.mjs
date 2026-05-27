// Locator for the CLI's host catalogs. Hands the existing
// `createSession({ locator })` + `use(:cli/...)` machinery the
// `.qlang` source plus JS impls for each namespace; the rest
// (parse, eval, snapshot-unwrap, stamp impls, stamp AST under
// `qlang/ast/<ns>`) is what `runtime/use-op.mjs::resolveNamespaceEnv`
// already does for every locator-loaded module.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeIoImpls } from './io-operands.mjs';
import { formatImpls } from './format-operands.mjs';
import { parseImpls } from './parse-operands.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB = join(__dirname, '..', 'lib', 'qlang');

const IO_SOURCE     = readFileSync(join(LIB, 'io.qlang'),     'utf8');
const FORMAT_SOURCE = readFileSync(join(LIB, 'format.qlang'), 'utf8');
const PARSE_SOURCE  = readFileSync(join(LIB, 'parse.qlang'),  'utf8');

export function createCliLocator(ioContext) {
  const io = makeIoImpls(ioContext);
  return async (namespaceName) => {
    if (namespaceName === 'cli/io')     return { source: IO_SOURCE,     impls: io };
    if (namespaceName === 'cli/format') return { source: FORMAT_SOURCE, impls: formatImpls };
    if (namespaceName === 'cli/parse')  return { source: PARSE_SOURCE,  impls: parseImpls };
    return null;
  };
}

export const CLI_NAMESPACES = [':cli/io', ':cli/format', ':cli/parse'];

export async function installCliCatalog(session) {
  await session.evalCell('use([' + CLI_NAMESPACES.join(' ') + '])');
}
