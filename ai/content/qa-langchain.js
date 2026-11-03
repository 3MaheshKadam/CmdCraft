/** AI interview bank: LangChain. Same shape as qa-rag.js. Versions move fast: confirm imports against the docs of the version you used. */
window.AI_INTERVIEW = window.AI_INTERVIEW || [];
window.AI_INTERVIEW.push({
  id: "langchain", name: "LangChain", icon: "fa-link",
  summary: "What LangChain is, LCEL, tools and agents, retrievers, memory, observability, and the honest criticisms interviewers like to probe.",
  topics: [
    {
      id: "lc-basics", t: "Fundamentals and LCEL",
      qa: [
        {
          q: "What is LangChain and why did you use it in your project? What are its main components?",
          probe: "Whether you can justify the framework and also name what it costs.",
          a: "LangChain is an open-source framework that gives common interfaces and integrations for building LLM applications, so components are swappable: chat models, prompt templates, output parsers, tools, document loaders, text splitters, embeddings, vector stores, retrievers and agents.\n\nI used it because (1) provider portability: the same code runs on OpenAI, Anthropic or a local model by changing one object, (2) ready integrations for loaders and vector stores saved weeks, (3) the Runnable interface gives streaming, async, batching and retries consistently, and (4) LangSmith tracing made debugging non-deterministic chains practical.\n\nPackage layout: langchain-core (Runnable, messages, prompts, parsers, tools), langchain (agents and chains), langchain-community (third-party integrations), provider packages like langchain-openai, langgraph for stateful workflows, and langsmith for tracing and evaluation.\n\nWhat I kept in mind: it is an abstraction layer, so I kept business logic and prompts in my own code, pinned versions (the API has changed a lot) and used the raw provider SDK where the abstraction added nothing.",
          f: [
            ["What are the downsides of LangChain?", "Fast-moving API with deprecations, abstraction layers that make stack traces and prompts harder to see, heavy dependencies, and a risk of using chains for what a plain function would do. Mitigation: pin versions, use LCEL/LangGraph rather than legacy classes, inspect actual prompts through tracing, and keep thin wrappers around the framework."],
            ["When would you not use LangChain?", "A simple single-call feature, latency- or dependency-sensitive services, or when the team already has a clean SDK-based abstraction. Direct provider SDK calls are easier to debug and often enough."],
            ["LangChain vs LlamaIndex?", "LangChain is a general orchestration framework (chains, tools, agents, with LangGraph for workflows). LlamaIndex started focused on data ingestion, indexing and retrieval with strong document parsing and query engines. Many teams use LlamaIndex for retrieval and LangGraph for orchestration, or either alone."]
          ]
        },
        {
          q: "What is LCEL (LangChain Expression Language)? Explain the Runnable interface and how composition works.",
          probe: "Core technical understanding of modern LangChain, not just copy-pasted chains.",
          a: "LCEL is a declarative way to compose components using the pipe operator. Everything implements the Runnable interface: invoke (single input), batch (many inputs concurrently), stream (incremental output) and the async versions ainvoke/abatch/astream, plus astream_events for step-level events.\n\nprompt | model | parser creates a RunnableSequence where each output feeds the next. A dict of runnables becomes a RunnableParallel that runs branches concurrently on the same input and returns a dict. RunnablePassthrough forwards the input (and .assign adds computed keys), RunnableLambda wraps any Python function, and routing can be a function that returns different runnables.\n\nBecause the interface is uniform you get for free: streaming through the whole chain, async execution, batching, retries (.with_retry()), fallbacks (.with_fallbacks()), configurable parameters, and automatic tracing of every step in LangSmith.\n\nExample: a RAG chain is {'context': retriever | format_docs, 'question': RunnablePassthrough()} | prompt | llm | StrOutputParser().",
          f: [
            ["What is the difference between invoke, batch and stream?", "invoke runs one input and returns the full result; batch runs a list of inputs concurrently (with a max_concurrency setting); stream yields output chunks as they are produced, which requires every step after the model to support streaming."],
            ["How do you add retries and fallback models?", "chain.with_retry(stop_after_attempt=3, wait_exponential_jitter=True) for transient errors, and primary.with_fallbacks([backup]) to switch to another model or chain when the primary raises."],
            ["How do you make the model configurable at runtime?", "Use configurable_alternatives or configurable_fields and pass config={'configurable': {...}} on invocation, so one chain can switch models or temperature per request."],
            ["Why is LCEL not suited for complex agents?", "LCEL describes mostly acyclic data flow. Loops, shared mutable state, human approval, checkpointing and multi-agent routing are awkward there; LangGraph models these explicitly as a state graph."]
          ]
        }
      ]
    },
    {
      id: "lc-prompts-tools", t: "Prompts, structured output, tools and agents",
      qa: [
        {
          q: "How do you get reliable structured output from an LLM in LangChain?",
          probe: "Practical reliability engineering for LLM output.",
          a: "I use llm.with_structured_output(Schema) with a Pydantic model (or TypedDict/JSON Schema). Under the hood it uses the provider's native tool-calling or JSON-schema mode, so the output is constrained and parsed into a validated object, which is far more reliable than asking for JSON in prose and parsing with regex.\n\nTo make it robust: clear field names and descriptions (the schema is part of the prompt), enums via Literal instead of free strings, optional fields with an explicit 'unknown' so the model does not invent values, and small flat schemas. I wrap the call with validation-error handling: catch the Pydantic error, feed the message back to the model for a limited number of retries, and log the raw output for analysis. For providers without native support I fall back to PydanticOutputParser with format instructions plus an OutputFixingParser.",
          f: [
            ["JSON mode vs schema-constrained decoding?", "JSON mode guarantees syntactically valid JSON only. Schema-constrained decoding (structured outputs, grammar-based decoding) restricts generation to your exact schema. Semantic correctness still needs validation."],
            ["How do you handle a model that keeps returning invalid output?", "Capped retries with the validation error in the prompt, simplify the schema, add one or two few-shot examples, lower temperature, try a stronger model for hard cases, and route persistent failures to a human review queue."]
          ]
        },
        {
          q: "How do tools and tool calling work in LangChain? How would you build an agent that uses them?",
          probe: "Understanding of the tool-calling loop, not only the one-line helper.",
          a: "A tool is a function with a name, a description and a typed argument schema. The @tool decorator derives these from the function name, docstring and type hints, so a clear docstring is effectively prompt engineering.\n\nllm.bind_tools([tools]) tells the model which tools exist. When the model decides to use one, the returned AIMessage has .tool_calls with name, args and an id. My code (or the agent runtime) executes the tool and appends a ToolMessage containing the result and the matching tool_call_id, then calls the model again. The loop ends when the model replies without tool calls.\n\nFor an agent I use create_agent (LangChain v1; previously langgraph.prebuilt.create_react_agent), which compiles this loop into a LangGraph graph, so I get streaming, checkpointed memory by thread, human-in-the-loop interrupts and tracing. Practical tool design: few, narrowly scoped, well-named tools; strict typed arguments; concise results; helpful error strings returned instead of raised so the model can recover; confirmation for destructive actions; a recursion limit and timeouts.",
          f: [
            ["What if the model calls the wrong tool or invents arguments?", "Improve tool names and descriptions, reduce the number of tools (too many hurts selection), validate arguments with Pydantic and return clear errors, add examples in the system prompt, or route by intent first so each sub-agent sees only a few tools."],
            ["How do you prevent an agent from looping forever?", "Recursion/step limits, per-run token and time budgets, detection of repeated identical tool calls, and clear stop criteria in the prompt."],
            ["What is ReAct?", "A pattern interleaving reasoning and acting: think, call a tool, observe, continue. With native tool calling the format is handled by the API instead of text parsing."],
            ["How do you make tool use safe?", "Least-privilege credentials, read-only by default, allowlists, argument validation, sandboxed code execution, human approval for irreversible actions, and audit logs."]
          ]
        }
      ]
    },
    {
      id: "lc-memory-retrieval", t: "Memory, retrieval and production",
      qa: [
        {
          q: "How did you implement conversation memory? What are the options and trade-offs?",
          probe: "Do you know that legacy memory classes are deprecated and how persistence really works?",
          a: "Conversation history is just a list of messages, so the design questions are where to store it, how to keep it within the context window, and how long-term memory differs from short-term.\n\n**Short-term (per conversation):** in current LangChain/LangGraph I use a checkpointer (SQLite/Postgres/Redis-backed) keyed by thread_id, which stores the full graph state after each step, so conversations survive restarts and can be resumed. For simpler chains, RunnableWithMessageHistory with a session-keyed store works.\n\n**Context control:** trim to a token budget (trim_messages), or summarise older turns into a running summary message, keeping the last N turns verbatim.\n\n**Long-term (across conversations):** facts and preferences extracted by the model are stored in a separate store (LangGraph Store or a vector DB) under a user namespace and retrieved semantically at the start of a turn.\n\nI avoided the legacy ConversationBufferMemory-style classes because they are deprecated and hide state.",
          f: [
            ["Buffer vs summary vs vector memory?", "Buffer keeps raw recent messages (accurate, grows). Summary compresses history (cheap, lossy, can drift). Vector/retrieval memory stores facts or past exchanges and retrieves the relevant ones (scales, but retrieval can miss). Real systems combine a recent window, a summary and retrieved long-term facts."],
            ["How do you handle privacy for stored memories?", "Per-user namespaces, encryption, retention limits, user-visible controls to view and delete memories, and avoiding storing sensitive data unless needed."]
          ]
        },
        {
          q: "How do you observe, test and deploy a LangChain application in production?",
          probe: "Production readiness beyond a notebook demo.",
          a: "**Observability:** LangSmith (or Langfuse/Phoenix/OpenTelemetry) tracing for every run: nested steps, prompts, outputs, latency, token counts and cost, tagged by user/session/version. Callbacks feed metrics (latency, error rate, tokens) into our monitoring stack.\n\n**Testing:** unit tests for deterministic parts (parsers, tools, routing) and fake chat models (FakeListChatModel) for chain logic without API calls. A separate evaluation suite on a versioned dataset runs against real models in CI/nightly with metrics (exact match, embedding similarity, LLM-judge, task-specific checks) and compares experiments across prompt/model/retriever changes to catch regressions.\n\n**Deployment:** the chain or graph is wrapped in a FastAPI service (or LangGraph Server), async end to end, streaming responses, a Postgres checkpointer, secrets from a vault, timeouts, retries with backoff, provider fallbacks, rate limiting, token budgets, PII redaction in logs, and pinned library and model versions. Rollouts use feature flags and canary traffic with online metrics.",
          f: [
            ["How do you control cost?", "Per-request token and cost tracking, model routing (small model first), caching, shorter prompts and contexts, max_tokens, batching and per-user quotas with alerts."],
            ["How do you handle provider outages and rate limits?", "Retries with exponential backoff and jitter, rate limiters, circuit breakers, and fallbacks to a secondary provider or model, with graceful degraded responses."],
            ["How do you version prompts?", "Keep them in version control or a prompt registry (LangSmith Hub etc.), tie each trace to a prompt version, and gate changes with evaluation results."]
          ]
        }
      ]
    }
  ]
});
