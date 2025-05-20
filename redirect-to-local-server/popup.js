// DOM Elements
const enableToggle = document.querySelector('.enable-toggle');
const redirectWrapper = document.getElementById('redirectWrapper');
const formButton = document.getElementById('toggleButton');
const addRedirectButton = document.getElementById('addRedirect');
const fromUrlInput = document.getElementById('fromUrl');
const toUrlInput = document.getElementById('toUrl');
const methodSelect = document.getElementById('methodSelect');
const redirectList = document.getElementById('redirectList');
const reSyncRedirects = document.getElementById('disableAllBtn');
const status = document.getElementById('status');
const loading = document.getElementById('loading');
const searchInput = document.getElementById('searchInput');

// Step 1: Extract extensionId from the URL
const urlParams = new URLSearchParams(window.location.search);
const extensionId = urlParams.get('extension_id'); // Get the extensionId from the URL parameter
const downloadLink = "https://chromewebstore.google.com/detail/redirect-to-local-server/mcckhgbpcjcfdmnmbahhoakjlnmmjjgo"; // 
const extensionMessage = `Extension ID is missing from the URL. Please close and reopen the extension to resolve this issue.\n\nIf you have not downloaded it yet, download Chrome Extension "Redirect to Local Server".`;
const TipHtmlString = `<p>🛠️ 🔄 After adding a new <strong>DOMAIN</strong> or <strong>LONG BREAK</strong>, turn <strong>OFF</strong> the extension & <strong>REFRESH</strong> your Web App to sync with the extension 😊</p>`;
const UpdateMessageString = `<p>🛠️ <strong>Update available !</strong> Fixed bugs and improved UI for better performance <a href="https://chromewebstore.google.com/detail/redirect-to-local-server/mcckhgbpcjcfdmnmbahhoakjlnmmjjgo" target="_blank">click to update</a> 😊</p>`;

!extensionId && showExtensionErrorModal();

extensionId && createPopup(TipHtmlString, 15000);



// Redirects Data
let localRedirects = [];
let updatingRuleId = null;
let search = '';


// Get the search 
searchInput.addEventListener('input', () => {
  search = searchInput.value.toLowerCase().trim();
  refreshPage('search');
});

// Toggle Redirect Form Visibility
formButton.addEventListener('click', () => {
  redirectWrapper.classList.toggle('visible');
  // Update the button text based on visibility
  formButton.textContent = redirectWrapper.classList.contains('visible') ? '−' : '+';
  // if (formButton.textContent !== '+') {
  //   // If the wrapper is visible, calculate and set the height of #redirectList
  //   const wrapperHeight = redirectWrapper.clientHeight; // Get the height of the wrapper
  //   const parentHeight = redirectWrapper.parentElement.clientHeight; // Get the height of the parent container
  //   const remainingHeight = parentHeight + wrapperHeight +10; // Calculate remaining height

  //   redirectList.style.height = `${remainingHeight}px`; // Set the height of #redirectList
  // } else {
  //   // If the wrapper is hidden, reset the height of #redirectList to 100%
  //   redirectList.style.height = '100%';
  // }
  if (formButton.textContent !== '-') {
    fromUrlInput.value = '';
    toUrlInput.value = '';
    methodSelect.value = 'GET';
    updatingRuleId = null;
    addRedirectButton.textContent = 'ADD REDIRECT';
  }
});

function updateMainToggle(status) {
  const mainToggle = document.getElementById('main-toggle');
  const switchText = mainToggle.parentElement.querySelector('.switch-text');
  mainToggle.checked = status == 'ON' ? true : false;
  // mainToggle.checked && showToast('The extension is now in listening mode !', 3000, 'succinfoess');
  switchText.textContent = status || 'OFF';
}

