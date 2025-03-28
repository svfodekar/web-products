document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('input');
    const output = document.getElementById('output');
    const errorMessage = document.getElementById('error-message');
    const errorLineDisplay = document.getElementById('error-line-display');
    const errorContext = document.getElementById('error-context');
    const formatBtn = document.getElementById('format-btn');
    const rawBtn = document.getElementById('raw-btn');
    const copyBtn = document.getElementById('copy-btn');
    const keySearch = document.getElementById('key-search');
    const pathResults = document.getElementById('path-results');

    let originalJson = '';
    let formattedJson = '';

    // Initialize with raw view visible
    input.classList.remove('hidden');
    output.classList.add('hidden');

    formatBtn.addEventListener('click', formatJson);
    rawBtn.addEventListener('click', toggleRaw);
    copyBtn.addEventListener('click', copyJson);


    async function formatJson() {
        try {
            originalJson = input.value;
            const jsonObj = JSON.parse(originalJson);
            formattedJson = JSON.stringify(jsonObj, null, 2);
            output.innerHTML = formatJsonToHtml(jsonObj, 0);

            // Show formatted output and hide input
            output.classList.remove('hidden');
            input.classList.add('hidden');

            // Hide any previous errors
            errorMessage.classList.add('hidden');
            errorLineDisplay.classList.add('hidden');
            errorContext.classList.add('hidden');

            setupCollapsibleListeners();
        } catch (e) {
            // Show error but keep the raw input visible
            formattedJson = '';
          // await  showPreciseJsonError(originalJson, e)
          showError(e)
            input.classList.remove('hidden');
            output.classList.add('hidden');
        }
    }

    function showError(error) {
        try {
            // Extract position from error message
            let errorPos = 0;
            const posMatch = error.message.match(/position (\d+)/);
            if (posMatch) {
                errorPos = parseInt(posMatch[1]);
            }

            // Get error context (20 chars before and after)
            let contextStart = Math.max(0, errorPos - 40);
            let contextEnd = Math.min(originalJson.length, errorPos + 40);
            let context = originalJson.substring(contextStart, contextEnd);

            // Calculate positions for highlighting
            let highlightPos = errorPos - contextStart;
            let beforeHighlight = escapeHtml(context.substring(0, highlightPos));
            let highlightChar = escapeHtml(context.substring(highlightPos, highlightPos + 1));
            let afterHighlight = escapeHtml(context.substring(highlightPos + 1));

            // Build the context display
            errorContext.innerHTML = `
                <div>Error area --> ${beforeHighlight}<span class="error-pointer">${highlightChar}</span>${afterHighlight}</div>

                <div style="color: green;">Detailed Error: ${error.message} 

                Possible Causes:
                1. Missing or extra comma
                2. Unquoted key
                3. Incorrect bracket/brace placement
                4. Trailing comma
                5. Unescaped special characters </div>
            `;
            errorContext.classList.remove('hidden');



            // Also show line-based error if available
            const lineColMatch = error.message.match(/line (\d+) column (\d+)/);
            if (lineColMatch) {
                const errorLine = parseInt(lineColMatch[1]) - 1;
                const errorCol = parseInt(lineColMatch[2]) - 1;
                const lines = originalJson.split('\n');
                const errorLineText = lines[errorLine] || '';
                const errorIndicator = ' '.repeat(errorCol);

                // errorLineDisplay.innerHTML = `
                //     <div class="error-line">${escapeHtml(errorLineText)}</div>
                   
                // `;
                // errorLineDisplay.classList.remove('hidden');
            }

            // errorMessage.textContent = `Error: ${error.message}`;
            // errorMessage.classList.remove('hidden');

        } catch (e) {
            // Fallback error display
            errorMessage.textContent = `Error: ${error.message}`;
            errorMessage.classList.remove('hidden');
            errorLineDisplay.classList.add('hidden');
            errorContext.classList.add('hidden');
        }
    }

    function formatJsonToHtml(obj, indent) {
        if (obj === null) return '<span class="null">null</span>';
        if (typeof obj === 'boolean') return `<span class="boolean">${obj}</span>`;
        if (typeof obj === 'number') return `<span class="number">${obj}</span>`;
        if (typeof obj === 'string') return `<span class="string">"${escapeHtml(obj)}"</span>`;

        if (Array.isArray(obj)) {
            if (obj.length === 0) return '[]';
            let html = '[<span class="collapsible">-</span><div style="display:inline">';
            obj.forEach((item, i) => {
                html += '\n' + '  '.repeat(indent + 1) + formatJsonToHtml(item, indent + 1);
                if (i < obj.length - 1) html += ',';
            });
            return html + '\n' + '  '.repeat(indent) + ']</div>';
        }

        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0) return '{}';
            let html = '{<span class="collapsible">-</span><div style="display:inline">';
            keys.forEach((key, i) => {
                html += '\n' + '  '.repeat(indent + 1) + `<span class="key">"${escapeHtml(key)}"</span>: ` +
                    formatJsonToHtml(obj[key], indent + 1);
                if (i < keys.length - 1) html += ',';
            });
            return html + '\n' + '  '.repeat(indent) + '}</div>';
        }

        return '';
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function setupCollapsibleListeners() {
        document.querySelectorAll('.collapsible').forEach(btn => {
            btn.addEventListener('click', function () {
                const content = this.nextElementSibling;
                if (this.textContent === '-') {
                    this.textContent = '+';
                    content.style.display = 'none';
                } else {
                    this.textContent = '-';
                    content.style.display = 'inline';
                }
            });
        });
    }

    function showPreciseJsonError(originalJson, error) {
        // Reset error displays
        errorMessage.innerHTML = '';
        errorLineDisplay.innerHTML = '';
        errorContext.innerHTML = '';
    
        // Parse error details
        const errorDetails = {
            message: error.message,
            line: 1,
            column: 1,
            position: 0
        };
    
        // Extract line and column information
        const lineColumnMatch = error.message.match(/line (\d+) column (\d+)/);
        const positionMatch = error.message.match(/at position (\d+)/);
    
        if (lineColumnMatch) {
            errorDetails.line = parseInt(lineColumnMatch[1]);
            errorDetails.column = parseInt(lineColumnMatch[2]);
        }
    
        if (positionMatch) {
            errorDetails.position = parseInt(positionMatch[1]);
        }
    
        // Split JSON into lines
        const jsonLines = originalJson.split('\n');
        const problemLine = jsonLines[errorDetails.line - 1] || '';
    
        // Create visual error pointer
        const errorPointer = ' '.repeat(errorDetails.column - 1) + '^';
    
        // Construct detailed error message
        const fullErrorMessage = `

    JSON Syntax Error
    ----------------------------------------------------------------
    Location: Line ${errorDetails.line}, Column ${errorDetails.column}
    
    Problematic Line:
    ${problemLine}
    ${errorPointer}
    
    Detailed Error: ${error.message}
    
    Possible Causes:
    1. Missing or extra comma
    2. Unquoted key
    3. Incorrect bracket/brace placement
    4. Trailing comma
    5. Unescaped special characters
        `;
    
        // Display error in UI
        errorMessage.innerHTML = `
            <div class="error" style="color: black;">
                <pre>${fullErrorMessage}</pre>
            </div>
        `;
    
        errorMessage.classList.remove('hidden');
       // showToast('Invalid JSON Syntax', 'error', 4000);
    }

    function toggleRaw() {
        if (input.classList.contains('hidden')) {
            input.value = originalJson;
            formattedJson = '';
            input.classList.remove('hidden');
            output.classList.add('hidden');
            errorMessage.classList.add('hidden');
            errorLineDisplay.classList.add('hidden');
            errorContext.classList.add('hidden');
        } else {
            // Do nothing when already in raw view
        }
    }

    function copyJson() {
        const textToCopy = output.classList.contains('hidden') ?
            originalJson : formattedJson;

        navigator.clipboard.writeText(textToCopy)
            .then(() => showToast('Above text Copied to clipboard!', 'success'))
            .catch(() => showToast('Failed to copy Json', 'error'));
    }

    // Remove search button related code and add input event listener
    keySearch.addEventListener('input', function () {
        const searchTerm = this.value.trim().toLowerCase();

        // Only search if at least 2 characters entered (adjust as needed)
        if (searchTerm.length >= 2) {
            findKeyPaths();
            // After adding items to DOM:
            equalizePathWidths()
        }
        else if (pathResults) {
            pathResults.classList.add('hidden');
        }
    });

    // Also trigger search on Enter key
    keySearch.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            const searchTerm = keySearch.value.trim().toLowerCase();
            if (searchTerm) {
                findKeyPaths();
                equalizePathWidths();
            }
        }
    });

    input.addEventListener('input', function () {
        originalJson = this.value;

    })

    // Function to make all path items same width
    function equalizePathWidths() {
        const items = document.querySelectorAll('.path-item');
        if (items.length === 0) return;

        // Reset widths first to get accurate measurements
        items.forEach(item => item.style.width = 'auto');

        // Find maximum width
        let maxWidth = 0;
        items.forEach(item => {
            maxWidth = Math.max(maxWidth, item.scrollWidth);
        });

        // Apply to all items
        items.forEach(item => {
            item.style.width = `${maxWidth}px`;
        });

        // Ensure results are visible
        pathResults.classList.remove('hidden');
    }

    // Debounce function to prevent excessive searches while typing
    function debounce(func, timeout = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => { func.apply(this, args); }, timeout);
        };
    }
    function findKeyPaths() {
        try {
            const searchTerm = keySearch.value.trim().toLowerCase();
            if (!searchTerm) return;

            const jsonObj = JSON.parse(originalJson);
            const paths = [];

            if (Array.isArray(jsonObj)) {
                // Handle root array
                jsonObj.forEach((item, index) => {
                    findPaths(item, `[${index}]`, paths, searchTerm, true);
                });
            } else {
                // Handle root object
                findPaths(jsonObj, '', paths, searchTerm, false);
            }

            displayPathResults(paths);
        } catch (e) {
            showToast('Please format valid JSON first');

        }
    }

    function findPaths(obj, currentPath, paths, searchTerm, isArrayElement) {
        if (typeof obj !== 'object' || obj === null) return;

        Object.keys(obj).forEach(key => {
            // Build the path segment
            let newPath;
            if (isArrayElement) {
                // Inside an array - use dot notation after brackets
                newPath = `${currentPath}.${key}`;
            } else if (currentPath === '') {
                // Root level property
                newPath = key;
            } else {
                // Nested property
                newPath = `${currentPath}.${key}`;
            }

            // Check if key matches search term
            if (key.toLowerCase().includes(searchTerm)) {
                paths.push(newPath);
            }

            // Handle arrays
            if (Array.isArray(obj[key])) {
                if (obj[key].length > 0) {
                    // Check if all elements have this key
                    const allHaveKey = obj[key].every(item => typeof item === 'object' && item !== null && item.hasOwnProperty(searchTerm)
                    );

                    if (allHaveKey) {
                        // Only add the wildcard version
                        paths.push(`${newPath}[*].${searchTerm}`);
                    } else {
                        // Add specific indices
                        obj[key].forEach((item, index) => {
                            findPaths(item, `${newPath}[${index}]`, paths, searchTerm, true);
                        });
                    }
                }
            }
            // Handle regular objects
            else if (typeof obj[key] === 'object' && obj[key] !== null) {
                findPaths(obj[key], newPath, paths, searchTerm, false);
            }
        });
    }

    function displayPathResults(paths) {
        pathResults.innerHTML = '';

        if (paths.length === 0) {
            pathResults.innerHTML = '<div class="path-item">No matching keys found</div>';
            return;
        }

        const uniquePaths = [...new Set(paths)].sort();

        uniquePaths.forEach(path => {
            const item = document.createElement('div');
            item.className = 'path-item';

            // Parse and colorize the path with alternating colors
            let htmlPath = '';
            const parts = path.split(/(\[|\]|\.)/).filter(Boolean);
            let keyColorIndex = 0;

            parts.forEach((part, i) => {
                if (part === '[' || part === ']') {
                    htmlPath += `<span class="bracket">${part}</span>`;
                }
                else if (part === '.') {
                    htmlPath += `<span class="dot">${part}</span>`;
                }
                else if (part === '*') {
                    htmlPath += `<span class="wildcard">${part}</span>`;
                }
                else if (/^\d+$/.test(part)) {
                    htmlPath += `<span class="index">${part}</span>`;
                }
                else {
                    // Alternate between 4 colors for keys
                    keyColorIndex = (keyColorIndex % 4) + 1;
                    const isRoot = i === 0 && !path.startsWith('[');
                    htmlPath += isRoot
                        ? `<span class="root">${part}</span>`
                        : `<span class="key-${keyColorIndex}">${part}</span>`;
                }
            });

            item.innerHTML = htmlPath;

            // Enhanced copy functionality
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(path).then(() => {
                    const originalBg = item.style.backgroundColor;
                    item.style.backgroundColor = '#d1e7dd';
                    item.innerHTML = 'Copied!';
                    showToast('Path copied to clipboard!', 'success')
                    setTimeout(() => {
                        item.style.backgroundColor = originalBg;
                        item.innerHTML = htmlPath;
                    }, 1000);
                }).catch(err => {
                    console.error('Failed to copy:', err);
                });
            });

            pathResults.appendChild(item);
        });

        pathResults.classList.remove('hidden');
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            pathResults.classList.add('hidden');
        }
    });


    // Close path results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            pathResults.classList.add('hidden');
        }
    });
