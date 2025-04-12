const urlParams = new URLSearchParams(window.location.search);
let extensionId = urlParams.get("extensionId");

console.log("Extracted Extension ID:", extensionId);

if (!extensionId) {
    console.log("Extension ID not found in URL.");
    //alert("✅ Enhance your experience by installing the 'GitHub Postman Sync Engine' Chrome Extension");
}

// document.getElementById("login-btn").addEventListener("click", () => {
//     doPostmanOauthLogin();
// });

// function doPostmanOauthLogin() {
//     chrome.runtime.sendMessage(extensionId, { action: 'doPostmanOauthLogin' }, (res) => {
//         console.log(res)
//     });
// }

//-----------------------

// Object to store user credentials
const userCredentials = {};
const postmanApiUrl = 'https://api.getpostman.com';

const outputDiv = document.getElementById('output');
const commandInput = document.getElementById('command-input');

const WELCOME_MESSAGE = 'Welcome to Github Postman Sync Engine! Type "help" for a list of commands.';
const HELP_MESSAGE = `<p><strong>Available Commands:</strong><br>
- git pull branch: Pull collections and environments from GitHub.<br>
- git pull hard branch: Hard pull collections and environments from GitHub.<br>
- git push new-branch message: Push collections and create pull request to GitHub.<br>
- help: Show this help message.</p>`;

async function handleGitPull(branchName) {
    if (!branchName || branchName.split(' ').length > 1) {
        displayOutput('Invalid command! Correct usage - git pull branch-name', 'red');
        return;
    }
    displayOutput(`Processing....`);
    await pullFromGithub(userCredentials, branchName);
    displayOutput(`Successfully pulled all collections from the branch: ${branchName}\n`, 'green');
}

async function handleGitPullHard(branchName) {
    if (!branchName || branchName.split(' ').length > 1) {
        displayOutput(`Invalid command! Correct usage: git pull hard branch-name`, 'red');
        return;
    }
    displayOutput(`Processing....`);
    await hardPullPostmanCollections(userCredentials, branchName)
    displayOutput(`Successfully hard pulled all collections from the branch: ${branchName}\n`, 'green');
}

async function handleGitPush(commandParams) {
    const split = commandParams.split(' ');
    const destinationBranch = localStorage.getItem("BASE_BRANCH") || 'main';
    const newBranch = split?.[0];
    let commitMsg = split.slice(1).join(' ').trim();

    if (!destinationBranch || !newBranch || !commitMsg) {
        displayOutput('Invalid command! Correct usage: git push new-branch message');
        return;
    }
    displayOutput(`Processing....`);
    commitMsg = commitMsg.slice(1, commitMsg.length - 1);
    await pushOnGithub(userCredentials, newBranch, destinationBranch, commitMsg);
}

async function processCommand(command) {
    if (!command.trim()) {
        displayOutput('No command entered. Try again.', 'red');
        return;
    }

    try {
        if (command.startsWith('git pull hard')) {
            const branchName = command.replace('git pull hard', '').trim();
            displayOutput(`COMMAND >> ` + command, null, true);
            const result = await handleGitPullHard(branchName);

        }
        else if (command.startsWith('git pull')) {
            const branchName = command.replace('git pull', '').trim();
            displayOutput(`COMMAND >> ` + command, null, true);
            const result = await handleGitPull(branchName);

        }
        else if (command.startsWith('git push')) {
            const params = command.replace('git push', '').trim();
            displayOutput(`COMMAND >> ` + command, null,  true);
            await handleGitPush(params);

        }
        else if (command === 'help') {
            showHelp();
        }
        else {
            displayOutput(`Unknown command: "${command}". Type 'help' for a list of commands.`, 'red', true);
        }
    } catch (e) {
        displayOutput(e.message, 'red');
    }
}

function ensureInputFocus() {
    commandInput.focus();
    document.addEventListener('click', () => {
        commandInput.focus();
    });
}