// Render Redirect List
async function renderRedirectList(redirects) {
  const redirectList = document.getElementById('redirectList');
  redirectList.innerHTML = ''; // Clear existing list
  redirects.forEach((redirect) => {
    const method = redirect.method || 'GET'; // Default to GET if method is undefined
    const methodClass = `method-${method.toLowerCase()}`; // Generate class for method badge
    const enableBtnColorBk = redirect.enabled ?  'background: linear-gradient(50deg, #2196F3, #134a88);' : 'background: transparent;';

    const enableBtnColor = redirect.enabled ?  '#edf0f4' :'007bff';

    // Create list item
    const li = document.createElement('li');
    li.className = 'redirect-item';
    li.innerHTML = `
          <div class="redirect-item-content">
              <div class="redirect-details">
                  <strong style="font-size: 15px;" >From:</strong>
                  <span class="small-input">${redirect.from}</span>
                  <br>
                  <strong style="font-size: 15px;">To&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</strong>
                  <span class="small-input">${redirect.to}</span>
              </div>
              <div class="action-container">
              <span class="method-badge ${methodClass}">${method}</span>
              <button class="enable-btn" data-rule-id="${redirect.redirectRuleId}" data-enabled="${redirect.enabled}" style="${enableBtnColorBk}; color: ${enableBtnColor};">${redirect.enabled ? 'Enable' :  'Enable' }</button>
                  <button class="edit-btn" data-rule-id="${redirect.redirectRuleId}">Edit</button>
                  <button class="delete-btn" data-rule-id="${redirect.redirectRuleId}">Delete</button>
              </div>
          </div>
          <hr>
      `;

    // Append the list item to the redirect list
    redirectList.appendChild(li);

    // Add event listeners for toggle, edit, and delete buttons
    const checkbox = li.querySelector('.enable-btn');

    checkbox.addEventListener('click', (event) => {
      const ruleId = event.target.getAttribute('data-rule-id');
      const isEnabled = event.target.getAttribute('data-enabled') === 'true';
      const newState = !isEnabled;
      event.target.textContent = newState ? 'Enable' : 'Enable';
      event.target.setAttribute('data-enabled', newState);
      handleEnableToggle(ruleId, newState);
    });

    const editButton = li.querySelector('.edit-btn');
    const deleteButton = li.querySelector('.delete-btn');

    editButton.addEventListener('click', () => {
      const ruleId = editButton.getAttribute('data-rule-id');
      editRedirect(ruleId); // Pass ruleId to the edit function
    });

    deleteButton.addEventListener('click', () => {
      const ruleId = deleteButton.getAttribute('data-rule-id');
      deleteRedirect(ruleId); // Pass ruleId to the delete function
    });

  });
}

// Edit Redirect
function editRedirect(ruleId) {

  updatingRuleId = ruleId;
  // Step 1: Find the redirect rule by ruleId
  const redirect = localRedirects.find((r) => r.redirectRuleId == ruleId);

  if (!redirect) {
    //alert("The redirect rule could not be found in the cache. Please refresh the page and try again.");
    showToast('The redirect rule could not be found in the cache. Please refresh the page and try again.', 6000, 'error');
    return;
  }
  // Step 2: Populate the form fields with the redirect data
  fromUrlInput.value = redirect.from;
  toUrlInput.value = redirect.to;
  methodSelect.value = redirect.method;

  // Step 4: Update the "Add Redirect" button to act as an "Update Redirect" button
  addRedirectButton.textContent = 'UPDATE REDIRECT';
  addRedirectButton.dataset.ruleId = ruleId; // Store the ruleId in the button for later use

  // Step 5: Show the form if it's hidden
  redirectWrapper.classList.add('visible');
  formButton.textContent = '−';
}

// Delete Redirect
function deleteRedirect(ruleId) {
  chrome.runtime.sendMessage(extensionId, { action: 'DeleteRedirect', ruleId }, (res) => {
    refreshPage();
    showToast('The redirect rule has been successfully deleted.', 3000, 'success');
  });
}

// Toggle Redirect Enable/Disable
function handleEnableToggle(ruleId, status) {
  chrome.runtime.sendMessage(extensionId, { action: 'EnableDisableRedirect', ruleId, status }, (res) => {
    refreshPage('search');
  });
}


// Load Saved Redirects and Extension State
async function refreshPage(source) {
  //!extensionId && alert(extensionMessage);

  // Step 2: Send a message to the extension to get all data
  chrome.runtime.sendMessage(extensionId, { action: 'GetAllData', search }, async (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error communicating with extension:', chrome.runtime.lastError.message);
      return;
    }
    // Step 3: Render the redirect list with the received data
    const redirects = response?.redirects || [];
    await renderRedirectList(redirects);
    setEqualWidth()
    setHrWidths();
    updateMainToggle(response?.onOff?.[0]);
    //reset local values
    if (source != 'search') {
      addRedirectButton.textContent = 'ADD REDIRECT';
      updatingRuleId = null;
      localRedirects = redirects;
    }
  });
}

