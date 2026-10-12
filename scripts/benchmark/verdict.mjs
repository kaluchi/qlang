// The verdict of a measurement [D26]: the runs of a decision beside the
// runs of a baseline in one set, from what each run fixed when it ran,
// computing nothing again. Runs compare within one mode and one model.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { recordPathOf } from '../decision-records.mjs';

const benchDir = import.meta.dirname;
const repoRoot = join(benchDir, '..', '..');
const setDirOf = setId => join(benchDir, 'sets', setId);

function runsOf(setId, screen) {
  const runsDir = join(setDirOf(setId), 'runs');
  return readdirSync(runsDir).filter(name => name.startsWith(`${screen}~`) && name.endsWith('.json')).sort()
    .map(name => JSON.parse(readFileSync(join(runsDir, name), 'utf8')));
}

// What a run spent and scored: its calls to the model, the calls of its
// tools, the tokens it read with the cache and wrote, and its solved
// tasks, null for a run that fixed no score.
function figuresOf(record) {
  return {
    run: record.run,
    requests: record.requests ?? null,
    calls: record.calls.length,
    read: record.inputTokens,
    written: record.outputTokens,
    solved: Array.isArray(record.score) ? record.score.filter(entry => entry.solved).length : null,
    missed: Array.isArray(record.score) ? record.score.filter(entry => !entry.solved) : [],
    of: Array.isArray(record.score) ? record.score.length : null
  };
}

// An answer as the report shows it: the tag of an error, or the first
// hundred characters of a value.
const shortAnswer = answer => (answer?.['$error'] !== undefined ? `отказ ${answer['$error']['$tag']}` : JSON.stringify(answer).slice(0, 100));

const thousands = count => `${Math.round(count / 1000)}k`;
const tenthsOf = value => String(Math.round(value * 10) / 10).replace('.', ',');
const tenths = count => `${(count / 1000).toFixed(1).replace('.', ',')}k`;

function span(values, show) {
  const known = values.filter(value => value !== null);
  if (known.length === 0) return 'не записано';
  const low = Math.min(...known);
  const high = Math.max(...known);
  const mean = known.reduce((sum, value) => sum + value, 0) / known.length;
  return `${low === high ? show(low) : `${show(low)}–${show(high)}`}, ср. ${show(mean)}`;
}

function solvedSpan(figures) {
  if (figures.some(figure => figure.solved === null)) return 'не записано';
  const all = figures.every(figure => figure.solved === figure.of);
  return all ? `${figures[0].of}/${figures[0].of} в каждом` : figures.map(figure => `${figure.solved}/${figure.of}`).join(' ');
}

// How the new runs stand to the baseline on a figure: above it or below
// it by more than a tenth of its range's edge, or inside it.
function standing(baseline, measured) {
  const known = values => values.filter(value => value !== null);
  const [base, now] = [known(baseline), known(measured)];
  if (base.length === 0 || now.length === 0) return null;
  if (Math.min(...now) > Math.max(...base) * 1.1) return 'above';
  if (Math.max(...now) < Math.min(...base) * 0.9) return 'below';
  return 'inside';
}

