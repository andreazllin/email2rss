import { Hono } from 'hono';
import { html } from 'hono/html';
import { z } from 'zod';
import { Env, FeedConfig, FeedList, FeedMetadata, EmailMetadata, EmailData } from '../types';

// Create a Hono app for admin routes
const app = new Hono();

// Schema for feed creation
const createFeedSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  language: z.string().optional().default('en')
});

// Schema for feed updates
const updateFeedSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  language: z.string().optional().default('en')
});

// Admin dashboard route
app.get('/', async (c) => {
  // Type assertion for environment variables
  const env = c.env as unknown as Env;
  const emailStorage = env.EMAIL_STORAGE;
  
  // List all feeds
  const feedList = await listAllFeeds(emailStorage);
  
  return c.html(
    html`<!DOCTYPE html>
    <html>
      <head>
        <title>Email to RSS Admin</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.5;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
          }
          .header {
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #eaeaea;
          }
          .feed-list {
            list-style: none;
            padding: 0;
          }
          .feed-item {
            padding: 1rem;
            margin-bottom: 1rem;
            border: 1px solid #eaeaea;
            border-radius: 4px;
          }
          .button {
            display: inline-block;
            background-color: #0070f3;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 0.5rem 1rem;
            font-size: 1rem;
            cursor: pointer;
            text-decoration: none;
            margin-right: 0.5rem;
          }
          .button:hover {
            background-color: #0051a8;
          }
          .delete-button {
            background-color: #e00;
          }
          .delete-button:hover {
            background-color: #c00;
          }
          .form-group {
            margin-bottom: 1rem;
          }
          label {
            display: block;
            margin-bottom: 0.5rem;
          }
          input, textarea {
            width: 100%;
            padding: 0.5rem;
            font-size: 1rem;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          .modal-bg {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            justify-content: center;
            align-items: center;
            z-index: 1000;
          }
          .modal {
            background: white;
            padding: 2rem;
            border-radius: 4px;
            max-width: 90%;
            width: 500px;
          }
          .modal-buttons {
            display: flex;
            justify-content: flex-end;
            margin-top: 1rem;
          }
        </style>
        <script>
          function confirmDelete(feedId) {
            if (confirm('Are you sure you want to delete this feed? This action cannot be undone.')) {
              const form = document.createElement('form');
              form.method = 'POST';
              form.action = '/admin/feeds/' + feedId + '/delete';
              document.body.appendChild(form);
              form.submit();
            }
          }
        </script>
      </head>
      <body>
        <div class="header">
          <h1>Email to RSS Admin</h1>
          <p>Manage your email newsletter feeds</p>
        </div>
        
        <h2>Create New Feed</h2>
        <form action="/admin/feeds" method="post">
          <div class="form-group">
            <label for="title">Feed Title</label>
            <input type="text" id="title" name="title" required>
          </div>
          
          <div class="form-group">
            <label for="description">Description</label>
            <textarea id="description" name="description" rows="3"></textarea>
          </div>
          
          <div class="form-group">
            <label for="language">Language</label>
            <input type="text" id="language" name="language" value="en">
          </div>
          
          <button type="submit" class="button">Create Feed</button>
        </form>
        
        <h2>Your Feeds</h2>
        ${feedList.length > 0 ? 
          html`<ul class="feed-list">
            ${feedList.map(feed => html`
              <li class="feed-item">
                <h3>${feed.title}</h3>
                <p>${feed.description || 'No description'}</p>
                <p><strong>Email:</strong> newsletter-${feed.id}@${env.DOMAIN}</p>
                <p><strong>RSS Feed:</strong> https://api.${env.DOMAIN}/rss/${feed.id}</p>
                <p>
                  <a href="/admin/feeds/${feed.id}/edit" class="button">Edit</a>
                  <a href="/admin/feeds/${feed.id}/emails" class="button">View Emails</a>
                  <button onclick="confirmDelete('${feed.id}')" class="button delete-button">Delete</button>
                </p>
              </li>
            `)}
          </ul>` : 
          html`<p>You don't have any feeds yet. Create one above.</p>`
        }
      </body>
    </html>`
  );
});

// Create a new feed
app.post('/feeds', async (c) => {
  // Type assertion for environment variables
  const env = c.env as unknown as Env;
  const emailStorage = env.EMAIL_STORAGE;
  
  try {
    const formData = await c.req.formData();
    const title = formData.get('title')?.toString() || '';
    const description = formData.get('description')?.toString();
    const language = formData.get('language')?.toString() || 'en';
    
    // Validate inputs
    const parsedData = createFeedSchema.parse({
      title,
      description,
      language
    });
    
    // Generate a unique feed ID
    const feedId = generateRandomId();
    
    // Store feed configuration
    const feedConfigKey = `feed:${feedId}:config`;
    await emailStorage.put(feedConfigKey, JSON.stringify({
      title: parsedData.title,
      description: parsedData.description,
      language: parsedData.language,
      site_url: `https://api.${env.DOMAIN}/rss/${feedId}`,
      feed_url: `https://api.${env.DOMAIN}/rss/${feedId}`,
      created_at: Date.now()
    }));
    
    // Create empty metadata for the feed
    const feedMetadataKey = `feed:${feedId}:metadata`;
    await emailStorage.put(feedMetadataKey, JSON.stringify({
      emails: []
    }));
    
    // Add feed to the list of all feeds
    await addFeedToList(emailStorage, feedId, parsedData.title);
    
    // Redirect back to admin page
    return c.redirect('/admin');
  } catch (error) {
    console.error('Error creating feed:', error);
    return c.text('Error creating feed. Please try again.', 400);
  }
});

