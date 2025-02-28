// Clipboard functionality
// Handles copying text to clipboard with visual feedback

export const clipboardScripts = `
  // Copy text to clipboard with animation feedback
  function copyToClipboard(text, element) {
    // Find the parent .copyable element and the content element
    const copyableContainer = element.closest('.copyable');
    const contentElement = copyableContainer?.querySelector('.copyable-content');
    if (!copyableContainer || !contentElement) return;
    
    navigator.clipboard.writeText(text).then(() => {
      // Add the 'copied' class to the content element for success styling
      contentElement.classList.add('copied');
      
      // Remove the class after a delay (let CSS handle the transitions)
      setTimeout(() => {
        contentElement.classList.remove('copied');
      }, 1500);
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  }
  
  // Initialize copyable elements
  function setupCopyableElements() {
    document.querySelectorAll('.copyable').forEach(container => {
      const contentElement = container.querySelector('.copyable-content');
      const valueElement = container.querySelector('.copyable-value');
      
      if (contentElement && valueElement) {
        const textToCopy = valueElement.getAttribute('data-copy') || valueElement.textContent.trim();
        
        // Add click handler to the entire content area
        contentElement.addEventListener('click', () => {
          copyToClipboard(textToCopy, contentElement);
        });
      }
    });
  }
  
  // Confirmation dialogs for deletion
  function confirmDelete(feedId) {
    if (confirm('Are you sure you want to delete this feed? This action cannot be undone.')) {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/admin/feeds/' + feedId + '/delete';
      document.body.appendChild(form);
      form.submit();
    }
  }
  
  function confirmDeleteEmail(emailKey, feedId) {
    if (confirm('Are you sure you want to delete this email? This action cannot be undone.')) {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/admin/emails/' + emailKey + '/delete?feedId=' + feedId;
      document.body.appendChild(form);
      form.submit();
    }
  }
`; 