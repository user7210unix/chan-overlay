// DOM Elements (unchanged)
const boardsPage = document.getElementById('boards-page');
const threadsPage = document.getElementById('threads-page');
const chatPage = document.getElementById('chat-page');
const boardsList = document.getElementById('boards-list');
const favoriteBoardsList = document.getElementById('favorite-boards-list');
const favoriteBoardsSection = document.getElementById('favorite-boards');
const boardsNavList = document.getElementById('boards-nav-list');
const favoriteBoardsNavList = document.getElementById('favorite-boards-nav-list');
const boardTitle = document.getElementById('board-title');
const threadsList = document.getElementById('threads-list');
const threadTitle = document.getElementById('thread-title');
const chatMessages = document.getElementById('chat-messages');
const imageModal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const ihover = document.getElementById('ihover');
const replyPreviewPopup = document.getElementById('reply-preview-popup');
const settingsDialog = document.getElementById('settings-dialog');
const settingsClose = document.getElementById('settings-close');
const hoverZoomToggle = document.getElementById('hover-zoom-toggle');
const autoplayToggle = document.getElementById('autoplay-toggle');
const highContrastToggle = document.getElementById('high-contrast-toggle');
const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
const favoriteBoardsSelector = document.getElementById('favorite-boards-selector');
const threadTagInput = document.getElementById('thread-tag-input');
const threadTagsList = document.getElementById('thread-tags-list');
const backToThreadsBtn = document.getElementById('back-to-threads-btn');
const threadFilter = document.getElementById('thread-filter');
const threadSort = document.getElementById('thread-sort');
const mediaFilter = document.getElementById('media-filter');
const corsProxyPrompt = document.getElementById('cors-proxy-prompt');
const corsProxyBtn = document.getElementById('cors-proxy-btn');
const navDrawer = document.getElementById('nav-drawer');
const settingsToggle = document.getElementById('settings-toggle');
const settingsToggleNav = document.getElementById('settings-toggle-nav');
const closeImageModal = document.getElementById('close-image-modal');
const greeting = document.getElementById('greeting');
const datetime = document.getElementById('datetime');
const boardSearch = document.getElementById('board-search');
const searchBtn = document.getElementById('search-btn');

const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
const API_BASE = 'https://a.4cdn.org/';

let settings = {
    hoverZoom: true,
    autoplay: true,
    highContrast: false,
    autoRefresh: false,
    favoriteBoards: [],
    pinnedThreads: [],
    threadTags: [],
    taggedThreads: {},
    hasRequestedCors: false
};

let autoRefreshInterval = null;
let currentBoardCode = '';
let threadCache = new Map();
let allBoards = [];
let imageCache = new Map();

// Greeting and Date/Time
function updateGreetingAndTime() {
    if (!greeting || !datetime) return;
    const now = new Date();
    const hour = now.getHours();
    let greetingText;
    if (hour >= 5 && hour < 12) greetingText = ">Good Morning, Anon";
    else if (hour >= 12 && hour < 17) greetingText = ">Good Afternoon, Anon";
    else if (hour >= 17 && hour < 22) greetingText = ">Good Evening, Anon";
    else greetingText = ">Good Night, Anon";
    greeting.textContent = greetingText;

    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    datetime.textContent = `${day}/${month}/${year} ${hours}:${minutes}`;
}

function startClock() {
    updateGreetingAndTime();
    setInterval(updateGreetingAndTime, 1000);
}

