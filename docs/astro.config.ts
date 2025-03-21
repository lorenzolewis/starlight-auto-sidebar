import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import starlightAutoSidebar from 'starlight-auto-sidebar'

export default defineConfig({
  integrations: [
    starlight({
      components: {
        MarkdownContent: './src/components/starlight/MarkdownContent.astro',
      },
      description: 'Starlight plugin to tweak autogenerated sidebar groups.',
      editLink: {
        baseUrl: 'https://github.com/HiDeoo/starlight-auto-sidebar/edit/main/docs/',
      },
      plugins: [starlightAutoSidebar()],
      routeMiddleware: './src/routeData.ts',
      sidebar: [
        {
          label: 'Start Here',
          items: ['getting-started', 'metadata'],
        },
        {
          label: 'Guides',
          items: ['guides/using-metadata', 'guides/cascading-metadata', 'guides/i18n'],
        },
        {
          label: 'Resources',
          items: [{ label: 'Plugins and Tools', slug: 'resources/starlight' }],
        },
        {
          label: 'Demo',
          autogenerate: { directory: 'demo' },
        },
      ],
      social: {
        blueSky: 'https://bsky.app/profile/hideoo.dev',
        github: 'https://github.com/HiDeoo/starlight-auto-sidebar',
      },
      title: 'Starlight Auto Sidebar',
    }),
  ],
  site: 'https://starlight-auto-sidebar.netlify.app/',
  trailingSlash: 'always',
})
