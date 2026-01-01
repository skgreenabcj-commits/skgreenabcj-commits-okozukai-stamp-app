// グローバル変数
let currentWeekStart = null;
let currentSettings = null;
let weeklyChart = null;
let selectedCell = null;
let customStamps = [];
let isDeleteMode = false;
let deleteModeLongPressTimer = null;

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

// 設定の読み込み
async function loadSettings() {
    try {
        const response = await fetch('tables/settings?limit=1');
        const data = await response.json();
        if (data.data && data.data.length > 0) {
            currentSettings = data.data[0];
            
            // バッジ設定のデフォルト値を設定（存在しない場合）
            if (currentSettings.badge_threshold === undefined || currentSettings.badge_threshold === null) {
                currentSettings.badge_threshold = 10;
            }
            if (currentSettings.badge_bonus === undefined || currentSettings.badge_bonus === null) {
                currentSettings.badge_bonus = 50;
            }
            
            // デフォルト値をデータベースに保存
            if (!data.data[0].badge_threshold || !data.data[0].badge_bonus) {
                await fetch(`tables/settings/${currentSettings.id}`, {
                    method: 'PATCH',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        badge_threshold: currentSettings.badge_threshold,
                        badge_bonus: currentSettings.badge_bonus
                    })
                });
            }
        } else {
            // デフォルト設定を作成
            const createResponse = await fetch('tables/settings', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    child_name: 'おなまえ',
                    stamp_unit_price: 10,
                    total_paid: 0,
                    badge_threshold: 10,
                    badge_bonus: 50
                })
            });
            currentSettings = await createResponse.json();
        }
        
        // 名前を表示
        document.getElementById('userName').textContent = `なまえ：${currentSettings.child_name}`;
    } catch (error) {
        console.error('設定の読み込みエラー:', error);
    }
}

// カスタムスタンプの読み込み
async function loadCustomStamps() {
    try {
        const response = await fetch('tables/custom_stamps?limit=100');
        const data = await response.json();
        customStamps = data.data || [];
        
        // データが空の場合は初期データを作成
        if (customStamps.length === 0) {
            await initializeDefaultStamps();
            // 再度読み込み
            const reloadResponse = await fetch('tables/custom_stamps?limit=100');
            const reloadData = await reloadResponse.json();
            customStamps = reloadData.data || [];
        }
        
        updateStampPalette();
    } catch (error) {
        console.error('カスタムスタンプの読み込みエラー:', error);
    }
}

// 初期スタンプデータの作成
async function initializeDefaultStamps() {
    const defaultStamps = [
        { stamp_name: 'プリンセス', stamp_emoji: '👸', is_active: true },
        { stamp_name: 'きらきら', stamp_emoji: '🌟', is_active: true },
        { stamp_name: 'おいわい', stamp_emoji: '🎉', is_active: true },
        { stamp_name: 'トロフィー', stamp_emoji: '🏆', is_active: true },
        { stamp_name: 'ねこ', stamp_emoji: '🐱', is_active: true },
        { stamp_name: 'ちょうちょ', stamp_emoji: '🦋', is_active: true },
        { stamp_name: 'にじ', stamp_emoji: '🌈', is_active: false },
        { stamp_name: 'おはな', stamp_emoji: '🌸', is_active: false },
        { stamp_name: 'メダル', stamp_emoji: '🏅', is_active: false },
        { stamp_name: 'くるま', stamp_emoji: '🚗', is_active: false },
        { stamp_name: 'でんしゃ', stamp_emoji: '🚂', is_active: false },
        { stamp_name: 'はたらくくるま', stamp_emoji: '🚜', is_active: false },
        { stamp_name: 'おうかん', stamp_emoji: '👑', is_active: false },
        { stamp_name: 'はーと', stamp_emoji: '💝', is_active: false }
    ];
    
    try {
        for (const stamp of defaultStamps) {
            await fetch('tables/custom_stamps', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(stamp)
            });
        }
        console.log('初期スタンプデータを作成しました');
    } catch (error) {
        console.error('初期スタンプデータ作成エラー:', error);
    }
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
    const diff = day === 0 ? -6 : 1 - day; // 日曜日の場合は-6、それ以外は月曜日までの差分
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

