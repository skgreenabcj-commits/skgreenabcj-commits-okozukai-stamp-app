// LocalStorage版 おこづかいスタンプアプリ
// グローバル変数
let currentWeekStart = null;
let currentSettings = null;
let weeklyChart = null;
let selectedCell = null;
let customStamps = [];
let isDeleteMode = false;
let deleteModeLongPressTimer = null;

// LocalStorageのキー
const STORAGE_KEYS = {
    SETTINGS: 'okozukai_settings',
    STAMPS: 'okozukai_stamps',
    WEEKLY_HISTORY: 'okozukai_weekly_history',
    CUSTOM_STAMPS: 'okozukai_custom_stamps',
    ACHIEVEMENTS: 'okozukai_achievements',
    BACKUP: 'okozukai_backup'
};

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadCustomStamps();
    currentWeekStart = getWeekStart(new Date());
    await initStampPage();
    await initHistoryPage();
    
    // 自動バックアップのチェック
    await checkAndPerformAutoBackup();
});

// 設定の読み込み（LocalStorage版）
async function loadSettings() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (data) {
            currentSettings = JSON.parse(data);
            
            // デフォルト値の設定
            if (currentSettings.badge_threshold === undefined) {
                currentSettings.badge_threshold = 10;
            }
            if (currentSettings.badge_bonus === undefined) {
                currentSettings.badge_bonus = 50;
            }
        } else {
            // デフォルト設定を作成
            currentSettings = {
                id: 'settings_1',
                child_name: 'おなまえ',
                stamp_unit_price: 10,
                total_paid: 0,
                badge_threshold: 10,
                badge_bonus: 50
            };
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(currentSettings));
        }
        
        // 名前を表示
        document.getElementById('userName').textContent = `なまえ：${currentSettings.child_name}`;
    } catch (error) {
        console.error('設定の読み込みエラー:', error);
    }
}

// カスタムスタンプの読み込み（LocalStorage版）
async function loadCustomStamps() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_STAMPS);
        if (data) {
            customStamps = JSON.parse(data);
        } else {
            // 初期スタンプデータを作成
            await initializeDefaultStamps();
        }
        
        if (customStamps.length === 0) {
            await initializeDefaultStamps();
        }
        
        updateStampPalette();
    } catch (error) {
        console.error('カスタムスタンプの読み込みエラー:', error);
    }
}

// 初期スタンプデータの作成
async function initializeDefaultStamps() {
    customStamps = [
        { id: 'stamp_1', stamp_name: 'プリンセス', stamp_emoji: '👸', is_active: true },
        { id: 'stamp_2', stamp_name: 'きらきら', stamp_emoji: '🌟', is_active: true },
        { id: 'stamp_3', stamp_name: 'おいわい', stamp_emoji: '🎉', is_active: true },
        { id: 'stamp_4', stamp_name: 'トロフィー', stamp_emoji: '🏆', is_active: true },
        { id: 'stamp_5', stamp_name: 'ねこ', stamp_emoji: '🐱', is_active: true },
        { id: 'stamp_6', stamp_name: 'ちょうちょ', stamp_emoji: '🦋', is_active: true },
        { id: 'stamp_7', stamp_name: 'にじ', stamp_emoji: '🌈', is_active: false },
        { id: 'stamp_8', stamp_name: 'おはな', stamp_emoji: '🌸', is_active: false },
        { id: 'stamp_9', stamp_name: 'メダル', stamp_emoji: '🏅', is_active: false },
        { id: 'stamp_10', stamp_name: 'くるま', stamp_emoji: '🚗', is_active: false },
        { id: 'stamp_11', stamp_name: 'でんしゃ', stamp_emoji: '🚂', is_active: false },
        { id: 'stamp_12', stamp_name: 'はたらくくるま', stamp_emoji: '🚜', is_active: false },
        { id: 'stamp_13', stamp_name: 'おうかん', stamp_emoji: '👑', is_active: false },
        { id: 'stamp_14', stamp_name: 'はーと', stamp_emoji: '💝', is_active: false }
    ];
    localStorage.setItem(STORAGE_KEYS.CUSTOM_STAMPS, JSON.stringify(customStamps));
    console.log('初期スタンプデータを作成しました');
}

// スタンプパレットの更新
function updateStampPalette() {
    const activeStamps = customStamps.filter(s => s.is_active).slice(0, 6);
    
    // パレットの更新
    const paletteContainer = document.querySelector('.stamp-options');
    if (paletteContainer) {
        paletteContainer.innerHTML = '';
        activeStamps.forEach(stamp => {
            const btn = document.createElement('button');
            btn.className = 'stamp-btn';
            btn.dataset.stamp = stamp.stamp_emoji;
            btn.textContent = stamp.stamp_emoji;
            paletteContainer.appendChild(btn);
        });
    }
}

