/** AI interview bank: ML and deep-learning fundamentals interviewers still ask. */
window.AI_INTERVIEW = window.AI_INTERVIEW || [];
window.AI_INTERVIEW.push({
  id: "ml", name: "ML and Deep Learning Fundamentals", icon: "fa-chart-line",
  summary: "Overfitting, metrics, validation, core algorithms and neural-network training questions that appear in almost every AI interview.",
  topics: [
    {
      id: "ml-core", t: "Core machine learning",
      qa: [
        {
          q: "Explain overfitting and the bias-variance trade-off. How do you diagnose and fix overfitting?",
          probe: "A fundamentals check that should be crisp and example-driven.",
          a: "Overfitting is when a model fits noise and idiosyncrasies of the training data and fails to generalise: training error is low, validation error is high. Underfitting is the opposite: the model is too simple and both errors are high.\n\nBias-variance: expected error = bias² (systematic error from wrong assumptions) + variance (sensitivity to the particular training sample) + irreducible noise. More complexity lowers bias and raises variance.\n\n**Diagnose:** compare training and validation error; learning curves (a persistent gap = high variance; both high and close = high bias); cross-validation variance.\n\n**Fix overfitting:** more or better data, data augmentation, simpler model, regularisation (L1/L2, dropout, weight decay), early stopping, ensembling (bagging), feature selection, cross-validation for model selection.\n**Fix underfitting:** richer features, more expressive model, less regularisation, train longer.\n\nExample: a deep decision tree reaches 100% training accuracy and 70% on validation; limiting depth or using a random forest reduces variance and raises validation accuracy.",
          f: [
            ["How does regularisation help?", "It penalises complexity (large weights or too many features), trading a small increase in bias for a larger decrease in variance. L1 produces sparse solutions, L2 shrinks weights smoothly."],
            ["What is early stopping?", "Stop training when validation loss stops improving and restore the best checkpoint, preventing the model from memorising the training set."],
            ["What is double descent?", "In very over-parameterised models, test error can fall again after the interpolation threshold, so 'bigger always overfits' is not universally true."]
          ]
        },
        {
          q: "A fraud model has 99.5% accuracy. Is that good? Which metrics would you use and why?",
          probe: "Metric selection on imbalanced data and business-cost thinking.",
          a: "Not necessarily. If only 0.5% of transactions are fraud, a model that never flags anything is 99.5% accurate and useless. Accuracy hides performance on the rare class.\n\nI would look at the confusion matrix and use precision (of flagged items, how many are fraud), recall (of real fraud, how many caught), F1 (harmonic mean) and PR-AUC, which is more informative than ROC-AUC under heavy imbalance. The decision threshold is chosen by business cost: a missed fraud has a monetary loss, a false alarm has a review cost and customer friction, so I optimise expected cost or pick recall at a fixed precision/alert budget.\n\nAlso: stratified splits, class weights or resampling (SMOTE with care, only on the training fold), calibrated probabilities, monitoring for drift, and evaluating by time-based splits to avoid leakage.",
          f: [
            ["Precision vs recall: which matters here?", "Depends on costs and review capacity: if investigators are limited, precision at top-k matters; if losses are large, recall. State the trade-off and choose a threshold with the business."],
            ["ROC-AUC vs PR-AUC?", "ROC-AUC includes true negatives and can look excellent on imbalanced data; PR-AUC focuses on the positive class and reflects the effort/precision trade-off."],
            ["How do you handle class imbalance?", "Class weights, resampling on the training set only, threshold tuning, anomaly-detection approaches, better features, and appropriate metrics."]
          ]
        },
        {
          q: "What is data leakage? Give examples and explain how you prevent it.",
          probe: "A very common cause of too-good-to-be-true results.",
          a: "Leakage is when information that would not be available at prediction time influences training or evaluation, giving over-optimistic results that collapse in production.\n\nExamples: fitting a scaler or imputer on the full dataset before splitting; features derived from the target or from the future (e.g. 'days since last payment' computed after the outcome); random splits on time-series data; the same user, patient or document appearing in both train and test; duplicate rows across splits; ID or timestamp columns that encode the label; target encoding without cross-fitting.\n\nPrevention: split first, then fit all transformations on the training data only (use pipelines), split by group or time where appropriate, audit features for availability at prediction time, check for duplicates, be suspicious of unusually high scores and inspect feature importances, and keep a final untouched test set.",
          f: [
            ["How do you validate a time-series model?", "Walk-forward (expanding or rolling window) validation: always train on the past and validate on the future."],
            ["How do you spot leakage after the fact?", "Implausibly high performance, one dominant feature, big drop between offline and online results, or features that could not exist at prediction time."]
          ]
        },
        {
          q: "Compare gradient boosting (XGBoost/LightGBM) with random forests and neural networks. When do you use each?",
          probe: "Practical model-selection judgement.",
          a: "**Random forest:** many deep trees trained on bootstrap samples and random feature subsets, predictions averaged. Reduces variance, robust, little tuning, parallel, good baseline; less accurate than boosting and larger.\n**Gradient boosting:** trees added sequentially, each fitting the residual errors of the ensemble (gradient of the loss). Reduces bias, state of the art on tabular data, handles mixed feature types and missing values, needs tuning (learning rate, depth, number of trees, regularisation) and can overfit.\n**Neural networks:** best for unstructured data (images, text, audio) and when representation learning or transfer learning matters; on tabular data they often need more data and tuning to match boosting.\n\nMy practice: tabular → regularised linear baseline, then gradient boosting; images/text/audio → pre-trained neural networks and fine-tuning; very small data → simple models; explainability needs → linear models or shallow trees with SHAP.",
          f: [
            ["Bagging vs boosting?", "Bagging trains models independently on resamples and averages (variance reduction). Boosting trains sequentially to correct predecessors (bias reduction)."],
            ["How do you explain a model's predictions?", "Global: feature importance, partial dependence; local: SHAP or LIME values, counterfactual examples; plus inherently interpretable models where required."]
          ]
        }
      ]
    },
    {
      id: "dl-core", t: "Deep learning training",
      qa: [
        {
          q: "Explain backpropagation and gradient descent. What causes vanishing or exploding gradients and how do you fix them?",
          probe: "Core understanding of how networks learn.",
          a: "Gradient descent minimises a loss by updating parameters opposite to the gradient: θ ← θ − η∇L. Backpropagation computes those gradients efficiently with the chain rule: a forward pass computes and stores activations and the loss; a backward pass propagates ∂L/∂activation from the output layer toward the input, multiplying local derivatives, so every parameter's gradient is obtained in about the cost of two forward passes. Mini-batches give noisy but efficient estimates; optimisers like Adam rescale updates per parameter.\n\nVanishing/exploding gradients happen because the gradient at early layers is a product of many terms (weights and activation derivatives). If they are mostly below 1 the product shrinks (sigmoid/tanh saturation, deep RNNs); above 1 it explodes.\n\nFixes: ReLU-family activations, careful initialisation (He/Xavier), normalisation layers (BatchNorm/LayerNorm), residual connections, gated architectures (LSTM/GRU), gradient clipping for explosions, and smaller learning rates or warmup.",
          f: [
            ["Why use Adam/AdamW?", "Adaptive per-parameter step sizes from running averages of the gradient and squared gradient give fast, robust convergence with little tuning; AdamW applies weight decay correctly (decoupled)."],
            ["BatchNorm vs LayerNorm?", "BatchNorm normalises across the batch per feature (good for CNNs, depends on batch statistics, behaves differently at inference); LayerNorm normalises across features per example, independent of batch size, so transformers use it."],
            ["What does dropout do and what happens at inference?", "It randomly zeroes activations during training so units cannot co-adapt, acting as a regulariser. At inference it is disabled and activations are scaled consistently."],
            ["Why are learning-rate warmup and schedules used?", "Early in training gradients and adaptive statistics are unreliable, so a gradual ramp prevents instability; decay later helps converge to a better minimum."]
          ]
        }
      ]
    }
  ]
});
