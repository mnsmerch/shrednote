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
      /*
       * The only sanctioned use of dangerouslySetInnerHTML in the codebase
       * (see the react/no-danger rule in eslint.config.mjs). The content is
       * JSON.stringify output with every `<` escaped, so it cannot terminate
       * the script tag, and it is built from our own page metadata - never
       * from a note, a label or any user input.
       */
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
