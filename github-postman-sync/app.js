const urlParams = new URLSearchParams(window.location.search);
let extensionId = urlParams.get("extensionId");

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

// Enhanced progress bar functions
function showProgressBar() {
    const progressContainer = document.getElementById('progress-container');
    progressContainer.style.display = 'block';
    updateProgressBar(0, '🚀 Initializing operation...');
}

function hideProgressBar() {
    const progressContainer = document.getElementById('progress-container');
    progressContainer.style.display = 'none';
}

function updateProgressBar(percent, message = '') {
    const progressBar = document.getElementById('progress-bar');
    percent = Math.min(100, Math.max(0, percent));
    progressBar.style.width = `${percent}%`;
    progressBar.textContent = message || `${percent}%`;
    
    // Dynamic color changes
    if (percent < 30) {
        progressBar.style.background = 'linear-gradient(90deg, #FF5722, #FF9800)';
    } else if (percent < 70) {
        progressBar.style.background = 'linear-gradient(90deg, #FF9800, #FFEB3B)';
    } else {
        progressBar.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
    }
    
    // Add detailed log message if provided
    if (message) {
        displayOutput(`[Progress] ${message}`, '#aaa');
    }
}

async function handleGitPull(branchName) {
    if (!branchName || branchName.split(' ').length > 1) {
        displayOutput('❌ Invalid command! Correct usage - git pull branch-name', 'red');
        return;
    }
    
    showProgressBar();
    try {
        updateProgressBar(10, '🔍 Validating branch...');
        displayOutput(`Starting pull operation from branch: ${branchName}`, '#aaa');
        
        updateProgressBar(20, '📦 Fetching collections from GitHub...');
        const collections = await fetchAllCollectionsFromGitHub(userCredentials, branchName);
        displayOutput(`Found ${collections.length} collections on GitHub`, '#aaa');
        
        updateProgressBar(40, '🌐 Fetching environments from GitHub...');
        const environments = await fetchEnvironmentsFromGitHub(userCredentials, branchName);
        displayOutput(`Found ${environments.length} environments on GitHub`, '#aaa');
        
        updateProgressBar(60, '🔄 Processing data...');
    await pullFromGithub(userCredentials, branchName);
    updateProgressBar(100, '🎉 Pull completed successfully!');
    displayOutput(`\n✅ Successfully pulled ${collections.length} collections and ${environments.length} environments from branch: ${branchName}\n`, 'green');
    
    setTimeout(hideProgressBar, 1000);
} catch (e) {
    updateProgressBar(0, '❌ Operation failed');
    displayOutput(`\n🔥 Error during pull operation: ${e.message}\n`, 'red');
    setTimeout(hideProgressBar, 1500);
}
}

async function handleGitPullHard(branchName) {
    if (!branchName || branchName.split(' ').length > 1) {
        displayOutput('❌ Invalid command! Correct usage: git pull hard branch-name', 'red');
        return;
    }
    
    showProgressBar();
    try {
        updateProgressBar(5, '⚠️ Starting HARD pull operation...');
        displayOutput(`\nInitiating HARD pull from branch: ${branchName}\nThis will DELETE all existing Postman collections first!`, '#aaa');
        
        updateProgressBar(10, '🗑️ Deleting existing collections...');
        const deleteCount = await deleteAllPostmanCollections(userCredentials.POSTMAN_API_KEY);
        displayOutput(`Deleted ${deleteCount} existing collections`, '#aaa');
        
        updateProgressBar(30, '📥 Fetching collections from GitHub...');
        const collections = await fetchAllCollectionsFromGitHub(userCredentials, branchName);
        displayOutput(`Found ${collections.length} collections on GitHub`, '#aaa');
        
        updateProgressBar(50, '⏳ Importing collections to Postman...');
        let importedCount = 0;
        for (const collection of collections) {
            await createPostmanCollection(userCredentials.POSTMAN_API_KEY, collection);
            importedCount++;
            updateProgressBar(50 + (importedCount/collections.length)*40, 
                `📦 Importing collection ${importedCount}/${collections.length}: ${collection.info.name}`);
        }
        
        updateProgressBar(95, '🌐 Fetching environments...');
        const environments = await fetchEnvironmentsFromGitHub(userCredentials, branchName);
        displayOutput(`Found ${environments.length} environments on GitHub`, '#aaa');
        
        updateProgressBar(100, '🎉 HARD pull completed!');
        displayOutput(`\n✅ Successfully imported ${importedCount} collections and ${environments.length} environments from branch: ${branchName}\n`, 'green');
        
        setTimeout(hideProgressBar, 1000);
    } catch (e) {
        updateProgressBar(0, '❌ HARD pull failed');
        displayOutput(`\n🔥 Error during HARD pull: ${e.message}\n`, 'red');
        setTimeout(hideProgressBar, 1500);
    }
}