// 月曜日を週の開始日として取得
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// 日付をYYYY-MM-DD形式に変換
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 週ラベルの生成
function getWeekLabel(weekStart) {
    const month = weekStart.getMonth() + 1;
    const day = weekStart.getDate();
    return `なんしゅう：${month}がつ${day}にちのしゅう`;
}

// 曜日名の配列
const dayNames = ['げつ', 'か', 'すい', 'もく', 'きん', 'ど', 'にち'];

// スタンプページの初期化
async function initStampPage() {
    await loadSettings();
    
    document.getElementById('weekLabel').textContent = getWeekLabel(currentWeekStart);
    await generateStampTable();
    await updateWeeklySummary();
}

// スタンプ表の生成
async function generateStampTable() {
    const tbody = document.getElementById('stampTableBody');
    tbody.innerHTML = '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const stamps = await getWeekStamps(currentWeekStart);
    
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(currentWeekStart);
        currentDate.setDate(currentDate.getDate() + i);
        const dateStr = formatDate(currentDate);
        
        const isToday = currentDate.getTime() === today.getTime();
        
        const row = document.createElement('tr');
        if (isToday) {
            row.classList.add('today');
        }
        
        const dayCell = document.createElement('td');
        dayCell.className = 'day-cell';
        dayCell.textContent = dayNames[i];
        row.appendChild(dayCell);
        
        const categories = ['おべんきょう', 'おてつだい', 'よいこ'];
        categories.forEach(category => {
            const cell = document.createElement('td');
            cell.className = 'stamp-cell';
            cell.dataset.date = dateStr;
            cell.dataset.category = category;
            
            const dayStamps = stamps.filter(s => s.date === dateStr && s.category === category);
            
            dayStamps.forEach(stamp => {
                for (let j = 0; j < stamp.stamp_count; j++) {
                    const stampSpan = document.createElement('span');
                    stampSpan.className = 'stamp';
                    stampSpan.textContent = stamp.stamp_type;
                    cell.appendChild(stampSpan);
                }
            });
            
            // タッチイベント
            let longPressTimer;
            cell.addEventListener('touchstart', (e) => {
                if (isDeleteMode) return;
                
                longPressTimer = setTimeout(() => {
                    if (dayStamps.length > 0) {
                        enterDeleteMode(cell);
                    }
                }, 800);
            }, { passive: true });
            
            cell.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
            });
            
            cell.addEventListener('touchmove', () => {
                clearTimeout(longPressTimer);
            });
            
            // クリックイベント
            cell.addEventListener('click', (e) => {
                if (isDeleteMode) {
                    deleteStampsFromCell(cell);
                } else {
                    if (dayStamps.length < 2) {
                        selectedCell = cell;
                        openStampModal(dateStr, category);
                    } else {
                        alert('1にち1つのくぶんに2このまでだよ！');
                    }
                }
            });
            
            row.appendChild(cell);
        });
        
        tbody.appendChild(row);
    }
}

// 週のスタンプデータ取得（LocalStorage版）
async function getWeekStamps(weekStart) {
    try {
        const allStamps = JSON.parse(localStorage.getItem(STORAGE_KEYS.STAMPS) || '[]');
        const weekStartStr = formatDate(weekStart);
        return allStamps.filter(s => s.week_start === weekStartStr);
    } catch (error) {
        console.error('スタンプデータ取得エラー:', error);
        return [];
    }
}

// スタンプモーダルを開く
function openStampModal(date, category) {
    const modal = document.getElementById('stampModal');
    const modalInfo = document.getElementById('modalInfo');
    
    const dateObj = new Date(date);
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const dayIndex = dateObj.getDay();
    const adjustedDayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    
    modalInfo.textContent = `${month}がつ${day}にち（${dayNames[adjustedDayIndex]}）の「${category}」`;
    
    const selection = document.getElementById('stampSelection');
    selection.innerHTML = '';
    
    const activeStamps = customStamps.filter(s => s.is_active).slice(0, 6);
    activeStamps.forEach(stamp => {
        const btn = document.createElement('button');
        btn.className = 'stamp-select-btn';
        btn.dataset.stamp = stamp.stamp_emoji;
        btn.textContent = stamp.stamp_emoji;
        btn.addEventListener('click', () => addStamp(date, category, stamp.stamp_emoji));
        selection.appendChild(btn);
    });
    
    modal.classList.add('active');
}

// モーダルを閉じる
function closeModal() {
    const modal = document.getElementById('stampModal');
    modal.classList.remove('active');
    selectedCell = null;
}

