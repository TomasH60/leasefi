---
title: Deploy your prepared workload with LeaseFi
description: Move from tenant setup to funding, leasing, manifest upload, and workload management.
---

Complete [the LeaseFi wallet handoff](../use-leasefi/) first. Use the same tenant
wallet, `PROVIDER` address, SSH key, and `ssh.yaml` prepared in the earlier steps.
Keep `LEASEFI_WALLET_PASSWORD` set in your tenant terminal.

## Verify the workload and funds

```sh
cd "$HOME/akash-ssh-test"
leasefi deployment validate ssh.yaml
leasefi wallet balance
leasefi doctor
```

The SDL's `lab: tomas-ssh` placement must match your provider. Its price is a bid
cap per block. `doctor` reports the live minimum deployment deposit; use that
value rather than assuming the example below is sufficient.

The sandbox needs **AKT for fees** and **ACT for the deployment deposit**. If ACT
is missing, review the amount to convert before running:

```sh
leasefi fund mint-act 5000000uakt --yes
leasefi wallet balance
```

This example burns the specified sandbox AKT amount. It is not a faucet or an EVM
bridge. Mint settlement may be asynchronous; wait for the ACT balance before
creating the deployment and retain AKT for subsequent transaction fees.

## Create the deployment and select a bid

```sh
export DSEQ="$(date +%s)"
leasefi deployment create ssh.yaml --dseq "$DSEQ" --deposit 500000uact --yes
leasefi deployment bids "$DSEQ"
```

Use a new DSEQ for a new deployment. Keep its value for all subsequent operations.
Wait for an open bid from your intended provider; if none arrives, the provider
operator should check inventory, placement attributes, and provider logs.

Use the actual group, order, and bid sequences from the result. The values `1`
below are examples, not defaults to assume:

```sh
leasefi lease create "$DSEQ" --provider "$PROVIDER" --gseq 1 --oseq 1 --bseq 1 --yes
leasefi lease list "$DSEQ"
```

## Send the same SDL and check readiness

```sh
leasefi deployment manifest send ssh.yaml "$DSEQ" --provider "$PROVIDER" --yes
leasefi deployment status "$DSEQ" --workload --provider "$PROVIDER"
```

Use the unchanged SDL from deployment creation. Check that the SSH service has
one ready replica and record `forwarded_ports.ssh[].externalPort` from the workload
status. The external port can differ from the container's port `2222`.

**Next:** follow [SSH port access and connection](../guides/tenant-access/).
The Linux workload port and firewall checks remain provider-side tasks. Once the port is reachable,
LeaseFi can open the connection using your existing key:

```sh
leasefi deployment ssh "$DSEQ" --service ssh --user akash \
  --identity "$HOME/.ssh/akash_lab_ed25519" --port 2222 --host provider.akash.test
```

## Monitor and close

```sh
leasefi deployment status "$DSEQ" --workload --provider "$PROVIDER"
leasefi deployment logs "$DSEQ" --provider "$PROVIDER" --follow
```

Stop following logs with Ctrl+C. When the workload is no longer needed:

```sh
leasefi deployment close "$DSEQ" --yes
leasefi deployment status "$DSEQ"
```

Closing ends the lease and its ongoing charges. An interrupted CLI command or a
timeout does not automatically close a deployment.

## After the first successful deployment

For subsequent deployments, the [combined deployment and resume workflow](../guides/tenant-cli/#combined-deployment-and-resume)
can create the deployment, wait for the selected provider, create leases, and send
the manifest. Inspect chain state before resuming an interrupted transaction.

The [full native lab walkthrough](../guides/local-provider/#tenant-setup) remains
available when you need to compare these actions with `provider-services` commands.

## Related official Akash documentation

- [CLI commands: certificates, deployments, bids, leases, and manifests](https://akash.network/docs/developers/deployment/cli/commands-reference/)
- [SDL syntax: services, exposed ports, resources, and placement](https://akash.network/docs/developers/deployment/akash-sdl/syntax-reference/)

These describe the upstream Akash workflow. The LeaseFi commands on this page
wrap that workflow; use the sandbox network and lab settings from this guide.