function initializeTerminal() {
    displayOutput(WELCOME_MESSAGE, 'limegreen');
    ensureInputFocus();
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// Helper function to handle fetch responses
async function handleResponse(response) {
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// Get Postman collections
async function getCollections(apiKey) {
    const collections = [];
    try {
        const response = await fetch(`${postmanApiUrl}/collections`, {
            headers: { 'X-Api-Key': apiKey },
        });
        const data = await handleResponse(response);

        for (const collection of data.collections) {
            const detailedResponse = await fetch(`${postmanApiUrl}/collections/${collection.uid}`, {
                headers: { 'X-Api-Key': apiKey },
            });
            const detailedData = await handleResponse(detailedResponse);
            collections.push(detailedData.collection);
        }
    } catch (error) {
        displayOutput("Error fetching collections:"+ error.message, 'red');
    }
    return collections;
}

// Get Postman environments
async function getEnvironments(apiKey) {
    const environments = [];
    try {
        const response = await fetch(`${postmanApiUrl}/environments`, {
            headers: { 'X-Api-Key': apiKey },
        });
        const data = await handleResponse(response);

        for (const env of data.environments) {
            const detailedResponse = await fetch(`${postmanApiUrl}/environments/${env.uid}`, {
                headers: { 'X-Api-Key': apiKey },
            });
            const detailedData = await handleResponse(detailedResponse);
            environments.push(detailedData.environment);
        }
    } catch (error) {
        displayOutput("Error fetching environments:"+ error.message, 'red');
    }
    return environments;
}

// Save content to GitHub
async function saveToGitHub(content, config, filePath, branch, message) {
    const repoName = config.GITHUB_REPO.split('/').pop().replace('.git', '');
    const repoOwner = config.GITHUB_USERNAME;
    const headers = {
        'Authorization': `token ${config.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
    };

    try {
        // Check if the file exists
        const checkResponse = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`,
            { headers }
        );
        let sha = null;
        if (checkResponse.ok) {
            const checkData = await handleResponse(checkResponse);
            sha = checkData.sha;
        }

        // Create or update the file
        const response = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
            {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({
                    message,
                    content: btoa(JSON.stringify(content, null, 2)),
                    sha,
                    branch,
                }),
            }
        );
        await handleResponse(response);
        console.log(`File '${filePath}' saved successfully on branch '${branch}'.`);
    } catch (error) {
        displayOutput(`Error saving file '${filePath}' to GitHub:`+ error.message, 'red');
        throw error;
    }
}

// Create a new collection in Postman
async function createPostmanCollection(apiKey, collection) {
    try {
        const response = await fetch(`${postmanApiUrl}/collections`, {
            method: 'POST',
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ collection }),
        });

        // Check if the response is OK
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log(`Collection '${collection.info.name}' added to Postman.`);
    } catch (error) {
        displayOutput(`Error creating Postman collection '${collection.info.name}':`+ error.messag, 'red');
        throw error;
    }
}

// Ensure the base branch exists
async function ensureBaseBranchExists(config, baseBranch) {
    const repoName = config.GITHUB_REPO.split('/').pop().replace('.git', '');
    const repoOwner = config.GITHUB_USERNAME;
    const headers = { 'Authorization': `token ${config.GITHUB_TOKEN}` };

    try {
        const response = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/branches/${baseBranch}`,
            { headers }
        );
        if (!response.ok) {
            if (response.status === 404) {
                console.log(`Base branch '${baseBranch}' does not exist. Creating it...`);
                await createInitialCommit(config, baseBranch);
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }
    } catch (error) {
        displayOutput(`Error ensuring base branch '${baseBranch}' exists:`+ error.message, 'red');
        throw error;
    }
}

// Create an initial commit to initialize the base branch
async function createInitialCommit(config, baseBranch) {
    const repoName = config.GITHUB_REPO.split('/').pop().replace('.git', '');
    const repoOwner = config.GITHUB_USERNAME;
    const headers = {
        'Authorization': `token ${config.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
    };

    const commitMessage = "Initial commit";
    const content = btoa("# Initial Commit\nThis repository is initialized.");
    const filePath = "README.md";

    try {
        const response = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
            {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({
                    message: commitMessage,
                    content,
                    branch: baseBranch,
                }),
            }
        );
        await handleResponse(response);
        console.log(`Base branch '${baseBranch}' created successfully with an initial commit.`);
    } catch (error) {
        displayOutput(`Error creating initial commit:`+ error.message, 'red');
        throw error;
    }
}

