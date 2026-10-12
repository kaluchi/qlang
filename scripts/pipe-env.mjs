// The environment a tool runs the command line in when it reads what the
// command line writes to a pipe, a probe's answer, a task's answer and
// the first screen among it: the checkout's own, without the colour a
// terminal or a harness forces through `FORCE_COLOR`.
// The decisions it exists for: [D93], [D216].
export const pipeEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== 'FORCE_COLOR'));
