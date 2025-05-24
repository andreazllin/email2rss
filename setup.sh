#!/bin/bash

# Email to RSS setup script

echo "🚀 Setting up Email to RSS service..."

# Check if npm and npx are installed
if ! command -v npm &> /dev/null || ! command -v npx &> /dev/null; then
  echo "❌ Error: npm and npx are required but not found."
  echo "Please install Node.js from https://nodejs.org/en/download/"
  exit 1
fi

# Check if wrangler-example.toml exists early
if [ ! -f "wrangler-example.toml" ]; then
  echo "❌ Error: wrangler-example.toml not found."
  exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install &> /dev/null

# Check if user is logged in to Cloudflare
echo "🔒 Checking Cloudflare authentication..."
if npx wrangler whoami | grep -q "You are not authenticated"; then
  echo "❌ You are not logged in to Cloudflare. Please run:"
  echo "🔥 \`npx wrangler login\`"
  echo "⚠️ After login completes, run this setup script again."
  exit 1
fi
echo "✅ Cloudflare authentication verified"

# Function to get KV namespace IDs
get_kv_namespace_ids() {
  echo "🔍 Retrieving KV namespace IDs..."

  # Get the complete KV namespace list
  local output
  output=$(npx wrangler kv namespace list 2>/dev/null)

  if [ -z "$output" ]; then
    echo "❌ Error listing KV namespaces. Please check your Cloudflare authentication."
    return 1
  fi

  # Try the direct approach first (most reliable)
  MAIN_ID=$(echo "$output" | grep -o '"id": *"[^"]*"' | head -1 | cut -d'"' -f4)
  PREVIEW_ID=$(echo "$output" | grep -o '"id": *"[^"]*"' | head -2 | tail -1 | cut -d'"' -f4)

  # If the direct approach failed, try to match by namespace title
  if [ -z "$MAIN_ID" ] || [ -z "$PREVIEW_ID" ]; then
    # Save the output to a file for more complex processing
    local temp_file
    temp_file=$(mktemp)
    echo "$output" > "$temp_file"

    # Try with different patterns
    if [ -z "$MAIN_ID" ]; then
      MAIN_ID=$(grep -A3 "email-to-rss-EMAIL_STORAGE\"" "$temp_file" | grep -o '"id": "[^"]*"' | head -1 | cut -d'"' -f4)
      if [ -z "$MAIN_ID" ]; then
        MAIN_ID=$(grep -A3 "email-to-rss-EMAIL_STORAGE\"" "$temp_file" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
      fi
    fi

    if [ -z "$PREVIEW_ID" ]; then
      PREVIEW_ID=$(grep -A3 "email-to-rss-EMAIL_STORAGE_preview\"" "$temp_file" | grep -o '"id": "[^"]*"' | head -1 | cut -d'"' -f4)
      if [ -z "$PREVIEW_ID" ]; then
        PREVIEW_ID=$(grep -A3 "email-to-rss-EMAIL_STORAGE_preview\"" "$temp_file" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
      fi
    fi

    # Clean up
    rm -f "$temp_file"
  fi

  # Check if we found both IDs
  if [ -z "$MAIN_ID" ] || [ -z "$PREVIEW_ID" ]; then
    echo "❌ Failed to extract KV namespace IDs. Please run manually:"
    echo "npx wrangler kv:namespace list"
    echo "And update the IDs in wrangler.toml"
    return 1
  fi

  return 0
}

# Create KV namespaces (suppressing output)
echo "🗄️ Creating KV namespaces..."
npx wrangler kv namespace create EMAIL_STORAGE > /dev/null 2>&1 || true
npx wrangler kv namespace create EMAIL_STORAGE --preview > /dev/null 2>&1 || true

# Get KV namespace IDs
if ! get_kv_namespace_ids; then
  echo "⚠️ Will continue without KV namespace IDs"
  KV_ID=""
  KV_PREVIEW_ID=""
else
  KV_ID="$MAIN_ID"
  KV_PREVIEW_ID="$PREVIEW_ID"
fi

# Summarize KV namespace status
echo "📊 KV Namespace Status:"
if [ -z "$KV_ID" ]; then
  echo "  ❌ Main KV namespace ID: Not found"
  SETUP_SUCCESS=false
else
  echo "  ✅ Main KV namespace ID: $KV_ID"
  SETUP_SUCCESS=true
fi

if [ -z "$KV_PREVIEW_ID" ]; then
  echo "  ❌ Preview KV namespace ID: Not found"
  SETUP_SUCCESS=false
else
  echo "  ✅ Preview KV namespace ID: $KV_PREVIEW_ID"
fi

# Set up admin password
echo "🔐 Setting up admin password..."
read -r -p "Enter admin password: " admin_password

echo "Setting admin password for production environment..."
# Initialize SETUP_SUCCESS if not already set
if [ -z "$SETUP_SUCCESS" ]; then
  SETUP_SUCCESS=true
fi

# Try to set the secret without redirecting stderr to see any errors
if [ -z "$admin_password" ]; then
  echo "⚠️ No admin password provided. Skipping secret creation."
else
  # Run the command and capture its output
  SECRET_OUTPUT=$(echo "$admin_password" | npx wrangler secret put ADMIN_PASSWORD --env production --name email-to-rss 2>&1)
  SECRET_STATUS=$?

  if [ $SECRET_STATUS -ne 0 ]; then
    echo "⚠️ Failed to set admin password for production environment"
    echo "Error: $SECRET_OUTPUT"
    SETUP_SUCCESS=false
  else
    echo "✅ Admin password set for production environment"
  fi
fi

# Prompt for domain
read -r -p "Enter your domain (e.g., yourdomain.com): " domain
if [ -z "$domain" ]; then
  echo "❌ No domain provided. Cannot continue."
  SETUP_SUCCESS=false
else
  echo "✅ Domain: $domain"
fi

# Create and update wrangler.toml only if everything is successful
if [ "$SETUP_SUCCESS" = false ]; then
  echo "⚠️ Some parts of the setup failed. Will not create wrangler.toml."
  echo "Please fix the issues and run the script again."
  exit 1
fi

# Create and configure wrangler.toml
echo "📝 Creating and configuring wrangler.toml..."
cp wrangler-example.toml wrangler.toml

# Update wrangler.toml with domain and KV IDs
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS requires empty string for -i
  sed -i '' "s/REPLACE_WITH_YOUR_DOMAIN/$domain/g" wrangler.toml
  if [ -n "$KV_ID" ]; then
    sed -i '' "s/REPLACE_WITH_YOUR_KV_NAMESPACE_ID/$KV_ID/g" wrangler.toml
  fi
  if [ -n "$KV_PREVIEW_ID" ]; then
    sed -i '' "s/REPLACE_WITH_YOUR_PREVIEW_KV_NAMESPACE_ID/$KV_PREVIEW_ID/g" wrangler.toml
  fi
else
  # Linux and others
  sed -i "s/REPLACE_WITH_YOUR_DOMAIN/$domain/g" wrangler.toml
  if [ -n "$KV_ID" ]; then
    sed -i "s/REPLACE_WITH_YOUR_KV_NAMESPACE_ID/$KV_ID/g" wrangler.toml
  fi
  if [ -n "$KV_PREVIEW_ID" ]; then
    sed -i "s/REPLACE_WITH_YOUR_PREVIEW_KV_NAMESPACE_ID/$KV_PREVIEW_ID/g" wrangler.toml
  fi
fi

echo "✅ wrangler.toml has been created and configured successfully!"
echo ""
echo "✅ Setup complete! Next steps:"
echo "1. Set up MX records for your domain with ForwardEmail.net (see README for more details)"
echo "2. Deploy with 'npm run deploy'"