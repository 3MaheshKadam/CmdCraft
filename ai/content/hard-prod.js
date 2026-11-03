/** HARD tier: evaluation, LLMOps, serving, system design, behavioural. */
(function () {
  window.AI_HARD = window.AI_HARD || {};
  const add = (id, qa) => { (window.AI_HARD[id] = window.AI_HARD[id] || []).push(...qa); };

  add("llmops", [
    {
      lv: "hard",
      q: "Your LLM judge says the new prompt wins 62% of comparisons, but users are complaining. What could be wrong?",
      trap: "Weak answer: 'users are wrong' or 'the judge needs a better model'. Judge agreement with real preference has to be earned.",
      probe: "Skepticism about proxy metrics.",
      a: "A win-rate from a judge is a proxy for user value, and proxies diverge. Possible causes:\n\n- **Judge biases:** preference for longer, more formal or more confident answers (verbosity and style bias), position bias, and self-preference for text resembling its own output. The new prompt may simply be longer.\n- **Rubric mismatch:** the judge optimises 'helpfulness' while users care about speed, correctness on their cases, tone, or fewer follow-ups.\n- **Evaluation set mismatch:** the test set is not representative of real traffic (missing long-tail, multi-turn, messy inputs).\n- **Aggregate hides regressions:** a 62% win rate can include a cluster of serious losses (e.g. refusals, formatting breaks, hallucinations in one category).\n- **Non-quality changes:** latency, cost, formatting changes, or lost behaviours the judge does not see.\n- **Judge unreliability:** noisy, non-calibrated, inconsistent on close pairs.\n\nResponse: check judge-human agreement on a labelled sample, randomise order, control length, slice results by category and read the biggest losses, add the user complaints as new test cases, compare against online metrics (thumbs, retries, escalations) with an A/B test, and trust offline judges only to the extent they predict online outcomes.",
      f: [
        ["How do you reduce length bias in a judge?", "Instruct the judge to ignore length, compare length-matched pairs, include length as a control variable, or score against rubric criteria with concrete checks."],
        ["Why A/B test an LLM feature differently from a normal feature?", "Outputs are variable and high-variance, effects are small, novelty effects are strong, and the proper metrics (task success, rework, trust) need careful definition; use guardrail metrics and enough sample size."]
      ]
    },
    {
      lv: "hard",
      q: "Costs doubled after a release with the same traffic. How do you investigate?",
      trap: "Weak answer: 'the provider raised prices'. Measure token flows first.",
      probe: "Operational cost debugging.",
      a: "Cost = requests × tokens × price, so decompose with trace data grouped by version, endpoint, tenant and step:\n\n1. **Input tokens per request:** did the prompt grow? Conversation history without trimming, more retrieved chunks, longer system prompt, added examples, or tool definitions.\n2. **Output tokens:** a prompt change makes the model more verbose, a missing max_tokens, reasoning/thinking tokens enabled.\n3. **Calls per request:** retries on errors or validation failures, agent loops, multi-query or verification passes, duplicate calls from the client.\n4. **Model mix:** a router regression sending everything to the large model; default model changed.\n5. **Cache effectiveness:** prompt-cache hit rate dropped because the prefix is no longer static (a timestamp or user name placed early).\n6. **Tenant outliers:** one customer or bot generating heavy traffic.\n7. **Price or tier changes.**\n\nThen fix by cause: trim history and context, cap output, reorder prompts for caching, fix retry storms, restore routing, add per-user quotas and cost alerts. Add cost per successful task as a standing dashboard metric so regressions are caught at release.",
      f: [
        ["What does a prompt-cache miss look like in the data?", "Cached-token fraction falls and input cost per request jumps even though the prompts look the same, often caused by a variable value early in the prompt."],
        ["How do you prevent this class of regression?", "Evaluate token and cost metrics in CI alongside quality, alert on cost per request, and review prompt changes for length."]
      ]
    },
    {
      lv: "tricky",
      q: "p50 latency is 3 seconds but p99 is 40 seconds. Where does a long tail like that come from in an LLM system?",
      trap: "Weak answer: 'the model is slow sometimes'.",
      probe: "Tail-latency reasoning.",
      a: "Averages hide the tail; I look at the slowest traces and break them down by step. Typical sources:\n\n- **Long outputs:** a handful of requests produce thousands of tokens (no cap, verbose mode, reasoning tokens): decode time is linear in output length.\n- **Retries and timeouts:** a failed attempt followed by backoff and a retry adds the timeout duration; rate-limit (429) backoff.\n- **Agent or tool loops:** extra model calls and slow tools.\n- **Queueing:** provider or self-hosted queueing under load; batch scheduling; cold starts of autoscaled replicas.\n- **Large inputs:** long prompts raise prefill time.\n- **Slow dependencies:** vector DB, reranker, external APIs without timeouts.\n- **Network and TLS** issues, GC pauses.\n\nMitigation: cap max_tokens and enforce concise formats, tight per-step timeouts with fallbacks, hedged requests for critical paths, smarter retries (limited, jittered), cap agent steps, autoscaling headroom and warm pools, streaming so perceived latency is the time to first token, and prioritise or isolate heavy tenants. Monitor per-step p95/p99 and alert on tail growth.",
      f: [
        ["What is request hedging?", "Sending a duplicate request after a delay (e.g. the p95 time) and using whichever returns first; reduces tail latency at the cost of extra load."],
        ["Why is time-to-first-token useful?", "It measures responsiveness independent of output length and drives perceived speed when streaming."]
      ]
    },
    {
      lv: "hard",
      q: "How do you detect hallucinations when you have no ground truth?",
      trap: "Weak answer: 'ask the model if it is sure'. Self-reported confidence is poorly calibrated.",
      probe: "Practical detection methods and their limits.",
      a: "Without a reference answer, check consistency and support rather than truth:\n\n- **Grounding checks (RAG):** verify each claim is entailed by the retrieved context using an NLI model or an LLM-based claim-by-claim check; flag unsupported sentences. Also verify that quoted spans and citations exist in the sources.\n- **Self-consistency:** sample several answers; high disagreement signals uncertainty (SelfCheckGPT-style). Costs extra calls and fails when the model is consistently wrong.\n- **Token-level uncertainty:** low log-probabilities or high entropy on factual spans, where logprobs are available.\n- **Tool verification:** recompute numbers with code, check entities and URLs against databases or search.\n- **Cross-model checks:** a second model as verifier, with the usual judge caveats.\n- **Behavioural signals:** answers with specific unverifiable details (names, numbers, citations) when retrieval returned nothing.\n\nLimits: none is complete; consistent hallucinations pass self-consistency; entailment checks miss omissions. Use them to triage: auto-answer when strongly supported, hedge or abstain on weak support, and route high-stakes uncertain cases to humans. Validate any detector against a human-labelled sample.",
      f: [
        ["Why is 'ask the model for a confidence score' unreliable?", "Verbalised confidence is often poorly calibrated and influenced by phrasing; token probabilities or consistency are better, and still imperfect."],
        ["How do you measure the detector itself?", "Precision and recall of flagged hallucinations on a human-annotated set."]
      ]
    },
    {
      lv: "hard",
      q: "How do you safely roll out a new model or prompt to production?",
      trap: "Weak answer: 'test it and deploy'. The point is to bound the blast radius and have rollback.",
      probe: "Release engineering for non-deterministic systems.",
      a: "1. **Offline gate:** the new version must meet thresholds on the golden set (quality, safety, schema validity, cost, latency) and not regress any critical slice; include adversarial and regression cases from past incidents.\n2. **Shadow mode:** run the new version on live traffic in parallel without showing users; compare outputs, judge scores, latency and cost against the current version.\n3. **Canary:** serve 1-5% of traffic (sticky per user), monitor guardrail metrics (error rate, refusal rate, escalations, thumbs, complaint volume, cost per task) with automatic rollback triggers.\n4. **A/B test** for product impact where a decision needs statistical evidence.\n5. **Versioning and rollback:** immutable prompt and model versions, config-driven switch, pinned model snapshots; one-click rollback.\n6. **Provider changes:** treat a model deprecation or silent update as a release: re-run the suite on a schedule to detect drift.\n7. **Post-release:** review failure samples, add new cases to the suite, document changes.\n\nThe unifying idea: assume the change is wrong until the evidence shows otherwise, and limit the cost of being wrong.",
      f: [
        ["What guardrail metrics would trigger rollback?", "Spikes in errors, schema failures, refusals, safety flags, latency, cost per request, negative feedback, or escalation rate beyond thresholds."],
        ["How do you handle a provider that retires the model you use?", "Maintain a model-agnostic interface, keep the evaluation suite ready, test the replacement early, and migrate with the same rollout process."]
      ]
    }
  ]);

  add("design", [
    {
      lv: "hard",
      q: "Design semantic search for 100M product listings with filters, personalisation and a 100 ms budget.",
      trap: "Weak answer: 'put everything in a vector database'. A 100 ms budget over 100M items needs staged retrieval and careful filtering.",
      probe: "Large-scale retrieval system design with latency constraints.",
      a: "**Requirements:** query latency p95 < 100 ms, freshness (new listings in minutes), faceted filters (category, price, availability), personalisation, quality measured by CTR/conversion and relevance judgments.\n\n**Architecture (two-stage with a candidate generator and a ranker):**\n1. **Query understanding (~5 ms):** normalise, spell-correct, detect category/attributes, optionally embed the query with a small, fast model (cached for popular queries).\n2. **Candidate generation (~30-40 ms):** hybrid: sparse retrieval (inverted index, e.g. Elasticsearch/OpenSearch) for exact attributes and brand names, plus ANN vector search (HNSW or IVF-PQ, sharded) for semantics; filters applied inside the search (pre-filtering) via partitioning by category/region; take ~200-500 candidates; fuse with RRF.\n3. **Ranking (~30 ms):** a lightweight learned ranker (gradient-boosted trees or a small neural model) using text relevance, embedding similarity, popularity, price, freshness and user features; optional cross-encoder on the top 30 only.\n4. **Personalisation:** user embedding or recent-activity features in the ranker; keep candidate generation mostly non-personalised so it can be cached.\n5. **Serving:** shards by listing ID or category with replicas; scatter-gather with timeouts and partial results; hot-query cache; vectors quantised (int8/PQ) with re-scoring of top candidates.\n6. **Indexing:** streaming pipeline (CDC → embed → upsert) with near-real-time segments and periodic rebuilds; embedding model versioning with blue/green index swap.\n7. **Evaluation:** offline relevance sets and NDCG, interleaving and A/B tests online, monitoring of zero-result rate and latency.\n\nMemory estimate: 100M × 384 dims × 1 byte (int8) ≈ 38 GB of vectors plus graph overhead: shardable across a few machines.",
      f: [
        ["How do filters interact with ANN?", "Highly selective filters make graph search inefficient or return too few results; use partitioned indexes, filter-aware ANN, or fall back to brute force within the filtered set when it is small."],
        ["How do you keep new listings searchable quickly?", "Write to a small real-time index searched alongside the large static index, then merge periodically."]
      ]
    },
    {
      lv: "hard",
      q: "Design a RAG system for legal contracts where a wrong answer has real liability.",
      trap: "Weak answer: 'use the best model and a good prompt'. High-stakes systems need verification, abstention and auditability by design.",
      probe: "Designing for risk, not for demos.",
      a: "**Principles:** accuracy over coverage; every claim traceable; the system assists a lawyer rather than replacing one.\n\n- **Scope and policy:** define supported question types; refuse or escalate outside them (legal advice, jurisdictions not covered).\n- **Ingestion:** layout-aware parsing preserving clause structure and numbering; clause-level chunks with section path, party, effective dates and version; metadata for jurisdiction, governing law and contract type; careful table and exhibit handling.\n- **Retrieval:** hybrid search with filters (this contract, this version); reranking; for comparisons retrieve the same clause type across documents; parent-child so the full clause and its definitions are included (defined terms are resolved through a glossary).\n- **Generation:** quote the clause text verbatim, cite section and page, answer only from the context, state uncertainty, never infer beyond the text.\n- **Verification:** a second pass checks each statement against quoted spans (entailment); numeric and date values recomputed in code; confidence thresholds; answers failing verification are withheld or flagged.\n- **Human in the loop:** reviewer UI showing sources highlighted; approval before external use; feedback captured.\n- **Governance:** access control per matter, audit log of questions, retrieved text and answers, data residency and encryption, retention.\n- **Evaluation:** a lawyer-labelled benchmark including tricky clauses (exceptions, cross-references, negation), measuring citation accuracy and faithfulness, with strict release thresholds and regression tests.\n\nAccept lower automation rates in exchange for trust: the system should often say 'needs review'.",
      f: [
        ["How do you handle cross-references like 'subject to Section 12.3'?", "Parse reference graphs at ingestion, expand retrieved clauses with the referenced ones, or let an agent follow references with a step limit."],
        ["What metric would you track most closely?", "Unsupported-claim rate and citation accuracy on lawyer-reviewed samples, plus the abstention rate, since both a wrong answer and too many refusals have costs."]
      ]
    }
  ]);

  add("responsible", [
    {
      lv: "tricky",
      q: "Your product manager wants to launch next week. Your evaluation shows a 12% hallucination rate on important questions. What do you do?",
      trap: "Weak answer: 'refuse to launch' or 'launch and fix later'. The strong answer reduces risk and offers options.",
      probe: "Judgement, communication and risk management.",
      a: "I would turn it into a decision with options and numbers, not a veto.\n\n1. **Quantify the risk:** what does a hallucination cost in this product (annoyance, wrong decision, legal exposure)? Which categories drive the 12%? Often a few question types cause most of it.\n2. **Reduce quickly:** cheap mitigations this week: require citations and abstain when retrieval is weak, restrict to the question types where quality is high, add a grounding check that withholds unsupported answers, lower temperature, route risky categories to a human or a disclaimer-free 'not available'.\n3. **Offer launch options:** (a) limited beta to internal or low-risk users with feedback capture, (b) launch with a narrower scope, (c) full launch with human review on high-risk categories, (d) delay with a concrete date and exit criteria.\n4. **Define exit criteria and monitoring:** target rate by category, online monitoring, kill switch, incident process.\n5. **Communicate clearly in writing:** the data, the risks, my recommendation, and what I need from product and legal.\n\nI would recommend the narrowest option that meets the risk tolerance the business explicitly accepts.",
      f: [
        ["What if they insist on a full launch anyway?", "Escalate the risk decision to the accountable owner with a written risk summary, apply the safest feasible safeguards (kill switch, monitoring, human review, disclaimers), and document the decision."],
        ["How do you explain a hallucination rate to non-technical stakeholders?", "Use concrete examples, translate into the affected users per day, compare with the human baseline error rate, and propose actions with expected impact."]
      ]
    }
  ]);
})();