// 週ラベルの生成（●がつ●にちのしゅう）
function getWeekLabel(weekStart) {
    const month = weekStart.getMonth() + 1;
    const day = weekStart.getDate();
    return `なんしゅう：${month}がつ${day}にちのしゅう`;
}

// 曜日名の配列
const dayNames = ['げつ', 'か', 'すい', 'もく', 'きん', 'ど', 'にち'];

// スタンプページの初期化
async function initStampPage() {
    // 設定を最新に更新
    await loadSettings();
    
    // 週ラベルの設定
    document.getElementById('weekLabel').textContent = getWeekLabel(currentWeekStart);
    
    // スタンプ表の生成
    await generateStampTable();
    
    // 週の集計を更新
    await updateWeeklySummary();
}

// スタンプ表の生成
async function generateStampTable() {
    const tbody = document.getElementById('stampTableBody');
    tbody.innerHTML = '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 週の各日のデータを取得
    const stamps = await getWeekStamps(currentWeekStart);
    
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(currentWeekStart);
        currentDate.setDate(currentDate.getDate() + i);
        const dateStr = formatDate(currentDate);
        
        const isToday = currentDate.getTime() === today.getTime();
        
        const row = document.createElement('tr');
        
        // 曜日セル
        const dayCell = document.createElement('td');
        dayCell.className = isToday ? 'day-cell today' : 'day-cell';
        dayCell.textContent = dayNames[i];
        row.appendChild(dayCell);
        
        // 各カテゴリーのスタンプセル
        const categories = ['おべんきょう', 'おてつだい', 'よいこ'];
        let dayTotal = 0;
        
        categories.forEach(category => {
            const cell = document.createElement('td');
            cell.className = 'stamp-cell';
            cell.dataset.date = dateStr;
            cell.dataset.category = category;
            
            const stampData = stamps.filter(s => s.date === dateStr && s.category === category);
            const stampCount = stampData.reduce((sum, s) => sum + s.stamp_count, 0);
            dayTotal += stampCount;
            
            if (stampCount > 0) {
                const display = document.createElement('div');
                display.className = 'stamp-display';
                stampData.forEach(s => {
                    for (let j = 0; j < s.stamp_count; j++) {
                        const stamp = document.createElement('span');
                        stamp.textContent = s.stamp_type;
                        display.appendChild(stamp);
                    }
                });
                cell.appendChild(display);
            }
            
            cell.addEventListener('click', () => openStampModal(dateStr, category));
            
            // 長押しで削除モード
            let longPressTimer;
            cell.addEventListener('touchstart', (e) => {
                if (stampCount > 0) {
                    longPressTimer = setTimeout(() => {
                        enableDeleteMode();
                    }, 800);
                }
            });
            cell.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
            });
            cell.addEventListener('touchmove', () => {
                clearTimeout(longPressTimer);
            });
            
            row.appendChild(cell);
        });
        
        // 日ごとの合計
        const totalCell = document.createElement('td');
        totalCell.className = 'count-cell';
        totalCell.textContent = dayTotal;
        row.appendChild(totalCell);
        
        tbody.appendChild(row);
    }
}

// 週のスタンプデータを取得
async function getWeekStamps(weekStart) {
    try {
        const weekStartStr = formatDate(weekStart);
        const response = await fetch(`tables/stamps?limit=100`);
        const data = await response.json();
        
        return data.data.filter(s => s.week_start === weekStartStr);
    } catch (error) {
        console.error('スタンプデータの取得エラー:', error);
        return [];
    }
}

// スタンプモーダルを開く
function openStampModal(date, category) {
    if (isDeleteMode) {
        // 削除モードの場合はスタンプ削除
        deleteStamps(date, category);
        return;
    }
    
    selectedCell = { date, category };
    
    const modal = document.getElementById('stampModal');
    const modalInfo = document.getElementById('modalInfo');
    
    const dateObj = new Date(date);
    const dayOfWeek = dayNames[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1];
    
    modalInfo.textContent = `${dayOfWeek}ようび：${category}`;
    
    // アクティブなスタンプを取得
    const activeStamps = customStamps.filter(s => s.is_active).slice(0, 6);
    
    // スタンプ選択エリアを更新
    const stampSelection = document.getElementById('stampSelection');
    stampSelection.innerHTML = '';
    activeStamps.forEach(stamp => {
        const btn = document.createElement('button');
        btn.className = 'stamp-select-btn';
        btn.dataset.stamp = stamp.stamp_emoji;
        btn.textContent = stamp.stamp_emoji;
        btn.onclick = () => addStamp(stamp.stamp_emoji);
        stampSelection.appendChild(btn);
    });
    
    modal.classList.add('active');
}

