/**
 * ============================================================================
 * ALGORITHM 4: 0/1 KNAPSACK DYNAMIC PROGRAMMING SCHEDULER
 * ============================================================================
 * 
 * DAA PARADIGM: Dynamic Programming (Bottom-Up Tabulation) + Backtracking
 * 
 * TIME COMPLEXITY:  O(n * C)
 *   - Where n = number of jobs, C = total cluster CPU capacity.
 *   - Filling the 2D table of size (n + 1) * (C + 1) takes O(n * C) operations.
 *   - Backtracking takes O(n).
 *   - Note: This is pseudo-polynomial time because it depends on numeric capacity C.
 * 
 * SPACE COMPLEXITY: O(n * C)
 *   - 2D table DP[n + 1][C + 1] to store optimal subproblem solutions.
 * 
 * ----------------------------------------------------------------------------
 * MATHEMATICAL RECURRENCE RELATION (MEMORIZE FOR VIVA):
 * ----------------------------------------------------------------------------
 * Let DP[i][w] = Maximum priority using a subset of first 'i' jobs with CPU <= w.
 * 
 * Base Case:
 *   DP[0][w] = 0  for all w (0 jobs yields 0 priority)
 *   DP[i][0] = 0  for all i (0 capacity holds 0 jobs)
 * 
 * Recurrence Step (for job i with cpu_i and priority_i):
 *   Case 1: If job i is too large (cpu_i > w)
 *     DP[i][w] = DP[i - 1][w]                           (Cannot include job i)
 * 
 *   Case 2: If job i fits (cpu_i <= w)
 *     DP[i][w] = max(
 *       DP[i - 1][w],                                    (Option A: Exclude job i)
 *       DP[i - 1][w - cpu_i] + priority_i               (Option B: Include job i)
 *     )
 * 
 * ----------------------------------------------------------------------------
 * HOW TO EXPLAIN TO YOUR TEACHER (VIVA NOTES):
 * ----------------------------------------------------------------------------
 * 1. "0/1 Knapsack exhibits Optimal Substructure and Overlapping Subproblems."
 * 2. "We build a 2D table row-by-row (bottom-up tabulation)."
 * 3. "After filling the table, the optimal value is found at DP[n][totalCpu]."
 * 4. "How do we find WHICH jobs were chosen?"
 *      - "We backtrack from cell (n, totalCpu)."
 *      - "If DP[i][w] != DP[i - 1][w], job i was included! We add job i to our
 *         solution, subtract its CPU: w = w - cpu_i, and move to i - 1."
 *      - "Otherwise, job i was excluded; we simply move to i - 1."
 * 5. "Once the optimal subset is chosen, we schedule them on cluster servers."
 * ============================================================================
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

  // STEP 1: Initialize 2D DP table: rows = jobs (0..n), columns = CPU capacity (0..capCpu)
  // dp[i][w] stores the optimal priority using first i jobs with CPU <= w
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

  // STEP 2: Bottom-Up Tabulation (Fill the 2D DP Table)
  const MAX_DP_TRACE = 350;
  const shouldTraceEveryCell = (n * capCpu) <= 400;

  for (let i = 1; i <= n; i++) {
    const job = jobs[i - 1]; // Current job under consideration (0-indexed)

    for (let w = 0; w <= capCpu; w++) {
      // Option A: Do NOT include job i (inherit solution from previous row)
      let bestPriority = dp[i - 1][w];
      let bestMemory = dpMem[i - 1][w];
      let tookJob = false;

      // Option B: Check if job i fits within capacity w AND memory limit
      if (job.cpu <= w) {
        const remainingCapacity = w - job.cpu;
        const candidateMemory = dpMem[i - 1][remainingCapacity] + job.memory;

        if (candidateMemory <= capMem) {
          const candidatePriority = dp[i - 1][remainingCapacity] + job.priority;

          // If taking job i yields strictly greater priority, take it!
          if (candidatePriority > bestPriority) {
            bestPriority = candidatePriority;
            bestMemory = candidateMemory;
            tookJob = true;
          }
        }
      }

      // Store optimal value in cell
      dp[i][w] = bestPriority;
      dpMem[i][w] = bestMemory;
      keep[i][w] = tookJob;

      // Record visual trace step for animation
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

  // STEP 3: Backtracking to Reconstruct Optimal Job Subset
  let currentCapacity = capCpu;
  const chosenJobs = [];
  const backtrackPath = [];

  for (let i = n; i >= 1; i--) {
    backtrackPath.push({ i, w: currentCapacity, took: keep[i][currentCapacity] });

    if (keep[i][currentCapacity]) {
      // Job i was included! Add to chosen list
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

      currentCapacity -= job.cpu; // Deduct capacity
    } else {
      // Job i was not included; move to row i - 1
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

  // Reverse chosen jobs to restore original arrival order
  chosenJobs.reverse();

  trace.push({
    action: 'knapsack_done',
    message: `0/1 Knapsack Optimal Selection: ${chosenJobs.length} of ${n} jobs selected (Max Priority: ${dp[n][capCpu]}, CPU Used: ${capCpu - currentCapacity}/${capCpu})`,
    chosenIds: chosenJobs.map((j) => j.id),
    highlightJobId: null,
    servers: snapshotServers(servers),
  });

  // STEP 4: Schedule the optimal subset on cluster servers
  const assignments = [];
  let rejectedCount = jobs.length - chosenJobs.length;
  const chosenJobIdSet = new Set(chosenJobs.map((j) => j.id));

  // Trace rejected jobs
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

  // Sort chosen jobs by arrival time for placement
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
