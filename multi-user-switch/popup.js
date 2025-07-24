const welcomeMessages = [
  "Your credentials are stored securely on your machine.",
  "No data is sent anywhere - everything stays local.",
  "Ideal for development and testing environments.",
  "Fast, private, and stored only in your browser.",
  "Your login info is safe and never leaves your device."
];


const modal = document.getElementById('url-modal');
const urlInput = document.getElementById('url-input');
const cancelModalBtn = document.getElementById('cancel-modal');
const submitUrlBtn = document.getElementById('submit-url');
const addWebsiteBtn = document.getElementById('add-website');
const urlModal = document.getElementById('url-modal');

const selectedWebsiteEl = document.getElementById('selected-website');
const dropdownListEl = document.getElementById('dropdown-list');
const mfaCheckbox = document.getElementById('otp-required');

// Show modal on button click
addWebsiteBtn.addEventListener('click', () => {
  urlInput.value = '';
  modal.classList.remove('hidden');
  setTimeout(() => urlInput.focus(), 100); // Optional: focus input
});

// Hide modal on cancel
cancelModalBtn.addEventListener('click', () => {
  modal.classList.add('hidden');
});



document.addEventListener('DOMContentLoaded', function () {
  const userList = document.getElementById('user-list');
  const newUsername = document.getElementById('new-username');
  const newPassword = document.getElementById('new-password');
  const addUserBtn = document.getElementById('add-user');
  const status = document.getElementById('status');

  // Show random welcome message
  const randomWelcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
  updateStatus(randomWelcome, 'info');

  mfaCheckbox.addEventListener('change', function () {
    const website = selectedWebsiteEl.getAttribute('data-value');
    if (!website) {
      updateStatus('Please select a website first', 'error');
      this.checked = false; // Revert if no website selected
      return;
    }

    chrome.storage.sync.get(['mfaFlags'], function (result) {
      const mfaFlags = result.mfaFlags || {};
      mfaFlags[website] = mfaCheckbox.checked;

      chrome.storage.sync.set({ mfaFlags }, function () {
        updateStatus(`Multi-factor authentication ${mfaCheckbox.checked ? 'Enabled' : 'Disabled'}`, 'success');
      });
    });
  });

  // Add website from modal
  submitUrlBtn.addEventListener('click', () => {
    let website = urlInput.value.trim();

    if (!website) {
      updateStatus('Please enter a valid URL', 'error');
      return;
    }
    // Add protocol if missing
    if (!/^https?:\/\//i.test(website)) {
      website = 'https://' + website;
    }

    try {
      const parsedUrl = new URL(website);
      const hasFullHost = !!parsedUrl.hostname;
      const path = parsedUrl.pathname;
      const hasNonRootPath = path && path !== '/' && path.split('/').filter(Boolean).length > 0;

      if (!hasFullHost || !hasNonRootPath) {
        updateStatus('Incorrect URL. Example: https://example.com/login', 'error');
        return;
      }
    } catch {
      updateStatus('Incorrect URL. Example: https://example.com/login', 'error');
      return;
    }

    chrome.storage.sync.get(['websites', 'mfaFlags'], function (result) {
      const websites = result.websites || {};
      const mfaFlags = result.mfaFlags || {};
      if (!websites[website]) {
        websites[website] = [];
        mfaFlags[website] = false;
        chrome.storage.sync.set({ websites, mfaFlags }, function () {
          updateWebsiteDropdown(websites);
          selectWebsite(website, websites); // ✅ Auto-select in dropdown
          updateStatus(`Website ${website} added`, 'success');
          urlModal.classList.add('hidden');
          urlInput.value = '';
        });
      } else {
        updateStatus('Website already exists', 'error');
      }
    });
  });

  // Save the last selected website
  function saveLastSelectedWebsite(website) {
    chrome.storage.sync.set({ lastSelectedWebsite: website });
  }

  // Load saved data
  chrome.storage.sync.get(['websites', 'lastSelectedWebsite'], function (result) {
    const websites = result.websites || {};
    updateWebsiteDropdown(websites);

    if (result.lastSelectedWebsite && websites[result.lastSelectedWebsite]) {
      selectedWebsiteEl.textContent = result.lastSelectedWebsite;
      selectedWebsiteEl.setAttribute('data-value', result.lastSelectedWebsite);
      renderUserList(result.lastSelectedWebsite, websites[result.lastSelectedWebsite]);

      // Load MFA flag
      chrome.storage.sync.get(['mfaFlags'], (flagResult) => {
        const mfaFlags = flagResult.mfaFlags || {};
        mfaCheckbox.checked = !!mfaFlags[result.lastSelectedWebsite];
      });
    }

  });

  // Add user
  addUserBtn.addEventListener('click', function () {
    const website = selectedWebsiteEl.getAttribute('data-value');
    const username = newUsername.value.trim();
    const password = newPassword.value.trim();

    if (!website) {
      updateStatus('Please select a website first', 'error');
      return;
    }

    if (!username || !password) {
      updateStatus('Username and password are required', 'error');
      return;
    }

    chrome.storage.sync.get(['websites'], function (result) {
      const websites = result.websites || {};
      if (!websites[website]) {
        websites[website] = [];
      }

      // Check if user already exists
      if (websites[website].some(u => u.username === username)) {
        updateStatus('User already exists', 'error');
        return;
      }

      websites[website].push({ username, password });
      chrome.storage.sync.set({ websites }, function () {
        renderUserList(website, websites[website]);
        newUsername.value = '';
        newPassword.value = '';
        updateStatus(`User ${username} added`, 'success');
      });
    });
  });

  // Helper functions
  function updateWebsiteDropdown(websites) {
    dropdownListEl.innerHTML = '';
    const websiteKeys = Object.keys(websites).sort();

    websiteKeys.forEach((website) => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';

      const label = document.createElement('span');
      label.textContent = website;
      label.style.flex = '1';
      label.onclick = () => {
        selectedWebsiteEl.textContent = website;
        selectedWebsiteEl.setAttribute('data-value', website);
        dropdownListEl.style.display = 'none';
        saveLastSelectedWebsite(website);
        renderUserList(website, websites[website]);
      };

      const deleteBtn = document.createElement('span');
      deleteBtn.className = 'dropdown-delete';
      deleteBtn.innerHTML = 'x';
      deleteBtn.title = 'Delete website';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (true) {
          delete websites[website];
          chrome.storage.sync.set({ websites }, () => {
            if (selectedWebsiteEl.getAttribute('data-value') === website) {
              selectedWebsiteEl.textContent = 'Select website...';
              selectedWebsiteEl.removeAttribute('data-value');
              userList.innerHTML = '';
            }
            updateWebsiteDropdown(websites);
            updateStatus(`Website ${website} deleted`, 'success');
          });
        }
      };

      item.appendChild(label);
      item.appendChild(deleteBtn);
      dropdownListEl.appendChild(item);
    });
  }

  selectedWebsiteEl.addEventListener('click', () => {
    dropdownListEl.style.display =
      dropdownListEl.style.display === 'block' ? 'none' : 'block';
  });

  // Hide dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-dropdown')) {
      dropdownListEl.style.display = 'none';
    }
  });


  // All users list
  function renderUserList(website, users) {
    userList.innerHTML = '';

    if (users.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'status info';
      emptyState.textContent = 'No users saved for this website';
      userList.appendChild(emptyState);
      return;
    }

    users.forEach(user => {
      const row = document.createElement('div');
      row.className = 'user-row';

      // Username input
      const usernameInput = document.createElement('input');
      usernameInput.type = 'text';
      usernameInput.value = user.username;
      usernameInput.disabled = true;
      usernameInput.title = user.username;

      // Password input
      const passwordInput = document.createElement('input');
      passwordInput.type = 'password';
      passwordInput.value = '••••••••'; // Always show masked
      passwordInput.disabled = true;
      passwordInput.title = 'Password stored (click Login to use)';

      // Login button
      const loginBtn = document.createElement('button');
      loginBtn.className = 'login';
      loginBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="margin-right:4px"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>Login';

      // Login action
      loginBtn.addEventListener('click', () => simulateLogin(website, user));

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete';
      deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      deleteBtn.title = 'Delete user';
      deleteBtn.addEventListener('click', () => deleteUser(website, user.username));

      row.appendChild(usernameInput);
      row.appendChild(passwordInput);
      row.appendChild(loginBtn);
      row.appendChild(deleteBtn);
      userList.appendChild(row);
    });
  }

  function deleteUser(website, username) {
    chrome.storage.sync.get(['websites'], function (result) {
      const websites = result.websites || {};
      if (websites[website]) {
        websites[website] = websites[website].filter(u => u.username !== username);
        chrome.storage.sync.set({ websites }, function () {
          renderUserList(website, websites[website]);
          updateStatus(`User ${username} deleted`, 'success');
        });
      }
    });
  }

  function simulateLogin(website, username) {
    console.log(website, username);
    updateStatus(`Authenticating as ${username.username}...`, 'info');

    // Send message to background script
    chrome.runtime.sendMessage({
      action: 'switchUser',
      website: website,
      user: username
    }, (response) => {
      // Handle response from background script
      if (response && response.success) {
        updateStatus(`Success! Logged in as ${username.username}`, 'success');
      } else {
        updateStatus(`Failed to login as ${username.username} - Error : ${response.error || 'Unknown'}`, 'error');
      }
    });
  }


  function updateStatus(message, type = 'info') {
    status.textContent = message;
    status.className = 'status ' + type;
  }

  function selectWebsite(website, websites) {
    selectedWebsiteEl.textContent = website;
    selectedWebsiteEl.setAttribute('data-value', website);
    dropdownListEl.style.display = 'none';
    saveLastSelectedWebsite(website);
    renderUserList(website, websites[website]);

    // Load MFA flag if available
    chrome.storage.sync.get(['mfaFlags'], (flagResult) => {
      const mfaFlags = flagResult.mfaFlags || {};
      mfaCheckbox.checked = !!mfaFlags[website];
    });
  }

});

