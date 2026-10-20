---
title: Connect your tenant wallet to LeaseFi
description: Reuse the tenant identity and workload you prepared in the setup walkthrough.
---

Complete [installation](../getting-started/) after the tenant setup. Run these
commands on the **tenant machine**. Keep the same wallet address that you funded
with sandbox AKT; a new wallet would not own your existing deployments.

## Import the prepared wallet

LeaseFi does not read the `provider-services` keyring directly. Import the recovery
phrase saved during [tenant wallet setup](../guides/tenant-identity/) into its own
encrypted wallet file. The password below protects that file, not the native keyring.

In **Bash**:

```sh
read -r -s -p "New LeaseFi wallet password (at least 12 characters): " LEASEFI_WALLET_PASSWORD
echo
export LEASEFI_WALLET_PASSWORD
read -r -s -p "Existing tenant recovery phrase: " LEASEFI_WALLET_MNEMONIC
echo
export LEASEFI_WALLET_MNEMONIC
leasefi wallet import
unset LEASEFI_WALLET_MNEMONIC
leasefi wallet address
```

Compare this address with `OWNER` from setup. **Continue only if they match.**
LeaseFi uses the standard Cosmos derivation path; a wallet created with a different
path may produce another address. Import refuses to overwrite an existing wallet.
If your LeaseFi wallet is already configured, unlock it and verify its address instead.

See [wallet storage and alternative wallet files](../wallets/) for existing LeaseFi
wallets. Keep the password available in this terminal for signing commands.

## Select the same network and provider

```sh
leasefi config set network sandbox-2
leasefi config set rpc https://rpc.sandbox-2.aksh.pw:443
leasefi config set grpc https://grpc.sandbox-2.aksh.pw:443
leasefi config show
leasefi wallet balance
export PROVIDER="REPLACE_WITH_PROVIDER_ADDRESS"
leasefi provider status "$PROVIDER"
```

Use the on-chain address supplied by your provider operator, not its hostname or
IP. The network, RPC, and gRPC must all identify the same chain. The provider API
must still be reachable through the networking configured during setup.

## Prepare LeaseFi's client certificate

LeaseFi stores its own client certificate and private key; importing a mnemonic
does not import the certificate files created by `provider-services`.

```sh
leasefi cert create --yes
leasefi cert status
leasefi doctor
```

This publishes LeaseFi's local certificate for your tenant identity and requires
sandbox AKT for fees. A retry reuses its local certificate when already valid.
Review `doctor` for remaining funding or connectivity issues before deploying.

**Next:** [Deploy the prepared SSH workload with LeaseFi](../deploy-with-leasefi/).

## Related official Akash documentation

- [Install provider-services and prepare a wallet](https://akash.network/docs/developers/deployment/cli/installation-guide/)
- [CLI commands: certificates, deployments, bids, leases, and manifests](https://akash.network/docs/developers/deployment/cli/commands-reference/)

These describe the upstream Akash workflow. The LeaseFi commands on this page
wrap that workflow; use the sandbox network and lab settings from this guide.
