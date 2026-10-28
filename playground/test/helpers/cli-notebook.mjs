// [QSSLF#page]

import { createNotebook, nodeAddresses } from '@kaluchi/qlang-core';
import { playgroundSources } from '../../src/playground-sources.mjs';
import { silentStreams } from './silent-streams.mjs';

export const notebook = await createNotebook({ sources: playgroundSources(silentStreams) });

export const answerOf = async query => (await notebook.evalCell(query)).result;

export const names = nodeAddresses(notebook.scope).map(name => `::${name}`);

export const cliNames = await answerOf(`[${names.join(' ')}] | filter ~(binding | origin | eq :stdio) | map ~print`);
