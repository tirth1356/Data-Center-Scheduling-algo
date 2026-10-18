# 🎓 DAA Course Project: Teacher Viva & Code Explanation Guide

This guide is designed to help you confidently explain your codebase and theoretical concepts to your teacher during your **Design and Analysis of Algorithms (DAA)** project viva or presentation.

---

## 📌 1. Project High-Level Architecture (The 30-Second Pitch)

> **"Sir/Ma'am, our project simulates a modern multi-tenant cloud data center with constrained CPU cores and RAM across parallel server nodes. We implemented and benchmarked 6 classical DAA algorithmic paradigms on identical job workloads to compare their throughput, wait time, priority served, energy consumption, and empirical Big-O runtimes."**

---

## 🗂️ 2. File Organization Cheat Sheet

| File | What is inside? | DAA Concept |
|---|---|---|
| `algorithms/fcfs.js` | Baseline non-preemptive queue | FIFO Queue / Greedy by Arrival |
| `algorithms/sjf.js` | Greedy shortest job first | Greedy Minimization of Average Wait Time |
| `algorithms/deadlines.js` | Job sequencing with deadlines | Greedy + Disjoint-Set (Union-Find) with Path Compression |
| `algorithms/knapsack.js` | 2D dynamic programming table & backtracking | Optimal Substructure, Overlapping Subproblems, Tabulation |
| `algorithms/heapScheduler.js` | Dual binary heap architecture | Priority Queues, Binary Heaps (`bubbleUp` / `bubbleDown`) |
| `algorithms/branchBound.js` | State-space tree search (DFS) with upper bound | Branch & Bound, Optimistic Bounding, Subtree Pruning |
| `algorithms/metrics.js` | Metrics calculation & Green power model | Novel Idea: Data Center Energy & Carbon Footprint Modeling |
| `server.js` | Express API endpoints | REST API & `process.hrtime.bigint()` benchmarking |
| `public/app.js` | Visualizer, player & scrubber | Front-End Simulation Controller & Chart.js Integration |

---

## 🎯 3. Top Viva Questions & Exact Answers to Give

### Question 1: "Explain your 0/1 Knapsack algorithm and write the recurrence relation."
- **Answer:**
  > "We formulate the workload selection as a 0/1 Knapsack problem where total cluster CPU is our capacity $C$, each job's CPU requirement is its weight $w_i$, and its priority is its value $v_i$.
  >
  > We construct a 2D table `DP[i][w]` of size $(n+1) \times (C+1)$ where each cell represents the maximum priority achievable using a subset of the first $i$ jobs with capacity at most $w$.
  >
  > **Recurrence Relation:**
  > $$DP[i][w] = \begin{cases} DP[i-1][w] & \text{if } w < \text{cpu}_i \\ \max\Big(DP[i-1][w],\; DP[i-1][w - \text{cpu}_i] + \text{priority}_i\Big) & \text{if } w \ge \text{cpu}_i \end{cases}$$
  >
  > **Base cases:** $DP[0][w] = 0$ and $DP[i][0] = 0$.
  >
  > **Backtracking:** Starting at cell $(n, C)$, if $DP[i][w] \neq DP[i-1][w]$, job $i$ was included. We record job $i$, decrement $w \leftarrow w - \text{cpu}_i$, and move to row $i-1$."

---

### Question 2: "Why use Disjoint-Set (Union-Find) in Job Sequencing with Deadlines? What does path compression do?"
- **Answer:**
  > "In classic Job Sequencing, jobs are sorted in descending order of priority. To leave maximum room for other jobs, the greedy choice is to schedule each job in the **latest free time slot $\le$ its deadline**.
  >
  > A naive linear search backwards from the deadline takes $O(D)$ time per job.
  > Instead, we maintain a Disjoint Set where `parent[t]` points to the latest free slot $\le t$.
  >
  > When slot $t$ is occupied, we union it with slot $t-1$: `parent[t] = find(t - 1)`.
  >
  > **Path Compression:** When calling `find(x)`, we flatten the tree by pointing `parent[x] = find(parent[x])`. This ensures future lookups run in near-constant amortized time $\mathcal{O}(\alpha(D))$, reducing the overall algorithm complexity to $\mathcal{O}(n \log n + n \cdot s \cdot \alpha(D))$."

---

