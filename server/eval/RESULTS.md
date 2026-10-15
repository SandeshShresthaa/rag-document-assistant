# Evaluation results

## Dataset

The evaluation uses a curated, page-numbered excerpt from NASA's public-domain
[Apollo 11 Lunar Landing Mission Press Kit](https://solarsystem.nasa.gov/system/downloadable_items/2920_Apollo_11.pdf).
It contains 12 grounded questions and 3 questions whose answers are absent from the excerpt.

The checked-in local evaluation is deterministic. It uses the production chunker, a small
token-overlap retriever, the production no-context response, and extractive answers assembled
from retrieved chunks. This makes configuration changes repeatable and free. It measures the
retrieval/evaluation machinery rather than claiming Gemini answer quality.

## Results

Run on 2026-10-15:

| Chunk size | Overlap | k | Retrieval hit rate | Answer keyword accuracy | Refusal accuracy |
|---:|---:|---:|---:|---:|---:|
| 500 | 100 | 3 | 10/12 (83%) | 10/12 (83%) | 3/3 (100%) |
| 800 | 150 | 5 | 10/12 (83%) | 10/12 (83%) | 3/3 (100%) |
| 1200 | 200 | 8 | 10/12 (83%) | 10/12 (83%) | 3/3 (100%) |

All three configurations produced the same result because each curated page is shorter than
500 characters after whitespace cleanup. The experiment still verifies the configuration
path, but a longer full-document corpus is needed to measure chunk-boundary differences.

Two grounded questions failed. “How many astronauts would travel toward the Moon?” uses
“astronauts,” while the source says “three-man spacecraft.” “When does the countdown start?”
retrieved the final-countdown page instead of the page containing the T-minus-28-hours value.
These failures show the limit of token-overlap retrieval and provide concrete cases where
semantic embeddings should improve retrieval.

## Running it

From `server/`:

```sh
npm run eval
```

To evaluate the configured Atlas Vector Search and Gemini answer generator, first upload the
NASA evaluation document into a dedicated session, set that session UUID, and run:

```sh
EVAL_SESSION_ID=<session-uuid> npm run eval -- --live
```

Live mode calls the production `searchChunks`, score threshold, prompt builder, and
`streamAnswer` functions directly. Results can vary with the embedding/model version and
provider availability. No live Atlas/Gemini score is claimed in this report.