function loadSettings() {
    try {
        const savedSettings = localStorage.getItem('settings');
        if (savedSettings) {
            settings = JSON.parse(savedSettings);
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
    applySettings();
    checkCorsProxyAccess();
}

function saveSettings() {
    try {
        localStorage.setItem('settings', JSON.stringify(settings));
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

function applySettings() {
    document.body.classList.toggle('high-contrast', settings.highContrast);
    if (highContrastToggle) highContrastToggle.checked = settings.highContrast;
    if (hoverZoomToggle) hoverZoomToggle.checked = settings.hoverZoom;
    if (autoplayToggle) autoplayToggle.checked = settings.autoplay;
    if (settings.autoRefresh && currentBoardCode) {
        startAutoRefresh();
        if (autoRefreshToggle) autoRefreshToggle.checked = true;
    } else {
        stopAutoRefresh();
        if (autoRefreshToggle) autoRefreshToggle.checked = false;
    }
}

function checkCorsProxyAccess() {
    if (!settings.hasRequestedCors && corsProxyPrompt) {
        corsProxyPrompt.classList.add('active');
        if (corsProxyBtn) {
            corsProxyBtn.addEventListener('click', () => {
                window.open(CORS_PROXY, '_blank');
                settings.hasRequestedCors = true;
                saveSettings();
                corsProxyPrompt.classList.remove('active');
            });
        }
    }
}

function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function startAutoRefresh() {
    stopAutoRefresh();
    autoRefreshInterval = setInterval(() => {
        if (currentBoardCode) fetchThreads(currentBoardCode);
    }, 30000);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

async function fetchBoards() {
    try {
        const response = await fetch(`${CORS_PROXY}${API_BASE}boards.json`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return (await response.json()).boards || [];
    } catch (error) {
        console.error('Error fetching boards:', error);
        if (boardsList) boardsList.innerHTML = '<div class="error">Unable to load boards.</div>';
        return [];
    }
}

async function initializeSearch() {
    allBoards = await fetchBoards();
    const searchSuggestions = document.getElementById('search-suggestions');

    if (!boardSearch || !searchSuggestions || !searchBtn) return;

    boardSearch.addEventListener('input', throttle(() => {
        const query = boardSearch.value.toLowerCase().trim();
        searchSuggestions.innerHTML = '';

        if (!query) {
            searchSuggestions.classList.remove('active');
            return;
        }

        const filteredBoards = allBoards.filter(board =>
            board.title.toLowerCase().includes(query) ||
            board.board.toLowerCase().includes(query) ||
            (board.meta_description && board.meta_description.toLowerCase().includes(query))
        );

        if (filteredBoards.length > 0) {
            filteredBoards.forEach(board => {
                const suggestion = document.createElement('div');
                suggestion.classList.add('suggestion-item');
                suggestion.innerHTML = `
                    <span>[/${board.board}/] ${board.title}</span>
                    <p>${board.meta_description || 'No description'}</p>
                `;
                suggestion.addEventListener('click', () => {
                    boardSearch.value = '';
                    searchSuggestions.classList.remove('active');
                    openThreads(board);
                });
                searchSuggestions.appendChild(suggestion);
            });
            searchSuggestions.classList.add('active');
        } else {
            searchSuggestions.classList.remove('active');
        }
    }, 200));

    searchBtn.addEventListener('click', () => {
        const query = boardSearch.value.toLowerCase().trim();
        const board = allBoards.find(b => b.board === query || b.title.toLowerCase() === query);
        if (board) {
            boardSearch.value = '';
            searchSuggestions.classList.remove('active');
            openThreads(board);
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchSuggestions.contains(e.target) && e.target !== boardSearch) {
            searchSuggestions.classList.remove('active');
        }
    });
}

async function loadBoards() {
    const boards = await fetchBoards();
    if (!boardsList || !favoriteBoardsList || !favoriteBoardsSection || !boardsNavList || !favoriteBoardsNavList) return;

    boardsList.innerHTML = '';
    favoriteBoardsList.innerHTML = '';
    boardsNavList.innerHTML = '';
    favoriteBoardsNavList.innerHTML = '';

    const favoriteBoards = boards.filter(board => settings.favoriteBoards.includes(board.board));
    if (favoriteBoards.length > 0) {
        favoriteBoardsSection.classList.add('active');
        favoriteBoards.forEach(board => {
            favoriteBoardsList.appendChild(createBoardItem(board));
            favoriteBoardsNavList.appendChild(createNavItem(board));
        });
    } else {
        favoriteBoardsSection.classList.remove('active');
    }

    boards.forEach(board => {
        boardsList.appendChild(createBoardItem(board));
        boardsNavList.appendChild(createNavItem(board));
    });

    if (favoriteBoardsSelector) {
        favoriteBoardsSelector.innerHTML = '';
        boards.forEach(board => {
            const item = document.createElement('div');
            item.classList.add('favorite-board-item');
            item.innerHTML = `
                <span>[/${board.board}/] ${board.title}</span>
                <label class="switch">
                    <input type="checkbox" data-board="${board.board}" ${settings.favoriteBoards.includes(board.board) ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            `;
            favoriteBoardsSelector.appendChild(item);
        });

        favoriteBoardsSelector.querySelectorAll('input').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const boardCode = checkbox.getAttribute('data-board');
                settings.favoriteBoards = checkbox.checked
                    ? [...settings.favoriteBoards, boardCode]
                    : settings.favoriteBoards.filter(code => code !== boardCode);
                saveSettings();
                loadBoards();
            });
        });
    }

    loadThreadTags();
    initializeSearch();
}

function createBoardItem(board) {
    const boardItem = document.createElement('div');
    boardItem.classList.add('board-item');
    boardItem.innerHTML = `<a href="#" data-board="${board.board}">[/${board.board}/] ${board.title}</a>`;
    boardItem.querySelector('a').addEventListener('click', (e) => {
        e.preventDefault();
        openThreads(board);
    });
    return boardItem;
}

function createNavItem(board) {
    const navItem = document.createElement('div');
    navItem.classList.add('nav-item');
    navItem.innerHTML = `<a href="#" data-board="${board.board}">[/${board.board}/] ${board.title}</a>`;
    navItem.querySelector('a').addEventListener('click', (e) => {
        e.preventDefault();
        openThreads(board);
        toggleNavDrawer();
    });
    return navItem;
}

function openThreads(board) {
    if (!boardsPage || !threadsPage || !boardTitle) return;
    currentBoardCode = board.board;
    boardsPage.classList.remove('active');
    threadsPage.classList.add('active');
    boardTitle.textContent = `[/${board.board}/] ${board.title}`;
    if (threadsList) threadsList.innerHTML = '';
    fetchThreads(board.board);
    if (settings.autoRefresh) startAutoRefresh();
}

async function fetchThreads(boardCode) {
    if (!threadsList) return;
    try {
        const response = await fetch(`${CORS_PROXY}${API_BASE}${boardCode}/catalog.json`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        await fetchRepliesForThreads(boardCode, data);
        filterAndSortThreads(data, boardCode);
    } catch (error) {
        console.error('Error fetching threads:', error);
        threadsList.innerHTML = '<div class="error">Unable to load threads.</div>';
    }
}

async function fetchRepliesForThreads(boardCode, catalogData) {
    threadCache.clear();
    const threads = catalogData.flatMap(page => page.threads);
    for (const thread of threads.slice(0, 10)) {
        try {
            const response = await fetch(`${CORS_PROXY}${API_BASE}${boardCode}/thread/${thread.no}.json`);
            if (response.ok) threadCache.set(thread.no, (await response.json()).posts);
        } catch (error) {
            console.error(`Error fetching replies for thread ${thread.no}:`, error);
        }
    }
}

function filterAndSortThreads(data, boardCode) {
    const filterQuery = threadFilter?.value.toLowerCase() || '';
    const sortOption = threadSort?.value || 'bump';
    const mediaOption = mediaFilter?.value || 'all';
    let threads = data.flatMap(page => page.threads);

    if (filterQuery) {
        threads = threads.filter(thread =>
            (thread.sub?.toLowerCase().includes(filterQuery) ||
             thread.com?.toLowerCase().includes(filterQuery))
        );
    }
    if (mediaOption === 'images') {
        threads = threads.filter(thread => thread.tim && thread.ext.match(/\.(jpg|png|gif)$/));
    } else if (mediaOption === 'videos') {
        threads = threads.filter(thread => thread.tim && thread.ext.match(/\.(mp4|webm)$/));
    }

    if (sortOption === 'replies') {
        threads.sort((a, b) => (b.replies || 0) - (a.replies || 0));
    } else if (sortOption === 'recent') {
        threads.sort((a, b) => (b.last_modified || 0) - (a.last_modified || 0));
    }

    if (settings.pinnedThreads.length > 0) {
        threads.sort((a, b) => {
            const aPinned = settings.pinnedThreads.includes(`${boardCode}:${a.no}`) ? 1 : 0;
            const bPinned = settings.pinnedThreads.includes(`${boardCode}:${b.no}`) ? 1 : 0;
            return bPinned - aPinned;
        });
    }

    displayThreads(threads, boardCode);
}

function togglePinThread(boardCode, threadNo) {
    const threadId = `${boardCode}:${threadNo}`;
    settings.pinnedThreads = settings.pinnedThreads.includes(threadId)
        ? settings.pinnedThreads.filter(id => id !== threadId)
        : [...settings.pinnedThreads, threadId];
    saveSettings();
    fetchThreads(boardCode);
}

function toggleThreadTag(boardCode, threadNo, tag) {
    const threadId = `${boardCode}:${threadNo}`;
    if (!settings.taggedThreads[threadId]) settings.taggedThreads[threadId] = [];
    settings.taggedThreads[threadId] = settings.taggedThreads[threadId].includes(tag)
        ? settings.taggedThreads[threadId].filter(t => t !== tag)
        : [...settings.taggedThreads[threadId], tag];
    if (settings.taggedThreads[threadId].length === 0) delete settings.taggedThreads[threadId];
    saveSettings();
    fetchThreads(boardCode);
}

function loadThreadTags() {
    if (!threadTagsList) return;
    threadTagsList.innerHTML = '';
    settings.threadTags.forEach(tag => {
        const item = document.createElement('div');
        item.classList.add('thread-tag-item');
        item.innerHTML = `
            <span>${tag}</span>
            <button data-tag="${tag}">[/delete/]</button>
        `;
        threadTagsList.appendChild(item);
    });

    threadTagsList.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
            const tag = button.getAttribute('data-tag');
            settings.threadTags = settings.threadTags.filter(t => t !== tag);
            Object.keys(settings.taggedThreads).forEach(threadId => {
                settings.taggedThreads[threadId] = settings.taggedThreads[threadId].filter(t => t !== tag);
                if (settings.taggedThreads[threadId].length === 0) delete settings.taggedThreads[threadId];
            });
            saveSettings();
            loadThreadTags();
        });
    });
}

