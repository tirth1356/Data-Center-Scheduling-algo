const { generateJobs } = require('../algorithms/generator');
const { ALGORITHMS, COMPLEXITY, runAlgorithm } = require('../algorithms/index');
const { validateGenerateBody, validateRunBody } = require('../algorithms/validate');

console.log('Testing algorithms registry...');
console.log('Registered algorithms:', Object.keys(ALGORITHMS));
console.log('Complexity entries:', COMPLEXITY.length);

const config = {
  n: 10,
  totalCpu: 16,
  totalMemory: 64,
  numServers: 2,
  seed: 42,
  cpuMin: 1,
  cpuMax: 4,
  memoryMin: 2,
  memoryMax: 8,
  durationMin: 2,
  durationMax: 8,
  deadlineMin: 5,
  deadlineMax: 25,
  priorityMin: 1,
  priorityMax: 10,
};

const valGen = validateGenerateBody(config);
if (!valGen.ok) throw new Error('validateGenerateBody failed');

const jobs = generateJobs(valGen.params);
console.log(`Generated ${jobs.length} jobs successfully.`);

const runConfig = {
  ...config,
  serverCpu: Math.floor(config.totalCpu / config.numServers),
  serverMemory: Math.floor(config.totalMemory / config.numServers),
};

for (const id of Object.keys(ALGORITHMS)) {
  const result = runAlgorithm(id, jobs, runConfig);
  if (result.error) throw new Error(`Algorithm ${id} failed: ${result.error}`);
  console.log(`[PASS] ${id.padEnd(12)} completed=${result.metrics.jobsCompleted}/${jobs.length} prio=${result.metrics.totalPriority} energy=${result.metrics.totalEnergyKwh}kWh traceSteps=${result.trace.length}`);
}

console.log('\nAll API and algorithm integrity checks PASSED successfully!');
