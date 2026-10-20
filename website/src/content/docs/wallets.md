---
title: Wallets & funding
description: Create and unlock local wallets, inspect balances, and prepare deployment funding.
---

Wallet commands use the CosmJS signer included by the Akash SDK and derive standard
`akash1...` addresses at the Cosmos `m/44'/118'/0'/0/0` path. The recovery phrase is stored
in an AES-256-GCM encrypted file. The default path is `~/.config/leasefi/wallet.json`; set
`LEASEFI_WALLET_FILE` or pass `--wallet-file` to select another path.

Create a wallet with a password of at least 12 characters:

```sh
export LEASEFI_WALLET_PASSWORD='use-a-long-unique-password'
leasefi wallet create
```

The command prints the recovery phrase once. Back it up separately from the wallet file.
To import an existing phrase without putting it directly in the command arguments:

```sh
export LEASEFI_WALLET_PASSWORD='use-a-long-unique-password'
export LEASEFI_WALLET_MNEMONIC='word1 word2 ...'
leasefi wallet import
unset LEASEFI_WALLET_MNEMONIC
```

Unlock the file and show its address:

```sh
export LEASEFI_WALLET_PASSWORD='use-a-long-unique-password'
leasefi wallet address
```

Use that address as `--to-address` when bridging USDC or AKT to Akash. The wallet service
also exposes the unlocked `DirectSecp256k1HdWallet` signer for Akash transaction
commands.

## The two wallets in an EVM bridge

`LEASEFI_EVM_PRIVATE_KEY` controls the source EVM account. `LEASEFI_WALLET_PASSWORD`
unlocks the separate encrypted CLI wallet used for Cosmos signing. Neither is your
MetaMask unlock password.

Enter an existing CLI password locally in Bash:

```sh
read -r -s -p "CLI wallet password: " LEASEFI_WALLET_PASSWORD
echo
export LEASEFI_WALLET_PASSWORD
leasefi wallet address
leasefi wallet balance
```

## Prepare deployment funds

Follow the [funding and certificate steps](../guides/tenant-cli/#wallet-funding-and-certificates)
to acquire sandbox AKT, mint ACT when supported, and publish your tenant certificate.
Retain AKT for transaction fees. Use `wallet balance` to verify funds before deployment.