async function handleGitPush(commandParams) {
    const split = commandParams.split(' ');
    const destinationBranch = localStorage.getItem("BASE_BRANCH") || 'main';
    const newBranch = split?.[0];
    let commitMsg = split.slice(1).join(' ').trim();

    if (!newBranch || !commitMsg) {
        displayOutput('❌ Invalid command! Correct usage: git push new-branch "commit message"', 'red');
        return;
    }newBranch
    if (destinationBranch.toLowerCase() == newBranch.toLowerCase()) {
        displayOutput('❌ Base branch and destination branch can\'t be same ', 'red');
        return;
    }
    
    showProgressBar();
    try {
        commitMsg = commitMsg.slice(1, commitMsg.length - 1);
        displayOutput(`\nStarting push operation to new branch: ${newBranch}`, '#aaa');
        
        updateProgressBar(10, '🔍 Validating base branch...');
        await ensureBaseBranchExists(userCredentials, destinationBranch);
        displayOutput(`Using base branch: ${destinationBranch}`, '#aaa');
        
        updateProgressBar(20, '🌱 Checking branch...');
        await createBranch(userCredentials, destinationBranch, newBranch);
        
        updateProgressBar(45, '📦 Comparing changes...');

        //const collections = await getCollections(userCredentials.POSTMAN_API_KEY);

        const changes = await getChangedCollections(userCredentials, userCredentials.BASE_BRANCH)
        // const collections = await fetchAllCollectionsFromGitHub(userCredentials, branchName);
        // displayOutput(`Found ${collections.length} collections in Postman`, '#aaa');
        const hasChanges = Object.values(changes).some(array => array.length > 0);
        if(!hasChanges){
            displayOutput(`❌ No Changes found !`, '#aaa');
            return;
        }

        const collections = [...changes.updatedCollections, ...changes.newCollections];
        if(collections.length > 0){
            updateProgressBar(60, '💾 Commiting collections to GitHub...');
            displayOutput(`Commiting collections to GitHub...`, '#aaa');
            for (let i = 0; i < collections.length; i++) {
                //await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
                const collection = collections[i];
                const filePath = `Collections/${encodeURIComponent(collection.info.name)}.json`;
                await saveToGitHub(collections, userCredentials, filePath, newBranch, `Sync collection: ${collection.info.name}`);
            }
            updateProgressBar(70, '💾 Committed collections to GitHub');
            displayOutput(` Committed collections to GitHub`, '#aaa');
        }
       //await saveToGitHubBatch(collections, userCredentials, newBranch, `Sync collections: ${commitMsg}`);
        
        //updateProgressBar(75, '🌐 Fetching environments from Postman...');
        // const environments = await getEnvironments(userCredentials.POSTMAN_API_KEY);
        const environments = [...changes.newEnvironments, ...changes.updatedEnvironments ]
        //displayOutput(`Found ${environments.length} environments in Postman`, '#aaa');
        
        if(environments.length > 0){
            updateProgressBar(80, '💾 commiting environments to GitHub...');
            const envFilePath = `Environments/environments.json`;
            await saveToGitHub(environments, userCredentials, envFilePath, newBranch, "Sync all environments");
            displayOutput(`committed environments to GitHub`, '#aaa');
        }
        
        updateProgressBar(90, '📮 Creating pull request...');
        const prUrl = await createPullRequest(userCredentials, newBranch, destinationBranch, commitMsg);
        
        updateProgressBar(100, '🎉 Push completed successfully!');
        displayOutput(`\n✅ Successfully pushed ${collections.length} collections and ${environments.length} environments to branch: ${newBranch}\n`, 'green');
        displayOutput(`🔗 Pull request: <a href="${prUrl}" target="_blank" style="color: green; text-decoration: none;">${prUrl}</a>`, 'green');
        
        setTimeout(hideProgressBar, 1000);
    } catch (e) {
        updateProgressBar(0, '❌ Push failed');
        displayOutput(`\n🔥 Error during push operation: ${e.message}\n`, 'red');
        setTimeout(hideProgressBar, 1500);
    }
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
        let errorData = response;
        try {
            errorData = await response.json();
        } catch (e) { }
        throw new Error(errorData.message || `HTTP error! status: ${response.status} - ${JSON.stringify(errorData)}`);
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

// Modified saveToGitHubBatch function
async function saveToGitHubBatch(collections, config, branch, commitMsg) {
    const repoName = config.GITHUB_REPO.split('/').pop().replace('.git', '');
    const repoOwner = config.GITHUB_USERNAME;
    const headers = {
        'Authorization': `token ${config.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
    };

    function utf8ToBase64(str) {
        return window.btoa(unescape(encodeURIComponent(str)));
    }

    try {
        // Prepare all files in a single batch
        const files = {};
        
        // First check which files already exist to get their SHAs
        updateProgressBar(45, '🔍 Checking existing files on GitHub...');
        const existingFiles = await checkExistingFiles(collections, config, branch);
        
        // Prepare the batch request
        updateProgressBar(50, '📦 Preparing batch commit...');
        for (const collection of collections) {
            const filePath = `Collections/${collection.info.name}.json`;
            files[filePath] = {
                content: utf8ToBase64(JSON.stringify(collection, null, 2)),
                sha: existingFiles[filePath]?.sha || null
            };
        }

        // Create the commit with all files
        updateProgressBar(60, '🚀 Commmiting collections...');
        const commitResponse = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/git/commits`,
            {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    message: commitMsg,
                    tree: await createTree(files, repoOwner, repoName, branch, headers),
                    parents: [await getLatestCommitSha(repoOwner, repoName, branch, headers)]
                })
            }
        );
        
        const commitData = await handleResponse(commitResponse);
        
        // Update the branch reference
        updateProgressBar(80, '🔗 Updating branch reference...');
        await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/git/refs/heads/${branch}`,
            {
                method: 'PATCH',
                headers: headers,
                body: JSON.stringify({
                    sha: commitData.sha,
                    force: false
                })
            }
        );
        
        updateProgressBar(90, '✅ Finalizing commit...');
        displayOutput(`Committed ${collections.length} collections in batch`, '#aaa');
        return true;
    } catch (error) {
        displayOutput(`Error during batch commit: ${error.message}`, 'red');
        throw error;
    }
}

// Helper functions for batch upload
async function checkExistingFiles(collections, config, branch) {
    const repoName = config.GITHUB_REPO.split('/').pop().replace('.git', '');
    const repoOwner = config.GITHUB_USERNAME;
    const headers = {
        'Authorization': `token ${config.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
    };
    
    const existingFiles = {};
    const paths = collections.map(c => `Collections/${c.info.name}.json`);
    
    // GitHub API only allows checking one file at a time
    for (const path of paths) {
        try {
            const response = await fetch(
                `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}?ref=${branch}`,
                { headers }
            );
            if (response.ok) {
                const data = await response.json();
                existingFiles[path] = { sha: data.sha };
            }
        } catch (error) {
            // File doesn't exist or other error - we'll treat as new file
            continue;
        }
    }
    
    return existingFiles;
}