// モーダルを閉じる
function closeModal() {
    document.getElementById('stampModal').classList.remove('active');
    selectedCell = null;
}

// スタンプを追加
async function addStamp(stampType) {
    if (!selectedCell) return;
    
    const { date, category } = selectedCell;
    const weekStartStr = formatDate(currentWeekStart);
    
    try {
        // 現在のスタンプ数を確認
        const stamps = await getWeekStamps(currentWeekStart);
        const existingStamps = stamps.filter(s => s.date === date && s.category === category);
        const currentCount = existingStamps.reduce((sum, s) => sum + s.stamp_count, 0);
        
        if (currentCount >= 2) {
            alert('もう2つスタンプがおしてあるよ！');
            closeModal();
            return;
        }
        
        // スタンプを追加
        await fetch('tables/stamps', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                week_start: weekStartStr,
                date: date,
                category: category,
                stamp_type: stampType,
                stamp_count: 1
            })
        });
        
        // 表示を更新
        await generateStampTable();
        await updateWeeklySummary();
        closeModal();
        
    } catch (error) {
        console.error('スタンプ追加エラー:', error);
        alert('エラーがおきたよ');
    }
}

// 週の集計を更新
async function updateWeeklySummary() {
    const stamps = await getWeekStamps(currentWeekStart);
    const totalStamps = stamps.reduce((sum, s) => sum + s.stamp_count, 0);
    
    // 各カテゴリーのスタンプ数を計算
    const categories = ['おべんきょう', 'おてつだい', 'よいこ'];
    const categoryStamps = {};
    categories.forEach(cat => {
        categoryStamps[cat] = stamps.filter(s => s.category === cat).reduce((sum, s) => sum + s.stamp_count, 0);
    });
    
    // 達成バッジのチェック（設定値に基づく）
    const badgeThreshold = currentSettings.badge_threshold || 10;
    const badgeBonus = currentSettings.badge_bonus || 50;
    
    const achievements = [];
    let totalBonus = 0;
    categories.forEach(cat => {
        if (categoryStamps[cat] >= badgeThreshold) {
            achievements.push({
                category: cat,
                count: categoryStamps[cat],
                bonus: badgeBonus
            });
            totalBonus += badgeBonus;
        }
    });
    
    // 達成バッジの表示
    displayAchievements(achievements);
    
    // 前週からの持ち越し額を取得
    const previousCarryover = await getPreviousCarryover();
    
    // 今週の合計金額（持ち越し含む + ボーナス含む）
    const totalAmount = totalStamps * currentSettings.stamp_unit_price + previousCarryover + totalBonus;
    
    // 100円単位で給付
    const allowancePaid = Math.floor(totalAmount / 100) * 100;
    
    // 持ち越し額（100円未満）
    const carryover = totalAmount - allowancePaid;
    
    // 表示更新
    document.getElementById('weeklyStamps').textContent = totalStamps;
    document.getElementById('weeklyAllowance').textContent = `${allowancePaid}えん`;
    document.getElementById('carryoverAmount').textContent = `${carryover}えん`;
    
    // ボーナスセクションの表示
    const bonusSection = document.getElementById('bonusSection');
    if (totalBonus > 0) {
        bonusSection.style.display = 'block';
        document.getElementById('bonusAmount').textContent = `${totalBonus}えん`;
    } else {
        bonusSection.style.display = 'none';
    }
    
    // 持ち越しセクションの表示制御
    const carryoverSection = document.getElementById('carryoverSection');
    if (carryover > 0) {
        carryoverSection.style.display = 'block';
    } else {
        carryoverSection.style.display = 'none';
    }
    
    // 週履歴の保存/更新
    await saveWeeklyHistory(totalStamps, allowancePaid, carryover);
    
    // 達成記録の保存
    if (achievements.length > 0) {
        await saveAchievements(achievements);
    }
}

