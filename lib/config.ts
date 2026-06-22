import { ContractConfig } from '@/types';

export const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';

export const CONTRACT_CONFIG: ContractConfig = {
  contractId: process.env.NEXT_PUBLIC_CONTRACT_ID || 'CONTRACT_ADDRESS_HERE',
  tokenContractId: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  reputationContractId: process.env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID || 'REPUTATION_CONTRACT_HERE',
  networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  rpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
};

export const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';

export const EXPLORER_BASE_URL = 'https://stellar.expert/explorer/testnet';

export const POLL_INTERVAL_MS = 5_000; // 5 seconds for real-time event polling

export const STROOPS_PER_XLM = BigInt(10_000_000);

export function stroopsToXLM(stroops: bigint): string {
  const xlm = Number(stroops) / Number(STROOPS_PER_XLM);
  return xlm.toFixed(7);
}

export function xlmToStroops(xlm: string): bigint {
  const val = parseFloat(xlm);
  if (isNaN(val) || val < 0) return BigInt(0);
  return BigInt(Math.round(val * Number(STROOPS_PER_XLM)));
}

export function truncateAddress(address: any): string {
  if (!address) return '';
  const str = String(address);
  if (str.length < 12) return str;
  return `${str.slice(0, 6)}...${str.slice(-4)}`;
}

export function getExplorerTxUrl(hash: string): string {
  return `${EXPLORER_BASE_URL}/tx/${hash}`;
}

export function getExplorerAccountUrl(address: string): string {
  return `${EXPLORER_BASE_URL}/account/${address}`;
}

export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}