function titleOf(screen) {
  const recordPath = recordPathOf(repoRoot, screen.split('.')[0]);
  return recordPath === null ? null : readFileSync(recordPath, 'utf8').split('\n')[0].replace(/^#\s*/, '');
}

function describe(label, screen, records) {
  const commits = [...new Set(records.map(record => record.commit))].join(', ');
  const hashes = [...new Set(records.map(record => record.screenHash))].join(', ');
  const title = titleOf(screen);
  return [`  ${label.padEnd(7)} ${screen}: коммит ${commits}, экран ${hashes}, прогонов ${records.length}`,
    ...(title === null ? [] : [`          ${title}`])];
}

// The measurement before a decision's in a set: the decision of the
// highest number below it that the set's runs measured, or undefined.
function previousMeasurement(setId, screen) {
  const number = Number(/^D(\d+)/.exec(screen)?.[1] ?? NaN);
  const earlier = readdirSync(join(setDirOf(setId), 'runs'))
    .map(name => Number(/^D(\d+)~/.exec(name)?.[1] ?? NaN))
    .filter(candidate => candidate < number);
  return earlier.length === 0 ? undefined : `D${Math.max(...earlier)}`;
}

// verdict(setId, screen, baselineScreen) — the report of a measurement
// beside one baseline, the measurement before it unless one is named.
export function verdict(setId, screen, baselineScreen = previousMeasurement(setId, screen)) {
  const measured = runsOf(setId, screen);
  const baseline = baselineScreen === undefined ? [] : runsOf(setId, baselineScreen);
  const tasks = JSON.parse(readFileSync(join(setDirOf(setId), 'tasks.json'), 'utf8'));
  const pairs = [...new Set(measured.map(record => `${record.mode}~${record.model}`))];
  const lines = [`Замер ${screen} · набор ${setId} · ${measured[0]?.date ?? ''}`, ''];
  for (const pair of pairs) {
    const [mode] = pair.split('~');
    const now = measured.filter(record => `${record.mode}~${record.model}` === pair);
    const base = baseline.filter(record => `${record.mode}~${record.model}` === pair);
    const [nowFigures, baseFigures] = [now.map(figuresOf), base.map(figuresOf)];
    const reasons = [...new Set(now.map(record => record.reason).filter(Boolean))];
    lines.push('Что сравниваю', ...describe('новый', screen, now));
    if (base.length > 0) lines.push(...describe('старый', baselineScreen, base));
    const models = [...new Set([...now, ...base].map(record => record.modelId ?? record.model))].join(', ');
    lines.push(`  Модель ${models}, ${mode === 'cli' ? 'с командной строкой qlang' : 'вслепую, по одной странице'}.`,
      `  Набор ${setId} — ${tasks.length} задач, их писал чистый автор.`);
    for (const reason of reasons) lines.push(`  Повторный замер: ${reason}`);
    const rows = [
      ['решено', figures => solvedSpan(figures)],
      ['обращений к API', figures => span(figures.map(figure => figure.requests), tenthsOf)],
      ['вызовов инструмента', figures => span(figures.map(figure => figure.calls), tenthsOf)],
      ['токенов прочитано', figures => span(figures.map(figure => figure.read), thousands)],
      ['токенов написано', figures => span(figures.map(figure => figure.written), tenths)]
    ];
    lines.push('', `Итог                   ${base.length > 0 ? 'старый'.padEnd(24) : ''}новый`);
    for (const [label, show] of rows) {
      lines.push(`  ${label.padEnd(20)} ${base.length > 0 ? show(baseFigures).padEnd(24) : ''}${show(nowFigures)}`);
    }
    lines.push('', `Вердикт: ${verdictOf(baseFigures, nowFigures)}`, '', 'Промахи');
    const misses = nowFigures.flatMap(figure => figure.missed.map(entry => ({ run: figure.run, ...entry })));
    if (nowFigures.some(figure => figure.solved === null)) lines.push('  не записаны: прогон шёл до того, как прогоны стали записывать решённые');
    else if (misses.length === 0) lines.push('  нет');
    for (const miss of misses) {
      const task = tasks.find(candidate => candidate.id === miss.task);
      lines.push(`  прогон ${miss.run}, ${miss.task}: ${task.text.replace(/\s+/g, ' ').slice(0, 70)}…`,
        `    запрос  ${miss.query ?? '(нет)'}`,
        `    ответ   ${shortAnswer(miss.answer)}`,
        `    ожидали ${JSON.stringify(task.expected)}`);
    }
    lines.push('', 'По прогонам');
    const runLine = (label, figure) => `  ${label.padEnd(9)} ${figure.solved === null ? 'решено не записано' : `${figure.solved}/${figure.of}`}  обращений ${String(figure.requests ?? '–').padStart(2)}  вызовов ${String(figure.calls).padStart(2)}  прочитано ${thousands(figure.read).padStart(5)}  написано ${tenths(figure.written)}`;
    for (const figure of baseFigures) lines.push(runLine(`старый ${figure.run}`, figure));
    for (const figure of nowFigures) lines.push(runLine(`новый ${figure.run}`, figure));
    lines.push('');
  }
  lines.push('Как считается',
    '  обращение к API — один ответ модели; при каждом Claude Code отправляет весь накопленный контекст',
    '  вызов инструмента — одна команда, которую модель отдала; несколько вызовов идут в одном ответе',
    '  прочитано — входные токены, сложенные по всем обращениям, вместе с кешем; написано — выходные',
    '  решено — итоговые запросы прогона, сверенные с ответами автора деревом того коммита, где шёл прогон');
  console.log(lines.join('\n'));
}

// A regression where fewer tasks are solved, or the new runs call the
// model or read more than every run of the baseline; an improvement the
// other way; no change where the ranges meet.
function verdictOf(base, now) {
  if (base.length === 0) return 'базы нет, сравнивать не с чем.';
  const solvedKnown = base.every(figure => figure.solved !== null) && now.every(figure => figure.solved !== null);
  const solved = solvedKnown ? standing(base.map(figure => figure.solved), now.map(figure => figure.solved)) : null;
  const requests = standing(base.map(figure => figure.requests), now.map(figure => figure.requests));
  const read = standing(base.map(figure => figure.read), now.map(figure => figure.read));
  const worse = solved === 'below' || requests === 'above' || read === 'above';
  const better = solved === 'above' || requests === 'below' || read === 'below';
  const caveat = solvedKnown ? '' : ' Решённые у базы не записаны, сравниваю обращения и токены.';
  if (worse && !better) return `регресс.${caveat}`;
  if (better && !worse) return `улучшение.${caveat}`;
  if (worse && better) return `смешанно: одно хуже, другое лучше.${caveat}`;
  return `регресса нет: решённые, обращения и токены лежат внутри разброса базы.${caveat}`;
}
