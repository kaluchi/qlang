import { it, expect } from 'vitest';
import { refusalOf } from '../../helpers/read-text.mjs';

it('refuses a value after the head by the message of its kind', () => {
  for (const [source, message] of [
    ['5 | /a', 'a path is a value, which the verb that takes it reads: write `get /a`'],
    ['5 | ::Box', 'a tag goes over the value in the pipe by `tag`: write `tag ::Box`'],
    ['5 | ~(x)', 'code runs on the value in the pipe by `apply`: write `apply (…)`'],
    ['5 | ::Box{:a 1}', 'a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`'],
    ['5 | #[1]', 'a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`'],
    ['5 | {:a 1}', 'a literal is a value, which a step does not run: a shape is built by `get`, `get {:k /path}`'],
    ['5 | 6', 'a step is a command: a value stands at the head, where it is the subject, or as what a verb takes']
  ]) expect(refusalOf(source).message, source).toBe(message);
});
