const ALGORITHMS = ['fcfs'];

function validateGenerateBody(body) {
  const errors = [];
  const n = num(body.n, 'n', errors, 5, 200);
  const totalCpu = num(body.totalCpu, 'totalCpu', errors, 1, 512);
  const totalMemory = num(body.totalMemory, 'totalMemory', errors, 1, 2048);
  const numServers = num(body.numServers, 'numServers', errors, 1, 8);
  const seed = num(body.seed, 'seed', errors, 0, 999999999);

  const cpuMin = num(body.cpuMin, 'cpuMin', errors, 1, 128);
  const cpuMax = num(body.cpuMax, 'cpuMax', errors, 1, 128);
  const memoryMin = num(body.memoryMin, 'memoryMin', errors, 1, 512);
  const memoryMax = num(body.memoryMax, 'memoryMax', errors, 1, 512);
  const durationMin = num(body.durationMin, 'durationMin', errors, 1, 100);
  const durationMax = num(body.durationMax, 'durationMax', errors, 1, 100);
  const deadlineMin = num(body.deadlineMin, 'deadlineMin', errors, 1, 500);
  const deadlineMax = num(body.deadlineMax, 'deadlineMax', errors, 1, 500);
  const priorityMin = num(body.priorityMin, 'priorityMin', errors, 1, 10);
  const priorityMax = num(body.priorityMax, 'priorityMax', errors, 1, 10);

  if (cpuMin > cpuMax) errors.push('cpuMin must be ≤ cpuMax');
  if (memoryMin > memoryMax) errors.push('memoryMin must be ≤ memoryMax');
  if (durationMin > durationMax) errors.push('durationMin must be ≤ durationMax');
  if (deadlineMin > deadlineMax) errors.push('deadlineMin must be ≤ deadlineMax');
  if (priorityMin > priorityMax) errors.push('priorityMin must be ≤ priorityMax');

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    params: {
      n,
      totalCpu,
      totalMemory,
      numServers,
      seed,
      cpuMin,
      cpuMax,
      memoryMin,
      memoryMax,
      durationMin,
      durationMax,
      deadlineMin,
      deadlineMax,
      priorityMin,
      priorityMax,
    },
  };
}

function validateRunBody(body) {
  const errors = [];
  const gen = validateGenerateBody(body.config || body);
  if (!gen.ok) return gen;

  const jobs = body.jobs;
  if (!Array.isArray(jobs) || jobs.length === 0) {
    errors.push('jobs must be a non-empty array');
    return { ok: false, errors };
  }
  if (jobs.length > 200) {
    errors.push('jobs length must be at most 200');
    return { ok: false, errors };
  }

  const normalized = [];
  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i];
    const id = num(j.id, `jobs[${i}].id`, errors, 1, 100000);
    const arrivalTime = num(j.arrivalTime, `jobs[${i}].arrivalTime`, errors, 0, 10000);
    const cpu = num(j.cpu, `jobs[${i}].cpu`, errors, 1, 128);
    const memory = num(j.memory, `jobs[${i}].memory`, errors, 1, 512);
    const duration = num(j.duration, `jobs[${i}].duration`, errors, 1, 100);
    const deadline = num(j.deadline, `jobs[${i}].deadline`, errors, 1, 10000);
    const priority = num(j.priority, `jobs[${i}].priority`, errors, 1, 10);
    if (errors.length) break;
    normalized.push({ id, arrivalTime, cpu, memory, duration, deadline, priority });
  }

  if (errors.length) return { ok: false, errors };

  const { totalCpu, totalMemory, numServers } = gen.params;
  const serverCpu = Math.max(1, Math.floor(totalCpu / numServers));
  const serverMemory = Math.max(1, Math.floor(totalMemory / numServers));

  return {
    ok: true,
    jobs: normalized,
    config: {
      ...gen.params,
      serverCpu,
      serverMemory,
    },
  };
}

function num(value, name, errors, min, max) {
  const x = Number(value);
  if (!Number.isFinite(x) || !Number.isInteger(x)) {
    errors.push(`${name} must be an integer`);
    return NaN;
  }
  if (x < min || x > max) {
    errors.push(`${name} must be between ${min} and ${max}`);
  }
  return x;
}

module.exports = { validateGenerateBody, validateRunBody, ALGORITHMS };
