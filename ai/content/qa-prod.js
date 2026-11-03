/** AI interview bank: LLMOps (evaluation, observability, cost, serving) and AI system design. */
window.AI_INTERVIEW = window.AI_INTERVIEW || [];
window.AI_INTERVIEW.push(
  {
    id: "llmops", name: "LLM Evaluation and LLMOps", icon: "fa-gauge-high",
    summary: "Evaluating LLM apps, observability, cost and latency, serving and guardrails: how a prototype becomes a product.",
    topics: [
      {
        id: "ops-eval", t: "Evaluation and monitoring",
        qa: [
          {
            q: "How do you evaluate an LLM application before and after release?",
            probe: "Evaluation discipline is the clearest signal of seniority.",
            a: "**Before release (offline):** a versioned evaluation dataset built from real inputs (plus edge cases, adversarial and unanswerable ones), each with an expected output or a rubric. Metrics matched to the task: exact match or F1 for extraction and classification, schema validity, retrieval metrics for RAG (recall@k, MRR), faithfulness and answer relevance for generation, task success for agents, plus latency, token cost and safety checks. For open-ended outputs I use LLM-as-judge with a fixed rubric, low temperature and pairwise comparison, calibrated against human labels, and I spot-check manually. Every prompt, model or retriever change runs the suite in CI and must not regress key metrics.\n\n**After release (online):** tracing of every request, explicit feedback (thumbs, edits), implicit signals (retries, abandonment, escalations), cost and latency dashboards, drift monitoring on inputs, and sampled human review of conversations. Failures feed the evaluation set. For risky changes I use shadow mode, canary rollout or A/B tests with guardrail metrics.",
            f: [
              ["How do you build the first evaluation set?", "Collect real or realistic queries from domain experts, write expected answers or rubrics, add edge and failure cases, generate synthetic variants and review them; start with 50-100 and grow it from production failures."],
              ["What are the limitations of LLM-as-judge?", "Position, verbosity and self-preference biases, inconsistency and rubric sensitivity; calibrate with human labels, randomise order, use clear rubrics and a stronger judge."],
              ["What do you measure for latency?", "Time to first token, tokens per second, end-to-end p50/p95/p99, per-step breakdown (retrieval, rerank, generation) and queueing time."],
              ["How do you detect drift in an LLM app?", "Track input distribution (topics, length, language), retrieval score distributions, refusal and 'unknown' rates, user feedback trends and evaluation scores on a rolling sample of production traffic."]
            ]
          },
          {
            q: "How do you control cost and latency of an LLM system at scale?",
            probe: "Cost awareness is a daily concern in LLM engineering.",
            a: "I start by measuring: per-request tokens (input and output), cost per task, per-step latency, cache hit rates. Then:\n\n- **Right-size the model:** smallest model that passes the evaluation set; route easy requests to cheap models, hard ones to stronger models.\n- **Reduce tokens:** shorter prompts, retrieval of fewer but better chunks, context compression, summarised history, capped max_tokens, concise output formats.\n- **Cache:** provider prompt caching for static prefixes (static content first), embedding and retrieval caches, semantic or exact-match answer caches where safe.\n- **Batch and async:** batch APIs for offline work, parallel calls, streaming for perceived latency.\n- **Self-hosting** when volume justifies it: quantisation, vLLM with continuous batching and PagedAttention, speculative decoding, prefix caching, autoscaling.\n- **Guardrails on spend:** per-user quotas, budgets and alerts, and kill switches.\n\nI watch quality while optimising: every cost change is checked against the evaluation suite.",
            f: [
              ["What is continuous batching?", "Scheduling at the token level so new requests join a running batch as others finish, keeping GPUs busy and raising throughput compared with static batching."],
              ["What is speculative decoding?", "A small draft model proposes several tokens that the large model verifies in one forward pass, producing multiple tokens per step with identical output distribution."],
              ["When would you self-host rather than use an API?", "Large steady volume, strict data residency or privacy, need for custom or fine-tuned models, or tight latency control; weigh GPU operations, scaling and on-call burden."]
            ]
          },
          {
            q: "What guardrails would you put on an LLM application that talks to customers?",
            probe: "Safety and compliance thinking.",
            a: "Layered controls, since each is imperfect:\n\n- **Input:** authentication, rate limits, PII detection or masking, prompt-injection and jailbreak classifiers, topic policy checks, length limits.\n- **Prompting:** clear scope and refusal rules, grounded answering, no secrets in prompts.\n- **Output:** schema validation, toxicity and policy classifiers, PII and secret leakage filters, citation verification, claim-entailment checks against sources, and blocking unsupported promises (refunds, legal advice).\n- **Actions:** allowlisted tools, argument validation, spend limits, human approval for irreversible or high-value actions.\n- **Fallbacks:** safe refusals and handoff to a human when confidence is low or policy triggers.\n- **Governance:** audit logs, red-team test suites in CI, incident process, data retention and provider terms (no training on our data), regional and regulatory requirements (GDPR, HIPAA, SOC 2).\n\nTools: provider moderation APIs, Llama Guard-style classifiers, NeMo Guardrails, Guardrails AI and custom rule layers.",
            f: [
              ["How do you handle PII?", "Detect and redact before logging and before sending to third-party models where not needed (Presidio or similar), restrict access to traces, encrypt, and set retention limits."],
              ["What do you do when the guardrail blocks a legitimate request?", "Track false-positive rates, review blocked samples, tune thresholds per category, give users a path to appeal or escalate, and keep the guardrail evaluated like any other model."]
            ]
          }
        ]
      }
    ]
  },
  {
    id: "design", name: "AI System Design", icon: "fa-sitemap",
    summary: "Open-ended design questions: structure your answer, state assumptions and trade-offs, and cover quality, scale, cost and safety.",
    topics: [
      {
        id: "design-qs", t: "Design questions",
        qa: [
          {
            q: "Design a 'chat with your documents' product for 10,000 enterprise customers, each with their own private documents.",
            probe: "Multi-tenancy, scale, security and quality: can you structure an open-ended design?",
            a: "**Clarify:** document volume per tenant, file types, languages, latency target (p95 ~4 s), freshness needs, compliance (data residency, SOC 2), and whether answers need citations.\n\n**Ingestion (async):** upload/connectors → queue → parsers (layout-aware, OCR) → chunking (structure-aware) → embedding workers (batched) → per-tenant index. Idempotent jobs with content hashing for updates and deletes; progress status to the user.\n\n**Storage and tenancy:** metadata and permissions in Postgres; vectors in a vector DB with a mandatory tenant filter or per-tenant namespaces (separate indexes for regulated customers); raw files in object storage with per-tenant encryption keys.\n\n**Query path:** auth → query rewrite with chat history → hybrid retrieval with permission filter → rerank → context builder → LLM with a grounded prompt → streaming with citations → guardrails.\n\n**Scale:** stateless API pods autoscaled; shard indexes by tenant; large tenants on dedicated nodes; embedding and rerank services behind queues; caching; rate limits and fair-share quotas per tenant to prevent noisy neighbours.\n\n**Quality:** golden sets per customer type, online feedback, continuous evaluation.\n\n**Cost:** tiered models (small first), prompt caching, quantisation for self-hosted embedders, per-tenant usage metering.\n\n**Safety:** ACL enforcement at retrieval, injection defences, PII handling, audit logs, data deletion on request (GDPR erasure).",
            f: [
              ["How do you handle one tenant with 50 million documents?", "Dedicated index with sharding, quantised vectors plus re-scoring, hierarchical retrieval (route to collections or summaries first), aggressive metadata filtering and a tiered storage strategy."],
              ["How do you prevent one tenant's load from hurting others?", "Per-tenant rate limits and queues, weighted fair scheduling, isolated resource pools for large tenants and backpressure."],
              ["How would you support data deletion?", "Document-ID-based deletion across vector store, keyword index, caches and backups with a verified, audited process and key-based crypto-shredding for per-tenant keys."]
            ]
          },
          {
            q: "Design an AI customer-support assistant that can answer questions and take actions such as issuing refunds.",
            probe: "Agent design with safety: where does the LLM decide and where does code or a human decide?",
            a: "**Scope and metrics:** deflection/resolution rate, CSAT, escalation rate, cost per resolution, and zero policy violations on money actions.\n\n**Architecture:** a LangGraph-style workflow, not a free-roaming agent.\n- **Intent classification** (small model, structured output): FAQ, order status, refund, complaint, escalate.\n- **Knowledge answers:** RAG over help centre and policies with citations.\n- **Account actions:** tools with narrow, typed interfaces (get_order, check_refund_eligibility, issue_refund) that call internal APIs under the customer's identity; eligibility rules live in deterministic code, not in the prompt.\n- **Human-in-the-loop:** refunds above a threshold, angry customers or low confidence trigger an interrupt and a human agent receives the case with a summary.\n- **Memory:** conversation state by thread; customer profile and past tickets retrieved as context.\n\n**Safety:** least-privilege service credentials, idempotency keys for money actions, audit logs, injection defences (customer text is untrusted), PII masking in logs, rate limits.\n\n**Evaluation:** scenario simulation with scripted customers, trajectory checks (right tool, right arguments, no forbidden actions), regression suites, shadow mode before launch and staged rollout.\n\n**Fallbacks:** graceful handoff to a human with context at any point.",
            f: [
              ["Why not let the LLM decide refund eligibility?", "Policies are rules; code is deterministic, testable and auditable. Use the LLM to understand the request and explain the decision, not to be the source of truth for money."],
              ["How do you handle an angry or abusive customer?", "Sentiment and policy classifiers trigger de-escalation templates or immediate human handoff; never argue; log for review."]
            ]
          },
          {
            q: "Design a text-to-SQL assistant for business users on a large data warehouse.",
            probe: "Grounding, safety and evaluation for structured data.",
            a: "**Challenges:** huge schemas that do not fit in context, ambiguous business terms, wrong joins that look plausible, and safety.\n\n**Design:**\n1. **Semantic layer:** curated table and column descriptions, metric definitions ('active user'), join paths and example queries, stored in a vector index.\n2. **Retrieval:** from the question, retrieve relevant tables, columns, definitions and similar past queries (schema linking).\n3. **Generation:** LLM produces SQL with the retrieved context, possibly after a clarification question for ambiguous terms.\n4. **Validation:** parse with sqlglot, enforce allowlisted schemas and read-only, add LIMIT, estimate cost with EXPLAIN, reject DDL/DML.\n5. **Execution:** read-only role with row, time and cost limits; sandboxed replica.\n6. **Self-correction:** on errors feed the message back, max 2 retries.\n7. **Answer:** show the result, the SQL and the assumptions; sanity checks such as row counts and null rates.\n\n**Evaluation:** a benchmark of questions with gold SQL; measure execution accuracy (result equality), not string match; track by difficulty class; add every production failure.\n\n**Governance:** row-level security passed through, PII masking, audit trail.",
            f: [
              ["How do you handle ambiguous questions?", "Detect ambiguity (several candidate metrics or tables), ask a clarifying question, or answer with explicit assumptions stated and an option to change them."],
              ["How do you scale to thousands of tables?", "Hierarchical schema retrieval (domain → table → column), table summaries, usage statistics, and curated 'golden' tables for common questions."]
            ]
          }
        ]
      }
    ]
  }
);
