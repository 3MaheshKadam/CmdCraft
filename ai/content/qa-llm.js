/** AI interview bank: LLM fundamentals, prompting and hallucinations, fine-tuning. */
window.AI_INTERVIEW = window.AI_INTERVIEW || [];
window.AI_INTERVIEW.push(
  {
    id: "llm", name: "LLM Fundamentals", icon: "fa-microchip",
    summary: "Transformers, attention, tokens, decoding, context windows and inference cost: the 'explain it from first principles' questions.",
    topics: [
      {
        id: "llm-core", t: "How LLMs work",
        qa: [
          {
            q: "Explain how a Large Language Model generates text, from the input string to the output token.",
            probe: "A first-principles walkthrough: tokenisation, embeddings, attention, logits, sampling, the loop.",
            a: "1. **Tokenisation:** text is split into subword tokens (BPE/SentencePiece) and mapped to integer IDs.\n2. **Embeddings:** each ID looks up a learned vector; positional information (e.g. rotary embeddings) is added so the model knows order.\n3. **Transformer blocks:** the vectors pass through dozens of identical blocks. Each has masked self-attention (every token builds a query, key and value; attention weights = softmax(QKᵀ/√d), used to mix values, with a causal mask so a position only sees earlier tokens), then a feed-forward network, each wrapped with normalisation and residual connections.\n4. **Output head:** the last position's vector is projected to a logit per vocabulary token; softmax turns them into probabilities for the next token.\n5. **Decoding:** a token is chosen (greedy, or sampled with temperature/top-p/top-k), appended to the input, and the loop repeats until an end token or max length.\n\nEfficiency: the keys and values of earlier tokens are cached (KV cache) so each new token costs one step instead of recomputing the whole prefix. Training is the same forward pass with cross-entropy loss against the true next token at every position, in parallel.",
            f: [
              ["Why divide by √d_k in attention?", "Dot products grow with dimension, which pushes softmax into saturated regions with tiny gradients; scaling keeps variances stable."],
              ["What is multi-head attention and why use it?", "Several attention operations run in parallel on lower-dimensional projections, letting different heads specialise (syntax, long-range references, positional patterns); outputs are concatenated and projected."],
              ["Why is attention O(n²) and what helps?", "Every token attends to every other. FlashAttention computes it exactly with far less memory traffic; sliding-window, sparse or linear variants approximate it; GQA/MQA shrink the KV cache."],
              ["Why transformers instead of RNNs?", "Parallel training across positions, direct long-range connections through attention and better scaling with data and compute."]
            ]
          },
          {
            q: "What do temperature, top-p and top-k do? How would you set them for different tasks?",
            probe: "Practical control of generation.",
            a: "The model outputs a probability distribution over the next token.\n\n- **Temperature** divides the logits before softmax: below 1 sharpens the distribution (more deterministic), above 1 flattens it (more random); 0 means greedy.\n- **Top-k** samples only from the k most probable tokens.\n- **Top-p (nucleus)** samples from the smallest set of tokens whose cumulative probability reaches p, adapting the candidate count to the model's confidence. Min-p keeps tokens above a fraction of the top token's probability.\n\nSettings: extraction, classification, code and tool calls: temperature 0-0.2. Question answering over documents: 0-0.3. Summaries: 0.2-0.5. Creative writing and brainstorming: 0.7-1.0 with top-p ~0.9. Change temperature or top-p, not both aggressively. Even at 0, outputs can vary slightly across hardware and model versions.",
            f: [
              ["Why can temperature 0 still give different answers?", "Floating-point non-determinism in parallel hardware, batching effects, ties, and silent provider model updates."],
              ["What are frequency and presence penalties?", "They reduce the probability of tokens already used (frequency scales with count, presence is a flat penalty) to discourage repetition."]
            ]
          },
          {
            q: "What is a context window? What happens when you exceed it, and how do you manage long inputs?",
            probe: "Awareness of limits and engineering around them.",
            a: "The context window is the maximum number of tokens (input plus output) the model can attend to in one call. Exceeding it makes the API reject the request or older content is truncated. Larger windows cost more (attention and KV-cache memory grow with length), add latency and do not guarantee the model uses every part well: facts in the middle of long prompts are recalled less reliably ('lost in the middle').\n\nManaging long inputs: retrieve only relevant chunks (RAG); summarise older conversation turns and keep recent ones verbatim; hierarchical or map-reduce summarisation for long documents; trim and deduplicate context; place key instructions and evidence at the start and end; use prompt caching for stable prefixes; and choose a long-context model only when the task truly needs the whole document at once.",
            f: [
              ["Is a longer window a replacement for RAG?", "No: cost, latency, accuracy on buried facts and corpus size limits remain; RAG selects evidence and gives citations. They are complementary."],
              ["What is the KV cache and why does it matter?", "Stored keys and values of all previous tokens, reused during decoding. It grows linearly with context length and batch size and can dominate GPU memory, which limits concurrency."]
            ]
          },
          {
            q: "How do embedding models differ from generative LLMs, and how are embeddings trained?",
            probe: "Understanding bi-encoders and contrastive learning.",
            a: "A generative decoder predicts the next token. An embedding model (usually a bidirectional encoder) maps a whole text to one fixed-size vector so that similar meanings are near each other. It is trained contrastively: positive pairs (a question and its answer, a query and a relevant passage, paraphrases) are pulled together and negatives (other items in the batch plus mined hard negatives) are pushed apart, using an InfoNCE-style loss. The vector is typically a pooled (mean or [CLS]) representation of the final hidden states.\n\nUses: semantic search, RAG retrieval, clustering, deduplication, classification features and recommendation. Limits: they capture topical similarity, not logic or negation; they are language- and domain-sensitive; they cannot be mixed across models.",
            f: [
              ["What are hard negatives?", "Passages that look relevant but are not (high lexical overlap, wrong answer). Training on them sharpens the model's discrimination."],
              ["What is Matryoshka representation learning?", "Training so that the first d dimensions of the vector form a good embedding on their own, allowing truncation to smaller sizes with modest quality loss."]
            ]
          }
        ]
      }
    ]
  },
  {
    id: "prompting", name: "Prompt Engineering and Hallucinations", icon: "fa-comments",
    summary: "Prompt design patterns, structured output, reducing hallucinations, context and cost control.",
    topics: [
      {
        id: "prompt-core", t: "Prompting in practice",
        qa: [
          {
            q: "How do you design and iterate on prompts for a production feature? What techniques do you use?",
            probe: "Systematic, evidence-based approach rather than trial-and-error folklore.",
            a: "I treat prompts like code: versioned, parameterised, tested and reviewed.\n\n**Structure:** role and context, a single clear task, constraints (format, length, tone, what to avoid), delimited input data (XML tags or fences), success criteria, and the output schema. Stable instructions go first (also good for prompt caching), variable data last.\n\n**Techniques:** few-shot examples for format and edge cases (diverse, correct, consistently formatted); chain-of-thought or a dedicated reasoning model for multi-step problems; decomposition into a chain of simpler prompts; routing to specialised prompts; self-consistency or a critic pass where accuracy matters; structured outputs for machine consumption; permission to say 'unknown'.\n\n**Process:** collect real inputs, define a metric and evaluation set first, change one thing at a time, run the set after each change, track versions, and regression-test because improving one case often breaks another. I also test adversarial and edge-case inputs and watch cost and latency.",
            f: [
              ["Zero-shot vs few-shot vs chain-of-thought?", "Zero-shot: instructions only. Few-shot: add examples that teach format and behaviour via in-context learning. Chain-of-thought: ask for intermediate reasoning to improve multi-step problems; reasoning models do this internally."],
              ["How do you stop the model from ignoring part of a long prompt?", "Shorten and prioritise, put critical instructions at the start and repeat the key constraint at the end, use clear sections and numbering, split into multiple calls, and validate the output programmatically."],
              ["How do you protect a prompt from injection?", "Delimit untrusted text, state that it is data, limit tool privileges, validate outputs and never rely on the prompt alone for security."]
            ]
          },
          {
            q: "Why do LLMs hallucinate and how do you reduce it in an application?",
            probe: "Layered mitigation: retrieval, prompting, verification, evaluation.",
            a: "LLMs are trained to produce plausible continuations, not verified facts. Hallucinations arise from gaps or errors in training data, outdated knowledge, ambiguous prompts, no built-in uncertainty signal, and pressure to always answer.\n\nMitigations, layered:\n- **Ground answers in sources** with RAG and require citations; quote spans.\n- **Allow abstention:** instruct and evaluate 'I don't know' behaviour.\n- **Use tools** for facts, calculations and look-ups instead of memory.\n- **Constrain output** with schemas and enumerations.\n- **Lower temperature** for factual tasks.\n- **Verify:** a second pass (NLI or LLM checker) tests each claim against the sources; compare citations to retrieved text.\n- **Evaluate:** measure faithfulness on a test set and monitor production samples.\n- **Design UX** to show sources and uncertainty and route high-stakes cases to humans.",
            f: [
              ["Can you eliminate hallucinations?", "No. You can reduce and detect them; high-stakes uses need verification and human oversight."],
              ["Intrinsic vs extrinsic hallucination?", "Intrinsic contradicts the provided source; extrinsic adds unverifiable information not in the source. Faithfulness checks target both."]
            ]
          }
        ]
      }
    ]
  },
  {
    id: "finetuning", name: "Fine-tuning and Alignment", icon: "fa-sliders",
    summary: "When to fine-tune, LoRA/QLoRA, data preparation, RLHF vs DPO, distillation and quantisation.",
    topics: [
      {
        id: "ft-core", t: "Fine-tuning decisions and methods",
        qa: [
          {
            q: "When would you fine-tune an LLM versus using prompting or RAG? Describe a fine-tuning project you ran.",
            probe: "Good judgement about cost/benefit and practical knowledge of data, training and evaluation.",
            a: "**Decision:** I first try better prompts and examples, then RAG for knowledge, then tools for actions. I fine-tune when I need consistent style, format or tone, domain-specific skills or vocabulary, a smaller cheaper model to replace a large prompted one (lower latency and cost), or behaviour that long prompts cannot enforce. I do not fine-tune to add frequently changing facts: it is unreliable, uncitable and goes stale.\n\n**Example project:** I fine-tuned an 8B open model to classify and summarise support tickets into a strict JSON format, replacing a large API model.\n- **Data:** ~6k human-reviewed examples, deduplicated, balanced across categories, with edge cases and 'unknown' labels; 10% held out; formatted with the model's chat template; loss only on response tokens.\n- **Method:** QLoRA (4-bit NF4 base, LoRA r=16 on all attention and MLP projections), learning rate 2e-4 with cosine decay and warmup, 2 epochs, effective batch 32 via gradient accumulation, on one 24 GB GPU using Hugging Face PEFT/TRL.\n- **Evaluation:** exact-match on JSON fields, macro-F1 for categories, and a general-capability check to detect forgetting; compared against the prompted baseline.\n- **Result:** matched the large model's F1 (0.91 vs 0.92) at about 1/12 of the cost per request and half the latency.\n- **Deployment:** merged adapter, served with vLLM, monitored drift and retrained quarterly.",
            f: [
              ["What is LoRA and why does it work?", "Freeze the weight W and learn a low-rank update ΔW = BA with rank r far smaller than the layer size, scaled by alpha/r. Fine-tuning updates have low intrinsic rank, so few trainable parameters (often <1%) capture most of the change, with small checkpoints and less memory."],
              ["What does QLoRA add?", "A 4-bit quantised frozen base model (NF4 with double quantisation) plus paged optimisers, so large models can be fine-tuned on a single GPU with little quality loss."],
              ["How do you avoid catastrophic forgetting?", "Low learning rate, few epochs, LoRA instead of full fine-tuning, mix in general instruction data, and evaluate on general benchmarks as well as the task."],
              ["How much data do you need?", "Quality over quantity: hundreds to a few thousand excellent, diverse examples often suffice for style and format; more is needed for new skills. Always check the learning curve on a validation set."],
              ["How do you pick LoRA rank and target modules?", "Start with r=8-16 on attention (and MLP) projections; raise rank if underfitting, lower if overfitting; validate on held-out data."]
            ]
          },
          {
            q: "Explain RLHF and DPO. Why are preference methods used after supervised fine-tuning?",
            probe: "Understanding the alignment pipeline and recent simplifications.",
            a: "SFT teaches the model to follow instructions from demonstrations, but it cannot easily express 'answer A is better than B'. Preference optimisation uses comparisons.\n\n**RLHF:** (1) SFT model. (2) Collect human rankings of several answers to the same prompts and train a reward model to predict the preferred one. (3) Optimise the policy with reinforcement learning (PPO) to maximise the reward while a KL penalty keeps it close to the SFT model, preventing reward hacking and drift. It works but is complex and unstable: four models in memory (policy, reference, reward, value).\n\n**DPO:** re-derives the objective so the policy is trained directly on (prompt, chosen, rejected) triples with a simple classification-like loss against a frozen reference model; no reward model or RL loop, so it is simpler, cheaper and more stable. Variants: IPO, KTO (thumbs up/down data), ORPO, SimPO.\n\n**Newer:** RL with verifiable rewards (tests pass, answer matches) with GRPO, which compares sampled answers within a group instead of a value network, is used to train reasoning models. Risks across all: reward hacking, sycophancy and verbosity bias.",
            f: [
              ["What is reward hacking?", "The policy exploits flaws in the reward signal (verbosity, flattery, formatting tricks) instead of being genuinely better. Counter with KL regularisation, diverse reward sources, adversarial evaluation and human review."],
              ["What is distillation?", "Training a smaller student to imitate a larger teacher's outputs or logits to get most of the quality at lower cost; check licence terms and evaluate on your own tasks."],
              ["What is quantisation and what are its trade-offs?", "Storing weights in fewer bits (int8/int4/FP8). It cuts memory and speeds memory-bound decoding with small accuracy loss that grows at 4-bit and below, especially for small models and reasoning; verify on your task. Methods: GPTQ, AWQ, bitsandbytes NF4, GGUF k-quants."]
            ]
          }
        ]
      }
    ]
  }
);
