/**
 * ============================================================================
 * ALGORITHM 6: EXACT BRANCH AND BOUND SCHEDULER (n <= 12)
 * ============================================================================
 * 
 * DAA PARADIGM: State-Space Tree Search (DFS) with Upper-Bound Pruning
 * 
 * TIME COMPLEXITY:
 *   - Worst-case: O(s^n) where s = servers and n = jobs.
 *     Every job can be assigned to any of the s servers or skipped.
 *   - Average / Pruned: Significantly faster than brute force because subtrees
 *     whose theoretical maximum cannot beat the current best solution are
 *     pruned immediately.
 * 
 * SPACE COMPLEXITY: O(n * s)
 *   - Maximum recursion stack depth is n, holding server state copies at each depth.
 * 
 * ----------------------------------------------------------------------------
 * HOW BRANCH AND BOUND PRUNING WORKS (FOR VIVA):
 * ----------------------------------------------------------------------------
 * 1. "We represent all possible server assignments as a State-Space Tree."
 * 2. "Each depth 'd' in the tree corresponds to making a decision for Job 'd'."
 * 3. "Branches from a node represent:"
 *      - Assign Job 'd' to Server 1
 *      - Assign Job 'd' to Server 2 ... Server 's'
 *      - Skip / Exclude Job 'd'
 * 4. "BOUNDING FUNCTION (Upper Bound):"
 *      Upper Bound = (Priority Accumulated So Far) + (Sum of ALL Remaining Priorities)
 *      - "This represents the absolute best-case priority achievable if EVERY
 *         remaining job in this branch could somehow be scheduled successfully."
 * 5. "PRUNING RULE (The 'Bound' Step):"
 *      If (Upper Bound <= Best Priority Found So Far):
 *          PRUNE THIS ENTIRE SUBTREE! (Cut the branch ✂️)
 *      - "Why? Because even in a perfect fantasy scenario, this branch can NEVER
 *         beat our existing best solution. Exploring it is guaranteed waste."
 * ============================================================================
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

  // Branch and bound explores an exponential state space, so restrict to n <= 12
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

  // STEP 1: Sort jobs by ID and precompute remaining suffix priority sums
  const orderedJobs = [...jobs].sort((a, b) => a.id - b.id);

  // remainingPriority[d] = sum of priorities from job d to job n - 1
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

  /**
   * Bounding Function: Optimistic upper bound for the current branch.
   */
  function calculateUpperBound(currentPriority, currentDepth) {
    return currentPriority + remainingPriority[currentDepth];
  }

  const MAX_TRACE = 700;
  function addTraceStep(step) {
    if (trace.length < MAX_TRACE) trace.push(step);
  }

  /**
   * STEP 2: Depth-First Search (DFS) with Bounding
   */
  function exploreStateSpace(depth, prioritySoFar, serverStates, currentAssignments, parentNodeId) {
    const optimisticUpperBound = calculateUpperBound(prioritySoFar, depth);

    // PRUNING CHECK: Can this branch beat the best solution found so far?
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
      return; // Stop exploring this branch!
    }

    // BASE CASE: Reached leaf node (all n jobs considered)
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

    // RECURSIVE STEP: Branch on the current job
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

    // BRANCH OPTION 1: Try assigning currentJob to each server (1 to numServers)
    for (let serverIndex = 0; serverIndex < numServers; serverIndex++) {
      if (currentJob.cpu > serverCpu || currentJob.memory > serverMemory) continue;

      const serverState = serverStates[serverIndex];
      const startTime = Math.max(currentJob.arrivalTime, serverState.freeTime);
      const endTime = startTime + currentJob.duration;
      const missedDeadline = endTime > currentJob.deadline;

      // Deep copy server states for this child branch
      const nextServerStates = serverStates.map((s) => ({
        id: s.id,
        freeTime: s.freeTime,
        timeline: s.timeline.map((t) => ({ ...t })),
      }));

      const targetServer = nextServerStates[serverIndex];
      targetServer.freeTime = endTime;
      targetServer.timeline.push({
        jobId: currentJob.id,
        startTime,
        endTime,
        cpu: currentJob.cpu,
        memory: currentJob.memory,
      });

      const nextAssignments = [
        ...currentAssignments,
        {
          jobId: currentJob.id,
          serverId: targetServer.id,
          startTime,
          endTime,
          waitTime: startTime - currentJob.arrivalTime,
          missedDeadline,
          priority: currentJob.priority,
        },
      ];

      // Recurse into child branch
      exploreStateSpace(
        depth + 1,
        prioritySoFar + currentJob.priority,
        nextServerStates,
        nextAssignments,
        currentNodeId
      );
    }

    // BRANCH OPTION 2: Skip / exclude currentJob entirely
    exploreStateSpace(
      depth + 1,
      prioritySoFar,
      serverStates,
      currentAssignments,
      currentNodeId
    );
  }

  // STEP 3: Begin DFS exploration from root node
  const initialServerStates = Array.from({ length: numServers }, (_, i) => ({
    id: i + 1,
    freeTime: 0,
    timeline: [],
  }));

  exploreStateSpace(0, 0, initialServerStates, [], -1);

  // STEP 4: Build final schedule from best assignment found
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
