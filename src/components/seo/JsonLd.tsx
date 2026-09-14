import { headers } from 'next/headers';

/**
 * Renders structured data as `application/ld+json`.
 *
 * The nonce from middleware is applied so the tag satisfies our
 * Content-Security-Policy. The payload is serialised with `<` escaped, which
 * prevents a `</script>` sequence in any value from breaking out of the tag.
 */
export async function JsonLd({ data }: { data: Record<string, unknown> }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
