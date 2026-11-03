/** AI interview bank: LangGraph. */
window.AI_INTERVIEW = window.AI_INTERVIEW || [];
window.AI_INTERVIEW.push({
  id: "langgraph", name: "LangGraph", icon: "fa-diagram-project",
  summary: "State, nodes, edges and reducers; cycles, persistence, human-in-the-loop, multi-agent design and production deployment.",
  topics: [
    {
      id: "lg-core", t: "Concepts and design",
      qa: [
        {
          q: "What is LangGraph, and why use it instead of plain LangChain chains or AgentExecutor?",
          probe: "Do you know the problem it solves: cycles, shared state, durability and control.",
          a: "LangGraph is a low-level orchestration framework that models an application as a graph of steps operating on shared state. Chains are fine for linear pipelines, but real agent workflows need loops (retry, reflect, tool-use cycles), conditional branching, shared state, long-running execution, human approval and the ability to resume after failure. LangGraph provides those directly:\n\n- **State** with a schema and reducers defining how updates merge.\n- **Nodes** (plain functions) that read state and return partial updates.\n- **Edges**, including conditional ones and dynamic routing with Command.\n- **Checkpointers** that save state after every step for memory, fault tolerance, interrupts and time travel.\n- **Streaming** of values, updates, tokens and custom events.\n\nIt does not hide prompts or impose an architecture, which gives control and makes debugging easier than the older AgentExecutor, which is deprecated. I use LCEL inside nodes and LangGraph for the control flow.",
          f: [
            ["What is a reducer and why do you need one?", "A reducer says how a node's update combines with the existing value of a state key. Without one, new values overwrite. With add_messages or operator.add, values are appended, which is also what makes parallel branches that write the same key safe. Conflicting parallel writes without a reducer raise an error."],
            ["How does execution actually proceed?", "In super-steps (Pregel-style): all nodes whose inputs changed run in the same step, their updates are applied through reducers, then the next set of nodes is scheduled, until nothing is scheduled or END is reached. A recursion limit (default 25) guards against runaway loops."],
            ["Explain conditional edges.", "add_conditional_edges(source, router, mapping) calls a routing function with the current state and uses its return value to choose the next node(s). The classic agent loop: after the model node, route to 'tools' if the last message has tool_calls, otherwise END."],
            ["What does Command do?", "A node can return Command(update={...}, goto='node') to update state and choose the next node in one step. It is how handoffs between agents are implemented, and Command(resume=...) is used from outside to continue after an interrupt."]
          ]
        },
        {
          q: "Walk me through an agentic workflow you built with LangGraph. How did you design the state, nodes and edges?",
          probe: "Real design thinking: explicit state, deterministic control flow, LLMs only where judgement is needed.",
          a: "Example: a customer-support assistant that classifies a request, retrieves policy, drafts a reply, and asks a human to approve refunds above a threshold.\n\n**State:** messages (add_messages reducer), the classified intent, retrieved documents, a draft reply, an approval flag, and an attempts counter. I kept it minimal and typed (TypedDict/Pydantic) and stored only references to large objects.\n\n**Nodes:** classify (small model, structured output), retrieve (RAG tool), draft (main model), check (rules plus an LLM grounding check), approve (human interrupt), send.\n\n**Edges:** START → classify; a conditional edge from classify routes to 'retrieve', 'handoff_to_human' or 'answer_directly'; retrieve → draft → check; a conditional edge from check loops back to draft up to 2 times if the grounding check fails, else goes to 'approve' for refunds above the limit or straight to 'send'.\n\n**Persistence:** a Postgres checkpointer keyed by thread_id. The approve node calls interrupt() so a human can approve or edit, possibly hours later; the workflow then resumes with Command(resume=...).\n\n**Design principle:** deterministic code decides control flow; the LLM makes judgements inside nodes. That made behaviour testable and debuggable.",
          f: [
            ["How did you test it?", "Unit tests for nodes and routers as plain functions with crafted state; whole-graph tests with a fake chat model and an in-memory checkpointer; trajectory evaluations on recorded scenarios checking which nodes ran and which tools were called; plus end-to-end evals on a dataset."],
            ["What went wrong and how did you fix it?", "Use a real example. A typical one: an infinite draft-check loop because the checker was too strict. Fix: an attempts counter in state, a hard limit that routes to human handoff, and a better rubric for the checker."],
            ["Why not let one agent do everything with tools?", "Too many tools and instructions degrade tool selection and make behaviour unpredictable. Explicit nodes give controllable steps, cheaper models for simple steps and clear points for human approval and evaluation."]
          ]
        }
      ]
    },
    {
      id: "lg-persistence", t: "Persistence, memory and human-in-the-loop",
      qa: [
        {
          q: "How does persistence work in LangGraph? Explain checkpointers, threads and the Store.",
          probe: "A frequent deep-dive: short-term vs long-term memory and durability.",
          a: "When the graph is compiled with a checkpointer (InMemorySaver for dev; SQLite, Postgres or Redis savers for production), a checkpoint of the full state is saved after every super-step under a thread_id passed in config={'configurable': {'thread_id': ...}}. Calling the graph again with the same thread_id loads that state, so a conversation continues, and a crash resumes from the last completed step (durable execution).\n\nCheckpoints are short-term memory scoped to one thread. For long-term memory shared across threads and users (preferences, learned facts) I use the Store, a namespaced key-value interface (e.g. namespace (user_id, 'memories')) with optional semantic search. Nodes read from it at the start of a turn and write new memories, either in the hot path or in a background job.\n\nOther things checkpoints enable: get_state to inspect values and next nodes, get_state_history to list checkpoints, update_state to edit state, and time travel to fork from an earlier checkpoint.",
          f: [
            ["How does human-in-the-loop work?", "A node calls interrupt(payload): the run pauses, state is saved and the payload is returned to the caller (for example 'approve this refund?'). Later the app resumes the same thread with Command(resume=value), and interrupt() returns that value inside the node. Static breakpoints (interrupt_before/after) pause around named nodes. A checkpointer is required."],
            ["What happens to side effects when a run resumes?", "Execution is at-least-once: a node interrupted or failed mid-way may run again. Make side effects idempotent (idempotency keys), or isolate them in separate tasks/nodes."],
            ["How do you stop the state growing without bound?", "Trim or summarise messages in a node (trim_messages, RemoveMessage), keep large artefacts outside state with references, and prune old checkpoints with a retention policy."],
            ["What is time travel useful for?", "Debugging and exploration: replay from an earlier checkpoint, edit the state at that point, and fork a new branch to see what a different decision would have done, without losing the original history."]
          ]
        },
        {
          q: "How do you design multi-agent systems in LangGraph? Compare supervisor and handoff (swarm) patterns.",
          probe: "Architectural judgement and awareness that multi-agent adds cost and risk.",
          a: "I start with a single agent and move to multiple only when a single prompt is overloaded with tools or roles, when different parts need different models or permissions, or when subtasks can run in parallel.\n\n**Supervisor:** a coordinating agent decides which specialist (researcher, coder, writer) runs next, receives its result and decides again until done. Pros: explicit control, easy to monitor and bound, specialists stay simple. Cons: the supervisor is a bottleneck and single point of failure, extra LLM calls, and misrouting.\n\n**Handoffs/swarm:** agents transfer control directly using handoff tools that return Command(goto='other_agent', graph=Command.PARENT, update=...); state records the active agent. Pros: fewer hops, natural for conversational flows (triage → billing → tech support). Cons: harder to bound and debug; loops are possible.\n\n**Hierarchical teams:** supervisors of sub-supervisors using subgraphs, with private state and a summarised result returned to the parent.\n\nDesign rules: limit topologies, give each agent a small toolset, keep private scratchpads instead of one shared giant message list, set step limits, and evaluate trajectories.",
          f: [
            ["How do agents share information?", "A shared state key (messages or structured fields) for what everyone needs; subgraph-private state for scratch work; and a summarised output returned to the parent to avoid context bloat."],
            ["What are the main failure modes of multi-agent systems?", "Compounding errors across steps, role confusion, infinite delegation loops, context bloat, cost and latency multiplication, and hard-to-reproduce behaviour. Mitigate with step limits, structured handoff payloads, tracing and trajectory evals."]
          ]
        },
        {
          q: "How do you stream, deploy and monitor a LangGraph application?",
          probe: "Production concerns.",
          a: "**Streaming:** stream_mode='messages' for token streaming to the UI, 'updates' for each node's delta (progress indicators), 'values' for full state, 'custom' for progress events emitted by nodes, and 'debug' for detailed traces; modes can be combined and astream is used in async servers.\n\n**Deployment:** either LangGraph Server/Platform (API for runs and threads, background runs, cron jobs, streaming, managed persistence, auth) or embedding the compiled graph in my own FastAPI service with a Postgres checkpointer and connection pooling. Per-run settings pass through config 'configurable' values rather than globals. LangGraph Studio helps visualise and debug graphs.\n\n**Monitoring:** LangSmith tracing of every node and tool call, metrics for latency per node, token cost per run, error and retry counts, recursion-limit hits, interrupt wait times, and trajectory-based evaluation on production samples. I set timeouts and retry policies per node.",
          f: [
            ["How do you handle long-running or asynchronous tasks?", "Run in the background with a run ID, persist state through the checkpointer, notify on completion, and use interrupts for human waits; workers can crash and resume from the last checkpoint."],
            ["How would you scale it?", "Stateless workers behind a queue with state in Postgres/Redis, per-thread ordering to avoid concurrent runs on one thread (double-texting policies), and horizontal scaling of workers plus rate limiting to providers."]
          ]
        }
      ]
    }
  ]
});