function addThreadTag() {
    if (!threadTagInput) return;
    const tag = threadTagInput.value.trim();
    if (tag && !settings.threadTags.includes(tag)) {
        settings.threadTags.push(tag);
        saveSettings();
        loadThreadTags();
        threadTagInput.value = '';
    }
}

function sanitizeComment(comment) {
    if (!comment) return '<p>No content</p>';
    const div = document.createElement('div');
    div.innerHTML = comment.replace(/<br>/g, '\n');
    let text = div.textContent || div.innerText || '';
    if (!text.trim()) return '<p>>>Reply</p>';
    return text.split('\n').map(line => {
        line = line.trim();
        if (line.startsWith('>') && !line.startsWith('>>')) {
            return `<span class="greentext">${line}</span>`;
        } else if (line.startsWith('>>')) {
            const match = line.match(/>>(\d+)/);
            if (match) {
                return `<span class="reply-link" data-post-no="${match[1]}">${line}</span>`;
            }
            return `<p>${line}</p>`;
        }
        return `<p>${line}</p>`;
    }).join('');
}

function displayThreads(threads, boardCode) {
    if (!threadsList) return;
    threadsList.innerHTML = '';
    for (const thread of threads) {
        const threadItem = document.createElement('div');
        threadItem.classList.add('thread-item');
        const threadId = `${boardCode}:${thread.no}`;
        if (settings.pinnedThreads.includes(threadId)) threadItem.classList.add('pinned');

        const content = document.createElement('div');
        content.classList.add('content');

        if (thread.tim && thread.ext) {
            const imageContainer = document.createElement('div');
            imageContainer.classList.add('image-container');
            const img = document.createElement('img');
            img.src = `https://i.4cdn.org/${boardCode}/${thread.tim}${thread.ext}`;
            img.dataset.fileID = `${boardCode}:${thread.no}:0`;
            img.onerror = () => img.style.display = 'none';
            if (settings.hoverZoom) {
                img.addEventListener('mouseover', (e) => showImageHover(boardCode, thread, img, e));
                img.addEventListener('mouseout', hideImageHover);
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideImageHover();
                    openImageModal(img.src);
                });
            }
            imageContainer.appendChild(img);
            content.appendChild(imageContainer);
        }

        const threadInfo = document.createElement('div');
        threadInfo.classList.add('thread-info');

        const title = document.createElement('div');
        title.classList.add('thread-title');
        title.textContent = thread.sub || `Thread #${thread.no}`;

        const username = document.createElement('div');
        username.classList.add('username');
        username.textContent = `${thread.name || 'Anonymous'} #${thread.no}`;

        const preview = document.createElement('div');
        preview.classList.add('thread-preview');
        let previewText = thread.com ? thread.com.replace(/<[^>]+>/g, '').substring(0, 100) : '';
        if (previewText.length >= 100) previewText += '...';
        preview.textContent = previewText || 'No preview available';

        const stats = document.createElement('div');
        stats.classList.add('thread-stats');
        stats.textContent = `Replies: ${thread.replies || 0} | Images: ${thread.images || 0}`;

        const tags = settings.taggedThreads[threadId] || [];
        if (tags.length > 0) {
            const tagsDiv = document.createElement('div');
            tagsDiv.classList.add('thread-tags');
            tagsDiv.textContent = `Tags: ${tags.join(', ')}`;
            threadInfo.appendChild(tagsDiv);
        }

        const pinButton = document.createElement('button');
        pinButton.classList.add('pin-button');
        pinButton.textContent = settings.pinnedThreads.includes(threadId) ? '[/unpin/]' : '[/pin/]';
        pinButton.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePinThread(boardCode, thread.no);
        });

        const tagButton = document.createElement('button');
        tagButton.classList.add('tag-button');
        tagButton.textContent = '[/tag/]';
        tagButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const tag = prompt('Enter tag:', tags[0] || '');
            if (tag && settings.threadTags.includes(tag)) {
                toggleThreadTag(boardCode, thread.no, tag);
            } else if (tag) {
                alert('Add the tag in Settings first.');
            }
        });

        const openButton = document.createElement('button');
        openButton.classList.add('open-button');
        openButton.textContent = '[/open/]';
        openButton.addEventListener('click', (e) => {
            e.stopPropagation();
            openThread(boardCode, thread);
        });

        threadInfo.appendChild(title);
        threadInfo.appendChild(username);
        threadInfo.appendChild(preview);
        threadInfo.appendChild(stats);
        content.appendChild(threadInfo);
        threadItem.appendChild(pinButton);
        threadItem.appendChild(tagButton);
        threadItem.appendChild(openButton);
        threadItem.appendChild(content);

        const repliesPreview = document.createElement('div');
        repliesPreview.classList.add('replies-preview');
        const posts = threadCache.get(thread.no) || [];
        posts.slice(-2).forEach(post => {
            if (post.no !== thread.no) {
                const reply = document.createElement('div');
                reply.classList.add('reply-preview-item');
                let html = `<div class="username">${post.name || 'Anonymous'} #${post.no} <span class="timestamp">${formatTimestamp(post.time)}</span></div>`;
                const comment = sanitizeComment(post.com);
                if (comment) html += `<div>${comment.replace(/<span class="reply-link"[^>]+>[^<]+<\/span>/g, '').substring(0, 50)}${comment.length > 50 ? '...' : ''}</div>`;
                if (post.tim && post.ext) {
                    html += `<img src="https://i.4cdn.org/${boardCode}/${post.tim}${post.ext}" data-fileID="${boardCode}:${post.no}:${posts.indexOf(post)}" onerror="this.style.display='none'">`;
                }
                reply.innerHTML = html;
                if (settings.hoverZoom) {
                    const img = reply.querySelector('img');
                    if (img) {
                        img.addEventListener('mouseover', (e) => showImageHover(boardCode, post, img, e));
                        img.addEventListener('mouseout', hideImageHover);
                        img.addEventListener('click', (e) => {
                            e.stopPropagation();
                            hideImageHover();
                            openImageModal(img.src);
                        });
                    }
                }
                repliesPreview.appendChild(reply);
            }
        });
        if (posts.length > 1) threadItem.appendChild(repliesPreview);

        threadItem.addEventListener('click', () => openThread(boardCode, thread));
        threadsList.appendChild(threadItem);
    }
}

