# Groundshift Dependency Control Room

A React/Vite control room for the deployed Groundshift intelligent contract. The interface keeps live sources, decisions, propagation events, repair order, and the dependency graph inspectable.

## Development

    npm install
    npm run dev

## Configuration

VITE_CONTRACT_ADDRESS
VITE_STUDIO_URL
VITE_STUDIO_CHAIN_ID

The example environment file points to the audited Studio-dev deployment.

## Network and contract

The app targets GenLayer Studio-dev, chain 61997, through the GenLayer RPC.
The deployed contract address is 0x40E8F2870Df8a0E23511DC3f7256Fc46A0198113.
The contract runner hash is pinned in the contract and is intentionally not changed by the frontend.

## Routes

/ — editorial landing page
/app — live control room
/app/sources — source registry
/app/decisions — decision registry
/app/events — propagation history
/app/repair — dependency-ordered repair queue
/app/graph — live SVG dependency explorer

Source and decision dossier routes expose the declared basis and owner-gated writes. Data is read from the deployed contract; empty state is rendered when the counters are empty.
