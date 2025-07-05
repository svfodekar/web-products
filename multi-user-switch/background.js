let tempTab = null;
let lastFocusedTab = null;
let isSwitching = false; // Prevent multiple triggers


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'switchUser') {
    if (isSwitching) {
      console.warn('[SwitchUser] Already switching. Ignoring duplicate request.');
      sendResponse({ success: false, error: 'Already switching user' });
      return true;
    }

    isSwitching = true; // block next calls
    handleUserSwitch(request, (response) => {
      isSwitching = false; // allow again
      sendResponse(response);
    });

    return true; // async response
  }
});



async function handleUserSwitch(request, sendResponse) {
  const { user, website } = request;
  const loginUrl = new URL(website); // <- Make sure this is defined here

  try {
    await nuclearLogout(website);

    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    lastFocusedTab = currentTab.id;

    chrome.tabs.create(
      {
        url: loginUrl.href,
        active: true,
        index: currentTab.index + 1,
      },
      (tab) => {
        tempTab = tab.id;
        console.log('[SwitchUser] Opened login tab:', tab.id);

        // Use a scoped listener function with access to user and website
        const onUpdatedListener = function (tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(onUpdatedListener);

            injectFormLogin(tabId, user, website)
              .then((result) => {
                console.log('[InjectFormLogin] Result:', result);

                if (!result.success) {
                  console.warn('[SwitchUser] Login failed, keeping login tab open');
                  sendResponse({ success: false, error: result.error || 'Unknown login error' });
                  return;
                }

                console.log('[SwitchUser] Login successful. Reloading other tabs...');
                setTimeout(() => {
                  reloadTabsAndRefocus(website, tabId);
                  sendResponse({ success: true });
                }, 2000);
              })
              .catch((err) => {
                console.error('[InjectFormLogin] Error:', err);
                sendResponse({ success: false, error: err.message });
              });
          }
        };

        chrome.tabs.onUpdated.addListener(onUpdatedListener);
      }
    );
  } catch (error) {
    console.error('[SwitchUser] Failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}


function injectFormLogin(tabId, user, website) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: ({ username, password }) => {
          function isVisible(el) {
            const style = window.getComputedStyle(el);
            return el.offsetParent !== null &&
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              style.opacity !== '0';
          }

          return new Promise((resolve) => {
            let attempts = 0;

            function tryLogin() {
              const inputs = Array.from(document.querySelectorAll('input')).filter(isVisible);

              if (inputs.length >= 2) {
                const [userInput, passInput] = inputs;

                userInput.focus();
                userInput.value = username;
                userInput.dispatchEvent(new Event('input', { bubbles: true }));

                passInput.focus();
                passInput.value = password;
                passInput.dispatchEvent(new Event('input', { bubbles: true }));

                const buttons = Array.from(document.querySelectorAll('button, input[type=submit]')).filter(isVisible);
                const submitBtn = buttons.find(btn => btn.innerText?.toLowerCase().includes('log') || btn.type === 'submit');

                setTimeout(() => {
                  if (submitBtn) {
                    submitBtn.click();
                  } else if (userInput.form) {
                    userInput.form.submit();
                  }

                  waitForErrorOrSuccess(resolve);
                }, 100);

              } else if (attempts >= 30) {
                resolve({ success: false, error: 'Login inputs did not appear in time' });
              } else {
                attempts++;
                setTimeout(tryLogin, 1000);
              }
            }

            function waitForErrorOrSuccess(done) {
              let checkCount = 0;

              function check() {
                const errorElement = document.querySelector('.error, .alert, .login-error, [role=alert]');
                const loggedIn = window.location.pathname !== '/login'; // heuristic

                if (loggedIn) {
                  return done({ success: true });
                } else if (errorElement && isVisible(errorElement)) {
                  return done({ success: false, error: 'Login failed: error message appeared' });
                }

                if (checkCount++ > 10) {
                  return done({ success: false, error: 'Login likely failed: no redirect detected' });
                }

                setTimeout(check, 1000);
              }

              check();
            }

            tryLogin();
          });
        },
        args: [{ username: user.username, password: user.password }]
      },
      (results) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        resolve(results[0]?.result || { success: false, error: 'No result returned' });
      }
    );
  });
}


function reloadTabsAndRefocus(website, excludeTabId) {
  const targetDomain = new URL(website).hostname;
  const shouldCloseTab = true;

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      try {
        const url = new URL(tab.url);
        if (url.hostname === targetDomain && tab.id !== excludeTabId) {
          chrome.tabs.reload(tab.id);
          console.log(`[TabReload] Reloaded tab ${tab.id}: ${tab.url}`);
        }
      } catch (e) {
        // Ignore non-http(s) tabs
      }
    });

    if (shouldCloseTab && tempTab) {
      chrome.tabs.remove(tempTab, () => {
        console.log('[Cleanup] Closed login tab');
      });
    }

    focusTabById(lastFocusedTab);
  });
}

async function nuclearLogout(websiteUrl) {
  try {
    const domain = new URL(websiteUrl).hostname;
    const origin = new URL(websiteUrl).origin;

    const cookies = await chrome.cookies.getAll({ domain });
    await Promise.all(
      cookies.map(cookie =>
        chrome.cookies.remove({
          url: `https://${cookie.domain}${cookie.path}`,
          name: cookie.name,
        })
      )
    );

    const tabs = await chrome.tabs.query({ url: `*://${domain}/*` });

    await Promise.all(
      tabs.map(tab =>
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            localStorage.clear();
            sessionStorage.clear();
            if (indexedDB.databases) {
              indexedDB.databases().then(dbs => {
                dbs?.forEach(db => {
                  indexedDB.deleteDatabase(db.name);
                });
              });
            }
          }
        }).catch(() => {})
      )
    );

    console.log('[NuclearLogout] Completed for:', origin);
    return true;
  } catch (error) {
    console.error('[NuclearLogout] Failed:', error);
    return false;
  }
}

function focusTabById(tabId) {
  chrome.tabs.update(tabId, { active: true }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('[FocusTab] Error:', chrome.runtime.lastError);
      return;
    }
    console.log('[FocusTab] Focused tab:', tab.id);
  });
}
