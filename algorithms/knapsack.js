/**
 * 0/1 Knapsack Dynamic Programming Scheduler
 * Uses a 2D DP table over jobs and CPU capacity to maximize total priority,
 * followed by backtracking to reconstruct the optimal subset.
 * Time Complexity: O(n * C) | Space Complexity: O(n * C)
 */

const {
  createServers,
  snapshotServers,
  placeOnServer,
  computeMetrics,
} = require('./metrics');

function knapsackSchedule(jobs, config) {
  const capCpu = config.totalCpu;
  const capMem = config.totalMemory;
  const { numServers, serverCpu, serverMemory } = config;
  const n = jobs.length;

  // Step 1: Initialize 2D DP table
  // dp[i][w] = maximum priority using first i jobs with CPU capacity <= w
  const dp = Array.from({ length: n + 1 }, () => Array(capCpu + 1).fill(0));
  const dpMem = Array.from({ length: n + 1 }, () => Array(capCpu + 1).fill(0));
  const keep = Array.from({ length: n + 1 }, () => Array(capCpu + 1).fill(false));

  const trace = [];
  const servers = createServers(numServers);

  trace.push({
    action: 'init',
    message: `0/1 Knapsack DP initialized: 2D Table [Jobs 0..${n}][CPU Capacity 0..${capCpu}], Memory Limit = ${capMem}GB.`,
    servers: snapshotServers(servers),
    dpSize: { rows: n + 1, cols: capCpu + 1 },
    highlightJobId: null,
  });

  // Step 2: Fill the DP table (Bottom-Up Tabulation)
  const MAX_DP_TRACE = 350;
  const shouldTraceEveryCell = (n * capCpu) <= 400;

  for (let i = 1; i <= n; i++) {
    const job = jobs[i - 1]; // Current job (0-indexed)

    for (let w = 0; w <= capCpu; w++) {
      // Option A: Exclude job i (inherit value from previous row)
      let bestPriority = dp[i - 1][w];
      let bestMemory = dpMem[i - 1][w];
      let tookJob = false;

      // Option B: Include job i if it fits within CPU and RAM capacity
      if (job.cpu <= w) {
        const remainingCapacity = w - job.cpu;
        const candidateMemory = dpMem[i - 1][remainingCapacity] + job.memory;

        if (candidateMemory <= capMem) {
          const candidatePriority = dp[i - 1][remainingCapacity] + job.priority;

          if (candidatePriority > bestPriority) {
            bestPriority = candidatePriority;
            bestMemory = candidateMemory;
            tookJob = true;
          }
        }
      }

      dp[i][w] = bestPriority;
      dpMem[i][w] = bestMemory;
      keep[i][w] = tookJob;

      if (trace.length < MAX_DP_TRACE && (shouldTraceEveryCell || tookJob || w === capCpu)) {
        trace.push({
          action: 'dp_fill',
          message: tookJob
            ? `DP[J${job.id}][cap ${w}] = ${bestPriority} (INCLUDED Job ${job.id}: +${job.priority} prio, CPU ${job.cpu}, RAM ${job.memory}GB)`
            : `DP[J${job.id}][cap ${w}] = ${bestPriority} (EXCLUDED Job ${job.id})`,
          i,
          w,
          value: bestPriority,
          took: tookJob,
          jobId: job.id,
          highlightJobId: tookJob ? job.id : null,
          servers: snapshotServers(servers),
        });
      }
    }
  }

  // Step 3: Backtrack from (n, capCpu) to find chosen jobs
  let currentCapacity = capCpu;
  const chosenJobs = [];
  const backtrackPath = [];

  for (let i = n; i >= 1; i--) {
    backtrackPath.push({ i, w: currentCapacity, took: keep[i][currentCapacity] });

    if (keep[i][currentCapacity]) {
      const job = jobs[i - 1];
      chosenJobs.push(job);

      trace.push({
        action: 'dp_backtrack',
        message: `Backtrack: Job ${job.id} was SELECTED (Prio ${job.priority}). Remaining capacity: ${currentCapacity} - ${job.cpu} = ${currentCapacity - job.cpu}`,
        i,
        w: currentCapacity,
        jobId: job.id,
        highlightJobId: job.id,
        servers: snapshotServers(servers),
      });

      currentCapacity -= job.cpu;
    } else {
      trace.push({
        action: 'dp_backtrack',
        message: `Backtrack: Job ${jobs[i - 1].id} was SKIPPED. Capacity remains ${currentCapacity}`,
        i,
        w: currentCapacity,
        jobId: jobs[i - 1].id,
        highlightJobId: null,
        servers: snapshotServers(servers),
      });
    }
  }

  chosenJobs.reverse();

  trace.push({
    action: 'knapsack_done',
    message: `0/1 Knapsack Optimal Selection: ${chosenJobs.length} of ${n} jobs selected (Max Priority: ${dp[n][capCpu]}, CPU Used: ${capCpu - currentCapacity}/${capCpu})`,
    chosenIds: chosenJobs.map((j) => j.id),
    highlightJobId: null,
    servers: snapshotServers(servers),
  });

  // Step 4: Schedule chosen jobs on servers
  const assignments = [];
  let rejectedCount = jobs.length - chosenJobs.length;
  const chosenJobIdSet = new Set(chosenJobs.map((j) => j.id));

  for (const job of jobs) {
    if (!chosenJobIdSet.has(job.id)) {
      trace.push({
        action: 'reject',
        message: `Job ${job.id} rejected: not in the optimal 0/1 knapsack subset.`,
        jobId: job.id,
        highlightJobId: job.id,
        servers: snapshotServers(servers),
      });
    }
  }

  const scheduleOrder = [...chosenJobs].sort(
    (a, b) => a.arrivalTime - b.arrivalTime || b.priority - a.priority || a.id - b.id
  );

  for (const job of scheduleOrder) {
    trace.push({
      action: 'consider',
      message: `Scheduling Knapsack-Selected Job ${job.id} (Priority ${job.priority})`,
      jobId: job.id,
      highlightJobId: job.id,
      servers: snapshotServers(servers),
    });

    let bestServer = null;
    for (const server of servers) {
      if (job.cpu > serverCpu || job.memory > serverMemory) continue;
      const startTime = Math.max(job.arrivalTime, server.freeTime);
      if (!bestServer || startTime < bestServer.startTime || (startTime === bestServer.startTime && server.id < bestServer.server.id)) {
        bestServer = { server, startTime };
      }
    }

    if (!bestServer) {
      rejectedCount += 1;
      continue;
    }

    const assignment = placeOnServer(bestServer.server, job, serverCpu, serverMemory);
    assignments.push(assignment);

    trace.push({
      action: 'place',
      message: `Assigned Job ${job.id} to Server ${bestServer.server.id} [${assignment.startTime}, ${assignment.endTime})`,
      jobId: job.id,
      serverId: bestServer.server.id,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      highlightJobId: job.id,
      servers: snapshotServers(servers),
    });
  }

  // Format table slice for UI visualization
  const displayCols = Math.min(capCpu + 1, 25);
  const displayRows = Math.min(n + 1, 26);
  const tableSlice = [];
  for (let r = 0; r < displayRows; r++) {
    tableSlice.push(dp[r].slice(0, displayCols));
  }

  const metrics = computeMetrics(assignments, jobs, servers, config, rejectedCount);

  trace.push({
    action: 'done',
    message: `0/1 Knapsack scheduling complete: Total Priority = ${dp[n][capCpu]}`,
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
