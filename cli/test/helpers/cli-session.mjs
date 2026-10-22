// [QSSLF#page]

import { createSession, nodeAddresses } from '@kaluchi/qlang-core';
import { cliSources } from '../../src/cli-sources.mjs';
import { silentStreams } from './silent-streams.mjs';

export const session = await createSession({ sources: cliSources(silentStreams) });

export const answerOf = async query => (await session.evalCell(query)).result;

export const names = nodeAddresses(session.scope).map(name => `::${name}`);

export const cliNames = await answerOf(`[${names.join(' ')}] | filter ~(binding | get /origin | eq :cli) | map ~print`);
