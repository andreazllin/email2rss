// Authentication helper functions
// Handles user authentication state

export const authHelpers = `
  // Check if user is authenticated
  function isAuthenticated() {
    // Check localStorage first (client-side)
    if (localStorage.getItem('authenticated') === 'true') {
      return true;
    }
    
    // Check for cookie (server-side auth)
    function getCookie(name) {
      const value = \`; \${document.cookie}\`;
      const parts = value.split(\`; \${name}=\`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    }
    
    return getCookie('admin_auth') === 'true';
  }
  
  // Set authentication state
  function setAuthenticated(value) {
    localStorage.setItem('authenticated', value ? 'true' : 'false');
  }
  
  // Logout function
  function logout() {
    localStorage.removeItem('authenticated');
    // Also clear the cookie by setting expiry in the past
    document.cookie = 'admin_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    window.location.href = '/admin/login';
  }
  
  // Check authentication on page load
  document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (path !== '/admin/login' && !isAuthenticated()) {
      window.location.href = '/admin/login';
    }
  });
`; 