import { Context } from 'hono';
import { EmailParser } from '../utils/email-parser';
import { Env, FeedMetadata } from '../types';

// Interface for ForwardEmail.net webhook payload
interface ForwardEmailPayload {
  recipients?: string[];
  from?: {
    value?: Array<{address?: string; name?: string}>;
    text?: string;
    html?: string;
  };
  subject?: string; 
  text?: string;
  html?: string;
  date?: string;
  messageId?: string;
  headerLines?: Array<{key: string; line: string}>;
  headers?: string;
  raw?: string;
  attachments?: Array<any>;
}

/**
 * Handle incoming emails from ForwardEmail.net webhook
 */
export async function handle(c: Context): Promise<Response> {
  try {
    // Type assertion for environment variables
    const env = c.env as unknown as Env;
    
    // Parse the incoming JSON payload
    const payload: ForwardEmailPayload = await c.req.json();
    
    // Log basic information about the incoming email
    console.log("Received email:", {
      to: payload.recipients?.[0],
      from: payload.from?.text || 'Unknown',
      subject: payload.subject,
      contentType: payload.html ? 'HTML' : 'Text'
    });
    
    // Extract feed ID from email address (e.g., apple.mountain.42@domain.com -> apple.mountain.42)
    const toAddress = payload.recipients?.[0] || '';
    const feedId = EmailParser.extractFeedId(toAddress);
    
    if (!feedId) {
      console.error(`Invalid email address format: ${toAddress}`);
      return new Response('Invalid email address format', { status: 400 });
    }
    
    // Check if the feed exists by looking up the feed configuration
    const feedConfigKey = `feed:${feedId}:config`;
    const feedConfig = await env.EMAIL_STORAGE.get(feedConfigKey, 'json');
    
    if (!feedConfig) {
      console.error(`Feed with ID ${feedId} does not exist or has been deleted`);
      return new Response('Feed does not exist', { status: 404 });
    }
    
    // Parse the email using our simplified parser
    const emailData = EmailParser.parseForwardEmailPayload(payload);
    
    // Generate a unique key for this email in KV storage
    const emailKey = `feed:${feedId}:${Date.now()}`;
    
    // Store the email data in KV
    await env.EMAIL_STORAGE.put(emailKey, JSON.stringify(emailData));
    
    // Get existing feed metadata
    const feedMetadataKey = `feed:${feedId}:metadata`;
    const feedMetadata = (await env.EMAIL_STORAGE.get(feedMetadataKey, 'json') || { emails: [] }) as FeedMetadata;
    
    // Add this email to the feed metadata
    feedMetadata.emails.unshift({
      key: emailKey,
      subject: emailData.subject,
      receivedAt: emailData.receivedAt
    });
    
    // Store updated feed metadata
    await env.EMAIL_STORAGE.put(feedMetadataKey, JSON.stringify(feedMetadata));
    
    console.log(`Successfully processed email for feed ${feedId}`);
    return new Response('Email processed successfully', { status: 200 });
  } catch (error) {
    console.error('Error processing email:', error);
    return new Response('Error processing email', { status: 500 });
  }
} 