function showImageHover(boardCode, post, thumb, event) {
    if (!settings.hoverZoom || !ihover || !document.contains(thumb)) return;
    const fileID = thumb.dataset.fileID;
    const isVideo = post.ext?.match(/\.(mp4|webm)$/);
    let el;

    if (imageCache.has(fileID)) {
        el = imageCache.get(fileID);
        el.style.display = '';
    } else {
        el = document.createElement(isVideo ? 'video' : 'img');
        el.id = 'ihover-content';
        el.dataset.fileID = fileID;
        el.src = `https://i.4cdn.org/${boardCode}/${post.tim}${post.ext}`;
        if (isVideo) {
            el.loop = true;
            el.controls = false;
            if (settings.autoplay) el.play().catch(() => {});
        }
        el.addEventListener('error', () => {
            setTimeout(() => {
                if (el.src === `https://i.4cdn.org/${boardCode}/${post.tim}${post.ext}`) {
                    el.src = `${el.src}?${Date.now()}`;
                } else {
                    hideImageHover();
                }
            }, 3000);
        });
        imageCache.set(fileID, el);
    }

    ihover.innerHTML = '';
    ihover.appendChild(el);
    ihover.classList.add('active');

    // Position near cursor
    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.9;
    let width = post.w || el.naturalWidth || maxWidth;
    let height = post.h || el.naturalHeight || maxHeight;
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    width *= scale;
    height *= scale;
    el.style.maxWidth = `${width}px`;
    el.style.maxHeight = `${height}px`;

    let left = event.clientX + 10;
    let top = event.clientY + 10;
    const rect = ihover.getBoundingClientRect();
    if (left + width + 20 > window.innerWidth) left = window.innerWidth - width - 20;
    if (top + height + 20 > window.innerHeight) top = window.innerHeight - height - 20;
    if (left < 0) left = 10;
    if (top < 0) top = 10;
    ihover.style.left = `${left}px`;
    ihover.style.top = `${top}px`;

    // Update position on mousemove
    const onMouseMove = (e) => {
        let newLeft = e.clientX + 10;
        let newTop = e.clientY + 10;
        if (newLeft + width + 20 > window.innerWidth) newLeft = window.innerWidth - width - 20;
        if (newTop + height + 20 > window.innerHeight) newTop = window.innerHeight - height - 20;
        if (newLeft < 0) newLeft = 10;
        if (newTop < 0) newTop = 10;
        ihover.style.left = `${newLeft}px`;
        ihover.style.top = `${newTop}px`;
    };

    document.addEventListener('mousemove', onMouseMove);
    ihover.dataset.mouseMoveHandler = 'active';

    // Clean up
    const cleanup = () => {
        document.removeEventListener('mousemove', onMouseMove);
        ihover.dataset.mouseMoveHandler = '';
    };
    ihover.addEventListener('mouseout', () => { cleanup(); hideImageHover(); }, { once: true });
    ihover.addEventListener('click', () => { cleanup(); hideImageHover(); }, { once: true });
}