//ReSyncRedirects actions
reSyncRedirects.addEventListener('click', () => {
  chrome.runtime.sendMessage(extensionId, { action: 'ReSyncRedirects' }, async (res) => {
    await refreshPage('search');
    showToast('All redirect rules have been successfully re-synced.', 3000, 'success');
  });
});

// Add Redirect
addRedirectButton.addEventListener('click', async () => {

  if (false == await validations()) {
    return;
  }

  const fromUrl = fromUrlInput.value.trim();
  const toUrl = toUrlInput.value.trim();
  const method = methodSelect.value;
  const ruleId = localRedirects.find(r => r.redirectRuleId == updatingRuleId) ? updatingRuleId : null;

  chrome.runtime.sendMessage(extensionId, { action: 'AddRedirect', fromUrl, toUrl, method, ruleId }, (res) => {
    fromUrlInput.value = '';
    toUrlInput.value = '';
    methodSelect.value = 'GET';
    ruleId ? showToast('The redirect rule has been successfully updated.', 3000, 'success') : showToast('The redirect rule has been successfully added.', 3000, 'success');
    if (search) showToast('Note: A search filter is currently applied. Results are being filtered accordingly.', 3000, 'info');
    refreshPage();
  });

});

//main toggle actions test
document.getElementById('main-toggle').addEventListener('change', (event) => {
  if (!extensionId) {
    !extensionId && alert(extensionMessage);
    createPopup(TipHtmlString, 15000);
    event.target.checked = false;
    return;
  }
  const isChecked = event.target.checked;
  const status = isChecked ? 'ON' : 'OFF';
  chrome.runtime.sendMessage(extensionId, { action: 'EnableDisableExtension', status }, (res) => {
    refreshPage('search');
    //createPopup(UpdateMessageString, 15000);
  });
});

function showToast(message, duration = 3000, color = 'info') {
  // Create the toast element
  const toast = document.createElement('div');
  toast.className = `toast ${color}`;
  toast.textContent = message;

  // Append the toast to the container
  const toastContainer = document.getElementById('toast-container');
  toastContainer.appendChild(toast);

  // Slide in the toast
  setTimeout(() => {
    toast.style.opacity = '1';
  }, 10);

  // Remove the toast after the specified duration
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300); // Wait for the fade-out animation to complete
  }, duration);
}


async function validations() {

  const fromUrl = fromUrlInput.value;
  const toUrl = toUrlInput.value;
  const method = methodSelect.value;


  if (!isValidUrl(fromUrl) || !isValidUrl(toUrl)) {
    showToast('Please enter valid URLs', 3000, 'error')
    return false;
  }
  if (!isValidHostname(fromUrl) || !isValidHostname(toUrl)) {
    showToast('URLs must contain a hostname', 3000, 'error')
    return false;
  }

  if (fromUrl.toLowerCase() == toUrl.toLowerCase()) {
    showToast('Please enter distinct URLs', 3000, 'error')
    return false;
  }
  if (!hasSameNumberOfHashes(fromUrl, toUrl)) {
    showToast('The number of placeholder # must be same in both URLs', 3000, 'error')
    return false;
  }
  if (!updatingRuleId && localRedirects.find(e => e.from === fromUrl && e.method == method)) {
    showToast('A redirect rule with the same \'From\' URL and method already exists.', 3000, 'error')
    return false;
  }

  return true;

}