// スタンプを追加（LocalStorage版）
async function addStamp(date, category, stampType) {
    try {
        const allStamps = JSON.parse(localStorage.getItem(STORAGE_KEYS.STAMPS) || '[]');
        
        const newStamp = {
            id: 'stamp_' + Date.now(),
            week_start: formatDate(currentWeekStart),
            date: date,
            category: category,
            stamp_type: stampType,
            stamp_count: 1,
            created_at: Date.now()
        };
        
        allStamps.push(newStamp);
        localStorage.setItem(STORAGE_KEYS.STAMPS, JSON.stringify(allStamps));
        
        closeModal();
        await generateStampTable();
        await updateWeeklySummary();
        
    } catch (error) {
        console.error('スタンプ追加エラー:', error);
        alert('エラーがおきたよ');
    }
}

// 削除モードに入る
function enterDeleteMode(cell) {
    isDeleteMode = true;
    
    const banner = document.createElement('div');
    banner.id = 'deleteModeBanner';
    banner.className = 'delete-mode-banner';
    banner.innerHTML = `
        <span>けすモード：けしたいマスをタップしてね</span>
        <button onclick="exitDeleteMode()">もどる</button>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
    
    document.querySelectorAll('.stamp-cell').forEach(c => {
        if (c.children.length > 0) {
            c.classList.add('delete-mode');
        }
    });
}

// 削除モードを終了
function exitDeleteMode() {
    isDeleteMode = false;
    const banner = document.getElementById('deleteModeBanner');
    if (banner) {
        banner.remove();
    }
    document.querySelectorAll('.stamp-cell').forEach(c => {
        c.classList.remove('delete-mode');
    });
}

// セルからスタンプを削除（LocalStorage版）
async function deleteStampsFromCell(cell) {
    const date = cell.dataset.date;
    const category = cell.dataset.category;
    
    if (!confirm(`${category}のスタンプをけしてもいいですか？`)) {
        return;
    }
    
    try {
        const allStamps = JSON.parse(localStorage.getItem(STORAGE_KEYS.STAMPS) || '[]');
        const filtered = allStamps.filter(s => !(s.date === date && s.category === category));
        localStorage.setItem(STORAGE_KEYS.STAMPS, JSON.stringify(filtered));
        
        exitDeleteMode();
        await generateStampTable();
        await updateWeeklySummary();
        
    } catch (error) {
        console.error('削除エラー:', error);
        alert('エラーがおきたよ');
    }
}

// 週の集計を更新
async function updateWeeklySummary() {
    try {
        const stamps = await getWeekStamps(currentWeekStart);
        const totalStamps = stamps.reduce((sum, s) => sum + s.stamp_count, 0);
        
        // 達成バッジの判定
        const achievements = await checkAchievements(stamps);
        displayAchievements(achievements);
        
        const totalBonus = achievements.reduce((sum, a) => sum + a.bonus_amount, 0);
        
        const previousCarryover = await getPreviousCarryover();
        const totalAmount = totalStamps * currentSettings.stamp_unit_price + previousCarryover + totalBonus;
        const allowancePaid = Math.floor(totalAmount / 100) * 100;
        const carryover = totalAmount - allowancePaid;
        
        document.getElementById('weeklyStamps').textContent = totalStamps;
        document.getElementById('weeklyAllowance').textContent = `${allowancePaid}えん`;
        document.getElementById('carryoverAmount').textContent = `${carryover}えん`;
        
        const bonusSection = document.getElementById('bonusSection');
        if (totalBonus > 0) {
            bonusSection.style.display = 'block';
            document.getElementById('bonusAmount').textContent = `${totalBonus}えん`;
        } else {
            bonusSection.style.display = 'none';
        }
        
        const carryoverSection = document.getElementById('carryoverSection');
        if (carryover > 0) {
            carryoverSection.style.display = 'block';
        } else {
            carryoverSection.style.display = 'none';
        }
        
        await saveWeeklyHistory(totalStamps, allowancePaid, carryover);
        
        if (achievements.length > 0) {
            await saveAchievements(achievements);
        }
    } catch (error) {
        console.error('集計更新エラー:', error);
    }
}

// 前週の持ち越し額を取得（LocalStorage版）
async function getPreviousCarryover() {
    try {
        const previousWeekStart = new Date(currentWeekStart);
        previousWeekStart.setDate(previousWeekStart.getDate() - 7);
        const previousWeekStartStr = formatDate(previousWeekStart);
        
        const allHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.WEEKLY_HISTORY) || '[]');
        const previousWeek = allHistory.find(h => h.week_start === previousWeekStartStr);
        
        return previousWeek ? previousWeek.carryover : 0;
    } catch (error) {
        console.error('持ち越し額取得エラー:', error);
        return 0;
    }
}

// 達成バッジの判定
async function checkAchievements(stamps) {
    const achievements = [];
    const categories = ['おべんきょう', 'おてつだい', 'よいこ'];
    
    categories.forEach(category => {
        const categoryStamps = stamps.filter(s => s.category === category);
        const count = categoryStamps.reduce((sum, s) => sum + s.stamp_count, 0);
        
        if (count >= currentSettings.badge_threshold) {
            achievements.push({
                week_start: formatDate(currentWeekStart),
                category: category,
                stamp_count: count,
                bonus_amount: currentSettings.badge_bonus
            });
        }
    });
    
    return achievements;
}

// 達成バッジの表示
function displayAchievements(achievements) {
    const container = document.getElementById('achievementBadges');
    container.innerHTML = '';
    
    if (achievements.length === 0) {
        return;
    }
    
    achievements.forEach(achievement => {
        const badge = document.createElement('div');
        badge.className = 'achievement-badge';
        badge.innerHTML = `
            <div class="badge-icon">🏆</div>
            <div class="badge-text">
                <div class="badge-category">${achievement.category}</div>
                <div class="badge-amount">+${achievement.bonus_amount}えん</div>
            </div>
        `;
        container.appendChild(badge);
    });
}

// 週履歴の保存（LocalStorage版）
async function saveWeeklyHistory(totalStamps, allowancePaid, carryover) {
    try {
        const weekStartStr = formatDate(currentWeekStart);
        const weekLabel = getWeekLabel(currentWeekStart);
        
        const allHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.WEEKLY_HISTORY) || '[]');
        const existingIndex = allHistory.findIndex(h => h.week_start === weekStartStr);
        
        const historyItem = {
            id: existingIndex >= 0 ? allHistory[existingIndex].id : 'history_' + Date.now(),
            week_start: weekStartStr,
            week_label: weekLabel,
            total_stamps: totalStamps,
            allowance_paid: allowancePaid,
            carryover: carryover,
            updated_at: Date.now()
        };
        
        if (existingIndex >= 0) {
            allHistory[existingIndex] = historyItem;
        } else {
            allHistory.push(historyItem);
        }
        
        localStorage.setItem(STORAGE_KEYS.WEEKLY_HISTORY, JSON.stringify(allHistory));
        
        // 累積給付額を更新
        if (allowancePaid > 0) {
            currentSettings.total_paid = (currentSettings.total_paid || 0) + allowancePaid;
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(currentSettings));
        }
    } catch (error) {
        console.error('週履歴保存エラー:', error);
    }
}

// 達成記録の保存（LocalStorage版）
async function saveAchievements(achievements) {
    try {
        const allAchievements = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS) || '[]');
        const weekStartStr = formatDate(currentWeekStart);
        
        // 今週の達成記録を削除
        const filtered = allAchievements.filter(a => a.week_start !== weekStartStr);
        
        // 新しい達成記録を追加
        achievements.forEach(achievement => {
            filtered.push({
                id: 'achievement_' + Date.now() + '_' + achievement.category,
                ...achievement,
                created_at: Date.now()
            });
        });
        
        localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(filtered));
    } catch (error) {
        console.error('達成記録保存エラー:', error);
    }
}

// 履歴ページの初期化
async function initHistoryPage() {
    await updateTotalPaidDisplay();
    await updateWeeklyChart();
    await updateHistoryList();
}

// 累積給付額の表示更新
async function updateTotalPaidDisplay() {
    await loadSettings();
    document.getElementById('totalPaid').textContent = `${currentSettings.total_paid || 0}えん`;
}

// 週ごとのグラフを更新（LocalStorage版）
async function updateWeeklyChart() {
    try {
        const allHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.WEEKLY_HISTORY) || '[]');
        
        // 週の開始日で降順ソート
        allHistory.sort((a, b) => new Date(b.week_start) - new Date(a.week_start));
        
        const recentWeeks = allHistory.slice(0, 10).reverse();
        
        const labels = recentWeeks.map(w => {
            const date = new Date(w.week_start);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        });
        
        const data = recentWeeks.map(w => w.allowance_paid);
        
        const ctx = document.getElementById('weeklyChart');
        
        if (weeklyChart) {
            weeklyChart.destroy();
        }
        
        weeklyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'おこづかい（えん）',
                    data: data,
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('グラフの更新エラー:', error);
    }
}

// 履歴リストの更新（LocalStorage版）
async function updateHistoryList() {
    try {
        const allHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.WEEKLY_HISTORY) || '[]');
        allHistory.sort((a, b) => new Date(b.week_start) - new Date(a.week_start));
        
        const listContainer = document.getElementById('historyList');
        listContainer.innerHTML = '';
        
        if (allHistory.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#6c757d;">まだりれきがないよ</p>';
            return;
        }
        
        allHistory.forEach(week => {
            const item = document.createElement('div');
            item.className = 'history-item';
            
            const leftDiv = document.createElement('div');
            const weekDiv = document.createElement('div');
            weekDiv.className = 'history-week';
            weekDiv.textContent = week.week_label;
            
            const stampsDiv = document.createElement('div');
            stampsDiv.className = 'history-stamps';
            stampsDiv.textContent = `スタンプ：${week.total_stamps}こ`;
            
            leftDiv.appendChild(weekDiv);
            leftDiv.appendChild(stampsDiv);
            
            const amountDiv = document.createElement('div');
            amountDiv.className = 'history-amount';
            amountDiv.textContent = `${week.allowance_paid}えん`;
            
            item.appendChild(leftDiv);
            item.appendChild(amountDiv);
            listContainer.appendChild(item);
        });
    } catch (error) {
        console.error('履歴リスト更新エラー:', error);
    }
}

// ページ切り替え
async function showPage(pageName) {
    const pages = document.querySelectorAll('.page');
    const tabs = document.querySelectorAll('.nav-tab');
    
    pages.forEach(page => {
        page.classList.remove('active');
    });
    
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    
    if (pageName === 'stamp') {
        document.getElementById('stampPage').classList.add('active');
        tabs[0].classList.add('active');
        await initStampPage();
    } else if (pageName === 'history') {
        document.getElementById('historyPage').classList.add('active');
        tabs[1].classList.add('active');
        await initHistoryPage();
    } else if (pageName === 'settings') {
        document.getElementById('settingsPage').classList.add('active');
        tabs[2].classList.add('active');
        await loadSettings();
        if (customStamps.length === 0) {
            await loadCustomStamps();
        }
        await initSettingsPage();
    }
}

// 設定ページの初期化
async function initSettingsPage() {
    if (!currentSettings) {
        await loadSettings();
    }
    
    document.getElementById('childName').value = currentSettings.child_name || '';
    document.getElementById('stampPrice').value = currentSettings.stamp_unit_price || 10;
    document.getElementById('badgeThreshold').value = currentSettings.badge_threshold || 10;
    document.getElementById('badgeBonus').value = currentSettings.badge_bonus || 50;
    
    console.log('設定値を反映:', currentSettings);
    
    const container = document.getElementById('stampSettingsList');
    container.innerHTML = '';
    
    console.log('initSettingsPage: customStamps数 =', customStamps.length);
    
    if (customStamps.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">スタンプデータをよみこみちゅう...</p>';
        console.log('スタンプデータが空です。');
        return;
    }
    
    customStamps.forEach((stamp, index) => {
        const item = document.createElement('div');
        item.className = 'stamp-setting-item' + (stamp.is_active ? ' active' : '');
        item.dataset.stampId = stamp.id;
        item.style.cursor = 'pointer';
        
        item.innerHTML = `
            <div class="stamp-setting-emoji">${stamp.stamp_emoji}</div>
            <div class="stamp-setting-name">${stamp.stamp_name}</div>
            <div class="stamp-status" style="font-size: 11px; margin-top: 5px; color: ${stamp.is_active ? '#667eea' : '#999'};">
                ${stamp.is_active ? '✓ えらばれています' : 'タップしてえらぶ'}
            </div>
        `;
        
        let touchHandled = false;
        let touchStartTime = 0;
        
        item.addEventListener('touchstart', (e) => {
            touchHandled = false;
            touchStartTime = Date.now();
            item.style.transform = 'scale(0.95)';
            item.style.opacity = '0.7';
        }, { passive: true });
        
        item.addEventListener('touchend', (e) => {
            e.preventDefault();
            const touchDuration = Date.now() - touchStartTime;
            
            item.style.transform = 'scale(1)';
            item.style.opacity = '1';
            
            if (touchDuration < 500) {
                touchHandled = true;
                console.log(`タッチイベント: ${stamp.stamp_name} (${index + 1}/${customStamps.length})`);
                toggleStamp(stamp.id);
            }
        });
        
        item.addEventListener('click', (e) => {
            if (!touchHandled) {
                console.log(`クリックイベント: ${stamp.stamp_name} (${index + 1}/${customStamps.length})`);
                toggleStamp(stamp.id);
            }
            touchHandled = false;
        });
        
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'scale(1.05)';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.transform = 'scale(1)';
        });
        
        container.appendChild(item);
        console.log(`スタンプ追加: ${stamp.stamp_emoji} ${stamp.stamp_name} (${stamp.is_active ? '有効' : '無効'})`);
    });
    
    const activeCount = customStamps.filter(s => s.is_active).length;
    console.log(`スタンプリスト生成完了: 全${customStamps.length}件 (有効: ${activeCount}件)`);
}

// スタンプの有効/無効切り替え（LocalStorage版）
async function toggleStamp(stampId) {
    try {
        console.log('========================================');
        console.log('toggleStamp called:', stampId);
        console.log('現在のスタンプ数:', customStamps.length);
        
        const stamp = customStamps.find(s => s.id === stampId);
        if (!stamp) {
            console.error('スタンプが見つかりません:', stampId);
            alert('エラー：スタンプがみつかりません');
            return;
        }
        
        console.log('対象スタンプ:', stamp.stamp_emoji, stamp.stamp_name);
        console.log('現在の状態:', stamp.is_active ? '有効' : '無効');
        
        const activeCount = customStamps.filter(s => s.is_active).length;
        console.log('現在の有効スタンプ数:', activeCount);
        
        if (!stamp.is_active && activeCount >= 6) {
            console.log('6個制限により変更不可');
            alert('スタンプは6このまでだよ！\n\nさきにほかのをタップして\nけしてから、もういちど\nためしてね');
            return;
        }
        
        const newState = !stamp.is_active;
        console.log('新しい状態:', newState ? '有効' : '無効');
        
        stamp.is_active = newState;
        localStorage.setItem(STORAGE_KEYS.CUSTOM_STAMPS, JSON.stringify(customStamps));
        
        console.log('LocalStorage更新成功');
        
        updateStampPalette();
        console.log('スタンプパレット更新完了');
        
        await initSettingsPage();
        console.log('設定画面再描画完了');
        
        console.log('スタンプ切り替え完了:', stamp.stamp_name, '→', newState ? '有効' : '無効');
        console.log('========================================');
        
    } catch (error) {
        console.error('スタンプ切り替えエラー:', error);
        alert('エラーがおきました\n\nもういちどためしてね');
    }
}

// 基本設定の保存（LocalStorage版）
async function saveBasicSettings() {
    try {
        const childName = document.getElementById('childName').value.trim();
        const stampPrice = parseInt(document.getElementById('stampPrice').value);
        const badgeThreshold = parseInt(document.getElementById('badgeThreshold').value);
        const badgeBonus = parseInt(document.getElementById('badgeBonus').value);
        
        if (!childName) {
            alert('なまえをいれてね');
            return;
        }
        
        if (stampPrice < 1) {
            alert('ねだんは1えんいじょうにしてね');
            return;
        }
        
        if (badgeThreshold < 1) {
            alert('バッジのかずは1こいじょうにしてね');
            return;
        }
        
        if (badgeBonus < 0) {
            alert('ごほうびは0えんいじょうにしてね');
            return;
        }
        
        currentSettings.child_name = childName;
        currentSettings.stamp_unit_price = stampPrice;
        currentSettings.badge_threshold = badgeThreshold;
        currentSettings.badge_bonus = badgeBonus;
        
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(currentSettings));
        
        document.getElementById('userName').textContent = `なまえ：${currentSettings.child_name}`;
        
        console.log('設定保存成功:', currentSettings);
        alert('ほぞんしたよ！');
        
    } catch (error) {
        console.error('設定保存エラー:', error);
        alert('エラーがおきたよ');
    }
}

// データリセット確認
function confirmResetData() {
    if (confirm('ほんとうにぜんぶけしてもいいですか？もとにはもどせません！')) {
        if (confirm('さいごのかくにん：ほんとうにけしますか？')) {
            resetAllData();
        }
    }
}

// 全データリセット（LocalStorage版）
async function resetAllData() {
    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        
        alert('すべてのデータをけしたよ！');
        location.reload();
        
    } catch (error) {
        console.error('データリセットエラー:', error);
        alert('エラーがおきたよ');
    }
}

// バックアップのエクスポート（固定ファイル名）
async function exportDataFixed() {
    try {
        const backupData = {
            version: '4.1.0-localStorage',
            exported_at: new Date().toISOString(),
            settings: JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || 'null'),
            stamps: JSON.parse(localStorage.getItem(STORAGE_KEYS.STAMPS) || '[]'),
            weekly_history: JSON.parse(localStorage.getItem(STORAGE_KEYS.WEEKLY_HISTORY) || '[]'),
            custom_stamps: JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_STAMPS) || '[]'),
            achievements: JSON.parse(localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS) || '[]')
        };
        
        const dataStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'okozukai-backup.json';  // 固定ファイル名
        a.click();
        
        URL.revokeObjectURL(url);
        
        // 自動バックアップ情報を更新
        const backupInfo = {
            last_backup: Date.now(),
            data: backupData
        };
        localStorage.setItem(STORAGE_KEYS.BACKUP, JSON.stringify(backupInfo));
        
        alert('バックアップファイルをほぞんしました！\n\nファイル名: okozukai-backup.json\niCloud DriveやGoogleドライブにほぞんしてね');
        
    } catch (error) {
        console.error('エクスポートエラー:', error);
        alert('バックアップがうまくいかなかったよ');
    }
}

// クリップボードにコピー
async function copyToClipboard() {
    try {
        const backupData = {
            version: '4.1.0-localStorage',
            exported_at: new Date().toISOString(),
            settings: JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || 'null'),
            stamps: JSON.parse(localStorage.getItem(STORAGE_KEYS.STAMPS) || '[]'),
            weekly_history: JSON.parse(localStorage.getItem(STORAGE_KEYS.WEEKLY_HISTORY) || '[]'),
            custom_stamps: JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_STAMPS) || '[]'),
            achievements: JSON.parse(localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS) || '[]')
        };
        
        const dataStr = JSON.stringify(backupData, null, 2);
        
        // クリップボードAPIを使用
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(dataStr);
            alert('データをコピーしました！\n\nGoogleドライブを開いて：\n1. 新しいテキストファイルを作成\n2. 貼り付け（ペースト）\n3. 「okozukai-backup.txt」として保存');
        } else {
            // 古いブラウザ向けのフォールバック
            const textArea = document.createElement('textarea');
            textArea.value = dataStr;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('データをコピーしました！\n\nGoogleドライブを開いて：\n1. 新しいテキストファイルを作成\n2. 貼り付け（ペースト）\n3. 「okozukai-backup.txt」として保存');
        }
        
        // 自動バックアップ情報も更新
        const backupInfo = {
            last_backup: Date.now(),
            data: backupData
        };
        localStorage.setItem(STORAGE_KEYS.BACKUP, JSON.stringify(backupInfo));
        
    } catch (error) {
        console.error('クリップボードコピーエラー:', error);
        alert('コピーできませんでした。\nファイルでバックアップしてね');
    }
}

// QRコード表示
async function showQRCode() {
    try {
        const backupData = {
            version: '4.1.0-localStorage',
            exported_at: new Date().toISOString(),
            settings: JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || 'null'),
            stamps: JSON.parse(localStorage.getItem(STORAGE_KEYS.STAMPS) || '[]'),
            weekly_history: JSON.parse(localStorage.getItem(STORAGE_KEYS.WEEKLY_HISTORY) || '[]'),
            custom_stamps: JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_STAMPS) || '[]'),
            achievements: JSON.parse(localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS) || '[]')
        };
        
        const dataStr = JSON.stringify(backupData);
        
        // データサイズチェック（QRコードには制限がある）
        if (dataStr.length > 2000) {
            if (!confirm('データがおおきいので、QRコードがよみとりにくいかもしれません。\n\nファイルかコピーをおすすめしますが、QRコードをひょうじしますか？')) {
                return;
            }
        }
        
        const modal = document.getElementById('qrModal');
        const canvas = document.getElementById('qrCanvas');
        
        // QRコード生成
        QRCode.toCanvas(canvas, dataStr, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        }, function (error) {
            if (error) {
                console.error('QRコード生成エラー:', error);
                alert('QRコードがつくれませんでした。\nデータがおおすぎるかもしれません。\nファイルかコピーをつかってね');
            } else {
                modal.classList.add('active');
            }
        });
        
    } catch (error) {
        console.error('QRコード表示エラー:', error);
        alert('QRコードがつくれませんでした');
    }
}

// QRモーダルを閉じる
function closeQRModal() {
    const modal = document.getElementById('qrModal');
    modal.classList.remove('active');
}

// クリップボードから復元
async function pasteFromClipboard() {
    try {
        if (!confirm('いまのデータはぜんぶきえて、コピーしたデータにもどります。よろしいですか？')) {
            return;
        }
        
        let clipboardText = '';
        
        // クリップボードAPIを使用
        if (navigator.clipboard && navigator.clipboard.readText) {
            clipboardText = await navigator.clipboard.readText();
        } else {
            clipboardText = prompt('コピーしたデータをはりつけてください：\n\n（Googleドライブのテキストファイルをひらいて、ぜんぶせんたくしてコピーしてね）');
            if (!clipboardText) {
                return;
            }
        }
        
        const backupData = JSON.parse(clipboardText);
        
        // データを復元
        if (backupData.settings) {
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(backupData.settings));
        }
        if (backupData.stamps) {
            localStorage.setItem(STORAGE_KEYS.STAMPS, JSON.stringify(backupData.stamps));
        }
        if (backupData.weekly_history) {
            localStorage.setItem(STORAGE_KEYS.WEEKLY_HISTORY, JSON.stringify(backupData.weekly_history));
        }
        if (backupData.custom_stamps) {
            localStorage.setItem(STORAGE_KEYS.CUSTOM_STAMPS, JSON.stringify(backupData.custom_stamps));
        }
        if (backupData.achievements) {
            localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(backupData.achievements));
        }
        
        alert('データをふくげんしたよ！ページをさいどくします');
        location.reload();
        
    } catch (error) {
        console.error('クリップボード復元エラー:', error);
        alert('ふくげんできませんでした。\nコピーしたデータがただしいかかくにんしてね');
    }
}

// バックアップのエクスポート（旧版・互換性のため残す）
async function exportData() {
    // 新しい固定ファイル名版を呼び出す
    return exportDataFixed();
}

// バックアップのインポート
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const backupData = JSON.parse(text);
            
            if (!confirm('いまのデータはぜんぶきえて、バックアップのデータにもどります。よろしいですか？')) {
                return;
            }
            
            if (backupData.settings) {
                localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(backupData.settings));
            }
            if (backupData.stamps) {
                localStorage.setItem(STORAGE_KEYS.STAMPS, JSON.stringify(backupData.stamps));
            }
            if (backupData.weekly_history) {
                localStorage.setItem(STORAGE_KEYS.WEEKLY_HISTORY, JSON.stringify(backupData.weekly_history));
            }
            if (backupData.custom_stamps) {
                localStorage.setItem(STORAGE_KEYS.CUSTOM_STAMPS, JSON.stringify(backupData.custom_stamps));
            }
            if (backupData.achievements) {
                localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(backupData.achievements));
            }
            
            alert('データをふくげんしたよ！ページをさいどくします');
            location.reload();
            
        } catch (error) {
            console.error('インポートエラー:', error);
            alert('ファイルがよみこめなかったよ。ただしいバックアップファイルかかくにんしてね');
        }
    };
    
    input.click();
}

// 自動バックアップのチェックと実行
async function checkAndPerformAutoBackup() {
    try {
        const backupInfo = JSON.parse(localStorage.getItem(STORAGE_KEYS.BACKUP) || 'null');
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        
        if (!backupInfo || (now - backupInfo.last_backup > oneDayMs)) {
            await performAutoBackup();
        }
        
        // 最終バックアップ日時を表示
        if (backupInfo && backupInfo.last_backup) {
            const lastBackupDate = new Date(backupInfo.last_backup);
            const dateStr = `${lastBackupDate.getFullYear()}ねん${lastBackupDate.getMonth() + 1}がつ${lastBackupDate.getDate()}にち`;
            const elem = document.getElementById('lastBackupDate');
            if (elem) {
                elem.textContent = dateStr;
            }
        }
    } catch (error) {
        console.error('自動バックアップチェックエラー:', error);
    }
}

// 自動バックアップの実行
async function performAutoBackup() {
    try {
        const backupData = {
            version: '3.3.0-localStorage',
            backed_up_at: new Date().toISOString(),
            settings: JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || 'null'),
            stamps: JSON.parse(localStorage.getItem(STORAGE_KEYS.STAMPS) || '[]'),
            weekly_history: JSON.parse(localStorage.getItem(STORAGE_KEYS.WEEKLY_HISTORY) || '[]'),
            custom_stamps: JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_STAMPS) || '[]'),
            achievements: JSON.parse(localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS) || '[]')
        };
        
        const backupInfo = {
            last_backup: Date.now(),
            data: backupData
        };
        
        localStorage.setItem(STORAGE_KEYS.BACKUP, JSON.stringify(backupInfo));
        console.log('自動バックアップ完了:', new Date().toISOString());
    } catch (error) {
        console.error('自動バックアップエラー:', error);
    }
}

// 自動バックアップから復元
async function restoreFromAutoBackup() {
    try {
        const backupInfo = JSON.parse(localStorage.getItem(STORAGE_KEYS.BACKUP) || 'null');
        
        if (!backupInfo || !backupInfo.data) {
            alert('じどうバックアップがみつかりません');
            return;
        }
        
        if (!confirm('いまのデータはぜんぶきえて、じどうバックアップのデータにもどります。よろしいですか？')) {
            return;
        }
        
        const backupData = backupInfo.data;
        
        if (backupData.settings) {
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(backupData.settings));
        }
        if (backupData.stamps) {
            localStorage.setItem(STORAGE_KEYS.STAMPS, JSON.stringify(backupData.stamps));
        }
        if (backupData.weekly_history) {
            localStorage.setItem(STORAGE_KEYS.WEEKLY_HISTORY, JSON.stringify(backupData.weekly_history));
        }
        if (backupData.custom_stamps) {
            localStorage.setItem(STORAGE_KEYS.CUSTOM_STAMPS, JSON.stringify(backupData.custom_stamps));
        }
        if (backupData.achievements) {
            localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(backupData.achievements));
        }
        
        alert('データをふくげんしたよ！ページをさいどくします');
        location.reload();
        
    } catch (error) {
        console.error('自動バックアップ復元エラー:', error);
        alert('ふくげんがうまくいかなかったよ');
    }
}

// バックアップガイドを表示
function showBackupGuide() {
    const modal = document.getElementById('backupGuideModal');
    modal.classList.add('active');
}

// バックアップガイドを閉じる
function closeBackupGuide() {
    const modal = document.getElementById('backupGuideModal');
    modal.classList.remove('active');
}
