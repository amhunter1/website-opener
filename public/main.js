// DOM Elements
const form = document.getElementById('opener-form');
const card = document.querySelector('.card');
const urlsEl = document.getElementById('urls');
const countEl = document.getElementById('count');
const modeEl = document.getElementById('mode');
const clearBtn = document.getElementById('clear');
const btnOpen = document.querySelector('.btn.primary');

// Browser preference storage (using variables to avoid localStorage issues)
let browserPreference = 'default';

function getBrowserPreference() {
    try {
        return localStorage.getItem('preferred_browser') || 'default';
    } catch {
        return browserPreference;
    }
}

function setBrowserPreference(value) {
    browserPreference = value;
    try {
        localStorage.setItem('preferred_browser', value);
    } catch {
        // Ignore storage errors
    }
}

// URL processing
function normalizeUrl(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    
    try {
        const hasProtocol = /^(https?:)?\/\//i.test(trimmed);
        const url = new URL(hasProtocol ? trimmed : `https://${trimmed}`);
        return url.toString();
    } catch (_) {
        return '';
    }
}

function validateUrls(urls) {
    const validUrls = [];
    
    for (const url of urls) {
        const normalized = normalizeUrl(url);
        if (normalized) {
            validUrls.push(normalized);
        }
    }
    
    return validUrls;
}

// URL opening function
function openUrlsClientOnly(urls, times, mode) {
    const features = mode === 'incognito' ? 'noopener,noreferrer' : 'noopener';
    let opened = 0;
    let blocked = 0;

    for (let i = 0; i < times; i++) {
        for (const url of urls) {
            try {
                const win = window.open(url, '_blank', features);
                if (win) {
                    opened++;
                } else {
                    blocked++;
                }
            } catch (error) {
                blocked++;
                console.warn('Failed to open:', url, error);
            }
        }
        
        if (i < times - 1 && times > 1) {
            setTimeout(() => {}, 50);
        }
    }

    return { opened, blocked };
}

function setButtonLoading(loading) {
    const btnText = btnOpen.querySelector('.btn-text');
    const btnLoading = btnOpen.querySelector('.btn-loading');
    
    if (loading) {
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';
        btnOpen.disabled = true;
    } else {
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
        btnOpen.disabled = false;
    }
}

// Simple notification function
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#7b7ff7'};
        color: white;
        border-radius: 12px;
        font-weight: 600;
        font-size: 14px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        z-index: 9999;
        animation: slideIn 0.3s ease;
        max-width: 350px;
    `;
    notification.textContent = message;
    
    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { opacity: 0; transform: translateX(100%); }
            to { opacity: 1; transform: translateX(0); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 4000);
    
    // Add slide-out animation
    const slideOutStyle = document.createElement('style');
    slideOutStyle.textContent = `
        @keyframes slideOut {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(100%); }
        }
    `;
    document.head.appendChild(slideOutStyle);
}

// Form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const lines = urlsEl.value.split('\n').map(line => line.trim()).filter(Boolean);
    const times = Math.max(1, Math.min(20, parseInt(countEl.value || '1', 10)));
    const mode = modeEl.value;

    if (lines.length === 0) {
        showNotification('Please enter at least one valid URL.', 'error');
        return;
    }

    const validUrls = validateUrls(lines);
    
    if (validUrls.length === 0) {
        showNotification('No valid URLs found. Please check your input.', 'error');
        return;
    }

    if (validUrls.length !== lines.length) {
        showNotification(`Found ${validUrls.length} valid URLs out of ${lines.length} total.`, 'info');
    }

    if (card) {
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
    }

    setButtonLoading(true);
    
    try {
        const preferred = getBrowserPreference();
        
        if (preferred === 'client') {
            // Client-only opening
            const result = openUrlsClientOnly(validUrls, times, mode);
            
            if (result.blocked > 0) {
                showNotification(
                    `Opened ${result.opened} tabs, ${result.blocked} were blocked. Please allow pop-ups for this site.`,
                    'error'
                );
            } else {
                showNotification(`Successfully opened ${result.opened} tabs!`, 'success');
            }
        } else {
            try {
                const response = await fetch('/api/open', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        urls: validUrls, 
                        count: times, 
                        mode, 
                        browser: preferred 
                    })
                });

                if (!response.ok) {
                    throw new Error(`Server error: ${response.status}`);
                }

                const data = await response.json();
                showNotification(`Successfully opened ${validUrls.length * times} tabs via server!`, 'success');
                
            } catch (serverError) {
                console.warn('Server method failed, trying client method:', serverError);
                
                // Fallback to client-side opening
                const result = openUrlsClientOnly(validUrls, times, mode);
                
                if (result.blocked > 0) {
                    showNotification(
                        `Opened ${result.opened} tabs, ${result.blocked} were blocked. Server unavailable, using browser method.`,
                        'error'
                    );
                } else {
                    showNotification(`Successfully opened ${result.opened} tabs! (Server unavailable, used browser method)`, 'success');
                }
            }
        }
    } finally {
        setButtonLoading(false);
        setTimeout(() => {
            if (card) {
                card.classList.remove('shake');
            }
        }, 500);
    }
});

// Clear button
clearBtn.addEventListener('click', () => {
    urlsEl.value = '';
    urlsEl.focus();
    showNotification('URLs cleared', 'info');
});

// Browser settings panel
function createSettingsPanel() {
    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    
    const label = document.createElement('span');
    label.className = 'settings-label';
    label.textContent = 'Browser Method:';
    
    const select = document.createElement('select');
    select.className = 'select';
    select.innerHTML = `
        <option value="default">Default Browser</option>
        <option value="chrome">Google Chrome</option>
        <option value="edge">Microsoft Edge</option>
        <option value="firefox">Mozilla Firefox</option>
        <option value="client">Client Only (Browser)</option>
    `;
    
    select.value = getBrowserPreference();
    select.addEventListener('change', () => {
        setBrowserPreference(select.value);
        showNotification('Browser preference saved', 'success');
    });
    
    panel.appendChild(label);
    panel.appendChild(select);
    document.body.appendChild(panel);
    
    return panel;
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        form.dispatchEvent(new Event('submit'));
    }
    
    // Ctrl/Cmd + K to clear
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        clearBtn.click();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    createSettingsPanel();
    
    if (urlsEl) {
        urlsEl.focus();
    }
    countEl.max = '20';
    countEl.min = '1';
    
    // Welcome notification
    setTimeout(() => {
        showNotification('Website Opener ready! Enter your URLs and click "Open URLs"', 'info');
    }, 1000);

});