function hideImageHover() {
    if (!ihover) return;
    const el = ihover.querySelector('#ihover-content');
    if (el) {
        if (el.tagName === 'VIDEO') el.pause();
        el.style.display = 'none';
    }
    ihover.classList.remove('active');
    ihover.style.left = '';
    ihover.style.top = '';
}

function openThread(boardCode, thread) {
    if (!threadsPage || !chatPage || !threadTitle || !chatMessages) return;
    threadsPage.classList.remove('active');
    chatPage.classList.add('active');
    threadTitle.textContent = thread.sub || `Thread #${thread.no}`;
    chatMessages.innerHTML = '';
    fetchThreadMessages(boardCode, thread.no);
    stopAutoRefresh();
}

async function fetchThreadMessages(boardCode, threadNo) {
    try {
        const response = await fetch(`${CORS_PROXY}${API_BASE}${boardCode}/thread/${threadNo}.json`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        threadCache.set(threadNo, data.posts);
        displayMessages(boardCode, data.posts, threadNo);
    } catch (error) {
        console.error('Error fetching thread messages:', error);
        chatMessages.innerHTML = '<div class="error">Unable to load messages.</div>';
    }
}

function formatTimestamp(unixTime) {
    const date = new Date(unixTime * 1000);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function buildReplyTree(posts) {
    const postMap = new Map(posts.map(post => [post.no, { ...post, replies: [] }]));
    const tree = [];

    posts.forEach(post => {
        const match = post.com?.match(/>>(\d+)/g);
        if (match) {
            const parentIds = match.map(m => parseInt(m.replace('>>', '')));
            parentIds.forEach(parentId => {
                const parent = postMap.get(parentId);
                if (parent) {
                    parent.replies.push(postMap.get(post.no));
                } else {
                    tree.push(postMap.get(post.no));
                }
            });
        } else {
            tree.push(postMap.get(post.no));
        }
    });

    return tree;
}

function displayMessages(boardCode, posts, threadNo) {
    if (!chatMessages) return;
    const postMap = new Map(posts.map(post => [post.no, post]));
    const tree = buildReplyTree(posts);
    const opPostNo = posts[0]?.no;

    function renderPost(post, depth = 0) {
        const message = document.createElement('div');
        message.id = `post-${post.no}`;
        message.classList.add('message');
        if (post.no === opPostNo) message.classList.add('op');
        if (post.replies.length > 0 || post.com?.match(/>>(\d+)/)) message.classList.add('reply');
        message.style.marginLeft = `${depth * 20}px`;

        let commentHtml = sanitizeComment(post.com);
        commentHtml = commentHtml.replace(/>>(\d+)/g, `<span class="reply-link" data-post-no="$1">>>$1</span>`);
        if (!commentHtml.trim()) commentHtml = '<p>>>Reply</p>';

        let html = `
            <div class="username">
                ${post.name || 'Anonymous'} #${post.no}
                ${post.no === opPostNo ? '<span class="op-tag">OP</span>' : ''}
                <span class="timestamp">${formatTimestamp(post.time)}</span>
            </div>
            <div class="message-content">${commentHtml}</div>
        `;
        if (post.tim && post.ext) {
            html += `<img src="https://i.4cdn.org/${boardCode}/${post.tim}${post.ext}" data-fileID="${boardCode}:${threadNo}:${posts.indexOf(post)}" data-fullsrc="https://i.4cdn.org/${boardCode}/${post.tim}${post.ext}" onerror="this.style.display='none'" class="message-image">`;
        }

        message.innerHTML = html;

        const img = message.querySelector('.message-image');
        if (img) {
            img.addEventListener('click', () => openImageModal(img.getAttribute('data-fullsrc')));
            if (settings.hoverZoom) {
                img.addEventListener('mouseover', (e) => showImageHover(boardCode, post, img, e));
                img.addEventListener('mouseout', hideImageHover);
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideImageHover();
                });
            }
        }

        chatMessages.appendChild(message);

        post.replies.forEach(reply => renderPost(reply, depth + 1));
    }

    tree.forEach(post => renderPost(post));

    chatMessages.querySelectorAll('.reply-link').forEach(link => {
        link.addEventListener('mouseenter', (e) => showReplyPreview(link, postMap, boardCode, e));
        link.addEventListener('mouseleave', hideReplyPreview);
        link.addEventListener('click', () => scrollToPost(link.getAttribute('data-post-no')));
    });
}

