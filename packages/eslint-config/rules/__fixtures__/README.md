# Test fixtures for no-unstable-views rule

This directory contains a minimal mock package structure used by the
`no-unstable-views` RuleTester tests. It is **not production code**.

`node_modules/@contentgrid/views/` mirrors the shape of the real
`packages/views/` package so the rule can resolve view subpaths and
read `x-stability` values without depending on real views existing.

Each view fixture under `src/` carries a specific `x-stability` value:

| Fixture             | x-stability    | Purpose                         |
| ------------------- | -------------- | ------------------------------- |
| `experimental-view` | `experimental` | Test block/allow logic          |
| `candidate-view`    | `candidate`    | Test block/allow logic          |
| `stable-view`       | `stable`       | Test allow logic                |
| `typo-view`         | `experimentl`  | Test `invalidStability` message |

> `__fixtures__/` is excluded from lint-staged (see root `package.json`) because
> it is test data, not source code — some files are intentionally invalid by design.
