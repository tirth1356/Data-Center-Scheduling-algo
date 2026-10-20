function createServers(numServers) {
  return Array.from({ length: numServers }, (_, i) => ({
    id: i + 1,
    freeTime: 0,
    timeline: [],
  }));
}

function snapshotServers(servers) {
  return servers.map((s) => ({
    id: s.id,
    freeTime: s.freeTime,
    timeline: s.timeline.map((t) => ({ ...t })),
  }));
}

function placeOnServer(server, job, serverCpu, serverMemory) {
  if (job.cpu > serverCpu || job.memory > serverMemory) return null;
  const startTime = Math.max(job.arrivalTime, server.freeTime);
  const endTime = startTime + job.duration;
  const block = {
    jobId: job.id,
    startTime,
    endTime,
    cpu: job.cpu,
    memory: job.memory,
  };
  server.timeline.push(block);
  server.freeTime = endTime;
  return {
    jobId: job.id,
    serverId: server.id,
    startTime,
    endTime,
    waitTime: startTime - job.arrivalTime,
    missedDeadline: endTime > job.deadline,
    priority: job.priority,
  };
}

function computeMetrics(assignments, jobs, servers, config, rejected) {
  const completed = assignments.length;
  const totalPriority = assignments.reduce((sum, a) => sum + a.priority, 0);
  const avgWait =
    completed === 0
      ? 0
      : assignments.reduce((sum, a) => sum + a.waitTime, 0) / completed;
  const deadlineMisses = assignments.filter((a) => a.missedDeadline).length + rejected;

  let busyTime = 0;
  let horizon = 0;
  for (const s of servers) {
    for (const block of s.timeline) {
      busyTime += block.endTime - block.startTime;
      horizon = Math.max(horizon, block.endTime);
    }
  }
  const utilization =
    horizon === 0 || config.numServers === 0
      ? 0
      : busyTime / (horizon * config.numServers);
  const serverCpu = config.serverCpu || Math.max(1, Math.floor(config.totalCpu / (config.numServers || 1)));
  const serverMemory = config.serverMemory || Math.max(1, Math.floor(config.totalMemory / (config.numServers || 1)));

  // Novel Idea: Data Center Power & Energy Consumption Model
  // P_idle = 120W per active server, P_dyn = up to 180W scaled by CPU/mem load
  let totalEnergyWh = 0;
  for (const s of servers) {
    if (s.timeline.length > 0) {
      const serverActiveHorizon = Math.max(...s.timeline.map((b) => b.endTime), 0);
      totalEnergyWh += (120 * serverActiveHorizon * 10) / 3600; // 1 unit = 10s
      for (const b of s.timeline) {
        const load = 0.65 * (b.cpu / serverCpu) + 0.35 * (b.memory / serverMemory);
        const dynPower = 180 * Math.min(1.0, load);
        totalEnergyWh += (dynPower * (b.endTime - b.startTime) * 10) / 3600;
      }
    }
  }
  const totalEnergyKwh = round2(totalEnergyWh / 1000);
  const energyEfficiency = round2(totalPriority / Math.max(totalEnergyKwh, 0.001));
  const carbonKg = round2(totalEnergyKwh * 0.42);

  return {
    jobsCompleted: completed,
    jobsTotal: jobs.length,
    rejected,
    totalPriority,
    averageWaitTime: round2(avgWait),
    serverUtilization: round2(utilization),
    deadlineMisses,
    makespan: horizon,
    totalEnergyKwh,
    energyEfficiency,
    carbonKg,
  };
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

function rebuildServersFromAssignments(numServers, assignments, jobsById) {
  const servers = createServers(numServers);
  for (const a of assignments) {
    const job = jobsById.get(a.jobId);
    const server = servers[a.serverId - 1];
    server.timeline.push({
      jobId: a.jobId,
      startTime: a.startTime,
      endTime: a.endTime,
      cpu: job?.cpu ?? 0,
      memory: job?.memory ?? 0,
    });
    server.freeTime = Math.max(server.freeTime, a.endTime);
  }
  return servers;
}

module.exports = {
  createServers,
  snapshotServers,
  placeOnServer,
  computeMetrics,
  rebuildServersFromAssignments,
  round2,
};