async function createTree(files, repoOwner, repoName, branch, headers) {
    const tree = [];
    
    for (const [path, file] of Object.entries(files)) {
        tree.push({
            path: path,
            mode: '100644', // File mode (100644 is file)
            type: 'blob',
            sha: await createBlob(file.content, repoOwner, repoName, headers),
            ...(file.sha ? { sha: file.sha } : {})
        });
    }
    
    const response = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/git/trees`,
        {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                base_tree: await getBaseTreeSha(repoOwner, repoName, branch, headers),
                tree: tree
            })
        }
    );
    
    const data = await handleResponse(response);
    return data.sha;
}

async function createBlob(content, repoOwner, repoName, headers) {
    const response = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/git/blobs`,
        {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                content: content,
                encoding: 'base64'
            })
        }
    );
    
    const data = await handleResponse(response);
    return data.sha;
}

async function getBaseTreeSha(repoOwner, repoName, branch, headers) {
    const response = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/branches/${branch}`,
        { headers }
    );
    const data = await handleResponse(response);
    return data.commit.commit.tree.sha;
}

async function getLatestCommitSha(repoOwner, repoName, branch, headers) {
    const response = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/branches/${branch}`,
        { headers }
    );
    const data = await handleResponse(response);
    return data.commit.sha;
}

