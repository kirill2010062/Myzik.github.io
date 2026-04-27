document.addEventListener('DOMContentLoaded', () => {
    const YOUTUBE_API_KEY = 'AIzaSyBXEosABQXZhrXJGw86aRYgexdWQ0Oo5EA';
    
    let player;
    let isPlaying = false;
    let playlist = [];
    let currentIndex = -1;
    let currentUser = null;
    let users = JSON.parse(localStorage.getItem('freemusic_users')) || [];
    let favorites = JSON.parse(localStorage.getItem('freemusic_favorites')) || {};
    let playlistOverlay = null;
    let searchTimeout;
    
    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app-screen');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const logoutNav = document.getElementById('logout-nav');
    const logoutProfile = document.getElementById('logout-profile');
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const modal = document.getElementById('edit-profile-modal');
    const editProfileForm = document.getElementById('edit-profile-form');
    const likeCurrentBtn = document.getElementById('like-current');
    const togglePlaylistBtn = document.getElementById('toggle-playlist');
    const playlistSidebar = document.querySelector('.playlist-sidebar');
    
    const playBtn = document.getElementById('master-play');
    const playerTitle = document.getElementById('player-title');
    const playerArtist = document.getElementById('player-artist');
    const progressFill = document.getElementById('progress-fill');
    const progressWrap = document.getElementById('progress-wrap');
    const currentTimeEl = document.getElementById('current-time');
    const durationTimeEl = document.getElementById('duration-time');
    const volumeSlider = document.getElementById('volume-slider');
    const playlistCountEl = document.getElementById('playlist-count');
    
    // =========================================
    // LIQUID GLASS NAVIGATION
    // =========================================
    function initLiquidNav() {
        const navButtons = document.querySelectorAll(".nav-btn");
        const activePill = document.getElementById("active-pill");
        const nav = document.getElementById("nav");
        const glare = document.getElementById("glare");
        const themeBtn = document.getElementById("theme-btn");
        
        function updatePill(btn, smooth = true) {
            if (!btn) return;
            
            if (!smooth) {
                activePill.style.transition = 'none';
            } else {
                activePill.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.2, 0.64, 1), width 0.5s cubic-bezier(0.34, 1.2, 0.64, 1), background 0.5s ease, box-shadow 0.5s ease';
            }
            
            activePill.style.width = `${btn.offsetWidth}px`;
            activePill.style.transform = `translateX(${btn.offsetLeft}px)`;
        }
        
        const initialActive = document.querySelector(".nav-btn.active");
        if (initialActive) {
            setTimeout(() => {
                updatePill(initialActive, false);
                void activePill.offsetWidth;
            }, 50);
        }
        
        navButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                navButtons.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                updatePill(btn);
                
                const page = btn.dataset.page;
                document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
                document.getElementById(`page-${page}`).classList.add('active');
                
                if (page === 'profile') updateFavoritesUI();
                if (page === 'search') {
                    document.getElementById('search-input').focus();
                }
            });
        });
        
        if (themeBtn) {
            themeBtn.addEventListener("click", () => {
                const root = document.documentElement;
                const isDark = root.getAttribute("data-theme") === "dark";
                root.setAttribute("data-theme", isDark ? "light" : "dark");
                
                setTimeout(() => {
                    const active = document.querySelector(".nav-btn.active");
                    if (active) updatePill(active);
                }, 100);
            });
        }
        
        window.addEventListener("resize", () => {
            const active = document.querySelector(".nav-btn.active");
            if (active) updatePill(active, false);
        });
        
        if (nav && glare) {
            nav.addEventListener("mousemove", (e) => {
                const rect = nav.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                glare.style.setProperty("--x", `${x}px`);
                glare.style.setProperty("--y", `${y}px`);
            });
        }
    }

    // =========================================
    // YOUTUBE PLAYER
    // =========================================
    window.onYouTubeIframeAPIReady = () => {
        player = new YT.Player('yt-player', {
            height: '0',
            width: '0',
            events: {
                'onStateChange': (e) => {
                    if (e.data === YT.PlayerState.ENDED) playNext();
                    if (e.data === YT.PlayerState.PLAYING) {
                        isPlaying = true;
                        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                        updateProgress();
                    }
                    if (e.data === YT.PlayerState.PAUSED) {
                        isPlaying = false;
                        playBtn.innerHTML = '<i class="fas fa-play"></i>';
                    }
                },
                'onReady': () => {
                    player.setVolume(volumeSlider.value);
                    if (currentUser) loadPopularTracks();
                }
            }
        });
    };

    // =========================================
    // АВТОРИЗАЦИЯ
    // =========================================
    function initAuth() {
        const savedUser = localStorage.getItem('freemusic_current_user');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            showApp();
        }
        
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab === 'login' ? 'login-form' : 'register-form').classList.add('active');
                document.getElementById('login-message').textContent = '';
                document.getElementById('register-message').textContent = '';
            });
        });
        
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            
            if (!email || !password) {
                document.getElementById('login-message').textContent = 'Заполните все поля';
                return;
            }
            
            const user = users.find(u => u.email === email && u.password === password);
            if (user) {
                currentUser = {...user};
                delete currentUser.password;
                localStorage.setItem('freemusic_current_user', JSON.stringify(currentUser));
                showApp();
            } else {
                document.getElementById('login-message').textContent = 'Неверный email или пароль';
            }
        });
        
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('reg-username').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;
            const confirm = document.getElementById('reg-confirm').value;
            const messageEl = document.getElementById('register-message');
            
            if (!username || !email || !password || !confirm) {
                messageEl.textContent = 'Все поля обязательны';
                return;
            }
            if (username.length < 3) {
                messageEl.textContent = 'Имя должно быть не менее 3 символов';
                return;
            }
            if (!email.includes('@') || !email.includes('.')) {
                messageEl.textContent = 'Введите корректный email';
                return;
            }
            if (password.length < 6) {
                messageEl.textContent = 'Пароль должен быть не менее 6 символов';
                return;
            }
            if (password !== confirm) {
                messageEl.textContent = 'Пароли не совпадают';
                return;
            }
            if (users.find(u => u.email === email)) {
                messageEl.textContent = 'Email уже используется';
                return;
            }
            
            const newUser = {
                id: Date.now(),
                username,
                email,
                password,
                avatar: '👤'
            };
            
            users.push(newUser);
            localStorage.setItem('freemusic_users', JSON.stringify(users));
            
            currentUser = {
                id: newUser.id,
                username,
                email,
                avatar: '👤'
            };
            
            localStorage.setItem('freemusic_current_user', JSON.stringify(currentUser));
            messageEl.textContent = 'Регистрация успешна!';
            messageEl.style.color = '#2ecc71';
            registerForm.reset();
            
            setTimeout(() => showApp(), 500);
        });
    }

    function showApp() {
        authScreen.style.display = 'none';
        appScreen.style.display = 'flex';
        updateUserUI();
        loadPopularTracks();
        updateFavoritesUI();
        initLiquidNav();
        initPlaylistSidebar();
    }
    
    function logout() {
        localStorage.removeItem('freemusic_current_user');
        currentUser = null;
        appScreen.style.display = 'none';
        authScreen.style.display = 'flex';
        loginForm.reset();
        registerForm.reset();
        document.getElementById('login-message').textContent = '';
        document.getElementById('register-message').textContent = '';
    }
    
    function updateUserUI() {
        if (!currentUser) return;
        
        document.getElementById('nav-username').textContent = currentUser.username;
        document.getElementById('nav-avatar').textContent = currentUser.avatar || '👤';
        document.getElementById('profile-username').textContent = currentUser.username;
        document.getElementById('profile-email').textContent = currentUser.email;
        document.getElementById('profile-avatar').textContent = currentUser.avatar || '👤';
        
        if (document.getElementById('edit-username')) {
            document.getElementById('edit-username').value = currentUser.username;
        }
    }
    
    // =========================================
    // УПРАВЛЕНИЕ ШТОРКОЙ ПЛЕЙЛИСТА
    // =========================================
    function initPlaylistSidebar() {
        // Создаём оверлей
        playlistOverlay = document.createElement('div');
        playlistOverlay.className = 'playlist-overlay';
        document.body.appendChild(playlistOverlay);
        
        // Создаём кнопку сворачивания для десктопа
        const toggleSidebarBtn = document.createElement('button');
        toggleSidebarBtn.className = 'playlist-toggle-btn';
        toggleSidebarBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        toggleSidebarBtn.title = 'Свернуть очередь';
        playlistSidebar.appendChild(toggleSidebarBtn);
        
        // Создаём кнопку закрытия для мобильных
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-playlist-btn';
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.title = 'Закрыть';
        
        const playlistHeader = document.querySelector('.playlist-header');
        if (playlistHeader && !document.querySelector('.close-playlist-btn')) {
            playlistHeader.appendChild(closeBtn);
        }
        
        // Функция открытия шторки
        function openPlaylist() {
            playlistSidebar.classList.remove('collapsed');
            if (window.innerWidth <= 768) {
                playlistOverlay.classList.add('active');
                document.body.style.overflow = 'hidden';
                togglePlaylistBtn.classList.add('hidden');
            }
            localStorage.setItem('playlist_open', 'true');
        }
        
        // Функция закрытия шторки
        function closePlaylist() {
            playlistSidebar.classList.add('collapsed');
            if (window.innerWidth <= 768) {
                playlistOverlay.classList.remove('active');
                document.body.style.overflow = '';
                togglePlaylistBtn.classList.remove('hidden');
            }
            localStorage.setItem('playlist_open', 'false');
        }
        
        // Функция переключения
        function togglePlaylist() {
            if (playlistSidebar.classList.contains('collapsed')) {
                openPlaylist();
            } else {
                closePlaylist();
            }
        }
        
        // Обработчики событий
        if (togglePlaylistBtn) {
            togglePlaylistBtn.addEventListener('click', openPlaylist);
        }
        
        toggleSidebarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePlaylist();
        });
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closePlaylist);
        }
        
        playlistOverlay.addEventListener('click', closePlaylist);
        
        // Свайп для закрытия на мобильных
        let touchStartX = 0;
        let touchStartY = 0;
        
        playlistSidebar.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });
        
        playlistSidebar.addEventListener('touchmove', (e) => {
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const deltaX = touchX - touchStartX;
            const deltaY = Math.abs(touchY - touchStartY);
            
            if (deltaX > 50 && deltaX > deltaY) {
                closePlaylist();
            }
        });
        
        // Восстанавливаем состояние шторки
        const savedState = localStorage.getItem('playlist_open');
        if (savedState === 'false') {
            playlistSidebar.classList.add('collapsed');
            if (window.innerWidth <= 768) {
                togglePlaylistBtn.classList.remove('hidden');
            }
        } else {
            playlistSidebar.classList.remove('collapsed');
            if (window.innerWidth <= 768) {
                togglePlaylistBtn.classList.add('hidden');
            }
        }
        
        // Горячие клавиши
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            if (e.key === 'q' || e.key === 'Q') {
                e.preventDefault();
                togglePlaylist();
            }
            
            if (e.key === 'Escape' && !playlistSidebar.classList.contains('collapsed')) {
                closePlaylist();
            }
        });
    }
    
    // =========================================
    // ИЗБРАННОЕ
    // =========================================
    function toggleFavorite(track) {
        if (!currentUser) return;
        
        const userFavs = favorites[currentUser.id] || [];
        const exists = userFavs.find(t => t.videoId === track.videoId);
        
        if (exists) {
            favorites[currentUser.id] = userFavs.filter(t => t.videoId !== track.videoId);
        } else {
            favorites[currentUser.id] = [...userFavs, {
                videoId: track.videoId,
                title: track.title,
                author: track.author,
                thumbnail: track.thumbnail || `https://i.ytimg.com/vi/${track.videoId}/mqdefault.jpg`
            }];
        }
        
        localStorage.setItem('freemusic_favorites', JSON.stringify(favorites));
        updateFavoritesUI();
        updateLikeButton();
    }
    
    function updateFavoritesUI() {
        if (!currentUser) return;
        
        const userFavs = favorites[currentUser.id] || [];
        if (document.getElementById('liked-count')) {
            document.getElementById('liked-count').textContent = userFavs.length;
        }
        renderFavorites();
    }
    
    function renderFavorites() {
        const container = document.getElementById('favorites-container');
        if (!container) return;
        
        const userFavs = currentUser ? (favorites[currentUser.id] || []) : [];
        
        if (userFavs.length === 0) {
            container.innerHTML = '<p class="empty-favorites"><i class="far fa-heart"></i> Вы пока не добавили ни одного трека</p>';
            return;
        }
        
        container.innerHTML = userFavs.map(track => `
            <div class="favorite-track-item" data-video-id="${track.videoId}">
                <div class="fav-thumb" style="background-image: url('${track.thumbnail}')"></div>
                <div class="fav-info">
                    <div class="fav-title">${escapeHtml(track.title)}</div>
                    <div class="fav-artist">${escapeHtml(track.author)}</div>
                </div>
                <button class="remove-fav-btn" data-id="${track.videoId}"><i class="fas fa-times"></i></button>
            </div>
        `).join('');
        
        container.querySelectorAll('.favorite-track-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.remove-fav-btn')) return;
                const videoId = el.dataset.videoId;
                const track = userFavs.find(t => t.videoId === videoId);
                if (track) {
                    playlist.push({...track});
                    renderPlaylist();
                    playPlaylistTrack(playlist.length - 1);
                }
            });
        });
        
        container.querySelectorAll('.remove-fav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                favorites[currentUser.id] = userFavs.filter(t => t.videoId !== btn.dataset.id);
                localStorage.setItem('freemusic_favorites', JSON.stringify(favorites));
                renderFavorites();
                updateFavoritesUI();
                updateLikeButton();
            });
        });
    }
    
    function updateLikeButton() {
        if (!currentUser || currentIndex === -1 || !playlist[currentIndex]) {
            likeCurrentBtn.classList.remove('active');
            likeCurrentBtn.innerHTML = '<i class="far fa-heart"></i>';
            return;
        }
        
        const isLiked = (favorites[currentUser.id] || []).some(t => t.videoId === playlist[currentIndex].videoId);
        likeCurrentBtn.classList.toggle('active', isLiked);
        likeCurrentBtn.innerHTML = isLiked ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]);
    }
    
    // =========================================
    // YOUTUBE SEARCH
    // =========================================
    async function searchYouTube(query, max = 20) {
        try {
            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${max}&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (!data.items) return [];
            
            return data.items.map(i => ({
                videoId: i.id.videoId,
                title: i.snippet.title,
                author: i.snippet.channelTitle,
                thumbnail: i.snippet.thumbnails.medium?.url || i.snippet.thumbnails.default?.url,
            }));
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }
    
    async function loadPopularTracks() {
        const grid = document.getElementById('popular-tracks');
        if (!grid) return;
        
        grid.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-pulse"></i> Загрузка...</div>';
        
        try {
            const tracks = await searchYouTube('top hits 2024', 24);
            renderTracks(grid, tracks);
        } catch {
            grid.innerHTML = '<div class="loading-placeholder">Ошибка загрузки</div>';
        }
    }
    
    function renderTracks(container, videos) {
        if (!container) return;
        container.innerHTML = '';
        
        if (videos.length === 0) {
            container.innerHTML = '<div class="loading-placeholder">Ничего не найдено</div>';
            return;
        }
        
        videos.forEach(v => {
            const card = document.createElement('div');
            card.className = 'track-card';
            card.innerHTML = `
                <div class="card-image" style="background-image:url('${v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`}')"></div>
                <button class="add-to-playlist"><i class="fas fa-plus"></i></button>
                <div class="track-info-text">
                    <div>${escapeHtml(v.title)}</div>
                    <div>${escapeHtml(v.author)}</div>
                </div>
            `;
            
            card.addEventListener('click', (e) => {
                if (e.target.closest('.add-to-playlist')) return;
                playlist.push(v);
                renderPlaylist();
                playPlaylistTrack(playlist.length - 1);
            });
            
            card.querySelector('.add-to-playlist').addEventListener('click', (e) => {
                e.stopPropagation();
                playlist.push(v);
                renderPlaylist();
            });
            
            container.appendChild(card);
        });
    }
    
    // =========================================
    // ПЛЕЙЛИСТ
    // =========================================
    function renderPlaylist() {
        const cont = document.getElementById('playlist-items');
        if (!cont) return;
        
        if (playlist.length === 0) {
            cont.innerHTML = '<p class="empty-playlist"><i class="fas fa-music"></i> Пусто. Добавьте треки из поиска!</p>';
            if (playlistCountEl) playlistCountEl.textContent = '0';
            return;
        }
        
        cont.innerHTML = playlist.map((t, i) => `
            <div class="playlist-item ${i === currentIndex ? 'active' : ''}">
                <div class="item-info">
                    <div class="item-title">${escapeHtml(t.title)}</div>
                    <div class="item-artist">${escapeHtml(t.author)}</div>
                </div>
                <button class="remove-btn" data-index="${i}"><i class="fas fa-times"></i></button>
            </div>
        `).join('');
        
        cont.querySelectorAll('.playlist-item').forEach((el, i) => {
            el.addEventListener('click', (e) => {
                if (!e.target.closest('.remove-btn')) playPlaylistTrack(i);
            });
        });
        
        cont.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                playlist.splice(index, 1);
                if (currentIndex >= index) currentIndex--;
                renderPlaylist();
                
                if (playlist.length === 0) {
                    playerTitle.textContent = 'Не выбрано';
                    playerArtist.textContent = 'Добавьте трек';
                    playBtn.innerHTML = '<i class="fas fa-play"></i>';
                }
            });
        });
        
        if (playlistCountEl) playlistCountEl.textContent = playlist.length;
        updateLikeButton();
    }
    
    function playPlaylistTrack(index) {
        if (!playlist[index] || !player) return;
        
        currentIndex = index;
        const t = playlist[index];
        player.loadVideoById(t.videoId);
        playerTitle.textContent = t.title;
        playerArtist.textContent = t.author;
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        renderPlaylist();
        updateLikeButton();
    }
    
    function playNext() {
        if (currentIndex < playlist.length - 1) {
            playPlaylistTrack(currentIndex + 1);
        } else {
            isPlaying = false;
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            currentIndex = -1;
            renderPlaylist();
        }
    }
    
    function updateProgress() {
        if (!player || !player.getCurrentTime) return;
        
        const cur = player.getCurrentTime();
        const dur = player.getDuration();
        
        if (dur) {
            progressFill.style.width = (cur / dur) * 100 + '%';
            currentTimeEl.textContent = formatTime(cur);
            durationTimeEl.textContent = formatTime(dur);
        }
    }
    
    function formatTime(s) {
        if (isNaN(s)) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
    
    // =========================================
    // ИНИЦИАЛИЗАЦИЯ
    // =========================================
    initAuth();
    
    // Аватар селектор
    document.querySelectorAll('.avatar-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Выход
    if (logoutNav) logoutNav.addEventListener('click', logout);
    if (logoutProfile) logoutProfile.addEventListener('click', logout);
    
    // Поиск
    document.getElementById('search-input').addEventListener('input', (e) => {
        const q = e.target.value.trim();
        clearTimeout(searchTimeout);
        
        if (q.length > 2) {
            searchTimeout = setTimeout(async () => {
                const results = await searchYouTube(q);
                renderTracks(document.getElementById('search-results'), results);
            }, 500);
        } else if (q.length === 0) {
            document.getElementById('search-results').innerHTML = '<div class="loading-placeholder">🔎 Введите запрос в строке поиска</div>';
        }
    });
    
    // Лайк текущего трека
    likeCurrentBtn.addEventListener('click', () => {
        if (currentIndex >= 0 && playlist[currentIndex]) {
            toggleFavorite(playlist[currentIndex]);
        }
    });
    
    // Редактирование профиля
    editProfileBtn.addEventListener('click', () => {
        document.getElementById('edit-username').value = currentUser.username;
        modal.style.display = 'flex';
    });
    
    document.querySelector('.modal-close').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
    
    editProfileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newUsername = document.getElementById('edit-username').value;
        const activeAvatar = document.querySelector('.avatar-option.active');
        const newAvatar = activeAvatar ? activeAvatar.dataset.emoji : (currentUser.avatar || '👤');
        
        currentUser.username = newUsername;
        currentUser.avatar = newAvatar;
        localStorage.setItem('freemusic_current_user', JSON.stringify(currentUser));
        
        const userIndex = users.findIndex(u => u.id === currentUser.id);
        if (userIndex >= 0) {
            users[userIndex].username = newUsername;
            users[userIndex].avatar = newAvatar;
            localStorage.setItem('freemusic_users', JSON.stringify(users));
        }
        
        updateUserUI();
        modal.style.display = 'none';
    });
    
    // Плеер контролы
    setInterval(updateProgress, 500);
    
    volumeSlider.addEventListener('input', () => {
        if (player) player.setVolume(volumeSlider.value);
    });
    
    progressWrap.addEventListener('click', (e) => {
        if (!player || !player.getDuration) return;
        const rect = progressWrap.getBoundingClientRect();
        player.seekTo(((e.clientX - rect.left) / rect.width) * player.getDuration(), true);
    });
    
    playBtn.addEventListener('click', () => {
        if (!player) return;
        
        const state = player.getPlayerState();
        if (state === 1) {
            player.pauseVideo();
        } else if (playlist.length > 0) {
            if (currentIndex === -1) {
                playPlaylistTrack(0);
            } else {
                player.playVideo();
            }
        }
    });
    
    document.getElementById('clear-playlist').addEventListener('click', () => {
        playlist = [];
        currentIndex = -1;
        renderPlaylist();
        playerTitle.textContent = 'Не выбрано';
        playerArtist.textContent = 'Добавьте трек';
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        updateLikeButton();
    });
    
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            playlistOverlay.classList.remove('active');
            document.body.style.overflow = '';
            togglePlaylistBtn.classList.remove('hidden');
            
            const savedState = localStorage.getItem('playlist_open');
            if (savedState === 'false') {
                playlistSidebar.classList.add('collapsed');
            } else {
                playlistSidebar.classList.remove('collapsed');
            }
        }
    });

        // =========================================
    // 3D ЭФФЕКТЫ ПРИ ДВИЖЕНИИ МЫШИ
    // =========================================
    
    // 3D tilt эффект для карточек треков
    document.addEventListener('mousemove', (e) => {
        document.querySelectorAll('.track-card:hover').forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / centerY * -10;
            const rotateY = (x - centerX) / centerX * 10;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
        });
        
        document.querySelectorAll('.favorite-track-item:hover').forEach(item => {
            const rect = item.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const centerX = rect.width / 2;
            const rotateY = (x - centerX) / centerX * 5;
            
            item.style.transform = `perspective(800px) rotateY(${rotateY}deg) translateX(5px)`;
        });
        
        document.querySelectorAll('.auth-card:hover').forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / centerY * -5;
            const rotateY = (x - centerX) / centerX * 5;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        });
    });
    
    // Сброс трансформаций при уходе мыши
    document.addEventListener('mouseleave', () => {
        document.querySelectorAll('.track-card').forEach(card => {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
        });
        
        document.querySelectorAll('.favorite-track-item').forEach(item => {
            item.style.transform = 'perspective(800px) rotateY(0deg)';
        });
        
        document.querySelectorAll('.auth-card').forEach(card => {
            card.style.transform = 'perspective(1000px) rotateX(2deg)';
        });
    }, true);
    
    // 3D эффект для progress bar при клике
    progressWrap.addEventListener('mousedown', () => {
        progressWrap.style.transform = 'translateZ(25px) scaleY(3)';
    });
    
    progressWrap.addEventListener('mouseup', () => {
        progressWrap.style.transform = 'translateZ(15px) scaleY(1)';
    });
    
    // Параллакс эффект для фоновых blob'ов
    document.addEventListener('mousemove', (e) => {
        const blobs = document.querySelectorAll('.blob');
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;
        
        blobs.forEach((blob, index) => {
            const speed = (index + 1) * 20;
            const x = (mouseX - 0.5) * speed;
            const y = (mouseY - 0.5) * speed;
            
            blob.style.transform = `translate(${x}px, ${y}px)`;
        });
    });
});
