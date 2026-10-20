/**
 * First-Come First-Served (FCFS) Workload Scheduler
 * Processes jobs in arrival order, assigning each onto the first available server.
 * Time Complexity: O(n log n + n * s) | Space Complexity: O(n + s)
 */

const {
  createServers,
  snapshotServers,
  placeOnServer,
  computeMetrics,
} = require('./metrics');

function fcfs(jobs, config) {
  const { numServers, serverCpu, serverMemory } = config;

  // Step 1: Sort jobs by arrival time (tie-breaker: job ID)
  const sortedJobs = [...jobs].sort(
    (a, b) => a.arrivalTime - b.arrivalTime || a.id - b.id
  );

  // Step 2: Initialize server states
  const servers = createServers(numServers);
  const assignments = [];
  const trace = [];
  let rejectedCount = 0;

  trace.push({
    action: 'init',
    message: `FCFS initialized with ${sortedJobs.length} jobs across ${numServers} server nodes.`,
    servers: snapshotServers(servers),
    highlightJobId: null,
  });

  // Step 3: Iterate through jobs in arrival order
  for (const currentJob of sortedJobs) {
    trace.push({
      action: 'consider',
      message: `Evaluating Job ${currentJob.id} (Arrival: ${currentJob.arrivalTime}, CPU: ${currentJob.cpu}, RAM: ${currentJob.memory}GB)`,
      jobId: currentJob.id,
      highlightJobId: currentJob.id,
      servers: snapshotServers(servers),
    });

    // Check if job exceeds server capacity
    if (currentJob.cpu > serverCpu || currentJob.memory > serverMemory) {
      rejectedCount += 1;
      trace.push({
        action: 'reject',
        message: `Job ${currentJob.id} rejected: exceeds node limits (needs CPU ${currentJob.cpu}/${serverCpu}, RAM ${currentJob.memory}/${serverMemory}GB)`,
        jobId: currentJob.id,
        highlightJobId: currentJob.id,
        servers: snapshotServers(servers),
      });
      continue;
    }

    // Assign to server that can start this job earliest
    const selectedServer = servers.reduce((best, s) =>
      Math.max(s.freeTime, currentJob.arrivalTime) < Math.max(best.freeTime, currentJob.arrivalTime) ? s : best
    );

    // Place job on selected server
    const assignment = placeOnServer(selectedServer, currentJob, serverCpu, serverMemory);
    assignments.push(assignment);

    trace.push({
      action: 'place',
      message: `Assigned Job ${currentJob.id} to Server ${selectedServer.id} [Start: ${assignment.startTime}, End: ${assignment.endTime})`,
      jobId: currentJob.id,
      serverId: selectedServer.id,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      highlightJobId: currentJob.id,
      servers: snapshotServers(servers),
    });
  }

  // Step 4: Compute metrics
  const metrics = computeMetrics(assignments, sortedJobs, servers, config, rejectedCount);

  trace.push({
    action: 'done',
    message: `FCFS scheduling complete: ${metrics.jobsCompleted}/${jobs.length} jobs scheduled.`,
    metrics,
    servers: snapshotServers(servers),
    highlightJobId: null,
  });

  return {
    algorithm: 'fcfs',
    assignments,
    metrics,
    trace,
  };
}

module.exports = { fcfs };
