let tempTab = null;
let lastFocusedTab = null;
let isSwitching = false; // Prevent multiple triggers


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'switchUser') {
    if (isSwitching) {
      console.warn('[SwitchUser] Already switching. Ignoring duplicate request.');
      sendResponse({ success: false, error: 'Something went wrong. Refresh Tab and try again.' });
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
                chrome.storage.sync.get(['mfaFlags'], (result) => {
                  const mfaFlags = result.mfaFlags || {};
                  const keepLoginTab = mfaFlags[website] == true;
                  console.log("mfaFlags ", mfaFlags[website])
                
                  setTimeout(() => {
                    reloadTabsAndRefocus(website, tabId, keepLoginTab);
                    sendResponse({ success: true });
                  }, 1);
                });
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
              const passwordInput = Array.from(document.querySelectorAll('input[type="password"]')).find(isVisible);
              let userInput = null;
              
              if (passwordInput) {
                const allInputs = Array.from(document.querySelectorAll('input')).filter(isVisible);
                const passwordIndex = allInputs.indexOf(passwordInput);
              
                // Look for the first visible input above password (text/email/number/etc.)
                for (let i = passwordIndex - 1; i >= 0; i--) {
                  if (['text', 'email', 'tel', 'number'].includes(allInputs[i].type)) {
                    userInput = allInputs[i];
                    break;
                  }
                }
              }
              
              if (userInput && passwordInput) {
                userInput.focus();
                userInput.value = username;
                userInput.dispatchEvent(new Event('input', { bubbles: true }));
              
                passwordInput.focus();
                passwordInput.value = password;
                passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
              
                const buttons = Array.from(document.querySelectorAll('button, input[type=submit]')).filter(isVisible);
                const submitKeywords = ['log', 'sign', 'submit', 'continue', 'next', 'proceed'];
                const submitBtn = buttons.find(btn =>
                  btn.type === 'submit' ||
                  submitKeywords.some(kw => btn.innerText?.toLowerCase().includes(kw))
                );
                
                setTimeout(() => {
                  if (submitBtn) {
                    submitBtn.click();
                  } else if (userInput.form) {
                    userInput.form.submit();
                  }

                  waitForErrorOrSuccess(resolve);
                }, 600);

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

                console.log("checkCount", checkCount)
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


function reloadTabsAndRefocus(website, excludeTabId, keepLoginTab = false) {
  const targetDomain = new URL(website).hostname;
  const shouldCloseTab = !keepLoginTab;

  chrome.tabs.query({}, (tabs) => {
    let isPreviousTabOfSameDomain = false;
    let isLastTabWasOfLogin = false;

    tabs.forEach((tab) => {
      try {
        const url = new URL(tab.url);

        // Check if the original tab is from the same domain
        if (tab.id === lastFocusedTab && url.hostname === targetDomain) {
          isPreviousTabOfSameDomain = true;

          const originalPath = url.pathname.toLowerCase().replace(/\/+$/, ''); // remove trailing slash
          const loginPath = new URL(website).pathname.toLowerCase().replace(/\/+$/, '');
          isLastTabWasOfLogin = originalPath == loginPath;
          console.log("isLastTabWasOfLogin",originalPath, loginPath , isLastTabWasOfLogin)
        }

        // Reload all other tabs from the same domain
        if (url.hostname === targetDomain && tab.id !== excludeTabId) {
          chrome.tabs.reload(tab.id);
          console.log(`[TabReload] Reloaded tab ${tab.id}: ${tab.url}`);
        }
      } catch (e) {
        // Ignore tabs without valid URLs (e.g., chrome://, about:blank)
      }
    });

    // ✅ Close login tab only if original tab is from the same domain
    if (shouldCloseTab && !isLastTabWasOfLogin && tempTab && isPreviousTabOfSameDomain) {
      chrome.tabs.remove(tempTab, () => {
        console.log('[Cleanup] Closed login tab');
      });
    }

    console.log("focusTabById", isPreviousTabOfSameDomain , isLastTabWasOfLogin ,keepLoginTab, isPreviousTabOfSameDomain && !isLastTabWasOfLogin && !keepLoginTab)
    // ✅ Refocus only if the original tab was from same domain
    if (isPreviousTabOfSameDomain && !isLastTabWasOfLogin && !keepLoginTab ) {
      focusTabById(lastFocusedTab);
    } else {
      console.log('[FocusTab] Skipped refocusing original tab (different domain)');
    }
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
