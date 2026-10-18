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

    let placed = false;
    for (const server of servers) {
      if (job.cpu > serverCpu || job.memory > serverMemory) {
        trace.push({
          action: 'skip_server',
          message: `Server ${server.id}: insufficient capacity for job ${job.id}`,
          jobId: job.id,
          serverId: server.id,
          highlightJobId: job.id,
          servers: snapshotServers(servers),
        });
        continue;
      }

      const assignment = placeOnServer(server, job, serverCpu, serverMemory);
      assignments.push(assignment);

      trace.push({
        action: 'place',
        message: `Place job ${job.id} on server ${server.id} [${assignment.startTime}, ${assignment.endTime})`,
        jobId: job.id,
        serverId: server.id,
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        highlightJobId: job.id,
        servers: snapshotServers(servers),
      });

      placed = true;
      break;
    }

    if (!placed) {
      rejected += 1;
      trace.push({
        action: 'reject',
        message: `No server can run job ${job.id}`,
        jobId: job.id,
        highlightJobId: job.id,
        servers: snapshotServers(servers),
      });
    }
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