// Create a new branch
async function createBranch(config, baseBranch, newBranch) {
    const repoName = config.GITHUB_REPO.split('/').pop().replace('.git', '');
    const repoOwner = config.GITHUB_USERNAME;
    const headers = {
        'Authorization': `token ${config.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
    };

    try {
        const baseBranchResponse = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/git/ref/heads/${baseBranch}`,
            { headers }
        );
        const baseData = await handleResponse(baseBranchResponse);
        const baseSha = baseData.object.sha;

        const response = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/git/refs`,
            {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    ref: `refs/heads/${newBranch}`,
                    sha: baseSha,
                }),
            }
        );
        await handleResponse(response);
        displayOutput(`Branch '${newBranch}' created successfully.`);
    } catch (error) {
        displayOutput(`Error creating branch '${newBranch}':`, error.message);
        if (error.message.includes('Reference already exists')) return;
        throw error;
    }
}

// Create a pull request
async function createPullRequest(config, branchName, baseBranch = 'main', commitMsg) {
    const repoName = config.GITHUB_REPO.split('/').pop().replace('.git', '');
    const repoOwner = config.GITHUB_USERNAME;
    const headers = {
        'Authorization': `token ${config.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
    };

    try {
        const update = await checkPullRequestExists(repoName, baseBranch, branchName);
        if(update) return;

        const response = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/pulls`,
            {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    title: commitMsg || `Sync Postman collections and environments`,
                    head: branchName,
                    base: baseBranch,
                    body: `Automated sync of Postman collections and environments to branch '${branchName}'.`,
                }),
            }
        );
        const data = await handleResponse(response);
        displayOutput( `Pull request created: <a href="${data.html_url}" target="_blank" style="color: green; text-decoration: none;">${data.html_url}</a>`, 'green');
    } catch (error) {
        displayOutput(`Error creating pull request:`, error.message);
        throw error;
    }
}

// Fetch all collections from GitHub
async function fetchAllCollectionsFromGitHub(config, branch) {
    const repoName = config.GITHUB_REPO.split('/').pop().replace('.git', '');
    const headers = { 'Authorization': `token ${config.GITHUB_TOKEN}` };
    const baseUrl = `https://api.github.com/repos/${config.GITHUB_USERNAME}/${repoName}/contents/Collections`;

    try {
        const response = await fetch(`${baseUrl}?ref=${branch}`, { headers });
        const data = await handleResponse(response);

        const collections = [];
        for (const file of data) {
            if (file.type === 'file' && file.name.endsWith('.json')) {
                const fileResponse = await fetch(file.download_url);
                const fileData = await handleResponse(fileResponse);
                collections.push({
                    name: file.name.replace('.json', ''),
                    content: fileData,
                });
            }
        }
        return collections;
    } catch (error) {
        displayOutput('Error fetching collections from GitHub:'+ error.message, 'red');
        return [];
    }
}

// Fetch environments from GitHub
async function fetchEnvironmentsFromGitHub(config, branch) {
    const repoName = config.GITHUB_REPO.split('/').pop().replace('.git', '');
    const headers = { 'Authorization': `token ${config.GITHUB_TOKEN}` };
    const envFilePath = `Environments/environments.json`;

    try {
        const response = await fetch(
            `https://api.github.com/repos/${config.GITHUB_USERNAME}/${repoName}/contents/${envFilePath}?ref=${branch}`,
            { headers }
        );
        const data = await handleResponse(response);
        return JSON.parse(atob(data.content));
    } catch (error) {
        displayOutput('Error fetching environments from GitHub:'+ error.message, 'red');
        return [];
    }
}

// Hard pull collections from GitHub to Postman
async function hardPullPostmanCollections(config, branch) {
    const repoName = config.GITHUB_REPO.split('/').pop().replace('.git', '');
    const headers = { Authorization: `token ${config.GITHUB_TOKEN}` };
    const baseUrl = `https://api.github.com/repos/${config.GITHUB_USERNAME}/${repoName}/contents`;

    // Delete all existing collections in Postman
    await deleteAllPostmanCollections(config.POSTMAN_API_KEY);

    // Get all collections from GitHub
    const collectionsPath = `${baseUrl}/Collections?ref=${branch}`;
    try {
        const response = await fetch(collectionsPath, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const githubCollections = await response.json();

        for (const file of githubCollections) {
            if (file.type === 'file' && file.name.endsWith('.json')) {
                const fileResponse = await fetch(file.download_url);
                if (!fileResponse.ok) {
                    throw new Error(`HTTP error! status: ${fileResponse.status}`);
                }
                const githubCollection = await fileResponse.json();

                // Add the collection to Postman
                await createPostmanCollection(config.POSTMAN_API_KEY, githubCollection);
            }
        }

        console.log('Hard pull operation completed.');
    } catch (error) {
        displayOutput('Error pulling collections from GitHub:'+error.message, 'red');
        if (error.message.includes('404')) {
            error.message = 'GitHub User, Repository or Branch may not exist.';
        }
        throw error;
    }
}

// Delete all Postman collections
async function deleteAllPostmanCollections(apiKey) {
    try {
        // Fetch all collections from Postman
        const response = await fetch(`${postmanApiUrl}/collections`, {
            headers: { 'X-Api-Key': apiKey },
        });

        // Check if the response is OK
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Parse the response data
        const data = await response.json();
        const collections = data.collections ?? [];

        // Delete each collection
        for (const collection of collections) {
            const deleteResponse = await fetch(`${postmanApiUrl}/collections/${collection.uid}`, {
                method: 'DELETE',
                headers: { 'X-Api-Key': apiKey },
            });

            // Check if the delete request was successful
            if (!deleteResponse.ok) {
                throw new Error(`HTTP error! status: ${deleteResponse.status}`);
            }
        }

        console.log('All Postman collections deleted successfully.');
    } catch (error) {
        displayOutput('Error deleting Postman collections:'+ error.message, 'red');
        throw error;
    }
}

// Push collections and environments to GitHub
async function pushOnGithub(config, newBranch, baseBranch = 'main', commitMsg) {
    await ensureBaseBranchExists(config, baseBranch);
    await createBranch(config, baseBranch, newBranch);

    const collections = await getCollections(config.POSTMAN_API_KEY);
    const oldCollections = await fetchAllCollectionsFromGitHub(config, baseBranch);

    for (const collection of collections) {
        const filePath = `Collections/${collection.info.name}.json`;
        await saveToGitHub(collection, config, filePath, newBranch, `Sync collection: ${collection.info.name}`);
    }

    const environments = await getEnvironments(config.POSTMAN_API_KEY);
    const envFilePath = `Environments/environments.json`;
    await saveToGitHub(environments, config, envFilePath, newBranch, "Sync all environments");

    const url = await createPullRequest(config, newBranch, baseBranch, commitMsg);
}

// Pull collections and environments from GitHub
async function pullFromGithub(config, branch) {
    const collections = await fetchAllCollectionsFromGitHub(config, branch);
    const environments = await fetchEnvironmentsFromGitHub(config, branch);

    console.log('Collections:', collections);
    console.log('Environments:', environments);
}


function clearTerminal() {
    outputDiv.innerHTML = '';
}

function showHelp() {
    displayOutput(HELP_MESSAGE);
}


function showSection(section) {
    document.getElementById('terminal').classList.remove('active');
    document.getElementById('config').classList.remove('active');
    document.getElementById(section).classList.add('active');
}

// Example data for dropdowns
let repositories = [];
let branches = [];

// Populate dropdowns dynamically
const repoDropdown = document.getElementById("repo");
const branchDropdown = document.getElementById("branch");


// branches.forEach(branch => {
//     let option = document.createElement("option");
//     option.text = branch;
//     branchDropdown.add(option);
// });


document.addEventListener("DOMContentLoaded", function () {
    const commandInput = document.getElementById("commandInput");
    const logSection = document.querySelector(".logs");
    const prefix = "COMMAND >> ";

    document.getElementById("repoInput").value = localStorage.getItem("GITHUB_REPO") || '';
    document.getElementById("branchInput").value = localStorage.getItem("BASE_BRANCH") || '';
    document.getElementById("github_username").value = localStorage.getItem("GITHUB_USERNAME") || '';
    document.getElementById("github_token").value ='';
    document.getElementById("postman_api_key").value = '';

    userCredentials.GITHUB_REPO = localStorage.getItem("GITHUB_REPO") || '';
    userCredentials.BASE_BRANCH = localStorage.getItem("BASE_BRANCH") || '';
    userCredentials.GITHUB_USERNAME = localStorage.getItem("GITHUB_USERNAME") || '';
    userCredentials.GITHUB_TOKEN = localStorage.getItem("GITHUB_TOKEN") || '';
    userCredentials.POSTMAN_API_KEY = localStorage.getItem("POSTMAN_API_KEY") || '';

    // Set default value
    commandInput.value = prefix ;
    displayOutput(WELCOME_MESSAGE);

    commandInput.addEventListener("keydown", function (event) {
        if (this.selectionStart <= prefix.length && (event.key === "Backspace" || event.key === "Delete")) {
            event.preventDefault(); // Prevent deletion of prefix
        }
    });

    document.querySelectorAll("input").forEach(input => {
        input.setAttribute("autocomplete", "off");
        input.setAttribute("autocorrect", "off");
        input.setAttribute("spellcheck", "false");
    });

    commandInput.addEventListener("keypress", async function (event) {
        if (event.key === "Enter") {
            const commandText = this.value.slice(prefix.length).trim(); // Get command text
            
            if (commandText) {
                await processCommand(commandText)
            }

            this.value = this.value; // Reset input with prefix
            event.preventDefault(); // Prevent default form submission
        }
    });

    commandInput.addEventListener("click", function () {
        if (this.selectionStart < prefix.length) {
            this.setSelectionRange(prefix.length, prefix.length);
        }
    });

    commandInput.addEventListener("keyup", function () {
        if (this.selectionStart < prefix.length) {
            this.setSelectionRange(prefix.length, prefix.length);
        }
    });

});

    // Function to log output with color support
function displayOutput(log, color = "rgb(207, 204, 204)", newpara) {
    const logSection = document.querySelector(".logs");
    if (newpara) logSection.innerHTML += '<br>'
    logSection.innerHTML += `<div style="color: ${color}; ">${log}</div>`;
    logSection.scrollTop = logSection.scrollHeight;
}

///================================================================
const repoInput = document.getElementById("repoInput");
const repoSelect = document.getElementById("repoSelect");
let isReposFetched = false;

// Function to fetch all repositories from GitHub
async function fetchRepositories() {
    try {
        const username = userCredentials.GITHUB_USERNAME;
        if (!username) {
            displayOutput("GitHub username is missing in config.", 'red');
            return;
        }

        const response = await fetch(`https://api.github.com/user/repos?per_page=100`, {
            headers: {
                "Authorization": `Bearer ${userCredentials.GITHUB_TOKEN}`, // Use Bearer token instead of "token"
                "Accept": "application/vnd.github.v3+json"
            }
        });

        if (!response.ok) throw new Error("Failed to fetch repositories");

        const data = await response.json();
        repositories = data.map(repo => repo.name).sort(); // Sort alphabetically
        isReposFetched = true;
        updateRepoDropdown(); // Show all repos
    } catch (error) {
        displayOutput("Error fetching repositories:"+ error, 'red');
    }
}


// Function to update dropdown
function updateRepoDropdown() {

    const searchText = repoInput.value.toLowerCase();
    repoSelect.innerHTML = ""; // Clear previous options

    const filteredRepos = repositories.filter(repo => repo.toLowerCase().includes(searchText));

    filteredRepos.forEach(repo => {
        const option = document.createElement("option");
        option.textContent = repo;
        option.style.whiteSpace = "nowrap"; // Prevent text wrapping
        repoSelect.appendChild(option);
    });

    repoSelect.style.display = filteredRepos.length ? "block" : "none"; // Show/hide dropdown
}

// Close dropdown when clicking outside
document.addEventListener("click", function (event) {
    if (!repoInput.contains(event.target) && !repoSelect.contains(event.target)) {
        repoSelect.style.display = "none";
        repoInput.value = localStorage.getItem("GITHUB_REPO");
        branchInput.value = localStorage.getItem("BASE_BRANCH");
    }
});

// Event listeners
repoInput.addEventListener("focus", function () {
    if (!isReposFetched) {
        fetchRepositories(); // Fetch repos when user clicks input for the first time
    } else {
        updateRepoDropdown(); // Show all repos immediately
    }
});

repoInput.addEventListener("input", updateRepoDropdown);

repoSelect.addEventListener("change", function () {
    repoInput.value = this.value;
    localStorage.setItem("GITHUB_REPO", repoInput.value);
    userCredentials.GITHUB_REPO = repoInput.value;
    document.getElementById("branchInput").value = '';
    localStorage.setItem("BASE_BRANCH", '');
    userCredentials.BASE_BRANCH = '';
    repoSelect.style.display = "none"; // Hide dropdown after selection
});

///============================================================================
const branchInput = document.getElementById("branchInput");
const branchSelect = document.getElementById("branchSelect");
const branchContainer = document.querySelector(".branch-container");

branches = [];
let isBranchFetched = false;


// Fetch branches for the selected repository
async function fetchBranches(repoName) {
    try {
        if (!repoName) return;
    
        let page = 1;
        let perPage = 900000000000000; // Max per request

        const response = await fetch(`https://api.github.com/repos/${userCredentials.GITHUB_USERNAME}/${repoName}/branches?per_page=${perPage}&page=${page}`, {
            headers: {
                "Authorization": `Bearer ${userCredentials.GITHUB_TOKEN}`
            }
        });

        if (!response.ok) throw new Error("Failed to fetch branches");

        const data = await response.json();
        branches = branches.concat(data.map(branch => branch.name)); // Merge results


        branches.sort(); // Sort alphabetically
        isBranchFetched = true;
        updateBranchDropdown(); // Pass branches to dropdown function
    } catch (error) {
        displayOutput("Error fetching branches:"+ error, 'red');
    }
}


// Update branch dropdown based on input
function updateBranchDropdown() {
    const searchText = branchInput.value.toLowerCase();
    branchSelect.innerHTML = ""; // Clear previous options

    let filteredBranches = searchText == '' ? branches :  branches.filter(branch => branch.toLowerCase().includes(searchText));

    if (filteredBranches.length === 0) {
        branchSelect.style.display = "none";
        return;
    }

    filteredBranches.forEach(branch => {
        const option = document.createElement("option");
        option.textContent = branch;
        branchSelect.appendChild(option);
    });

    branchSelect.style.display = "block"; // Show dropdown
}

// Close dropdown when clicking outside
document.addEventListener("click", function (event) {
    if (!branchContainer.contains(event.target)) {
        branchSelect.style.display = "none";
    }
});

// Event listeners for branch input
branchInput.addEventListener("focus", function () {
    const selectedRepo = document.getElementById("repoInput").value; // Get selected repo
    if (!isBranchFetched) {
        fetchBranches(selectedRepo); // Fetch branches for selected repo
    } else {
        updateBranchDropdown();
    }
});

branchInput.addEventListener("input", updateBranchDropdown);

branchSelect.addEventListener("change", async function () {
    branchInput.value = this.value;
    localStorage.setItem("BASE_BRANCH", branchInput.value);
    branchSelect.style.display = "none"; // Hide dropdown after selection
});

document.getElementById("saveConfig").addEventListener("click", async function () {
    const saveButton = document.getElementById("saveConfig");
    saveButton.innerHTML = "Saving... ⏳";
    let githubUsername = document.getElementById("github_username").value;
    let githubToken = document.getElementById("github_token").value || localStorage.getItem("GITHUB_TOKEN");
    let postmanApiKey = document.getElementById("postman_api_key").value || localStorage.getItem("POSTMAN_API_KEY");
    if (false == await validateCredentials(githubUsername, githubToken, postmanApiKey)) {
        saveButton.innerHTML = "Save";
        return;
    }

    isBranchFetched = false;
    isReposFetched = false;

    localStorage.setItem("GITHUB_USERNAME", githubUsername);
    localStorage.setItem("GITHUB_TOKEN", githubToken);
    localStorage.setItem("POSTMAN_API_KEY", postmanApiKey);

    userCredentials.GITHUB_USERNAME = localStorage.getItem("GITHUB_USERNAME") || '';
    userCredentials.GITHUB_TOKEN = localStorage.getItem("GITHUB_TOKEN") || '';
    userCredentials.POSTMAN_API_KEY = localStorage.getItem("POSTMAN_API_KEY") || '';

    saveButton.innerHTML = "Save";
    alert("✅ Configurations have been securely saved to your local storage.");


})


async function validateCredentials(githubUsername, githubToken, postmanApiKey ) {
    if (!githubUsername || !githubToken || !postmanApiKey) {
         alert("🚨 All fields are required! Please fill in all details.");
         return false;
    }

    try {
        // ✅ Validate GitHub Username & Token by fetching user profile
        let githubResponse = await fetch(`https://api.github.com/user`, {
            headers: { "Authorization": `token ${githubToken}` }
        });

        if (!githubResponse.ok) {
            alert(`🚨  Invalid GitHub Token for Username: ${githubUsername}`);
            return false;
        }

        let githubData = await githubResponse.json();
        if (githubData.login.toLowerCase() !== githubUsername.toLowerCase()) {
            alert(`🚨  Invalid GitHub Username: ${githubUsername}`);
            return false;
        }

        // ✅ Validate Postman API Key by fetching workspaces
        let postmanResponse = await fetch(`https://api.getpostman.com/workspaces`, {
            headers: { "X-Api-Key": postmanApiKey }
        });

        if (!postmanResponse.ok) {
             alert("🚨  Invalid Postman API Key!");
             return false;
        }

        return true;

    } catch (error) {
        console.error("Error validating credentials:", error);
        alert("🚨  Error validating onfigurations. Please try again!");
        return false;
    }
}


document.getElementById("clearButton").addEventListener("click", function () {
    location.reload(); // Refresh the page
});


