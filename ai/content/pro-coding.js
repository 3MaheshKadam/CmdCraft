/**
 * LIVE CODING tier: problems an interviewer asks you to write, with a working reference solution and the follow-up questions.
 * Python. Code blocks use ``` fences; the viewer renders them as code.
 */
(function () {
  const F = "```";
  const code = (q, probe, text, f) => ({ lv: "code", q, probe, a: text, f });
  window.AI_INTERVIEW = window.AI_INTERVIEW || [];
  window.AI_INTERVIEW.push({
    id: "coding", name: "Live Coding for GenAI Roles", icon: "fa-code",
    summary: "Write it on the spot: chunkers, fusion, retrieval metrics, retries, async batching, an agent loop, streaming endpoints, a LangGraph workflow. Each has a reference solution, edge cases and the follow-ups interviewers add.",
    topics: [
      {
        id: "coding-retrieval", t: "Retrieval and RAG building blocks",
        qa: [
          code("Write a token-aware text chunker with overlap that splits on paragraph and sentence boundaries.",
            "Handling of edge cases (huge sentences, overlap correctness) and clean code, not regex trivia.",
            String.raw`Approach: split into paragraphs, then sentences; greedily pack sentences into a chunk until adding the next would exceed the budget; start the next chunk with the tail of the previous one (up to the overlap budget); hard-split any single sentence larger than the budget. Pass the token counter in (a real tokenizer in production, a word count here).

${F}python
import re
from typing import Callable

def chunk_text(text: str, max_tokens: int = 400, overlap: int = 50,
               count: Callable[[str], int] = lambda s: len(s.split())) -> list[str]:
    assert 0 <= overlap < max_tokens
    sentences = []
    for para in re.split(r"\n\s*\n", text):
        sentences += [s.strip() for s in re.split(r"(?<=[.!?])\s+", para) if s.strip()]

    chunks, cur, cur_tokens = [], [], 0

    def flush():
        nonlocal cur, cur_tokens
        if cur:
            chunks.append(" ".join(cur))
        cur, cur_tokens = [], 0

    for s in sentences:
        n = count(s)
        if n > max_tokens:                      # one giant sentence: split by words
            flush()
            words = s.split()
            step = max_tokens - overlap
            for i in range(0, len(words), step):
                chunks.append(" ".join(words[i:i + max_tokens]))
            continue
        if cur_tokens + n > max_tokens:
            prev = cur
            flush()
            tail, t = [], 0                     # carry the last sentences as overlap
            for sent in reversed(prev):
                c = count(sent)
                if t + c > overlap:
                    break
                tail.insert(0, sent)
                t += c
            cur, cur_tokens = tail, t
        cur.append(s)
        cur_tokens += n
    flush()
    return chunks
${F}

Complexity is linear in the number of sentences. Edge cases handled: empty input (returns []), a sentence longer than the budget, overlap larger than the last sentence (the tail is empty rather than overflowing).`,
            [
              ["How would you add heading-aware splitting?", "Parse the document into sections first (markdown or HTML headings), chunk within each section, and prepend the heading path to every chunk before embedding; never merge text across a top-level heading."],
              ["Why pass in the token counter?", "Word counts misjudge subword tokens (code and non-English text use many more), so use the embedding model's tokenizer to respect its real limit."],
              ["How do you test it?", "Property tests: every chunk ≤ max_tokens, concatenating non-overlapping parts reconstructs the text, consecutive chunks share overlap, and no sentence is lost."]
            ]),
          code("Implement Reciprocal Rank Fusion for merging several ranked lists, with optional weights.",
            "Understanding of why RRF needs no score normalisation.",
            String.raw`RRF scores a document as the sum over lists of weight / (k + rank), with k≈60 damping the dominance of top ranks. It needs only ranks, so it works for BM25 and vector scores that live on different scales.

${F}python
from collections import defaultdict

def rrf(rankings: list[list[str]], k: int = 60, weights: list[float] | None = None):
    weights = weights or [1.0] * len(rankings)
    scores: dict[str, float] = defaultdict(float)
    for w, ranking in zip(weights, rankings):
        seen = set()
        for rank, doc_id in enumerate(ranking, start=1):
            if doc_id in seen:          # ignore duplicates within one list
                continue
            seen.add(doc_id)
            scores[doc_id] += w / (k + rank)
    # stable tie-break: higher score first, then first-seen order
    return sorted(scores.items(), key=lambda kv: kv[1], reverse=True)

# rrf([["a","b","c"], ["c","a","d"]]) -> a and c lead; b and d trail
${F}

Complexity O(total items + n log n).`,
            [
              ["When would you prefer weighted score fusion?", "When you have enough labelled data to tune weights and both score distributions are normalised (min-max or z-score); RRF is the robust default without tuning."],
              ["What does k do?", "Larger k flattens the difference between ranks (more weight to agreement across lists); smaller k favours top-ranked items."]
            ]),
          code("Write top-k cosine similarity search over a matrix of embeddings using NumPy, efficiently.",
            "Vectorisation and partial sorting instead of a full sort.",
            String.raw`Normalise once, take a matrix-vector product for all similarities, and use argpartition (O(n)) to get the top k before sorting just those k.

${F}python
import numpy as np

def top_k_cosine(query: np.ndarray, docs: np.ndarray, k: int = 5, eps: float = 1e-12):
    q = query / (np.linalg.norm(query) + eps)
    d = docs / (np.linalg.norm(docs, axis=1, keepdims=True) + eps)   # precompute once in practice
    scores = d @ q                                                   # shape (n,)
    k = min(k, scores.shape[0])
    idx = np.argpartition(-scores, k - 1)[:k]                        # top-k, unsorted
    idx = idx[np.argsort(-scores[idx])]                              # sort only k items
    return idx, scores[idx]
${F}

For repeated queries, store normalised vectors (then cosine = dot product) and batch queries as a matrix product (Q @ D.T). Beyond ~1M vectors use an ANN index (FAISS, HNSW).`,
            [
              ["What is the memory and compute cost for 1M × 768 float32 vectors?", "Memory ≈ 3 GB; one query is a 1M×768 matrix-vector product ≈ 0.77 GFLOPs, a few ms on a modern CPU with BLAS, which is why brute force is fine up to roughly this size."],
              ["How would you reduce memory?", "Float16 or int8 quantisation, Matryoshka truncation, or product quantisation with re-scoring."]
            ]),
          code("Implement Maximal Marginal Relevance (MMR) to pick k diverse yet relevant chunks.",
            "Understanding of the relevance-diversity trade-off in context assembly.",
            String.raw`MMR iteratively selects the candidate maximising lambda * sim(query, doc) - (1 - lambda) * max sim(doc, already_selected).

${F}python
import numpy as np

def mmr(query_vec: np.ndarray, doc_vecs: np.ndarray, k: int = 5, lambda_: float = 0.7) -> list[int]:
    # vectors assumed L2-normalised
    sim_q = doc_vecs @ query_vec
    selected: list[int] = []
    candidates = list(range(len(doc_vecs)))
    while candidates and len(selected) < k:
        if not selected:
            best = candidates[int(np.argmax(sim_q[candidates]))]
        else:
            redundancy = (doc_vecs[candidates] @ doc_vecs[selected].T).max(axis=1)
            scores = lambda_ * sim_q[candidates] - (1 - lambda_) * redundancy
            best = candidates[int(np.argmax(scores))]
        selected.append(best)
        candidates.remove(best)
    return selected
${F}

Complexity O(k · n · d). lambda_=1 reduces to plain top-k; lower values favour diversity.`,
            [
              ["When is MMR harmful?", "When the answer needs several near-duplicate passages (e.g. the same clause in multiple contracts) or when diversity pushes out the single best evidence; tune on your evaluation set."],
              ["Alternatives for deduplication?", "Near-duplicate removal at ingestion (MinHash/SimHash), or reranking then filtering by similarity threshold."]
            ]),
          code("Implement BM25 scoring from scratch for a small in-memory corpus.",
            "Do you know what the formula's terms mean (IDF, term-frequency saturation, length normalisation)?",
            String.raw`${F}python
import math
from collections import Counter

class BM25:
    def __init__(self, docs: list[list[str]], k1: float = 1.5, b: float = 0.75):
        self.docs, self.k1, self.b = docs, k1, b
        self.N = len(docs)
        self.avgdl = sum(len(d) for d in docs) / max(1, self.N)
        df = Counter(t for d in docs for t in set(d))                    # document frequency
        self.idf = {t: math.log(1 + (self.N - n + 0.5) / (n + 0.5)) for t, n in df.items()}
        self.tf = [Counter(d) for d in docs]

    def score(self, query: list[str], i: int) -> float:
        dl, s = len(self.docs[i]), 0.0
        for t in query:
            f = self.tf[i].get(t, 0)
            if f:
                denom = f + self.k1 * (1 - self.b + self.b * dl / self.avgdl)
                s += self.idf[t] * f * (self.k1 + 1) / denom
        return s

    def top(self, query: list[str], k: int = 5) -> list[int]:
        return sorted(range(self.N), key=lambda i: -self.score(query, i))[:k]
${F}

Meaning: IDF down-weights common terms; the tf term saturates (k1 controls how quickly); b normalises by document length (b=0 ignores length, b=1 fully normalises). Production systems use an inverted index so only documents containing a query term are scored.`,
            [
              ["Why does BM25 still matter with embeddings?", "Exact tokens (IDs, codes, rare names) are matched reliably and cheaply; hybrid search combines both strengths."],
              ["How do you make this scale?", "Inverted index (term → postings), skip documents without query terms, precompute document lengths, and use an engine such as Lucene/Elasticsearch/OpenSearch."]
            ]),
          code("Write functions for recall@k, MRR and nDCG@k to evaluate a retriever.",
            "Correctness of metrics and understanding of what each rewards.",
            String.raw`${F}python
import math

def recall_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    return len(set(retrieved[:k]) & relevant) / max(1, len(relevant))

def reciprocal_rank(retrieved: list[str], relevant: set[str]) -> float:
    for i, doc in enumerate(retrieved, start=1):
        if doc in relevant:
            return 1.0 / i
    return 0.0

def ndcg_at_k(retrieved: list[str], gains: dict[str, float], k: int) -> float:
    dcg = sum(gains.get(d, 0.0) / math.log2(i + 1) for i, d in enumerate(retrieved[:k], start=1))
    ideal = sorted(gains.values(), reverse=True)[:k]
    idcg = sum(g / math.log2(i + 1) for i, g in enumerate(ideal, start=1))
    return dcg / idcg if idcg else 0.0

def evaluate(queries):   # queries: list of (retrieved, relevant_set, gains)
    n = len(queries)
    return {
        "recall@5": sum(recall_at_k(r, rel, 5) for r, rel, _ in queries) / n,
        "mrr": sum(reciprocal_rank(r, rel) for r, rel, _ in queries) / n,
        "ndcg@10": sum(ndcg_at_k(r, g, 10) for r, _, g in queries) / n,
    }
${F}

recall@k rewards finding relevant items anywhere in the top k; MRR rewards ranking the first relevant item high; nDCG handles graded relevance and position discounts.`,
            [
              ["What if a query has no relevant documents?", "Exclude it from retrieval metrics (undefined) but track it in an 'unanswerable' slice where the right behaviour is abstention."],
              ["How do you report uncertainty?", "Bootstrap over queries to get confidence intervals and compare systems with paired bootstrap."]
            ])
        ]
      },
      {
        id: "coding-async", t: "Async, reliability and serving",
        qa: [
          code("Write an async retry helper with exponential backoff, full jitter, a timeout per attempt, and respect for Retry-After.",
            "Reliability patterns done correctly: retry only the right errors and avoid thundering herds.",
            String.raw`${F}python
import asyncio, random

class RetryableError(Exception):
    def __init__(self, msg: str, retry_after: float | None = None):
        super().__init__(msg)
        self.retry_after = retry_after          # seconds, from a Retry-After header

async def call_with_retry(fn, *, attempts: int = 5, base: float = 0.5,
                          cap: float = 30.0, timeout: float = 60.0):
    """fn is a zero-argument async callable; a fresh coroutine is created per attempt."""
    last: Exception | None = None
    for attempt in range(attempts):
        try:
            return await asyncio.wait_for(fn(), timeout=timeout)
        except (RetryableError, asyncio.TimeoutError) as e:
            last = e
            if attempt == attempts - 1:
                break
            hinted = getattr(e, "retry_after", None)
            delay = hinted if hinted is not None else random.uniform(0, min(cap, base * 2 ** attempt))
            await asyncio.sleep(delay)          # full jitter avoids synchronized retries
    raise last                                  # non-retryable errors propagate immediately
${F}

Map provider errors to RetryableError only for 429, 5xx and timeouts; do not retry 400/401/403 or validation errors, and be careful with non-idempotent side effects.`,
            [
              ["Why jitter?", "Without it, many clients that failed together retry together, causing synchronized load spikes (thundering herd)."],
              ["How do you cap total time?", "Add an overall deadline (monotonic clock) and stop retrying when the remaining time is less than the next delay plus timeout."],
              ["What about retry budgets?", "Limit retries to a fraction of total traffic (for example 10%) so a provider outage does not triple your request volume."]
            ]),
          code("Embed 100,000 texts with a rate-limited API: batch, limit concurrency, preserve order, and survive partial failures.",
            "Practical async batching and fault isolation.",
            String.raw`${F}python
import asyncio

async def embed_all(texts: list[str], embed_batch, batch_size: int = 64, concurrency: int = 8):
    """embed_batch(list[str]) -> list[vector]. Returns (results aligned to texts, {batch_start: error})."""
    sem = asyncio.Semaphore(concurrency)
    results: list = [None] * len(texts)
    errors: dict[int, Exception] = {}

    async def run(start: int):
        batch = texts[start:start + batch_size]
        async with sem:                                     # bound in-flight requests
            try:
                vecs = await call_with_retry(lambda: embed_batch(batch))
                for i, v in enumerate(vecs):
                    results[start + i] = v                  # write by index => order preserved
            except Exception as e:                          # isolate failures
                errors[start] = e

    await asyncio.gather(*(run(s) for s in range(0, len(texts), batch_size)))
    return results, errors
${F}

Re-queue failed batches (smaller size, lower priority), persist completed results (by content hash) so a crashed job resumes, and add a token-bucket limiter if the provider limits tokens per minute.`,
            [
              ["Why not use one big request?", "Providers cap batch size and tokens per request, a single failure would redo everything, and concurrency would drop."],
              ["How do you pick concurrency?", "About target throughput × latency, then lower until 429s disappear; adapt dynamically (AIMD) based on rate-limit responses."]
            ]),
          code("Implement an async token-bucket rate limiter usable for requests-per-minute and tokens-per-minute limits.",
            "Concurrency correctness without busy-waiting.",
            String.raw`${F}python
import asyncio, time

class TokenBucket:
    def __init__(self, rate_per_sec: float, capacity: float):
        self.rate, self.capacity = rate_per_sec, capacity
        self.tokens, self.ts = capacity, time.monotonic()
        self.lock = asyncio.Lock()

    async def acquire(self, n: float = 1.0):
        n = min(n, self.capacity)                       # a request larger than capacity would wait forever
        while True:
            async with self.lock:
                now = time.monotonic()
                self.tokens = min(self.capacity, self.tokens + (now - self.ts) * self.rate)
                self.ts = now
                if self.tokens >= n:
                    self.tokens -= n
                    return
                wait = (n - self.tokens) / self.rate
            await asyncio.sleep(wait)                   # sleep outside the lock

rpm = TokenBucket(rate_per_sec=500 / 60, capacity=50)           # 500 requests/min with burst 50
tpm = TokenBucket(rate_per_sec=200_000 / 60, capacity=20_000)   # 200k tokens/min

async def guarded_call(prompt_tokens: int, max_out: int, fn):
    await rpm.acquire(1)
    await tpm.acquire(prompt_tokens + max_out)          # reserve the worst case, refund later if you track usage
    return await fn()
${F}

For multiple workers use a shared limiter (Redis with an atomic Lua script). Reserve estimated tokens up front and reconcile with actual usage afterwards.`,
            [
              ["Why release the lock before sleeping?", "Holding it would block all other waiters and serialise unrelated acquisitions."],
              ["What fairness issues exist?", "Waiters retry independently so ordering is not FIFO; use a queue of waiters if strict fairness or priorities are needed."]
            ]),
          code("Write a FastAPI endpoint that streams an LLM response with Server-Sent Events and stops generating when the client disconnects.",
            "Streaming correctness: cancellation, errors mid-stream, buffering headers.",
            String.raw`${F}python
import json
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

app = FastAPI()

@app.post("/chat")
async def chat(request: Request):
    body = await request.json()

    async def events():
        stream = llm_stream(body["messages"])            # async generator from the provider SDK
        try:
            async for token in stream:
                if await request.is_disconnected():      # client left: stop paying for tokens
                    break
                yield f"event: token\ndata: {json.dumps({'t': token})}\n\n"
            else:
                yield "event: done\ndata: {}\n\n"
        except Exception as e:                           # surface errors as a stream event
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"
        finally:
            await stream.aclose()                        # closes the upstream request

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},   # stop nginx buffering
    )
${F}

Production extras: auth and per-user rate limits before opening the stream, heartbeat comments (": ping") every ~15 s to keep proxies from timing out, sequence IDs for resumable streams, request IDs in events, and a global timeout.`,
            [
              ["Why SSE rather than WebSockets?", "One-way server-to-client streaming over plain HTTP, automatic reconnection in browsers, simpler infrastructure; WebSockets are for bidirectional needs such as voice."],
              ["What breaks streaming in production?", "Reverse proxies or CDNs buffering responses, gzip middleware buffering, idle timeouts, and blocking calls on the event loop."]
            ]),
          code("Write a Pydantic-based extractor that validates LLM JSON output and repairs it by feeding the validation error back, with a retry cap.",
            "Robust structured-output handling.",
            String.raw`${F}python
import json, re
from pydantic import BaseModel, ValidationError

def strip_fences(s: str) -> str:
    s = s.strip()
    m = re.match(r"^${F}(?:json)?\s*(.*?)\s*${F}$", s, flags=re.S)
    return m.group(1) if m else s

def extract(llm_call, text: str, Model: type[BaseModel], max_retries: int = 2) -> BaseModel:
    schema = json.dumps(Model.model_json_schema())
    base = f"Extract the data as JSON matching this schema. Use null when unknown.\nSchema: {schema}\nText: {text}"
    error = None
    for _ in range(max_retries + 1):
        prompt = base if error is None else (
            f"{base}\n\nYour previous answer was invalid:\n{error}\nReturn corrected JSON only.")
        raw = llm_call(prompt)
        try:
            return Model.model_validate_json(strip_fences(raw))
        except ValidationError as e:
            error = str(e)[:600]                        # keep the repair prompt small
    raise ValueError(f"extraction failed after retries: {error}")
${F}

Prefer provider structured outputs / constrained decoding when available and keep this as the safety net; log failures with the raw output; check finish_reason for truncation (max_tokens) before blaming the model.`,
            [
              ["How do you handle partial JSON from a truncated response?", "Detect finish_reason == 'length', retry with a higher limit or a smaller extraction, never try to 'close' the JSON blindly."],
              ["What domain validation goes beyond the schema?", "Cross-field rules (totals add up), existence of referenced IDs, date ranges, enums mapped to master data."]
            ])
        ]
      },
      {
        id: "coding-agents", t: "Agents, memory and caching",
        qa: [
          code("Implement a ReAct-style tool-calling agent loop without any framework (OpenAI-style chat API).",
            "Do you understand the message protocol, termination and failure handling?",
            String.raw`${F}python
import json

def run_agent(client, model: str, tools: dict, schemas: list, user_msg: str, max_steps: int = 8) -> str:
    messages = [
        {"role": "system", "content": "You are a helpful assistant. Use tools when needed."},
        {"role": "user", "content": user_msg},
    ]
    seen = set()
    for _ in range(max_steps):
        resp = client.chat.completions.create(model=model, messages=messages, tools=schemas)
        msg = resp.choices[0].message
        messages.append(msg)                              # keep the assistant turn that contains tool_calls
        if not msg.tool_calls:
            return msg.content                            # final answer
        for call in msg.tool_calls:
            name, raw_args = call.function.name, call.function.arguments
            if (name, raw_args) in seen:                  # loop detection
                result = "Error: identical call already made; try different arguments or give an answer."
            else:
                seen.add((name, raw_args))
                try:
                    result = json.dumps(tools[name](**json.loads(raw_args)))
                except KeyError:
                    result = f"Error: unknown tool '{name}'."
                except Exception as e:                    # return errors so the model can recover
                    result = f"Error: {type(e).__name__}: {e}"
            messages.append({"role": "tool", "tool_call_id": call.id, "content": result[:4000]})
    messages.append({"role": "user", "content": "Step limit reached. Answer using what you have."})
    return client.chat.completions.create(model=model, messages=messages).choices[0].message.content
${F}

Every tool call needs exactly one tool message with the matching id. Truncate results, enforce permissions inside tools, add timeouts and a token/cost budget in real use.`,
            [
              ["How do you run parallel tool calls?", "Execute the calls concurrently (asyncio.gather or threads) but still append one tool message per call_id, in any order."],
              ["How do you add human approval for risky tools?", "Mark tools as sensitive; when called, pause the loop, persist state, and resume after approval (this is what interrupt/checkpointing gives you)."],
              ["How would you test it?", "A fake client that returns scripted tool-call messages, asserting the loop's behaviour for unknown tools, errors, repeats and the step limit."]
            ]),
          code("Trim a chat history to a token budget while keeping the system prompt and not breaking tool-call pairs.",
            "Attention to protocol constraints, a classic production bug.",
            String.raw`${F}python
def trim_history(messages: list[dict], max_tokens: int, count) -> list[dict]:
    system = [m for m in messages if m["role"] == "system"]
    rest = [m for m in messages if m["role"] != "system"]
    budget = max_tokens - sum(count(m["content"]) + 4 for m in system)

    kept: list[dict] = []
    for m in reversed(rest):                        # newest first
        cost = count(m.get("content") or "") + 4
        if cost > budget:
            break
        kept.append(m)
        budget -= cost
    kept.reverse()

    # A tool message is invalid without the assistant message that issued its tool_call.
    while kept and kept[0]["role"] == "tool":
        kept.pop(0)
    return system + kept
${F}

Improvements: also drop an assistant message whose tool_calls lost their results, summarise the dropped prefix into one message (and keep it stable to preserve prompt-cache hits), and always keep the latest user message even if it alone exceeds the budget (truncate its content instead).`,
            [
              ["Why does dropping the head of the history hurt prompt caching?", "The cached prefix no longer matches; trimming in coarse steps (for example, when exceeding 80% of the budget) keeps prefixes stable for many turns."],
              ["Sliding window vs summarisation?", "A window is cheap but forgets; summaries retain gist but cost a call and can drift; combine a rolling summary with the last N turns."]
            ]),
          code("Implement a scoped semantic cache with TTL: return a cached answer only if the query is similar enough and the scope matches.",
            "Cache correctness (scoping, expiry) over cleverness.",
            String.raw`${F}python
import time
import numpy as np

class SemanticCache:
    def __init__(self, embed, threshold: float = 0.92, ttl: float = 3600, max_items: int = 10_000):
        self.embed, self.threshold, self.ttl, self.max_items = embed, threshold, ttl, max_items
        self.vecs: np.ndarray | None = None
        self.items: list[tuple[str, str, float]] = []        # (scope, answer, expires_at)

    def _norm(self, text: str) -> np.ndarray:
        v = np.asarray(self.embed(text), dtype=np.float32)
        return v / (np.linalg.norm(v) + 1e-12)

    def get(self, query: str, scope: str) -> str | None:
        if not self.items:
            return None
        sims = self.vecs @ self._norm(query)
        now = time.time()
        for i in np.argsort(-sims)[:5]:
            if sims[i] < self.threshold:
                break
            s, answer, expires = self.items[i]
            if s == scope and expires > now:               # same tenant/permissions/model version
                return answer
        return None

    def put(self, query: str, scope: str, answer: str) -> None:
        v = self._norm(query)[None, :]
        self.vecs = v if self.vecs is None else np.vstack([self.vecs, v])
        self.items.append((scope, answer, time.time() + self.ttl))
        if len(self.items) > self.max_items:                # simple FIFO eviction
            self.vecs, self.items = self.vecs[1:], self.items[1:]
${F}

Scope should encode tenant, permission set, language, prompt/model version and source-document version so entries are invalidated correctly. Only cache answers that passed guardrails. Use an ANN index and a shared store (Redis/pgvector) in production, and tune the threshold on labelled equivalent/non-equivalent query pairs.`,
            [
              ["What bugs would you look for in review?", "Cross-tenant leakage (missing scope), no invalidation when documents change, caching personalised answers, and a threshold chosen without data."],
              ["Exact-match cache first?", "Yes: normalise whitespace/case and hash the query + scope; it is cheap and risk-free before adding similarity matching."]
            ])
        ]
      },
      {
        id: "coding-graph", t: "LangGraph",
        qa: [
          code("Build a LangGraph workflow: write → check → (retry up to 3 times | human approval | give up), with a checkpointer and a pause for approval.",
            "Fluency with state, conditional edges, loops with caps and interrupt/resume.",
            String.raw`${F}python
from typing import Annotated, TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import interrupt, Command

class State(TypedDict):
    messages: Annotated[list, add_messages]
    draft: str
    ok: bool
    attempts: int
    approved: bool

def write(state: State):
    draft = llm.invoke(state["messages"]).content
    return {"draft": draft, "attempts": state["attempts"] + 1}

def check(state: State):
    return {"ok": validate(state["draft"])}                # deterministic checks first, LLM judge if needed

def route(state: State) -> str:
    if state["ok"]:
        return "approve"
    return "give_up" if state["attempts"] >= 3 else "write"   # the loop has a hard cap

def approve(state: State):
    # No side effects before interrupt(): on resume this node re-runs from the top.
    decision = interrupt({"question": "Send this draft?", "draft": state["draft"]})
    return {"approved": decision == "yes"}

def give_up(state: State):
    return {"draft": "I couldn't produce a valid answer; escalating to a human."}

g = StateGraph(State)
for name, fn in [("write", write), ("check", check), ("approve", approve), ("give_up", give_up)]:
    g.add_node(name, fn)
g.add_edge(START, "write")
g.add_edge("write", "check")
g.add_conditional_edges("check", route, {"approve": "approve", "write": "write", "give_up": "give_up"})
g.add_edge("approve", END)
g.add_edge("give_up", END)

app = g.compile(checkpointer=InMemorySaver())              # use a Postgres saver in production
cfg = {"configurable": {"thread_id": "case-1"}}
app.invoke({"messages": [("user", "Draft a refund reply")], "draft": "", "ok": False,
            "attempts": 0, "approved": False}, cfg)         # runs until the interrupt
print(app.get_state(cfg).next)                              # ('approve',)
app.invoke(Command(resume="yes"), cfg)                      # human decision resumes the run
${F}

Points to say out loud: reducers (add_messages) vs overwrite keys, why the attempts counter exists (termination), that interrupt needs a checkpointer and re-runs its node on resume (so keep side effects out of it or make them idempotent), and how you would test with a fake model.`,
            [
              ["How would you add a timeout for the human approval?", "Run an external scheduler or a background job that resumes the thread with a default decision (reject) after the deadline; the graph itself does not wait on a clock."],
              ["How do you unit test the router?", "It is a pure function of state: call route() with crafted states (ok, attempts at 0, 2 and 3) and assert the returned branch."],
              ["How would this change for parallel reviewers?", "Fan out with Send to N reviewer nodes writing to a list key with an operator.add reducer, then a reduce node aggregates the votes."]
            ])
        ]
      }
    ]
  });
})();
