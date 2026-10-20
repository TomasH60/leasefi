import { URL } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// The runbooks in /docs are the source of truth. Only these reviewed files are published.
const pages = [
  [
    'TENANT_CLI.md',
    'tenant-cli',
    'Tenant deployments',
    'Create, inspect, resume, and close Akash tenant deployments.',
  ],
  [
    'SKIP_GO_TESTNET_BRIDGE.md',
    'testnet-bridge',
    'Testnet bridge',
    'Test a Sepolia USDC to Osmosis testnet bridge with Skip Go.',
  ],
  [
    'Akash local network deployment setup.md',
    'local-provider',
    'Complete native lab walkthrough',
    'The original provider and tenant setup commands in one document.',
  ],
];
const output = new URL('../src/content/docs/guides/', import.meta.url);
await mkdir(output, { recursive: true });
for (const [file, slug, title, description] of pages) {
  let body = await readFile(new URL(`../../docs/${file}`, import.meta.url), 'utf8');
  body = body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').replace(/^\s*# [^\n]+\n/, '');
  for (const [source, target] of pages) {
    body = body.replaceAll(`](${encodeURI(source)})`, `](../${target}/)`);
    body = body.replaceAll(`](${source})`, `](../${target}/)`);
  }
  // Repository source paths in runbooks should open GitHub, not a nonexistent site route.
  body = body.replace(
    /\]\((src\/[^)]+)\)/g,
    '](' + 'https://github.com/TomasH60/leasefi/blob/main/$1)',
  );
  await writeFile(
    new URL(`${slug}.md`, output),
    `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\neditUrl: ${JSON.stringify(`https://github.com/TomasH60/leasefi/edit/main/docs/${encodeURI(file)}`)}\n---\n\n${body.trim()}\n`,
  );
}

// Publish the detailed lab in task-sized chapters without duplicating its commands.
const labFile = 'Akash local network deployment setup.md';
const lab = await readFile(new URL(`../../docs/${labFile}`, import.meta.url), 'utf8');
function section(start, end) {
  const from = lab.indexOf(start);
  const to = end ? lab.indexOf(end, from + start.length) : lab.length;
  if (from < 0 || to < 0) throw new Error(`Missing lab section: ${start} / ${end}`);
  return lab.slice(from, to).trim();
}
const chapters = [
  {
    slug: 'provider-cluster',
    title: 'Prepare the provider cluster',
    intro:
      'Start on the provider PC. This guide is a native Linux (Ubuntu/Debian) lab using the public `sandbox-2` chain, not a private blockchain or a production provider installation. Install the listed tools before running the configuration commands. LeaseFi is introduced on the tenant machine after the infrastructure is ready.',
    body:
      section('## Provider requirements:', '## Tenant requirements:') +
      '\n\n' +
      section('### Step 1. Configure', '### Step 4. Create'),
    next: 'provider-service',
    nextTitle: 'Configure and start the provider',
  },
  {
    slug: 'provider-service',
    title: 'Configure and start the provider',
    intro:
      'Complete [the cluster setup](../provider-cluster/) first. Run these steps on Linux on the provider PC, using a provider wallet separate from the tenant wallet. Skip wallet creation only if you already have the wallet and export files required below.',
    body: section('### Step 4. Create', '### Step 7. Expose'),
    next: 'provider-network',
    nextTitle: 'Expose the provider API',
  },
  {
    slug: 'provider-network',
    title: 'Expose the provider API',
    intro:
      'Complete [provider installation](../provider-service/) first. The provider must be running before forwarding its API. Run these commands on the Linux provider; keep the API forwarding process running while a tenant uses the provider.',
    body: section('### Step 7. Expose', '## Tenant setup:'),
    next: '../provider-test',
    nextTitle: 'Test the provider with a tenant',
  },
  {
    slug: 'tenant-setup',
    title: 'Prepare the tenant and connect to the provider',
    intro:
      'A tenant rents compute; it does not need to install Kubernetes or operate a provider. This walkthrough uses a Linux tenant machine and a native Linux provider on the same local network. If you operate both machines, finish [provider setup](../provider-cluster/) first. Ask the provider operator for its LAN IP and on-chain provider address. Public providers do not use this lab’s local hostname and API forwarding steps.',
    body:
      section('## Tenant requirements:', '## Provider setup:') +
      '\n\n' +
      section('### Step 1. Test connection', '### Step 2. Create and fund the tenant'),
    next: 'tenant-identity',
    nextTitle: 'Set up the tenant wallet and certificate',
  },
  {
    slug: 'tenant-identity',
    title: 'Set up the tenant wallet and certificate',
    intro:
      'First [verify the provider connection](../tenant-setup/). These are the native Akash setup commands from the lab runbook. Keep the recovery phrase and tenant address: later you will import this same identity into LeaseFi, rather than create another funded account.',
    body: section('### Step 2. Create and fund the tenant', '### Step 4. Prepare the SSH'),
    next: 'tenant-workload',
    nextTitle: 'Prepare the SSH workload',
  },
  {
    slug: 'tenant-workload',
    title: 'Prepare the SSH workload',
    intro:
      'Complete [wallet and certificate setup](../tenant-identity/) first. The SSH key controls access to your container; the wallet and client certificate control the deployment. Create the SDL on the tenant machine and ensure its placement attributes match the provider.',
    body: section('### Step 4. Prepare the SSH', '### Step 5. Fund and create').replace(
      'Next, fund the tenant wallet with ACT and create the on-chain deployment.',
      'Your setup is ready for LeaseFi: keep this SSH key and `ssh.yaml` for the deployment workflow.',
    ),
    next: '../getting-started',
    nextTitle: 'Install LeaseFi on the tenant machine',
  },
  {
    slug: 'tenant-access',
    title: 'Connect to the deployed SSH container',
    intro:
      'First [deploy with LeaseFi](../../deploy-with-leasefi/). In the original lab steps below, “Step 7” means the workload-status check that reports `forwarded_ports.ssh[].externalPort`; LeaseFi exposes it with `deployment status --workload`. Keep the deployment owner, provider address, and DSEQ from that workflow. The provider operator verifies the exposed workload port and firewall rules; the tenant connects with the SSH key.',
    body:
      section('### Step 8. Verify', '### Step 10. Close') +
      '\n\n## Finish the deployment\n\nReturn to [LeaseFi monitoring and cleanup](../../deploy-with-leasefi/#monitor-and-close) to inspect logs and close the deployment when finished.',
    next: '../deploy-with-leasefi',
    nextTitle: 'Monitor and close with LeaseFi',
  },
];
for (const chapter of chapters) {
  const editUrl = `https://github.com/TomasH60/leasefi/edit/main/docs/${encodeURI(labFile)}`;
  await writeFile(
    new URL(`${chapter.slug}.md`, output),
    `---\ntitle: ${JSON.stringify(chapter.title)}\ndescription: ${JSON.stringify(chapter.title + ' for the sandbox lab.')}\neditUrl: ${JSON.stringify(editUrl)}\n---\n\n${chapter.intro}\n\n${chapter.body}\n\n**Next:** [${chapter.nextTitle}](../${chapter.next}/).\n`,
  );
}
