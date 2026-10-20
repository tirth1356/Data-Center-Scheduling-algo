/**
 * Exact Branch and Bound Scheduler (n <= 12)
 * Explores assignment state space using Depth-First Search with upper-bound pruning.
 * Time Complexity: O(s^n) worst-case | Space Complexity: O(n * s)
 */

const {
  createServers,
  snapshotServers,
  computeMetrics,
  rebuildServersFromAssignments,
} = require('./metrics');

function branchAndBound(jobs, config) {
  const { numServers, serverCpu, serverMemory } = config;
  const n = jobs.length;

  if (n > 12) {
    return {
      algorithm: 'branchBound',
      error: 'Branch and bound requires n <= 12 jobs due to exponential O(s^n) complexity.',
      assignments: [],
      metrics: null,
      trace: [{ action: 'error', message: 'n must be <= 12 for Branch and Bound' }],
      pruneCount: 0,
    };
  }

  // Step 1: Precompute remaining priority suffix sums
  const orderedJobs = [...jobs].sort((a, b) => a.id - b.id);

  // remainingPriority[d] = sum of priorities from job d to n - 1
  const remainingPriority = Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    remainingPriority[i] = remainingPriority[i + 1] + orderedJobs[i].priority;
  }

  let bestPriorityFound = -1;
  let bestAssignments = [];
  let totalPrunedBranches = 0;
  const trace = [];
  const treeNodes = [];
  let nextNodeId = 0;

  trace.push({
    action: 'init',
    message: `Branch & Bound initialized: ${n} jobs across ${numServers} servers. Evaluating state-space search tree.`,
    servers: snapshotServers(createServers(numServers)),
    highlightJobId: null,
    treeNodes: [],
  });

  // Calculate optimistic upper bound for the current branch
  function calculateUpperBound(currentPriority, currentDepth) {
    return currentPriority + remainingPriority[currentDepth];
  }

  const MAX_TRACE = 700;
  function addTraceStep(step) {
    if (trace.length < MAX_TRACE) trace.push(step);
  }

  // Step 2: Depth-First Search (DFS) with Bounding
  function exploreStateSpace(depth, prioritySoFar, serverStates, currentAssignments, parentNodeId) {
    const optimisticUpperBound = calculateUpperBound(prioritySoFar, depth);

    // Prune branch if theoretical upper bound cannot beat best solution found so far
    if (optimisticUpperBound <= bestPriorityFound) {
      totalPrunedBranches += 1;
      treeNodes.push({
        id: nextNodeId++,
        parentId: parentNodeId,
        depth,
        label: `Prune ✂ (Bound ${optimisticUpperBound} <= Best ${bestPriorityFound})`,
        pruned: true,
      });

      addTraceStep({
        action: 'prune',
        message: `Pruned Subtree at Depth ${depth}: Upper Bound (${optimisticUpperBound}) <= Best (${bestPriorityFound})`,
        depth,
        pruneCount: totalPrunedBranches,
        highlightJobId: depth < n ? orderedJobs[depth].id : null,
        servers: snapshotFromStates(serverStates),
        treeNodes: snapshotTree(treeNodes),
      });
      return;
    }

    // Base case: all jobs considered
    if (depth === n) {
      if (prioritySoFar > bestPriorityFound) {
        bestPriorityFound = prioritySoFar;
        bestAssignments = currentAssignments.map((a) => ({ ...a }));

        addTraceStep({
          action: 'update_best',
          message: `New Best Solution Found! Total Priority = ${bestPriorityFound}`,
          priority: bestPriorityFound,
          highlightJobId: null,
          servers: snapshotFromStates(serverStates),
          treeNodes: snapshotTree(treeNodes),
        });
      }
      return;
    }

    // Recursive step: branch on current job
    const currentJob = orderedJobs[depth];
    const currentNodeId = nextNodeId++;

    treeNodes.push({
      id: currentNodeId,
      parentId: parentNodeId,
      depth,
      label: `Job ${currentJob.id} (Prio ${currentJob.priority})`,
      pruned: false,
    });

    addTraceStep({
      action: 'branch',
      message: `Branching on Job ${currentJob.id} at tree depth ${depth}`,
      jobId: currentJob.id,
      depth,
      nodeId: currentNodeId,
      highlightJobId: currentJob.id,
      servers: snapshotFromStates(serverStates),
      treeNodes: snapshotTree(treeNodes),
    });

    // Branch 1: Try assigning currentJob to each server (if it fits node limits)
    if (currentJob.cpu <= serverCpu && currentJob.memory <= serverMemory) {
      for (let serverIndex = 0; serverIndex < numServers; serverIndex++) {
        const serverState = serverStates[serverIndex];
        const startTime = Math.max(currentJob.arrivalTime, serverState.freeTime);
        const endTime = startTime + currentJob.duration;

        const nextServerStates = snapshotFromStates(serverStates);
        const targetServer = nextServerStates[serverIndex];
        targetServer.freeTime = endTime;
        targetServer.timeline.push({
          jobId: currentJob.id,
          startTime,
          endTime,
          cpu: currentJob.cpu,
          memory: currentJob.memory,
        });

        exploreStateSpace(
          depth + 1,
          prioritySoFar + currentJob.priority,
          nextServerStates,
          [
            ...currentAssignments,
            {
              jobId: currentJob.id,
              serverId: targetServer.id,
              startTime,
              endTime,
              waitTime: startTime - currentJob.arrivalTime,
              missedDeadline: endTime > currentJob.deadline,
              priority: currentJob.priority,
            },
          ],
          currentNodeId
        );
      }
    }

    // Branch 2: Exclude currentJob (pruning decision)
    exploreStateSpace(
      depth + 1,
      prioritySoFar,
      serverStates,
      currentAssignments,
      currentNodeId
    );
  }

  // Step 3: Run search from root node
  const initialServerStates = Array.from({ length: numServers }, (_, i) => ({
    id: i + 1,
    freeTime: 0,
    timeline: [],
  }));

  exploreStateSpace(0, 0, initialServerStates, [], -1);

  // Step 4: Rebuild final schedule
  const jobsById = new Map(jobs.map((j) => [j.id, j]));
  const finalServers = rebuildServersFromAssignments(numServers, bestAssignments, jobsById);
  const rejectedCount = jobs.length - bestAssignments.length;
  const metrics = computeMetrics(bestAssignments, jobs, finalServers, config, rejectedCount);

  trace.push({
    action: 'done',
    message: `Branch & Bound complete: Explored state space, Pruned ${totalPrunedBranches} subtrees, Best Priority = ${bestPriorityFound}`,
    metrics,
    pruneCount: totalPrunedBranches,
    servers: snapshotServers(finalServers),
    treeNodes: snapshotTree(treeNodes),
  });

  return {
    algorithm: 'branchBound',
    assignments: bestAssignments,
    metrics,
    trace,
    pruneCount: totalPrunedBranches,
  };
}

function snapshotFromStates(serverStates) {
  return serverStates.map((s) => ({
    id: s.id,
    freeTime: s.freeTime,
    timeline: s.timeline.map((t) => ({ ...t })),
  }));
}

function snapshotTree(treeNodes) {
  return treeNodes.slice(Math.max(0, treeNodes.length - 80)).map((n) => ({ ...n }));
}

module.exports = { branchAndBound };
