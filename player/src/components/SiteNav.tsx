const SITE_URL = 'https://whiterabbitashland.com'

const navItems = [
  { name: "What's On", href: `${SITE_URL}/events` },
  { name: 'About', href: `${SITE_URL}/about` },
  { name: 'Menu', href: '/', active: true },
  { name: 'Membership', href: `${SITE_URL}/membership` },
  { name: 'Gallery', href: `${SITE_URL}/gallery` },
]

export function SiteNav() {
  return (
    <nav className="site-nav">
      <div className="site-nav-inner">
        <a href={SITE_URL} className="site-nav-logo">
          <img src="/logo-green.png" alt="White Rabbit" />
        </a>

        <div className="site-nav-links">
          {navItems.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className={`site-nav-link ${item.active ? 'active' : ''}`}
            >
              {item.name}
            </a>
          ))}
        </div>
      </div>
    </nav>
  )
}
