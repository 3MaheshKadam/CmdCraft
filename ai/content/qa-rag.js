/**
 * AI interview bank. Each question: { q, a, f:[[followUpQuestion, answer]...], probe }
 * `a` is a model answer written in first person: ADAPT IT to a project you really built (never claim work you did not do).
 * Lines starting "- " render as bullets; **bold** is supported.
 */
window.AI_INTERVIEW = window.AI_INTERVIEW || [];
window.AI_INTERVIEW.push({
  id: "rag", name: "RAG (Retrieval-Augmented Generation)", icon: "fa-database",
  summary: "The most common GenAI interview topic: walk through a RAG system end to end, then defend every design choice under cross-questioning.",
  topics: [
    {
      id: "rag-walkthrough", t: "Project walkthrough",
      qa: [
        {
          q: "Explain an end-to-end RAG application that you developed. How did you implement document chunking, embeddings, vector search, reranking and retrieval optimisation?",
          probe: "Do you understand every stage, the trade-offs you made, and the numbers behind them? Interviewers listen for specifics (chunk size, k, models, metrics) and for what you measured and changed.",
          a: "**Context:** I built an internal assistant that answers employee questions from ~12,000 policy documents (PDF, Word, Confluence). Goal: grounded answers with citations, under 4 seconds p95.\n\n**1. Ingestion and parsing.** Documents come from connectors on a schedule. I parse with a layout-aware parser (tables and headings preserved, OCR only for scans), clean boilerplate (headers, footers), and attach metadata: source, section path, last-updated date, department and access group.\n\n**2. Chunking.** Structure-aware: split by headings first, then recursively by paragraph to ~500 tokens with ~60 tokens overlap, never splitting tables or code blocks. Each chunk keeps its heading path as a prefix ('Leave Policy > Parental Leave') so it embeds with context. I chose the size by testing 250/500/1000 tokens on a labelled set; 500 gave the best recall@5.\n\n**3. Embeddings.** One embedding model for documents and queries (a modern API model; we compared against an open model on our own questions, not just the MTEB leaderboard). Vectors normalised, cosine similarity. Content hashes decide re-embedding so updates are incremental.\n\n**4. Vector search.** Stored in a vector DB with an HNSW index and metadata filtering (access group, document type, date). The ACL filter is applied inside the query, not after the LLM.\n\n**5. Retrieval optimisation.** Hybrid retrieval: BM25 plus dense, fused with Reciprocal Rank Fusion, because policy IDs and acronyms retrieved badly with vectors alone. For follow-up questions I rewrite the query into a standalone one using chat history. Top 40 candidates go forward.\n\n**6. Reranking.** A cross-encoder reranker scores the 40 candidates against the query and I keep the top 6. This was the biggest single quality jump.\n\n**7. Generation.** The prompt says: answer only from the context, cite chunk IDs, say 'I could not find this' otherwise. Chunks are ordered by relevance, with the best at the start and end. Temperature 0.\n\n**8. Evaluation.** A golden set of ~150 real questions with expected source chunks. I track recall@k and MRR for retrieval, and faithfulness and answer relevance for generation (LLM-judge calibrated on 50 human-graded samples).\n\n**Results:** recall@5 went from 0.62 (dense only) to 0.88 (hybrid + rerank); faithfulness 0.91; p95 latency 3.4 s.",
          f: [
            ["What was the biggest problem you hit and how did you find it?", "Answers were wrong for table-heavy documents. Looking at retrieved chunks (not the final answers) showed the parser had flattened tables into unreadable text, so retrieval was returning garbage. Fixing parsing (table-aware extraction, tables serialised as markdown with the caption) improved those questions far more than any model change. Lesson: always inspect retrieved chunks first."],
            ["How did you know the system was actually better?", "I never judged by vibes. I built a labelled golden set, froze it, and ran every change (chunk size, hybrid, reranker, prompt) against it, comparing retrieval metrics and faithfulness before and after. Changes that did not move metrics were dropped."],
            ["What would you do differently if you rebuilt it?", "Start the evaluation set earlier (I built it after the first prototype), add contextual chunk enrichment from day one, and log user feedback signals (thumbs, edits) to grow the golden set continuously."],
            ["How many documents and what scale did it handle?", "State your real numbers. A reasonable example: ~400k chunks, a few thousand queries a day; at that size an HNSW index fits in memory on one node, so there was no need for sharding."]
          ]
        },
        {
          q: "Draw or describe the architecture of a production RAG system, including offline and online paths.",
          probe: "Can you separate the indexing pipeline from the query path and mention operational concerns (freshness, ACLs, monitoring)?",
          a: "I describe two paths.\n\n**Offline (indexing):** source connectors → parsers → cleaning/normalisation → chunker → metadata enrichment → embedding service (batched, with retries) → vector store plus a keyword index (BM25). A change-detection step uses content hashes so only new/changed documents are re-embedded, and deletes are propagated. Everything is idempotent and observable (counts, failures, lag).\n\n**Online (query):** API gateway with auth → query understanding (rewrite with chat history, optional intent routing/ filters extraction) → hybrid retrieval with permission filter → reranker → context builder (dedupe, token budget, ordering) → LLM generation with a grounded prompt, streaming → guardrails (citation check, PII, refusal) → response with sources. Caches sit at the embedding step and for popular answers.\n\n**Cross-cutting:** tracing (every step logged with retrieved IDs and scores), feedback capture, evaluation jobs on the golden set, cost and latency dashboards, and a versioned config so a change in chunking or model can be rolled out and rolled back.",
          f: [
            ["Where would you put caching?", "Embedding cache (same query text), retrieval cache for hot queries, prompt-prefix caching for the static system prompt, and optionally a semantic answer cache for FAQ-style traffic. Never cache personalised or permission-dependent answers across users."],
            ["Where are the likely latency bottlenecks?", "LLM generation first (time to first token and output length), then the reranker, then embedding the query. Mitigate with streaming, smaller models for easy queries, a limited rerank candidate set and parallelising the BM25 and vector queries."],
            ["How do you keep the index fresh?", "Webhook or scheduled change detection, content hashing for incremental updates, tombstones for deletions, and a periodic full reconciliation job that compares source and index counts."]
          ]
        }
      ]
    },
    {
      id: "rag-chunking", t: "Chunking and ingestion",
      qa: [
        {
          q: "How did you decide your chunking strategy? What chunk size and overlap did you use, and why?",
          probe: "Whether you treat chunking as an empirical decision tied to retrieval metrics, not a default copy-pasted from a tutorial.",
          a: "Chunking determines what a single vector represents, so it directly sets retrieval quality. Too small and a chunk loses the context needed to be understood; too large and the embedding blurs several topics and wastes prompt tokens.\n\nI started with a baseline (recursive character splitting, ~500 tokens, ~10-15% overlap) then evaluated alternatives on a labelled question set using recall@k: fixed-size at 256/512/1024, structure-aware by headings, semantic chunking, and parent-child.\n\nWhat won for our documents was structure-aware splitting: respect headings, paragraphs and tables first, then size-limit. Overlap was ~10-15% so a sentence cut at a boundary still appears whole in one chunk. I also prepended the section path to each chunk before embedding. I would pick different settings for different content: short FAQ entries need no splitting, long legal text benefits from parent-child, code needs function-level splitting.",
          f: [
            ["What is parent-child (small-to-big) retrieval?", "Index small chunks (~150-250 tokens) for precise matching, but return the larger parent section (~800-1500 tokens) to the LLM for context. It improves both match precision and answer completeness at the cost of a more complex store and larger prompts."],
            ["What is semantic chunking and when is it worth it?", "Split where the embedding similarity between adjacent sentences drops, so chunks follow topic shifts. It helps for unstructured prose (transcripts, long articles) but costs extra embedding calls and gives variable chunk sizes. For documents with clear structure, heading-based splitting is cheaper and usually as good."],
            ["How do you chunk tables, code and PDFs with images?", "Tables: keep intact, serialise as markdown/CSV with caption and header repeated; large tables split by row groups with the header repeated. Code: split on function/class boundaries using a language-aware splitter. Images and scanned pages: OCR, or a vision model to caption, or a page-image embedding model such as ColPali; store the caption as the chunk and keep a link to the original."],
            ["What happens if the overlap is too big?", "Many near-duplicate chunks fill the top-k with the same text, wasting context and lowering diversity; index size grows. MMR or deduplication helps, but usually 10-20% is plenty."]
          ]
        },
        {
          q: "How do you handle metadata, document updates and deletions in the index?",
          probe: "Operational maturity: RAG is not only a one-time script.",
          a: "Each chunk stores a stable document ID, chunk index, source URL, section path, content hash, timestamps, language, doc type and access-control fields. Metadata is used three ways: filtering (per tenant, department, date range), boosting freshness, and citations.\n\nUpdates: a change-detection job compares the document's hash with the stored one; if different I delete that document's old chunks and insert the new chunks in one logical operation (or write a new version and flip an 'active' flag so queries never see a half-updated document). Deletes remove all chunks by document ID. A nightly reconciliation compares the source of truth with the index to catch drift.\n\nI also store the embedding model name and version per chunk, because changing the embedding model requires re-embedding everything into a new index and switching over (blue/green).",
          f: [
            ["What if the embedding model changes?", "Vectors from different models are incompatible. Build a new index with the new model in parallel, evaluate it on the golden set, then switch traffic and retire the old one."],
            ["How would you avoid exposing a half-updated document?", "Write new chunks under a new version ID, and only switch the document's 'current version' pointer once all chunks are indexed; queries filter on the current version."]
          ]
        }
      ]
    },
    {
      id: "rag-embeddings-vector", t: "Embeddings and vector search",
      qa: [
        {
          q: "How did you choose the embedding model and the vector database?",
          probe: "Evidence-based selection and awareness of operational trade-offs.",
          a: "**Embedding model:** I shortlisted models from MTEB (retrieval tasks) but made the decision on our own data: 150 real questions with known relevant chunks, comparing recall@5/10 and MRR. I also weighed dimensions (storage and speed), max input length, multilingual needs, price, rate limits and whether we needed to self-host for data residency. Some models need different prefixes for queries versus documents, which I checked.\n\n**Vector DB:** requirements were metadata filtering, hybrid search, updates/deletes, scale (hundreds of thousands of chunks growing to millions), cost and ops overhead. I compared pgvector (we already ran Postgres, simplest ops, good to a few million vectors), a dedicated engine (Qdrant/Weaviate/Milvus: richer filtering and scale-out) and a managed service (Pinecone: no ops, higher cost). For our scale and team size, [pgvector / Qdrant] was the best fit.",
          f: [
            ["What is HNSW and what are its main parameters?", "A layered proximity graph. Search starts at a sparse top layer and descends, greedily moving toward the query. Parameters: M (links per node; higher = better recall, more memory), efConstruction (build-time search breadth; higher = better index, slower build) and efSearch (query-time breadth: the recall vs latency knob). It needs the graph in memory."],
            ["How do IVF and PQ differ from HNSW?", "IVF clusters vectors and searches only the nearest clusters (nprobe controls recall); PQ compresses vectors into short codes to save memory and speed distance computation, at some recall loss. IVF-PQ suits very large datasets where memory is tight; HNSW gives higher recall at moderate scale."],
            ["Cosine vs dot product vs L2?", "If vectors are normalised, cosine equals dot product, and ranking by L2 gives the same order too. Use the metric the model was trained with; normalise once and use dot product for speed."],
            ["How would you scale to 100 million vectors?", "Shard by tenant or ID range, use quantisation (scalar/binary/PQ) with re-scoring of the top candidates using full vectors, disk-based indexes (DiskANN), Matryoshka-truncated dimensions, and aggressive metadata filtering to cut the search space."],
            ["Why might nearest-neighbour search return irrelevant results?", "Embeddings capture topical similarity, not exact facts or negation; chunks lacking context; a wrong metric or un-normalised vectors; stale index; too-low efSearch; or a domain the embedding model handles poorly."]
          ]
        },
        {
          q: "Dense retrieval misses exact keywords and codes. How did you handle that?",
          probe: "Knowledge of hybrid search and its implementation.",
          a: "I added sparse retrieval and combined it with dense. BM25 (or SPLADE-style learned sparse) ranks documents by exact term match and rarity, which is precisely what embeddings lose for product codes, error messages, names and acronyms.\n\nBoth retrievers run in parallel on the same query. I fuse the two ranked lists with Reciprocal Rank Fusion: score(d) = Σ 1/(k + rank_i(d)), commonly k=60. RRF needs no score normalisation, which matters because BM25 and cosine scores are on different scales. The fused list (top 30-50) goes to the reranker. On our golden set hybrid lifted recall@10 from 0.74 to 0.85, mostly on questions with identifiers and abbreviations.",
          f: [
            ["Why not just add the two scores?", "They have different distributions and scales, so one would dominate. You would need normalisation (min-max or z-score) and a tuned weight. RRF uses only ranks and is robust without tuning; weighted fusion can be better when you have enough data to tune alpha."],
            ["Can you do hybrid search inside one database?", "Yes: Elasticsearch/OpenSearch, Weaviate, Qdrant (sparse vectors), Milvus and Postgres (pgvector + full-text search) support combining keyword and vector queries natively."]
          ]
        }
      ]
    },
    {
      id: "rag-rerank-optimise", t: "Reranking and retrieval optimisation",
      qa: [
        {
          q: "Why did you add a reranker, how does it work, and what did it cost in latency?",
          probe: "Understanding bi-encoder vs cross-encoder and the retrieve-then-rerank pattern.",
          a: "First-stage retrieval uses a bi-encoder: query and document are embedded separately and compared with a cheap vector operation, which is fast but loses fine-grained interaction. A cross-encoder reads the query and one candidate together through the transformer, so it can model exact relationships between them and is much more accurate, but it needs one forward pass per candidate, so it is only affordable on a short list.\n\nPattern: retrieve 40-100 candidates cheaply (hybrid), rerank them with a cross-encoder (Cohere Rerank, bge-reranker, or an LLM-based reranker), keep the top 5-8. This gave the largest quality gain in my evaluations (MRR +0.12).\n\nCost: reranking 40 passages of ~500 tokens took about 150-250 ms with a hosted reranker or a GPU-served model. I limited candidates to 40 and ran it in parallel with other work where possible. Using fewer, better chunks also reduced the LLM prompt size, partly offsetting the latency.",
          f: [
            ["Bi-encoder vs cross-encoder vs ColBERT?", "Bi-encoder: one vector per text, fastest, least precise. Cross-encoder: joint scoring, most precise, slowest, cannot be precomputed. ColBERT/late interaction: stores a vector per token and scores with MaxSim, between the two: more precise than bi-encoders, precomputable, but larger indexes."],
            ["Can you use an LLM as the reranker?", "Yes (pointwise scoring, listwise ranking such as RankGPT). It can reason about relevance and follow custom criteria but is slower and costlier and can be inconsistent; a fine-tuned cross-encoder is usually the production choice."],
            ["How would you decide how many candidates to rerank?", "Measure recall@N of the first stage: pick N where recall stops improving materially (often 30-50), then balance with latency budget."]
          ]
        },
        {
          q: "Beyond hybrid search and reranking, what other retrieval optimisations did you apply?",
          probe: "Breadth of techniques and judgement about when each is worth its cost.",
          a: "I treated optimisation as a measured loop: find failures in the golden set, categorise them, apply the technique that targets that failure class.\n\n- **Query rewriting** for follow-ups ('what about 2023?') using chat history so retrieval has a standalone query.\n- **Multi-query / decomposition** for compound questions: generate 2-3 sub-queries, retrieve for each, union the results.\n- **HyDE** for very short or abstract queries: embed a generated hypothetical answer.\n- **Metadata filters / self-querying**: extract filters (year, product, region) from the question and apply them in the vector query.\n- **Parent-child retrieval** for answers that need surrounding context.\n- **Contextual chunk enrichment**: prepend an LLM-written one-line situating context to each chunk before embedding.\n- **MMR / deduplication** to avoid near-duplicate chunks filling the context.\n- **Context compression and ordering**: trim irrelevant sentences and put the strongest evidence first and last.\n- **Score thresholds**: if top scores are below a threshold, say 'not found' instead of generating a guess.\n\nI only kept a technique if it improved recall or faithfulness on the evaluation set by more than its added latency and cost justified.",
          f: [
            ["Which one gave the best return?", "Be honest and specific. Typically: parsing quality, hybrid search, then reranking; query rewriting for multi-turn chat; the others are situational."],
            ["When does multi-query retrieval hurt?", "It increases latency and cost and can pull in noisy results that dilute the context. Use it only for ambiguous or compound questions, ideally triggered by a classifier."],
            ["How do you handle 'lost in the middle'?", "Retrieve fewer, better chunks (rerank), put the most relevant at the beginning and end of the context, compress irrelevant text, and keep the context window small enough that the model attends well."]
          ]
        }
      ]
    },
    {
      id: "rag-generation-eval", t: "Generation, evaluation and failure analysis",
      qa: [
        {
          q: "How do you evaluate a RAG system? What metrics do you use for retrieval and for generation?",
          probe: "Separation of retrieval vs generation evaluation, golden datasets and awareness of LLM-judge limits.",
          a: "I evaluate the two halves separately, otherwise I cannot tell what to fix.\n\n**Dataset:** a golden set of ~150-300 questions from real users (plus synthetic ones generated from chunks and then spot-checked), each with the expected source chunks and a reference answer, including unanswerable and adversarial questions.\n\n**Retrieval metrics:** hit rate / recall@k (was a relevant chunk in the top k), MRR (rank of the first relevant chunk), NDCG for graded relevance, context precision (share of retrieved context that is relevant) and context recall (does it contain everything needed).\n\n**Generation metrics:** faithfulness/groundedness (every claim supported by context), answer relevance (addresses the question), correctness versus the reference, citation accuracy and correct refusals for unanswerable questions. I use an LLM judge with a fixed rubric, low temperature and pairwise comparisons, calibrated against ~50 human-labelled samples; tools like RAGAS, DeepEval or TruLens help.\n\n**Online:** thumbs up/down, 'I don't know' rate, escalation rate, latency and cost per answer; low-scoring conversations are reviewed weekly and added to the golden set.",
          f: [
            ["Your faithfulness score is high but users are unhappy. Why?", "The answer may be faithful to the retrieved context but the context was wrong or incomplete (retrieval failure), the question was misunderstood, or the answer is correct but not helpful (too long, wrong format). Check context recall and answer relevance, and read real failures."],
            ["What are the weaknesses of LLM-as-judge?", "Position and verbosity bias, self-preference, inconsistency and sensitivity to rubric wording. Mitigate with pairwise comparison, swapping order, strict rubrics, a stronger judge model and calibration against human labels."],
            ["How do you build a golden set from scratch with no users yet?", "Have domain experts write real questions, generate synthetic questions from sampled chunks (then filter and review), and include paraphrases, multi-hop and unanswerable cases; refresh it with production queries after launch."],
            ["How do you detect regressions before release?", "Run the full evaluation suite in CI on every change to chunking, models or prompts and block merges that drop key metrics beyond a threshold; compare against the previous version."]
          ]
        },
        {
          q: "Your RAG assistant gave a wrong answer in production. Walk me through how you debug it.",
          probe: "A systematic debugging process, not guessing.",
          a: "I follow the pipeline in order and use the trace for that exact request.\n\n1. **Was the answer in the knowledge base at all?** If not, it is a content gap or ingestion failure (parsing, a missing connector, filtered by access rules).\n2. **Was it retrieved?** Look at the top-k chunks and scores. Not retrieved though present means a retrieval problem: chunking cut the answer apart, the query needed rewriting, a keyword/ID needs hybrid, the embedding model handles the domain poorly, or a filter excluded it.\n3. **Was it retrieved but ranked low or dropped?** Reranker, k, or token budget issue.\n4. **Was it in the prompt but ignored or misused?** Context ordering, too much noise, prompt wording, or model capability; check for contradiction between chunks and outdated versions.\n5. **Was the source itself wrong or stale?** Fix the document and add freshness metadata.\n\nThen I add the failing case to the golden set, make the fix, and confirm the metrics move without regressing others.",
          f: [
            ["What tooling do you use for this?", "Request-level tracing (LangSmith, Langfuse, Phoenix or OpenTelemetry) recording the rewritten query, retrieved IDs and scores, final prompt, model output and latency per step."],
            ["How do you stop the assistant guessing when retrieval fails?", "A relevance score threshold plus a prompt instruction to answer 'not found' and a faithfulness check on the output; for important domains route to a human."]
          ]
        },
        {
          q: "How do you reduce hallucinations in a RAG system?",
          probe: "Layered mitigations, not just 'prompt it better'.",
          a: "Hallucination has several sources, so I mitigate at each layer:\n\n- **Retrieval quality:** better parsing, hybrid search, reranking; most 'hallucinations' are actually missing or wrong context.\n- **Grounded prompting:** answer only from the provided context, quote and cite chunk IDs, and say 'I don't know' when the context lacks the answer; permission to refuse matters.\n- **Decoding:** temperature 0-0.2 for factual answers.\n- **Structured output:** require a citation field and verify that quoted spans actually appear in the sources.\n- **Post-generation verification:** a second pass (NLI model or LLM checker) tests whether each claim is entailed by the context and removes or flags unsupported claims.\n- **Thresholds and fallbacks:** low retrieval scores trigger a refusal or escalation.\n- **Evaluation:** track faithfulness continuously and review failures.",
          f: [
            ["Does a bigger context window remove the need for RAG?", "No. Long context costs more per call, adds latency, can distract the model, still has limited effective recall for buried facts, and cannot hold an entire enterprise corpus. RAG selects the relevant evidence; long context and RAG are complementary."],
            ["Why not fine-tune the model on the documents instead?", "Fine-tuning is poor at reliably injecting facts, cannot show citations, cannot respect per-user permissions, and goes stale when documents change. RAG is cheaper to update and auditable. Fine-tuning helps with style, format and domain language."]
          ]
        }
      ]
    },
    {
      id: "rag-advanced-prod", t: "Advanced RAG, security and production",
      qa: [
        {
          q: "What is GraphRAG and when would you use it instead of standard RAG?",
          probe: "Whether you know the limits of chunk-based RAG on multi-hop and global questions.",
          a: "Standard RAG retrieves a handful of similar chunks, which works for questions answered in one or two passages. It struggles with multi-hop questions ('which suppliers of our delayed product also supply the Berlin plant?') and global questions ('what are the main themes in these 5,000 incident reports?').\n\nGraphRAG builds a knowledge graph: an LLM extracts entities and relationships from chunks, the graph is stored (Neo4j or similar), communities of related entities are detected (e.g. Leiden algorithm) and summarised hierarchically. At query time, local questions traverse the graph from matched entities and gather connected facts; global questions are answered from community summaries.\n\nUse it when relationships between entities are central or when you need corpus-wide synthesis. Costs: expensive indexing (many LLM calls), schema and entity-resolution work, and harder updates. For ordinary document Q&A, hybrid + reranking is far cheaper and usually sufficient.",
          f: [
            ["How would you do multi-hop question answering without a graph?", "Decompose the question into sub-questions, retrieve and answer iteratively (agentic RAG), feeding earlier answers into later queries; or use iterative retrieval (IRCoT)."],
            ["What is agentic RAG?", "An agent decides whether to retrieve, which source or tool to use, grades the retrieved documents, rewrites the query and retries, and verifies its answer. It improves hard queries at the price of higher latency, cost and variability, and is naturally built as a LangGraph state machine."]
          ]
        },
        {
          q: "How do you secure a RAG application? How do you enforce document-level access control?",
          probe: "Security awareness: permission leakage and prompt injection are real production failures.",
          a: "**Access control:** every chunk stores its permission metadata (groups, tenant, classification) copied from the source system. At query time I resolve the user's identity and groups and apply them as a mandatory filter inside the vector and keyword queries, so unauthorised chunks are never retrieved. Relying on the prompt ('do not reveal confidential info') is not security, because anything that reaches the context can leak. Permissions are refreshed when source ACLs change.\n\n**Prompt injection:** retrieved documents are untrusted. I delimit them clearly, instruct the model to treat them as data, avoid giving the model tools with side effects in the same context, and strip or flag instruction-like text. I validate outputs and never auto-render links or images from model output that could exfiltrate data.\n\n**Privacy:** PII detection/redaction before indexing and logging, encryption at rest and in transit, tenant isolation, data-retention policies, and provider contracts that disable training on our data.\n\n**Abuse:** authentication, rate limits, query logging and audit trails.",
          f: [
            ["What is the multi-tenant design for the vector store?", "Either a namespace/collection per tenant (strong isolation, more overhead) or a shared index with a mandatory tenant_id filter (cheaper, needs strict enforcement and testing). For regulated customers, separate indexes or databases."],
            ["How do you test for permission leakage?", "Automated tests with users of different roles asking questions whose answers exist only in restricted documents; assert that neither the retrieved chunks nor the answers contain them."]
          ]
        },
        {
          q: "How would you reduce latency and cost of a RAG system serving thousands of users?",
          probe: "Practical performance engineering for LLM apps.",
          a: "First measure where time and money go: per-step latency and tokens from traces. Typical levers:\n\n- **Fewer, better tokens:** rerank to 4-6 chunks, compress context, short system prompts; input tokens drive cost and time-to-first-token.\n- **Model routing:** a small cheap model for simple questions and a larger model for hard ones (decided by a classifier or retrieval confidence).\n- **Caching:** embedding cache, retrieval cache, provider prompt-prefix caching for the static instructions, semantic cache for repeated FAQs.\n- **Streaming** the answer so users see tokens immediately.\n- **Parallelism:** run BM25 and vector search concurrently; overlap rewrite and retrieval where possible.\n- **Right-size infrastructure:** batch embeddings, connection pooling, async I/O, quantised self-hosted models if volume justifies it.\n- **Limits:** cap max output tokens, rate limit per user, and use batch APIs for non-interactive jobs.\n\nI track cost per answer and p95 latency as first-class metrics, with alerts.",
          f: [
            ["What is the risk of semantic caching?", "A similar-but-different question can return a wrong cached answer; permission-dependent or time-sensitive answers can leak or go stale. Use high similarity thresholds, scope the cache per tenant, and add TTLs."],
            ["When would you self-host the LLM?", "High and steady volume that beats API cost, strict data-residency or privacy needs, latency control, or customisation. It adds GPU ops, scaling and monitoring work (vLLM, quantisation, autoscaling)."]
          ]
        }
      ]
    }
  ]
});
