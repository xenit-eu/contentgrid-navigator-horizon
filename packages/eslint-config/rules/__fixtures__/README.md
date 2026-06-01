# Test fixtures for no-unstable-features rule

This directory contains a minimal mock package structure used by the
`no-unstable-features` RuleTester tests. It is **not production code**.

`node_modules/@contentgrid/features/` mirrors the shape of the real
`packages/features/` package so the rule can resolve feature subpaths and
read `x-stability` values without depending on real features existing.

Each feature fixture under `src/` carries a specific `x-stability` value:

| Fixture                | x-stability    | Purpose                         |
| ---------------------- | -------------- | ------------------------------- |
| `experimental-feature` | `experimental` | Test block/allow logic          |
| `candidate-feature`    | `candidate`    | Test block/allow logic          |
| `stable-feature`       | `stable`       | Test allow logic                |
| `typo-feature`         | `experimentl`  | Test `invalidStability` message |

> `__fixtures__/` is excluded from lint-staged (see root `package.json`) because
> it is test data, not source code — some files are intentionally invalid by design.
