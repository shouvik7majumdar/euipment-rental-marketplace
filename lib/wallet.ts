'use client';

import {
  StellarWalletsKit,
  WalletNetwork,
  WalletType,
  ISupportedWallet,
  FREIGHTER_ID,
  FreighterModule,
  LOBSTR_ID,
  LobstrModule,
  xBullModule,
  XBULL_ID,
  HanaModule,
  HANA_ID,
} from '@creit.tech/stellar-wallets-kit';

export let kit: StellarWalletsKit | null = null;

export function createWalletsKit(): StellarWalletsKit {
  if (kit) return kit;

  kit = new StellarWalletsKit({
    network: WalletNetwork.TESTNET,
    selectedWalletId: FREIGHTER_ID,
    modules: [
      new FreighterModule(),
      new LobstrModule(),
      new xBullModule(),
      new HanaModule(),
    ],
  });

  return kit;
}

export function getWalletsKit(): StellarWalletsKit {
  if (!kit) return createWalletsKit();
  return kit;
}

export async function connectWallet(walletId?: string): Promise<string> {
  const walletsKit = getWalletsKit();

  if (walletId) {
    await walletsKit.setWallet(walletId);
  }

  const { address } = await walletsKit.getAddress();
  return address;
}

export async function disconnectWallet(): Promise<void> {
  kit = null;
}

export async function signTransaction(
  xdr: string,
  opts: { networkPassphrase: string; address: string }
): Promise<string> {
  const walletsKit = getWalletsKit();
  const { signedTxXdr } = await walletsKit.signTransaction(xdr, {
    networkPassphrase: opts.networkPassphrase,
    address: opts.address,
  });
  return signedTxXdr;
}

export async function getAvailableWallets(): Promise<ISupportedWallet[]> {
  const walletsKit = getWalletsKit();
  const supported = await walletsKit.getSupportedWallets();
  return supported;
}
