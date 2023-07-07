module.exports = {
  title: 'NomanAziz',
  tagline: 'Full Stack Web3 Developer | DevSecOps Engineer',
  url: 'https://blog.nomanaziz.me',
  baseUrl: '/',
  trailingSlash: true,
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/nomanaziz.jpg',
  organizationName: 'noman-aziz', // Usually your GitHub org/user name.
  projectName: 'Blogs', // Usually your repo name.
  themeConfig: {
    colorMode: {
      defaultMode: "dark",
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      hideOnScroll: true,
      title: "NomanAziz",
      logo: {
        alt: "NomanAziz",
        src: "img/nomanaziz.jpg",
        href: "https://nomanaziz.me",
        target: "_blank",
      },
      items: [
        { to: "/", label: "Blog", position: "left" },
        {
          to: "/docs/",
          activeBasePath: "docs",
          label: "Diary",
          position: "left",
        },
        {
          href: 'https://nomanaziz.me/about',
          label: 'About',
          position: 'right',
        },
        {
          href: 'https://notes.nomanaziz.me',
          label: 'Notes',
          position: 'right',
        },        
        {
          href: 'https://nomanaziz.me/skills',
          label: 'Skills',
          position: 'right',
        },
        {
          href: 'https://nomanaziz.me/achievements',
          label: 'Achievements',
          position: 'right',
        },
      ],
    },
    footer: {
      links: [
        {
          title: 'Connect',
          items: [
            {
              label: 'LinkedIn',
              href: 'https://linkedin/in/noman-aziz',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/noman-aziz',
            },
            {
              label: 'Email',
              href: 'mailto:nauman.aziz@pm.me',
            },
          ],
        },
      ],
      copyright: `Last updated on ${new Date().toDateString()}`,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        googleAnalytics: {
          trackingID: 'UA-123518521-4',
          anonymizeIP: true, // Should IPs be anonymized?
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['/tags/**'],
        },
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          disableVersioning: false,
          editCurrentVersion: false,
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        blog: {
          blogTitle: 'NomanAziz Blog',
          blogDescription: 'Blog For Development & Security Operations tools, tips, tricks and more.!',
          // showReadingTime: true,
          path: "./blog",
          routeBasePath: "/"
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};
