import Link from 'next/link';

import { Composer } from '@/components/composer/Composer';
import { JsonLd } from '@/components/seo/JsonLd';
import { getLandingContent, LANDING_PAGES } from '@/lib/landing-content';
import { siteUrl } from '@/lib/site';

/**
 * Shared layout for the topic pages.
 *
 * Every page puts the working tool directly under the introduction: someone
 * who arrived looking for "how do I send a password" should be able to do it
 * on the page they landed on, not be sent back to the homepage first.
 */
export function LandingPage({ slug }: { slug: string }) {
  const content = getLandingContent(slug);
  const related = content.related
    .map((relatedSlug) => LANDING_PAGES[relatedSlug])
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Article',
              headline: content.h1,
              description: content.metaDescription,
              url: `${siteUrl}/${content.slug}`,
              inLanguage: 'en',
              isPartOf: { '@id': `${siteUrl}/#website` },
              publisher: { '@id': `${siteUrl}/#organization` },
            },
            {
              '@type': 'FAQPage',
              mainEntity: content.faqs.map((faq) => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: { '@type': 'Answer', text: faq.answer },
              })),
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'ShredNote', item: siteUrl },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: content.h1,
                  item: `${siteUrl}/${content.slug}`,
                },
              ],
            },
          ],
        }}
      />

      <article className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-20">
        <header>
          <p className="text-[0.8125rem] font-semibold tracking-wide text-accent uppercase">
            {content.eyebrow}
          </p>
          <h1 className="mt-2 text-[2rem] leading-[1.12] font-semibold tracking-[-0.03em] text-ink sm:text-[2.75rem]">
            {content.h1}
          </h1>
          <p className="mt-4 text-[1.125rem] leading-relaxed text-muted sm:text-[1.1875rem]">
            {content.lead}
          </p>
        </header>

        <div className="sn-prose mt-8">
          {content.intro.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </div>

        {/* The tool itself, usable without leaving the page. */}
        <section className="mt-10" aria-label="Create a ShredNote">
          <Composer />
        </section>

        <div className="sn-prose mt-14">
          {content.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.body?.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
              {section.list ? (
                section.listOrdered ? (
                  <ol>
                    {section.list.map((item) => (
                      <li key={item.slice(0, 40)}>{item}</li>
                    ))}
                  </ol>
                ) : (
                  <ul>
                    {section.list.map((item) => (
                      <li key={item.slice(0, 40)}>{item}</li>
                    ))}
                  </ul>
                )
              ) : null}
            </section>
          ))}

          <h2>Common questions</h2>
          <div className="!mt-4 space-y-3">
            {content.faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-line bg-surface px-5 py-4 [&[open]]:bg-surface-inset"
              >
                <summary className="cursor-pointer list-none font-semibold text-ink marker:content-['']">
                  <span className="flex items-start justify-between gap-4">
                    {faq.question}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="mt-1 h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    >
                      <path
                        d="m6 9 6 6 6-6"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </summary>
                <p className="!mt-2.5 text-[0.9375rem]">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>

        {related.length > 0 ? (
          <nav className="mt-14 border-t border-line pt-8" aria-label="Related guides">
            <h2 className="text-[0.8125rem] font-semibold tracking-wide text-muted uppercase">
              Keep reading
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-3">
              {related.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={`/${entry.slug}`}
                    className="block h-full rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-muted"
                  >
                    <span className="block text-[0.9375rem] font-semibold text-ink">
                      {entry.h1}
                    </span>
                    <span className="mt-1 block text-[0.875rem] leading-relaxed text-muted">
                      {entry.eyebrow}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </article>
    </>
  );
}
