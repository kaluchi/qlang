// [QSSLF#page]

import { createNotebook, nodeAddresses } from '@kaluchi/qlang-core';
import { cliSources } from '../../src/cli-sources.mjs';
import { silentStreams } from './silent-streams.mjs';

export const notebook = await createNotebook({ sources: cliSources(silentStreams) });

export const answerOf = async query => (await notebook.evalCell(query)).result;

export const names = nodeAddresses(notebook.scope).map(name => `::${name}`);

export const cliNames = await answerOf(`[${names.join(' ')}] | filter ~(binding | origin | eq :cli) | map ~print`);
