const express = require('express');
const path = require('path');
const { generateJobs } = require('./algorithms/generator');
const { validateGenerateBody, validateRunBody } = require('./algorithms/validate');
const { ALGORITHMS, COMPLEXITY, runAlgorithm } = require('./algorithms/index');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/algorithms', (_req, res) => {
  res.json({
    algorithms: Object.entries(ALGORITHMS).map(([id, meta]) => ({
      id,
      label: meta.label,
      maxN: meta.maxN,
    })),
    complexity: COMPLEXITY,
  });
});

app.post('/api/generate-jobs', (req, res) => {
  const check = validateGenerateBody(req.body);
  if (!check.ok) {
    return res.status(400).json({ error: 'Validation failed', details: check.errors });
  }
  const jobs = generateJobs(check.params);
  const { totalCpu, totalMemory, numServers } = check.params;
  res.json({
    jobs,
    config: {
      ...check.params,
      serverCpu: Math.max(1, Math.floor(totalCpu / numServers)),
      serverMemory: Math.max(1, Math.floor(totalMemory / numServers)),
    },
  });
});

function runWithTiming(id, jobs, config) {
  const start = process.hrtime.bigint();
  const result = runAlgorithm(id, jobs, config);
  const end = process.hrtime.bigint();
  result.runtimeMs = Number(end - start) / 1e6;
  return result;
}

app.post('/api/run/:algorithmId', (req, res) => {
  const { algorithmId } = req.params;
  if (!ALGORITHMS[algorithmId]) {
    return res.status(404).json({ error: 'Unknown algorithm', details: [`${algorithmId}`] });
  }
  const check = validateRunBody(req.body);
  if (!check.ok) {
    return res.status(400).json({ error: 'Validation failed', details: check.errors });
  }
  const result = runWithTiming(algorithmId, check.jobs, check.config);
  if (result.error) {
    return res.status(400).json({ error: result.error, ...result });
  }
  res.json(result);
});

app.post('/api/compare', (req, res) => {
  const check = validateRunBody(req.body);
  if (!check.ok) {
    return res.status(400).json({ error: 'Validation failed', details: check.errors });
  }
  const results = {};
  for (const id of Object.keys(ALGORITHMS)) {
    const result = runWithTiming(id, check.jobs, check.config);
    results[id] = {
      label: ALGORITHMS[id].label,
      runtimeMs: result.runtimeMs,
      metrics: result.metrics,
      error: result.error || null,
    };
  }
  res.json({ results });
});

app.post('/api/benchmark', (req, res) => {
  const ns = req.body.ns;
  const algorithmIds = req.body.algorithms;
  const baseConfig = req.body.config;

  if (!Array.isArray(ns) || ns.length === 0 || ns.length > 10) {
    return res.status(400).json({ error: 'Validation failed', details: ['ns: array of 1–10 values'] });
  }
  const check = validateGenerateBody(baseConfig || {});
  if (!check.ok) {
    return res.status(400).json({ error: 'Validation failed', details: check.errors });
  }

  const ids =
    Array.isArray(algorithmIds) && algorithmIds.length
      ? algorithmIds.filter((id) => ALGORITHMS[id])
      : Object.keys(ALGORITHMS);

  const series = {};
  for (const id of ids) {
    series[id] = { label: ALGORITHMS[id].label, points: [] };
  }

  for (const n of ns) {
    const nInt = Number(n);
    if (!Number.isInteger(nInt) || nInt < 5 || nInt > 200) {
      return res.status(400).json({ error: 'Validation failed', details: ['each n must be 5–200'] });
    }
    const params = { ...check.params, n: nInt };
    const jobs = generateJobs(params);
    const config = {
      ...params,
      serverCpu: Math.max(1, Math.floor(params.totalCpu / params.numServers)),
      serverMemory: Math.max(1, Math.floor(params.totalMemory / params.numServers)),
    };

    for (const id of ids) {
      if (nInt > ALGORITHMS[id].maxN) {
        series[id].points.push({ n: nInt, runtimeMs: null, skipped: true });
        continue;
      }
      const result = runWithTiming(id, jobs, config);
      series[id].points.push({ n: nInt, runtimeMs: result.runtimeMs, skipped: false });
    }
  }

  res.json({ series, complexity: COMPLEXITY });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Data Center Workload Optimizer listening on http://localhost:${PORT}`);
});
