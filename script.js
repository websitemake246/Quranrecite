// ========== GLOBAL VARIABLES ==========
const API_BASE = 'https://quranapi.pages.dev/api';
let surahs = [];
let reciters = {};
let currentPage = 1;
let stats = { visits: 0, plays: 0 };
const surahsPerPage = 30;

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    loadSurahs();
    loadReciters();
    loadStats();
    loadDailyVerse();
    setupEventListeners();
});

// ========== VISITOR STATS ==========
async function loadStats() {
    try {
        const stored = localStorage.getItem('quran_stats');
        if (stored) {
            stats = JSON.parse(stored);
        }
        updateStatsUI();
    } catch (e) {
        // best-effort only
    }
}

function getSelectedReciterId() {
    try {
        const saved = localStorage.getItem('quran_reciter');
        if (!saved) return '1';
        const parsed = JSON.parse(saved);
        return parsed.id ? String(parsed.id) : '1';
    } catch (e) {
        return '1';
    }
}

function updateStatsUI() {
    const visitsEl = document.getElementById('totalVisitors');
    const playsEl = document.getElementById('totalPlays');
    if (visitsEl) visitsEl.textContent = stats.visits.toLocaleString();
    if (playsEl) playsEl.textContent = stats.plays.toLocaleString();
}

function incrementVisit() {
    stats.visits += 1;
    try { localStorage.setItem('quran_stats', JSON.stringify(stats)); } catch (e) {}
    updateStatsUI();
}

function incrementPlay() {
    stats.plays += 1;
    try { localStorage.setItem('quran_stats', JSON.stringify(stats)); } catch (e) {}
    updateStatsUI();
}

// ========== THEME MANAGEMENT ==========
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeIcon = document.querySelector('#themeToggle i');
    
    if (savedTheme === 'dark') {
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const themeIcon = document.querySelector('#themeToggle i');
    themeIcon.classList.toggle('fa-moon');
    themeIcon.classList.toggle('fa-sun');
}

// ========== API FUNCTIONS ==========
async function loadSurahs() {
    try {
        const response = await fetch(`${API_BASE}/surah.json`);
        surahs = await response.json();
        
        // Add surah numbers
        surahs = surahs.map((surah, index) => ({
            ...surah,
            surahNo: index + 1
        }));
        
        displaySurahs();
    } catch (error) {
        console.error('Error loading surahs:', error);
        showError('Failed to load surahs. Please refresh the page.');
    }
}

async function loadReciters() {
    try {
        const response = await fetch(`${API_BASE}/reciters.json`);
        reciters = await response.json();
        // reciters.json can be an object keyed by id or a list; normalize both
        const list = Array.isArray(reciters)
            ? reciters
            : Object.values(reciters || {});

        const mapped = list.map((r, idx) => {
            const name = typeof r === 'string' ? r : r.name || r.reciter || `Reciter ${idx + 1}`;
            const id = typeof r === 'object' && r.id ? r.id : idx + 1;
            return { id, name };
        });

        displayReciters(mapped);
        restoreSelectedReciter();
    } catch (error) {
        console.error('Error loading reciters:', error);
    }
}

async function fetchSurah(surahNo) {
    try {
        const response = await fetch(`${API_BASE}/${surahNo}.json`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching surah ${surahNo}:`, error);
        return null;
    }
}

async function fetchVerse(surahNo, ayahNo) {
    try {
        const response = await fetch(`${API_BASE}/${surahNo}/${ayahNo}.json`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching verse ${surahNo}:${ayahNo}:`, error);
        return null;
    }
}

async function fetchTafsir(surahNo, ayahNo) {
    try {
        const response = await fetch(`${API_BASE}/tafsir/${surahNo}_${ayahNo}.json`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching tafsir ${surahNo}:${ayahNo}:`, error);
        return null;
    }
}

async function fetchAudio(surahNo, ayahNo) {
    try {
        const response = await fetch(`${API_BASE}/audio/${surahNo}/${ayahNo}.json`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching audio ${surahNo}:${ayahNo}:`, error);
        const verseData = await fetchVerse(surahNo, ayahNo);
        return verseData?.audio || null;
    }
}

