// Application State
let releaseNotes = []; // Raw feed entries
let parsedUpdates = []; // Parsed and flattened sub-updates
let selectedUpdate = null;
let activeHashtags = ["#BigQuery", "#GoogleCloud"];

// DOM Elements
const refreshBtn = document.getElementById('refreshBtn');
const spinnerIcon = document.getElementById('spinnerIcon');
const syncStatus = document.getElementById('syncStatus');
const statusText = document.getElementById('statusText');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const filterTags = document.getElementById('filterTags');
const timelineContainer = document.querySelector('.timeline-container');
const releasesFeed = document.getElementById('releasesFeed');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');
const emptyState = document.getElementById('emptyState');

// Composer DOM Elements
const composerPlaceholder = document.getElementById('composerPlaceholder');
const composerActive = document.getElementById('composerActive');
const composerSelectedDate = document.getElementById('composerSelectedDate');
const composerSelectedType = document.getElementById('composerSelectedType');
const tweetTextArea = document.getElementById('tweetTextArea');
const tweetCounter = document.getElementById('tweetCounter');
const includeLinkCheck = document.getElementById('includeLinkCheck');
const hashtagButtons = document.querySelectorAll('.hashtag-tag');
const tweetBtn = document.getElementById('tweetBtn');

// Initialize the Application
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes(false);
    setupEventListeners();
});

// Event Listeners Setup
function setupEventListeners() {
    // Refresh button
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    
    // Search input filtering
    searchInput.addEventListener('input', debounce(() => {
        applyFilters();
    }, 250));
    
    // Clear search
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        applyFilters();
        searchInput.focus();
    });
    
    // Category filter tags
    const filterButtons = filterTags.querySelectorAll('.filter-tag');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyFilters();
        });
    });
    
    // Tweet composer: live character counter
    tweetTextArea.addEventListener('input', updateTweetCounter);
    
    // Include link checkbox
    includeLinkCheck.addEventListener('change', () => {
        if (selectedUpdate) {
            regenerateTweet();
        }
    });
    
    // Hashtags toggling
    hashtagButtons.forEach(btn => {
        const tagValue = btn.dataset.tag;
        // Set initial active state based on activeHashtags array
        if (activeHashtags.includes(tagValue)) {
            btn.classList.add('active');
        }
        
        btn.addEventListener('click', () => {
            if (activeHashtags.includes(tagValue)) {
                activeHashtags = activeHashtags.filter(t => t !== tagValue);
                btn.classList.remove('active');
            } else {
                activeHashtags.push(tagValue);
                btn.classList.add('active');
            }
            if (selectedUpdate) {
                regenerateTweet();
            }
        });
    });
    
    // Tweet button click
    tweetBtn.addEventListener('click', () => {
        const text = tweetTextArea.value.trim();
        if (!text) return;
        
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    });
}

// Fetch Release Notes from Flask API
async function fetchReleaseNotes(forceRefresh = false) {
    showLoading();
    setStatus('syncing', forceRefresh ? 'Refreshing feed...' : 'Fetching feed...');
    
    try {
        const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
            const data = result.data;
            releaseNotes = data.entries || [];
            
            // Format status bar
            setStatus('fresh', `Last synced: ${data.fetched_at}`);
            if (data.warning) {
                console.warn(data.warning);
                setStatus('error', 'Using cached data (Refresh failed)');
            }
            
            // Process raw XML feed to flatten into categorized sub-updates
            processUpdates();
            
            // Render the elements
            applyFilters();
        } else {
            throw new Error(result.error || 'Failed to fetch release notes.');
        }
    } catch (err) {
        console.error('Error fetching release notes:', err);
        showError(err.message);
        setStatus('error', 'Failed to synchronize');
    }
}

// Parse Raw HTML summaries from Feed and segment them
function processUpdates() {
    parsedUpdates = [];
    const parser = new DOMParser();
    
    releaseNotes.forEach((entry, entryIdx) => {
        const doc = parser.parseFromString(entry.summary, 'text/html');
        const children = Array.from(doc.body.children);
        
        let currentType = 'General';
        let currentContentBlocks = [];
        let subIndex = 0;
        
        const saveCurrentSubUpdate = () => {
            if (currentContentBlocks.length > 0) {
                const contentHtml = currentContentBlocks.join('');
                parsedUpdates.push({
                    id: `${entry.id || entryIdx}_sub_${subIndex++}`,
                    entryTitle: entry.title, // Usually the Date (e.g. "June 17, 2026")
                    entryLink: entry.link,
                    entryUpdated: entry.updated,
                    type: currentType,
                    contentHtml: contentHtml,
                    // Pre-calculate search string for keyword filtering
                    searchString: `${entry.title.toLowerCase()} ${currentType.toLowerCase()} ${extractPlainText(contentHtml).toLowerCase()}`
                });
                currentContentBlocks = [];
            }
        };
        
        children.forEach(child => {
            if (child.tagName === 'H3') {
                // Save the previous section before starting a new one
                saveCurrentSubUpdate();
                
                // Set the type from the heading text
                const headingText = child.innerText.trim();
                currentType = normalizeType(headingText);
            } else {
                currentContentBlocks.push(child.outerHTML);
            }
        });
        
        // Save the last section
        saveCurrentSubUpdate();
    });
}