### Question 3: "Explain how your Dual-Heap Priority Queue works."
- **Answer:**
  > "Instead of scanning arrays, we utilize two complementary binary heaps:
  > 1. **Job Max-Heap:** Stores ready jobs ordered by priority ($O(\log n)$ extraction of highest-priority job).
  > 2. **Server Min-Heap:** Stores server nodes ordered by their `freeTime` ($O(\log s)$ extraction of the earliest-available server).
  >
  > As the simulation clock advances, arriving jobs are pushed into the Max-Heap. We extract the root job from the Max-Heap, extract the earliest server from the Min-Heap, assign the job, update the server's `freeTime`, and re-insert the server back into the Min-Heap.
  >
  > This guarantees optimal load distribution in $\mathcal{O}(n \log n)$ total time."

---

### Question 4: "How does Branch & Bound work here, and what is your bounding function?"
- **Answer:**
  > "Branch and Bound explores a state-space tree where each tree depth $d$ represents a decision for job $d$ (assign to Server 1, Server 2, ..., or skip).
  >
  > **Bounding Function (Upper Bound):**
  > $$\text{Upper Bound} = \text{Priority Accumulated So Far} + \sum_{j=d}^{n-1} \text{Priority}_j$$
  > This represents the optimistic ceiling: the best possible priority if *every single remaining job* could be scheduled.
  >
  > **Pruning Condition:**
  > If $\text{Upper Bound} \le \text{Best Priority Found So Far}$, we **prune the entire subtree**! Exploring deeper is mathematically guaranteed to be unable to beat our current best solution.
  >
  > Because the worst-case tree has $O(s^n)$ nodes, we constrain Branch and Bound to $n \le 12$."

---

### Question 5: "Why does SJF minimize average waiting time?"
- **Answer:**
  > "Mathematically, if $n$ jobs run sequentially with durations $d_1, d_2, \dots, d_n$, the total waiting time is:
  > $$\sum_{i=1}^n \text{Wait}_i = (n-1)d_1 + (n-2)d_2 + \dots + 1 \cdot d_{n-1} + 0 \cdot d_n$$
  > Notice that the duration of the first job $d_1$ is multiplied by $(n-1)$, the second by $(n-2)$, etc.
  > By the **Rearrangement Inequality**, this weighted sum is strictly minimized when durations are sorted in ascending order ($d_1 \le d_2 \le \dots \le d_n$)."

---

### Question 6: "What is your project's Novel Idea?"
- **Answer:**
  > "We designed and implemented a **Data Center Power Consumption & Green Computing Model**:
  > - Each active physical server consumes a baseline **Idle Power** $P_{\text{idle}} = 120\text{ W}$ across its active span.
  > - During job execution, it draws **Dynamic Workload Power** $P_{\text{dyn}} \le 180\text{ W}$, weighted $65\%$ by CPU utilization and $35\%$ by RAM utilization.
  > - We integrate power over time to calculate **Total Energy (kWh)** and compute a **Green Efficiency Score**:
  >   $$\text{Efficiency} = \frac{\text{Total Priority Served}}{\text{Total Energy in kWh}}$$
  > - This allows comparing algorithms not just by pure completion speed, but also by energy efficiency and carbon emissions ($\text{kg CO}_2$)."

---

### Question 7: "Why might measured runtime differ slightly from theoretical Big-O curves?"
- **Answer:**
  > "In live benchmarking:
  > 1. Big-O ignores constant factors and low-order terms ($c_1 n + c_2$).
  > 2. V8 engine JIT optimization, garbage collection, and microsecond timer precision create small deviations at very small $n$ ($n=10$).
  > 3. Recording trace steps adds a slight linear overhead.
  > However, as $n$ scales to $50, 100, 200$, the empirical curve matches the asymptotic slope ($n \log n$, $n^2$) as shown on our benchmark chart."

---

## 💡 Quick Code Pointers to Show Teacher

- **Path Compression in Union-Find:**
  `algorithms/deadlines.js` ➔ Look at lines 40-47 in `find(x)`:
  ```javascript
  this.parent[x] = this.find(this.parent[x]); // Path compression
  ```
- **DP Recurrence Calculation:**
  `algorithms/knapsack.js` ➔ Look at lines 60-75:
  ```javascript
  const candidatePriority = dp[i - 1][remainingCapacity] + job.priority;
  if (candidatePriority > bestPriority) { ... }
  ```
- **Branch and Bound Pruning:**
  `algorithms/branchBound.js` ➔ Look at lines 75-85:
  ```javascript
  if (optimisticUpperBound <= bestPriorityFound) {
    totalPrunedBranches += 1;
    return; // Pruned!
  }
  ```
- **Binary Heap Bubble Up/Down:**
  `algorithms/heapScheduler.js` ➔ Look at `bubbleUp` and `bubbleDown` methods with array arithmetic (`(i - 1) / 2` and `2 * i + 1`).
