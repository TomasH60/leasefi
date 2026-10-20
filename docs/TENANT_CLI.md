# Tenant command groups

`leasefi` manages tenant deployments. Docker/K3s installation, provider Helm releases,
Linux firewall and service networking, and `/etc/hosts` remain in
[the lab setup guide](Akash%20local%20network%20deployment%20setup.md).
These commands use the pinned Akash SDK directly, not an installed `provider-services` binary.
The guide's `sandbox-2` is a public sandbox chain with a locally hosted provider.

## Install the CLI

From the repository root, build and link the CLI before using the commands below:

```sh
npm ci
npm run build
npm link
leasefi --help
```

After updating the source, run `npm run build` again.

## Configuration and diagnostics

```sh
leasefi config show
leasefi config set network sandbox-2
leasefi config set rpc https://rpc.sandbox-2.aksh.pw:443
leasefi config set grpc https://grpc.sandbox-2.aksh.pw:443
leasefi config set walletFile /absolute/path/to/wallet.json
leasefi doctor
leasefi provider status akash1_PROVIDER_ADDRESS
```

Configuration precedence: command flags, environment variables, saved configuration,
then sandbox defaults. `--network` is the expected chain ID, not a label that switches
endpoints automatically. Set all three of network/RPC/gRPC when changing networks.
Tenant commands verify RPC and gRPC chain identity before submission. No mainnet
transactions are needed to test this workflow.

Saved keys: `network`, `rpc`, `grpc`, `gasPrice`, `walletFile`, `provider`, `providerCa`.
`provider` is the default for `provider status`; deployment bid selection is explicit.
Environment overrides: `LEASEFI_NETWORK`, `LEASEFI_RPC_URL`, `LEASEFI_GRPC_URL`,
`LEASEFI_GAS_PRICE`, `LEASEFI_WALLET_FILE`, `LEASEFI_PROVIDER`, `LEASEFI_PROVIDER_CA`.
Existing wallet commands and bridge sending also respect the saved wallet path.
Bridge `--environment` still selects Skip's networks independently of tenant configuration.

Configuration, transaction records, certificates, and deployment records live under
`$XDG_CONFIG_HOME/leasefi` (default `~/.config/leasefi`). Override the storage directory
with `LEASEFI_CONFIG_DIR`. This does not move an existing wallet automatically.
Do not store passwords or private keys with `config set`.

When upgrading from a previously named build, existing data is not moved automatically.
Set `LEASEFI_CONFIG_DIR` to your existing configuration directory and
`LEASEFI_WALLET_FILE` to your existing encrypted wallet file to reuse them. Update shell
scripts to use `leasefi` and the `LEASEFI_*` environment variables, then rerun `npm link`
from the project root to install the renamed command.

## Wallet, funding, and certificates

Reuse `wallet create`, `wallet import`, and `wallet address`. The CLI password is
separate from MetaMask's password and the source EVM private key.

```sh
leasefi wallet balance
# A public address can be inspected without unlocking a wallet:
leasefi wallet balance akash1_ADDRESS
leasefi fund mint-act 5000000uakt --yes
leasefi wallet balance
leasefi cert create --yes
leasefi cert status
```

Get sandbox AKT through the faucet in the lab guide. `mint-act` burns the explicit
AKT amount, checks BME availability, and leaves balance for fees; the actual fee is
estimated before signing. Mint settlement can be asynchronous: verify ACT arrived
before depositing it. This command does not bridge assets or fund a wallet from a faucet.

`cert create` stores a private client certificate file with mode 0600 before publishing
it. Retrying reuses that certificate and skips publication if already valid on-chain.
Keep this file private. This implementation uses the guide's mTLS authentication;
the SDK recommends JWT for new clients, which can be added as another adapter later.
Certificate rotation/revocation is not yet exposed.

## SDL and manual deployment

The following values are examples: use the live minimum deposit from `doctor` and
review the SDL's pricing cap. All mutation commands require `--yes`.

