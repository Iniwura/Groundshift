# Groundshift

Know exactly what breaks when the basis moves.

Groundshift is a dependency-aware decision system built on GenLayer.

Each decision snapshots the exact revision of every source or upstream decision that formed its basis. When an upstream source revision changes, Groundshift propagates stale state through downstream decisions, records the blast radius, and exposes the dependency-safe repair order.

## Core features

- Revision-pinned dependency snapshots
- Source and decision dependencies
- Deterministic stale propagation
- Historical propagation events
- Blast-radius inspection
- Dependency-ordered repair
- GenLayer semantic reevaluation
- Wallet/network guarded writes
- Live contract-backed frontend

## Live demo flow

```text
S1 → D1 → D2 → D3
```

Changing S1 advances its revision and makes D1, D2, and D3 stale. Repair proceeds in dependency order:

```text
D1 → D2 → D3
```

Each successful reevaluation updates that decision's dependency snapshot to the current upstream revision.

## Deployment

- Network: GenLayer Studio-dev
- Chain ID: 61997
- Contract: [`0xb5C9fc8a040e8E54778f1bD7ea8F1ddEB66d01e2`](https://explorer-studio-dev.genlayer.com/address/0xb5C9fc8a040e8E54778f1bD7ea8F1ddEB66d01e2)
- Explorer: [Groundshift on Studio-dev Explorer](https://explorer-studio-dev.genlayer.com/address/0xb5C9fc8a040e8E54778f1bD7ea8F1ddEB66d01e2)
- Live app: [groundshift-rho.vercel.app](https://groundshift-rho.vercel.app/)
- Repository: [github.com/Iniwura/Groundshift](https://github.com/Iniwura/Groundshift)
- Pinned runner: `5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`

## Project structure

```text
contracts/groundshift.py       GenLayer intelligent contract
tests/direct/test_groundshift.py  Direct Mode contract tests
app/                           React + Vite frontend
```

The `app/` frontend communicates with the deployed Groundshift contract using `genlayer-js`.

## Run the frontend

From the repository root:

```shell
cd app
npm install
npm run dev
```

`VITE_CONTRACT_ADDRESS` can override the default deployment. See [`app/.env.example`](app/.env.example) for the frontend environment configuration.

## Tests

79 direct contract tests passing.

Coverage includes:

- Source registration and revision
- Decision creation and finalization
- Dependency snapshots
- Stale propagation
- Stale provenance
- Repair ordering
- Semantic reevaluation
- Malformed and invalid evaluator outputs

The repository does not claim CI status here; run the direct suite in the configured GenLayer test environment when validating contract changes.