// 前週の持ち越し額を取得
async function getPreviousCarryover() {
    try {
        const previousWeekStart = new Date(currentWeekStart);
        previousWeekStart.setDate(previousWeekStart.getDate() - 7);
        const previousWeekStartStr = formatDate(previousWeekStart);
        
        const response = await fetch(`tables/weekly_history?limit=100`);
        const data = await response.json();
        
        const previousWeek = data.data.find(w => w.week_start === previousWeekStartStr);
        return previousWeek ? previousWeek.carryover : 0;
    } catch (error) {
        console.error('前週持ち越し額の取得エラー:', error);
        return 0;
    }
}

// 週履歴の保存
async function saveWeeklyHistory(totalStamps, allowancePaid, carryover) {
    try {
        const weekStartStr = formatDate(currentWeekStart);
        const weekLabel = getWeekLabel(currentWeekStart);
        
        const response = await fetch(`tables/weekly_history?limit=100`);
        const data = await response.json();
        
        const existing = data.data.find(w => w.week_start === weekStartStr);
        
        const historyData = {
            week_start: weekStartStr,
            week_label: weekLabel,
            total_stamps: totalStamps,
            allowance_paid: allowancePaid,
            carryover: carryover
        };
        
        if (existing) {
            // 更新
            await fetch(`tables/weekly_history/${existing.id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(historyData)
            });
        } else {
            // 新規作成
            await fetch('tables/weekly_history', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(historyData)
            });
        }
        
        // 累積給付額を更新
        if (allowancePaid > 0) {
            await updateTotalPaid(allowancePaid);
        }
    } catch (error) {
        console.error('週履歴の保存エラー:', error);
    }
}

// 累積給付額を更新
async function updateTotalPaid(newAmount) {
    try {
        // 既存の全履歴から合計を計算
        const response = await fetch('tables/weekly_history?limit=1000');
        const data = await response.json();
        
        const totalPaid = data.data.reduce((sum, w) => sum + w.allowance_paid, 0);
        
        // 設定を更新
        await fetch(`tables/settings/${currentSettings.id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                total_paid: totalPaid
            })
        });
        
        currentSettings.total_paid = totalPaid;
    } catch (error) {
        console.error('累積給付額の更新エラー:', error);
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
    document.getElementById('totalPaid').textContent = `${currentSettings.total_paid}えん`;
}