// Save content to GitHub
async function saveToGitHub(content, config, filePath, branch, message) {
    const repoName = config.GITHUB_REPO.split('/').pop().replace('.git', '');
    const repoOwner = config.GITHUB_USERNAME;
    const headers = {
        'Authorization': `token ${config.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
    };

    function utf8ToBase64(str) {
        return window.btoa(unescape(encodeURIComponent(str)));
    }

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
                    content: utf8ToBase64(JSON.stringify(content, null, 2)),
                    sha,
                    branch,
                }),
            }
        );
        await handleResponse(response);
        console.log(`File '${filePath}' saved successfully on branch '${branch}'.`);
    } catch (error) {
        displayOutput(`Error saving file '${filePath}' to GitHub: ${error.message}`, 'red');
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

    function utf8ToBase64(str) {
        return window.btoa(unescape(encodeURIComponent(str)));
    }

    const commitMessage = "Initial commit";
    const content = utf8ToBase64("# Initial Commit\nThis repository is initialized.");
    const filePath = "README.md";

    try {
        const response = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
            {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({
                    message: commitMessage,
                    content: content,
                    branch: baseBranch,
                }),
            }
        );
        await handleResponse(response);
        console.log(`Base branch '${baseBranch}' created successfully with an initial commit.`);
    } catch (error) {
        displayOutput(`Error creating initial commit: ${error.message}`, 'red');
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
        displayOutput(`Created new branch: ${newBranch}`, '#aaa');
    } catch (error) {
        if (error.message.includes('Reference already exists')){
            displayOutput(`branch '${newBranch}' already exists`, '#aaa');
            return;
        } 
        throw error;
    }
    updateProgressBar(30, 'branch created.');
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
        displayOutput('Checking for existing pull request...', '#aaa');
        const existingPR = await checkPullRequestExists(repoName, baseBranch, branchName);
        if (existingPR) {
            displayOutput(`Pull request already exists`, '#aaa');
            return existingPR;
        } 

        displayOutput('Creating new pull request...', '#aaa');
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
        displayOutput(`Pull request created successfully!`, '#aaa');
        return data.html_url;
    } catch (error) {
        displayOutput(`❌ Error creating pull request: ${error.message}`, 'red');
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
                //await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
                const fileResponse = await fetch(file.download_url);
                console.log('fetching file : ', file.name, file.download_url)
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

// Modified deleteAllPostmanCollections to return count
async function deleteAllPostmanCollections(apiKey) {
    let deletedCount = 0;
    try {
        displayOutput('Fetching existing collections...', '#aaa');
        const response = await fetch(`${postmanApiUrl}/collections`, {
            headers: { 'X-Api-Key': apiKey },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const collections = data.collections ?? [];
        displayOutput(`Found ${collections.length} collections to delete`, '#aaa');

        for (const collection of collections) {
            displayOutput(`Deleting collection: ${collection.name}`, '#aaa');
            const deleteResponse = await fetch(`${postmanApiUrl}/collections/${collection.uid}`, {
                method: 'DELETE',
                headers: { 'X-Api-Key': apiKey },
            });

            if (!deleteResponse.ok) {
                displayOutput(`Failed to delete collection: ${collection.name}`, '#aaa');
                continue;
            }
            deletedCount++;
        }

        displayOutput(`Deleted ${deletedCount} collections`, 'aaa');
        return deletedCount;
    } catch (error) {
        displayOutput('❌ Error deleting Postman collections:'+ error.message, 'red');
        throw error;
    }
}

// Push collections and environments to GitHub
async function pushOnGithub(config, newBranch, baseBranch = 'main', commitMsg) {
    await ensureBaseBranchExists(config, baseBranch);
    updateProgressBar(20, 'Creating branch...');

    await createBranch(config, baseBranch, newBranch);

    const collections = await getCollections(config.POSTMAN_API_KEY);
    //const oldCollections = await fetchAllCollectionsFromGitHub(config, baseBranch);

    for (const collection of collections) {
        const filePath = `Collections/${collection.info.name}.json`;
        await saveToGitHub(collection, config, filePath, newBranch, `Sync collection: ${collection.info.name}`);
    }

    const environments = await getEnvironments(config.POSTMAN_API_KEY);
    const envFilePath = `Environments/environments.json`;
    await saveToGitHub(environments, config, envFilePath, newBranch, "Sync all environments");

    await createPullRequest(config, newBranch, baseBranch, commitMsg);
    updateProgressBar(100, 'pull request created.');
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
       // Add progress bar container if it doesn't exist
       if (!document.getElementById('progress-container')) {
        const progressContainer = document.createElement('div');
        progressContainer.id = 'progress-container';
        progressContainer.className = 'progress-container';
        progressContainer.style.display = 'none';
        
        const progressBar = document.createElement('div');
        progressBar.id = 'progress-bar';
        progressBar.className = 'progress-bar';
        progressBar.textContent = '0%';
        
        progressContainer.appendChild(progressBar);
        document.querySelector('.terminal').appendChild(progressContainer);
    }
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



async function checkPullRequestExists(repoName, baseBranch, headBranch) {
    const repoOwner = userCredentials.GITHUB_USERNAME;
    const headers = {
        'Authorization': `token ${userCredentials.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
    };

    try {
        // More specific API query to filter PRs by head branch
        const response = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/pulls?state=open&head=${repoOwner}:${headBranch}`,
            { headers }
        );
        
        if (!response.ok) {
            // If 404, no PR exists (return false)
            if (response.status === 404) return false;
            throw new Error(`Failed to fetch pull requests: ${response.status}`);
        }

        const pullRequests = await response.json();
        
        // Since we filtered by head branch, just need to check base branch
        const existingPR = pullRequests.find(pr => pr.base.ref === baseBranch);

        if (existingPR) {
            return existingPR.html_url;
        }
        
        return false;
    } catch (error) {
        // Don't show error if it's just that no PR exists
        if (!error.message.includes('404')) {
            displayOutput(`Error checking for existing pull request: ${error.message}`, 'red');
        }
        return false;
    }
}

// Progress bar functions
function showProgressBar() {
    const progressContainer = document.getElementById('progress-container');
    progressContainer.style.display = 'block';
    updateProgressBar(0, 'Starting...');
}

function hideProgressBar() {
    const progressContainer = document.getElementById('progress-container');
    progressContainer.style.display = 'none';
}

function updateProgressBar(percent, message = '') {
    const progressBar = document.getElementById('progress-bar');
    percent = Math.min(100, Math.max(0, percent)); // Clamp between 0-100
    progressBar.style.width = `${percent}%`;
    progressBar.textContent = message || `${percent}%`;
    
    // Change color based on progress
    if (percent < 30) {
        progressBar.style.background = 'linear-gradient(90deg, #FF5722, #FF9800)';
    } else if (percent < 70) {
        progressBar.style.background = 'linear-gradient(90deg, #FF9800, #FFEB3B)';
    } else {
        progressBar.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
    }
}


async function getChangedCollections(config, branch) {
    try {
        displayOutput('Comparing Postman and GitHub collections...', '#aaa');
        
        // 1. Get data from both sources
        const [githubCollections, postmanCollections, githubEnvs, postmanEnvs] = await Promise.all([
            fetchAllCollectionsFromGitHub(config, branch).catch(() => []),
            getCollections(config.POSTMAN_API_KEY).catch(() => []),
            fetchEnvironmentsFromGitHub(config, branch).catch(() => []),
            getEnvironments(config.POSTMAN_API_KEY).catch(() => [])
        ]);

        // Helper function to parse dates safely
        const parseDate = (dateString) => {
            if (!dateString) return new Date(0); // Default to epoch if missing
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? new Date(0) : date;
        };

        // 2. Compare collections
        const changes = {
            updatedCollections: [],
            newCollections: [],
            deletedCollections: [],
            updatedEnvironments: [],
            newEnvironments: [],
            deletedEnvironments: []
        };

        // Check Postman collections against GitHub
        for (const postmanCol of postmanCollections) {
            const colName = postmanCol.info?.name;
            if (!colName) continue;

            const githubCol = githubCollections[0]?.content.find(c => c.info?.name === colName);
            
            if (!githubCol) {
                changes.newCollections.push(postmanCol);
            } else {
                const postmanDate = parseDate(postmanCol.info?.updatedAt);
                const githubDate = parseDate(githubCol.info?.updatedAt);
                
                if (postmanDate > githubDate) {
                    changes.updatedCollections.push(postmanCol);
                }
            }
        }

        // Check for deleted collections
        for (const githubCol of (githubCollections[0]?.content||[])) {
            const colName = githubCol.info?.name;
            if (!colName) continue;

            const existsInPostman = postmanCollections.some(c => c.info?.name === colName);
            if (!existsInPostman) {
                changes.deletedCollections.push(githubCol);
            }
        }

        // 3. Compare environments
        for (const postmanEnv of postmanEnvs) {
            const envName = postmanEnv.name;
            if (!envName) continue;

            const githubEnv = githubEnvs.find(e => e.name === envName);
            
            if (!githubEnv) {
                changes.newEnvironments.push(postmanEnv);
            } else {
                const postmanDate = parseDate(postmanEnv.updatedAt);
                const githubDate = parseDate(githubEnv.updatedAt);
                
                if (postmanDate > githubDate) {
                    changes.updatedEnvironments.push(postmanEnv);
                }
            }
        }

        // Check for deleted environments
        for (const githubEnv of githubEnvs) {
            const envName = githubEnv.name;
            if (!envName) continue;

            const existsInPostman = postmanEnvs.some(e => e.name === envName);
            if (!existsInPostman) {
                changes.deletedEnvironments.push(githubEnv);
            }
        }

        // 4. Display results
        displayOutput('Comparison results -> ', '#aaa');
        displayOutput(`New collections: ${changes.newCollections.length}`, '#aaa');
        displayOutput(`Updated collections: ${changes.updatedCollections.length}`, '#aaa');
        displayOutput(`Deleted collections: ${changes.deletedCollections.length}`, '#aaa');
        displayOutput(`New environments: ${changes.newEnvironments.length}`, '#aaa');
        displayOutput(`Updated environments: ${changes.updatedEnvironments.length}`, '#aaa');
        displayOutput(`Deleted environments: ${changes.deletedEnvironments.length}`, '#aaa');

        return changes;
    } catch (error) {
        displayOutput(`❌ Error comparing collections: ${error.message}`, 'red');
        throw error;
    }
}