// Normalize release notes section types to uniform tags
function normalizeType(typeStr) {
    const lower = typeStr.toLowerCase();
    if (lower.includes('feature')) return 'Feature';
    if (lower.includes('change') || lower.includes('deprecated') || lower.includes('changed')) {
        if (lower.includes('deprecated')) return 'Deprecated';
        return 'Changed';
    }
    if (lower.includes('resolve') || lower.includes('fix') || lower.includes('bug')) return 'Resolved';
    return 'Other';
}

// Filter and render updates
function applyFilters() {
    const activeFilterTag = filterTags.querySelector('.filter-tag.active');
    const filterType = activeFilterTag ? activeFilterTag.dataset.type : 'all';
    const searchQuery = searchInput.value.toLowerCase().trim();
    
    // Filter the items
    let filtered = parsedUpdates.filter(update => {
        // 1. Filter by Category Type
        if (filterType !== 'all') {
            if (filterType === 'feature' && update.type !== 'Feature') return false;
            if (filterType === 'changed' && update.type !== 'Changed') return false;
            if (filterType === 'deprecated' && update.type !== 'Deprecated') return false;
            if (filterType === 'resolved' && update.type !== 'Resolved') return false;
        }
        
        // 2. Filter by search keyword
        if (searchQuery) {
            return update.searchString.includes(searchQuery);
        }
        
        return true;
    });
    
    renderTimeline(filtered);
}