// Edit feed form
app.get('/feeds/:feedId/edit', async (c) => {
  // Type assertion for environment variables
  const env = c.env as unknown as Env;
  const emailStorage = env.EMAIL_STORAGE;
  const feedId = c.req.param('feedId');
  
  // Get feed configuration
  const feedConfigKey = `feed:${feedId}:config`;
  const feedConfig = await emailStorage.get(feedConfigKey, 'json') as FeedConfig | null;
  
  if (!feedConfig) {
    return c.text('Feed not found', 404);
  }
  
  return c.html(
    html`<!DOCTYPE html>
    <html>
      <head>
        <title>Edit Feed - Email to RSS Admin</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.5;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
          }
          .header {
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #eaeaea;
          }
          .button {
            display: inline-block;
            background-color: #0070f3;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 0.5rem 1rem;
            font-size: 1rem;
            cursor: pointer;
            text-decoration: none;
          }
          .button:hover {
            background-color: #0051a8;
          }
          .form-group {
            margin-bottom: 1rem;
          }
          label {
            display: block;
            margin-bottom: 0.5rem;
          }
          input, textarea {
            width: 100%;
            padding: 0.5rem;
            font-size: 1rem;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Edit Feed</h1>
          <p><a href="/admin">Back to Dashboard</a></p>
        </div>
        
        <form action="/admin/feeds/${feedId}/edit" method="post">
          <div class="form-group">
            <label for="title">Feed Title</label>
            <input type="text" id="title" name="title" value="${feedConfig.title}" required>
          </div>
          
          <div class="form-group">
            <label for="description">Description</label>
            <textarea id="description" name="description" rows="3">${feedConfig.description || ''}</textarea>
          </div>
          
          <div class="form-group">
            <label for="language">Language</label>
            <input type="text" id="language" name="language" value="${feedConfig.language || 'en'}">
          </div>
          
          <button type="submit" class="button">Update Feed</button>
        </form>
      </body>
    </html>`
  );
});

