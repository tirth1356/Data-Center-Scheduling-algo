/**
 * Seeded PRNG (mulberry32) for reproducible job sets.
 */
function createRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * @param {object} params
 * @param {number} params.n
 * @param {number} params.cpuMin
 * @param {number} params.cpuMax
 * @param {number} params.memoryMin
 * @param {number} params.memoryMax
 * @param {number} params.durationMin
 * @param {number} params.durationMax
 * @param {number} params.deadlineMin
 * @param {number} params.deadlineMax
 * @param {number} params.priorityMin
 * @param {number} params.priorityMax
 * @param {number} params.seed
 * @returns {Array<object>}
 */
function generateJobs(params) {
  const rng = createRng(params.seed);
  const jobs = [];
  let arrival = 0;
  for (let i = 0; i < params.n; i++) {
    const duration = randInt(rng, params.durationMin, params.durationMax);
    const deadline =
      randInt(rng, params.deadlineMin, params.deadlineMax) + arrival;
    jobs.push({
      id: i + 1,
      arrivalTime: arrival,
      cpu: randInt(rng, params.cpuMin, params.cpuMax),
      memory: randInt(rng, params.memoryMin, params.memoryMax),
      duration,
      deadline: Math.max(deadline, arrival + duration),
      priority: randInt(rng, params.priorityMin, params.priorityMax),
    });
    arrival += randInt(rng, 0, 2);
  }
  return jobs;
}

module.exports = { generateJobs, createRng };
