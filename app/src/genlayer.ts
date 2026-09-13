import { createClient, isSuccessful } from 'genlayer-js'
import { studioDevnet } from 'genlayer-js/chains'
import { TransactionHashVariant, type CalldataEncodable } from 'genlayer-js/types'

export const CONTRACT_ADDRESS = String((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_CONTRACT_ADDRESS || "0xb5C9fc8a040e8E54778f1bD7ea8F1ddEB66d01e2").trim()
export const STUDIO_DEV_CHAIN_ID = studioDevnet.id
export const STUDIO_DEV_CHAIN_HEX = '0x' + studioDevnet.id.toString(16)
export const RUNNER_HASH = '5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng'
export const STUDIO_DEV_RPC_URL = studioDevnet.rpcUrls.default.http[0]

export const READ_METHODS = [
  'get_source',
  'get_decision',
  'get_dependency',
  'get_dependant_count',
  'is_decision_current',
  'get_propagation_event',
  'get_affected_decision',
  'get_source_count',
  'get_decision_count',
  'get_event_count',
] as const

export const WRITE_METHODS = [
  'register_source',
  'create_decision',
  'add_source_dependency',
  'add_decision_dependency',
  'finalize_decision',
  'revise_source',
  'continue_propagation',
  'reevaluate_decision',
] as const

export type SourceRecord = {
  exists: boolean
  id: number
  owner: string
  title: string
  canonical_url: string
  fingerprint: string
  revision: number
  active: boolean
}

export type DecisionRecord = {
  exists: boolean
  id: number
  owner: string
  question: string
  outcome: string
  reasoning: string
  revision: number
  status: 'DRAFT' | 'CURRENT' | 'STALE' | 'UNDETERMINED' | string
  dependency_count: number
  stale_origin_type: string
  stale_origin_id: number
  stale_origin_revision: number
  stale_via_decision_id: number
  stale_depth: number
  stale_event_id: number
}

export type DependencyRecord = {
  exists: boolean
  decision_id: number
  dependency_index: number
  dependency_type: 'SOURCE' | 'DECISION' | string
  parent_id: number
  parent_revision_at_evaluation: number
}

export type PropagationEventRecord = {
  exists: boolean
  id: number
  origin_type: 'SOURCE' | 'DECISION' | string
  origin_id: number
  origin_revision: number
  affected_decision_count: number
  pending: boolean
  completed: boolean
}

export type AffectedDecision = {
  exists: boolean
  event_id: number
  index: number
  decision_id: number
}

export type DecisionBundle = {
  decision: DecisionRecord
  dependencies: DependencyRecord[]
}

export type EventBundle = {
  event: PropagationEventRecord
  affected: AffectedDecision[]
}

export type DashboardData = {
  sources: SourceRecord[]
  decisions: DecisionBundle[]
  events: EventBundle[]
  sourceCount: number
  decisionCount: number
  eventCount: number
  truncated: boolean
}

type Provider = {
  isRabby?: boolean
  isMetaMask?: boolean
  providers?: Provider[]
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>
  on?(event: string, handler: (...args: unknown[]) => void): void
  removeListener?(event: string, handler: (...args: unknown[]) => void): void
}

declare global {
  interface Window {
    ethereum?: Provider
  }
}

const readArgs = { transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL }
const readClient = createClient({ chain: studioDevnet })
const visibleLimit = 120

function provider(): Provider | null {
  if (typeof window === 'undefined') return null
  const injected = window.ethereum
  if (!injected) return null
  if (injected.providers?.length) {
    return injected.providers.find((candidate) => candidate.isRabby) || injected.providers[0]
  }
  return injected
}

export function providerLabel(): string {
  const active = provider()
  if (!active) return 'No wallet detected'
  if (active.isRabby) return 'Rabby'
  if (active.isMetaMask) return 'Injected wallet'
  return 'Injected EVM wallet'
}

export function contractConfigurationError(): string {
  if (!CONTRACT_ADDRESS) return 'The Groundshift contract address is not configured.'
  if (!/^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS)) {
    return 'The Groundshift contract address is invalid. It must be a 20-byte 0x address.'
  }
  return ''
}

export function isContractConfigured(): boolean {
  return contractConfigurationError() === ''
}

