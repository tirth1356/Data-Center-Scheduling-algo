const { fcfs } = require('./fcfs');
const { sjf } = require('./sjf');
const { jobSequencingDeadlines } = require('./deadlines');
const { knapsackSchedule } = require('./knapsack');
const ALGORITHMS = {
  fcfs: { fn: fcfs, label: 'FCFS', maxN: 200 },
  sjf: { fn: sjf, label: 'Greedy SJF', maxN: 200 },
  deadlines: { fn: jobSequencingDeadlines, label: 'Job sequencing (deadlines)', maxN: 200 },
  knapsack: { fn: knapsackSchedule, label: '0/1 Knapsack DP', maxN: 80 },
};

const COMPLEXITY = [
  {
    id: 'fcfs',
    time: 'O(n · s)',
    space: 'O(n + s)',
    note: 'Scan servers per job in arrival order.',
  },
  {
    id: 'sjf',
    time: 'O(n log n + n · s)',
    space: 'O(n + s)',
    note: 'Sort by duration, then pick earliest-free server.',
  },
  {
    id: 'deadlines',
    time: 'O(n log n + n · s · D)',
    space: 'O(s · D)',
    note: 'Sort by priority; union-find over D deadline slots per server.',
  },
  {
    id: 'knapsack',
    time: 'O(n · C)',
    space: 'O(n · C)',
    note: '2D DP table over jobs and CPU capacity C with memory validation, plus backtracking.',
  },
];

function runAlgorithm(id, jobs, config) {
  const entry = ALGORITHMS[id];
  if (!entry) throw new Error(`Unknown algorithm: ${id}`);
  if (jobs.length > entry.maxN) {
    return {
      algorithm: id,
      error: `${entry.label} supports at most ${entry.maxN} jobs`,
      assignments: [],
      metrics: null,
      trace: [{ action: 'error', message: `Too many jobs (max ${entry.maxN})` }],
    };
  }
  return entry.fn(jobs, config);
}

module.exports = { ALGORITHMS, COMPLEXITY, runAlgorithm };
