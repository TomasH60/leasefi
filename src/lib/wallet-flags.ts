import { readConfig } from '../services/config-service.js';
import { Flags } from '@oclif/core';
import { resolveWalletPath } from '../services/wallet-service.js';

export const walletFileFlag = Flags.string({
  description: 'Encrypted wallet file path',
  env: 'LEASEFI_WALLET_FILE',
  helpValue: '<path>',
});

export function getWalletPath(path?: string): string {
  return resolveWalletPath(path);
}

export function getWalletPassword(): string {
  const password = process.env.LEASEFI_WALLET_PASSWORD;
  if (!password) {
    throw new Error('Set LEASEFI_WALLET_PASSWORD to unlock the encrypted wallet.');
  }
  return password;
}

export async function getConfiguredWalletPath(path?: string): Promise<string> {
  return getWalletPath(path ?? (await readConfig()).walletFile);
}
