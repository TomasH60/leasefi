---
title: Akash local network deployment setup
---

# Akash local network deployment setup

The official Akash pages linked beside each step provide supporting documentation
for the underlying setup and commands. This guide adapts those workflows to a
local Linux provider on `sandbox-2`; upstream examples may use a different network
or production topology. Keep this guide’s sandbox endpoints and lab settings.

## Provider requirements:

- A native Linux provider machine (Ubuntu or Debian with systemd).
- Docker Engine installed on the Linux provider.
- K3s, kubectl, Helm, and socat installed on the Linux provider.
- Akash provider CLI and Kubernetes operators installed.
- A registered provider wallet funded with sandbox AKT.
- Access to the `sandbox-2` RPC.
- Network access from the tenant machine to the provider API and the container’s assigned port.
- A healthy inventory operator that detects the PC’s available resources.

## Tenant requirements:

- Akash provider-services CLI installed.
- A tenant wallet funded with sandbox AKT for transaction fees.
- Sufficient ACT to fund the deployment deposit and lease.
- A published Akash client certificate for provider API access.
- An SSH key pair for logging into the test container.
- An SDL file describing the container, resources, and provider requirements.
- Access to the `sandbox-2` RPC.
- Network access to the provider API and the container’s assigned SSH port.

## Provider setup:

### Step 1. Configure the Kubernetes cluster on the provider PC