function hasSameNumberOfHashes(str1, str2) {
  const countHashes = str => (str.match(/#/g) || []).length;
  return countHashes(str1) === countHashes(str2);
}

function isValidHostname(url) {
  try {
    const url2 = new URL(url);
    return !!url2.hostname; // Ensure the hostname is valid
  } catch {
    return false; // Return false if an error is thrown
  }
}

function isValidUrl(url) {
  try {
    const url2 = new URL(url);
    return !!url2.href; // Ensure the URL is valid
  } catch {
    return false; // Return false if an error is thrown
  }
}

function createPopup(htmlString, time) {
  // Check if a popup already exists and remove it
  const existingPopup = document.getElementById('customPopup');
  if (existingPopup) {
      document.body.removeChild(existingPopup);
  }

  // Create the popup container
  const popupContainer = document.createElement('div');
  popupContainer.id = 'customPopup';
  popupContainer.innerHTML = `
      <div class="popup-content">
          <span class="close-btn">&times;</span>
          <div class="popup-html-content">${htmlString}</div>
      </div>
  `;

  // Append the popup to the body
  document.body.appendChild(popupContainer);

  // Display the popup
  popupContainer.style.display = 'block';

  // Close the popup when the close button is clicked
  const closeBtn = popupContainer.querySelector('.close-btn');
  closeBtn.addEventListener('click', closePopup);

  // Automatically close the popup after the specified time
  if (time) {
      setTimeout(closePopup, time);
  }
}

function closePopup() {
  const popupContainer = document.getElementById('customPopup');
  if (popupContainer && popupContainer.parentNode) {
      popupContainer.parentNode.removeChild(popupContainer);
  }
}

// Function to set equal width for all .redirect-item elements
function setEqualWidth() {
  // Get all .redirect-item elements
  const items = document.querySelectorAll('.redirect-item');
  let maxWidth = 0;
  // Find the maximum width among all items
  items.forEach(item => {
      const itemWidth = item.offsetWidth; // Get the actual width of the item
      if (itemWidth > maxWidth) {
          maxWidth = itemWidth;
      }
  });

  // Set the maximum width to all items
  items.forEach(item => {
      item.style.width = `${maxWidth}px`;
  });
}

function setHrWidths() {
  const w = Math.max(1, 
    document.getElementById('redirectList')?.clientWidth || 0,
    ...Array.from(document.querySelectorAll('.small-input')).map(e => e.offsetWidth)
  );
  document.querySelectorAll('hr').forEach(e => e.style.width = w + 'px');
}

function showExtensionErrorModal() {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
  overlay.style.backdropFilter = 'blur(2px)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';

  // Create modal content
  const modal = document.createElement('div');
  modal.style.backgroundColor = '#ffffff';
  modal.style.padding = '25px';
  modal.style.borderRadius = '8px';
  modal.style.maxWidth = '380px';
  modal.style.width = '90%';
  modal.style.textAlign = 'center';
  modal.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

  // Add warning icon
  const warningIcon = document.createElement('div');
  warningIcon.innerHTML = '⚠️';
  warningIcon.style.fontSize = '40px';
  warningIcon.style.marginBottom = '12px';

  // Add main message
  const mainMessage = document.createElement('p');
  mainMessage.textContent = 'Extension ID is missing from the URL.';
  mainMessage.style.fontWeight = '600';
  mainMessage.style.fontSize = '17px';
  mainMessage.style.marginBottom = '8px';
  mainMessage.style.color = '#333';

  // Add secondary message
  const secondaryMessage = document.createElement('p');
  secondaryMessage.textContent = 'Please close and reopen the extension from the Chrome extensions menu to resolve this issue.';
  secondaryMessage.style.fontSize = '14px';
  secondaryMessage.style.marginBottom = '20px';
  secondaryMessage.style.color = '#555';
  secondaryMessage.style.lineHeight = '1.4';

  // Create download button (changed from link to button for better control)
  const downloadButton = document.createElement('button');
  downloadButton.textContent = 'If not downloaded yet, click here to download';
  downloadButton.style.display = 'block';
  downloadButton.style.width = '100%';
  downloadButton.style.marginTop = '12px';
  downloadButton.style.padding = '8px 12px';
  downloadButton.style.backgroundColor = '#4285F4';
  downloadButton.style.color = 'white';
  downloadButton.style.border = 'none';
  downloadButton.style.borderRadius = '4px';
  downloadButton.style.fontWeight = '500';
  downloadButton.style.fontSize = '14px';
  downloadButton.style.cursor = 'pointer';
  downloadButton.style.transition = 'all 0.15s ease';

  // Hover effects
  downloadButton.onmouseenter = () => {
    downloadButton.style.backgroundColor = '#3367D6';
    downloadButton.style.transform = 'translateY(-1px)';
  };
  downloadButton.onmouseleave = () => {
    downloadButton.style.backgroundColor = '#4285F4';
    downloadButton.style.transform = 'translateY(0)';
  };

  // Fixed click handler
  downloadButton.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(
      'https://chromewebstore.google.com/detail/redirect-to-local-server/mcckhgbpcjcfdmnmbahhoakjlnmmjjgo',
      '_blank',
      'noopener,noreferrer'
    );
  };

  // Append elements
  modal.appendChild(warningIcon);
  modal.appendChild(mainMessage);
  modal.appendChild(secondaryMessage);
  modal.appendChild(downloadButton);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Disable scrolling
  document.body.style.overflow = 'hidden';
  
  // Prevent closing when clicking outside
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
}





// Initialize
refreshPage();

