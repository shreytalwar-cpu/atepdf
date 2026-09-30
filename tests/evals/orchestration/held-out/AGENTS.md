# Held-out orchestration eval data

When optimizing in SHR-108 or preparing optimizer prompts, do not read or import
`scoring/keys.json` or `scoring/recordings.json`. Use the scorer command; its default
output contains aggregates. Export tuning inputs with `--export-dev` only.

SHR-107 corpus authors and reviewers may inspect these files to maintain or verify
the benchmark. Explicit held-out diagnosis uses `--held-out-details`; treat a case
whose answer has been inspected during optimization as contaminated and move it
to dev in a newly versioned corpus before reusing it for tuning.

This is an operational separation, not filesystem access control. Do not infer
cryptographic isolation or live-model evidence from this directory structure.