// Render the Timeline markup
function renderTimeline(updates) {
    hideAllStates();
    releasesFeed.innerHTML = '';
    
    if (updates.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    
    // Group updates by date for presentation
    const groupedByDate = {};
    updates.forEach(up => {
        if (!groupedByDate[up.entryTitle]) {
            groupedByDate[up.entryTitle] = [];
        }
        groupedByDate[up.entryTitle].push(up);
    });
    
    // Sort dates descending (they are already sorted in feed, but keeping order is safe)
    Object.keys(groupedByDate).forEach(date => {
        const dateGroupDiv = document.createElement('div');
        dateGroupDiv.className = 'timeline-date-group';
        
        const node = document.createElement('div');
        node.className = 'timeline-node';
        dateGroupDiv.appendChild(node);
        
        const header = document.createElement('h3');
        header.className = 'date-header';
        header.innerText = date;
        
        // Optional relative date text (e.g. "Wednesday")
        const dateItems = groupedByDate[date];
        if (dateItems.length > 0 && dateItems[0].entryUpdated) {
            try {
                const dateObj = new Date(dateItems[0].entryUpdated);
                const daySpan = document.createElement('span');
                daySpan.innerText = dateObj.toLocaleDateString(undefined, { weekday: 'long' });
                header.appendChild(daySpan);
            } catch(e) {}
        }
        
        dateGroupDiv.appendChild(header);
        
        const updatesList = document.createElement('div');
        updatesList.className = 'date-updates';
        
        dateItems.forEach(update => {
            const card = document.createElement('div');
            // Class list for type highlights
            card.className = `update-card type-${update.type.toLowerCase()}`;
            card.dataset.id = update.id;
            
            if (selectedUpdate && selectedUpdate.id === update.id) {
                card.classList.add('selected');
            }
            
            card.innerHTML = `
                <div class="update-card-header">
                    <span class="update-badge">${update.type}</span>
                    <div class="card-select-checkbox">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                </div>
                <div class="update-card-content">
                    ${update.contentHtml}
                </div>
            `;
            
            // Add click event to select update card
            card.addEventListener('click', () => selectUpdateCard(update, card));
            
            updatesList.appendChild(card);
        });
        
        dateGroupDiv.appendChild(updatesList);
        releasesFeed.appendChild(dateGroupDiv);
    });
}

// Select a release card to compose a tweet
function selectUpdateCard(update, cardElement) {
    // Remove selected state from other cards
    const cards = releasesFeed.querySelectorAll('.update-card');
    cards.forEach(c => c.classList.remove('selected'));
    
    // Toggle state logic: clicking the already selected card deselects it
    if (selectedUpdate && selectedUpdate.id === update.id) {
        selectedUpdate = null;
        hideComposer();
    } else {
        selectedUpdate = update;
        cardElement.classList.add('selected');
        showComposer(update);
    }
}

// Show Composer Panel with details
function showComposer(update) {
    composerPlaceholder.classList.add('hidden');
    composerActive.classList.remove('hidden');
    
    // Set metadata labels
    composerSelectedDate.innerText = update.entryTitle;
    composerSelectedType.innerText = update.type;
    
    // Generate initial tweet text
    regenerateTweet();
}

// Hide Composer Panel and clear fields
function hideComposer() {
    composerActive.classList.add('hidden');
    composerPlaceholder.classList.remove('hidden');
    selectedUpdate = null;
}

// Generate the Tweet Text based on current active choices
function regenerateTweet() {
    if (!selectedUpdate) return;
    
    // Set icon depending on category
    let typeEmoji = "🚀";
    if (selectedUpdate.type === "Feature") typeEmoji = "⚡";
    else if (selectedUpdate.type === "Changed") typeEmoji = "⚙️";
    else if (selectedUpdate.type === "Deprecated") typeEmoji = "⚠️";
    else if (selectedUpdate.type === "Resolved") typeEmoji = "✅";
    
    // Base release title and content
    const dateStr = selectedUpdate.entryTitle;
    const plainContent = extractPlainText(selectedUpdate.contentHtml);
    
    // Construct tweet blocks
    const headerText = `${typeEmoji} BigQuery ${selectedUpdate.type} (${dateStr}): `;
    
    let hashtagsText = "";
    if (activeHashtags.length > 0) {
        hashtagsText = `\n\n${activeHashtags.join(' ')}`;
    }
    
    let linkText = "";
    if (includeLinkCheck.checked) {
        linkText = `\n\nRead more: ${selectedUpdate.entryLink}`;
    }
    
    // Tweet limit budget calculation
    // Total character limit = 280
    const overheadLength = headerText.length + linkText.length + hashtagsText.length;
    const availableForContent = 280 - overheadLength;
    
    let contentSnippet = plainContent;
    if (plainContent.length > availableForContent) {
        // Truncate cleanly and fit within character limits
        contentSnippet = plainContent.substring(0, Math.max(20, availableForContent - 4)) + "...";
    }
    
    const fullTweet = `${headerText}${contentSnippet}${linkText}${hashtagsText}`;
    
    // Fill text area
    tweetTextArea.value = fullTweet;
    updateTweetCounter();
}

// Update character counter widget style
function updateTweetCounter() {
    const textLength = tweetTextArea.value.length;
    const remaining = 280 - textLength;
    
    tweetCounter.innerText = remaining;
    
    // Reset statuses
    tweetCounter.className = 'tweet-counter';
    tweetBtn.disabled = false;
    
    if (remaining < 0) {
        tweetCounter.classList.add('danger');
        // Do not disable completely, but warn. Twitter handles over-limit alerts natively on intent if it has small overflow, 
        // but we'll show alert to guide them.
    } else if (remaining < 30) {
        tweetCounter.classList.add('warning');
    }
}

// Helper: Extract plain text content from HTML block
function extractPlainText(htmlStr) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlStr;
    
    // Remove unwanted sub-headers if any are left
    const headings = tempDiv.querySelectorAll('h3');
    headings.forEach(h => h.remove());
    
    let text = tempDiv.innerText || tempDiv.textContent || "";
    // Clean up carriage returns, double spacing, and tabs
    text = text.replace(/\r?\n|\r/g, " ");
    text = text.replace(/\s+/g, " ");
    return text.trim();
}

// Status Area Managers
function setStatus(type, msg) {
    const dot = syncStatus.querySelector('.status-dot');
    dot.className = 'status-dot';
    
    if (type === 'syncing') {
        dot.classList.add('syncing');
        spinnerIcon.classList.add('spinning');
        refreshBtn.disabled = true;
    } else if (type === 'error') {
        dot.classList.add('error');
        spinnerIcon.classList.remove('spinning');
        refreshBtn.disabled = false;
    } else {
        // Fresh state
        spinnerIcon.classList.remove('spinning');
        refreshBtn.disabled = false;
    }
    
    statusText.innerText = msg;
}

function showLoading() {
    hideAllStates();
    loadingState.classList.remove('hidden');
}

function showError(msg) {
    hideAllStates();
    errorMessage.innerText = msg;
    errorState.classList.remove('hidden');
}

function hideAllStates() {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    emptyState.classList.add('hidden');
}

// Debounce Utility for fast searches
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
