const { fcfs } = require('./fcfs');
const { sjf } = require('./sjf');
const { jobSequencingDeadlines } = require('./deadlines');
const { knapsackSchedule } = require('./knapsack');
const { heapPriority } = require('./heapScheduler');
const { branchAndBound } = require('./branchBound');

const ALGORITHMS = {
  fcfs: { fn: fcfs, label: 'FCFS', maxN: 200 },
  sjf: { fn: sjf, label: 'Greedy SJF', maxN: 200 },
  deadlines: { fn: jobSequencingDeadlines, label: 'Job sequencing (deadlines)', maxN: 200 },
  knapsack: { fn: knapsackSchedule, label: '0/1 Knapsack DP', maxN: 80 },
  heap: { fn: heapPriority, label: 'Heap priority queue', maxN: 200 },
  branchBound: { fn: branchAndBound, label: 'Branch & bound', maxN: 12 },
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
  {
    id: 'heap',
    time: 'O(n log n)',
    space: 'O(n + s)',
    note: 'Heap operations for job priority and server availability.',
  },
  {
    id: 'branchBound',
    time: 'O(sⁿ) worst case',
    space: 'O(n · s)',
    note: 'DFS assignment tree; pruning cuts branches with weak upper bound.',
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