// 週ごとのグラフを更新
async function updateWeeklyChart() {
    try {
        const response = await fetch('tables/weekly_history?limit=100&sort=-week_start');
        const data = await response.json();
        
        // 最新10週分を取得（逆順にする）
        const recentWeeks = data.data.slice(0, 10).reverse();
        
        const labels = recentWeeks.map(w => {
            const date = new Date(w.week_start);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        });
        
        const amounts = recentWeeks.map(w => w.allowance_paid);
        
        const ctx = document.getElementById('weeklyChart').getContext('2d');
        
        if (weeklyChart) {
            weeklyChart.destroy();
        }
        
        weeklyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'おこづかい（えん）',
                    data: amounts,
                    backgroundColor: 'rgba(102, 126, 234, 0.7)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: {
                                size: 14,
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

// 履歴リストの更新
async function updateHistoryList() {
    try {
        const response = await fetch('tables/weekly_history?limit=100&sort=-week_start');
        const data = await response.json();
        
        const listContainer = document.getElementById('historyList');
        listContainer.innerHTML = '';
        
        if (data.data.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#6c757d;">まだりれきがないよ</p>';
            return;
        }
        
        data.data.forEach(week => {
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
        console.error('履歴リストの更新エラー:', error);
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
        // 設定を最新の状態に更新してから初期化
        loadSettings().then(() => {
            if (customStamps.length === 0) {
                loadCustomStamps().then(() => initSettingsPage());
            } else {
                initSettingsPage();
            }
        });
    }
}

// 達成バッジの表示
function displayAchievements(achievements) {
    const container = document.getElementById('achievementBadges');
    container.innerHTML = '';
    
    if (achievements.length === 0) {
        return;
    }
    
    achievements.forEach(ach => {
        const badge = document.createElement('div');
        badge.className = 'achievement-badge';
        
        badge.innerHTML = `
            <div class="achievement-badge-icon">🏆</div>
            <div class="achievement-badge-text">
                <div class="achievement-badge-title">たっせい！</div>
                <div class="achievement-badge-detail">${ach.category}：${ach.count}こ</div>
            </div>
            <div class="achievement-badge-bonus">+${ach.bonus}えん</div>
        `;
        
        container.appendChild(badge);
    });
}

// 達成記録の保存
async function saveAchievements(achievements) {
    try {
        const weekStartStr = formatDate(currentWeekStart);
        
        for (const ach of achievements) {
            const response = await fetch('tables/achievements?limit=100');
            const data = await response.json();
            
            const existing = data.data.find(a => 
                a.week_start === weekStartStr && a.category === ach.category
            );
            
            const achData = {
                week_start: weekStartStr,
                category: ach.category,
                stamp_count: ach.count,
                bonus_amount: ach.bonus
            };
            
            if (!existing) {
                await fetch('tables/achievements', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(achData)
                });
            }
        }
    } catch (error) {
        console.error('達成記録の保存エラー:', error);
    }
}

// 削除モードの有効化
function enableDeleteMode() {
    isDeleteMode = true;
    
    // バナーを表示
    const banner = document.createElement('div');
    banner.className = 'delete-mode-banner';
    banner.id = 'deleteModeBanner';
    banner.textContent = 'スタンプをけすモード：けしたいマスをおしてね';
    document.body.appendChild(banner);
    
    // キャンセルボタンを表示
    const buttons = document.createElement('div');
    buttons.className = 'delete-mode-buttons';
    buttons.id = 'deleteModeButtons';
    buttons.innerHTML = `
        <button class="btn-delete-mode cancel" onclick="disableDeleteMode()">もどる</button>
    `;
    document.body.appendChild(buttons);
    
    // テーブルセルにクラスを追加
    document.querySelectorAll('.stamp-cell').forEach(cell => {
        if (cell.querySelector('.stamp-display')) {
            cell.classList.add('delete-mode');
        }
    });
}

// 削除モードの無効化
function disableDeleteMode() {
    isDeleteMode = false;
    
    const banner = document.getElementById('deleteModeBanner');
    const buttons = document.getElementById('deleteModeButtons');
    if (banner) banner.remove();
    if (buttons) buttons.remove();
    
    document.querySelectorAll('.stamp-cell').forEach(cell => {
        cell.classList.remove('delete-mode');
    });
}

// スタンプの削除
async function deleteStamps(date, category) {
    if (!confirm(`${category}のスタンプをぜんぶけしてもいいですか？`)) {
        return;
    }
    
    try {
        const stamps = await getWeekStamps(currentWeekStart);
        const stampsToDelete = stamps.filter(s => s.date === date && s.category === category);
        
        for (const stamp of stampsToDelete) {
            await fetch(`tables/stamps/${stamp.id}`, {
                method: 'DELETE'
            });
        }
        
        await generateStampTable();
        await updateWeeklySummary();
        disableDeleteMode();
        
    } catch (error) {
        console.error('スタンプ削除エラー:', error);
        alert('エラーがおきたよ');
    }
}

// 設定ページの初期化
async function initSettingsPage() {
    // 基本設定の読み込み
    if (!currentSettings) {
        console.log('設定データがありません。読み込みます...');
        await loadSettings();
    }
    
    document.getElementById('childName').value = currentSettings.child_name || '';
    document.getElementById('stampPrice').value = currentSettings.stamp_unit_price || 10;
    
    // バッジ設定の読み込み
    document.getElementById('badgeThreshold').value = currentSettings.badge_threshold || 10;
    document.getElementById('badgeBonus').value = currentSettings.badge_bonus || 50;
    
    console.log('設定値を反映:', {
        name: currentSettings.child_name,
        price: currentSettings.stamp_unit_price,
        threshold: currentSettings.badge_threshold,
        bonus: currentSettings.badge_bonus
    });
    
    // スタンプ設定リストの生成
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
        
        // 選択可能であることを示すために、カーソルとホバー効果を強調
        item.style.cursor = 'pointer';
        
        item.innerHTML = `
            <div class="stamp-setting-emoji">${stamp.stamp_emoji}</div>
            <div class="stamp-setting-name">${stamp.stamp_name}</div>
            <div class="stamp-status" style="font-size: 11px; margin-top: 5px; color: ${stamp.is_active ? '#667eea' : '#999'};">
                ${stamp.is_active ? '✓ えらばれています' : 'タップしてえらぶ'}
            </div>
        `;
        
        // iPhoneでも動作するようにtouchイベントとclickイベントの両方を追加
        let touchHandled = false;
        let touchStartTime = 0;
        
        item.addEventListener('touchstart', (e) => {
            touchHandled = false;
            touchStartTime = Date.now();
            // 視覚的フィードバック
            item.style.transform = 'scale(0.95)';
            item.style.opacity = '0.7';
        }, { passive: true });
        
        item.addEventListener('touchend', (e) => {
            e.preventDefault();
            const touchDuration = Date.now() - touchStartTime;
            
            // 視覚的フィードバックをリセット
            item.style.transform = 'scale(1)';
            item.style.opacity = '1';
            
            // タップとして認識（短時間のタッチ）
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
        
        // ホバー効果（デスクトップ用）
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

// スタンプの有効/無効切り替え
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
        
        // アクティブなスタンプ数をカウント
        const activeCount = customStamps.filter(s => s.is_active).length;
        console.log('現在の有効スタンプ数:', activeCount);
        
        // 有効にする場合、6個を超えないかチェック
        if (!stamp.is_active && activeCount >= 6) {
            console.log('6個制限により変更不可');
            alert('スタンプは6このまでだよ！\n\nさきにほかのをタップして\nけしてから、もういちど\nためしてね');
            return;
        }
        
        // 切り替え
        const newState = !stamp.is_active;
        console.log('新しい状態:', newState ? '有効' : '無効');
        console.log('データベース更新開始...');
        
        const response = await fetch(`tables/custom_stamps/${stamp.id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ is_active: newState })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('更新失敗:', response.status, errorText);
            throw new Error(`更新失敗: ${response.status}`);
        }
        
        console.log('データベース更新成功');
        
        // データベースから最新の状態を取得して確認
        const verifyResponse = await fetch(`tables/custom_stamps/${stamp.id}`);
        const verifyData = await verifyResponse.json();
        console.log('データベース確認:', verifyData.is_active ? '有効' : '無効');
        
        // ローカルのデータも更新
        stamp.is_active = newState;
        
        // スタンプパレットを更新（メインページ用）
        updateStampPalette();
        console.log('スタンプパレット更新完了');
        
        // スタンプデータを再読み込みしてから設定画面を再描画
        await loadCustomStamps();
        console.log('スタンプデータ再読み込み完了');
        
        await initSettingsPage();
        console.log('設定画面再描画完了');
        
        console.log('スタンプ切り替え完了:', stamp.stamp_name, '→', newState ? '有効' : '無効');
        console.log('========================================');
        
    } catch (error) {
        console.error('スタンプ切り替えエラー:', error);
        alert('エラーがおきました\n\nもういちどためしてね\n\nそれでもだめなら\nページをリロードしてください');
    }
}

// 基本設定の保存
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
        
        const response = await fetch(`tables/settings/${currentSettings.id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                child_name: childName,
                stamp_unit_price: stampPrice,
                badge_threshold: badgeThreshold,
                badge_bonus: badgeBonus
            })
        });
        
        if (!response.ok) {
            throw new Error('ほぞんにしっぱいしました');
        }
        
        // 設定を再読み込みして最新の状態を取得
        await loadSettings();
        
        // 画面を更新して保存内容を反映
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

// 全データリセット
async function resetAllData() {
    try {
        // スタンプデータをクリア
        await fetch('tables/stamps', {
            method: 'DELETE'
        });
        
        // 週履歴をクリア
        await fetch('tables/weekly_history', {
            method: 'DELETE'
        });
        
        // 達成記録をクリア
        await fetch('tables/achievements', {
            method: 'DELETE'
        });
        
        // 累積給付額をリセット
        await fetch(`tables/settings/${currentSettings.id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ total_paid: 0 })
        });
        
        alert('すべてのデータをけしたよ！');
        location.reload();
        
    } catch (error) {
        console.error('データリセットエラー:', error);
        alert('エラーがおきたよ');
    }
}

// =====================================
// バックアップ・復元機能
// =====================================

// 全データをエクスポート
async function exportData() {
    try {
        // 全テーブルのデータを取得
        const [settingsRes, stampsRes, historyRes, achievementsRes, customStampsRes] = await Promise.all([
            fetch('tables/settings?limit=1000'),
            fetch('tables/stamps?limit=10000'),
            fetch('tables/weekly_history?limit=1000'),
            fetch('tables/achievements?limit=1000'),
            fetch('tables/custom_stamps?limit=1000')
        ]);
        
        const backupData = {
            version: '2.1.0',
            exportDate: new Date().toISOString(),
            settings: (await settingsRes.json()).data,
            stamps: (await stampsRes.json()).data,
            weekly_history: (await historyRes.json()).data,
            achievements: (await achievementsRes.json()).data,
            custom_stamps: (await customStampsRes.json()).data
        };
        
        // JSONファイルとしてダウンロード
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
        const fileName = `okozukai-backup-${dateStr}.json`;
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        
        // 初回バックアップの場合はガイドを表示
        const hasShownGuide = localStorage.getItem('okozukai_backup_guide_shown');
        if (!hasShownGuide) {
            showBackupGuide();
            localStorage.setItem('okozukai_backup_guide_shown', 'true');
        } else {
            alert('バックアップファイルをほぞんしたよ！');
        }
        
    } catch (error) {
        console.error('エクスポートエラー:', error);
        alert('バックアップがうまくいかなかったよ');
    }
}

// データをインポート
async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!confirm('ふくげんすると、いまのデータはすべてきえます。よろしいですか？')) {
        event.target.value = '';
        return;
    }
    
    try {
        const text = await file.text();
        const backupData = JSON.parse(text);
        
        // バージョンチェック
        if (!backupData.version) {
            throw new Error('Invalid backup file');
        }
        
        // 既存データをクリア
        await clearAllTables();
        
        // データを復元
        if (backupData.settings && backupData.settings.length > 0) {
            for (const item of backupData.settings) {
                delete item.id;
                await fetch('tables/settings', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(item)
                });
            }
        }
        
        if (backupData.stamps) {
            for (const item of backupData.stamps) {
                delete item.id;
                await fetch('tables/stamps', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(item)
                });
            }
        }
        
        if (backupData.weekly_history) {
            for (const item of backupData.weekly_history) {
                delete item.id;
                await fetch('tables/weekly_history', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(item)
                });
            }
        }
        
        if (backupData.achievements) {
            for (const item of backupData.achievements) {
                delete item.id;
                await fetch('tables/achievements', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(item)
                });
            }
        }
        
        if (backupData.custom_stamps) {
            for (const item of backupData.custom_stamps) {
                delete item.id;
                await fetch('tables/custom_stamps', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(item)
                });
            }
        }
        
        alert('データをふくげんしたよ！ページをさいどくします');
        location.reload();
        
    } catch (error) {
        console.error('インポートエラー:', error);
        alert('ふくげんがうまくいかなかったよ。ファイルをかくにんしてね');
    }
    
    event.target.value = '';
}

// 全テーブルをクリア
async function clearAllTables() {
    const tables = ['settings', 'stamps', 'weekly_history', 'achievements', 'custom_stamps'];
    
    for (const table of tables) {
        try {
            const response = await fetch(`tables/${table}?limit=10000`);
            const data = await response.json();
            
            for (const item of data.data) {
                await fetch(`tables/${table}/${item.id}`, {
                    method: 'DELETE'
                });
            }
        } catch (error) {
            console.error(`テーブル ${table} のクリアエラー:`, error);
        }
    }
}

// 自動バックアップのチェックと実行
async function checkAndPerformAutoBackup() {
    try {
        const today = formatDate(new Date());
        const lastBackupDate = localStorage.getItem('okozukai_last_backup_date');
        
        // 自動バックアップボタンの表示制御
        const autoBackup = localStorage.getItem('okozukai_auto_backup');
        const autoRestoreBtn = document.getElementById('autoRestoreBtn');
        if (autoBackup && autoRestoreBtn) {
            autoRestoreBtn.style.display = 'block';
        }
        
        // 最終バックアップ日を表示
        const lastBackupDateElem = document.getElementById('lastBackupDate');
        if (lastBackupDateElem) {
            if (lastBackupDate) {
                const date = new Date(lastBackupDate);
                lastBackupDateElem.textContent = `${date.getFullYear()}ねん${date.getMonth() + 1}がつ${date.getDate()}にち`;
            } else {
                lastBackupDateElem.textContent = 'まだありません';
            }
        }
        
        // 今日まだバックアップしていなければ実行
        if (lastBackupDate !== today) {
            await performAutoBackup();
            localStorage.setItem('okozukai_last_backup_date', today);
            
            // 表示を更新
            if (lastBackupDateElem) {
                const date = new Date();
                lastBackupDateElem.textContent = `${date.getFullYear()}ねん${date.getMonth() + 1}がつ${date.getDate()}にち`;
            }
        }
    } catch (error) {
        console.error('自動バックアップチェックエラー:', error);
    }
}

// 自動バックアップを実行
async function performAutoBackup() {
    try {
        // 全テーブルのデータを取得
        const [settingsRes, stampsRes, historyRes, achievementsRes, customStampsRes] = await Promise.all([
            fetch('tables/settings?limit=1000'),
            fetch('tables/stamps?limit=10000'),
            fetch('tables/weekly_history?limit=1000'),
            fetch('tables/achievements?limit=1000'),
            fetch('tables/custom_stamps?limit=1000')
        ]);
        
        const backupData = {
            version: '2.1.0',
            exportDate: new Date().toISOString(),
            settings: (await settingsRes.json()).data,
            stamps: (await stampsRes.json()).data,
            weekly_history: (await historyRes.json()).data,
            achievements: (await achievementsRes.json()).data,
            custom_stamps: (await customStampsRes.json()).data
        };
        
        // LocalStorageに保存
        localStorage.setItem('okozukai_auto_backup', JSON.stringify(backupData));
        
        // 自動復元ボタンを表示
        const autoRestoreBtn = document.getElementById('autoRestoreBtn');
        if (autoRestoreBtn) {
            autoRestoreBtn.style.display = 'block';
        }
        
        console.log('自動バックアップ完了:', new Date().toISOString());
    } catch (error) {
        console.error('自動バックアップエラー:', error);
    }
}

// 自動バックアップから復元
async function restoreFromAutoBackup() {
    const autoBackup = localStorage.getItem('okozukai_auto_backup');
    
    if (!autoBackup) {
        alert('じどうバックアップがみつかりません');
        return;
    }
    
    if (!confirm('じどうバックアップからふくげんします。いまのデータはきえますが、よろしいですか？')) {
        return;
    }
    
    try {
        const backupData = JSON.parse(autoBackup);
        
        // 既存データをクリア
        await clearAllTables();
        
        // データを復元（exportDataと同じロジック）
        if (backupData.settings && backupData.settings.length > 0) {
            for (const item of backupData.settings) {
                delete item.id;
                await fetch('tables/settings', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(item)
                });
            }
        }
        
        if (backupData.stamps) {
            for (const item of backupData.stamps) {
                delete item.id;
                await fetch('tables/stamps', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(item)
                });
            }
        }
        
        if (backupData.weekly_history) {
            for (const item of backupData.weekly_history) {
                delete item.id;
                await fetch('tables/weekly_history', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(item)
                });
            }
        }
        
        if (backupData.achievements) {
            for (const item of backupData.achievements) {
                delete item.id;
                await fetch('tables/achievements', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(item)
                });
            }
        }
        
        if (backupData.custom_stamps) {
            for (const item of backupData.custom_stamps) {
                delete item.id;
                await fetch('tables/custom_stamps', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(item)
                });
            }
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

// 設定ページ初期化時にバックアップ情報を更新
const originalInitSettingsPage = initSettingsPage;
initSettingsPage = async function() {
    await originalInitSettingsPage();
    await checkAndPerformAutoBackup();
};


