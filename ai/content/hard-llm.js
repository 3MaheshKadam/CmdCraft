/** HARD tier: LLM internals, prompting, fine-tuning, classical ML. */
(function () {
  window.AI_HARD = window.AI_HARD || {};
  const add = (id, qa) => { (window.AI_HARD[id] = window.AI_HARD[id] || []).push(...qa); };

  add("llm", [
    {
      lv: "hard",
      q: "Temperature is 0 and the prompt is identical, yet the output differs between runs. List every reason you can think of.",
      trap: "Weak answer: 'the model is random'. At temperature 0 sampling is greedy, so the sources of variation are engineering ones.",
      probe: "Do you understand floating-point and serving-stack non-determinism?",
      a: "Greedy decoding is deterministic in theory; in practice:\n\n1. **Floating-point non-associativity:** GPU reductions sum numbers in an order that can change with kernel choice or parallelism, giving tiny differences in logits. When two tokens are near-tied, the argmax flips, and the whole continuation diverges.\n2. **Batching effects:** the same request batched with different neighbours can use different kernels or padding, changing numerics (batch invariance is not guaranteed).\n3. **Different hardware or library versions** between replicas.\n4. **Mixture-of-experts routing:** token routing depends on batch composition and capacity limits, so expert assignment can differ.\n5. **Speculative decoding or quantised kernels** with slightly different paths.\n6. **Provider changes:** silent model or system-prompt updates, load-balancing across model snapshots.\n7. **Input differences you do not see:** hidden system prompts, tool definitions, timestamps, retrieved documents in different order.\n8. **Ties and tokenisation** of logically identical text (trailing spaces).\n\nMitigations: pin model versions, use seeds where offered (best-effort), design systems that do not depend on exact text (validate structure, not wording), cache responses where reproducibility matters, and evaluate with multiple samples.",
      f: [
        ["Would a seed fix it?", "Only partially; seeds control sampling randomness, not hardware or batching numerics, and not all providers support them."],
        ["How should this change how you test LLM features?", "Assert on properties (schema valid, contains required facts, passes rubric) with tolerance, run several samples, and track pass rates instead of exact string equality."]
      ]
    },
    {
      lv: "hard",
      q: "Compute the KV-cache memory for a 70B model (80 layers, 8 KV heads via GQA, head dim 128, fp16) serving 16 requests of 32k tokens. Compare with the weight size.",
      trap: "Weak answer: 'the cache is small compared to the weights'. At long context and decent batch sizes it is often larger.",
      probe: "Can you do the capacity maths that drives serving decisions?",
      a: "Per token, the cache stores a key and a value vector for every layer and KV head:\n\n2 (K and V) × 80 layers × 8 KV heads × 128 dims × 2 bytes (fp16) = 327,680 bytes ≈ 0.31 MB per token.\n\nPer sequence of 32,768 tokens: 0.31 MB × 32,768 ≈ 10.7 GB.\nFor 16 sequences: ≈ 172 GB (about 160 GiB).\n\nWeights at fp16: 70B × 2 bytes = 140 GB. So the cache for this batch exceeds the weights. Without GQA (64 KV heads instead of 8) it would be 8× larger, which is why GQA matters.\n\nImplications: GPU memory, not compute, limits concurrency at long contexts; options are KV-cache quantisation (fp8/int8), paged allocation (vLLM PagedAttention) to avoid fragmentation, prefix sharing for common prompts, shorter contexts or summarisation, sliding-window layers, more GPUs with tensor parallelism, or offloading cold cache to CPU.",
      f: [
        ["Why does GQA reduce this?", "Several query heads share the same K/V head, so fewer K/V vectors are stored (8 KV heads instead of 64), with small quality loss."],
        ["How would this change your capacity planning?", "Max concurrent sequences ≈ (GPU memory − weights − activations) / cache per sequence; use that to size GPUs and set context and batch limits."]
      ]
    },
    {
      lv: "tricky",
      q: "Attention is O(n²) in sequence length, yet providers offer million-token contexts. How, and what remains expensive?",
      trap: "Weak answer: 'they use a bigger GPU'. The tricks are algorithmic and systems-level.",
      probe: "Knowledge of long-context techniques and their trade-offs.",
      a: "Several techniques stack:\n\n- **FlashAttention:** computes exact attention in tiles that stay in on-chip memory, avoiding materialising the n×n matrix: compute is still O(n²) but memory is O(n) and it is much faster in practice.\n- **GQA/MQA and KV quantisation:** shrink the cache.\n- **Position scaling:** RoPE interpolation/extrapolation methods (YaRN and similar) plus continued training on long data so positions beyond the original training length work.\n- **Sparse or local attention:** some layers use sliding windows or global tokens/attention sinks, reducing cost to near-linear.\n- **Distributed attention:** ring attention shards the sequence across GPUs.\n- **Chunked prefill and caching:** process long prompts in pieces and reuse prefixes.\n\nWhat remains expensive: prefill compute still grows with n (quadratically for full-attention layers), the KV cache grows linearly with n and consumes memory, latency rises, and quality is not uniform: retrieval of facts from the middle degrades, and reasoning over many pieces of evidence is weaker than over a few. So long context is a capability to use selectively, not a free replacement for retrieval.",
      f: [
        ["What is an attention sink?", "Initial tokens that attract a large share of attention regardless of content; keeping them in cache stabilises streaming and sliding-window models."],
        ["What does 'effective context length' mean?", "The length at which the model still reliably uses information, often much shorter than the advertised window; measured with needle-in-a-haystack and multi-hop long-context tests."]
      ]
    },
    {
      lv: "tricky",
      q: "Why can an LLM write a correct recursive function but fail to count the letter 'r' in 'strawberry'? Explain mechanistically.",
      trap: "Weak answer: 'LLMs are bad at math/counting'. The mechanism is tokenisation plus the lack of an internal counter, and it is fixable.",
      probe: "Connecting tokenisation to observable behaviour.",
      a: "The model never sees letters; it sees token IDs such as 'straw' + 'berry'. The characters inside a token are not explicit inputs, so spelling is something the model must have memorised indirectly from data. Counting additionally requires an exact, sequential tally, which a fixed-depth forward pass does not implement reliably; in a single pass the model approximates.\n\nCode is different: syntax and common algorithms are heavily represented in training data, and writing a function is pattern completion over tokens it does see.\n\nFixes: ask the model to spell the word out first, letter by letter, then count (chain-of-thought gives it a scratchpad where each letter is a token); or use a tool (a code interpreter) for exact operations; or character-level or byte-level model variants. The same mechanism explains weak performance on string reversal, anagrams and some arithmetic.",
      f: [
        ["Is this a limitation of transformers or of tokenisation?", "Mostly of tokenisation plus the lack of exact algorithmic computation in one forward pass; reasoning models and tools largely work around it."],
        ["What does this teach about production design?", "Delegate exact operations (counting, arithmetic, date maths, string manipulation) to code, and do not judge a model's general ability by one such failure."]
      ]
    },
    {
      lv: "hard",
      q: "Do reasoning models always beat standard models? When would you choose the standard one?",
      trap: "Weak answer: 'reasoning models are strictly better'. They trade latency and cost for accuracy on certain tasks.",
      probe: "Model selection judgement.",
      a: "Reasoning models spend extra tokens on hidden or visible chain-of-thought before answering, trained with reinforcement learning on verifiable tasks. They excel at multi-step maths, code, planning and puzzles where intermediate computation matters.\n\nI choose a standard model when: the task is simple (classification, extraction, rewriting, short Q&A) where extra thinking adds cost and latency without accuracy; latency budget is tight (interactive UX); throughput and cost dominate; or I need strict control of the output format and style. Reasoning models can also 'overthink', be harder to steer with step-by-step prompts, and are billed for thinking tokens that you cannot always see.\n\nPractical approach: evaluate both on my task, include cost and latency, and route: a cheap model by default and a reasoning model for hard queries (decided by a classifier, a failed first attempt, or a verification step). Prompting differs: give the goal, constraints and the verification criteria rather than dictating each step.",
      f: [
        ["How do thinking budgets work?", "Many APIs let you cap or set the number of reasoning tokens; a higher budget improves hard problems with diminishing returns and higher cost."],
        ["Can you distill reasoning into a small model?", "Yes: fine-tune a smaller model on reasoning traces from a stronger one; quality is task-dependent and licence terms must be checked."]
      ]
    }
  ]);

  add("prompting", [
    {
      lv: "hard",
      q: "Your model ignores an instruction that is clearly present in a long prompt. List the reasons beyond 'make it clearer' and how you would debug.",
      trap: "Weak answer: 'rewrite the prompt more clearly' without a method.",
      probe: "Systematic prompt debugging.",
      a: "Hypotheses I would test, each with a cheap experiment:\n\n- **Position and length:** instructions buried in the middle of a long prompt are followed less reliably. Move the critical instruction to the end (and the beginning), shorten the prompt.\n- **Conflicting instructions:** a later example or retrieved text contradicts it, or two rules compete. Remove or prioritise explicitly.\n- **Examples dominate:** few-shot examples that violate the rule teach the opposite behaviour.\n- **Negative phrasing:** 'do not mention X' primes X; rephrase positively.\n- **Too many instructions:** the model satisfies most but not all; split into steps or separate calls.\n- **Format pressure:** a rigid schema leaves no place for the behaviour.\n- **Injected content:** data text contains instructions.\n- **Model capability:** small models follow complex constraints worse.\n\nMethod: build a minimal failing example, bisect the prompt by removing sections, change one variable at a time, run each variant on a batch of inputs (not one), and measure pass rate. Consider enforcing in code (validators, retries, constrained decoding) rather than relying on the prompt.",
      f: [
        ["What does 'prompt sensitivity' mean?", "Small, semantically irrelevant changes (ordering, formatting, wording) can shift outputs and accuracy noticeably, so prompts must be tested across variations."],
        ["When do you stop prompting and enforce in code?", "When a rule must hold 100% (schemas, banned content, calculations): validate and retry or use constrained decoding."]
      ]
    },
    {
      lv: "tricky",
      q: "Few-shot examples change a model's behaviour with no weight updates. How does that work, and what are its limits?",
      trap: "Weak answer: 'the model learns from the examples' as if fine-tuned. It is inference-time conditioning.",
      probe: "Understanding of in-context learning and its brittleness.",
      a: "In-context learning means the examples in the prompt condition the next-token distribution: the model infers the task, the format and the label space from the pattern, then continues it. Nothing is stored; remove the examples and the behaviour vanishes. Research suggests models often learn the format and label distribution from examples more than the correctness of each answer, though quality still matters for harder tasks.\n\nLimits and gotchas: sensitivity to example order and recency (the last example has outsized influence), label balance (majority-label bias), formatting differences, copying of surface features, context cost (every call pays for the examples), and diminishing returns after a handful. Bad or unrepresentative examples teach bad behaviour. Dynamic example selection (retrieve the most similar examples per query) usually beats a fixed set.\n\nWhen the behaviour is stable and the prompt is long, fine-tuning moves it into weights, saving tokens and improving consistency.",
      f: [
        ["How would you choose examples?", "Diverse, correct, covering edge cases and the output format, balanced across labels, and ideally selected per query by similarity."],
        ["Is ICL the same as fine-tuning?", "No: it conditions behaviour temporarily within a context; fine-tuning permanently updates parameters."]
      ]
    }
  ]);

  add("finetuning", [
    {
      lv: "hard",
      q: "After LoRA fine-tuning, your model is better at the task but worse at general questions and sometimes ignores safety rules. Why, and what do you do?",
      trap: "Weak answer: 'LoRA cannot forget'. Adapters change behaviour, and narrow fine-tuning demonstrably erodes other behaviours including safety.",
      probe: "Awareness of forgetting and alignment regression.",
      a: "Fine-tuning shifts the model's output distribution toward the training data. If that data is narrow, the model overfits to its style and loses breadth (catastrophic forgetting); and refusal and safety behaviour, instilled by earlier alignment, is easily overwritten, even by benign data.\n\nContributing factors: learning rate too high, too many epochs, a large rank on all modules, no general data in the mix, a wrong chat template (the model sees an unfamiliar format and behaves oddly), and training on assistant outputs that never refuse.\n\nFixes: lower the learning rate and epochs; smaller rank or fewer target modules; mix in replay data (general instruction and safety examples, 10-30%); add refusal/safety examples relevant to your domain; evaluate on a general benchmark and a safety suite after every run; use adapter scaling at merge time (merge with alpha below 1) or keep the adapter separate and enable it only for the task; consider fine-tuning from the instruct model with a light touch, or use preference tuning for the style instead; and re-run safety evaluation before release.",
      f: [
        ["How do you measure forgetting?", "Run a fixed general capability benchmark (MMLU-style, instruction-following, your own regression prompts) before and after, plus safety/red-team prompts, and compare."],
        ["Why does a chat-template mismatch matter?", "The model was aligned with specific role tokens; training or inference with a different template means the model sees out-of-distribution input and loses instruction-following."]
      ]
    },
    {
      lv: "tricky",
      q: "Can fine-tuning teach a model new factual knowledge? Why do people say it should not be used for that?",
      trap: "Weak answer: 'yes, just train on your documents' or 'no, never'. The truth is conditional and has costs.",
      probe: "Understanding where knowledge lives and the hallucination risk.",
      a: "Pretraining stores most knowledge in weights through exposure to a fact many times in varied contexts. Supervised fine-tuning on a small set of documents can teach some facts, but poorly and unreliably: the model may memorise surface wording, fail to generalise to differently phrased questions, and, notably, studies show fine-tuning on new facts can increase hallucination because the model learns to produce confident answers about things it does not truly know.\n\nOther problems: no citations, no access control, updates need retraining, and facts become stale. For knowledge, RAG is the better tool: it grounds answers in retrievable, citable, updatable sources.\n\nFine-tuning is strong for behaviour: format, tone, domain vocabulary and reasoning style, tool-use patterns, and classification. A combined approach is common: fine-tune for how to use retrieved context and cite it, and keep facts in the retrieval layer.",
      f: [
        ["Is continued pretraining different?", "Yes: training on large volumes of domain text with the next-token objective can inject domain knowledge and vocabulary, but it is expensive, risks forgetting, and still is not a substitute for retrieval for exact, changing facts."],
        ["How would you teach a model your product catalogue?", "Index the catalogue for retrieval (and a structured lookup tool for prices and stock), and fine-tune only if you need a particular answer style."]
      ]
    },
    {
      lv: "hard",
      q: "Your fine-tuned model reproduces training examples almost verbatim and fails on slight variations. Diagnose and fix.",
      trap: "Weak answer: 'train for more epochs' or 'add more layers'.",
      probe: "Recognising overfitting and data problems in SFT.",
      a: "This is overfitting or memorisation. Likely causes: too many epochs or too high a learning rate for the dataset size; a small dataset with many near-duplicates (so the model sees the same pattern repeatedly); templated outputs with little diversity; high LoRA rank or full fine-tuning on tiny data; and training loss going near zero.\n\nDiagnosis: compare training and validation loss (validation rising while training falls), test paraphrased and out-of-distribution inputs, and check for exact-match copying of training strings.\n\nFixes: deduplicate and diversify the data (more varied inputs and phrasing, not just more rows); cut epochs to 1-3 with early stopping on validation loss; lower the learning rate; reduce rank or add dropout and weight decay; augment inputs with paraphrases; mix in general data; and use a held-out evaluation set that includes novel variations. If the dataset is tiny, prefer few-shot prompting or retrieval-selected examples over fine-tuning.",
      f: [
        ["How much data is 'enough'?", "There is no fixed number: use a learning curve; if validation performance still rises with more data, collect more; for style and format, a few hundred to a few thousand clean examples often suffice."],
        ["What is data deduplication in SFT and why does it matter?", "Removing exact and near-duplicate examples; duplicates inflate the influence of some patterns and encourage memorisation."]
      ]
    }
  ]);

  add("ml", [
    {
      lv: "tricky",
      q: "Validation accuracy is higher than training accuracy. Is that a bug?",
      trap: "Weak answer: 'yes, there must be a bug'. There are several legitimate explanations as well as bug-like ones.",
      probe: "Reasoning about how training metrics are measured.",
      a: "It is common and not necessarily a bug. Legitimate reasons: **regularisation active only in training** (dropout, noise, data augmentation make the training task harder, and training metrics are averaged during the epoch while the model is improving, whereas validation is measured after the epoch); **an easier validation set** (different distribution or smaller, so it varies); and **metric timing** (training loss is the running average across the epoch).\n\nBug-like reasons: **data leakage** (validation examples duplicated in training, or features that leak the label), **inconsistent preprocessing** between splits, evaluating training metrics in train mode versus validation in eval mode, mislabelled training data being noisier than the cleaned validation set, or class distribution differing between splits.\n\nChecks: evaluate the training set in eval mode (no dropout or augmentation), check for duplicates across splits, use cross-validation to see variance, compare class balance, and inspect a few examples.",
      f: [
        ["How does this relate to underfitting?", "If both are low and close the model underfits; validation above training alone does not tell you which regime you are in."],
        ["What would you do next?", "Re-measure training metrics under identical conditions, look at the learning curves and run k-fold to check stability."]
      ]
    },
    {
      lv: "hard",
      q: "Your classifier has AUC 0.95 offline but is useless in production. What can explain it?",
      trap: "Weak answer: 'overfitting'. AUC measures ranking, which is only one aspect.",
      probe: "Gap between offline metrics and deployed value.",
      a: "AUC measures how well scores rank positives above negatives across all thresholds. Production value depends on more:\n\n- **Calibration and threshold:** scores may be well ranked but poorly calibrated, and the operating threshold gives too many false positives for the real base rate. A model with AUC 0.95 can still have precision of 5% at 0.1% prevalence.\n- **Base-rate shift:** prevalence differs between the evaluation set (often rebalanced) and production.\n- **Distribution shift or leakage:** offline features not available or different at serving time (leakage), training/serving skew in feature computation, label delay.\n- **Selection bias:** training labels come only from cases the old system flagged.\n- **Feedback loops:** the model's decisions change future data.\n- **Wrong objective:** the business cares about cost-weighted outcomes or top-k precision, not global ranking.\n- **Latency, coverage or missing values** at serving time.\n\nChecks: evaluate on a time-based hold-out resembling production prevalence, plot precision-recall at the operating threshold, compare feature distributions train vs serving, test calibration, and run a shadow deployment with real labels before acting on predictions.",
      f: [
        ["What is training-serving skew?", "Differences between how features are computed in training (batch, historical) and in serving (online), causing the model to see different inputs than it was trained on; fixed with a shared feature pipeline or feature store."],
        ["How do you pick an operating threshold?", "From the precision-recall curve using business costs or a required precision/recall, validated on a time-split set at production prevalence."]
      ]
    },
    {
      lv: "tricky",
      q: "Why does batch normalisation misbehave with batch size 1 or in evaluation mode, and what do you use instead?",
      trap: "Weak answer: 'BatchNorm is just worse'.",
      probe: "Deep understanding of normalisation layers.",
      a: "During training BatchNorm normalises each feature using the mean and variance of the current mini-batch, then scales and shifts with learned parameters; it also keeps running averages of the statistics. At inference those running averages are used instead of batch statistics.\n\nProblems: with a tiny batch (1 or 2) the batch statistics are noisy or degenerate, making training unstable and creating a mismatch between training behaviour (batch stats) and inference (running stats). Distribution shift makes the running averages inaccurate; mixing training and eval modes accidentally (forgetting model.eval()) gives wrong outputs; and with sequences of varying length or distributed training the statistics are hard to define.\n\nAlternatives: LayerNorm (normalises across features per example, used in transformers), GroupNorm (groups of channels, good for small batches in vision), InstanceNorm, RMSNorm (cheaper, used in many LLMs), or sync BatchNorm across devices when batches are split.",
      f: [
        ["What do the learned scale and shift do?", "They let the network undo or reshape the normalisation, preserving representational capacity."],
        ["Why is LayerNorm preferred in transformers?", "It does not depend on batch size or sequence padding and behaves identically in training and inference."]
      ]
    }
  ]);
})();