function showReplyPreview(link, postMap, boardCode, e) {
    if (!replyPreviewPopup) return;
    const postNo = link.getAttribute('data-post-no');
    const post = postMap.get(parseInt(postNo));
    if (!post) return;

    let commentHtml = sanitizeComment(post.com);
    commentHtml = commentHtml.replace(/>>(\d+)/g, `<span class="reply-link" data-post-no="$1">>>$1</span>`);
    if (!commentHtml.trim()) commentHtml = '<p>>>Reply</p>';

    // Ensure content matches thread message exactly
    const html = `
        <div class="username">
            ${post.name || 'Anonymous'} #${post.no}
            <span class="timestamp">${formatTimestamp(post.time)}</span>
        </div>
        <div class="message-content">${commentHtml}</div>
        ${post.tim && post.ext ? `<img src="https://i.4cdn.org/${boardCode}/${post.tim}${post.ext}" onerror="this.style.display='none'">` : ''}
    `;

    replyPreviewPopup.innerHTML = html;
    replyPreviewPopup.classList.add('active');

    // Position near cursor
    let left = e.clientX + 10;
    let top = e.clientY + 10;
    const rect = replyPreviewPopup.getBoundingClientRect();
    if (left + rect.width + 10 > window.innerWidth) left = window.innerWidth - rect.width - 10;
    if (top + rect.height + 10 > window.innerHeight) top = window.innerHeight - rect.height - 10;
    if (left < 0) left = 10;
    if (top < 0) top = 10;
    replyPreviewPopup.style.left = `${left}px`;
    replyPreviewPopup.style.top = `${top}px`;
}

