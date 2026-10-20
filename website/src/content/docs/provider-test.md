---
title: Test and operate the provider
description: Verify your configured provider using a separate tenant and LeaseFi.
---

Complete [provider API networking](../guides/provider-network/) first. At this
point the cluster, operators, provider service, and API forwarding should be ready.

## Hand over to a tenant

Give the tenant the provider's on-chain address, current Linux LAN IP, and
the placement attribute `lab: tomas-ssh` used in this lab. Keep the provider API
port-forwarding terminal open. Keep provider wallet material on the provider PC.

On another machine, follow the [tenant setup](../guides/tenant-setup/). It prepares
the wallet, certificate, SSH key, and SDL before introducing LeaseFi. Use a separate
tenant wallet even when you operate both sides.

## Verify a deployment with LeaseFi

After the tenant has [connected its wallet to LeaseFi](../use-leasefi/), follow
[the deployment walkthrough](../deploy-with-leasefi/). Verify each milestone:

1. The tenant can query the provider and create a deployment on `sandbox-2`.
2. Your provider submits an open bid matching the SDL's placement and resources.
3. The tenant accepts that bid and sends the matching manifest.
4. Workload status reports a ready SSH service and its external port.
5. You verify access to that workload port on Linux, and the tenant connects.
6. The tenant closes the deployment after testing.

## Inspect the provider when a milestone fails

In **Linux on the provider PC**:

```sh
kubectl get pods --namespace akash-services
kubectl get pods --namespace lease
kubectl logs akash-provider-0 --namespace akash-services --container provider --tail=100
```

If no bid arrives, check operator health, advertised resources, wallet funding,
and the SDL placement attributes. If the workload starts but SSH times out, check
the lease's external port and the current provider LAN address.

On the **Linux provider**:

```sh
ip -br -4 address show
kubectl get services --all-namespaces -o wide
```

Use the [SSH port access steps](../guides/tenant-access/) to check the workload
service port and the applicable host and network firewall rules.
The [original lab operations checks](../guides/local-provider/#provider-pc-checks)
include filtering provider logs for an owner and deployment sequence.

LeaseFi manages the tenant's interaction with your provider. Continue using Helm,
Kubernetes, and `provider-services` for provider infrastructure and wallet operations.

## Related official Akash documentation

- [Provider installation](https://akash.network/docs/providers/setup-and-installation/kubespray/provider-installation/)

These describe the upstream Akash workflow. The LeaseFi commands on this page
wrap that workflow; use the sandbox network and lab settings from this guide.
