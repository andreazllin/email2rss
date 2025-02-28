# Email-to-RSS

A modern service that turns email newsletters into RSS feeds, built with Cloudflare Workers and ForwardEmail.net. This service provides unique email addresses per feed, a front-end admin panel, and long-term storage of newsletters.

## Why Email to RSS?

I love consolidating my newsletters into a centralized reading app like [Reeder](https://reederapp.com). They make for a better reading experience and prevents my email inbox from getting clogged with newsletters. However, Reeder requires RSS support and many email newsletters don't support native RSS feeds.

There are some free services online that do the same thing (e.g. [kill-the-newsletter.com](kill-the-newsletter.com)), but there are several downsides to this approach:

- **No long-term retention**: old RSS posts are deleted to save space.
- **Risk of blocklisting**: being forced to use the same domain (@kill-the-newsletter.com) as everyone else increases the likelihood that an email newsletter can blocklist you from signing up.
- **Self-hosting is non-trivial**: Kill The Newsletter is also [open source](https://github.com/leafac/kill-the-newsletter), but the self-hosting steps seem neither straightforward nor does it focus on exclusively leveraging free services.

On the other hand, while Email-to-RSS isn't necessarily a one-click-deploy solution, it works just as well, is customized to your domain, and is completely free (except for the custom domain itself)!

## Features

- **Autogenerate Custom Emails**: Creates custom email addresses in the format `noun1.noun2.XY@yourdomain.com` for each feed
- **ForwardEmail.net Integration**: Processes incoming emails via webhook with robust IP verification
- **Minimalist Email Parser**: Custom-built lightweight parser that works efficiently in edge environments
- **RSS Feed Generation**: Serves standards-compliant RSS feeds using the modern Feed library
- **Admin Dashboard**: Complete web UI for managing feeds and viewing emails
- **Secure Authentication**: Password-protected admin interface
- **Cloudflare KV Storage**: Efficient, low-cost storage solution for feed data
- **Minimal Dependencies**: Built using modern, web-friendly libraries
- **Lightweight**: Entire worker bundle is optimized for edge deployment
- **Deletion Support**: Email content can be removed from feeds in the admin UI, with automatic cache updates

## Setup

1. Buy your custom domain. You can buy it directly from Cloudflare for convenience. If purchased elsewhere, add the domain to your Cloudflare account to manage the DNS there.
2. Clone this repository.
3. Open your command line in the cloned repo folder and run: `bash setup.sh` – this will install dependencies and set up the Cloudflare Worker/KV with your admin password.
4. Set up your ForwardEmail.net account and configure it to forward to Cloudflare (replace `yourdomain.com` with your custom domain):

   1. Sign up for a free account using any email (doesn't necessarily have to be the one used for the newsletter).
   2. Add your custom domain.
   3. To verify your domain, add the following DNS records to your Cloudflare DNS configuration:

      | Type | Name | Content                                            | TTL  | Proxy Status | Notes                                    |
      | ---- | ---- | -------------------------------------------------- | ---- | ------------ | ---------------------------------------- |
      | MX   | @    | mx1.forwardemail.net                               | Auto | DNS only     | Set Priority to 10.                      |
      | MX   | @    | mx2.forwardemail.net                               | Auto | DNS only     | Set Priority to 10.                      |
      | TXT  | @    | "forward-email=https://yourdomain.com/api/inbound" | Auto | DNS only     | This forwards your emails to the webhook |
      | TXT  | @    | "v=spf1 include:spf.forwardemail.net -all"         | Auto | DNS only     | Email security                           |

5. Deploy with `npm run deploy`.
6. Go to yourdomain.com to open up the admin panel and log in!

Tip: If you're unsure about any of these steps, ask ChatGPT or Cursor to guide you through them.

## Architecture

### Email Flow

1. A newsletter email arrives at `apple.mountain.42@yourdomain.com` (feed ID format: noun1.noun2.XY).
2. ForwardEmail.net forwards it to your Cloudflare Worker endpoint via webhook.
3. The Worker validates the request is from ForwardEmail.net based on IP address.
4. The email is parsed, content extracted, and stored in Cloudflare KV.
5. Feed metadata is updated to include the new email.
6. The RSS feed endpoint dynamically generates the feed from stored emails.

### Key Components

- **Email Parser**: Extracts content from ForwardEmail.net webhook payload
- **Feed Generator**: Creates standard-compliant RSS feeds from stored emails
- **Admin UI**: Interface for creating, viewing, and managing feeds
- **ID Generator**: Creates memorable, collision-resistant feed IDs using common nouns
- **Security Layer**: Validates webhook requests against ForwardEmail.net IP addresses
- **Storage Manager**: Organized module for storing and retrieving data from KV

### Code Structure

- `src/routes/`: API and UI route handlers for inbound emails, RSS feeds, and admin panel
- `src/utils/`: Utility functions including email parsing, feed generation, and ID creation
- `src/data/`: Data files including the nouns list used in ID generation
- `src/types/`: TypeScript type definitions
- `src/scripts/`: Client-side JavaScript for the admin interface
- `src/styles/`: CSS styling for the admin interface
- `src/index.ts`: Main application entry point with middleware and routing configuration

## Development

This project uses a modern build process with Cloudflare Wrangler's built-in bundling (powered by `esbuild`):

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare
npm run deploy
```

## Technology Stack

- **Cloudflare Workers**: Edge computing platform for running the service
- **Cloudflare KV**: Key-value storage for email and feed data
- **Hono**: Lightweight web framework for routing and middleware
- **TypeScript**: Type-safe JavaScript for reliable code
- **Feed**: Modern RSS feed generator
- **Zod**: Schema validation for input data

## Minimalist Approach

This project follows a minimalist approach:

- No unnecessary dependencies
- Web-standard APIs where possible
- No Node.js-specific modules or polyfills
- Modern TypeScript features
- Clean, maintainable code structure
- Modular organization for improved maintainability

## Feed ID System

The system generates memorable, user-friendly feed IDs in the format `noun1.noun2.XY` where:

- `noun1` and `noun2` are randomly selected from a curated list of ~450 common, neutral nouns
- `XY` is a random two-digit number between 10 and 99

This is inspired by iCloud's Hide My Email feature.

This format provides:

- Easy to read and share email addresses
- Low collision probability (can handle thousands of feeds)
- Simple to remember for users
- ~20 million possible combinations

### Noun Selection

The noun list has been carefully curated to:

- Include only common, everyday objects and concepts
- Exclude any potentially problematic terms
- Ensure appropriate combinations when nouns are randomly paired
- Maintain a professional appearance for all generated feed IDs

## License

MIT
