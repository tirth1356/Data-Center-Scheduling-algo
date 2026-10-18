const {
  createServers,
  snapshotServers,
  placeOnServer,
  computeMetrics,
} = require('./metrics');

/**
 * 0/1 Knapsack DP:
 * Uses a true 2D DP table: rows = job index (0..n), columns = capacity (0..W),
 * maximizing total priority within CPU and memory capacity.
 * Reconstructs the chosen set by backtracking through the table.
 */
function knapsackSchedule(jobs, config) {
  const capCpu = config.totalCpu;
  const capMem = config.totalMemory;
  const { numServers, serverCpu, serverMemory } = config;
  const n = jobs.length;

  // dp[i][w] = max priority using subset of jobs 1..i with CPU <= w
  const dp = Array.from({ length: n + 1 }, () => Array(capCpu + 1).fill(0));
  const dpMem = Array.from({ length: n + 1 }, () => Array(capCpu + 1).fill(0));
  const keep = Array.from({ length: n + 1 }, () => Array(capCpu + 1).fill(false));

  const trace = [];
  const servers = createServers(numServers);

  trace.push({
    action: 'init',
    message: `0/1 Knapsack DP initialized: 2D table [jobs 0..${n}][capacity 0..${capCpu}], memory limit=${capMem}GB`,
    servers: snapshotServers(servers),
    dpSize: { rows: n + 1, cols: capCpu + 1 },
    highlightJobId: null,
  });

  const MAX_DP_TRACE = 350;
  const shouldTraceEveryCell = (n * capCpu) <= 400;

  for (let i = 1; i <= n; i++) {
    const job = jobs[i - 1];

    for (let w = 0; w <= capCpu; w++) {
      let bestVal = dp[i - 1][w];
      let bestMem = dpMem[i - 1][w];
      let took = false;

      if (job.cpu <= w) {
        const remCpu = w - job.cpu;
        const candMem = dpMem[i - 1][remCpu] + job.memory;
        if (candMem <= capMem) {
          const candVal = dp[i - 1][remCpu] + job.priority;
          if (candVal > bestVal) {
            bestVal = candVal;
            bestMem = candMem;
            took = true;
          }
        }
      }

      dp[i][w] = bestVal;
      dpMem[i][w] = bestMem;
      keep[i][w] = took;

      if (trace.length < MAX_DP_TRACE && (shouldTraceEveryCell || took || w === capCpu)) {
        trace.push({
          action: 'dp_fill',
          message: took
            ? `Cell [J${job.id}][cap ${w}]: TAKE Job ${job.id} (priority ${bestVal}, CPU ${job.cpu}, mem ${job.memory})`
            : `Cell [J${job.id}][cap ${w}]: SKIP Job ${job.id} (keep ${bestVal})`,
          i,
          w,
          value: bestVal,
          took,
          jobId: job.id,
          highlightJobId: took ? job.id : null,
          servers: snapshotServers(servers),
        });
      }
    }
  }

  // Backtracking to find chosen jobs
  let curW = capCpu;
  const chosen = [];
  const backtrackPath = [];

  for (let i = n; i >= 1; i--) {
    backtrackPath.push({ i, w: curW, took: keep[i][curW] });
    if (keep[i][curW]) {
      const job = jobs[i - 1];
      chosen.push(job);
      trace.push({
        action: 'dp_backtrack',
        message: `Backtrack: Job ${job.id} was TAKEN at capacity ${curW}. New remaining capacity = ${curW - job.cpu}`,
        i,
        w: curW,
        jobId: job.id,
        highlightJobId: job.id,
        servers: snapshotServers(servers),
      });
      curW -= job.cpu;
    } else {
      trace.push({
        action: 'dp_backtrack',
        message: `Backtrack: Job ${jobs[i - 1].id} was SKIPPED at capacity ${curW}`,
        i,
        w: curW,
        jobId: jobs[i - 1].id,
        highlightJobId: null,
        servers: snapshotServers(servers),
      });
    }
  }
  chosen.reverse();

  trace.push({
    action: 'knapsack_done',
    message: `Knapsack optimal subset: ${chosen.length} of ${n} jobs (Total Priority: ${dp[n][capCpu]}, CPU used: ${capCpu - curW}/${capCpu})`,
    chosenIds: chosen.map((j) => j.id),
    highlightJobId: null,
    servers: snapshotServers(servers),
  });

  // Schedule chosen jobs on servers (earliest-free placement)
  const assignments = [];
  let rejected = jobs.length - chosen.length;
  const chosenSet = new Set(chosen.map((j) => j.id));

  for (const job of jobs) {
    if (!chosenSet.has(job.id)) {
      trace.push({
        action: 'reject',
        message: `Job ${job.id} excluded by 0/1 knapsack optimal solution`,
        jobId: job.id,
        highlightJobId: job.id,
        servers: snapshotServers(servers),
      });
    }
  }

  const scheduleOrder = [...chosen].sort(
    (a, b) => a.arrivalTime - b.arrivalTime || b.priority - a.priority || a.id - b.id
  );

  for (const job of scheduleOrder) {
    trace.push({
      action: 'consider',
      message: `Schedule chosen job ${job.id} (priority ${job.priority})`,
      jobId: job.id,
      highlightJobId: job.id,
      servers: snapshotServers(servers),
    });

    let best = null;
    for (const server of servers) {
      if (job.cpu > serverCpu || job.memory > serverMemory) continue;
      const startTime = Math.max(job.arrivalTime, server.freeTime);
      if (!best || startTime < best.startTime || (startTime === best.startTime && server.id < best.server.id)) {
        best = { server, startTime };
      }
    }

    if (!best) {
      rejected += 1;
      trace.push({
        action: 'reject',
        message: `Cannot place knapsack job ${job.id} on any server (exceeds per-server limits)`,
        jobId: job.id,
        highlightJobId: job.id,
        servers: snapshotServers(servers),
      });
      continue;
    }

    const assignment = placeOnServer(best.server, job, serverCpu, serverMemory);
    assignments.push(assignment);
    trace.push({
      action: 'place',
      message: `Place job ${job.id} on server ${best.server.id} [${assignment.startTime}, ${assignment.endTime})`,
      jobId: job.id,
      serverId: best.server.id,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      highlightJobId: job.id,
      servers: snapshotServers(servers),
    });
  }

  // Prepare table slice for UI visualization (max 24 columns, max 25 rows for clean display)
  const displayCols = Math.min(capCpu + 1, 25);
  const displayRows = Math.min(n + 1, 26);
  const tableSlice = [];
  for (let r = 0; r < displayRows; r++) {
    tableSlice.push(dp[r].slice(0, displayCols));
  }

  const metrics = computeMetrics(assignments, jobs, servers, config, rejected);
  trace.push({
    action: 'done',
    message: '0/1 Knapsack scheduling completed',
    metrics,
    servers: snapshotServers(servers),
    finalDp: tableSlice,
    dpMeta: {
      totalRows: n + 1,
      totalCols: capCpu + 1,
      backtrackPath,
      optimalValue: dp[n][capCpu],
    },
  });

  return {
    algorithm: 'knapsack',
    assignments,
    metrics,
    trace,
    knapsackValue: dp[n][capCpu],
    finalDp: tableSlice,
    backtrackPath,
  };
}

module.exports = { knapsackSchedule };
