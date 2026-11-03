/**
 * HARD tier: scenario, debugging and trap questions. Extra field `lv` ("hard" | "tricky") and `trap` (the weak answer most candidates give).
 * These are appended to existing modules by id.
 */
(function () {
  window.AI_HARD = window.AI_HARD || {};
  const add = (id, qa) => { (window.AI_HARD[id] = window.AI_HARD[id] || []).push(...qa); };

  add("rag", [
    {
      lv: "hard",
      q: "Your retrieval recall@10 is 0.90, but answer correctness is only 0.60. Where do you look?",
      trap: "Weak answer: 'improve the embeddings' or 'use a better LLM'. Recall@10 is already high, so retrieval is probably not the bottleneck.",
      probe: "Can you localise a failure between pipeline stages instead of tuning the component you already know?",
      a: "High recall@10 only says the right chunk is somewhere in the top 10. Several things sit between that and a correct answer, so I take failing questions and check each stage:\n\n- **Is the evidence actually in the prompt?** If I pass 10 chunks but the context budget truncates, or the relevant one is ranked 9th of 10, the model may never use it ('lost in the middle'). Metric to look at: recall@k for the k I actually send, and the rank of the gold chunk.\n- **Context precision:** nine irrelevant or contradictory chunks beside one right one make the model hedge or pick the wrong one. Rerank and send 4-5, not 10.\n- **Does one chunk contain the full answer?** Answers needing two chunks (a condition in one, an exception in another) are 'recalled' but never assembled. Check multi-evidence questions separately.\n- **Metric mismatch:** recall is often computed at chunk-ID level while correctness needs the right span or the right document version.\n- **Generation:** the prompt, the model, answer format, or an LLM-judge that is mis-scoring.\n\nSo: split the 40% failures into 'gold chunk missing from the prompt', 'present but ignored', 'present but incomplete', and 'judge error', then fix the largest bucket.",
      f: [
        ["Would adding a reranker fix it?", "Possibly, because it improves precision at the top and lets you send fewer chunks, but only if the failures are 'present but buried'. If they are incomplete-evidence or judge errors it will not help, which is why you bucket first."],
        ["How do you tell 'ignored' from 'wrong'?", "Run the same question with only the gold chunk in the prompt. If the model answers correctly, retrieval packaging is the issue; if it still fails, it is a generation, prompt or evaluation problem."],
        ["What if the gold chunk is in the prompt and the model still gets it wrong?", "Check conflicting chunks (old vs new version), instructions that push the model to be brief or to refuse, a reasoning gap needing step-by-step, or a faulty reference answer. Then consider a stronger model or a verification pass."]
      ]
    },
    {
      lv: "tricky",
      q: "You doubled the chunk size and recall dropped. Isn't more context per chunk always better?",
      trap: "Weak answer: 'bigger chunks mean more information so recall must rise; the measurement is wrong'. In fact it often really drops.",
      probe: "Do you understand what a single vector represents and how evaluation changes when the unit of retrieval changes?",
      a: "No. A chunk is represented by ONE vector, so a larger chunk averages several topics into one point. The embedding gets blurrier, its similarity to any specific question falls, and relevant chunks can be outranked by smaller, more focused ones. With a fixed k you also see fewer distinct documents.\n\nBut two other effects can create a false drop or a false gain, so I check the measurement first:\n- **Evaluation unit changed.** If recall is defined as 'gold chunk ID in top-k', the IDs and what counts as a hit change when you re-chunk. Re-label at the span or document level (is the gold answer text contained in the retrieved text?).\n- **Token budget.** With the same k, the prompt now holds twice the text, so cost, latency and noise rise.\n\nFair comparison: same questions, answer-span-based relevance, hold the prompt token budget constant (so smaller chunks get a larger k), compare recall@budget and end-to-end correctness. Often the best setup is small chunks for matching and parent expansion for context (small-to-big), which decouples the two.",
      f: [
        ["Then why not always use tiny chunks?", "Tiny chunks lose the context needed for the embedding and for the model (pronouns, conditions, table headers), so recall for questions needing context falls and the answer is fragmentary. It is a trade-off tuned per corpus."],
        ["How would you pick the size objectively?", "Sweep sizes with overlap on a labelled set, using budget-matched metrics, and look at per-question-type results (lookup vs reasoning); choose the knee of the curve, then verify end-to-end."]
      ]
    },
    {
      lv: "hard",
      q: "You swapped to an embedding model that ranks higher on MTEB, and retrieval on your data got worse. Why, and how do you proceed?",
      trap: "Weak answer: 'MTEB is unreliable, go back'. Leaderboards are informative but not a substitute for evaluation; the question is why it failed here.",
      probe: "Knowledge of the practical pitfalls of embedding models beyond the benchmark number.",
      a: "A leaderboard average is over tasks and domains that are not mine. Causes I would check, in order:\n\n1. **Usage mistakes:** many models need different prefixes or instructions for queries and documents ('query:' / 'passage:'), a specific pooling and normalisation, and the right similarity metric. Skipping these silently degrades quality.\n2. **Truncation:** a max input length of 512 tokens cuts long chunks, so the embedding represents only the first part.\n3. **Domain and language shift:** jargon, abbreviations, code, tables or non-English text that the model saw little of.\n4. **Query style:** short keyword queries vs natural questions; the model may be tuned for one.\n5. **Index issues:** old vectors mixed with new, wrong metric in the index, different dimensionality settings.\n6. **Benchmark contamination or averaging effects:** the score gain may come from tasks irrelevant to retrieval.\n\nProcess: re-run my golden set with correct prefixes and settings, look at the per-query diffs where it got worse, and test candidates with the same harness. If a general model still falls short, add hybrid search or a reranker, or fine-tune the embedder on in-domain pairs with hard negatives.",
      f: [
        ["What is anisotropy in embedding spaces?", "Embeddings occupy a narrow cone, so even unrelated texts have high cosine similarity (e.g. 0.6-0.8). That is why absolute thresholds are unreliable and why relative ranking or calibrated scores are used."],
        ["Would you fine-tune an embedding model? How?", "Yes if the gap is large: contrastive training on (query, positive) pairs from the corpus with in-batch and mined hard negatives, synthetic queries generated by an LLM and filtered, validated against real held-out queries to avoid overfitting."]
      ]
    },
    {
      lv: "tricky",
      q: "Your cross-encoder reranker improves the average metric but makes some queries worse. How can reranking hurt?",
      trap: "Weak answer: 'rerankers are always better than embeddings'. They are better on average, not on every query type.",
      probe: "Understanding where a reranker's assumptions break.",
      a: "A reranker is another model with its own training distribution and limits, so it can lose to the first stage in specific cases:\n\n- **Exact-match queries** (IDs, error codes, names): BM25 ranked the right document first because of a rare token; a semantic reranker may prefer a fluent but wrong passage.\n- **Truncation:** cross-encoders have a max length (often 512 tokens); a long chunk is cut and the evidence falls off the end.\n- **Domain shift:** trained on web QA, not on your policy language.\n- **Candidate set too narrow or already clean:** it reorders near-ties noisily.\n- **Score semantics:** rerank scores are not comparable across queries, so a global threshold or fusing with first-stage scores without calibration misbehaves.\n- **Position of the gold chunk** in the candidate list: if it is not in the top-N retrieved, no reranker helps.\n\nMitigations: fuse reranker and first-stage ranks (RRF) instead of replacing them, route exact-match queries to keyword-heavy paths, split or window long chunks, fine-tune the reranker on in-domain pairs, and analyse the regression bucket explicitly so the metric average does not hide it.",
      f: [
        ["How do you decide how many candidates to rerank?", "Measure recall@N of the first stage and pick the point where it flattens; balance against latency since reranking cost is linear in N."],
        ["Could you skip reranking sometimes?", "Yes: if the first stage's top score has a large margin over the rest, or for exact-ID queries, skip it to save latency; this is adaptive retrieval."]
      ]
    },
    {
      lv: "tricky",
      q: "A query and a clearly irrelevant chunk have cosine similarity 0.87. How is that possible, and what does it mean for similarity thresholds?",
      trap: "Weak answer: 'the embedding model is bad'. High baseline similarity is typical, and an absolute threshold is the real mistake.",
      probe: "Do you understand the geometry and calibration of embedding scores?",
      a: "Cosine similarity values are model-specific and not probabilities. Many embedding models have a high floor: unrelated texts commonly score 0.6-0.8, and relevant ones 0.85-0.95. Other causes: boilerplate or generic chunks ('hubs') that are similar to many queries, shared formatting or topic words, and negation or specifics that embeddings blur ('not eligible' vs 'eligible').\n\nConsequences: a fixed threshold such as 0.8 'means relevant' is invalid across models, languages and query types. Better approaches: (1) rely on rank and relative gaps (score of top-1 minus top-2), (2) calibrate a threshold per model on labelled data (find the score where precision hits the target), (3) use a reranker or a small classifier to produce a relevance probability, and (4) for 'I don't know' behaviour combine a calibrated score with an LLM check that the context supports the answer.",
      f: [
        ["How would you remove hub chunks?", "Detect chunks that appear in the top-k for a large share of unrelated queries, then drop boilerplate (headers, footers, TOC) at ingestion, dedupe, or down-weight them."],
        ["Why do embeddings blur negation?", "They are trained to place topically related text together; 'A is allowed' and 'A is not allowed' share almost all content, so the vectors are close. That is a reason for rerankers and LLM verification."]
      ]
    },
    {
      lv: "hard",
      q: "Users ask 'How many contracts expire in 2025?' and 'Which department has the highest turnover?' Your RAG system answers confidently and wrongly. Why, and what do you build?",
      trap: "Weak answer: 'retrieve more chunks'. Aggregation across thousands of records cannot be done by reading a few retrieved passages.",
      probe: "Do you know the limits of RAG and when to switch to structured or agentic approaches?",
      a: "These are aggregation and analytic questions: the answer is computed over many records, but RAG retrieves a handful of semantically similar passages, so the model extrapolates from a sample and presents a guess as a fact.\n\nSolution: route by question type. A classifier or the LLM decides: lookup questions go to RAG; analytic questions go to a structured path. For the structured path I extract data into a table at ingestion time (contract end date, department, amounts) using an LLM extraction pipeline with a schema and validation, store it in SQL, and use text-to-SQL (with a semantic layer, read-only access and validation) so the database does the counting. The answer cites the query and the data.\n\nFor corpus-wide qualitative questions ('main themes') use map-reduce summarisation or GraphRAG community summaries. An agent can orchestrate: decide, call SQL or RAG tools, combine results. Always show sources and state when the data is incomplete.",
      f: [
        ["How do you make LLM-based extraction reliable?", "Strict schema with enums and 'unknown', validation rules, double extraction or a verifier pass, sampling-based human review, confidence thresholds, and tracking extraction accuracy as its own metric."],
        ["What would you tell the user when the system cannot do it?", "State the limitation and offer the correct route (run an analytics query) rather than guessing; refusal on out-of-scope question types is a feature."]
      ]
    },
    {
      lv: "hard",
      q: "Your knowledge base has several versions of the same policy. RAG keeps quoting the old one. How do you fix it properly?",
      trap: "Weak answer: 'delete the old documents' (loses history, audit and 'as of' questions) or 'tell the prompt to prefer the newest'.",
      probe: "Real-world data problems: versioning, validity and conflict.",
      a: "Similarity search has no notion of time or authority, and old versions are textually nearly identical to new ones, so both are retrieved and the model may pick either.\n\n**Ingestion:** store version, effective-from/to dates, status (current, superseded, draft) and document family ID as metadata. Detect near-duplicates across versions and link them (supersedes relation).\n**Retrieval:** default filter to status=current (or effective at the query date); support 'as of 2023' questions by date filtering; boost recency only as a tiebreaker. For multi-version retrieval, group by family and keep the latest.\n**Generation:** include version/date in the context chunk header and cite it; if conflicting statements remain, instruct the model to state the conflict and the dates instead of choosing silently.\n**Operations:** a reconciliation job that retires superseded content when a new version is published, and evaluation cases specifically about versioned facts.\n\nThis also generalises to access status (draft vs published) and jurisdictions.",
      f: [
        ["How do you handle questions like 'what changed between v2 and v3?'", "Retrieve both versions by family, diff them (programmatically or with an LLM on aligned sections) and summarise the changes with citations."],
        ["What if dates are missing in source documents?", "Infer from file metadata or content with an LLM and a confidence flag, route low-confidence ones for review, and never let unknown-date documents outrank known-current ones."]
      ]
    },
    {
      lv: "hard",
      q: "Latency doubled after you added reranking, multi-query and a verification pass. The SLA is 2 s at p95. What do you cut and how do you decide?",
      trap: "Weak answer: 'use a faster GPU' or 'remove everything'. The senior answer is measuring, then making each technique conditional.",
      probe: "Engineering trade-offs under a budget.",
      a: "Start from a per-step latency breakdown from traces, and the quality contribution of each technique from the evaluation set. Then optimise cost per unit of quality:\n\n- **Make techniques adaptive:** run multi-query only for queries a classifier marks complex or ambiguous; skip reranking when the first-stage score margin is large; run the verification pass only for high-risk categories or low-confidence answers.\n- **Cheapen the steps:** rerank 20-30 candidates, not 100; use a smaller or quantised reranker (or ONNX/TensorRT); batch rerank in one call; verify with a small model.\n- **Parallelise:** run BM25 and vector search, and multi-query variants, concurrently; overlap query rewriting with other work.\n- **Cache:** embedding of queries, retrieval results for hot queries, prompt prefix.\n- **Streaming:** start streaming the answer immediately and run verification asynchronously (flag or retract) where the product allows.\n- **Prompt size:** fewer, better chunks reduce LLM latency, partly paying for the reranker.\n\nDecision rule: keep whatever has the best (metric gain)/(latency cost); drop the rest, and confirm with the golden set plus p95 measurements, not averages.",
      f: [
        ["What is adaptive RAG?", "Routing each query to the cheapest sufficient path: no retrieval for chit-chat, single-step retrieval for simple lookups, multi-step or agentic retrieval for complex ones."],
        ["Why p95 and not the mean?", "Users experience the tail, and tail latency is driven by retries, long generations, cold caches and queueing, which averages hide."]
      ]
    },
    {
      lv: "tricky",
      q: "Hybrid search with RRF scored lower than dense-only in your evaluation. When does adding BM25 hurt?",
      trap: "Weak answer: 'hybrid is always better'. It usually is, but not unconditionally.",
      probe: "Critical thinking about a popular technique.",
      a: "Hybrid helps when exact terms matter, but it can hurt when:\n\n- **Queries are long natural-language questions** full of stopwords and generic terms; BM25 matches common words and surfaces noisy documents that, under RRF, steal slots from good dense results.\n- **The corpus is paraphrase-heavy:** users use different words than the documents, which BM25 cannot bridge.\n- **BM25 is poorly configured:** wrong analyzer (no stemming or the wrong language), chunk-level vs document-level statistics, no stopword handling, very short chunks distorting length normalisation.\n- **Fusion is naive:** RRF with equal weight and k=60 gives each list equal influence even if one is much weaker; a weighted fusion or a learned combination can be better.\n- **Evaluation labels favour semantics:** if gold passages were chosen by dense similarity, you bias against lexical hits.\n\nFix by tuning the analyzer, weighting the lists (or fusing scores after normalisation), routing by query type (keyword-like → hybrid, natural language → dense-first), checking per-query-type results, and ensuring the golden set is built independently of any retriever.",
      f: [
        ["What is SPLADE?", "A learned sparse retrieval model that expands queries and documents with weighted vocabulary terms using a transformer, keeping an inverted index but adding semantic matching."]
      ]
    },
    {
      lv: "hard",
      q: "A question needs facts from three different documents. How do you make sure the model sees all three?",
      trap: "Weak answer: 'increase top-k'. That adds noise and still ranks by similarity to the original question, not to each needed fact.",
      probe: "Multi-hop retrieval design.",
      a: "A single embedding of the whole question is close to documents about the overall topic, not necessarily to each sub-fact. Options in increasing complexity:\n\n1. **Query decomposition:** an LLM splits the question into sub-questions ('Who is the supplier?', 'Where is the plant?', 'What is the delay?'), retrieves for each, unions and dedupes the results.\n2. **Diversity-aware ranking:** MMR so near-duplicates from one document do not take every slot.\n3. **Iterative / agentic retrieval:** answer part, use the intermediate result in the next query (entity from hop 1 becomes the query for hop 2), stop when sufficient; implement as a graph with a step limit.\n4. **Structure:** entity linking, a knowledge graph or metadata joins when relationships are stable (GraphRAG).\n5. **Context assembly:** guarantee each sub-question gets slots in the prompt, label the evidence per sub-question.\n\nEvaluate with a multi-hop test set and measure 'all required evidence present' (a stricter recall) as well as final correctness; check cost and latency since this multiplies calls.",
      f: [
        ["When is this not worth it?", "If only a small fraction of queries are multi-hop; use a classifier to route those and keep the fast path for the rest."],
        ["How do you stop an iterative loop from wandering?", "Step and token limits, a 'sufficient evidence' check, deduping repeated queries and a fallback to answer with stated gaps."]
      ]
    },
    {
      lv: "tricky",
      q: "With 1M-token context windows, is RAG dead?",
      trap: "Weak answer: 'yes, just put everything in the prompt' or 'no, because context is expensive' without numbers.",
      probe: "Balanced reasoning with cost, latency, accuracy and operations.",
      a: "No, but the boundary moved. Reasons RAG remains:\n\n- **Cost:** sending 500k tokens per query at, say, a few dollars per million input tokens is cents to dollars per question, times every question and every user; retrieval sends 3-5k tokens. Prompt caching helps for a static corpus but not for permission-filtered or changing content.\n- **Latency:** prefill over hundreds of thousands of tokens takes seconds to tens of seconds.\n- **Accuracy:** effective use of context degrades with length and with distractors; models recall facts in the middle less reliably; retrieval removes noise.\n- **Corpus size:** enterprise corpora are billions of tokens; they do not fit anyway.\n- **Freshness and access control:** retrieval applies per-user permissions and updates instantly; a giant static prompt cannot.\n- **Citations and auditability:** retrieved chunks give traceable sources.\n\nWhere long context wins: a single bounded document or small set (a contract, a codebase slice) where cross-references matter, one-off analysis, and prototyping. In practice they combine: retrieve generously, then use a larger window to include whole relevant sections rather than tiny chunks.",
      f: [
        ["How would you decide for a 200-page manual with 50 queries a day?", "Compute cost per query, test accuracy both ways on the golden set; with caching of the manual as a prompt prefix, long context can be cheaper and simpler. For millions of docs or permissions, RAG."],
        ["What is the 'lost in the middle' effect?", "Models use information at the start and end of long contexts more reliably than the middle; it motivates reranking and careful ordering."]
      ]
    },
    {
      lv: "hard",
      q: "You have no labelled data and no users yet. How do you evaluate a RAG system before launch?",
      trap: "Weak answer: 'ask the LLM if the answers look good'. Ungrounded self-evaluation hides the failures you care about.",
      probe: "Practical evaluation design from zero.",
      a: "Build a dataset in layers and treat every layer's limits honestly:\n\n1. **Expert-written questions** (30-50): ask domain experts for real questions including the awkward ones, with the source passage and reference answer. Small but trustworthy: this is the 'gold' core.\n2. **Synthetic questions at scale:** sample chunks, have an LLM write questions that the chunk answers (and multi-chunk ones), then filter: remove questions answerable without the chunk, ambiguous or trivial ones, deduplicate, and manually review a sample. Beware: synthetic questions reuse the chunk's wording, which flatters lexical and embedding retrieval; paraphrase them.\n3. **Negative and adversarial cases:** unanswerable questions (the answer is not in the corpus), out-of-scope, versioned facts, near-duplicate documents, prompt-injection documents.\n4. **Metrics:** retrieval (recall@k at span level, MRR), generation (faithfulness, answer relevance, correctness vs reference, refusal accuracy), with LLM-judge calibrated on ~50 human-labelled examples.\n5. **Pre-launch:** dogfood with internal users, shadow mode, log everything, review failures weekly and feed them back.\n\nReport confidence intervals; 50 questions cannot distinguish a 2-point change.",
      f: [
        ["How do you validate that your LLM judge is trustworthy?", "Have humans label 50-100 samples, measure agreement (Cohen's kappa or accuracy) with the judge, inspect disagreements, test for position and length bias by swapping order, and iterate on the rubric until agreement is acceptable."],
        ["What is wrong with evaluating only on synthetic questions?", "They are easier and lexically close to the chunks, so metrics are inflated and miss real user phrasing and ambiguity."]
      ]
    }
  ]);
})();
