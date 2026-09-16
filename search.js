  const API_ENDPOINT = 'https://search.xerrortm.workers.dev/search?q=';
  const RECENT_KEY = 'xsearch_recent_searches';
  let currentQuery = '';
  let isListening = false;
  let recognition = null;
  let acIndex = -1;
  let acItemsCache = [];

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderRecentSearches();
    checkUrlQuery();
    setupSpeechRecognition();
    setupKeyboardShortcuts();
    setupGlobalDismiss();
    window.addEventListener('scroll', () => {
      document.getElementById('back-to-top').classList.toggle('hidden', window.scrollY < 400);
    });
  });

  function setupKeyboardShortcuts(){
    document.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && activeTag !== 'input')) {
        e.preventDefault();
        const target = document.getElementById('hero-view').classList.contains('hidden')
          ? document.getElementById('top-search-input') : document.getElementById('hero-search-input');
        target?.focus(); target?.select();
      }
      if (e.key === 'Escape') { closeLightbox(); closeAbout(); hideAllAc(); }
    });
  }

  function setupGlobalDismiss(){
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#hero-search-wrap')) hideAc('hero');
      if (!e.target.closest('#top-search-wrap')) hideAc('top');
    });
  }

  // ---------- storage ----------
  function getRecentSearches(){
    try { const s = localStorage.getItem(RECENT_KEY); const p = s ? JSON.parse(s) : []; return Array.isArray(p) ? p : []; }
    catch(e){ return []; }
  }
  function saveRecentSearch(query){
    if (!query || !query.trim()) return;
    const clean = query.trim();
    try {
      let searches = getRecentSearches().filter(q => q.toLowerCase() !== clean.toLowerCase());
      searches.unshift(clean);
      localStorage.setItem(RECENT_KEY, JSON.stringify(searches.slice(0, 8)));
      renderRecentSearches();
    } catch(e){}
  }
  function clearRecentSearches(){
    try { localStorage.removeItem(RECENT_KEY); renderRecentSearches(); } catch(e){}
  }
  function renderRecentSearches(){
    const container = document.getElementById('recent-searches-container');
    const list = document.getElementById('recent-searches-list');
    const searches = getRecentSearches();
    if (!searches.length){ container.classList.add('hidden'); list.innerHTML=''; return; }
    container.classList.remove('hidden');
    list.innerHTML = searches.map(s => `
      <button type="button" onclick="executeSearch('${escapeAttr(s)}')"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 hover:border-brand-400 dark:hover:border-brand-500 rounded-full text-xs text-ink-600 dark:text-ink-300 font-medium transition-all hover:scale-[1.02] active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
        <svg class="w-3 h-3 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <span>${escapeHtml(s)}</span>
      </button>`).join('');
  }

  // ---------- autocomplete ----------
  function renderAutocomplete(source){
    const input = document.getElementById(`${source}-search-input`);
    const panel = document.getElementById(`${source}-ac-panel`);
    const q = input.value.trim();
    const recents = getRecentSearches();
    let matches = q ? recents.filter(r => r.toLowerCase().includes(q.toLowerCase()) && r.toLowerCase() !== q.toLowerCase()) : recents;
    matches = matches.slice(0, 5);

    const rows = [];
    if (q) rows.push({ type:'go', label:q });
    matches.forEach(m => rows.push({ type:'recent', label:m }));

    if (!rows.length){ panel.classList.add('hidden'); panel.innerHTML=''; acItemsCache=[]; return; }
    acItemsCache = rows; acIndex = -1;

    panel.innerHTML = rows.map((r, i) => `
      <button type="button" data-ac-index="${i}" onclick="selectAc('${source}', ${i})"
        class="ac-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-ink-700 dark:text-ink-200 transition-colors">
        <svg class="w-4 h-4 text-ink-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          ${r.type === 'go'
            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>'
            : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>'}
        </svg>
        <span class="line-clamp-1">${r.type === 'go' ? `Search for “${escapeHtml(r.label)}”` : escapeHtml(r.label)}</span>
      </button>`).join('');
    panel.classList.remove('hidden');
  }
  function hideAc(source){ document.getElementById(`${source}-ac-panel`).classList.add('hidden'); acIndex=-1; }
  function hideAllAc(){ hideAc('hero'); hideAc('top'); }
  function selectAc(source, i){
    const row = acItemsCache[i]; if (!row) return;
    hideAc(source);
    executeSearch(row.label);
  }
  function handleAcKeydown(e, source){
    const panel = document.getElementById(`${source}-ac-panel`);
    if (panel.classList.contains('hidden') || !acItemsCache.length) return;
    const items = panel.querySelectorAll('.ac-item');
    if (e.key === 'ArrowDown'){ e.preventDefault(); acIndex = Math.min(acIndex+1, items.length-1); updateAcActive(items); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); acIndex = Math.max(acIndex-1, 0); updateAcActive(items); }
    else if (e.key === 'Enter' && acIndex >= 0){ e.preventDefault(); selectAc(source, acIndex); }
  }
  function updateAcActive(items){ items.forEach((el,i)=> el.classList.toggle('active', i===acIndex)); }

  // ---------- theme ----------
  function initTheme(){
    const saved = localStorage.getItem('xsearch_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = saved === 'dark' || (!saved && prefersDark);
    document.documentElement.classList.toggle('dark', dark);
    document.getElementById('sun-icon').classList.toggle('hidden', !dark);
    document.getElementById('moon-icon').classList.toggle('hidden', dark);
  }
  function toggleTheme(){
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('xsearch_theme', isDark ? 'dark' : 'light');
    document.getElementById('sun-icon').classList.toggle('hidden', !isDark);
    document.getElementById('moon-icon').classList.toggle('hidden', isDark);
  }

  // ---------- view state ----------
  function checkUrlQuery(){
    const q = new URLSearchParams(window.location.search).get('q');
    if (q && q.trim()) executeSearch(q.trim());
  }
  function showResultsView(){
    document.getElementById('hero-view').classList.add('hidden');
    document.getElementById('results-view').classList.remove('hidden');
  }
  function resetToHome(e){
    if (e) e.preventDefault();
    currentQuery = '';
    ['hero','top'].forEach(s => { document.getElementById(`${s}-search-input`).value=''; clearInput(s); hideAc(s); });
    document.getElementById('results-view').classList.add('hidden');
    document.getElementById('hero-view').classList.remove('hidden');
    renderRecentSearches();
    try { window.history.pushState({}, '', window.location.pathname); } catch(e){}
    setTimeout(() => document.getElementById('hero-search-input').focus(), 80);
  }
  function handleInputChange(source){
    const input = document.getElementById(`${source}-search-input`);
    document.getElementById(`${source}-clear-btn`).classList.toggle('hidden', input.value.trim().length === 0);
    renderAutocomplete(source);
  }
  function clearInput(source){
    const input = document.getElementById(`${source}-search-input`);
    input.value=''; input.focus();
    document.getElementById(`${source}-clear-btn`).classList.add('hidden');
    hideAc(source);
  }
  function handleSearch(e, source){
    e.preventDefault();
    hideAc(source);
    const q = document.getElementById(`${source}-search-input`).value.trim();
    if (q) executeSearch(q);
  }
  function retrySearch(){ if (currentQuery) executeSearch(currentQuery); }

  // ---------- search ----------
  async function executeSearch(query){
    currentQuery = query;
    ['hero','top'].forEach(s => { document.getElementById(`${s}-search-input`).value = query; handleInputChange(s); hideAc(s); });
    saveRecentSearch(query);

    try {
      const newUrl = `${window.location.pathname}?q=${encodeURIComponent(query)}`;
      window.history.pushState({ path:newUrl }, '', newUrl);
    } catch(e){}

    showResultsView();
    document.getElementById('loading-state').classList.remove('hidden');
    document.getElementById('results-list').innerHTML = '';
    document.getElementById('results-meta').classList.add('hidden');
    document.getElementById('didyoumean').classList.add('hidden');
    document.getElementById('related-searches').classList.add('hidden');
    document.getElementById('error-state').classList.add('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    window.scrollTo({top:0});

    const t0 = performance.now();
    try {
      const response = await fetch(`${API_ENDPOINT}${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
      document.getElementById('loading-state').classList.add('hidden');

      if (!data.results || !Array.isArray(data.results) || data.results.length === 0){
        document.getElementById('empty-state').classList.remove('hidden');
        return;
      }

      const meta = document.getElementById('results-meta');
      const count = typeof data.total === 'number' ? data.total : data.results.length;
      meta.innerHTML = `${count.toLocaleString()} result${count===1?'':'s'} <span class="text-ink-300 dark:text-ink-700">·</span> ${elapsed}s`;
      meta.classList.remove('hidden');

      const suggestion = data.suggestion || data.corrected_query || data.did_you_mean;
      if (suggestion && suggestion.toLowerCase() !== query.toLowerCase()){
        const dym = document.getElementById('didyoumean');
        dym.innerHTML = `Did you mean: <button onclick="executeSearch('${escapeAttr(suggestion)}')" class="text-brand-600 dark:text-brand-400 font-medium italic hover:underline">${escapeHtml(suggestion)}</button>?`;
        dym.classList.remove('hidden');
      }

      const sorted = [...data.results].sort((a,b) => (typeof b.score==='number'?b.score:0) - (typeof a.score==='number'?a.score:0));
      renderResults(sorted, data.images || []);

      const related = data.related || data.related_searches || data.suggestions;
      if (Array.isArray(related) && related.length){
        const box = document.getElementById('related-searches');
        box.innerHTML = `
          <h3 class="text-xs font-semibold text-ink-400 dark:text-ink-500 mb-3">Related searches</h3>
          <div class="flex flex-wrap gap-2">
            ${related.slice(0,8).map(r => `
              <button onclick="executeSearch('${escapeAttr(r)}')" class="px-3 py-1.5 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 hover:border-brand-400 dark:hover:border-brand-500 rounded-full text-xs text-ink-600 dark:text-ink-300 transition-all hover:scale-[1.02]">${escapeHtml(r)}</button>
            `).join('')}
          </div>`;
        box.classList.remove('hidden');
      }
    } catch(err){
      console.error('Search request failed:', err);
      document.getElementById('loading-state').classList.add('hidden');
      document.getElementById('error-message').textContent = 'Couldn\'t reach the search service. Check your connection and try again.';
      document.getElementById('error-state').classList.remove('hidden');
    }
  }

  function renderResults(results, images){
    const container = document.getElementById('results-list');
    container.innerHTML = '';
    results.forEach((item, index) => {
      const domain = getDomain(item.url);
      const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
      const row = document.createElement('div');
      row.className = 'result-row';
      row.innerHTML = `
        <div class="flex items-center gap-2 mb-1">
          <img src="${favicon}" alt="" class="w-4 h-4 rounded-sm object-contain bg-ink-100 dark:bg-ink-800" onerror="this.style.display='none'"/>
          <span class="text-xs text-ink-500 dark:text-ink-400 line-clamp-1">${escapeHtml(domain)}</span>
          <span class="text-xs text-ink-300 dark:text-ink-700">·</span>
          <span class="text-xs text-ink-400 dark:text-ink-600 line-clamp-1">${escapeHtml(item.url)}</span>
        </div>
        <h2 class="text-[1.15rem] font-medium leading-snug mb-1">
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="text-brand-700 dark:text-brand-400 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500/30 rounded">${escapeHtml(item.title || item.url)}</a>
        </h2>
        <p class="text-[0.9rem] text-ink-500 dark:text-ink-400 leading-relaxed line-clamp-2">${escapeHtml(item.content || 'No description available for this result.')}</p>
      `;
      container.appendChild(row);
      if (index === 0 && Array.isArray(images) && images.length){
        const imgSection = createImagesSection(images);
        if (imgSection) container.appendChild(imgSection);
      }
    });
  }

  function createImagesSection(images){
    const valid = images.filter(Boolean);
    if (!valid.length) return null;
    const section = document.createElement('div');
    section.className = 'my-3 py-4 border-y border-ink-100 dark:border-ink-900';
    const items = valid.map((img, i) => {
      let url='', target='', alt='Result image';
      if (typeof img === 'string'){ url=img; target=img; }
      else if (img && typeof img === 'object'){
        url = img.url || img.image_url || '';
        target = img.target_url || img.source_url || img.url || url;
        alt = img.description || img.alt || 'Result image';
      }
      if (!url) return '';
      return `
        <button type="button" onclick='openLightbox(${JSON.stringify(url)}, ${JSON.stringify(target)})'
          class="group/img flex-none relative w-32 h-24 sm:w-40 sm:h-28 rounded-xl overflow-hidden bg-ink-100 dark:bg-ink-800 border border-ink-200/70 dark:border-ink-800 hover:ring-2 hover:ring-brand-400 transition-all focus:outline-none">
          <img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200" onerror="this.closest('button').remove()"/>
        </button>`;
    }).join('');
    if (!items.trim()) return null;
    section.innerHTML = `
      <div class="flex items-center gap-2 mb-3">
        <svg class="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <h3 class="text-xs font-semibold text-ink-500 dark:text-ink-400">Images</h3>
      </div>
      <div class="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">${items}</div>
    `;
    return section;
  }

  function openLightbox(url, target){
    document.getElementById('lightbox-img').src = url;
    document.getElementById('lightbox-link').href = target || url;
    document.getElementById('lightbox').classList.remove('hidden');
  }
  function closeLightbox(e){
    if (e && e.target !== e.currentTarget && e.type==='click') return;
    document.getElementById('lightbox').classList.add('hidden');
    document.getElementById('lightbox-img').src = '';
  }

  function openAbout(){ document.getElementById('about-modal').classList.remove('hidden'); }
  function closeAbout(e){
    if (e && e.target !== e.currentTarget && e.type==='click') return;
    document.getElementById('about-modal').classList.add('hidden');
  }

  function getDomain(urlString){
    try { return new URL(urlString).hostname.replace(/^www\./,''); } catch(e){ return urlString; }
  }
  function escapeHtml(str){
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function escapeAttr(str){ return escapeHtml(str).replace(/`/g,'&#96;'); }

  // ---------- voice ----------
  function setupSpeechRecognition(){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR){
      recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.onresult = (e) => { const t = e.results[0][0].transcript; if (t) executeSearch(t); stopListening(); };
      recognition.onerror = stopListening;
      recognition.onend = stopListening;
    } else {
      document.getElementById('hero-mic-btn')?.style.setProperty('display','none');
      document.getElementById('top-mic-btn')?.style.setProperty('display','none');
    }
  }
  function toggleVoiceSearch(source){
    if (!recognition) return;
    if (isListening){ recognition.stop(); stopListening(); }
    else {
      try {
        recognition.start(); isListening = true;
        const btn = document.getElementById(`${source}-mic-btn`);
        btn?.classList.add('text-red-500','animate-pulse');
      } catch(e){}
    }
  }
  function stopListening(){
    isListening = false;
    ['hero','top'].forEach(s => document.getElementById(`${s}-mic-btn`)?.classList.remove('text-red-500','animate-pulse'));
  }

  window.addEventListener('popstate', () => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) executeSearch(q); else resetToHome();
  });
