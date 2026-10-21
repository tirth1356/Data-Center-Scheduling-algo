const { generateJobs } = require('../algorithms/generator');
const { runAlgorithm } = require('../algorithms/index');

const p = {
  n: 10,
  totalCpu: 16,
  totalMemory: 64,
  numServers: 2,
  seed: 7,
  cpuMin: 1,
  cpuMax: 3,
  memoryMin: 2,
  memoryMax: 6,
  durationMin: 2,
  durationMax: 8,
  deadlineMin: 5,
  deadlineMax: 25,
  priorityMin: 1,
  priorityMax: 10,
};
const jobs = generateJobs(p);
const config = { ...p, serverCpu: 8, serverMemory: 32 };

for (const id of ['fcfs', 'sjf', 'deadlines', 'knapsack']) {
  const r = runAlgorithm(id, jobs, config);
  console.log(
    id,
    r.error || `ok completed=${r.metrics.jobsCompleted} trace=${r.trace.length}`
  );
}