function hideReplyPreview() {
    if (!replyPreviewPopup) return;
    replyPreviewPopup.classList.remove('active');
    replyPreviewPopup.innerHTML = '';
    replyPreviewPopup.style.left = '';
    replyPreviewPopup.style.top = '';
}

function scrollToPost(postNo) {
    const post = document.getElementById(`post-${postNo}`);
    if (post) {
        post.scrollIntoView({ behavior: 'smooth' });
        post.style.background = 'rgba(75, 142, 247, 0.1)';
        setTimeout(() => post.style.background = '', 1000);
    }
}

function openImageModal(src) {
    if (!modalImage || !imageModal) return;
    modalImage.src = src;
    imageModal.classList.add('active');
}

function closeImageModalHandler() {
    if (!imageModal) return;
    imageModal.classList.remove('active');
    modalImage.src = '';
}

function toggleSettingsDialog(e) {
    e.preventDefault();
    if (settingsDialog) settingsDialog.classList.toggle('active');
}

function toggleNavDrawer() {
    if (navDrawer) navDrawer.classList.toggle('active');
}

if (backToThreadsBtn) {
    backToThreadsBtn.addEventListener('click', () => {
        chatPage.classList.remove('active');
        threadsPage.classList.add('active');
        if (settings.autoRefresh) startAutoRefresh();
    });
}

