/** AI interview bank: agents, tool use and MCP. */
window.AI_INTERVIEW = window.AI_INTERVIEW || [];
window.AI_INTERVIEW.push({
  id: "agents", name: "Agents, Tool Use and MCP", icon: "fa-robot",
  summary: "What an agent is, when not to use one, planning and memory, MCP, multi-agent frameworks, security and evaluation.",
  topics: [
    {
      id: "agents-core", t: "Designing agents",
      qa: [
        {
          q: "What is an AI agent? How is it different from a workflow or a simple LLM call, and when would you NOT build an agent?",
          probe: "Maturity: knowing that agents are costly and unreliable and should be a last resort.",
          a: "An agent is an LLM running in a loop where it decides what to do next: observe, reason, choose a tool, act, read the result, and repeat until a stop condition. A workflow follows a path I define in code, with LLM calls as steps; a single LLM call has no loop or tools.\n\nI choose the simplest option that works:\n1. One prompt (possibly with retrieval) if the task is single-step.\n2. A workflow (prompt chaining, routing, parallelisation, orchestrator-workers, evaluator-optimiser) when the steps are known in advance but need several LLM calls.\n3. An agent only when the number and order of steps cannot be predetermined, such as open-ended research or debugging, and when the environment gives reliable feedback (tests, tool results).\n\nI avoid agents when the process is fixed, when errors are costly, when latency or cost budgets are tight, or when I cannot evaluate them: each extra step multiplies cost and failure probability (10 steps at 95% each is about 60% overall). If I do build one: few well-designed tools, clear stop criteria, step and budget limits, human approval for irreversible actions, tracing and an evaluation suite.",
          f: [
            ["Name common agent design patterns.", "ReAct (reason and act interleaved), plan-and-execute (plan first, replan on failure), reflection/Reflexion (critique and retry), orchestrator-workers, evaluator-optimiser, routing, and multi-agent supervisor/handoff patterns."],
            ["How do you handle agent memory?", "Short-term: the running messages and scratchpad within the context window, trimmed or summarised. Long-term: semantic facts, episodic past interactions and procedural instructions stored externally and retrieved by relevance, with rules for what to write and when to forget."],
            ["How do you make agents more reliable?", "Fewer steps, verifiable intermediate checks, structured tool arguments, retries with error feedback, deterministic code for control flow, guardrails, human checkpoints, and evaluation of full trajectories."],
            ["What makes a good tool for an agent?", "A precise name and description, narrow purpose, typed validated arguments, concise structured output, helpful error messages, idempotency where possible, and least-privilege access."]
          ]
        },
        {
          q: "Describe an agent you built end to end: tools, orchestration, memory, guardrails and how you evaluated it.",
          probe: "Evidence of real engineering: constraints, failures, measurement.",
          a: "Example: a data-analyst agent that answers business questions by querying a warehouse.\n\n**Tools:** a schema-lookup tool (returns table and column descriptions), a read-only SQL tool (parameterised, row-limited, timeout, restricted role), a chart tool, and a 'ask the user to clarify' tool.\n\n**Orchestration:** a LangGraph graph: understand the question → look up relevant schema → generate SQL → validate (static checks with sqlglot, EXPLAIN cost cap) → execute → check the result for sanity → summarise. A retry edge sends SQL errors back to the generator at most twice, then hands off to a human.\n\n**Memory:** the thread's messages with trimming; a long-term store for definitions of company metrics ('active user') retrieved when relevant.\n\n**Guardrails:** read-only database role, allowlisted schemas, no DDL/DML, row and time limits, PII columns masked, output checked for numbers that do not appear in query results, and an audit log.\n\n**Evaluation:** a set of ~100 questions with verified SQL and answers; metrics: execution accuracy (result matches), tool-call correctness, steps per task, cost and latency; regression-tested in CI, plus review of production traces weekly. Early result: 62% accuracy; adding the schema-description tool and metric definitions raised it to 84%.",
          f: [
            ["What was the hardest failure mode?", "Use a real one. Commonly: wrong joins that silently return plausible but incorrect numbers. Fix: documented join paths in the schema tool, result sanity checks, and showing the generated SQL to the user."],
            ["How did you prevent dangerous queries?", "Defence in depth: DB-level read-only role and resource limits (the real control), plus SQL parsing and allowlists. Prompt instructions alone are not a security control."],
            ["How would you evaluate it when there are no ground-truth answers?", "Use rubric-based LLM judging plus human review samples, consistency checks across paraphrased questions, and monitor user corrections as implicit labels."]
          ]
        }
      ]
    },
    {
      id: "agents-mcp", t: "MCP and agent interoperability",
      qa: [
        {
          q: "What is the Model Context Protocol (MCP)? Explain its architecture and when you would build an MCP server.",
          probe: "Up-to-date knowledge of the ecosystem and the security considerations.",
          a: "MCP is an open protocol that standardises how AI applications connect to external tools and data. Without it, every app needs custom integrations for every tool (M×N); with it, a tool is written once as an MCP server and any compliant client can use it.\n\n**Architecture:** a host (the AI application, such as an IDE or chat client) contains MCP clients, each with a 1:1 connection to an MCP server. Messages are JSON-RPC 2.0. After an initialise handshake negotiates versions and capabilities, the client can list and use what the server exposes.\n\n**Server primitives:** tools (functions the model can call, with JSON Schema inputs), resources (data addressed by URI that the application can read) and prompts (reusable templates). **Client features:** sampling (server asks the host's LLM to generate), roots (which directories a server may use) and elicitation (ask the user for input).\n\n**Transports:** stdio for local servers launched as subprocesses, and Streamable HTTP for remote servers with OAuth-based authorisation.\n\nI would build an MCP server to expose an internal system (ticketing, database, knowledge base) to several AI clients with one implementation, with per-user auth, narrow tools and audit logging.",
          f: [
            ["How is MCP different from function calling?", "Function calling is how a model asks for a tool to be run within one API. MCP standardises how tools are discovered, described, authorised and executed across applications and servers; an MCP client converts server tools into function-calling schemas for the model."],
            ["What are the security risks of MCP?", "Prompt injection via tool descriptions or results, malicious or compromised servers (tool poisoning, tool shadowing), over-broad permissions and confused-deputy problems, token theft, and data exfiltration. Mitigate: vet and pin servers, least privilege, user approval for sensitive actions, sandboxing, scoped OAuth tokens and logging."],
            ["How does A2A relate to MCP?", "MCP connects an agent to tools and data; A2A (Agent2Agent) standardises how agents discover each other and exchange tasks across vendors. They are complementary layers."],
            ["How would you expose a database safely through MCP?", "A server with read-only credentials, a small set of purpose-built tools rather than raw SQL where possible, row and time limits, schema allowlists, per-user authorisation passed through, and audit logs."]
          ]
        },
        {
          q: "Compare LangGraph, CrewAI, AutoGen and the OpenAI Agents SDK. How do you choose?",
          probe: "Breadth and judgement rather than brand loyalty.",
          a: "- **LangGraph:** low-level, explicit graph with typed state, cycles, checkpointing, interrupts, time travel and streaming. Best for durable, controllable production workflows, with more code to write.\n- **CrewAI:** high-level role-based teams (agents with role, goal and backstory, tasks, crews with sequential or hierarchical processes); quick to prototype, less control over internals; Flows add more deterministic orchestration.\n- **AutoGen / AG2 (and Microsoft Agent Framework):** conversational multi-agent patterns with message exchange and group chats; strong for research-style multi-agent conversations and Microsoft/.NET ecosystems.\n- **OpenAI Agents SDK:** small set of primitives (agents, handoffs, guardrails, sessions, tracing); minimal abstraction, easy for OpenAI-centred apps.\n- **Others:** LlamaIndex (data/RAG-centred agents), Pydantic AI (type-safe), smolagents (code-writing agents), DSPy (prompt optimisation), Semantic Kernel (enterprise SDK).\n\nI choose by requirement: durability, human approval and auditability → LangGraph; fast role-based prototype → CrewAI; simple handoff agents with tracing → Agents SDK; heavy document retrieval → LlamaIndex. Often no framework is the right answer: a direct SDK call loop is simpler to debug.",
          f: [
            ["What are the risks of adopting an agent framework?", "Fast API churn, hidden prompts, abstraction leakage and vendor lock-in. Pin versions, own your prompts and evals, and keep business logic behind a thin interface."],
            ["Would you use multiple agents for this task?", "Only with a reason: too many tools for one agent, different models or permissions, or parallelisable subtasks. Otherwise one agent plus good tools is more reliable and cheaper."]
          ]
        }
      ]
    },
    {
      id: "agents-safety", t: "Security, evaluation and guardrails",
      qa: [
        {
          q: "What is prompt injection and how do you defend an agent against it?",
          probe: "A top interview question for any system where LLMs read external content.",
          a: "Prompt injection is when instructions hidden in input override the developer's intent. **Direct:** the user tries 'ignore previous instructions'. **Indirect:** instructions are embedded in content the agent reads (a web page, email, PDF or tool result) and the model treats them as commands. There is no complete defence, so I design for limited impact:\n\n- **Least privilege:** the agent only gets the tools and credentials it needs; read-only where possible.\n- **Break the 'lethal trifecta':** avoid combining access to private data, exposure to untrusted content and an external communication channel in one context.\n- **Separate contexts:** untrusted content is processed by a model with no tools and no secrets; a privileged agent only sees sanitised, structured output.\n- **Human approval** for sensitive or irreversible actions, shown with the exact parameters.\n- **Output handling:** treat model output as untrusted input to other systems; do not auto-render external links/images that could leak data; validate tool arguments.\n- **Detection:** injection classifiers, allowlisted domains, monitoring and red-team test suites.\n- **Delimiters and instructions** to treat retrieved text as data help but are not sufficient alone.",
          f: [
            ["Can system prompts keep secrets?", "No. Anything in context can be extracted with enough effort, so never place credentials or sensitive logic in the prompt; enforce access in code."],
            ["How do you test for injection?", "Maintain an adversarial test suite (known attacks, injected documents, poisoned tool outputs), run it in CI and after prompt/model changes, and add real incidents to it."]
          ]
        },
        {
          q: "How do you evaluate an agent? What metrics beyond answer accuracy?",
          probe: "Agent evaluation is harder than single-call evaluation; do you know the dimensions?",
          a: "I evaluate the outcome and the process:\n\n- **Task success rate** on a fixed scenario set with programmatic checks where possible (tests pass, state matches), else rubric/LLM-judge plus human review.\n- **Tool use:** correct tool selection, argument validity, unnecessary or repeated calls, error recovery.\n- **Trajectory efficiency:** steps, tokens, cost and latency per task; recursion-limit hits.\n- **Safety and policy:** violations, attempts at forbidden actions, refusal behaviour, injection resistance.\n- **Robustness:** variance across repeated runs (agents are stochastic, so I run each scenario several times and report pass@k and consistency), paraphrased tasks, tool failures injected on purpose.\n- **Online metrics:** resolution rate, escalation rate, user feedback and cost per resolved task.\n\nI run simulated environments for repeatability, review failing traces manually, and add each production failure to the suite. Public benchmarks (SWE-bench, WebArena, τ-bench, GAIA) are useful for model selection but my own task-specific evals matter most.",
          f: [
            ["Why run each scenario multiple times?", "Sampling makes outcomes non-deterministic; a single pass can hide flakiness. Reporting a success rate over several runs (and pass^k for reliability) gives a truer picture."],
            ["What is a trajectory evaluation?", "Scoring the sequence of steps and tool calls against expected behaviour (required calls present, forbidden calls absent, order constraints), not only the final answer."]
          ]
        }
      ]
    }
  ]
});
