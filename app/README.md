# Groundshift Dependency Control Room

A React/Vite control room for the deployed Groundshift intelligent contract. The interface keeps live sources, decisions, propagation events, repair order, and dependency strata inspectable.

## Development

```shell
npm install
npm run dev
```

## Configuration

The example environment file documents the available frontend configuration. Set `VITE_CONTRACT_ADDRESS` to override the default deployment when needed.

## Network and contract

The app targets GenLayer Studio-dev on chain `61997` through the GenLayer RPC.

The deployed contract address is [`0xb5C9fc8a040e8E54778f1bD7ea8F1ddEB66d01e2`](https://explorer-studio-dev.genlayer.com/address/0xb5C9fc8a040e8E54778f1bD7ea8F1ddEB66d01e2).

The contract runner hash is pinned in the contract and is intentionally not changed by the frontend.

## Routes

- `/` — illustrative landing page
- `/app` — live control room
- `/app/sources` — source registry
- `/app/sources/new` — register a source
- `/app/sources/:id` — source dossier
- `/app/decisions` — decision registry
- `/app/decisions/new` — create a draft decision
- `/app/decisions/:id` — decision dossier
- `/app/events` — propagation history
- `/app/events/:id` — propagation event dossier
- `/app/repair` — dependency-ordered repair queue
- `/app/graph` — secondary live strata map route

The primary product navigation is the live map, sources, decisions, events, and repair queue. Source and decision dossier routes expose the declared basis and owner-gated writes. Data is read from the deployed contract; empty state is rendered when the counters are empty.
