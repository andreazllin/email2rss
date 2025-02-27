import { Hono } from 'hono';
import { handle as handleInbound } from './routes/inbound';
import { handle as handleRSS } from './routes/rss';
import { handle as handleAdmin } from './routes/admin';
import { Context, Next } from 'hono';
import { Env } from './types';

// Define allowed origins for CORS
const ALLOWED_ORIGINS = ['https://getmynews.app', 'https://api.getmynews.app'];

// Create the main Hono app
const app = new Hono();

// CORS middleware
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.header('Access-Control-Max-Age', '86400');
  }
  
  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }
  
  await next();
});

// Create auth middleware function
const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    c.header('WWW-Authenticate', 'Basic realm="Admin Area"');
    return c.text('Unauthorized', 401);
  }
  
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = atob(base64Credentials);
  const [username, password] = credentials.split(':');
  
  // Check against environment variable
  const env = c.env as unknown as Env;
  const adminPassword = env.ADMIN_PASSWORD;
  
  if (username !== 'admin' || password !== adminPassword) {
    c.header('WWW-Authenticate', 'Basic realm="Admin Area"');
    return c.text('Unauthorized', 401);
  }
  
  await next();
};

// Apply auth middleware to admin routes
app.use('/admin/*', authMiddleware);

// Also apply auth middleware to root path
app.use('/', authMiddleware);

// Route handlers
app.post('/api/inbound', handleInbound);
app.get('/rss/:feedId', handleRSS);
app.route('/admin', handleAdmin);

// Root path uses admin handler
app.route('/', handleAdmin);

// Catch-all for 404s
app.all('*', (c) => c.text('Not Found', 404));

// Export the worker handler
export default app; 