/**
 * Content for the topic landing pages.
 *
 * Each entry is written to answer the question a visitor actually arrived
 * with. They deliberately share no boilerplate paragraphs: near-duplicate
 * pages are bad for readers and are treated as thin content by search
 * engines, so every page here has to earn its place or be deleted.
 */

export interface LandingSection {
  heading: string;
  body?: string[];
  list?: string[];
  listOrdered?: boolean;
}

export interface LandingFaq {
  question: string;
  answer: string;
}

export interface LandingContent {
  slug: string;
  title: string;
  metaDescription: string;
  eyebrow: string;
  h1: string;
  lead: string;
  intro: string[];
  sections: LandingSection[];
  faqs: LandingFaq[];
  related: string[];
}

export const LANDING_PAGES: Record<string, LandingContent> = {
  'send-password-securely': {
    slug: 'send-password-securely',
    title: 'How to Send a Password Securely',
    metaDescription:
      'Sending a password over chat or email leaves a permanent copy. Here is how to share one safely, what to avoid, and how a one-time encrypted link works.',
    eyebrow: 'Guide',
    h1: 'How to send a password securely',
    lead: 'The problem is not usually the password. It is the copy of it that stays in a chat thread, an inbox or a backup for the next five years.',
    intro: [
      'Most password sharing happens in the least safe place available: a message thread. It works, so nobody questions it — until someone leaves the company, a laptop is lost, or a chat export ends up somewhere it should not be.',
      'A one-time encrypted link solves the part you can actually control: how long the secret stays readable after it has been delivered.',
    ],
    sections: [
      {
        heading: 'What not to do',
        list: [
          'Email. Mail is stored on at least two servers, archived by default, and often searchable by an admin.',
          'Chat apps. Slack, Teams, WhatsApp and SMS all keep history, and that history gets exported, synced and backed up.',
          'Shared documents. A password in a doc inherits every sharing mistake that doc will ever accumulate.',
          'Splitting it in half across two channels. It feels clever, but both halves still sit in permanent history.',
        ],
      },
      {
        heading: 'A safer routine',
        listOrdered: true,
        list: [
          'Put the password into a one-time link instead of the message itself.',
          'Send the link through your normal channel — it is useless once it has been opened.',
          'For higher-value credentials, add a password to the note and share that separately, by voice.',
          'Ask the recipient to store it in a password manager, not in the chat you just used.',
          'Rotate the credential afterwards if it protects anything important. Sharing a secret is always a good moment to plan its replacement.',
        ],
      },
      {
        heading: 'Why a one-time link helps',
        body: [
          'ShredNote encrypts the password in your browser with AES-256-GCM and stores only the ciphertext. The decryption key travels in the part of the link after the # symbol, which browsers never send to a server — so we hold an encrypted blob we cannot read.',
          'When your recipient opens the link, the note is claimed and erased in a single database operation. Your chat thread is left holding a link that no longer does anything.',
        ],
      },
      {
        heading: 'Use a password manager for anything ongoing',
        body: [
          'This is a delivery mechanism, not storage. If a credential is going to be used repeatedly, it belongs in a shared vault in 1Password, Bitwarden, Keeper or your browser’s built-in manager, where it can be rotated and revoked. ShredNote is for the hand-off.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Is it safe to send a password over Slack or email?',
        answer:
          'Not really. Both retain history indefinitely by default, are backed up, and can be read by administrators or anyone who later gains access to the account. Sending a one-time link means that even if the thread is exposed later, the password is no longer in it.',
      },
      {
        question: 'What if someone intercepts the link before my recipient opens it?',
        answer:
          'They can read the note, and your recipient will find it already opened. That is your signal that something went wrong, and you should rotate the credential. No tool can prevent interception of a link you send over a channel an attacker already controls.',
      },
      {
        question: 'Should I add a password to the note as well?',
        answer:
          'For anything valuable, yes. It means the link alone is not enough. Share the password through a different channel — ideally spoken aloud — so that one compromised channel does not give up both halves.',
      },
    ],
    related: ['one-time-secret', 'share-api-keys-securely', 'encrypted-note'],
  },

  'self-destructing-note': {
    slug: 'self-destructing-note',
    title: 'Self-Destructing Notes, Explained',
    metaDescription:
      'What a self-destructing note actually does, how the destruction is enforced, and when it genuinely protects you — explained without the marketing.',
    eyebrow: 'Explainer',
    h1: 'Self-destructing notes, explained',
    lead: 'The phrase sounds like a gimmick. The mechanism behind it is simple, and worth understanding before you rely on it.',
    intro: [
      'A self-destructing note is a message stored under a single-use address. The first request for it receives the content; the same operation deletes it. Every later request is told it is gone.',
      'The useful property is not drama. It is that the window during which a secret is readable shrinks from "forever" to "until my recipient opens it".',
    ],
    sections: [
      {
        heading: 'What "destroyed" has to mean to be worth anything',
        body: [
          'Hiding a note from the interface is not destruction. For the claim to hold, the stored data has to be erased, and the erase has to be atomic — part of the same operation that delivers the note, not a cleanup job that runs later and might not run at all.',
          'ShredNote claims and blanks a note in one database statement. Two people clicking the same link at the same moment cannot both receive it: the database serialises the update, the first request wins, and the second sees a note that is already consumed.',
        ],
      },
      {
        heading: 'Destruction is not the main protection',
        body: [
          'Even before a note is read, we cannot read it. It is encrypted in your browser and the key is in the link fragment, which never reaches our servers. Self-destruction is the second layer: it limits how long the ciphertext exists at all, and it tells you if someone opened the note before its intended reader.',
          'That signal matters. A recipient who finds a note already opened knows the link leaked, which is information you would never get from an email.',
        ],
      },
      {
        heading: 'What it cannot do',
        list: [
          'It cannot un-read a message. Once the recipient has it, they can screenshot, copy or forward it.',
          'It cannot protect against a compromised device on either end.',
          'It cannot stop someone who obtains the link first from reading the note.',
        ],
      },
      {
        heading: 'When to use one',
        list: [
          'Handing over a password, key or access code exactly once.',
          'Sending anything you would not want sitting in a chat export a year from now.',
          'Sharing something over a channel you do not control, like a client’s email system.',
        ],
      },
    ],
    faqs: [
      {
        question: 'What happens if two people open the link at the same time?',
        answer:
          'Exactly one of them gets the note. The claim is a single atomic database update, so concurrent requests cannot both succeed; the loser sees the same "this note is gone" page as any later visitor.',
      },
      {
        question: 'Can the sender recover a note after it has been read?',
        answer:
          'No. The ciphertext is erased when the note is claimed, and we never had the key. There is no recovery path for anyone, including us — that is the point.',
      },
      {
        question: 'What happens if nobody ever opens the note?',
        answer:
          'It is deleted when it expires. You choose the expiry when you create it, from one hour up to 30 days, and nothing is kept longer than 30 days.',
      },
    ],
    related: ['burn-after-reading-message', 'one-time-message', 'private-note'],
  },

  'one-time-secret': {
    slug: 'one-time-secret',
    title: 'One-Time Secret Links',
    metaDescription:
      'Share a secret through a link that works exactly once. How one-time secret links work, where they fit, and what to check before trusting one.',
    eyebrow: 'Guide',
    h1: 'One-time secret links',
    lead: 'A secret that can be read twice is a secret you no longer control. A one-time link puts a hard limit on it.',
    intro: [
      'A one-time secret is a value — a password, a token, a recovery code — published at an address that stops working the moment it is used. It turns an open-ended exposure into a single, observable event.',
    ],
    sections: [
      {
        heading: 'Where one-time links fit',
        list: [
          'Onboarding: handing a new colleague their first credential before they have a shared vault.',
          'Support: giving a customer a reset code without leaving it in a ticket that stays open for months.',
          'Contractors and clients: sharing access through email systems you do not administer.',
          'Recovery codes and 2FA backup codes, which are worth more than the password they protect.',
        ],
      },
      {
        heading: 'What to check before trusting any one-time secret service',
        list: [
          'Is the encryption done in the browser, or on the server? If the server encrypts, the server can read.',
          'Where does the key live? If it is anywhere in the request — path, query string, header — the operator has it.',
          'Is consumption atomic? A service that reads first and deletes afterwards can deliver the same secret twice under load.',
          'What is logged? A privacy policy that does not mention logs has not thought about them.',
        ],
        body: [
          'ShredNote answers those as follows: encryption happens in your browser; the key is in the URL fragment, which is never transmitted; consumption is a single atomic database statement; and our logging layer only accepts a fixed list of non-identifying fields, so a note body cannot be logged even by mistake.',
        ],
      },
      {
        heading: 'Add a password for high-value secrets',
        body: [
          'An optional password means the link alone is not enough. It is stretched with 600,000 rounds of PBKDF2 in your browser and combined with the link secret — neither half works without the other. After ten wrong guesses the note destroys itself, so the password cannot be worn down by anyone who intercepts the link.',
        ],
      },
    ],
    faqs: [
      {
        question: 'How is this different from an expiring link?',
        answer:
          'An expiring link limits time; a one-time link limits use. ShredNote does both: the note is destroyed when it is read, and also when it expires if it is never opened.',
      },
      {
        question: 'Do I need an account?',
        answer:
          'No. There is no sign-up, no email address and no profile. The basic product will always work without an account.',
      },
      {
        question: 'How long is the link valid if nobody opens it?',
        answer:
          'Up to 30 days by default, and you can shorten it to one hour, 24 hours or 7 days when you create the note.',
      },
    ],
    related: ['send-password-securely', 'secure-message-link', 'self-destructing-note'],
  },

  'burn-after-reading-message': {
    slug: 'burn-after-reading-message',
    title: 'Burn After Reading Messages',
    metaDescription:
      'Send a message that deletes itself the moment it is read. What "burn after reading" really guarantees online, and what it does not.',
    eyebrow: 'Explainer',
    h1: 'Burn after reading, online',
    lead: 'The idea is old. The digital version is only meaningful if the burning is real and the service cannot read the message in the first place.',
    intro: [
      'A burn-after-reading message is delivered once and then destroyed. The appeal is obvious; the important question is what is actually being burned.',
    ],
    sections: [
      {
        heading: 'What gets burned',
        body: [
          'With ShredNote, what is stored is ciphertext: an AES-256-GCM encrypted block your browser produced before anything was sent. When the recipient opens the note, that ciphertext is returned and erased in the same database statement. What burns is the only copy that existed on our side, and it was never readable by us.',
          'That ordering matters. A service that deletes the message after returning it leaves a window; a service that deletes it in the same operation does not.',
        ],
      },
      {
        heading: 'What does not burn',
        list: [
          'The copy in your recipient’s head, screenshot folder or clipboard.',
          'Anything they paste elsewhere afterwards.',
          'The fact that you sent them a link — that is still in your chat history.',
        ],
        body: [
          'Treat "burn after reading" as a limit on your exposure, not a guarantee about the recipient’s behaviour. If you would not tell them, do not send it.',
        ],
      },
      {
        heading: 'Turn on confirmation before revealing',
        body: [
          'ShredNote shows a warning screen before revealing by default, so that a link preview, an over-eager click or a mail scanner does not consume the note. The recipient has to choose "Reveal & Shred". You can turn it off under More options if you want the message to open immediately.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can a link preview bot destroy my note by accident?',
        answer:
          'Not with the default settings. Nothing is consumed until a real browser runs the page and the recipient clicks Reveal & Shred. Previews and crawlers never get that far.',
      },
      {
        question: 'Will the recipient know the note was already read?',
        answer:
          'Yes. They see a page saying it is gone. That is a useful signal that the link was intercepted, and a reason to rotate whatever you shared.',
      },
      {
        question: 'Can I get a read receipt?',
        answer:
          'Not today. The note simply stops working, which tells the sender it was opened if they check the link themselves — though checking it is what would destroy an unread note, so do not.',
      },
    ],
    related: ['self-destructing-note', 'temporary-private-message', 'one-time-message'],
  },

  'temporary-private-message': {
    slug: 'temporary-private-message',
    title: 'Send a Temporary Private Message',
    metaDescription:
      'Send a private message that expires on a schedule and disappears when it is read. Choose an expiry from one hour to 30 days, with no account required.',
    eyebrow: 'Guide',
    h1: 'Send a temporary private message',
    lead: 'Some things only need to be readable for an afternoon. Everything else is just risk you kept for no reason.',
    intro: [
      'A temporary message has two limits: it disappears when it is read, and it disappears on its own if it is not. Choosing a short expiry is the cheapest security decision available to you.',
    ],
    sections: [
      {
        heading: 'Choosing an expiry',
        list: [
          'One hour: for something you are handing over right now, in a call or in person.',
          '24 hours: the practical default for a colleague in another timezone.',
          '7 days: for someone who may be away, or a process that takes a few days.',
          '30 days: the longest we allow, for a link included in onboarding material.',
        ],
        body: [
          'Whichever you choose, the note is still destroyed the moment it is read. Expiry only governs what happens if nobody opens it.',
        ],
      },
      {
        heading: 'Why short beats long',
        body: [
          'An unread note sitting in a database is an exposure with no benefit. Shorter expiry means a smaller window for a leaked link to be useful, and it forces the conversation to happen while it is still current. If a note expires, creating another takes ten seconds.',
        ],
      },
      {
        heading: 'Add a reference label so you know what expired',
        body: [
          'When you send several notes, a short label such as "Staging login" helps you keep track — and is shown to the recipient before they open it. The label is stored unencrypted on purpose, so keep it generic and never put anything private in it.',
        ],
      },
    ],
    faqs: [
      {
        question: 'What is the longest a note can last?',
        answer:
          'Thirty days. Nothing is stored beyond that under any setting, and unread notes are deleted automatically when they expire.',
      },
      {
        question: 'Can I change the expiry after sending?',
        answer:
          'No. A note is fixed once created, and we have no account system through which to edit it. Create a new note with the expiry you want and stop sharing the old link.',
      },
      {
        question: 'Does an expired note tell the recipient it expired?',
        answer:
          'No. Expired, read and never-existed notes all show the same page, so the link cannot be used to learn anything about a note id.',
      },
    ],
    related: ['private-note', 'self-destructing-note', 'secure-message-link'],
  },

  'private-note': {
    slug: 'private-note',
    title: 'Send a Private Note Online',
    metaDescription:
      'Write a private note in your browser, share it with a single link, and have it delete itself after it is read. No account, no tracking on note pages.',
    eyebrow: 'Guide',
    h1: 'Send a private note online',
    lead: 'Private should mean the service hosting it cannot read it — not that it promises not to look.',
    intro: [
      'Plenty of tools will store a note for you privately. The distinction worth caring about is whether "private" is a policy or a property of the design.',
    ],
    sections: [
      {
        heading: 'Policy privacy versus structural privacy',
        body: [
          'Policy privacy means the operator can read your note but says it will not. It depends on their good behaviour, their security, their staff and whoever can legally compel them.',
          'Structural privacy means the operator cannot read it. ShredNote encrypts in your browser and keeps the key in the URL fragment, which browsers never transmit. If we were compelled to hand over everything we hold about a note, we could produce ciphertext and timestamps. Nothing else exists.',
        ],
      },
      {
        heading: 'What a private note is good for',
        list: [
          'Personal information you would rather not leave in a chat thread — an address, an account number, a medical detail.',
          'A message to someone whose inbox you do not trust.',
          'Anything a colleague needs once but nobody needs archived.',
        ],
      },
      {
        heading: 'No tracking where it matters',
        body: [
          'Note creation and note reading pages carry no analytics and no third-party scripts. There is nothing on those pages to record what you wrote, when you read it, or who you are. That is a deliberate line: an analytics script on a page that displays secrets is a bad idea regardless of the vendor’s privacy claims.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can ShredNote staff read my note?',
        answer:
          'No. The note is encrypted before it leaves your browser and the key never reaches us. We hold an encrypted block and no means of decrypting it.',
      },
      {
        question: 'Do I need to install anything?',
        answer:
          'No. It runs in any modern browser using the built-in Web Crypto API. There is no app, no extension and no account.',
      },
      {
        question: 'Is there any tracking?',
        answer:
          'There are no advertising trackers anywhere on the site, and no analytics at all on note creation or note reading pages.',
      },
    ],
    related: ['encrypted-note', 'temporary-private-message', 'one-time-message'],
  },

  'encrypted-note': {
    slug: 'encrypted-note',
    title: 'Encrypted Notes in Your Browser',
    metaDescription:
      'How ShredNote encrypts notes with AES-256-GCM using the Web Crypto API, where the key lives, and why that means the server cannot read your note.',
    eyebrow: 'Technical',
    h1: 'Encrypted notes, in your browser',
    lead: 'If you want to check our claims rather than take them on trust, this is the page that describes what actually happens.',
    intro: [
      'ShredNote uses only primitives your browser already ships. There is no bespoke cryptography, no custom cipher and no third-party crypto library downloaded at runtime.',
    ],
    sections: [
      {
        heading: 'The scheme',
        list: [
          'A 256-bit content key is generated with the browser’s cryptographically secure random number generator.',
          'The message is encrypted with AES-256-GCM using a fresh 96-bit nonce. GCM authenticates as well as encrypts, so tampering is detected rather than silently decrypted.',
          'A 256-bit link secret is generated the same way and encoded into the URL fragment.',
          'HKDF-SHA256 derives a wrapping key from that link secret, and the content key is encrypted under it.',
          'Only the encrypted message, the encrypted content key, the nonces and a salt are uploaded.',
        ],
      },
      {
        heading: 'Why the key is in the fragment',
        body: [
          'Everything after the # in a URL is the fragment. Browsers use it locally — it is not in the request line, not in a header, and not in any server log. Putting the key there is what makes the whole design work: we can store your ciphertext without ever being in a position to read it.',
          'It also means a truncated link is unrecoverable. If a chat app or a link shortener drops the fragment, the note cannot be decrypted by anyone, including us.',
        ],
      },
      {
        heading: 'How a password fits in without weakening anything',
        body: [
          'When you set a password, it is stretched with PBKDF2-HMAC-SHA256 at 600,000 iterations and mixed with the link secret. Both are required to derive the wrapping key.',
          'To check a password before destroying the note, your browser derives a second, separate value from the same material using a different HKDF label, and sends only that. It is computationally independent of the wrapping key, so it cannot decrypt anything, and because it is bound to the link secret, a stolen database would not let anyone guess the password offline.',
        ],
      },
      {
        heading: 'The assumption we cannot remove',
        body: [
          'Browser-based encryption means trusting that the JavaScript served to you is the JavaScript described here. That is true of every in-browser encryption tool, and we would rather say it than imply otherwise. For secrets where that assumption is unacceptable, use an end-to-end encrypted channel you already trust, or hand the secret over in person.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Which encryption algorithm does ShredNote use?',
        answer:
          'AES-256 in GCM mode, via the browser’s Web Crypto API, with keys from the platform CSPRNG. Key derivation uses HKDF-SHA256, and PBKDF2-HMAC-SHA256 at 600,000 iterations when a password is set.',
      },
      {
        question: 'Is the encryption key ever sent to the server?',
        answer:
          'No. It is placed in the URL fragment after the # symbol, which browsers do not transmit. Our API accepts ciphertext fields only, and rejects anything else.',
      },
      {
        question: 'What if my browser does not support Web Crypto?',
        answer:
          'ShredNote tells you plainly instead of silently falling back to something weaker. In practice this only affects very old browsers, or a page served over plain HTTP instead of HTTPS.',
      },
    ],
    related: ['private-note', 'share-api-keys-securely', 'secure-message-link'],
  },

  'secure-message-link': {
    slug: 'secure-message-link',
    title: 'Secure Message Links',
    metaDescription:
      'Send a secure message as a link instead of text. How the link protects the message, how to share it safely, and why the part after the # matters.',
    eyebrow: 'Guide',
    h1: 'Secure message links',
    lead: 'Sending a link instead of the message itself moves the secret out of your chat history and into something you can revoke by using it.',
    intro: [
      'The trick is that the link is not a pointer to a readable message. It is half of the key material: our half is useless without yours.',
    ],
    sections: [
      {
        heading: 'Anatomy of the link',
        body: [
          'A ShredNote link has two parts. Before the #, a random 22-character identifier that tells our server which encrypted blob to fetch. After the #, the decryption key, which never leaves your device.',
          'The identifier carries 128 bits of entropy, which is why guessing note ids is not a practical attack, and why our read endpoints are rate limited anyway.',
        ],
      },
      {
        heading: 'Sharing the link safely',
        list: [
          'Send the whole link. Anything that truncates it makes the note permanently unreadable.',
          'Avoid link shorteners — many discard fragments, and they add a party that sees the URL.',
          'If the channel is untrusted, add a password to the note and share it by voice.',
          'Tell your recipient it only opens once, so they read it somewhere they can copy what they need.',
        ],
      },
      {
        heading: 'What our server sees when the link is used',
        body: [
          'A request for the identifier. Not the fragment, not the message, not the password. The response is ciphertext, and the note is erased as it is sent. Our logs record that a note was consumed, with no identifier attached.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Why does my link break when I paste it somewhere?',
        answer:
          'Something dropped the part after the # symbol. Some chat apps, ticketing systems and link shorteners do this. Paste the full link, and if a tool keeps mangling it, send it as plain text or in a code block.',
      },
      {
        question: 'Can someone guess a note link?',
        answer:
          'Note identifiers are 128-bit random values, so guessing one is not feasible, and read endpoints are rate limited to stop bulk probing. Unknown, expired and already-read ids all return the same response, so probing reveals nothing either way.',
      },
      {
        question: 'Is the link safe to send over email?',
        answer:
          'Safer than the secret itself, because it stops working once used. But anyone who reads that email before your recipient can open the note, so add a password for anything valuable.',
      },
    ],
    related: ['one-time-secret', 'encrypted-note', 'send-password-securely'],
  },

  'one-time-message': {
    slug: 'one-time-message',
    title: 'One-Time Messages',
    metaDescription:
      'Send a message that can be read exactly once. How single-use delivery is enforced, and how it behaves when two people open the same link.',
    eyebrow: 'Explainer',
    h1: 'One-time messages',
    lead: 'Read once, then gone. The interesting part is what "once" means when two people click at the same moment.',
    intro: [
      'A one-time message is only trustworthy if the service can prove that "once" holds under pressure — concurrent requests, retries, flaky networks and duplicate clicks.',
    ],
    sections: [
      {
        heading: 'How single use is enforced',
        body: [
          'The note is claimed with one database statement whose condition includes "not yet consumed". PostgreSQL serialises concurrent updates to the same row, so the first request wins and every other request re-evaluates the condition against the committed row and matches nothing.',
          'The same statement blanks the stored ciphertext and returns the pre-update value, so there is no window in which the note is both delivered and still stored. This is covered by tests that fire forty simultaneous requests at one note and assert that exactly one succeeds.',
        ],
      },
      {
        heading: 'What the second person sees',
        body: [
          'The same page as anyone visiting an expired or non-existent link: "This ShredNote is gone." We do not distinguish between read, expired and never existed, because doing so would let someone probe which note identifiers are real.',
        ],
      },
      {
        heading: 'Protecting against an accidental first read',
        body: [
          'By default the recipient sees a confirmation screen before anything is consumed, so a preview, a scanner or a misclick cannot burn the message. If a wrong password is entered, the note is not consumed either — the check happens first, and only a correct password proceeds.',
        ],
      },
    ],
    faqs: [
      {
        question: 'What if my connection drops while opening the note?',
        answer:
          'If the request reached our server, the note was consumed and the message is lost. This is the honest trade-off of a genuinely single-use system: we would rather lose a message than risk delivering it twice. Open notes on a stable connection.',
      },
      {
        question: 'Can I open my own note to check it worked?',
        answer:
          'You can, but it destroys the note. If you want to verify the flow, create a test note with a throwaway message and open that instead.',
      },
      {
        question: 'Does refreshing the page show the message again?',
        answer:
          'No. Once revealed, the message exists only in that page. A refresh loses it, which is why the page warns you before you leave.',
      },
    ],
    related: ['self-destructing-note', 'burn-after-reading-message', 'one-time-secret'],
  },

  'share-api-keys-securely': {
    slug: 'share-api-keys-securely',
    title: 'How to Share an API Key Securely',
    metaDescription:
      'API keys leak through chat, tickets and commit history. How to hand one to a colleague or contractor safely, and what to do straight afterwards.',
    eyebrow: 'Guide',
    h1: 'How to share an API key securely',
    lead: 'API keys are bearer tokens: whoever holds one is you, as far as the service is concerned. They deserve more care than a password.',
    intro: [
      'Keys leak in boring ways — a Slack message, a support ticket, a screenshot in a bug report, a config file committed by accident. Almost none of those involve an attacker doing anything clever.',
    ],
    sections: [
      {
        heading: 'Before you share it at all',
        list: [
          'Can you issue a scoped key instead? A read-only key for a staging environment is a much smaller problem if it leaks.',
          'Can the recipient generate their own? Shared credentials remove any chance of knowing who did what.',
          'Does it expire? A key with an expiry limits the damage of a leak you never notice.',
        ],
      },
      {
        heading: 'Handing it over',
        listOrdered: true,
        list: [
          'Put the key in a one-time encrypted link rather than the message body.',
          'Add a password to the note and send it through a different channel for production keys.',
          'Set a short expiry — an hour is usually plenty for a live hand-off.',
          'Tell the recipient to move it straight into a secret manager or environment variable, never a committed file.',
          'Note the date. Keys shared by hand should be on your rotation list.',
        ],
      },
      {
        heading: 'Afterwards',
        body: [
          'If the note shows as already opened when your recipient tries it, treat the key as compromised and rotate it. That is exactly the signal a one-time link is designed to give you, and it is worth acting on rather than assuming a glitch.',
          'For keys used on an ongoing basis, get them into your platform’s secret store — AWS Secrets Manager, Vault, Doppler, GitHub Actions secrets — so the next person does not need a hand-off at all.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Is it safe to paste an API key into a ticket or a pull request?',
        answer:
          'No. Tickets and pull requests are archived, indexed and often visible to more people than you expect, and a key in commit history survives deleting the file. Use a one-time link and rotate the key if it has already been posted.',
      },
      {
        question: 'How large a key or config can I send?',
        answer:
          'Notes can hold up to 25,000 characters, which covers keys, certificates and small config blocks comfortably.',
      },
      {
        question: 'Should I share a private key this way?',
        answer:
          'Prefer not to share private keys at all — generate them where they will be used. If you must, add a password to the note, use a short expiry, and rotate on a defined schedule.',
      },
    ],
    related: ['send-password-securely', 'encrypted-note', 'one-time-secret'],
  },
};

export const LANDING_SLUGS = Object.keys(LANDING_PAGES);

export function getLandingContent(slug: string): LandingContent {
  const content = LANDING_PAGES[slug];
  if (!content) {
    throw new Error(`Unknown landing page: ${slug}`);
  }
  return content;
}