function assertConfigured() {
  const error = contractConfigurationError()
  if (error) throw new Error(error)
}

function record<T>(value: unknown): T {
  if (value instanceof Map) return Object.fromEntries(value.entries()) as T
  if (Array.isArray(value)) return Object.fromEntries(value as Array<[string, unknown]>) as T
  return value as T
}

function numberValue(value: unknown): number {
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'number') return value
  return Number(value || 0)
}

function read(functionName: string, args: CalldataEncodable[] = []): Promise<unknown> {
  assertConfigured()
  return (readClient as any).readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    ...readArgs,
  })
}

export async function getSource(sourceId: number): Promise<SourceRecord> {
  const value = record<Record<string, unknown>>(await read('get_source', [sourceId]))
  return {
    exists: Boolean(value.exists),
    id: numberValue(value.id),
    owner: String(value.owner || ''),
    title: String(value.title || ''),
    canonical_url: String(value.canonical_url || ''),
    fingerprint: String(value.fingerprint || ''),
    revision: numberValue(value.revision),
    active: Boolean(value.active),
  }
}

export async function getDecision(decisionId: number): Promise<DecisionRecord> {
  const value = record<Record<string, unknown>>(await read('get_decision', [decisionId]))
  return {
    exists: Boolean(value.exists),
    id: numberValue(value.id),
    owner: String(value.owner || ''),
    question: String(value.question || ''),
    outcome: String(value.outcome || ''),
    reasoning: String(value.reasoning || ''),
    revision: numberValue(value.revision),
    status: String(value.status || '') as DecisionRecord['status'],
    dependency_count: numberValue(value.dependency_count),
    stale_origin_type: String(value.stale_origin_type || ''),
    stale_origin_id: numberValue(value.stale_origin_id),
    stale_origin_revision: numberValue(value.stale_origin_revision),
    stale_via_decision_id: numberValue(value.stale_via_decision_id),
    stale_depth: numberValue(value.stale_depth),
    stale_event_id: numberValue(value.stale_event_id),
  }
}

export async function getDependency(decisionId: number, index: number): Promise<DependencyRecord> {
  const value = record<Record<string, unknown>>(await read('get_dependency', [decisionId, index]))
  return {
    exists: Boolean(value.exists),
    decision_id: numberValue(value.decision_id),
    dependency_index: numberValue(value.dependency_index),
    dependency_type: String(value.dependency_type || ''),
    parent_id: numberValue(value.parent_id),
    parent_revision_at_evaluation: numberValue(value.parent_revision_at_evaluation),
  }
}

export async function getEvent(eventId: number): Promise<PropagationEventRecord> {
  const value = record<Record<string, unknown>>(await read('get_propagation_event', [eventId]))
  return {
    exists: Boolean(value.exists),
    id: numberValue(value.id),
    origin_type: String(value.origin_type || ''),
    origin_id: numberValue(value.origin_id),
    origin_revision: numberValue(value.origin_revision),
    affected_decision_count: numberValue(value.affected_decision_count),
    pending: Boolean(value.pending),
    completed: Boolean(value.completed),
  }
}

export async function getAffectedDecision(eventId: number, index: number): Promise<AffectedDecision> {
  const value = record<Record<string, unknown>>(await read('get_affected_decision', [eventId, index]))
  return {
    exists: Boolean(value.exists),
    event_id: numberValue(value.event_id),
    index: numberValue(value.index),
    decision_id: numberValue(value.decision_id),
  }
}

export async function getSourceCount(): Promise<number> {
  return numberValue(await read('get_source_count'))
}

export async function getDecisionCount(): Promise<number> {
  return numberValue(await read('get_decision_count'))
}

export async function getEventCount(): Promise<number> {
  return numberValue(await read('get_event_count'))
}

export async function getDependantCount(parentType: 'SOURCE' | 'DECISION', parentId: number): Promise<number> {
  return numberValue(await read('get_dependant_count', [parentType, parentId]))
}

export async function isDecisionCurrent(decisionId: number): Promise<boolean> {
  return Boolean(await read('is_decision_current', [decisionId]))
}

export async function getDecisionBundle(decisionId: number): Promise<DecisionBundle> {
  const decision = await getDecision(decisionId)
  const dependencies = decision.exists
    ? await Promise.all(Array.from({ length: decision.dependency_count }, (_, index) => getDependency(decisionId, index)))
    : []
  return { decision, dependencies }
}

