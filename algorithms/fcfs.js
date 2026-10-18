const {
  createServers,
  snapshotServers,
  placeOnServer,
  computeMetrics,
} = require('./metrics');

/**
 * FCFS: process jobs in arrival order; assign each to the first server with capacity.
 */
function fcfs(jobs, config) {
  const { numServers, serverCpu, serverMemory } = config;
  const sorted = [...jobs].sort((a, b) => a.arrivalTime - b.arrivalTime || a.id - b.id);

  const servers = createServers(numServers);

  const trace = [];
  const assignments = [];
  let rejected = 0;

  trace.push({
    action: 'init',
    message: `FCFS: ${sorted.length} jobs, ${numServers} server(s), ${serverCpu} CPU / ${serverMemory} GB each`,
    servers: snapshotServers(servers),
    highlightJobId: null,
  });

  for (const job of sorted) {
    trace.push({
      action: 'consider',
      message: `Consider job ${job.id} (arrival ${job.arrivalTime}, CPU ${job.cpu}, mem ${job.memory})`,
      jobId: job.id,
      highlightJobId: job.id,
      servers: snapshotServers(servers),
    });

    if (job.cpu > serverCpu || job.memory > serverMemory) {
      rejected += 1;
      trace.push({
        action: 'reject',
        message: `Job ${job.id} exceeds per-node capacity (needs CPU ${job.cpu}, RAM ${job.memory}GB)`,
        jobId: job.id,
        highlightJobId: job.id,
        servers: snapshotServers(servers),
      });
      continue;
    }

    // Assign to first server with room at arrival time, or earliest freeing server
    let targetServer = null;
    for (const server of servers) {
      if (server.freeTime <= job.arrivalTime) {
        targetServer = server;
        break;
      }
    }
    if (!targetServer) {
      targetServer = servers.reduce((earliest, s) => s.freeTime < earliest.freeTime ? s : earliest, servers[0]);
    }

    const assignment = placeOnServer(targetServer, job, serverCpu, serverMemory);
    assignments.push(assignment);

    trace.push({
      action: 'place',
      message: `Place job ${job.id} on server ${targetServer.id} [${assignment.startTime}, ${assignment.endTime})`,
      jobId: job.id,
      serverId: targetServer.id,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      highlightJobId: job.id,
      servers: snapshotServers(servers),
    });
  }

  const metrics = computeMetrics(assignments, sorted, servers, config, rejected);

  trace.push({
    action: 'done',
    message: 'FCFS complete',
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