> **Official Akash documentation:** [Provider installation preparation](https://akash.network/docs/providers/setup-and-installation/kubespray/provider-installation-prep/).

Run this on the Linux provider. It assumes Docker Engine and K3s are installed, but K3s has not yet been configured for this Akash lab.

```bash
sudo systemctl enable --now docker

sudo mkdir -p /etc/rancher/k3s

sudo tee /etc/rancher/k3s/config.yaml > /dev/null <<'YAML'
docker: true
node-name: akash-provider
YAML

sudo systemctl restart k3s
```

- `enable --now` starts Docker and configures it to start automatically.
- `docker: true` makes K3s use Docker Engine as its container runtime.
- `node-name` gives the provider node a stable name.
- Restarting K3s applies the configuration.

K3s creates an administrator kubeconfig at `/etc/rancher/k3s/k3s.yaml`. Copy it so your normal Linux user can run `kubectl`:

```bash
mkdir -p "$HOME/.kube"

sudo install \
  -o "$USER" \
  -g "$(id -gn)" \
  -m 600 \
  /etc/rancher/k3s/k3s.yaml \
  "$HOME/.kube/akash-provider.yaml"

export KUBECONFIG="$HOME/.kube/akash-provider.yaml"

kubectl get nodes
```

- `mkdir -p` creates the directory if necessary.
- `-o` and `-g` make your user the owner of the copied file.
- `-m 600` restricts access to that user because kubeconfig contains cluster administrator credentials.
- `KUBECONFIG` tells `kubectl` which cluster access file to use.

Continue when `kubectl get nodes` shows `akash-provider` with status `Ready`. No Akash provider or operator has been deployed yet.

### Step 2. Prepare Kubernetes and install the Akash operators

> **Official Akash documentation:** [Provider installation](https://akash.network/docs/providers/setup-and-installation/kubespray/provider-installation/).

Run these commands on the Linux provider. Keep `KUBECONFIG` set to the file created in Step 1.

```bash
export KUBECONFIG="$HOME/.kube/akash-provider.yaml"

kubectl create namespace akash-services
kubectl create namespace lease
kubectl create namespace akash-gateway

kubectl label namespace akash-services akash.network=true
kubectl label namespace akash-services akash.network/name=akash-services
kubectl label namespace lease akash.network=true
kubectl label namespace akash-gateway akash.network=true
kubectl label node akash-provider akash.network=true
```

The namespaces separate provider components, lease records, and gateway resources. The labels identify them and the K3s node to Akash. Because this is a fresh cluster, the `create` commands should succeed; do not recreate namespaces if they already exist.

Add the Akash chart repository and install the provider CRDs:

```bash
helm repo add akash https://akash-network.github.io/helm-charts
helm repo update

kubectl apply -f \
  https://raw.githubusercontent.com/akash-network/provider/v0.16.2/pkg/apis/akash.network/crd.yaml
```

`helm repo add` registers the chart repository; `helm repo update` refreshes its chart list. `kubectl apply -f` installs the resource definitions that Akash uses in Kubernetes.

Install the operators:

```bash
helm upgrade --install inventory-operator akash/akash-inventory-operator \
  --namespace akash-services \
  --version 19.0.2 \
  --set 'inventoryConfig.cluster_storage[0]=default' \
  --set 'inventoryConfig.cluster_storage[1]=ram'

helm upgrade --install akash-hostname-operator akash/akash-hostname-operator \
  --namespace akash-services \
  --version 19.0.2 \
  --set gatewayApi.enabled=false
```

`upgrade --install` installs a missing release or updates an existing one. `--namespace` selects `akash-services`; `--version` pins the chart version used in this guide. The inventory settings advertise default ephemeral storage and RAM-backed shared memory. `gatewayApi.enabled=false` matches this local lab, which does not have a Gateway API controller installed.

Check the result:

```bash
kubectl rollout status deployment/operator-inventory \
  --namespace akash-services \
  --timeout=300s

kubectl rollout status deployment/operator-hostname \
  --namespace akash-services \
  --timeout=300s

kubectl get pods --namespace akash-services
```

`--timeout=300s` limits each readiness wait to five minutes. Continue when both operators are ready and the inventory operator remains stable. If Kubernetes reports GPU capacity that Akash cannot identify, investigate the device plugin and inventory logs before advertising GPU resources.

### Step 3. Check Akash connection

Check access to the sandbox chain:

```bash
export AKASH_CHAIN_ID="sandbox-2"
export AKASH_NODE="https://rpc.sandbox-2.aksh.pw:443"
provider-services query block
```

A returned block confirms that the provider PC can reach the RPC.

Before offering GPU deployments, verify that Kubernetes and the inventory operator agree on the available GPU resources.

### Step 4. Create and fund the provider wallet (OPTIONAL)

> **Official Akash documentation:** [Provider installation preparation](https://akash.network/docs/providers/setup-and-installation/kubespray/provider-installation-prep/); [Install provider-services and prepare a wallet](https://akash.network/docs/developers/deployment/cli/installation-guide/).

Run these commands on the Linux provider. The provider and tenant should use separate wallets.

```bash
export AKASH_CHAIN_ID="sandbox-2"
export AKASH_NODE="https://rpc.sandbox-2.aksh.pw:443"
export AKASH_KEYRING_BACKEND="file"
export PROVIDER_KEY_NAME="my-provider"
provider-services keys add "$PROVIDER_KEY_NAME"
```

The CLI will display a recovery phrase. Save it securely offline. The `file` keyring backend protects the local wallet with a passphrase; remember that passphrase.

Display the wallet address and check its balance:

```bash
export PROVIDER_ADDRESS="$(provider-services keys show "$PROVIDER_KEY_NAME" -a)"
printf '%s\n' "$PROVIDER_ADDRESS"
provider-services query bank balances "$PROVIDER_ADDRESS"
```

The `-a` flag returns only the wallet address. The balance will initially be empty.

Request sandbox AKT for this address from the [sandbox-2 faucet](https://faucet.sandbox-2.aksh.pw). Then run the balance query again and confirm that it contains `uakt`. Keep enough sandbox AKT for provider transactions, bid deposits, and transaction fees.

```bash
provider-services query bank balances "$PROVIDER_ADDRESS"
```

Export an encrypted copy of the wallet for the provider Helm chart:

```bash
umask 077
mkdir -p "$HOME/akash-lab"
provider-services keys export "$PROVIDER_KEY_NAME" > "$HOME/akash-lab/key.txt"
```

The CLI will ask for your keyring passphrase and for a **new export password**. Save the export password separately; the provider's init container will need it to decrypt `key.txt`.

```bash
read -r -s -p "Enter the key export password: " PROVIDER_EXPORT_PASSWORD
printf '\n'
printf '%s' "$PROVIDER_EXPORT_PASSWORD" > "$HOME/akash-lab/key-pass.txt"
unset PROVIDER_EXPORT_PASSWORD
printf '%s\n' "$PROVIDER_ADDRESS" > "$HOME/akash-lab/provider-address.txt"
chmod 600 "$HOME/akash-lab/key.txt" "$HOME/akash-lab/key-pass.txt" "$HOME/akash-lab/provider-address.txt"
```

Enter **exactly the same export password** that you chose during `keys export`. The three files will be used in the next provider configuration step. Do not share the recovery phrase, `key.txt`, or `key-pass.txt`.

### Step 5. Create the provider configuration

> **Official Akash documentation:** [Provider installation preparation](https://akash.network/docs/providers/setup-and-installation/kubespray/provider-installation-prep/).

Run these commands on the Linux provider. This configuration targets `sandbox-2` and uses `provider.akash.test` as the provider hostname for the local network test.

```bash
export AKASH_CHAIN_ID="sandbox-2"
export AKASH_NODE="https://rpc.sandbox-2.aksh.pw:443"
export PROVIDER_ADDRESS="$(cat "$HOME/akash-lab/provider-address.txt")"
export PROVIDER_KEY="$(openssl base64 -A -in "$HOME/akash-lab/key.txt")"
export PROVIDER_KEY_PASSWORD="$(openssl base64 -A -in "$HOME/akash-lab/key-pass.txt")"
```

`openssl base64 -A` encodes each file on one line, as the Helm chart expects. The exported variables contain sensitive wallet material; do not print them.

Create the Helm values file:

```bash
umask 077
cat > "$HOME/akash-lab/provider.yaml" <<EOF
from: "$PROVIDER_ADDRESS"
key: "$PROVIDER_KEY"
keysecret: "$PROVIDER_KEY_PASSWORD"
domain: "akash.test"
node: "$AKASH_NODE"
chainid: "$AKASH_CHAIN_ID"
withdrawalperiod: 12h

attributes:
  - key: host
    value: akash
  - key: tier
    value: community
  - key: lab
    value: tomas-ssh
  - key: feat-persistent-storage
    value: "false"
  - key: capabilities/ip-lease
    value: "false"

price_target_cpu: 1.60
price_target_memory: 0.30
price_target_hd_ephemeral: 0.02
price_target_hd_pers_hdd: 0.01
price_target_hd_pers_ssd: 0.03
price_target_hd_pers_nvme: 0.10
price_target_endpoint: 0.05
price_target_ip: 5.00
EOF
chmod 600 "$HOME/akash-lab/provider.yaml"
unset PROVIDER_KEY PROVIDER_KEY_PASSWORD
```

The `lab: tomas-ssh` attribute lets the tenant target this provider in the test SDL. `domain: akash.test` makes its API hostname `provider.akash.test`; the tenant machine will need to resolve that name to the provider PC when we configure network access. GPU attributes are omitted until the inventory operator detects the GPU correctly.

Download the pricing script used by the provider chart:

```bash
curl -fsSLo "$HOME/akash-lab/price_script.sh" \
  "https://raw.githubusercontent.com/akash-network/helm-charts/provider-19.0.2/charts/akash-provider/scripts/price_script_generic.sh"
chmod 700 "$HOME/akash-lab/price_script.sh"
```

For `curl`, `-f` fails on HTTP errors, `-sS` suppresses progress while retaining errors, `-L` follows redirects, and `-o` saves the script to the specified file.

Keep `provider.yaml` private: it contains the encrypted wallet export and its decryption password.

### Step 6. Install and verify the provider

> **Official Akash documentation:** [Provider installation](https://akash.network/docs/providers/setup-and-installation/kubespray/provider-installation/).

The provider chart creates Gateway API resources, so install their CRDs first:

```bash
kubectl kustomize "https://github.com/nginx/nginx-gateway-fabric/config/crd/gateway-api/experimental?ref=v2.6.7" |
  kubectl apply --server-side -f -
```

`--server-side` applies the definitions through the Kubernetes API server. `-f -` reads them from the preceding command. Wait until Kubernetes recognizes `HTTPRoute`:

```bash
kubectl wait --for=condition=Established \
  crd/httproutes.gateway.networking.k8s.io \
  --timeout=120s
```

`--for=condition=Established` checks that the CRD is ready. `--timeout=120s` limits the wait to two minutes.

Install the provider using the files created in Steps 4 and 5:

```bash
cd "$HOME/akash-lab"

helm upgrade --install akash-provider akash/provider \
  --namespace akash-services \
  --version 19.0.2 \
  --values provider.yaml \
  --set bidpricescript="$(openssl base64 -A -in price_script.sh)"
```

- `upgrade --install` installs the release or updates an existing one.
- `--namespace akash-services` selects the namespace containing the Akash operators.
- `--version 19.0.2` pins the chart version used by this guide.
- `--values provider.yaml` loads the provider's wallet, network, attributes, and prices.
- `--set bidpricescript=...` passes the pricing script encoded on one line.

Check that the provider starts:

```bash
kubectl rollout status statefulset/akash-provider \
  --namespace akash-services \
  --timeout=300s

kubectl get pods --namespace akash-services
```

`--timeout=300s` limits the rollout check to five minutes. The expected result is `akash-provider-0` showing `1/1 Running`.

If the rollout fails, check the init container:

```bash
kubectl logs akash-provider-0 \
  --namespace akash-services \
  --container init \
  --tail=100
```

`--container init` selects the container that imports the wallet. `--tail=100` shows its last 100 log lines. A `failed to decrypt private key` error usually means `key-pass.txt` does not match the password chosen during the wallet export.

Once the pod is running, check the provider process:

```bash
kubectl logs akash-provider-0 \
  --namespace akash-services \
  --container provider \
  --tail=100
```

The next step is to verify registration on `sandbox-2` and make the provider API reachable from the tenant machine

### Step 7. Expose provider API

> **Official Akash documentation:** [Provider installation](https://akash.network/docs/providers/setup-and-installation/kubespray/provider-installation/).

Continue after `akash-provider-0` shows `1/1 Running`. This single-node Linux lab
binds the provider API to the provider machine's LAN address. The tenant must be
able to route to that address.

#### 1. Select the provider address

On the **Linux provider machine**, inspect the available addresses:

```bash
ip -br -4 address show
```

Choose the LAN interface address reachable from the tenant, not a loopback,
container bridge, or pod address. Replace this example with your address:

```bash
export PROVIDER_IP="192.168.1.50"
```

Give this address to the tenant for its `provider.akash.test` hosts entry. If it
changes, update the entry and restart the API forwarding command below.

#### 2. Bind the provider API to the LAN interface

Run this on the provider in a terminal and leave it open:

```bash
kubectl port-forward \
  --namespace akash-services \
  --address="$PROVIDER_IP" \
  service/akash-provider \
  8443:8443 8444:8444
```

Each `local:remote` pair forwards a host port to the corresponding provider service
port. This foreground process is for the lab; it must be restarted if it exits or
its selected pod terminates. See the [Kubernetes port-forward guide](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/).

#### 3. Check host firewall and routing

Allow tenant traffic to TCP ports `8443` and `8444` through the firewall used by
your Linux host and any intervening network firewall. If UFW is already active,
these example rules permit one tenant address (replace both addresses):

```bash
export TENANT_IP="192.168.1.60"
sudo ufw allow from "$TENANT_IP" to "$PROVIDER_IP" port 8443 proto tcp
sudo ufw allow from "$TENANT_IP" to "$PROVIDER_IP" port 8444 proto tcp
sudo ufw status verbose
```

Use equivalent rules if you manage nftables or firewalld instead. These API rules
are additional to the cluster networking configuration; follow the
[K3s firewall requirements](https://docs.k3s.io/installation/requirements) for your
pod/service CIDRs and node topology. Do not enable a new firewall blindly on an
existing cluster. Verify access from the tenant in the next step.

## Tenant setup:

### Step 1. Test connection to provider machine

> **Official Akash documentation:** [Provider installation](https://akash.network/docs/providers/setup-and-installation/kubespray/provider-installation/).

Point the tenant hostname at the Linux provider machine

On the tenant, edit `/etc/hosts`:

```bash
sudo nano /etc/hosts
```

Add or update this line, replacing `PROVIDER_LAN_IP` with the provider address selected above:

```text
PROVIDER_LAN_IP provider.akash.test
```

Save the file. The hostname stays `provider.akash.test`; only its IP changes when the provider PC joins a different network.

#### Test from the tenant

```bash
nc -vz provider.akash.test 8443
nc -vz provider.akash.test 8444
```

For `nc`, `-v` prints connection details and `-z` checks whether the TCP port accepts a connection without sending data. Both tests should succeed. A timeout can mean a host or network firewall is blocking traffic, the forwarding process has stopped, or the tenant cannot route to the provider.

Keep the provider API `kubectl port-forward` terminal running during the test. Checking the workload’s assigned SSH port comes later, after the tenant has created a lease.

### Step 2. Create and fund the tenant wallet

> **Official Akash documentation:** [Install provider-services and prepare a wallet](https://akash.network/docs/developers/deployment/cli/installation-guide/).

Run these commands on the tenant PC:

```bash
export AKASH_CHAIN_ID="sandbox-2"
export AKASH_NODE="https://rpc.sandbox-2.aksh.pw:443"
export AKASH_GAS_PRICES="0.025uakt"
export AKASH_GAS_ADJUSTMENT="1.5"
export AKASH_KEYRING_BACKEND="file"
export TENANT_KEY_NAME="my-tenant"

provider-services keys list
```

The `file` keyring backend stores the wallet in an encrypted file. If `my-tenant` already appears, reuse it. Otherwise, create it:

```bash
provider-services keys add "$TENANT_KEY_NAME"
```

Save the displayed recovery phrase securely. Get the tenant address:

```bash
export OWNER="$(provider-services keys show "$TENANT_KEY_NAME" -a)"
printf '%s\n' "$OWNER"
```

The `-a` flag prints only the address. Request sandbox AKT for this address from the [sandbox-2 faucet](https://faucet.sandbox-2.aksh.pw), then confirm it arrived:

```bash
provider-services query bank balances "$OWNER"
```

Keep some `uakt` for transaction fees. The deployment deposit and lease will use `uact`, which we will prepare before creating the deployment.

### Step 3. Create the tenant client certificate

> **Official Akash documentation:** [CLI commands: certificates, deployments, bids, leases, and manifests](https://akash.network/docs/developers/deployment/cli/commands-reference/).

The certificate lets the tenant authenticate when sending a manifest to the provider API:

```bash
provider-services tx cert generate client --from "$TENANT_KEY_NAME"

provider-services tx cert publish client \
  --from "$TENANT_KEY_NAME" \
  --gas auto
```

`--from` selects the tenant wallet. `--gas auto` estimates the gas for publishing the certificate. Confirm the transaction when prompted.

Verify publication:

```bash
provider-services query cert list --owner "$OWNER"
```

`--owner` limits the results to the tenant address. Next, prepare the SSH key and the container’s SDL file.

### Step 4. Prepare the SSH container

> **Official Akash documentation:** [SDL syntax: services, exposed ports, resources, and placement](https://akash.network/docs/developers/deployment/akash-sdl/syntax-reference/).

Run these commands on the tenant PC. Create a dedicated SSH key if you do not already have one for this test:

```bash
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

if [ ! -f "$HOME/.ssh/akash_lab_ed25519" ]; then
  ssh-keygen -t ed25519 -f "$HOME/.ssh/akash_lab_ed25519"
fi
```

`-t ed25519` selects the key type. `-f` specifies where to save the key. Keep the private key on the tenant PC; only its `.pub` file goes into the container configuration.

Create a directory for the deployment and write `ssh.yaml`:

```bash
mkdir -p "$HOME/akash-ssh-test"
cd "$HOME/akash-ssh-test"

SSH_PUBLIC_KEY="$(cat "$HOME/.ssh/akash_lab_ed25519.pub")"

cat > ssh.yaml <<EOF
version: "2.0"

services:
  ssh:
    image: lscr.io/linuxserver/openssh-server:latest
    env:
      - USER_NAME=akash
      - PUBLIC_KEY=$SSH_PUBLIC_KEY
      - PASSWORD_ACCESS=false
    expose:
      - port: 2222
        as: 2222
        proto: tcp
        to:
          - global: true

profiles:
  compute:
    ssh:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi

  placement:
    your-provider:
      attributes:
        lab: tomas-ssh
      pricing:
        ssh:
          denom: uact
          amount: 1000

deployment:
  ssh:
    your-provider:
      profile: ssh
      count: 1
EOF

unset SSH_PUBLIC_KEY
```

The image listens for SSH on container port `2222`. `PUBLIC_KEY` authorizes your tenant PC’s SSH key, while `PASSWORD_ACCESS=false` disables password login. The `lab: tomas-ssh` attribute matches the provider configuration. `amount: 1000` is the maximum bid price this deployment will accept, in `uact` per block; it is not the price charged merely for creating the SDL.

The provider will assign an external TCP port after the lease starts. That external port may differ from `2222`.

Next, fund the tenant wallet with ACT and create the on-chain deployment.

### Step 5. Fund and create the deployment

> **Official Akash documentation:** [CLI commands: certificates, deployments, bids, leases, and manifests](https://akash.network/docs/developers/deployment/cli/commands-reference/).

Run these commands on the tenant PC:

```bash
export AKASH_CHAIN_ID="sandbox-2"
export AKASH_NODE="https://rpc.sandbox-2.aksh.pw:443"
export AKASH_KEYRING_BACKEND="file"
export TENANT_KEY_NAME="my-tenant"
export OWNER="$(provider-services keys show "$TENANT_KEY_NAME" -a)"

cd "$HOME/akash-ssh-test"
provider-services query bank balances "$OWNER"
provider-services query deployment params
```

Confirm the wallet has sandbox `uakt` and check the chain’s minimum `uact` deposit. Mint ACT while retaining some AKT for transaction fees:

```bash
provider-services tx bme mint-act 5000000uakt \
  --from "$TENANT_KEY_NAME" \
  --gas auto
```

`--from` selects the tenant wallet. `--gas auto` estimates the transaction’s gas. Confirm the transaction when prompted, then **verify that the wallet actually has `uact`**:

```bash
provider-services query bank balances "$OWNER"
```

Create a new deployment sequence for this attempt:

```bash
export DSEQ="$(date +%s)"
printf '%s\n' "$DSEQ"
```

`date +%s` produces the current Unix timestamp. Use a **new value for each new deployment**; reusing an existing sequence causes `Deployment exists`.

If the chain reports a minimum deposit of `500000uact` and your wallet has at least that amount, create the deployment:

```bash
provider-services tx deployment create ssh.yaml \
  --from "$TENANT_KEY_NAME" \
  --dseq "$DSEQ" \
  --deposit 500000uact \
  --deposit-sources balance \
  --gas auto
```

- `--from` signs with the tenant wallet.
- `--dseq` assigns the new deployment sequence.
- `--deposit` funds its escrow with ACT.
- `--deposit-sources balance` uses ACT held in the wallet.
- `--gas auto` estimates gas for the transaction.

Confirm the transaction and check that its result contains `code: 0`. Save the `DSEQ`; the bid, lease, and manifest steps all refer to it.

Creating the deployment places the order on-chain. The provider can now evaluate it and submit a bid.

### Step 6. Check the provider’s bid and create the lease

> **Official Akash documentation:** [CLI commands: certificates, deployments, bids, leases, and manifests](https://akash.network/docs/developers/deployment/cli/commands-reference/).

Run these commands on the tenant PC using the same wallet that signed the
deployment in Step 5. Restore its key name if this is a new terminal:

```bash
export TENANT_KEY_NAME="my-tenant"
export OWNER="$(provider-services keys show "$TENANT_KEY_NAME" -a)"
```

Use your actual key name if it differs. Changing wallets does not change the owner
of an existing deployment.

Confirm that the deployment exists:

```bash
provider-services query deployment get \
  --owner "$OWNER" \
  --dseq "$DSEQ"
```

`--owner` selects the deployment owner. `--dseq` selects the deployment sequence created in Step 5.

List its open bids:

```bash
provider-services query market bid list \
  --owner "$OWNER" \
  --dseq "$DSEQ" \
  --state open
```

`--state open` limits the results to bids that can still be accepted. Find the bid from your provider PC and copy its provider address. If the list is empty, do not create a lease yet.

Set the provider address to the value shown in its bid:

```bash
export PROVIDER="REPLACE_WITH_PROVIDER_ADDRESS"
```

Create the lease:

```bash
provider-services tx market lease create \
  --dseq "$DSEQ" \
  --gseq 1 \
  --oseq 1 \
  --provider "$PROVIDER" \
  --from "$TENANT_KEY_NAME" \
  --gas auto
```

- `--dseq` selects this deployment.
- `--gseq 1` selects its first resource group.
- `--oseq 1` selects its first order.
- `--provider` selects the provider whose bid you accepted.
- `--from` signs with the wallet that owns the deployment.
- `--gas auto` estimates the gas limit.

Confirm the transaction when prompted. Its result should contain `code: 0`. Keep the values of `DSEQ` and `PROVIDER` for the manifest step.

Confirm the lease transaction has `code: 0`, then verify that it is active:

```bash
provider-services query market lease list \
  --owner "$OWNER" \
  --dseq "$DSEQ"
```

`--owner` and `--dseq` limit the results to this deployment. An active lease completes the on-chain trade; the container starts after you send its manifest.

### Step 7. Send the manifest

> **Official Akash documentation:** [CLI commands: certificates, deployments, bids, leases, and manifests](https://akash.network/docs/developers/deployment/cli/commands-reference/).

On the tenant PC, send the **same `ssh.yaml`** used to create the deployment:

```bash
cd "$HOME/akash-ssh-test"

provider-services send-manifest ssh.yaml \
  --dseq "$DSEQ" \
  --provider "$PROVIDER" \
  --from "$TENANT_KEY_NAME"
```

`--dseq` identifies the deployment, `--provider` selects the provider holding the lease, and `--from` authenticates as the tenant wallet.

Check the service and its assigned SSH port:

```bash
provider-services lease-status \
  --dseq "$DSEQ" \
  --provider "$PROVIDER" \
  --from "$TENANT_KEY_NAME"
```

Wait until `services.ssh.ready_replicas` is `1`. Under `forwarded_ports.ssh`, record **`externalPort`**. This is the port the tenant PC connects to; `2222` is the port inside the container.

### Step 8. Verify the workload port on Linux

> **Official Akash documentation:** [Provider installation](https://akash.network/docs/providers/setup-and-installation/kubespray/provider-installation/); [SDL syntax: services, exposed ports, resources, and placement](https://akash.network/docs/developers/deployment/akash-sdl/syntax-reference/).

On the **Linux provider machine**, inspect the workload services and their assigned
ports after the manifest is accepted:

```bash
kubectl get services --all-namespaces -o wide
kubectl get pods --all-namespaces -o wide
```

Find the service for this lease and match its exposed port to `externalPort` from
Step 7. For this single-node lab, the tenant connects to the provider's LAN IP and
the exposed workload port. Do not substitute the container's `2222` port for the
reported external port. For a multi-node or load-balanced provider, use the
advertised reachable workload endpoint instead.

Allow that TCP port through your applicable host and network firewall rules.
For an already active UFW setup, replace `30625` with the lease's actual external
port and use your tenant and provider addresses:

```bash
export PROVIDER_IP="192.168.1.50"
export TENANT_IP="192.168.1.60"
export SSH_EXTERNAL_PORT=30625
sudo ufw allow from "$TENANT_IP" to "$PROVIDER_IP" port "$SSH_EXTERNAL_PORT" proto tcp
```

Kubernetes service traffic may traverse forwarding chains rather than the host
input chain. A UFW input rule alone does not establish that NodePort traffic is
restricted or reachable; check your cluster's forwarding rules and any upstream
firewall, then test from the tenant. No additional host-to-guest port proxy is
part of this native Linux setup.

### Step 9. Connect from the tenant PC

Use the provider LAN IP selected during API setup. If Step 1 already maps `provider.akash.test` to that IP, check the port and connect:

```bash
export SSH_EXTERNAL_PORT=30625

nc -vz provider.akash.test "$SSH_EXTERNAL_PORT"

ssh -i "$HOME/.ssh/akash_lab_ed25519" \
  -p "$SSH_EXTERNAL_PORT" \
  akash@provider.akash.test
```

Replace `30625` with this lease’s `externalPort`. For `nc`, `-v` displays the connection result and `-z` tests the TCP port without sending data. For `ssh`, `-i` selects the private key created in Step 4, and `-p` selects the external port. The username is `akash` because Step 4 set `USER_NAME=akash`.

The SSH session is running inside the tenant’s container on the provider PC.

### Step 10. Close the deployment when finished

> **Official Akash documentation:** [CLI commands: certificates, deployments, bids, leases, and manifests](https://akash.network/docs/developers/deployment/cli/commands-reference/).

Run this on the tenant PC when you no longer need the container:

```bash
provider-services tx deployment close \
  --dseq "$DSEQ" \
  --from "$TENANT_KEY_NAME" \
  --gas auto
```

`--dseq` identifies the deployment, `--from` signs with its owner wallet, and `--gas auto` estimates the transaction fee. Confirm the transaction and check for `code: 0`. Closing the deployment ends its lease and stops ongoing charges.

## Command cheat sheet

Run tenant commands on the **tenant PC**. In a new terminal, restore the values for the deployment you want to inspect:

```bash
export AKASH_CHAIN_ID="sandbox-2"
export AKASH_NODE="https://rpc.sandbox-2.aksh.pw:443"
export AKASH_KEYRING_BACKEND="file"
export TENANT_KEY_NAME="my-tenant"
export OWNER="$(provider-services keys show "$TENANT_KEY_NAME" -a)"
export PROVIDER="akash1f667m5r37r6gchhc9jfr7enzl8fvswv7ae3jvj"
export DSEQ="REPLACE_WITH_DEPLOYMENT_DSEQ"
```

`OWNER` is the tenant wallet address. `PROVIDER` is the provider wallet address. `DSEQ` identifies one deployment; set it to the sequence returned when that deployment was created.

### Check the deployment

```bash
provider-services query deployment get \
  --owner "$OWNER" \
  --dseq "$DSEQ"
```

`--owner` and `--dseq` select the exact deployment. Check its `state` and the state of its resource group.

### Check bids

```bash
provider-services query market bid list \
  --owner "$OWNER" \
  --dseq "$DSEQ"
```

This shows bids for the deployment, regardless of state. To see only bids still available to accept:

```bash
provider-services query market bid list \
  --owner "$OWNER" \
  --dseq "$DSEQ" \
  --state open
```

`--state open` filters out bids that are no longer open. Add `--provider "$PROVIDER"` to either command to show only bids from your provider PC.

### Check leases

```bash
provider-services query market lease list \
  --owner "$OWNER" \
  --dseq "$DSEQ"
```

This lists leases for the deployment. To inspect the lease with your provider:

```bash
provider-services query market lease get \
  --owner "$OWNER" \
  --dseq "$DSEQ" \
  --gseq 1 \
  --oseq 1 \
  --provider "$PROVIDER"
```

`--gseq 1` and `--oseq 1` select the first group and order; `--provider` selects the provider that won the lease.

### Check container readiness and assigned ports

```bash
provider-services lease-status \
  --dseq "$DSEQ" \
  --provider "$PROVIDER" \
  --from "$TENANT_KEY_NAME"
```

`--from` authenticates with the tenant wallet. Check `ready_replicas` for the SSH service and `forwarded_ports.ssh[].externalPort` for its current external TCP port.

### View container logs

```bash
provider-services lease-logs \
  --dseq "$DSEQ" \
  --provider "$PROVIDER" \
  --from "$TENANT_KEY_NAME"
```

The deployment and provider flags select the lease; `--from` authenticates as its owner.

### Check the tenant wallet balance

```bash
provider-services query bank balances "$OWNER"
```

The output shows the wallet’s `uakt` for transaction fees and any `uact` available for deployment deposits.

### Connect over SSH

Set the port to the `externalPort` shown by `lease-status`:

```bash
export SSH_EXTERNAL_PORT="REPLACE_WITH_EXTERNAL_PORT"

ssh -i "$HOME/.ssh/akash_lab_ed25519" \
  -p "$SSH_EXTERNAL_PORT" \
  akash@provider.akash.test
```

`-i` selects the tenant PC’s private key. `-p` selects the lease’s external SSH port. The hostname must point to the provider PC’s current LAN IP.

### Close the deployment

Run this when the test is finished:

```bash
provider-services tx deployment close \
  --dseq "$DSEQ" \
  --from "$TENANT_KEY_NAME" \
  --gas auto
```

`--dseq` identifies the deployment, `--from` signs with its owner wallet, and `--gas auto` estimates the transaction fee. Confirm the transaction and check for `code: 0`.

### Provider PC checks

Run these on the Linux provider on the **provider PC**:

```bash
sudo kubectl get pods --namespace akash-services
sudo kubectl get pods --namespace lease
sudo kubectl logs akash-provider-0 \
  --namespace akash-services \
  --container provider \
  --tail=100
```

`--namespace` selects the provider or workload namespace. `--container provider` reads the provider process rather than its init container; `--tail=100` limits the log output.

To find what the provider logged for a particular deployment:

```bash
sudo kubectl logs akash-provider-0 \
  --namespace akash-services \
  --container provider \
  --since=30m |
  grep -F "$OWNER/$DSEQ/"
```

`--since=30m` limits the search to recent logs. `grep -F` matches the owner and DSEQ literally.

### Linux networking checks

Run these on the **Linux provider machine**:

```bash
ip -br -4 address show
sudo ss -ltnp '( sport = :8443 or sport = :8444 )'
kubectl get services --all-namespaces -o wide
```

Verify that the API forwarding process binds the current LAN address and that the
workload service exposes the port reported in lease status. A Kubernetes NodePort
may be implemented by packet-forwarding rules rather than a listening process,
so `ss` alone is not a NodePort readiness check. From the tenant, test both API
ports and the workload port with `nc -vz` as shown above. If access fails, inspect
routing and the active firewall rules on the path between the two machines.
