# Examples and evaluation separation
Use a small, representative subset of the supplied seed cases as development examples. Keep the full corpus versioned and extend with independently authored holdout cases before measuring release accuracy. Do not call the included synthetic seed corpus an independent benchmark or claim that a model passed it unless actual live evaluations were run.

Do not include all examples in every request. Keep planner context small and include only the relevant tested capabilities. Preserve negation, ordering and file-version distinctions when optimising prompts. A shorter schema that changes semantics is not an optimisation.

Provider SDK details, exact structured-output syntax and supported reasoning parameters must be verified from current official documentation. Set model/storage/timeout limits on the server. Never add hosted file/code/search tools for convenience.
