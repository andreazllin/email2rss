#!/bin/bash

# Email to RSS setup script

echo "🚀 Setting up Email to RSS service..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create KV namespaces
echo "🗄️ Creating KV namespaces..."
echo "You'll need to update wrangler.toml with these IDs."
npx wrangler kv:namespace create EMAIL_STORAGE
npx wrangler kv:namespace create EMAIL_STORAGE --preview

# Set up admin password
echo "🔐 Setting up admin password..."
read -p "Enter admin password: " admin_password
echo "$admin_password" | npx wrangler secret put ADMIN_PASSWORD

# Prompt for domain
read -p "Enter your domain (e.g., yourdomain.com): " domain
echo "📝 Please update your domain in wrangler.toml"

echo "✅ Setup complete! Next steps:"
echo "1. Update wrangler.toml with your KV namespace IDs and domain"
echo "2. Set up MX records for your domain with ForwardEmail.net"
echo "3. Deploy with 'npm run deploy'" 