// Update feed
app.post('/feeds/:feedId/edit', async (c) => {
  // Type assertion for environment variables
  const env = c.env as unknown as Env;
  const emailStorage = env.EMAIL_STORAGE;
  const feedId = c.req.param('feedId');
  
  try {
    const formData = await c.req.formData();
    const title = formData.get('title')?.toString() || '';
    const description = formData.get('description')?.toString();
    const language = formData.get('language')?.toString() || 'en';
    
    // Validate inputs
    const parsedData = updateFeedSchema.parse({
      title,
      description,
      language
    });
    
    // Get existing feed config
    const feedConfigKey = `feed:${feedId}:config`;
    const existingConfig = await emailStorage.get(feedConfigKey, 'json') as FeedConfig | null;
    
    if (!existingConfig) {
      return c.text('Feed not found', 404);
    }
    
    // Update feed configuration
    await emailStorage.put(feedConfigKey, JSON.stringify({
      ...existingConfig,
      title: parsedData.title,
      description: parsedData.description,
      language: parsedData.language,
      updated_at: Date.now()
    }));
    
    // Update feed in the list of all feeds
    await updateFeedInList(emailStorage, feedId, parsedData.title);
    
    // Redirect back to admin page
    return c.redirect('/admin');
  } catch (error) {
    console.error('Error updating feed:', error);
    return c.text('Error updating feed. Please try again.', 400);
  }
});

// Delete feed
app.post('/feeds/:feedId/delete', async (c) => {
  // Type assertion for environment variables
  const env = c.env as unknown as Env;
  const emailStorage = env.EMAIL_STORAGE;
  const feedId = c.req.param('feedId');
  
  try {
    // Get feed metadata to find all email keys
    const feedMetadataKey = `feed:${feedId}:metadata`;
    const feedMetadata = await emailStorage.get(feedMetadataKey, 'json') as FeedMetadata | null;
    
    if (!feedMetadata) {
      return c.text('Feed not found', 404);
    }
    
    // Delete all emails for this feed
    for (const email of feedMetadata.emails) {
      await emailStorage.delete(email.key);
    }
    
    // Delete feed configuration and metadata
    await emailStorage.delete(`feed:${feedId}:config`);
    await emailStorage.delete(feedMetadataKey);
    
    // Remove feed from the list of all feeds
    await removeFeedFromList(emailStorage, feedId);
    
    // Redirect back to admin page
    return c.redirect('/admin');
  } catch (error) {
    console.error('Error deleting feed:', error);
    return c.text('Error deleting feed. Please try again.', 400);
  }
});

// View emails for a feed
app.get('/feeds/:feedId/emails', async (c) => {
  // Type assertion for environment variables
  const env = c.env as unknown as Env;
  const emailStorage = env.EMAIL_STORAGE;
  const feedId = c.req.param('feedId');
  
  // Get feed configuration
  const feedConfigKey = `feed:${feedId}:config`;
  const feedConfig = await emailStorage.get(feedConfigKey, 'json') as FeedConfig | null;
  
  if (!feedConfig) {
    return c.text('Feed not found', 404);
  }
  
  // Get feed metadata (list of emails)
  const feedMetadataKey = `feed:${feedId}:metadata`;
  const feedMetadata = (await emailStorage.get(feedMetadataKey, 'json') || { emails: [] }) as FeedMetadata;
  
  return c.html(
    html`<!DOCTYPE html>
    <html>
      <head>
        <title>${feedConfig.title} - Emails</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.5;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
          }
          .header {
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #eaeaea;
          }
          .email-list {
            list-style: none;
            padding: 0;
          }
          .email-item {
            padding: 1rem;
            margin-bottom: 1rem;
            border: 1px solid #eaeaea;
            border-radius: 4px;
          }
          .button {
            display: inline-block;
            background-color: #0070f3;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 0.5rem 1rem;
            font-size: 1rem;
            cursor: pointer;
            text-decoration: none;
          }
          .button:hover {
            background-color: #0051a8;
          }
          .delete-button {
            background-color: #e00;
          }
          .delete-button:hover {
            background-color: #c00;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${feedConfig.title} - Emails</h1>
          <p><a href="/admin">Back to Dashboard</a></p>
        </div>
        
        <div>
          <p><strong>Email Address:</strong> newsletter-${feedId}@${env.DOMAIN}</p>
          <p><strong>RSS Feed:</strong> https://api.${env.DOMAIN}/rss/${feedId}</p>
        </div>
        
        <h2>Emails (${feedMetadata.emails.length})</h2>
        ${feedMetadata.emails.length > 0 ? 
          html`<ul class="email-list">
            ${feedMetadata.emails.map((email: EmailMetadata) => html`
              <li class="email-item">
                <h3>${email.subject}</h3>
                <p>Received: ${new Date(email.receivedAt).toLocaleString()}</p>
                <p>
                  <a href="/admin/emails/${email.key}" class="button">View Content</a>
                  <button onclick="confirmDeleteEmail('${email.key}', '${feedId}')" class="button delete-button">Delete</button>
                </p>
              </li>
            `)}
          </ul>` : 
          html`<p>No emails received yet. Subscribe to newsletters using the email address above.</p>`
        }
        
        <script>
          function confirmDeleteEmail(emailKey, feedId) {
            if (confirm('Are you sure you want to delete this email? This action cannot be undone.')) {
              const form = document.createElement('form');
              form.method = 'POST';
              form.action = '/admin/emails/' + emailKey + '/delete';
              form.innerHTML = '<input type="hidden" name="feedId" value="' + feedId + '">';
              document.body.appendChild(form);
              form.submit();
            }
          }
        </script>
      </body>
    </html>`
  );
});

