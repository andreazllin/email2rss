# Email-to-RSS

A modern service that turns email newsletters into RSS feeds, built with Cloudflare Workers. This service provides unique email addresses per feed, a front-end admin panel, and long-term storage of newsletters.

## Features

- **Minimal Dependencies**: Built using modern, web-friendly libraries without Node.js-specific dependencies
- **Lightweight**: Entire worker bundle is only ~360KB (gzipped: ~65KB)
- **Email Processing**: Handles emails from ForwardEmail.net webhook
- **RSS Generation**: Serves standards-compliant RSS feeds
- **Admin Interface**: Simple management UI for feeds and emails
- **Storage**: Uses Cloudflare KV for efficient, low-cost storage

## Architecture

### Email Flow
1. A newsletter arrives at `newsletter-XYZ@yourdomain.com`
2. ForwardEmail.net forwards it to your Cloudflare Worker
3. The Worker parses the email, extracts content, and stores it in KV
4. The RSS feed is updated with the new content

### Key Components

- **Email Parser**: Lightweight custom parser that works in edge environments
- **Feed Generator**: Modern RSS feed generator with minimal dependencies
- **Admin UI**: Simple interface to manage feeds and view emails

## Development

This project uses a modern build process with Wrangler's built-in bundling (powered by esbuild):

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

## Environment Variables

- `ADMIN_PASSWORD`: Password for the admin interface
- `DOMAIN`: Your custom domain for receiving emails
- `FORWARDEMAIL_TOKEN`: Token for ForwardEmail.net webhook authentication

## Technology Stack

- **Cloudflare Workers**: Edge computing platform
- **Cloudflare KV**: Key-value storage
- **Hono**: Lightweight web framework
- **TypeScript**: Type-safe JavaScript
- **Feed**: Modern RSS feed generator
- **Zod**: Schema validation

## Setup

1. Clone this repository
2. Install dependencies with `npm install`
3. Copy `wrangler.toml.example` to `wrangler.toml` and set your values
4. Run `npm run dev` to start the development server
5. Deploy with `npm run deploy`

## Minimalist Approach

This project follows a minimalist approach:

- No unnecessary dependencies
- Web-standard APIs where possible
- No Node.js-specific modules or polyfills
- Modern TypeScript features
- Clean, maintainable code structure

## License

MIT