```sh
leasefi deployment init web.yaml
# Edit image, resources, placement attributes, and pricing before deployment.
leasefi deployment validate web.yaml

export DSEQ="$(date +%s)"
leasefi deployment create web.yaml --dseq "$DSEQ" --deposit 500000uact --yes
leasefi deployment bids "$DSEQ"
leasefi lease create "$DSEQ" --provider akash1_PROVIDER_ADDRESS --gseq 1 --oseq 1 --bseq 1 --yes
leasefi lease list "$DSEQ"
leasefi deployment manifest send web.yaml "$DSEQ" --provider akash1_PROVIDER_ADDRESS --yes
leasefi deployment status "$DSEQ" --workload --provider akash1_PROVIDER_ADDRESS
leasefi deployment logs "$DSEQ" --provider akash1_PROVIDER_ADDRESS --follow
leasefi deployment close "$DSEQ" --yes
```

Use the actual group/order/bid sequences printed by `deployment bids`; the example
values are not assumed by the CLI. An ambiguous bid or lease selection fails rather
than choosing arbitrarily. The same SDL must be used for creation and manifest
upload; its manifest hash is checked against the chain.

`deployment status` shows chain state and active leases. `--workload` adds provider
readiness and forwarded endpoints. It requires the local published certificate.
The current command output is structured JSON; token amounts remain in exact base
units, avoiding floating-point conversions.

The web template is optional. For SSH, use your guide's SSH SDL and an existing SSH key:

```sh
leasefi deployment ssh "$DSEQ" --service ssh --user akash \
  --identity "$HOME/.ssh/akash_lab_ed25519" --port 2222
```

SSH uses the provider's advertised external TCP port and the system SSH client.
`--host provider.akash.test` can override the advertised host after lab networking
has been configured. The command does not create SSH keys or change host/firewall rules.

## Combined deployment and resume

After funding and certificate publication, an explicit provider can be used for the
full workflow. The SDL's pricing caps bound the bids you have authorized.

```sh
leasefi deployment deploy web.yaml --dseq "$DSEQ" \
  --deposit 500000uact --provider akash1_PROVIDER_ADDRESS --yes
```

The command creates the deployment, waits for that provider's bid for each group,
creates leases, sends the manifest, and waits for all requested replicas. Waits
print progress and default to 300 seconds per stage; override with `--timeout`.
A timeout leaves the deployment open and potentially accruing charges.

After an interruption, inspect chain state first:

```sh
leasefi deployment status "$DSEQ"
leasefi deployment deploy web.yaml --dseq "$DSEQ" \
  --provider akash1_PROVIDER_ADDRESS --resume --yes
```

Resume requires the deployment already to exist, be active, and match the SDL. It
reuses active leases, rejects conflicting providers, and resends the matching manifest.
It never creates another deployment. It does not automatically repeat transactions
whose inclusion is unknown. If a transaction timed out before its result was returned,
check the saved transaction hash on the selected chain before resuming.

Creation reserves a local record before broadcasting and refuses a second create
with that owner/chain/DSEQ. If pre-broadcast creation failed, inspect the transaction
records and chain before using a new DSEQ. Closing does not erase recovery records.
Transaction journals save the signed transaction hash **before** broadcast, but never
save signed transaction bytes, wallet passwords, or recovery phrases.

## Provider authentication and validation limits

Provider URLs come from the selected chain's registry. HTTPS validates the provider
against its valid on-chain certificate. For a separately managed CA, configure
`providerCa` with a local PEM CA file; hostname verification then applies normally.
There is no insecure TLS bypass. Client certificates stay in private local files.

Automated tests cover command discovery, configuration precedence, SDK message
construction, signed-hash journaling, wrong-network rejection, duplicate creation,
ambiguous bids, manifest consistency, and resume behavior. They do not establish
live sandbox end-to-end compatibility. Verify an actual deployment against your
provider before treating this as a production deployment client.

API references used for implementation:

- Pinned local package: `@akashnetwork/chain-sdk@1.0.0-alpha.45` declarations and README.
- [Provider v0.16.2 REST routes](https://github.com/akash-network/provider/blob/v0.16.2/gateway/rest/router.go)
- [Provider v0.16.2 query parameters](https://github.com/akash-network/provider/blob/v0.16.2/gateway/rest/middleware.go)

## Related official Akash documentation

- [Install provider-services and prepare a wallet](https://akash.network/docs/developers/deployment/cli/installation-guide/)
- [CLI commands: certificates, deployments, bids, leases, and manifests](https://akash.network/docs/developers/deployment/cli/commands-reference/)
- [SDL syntax: services, exposed ports, resources, and placement](https://akash.network/docs/developers/deployment/akash-sdl/syntax-reference/)