if (imageModal) imageModal.addEventListener('click', (e) => { if (e.target === imageModal) closeImageModalHandler(); });
if (closeImageModal) closeImageModal.addEventListener('click', closeImageModalHandler);

[settingsToggle, settingsToggleNav].forEach(toggle => {
    if (toggle) toggle.addEventListener('click', toggleSettingsDialog);
});

if (settingsClose) settingsClose.addEventListener('click', toggleSettingsDialog);

if (hoverZoomToggle) {
    hoverZoomToggle.addEventListener('change', () => {
        settings.hoverZoom = hoverZoomToggle.checked;
        saveSettings();
    });
}

if (autoplayToggle) {
    autoplayToggle.addEventListener('change', () => {
        settings.autoplay = autoplayToggle.checked;
        saveSettings();
    });
}

if (highContrastToggle) {
    highContrastToggle.addEventListener('change', () => {
        settings.highContrast = highContrastToggle.checked;
        saveSettings();
        applySettings();
    });
}

if (autoRefreshToggle) {
    autoRefreshToggle.addEventListener('change', () => {
        settings.autoRefresh = autoRefreshToggle.checked;
        saveSettings();
        applySettings();
    });
}

if (threadTagInput) {
    threadTagInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addThreadTag();
    });
}

if (threadFilter) threadFilter.addEventListener('input', debounce(() => fetchThreads(currentBoardCode), 300));
if (threadSort) threadSort.addEventListener('change', () => fetchThreads(currentBoardCode));
if (mediaFilter) mediaFilter.addEventListener('change', () => fetchThreads(currentBoardCode));

// Initialize
loadBoards();
startClock();
