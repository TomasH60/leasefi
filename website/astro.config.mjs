import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://tomash60.github.io',
  base: '/leasefi',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'LeaseFi',
      description: 'Wallets, cross-chain funding, and tenant deployments from your terminal.',
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/TomasH60/leasefi' }],
      customCss: ['./src/styles/custom.css'],
      components: {
        Hero: './src/components/BannerHero.astro',
        SiteTitle: './src/components/SiteLogo.astro',
      },
      sidebar: [
        { label: 'Start here', items: [{ label: 'Choose tenant or provider', slug: 'index' }] },
        {
          label: 'Tenant — rent compute',
          items: [
            { label: '1. Prepare & connect', slug: 'guides/tenant-setup' },
            { label: '2. Wallet & certificate', slug: 'guides/tenant-identity' },
            { label: '3. Prepare the workload', slug: 'guides/tenant-workload' },
            { label: '4. Install LeaseFi', slug: 'getting-started' },
            { label: '5. Connect your tenant wallet', slug: 'use-leasefi' },
            { label: '6. Deploy with LeaseFi', slug: 'deploy-with-leasefi' },
            { label: '7. Connect over SSH', slug: 'guides/tenant-access' },
          ],
        },
        {
          label: 'Provider — supply compute',
          items: [
            { label: '1. Prepare the cluster', slug: 'guides/provider-cluster' },
            { label: '2. Configure & start the provider', slug: 'guides/provider-service' },
            { label: '3. Expose the provider API', slug: 'guides/provider-network' },
            { label: '4. Test & operate the provider', slug: 'provider-test' },
          ],
        },
        {
          label: 'Optional — bridge EVM funds',
          items: [
            { label: 'Understand the funding route', slug: 'bridge' },
            { label: 'Run the testnet walkthrough', slug: 'guides/testnet-bridge' },
          ],
        },
      ],
    }),
  ],
});
