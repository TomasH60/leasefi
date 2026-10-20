---
title: Install LeaseFi after setup
description: Install leasefi from source and run your first read-only commands.
---

Complete the [tenant setup](../guides/tenant-setup/),
[wallet and certificate](../guides/tenant-identity/), and
[SSH workload preparation](../guides/tenant-workload/) first. If these are already
ready, install LeaseFi on the **tenant machine** below. The provider machine keeps
using Kubernetes, Helm, and `provider-services` for infrastructure operations.

## Requirements

- Node.js **22.18+ within 22.x**, or **24.x**.
- npm and Git.
- A terminal. Secret-entry examples in these docs use **Bash**.

## Install from source

```sh
git clone https://github.com/TomasH60/leasefi.git
cd leasefi
npm ci
npm run build
npm link
leasefi --help
```

`npm link` makes the local build available as `leasefi`. After editing TypeScript,
run `npm run build` again. During development, use `npm run dev -- <command>` to
run the source directly.

## Inspect your configuration

```sh
leasefi config show
leasefi deployment --help
leasefi bridge --help
```

Tenant commands default to Akash `sandbox-2`. The bridge's `--environment` flag
selects Skip networks independently. An Osmosis testnet balance does not fund an
Akash sandbox wallet.

## Next: connect the existing tenant identity

[Import your prepared wallet into LeaseFi](../use-leasefi/), verify its address,
and configure the sandbox endpoints before deploying. You will reuse the
`ssh.yaml` and SSH key from setup.
