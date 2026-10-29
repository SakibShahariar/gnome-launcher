# Performance notes

## Synthetic search and result-mapping benchmark

Sample captured on 2026-10-29 from GitHub Actions workflow run [40864856287](https://github.com/SakibShahariar/gnome-launcher/actions/runs/40864856287), for commit `97a37a5ed18944ae176a67af6b9969e340b2f381`.

The benchmark uses generated application names rather than an installed desktop's real application catalog. It warms up each operation five times, then reports the median across 25 samples. Each search sample runs four queries (`fi`, `settings`, `term`, and `firefox`). These timings are informational and are not a CI pass/fail threshold.

### Fuzzy search

| Synthetic apps | Previous implementation median | Current implementation median | Speedup |
|---:|---:|---:|---:|
| 100 | 0.179 ms | 0.216 ms | 0.83× |
| 500 | 0.182 ms | 0.169 ms | 1.08× |
| 1,000 | 0.390 ms | 0.343 ms | 1.14× |
| 5,000 | 1.988 ms | 1.754 ms | 1.13× |

The optimization is modest on the larger synthetic lists and is not faster in this sample at 100 apps. The benchmark also asserts that the optimized search preserves result ordering.

### Mapping native result IDs back to app objects

This benchmark maps 20 result IDs from each generated app list.

| Synthetic apps | Previous mapping median | Cached mapping median | Speedup |
|---:|---:|---:|---:|
| 100 | 0.0168 ms | 0.0010 ms | 16.25× |
| 500 | 0.0691 ms | 0.0008 ms | 81.73× |
| 1,000 | 0.1379 ms | 0.0004 ms | 347.41× |
| 5,000 | 0.8958 ms | 0.0004 ms | 2,552.52× |

The resolver is validated against the previous mapping implementation to ensure it preserves result order. Very small cached timings are close to the measurement floor, so the largest ratios should be interpreted as directional rather than as real-world end-to-end speedups.

## What this does not measure

- Real app catalogs and native GNOME search-provider latency.
- Rendering or rebuilding GNOME Shell result actors.
- End-to-end typing-to-paint latency on a representative desktop.

Those require profiling in a running GNOME Shell session. This report therefore records the available reproducible microbenchmark, but does not claim that all launcher responsiveness bottlenecks have been measured.
