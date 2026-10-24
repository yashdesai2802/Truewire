// TrueWire — Client Controller
(function() {
  'use strict';

  // State Management
  const state = {
    allStories: [],
    filteredStories: [],
    selectedSource: 'all',
    searchQuery: '',
    activeTab: 'text',
    selectedImageFile: null,
    refreshIntervalSeconds: 300, // 5 minutes
    countdownSeconds: 300,
    countdownTimer: null,
    clockTimer: null,
    isRefreshingNews: false,
    isVerifying: false
  };

  // DOM Elements
  const DOM = {
    liveClock: document.getElementById('liveClock'),
    loadedStoriesCount: document.getElementById('loadedStoriesCount'),
    lastUpdatedTime: document.getElementById('lastUpdatedTime'),
    tickerTrack: document.getElementById('tickerTrack'),
    storiesFeed: document.getElementById('storiesFeed'),
    feedLoader: document.getElementById('feedLoader'),
    emptyFeed: document.getElementById('emptyFeed'),
    refreshCountdown: document.getElementById('refreshCountdown'),
    btnRefreshNow: document.getElementById('btnRefreshNow'),
    filterSearchInput: document.getElementById('filterSearchInput'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    btnApiSearch: document.getElementById('btnApiSearch'),
    sourceChipsContainer: document.getElementById('sourceChipsContainer'),
    btnResetFilter: document.getElementById('btnResetFilter'),

    // Verifier elements
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanels: document.querySelectorAll('.tab-panel'),
    claimTextInput: document.getElementById('claimTextInput'),
    textCharCount: document.getElementById('textCharCount'),
    claimUrlInput: document.getElementById('claimUrlInput'),
    imageDropzone: document.getElementById('imageDropzone'),
    imageFileInput: document.getElementById('imageFileInput'),
    dropzoneEmpty: document.getElementById('dropzoneEmpty'),
    dropzonePreview: document.getElementById('dropzonePreview'),
    imagePreviewImg: document.getElementById('imagePreviewImg'),
    previewFilename: document.getElementById('previewFilename'),
    previewFilesize: document.getElementById('previewFilesize'),
    btnRemoveImage: document.getElementById('btnRemoveImage'),

    btnVerify: document.getElementById('btnVerify'),
    btnSpinner: document.getElementById('btnSpinner'),
    btnText: document.querySelector('.btn-verify .btn-text'),
    verifierError: document.getElementById('verifierError'),
    errorMessageText: document.getElementById('errorMessageText'),

    // Result elements
    resultWrapper: document.getElementById('resultWrapper'),
    verdictBadge: document.getElementById('verdictBadge'),
    scoreValue: document.getElementById('scoreValue'),
    resultClaimText: document.getElementById('resultClaimText'),
    resultSummaryText: document.getElementById('resultSummaryText'),
    supportingList: document.getElementById('supportingList'),
    contradictingList: document.getElementById('contradictingList'),
    sourcesList: document.getElementById('sourcesList'),
    limitationsList: document.getElementById('limitationsList'),
    checkedTimestamp: document.getElementById('checkedTimestamp'),
    engineProviderUsed: document.getElementById('engineProviderUsed'),
    btnResetResult: document.getElementById('btnResetResult'),

    // Prototype accordion
    aboutTrigger: document.getElementById('aboutTrigger'),
    aboutDrawer: document.getElementById('aboutDrawer'),
    aboutArrow: document.getElementById('aboutArrow')
  };

  // =========================================================================
  // CLOCK & COUNTDOWN
  // =========================================================================
  function initClock() {
    function update() {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      DOM.liveClock.textContent = `${hours}:${minutes}:${seconds}`;
    }
    update();
    state.clockTimer = setInterval(update, 1000);
  }

  function startCountdown() {
    if (state.countdownTimer) clearInterval(state.countdownTimer);

    function tick() {
      state.countdownSeconds--;
      if (state.countdownSeconds <= 0) {
        state.countdownSeconds = state.refreshIntervalSeconds;
        fetchNewsStories(true);
      }
      const mins = Math.floor(state.countdownSeconds / 60);
      const secs = state.countdownSeconds % 60;
      DOM.refreshCountdown.textContent = `refreshing in ${mins}:${String(secs).padStart(2, '0')}`;
    }

    state.countdownTimer = setInterval(tick, 1000);
  }

  function resetCountdown() {
    state.countdownSeconds = state.refreshIntervalSeconds;
    const mins = Math.floor(state.countdownSeconds / 60);
    const secs = state.countdownSeconds % 60;
    DOM.refreshCountdown.textContent = `refreshing in ${mins}:${String(secs).padStart(2, '0')}`;
  }

  // =========================================================================
  // NEWS RETRIEVAL & RENDERING
  // =========================================================================
  async function fetchNewsStories(silent = false) {
    if (state.isRefreshingNews) return;
    state.isRefreshingNews = true;

    if (!silent) {
      DOM.btnRefreshNow.classList.add('loading');
      DOM.feedLoader.style.display = 'flex';
      DOM.emptyFeed.style.display = 'none';
    }

    try {
      const response = await fetch('/api/news?limit=100');
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const json = await response.json();

      if (json.success && json.data && Array.isArray(json.data.stories)) {
        state.allStories = json.data.stories;
        DOM.loadedStoriesCount.textContent = json.data.stories.length;

        const now = new Date();
        DOM.lastUpdatedTime.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        applyFilters();
        updateNewsTicker(json.data.stories);
      }
    } catch (err) {
      console.error('[TrueWire] News fetch error:', err.message);
    } finally {
      state.isRefreshingNews = false;
      DOM.btnRefreshNow.classList.remove('loading');
      DOM.feedLoader.style.display = 'none';
      resetCountdown();
    }
  }

  function updateNewsTicker(stories) {
    if (!stories || !stories.length) return;
    const topStories = stories.slice(0, 16);

    // Build ticker HTML with loop duplication for seamless scrolling
    const itemsHtml = topStories.map(s => `
      <div class="ticker-item">
        <span class="ticker-source">${escapeHtml(s.source)}</span>
        <span class="ticker-text">${escapeHtml(s.title)}</span>
      </div>
    `).join('');

    // Duplicate content twice to enable endless CSS marquee
    DOM.tickerTrack.innerHTML = itemsHtml + itemsHtml;
  }

  function applyFilters() {
    let filtered = [...state.allStories];

    // Filter by source
    if (state.selectedSource !== 'all') {
      const srcId = state.selectedSource.toLowerCase();
      filtered = filtered.filter(s =>
        s.sourceId.toLowerCase() === srcId ||
        s.source.toLowerCase().includes(srcId)
      );
    }

    // Filter by search query (local instant search)
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.source.toLowerCase().includes(q) ||
        (s.summary && s.summary.toLowerCase().includes(q))
      );
    }

    state.filteredStories = filtered;
    renderStoriesList(filtered);
  }

  function renderStoriesList(stories) {
    if (!stories || stories.length === 0) {
      DOM.storiesFeed.innerHTML = '';
      DOM.emptyFeed.style.display = 'block';
      return;
    }

    DOM.emptyFeed.style.display = 'none';

    const html = stories.map(story => {
      const cleanTitle = escapeHtml(story.title);
      const cleanSource = escapeHtml(story.source);
      const timeStr = escapeHtml(story.timeAgo || 'now');
      const rawTitleAttr = encodeURIComponent(story.title);

      return `
        <article class="story-item" data-id="${story.id}">
          <div class="story-time">${timeStr}</div>
          <div class="story-body">
            <span class="story-source">${cleanSource}</span>
            <h3 class="story-headline">${cleanTitle}</h3>
            <div class="story-actions">
              <button type="button" class="story-action-verify" data-claim="${rawTitleAttr}">
                Verify claim
              </button>
              <a href="${escapeHtml(story.link)}" target="_blank" rel="noopener noreferrer" class="story-action-link">
                Source ↗
              </a>
            </div>
          </div>
        </article>
      `;
    }).join('');

    DOM.storiesFeed.innerHTML = html;

    // Attach event listeners to "Verify claim" buttons
    DOM.storiesFeed.querySelectorAll('.story-action-verify').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rawClaim = decodeURIComponent(e.currentTarget.getAttribute('data-claim'));
        loadClaimIntoVerifier(rawClaim);
      });
    });
  }

  function loadClaimIntoVerifier(claimText) {
    switchTab('text');
    DOM.claimTextInput.value = claimText;
    updateCharCount();
    DOM.claimTextInput.focus();
    // Smooth scroll into verifier on mobile
    if (window.innerWidth < 980) {
      document.querySelector('.verifier-column').scrollIntoView({ behavior: 'smooth' });
    }
  }

  // =========================================================================
  // SOURCE CHIPS & SEARCH EVENTS
  // =========================================================================
  DOM.sourceChipsContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.source-chip');
    if (!chip) return;

    DOM.sourceChipsContainer.querySelectorAll('.source-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    state.selectedSource = chip.getAttribute('data-source') || 'all';
    applyFilters();
  });

  DOM.filterSearchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    DOM.btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
    applyFilters();
  });

  DOM.btnClearSearch.addEventListener('click', () => {
    DOM.filterSearchInput.value = '';
    state.searchQuery = '';
    DOM.btnClearSearch.style.display = 'none';
    applyFilters();
    DOM.filterSearchInput.focus();
  });

  DOM.btnResetFilter.addEventListener('click', () => {
    DOM.filterSearchInput.value = '';
    state.searchQuery = '';
    DOM.btnClearSearch.style.display = 'none';
    state.selectedSource = 'all';

    DOM.sourceChipsContainer.querySelectorAll('.source-chip').forEach(c => c.classList.remove('active'));
    DOM.sourceChipsContainer.querySelector('[data-source="all"]')?.classList.add('active');

    applyFilters();
  });

  DOM.btnRefreshNow.addEventListener('click', () => {
    fetchNewsStories(false);
  });

  // Deep remote search via /api/news/search
  async function performDeepSearch() {
    const query = DOM.filterSearchInput.value.trim();
    if (!query) return;

    DOM.feedLoader.style.display = 'flex';
    DOM.storiesFeed.innerHTML = '';
    DOM.emptyFeed.style.display = 'none';

    try {
      const res = await fetch(`/api/news/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.results)) {
        const mapped = json.results.map((r, i) => ({
          id: `deep-${i}`,
          source: r.source,
          sourceId: 'search-result',
          title: r.title,
          link: r.link,
          timeAgo: 'live',
          summary: r.summary
        }));
        renderStoriesList(mapped);
      }
    } catch (err) {
      console.warn('Deep search error:', err.message);
      applyFilters();
    } finally {
      DOM.feedLoader.style.display = 'none';
    }
  }

  DOM.btnApiSearch.addEventListener('click', performDeepSearch);
  DOM.filterSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performDeepSearch();
    }
  });

  // =========================================================================
  // TABS CONTROLLER
  // =========================================================================
  function switchTab(tabName) {
    state.activeTab = tabName;
    DOM.tabBtns.forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === tabName;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    DOM.tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `panel${capitalize(tabName)}`);
    });

    hideError();
  }

  DOM.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  function updateCharCount() {
    const len = DOM.claimTextInput.value.length;
    DOM.textCharCount.textContent = len;
  }
  DOM.claimTextInput.addEventListener('input', updateCharCount);

  // =========================================================================
  // IMAGE DRAG & DROP & PREVIEW
  // =========================================================================
  DOM.imageDropzone.addEventListener('click', (e) => {
    if (e.target.id === 'btnRemoveImage') return;
    DOM.imageFileInput.click();
  });

  DOM.imageDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.imageDropzone.classList.add('dragover');
  });

  DOM.imageDropzone.addEventListener('dragleave', () => {
    DOM.imageDropzone.classList.remove('dragover');
  });

  DOM.imageDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.imageDropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  DOM.imageFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  function handleFileSelected(file) {
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      showError('Unsupported file type. Please select a PNG, JPG, or WebP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('Image file is too large. Maximum file size is 5MB.');
      return;
    }

    state.selectedImageFile = file;
    DOM.previewFilename.textContent = file.name;
    DOM.previewFilesize.textContent = `${(file.size / 1024).toFixed(1)} KB`;

    const reader = new FileReader();
    reader.onload = (ev) => {
      DOM.imagePreviewImg.src = ev.target.result;
      DOM.dropzoneEmpty.style.display = 'none';
      DOM.dropzonePreview.style.display = 'flex';
      hideError();
    };
    reader.readAsDataURL(file);
  }

  DOM.btnRemoveImage.addEventListener('click', (e) => {
    e.stopPropagation();
    state.selectedImageFile = null;
    DOM.imageFileInput.value = '';
    DOM.imagePreviewImg.src = '';
    DOM.dropzoneEmpty.style.display = 'block';
    DOM.dropzonePreview.style.display = 'none';
  });

  // =========================================================================
  // PROTOTYPE ACCORDION DRAWER
  // =========================================================================
  DOM.aboutTrigger.addEventListener('click', () => {
    const isClosed = DOM.aboutDrawer.style.display === 'none';
    DOM.aboutDrawer.style.display = isClosed ? 'block' : 'none';
    DOM.aboutArrow.textContent = isClosed ? '▼' : '▶';
  });

  // =========================================================================
  // VERIFICATION WORKFLOW
  // =========================================================================
  DOM.btnVerify.addEventListener('click', executeVerification);

  async function executeVerification() {
    if (state.isVerifying) return;
    hideError();

    let endpoint = '';
    let payload = null;
    let isFormData = false;

    if (state.activeTab === 'text') {
      const text = DOM.claimTextInput.value.trim();
      if (!text) {
        showError('Please enter a claim, statement, or headline to verify.');
        DOM.claimTextInput.focus();
        return;
      }
      endpoint = '/api/verify/text';
      payload = JSON.stringify({ text });
    } else if (state.activeTab === 'link') {
      const url = DOM.claimUrlInput.value.trim();
      if (!url) {
        showError('Please enter a valid web article URL to verify.');
        DOM.claimUrlInput.focus();
        return;
      }
      try {
        new URL(url);
      } catch (e) {
        showError('Please enter a valid URL starting with http:// or https://');
        return;
      }
      endpoint = '/api/verify/link';
      payload = JSON.stringify({ url });
    } else if (state.activeTab === 'image') {
      if (!state.selectedImageFile) {
        showError('Please upload an image file (PNG, JPG, or WebP) to verify.');
        return;
      }
      endpoint = '/api/verify/image';
      const formData = new FormData();
      formData.append('image', state.selectedImageFile);
      payload = formData;
      isFormData = true;
    }

    setVerifyingState(true);

    try {
      const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: payload
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || `Verification failed with HTTP ${res.status}`);
      }

      renderVerificationResult(json.data);
    } catch (err) {
      console.error('[TrueWire] Verification failure:', err);
      showError(err.message || 'An unexpected verification error occurred.');
    } finally {
      setVerifyingState(false);
    }
  }

  function setVerifyingState(isVerifying) {
    state.isVerifying = isVerifying;
    DOM.btnVerify.disabled = isVerifying;
    DOM.btnSpinner.style.display = isVerifying ? 'inline-block' : 'none';
    DOM.btnText.textContent = isVerifying ? 'VERIFYING CLAIM...' : 'VERIFY THIS';
  }

  function renderVerificationResult(data) {
    if (!data) return;

    // Verdict Badge
    const verdict = data.verdict || 'UNVERIFIED';
    DOM.verdictBadge.textContent = verdict.replace(/_/g, ' ');
    DOM.verdictBadge.className = `verdict-tag ${verdict}`;

    // Reliability Score
    const confidence = typeof data.confidence === 'number' ? data.confidence : 50;
    DOM.scoreValue.textContent = `${confidence}%`;

    // Claim & Summary
    DOM.resultClaimText.textContent = data.claim || 'Analyzed Claim';
    DOM.resultSummaryText.textContent = data.summary || 'Summary evaluated against live sources.';

    // Supporting Evidence
    if (data.supportingEvidence && data.supportingEvidence.length > 0) {
      DOM.supportingList.innerHTML = data.supportingEvidence.map(e => `<li>${escapeHtml(e)}</li>`).join('');
      DOM.supportingList.parentElement.style.display = 'block';
    } else {
      DOM.supportingList.innerHTML = '<li>No corroborating evidence identified.</li>';
    }

    // Contradicting Evidence
    if (data.contradictingEvidence && data.contradictingEvidence.length > 0) {
      DOM.contradictingList.innerHTML = data.contradictingEvidence.map(e => `<li>${escapeHtml(e)}</li>`).join('');
      DOM.contradictingList.parentElement.style.display = 'block';
    } else {
      DOM.contradictingList.innerHTML = '<li>No contradicting evidence identified.</li>';
    }

    // Corroborating Sources
    if (data.sources && data.sources.length > 0) {
      DOM.sourcesList.innerHTML = data.sources.map(s => `
        <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="source-item">
          <div>
            <div class="source-item-title">${escapeHtml(s.title)}</div>
            <div style="font-size: 11px; color: #64748B; margin-top: 2px;">${escapeHtml(s.relevance || '')}</div>
          </div>
          <div class="source-item-meta">${escapeHtml(s.publisher)}</div>
        </a>
      `).join('');
      DOM.sourcesList.parentElement.style.display = 'block';
    } else {
      DOM.sourcesList.parentElement.style.display = 'none';
    }

    // Limitations
    if (data.limitations && data.limitations.length > 0) {
      DOM.limitationsList.innerHTML = data.limitations.map(l => `<li>• ${escapeHtml(l)}</li>`).join('');
      DOM.limitationsList.parentElement.style.display = 'block';
    } else {
      DOM.limitationsList.parentElement.style.display = 'none';
    }

    // Timestamp & Provider
    const checkedDate = data.checkedAt ? new Date(data.checkedAt) : new Date();
    DOM.checkedTimestamp.textContent = checkedDate.toLocaleTimeString();
    DOM.engineProviderUsed.textContent = data.providerUsed || 'Live Wire Engine';

    // Show result panel
    DOM.resultWrapper.style.display = 'flex';
    DOM.resultWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  DOM.btnResetResult.addEventListener('click', () => {
    DOM.resultWrapper.style.display = 'none';
  });

  function showError(msg) {
    DOM.errorMessageText.textContent = msg;
    DOM.verifierError.style.display = 'flex';
  }

  function hideError() {
    DOM.verifierError.style.display = 'none';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // =========================================================================
  // BOOTSTRAP
  // =========================================================================
  function init() {
    initClock();
    startCountdown();
    fetchNewsStories(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