export async function getEventBundle(eventId: number): Promise<EventBundle> {
  const event = await getEvent(eventId)
  const affected = event.exists
    ? await Promise.all(Array.from({ length: event.affected_decision_count }, (_, index) => getAffectedDecision(eventId, index)))
    : []
  return { event, affected }
}

export async function getDashboardData(): Promise<DashboardData> {
  const [sourceCount, decisionCount, eventCount] = await Promise.all([
    getSourceCount(),
    getDecisionCount(),
    getEventCount(),
  ])
  const sourceIds = Array.from({ length: Math.min(sourceCount, visibleLimit) }, (_, index) => index + 1)
  const decisionIds = Array.from({ length: Math.min(decisionCount, visibleLimit) }, (_, index) => index + 1)
  const eventIds = Array.from({ length: Math.min(eventCount, visibleLimit) }, (_, index) => eventCount - index)
  const [sources, decisions, events] = await Promise.all([
    Promise.all(sourceIds.map(getSource)),
    Promise.all(decisionIds.map(getDecisionBundle)),
    Promise.all(eventIds.filter((id) => id > 0).map(getEventBundle)),
  ])
  return {
    sources: sources.filter((source) => source.exists),
    decisions: decisions.filter((bundle) => bundle.decision.exists),
    events: events.filter((bundle) => bundle.event.exists),
    sourceCount,
    decisionCount,
    eventCount,
    truncated: sourceCount > visibleLimit || decisionCount > visibleLimit || eventCount > visibleLimit,
  }
}

export async function getWalletAddress(): Promise<string | null> {
  const active = provider()
  if (!active) return null
  const accounts = await active.request({ method: 'eth_accounts' }) as string[]
  return accounts?.[0] || null
}

export async function getWalletChainId(): Promise<string | null> {
  const active = provider()
  if (!active) return null
  return String(await active.request({ method: 'eth_chainId' })).toLowerCase()
}

export async function requestWallet(): Promise<string> {
  const active = provider()
  if (!active) throw new Error('No injected EVM wallet was found. Install Rabby or another injected wallet.')
  const accounts = await active.request({ method: 'eth_requestAccounts' }) as string[]
  const address = accounts?.[0]
  if (!address) throw new Error('The wallet did not return an account.')
  return address
}

export function watchWallet(
  onAccountsChanged: (address: string | null) => void,
  onChainChanged: (chainId: string) => void,
): () => void {
  const active = provider()
  if (!active?.on) return () => undefined
  const accountsHandler = (...args: unknown[]) => {
    const accounts = (args[0] as string[] | undefined) || []
    onAccountsChanged(accounts[0] || null)
  }
  const chainHandler = (...args: unknown[]) => onChainChanged(String(args[0] || '').toLowerCase())
  active.on('accountsChanged', accountsHandler)
  active.on('chainChanged', chainHandler)
  return () => {
    active.removeListener?.('accountsChanged', accountsHandler)
    active.removeListener?.('chainChanged', chainHandler)
  }
}

function providerError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null && 'message' in error) return String((error as { message: unknown }).message)
  return String(error)
}

export async function switchToStudioDevnet(): Promise<string> {
  const active = provider()
  if (!active) throw new Error('No injected EVM wallet was found.')
  const current = String(await active.request({ method: 'eth_chainId' })).toLowerCase()
  if (current === STUDIO_DEV_CHAIN_HEX) return current
  try {
    await active.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: STUDIO_DEV_CHAIN_HEX }] })
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? Number((error as { code: unknown }).code) : 0
    if (code === 4902) {
      await active.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: STUDIO_DEV_CHAIN_HEX,
          chainName: studioDevnet.name,
          nativeCurrency: studioDevnet.nativeCurrency,
          rpcUrls: [STUDIO_DEV_RPC_URL],
        }],
      })
    } else {
      throw new Error('Switch the wallet to GenLayer Studio Devnet (chain ' + STUDIO_DEV_CHAIN_ID + '). ' + providerError(error))
    }
  }
  const verified = String(await active.request({ method: 'eth_chainId' })).toLowerCase()
  if (verified !== STUDIO_DEV_CHAIN_HEX) {
    throw new Error('Wallet remains on the wrong network. GenLayer Studio Devnet chain ' + STUDIO_DEV_CHAIN_ID + ' is required.')
  }
  return verified
}