// ========== DISPLAY FUNCTIONS ==========
function displaySurahs() {
    const surahGrid = document.getElementById('surahGrid');
    if (!surahs.length) return;
    
    const endIndex = currentPage * surahsPerPage;
    const displayedSurahs = surahs.slice(0, endIndex);
    
    surahGrid.innerHTML = displayedSurahs.map(surah => {
        const emoji = getEmojiForSurah(surah.surahNo);
        const revelationEmoji = surah.revelationPlace?.toLowerCase() === 'mecca' ? '🕋' : '🕌';
        
        return `
            <div class="surah-card" onclick="openSurah(${surah.surahNo})">
                <div style="display: flex; align-items: center;">
                    <div class="surah-number">${surah.surahNo}</div>
                    <div class="surah-info">
                        <div class="surah-name">${emoji} ${surah.surahName || 'Unknown'}</div>
                        <div class="surah-name-arabic">${surah.surahNameArabic || ''}</div>
                        <div class="surah-details">
                            <span><i class="fas fa-book-open"></i> ${surah.totalAyah || 0} verses</span>
                            <span>${revelationEmoji} ${surah.revelationPlace || 'Unknown'}</span>
                        </div>
                    </div>
                </div>
                <div class="surah-actions">
                    <button onclick="event.stopPropagation(); playSurahAudio(${surah.surahNo})" title="Listen">
                        <i class="fas fa-headphones"></i>
                    </button>
                    <button onclick="event.stopPropagation(); openSurah(${surah.surahNo})" title="Read">
                        <i class="fas fa-book-open"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.style.display = endIndex >= surahs.length ? 'none' : 'block';
    }
}

function displayReciters(list) {
    if (!Array.isArray(list)) return;
    const recitersGrid = document.getElementById('recitersGrid');
    if (!recitersGrid) return;
    
    recitersGrid.innerHTML = list.map(reciter => `
        <div class="reciter-card">
            <div class="reciter-icon">
                <i class="fas fa-user"></i>
            </div>
            <h3 class="reciter-name">${escapeHtml(reciter.name)}</h3>
            <div class="reciter-actions">
                <button class="btn btn-outline" onclick="setActiveReciter(${reciter.id}, '${escapeHtml(reciter.name).replace(/'/g, "\\'")}')">
                    <i class="fas fa-check"></i>
                    Select
                </button>
            </div>
        </div>
    `).join('');
}

function setActiveReciter(id, name) {
    try {
        localStorage.setItem('quran_reciter', JSON.stringify({ id, name }));
    } catch (e) {}
    const selected = document.getElementById('selectedReciterName');
    if (selected) selected.textContent = name;
    alert(`Reciter updated: ${name}`);
}

function restoreSelectedReciter() {
    try {
        const saved = localStorage.getItem('quran_reciter');
        if (!saved) return;
        const { id, name } = JSON.parse(saved);
        if (!id || !name) return;
        const selected = document.getElementById('selectedReciterName');
        if (selected) selected.textContent = name;
        // Update active UI if needed
        const cards = document.querySelectorAll('.reciter-card')
        // simple highlight by name text not perfect but avoids indexing assumptions
    } catch (e) {}
}

// ========== SURAH FUNCTIONS ==========
function openSurah(surahNo) {
    window.location.href = `surah.html?id=${surahNo}`;
}

async function playSurahAudio(surahNo) {
    try {
        const surahData = await fetchSurah(surahNo);
        if (surahData?.audio) {
            const reciterId = getSelectedReciterId();
            const entry = surahData.audio[String(reciterId)] || Object.values(surahData.audio)[0];
            if (entry?.originalUrl || entry?.url) {
                const audio = new Audio(entry.originalUrl || entry.url);
                audio.play();
                incrementPlay();
            }
        }
    } catch (error) {
        console.error('Error playing surah audio:', error);
    }
}

// ========== VERSE FUNCTIONS ==========
async function searchVerse() {
    const surahInput = document.getElementById('surahInput');
    const ayahInput = document.getElementById('ayahInput');
    
    const surahNo = parseInt(surahInput.value, 10);
    const ayahNo = parseInt(ayahInput.value, 10);
    
    if (!surahNo || !ayahNo) {
        alert('Please enter both surah and ayah numbers');
        return;
    }
    
    if (surahNo < 1 || surahNo > 114) {
        alert('Surah number must be between 1 and 114');
        return;
    }
    
    await showVerse(surahNo, ayahNo);
}

function quickVerse(surahNo, ayahNo) {
    const surahInput = document.getElementById('surahInput');
    const ayahInput = document.getElementById('ayahInput');
    if (surahInput) surahInput.value = surahNo;
    if (ayahInput) ayahInput.value = ayahNo;
    searchVerse();
}

async function showVerse(surahNo, ayahNo) {
    const verseData = await fetchVerse(surahNo, ayahNo);
    if (!verseData) {
        alert('Verse not found');
        return;
    }
    
    const modal = document.getElementById('verseModal');
    document.getElementById('modalSurahName').innerHTML = `
        ${verseData.surahNameArabic} - ${verseData.surahName}
        <span style="font-size: 0.8rem; margin-left: 1rem; color: var(--text-light);">
            Verse ${ayahNo}
        </span>
    `;
    document.getElementById('modalArabic').innerHTML = verseData.arabic1 || verseData.arabic2;
    document.getElementById('modalTranslation').innerHTML = `
        <strong>English:</strong> ${verseData.english || 'N/A'}<br>
        <strong>Bengali:</strong> ${verseData.bengali || 'N/A'}<br>
        <strong>Urdu:</strong> ${verseData.urdu || 'N/A'}
    `;
    
    await loadAudioOptions(surahNo, ayahNo);
    await loadTafsirPreview(surahNo, ayahNo);
    
    modal.style.display = 'block';
}

async function loadAudioOptions(surahNo, ayahNo) {
    const audioContainer = document.getElementById('audioControls');
    const audioData = await fetchAudio(surahNo, ayahNo);
    
    if (audioData) {
        audioContainer.innerHTML = Object.entries(audioData).map(([id, info]) => `
            <button class="audio-button" onclick="playAudio('${info.originalUrl || info.url}')">
                <i class="fas fa-play-circle"></i>
                <span>${escapeHtml(info.reciter || 'Audio')}</span>
                <i class="fas fa-headphones" style="margin-left: auto;"></i>
            </button>
        `).join('');
    } else {
        audioContainer.innerHTML = '<p style="color: var(--text-light);">No audio available for this verse</p>';
    }
}

async function loadTafsirPreview(surahNo, ayahNo) {
    const tafsirData = await fetchTafsir(surahNo, ayahNo);
    const tafsirContainer = document.getElementById('modalTafsir');
    
    if (tafsirData?.tafsirs?.length > 0) {
        tafsirContainer.innerHTML = `
            <h4 style="margin-bottom: 1rem; color: var(--primary-color);">
                <i class="fas fa-book"></i> Tafsir - ${tafsirData.tafsirs[0].author}
            </h4>
            <p style="color: var(--text-dark); line-height: 1.8;">
                ${tafsirData.tafsirs[0].content.replace(/<[^>]*>/g, '').substring(0, 300)}...
            </p>
            <button onclick="viewFullTafsir(${surahNo}, ${ayahNo})" 
                    style="margin-top: 1rem; padding: 0.5rem 1rem; background: none; border: 1px solid var(--primary-color); 
                           border-radius: 50px; color: var(--primary-color); cursor: pointer;">
                Read Full Tafsir
            </button>
        `;
    } else {
        tafsirContainer.innerHTML = '<p style="color: var(--text-light);">Tafsir not available for this verse</p>';
    }
}

function viewFullTafsir(surahNo, ayahNo) {
    window.location.href = `tafsir.html?surah=${surahNo}&ayah=${ayahNo}`;
}

function playAudio(url) {
    const audio = new Audio(url);
    audio.play();
    incrementPlay();
}

function playDailyVerse() {
    const surahMatch = document.getElementById('dailyReference').textContent.match(/(\d+):(\d+)/);
    if (surahMatch) {
        const [_, surah, ayah] = surahMatch;
        showVerse(parseInt(surah, 10), parseInt(ayah, 10));
    }
}

function closeModal() {
    const modal = document.getElementById('verseModal');
    if (modal) modal.style.display = 'none';
}

function shareVerse() {
    const surahName = document.getElementById('modalSurahName')?.textContent || '';
    const verse = document.getElementById('modalArabic')?.textContent || '';
    
    if (navigator.share) {
        navigator.share({
            title: 'Quran Verse',
            text: `${surahName}\n\n${verse}`,
        });
    } else {
        alert('Share not supported on this browser');
    }
}

// ========== DAILY VERSE ==========
async function loadDailyVerse() {
    const randomSurah = Math.floor(Math.random() * 114) + 1;
    const surahData = await fetchSurah(randomSurah);
    
    if (surahData) {
        const randomAyah = Math.floor(Math.random() * Math.min(surahData.totalAyah, 10)) + 1;
        const verseData = await fetchVerse(randomSurah, randomAyah);
        
        if (verseData) {
            const arabicEl = document.getElementById('dailyArabic');
            const translationEl = document.getElementById('dailyTranslation');
            const referenceEl = document.getElementById('dailyReference');
            if (arabicEl) arabicEl.textContent = verseData.arabic1 || verseData.arabic2;
            if (translationEl) translationEl.textContent = verseData.english || '';
            if (referenceEl) referenceEl.textContent = `Surah ${verseData.surahNameArabic} (${randomSurah}:${randomAyah})`;
        }
    }
}

function newDailyVerse() {
    loadDailyVerse();
}

// ========== UTILITY FUNCTIONS ==========
function getEmojiForSurah(surahNo) {
    const specialSurahs = {
        1: '🕌', 2: '🐄', 3: '👨‍👩‍👧‍👦', 36: '✨', 55: '🌹',
        56: '⚡', 67: '👑', 112: '🕋', 113: '🌅', 114: '👥'
    };
    return specialSurahs[surahNo] || '📖';
}

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #ff6b6b;
        color: white;
        padding: 1rem 2rem;
        border-radius: 50px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease;
        font-weight: 600;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    incrementVisit();
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) menuToggle.addEventListener('click', () => {
        document.querySelector('.nav-menu')?.classList.toggle('active');
    });
    
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        displaySurahs();
    });
    
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('verseModal');
        if (e.target === modal) {
            closeModal();
        }
    });
    
    const ayahInput = document.getElementById('ayahInput');
    if (ayahInput) ayahInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchVerse();
    });
    
    const surahInput = document.getElementById('surahInput');
    if (surahInput) surahInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('ayahInput')?.focus();
    });
}

// ========== RECITER FUNCTIONS ==========
function showReciterAudio(reciterId) {
    alert(`🎧 Reciter selected. Click on any verse to listen to this reciter.`);
}
