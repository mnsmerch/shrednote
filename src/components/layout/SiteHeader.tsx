import Link from 'next/link';

import { Logo } from '@/components/brand/Logo';

const LINKS = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/about', label: 'About' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-6">
        <Logo />
        <nav aria-label="Main">
          <ul className="flex items-center gap-1 sm:gap-2">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-lg px-2.5 py-2 text-[0.875rem] font-medium text-muted transition-colors hover:bg-surface-muted hover:text-ink sm:px-3"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