// Initialize toast container
function initToastContainer() {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Show animated toast notification
 * @param {string} message - Notification text
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration - Display duration in ms (0 = persistent)
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = initToastContainer();
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Add progress bar if duration is set
    if (duration > 0) {
        toast.innerHTML = `
            ${message}
            <button class="toast-close" aria-label="Close">&times;</button>
            <div class="toast-progress">
                <div class="toast-progress-bar"></div>
            </div>
        `;
    } else {
        toast.innerHTML = `
            ${message}
            <button class="toast-close" aria-label="Close">&times;</button>
        `;
    }
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
        
        // Animate progress bar
        if (duration > 0) {
            const progressBar = toast.querySelector('.toast-progress-bar');
            progressBar.style.transform = 'scaleX(0)';
            progressBar.style.transition = `transform ${duration}ms linear`;
            setTimeout(() => progressBar.style.transform = 'scaleX(1)', 10);
        }
    }, 10);
    
    // Close button handler
    toast.querySelector('.toast-close').addEventListener('click', () => {
        hideToast(toast);
    });
    
    // Auto-hide after duration
    if (duration > 0) {
        setTimeout(() => {
            hideToast(toast);
        }, duration);
    }
    
    return {
        close: () => hideToast(toast)
    };
}

function hideToast(toast) {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => {
        toast.remove();
    }, 400);
}
});