async function ensureStudioDevnet() {
  const current = await getWalletChainId()
  if (!current) throw new Error('Connect Rabby or another injected EVM wallet before signing.')
  if (current !== STUDIO_DEV_CHAIN_HEX) {
    await switchToStudioDevnet()
  }
}

export async function makeWriteClient(address: string) {
  assertConfigured()
  const active = provider()
  if (!active) throw new Error('No injected EVM wallet was found.')
  await ensureStudioDevnet()
  return createClient({ chain: studioDevnet, account: address as any, provider: active as any })
}

export type WriteCallbacks = {
  onAwaitingWallet?: () => void
  onSubmitted?: (hash: string) => void
  onConsensus?: (hash: string) => void
}

export async function writeAndWait(
  address: string,
  functionName: string,
  args: CalldataEncodable[],
  callbacks: WriteCallbacks = {},
): Promise<{ hash: string; receipt: any }> {
  callbacks.onAwaitingWallet?.()
  const client: any = await makeWriteClient(address)
  const estimate = await client.estimateTransactionFees()
  if (BigInt(estimate.feeValue || 0) <= 0n) {
    throw new Error('Studio-dev returned a zero transaction fee. Refusing to submit.')
  }
  const hash = String(await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value: 0n,
    fees: {
      distribution: estimate.distribution,
      messageAllocations: estimate.messageAllocations,
      feeValue: estimate.feeValue,
    },
  }))
  callbacks.onSubmitted?.(hash)
  const receipt = await client.waitForTransactionReceipt({
    hash,
    waitUntil: 'decided',
    interval: 2500,
    retries: 120,
    fullTransaction: true,
  })
  const decided = receipt.statusName === 'ACCEPTED' || receipt.statusName === 'FINALIZED'
  if (decided) callbacks.onConsensus?.(hash)
  if (!isSuccessful(receipt)) {
    const status = receipt.statusName || String(receipt.status || 'unknown')
    const execution = receipt.txExecutionResultName || String(receipt.execution_result || 'unknown')
    if (decided) {
      const leaderError = receipt.consensus_data?.leader_receipt?.map((item: any) => String(item.error || '').trim()).find(Boolean)
      throw new Error('GenVM execution failed: ' + execution + (leaderError ? ' / ' + leaderError : ''))
    }
    throw new Error('Consensus did not resolve the transaction: ' + status + ' / ' + execution)
  }
  return { hash, receipt }
}

const pause = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

export async function pollUntil<T>(
  readValue: () => Promise<T>,
  matches: (value: T) => boolean,
  label: string,
  attempts = 30,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const value = await readValue()
      if (matches(value)) return value
    } catch (error) {
      lastError = error
    }
    await pause(2000)
  }
  throw new Error('Authoritative state confirmation failed for ' + label + (lastError instanceof Error ? '. ' + lastError.message : '.'))
}

export function waitForCount(readCount: () => Promise<number>, count: number, label: string) {
  return pollUntil(readCount, (value) => value >= count, label)
}

export function waitForSourceRevision(sourceId: number, revision: number) {
  return pollUntil(() => getSource(sourceId), (source) => source.exists && source.revision >= revision, 'source #' + sourceId + ' revision ' + revision)
}

export function waitForDecisionState(decisionId: number, states: string[], minimumRevision?: number) {
  return pollUntil(
    () => getDecision(decisionId),
    (decision) => decision.exists && states.includes(decision.status) && (minimumRevision === undefined || decision.revision >= minimumRevision),
    'decision #' + decisionId + ' state confirmation',
  )
}

export function waitForDependency(decisionId: number, index: number) {
  return pollUntil(() => getDependency(decisionId, index), (dependency) => dependency.exists, 'decision #' + decisionId + ' dependency ' + index)
}

export function waitForEventState(eventId: number) {
  return pollUntil(() => getEvent(eventId), (event) => event.exists && !event.pending, 'event #' + eventId + ' propagation')
}

export function friendlyError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'The request failed. Check the wallet and Studio-dev connection, then retry.'
}