// View email content
app.get('/emails/:emailKey', async (c) => {
  // Type assertion for environment variables
  const env = c.env as unknown as Env;
  const emailStorage = env.EMAIL_STORAGE;
  const emailKey = c.req.param('emailKey');
  
  // Get email content
  const emailData = await emailStorage.get(emailKey, 'json') as EmailData | null;
  
  if (!emailData) {
    return c.text('Email not found', 404);
  }
  
  // Extract feed ID from the key
  const feedId = emailKey.split(':')[1];
  
  // Create a sanitized HTML content with CSS for the iframe
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.5;
            padding: 0;
            margin: 0;
            color: #333;
          }
          img {
            max-width: 100%;
            height: auto;
          }
          a {
            color: #0070f3;
          }
        </style>
      </head>
      <body>
        ${emailData.content}
      </body>
    </html>
  `;
  
  // Properly encode the HTML content to handle Unicode characters
  const encodedHtmlContent = (() => {
    // Convert the string to UTF-8
    const encoder = new TextEncoder();
    const bytes = encoder.encode(htmlContent);
    // Convert bytes to base64
    return btoa(String.fromCharCode(...new Uint8Array(bytes)));
  })();
  
  return c.html(
    html`<!DOCTYPE html>
    <html>
      <head>
        <title>${emailData.subject}</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.5;
            padding: 1rem;
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #eaeaea;
          }
          .email-content {
            margin-top: 2rem;
            border: 1px solid #eaeaea;
            border-radius: 4px;
            overflow: hidden;
          }
          .email-meta {
            margin-bottom: 1rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #eaeaea;
          }
          .email-iframe {
            width: 100%;
            height: 800px;
            border: none;
          }
          .email-raw {
            padding: 1rem;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .toggle-view {
            margin-top: 1rem;
            display: flex;
            gap: 1rem;
          }
          .toggle-button {
            background-color: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 0.5rem 1rem;
            cursor: pointer;
          }
          .toggle-button.active {
            background-color: #0070f3;
            color: white;
            border-color: #0070f3;
          }
        </style>
        <script>
          function toggleView(view) {
            const renderedView = document.getElementById('rendered-view');
            const rawView = document.getElementById('raw-view');
            const renderedButton = document.getElementById('rendered-button');
            const rawButton = document.getElementById('raw-button');
            
            if (view === 'rendered') {
              renderedView.style.display = 'block';
              rawView.style.display = 'none';
              renderedButton.classList.add('active');
              rawButton.classList.remove('active');
            } else {
              renderedView.style.display = 'none';
              rawView.style.display = 'block';
              rawButton.classList.add('active');
              renderedButton.classList.remove('active');
            }
          }
        </script>
      </head>
      <body>
        <div class="header">
          <h1>${emailData.subject}</h1>
          <p><a href="/admin/feeds/${feedId}/emails">Back to Emails</a></p>
        </div>
        
        <div class="email-meta">
          <p><strong>From:</strong> ${emailData.from}</p>
          <p><strong>Received:</strong> ${new Date(emailData.receivedAt).toLocaleString()}</p>
        </div>
        
        <div class="toggle-view">
          <button id="rendered-button" class="toggle-button active" onclick="toggleView('rendered')">Rendered View</button>
          <button id="raw-button" class="toggle-button" onclick="toggleView('raw')">Raw HTML</button>
        </div>
        
        <div class="email-content">
          <div id="rendered-view">
            <iframe 
              class="email-iframe" 
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" 
              src="data:text/html;base64,${encodedHtmlContent}"
              title="Email Content"
            ></iframe>
          </div>
          
          <div id="raw-view" class="email-raw" style="display: none;">
            ${emailData.content}
          </div>
        </div>
      </body>
    </html>`
  );
});

// Delete an email
app.post('/emails/:emailKey/delete', async (c) => {
  // Type assertion for environment variables
  const env = c.env as unknown as Env;
  const emailStorage = env.EMAIL_STORAGE;
  const emailKey = c.req.param('emailKey');
  
  try {
    // Get the feed ID from form data
    const formData = await c.req.formData();
    const feedId = formData.get('feedId')?.toString() || '';
    
    if (!feedId) {
      return c.text('Missing feed ID', 400);
    }
    
    // Delete the email from KV storage
    await emailStorage.delete(emailKey);
    
    // Remove the email from the feed metadata
    const feedMetadataKey = `feed:${feedId}:metadata`;
    const feedMetadata = (await emailStorage.get(feedMetadataKey, 'json') || { emails: [] }) as FeedMetadata;
    
    // Filter out the deleted email
    feedMetadata.emails = feedMetadata.emails.filter(email => email.key !== emailKey);
    
    // Update the feed metadata
    await emailStorage.put(feedMetadataKey, JSON.stringify(feedMetadata));
    
    // Redirect back to the emails list
    return c.redirect(`/admin/feeds/${feedId}/emails`);
  } catch (error) {
    console.error('Error deleting email:', error);
    return c.text('Error deleting email. Please try again.', 400);
  }
});

// Helper function to generate a random feed ID
function generateRandomId(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper function to list all feeds
async function listAllFeeds(emailStorage: KVNamespace): Promise<any[]> {
  try {
    const feedListKey = 'feeds:list';
    const feedList = await emailStorage.get(feedListKey, 'json') as FeedList | null || { feeds: [] };
    
    // Fetch detailed information for each feed
    const feeds = [];
    for (const feed of feedList.feeds) {
      const feedConfigKey = `feed:${feed.id}:config`;
      const feedConfig = await emailStorage.get(feedConfigKey, 'json') as FeedConfig | null;
      
      if (feedConfig) {
        feeds.push({
          id: feed.id,
          title: feedConfig.title,
          description: feedConfig.description
        });
      }
    }
    
    return feeds;
  } catch (error) {
    console.error('Error listing feeds:', error);
    return [];
  }
}

// Helper function to add a feed to the list of all feeds
async function addFeedToList(emailStorage: KVNamespace, feedId: string, title: string): Promise<void> {
  const feedListKey = 'feeds:list';
  const feedList = await emailStorage.get(feedListKey, 'json') as FeedList | null || { feeds: [] };
  
  feedList.feeds.push({
    id: feedId,
    title
  });
  
  await emailStorage.put(feedListKey, JSON.stringify(feedList));
}

// Helper function to update a feed in the list of all feeds
async function updateFeedInList(emailStorage: KVNamespace, feedId: string, title: string): Promise<void> {
  const feedListKey = 'feeds:list';
  const feedList = await emailStorage.get(feedListKey, 'json') as FeedList | null || { feeds: [] };
  
  const feedIndex = feedList.feeds.findIndex((feed) => feed.id === feedId);
  
  if (feedIndex >= 0) {
    feedList.feeds[feedIndex].title = title;
    await emailStorage.put(feedListKey, JSON.stringify(feedList));
  }
}

// Helper function to remove a feed from the list of all feeds
async function removeFeedFromList(emailStorage: KVNamespace, feedId: string): Promise<void> {
  const feedListKey = 'feeds:list';
  const feedList = await emailStorage.get(feedListKey, 'json') as FeedList | null || { feeds: [] };
  
  feedList.feeds = feedList.feeds.filter((feed) => feed.id !== feedId);
  
  await emailStorage.put(feedListKey, JSON.stringify(feedList));
}

// Export the Hono app
export const handle = app; 