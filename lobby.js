// ===== 主城大廳系統 =====

let playerGems = 5;
let playerGold = 10000;
let playerStamina = 50;
let maxStamina = 50;
let ownedCards = [];
let gachaPity = 0; // SSR 保底計數器（連續未中 SSR 的抽數）

// ===== 召喚師等級系統 =====
let summonerLv = 1;
let summonerExp = 0;
let staminaPotions = 0;
let teamCost = 80;
let bagSlots = 100;
let favoriteCard = 0; // index in CHARACTERS
let lastStaminaTime = Date.now();
let skillBooks = { '人': 0, '神': 0, '魔': 0, '龍': 0, '獸': 0 };

// 經驗值計算：等級越高需要越多經驗（最高100等）
function expForLevel(lv) {
    // Lv1→2: 100, Lv99→100: ~5000
    return Math.floor(100 + (lv - 1) * 50);
}

// 根據等級計算最大體力 (50起步, 每2等+1, 上限99)
function calcMaxStamina(lv) {
    return Math.min(99, 50 + Math.floor((lv - 1) / 2));
}

// 根據等級計算隊伍空間 (80起步, 每等+2)
function calcTeamCost(lv) {
    return 80 + (lv - 1) * 2;
}

// 獲得經驗值
function gainExp(amount) {
    summonerExp += amount;
    let leveled = false;
    let startLv = summonerLv;
    while (summonerLv < 100 && summonerExp >= expForLevel(summonerLv)) {
        summonerExp -= expForLevel(summonerLv);
        summonerLv++;
        leveled = true;
        // 升等獎勵：體力藥水
        staminaPotions++;
        // 更新最大體力和隊伍空間
        maxStamina = calcMaxStamina(summonerLv);
        teamCost = calcTeamCost(summonerLv);
    }
    if (summonerLv >= 100) { summonerLv = 100; summonerExp = 0; }
    updateLobbyUI();
    saveGame();
    if (leveled) showLevelUp(startLv, summonerLv);
    checkBadgeUnlocks();
}

function showLevelUp(fromLv, toLv) {
    document.getElementById('levelup-lv').textContent = `Lv. ${toLv}`;
    const newMax = calcMaxStamina(toLv);
    const newCost = calcTeamCost(toLv);
    const lvGained = toLv - fromLv;
    document.getElementById('levelup-rewards').innerHTML =
        `體力上限：${newMax}<br>隊伍空間：${newCost}<br><img src="其他圖示/體力圖示.png" style="width:14px;height:14px;vertical-align:middle;"> 體力藥水 ×${lvGained}`;
    document.getElementById('levelup-popup').classList.remove('hidden');
    SFX.play('levelUp');
}

function closeLevelUp() {
    document.getElementById('levelup-popup').classList.add('hidden');
}

// 體力恢復：每5分鐘1點（防竄改：記錄消耗時的體力和時間戳，恢復量由差值計算）
let staminaCountdownInterval = null;

function tickStaminaRegen() {
    const now = Date.now();
    const elapsed = now - lastStaminaTime;
    // 防竄改：限制最大離線恢復量（最多恢復到滿，且每次最多恢復 maxStamina 點）
    const maxRecover = maxStamina - playerStamina;
    if (maxRecover <= 0) {
        lastStaminaTime = now;
        return;
    }
    const regenCount = Math.min(maxRecover, Math.floor(elapsed / (5 * 60 * 1000)));
    if (regenCount > 0) {
        playerStamina = Math.min(maxStamina, playerStamina + regenCount);
        lastStaminaTime = now - (elapsed % (5 * 60 * 1000));
        // 防竄改：如果時間差異超過合理範圍（超過 maxStamina * 5 分鐘），重置
        const maxReasonableElapsed = maxStamina * 5 * 60 * 1000;
        if (elapsed > maxReasonableElapsed) {
            lastStaminaTime = now;
        }
        updateResources();
        saveGame();
    }
}
setInterval(tickStaminaRegen, 10000); // check every 10s

// 體力倒計時顯示
function startStaminaCountdown() {
    if (staminaCountdownInterval) clearInterval(staminaCountdownInterval);
    staminaCountdownInterval = setInterval(updateStaminaCountdown, 1000);
}

function updateStaminaCountdown() {
    const sub = document.getElementById('battle-sub-text');
    if (!sub) return;
    if (playerStamina >= maxStamina) {
        sub.textContent = '體力值已滿';
        sub.style.color = '#7bed9f';
        return;
    }
    const now = Date.now();
    const elapsed = now - lastStaminaTime;
    const nextRegenMs = (5 * 60 * 1000) - (elapsed % (5 * 60 * 1000));
    const mins = Math.floor(nextRegenMs / 60000);
    const secs = Math.floor((nextRegenMs % 60000) / 1000);
    sub.textContent = `下一點 ${mins}:${String(secs).padStart(2, '0')}`;
    sub.style.color = '#64c8ff';
}

// 使用體力藥水
function useStaminaPotion() {
    if (staminaPotions <= 0) { showToast('沒有體力藥水了'); return; }
    staminaPotions--;
    playerStamina = maxStamina;
    updateResources();
    saveGame();
    showToast('體力已回滿！');
}

// ===== 存檔系統 =====
const SAVE_KEY = 'caitiankm_save_v2';

function saveGame() {
    const data = {
        playerName, playerGems, playerGold, playerStamina, maxStamina,
        ownedCards, storyProgress, gachaPity,
        summonerLv, summonerExp, staminaPotions, teamCost, bagSlots, favoriteCard,
        lastStaminaTime,
        equippedBadge, unlockedBadges, teamSlots,
        lastDailyReset,
        dailyQuests: DAILY_QUESTS.map(q => ({ progress: q.progress, claimed: q.claimed })),
        rookieProgress,
        gachaPityTarget: gachaPityTarget ? gachaPityTarget.name : null,
        skillBooks,
    };
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        if (typeof window.queueCloudSave === 'function') {
            window.queueCloudSave(data);
        }
    } catch(e) {}
}

function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        playerName = data.playerName || '';
        playerGems = data.playerGems ?? 5;
        playerGold = data.playerGold ?? 10000;
        playerStamina = data.playerStamina ?? 50;
        maxStamina = data.maxStamina ?? 50;
        ownedCards = data.ownedCards || [];
        // 確保所有卡片有基礎數值
        ownedCards.forEach(c => { ensureBaseStats(c); recalcCardStats(c); });
        gachaPity = data.gachaPity ?? 0;
        summonerLv = data.summonerLv ?? 1;
        summonerExp = data.summonerExp ?? 0;
        staminaPotions = data.staminaPotions ?? 0;
        teamCost = data.teamCost ?? 80;
        bagSlots = data.bagSlots ?? 100;
        favoriteCard = data.favoriteCard ?? 0;
        if (data.skillBooks) skillBooks = { ...skillBooks, ...data.skillBooks };
        lastStaminaTime = data.lastStaminaTime ?? Date.now();
        equippedBadge = data.equippedBadge || 'starter';
        unlockedBadges = data.unlockedBadges || ['starter'];
        if (data.teamSlots && Array.isArray(data.teamSlots)) {
            teamSlots = data.teamSlots.slice(0, 5);
            while (teamSlots.length < 5) teamSlots.push(-1);
        }
        lastDailyReset = data.lastDailyReset || '';
        if (data.storyProgress) {
            storyProgress = data.storyProgress;
            // 補齊新增章節的進度資料
            while (storyProgress.length < STORY_CHAPTERS.length) {
                const ci = storyProgress.length;
                storyProgress.push(STORY_CHAPTERS[ci].stages.map(() => false));
            }
        }
        if (data.dailyQuests) {
            data.dailyQuests.forEach((q, i) => {
                if (DAILY_QUESTS[i]) {
                    DAILY_QUESTS[i].progress = q.progress;
                    DAILY_QUESTS[i].claimed = q.claimed;
                }
            });
        }
        if (data.rookieProgress) {
            rookieProgress = data.rookieProgress;
            initRookieProgress(); // 補齊新增任務
        }
        // 恢復保底目標
        if (data.gachaPityTarget) {
            const ssrPool = CHARACTERS.slice(5).filter(c => c.rarity === 'SSR');
            gachaPityTarget = ssrPool.find(c => c.name === data.gachaPityTarget) || null;
        }
        // 恢復離線期間的體力
        tickStaminaRegen();
        return true;
    } catch(e) { return false; }
}

setInterval(() => { if (playerName) saveGame(); }, 30000);

// ===== 改名功能 =====
function editPlayerName() {
    document.getElementById('rename-input').value = playerName || '';
    document.getElementById('rename-dialog').classList.remove('hidden');
    setTimeout(() => document.getElementById('rename-input').focus(), 200);
}

function confirmRename() {
    const input = document.getElementById('rename-input');
    const name = input.value.trim();
    if (!name) { input.style.borderColor = '#ff4757'; SFX.play('error'); return; }
    playerName = name;
    document.getElementById('lobby-player-name').innerHTML = `${playerName} <span class="name-edit-icon">✏️</span>`;
    closeRename();
    saveGame();
    showToast('名稱已更新！');
}

function closeRename() {
    document.getElementById('rename-dialog').classList.add('hidden');
}

// ===== 喜愛角色選擇 =====
function showFavoriteSelect() {
    const allCards = ownedCards;
    let html = '<div style="position:absolute;inset:0;z-index:200;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;" id="fav-select-screen">';
    html += '<div style="padding:14px;display:flex;justify-content:space-between;align-items:center;"><button class="back-btn" onclick="closeFavSelect()">← 返回</button><div style="font-size:16px;font-weight:bold;letter-spacing:3px;color:#ffd700;">選擇喜愛角色</div><div></div></div>';
    html += '<div style="flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:8px 10px;align-content:start;touch-action:pan-y;min-height:0;">';
    for (let i = 0; i < allCards.length; i++) {
        const c = allCards[i];
        const el = ELEMENTS[c.element];
        const sel = i === favoriteCard ? 'border:2px solid #ffd700;box-shadow:0 0 12px rgba(255,215,0,0.4);' : '';
        html += `<div style="width:100%;height:0;padding-bottom:133%;border-radius:6px;overflow:hidden;position:relative;cursor:pointer;background:rgba(10,12,25,0.9);border:1.5px solid rgba(255,255,255,0.08);${sel}" onclick="selectFavorite(${i})">`;
        html += `<img src="${c.img}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" alt="${c.name}">`;
        html += `<span style="position:absolute;bottom:1px;left:2px;font-size:8px;color:#ccc;text-shadow:0 1px 2px #000;z-index:1;">${c.name}</span>`;
        html += '</div>';
    }
    html += '</div></div>';
    document.getElementById('lobby-screen').insertAdjacentHTML('beforeend', html);
}

function closeFavSelect() {
    const el = document.getElementById('fav-select-screen');
    if (el) el.remove();
}

function selectFavorite(idx) {
    const allCards = ownedCards;
    favoriteCard = idx;
    const c = allCards[idx];
    const img = document.getElementById('lobby-fav-img');
    if (img && c) img.src = c.img;
    updateFavCardRarity(c);
    closeFavSelect();
    saveGame();
    showToast(`已設定 ${c.name} 為喜愛角色`);
}

function updateFavCardRarity(c) {
    const wrap = document.getElementById('fav-card-wrap');
    if (!wrap) return;
    wrap.classList.remove('fav-r', 'fav-sr', 'fav-ssr');
    const r = (c && c.rarity) ? c.rarity.toUpperCase() : 'R';
    if (r === 'SSR') wrap.classList.add('fav-ssr');
    else if (r === 'SR') wrap.classList.add('fav-sr');
    else wrap.classList.add('fav-r');
}

// ===== 徽章系統 =====
const BADGES = [
    { id: 'starter', icon: '⚔️', img: '成就徽章/初心召喚師（starter）— 藍色品質.png', name: '初心召喚師', desc: '開始你的旅程', rarity: 'blue', unlocked: true },
    { id: 'ch1_clear', icon: '🌅', img: '成就徽章/五行初醒（ch1_clear）— 藍色品質.png', name: '五行初醒', desc: '通關第一章', rarity: 'blue', unlocked: false },
    { id: 'ch2_clear', icon: '🏔️', img: '成就徽章/土石崩裂（ch2_clear）— 紫色品質.png', name: '土石崩裂', desc: '通關第二章', rarity: 'purple', unlocked: false },
    { id: 'ch3_clear', icon: '🌿', img: '成就徽章/翠嵐迷境（ch3_clear）— 紫色品質.png', name: '翠嵐迷境', desc: '通關第三章', rarity: 'purple', unlocked: false },
    { id: 'ch4_clear', icon: '🌀', img: '成就徽章/混沌終焉（ch4_clear）— 金色品質.png', name: '混沌終焉', desc: '通關第四章', rarity: 'gold', unlocked: false },
    { id: 'ch5_clear', icon: '🔥', img: '成就徽章/焚天煉獄（ch5_clear）— 金色品質.png', name: '焚天煉獄', desc: '通關第五章', rarity: 'gold', unlocked: false },
    { id: 'ch6_clear', icon: '⚡', img: '成就徽章/蒼穹雷域（ch6_clear）— 金色品質.png', name: '蒼穹雷域', desc: '通關第六章', rarity: 'gold', unlocked: false },
    { id: 'ch7_clear', icon: '🦅', img: '成就徽章/涅槃聖域（ch7_clear）— 金色品質.png', name: '涅槃聖域', desc: '通關第七章', rarity: 'gold', unlocked: false },
    { id: 'ch8_clear', icon: '💀', img: '成就徽章/鑄魂黃泉（ch8_clear）— 金色品質.png', name: '鑄魂黃泉', desc: '通關第八章', rarity: 'gold', unlocked: false },
    { id: 'combo5', icon: '💥', img: '成就徽章/連鎖大師（combo5）— 藍色品質.png', name: '連鎖大師', desc: '達成 5 Combo', rarity: 'blue', unlocked: false },
    { id: 'lv10', icon: '🔟', img: '成就徽章/成長之路（lv10）— 藍色品質.png', name: '成長之路', desc: '召喚師等級達到 10', rarity: 'blue', unlocked: false },
    { id: 'lv50', icon: '⭐', img: '成就徽章/資深召喚師（lv50）— 紫色品質.png', name: '資深召喚師', desc: '召喚師等級達到 50', rarity: 'purple', unlocked: false },
    { id: 'lv100', icon: '👑', img: '成就徽章/傳說召喚師（lv100）— 金色品質.png', name: '傳說召喚師', desc: '召喚師等級達到 100', rarity: 'gold', unlocked: false },
    { id: 'gacha10', icon: '🎰', img: '成就徽章/抽卡達人（gacha10）— 藍色品質.png', name: '抽卡達人', desc: '累計召喚 10 次', rarity: 'blue', unlocked: false },
    { id: 'ssr_get', icon: '🌟', img: '成就徽章/幸運之星（ssr_get）— 金色品質.png', name: '幸運之星', desc: '獲得一張 SSR 卡', rarity: 'gold', unlocked: false },
    { id: 'full_team', icon: '👥', img: '成就徽章/全員集結（full_team）— 紫色品質.png', name: '全員集結', desc: '擁有所有基礎角色', rarity: 'purple', unlocked: false },
];

let equippedBadge = 'starter';
let unlockedBadges = ['starter'];

function checkBadgeUnlocks() {
    let changed = false;
    // 章節通關
    const chBadgeIds = ['ch1_clear','ch2_clear','ch3_clear','ch4_clear','ch5_clear','ch6_clear','ch7_clear','ch8_clear','ch9_clear','ch10_clear','ch11_clear','ch12_clear','ch13_clear'];
    for (let i = 0; i < STORY_CHAPTERS.length; i++) {
        const id = chBadgeIds[i];
        if (id && storyProgress[i] && storyProgress[i].every(s => s) && !unlockedBadges.includes(id)) {
            unlockedBadges.push(id);
            changed = true;
        }
    }
    // 等級徽章
    if (summonerLv >= 10 && !unlockedBadges.includes('lv10')) { unlockedBadges.push('lv10'); changed = true; }
    if (summonerLv >= 50 && !unlockedBadges.includes('lv50')) { unlockedBadges.push('lv50'); changed = true; }
    if (summonerLv >= 100 && !unlockedBadges.includes('lv100')) { unlockedBadges.push('lv100'); changed = true; }
    // SSR
    if (ownedCards.some(c => c.rarity === 'SSR') && !unlockedBadges.includes('ssr_get')) { unlockedBadges.push('ssr_get'); changed = true; }

    if (changed) {
        updateBadgeDisplay();
        saveGame();
    }
}

function updateBadgeDisplay() {
    const badge = BADGES.find(b => b.id === equippedBadge) || BADGES[0];
    const el = document.getElementById('lobby-badge');
    const icon = document.getElementById('badge-icon');
    if (icon) {
        if (badge.img) {
            icon.innerHTML = `<img src="${badge.img}" alt="${badge.name}">`;
        } else {
            icon.textContent = badge.icon;
        }
    }
    if (el) {
        el.className = 'player-badge';
        if (badge.rarity === 'gold') el.classList.add('badge-gold');
        else if (badge.rarity === 'purple') el.classList.add('badge-purple');
        else el.classList.add('badge-blue');
    }
}

function showBadgeSelect() {
    let html = '<div style="position:absolute;inset:0;z-index:200;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;" id="badge-select-screen">';
    html += '<div style="padding:14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,215,0,0.1);"><button class="back-btn" onclick="closeBadgeSelect()">← 返回</button><div style="font-size:16px;font-weight:bold;letter-spacing:3px;color:#ffd700;">成就徽章</div><div style="width:50px;"></div></div>';
    html += '<div style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;touch-action:pan-y;">';

    for (const b of BADGES) {
        const unlocked = unlockedBadges.includes(b.id);
        const equipped = equippedBadge === b.id;
        const borderColor = b.rarity === 'gold' ? 'rgba(255,215,0,0.4)' : (b.rarity === 'purple' ? 'rgba(199,125,255,0.4)' : 'rgba(100,200,255,0.3)');
        const glowColor = b.rarity === 'gold' ? 'rgba(255,215,0,0.15)' : (b.rarity === 'purple' ? 'rgba(199,125,255,0.1)' : 'rgba(100,200,255,0.08)');

        html += `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:linear-gradient(135deg,rgba(18,22,45,0.95),rgba(12,14,30,0.98));border:1px solid ${unlocked ? borderColor : 'rgba(255,255,255,0.04)'};border-radius:10px;opacity:${unlocked ? '1' : '0.4'};box-shadow:${unlocked ? '0 0 12px ' + glowColor : 'none'};cursor:${unlocked ? 'pointer' : 'default'};" ${unlocked && !equipped ? `onclick="equipBadge('${b.id}')"` : ''}>`;
        const badgeIcon = unlocked && b.img ? `<img src="${b.img}" alt="${b.name}" style="width:100%;height:100%;object-fit:contain;border-radius:4px;">` : (unlocked ? b.icon : '🔒');
        html += `<div style="width:42px;height:42px;border-radius:8px;background:linear-gradient(135deg,#1a2a5a,#0d1530);border:1.5px solid ${unlocked ? borderColor : 'rgba(255,255,255,0.06)'};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;overflow:hidden;">${badgeIcon}</div>`;
        html += `<div style="flex:1;"><div style="font-size:13px;font-weight:bold;color:${unlocked ? '#eee' : '#555'};letter-spacing:1px;">${b.name}</div><div style="font-size:10px;color:${unlocked ? '#888' : '#444'};margin-top:2px;">${b.desc}</div></div>`;
        if (equipped) {
            html += `<div style="font-size:9px;color:#ffd700;background:rgba(255,215,0,0.1);padding:4px 10px;border-radius:6px;border:1px solid rgba(255,215,0,0.2);letter-spacing:1px;">裝備中</div>`;
        } else if (unlocked) {
            html += `<div style="font-size:9px;color:#64c8ff;letter-spacing:1px;">點擊裝備</div>`;
        }
        html += '</div>';
    }

    html += '</div></div>';
    document.getElementById('lobby-screen').insertAdjacentHTML('beforeend', html);
}

function closeBadgeSelect() {
    const el = document.getElementById('badge-select-screen');
    if (el) el.remove();
}

function equipBadge(id) {
    equippedBadge = id;
    updateBadgeDisplay();
    closeBadgeSelect();
    saveGame();
    const badge = BADGES.find(b => b.id === id);
    showToast(`已裝備徽章：${badge ? badge.name : ''}`);
}

// ===== 更新大廳 UI =====
function updateLobbyUI() {
    // 等級
    const lvEl = document.getElementById('lobby-lv');
    if (lvEl) lvEl.textContent = summonerLv;

    // 經驗條 — 顯示數字 如 "0/100"
    const needed = expForLevel(summonerLv);
    const pct = summonerLv >= 100 ? 100 : Math.floor((summonerExp / needed) * 100);
    const expFill = document.getElementById('lobby-exp-fill');
    if (expFill) expFill.style.width = pct + '%';
    const expPct = document.getElementById('lobby-exp-pct');
    if (expPct) {
        if (summonerLv >= 100) {
            expPct.textContent = 'MAX';
        } else {
            expPct.textContent = `${summonerExp}/${needed}`;
        }
    }

    // 隊伍空間
    const costEl = document.getElementById('cost-display');
    if (costEl) costEl.textContent = teamCost;

    // 喜愛角色圖片
    const allCards = ownedCards;
    const favCard = allCards[favoriteCard];
    const favImg = document.getElementById('lobby-fav-img');
    if (favImg && favCard) favImg.src = favCard.img;
    updateFavCardRarity(favCard);

    // 更新資源
    updateResources();
}

// ===== Battle 波浪動畫 =====
let battleWaveId = null;

function initBattleWave() {
    const canvas = document.getElementById('battle-wave-canvas');
    if (!canvas) return;
    const btn = canvas.parentElement;
    const size = Math.min(btn.clientWidth, btn.clientHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2, cy = size / 2, r = size / 2 - 4;
    let t = 0;

    function draw() {
        ctx.clearRect(0, 0, size, size);
        t += 0.03;

        // 繪製多層波浪
        for (let layer = 0; layer < 3; layer++) {
            const staPct = playerStamina / maxStamina;
            const waterLevel = cy + r - (staPct * r * 2);
            const amp = 3 + layer * 1.5;
            const freq = 0.04 + layer * 0.01;
            const phase = t * (1.2 + layer * 0.4) + layer * 1.5;
            const alpha = 0.12 - layer * 0.03;

            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.clip();

            ctx.beginPath();
            ctx.moveTo(0, size);
            for (let x = 0; x <= size; x++) {
                const y = waterLevel + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 0.5 + phase * 0.7) * amp * 0.5;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(size, size);
            ctx.closePath();

            const colors = ['rgba(100,200,255,', 'rgba(42,122,181,', 'rgba(26,90,138,'];
            ctx.fillStyle = colors[layer] + alpha + ')';
            ctx.fill();
            ctx.restore();
        }

        battleWaveId = requestAnimationFrame(draw);
    }

    if (battleWaveId) cancelAnimationFrame(battleWaveId);
    draw();
}

// ===== 頭像光點粒子特效 =====
let avatarParticleId = null;

function initAvatarParticles() {
    const canvas = document.getElementById('avatar-particle-canvas');
    if (!canvas) return;
    const W = 94, H = 94;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const cx = W / 2, cy = H / 2;
    const orbitR = 34;

    const pts = [];
    // 環繞金色光點
    for (let i = 0; i < 8; i++) {
        pts.push({
            type: 'orbit',
            angle: (Math.PI * 2 / 8) * i,
            speed: 0.008 + Math.random() * 0.004,
            r: orbitR + (Math.random() - 0.5) * 4,
            size: Math.random() * 1.5 + 0.8,
            phase: Math.random() * Math.PI * 2,
        });
    }
    // 上飄微光
    for (let i = 0; i < 12; i++) {
        pts.push({
            type: 'float',
            x: cx + (Math.random() - 0.5) * 50,
            y: cy + (Math.random() - 0.5) * 50,
            dy: -Math.random() * 0.3 - 0.1,
            dx: (Math.random() - 0.5) * 0.1,
            size: Math.random() * 1.2 + 0.3,
            alpha: Math.random() * 0.4 + 0.1,
            phase: Math.random() * Math.PI * 2,
            hue: 35 + Math.random() * 20,
        });
    }
    // 閃爍星點
    for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 28 + Math.random() * 10;
        pts.push({
            type: 'star',
            x: cx + Math.cos(a) * d,
            y: cy + Math.sin(a) * d,
            phase: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.05 + 0.03,
            maxSize: Math.random() * 2 + 1,
        });
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        for (const p of pts) {
            if (p.type === 'orbit') {
                p.angle += p.speed;
                p.phase += 0.03;
                const flicker = 0.4 + 0.6 * Math.sin(p.phase);
                const x = cx + Math.cos(p.angle) * p.r;
                const y = cy + Math.sin(p.angle) * p.r;

                const g = ctx.createRadialGradient(x, y, 0, x, y, p.size * 3);
                g.addColorStop(0, `rgba(255,230,150,${flicker * 0.8})`);
                g.addColorStop(0.4, `rgba(255,200,80,${flicker * 0.4})`);
                g.addColorStop(1, 'rgba(255,180,50,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(x, y, p.size * 3, 0, Math.PI * 2);
                ctx.fill();

                // bright core
                ctx.fillStyle = `rgba(255,255,220,${flicker * 0.9})`;
                ctx.beginPath();
                ctx.arc(x, y, p.size * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
            else if (p.type === 'float') {
                p.x += p.dx;
                p.y += p.dy;
                p.phase += 0.02;
                const a = p.alpha * (0.3 + 0.7 * Math.sin(p.phase));
                if (p.y < -5) { p.y = H + 5; p.x = cx + (Math.random() - 0.5) * 50; }

                ctx.save();
                ctx.globalAlpha = a;
                ctx.fillStyle = `hsl(${p.hue}, 100%, 75%)`;
                ctx.shadowColor = `hsl(${p.hue}, 100%, 65%)`;
                ctx.shadowBlur = 4;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            else if (p.type === 'star') {
                p.phase += p.speed;
                const brightness = Math.max(0, Math.sin(p.phase));
                if (brightness < 0.01) continue;
                const s = p.maxSize * brightness;

                // 四角星形
                ctx.save();
                ctx.globalAlpha = brightness * 0.8;
                ctx.fillStyle = '#fff';
                ctx.shadowColor = 'rgba(255,215,0,0.8)';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                // 十字光芒
                ctx.moveTo(p.x - s, p.y);
                ctx.lineTo(p.x - s * 0.15, p.y - s * 0.15);
                ctx.lineTo(p.x, p.y - s);
                ctx.lineTo(p.x + s * 0.15, p.y - s * 0.15);
                ctx.lineTo(p.x + s, p.y);
                ctx.lineTo(p.x + s * 0.15, p.y + s * 0.15);
                ctx.lineTo(p.x, p.y + s);
                ctx.lineTo(p.x - s * 0.15, p.y + s * 0.15);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }

        avatarParticleId = requestAnimationFrame(draw);
    }

    if (avatarParticleId) cancelAnimationFrame(avatarParticleId);
    draw();
}

// ===== 進入主城 =====
function enterLobby() {
    document.getElementById('lobby-screen').classList.add('show');
    document.getElementById('lobby-player-name').innerHTML = `${playerName || '召喚師'} <span class="name-edit-icon">✏️</span>`;

    // 更新等級相關數值
    maxStamina = calcMaxStamina(summonerLv);
    teamCost = calcTeamCost(summonerLv);

    checkDailyReset();
    updateLobbyUI();
    initGachaPreview();
    initLobbyParticles();
    initBattleWave();
    initAvatarParticles();
    startStaminaCountdown();
    updateBadgeDisplay();
    updateBattleBtn();
    SFX.startBGM('lobby');
}

function updateResources() {
    document.getElementById('stamina-display').textContent = `${playerStamina}/${maxStamina}`;
    document.getElementById('gold-display').textContent = playerGold.toLocaleString();
    document.getElementById('gem-display').textContent = playerGems;
    // 體力滿時資源欄發光
    const staminaRes = document.querySelector('.stamina-res');
    if (staminaRes) {
        if (playerStamina >= maxStamina) {
            staminaRes.classList.add('stamina-full-res');
        } else {
            staminaRes.classList.remove('stamina-full-res');
        }
    }
    updateBattleBtn();
}

function updateBattleBtn() {
    const staNum = document.getElementById('battle-sta-num');
    const staMax = document.getElementById('battle-sta-max');
    const sub = document.getElementById('battle-sub-text');
    const btn = document.querySelector('.battle-main-btn');
    if (staNum) staNum.textContent = playerStamina;
    if (staMax) staMax.textContent = maxStamina;
    if (sub) {
        if (playerStamina >= maxStamina) {
            sub.textContent = '體力值已滿';
            sub.style.color = '#7bed9f';
        }
    }
    if (btn) {
        if (playerStamina >= maxStamina) {
            btn.classList.add('stamina-full');
        } else {
            btn.classList.remove('stamina-full');
        }
    }
}

// 主城粒子特效
let lobbyParticleId = null;
function initLobbyParticles() {
    const canvas = document.getElementById('lobby-particles');
    if (!canvas) return;
    const container = document.getElementById('lobby-screen');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    const ctx = canvas.getContext('2d');
    const pts = [];

    // 金色光塵
    for (let i = 0; i < 40; i++) {
        pts.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.8 + 0.4,
            dy: -Math.random() * 0.3 - 0.1,
            dx: (Math.random() - 0.5) * 0.15,
            a: Math.random() * 0.5 + 0.2,
            p: Math.random() * Math.PI * 2,
            color: `hsl(${40 + Math.random() * 15}, 100%, ${65 + Math.random() * 15}%)`,
        });
    }
    // 五彩微光
    const colors = ['rgba(100,200,255,', 'rgba(255,107,155,', 'rgba(46,213,115,', 'rgba(255,165,2,', 'rgba(223,230,233,'];
    for (let i = 0; i < 15; i++) {
        pts.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.2 + 0.3,
            dy: -Math.random() * 0.2 - 0.05,
            dx: (Math.random() - 0.5) * 0.1,
            a: Math.random() * 0.3 + 0.1,
            p: Math.random() * Math.PI * 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            isRgba: true,
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of pts) {
            p.x += p.dx;
            p.y += p.dy;
            p.p += 0.02;
            const alpha = p.a * (0.4 + 0.6 * Math.sin(p.p));
            if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
            if (p.x < -5) p.x = canvas.width + 5;
            if (p.x > canvas.width + 5) p.x = -5;

            ctx.save();
            if (p.isRgba) {
                ctx.fillStyle = p.color + alpha + ')';
            } else {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
            }
            ctx.shadowColor = p.isRgba ? p.color + '0.5)' : p.color;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        lobbyParticleId = requestAnimationFrame(draw);
    }
    if (lobbyParticleId) cancelAnimationFrame(lobbyParticleId);
    draw();
}

// ===== 子畫面控制 =====
function closeSub(id) {
    const el = document.getElementById(id);
    if (!el) return;
    // 動態建立的畫面直接移除，靜態的加 hidden
    if (id === 'rookie-screen' || id === 'badge-select-screen') {
        el.remove();
    } else {
        el.classList.add('hidden');
    }
    SFX.play('pageClose');
}

// ===== 主線 =====
const STORY_CHAPTERS = [
    {
        name: '第一章　五行初醒',
        sub: '踏上召喚師的旅途',
        icon: '🌅',
        reward: { icon: '<img src="其他圖示/鑽石圖示.png" style="width:20px;height:20px;vertical-align:middle;">', label: '×10' },
        story: [
            { speaker: '旁白', text: '天地之間，五行之力維繫著萬物的平衡。然而，一股神秘的黑暗力量正在侵蝕大地……' },
            { speaker: '???', text: '醒來吧，被選中的召喚師。你體內沉睡的五行之力，是拯救這個世界的唯一希望。' },
            { speaker: '主角', text: '這裡是……？我感覺到一股奇異的力量在體內流動……' },
            { speaker: '旁白', text: '森林深處，被黑暗侵蝕的妖獸開始躁動。你的旅途，從這裡開始。' },
        ],
        stages: [
            { name: '五行初醒 Ⅰ', desc: '火焰狂徒的襲擊', enemy: '火焰狂徒', cost: 3, enemyIdx: 0 },
            { name: '五行初醒 Ⅱ', desc: '荊棘藤怪的陷阱', enemy: '荊棘藤怪', cost: 3, enemyIdx: 1 },
            { name: '五行初醒 Ⅲ', desc: '冰雪刺客的暗襲', enemy: '冰雪刺客', cost: 4, enemyIdx: 2 },
        ]
    },
    {
        name: '第二章　鋼鐵試煉',
        sub: '金屬與大地的考驗',
        icon: '🏔️',
        reward: { icon: '<img src="其他圖示/鑽石圖示.png" style="width:20px;height:20px;vertical-align:middle;">', label: '×15' },
        story: [
            { speaker: '旁白', text: '穿越森林後，你來到了一片荒蕪的礦山。這裡的生物被金屬之力所侵蝕，變得異常兇猛。' },
            { speaker: '主角', text: '這些蟲子的外殼堅硬如鐵……看來需要更強的力量才能突破。' },
            { speaker: '???', text: '召喚師，五行相生相剋。以火克金，以木克土，善用屬性之力吧。' },
        ],
        stages: [
            { name: '鋼鐵試煉 Ⅰ', desc: '沙漠盜賊的伏擊', enemy: '沙漠盜賊', cost: 5, enemyIdx: 3 },
            { name: '鋼鐵試煉 Ⅱ', desc: '雷電狼的雷域', enemy: '雷電狼', cost: 5, enemyIdx: 4 },
            { name: '鋼鐵試煉 Ⅲ', desc: '毒霧蘑菇的瘴氣', enemy: '毒霧蘑菇', cost: 6, enemyIdx: 5 },
        ]
    },
    {
        name: '第三章　熔岩龍巢',
        sub: '巨龍甦醒的火山',
        icon: '🌋',
        reward: { icon: '<img src="其他圖示/鑽石圖示.png" style="width:20px;height:20px;vertical-align:middle;">', label: '×20' },
        story: [
            { speaker: '旁白', text: '火山深處傳來低沉的咆哮。熔岩巨龍，五行之火的化身，已經從沉睡中甦醒。' },
            { speaker: '主角', text: '那個巨龍……是傳說中的熔岩巨龍！牠的力量遠超之前遇到的任何敵人。' },
            { speaker: '???', text: '這是你的第一場真正的考驗，召喚師。五行相剋——以水制火，你能做到的。' },
        ],
        stages: [
            { name: '熔岩龍巢', desc: '熔岩巨龍的試煉（BOSS）', enemy: '熔岩巨龍', cost: 8, enemyIdx: 6 },
        ]
    },
    {
        name: '第四章　暗影荒原',
        sub: '被侵蝕的大地',
        icon: '🏜️',
        reward: { icon: '<img src="其他圖示/鑽石圖示.png" style="width:20px;height:20px;vertical-align:middle;">', label: '×25' },
        story: [
            { speaker: '旁白', text: '越過火山，荒原上的生物變得更加兇猛。火焰蝙蝠在天空盤旋，翠綠幼龍在叢林中潛伏。' },
            { speaker: '主角', text: '這裡的敵人越來越強了……但我不能退縮，五行的平衡必須恢復。' },
            { speaker: '???', text: '小心，召喚師。這些被侵蝕的生物已經失去了理智，只剩下本能的攻擊慾望。' },
        ],
        stages: [
            { name: '暗影荒原 Ⅰ', desc: '火焰蝙蝠的空襲', enemy: '火焰蝙蝠', cost: 9, enemyIdx: 7 },
            { name: '暗影荒原 Ⅱ', desc: '翠綠幼龍的領地', enemy: '翠綠幼龍', cost: 9, enemyIdx: 8 },
            { name: '暗影荒原 Ⅲ', desc: '冰霜蜘蛛的巢穴', enemy: '冰霜蜘蛛', cost: 10, enemyIdx: 9 },
        ]
    },
    {
        name: '第五章　地底迷城',
        sub: '岩石與金屬的交響',
        icon: '🌿',
        reward: { icon: '<img src="其他圖示/鑽石圖示.png" style="width:20px;height:20px;vertical-align:middle;">', label: '×30' },
        story: [
            { speaker: '旁白', text: '地底迷宮中，岩石巨龜守護著古老的通道，金甲蠍在暗處伺機而動。' },
            { speaker: '主角', text: '這片地下城曾經是五行之力最強盛的地方……現在卻變成了妖獸的巢穴。' },
            { speaker: '???', text: '五行失衡的根源就在前方。你必須征服這些守護者，才能繼續前進。' },
        ],
        stages: [
            { name: '地底迷城 Ⅰ', desc: '岩石巨龜的防線', enemy: '岩石巨龜', cost: 12, enemyIdx: 10 },
            { name: '地底迷城 Ⅱ', desc: '金甲蠍的毒域', enemy: '金甲蠍', cost: 13, enemyIdx: 11 },
            { name: '地底迷城 Ⅲ', desc: '幽靈火焰的幻影', enemy: '幽靈火焰', cost: 14, enemyIdx: 12 },
        ]
    },
    {
        name: '第六章　深淵魔域',
        sub: '深淵魔王的領地',
        icon: '🔥',
        reward: { icon: '<img src="其他圖示/鑽石圖示.png" style="width:20px;height:20px;vertical-align:middle;">', label: '×35' },
        story: [
            { speaker: '旁白', text: '深淵的入口散發著不祥的氣息。深淵魔王，黑暗之水的化身，在此等候挑戰者。' },
            { speaker: '主角', text: '深淵魔王……牠的力量比熔岩巨龍還要恐怖。我必須做好萬全的準備。' },
            { speaker: '旁白', text: '黑暗的潮水翻湧，深淵的咆哮震動著大地。最終的決戰，即將開始。' },
        ],
        stages: [
            { name: '深淵魔域', desc: '深淵魔王的試煉（BOSS）', enemy: '深淵魔王', cost: 16, enemyIdx: 13 },
        ]
    },
    {
        name: '第七章　腐蝕之地',
        sub: '被侵蝕的古代神殿',
        icon: '⚡',
        reward: { icon: '<img src="其他圖示/鑽石圖示.png" style="width:20px;height:20px;vertical-align:middle;">', label: '×40' },
        story: [
            { speaker: '旁白', text: '古代神殿被黑暗之力侵蝕，熔岩史萊姆、腐化樹魔、暗影水妖橫行其中。' },
            { speaker: '主角', text: '越往深處走，敵人就越強……但我已經不是當初那個懵懂的召喚師了。' },
            { speaker: '???', text: '你的成長令人欣慰，召喚師。但真正的考驗還在後面……' },
        ],
        stages: [
            { name: '腐蝕之地 Ⅰ', desc: '熔岩史萊姆的領域', enemy: '熔岩史萊姆', cost: 18, enemyIdx: 14 },
            { name: '腐蝕之地 Ⅱ', desc: '腐化樹魔的森林', enemy: '腐化樹魔', cost: 19, enemyIdx: 15 },
            { name: '腐蝕之地 Ⅲ', desc: '暗影水妖的深潭', enemy: '暗影水妖', cost: 20, enemyIdx: 16 },
        ]
    },
    {
        name: '第八章　地底煉獄',
        sub: '熔岩與鋼鐵的交響',
        icon: '🌀',
        reward: { icon: '<img src="其他圖示/鑽石圖示.png" style="width:20px;height:20px;vertical-align:middle;">', label: '×45' },
        story: [
            { speaker: '旁白', text: '地底深處，岩漿巨像鎮守著通往世界樹的通道。鋼鐵惡魔和深海海馬阻擋前路。' },
            { speaker: '主角', text: '這些怪物的力量已經完全失控了……必須在一切崩潰之前阻止它。' },
            { speaker: '旁白', text: '岩漿巨像、鋼鐵惡魔、深海海馬——三大守護者擋在你的面前。' },
        ],
        stages: [
            { name: '地底煉獄 Ⅰ', desc: '岩漿巨像的封鎖', enemy: '岩漿巨像', cost: 20, enemyIdx: 17 },
            { name: '地底煉獄 Ⅱ', desc: '鋼鐵惡魔的試煉', enemy: '鋼鐵惡魔', cost: 21, enemyIdx: 18 },
            { name: '地底煉獄 Ⅲ', desc: '深海海馬的守護', enemy: '深海海馬', cost: 22, enemyIdx: 19 },
        ]
    },
    {
        name: '第九章　世界樹聖域',
        sub: '神木的審判',
        icon: '🐉',
        reward: { icon: '<img src="其他圖示/鑽石圖示.png" style="width:20px;height:20px;vertical-align:middle;">', label: '×50' },
        story: [
            { speaker: '旁白', text: '世界樹的根系延伸到大地深處，守護著五行的平衡。世界樹守護者不會容許任何人打擾。' },
            { speaker: '主角', text: '世界樹守護者……傳說中守護五行秩序的神級存在！' },
            { speaker: '???', text: '召喚師，這是你的第三場真正的考驗。以心之力，感受世界樹的意志。' },
        ],
        stages: [
            { name: '世界樹聖域', desc: '世界樹守護者的審判（BOSS）', enemy: '世界樹守護者', cost: 25, enemyIdx: 20 },
        ]
    },
    {
        name: '第十章　龍域裂隙',
        sub: '遠古龍族的覺醒',
        icon: '💀',
        reward: { icon: '<img src="其他圖示/鑽石圖示.png" style="width:20px;height:20px;vertical-align:middle;">', label: '×60' },
        story: [
            { speaker: '旁白', text: '大地裂開，遠古的力量從裂隙中湧出。火焰鳳凰、腐化神木、冰晶飛龍在此甦醒。' },
            { speaker: '主角', text: '這些遠古的存在……每一個都是傳說級別的怪物！' },
            { speaker: '???', text: '你已經走到了這一步。前方就是最後的試煉了。' },
        ],
        stages: [
            { name: '龍域裂隙 Ⅰ', desc: '火焰鳳凰幼體的巢穴', enemy: '火焰鳳凰幼體', cost: 26, enemyIdx: 21 },
            { name: '龍域裂隙 Ⅱ', desc: '腐化神木的森林', enemy: '腐化神木', cost: 28, enemyIdx: 22 },
            { name: '龍域裂隙 Ⅲ', desc: '冰晶飛龍的冰窟', enemy: '冰晶飛龍', cost: 30, enemyIdx: 23 },
        ]
    },
    {
        name: '第十一章　終焉之門',
        sub: '通往神域的最後障壁',
        icon: '🪷',
        reward: { icon: '<img src="其他圖示/鑽石圖示.png" style="width:20px;height:20px;vertical-align:middle;">', label: '×100' },
        story: [
            { speaker: '旁白', text: '神域之門前，琥珀土龍、黃金機械蛇、業火骷髏——它們是五行秩序的最後防線。' },
            { speaker: '主角', text: '我已經走到這裡了……無論前方有什麼，我都不會退縮！' },
            { speaker: '???', text: '通過這道門，你將面對的是……超越凡人理解的存在。做好覺悟了嗎？' },
        ],
        stages: [
            { name: '終焉之門 Ⅰ', desc: '琥珀土龍的封印', enemy: '琥珀土龍', cost: 32, enemyIdx: 24 },
            { name: '終焉之門 Ⅱ', desc: '黃金機械蛇的巢穴', enemy: '黃金機械蛇', cost: 34, enemyIdx: 25 },
            { name: '終焉之門 Ⅲ', desc: '業火骷髏的墓地', enemy: '業火骷髏', cost: 36, enemyIdx: 26 },
        ]
    },
    // ===== 最終 BOSS 章節 =====
    {
        name: '第十二章　黃金機甲',
        sub: '機甲泰坦的審判',
        icon: '👹',
        reward: { icon: '<img src="其他圖示/鑽石圖示.png" style="width:20px;height:20px;vertical-align:middle;">', label: '×100' },
        story: [
            { speaker: '旁白', text: '黃金機甲泰坦，五行之金的終極化身。它的鋼鐵身軀蘊含著毀滅一切的力量。' },
            { speaker: '機甲泰坦', text: '渺小的人類，你以為自己能挑戰金之力的巔峰嗎？' },
            { speaker: '主角', text: '我不是一個人在戰鬥。五行之力與我同在！' },
            { speaker: '機甲泰坦', text: '那就來吧，用你的力量來證明你配得上這份力量！' },
        ],
        stages: [
            { name: '黃金機甲', desc: '黃金機甲泰坦的審判（BOSS）', enemy: '黃金機甲泰坦', cost: 40, enemyIdx: 27 },
        ]
    },
    {
        name: '第十三章　大地終焉',
        sub: '大地暴君的最終審判',
        icon: '☸️',
        reward: { icon: '<img src="其他圖示/星星圖示 — 亮星（32×32）.png" style="width:20px;height:20px;vertical-align:middle;">', label: 'SSR卡' },
        story: [
            { speaker: '旁白', text: '世界的盡頭，大地暴君統治著一切。冰霜神像、石像鬼、墮落天使、雷霆叛神、黃金僱傭兵、狂戰士——所有的強者都在此集結。' },
            { speaker: '主角', text: '這是……最後的戰鬥了。我要恢復五行的平衡，讓這個世界重獲新生！' },
            { speaker: '旁白', text: '打敗所有守護者，面對大地暴君。這是超越人類極限的挑戰。' },
            { speaker: '大地暴君', text: '愚蠢的凡人，五行的秩序不是你能觸碰的。讓我親手終結你的旅途吧！' },
            { speaker: '旁白', text: '最終的戰鬥即將開始。戰鬥到最後一刻，還是被大地吞噬。' },
        ],
        stages: [
            { name: '大地終焉 Ⅰ', desc: '冰霜神像的試煉', enemy: '冰霜神像', cost: 40, enemyIdx: 28 },
            { name: '大地終焉 Ⅱ', desc: '石像鬼的封印', enemy: '石像鬼', cost: 42, enemyIdx: 29 },
            { name: '大地終焉 Ⅲ', desc: '墮落天使的審判', enemy: '墮落天使', cost: 44, enemyIdx: 30 },
            { name: '大地終焉 Ⅳ', desc: '雷霆叛神的雷域', enemy: '雷霆叛神', cost: 46, enemyIdx: 31 },
            { name: '大地終焉 Ⅴ', desc: '黃金僱傭兵的決鬥', enemy: '黃金僱傭兵', cost: 48, enemyIdx: 32 },
            { name: '大地終焉 Ⅵ', desc: '狂戰士的狂暴', enemy: '狂戰士', cost: 50, enemyIdx: 33 },
            { name: '大地暴君', desc: '大地暴君的終極審判（超地獄級）', enemy: '大地暴君', cost: 60, enemyIdx: 34 },
        ]
    },
];

// 進度追蹤：chapterIdx -> [stage cleared booleans]
let storyProgress = STORY_CHAPTERS.map(ch => ch.stages.map(() => false));

function enterMainQuest() {
    SFX.play('pageOpen');
    document.getElementById('story-stamina').textContent = `${playerStamina}/${maxStamina}`;
    renderChapters();
    document.getElementById('story-chapter-list').classList.remove('hidden');
    document.getElementById('story-stage-list').classList.add('hidden');
    document.getElementById('story-screen').classList.remove('hidden');
}

let openChapterIdx = -1;

function renderChapters() {
    const list = document.getElementById('story-chapter-list');
    list.innerHTML = '';

    for (let ci = 0; ci < STORY_CHAPTERS.length; ci++) {
        const ch = STORY_CHAPTERS[ci];
        const cleared = storyProgress[ci].every(s => s);
        const clearedCount = storyProgress[ci].filter(s => s).length;
        const pct = Math.floor((clearedCount / ch.stages.length) * 100);
        const locked = ci > 0 && !storyProgress[ci - 1].every(s => s);
        const isNew = !locked && clearedCount === 0;
        const isOpen = openChapterIdx === ci;

        let badge = '';
        if (cleared) badge = '<div class="chapter-badge clear-badge">CLEAR</div>';
        else if (isNew) badge = '<div class="chapter-badge new-badge">NEW</div>';

        const rewardHtml = cleared
            ? ''
            : `<div class="chapter-reward">
                    <div class="chapter-reward-icon">${ch.reward.icon}</div>
                    <div class="chapter-reward-label">${ch.reward.label}</div>
                </div>`;

        const arrow = `<div class="chapter-arrow" style="margin-left:auto;font-size:12px;color:#888;transition:transform 0.3s;${isOpen ? 'transform:rotate(180deg);' : ''}">\u25BC</div>`;

        let stagesHtml = '';
        if (isOpen && !locked) {
            stagesHtml = '<div class="chapter-stages-dropdown">';
            for (let si = 0; si < ch.stages.length; si++) {
                const st = ch.stages[si];
                const stCleared = storyProgress[ci][si];
                const stLocked = si > 0 && !storyProgress[ci][si - 1];
                const stars = stCleared ? 3 : 0;
                let starsHtml = '';
                for (let s = 0; s < 3; s++) {
                    const starSrc = s < stars ? '其他圖示/星星圖示 — 通關亮星（32×32）.png' : '其他圖示/星星圖示 — 暗星（32×32）.png';
                    starsHtml += `<img src="${starSrc}" class="stage-star-img">`;
                }
                stagesHtml += `
                    <div class="stage-card ${stLocked ? 'locked' : ''} ${stCleared ? 'cleared' : ''}" onclick="event.stopPropagation();startStoryBattle(${ci},${si})">
                        <div class="stage-num">${si + 1}</div>
                        <div class="stage-info">
                            <div class="stage-name">${st.name}</div>
                            <div class="stage-desc">${st.desc}</div>
                            <div class="stage-enemy">👹 ${st.enemy}</div>
                        </div>
                        <div class="stage-cost">
                            <div class="stage-cost-val">⚡ ${st.cost}</div>
                            <div class="stage-cost-label">體力</div>
                            <div class="stage-stars">${starsHtml}</div>
                        </div>
                    </div>`;
            }
            stagesHtml += '</div>';
        }

        list.innerHTML += `
            <div class="chapter-accordion ${locked ? 'locked' : ''} ${cleared ? 'cleared' : ''}">
                <div class="chapter-card" onclick="toggleChapter(${ci})">
                    <div class="chapter-thumb">${ch.icon}</div>
                    <div class="chapter-info">
                        <div class="chapter-title">${ch.name}</div>
                        <div class="chapter-sub">${ch.sub}（${clearedCount}/${ch.stages.length}）</div>
                        <div class="chapter-progress"><div class="chapter-progress-fill" style="width:${pct}%"></div></div>
                    </div>
                    ${rewardHtml}
                    ${badge}
                    ${arrow}
                </div>
                ${stagesHtml}
            </div>`;
    }
}

function toggleChapter(ci) {
    const ch = STORY_CHAPTERS[ci];
    const locked = ci > 0 && !storyProgress[ci - 1].every(s => s);
    if (locked) { showToast('請先通關前一章節'); return; }
    openChapterIdx = openChapterIdx === ci ? -1 : ci;
    renderChapters();
}

function openChapter(ci) { toggleChapter(ci); }
function backToChapters() {
    document.getElementById('story-stage-list').classList.add('hidden');
    document.getElementById('story-chapter-list').classList.remove('hidden');
}

let currentStoryChapter = 0;
let currentStoryStage = 0;

// ===== 故事對話系統 =====
let storyDialogLines = [];
let storyDialogIdx = 0;
let storyDialogCallback = null;
let storyTypingTimer = null;
let storyTypingDone = false;

function showStoryDialog(lines, callback) {
    storyDialogLines = lines;
    storyDialogIdx = 0;
    storyDialogCallback = callback;
    document.getElementById('story-dialog-screen').classList.remove('hidden');
    displayStoryLine();
}

function displayStoryLine() {
    if (storyDialogIdx >= storyDialogLines.length) {
        closeStoryDialog();
        return;
    }
    const line = storyDialogLines[storyDialogIdx];
    const speakerEl = document.getElementById('story-dialog-speaker');
    const textEl = document.getElementById('story-dialog-text');
    if (line.speaker === '旁白') speakerEl.style.color = '#aaa';
    else if (line.speaker === '主角') speakerEl.style.color = '#64c8ff';
    else speakerEl.style.color = '#ffd700';
    speakerEl.textContent = line.speaker;
    textEl.textContent = '';
    storyTypingDone = false;
    let charIdx = 0;
    const fullText = line.text;
    if (storyTypingTimer) clearInterval(storyTypingTimer);
    storyTypingTimer = setInterval(() => {
        if (charIdx < fullText.length) {
            textEl.textContent = fullText.substring(0, charIdx + 1);
            charIdx++;
        } else {
            clearInterval(storyTypingTimer);
            storyTypingTimer = null;
            storyTypingDone = true;
        }
    }, 35);
}

function advanceStoryDialog() {
    if (!storyTypingDone) {
        if (storyTypingTimer) { clearInterval(storyTypingTimer); storyTypingTimer = null; }
        const line = storyDialogLines[storyDialogIdx];
        document.getElementById('story-dialog-text').textContent = line.text;
        storyTypingDone = true;
        return;
    }
    storyDialogIdx++;
    if (storyDialogIdx >= storyDialogLines.length) closeStoryDialog();
    else displayStoryLine();
}

function skipStoryDialog() {
    if (storyTypingTimer) { clearInterval(storyTypingTimer); storyTypingTimer = null; }
    closeStoryDialog();
}

function closeStoryDialog() {
    if (storyTypingTimer) { clearInterval(storyTypingTimer); storyTypingTimer = null; }
    document.getElementById('story-dialog-screen').classList.add('hidden');
    if (storyDialogCallback) {
        const cb = storyDialogCallback;
        storyDialogCallback = null;
        cb();
    }
}

function startStoryBattle(ci, si) {
    const ch = STORY_CHAPTERS[ci];
    const st = ch.stages[si];
    if (playerStamina < st.cost) {
        showToast(`體力不足！需要 ${st.cost} 體力`);
        return;
    }
    // Show story dialog before first stage of each chapter (only first time)
    const hasStory = ch.story && ch.story.length > 0;
    const neverCleared = storyProgress[ci] && !storyProgress[ci].some(s => s);
    if (si === 0 && hasStory && neverCleared) {
        playerStamina -= st.cost;
        updateResources();
        currentStoryChapter = ci;
        currentStoryStage = si;
        closeSub('story-screen');
        showStoryDialog(ch.story, () => launchStoryBattle(ci, si, st));
        return;
    }
    playerStamina -= st.cost;
    updateResources();
    currentStoryChapter = ci;
    currentStoryStage = si;
    closeSub('story-screen');
    launchStoryBattle(ci, si, st);
}

function launchStoryBattle(ci, si, st) {
    document.getElementById('lobby-screen').classList.remove('show');
    isStoryBattle = true;
    const allCards = ownedCards;
    team = teamSlots.filter(idx => idx >= 0).map(idx => allCards[idx] || ownedCards[0]);
    if (team.length === 0) team = [ownedCards[0] || CHARACTERS[0]];
    teamMaxHp = team.reduce((s, c) => s + c.hp, 0);
    teamBaseRcv = team.reduce((s, c) => s + (c.rcv || 0), 0);
    teamHp = teamMaxHp;
    currentStage = st.enemyIdx;
    turnCount = 0;
    activeBuffs = [];
    enemyBuffs = [];
    battleParticles = [];
    skillCooldowns = team.map(c => c.activeSkill.cd);
    document.getElementById('battle-screen').style.display = 'flex';
    document.getElementById('result-screen').classList.remove('show');
    const bgIdx = ci % BATTLE_BGS.length;
    const battleBg = document.getElementById('battle-bg');
    if (battleBg) battleBg.src = BATTLE_BGS[bgIdx];
    initCanvas();
    renderTeam();
    const e = ENEMIES[st.enemyIdx];
    enemy = JSON.parse(JSON.stringify(e));
    enemyMaxHp = e.hp;
    enemyHp = e.hp;
    enemyCd = e.cd;
    enemyMaxCd = e.cd;
    document.getElementById('stage-info').textContent = `${STORY_CHAPTERS[ci].name} - ${st.name}`;
    const spriteEl = document.getElementById('enemy-sprite');
    spriteEl.innerHTML = `<img src="${e.img}" alt="${e.name}" class="enemy-img">`;
    document.getElementById('enemy-name').textContent = `【${ELEMENTS[e.element].name}】${e.name}`;
    updateEnemyHp();
    updateEnemyCd();
    updateTeamHp();
    generateBoard();
    drawBoard();
    startBoardAnimation();
    SFX.startBGM('battle');
    playEnemyEntrance();
}


// ===== 副本（輪迴挑戰） =====
function enterDungeon() {
    if (playerStamina < 10) { showToast('體力不足！需要 10 體力'); return; }
    playerStamina -= 10;
    updateResources();
    startRoguelike();
}

// ===== PVP =====
function enterPvP() {
    showToast('PVP 競技場即將開放，敬請期待！');
}

// ===== 每日任務 =====
const DAILY_QUESTS = [
    { name: '完成 1 場主線戰鬥', desc: '挑戰任意主線關卡', icon: '<img src="其他圖示/BATTLE 按鈕圖示.png" style="width:28px;height:28px;">', target: 1, progress: 0, reward: '<img src="其他圖示/鑽石圖示.png" style="width:16px;height:16px;vertical-align:middle;"> ×5', claimed: false },
    { name: '完成 3 場戰鬥', desc: '完成任意 3 場戰鬥', icon: '<img src="其他圖示/BATTLE 按鈕圖示.png" style="width:28px;height:28px;">', target: 3, progress: 0, reward: '<img src="其他圖示/金幣圖示.png" style="width:16px;height:16px;vertical-align:middle;"> ×5000', claimed: false },
    { name: '進行 1 次召喚', desc: '在召喚系統中抽卡', icon: '<img src="其他圖示/召喚圖示.png" style="width:28px;height:28px;">', target: 1, progress: 0, reward: '<img src="其他圖示/鑽石圖示.png" style="width:16px;height:16px;vertical-align:middle;"> ×3', claimed: false },
    { name: '消除 50 顆珠子', desc: '在戰鬥中消除珠子', icon: '<img src="五行珠/治癒.png" style="width:28px;height:28px;">', target: 50, progress: 0, reward: '<img src="其他圖示/金幣圖示.png" style="width:16px;height:16px;vertical-align:middle;"> ×3000', claimed: false },
    { name: '達成 5 Combo', desc: '單次轉珠達成 5 Combo', icon: '<img src="其他圖示/星星圖示 — 亮星（32×32）.png" style="width:28px;height:28px;">', target: 5, progress: 0, reward: '<img src="其他圖示/鑽石圖示.png" style="width:16px;height:16px;vertical-align:middle;"> ×10', claimed: false },
];

let lastDailyReset = '';
let dailyRateUpSSR = []; // 每日1張SSR加倍

// 根據日期生成每日加倍SSR（用日期當seed確保同一天固定）
function refreshDailyRateUp() {
    const ssrPool = GACHA_POOL.filter(c => c.rarity === 'SSR');
    const today = new Date().toISOString().slice(0, 10);
    // simple seed from date string
    let seed = 0;
    for (let i = 0; i < today.length; i++) seed = (seed * 31 + today.charCodeAt(i)) & 0x7fffffff;
    function seededRand() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    // pick 1 unique SSR
    const indices = [];
    while (indices.length < 1 && indices.length < ssrPool.length) {
        const idx = Math.floor(seededRand() * ssrPool.length);
        if (!indices.includes(idx)) indices.push(idx);
    }
    dailyRateUpSSR = indices.map(i => ssrPool[i]);
    // update gacha weights: SSR總機率維持0.1%不變
    // 加倍的3張在SSR池內機率加倍（權重×2），其他SSR維持原權重
    const rateUpNames = dailyRateUpSSR.map(c => c.name);
    const normalSSR = ssrPool.filter(c => !rateUpNames.includes(c.name));
    const totalSSRPct = 1.0; // SSR總機率固定1%
    // 加倍SSR權重=2，普通SSR權重=1，算出每份的實際%
    const totalParts = 1 * 2 + normalSSR.length * 1; // 加倍1張×2 + 普通×1
    const partPct = totalSSRPct / totalParts;
    for (const card of GACHA_POOL) {
        if (card.rarity === 'SSR') {
            if (rateUpNames.includes(card.name)) {
                card.weight = partPct * 2; // 加倍
            } else {
                card.weight = partPct * 1; // 普通
            }
        }
    }
    // recalc R weights to keep total = 100
    const srTotal = GACHA_POOL.filter(c => c.rarity === 'SR').reduce((s, c) => s + c.weight, 0);
    const ssrTotal = GACHA_POOL.filter(c => c.rarity === 'SSR').reduce((s, c) => s + c.weight, 0);
    const rCards = GACHA_POOL.filter(c => c.rarity === 'R');
    const rTotal = 100 - srTotal - ssrTotal;
    for (const card of rCards) card.weight = rTotal / rCards.length;
}

function renderLobbyRateUp() {
    const banner = document.getElementById('lobby-rateup-banner');
    if (!banner || dailyRateUpSSR.length === 0) return;
    let html = '<div class="lobby-rateup-title">🔥 今日限定加倍 🔥</div><div class="lobby-rateup-cards">';
    for (const c of dailyRateUpSSR) {
        const el = ELEMENTS[c.element] || {};
        html += `<div class="lobby-rateup-card" onclick="showGacha()">
            <img src="${c.img}" alt="${c.title}">
            <div class="lobby-rateup-card-badge">UP</div>
            <div class="lobby-rateup-card-name">${c.title}</div>
            <div class="lobby-rateup-card-shimmer"></div>
        </div>`;
    }
    html += '</div>';
    banner.innerHTML = html;
}

function checkDailyReset() {
    const today = new Date().toISOString().slice(0, 10);
    refreshDailyRateUp();
    renderLobbyRateUp();
    if (lastDailyReset !== today) {
        lastDailyReset = today;
        for (const q of DAILY_QUESTS) {
            q.progress = 0;
            q.claimed = false;
        }
        saveGame();
    }
}

// ===== 任務中心（每日+新手） =====
function showQuestCenter() {
    SFX.play('pageOpen');
    const old = document.getElementById('quest-center-screen');
    if (old) old.remove();
    let html = '<div class="sub-screen" id="quest-center-screen" style="z-index:65;">';
    html += '<div class="sub-header"><button class="back-btn" onclick="closeSub(\'quest-center-screen\')">← 返回</button><div class="sub-title">任務中心</div><div></div></div>';
    html += '<div style="display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">';
    html += '<div id="qc-tab-daily" class="qc-tab qc-tab-active" onclick="switchQcTab(\'daily\')">📋 每日任務</div>';
    html += '<div id="qc-tab-rookie" class="qc-tab" onclick="switchQcTab(\'rookie\')">🎓 新手任務</div>';
    html += '</div>';
    html += '<div id="qc-content" style="flex:1;overflow-y:auto;min-height:0;touch-action:pan-y;-webkit-overflow-scrolling:touch;"></div>';
    html += '</div>';
    document.getElementById('game-container').appendChild(document.createRange().createContextualFragment(html));
    switchQcTab('daily');
}

function switchQcTab(tab) {
    document.getElementById('qc-tab-daily').className = 'qc-tab' + (tab === 'daily' ? ' qc-tab-active' : '');
    document.getElementById('qc-tab-rookie').className = 'qc-tab' + (tab === 'rookie' ? ' qc-tab-active' : '');
    const content = document.getElementById('qc-content');
    if (tab === 'daily') {
        renderQcDaily(content);
    } else {
        renderQcRookie(content);
    }
}

function renderQcDaily(container) {
    checkDailyReset();
    let html = '';
    for (let i = 0; i < DAILY_QUESTS.length; i++) {
        const q = DAILY_QUESTS[i];
        const pct = Math.min(100, (q.progress / q.target) * 100);
        const done = q.progress >= q.target;
        html += `<div class="daily-item">
            <div class="daily-icon">${q.icon}</div>
            <div class="daily-info">
                <div class="daily-name">${q.name}</div>
                <div class="daily-desc">${q.desc} (${q.progress}/${q.target})</div>
                <div class="daily-progress"><div class="daily-progress-fill" style="width:${pct}%"></div></div>
            </div>
            <div class="daily-reward ${q.claimed ? 'claimed' : ''}" onclick="${done && !q.claimed ? `claimDaily(${i});switchQcTab('daily')` : ''}">${q.claimed ? '已領取' : q.reward}</div>
        </div>`;
    }
    container.innerHTML = '<div class="daily-list" style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;">' + html + '</div>';
}

function renderQcRookie(container) {
    trackRookieQuest('level', summonerLv);
    let html = '<div class="rq-content" style="overflow:visible;">';
    for (let si = 0; si < ROOKIE_STAGES.length; si++) {
        const stage = ROOKIE_STAGES[si];
        const allDone = stage.quests.every(q => rookieProgress[q.id]?.claimed);
        const allComplete = stage.quests.every(q => (rookieProgress[q.id]?.progress || 0) >= q.target);
        const prevDone = si === 0 || ROOKIE_STAGES[si - 1].quests.every(q => rookieProgress[q.id]?.claimed);
        const locked = !prevDone;
        html += `<div class="rq-stage ${locked ? 'rq-locked' : ''} ${allDone ? 'rq-done' : ''}">`;
        html += `<div class="rq-stage-header" style="border-left:3px solid ${stage.color};"><span class="rq-stage-icon">${stage.icon}</span><span class="rq-stage-name" style="color:${stage.color};">${stage.name}</span>`;
        if (allDone) html += '<span class="rq-stage-badge rq-badge-done">完成</span>';
        else if (allComplete && !locked) html += '<span class="rq-stage-badge rq-badge-ready">可領取</span>';
        html += '</div>';
        for (const q of stage.quests) {
            const rp = rookieProgress[q.id] || { progress: 0, claimed: false };
            const done = rp.progress >= q.target;
            const pct = Math.min(100, Math.floor((rp.progress / q.target) * 100));
            const rewardText = q.reward.gems
                ? `<img src="其他圖示/鑽石圖示.png" style="width:16px;height:16px;vertical-align:middle;"> ×${q.reward.gems}`
                : `<img src="其他圖示/金幣圖示.png" style="width:16px;height:16px;vertical-align:middle;"> ×${q.reward.gold?.toLocaleString()}`;
            html += `<div class="rq-quest ${rp.claimed ? 'rq-quest-claimed' : ''}">`;
            html += `<div class="rq-quest-info"><div class="rq-quest-name">${q.name}</div><div class="rq-quest-desc">${q.desc} (${rp.progress}/${q.target})</div>`;
            html += `<div class="rq-quest-bar"><div class="rq-quest-bar-fill" style="width:${pct}%;background:${stage.color};"></div></div></div>`;
            if (rp.claimed) {
                html += '<div class="rq-reward rq-reward-claimed">已領取</div>';
            } else if (done && !locked) {
                html += `<div class="rq-reward rq-reward-ready" onclick="claimRookieQuest('${q.id}');switchQcTab('rookie')">${rewardText}</div>`;
            } else {
                html += `<div class="rq-reward rq-reward-locked">${rewardText}</div>`;
            }
            html += '</div>';
        }
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

// ===== 冒險選單（新故事+副本+PVP） =====
function showAdventureMenu() {
    SFX.play('pageOpen');
    const old = document.getElementById('adventure-menu-screen');
    if (old) old.remove();
    let html = '<div class="sub-screen" id="adventure-menu-screen" style="z-index:65;">';
    html += '<div class="sub-header"><button class="back-btn" onclick="closeSub(\'adventure-menu-screen\')">← 返回</button><div class="sub-title">冒險</div><div></div></div>';
    html += '<div style="flex:1;display:flex;flex-direction:column;gap:12px;padding:16px 14px;overflow-y:auto;">';
    // 主線故事
    html += '<div class="adv-menu-item" onclick="closeSub(\'adventure-menu-screen\');enterMainQuest()">';
    html += '<div class="adv-menu-icon">📜</div>';
    html += '<div class="adv-menu-info"><div class="adv-menu-name">主線故事</div><div class="adv-menu-desc">探索五行世界的冒險旅程</div></div>';
    html += '<div class="adv-menu-arrow">›</div></div>';
    // 副本挑戰
    html += '<div class="adv-menu-item" onclick="closeSub(\'adventure-menu-screen\');enterDungeon()">';
    html += '<div class="adv-menu-icon">🏰</div>';
    html += '<div class="adv-menu-info"><div class="adv-menu-name">輪迴挑戰</div><div class="adv-menu-desc">50層連戰，越深越強！消耗10體力</div></div>';
    html += '<div class="adv-menu-arrow">›</div></div>';
    // PVP
    html += '<div class="adv-menu-item" onclick="closeSub(\'adventure-menu-screen\');enterPvP()">';
    html += '<div class="adv-menu-icon">⚔️</div>';
    html += '<div class="adv-menu-info"><div class="adv-menu-name">PVP競技</div><div class="adv-menu-desc">與其他召喚師一決高下</div></div>';
    html += '<div class="adv-menu-arrow">›</div></div>';
    html += '</div></div>';
    document.getElementById('game-container').appendChild(document.createRange().createContextualFragment(html));
}

function showDaily() {
    SFX.play('pageOpen');
    checkDailyReset();
    const list = document.getElementById('daily-list');
    list.innerHTML = '';
    for (let i = 0; i < DAILY_QUESTS.length; i++) {
        const q = DAILY_QUESTS[i];
        const pct = Math.min(100, (q.progress / q.target) * 100);
        const done = q.progress >= q.target;
        list.innerHTML += `
            <div class="daily-item">
                <div class="daily-icon">${q.icon}</div>
                <div class="daily-info">
                    <div class="daily-name">${q.name}</div>
                    <div class="daily-desc">${q.desc} (${q.progress}/${q.target})</div>
                    <div class="daily-progress"><div class="daily-progress-fill" style="width:${pct}%"></div></div>
                </div>
                <div class="daily-reward ${q.claimed ? 'claimed' : ''}" onclick="${done && !q.claimed ? `claimDaily(${i})` : ''}">${q.claimed ? '已領取' : q.reward}</div>
            </div>`;
    }
    document.getElementById('daily-screen').classList.remove('hidden');
}

function claimDaily(idx) {
    const q = DAILY_QUESTS[idx];
    if (q.claimed || q.progress < q.target) return;
    q.claimed = true;
    // 發放獎勵
    const reward = q.reward;
    if (reward.includes('💎')) {
        const amount = parseInt(reward.replace(/[^\d]/g, ''), 10) || 0;
        playerGems += amount;
    } else if (reward.includes('🪙')) {
        const amount = parseInt(reward.replace(/[^\d]/g, ''), 10) || 0;
        playerGold += amount;
    }
    updateResources();
    saveGame();
    SFX.play('confirm');
    showToast('獎勵已領取！');
    showDaily();
}

// ===== 抽卡系統 =====
// 卡池：排除初始角色（index 0-4），只有 index 5+ 的卡
const GACHA_POOL = CHARACTERS.slice(5).map((c, i) => {
    const rarity = c.rarity || 'R';
    const ssrCards = CHARACTERS.slice(5).filter(x => x.rarity === 'SSR');
    const srCards = CHARACTERS.slice(5).filter(x => x.rarity === 'SR');
    const rCards = CHARACTERS.slice(5).filter(x => !x.rarity || x.rarity === 'R');
    let weight;
    if (rarity === 'SSR') weight = 1.0 / ssrCards.length;
    else if (rarity === 'SR') weight = 5.0 / srCards.length;
    else weight = 94.0 / rCards.length;
    return { ...c, _poolIdx: i + 5, rarity, weight };
});

let gachaPityTarget = null; // 保底目標卡（玩家預選）

function initGachaPreview() {
    const preview = document.getElementById('gacha-preview');
    if (!preview) return;
    const rateUpNames = dailyRateUpSSR.map(c => c.name);
    const ssrCards = GACHA_POOL.filter(c => c.rarity === 'SSR');
    const otherSSR = ssrCards.filter(c => !rateUpNames.includes(c.name));
    // 第一排：加倍SSR
    let html = '<div class="gacha-preview-row">';
    for (const c of dailyRateUpSSR) {
        html += `<div class="gacha-preview-card gacha-rateup-card">
            <img src="${c.img}" alt="${c.name}">
            <div class="gacha-rateup-badge">機率UP</div>
            <div class="gacha-rateup-shimmer"></div>
        </div>`;
    }
    html += '</div>';
    // 第二排：其他SSR
    html += '<div class="gacha-preview-row">';
    for (const c of otherSSR) {
        html += `<div class="gacha-preview-card"><img src="${c.img}" alt="${c.name}"></div>`;
    }
    html += '</div>';
    preview.innerHTML = html;
    // 更新banner文字
    const bannerSub = document.getElementById('gacha-banner-sub');
    if (bannerSub && dailyRateUpSSR.length > 0) {
        bannerSub.innerHTML = '今日加倍：' + dailyRateUpSSR.map(c => `<span style="color:#ffd700;">${c.title}</span>`).join('、');
    }
}

function updatePityDisplay() {
    const el = document.getElementById('gacha-pity-info');
    if (!el) return;
    const remaining = 66 - gachaPity;
    const ssrTotal = GACHA_POOL.filter(c => c.rarity === 'SSR').reduce((s, c) => s + c.weight, 0);
    let html = `<div>距離保底還有 <span style="color:#ffd700;font-weight:bold;">${remaining}</span> 抽</div>`;
    html += `<div style="font-size:10px;color:#888;margin-top:4px;">R: ${parseFloat((100 - 5 - ssrTotal).toFixed(1))}% | SR: 5% | SSR: ${parseFloat(ssrTotal.toFixed(1))}%</div>`;
    // 今日加倍
    if (dailyRateUpSSR.length > 0) {
        html += `<div style="margin-top:6px;font-size:10px;color:#ffaa00;">🔥 今日加倍：${dailyRateUpSSR.map(c => c.title).join('、')}</div>`;
    }
    // 保底目標選擇
    html += `<div style="margin-top:8px;font-size:11px;color:#ccc;">保底目標：`;
    if (gachaPityTarget) {
        html += `<span style="color:#ffd700;">${gachaPityTarget.title}・${gachaPityTarget.name}</span>`;
    } else {
        html += `<span style="color:#888;">未選擇（隨機SSR）</span>`;
    }
    html += ` <button onclick="showPityTargetSelect()" style="font-size:10px;padding:2px 8px;border:1px solid rgba(255,215,0,0.3);background:rgba(255,215,0,0.1);color:#ffd700;border-radius:4px;cursor:pointer;">選擇</button></div>`;
    el.innerHTML = html;
}

function showGacha() {
    SFX.play('pageOpen');
    document.getElementById('gacha-gems').textContent = playerGems;
    document.getElementById('gacha-screen').classList.remove('hidden');
    initGachaPreview();
    updatePityDisplay();
}

function showPityTargetSelect() {
    const ssrPool = GACHA_POOL.filter(c => c.rarity === 'SSR');
    let html = '<div id="pity-target-screen" style="position:absolute;inset:0;z-index:300;background:radial-gradient(ellipse at top,#1a1530 0%,#080c1e 50%,#050810 100%);display:flex;flex-direction:column;">';
    html += '<div style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,215,0,0.15);background:linear-gradient(180deg,rgba(30,25,10,0.5),transparent);flex-shrink:0;">';
    html += '<button class="back-btn" onclick="closePityTarget()">← 返回</button>';
    html += '<div style="font-size:16px;font-weight:bold;letter-spacing:3px;color:#ffd700;text-shadow:0 0 10px rgba(255,215,0,0.4);">選擇保底目標</div>';
    html += '<div style="width:50px;"></div></div>';
    html += '<div style="font-size:11px;color:#aaa;text-align:center;padding:6px 12px;flex-shrink:0;">66抽保底時將獲得你選擇的SSR卡</div>';
    html += '<div style="flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:10px 14px;align-content:start;touch-action:pan-y;-webkit-overflow-scrolling:touch;">';
    const rateUpNames = dailyRateUpSSR.map(c => c.name);
    for (let i = 0; i < ssrPool.length; i++) {
        const c = ssrPool[i];
        const isRateUp = rateUpNames.includes(c.name);
        const isSel = gachaPityTarget && gachaPityTarget.name === c.name;
        const el = ELEMENTS[c.element] || {};
        const selBorder = isSel ? 'border-color:rgba(255,215,0,0.8);box-shadow:0 0 20px rgba(255,215,0,0.6),0 0 40px rgba(255,215,0,0.2);' : '';
        html += '<div style="display:flex;flex-direction:column;border-radius:10px;overflow:hidden;background:rgba(10,12,25,0.95);border:2px solid rgba(255,215,0,0.3);box-shadow:0 0 10px rgba(255,215,0,0.15),0 4px 12px rgba(0,0,0,0.6);position:relative;' + selBorder + '">';
        // card image - click to select
        html += '<div style="width:100%;aspect-ratio:3/4;position:relative;cursor:pointer;overflow:hidden;background:#0a0c19;" onclick="selectPityTarget(\'' + c.name + '\')">';
        html += '<img src="' + c.img + '" style="width:100%;height:100%;object-fit:contain;">';
        html += '<div style="position:absolute;inset:0;overflow:hidden;pointer-events:none;"><div style="position:absolute;top:-50%;left:-60%;width:40%;height:200%;background:linear-gradient(105deg,transparent 30%,rgba(255,230,100,0.1) 48%,rgba(255,255,200,0.2) 50%,rgba(255,230,100,0.1) 52%,transparent 70%);transform:rotate(25deg);animation:pityShimmer2 4s ease-in-out infinite;"></div></div>';
        html += '<div style="position:absolute;top:4px;left:4px;width:22px;height:22px;"><img src="' + (el.orbImg || '') + '" style="width:20px;height:20px;object-fit:contain;filter:drop-shadow(0 0 4px ' + (el.color || '#fff') + ');"></div>';
        if (isRateUp) {
            html += '<div style="position:absolute;top:4px;left:28px;background:linear-gradient(135deg,#ff4757,#ff6b81);color:#fff;font-size:8px;font-weight:bold;padding:1px 5px;border-radius:4px;letter-spacing:1px;text-shadow:0 1px 2px rgba(0,0,0,0.5);animation:rateupBadgePulse 1.5s ease-in-out infinite;">UP</div>';
        }
        if (isSel) {
            html += '<div style="position:absolute;top:4px;right:4px;width:26px;height:26px;background:linear-gradient(135deg,#ffd700,#ffaa00);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;color:#1a1000;font-weight:bold;box-shadow:0 0 14px rgba(255,215,0,0.7);">✓</div>';
        }
        html += '<div style="position:absolute;bottom:0;left:0;right:0;padding:20px 8px 6px;background:linear-gradient(0deg,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.5) 60%,transparent 100%);">';
        html += '<div style="font-size:13px;font-weight:bold;color:#ffd700;text-shadow:0 0 8px rgba(255,215,0,0.5),0 1px 3px #000;letter-spacing:1px;">' + c.title + '</div>';
        html += '<div style="font-size:10px;color:#ccc;text-shadow:0 1px 2px #000;">' + c.name + ' · ' + (el.name || '') + '屬性</div>';
        html += '</div></div>';
        // bottom buttons
        html += '<div style="display:flex;gap:0;">';
        html += '<div style="flex:1;padding:8px 0;text-align:center;font-size:11px;color:#ffd700;font-weight:bold;cursor:pointer;background:rgba(255,215,0,0.06);border-top:1px solid rgba(255,215,0,0.1);" onclick="selectPityTarget(\'' + c.name + '\')">選擇</div>';
        html += '<div style="flex:1;padding:8px 0;text-align:center;font-size:11px;color:#64c8ff;font-weight:bold;cursor:pointer;background:rgba(100,200,255,0.04);border-top:1px solid rgba(100,200,255,0.08);border-left:1px solid rgba(255,255,255,0.06);" onclick="event.stopPropagation();showPityCardPreview(' + i + ')">查看詳情</div>';
        html += '</div></div>';
    }
    html += '</div>';
    html += '<div style="padding:10px 14px 16px;display:flex;justify-content:center;flex-shrink:0;background:linear-gradient(0deg,rgba(10,10,20,0.95),transparent);">';
    html += '<button onclick="clearPityTarget()" style="padding:10px 28px;border:1px solid rgba(255,255,255,0.12);background:linear-gradient(180deg,rgba(30,30,50,0.9),rgba(15,15,30,0.95));color:#ccc;border-radius:8px;cursor:pointer;font-size:12px;letter-spacing:1px;">清除選擇（隨機SSR）</button>';
    html += '</div></div>';
    if (!document.getElementById('pity-shimmer-style')) {
        const style = document.createElement('style');
        style.id = 'pity-shimmer-style';
        style.textContent = '@keyframes pityShimmer2 { 0%,100%{left:-60%;opacity:0;} 10%{opacity:1;} 55%{left:130%;opacity:1;} 65%,100%{left:130%;opacity:0;} }';
        document.head.appendChild(style);
    }
    document.getElementById('gacha-screen').insertAdjacentHTML('beforeend', html);
}


function closePityTarget() {
    const el = document.getElementById('pity-target-screen');
    if (el) el.remove();
    updatePityDisplay();
}

function selectPityTarget(name) {
    const ssrPool = GACHA_POOL.filter(c => c.rarity === 'SSR');
    gachaPityTarget = ssrPool.find(c => c.name === name) || null;
    closePityTarget();
    saveGame();
    showToast(gachaPityTarget ? `保底目標：${gachaPityTarget.title}` : '已清除保底目標');
}

function clearPityTarget() {
    gachaPityTarget = null;
    closePityTarget();
    saveGame();
    showToast('已清除保底目標');
}

function showPityCardPreview(idx) {
    const ssrPool = GACHA_POOL.filter(c => c.rarity === 'SSR');
    const c = ssrPool[idx];
    if (!c) return;
    const el = ELEMENTS[c.element] || {};
    let html = '<div id="pity-card-preview" style="position:absolute;inset:0;z-index:310;background:rgba(0,0,0,0.97);display:flex;flex-direction:column;animation:dialogFadeIn 0.3s ease-out;">';
    html += '<div style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;border-bottom:1px solid rgba(255,215,0,0.1);">';
    html += `<button class="back-btn" onclick="closePityCardPreview()">← 返回</button>`;
    html += `<div style="font-size:14px;font-weight:bold;color:#ffd700;letter-spacing:2px;">${c.title} · ${c.name}</div>`;
    html += '<div style="width:50px;"></div></div>';
    html += '<div style="flex:1;overflow-y:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch;">';
    // full card image
    html += '<div style="width:100%;max-height:50vh;position:relative;background:#080c1e;display:flex;align-items:center;justify-content:center;overflow:hidden;">';
    html += `<img src="${c.img}" style="width:100%;max-height:50vh;object-fit:contain;">`;
    html += '<div style="position:absolute;inset:0;box-shadow:inset 0 0 30px rgba(255,215,0,0.15),inset 0 0 60px rgba(255,215,0,0.05);pointer-events:none;"></div>';
    html += '<div style="position:absolute;bottom:0;left:0;right:0;height:30%;background:linear-gradient(0deg,#050810 0%,rgba(5,8,16,0.4) 60%,transparent 100%);pointer-events:none;"></div>';
    html += `<div style="position:absolute;top:8px;left:8px;"><img src="${el.orbImg || ''}" style="width:24px;height:24px;object-fit:contain;filter:drop-shadow(0 0 4px ${el.color || '#fff'});"></div>`;
    html += '</div>';
    // info
    html += '<div style="padding:10px 14px;">';
    html += `<div style="font-size:18px;font-weight:bold;color:#ffd700;letter-spacing:2px;text-shadow:0 0 10px rgba(255,215,0,0.4);">${c.title}</div>`;
    html += `<div style="font-size:12px;color:#ccc;margin-top:2px;">${c.name} · <span style="color:${el.color || '#aaa'};">${el.name || ''}屬性</span> · 種族：${c.race || ''}</div>`;
    // stats
    html += '<div style="display:flex;gap:16px;margin-top:10px;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.06);">';
    html += `<div style="text-align:center;flex:1;"><div style="font-size:9px;color:#888;">生命力</div><div style="font-size:16px;font-weight:bold;color:#ff6b81;">${c.hp}</div></div>`;
    html += `<div style="text-align:center;flex:1;"><div style="font-size:9px;color:#888;">攻擊力</div><div style="font-size:16px;font-weight:bold;color:#ffa502;">${c.atk}</div></div>`;
    html += `<div style="text-align:center;flex:1;"><div style="font-size:9px;color:#888;">回復力</div><div style="font-size:16px;font-weight:bold;color:#7bed9f;">${c.rcv}</div></div>`;
    html += '</div>';
    // active skill
    html += '<div style="margin-top:10px;padding:10px;background:rgba(255,215,0,0.04);border:1px solid rgba(255,215,0,0.12);border-radius:8px;">';
    html += `<div style="font-size:12px;color:#ffd700;font-weight:bold;">主動技：${c.activeSkill.name} <span style="color:#64c8ff;font-weight:normal;font-size:11px;">CD ${c.activeSkill.cd}</span></div>`;
    html += `<div style="font-size:11px;color:#ccc;margin-top:4px;line-height:1.6;white-space:pre-line;">${c.activeSkill.desc}</div>`;
    html += '</div>';
    // leader skill
    html += '<div style="margin-top:8px;padding:10px;background:rgba(100,200,255,0.04);border:1px solid rgba(100,200,255,0.1);border-radius:8px;">';
    html += `<div style="font-size:12px;color:#64c8ff;font-weight:bold;">隊長技：${c.leaderSkill.name}</div>`;
    html += `<div style="font-size:11px;color:#ccc;margin-top:4px;line-height:1.6;white-space:pre-line;">${c.leaderSkill.desc}</div>`;
    html += '</div>';
    if (c.teamSkill) {
        html += '<div style="margin-top:8px;padding:10px;background:rgba(46,213,115,0.04);border:1px solid rgba(46,213,115,0.1);border-radius:8px;">';
        html += `<div style="font-size:12px;color:#7bed9f;font-weight:bold;">隊伍技：${c.teamSkill.name}</div>`;
        html += `<div style="font-size:11px;color:#ccc;margin-top:4px;line-height:1.6;white-space:pre-line;">${c.teamSkill.desc}</div>`;
        html += '</div>';
    }
    if (c.bond) {
        html += '<div style="margin-top:8px;padding:10px;background:rgba(199,125,255,0.04);border:1px solid rgba(199,125,255,0.1);border-radius:8px;">';
        html += `<div style="font-size:12px;color:#c77dff;font-weight:bold;">羈絆：${c.bond.name}</div>`;
        html += `<div style="font-size:11px;color:#ccc;margin-top:4px;line-height:1.6;white-space:pre-line;">${c.bond.desc}</div>`;
        html += '</div>';
    }
    html += '<div style="height:20px;"></div></div></div></div>';
    document.getElementById('pity-target-screen').insertAdjacentHTML('beforeend', html);
}

function closePityCardPreview() {
    const el = document.getElementById('pity-card-preview');
    if (el) el.remove();
}

let gachaAnimResults = [];
let gachaFlippedCount = 0;
let gachaCurrentIndex = 0;
let gachaAnimating = false;

async function doPull(count) {
    const cost = count === 1 ? 5 : 50;
    if (playerGems < cost) { showToast('紫珀原石不足！'); return; }

    try {
        const data = await apiFetch('/gacha/pull', {
            method: 'POST',
            body: JSON.stringify({
                count,
                pityTargetName: gachaPityTarget ? gachaPityTarget.name : null,
            }),
        });

        const pulledCards = (data.results || []).map((r) => {
            const base = CHARACTERS.find((c) => c.name === r.name);
            if (!base) {
                return {
                    name: r.name,
                    title: r.name,
                    rarity: r.rarity || 'R',
                    element: 'fire',
                    img: '',
                    lv: 1,
                    maxLv: r.rarity === 'SSR' ? 99 : (r.rarity === 'SR' ? 70 : 50),
                    atk: 500,
                    hp: 2000,
                    rcv: 150,
                    cost: 10,
                    activeSkill: { name: '未知技能', cd: 8, desc: '暫無技能資料', effect: '' },
                    leaderSkill: { name: '未知隊長技', desc: '暫無隊長技資料', mult: [] },
                    teamSkill: { name: '未知隊伍技', desc: '暫無隊伍技資料' },
                    bond: { name: '未知羈絆', desc: '暫無羈絆資料' },
                };
            }
            return { ...base };
        });

        pulledCards.forEach((card) => {
            ensureBaseStats(card);
            ownedCards.push(card);
        });

        if (data.resources) {
            playerGems = Number(data.resources.gems || playerGems);
            playerGold = Number(data.resources.gold || playerGold);
            gachaPity = Number(data.resources.gacha_pity || 0);
            const targetName = data.resources.gacha_pity_target || null;
            gachaPityTarget = targetName ? (GACHA_POOL.find((c) => c.name === targetName) || null) : null;
        }

        updateResources();
        document.getElementById('gacha-gems').textContent = playerGems;
        updatePityDisplay();
        saveGame();

        if (DAILY_QUESTS[2]) DAILY_QUESTS[2].progress = Math.min(DAILY_QUESTS[2].target, DAILY_QUESTS[2].progress + 1);
        trackRookieQuest('gacha');

        showGachaAnimation(pulledCards);
    } catch (error) {
        showToast(error.message || '抽卡失敗，請稍後再試');
    }
}

function showGachaAnimation(results) {
    gachaAnimResults = results;
    gachaCurrentIndex = 0;
    gachaAnimating = false;

    const screen = document.getElementById('gacha-anim-screen');
    const reveal = document.getElementById('gacha-anim-reveal');
    reveal.classList.add('hidden');
    screen.classList.remove('hidden');

    const skipBtn = document.getElementById('gacha-skip-btn');
    if (results.length > 1) skipBtn.classList.remove('hidden');
    else skipBtn.classList.add('hidden');

    drawGachaParticles(results.some(c => c.rarity === 'SSR'));
    showNextGachaCard();
}

function showNextGachaCard() {
    if (gachaCurrentIndex >= gachaAnimResults.length) {
        setTimeout(showGachaFinalResult, 300);
        return;
    }
    gachaAnimating = true;
    const card = gachaAnimResults[gachaCurrentIndex];
    const isSSR = card.rarity === 'SSR';
    const isSR = card.rarity === 'SR';

    const stage = document.getElementById('gacha-card-stage');
    const cardEl = document.getElementById('gacha-card-reveal');
    const nameEl = document.getElementById('gacha-card-name');
    const rarityEl = document.getElementById('gacha-card-rarity');
    const hint = document.getElementById('gacha-pull-hint');
    const counter = document.getElementById('gacha-counter');
    const doorL = document.getElementById('gacha-door-left');
    const doorR = document.getElementById('gacha-door-right');
    const doorWrap = document.getElementById('gacha-door-wrap');

    // 更新計數
    if (gachaAnimResults.length > 1) {
        counter.textContent = `${gachaCurrentIndex + 1} / ${gachaAnimResults.length}`;
        counter.style.display = 'block';
    } else {
        counter.style.display = 'none';
    }

    // 重置狀態
    nameEl.textContent = '';
    rarityEl.textContent = '';
    nameEl.style.opacity = '0';
    rarityEl.style.opacity = '0';
    stage.style.opacity = '0';
    hint.style.opacity = '1';
    hint.textContent = '點擊螢幕開啟';

    // 卡背圖
    const cardBackImg = isSSR ? '卡背/SSR 卡背（傳說）.png' : (isSR ? '卡背/SR 卡背（稀有）.png' : '卡背/R 卡背（普通）.png');
    cardEl.innerHTML = `<img src="${cardBackImg}" class="gacha-card-back-img">`;
    cardEl.classList.remove('gacha-card-revealed');

    // 門關閉
    doorWrap.style.display = 'flex';
    doorL.style.transform = 'translateX(0)';
    doorR.style.transform = 'translateX(0)';
    doorL.className = `gacha-door ${isSSR ? 'door-ssr' : (isSR ? 'door-sr' : 'door-r')}`;
    doorR.className = `gacha-door ${isSSR ? 'door-ssr' : (isSR ? 'door-sr' : 'door-r')}`;

    // 卡片從上方滑入
    stage.style.transform = 'translateY(-120%)';
    stage.style.opacity = '1';
    setTimeout(() => {
        stage.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        stage.style.transform = 'translateY(0)';
    }, 100);

    // 等卡片到位後啟用互動
    setTimeout(() => {
        setupGachaDragReveal(card);
    }, 800);
}

function setupGachaDragReveal(card) {
    const screen = document.getElementById('gacha-anim-screen');
    let revealed = false;

    function onClick(e) {
        if (revealed) {
            cleanup();
            gachaCurrentIndex++;
            showNextGachaCard();
            return;
        }
        revealed = true;
        revealCurrentCard(card);
    }

    function cleanup() {
        screen.removeEventListener('click', onClick);
    }

    screen._gachaCleanup = cleanup;
    screen.addEventListener('click', onClick);
}


function revealCurrentCard(card) {
    const doorL = document.getElementById('gacha-door-left');
    const doorR = document.getElementById('gacha-door-right');
    const doorWrap = document.getElementById('gacha-door-wrap');
    const cardEl = document.getElementById('gacha-card-reveal');
    const nameEl = document.getElementById('gacha-card-name');
    const rarityEl = document.getElementById('gacha-card-rarity');
    const hint = document.getElementById('gacha-pull-hint');
    const screen = document.getElementById('gacha-anim-screen');
    const isSSR = card.rarity === 'SSR';
    const isSR = card.rarity === 'SR';

    hint.style.opacity = '0';

    if (isSSR) {
        // === SSR：震動集氣 → 爆炸 → 揭卡 ===
        screen.classList.add('gacha-shake-charge');
        // 集氣光球
        const chargeOrb = document.createElement('div');
        chargeOrb.className = 'gacha-charge-orb';
        screen.appendChild(chargeOrb);

        // 1.2秒集氣後爆炸
        setTimeout(() => {
            screen.classList.remove('gacha-shake-charge');
            chargeOrb.remove();

            // 爆炸白屏
            const explosion = document.createElement('div');
            explosion.className = 'gacha-ssr-explosion';
            screen.appendChild(explosion);
            setTimeout(() => explosion.remove(), 1000);

            // 門炸開
            doorL.style.transition = 'transform 0.3s ease-out';
            doorR.style.transition = 'transform 0.3s ease-out';
            doorL.style.transform = 'translateX(-150%)';
            doorR.style.transform = 'translateX(150%)';

            // 震動反饋
            if (navigator.vibrate) navigator.vibrate([100, 50, 200]);

            setTimeout(() => {
                doorWrap.style.display = 'none';
                cardEl.classList.add('gacha-card-revealed');
                cardEl.innerHTML = `<img src="${card.img}" class="gacha-card-front-img">`;

                SFX.play('gachaSSR');

                nameEl.textContent = `${card.title} ‧ ${card.name}`;
                rarityEl.textContent = card.rarity;
                rarityEl.className = 'rarity-ssr';
                nameEl.style.opacity = '1';
                rarityEl.style.opacity = '1';

                // 金色光柱
                const beam = document.createElement('div');
                beam.className = 'gacha-ssr-beam';
                screen.appendChild(beam);
                setTimeout(() => beam.remove(), 2000);

                // 金色粒子爆發
                for (let i = 0; i < 20; i++) {
                    const p = document.createElement('div');
                    p.className = 'gacha-ssr-particle';
                    p.style.setProperty('--angle', `${Math.random() * 360}deg`);
                    p.style.setProperty('--dist', `${80 + Math.random() * 120}px`);
                    p.style.setProperty('--delay', `${Math.random() * 0.3}s`);
                    p.style.setProperty('--size', `${3 + Math.random() * 5}px`);
                    screen.appendChild(p);
                    setTimeout(() => p.remove(), 1500);
                }

                // 卡片金色脈衝
                cardEl.classList.add('gacha-ssr-glow');
                setTimeout(() => cardEl.classList.remove('gacha-ssr-glow'), 2000);

                setTimeout(() => {
                    hint.textContent = gachaCurrentIndex < gachaAnimResults.length - 1 ? '點擊繼續' : '點擊查看結果';
                    hint.style.opacity = '0.6';
                }, 800);
            }, 300);
        }, 1200);

    } else if (isSR) {
        // === SR：紫色光環擴散 + 星光粒子 ===
        doorL.style.transition = 'transform 0.5s ease-out';
        doorR.style.transition = 'transform 0.5s ease-out';
        doorL.style.transform = 'translateX(-110%)';
        doorR.style.transform = 'translateX(110%)';

        setTimeout(() => {
            doorWrap.style.display = 'none';
            cardEl.classList.add('gacha-card-revealed');
            cardEl.innerHTML = `<img src="${card.img}" class="gacha-card-front-img">`;

            SFX.play('confirm');

            nameEl.textContent = `${card.title} ‧ ${card.name}`;
            rarityEl.textContent = card.rarity;
            rarityEl.className = 'rarity-sr';
            nameEl.style.opacity = '1';
            rarityEl.style.opacity = '1';

            // 紫色閃光
            const flash = document.createElement('div');
            flash.className = 'gacha-sr-flash';
            screen.appendChild(flash);
            setTimeout(() => flash.remove(), 600);

            // 紫色光環擴散
            const ring = document.createElement('div');
            ring.className = 'gacha-sr-ring';
            screen.appendChild(ring);
            setTimeout(() => ring.remove(), 1000);

            // 星光粒子
            for (let i = 0; i < 12; i++) {
                const s = document.createElement('div');
                s.className = 'gacha-sr-sparkle';
                s.style.setProperty('--angle', `${Math.random() * 360}deg`);
                s.style.setProperty('--dist', `${60 + Math.random() * 80}px`);
                s.style.setProperty('--delay', `${Math.random() * 0.4}s`);
                screen.appendChild(s);
                setTimeout(() => s.remove(), 1200);
            }

            // 卡片紫色脈衝
            cardEl.classList.add('gacha-sr-glow');
            setTimeout(() => cardEl.classList.remove('gacha-sr-glow'), 1500);

            setTimeout(() => {
                hint.textContent = gachaCurrentIndex < gachaAnimResults.length - 1 ? '點擊繼續' : '點擊查看結果';
                hint.style.opacity = '0.6';
            }, 600);
        }, 400);

    } else {
        // === R：普通開門 ===
        doorL.style.transition = 'transform 0.5s ease-out';
        doorR.style.transition = 'transform 0.5s ease-out';
        doorL.style.transform = 'translateX(-110%)';
        doorR.style.transform = 'translateX(110%)';

        setTimeout(() => {
            doorWrap.style.display = 'none';
            cardEl.classList.add('gacha-card-revealed');
            cardEl.innerHTML = `<img src="${card.img}" class="gacha-card-front-img">`;

            SFX.play('tap');

            nameEl.textContent = `${card.title} ‧ ${card.name}`;
            rarityEl.textContent = card.rarity;
            rarityEl.className = 'rarity-r';
            nameEl.style.opacity = '1';
            rarityEl.style.opacity = '1';

            setTimeout(() => {
                hint.textContent = gachaCurrentIndex < gachaAnimResults.length - 1 ? '點擊繼續' : '點擊查看結果';
                hint.style.opacity = '0.6';
            }, 600);
        }, 400);
    }
}

function skipToGachaResult() {
    const screen = document.getElementById('gacha-anim-screen');
    if (screen._gachaCleanup) screen._gachaCleanup();
    gachaCurrentIndex = gachaAnimResults.length;
    showGachaFinalResult();
}

function flipAllGachaCards() { skipToGachaResult(); }

function showGachaFinalResult() {
    const screen = document.getElementById('gacha-anim-screen');
    if (screen._gachaCleanup) screen._gachaCleanup();
    document.getElementById('gacha-skip-btn').classList.add('hidden');
    document.getElementById('gacha-pull-hint').style.opacity = '0';
    document.getElementById('gacha-card-stage').style.opacity = '0';
    document.getElementById('gacha-door-wrap').style.display = 'none';
    document.getElementById('gacha-counter').style.display = 'none';

    const reveal = document.getElementById('gacha-anim-reveal');
    const container = document.getElementById('gacha-reveal-cards');
    container.innerHTML = '';
    gachaAnimResults.forEach((card, i) => {
        const rc = card.rarity === 'SSR' ? 'ssr' : (card.rarity === 'SR' ? 'sr' : 'r');
        const div = document.createElement('div');
        div.className = `gacha-reveal-card ${rc}`;
        div.style.animationDelay = `${i * 0.08}s`;
        div.innerHTML = `<img src="${card.img}" alt="${card.name}"><span class="reveal-rarity">${card.rarity}</span>`;
        container.appendChild(div);
    });
    reveal.classList.remove('hidden');
}

function closeGachaAnim() {
    const screen = document.getElementById('gacha-anim-screen');
    if (screen._gachaCleanup) screen._gachaCleanup();
    screen.classList.add('hidden');
    document.getElementById('gacha-anim-reveal').classList.add('hidden');
    if (gachaParticleId) { cancelAnimationFrame(gachaParticleId); gachaParticleId = null; }
}

function closeGachaResult() {
    document.getElementById('gacha-result').classList.add('hidden');
}

// GM 測試用（之後移除）
function gmCheat() {
    const key = prompt('輸入 GM Key：');
    if (key === 'Qqaz78963...') {
        playerGems = 99999;
        playerGold = 9999999;
        skillBooks = { '人': 99, '神': 99, '魔': 99, '龍': 99, '獸': 99 };
        staminaPotions = 99;
        updateResources();
        saveGame();
        showToast('GM：全資源已灌滿');
    } else {
        showToast('Key 錯誤');
    }
}

let gachaParticleId = null;
function drawGachaParticles(isSSR) {
    const canvas = document.getElementById('gacha-anim-canvas');
    if (!canvas) return;
    const W = canvas.parentElement.clientWidth;
    const H = canvas.parentElement.clientHeight;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const pts = [];
    const color1 = isSSR ? 'rgba(255,215,0,' : 'rgba(150,120,255,';
    const color2 = isSSR ? 'rgba(255,180,50,' : 'rgba(100,80,200,';
    for (let i = 0; i < 60; i++) {
        pts.push({
            x: Math.random() * W, y: Math.random() * H,
            r: Math.random() * 2 + 0.5,
            dx: (Math.random() - 0.5) * 0.3,
            dy: -Math.random() * 0.5 - 0.2,
            a: Math.random() * 0.5 + 0.2,
            p: Math.random() * Math.PI * 2,
            c: Math.random() > 0.5 ? color1 : color2,
        });
    }
    function draw() {
        ctx.clearRect(0, 0, W, H);
        for (const p of pts) {
            p.x += p.dx; p.y += p.dy; p.p += 0.02;
            const alpha = p.a * (0.3 + 0.7 * Math.sin(p.p));
            if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
            ctx.fillStyle = p.c + alpha + ')';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        gachaParticleId = requestAnimationFrame(draw);
    }
    if (gachaParticleId) cancelAnimationFrame(gachaParticleId);
    draw();
}

// ===== 商城 =====
const SHOP_ITEMS = [
    { name: '紫珀原石 ×30', icon: '<img src="其他圖示/鑽石圖示.png" class="shop-icon-img">', price: 'NT$ 30', featured: true },
    { name: '紫珀原石 ×100', icon: '<img src="其他圖示/鑽石圖示.png" class="shop-icon-img">', price: 'NT$ 90', featured: true },
    { name: '紫珀原石 ×300', icon: '<img src="其他圖示/鑽石圖示.png" class="shop-icon-img">', price: 'NT$ 250', featured: false },
    { name: '體力回復', icon: '<img src="其他圖示/體力圖示.png" class="shop-icon-img">', price: '<img src="其他圖示/鑽石圖示.png" class="shop-price-img"> ×5', featured: false },
    { name: '金幣 ×10000', icon: '<img src="其他圖示/金幣圖示.png" class="shop-icon-img">', price: '<img src="其他圖示/鑽石圖示.png" class="shop-price-img"> ×10', featured: false },
];

function showShop() {
    SFX.play('pageOpen');
    const grid = document.getElementById('shop-grid');
    grid.innerHTML = '';
    document.getElementById('shop-gems').textContent = playerGems;
    document.getElementById('shop-gold').textContent = playerGold.toLocaleString();

    for (const item of SHOP_ITEMS) {
        grid.innerHTML += `
            <div class="shop-item ${item.featured ? 'featured' : ''}" onclick="buyItem('${item.name}')">
                <div class="shop-item-icon">${item.icon}</div>
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-price">${item.price}</div>
            </div>`;
    }
    document.getElementById('shop-screen').classList.remove('hidden');
}

function buyItem(name) {
    if (name === '體力回復') {
        if (playerGems < 5) { showToast('紫珀原石不足！'); SFX.play('error'); return; }
        playerGems -= 5;
        playerStamina = maxStamina;
        updateResources();
        saveGame();
        showToast('⚡ 體力已回滿！');
        SFX.play('confirm');
        document.getElementById('shop-gems').textContent = playerGems;
        document.getElementById('shop-gold').textContent = playerGold.toLocaleString();
    } else if (name === '金幣 ×10000') {
        if (playerGems < 10) { showToast('紫珀原石不足！'); SFX.play('error'); return; }
        playerGems -= 10;
        playerGold += 10000;
        updateResources();
        saveGame();
        showToast('獲得 10,000 金幣！');
        SFX.play('confirm');
        document.getElementById('shop-gems').textContent = playerGems;
        document.getElementById('shop-gold').textContent = playerGold.toLocaleString();
    } else {
        showToast(`${name} 購買功能開發中`);
    }
}

// ===== 背包 =====
let currentBagTab = 'cards';
let allBagCards = [];
let bagSortMode = 'time'; // 'time' | 'level' | 'element'
const imgCache = {};

// 圖片預載入
function preloadImages() {
    for (const c of CHARACTERS) {
        if (!imgCache[c.img]) {
            const img = new Image();
            img.src = c.img;
            imgCache[c.img] = img;
        }
    }
}
// 啟動時預載
setTimeout(preloadImages, 500);

function showBag() {
    SFX.play('pageOpen');
    // 背包爆滿檢查 — 強制擴充
    if (ownedCards.length > bagSlots) {
        showBagExpandPrompt();
        return;
    }
    openBagScreen();
}

function showBagExpandPrompt() {
    const cost = 50; // 紫珀原石擴充費用
    const expandAmount = 25;
    const overlay = document.createElement('div');
    overlay.id = 'bag-expand-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
        <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid rgba(255,215,0,0.3);border-radius:12px;padding:24px;max-width:300px;text-align:center;">
            <div style="font-size:16px;color:#ff6b6b;font-weight:bold;margin-bottom:12px;">⚠️ 背包已滿</div>
            <div style="font-size:13px;color:#ccc;margin-bottom:8px;">
                目前：<span style="color:#ff4757;">${ownedCards.length}</span> / ${bagSlots}
            </div>
            <div style="font-size:12px;color:#aaa;margin-bottom:16px;">
                需要擴充背包才能繼續使用<br>
                擴充 +${expandAmount} 格（花費 ${cost} <img src="其他圖示/鑽石圖示.png" style="width:14px;height:14px;vertical-align:middle;"> 紫珀原石）
            </div>
            <div style="display:flex;gap:10px;justify-content:center;">
                <button onclick="doBagExpand(${cost},${expandAmount})" style="padding:8px 20px;border:none;border-radius:6px;background:linear-gradient(135deg,#ffd700,#f0a500);color:#000;font-weight:bold;font-size:13px;cursor:pointer;">擴充背包</button>
                <button onclick="document.getElementById('bag-expand-overlay').remove()" style="padding:8px 20px;border:none;border-radius:6px;background:rgba(255,255,255,0.1);color:#aaa;font-size:13px;cursor:pointer;">取消</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

function doBagExpand(cost, amount) {
    const overlay = document.getElementById('bag-expand-overlay');
    if (playerGems < cost) {
        if (overlay) overlay.querySelector('div > div:first-child').textContent = '❌ 紫珀原石不足';
        return;
    }
    playerGems -= cost;
    bagSlots += amount;
    saveGame();
    updateResources();
    if (overlay) overlay.remove();
    // 擴充後如果還是滿的，再次提示
    if (ownedCards.length > bagSlots) {
        showBagExpandPrompt();
    } else {
        openBagScreen();
    }
}

function openBagScreen() {
    document.getElementById('bag-count').textContent = ownedCards.length;
    document.querySelector('#bag-screen .sub-gems').innerHTML = `<img src="其他圖示/背包圖示.png" style="width:20px;height:20px;object-fit:contain;vertical-align:middle;"> <span id="bag-count">${ownedCards.length}</span>/${bagSlots}`;
    document.getElementById('bag-gold').textContent = playerGold.toLocaleString();
    updateBagSortLabel();
    currentBagTab = 'cards';
    renderBag('cards');
    document.getElementById('bag-screen').classList.remove('hidden');
}

function cycleBagSort() {
    const modes = ['time', 'level', 'element', 'rarity'];
    const idx = modes.indexOf(bagSortMode);
    bagSortMode = modes[(idx + 1) % modes.length];
    updateBagSortLabel();
    renderBag(currentBagTab);
}

function updateBagSortLabel() {
    const labels = { time: '入手時間', level: '等級', element: '屬性', rarity: '稀有度' };
    const el = document.getElementById('bag-sort-btn');
    if (el) el.innerHTML = '<img src="其他圖示/排序圖示.png" class="topbar-res-img"> ' + labels[bagSortMode];
}

function switchBagTab(tab, el) {
    document.querySelectorAll('.bag-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    currentBagTab = tab;
    renderBag(tab);
}

function renderBag(tab) {
    const grid = document.getElementById('bag-grid');
    grid.innerHTML = '';
    const totalSlots = 25;

    if (tab === 'cards') {
        allBagCards = ownedCards.map((c, i) => ({ ...c, _ownIdx: i }));
        // 排序
        const elemOrder = ['fire','water','wood','earth','metal'];
        const rarityOrder = { 'SSR': 0, 'SR': 1, 'R': 2 };
        const rVal = (c) => rarityOrder[c.rarity || 'R'] ?? 2;
        if (bagSortMode === 'level') {
            allBagCards.sort((a, b) => {
                const lvDiff = (b.lv || 1) - (a.lv || 1);
                if (lvDiff !== 0) return lvDiff;
                return rVal(a) - rVal(b);
            });
        } else if (bagSortMode === 'element') {
            allBagCards.sort((a, b) => {
                const elDiff = elemOrder.indexOf(a.element) - elemOrder.indexOf(b.element);
                if (elDiff !== 0) return elDiff;
                return rVal(a) - rVal(b);
            });
        } else if (bagSortMode === 'rarity') {
            allBagCards.sort((a, b) => rVal(a) - rVal(b));
        }
        // 'time' = default ownedCards order (入手順)

        for (let i = 0; i < allBagCards.length; i++) {
            const c = allBagCards[i];
            const el = ELEMENTS[c.element];
            const rarity = (c.rarity || 'R').toLowerCase();
            const raceImg = c.race ? `其他圖示/種族圖示 — ${c.race}（64×64）.png` : '';
            const grade = c.enhanceGrade || 'C';
            const gradeIdx = ENHANCE_GRADES.indexOf(grade);
            const gradeColor = ENHANCE_COLORS[grade] || '#888';
            const isMaxLv = (c.lv || 1) >= (c.maxLv || 50);
            const isMaxGrade = gradeIdx >= ENHANCE_GRADES.length - 1;
            const isFullMax = isMaxLv && isMaxGrade;
            let gradeHtml = '';
            if (gradeIdx > 0) {
                gradeHtml = `<span class="bag-card-grade" style="color:${gradeColor};text-shadow:0 0 6px ${gradeColor};">${grade}</span>`;
            }
            let glowStyle = '';
            if (isFullMax) {
                glowStyle = `box-shadow:0 0 8px ${gradeColor},0 0 16px rgba(255,215,0,0.3);border-color:rgba(255,215,0,0.6);`;
            } else if (gradeIdx >= 3) {
                glowStyle = `box-shadow:0 0 6px ${gradeColor};border-color:${gradeColor};`;
            } else if (gradeIdx >= 1) {
                glowStyle = `border-color:${gradeColor};`;
            }
            const clickAction = batchSellMode ? `toggleBatchSelect(${i})` : `openCardDetail(${i})`;
            const isSelected = batchSellMode && batchSellSelected.has(c._ownIdx);
            const inTeam = batchSellMode && teamSlots.includes(c._ownIdx);
            const isCardLocked = c.locked || false;
            const cantSell = inTeam || isCardLocked;
            const sellOverlay = batchSellMode
                ? (cantSell ? '' : (isSelected ? '<div class="sell-check">✓</div>' : '<div class="sell-uncheck"></div>'))
                : '';
            const lockIcon = isCardLocked ? '<div class="bag-card-lock">🔒</div>' : '';
            grid.innerHTML += `
                <div class="bag-card ${rarity} ${isFullMax ? 'bag-card-fullmax' : ''} ${isSelected ? 'sell-selected' : ''}" onclick="${clickAction}" style="${glowStyle}${cantSell && batchSellMode ? 'opacity:0.35;' : ''}">
                    <img src="${c.img}" alt="${c.name}" loading="lazy" decoding="async">
                    <img class="bag-card-el" src="${el.orbImg}" alt="${el.name}">
                    <span class="bag-card-badge">${c.rarity || 'R'}</span>
                    <span class="bag-card-lv">Lv.${c.lv || 1}</span>
                    ${gradeHtml}
                    ${raceImg ? `<img class="bag-card-race" src="${raceImg}" alt="${c.race}">` : ''}
                    ${isFullMax ? '<div class="bag-card-maxshine"></div>' : ''}
                    ${lockIcon}
                    ${sellOverlay}
                </div>`;
        }
        for (let i = allBagCards.length; i < Math.max(totalSlots, allBagCards.length); i++) {
            if (i >= totalSlots && i >= allBagCards.length) break;
            if (i >= allBagCards.length) {
                grid.innerHTML += `<div class="bag-card-empty"></div>`;
            }
        }
    } else {
        const races = ['人', '神', '魔', '龍', '獸'];
        const raceImgs = { '人': '其他圖示/種族圖示 — 人（64×64）.png', '神': '其他圖示/種族圖示 — 神（64×64）.png', '魔': '其他圖示/種族圖示 — 魔（64×64）.png', '龍': '其他圖示/種族圖示 — 龍（64×64）.png', '獸': '其他圖示/種族圖示 — 獸（64×64）.png' };
        const items = races.map(r => ({ img: raceImgs[r], name: `${r}族技能書`, qty: skillBooks[r] || 0 }));
        items.push({ icon: '<img src="其他圖示/體力圖示.png" style="width:32px;height:32px;">', name: '體力藥水', qty: staminaPotions });
        for (const item of items) {
            grid.innerHTML += `
                <div class="bag-card" style="display:flex;align-items:center;justify-content:center;flex-direction:column;background:rgba(20,25,50,0.8);gap:4px;height:0;padding-bottom:133%;">
                    ${item.img ? `<img src="${item.img}" style="position:absolute;width:32px;height:32px;top:25%;left:50%;transform:translate(-50%,-50%);object-fit:contain;">` : `<span style="position:absolute;top:25%;left:50%;transform:translate(-50%,-50%);font-size:24px">${item.icon}</span>`}
                    <span style="position:absolute;bottom:20%;left:50%;transform:translateX(-50%);font-size:8px;color:#ccc;white-space:nowrap;">${item.name}</span>
                    <span style="position:absolute;bottom:8%;left:50%;transform:translateX(-50%);font-size:9px;color:#ffd700;font-weight:bold;">×${item.qty}</span>
                </div>`;
        }
        for (let i = items.length; i < totalSlots; i++) {
            grid.innerHTML += `<div class="bag-card-empty"></div>`;
        }
    }
}

// ===== 角色卡牌詳情 =====
let currentDetailCard = null;
let currentSkillTab = 'active';
let cdParticleId = null;

function openCardDetail(idx) {
    const c = allBagCards[idx];
    if (!c) return;
    currentDetailCard = c;
    currentSkillTab = 'active';

    const el = ELEMENTS[c.element];
    const rarity = c.rarity || 'R';
    const starCount = rarity === 'SSR' ? 6 : (rarity === 'SR' ? 5 : 4);
    let starsImgHtml = '';
    for (let si = 0; si < starCount; si++) {
        starsImgHtml += '<img src="其他圖示/星星圖示 — 亮星（32×32）.png" class="cd-star-img">';
    }

    document.getElementById('cd-element').innerHTML = `<img src="${el.orbImg}" alt="${el.name}">`;
    document.getElementById('cd-title').textContent = `${c.title} ‧ ${c.name}`;
    document.getElementById('cd-stars').innerHTML = starsImgHtml;
    document.getElementById('cd-lv').textContent = c.lv || 1;
    document.getElementById('cd-maxlv').textContent = c.maxLv || 99;
    document.getElementById('cd-hp').textContent = (c.hp || 0).toLocaleString();
    document.getElementById('cd-atk').textContent = (c.atk || 0).toLocaleString();
    document.getElementById('cd-rcv').textContent = (c.rcv || 0).toLocaleString();
    // 顯示強化加成
    const grade = c.enhanceGrade || 'C';
    const bonusPct = ENHANCE_BONUS[grade] || 0;
    const gradeColor = ENHANCE_COLORS[grade] || '#888';
    const bonusEl = document.getElementById('cd-grade-bonus');
    if (bonusEl) {
        if (bonusPct > 0) {
            bonusEl.innerHTML = `<span style="color:${gradeColor};font-weight:bold;">${grade}</span> <span style="color:${gradeColor};">全能力 +${(bonusPct * 100).toFixed(0)}%</span>`;
            bonusEl.style.display = '';
        } else {
            bonusEl.style.display = 'none';
        }
    }
    const raceImg = c.race ? `其他圖示/種族圖示 — ${c.race}（64×64）.png` : '';
    document.getElementById('cd-race').innerHTML = raceImg ? `<img src="${raceImg}" class="cd-race-img"> ${c.race}` : '未知';
    document.getElementById('cd-cost').textContent = c.cost || 0;
    document.getElementById('cd-id').textContent = `No. ${String((c._ownIdx != null ? c._ownIdx : idx) + 1).padStart(4, '0')}`;

    // 設定圖片（使用快取）
    const imgEl = document.getElementById('cd-img');
    if (imgCache[c.img] && imgCache[c.img].complete) {
        imgEl.src = imgCache[c.img].src;
    } else {
        imgEl.src = c.img;
    }
    imgEl.alt = c.name;

    // 稀有度光暈
    const glowEl = document.getElementById('cd-rarity-glow');
    glowEl.className = 'cd-rarity-glow';
    if (rarity === 'SSR') glowEl.classList.add('ssr-glow');
    else if (rarity === 'SR') glowEl.classList.add('sr-glow');
    else glowEl.classList.add('r-glow');

    // Reset skill tabs
    document.querySelectorAll('.cd-skill-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.cd-skill-tab').classList.add('active');
    renderSkillContent('active', c);

    // 更新強化按鈕
    updateEnhanceButtons(c);

    document.getElementById('card-detail-screen').classList.remove('hidden');

    // 強化等級視覺特效
    applyGradeEffect(c);

    // 啟動卡片詳情粒子特效
    initCardDetailParticles(el, rarity);
}

function closeCardDetail() {
    stopCardDetailParticles();
    // 清除強化特效
    const oldGradeEl = document.getElementById('cd-grade-effect');
    if (oldGradeEl) oldGradeEl.remove();
    const wrap = document.getElementById('cd-img-wrap');
    if (wrap) { wrap.className = 'card-detail-img-wrap'; wrap.style.cssText = ''; }
    closeSub('card-detail-screen');
}

function applyGradeEffect(card) {
    const grade = card.enhanceGrade || 'C';
    const gradeIdx = ENHANCE_GRADES.indexOf(grade);
    const wrap = document.getElementById('cd-img-wrap');
    if (!wrap) return;
    // 清除舊特效
    const oldEl = document.getElementById('cd-grade-effect');
    if (oldEl) oldEl.remove();
    wrap.className = 'card-detail-img-wrap';

    if (gradeIdx <= 0) return; // C級無特效

    const color = ENHANCE_COLORS[grade] || '#888';
    const isMax = gradeIdx >= ENHANCE_GRADES.length - 1;
    const lv = card.lv || 1;
    const maxLv = card.maxLv || 50;
    const isFullMax = isMax && lv >= maxLv;

    // 邊框光暈強度隨等級增加
    const glowSize = 4 + gradeIdx * 4;
    const glowAlpha = 0.15 + gradeIdx * 0.12;
    wrap.style.boxShadow = `0 0 ${glowSize}px rgba(${hexToRgb(color)},${glowAlpha}), 0 0 ${glowSize * 2}px rgba(${hexToRgb(color)},${glowAlpha * 0.4})`;
    wrap.style.borderBottom = `2px solid ${color}`;

    // 建立特效層
    let effectHtml = '<div id="cd-grade-effect" style="position:absolute;inset:0;pointer-events:none;z-index:4;overflow:hidden;">';

    // B級以上：角落光點
    if (gradeIdx >= 1) {
        effectHtml += `<div style="position:absolute;top:6px;right:6px;width:${6 + gradeIdx * 2}px;height:${6 + gradeIdx * 2}px;background:${color};border-radius:50%;filter:blur(3px);opacity:0.6;animation:gradeCornerPulse ${2.5 - gradeIdx * 0.2}s ease-in-out infinite;"></div>`;
    }

    // A級以上：底部光帶
    if (gradeIdx >= 2) {
        effectHtml += `<div style="position:absolute;bottom:0;left:0;right:0;height:${20 + gradeIdx * 8}%;background:linear-gradient(0deg,rgba(${hexToRgb(color)},${0.08 + gradeIdx * 0.04}),transparent);"></div>`;
    }

    // S級以上：光線掃過
    if (gradeIdx >= 3) {
        effectHtml += `<div style="position:absolute;top:-50%;left:-60%;width:40%;height:200%;background:linear-gradient(105deg,transparent 30%,rgba(${hexToRgb(color)},0.08) 48%,rgba(${hexToRgb(color)},0.15) 50%,rgba(${hexToRgb(color)},0.08) 52%,transparent 70%);transform:rotate(25deg);animation:gradeShimmer ${3.5 - gradeIdx * 0.3}s ease-in-out infinite;"></div>`;
    }

    // SS級以上：上方光粒子
    if (gradeIdx >= 4) {
        for (let i = 0; i < 6; i++) {
            const x = 10 + Math.random() * 80;
            const delay = Math.random() * 3;
            const size = 2 + Math.random() * 2;
            effectHtml += `<div style="position:absolute;bottom:10%;left:${x}%;width:${size}px;height:${size}px;background:${color};border-radius:50%;opacity:0;animation:gradeParticleRise 3s ${delay}s ease-out infinite;"></div>`;
        }
    }

    // SSS：全屏華麗光環 + 大量粒子
    if (gradeIdx >= 5 || isFullMax) {
        effectHtml += `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at center 60%,rgba(${hexToRgb(color)},0.25),transparent 65%);animation:gradeAuraPulse 2s ease-in-out infinite;"></div>`;
        effectHtml += `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at center 30%,rgba(${hexToRgb(color)},0.15),transparent 50%);animation:gradeAuraPulse 2.5s 0.5s ease-in-out infinite;"></div>`;
        for (let i = 0; i < 30; i++) {
            const x = 5 + Math.random() * 90;
            const delay = Math.random() * 4;
            const size = 2 + Math.random() * 3;
            effectHtml += `<div style="position:absolute;bottom:5%;left:${x}%;width:${size}px;height:${size}px;background:${color};border-radius:50%;opacity:0;filter:blur(0.5px);animation:gradeParticleRise 2.5s ${delay}s ease-out infinite;"></div>`;
        }
    }

    // 全滿（Lv MAX + SSS）：超華麗金色爆發
    if (isFullMax) {
        // 金色脈動光環（更大更亮）
        effectHtml += `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:180%;height:180%;border-radius:50%;background:radial-gradient(circle,rgba(255,215,0,0.18) 0%,rgba(255,215,0,0.08) 30%,transparent 55%);animation:gradeFullMaxPulse 1.8s ease-in-out infinite;"></div>`;
        // 第二層光環
        effectHtml += `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:120%;height:120%;border-radius:50%;background:radial-gradient(circle,rgba(255,200,50,0.12) 0%,transparent 50%);animation:gradeFullMaxPulse 2.4s 0.6s ease-in-out infinite;"></div>`;
        // 金色邊框呼吸（更強）
        effectHtml += `<div style="position:absolute;inset:-3px;border:2px solid rgba(255,215,0,0.5);border-radius:inherit;animation:gradeFullMaxBorder 2s ease-in-out infinite;"></div>`;
        // 頂部光暈
        effectHtml += `<div style="position:absolute;top:0;left:0;right:0;height:50%;background:linear-gradient(180deg,rgba(255,215,0,0.12),transparent);pointer-events:none;"></div>`;
        // 底部光暈
        effectHtml += `<div style="position:absolute;bottom:0;left:0;right:0;height:40%;background:linear-gradient(0deg,rgba(255,215,0,0.1),transparent);pointer-events:none;"></div>`;
        // 四角金色光點（更大）
        const corners = ['top:4px;left:4px','top:4px;right:4px','bottom:4px;left:4px','bottom:4px;right:4px'];
        corners.forEach((pos, ci) => {
            effectHtml += `<div style="position:absolute;${pos};width:8px;height:8px;background:#ffd700;border-radius:50%;filter:blur(3px);animation:gradeCornerPulse 2s ${ci * 0.4}s ease-in-out infinite;"></div>`;
        });
        // 光線掃過（金色）
        effectHtml += `<div style="position:absolute;top:-50%;left:-60%;width:40%;height:200%;background:linear-gradient(105deg,transparent 30%,rgba(255,215,0,0.12) 48%,rgba(255,255,200,0.2) 50%,rgba(255,215,0,0.12) 52%,transparent 70%);transform:rotate(25deg);animation:gradeShimmer 2.5s ease-in-out infinite;"></div>`;
        // 大量金色上升粒子（更多更大）
        for (let i = 0; i < 35; i++) {
            const x = Math.random() * 100;
            const delay = Math.random() * 5;
            const size = 2 + Math.random() * 4;
            const blur = Math.random() < 0.3 ? 'filter:blur(2px);' : 'filter:blur(1px);';
            effectHtml += `<div style="position:absolute;bottom:0;left:${x}%;width:${size}px;height:${size}px;background:#ffd700;border-radius:50%;opacity:0;${blur}animation:gradeParticleRise 3s ${delay}s ease-out infinite;"></div>`;
        }
        // 側邊火焰粒子
        for (let i = 0; i < 10; i++) {
            const y = 20 + Math.random() * 60;
            const delay = Math.random() * 4;
            const size = 2 + Math.random() * 2;
            const side = Math.random() < 0.5 ? 'left:2%' : 'right:2%';
            effectHtml += `<div style="position:absolute;top:${y}%;${side};width:${size}px;height:${size}px;background:rgba(255,180,50,0.9);border-radius:50%;opacity:0;filter:blur(1px);animation:gradeParticleRise 2.8s ${delay}s ease-out infinite;"></div>`;
        }
        // MAX 文字浮水印（更明顯）
        effectHtml += `<div style="position:absolute;bottom:15%;left:50%;transform:translateX(-50%);font-size:42px;font-weight:900;color:rgba(255,215,0,0.12);letter-spacing:10px;pointer-events:none;text-shadow:0 0 20px rgba(255,215,0,0.15);animation:gradeAuraPulse 3s ease-in-out infinite;">MAX</div>`;
    }

    effectHtml += '</div>';
    wrap.insertAdjacentHTML('beforeend', effectHtml);

    // 注入動畫 keyframes
    if (!document.getElementById('grade-effect-style')) {
        const style = document.createElement('style');
        style.id = 'grade-effect-style';
        style.textContent = `
@keyframes gradeCornerPulse { 0%,100%{opacity:0.4;transform:scale(1);} 50%{opacity:0.9;transform:scale(1.5);} }
@keyframes gradeShimmer { 0%,100%{left:-60%;opacity:0;} 10%{opacity:1;} 55%{left:130%;opacity:1;} 65%,100%{left:130%;opacity:0;} }
@keyframes gradeParticleRise { 0%{opacity:0;transform:translateY(0);} 15%{opacity:0.9;} 100%{opacity:0;transform:translateY(-180px);} }
@keyframes gradeAuraPulse { 0%,100%{opacity:0.4;} 50%{opacity:1;} }
@keyframes gradeFullMaxPulse { 0%,100%{opacity:0.3;transform:translate(-50%,-50%) scale(1);} 50%{opacity:0.7;transform:translate(-50%,-50%) scale(1.15);} }
@keyframes gradeFullMaxBorder { 0%,100%{border-color:rgba(255,215,0,0.15);box-shadow:0 0 8px rgba(255,215,0,0.1);} 50%{border-color:rgba(255,215,0,0.5);box-shadow:0 0 20px rgba(255,215,0,0.3);} }
        `;
        document.head.appendChild(style);
    }
}

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const r = parseInt(hex.substring(0,2), 16);
    const g = parseInt(hex.substring(2,4), 16);
    const b = parseInt(hex.substring(4,6), 16);
    return `${r},${g},${b}`;
}

// ===== 強化系統 UI =====
function updateEnhanceButtons(c) {
    ensureBaseStats(c);
    const rarity = c.rarity || 'R';
    const lv = c.lv || 1;
    const maxLv = c.maxLv || 50;
    const grade = c.enhanceGrade || 'C';
    const gradeColor = ENHANCE_COLORS[grade] || '#888';
    const race = c.race || '人';

    // 升級按鈕
    const lvBtn = document.getElementById('cd-lvup-btn');
    const lvCost = document.getElementById('cd-lvup-cost');
    if (lv >= maxLv) {
        lvBtn.disabled = true;
        lvCost.textContent = 'MAX';
    } else {
        const cost = LEVELUP_GOLD_BASE[rarity] * lv;
        lvBtn.disabled = false;
        lvCost.innerHTML = `<img src="其他圖示/金幣圖示.png" style="width:14px;height:14px;vertical-align:middle;"> ${cost.toLocaleString()}/${playerGold.toLocaleString()}`;
    }

    // 強化按鈕
    const gradeBtn = document.getElementById('cd-grade-btn');
    const gradeInfo = document.getElementById('cd-grade-info');
    const gradeIdx = ENHANCE_GRADES.indexOf(grade);
    if (lv < maxLv) {
        gradeBtn.disabled = true;
        gradeInfo.textContent = '需先升至滿等';
    } else if (gradeIdx >= ENHANCE_GRADES.length - 1) {
        gradeBtn.disabled = true;
        gradeInfo.innerHTML = `<span class="cd-grade-badge" style="background:${gradeColor};color:#000;">${grade}</span> MAX`;
    } else {
        const nextGrade = ENHANCE_GRADES[gradeIdx + 1];
        const cost = ENHANCE_GOLD[nextGrade];
        const bookCost = ENHANCE_BOOK_COST[nextGrade] || 1;
        const bookOwned = skillBooks[race] || 0;
        const rate = ENHANCE_SUCCESS_RATE[nextGrade] ?? 1.0;
        const rateText = rate < 1 ? ` (${(rate * 100).toFixed(1)}%)` : '';
        gradeBtn.disabled = false;
        gradeInfo.innerHTML = `<span class="cd-grade-badge" style="background:${gradeColor};color:#000;">${grade}</span> → ${nextGrade}${rateText}<br>📕${race}族書 ${bookOwned}/${bookCost}　🪙 ${cost.toLocaleString()}`;
    }

    // 最愛按鈕
    const favBtn = document.getElementById('cd-fav-btn');
    const favLabel = document.getElementById('cd-fav-label');
    const favInfo = document.getElementById('cd-fav-info');
    const isLocked = c.locked || false;
    if (isLocked) {
        favBtn.classList.add('is-locked');
        favLabel.textContent = '❤️ 已鎖定';
        favInfo.textContent = '點擊可解除鎖定';
    } else {
        favBtn.classList.remove('is-locked');
        favLabel.textContent = '加入最愛';
        favInfo.textContent = '鎖定後無法販售';
    }

    // 販售按鈕
    const sellBtn = document.getElementById('cd-sell-btn');
    const sellInfo = document.getElementById('cd-sell-info');
    const SELL_BOOK_REWARD = { SSR: 3, SR: 2, R: 1 };
    const bookReward = SELL_BOOK_REWARD[rarity] || 1;
    const inTeam = teamSlots.includes(c._ownIdx != null ? c._ownIdx : -999);
    if (isLocked) {
        sellBtn.disabled = true;
        sellInfo.textContent = '已鎖定，無法販售';
    } else if (inTeam) {
        sellBtn.disabled = true;
        sellInfo.textContent = '隊伍中的角色無法販售';
    } else {
        sellBtn.disabled = false;
        sellInfo.innerHTML = `可獲得 <img src="其他圖示/種族圖示 — ${race}（64×64）.png" style="width:16px;height:16px;vertical-align:middle;"> ${race}族技能書 ×${bookReward}`;
    }
}

function syncDetailToOwned() {
    if (!currentDetailCard || currentDetailCard._ownIdx == null) return;
    const idx = currentDetailCard._ownIdx;
    const copy = { ...currentDetailCard };
    delete copy._ownIdx;
    Object.assign(ownedCards[idx], copy);
}

function doLevelUp() {
    if (!currentDetailCard) return;
    const result = levelUpCard(currentDetailCard);
    if (!result.success) {
        showToast(result.msg);
        SFX.play('error');
        return;
    }
    SFX.play('confirm');
    syncDetailToOwned();
    saveGame();
    updateResources();
    refreshCardDetail();
}

function doEnhanceGrade() {
    if (!currentDetailCard) return;
    const result = enhanceCard(currentDetailCard);
    if (!result.success) {
        if (result.failed) {
            // 強化失敗但已扣資源
            SFX.play('error');
            showToast(result.msg);
            syncDetailToOwned();
            saveGame();
            updateResources();
            refreshCardDetail();
        } else {
            showToast(result.msg);
            SFX.play('error');
        }
        return;
    }
    SFX.play('confirm');
    const grade = result.grade;
    showToast(`強化成功！等級 → ${grade}`);
    // 強化特效
    showEnhanceEffect(grade);
    syncDetailToOwned();
    saveGame();
    updateResources();
    refreshCardDetail();
}

function refreshCardDetail() {
    if (!currentDetailCard) return;
    const c = currentDetailCard;
    document.getElementById('cd-lv').textContent = c.lv || 1;
    document.getElementById('cd-hp').textContent = (c.hp || 0).toLocaleString();
    document.getElementById('cd-atk').textContent = (c.atk || 0).toLocaleString();
    document.getElementById('cd-rcv').textContent = (c.rcv || 0).toLocaleString();
    updateEnhanceButtons(c);
}

// ===== 卡片鎖定（最愛）=====
function toggleCardLock() {
    if (!currentDetailCard) return;
    const c = currentDetailCard;
    c.locked = !c.locked;
    syncDetailToOwned();
    saveGame();
    updateEnhanceButtons(c);
    if (c.locked) {
        showToast('已鎖定！此卡片無法被販售');
        SFX.play('confirm');
    } else {
        showToast('已解除鎖定');
        SFX.play('confirm');
    }
}

// ===== 販售卡片 =====
const SELL_BOOK_REWARD = { SSR: 3, SR: 2, R: 1 };

function doSellCard() {
    if (!currentDetailCard) return;
    const c = currentDetailCard;
    const ownIdx = c._ownIdx;
    if (ownIdx == null || ownIdx < 0) return;

    // 不能賣鎖定的角色
    if (c.locked) {
        showToast('此卡片已鎖定，請先解除鎖定');
        SFX.play('error');
        return;
    }

    // 不能賣隊伍中的角色
    if (teamSlots.includes(ownIdx)) {
        showToast('隊伍中的角色無法販售');
        SFX.play('error');
        return;
    }

    // 只剩一張卡不能賣
    if (ownedCards.length <= 1) {
        showToast('至少需保留一張角色');
        SFX.play('error');
        return;
    }

    const rarity = c.rarity || 'R';
    const race = c.race || '人';
    const bookReward = SELL_BOOK_REWARD[rarity] || 1;

    // 顯示遊戲內確認對話框
    const cardPreview = document.getElementById('sell-confirm-card');
    cardPreview.innerHTML = `
        <img src="${c.img}" alt="${c.name}">
        <div class="sell-confirm-card-info">
            <div class="sell-confirm-card-name">${c.title || ''} ‧ ${c.name}</div>
            <div class="sell-confirm-card-sub">${rarity}　${race}族　Lv.${c.lv || 1}</div>
        </div>`;
    document.getElementById('sell-confirm-reward').innerHTML =
        `可獲得 <img src="其他圖示/種族圖示 — ${race}（64×64）.png" style="width:20px;height:20px;vertical-align:middle;"> ${race}族技能書 ×${bookReward}`;
    document.getElementById('sell-confirm-dialog').classList.remove('hidden');
    SFX.play('confirm');
}

function confirmSellCard() {
    if (!currentDetailCard) return;
    const c = currentDetailCard;
    const ownIdx = c._ownIdx;
    if (ownIdx == null || ownIdx < 0) return;

    const rarity = c.rarity || 'R';
    const race = c.race || '人';
    const bookReward = SELL_BOOK_REWARD[rarity] || 1;

    // 給予技能書
    skillBooks[race] = (skillBooks[race] || 0) + bookReward;

    // 從 ownedCards 移除
    ownedCards.splice(ownIdx, 1);

    // 修正 teamSlots 索引（被刪除的索引之後的都要 -1）
    for (let i = 0; i < teamSlots.length; i++) {
        if (teamSlots[i] > ownIdx) {
            teamSlots[i]--;
        }
    }

    // 修正 favoriteCard 索引
    if (typeof favoriteCard !== 'undefined' && favoriteCard !== null) {
        if (favoriteCard === ownIdx) {
            favoriteCard = 0;
        } else if (favoriteCard > ownIdx) {
            favoriteCard--;
        }
    }

    SFX.play('confirm');
    showToast(`販售成功！獲得 ${race}族技能書 ×${bookReward}`);
    document.getElementById('sell-confirm-dialog').classList.add('hidden');
    saveGame();
    updateResources();

    // 關閉卡片詳情，回到背包
    currentDetailCard = null;
    closeCardDetail();
    renderBag();
}

function cancelSellCard() {
    document.getElementById('sell-confirm-dialog').classList.add('hidden');
}

// ===== 批量販售 =====
let batchSellMode = false;
let batchSellSelected = new Set(); // stores _ownIdx values

function toggleBatchSellMode() {
    if (currentBagTab !== 'cards') {
        showToast('請先切換到角色頁籤');
        return;
    }
    batchSellMode = !batchSellMode;
    batchSellSelected.clear();
    const toggle = document.getElementById('bag-sell-toggle');
    const bar = document.getElementById('bag-batch-bar');
    if (batchSellMode) {
        toggle.classList.add('active');
        bar.classList.remove('hidden');
    } else {
        toggle.classList.remove('active');
        bar.classList.add('hidden');
    }
    updateBatchSellInfo();
    renderBag('cards');
}

let _batchLastClick = { bagIdx: -1, time: 0 };

function toggleBatchSelect(bagIdx) {
    const c = allBagCards[bagIdx];
    if (!c || c._ownIdx == null) return;
    // 不能選隊伍中或已鎖定的角色
    if (teamSlots.includes(c._ownIdx)) {
        showToast('隊伍中的角色無法販售');
        SFX.play('error');
        return;
    }
    if (c.locked) {
        showToast('已鎖定的角色無法販售');
        SFX.play('error');
        return;
    }

    // 雙擊偵測：同一張卡 400ms 內點兩次 → 全選同名卡
    const now = Date.now();
    if (_batchLastClick.bagIdx === bagIdx && now - _batchLastClick.time < 400) {
        _batchLastClick = { bagIdx: -1, time: 0 };
        // 找出所有同名卡（不在隊伍中且未鎖定的）
        const targetName = c.name;
        let addedCount = 0;
        for (let i = 0; i < allBagCards.length; i++) {
            const card = allBagCards[i];
            if (card.name === targetName && !teamSlots.includes(card._ownIdx) && !card.locked) {
                const remaining = ownedCards.length - batchSellSelected.size;
                if (remaining <= 1) break;
                if (!batchSellSelected.has(card._ownIdx)) {
                    batchSellSelected.add(card._ownIdx);
                    addedCount++;
                }
            }
        }
        if (addedCount > 0) {
            showToast(`已全選 ${targetName} 共 ${batchSellSelected.size} 張（同名）`);
        }
        updateBatchSellInfo();
        renderBag('cards');
        return;
    }
    _batchLastClick = { bagIdx, time: now };

    if (batchSellSelected.has(c._ownIdx)) {
        batchSellSelected.delete(c._ownIdx);
    } else {
        // 至少保留一張卡
        const remaining = ownedCards.length - batchSellSelected.size;
        if (remaining <= 1) {
            showToast('至少需保留一張角色');
            SFX.play('error');
            return;
        }
        batchSellSelected.add(c._ownIdx);
    }
    updateBatchSellInfo();
    renderBag('cards');
}

function updateBatchSellInfo() {
    const info = document.getElementById('bag-batch-info');
    const btn = document.getElementById('bag-batch-confirm');
    const count = batchSellSelected.size;
    if (count === 0) {
        info.textContent = '已選 0 張（點擊卡片選取）';
        btn.disabled = true;
        return;
    }
    // 計算獎勵預覽
    const rewards = {};
    for (const ownIdx of batchSellSelected) {
        const c = ownedCards[ownIdx];
        if (!c) continue;
        const race = c.race || '人';
        const rarity = c.rarity || 'R';
        const bookReward = SELL_BOOK_REWARD[rarity] || 1;
        rewards[race] = (rewards[race] || 0) + bookReward;
    }
    let rewardText = Object.entries(rewards).map(([race, qty]) =>
        `${race}族書×${qty}`
    ).join('、');
    info.innerHTML = `已選 <span style="color:#ff6b81;font-weight:bold;">${count}</span> 張　→　${rewardText}`;
    btn.disabled = false;
}

function doBatchSell() {
    const count = batchSellSelected.size;
    if (count === 0) return;

    // 計算獎勵
    const rewards = {};
    for (const ownIdx of batchSellSelected) {
        const c = ownedCards[ownIdx];
        if (!c) continue;
        const race = c.race || '人';
        const rarity = c.rarity || 'R';
        const bookReward = SELL_BOOK_REWARD[rarity] || 1;
        rewards[race] = (rewards[race] || 0) + bookReward;
    }

    let rewardText = Object.entries(rewards).map(([race, qty]) =>
        `${race}族技能書 ×${qty}`
    ).join('、');

    if (!confirm(`確定販售 ${count} 張角色？\n可獲得：${rewardText}`)) return;

    // 給予獎勵
    for (const [race, qty] of Object.entries(rewards)) {
        skillBooks[race] = (skillBooks[race] || 0) + qty;
    }

    // 從大到小排序要刪除的索引，避免刪除時索引偏移
    const sortedIdxs = [...batchSellSelected].sort((a, b) => b - a);
    for (const idx of sortedIdxs) {
        ownedCards.splice(idx, 1);
        // 修正 teamSlots 索引
        for (let i = 0; i < teamSlots.length; i++) {
            if (teamSlots[i] > idx) teamSlots[i]--;
        }
        // 修正 favoriteCard 索引
        if (typeof favoriteCard !== 'undefined' && favoriteCard !== null) {
            if (favoriteCard === idx) {
                favoriteCard = 0;
            } else if (favoriteCard > idx) {
                favoriteCard--;
            }
        }
    }

    SFX.play('confirm');
    showToast(`販售成功！獲得 ${rewardText}`);

    batchSellSelected.clear();
    batchSellMode = false;
    document.getElementById('bag-sell-toggle').classList.remove('active');
    document.getElementById('bag-batch-bar').classList.add('hidden');

    saveGame();
    updateResources();
    document.getElementById('bag-count').textContent = ownedCards.length;
    document.querySelector('#bag-screen .sub-gems').innerHTML = `<img src="其他圖示/背包圖示.png" style="width:20px;height:20px;object-fit:contain;vertical-align:middle;"> <span id="bag-count">${ownedCards.length}</span>/${bagSlots}`;
    renderBag('cards');
}

function cancelBatchSell() {
    batchSellMode = false;
    batchSellSelected.clear();
    document.getElementById('bag-sell-toggle').classList.remove('active');
    document.getElementById('bag-batch-bar').classList.add('hidden');
    renderBag('cards');
}

function showEnhanceEffect(grade) {
    const screen = document.getElementById('card-detail-screen');
    if (!screen) return;
    const flash = document.createElement('div');
    const color = ENHANCE_COLORS[grade] || '#fff';
    const isHigh = ['S', 'SS', 'SSS'].includes(grade);
    flash.style.cssText = `position:absolute;inset:0;z-index:100;pointer-events:none;
        background:radial-gradient(circle, ${color}44 0%, transparent 70%);
        animation: enhanceFlash ${isHigh ? '0.8s' : '0.5s'} ease-out forwards;`;
    screen.appendChild(flash);
    setTimeout(() => flash.remove(), isHigh ? 800 : 500);

    if (isHigh) {
        // 高等級強化震動
        screen.style.animation = 'none';
        screen.offsetHeight;
        screen.style.animation = 'enhanceShake 0.4s ease-out';
        setTimeout(() => screen.style.animation = '', 400);
    }
}

// 卡片詳情粒子特效
function initCardDetailParticles(element, rarity) {
    stopCardDetailParticles();
    const canvas = document.getElementById('cd-particles');
    if (!canvas) return;
    const screen = document.getElementById('card-detail-screen');
    canvas.width = screen.clientWidth;
    canvas.height = screen.clientHeight;
    const ctx = canvas.getContext('2d');
    const pts = [];

    // 屬性色粒子
    const elColor = element.color;
    const particleCount = rarity === 'SSR' ? 50 : (rarity === 'SR' ? 35 : 20);

    // 上飄光塵
    for (let i = 0; i < particleCount; i++) {
        const isGold = rarity === 'SSR' && Math.random() < 0.4;
        pts.push({
            type: 'dust',
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.8 + 0.3,
            dy: -Math.random() * 0.4 - 0.1,
            dx: (Math.random() - 0.5) * 0.2,
            a: Math.random() * 0.5 + 0.15,
            p: Math.random() * Math.PI * 2,
            color: isGold ? `hsl(${40 + Math.random() * 15}, 100%, ${65 + Math.random() * 15}%)` : elColor,
        });
    }

    // SSR 專屬：流光線條
    if (rarity === 'SSR') {
        for (let i = 0; i < 4; i++) {
            pts.push({
                type: 'streak',
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height * 0.4,
                len: Math.random() * 50 + 30,
                speed: Math.random() * 1.2 + 0.8,
                angle: Math.PI * 0.65 + Math.random() * 0.3,
                a: 0, life: Math.random() * 180 + 80, maxLife: 0,
                color: `hsl(${40 + Math.random() * 20}, 90%, 70%)`,
            });
            pts[pts.length - 1].maxLife = pts[pts.length - 1].life;
        }
    }

    // 大光暈
    if (rarity !== 'R') {
        for (let i = 0; i < 3; i++) {
            pts.push({
                type: 'glow',
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height * 0.5,
                r: Math.random() * 60 + 30,
                dx: (Math.random() - 0.5) * 0.1,
                dy: (Math.random() - 0.5) * 0.1,
                a: Math.random() * 0.04 + 0.01,
                color: rarity === 'SSR' ? '#ffd700' : '#c77dff',
                p: Math.random() * Math.PI * 2,
            });
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of pts) {
            if (p.type === 'dust') {
                p.x += p.dx; p.y += p.dy; p.p += 0.02;
                const alpha = p.a * (0.3 + 0.7 * Math.sin(p.p));
                if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
                if (p.x < -5) p.x = canvas.width + 5;
                if (p.x > canvas.width + 5) p.x = -5;
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else if (p.type === 'streak') {
                p.life--;
                if (p.life <= 0) {
                    p.x = Math.random() * canvas.width;
                    p.y = -20;
                    p.life = Math.random() * 180 + 80;
                    p.maxLife = p.life;
                }
                const progress = 1 - p.life / p.maxLife;
                p.a = progress < 0.1 ? progress / 0.1 : (progress > 0.7 ? (1 - progress) / 0.3 : 1);
                p.a *= 0.3;
                p.x += Math.cos(p.angle) * p.speed;
                p.y += Math.sin(p.angle) * p.speed;
                ctx.save();
                ctx.globalAlpha = p.a;
                const grad = ctx.createLinearGradient(p.x, p.y, p.x - Math.cos(p.angle) * p.len, p.y - Math.sin(p.angle) * p.len);
                grad.addColorStop(0, p.color);
                grad.addColorStop(1, 'transparent');
                ctx.strokeStyle = grad;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - Math.cos(p.angle) * p.len, p.y - Math.sin(p.angle) * p.len);
                ctx.stroke();
                ctx.restore();
            } else if (p.type === 'glow') {
                p.x += p.dx; p.y += p.dy; p.p += 0.008;
                const a = p.a * (0.5 + 0.5 * Math.sin(p.p));
                if (p.x < -p.r) p.x = canvas.width + p.r;
                if (p.x > canvas.width + p.r) p.x = -p.r;
                if (p.y < -p.r) p.y = canvas.height + p.r;
                if (p.y > canvas.height + p.r) p.y = -p.r;
                ctx.save();
                ctx.globalAlpha = a;
                const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
                grad.addColorStop(0, p.color);
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
        cdParticleId = requestAnimationFrame(draw);
    }
    draw();
}

function stopCardDetailParticles() {
    if (cdParticleId) {
        cancelAnimationFrame(cdParticleId);
        cdParticleId = null;
    }
    const canvas = document.getElementById('cd-particles');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function switchSkillTab(tab, el) {
    document.querySelectorAll('.cd-skill-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    currentSkillTab = tab;
    if (currentDetailCard) renderSkillContent(tab, currentDetailCard);
}

function renderSkillContent(tab, card) {
    const container = document.getElementById('cd-skill-content');
    let html = '';

    if (tab === 'active' && card.activeSkill) {
        const sk = card.activeSkill;
        html = `<div class="cd-skill-name">${sk.name}<span class="cd-skill-cd">CD: ${sk.cd}</span></div>
<span class="cd-skill-slv">技能 Lv.1</span>
<div style="margin-top:10px">${sk.desc}</div>`;
    } else if (tab === 'leader' && card.leaderSkill) {
        const sk = card.leaderSkill;
        html = `<div class="cd-skill-name">${sk.name}</div>
<div style="margin-top:8px">${sk.desc}</div>`;
    } else if (tab === 'team' && card.teamSkill) {
        const sk = card.teamSkill;
        html = `<div class="cd-skill-name">${sk.name}</div>
<div style="margin-top:8px">${sk.desc}</div>`;
    } else if (tab === 'bond' && card.bond) {
        const sk = card.bond;
        html = `<div class="cd-skill-name">${sk.name}</div>
<div style="margin-top:8px">${sk.desc}</div>`;
    } else {
        html = '<div style="color:#666;text-align:center;margin-top:20px;">尚未解鎖</div>';
    }

    container.innerHTML = html;
}

// ===== 隊伍編輯（神魔之塔風格） =====
let teamSlots = [0, -1, -1, -1, -1];
let selectedTeamSlotIdx = -1;
let teamEditFilter = 'all'; // all, fire, water, wood, earth, metal
let teamEditRaceFilter = 'all'; // all, 人, 神, 魔, 龍, 獸

function showTeamEdit() {
    // Remove old screen without resetting selection
    const oldEl = document.getElementById('team-edit-screen');
    if (oldEl) oldEl.remove();
    const allCards = ownedCards;
    const leader = teamSlots[0] >= 0 ? allCards[teamSlots[0]] : null;
    const leaderSkillText = leader?.leaderSkill?.desc || '無';

    // 計算隊伍屬性統計
    const elStats = { fire: { hp: 0, atk: 0, rcv: 0 }, water: { hp: 0, atk: 0, rcv: 0 }, wood: { hp: 0, atk: 0, rcv: 0 }, earth: { hp: 0, atk: 0, rcv: 0 }, metal: { hp: 0, atk: 0, rcv: 0 } };
    let totalHp = 0, totalAtk = 0, totalRcv = 0, totalCost = 0;
    for (const idx of teamSlots) {
        if (idx < 0) continue;
        const c = allCards[idx];
        if (!c) continue;
        totalHp += c.hp; totalAtk += c.atk; totalRcv += (c.rcv || 0); totalCost += (c.cost || 0);
        if (elStats[c.element]) { elStats[c.element].hp += c.hp; elStats[c.element].atk += c.atk; elStats[c.element].rcv += (c.rcv || 0); }
    }
    const costColor = totalCost > teamCost ? '#ff4757' : '#7bed9f';

    let html = '<div class="te-screen" id="team-edit-screen">';
    // 頂部
    html += '<div class="te-header"><button class="back-btn" onclick="closeTeamEdit()">← 返回</button><div class="te-title">隊伍編輯</div><div class="te-cost-badge" style="color:' + costColor + '">📦 ' + totalCost + '/' + teamCost + '</div></div>';

    // 隊伍卡槽
    html += '<div class="te-slots-area">';
    for (let i = 0; i < 5; i++) {
        const cardIdx = teamSlots[i];
        const c = cardIdx >= 0 ? allCards[cardIdx] : null;
        const isSelected = selectedTeamSlotIdx === i;
        if (c) {
            const el = ELEMENTS[c.element];
            const rarity = (c.rarity || 'R').toLowerCase();
            html += `<div class="te-slot ${isSelected ? 'te-slot-selected' : ''} te-slot-${rarity}" onclick="selectTeamSlot(${i})">`;
            html += `<img src="${c.img}" alt="${c.name}">`;
            html += `<span class="te-slot-el" style="background:${el.darkColor}88;"><img src="${el.orbImg}" alt="${el.name}" style="width:16px;height:16px;"></span>`;
            html += `<span class="te-slot-lv">Lv.${c.lv || 1}</span>`;
            if (i === 0) html += '<span class="te-slot-leader">隊長</span>';
            if (isSelected) html += '<div class="te-slot-glow"></div>';
            html += '</div>';
        } else {
            html += `<div class="te-slot te-slot-empty ${isSelected ? 'te-slot-selected' : ''}" onclick="selectTeamSlot(${i})">`;
            html += '<div class="te-slot-plus">+</div>';
            if (isSelected) html += '<div class="te-slot-glow"></div>';
            html += '</div>';
        }
    }
    html += '</div>';

    // 操作按鈕列
    html += '<div class="te-action-bar">';
    html += '<button class="te-action-btn" onclick="clearTeamSlot()">移除角色</button>';
    html += '<button class="te-action-btn te-action-danger" onclick="clearAllTeamSlots()">清空隊伍</button>';
    html += '</div>';

    // 隊長技顯示
    html += '<div class="te-leader-skill">';
    html += `<span class="te-ls-label">隊長技</span>`;
    html += `<span class="te-ls-name">${leader?.leaderSkill?.name || '無'}</span>`;
    html += `<div class="te-ls-desc">${leaderSkillText}</div>`;
    html += '</div>';

    // 隊伍總計
    html += '<div class="te-stats-bar">';
    html += `<div class="te-stat"><span class="te-stat-icon"><img src="其他圖示/生命力圖示（64×64）.png" class="te-stat-img"></span><span class="te-stat-val">${totalHp.toLocaleString()}</span></div>`;
    html += `<div class="te-stat"><span class="te-stat-icon"><img src="其他圖示/攻擊力圖示（64×64）.png" class="te-stat-img"></span><span class="te-stat-val">${totalAtk.toLocaleString()}</span></div>`;
    html += `<div class="te-stat"><span class="te-stat-icon"><img src="其他圖示/回復力圖示（64×64）.png" class="te-stat-img"></span><span class="te-stat-val">${totalRcv.toLocaleString()}</span></div>`;
    html += '</div>';

    // 屬性分佈條
    const elOrder = ['fire','water','wood','earth','metal'];
    const elColors = { fire:'#ff4757', water:'#3742fa', wood:'#2ed573', earth:'#ffa502', metal:'#dfe6e9' };
    html += '<div class="te-el-bar">';
    for (const e of elOrder) {
        const pct = totalAtk > 0 ? Math.round((elStats[e].atk / totalAtk) * 100) : 0;
        if (pct > 0) html += `<div class="te-el-seg" style="width:${pct}%;background:${elColors[e]};" title="${ELEMENTS[e].name} ${pct}%"></div>`;
    }
    html += '</div>';

    // 提示
    if (selectedTeamSlotIdx >= 0) {
        html += `<div class="te-hint te-hint-active">▼ 選擇角色替換第 ${selectedTeamSlotIdx + 1} 位 ▼</div>`;
    } else {
        html += '<div class="te-hint">點擊上方位置，再選擇下方角色替換</div>';
    }

    // 篩選按鈕 — 屬性
    html += '<div class="te-filter-bar">';
    const filters = [['all','全部'],['fire','<img src="五行珠/火.png" class="te-filter-orb">'],['water','<img src="五行珠/水.png" class="te-filter-orb">'],['wood','<img src="五行珠/木.png" class="te-filter-orb">'],['earth','<img src="五行珠/土.png" class="te-filter-orb">'],['metal','<img src="五行珠/金.png" class="te-filter-orb">']];
    for (const [fk, fl] of filters) {
        html += `<button class="te-filter-btn ${teamEditFilter === fk ? 'te-filter-active' : ''}" onclick="setTeamFilter('${fk}')">${fl}</button>`;
    }
    html += '</div>';

    // 篩選按鈕 — 種族
    html += '<div class="te-filter-bar">';
    const raceFilters = [['all','全部'],['人','<img src="其他圖示/種族圖示 — 人（64×64）.png" class="te-filter-orb">'],['神','<img src="其他圖示/種族圖示 — 神（64×64）.png" class="te-filter-orb">'],['魔','<img src="其他圖示/種族圖示 — 魔（64×64）.png" class="te-filter-orb">'],['龍','<img src="其他圖示/種族圖示 — 龍（64×64）.png" class="te-filter-orb">'],['獸','<img src="其他圖示/種族圖示 — 獸（64×64）.png" class="te-filter-orb">']];
    for (const [rk, rl] of raceFilters) {
        html += `<button class="te-filter-btn ${teamEditRaceFilter === rk ? 'te-filter-active' : ''}" onclick="setTeamRaceFilter('${rk}')">${rl}</button>`;
    }
    html += '</div>';

    // 可選角色列表
    html += '<div class="te-card-list">';
    for (let i = 0; i < allCards.length; i++) {
        const c = allCards[i];
        if (teamEditFilter !== 'all' && c.element !== teamEditFilter) continue;
        if (teamEditRaceFilter !== 'all' && c.race !== teamEditRaceFilter) continue;
        const el = ELEMENTS[c.element];
        const inTeam = teamSlots.includes(i);
        const rarity = (c.rarity || 'R').toLowerCase();
        html += `<div class="te-card ${inTeam ? 'te-card-inteam' : ''} te-card-${rarity}" onclick="pickTeamCard(${i})">`;
        html += `<img src="${c.img}" alt="${c.name}" loading="lazy">`;
        html += `<span class="te-card-el"><img src="${el.orbImg}" alt="${el.name}" style="width:16px;height:16px;"></span>`;
        html += `<span class="te-card-rarity">${c.rarity || 'R'}</span>`;
        if (c.race) html += `<img class="te-card-race" src="其他圖示/種族圖示 — ${c.race}（64×64）.png" alt="${c.race}">`;
        html += `<div class="te-card-bottom"><span class="te-card-name">${c.name}</span><span class="te-card-info">Lv.${c.lv || 1} | 📦${c.cost || 0}</span></div>`;
        if (inTeam) html += '<div class="te-card-check">✓</div>';
        html += '</div>';
    }
    html += '</div></div>';
    document.getElementById('lobby-screen').insertAdjacentHTML('beforeend', html);
}

function setTeamFilter(f) {
    teamEditFilter = f;
    showTeamEdit();
}

function setTeamRaceFilter(r) {
    teamEditRaceFilter = r;
    showTeamEdit();
}

function selectTeamSlot(slotIdx) {
    selectedTeamSlotIdx = slotIdx;
    SFX.play('tap');
    showTeamEdit();
}

function pickTeamCard(cardIdx) {
    if (selectedTeamSlotIdx < 0) { showToast('請先點擊上方隊伍位置'); return; }
    const allCards = ownedCards;
    const oldSlots = [...teamSlots];
    // If this card is already in another slot, swap
    const existingSlot = teamSlots.indexOf(cardIdx);
    if (existingSlot >= 0 && existingSlot !== selectedTeamSlotIdx) {
        teamSlots[existingSlot] = teamSlots[selectedTeamSlotIdx];
    }
    teamSlots[selectedTeamSlotIdx] = cardIdx;
    // Check cost (only count filled slots)
    const totalCost = teamSlots.reduce((s, idx) => {
        if (idx < 0) return s;
        return s + ((allCards[idx] || {}).cost || 0);
    }, 0);
    if (totalCost > teamCost) {
        for (let i = 0; i < 5; i++) teamSlots[i] = oldSlots[i];
        showToast(`隊伍空間不足！(${totalCost}/${teamCost})`);
        SFX.play('error');
        return;
    }
    SFX.play('confirm');
    selectedTeamSlotIdx = -1;
    saveGame();
    trackRookieQuest('editTeam');
    showTeamEdit();
}

function clearTeamSlot() {
    if (selectedTeamSlotIdx < 0) { showToast('請先選擇要移除的位置'); return; }
    // Must keep at least 1 member
    const filledCount = teamSlots.filter(s => s >= 0).length;
    if (filledCount <= 1 && teamSlots[selectedTeamSlotIdx] >= 0) {
        showToast('隊伍至少需要 1 名角色');
        SFX.play('error');
        return;
    }
    teamSlots[selectedTeamSlotIdx] = -1;
    selectedTeamSlotIdx = -1;
    SFX.play('confirm');
    saveGame();
    showTeamEdit();
}

function clearAllTeamSlots() {
    // Keep only the leader (slot 0)
    for (let i = 1; i < 5; i++) teamSlots[i] = -1;
    selectedTeamSlotIdx = -1;
    SFX.play('confirm');
    saveGame();
    showToast('已清空隊伍（保留隊長）');
    showTeamEdit();
}

function closeTeamEdit() {
    selectedTeamSlotIdx = -1;
    const el = document.getElementById('team-edit-screen');
    if (el) el.remove();
}

// ===== 設定 =====
function showSettings() {
    let html = '<div style="position:absolute;inset:0;z-index:200;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;" id="settings-screen">';
    html += '<div style="padding:14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,215,0,0.1);"><button class="back-btn" onclick="closeSettings()">← 返回</button><div style="font-size:16px;font-weight:bold;letter-spacing:3px;color:#ffd700;">設定</div><div style="width:50px;"></div></div>';
    html += '<div style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:16px;touch-action:pan-y;">';

    // 音量設定
    html += `<div style="background:linear-gradient(135deg,rgba(18,22,45,0.95),rgba(12,14,30,0.98));border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:16px;">`;
    html += `<div style="font-size:14px;font-weight:bold;color:#eee;letter-spacing:2px;margin-bottom:12px;">🔊 音量設定</div>`;
    html += `<div style="margin-bottom:10px;"><div style="font-size:11px;color:#888;margin-bottom:4px;">背景音樂 <span id="bgm-vol-label">${Math.round(SFX.bgmVolume * 100)}%</span></div><input type="range" min="0" max="100" value="${SFX.bgmVolume * 100}" oninput="SFX.bgmVolume=this.value/100;document.getElementById('bgm-vol-label').textContent=this.value+'%'" style="width:100%;accent-color:#ffd700;"></div>`;
    html += `<div><div style="font-size:11px;color:#888;margin-bottom:4px;">音效 <span id="sfx-vol-label">${Math.round(SFX.sfxVolume * 100)}%</span></div><input type="range" min="0" max="100" value="${SFX.sfxVolume * 100}" oninput="SFX.sfxVolume=this.value/100;document.getElementById('sfx-vol-label').textContent=this.value+'%'" style="width:100%;accent-color:#ffd700;"></div>`;
    html += '</div>';

    // 帳號資訊
    const authUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const bindText = authUser ? `已綁定（${authUser.email || authUser.uid}）` : '未綁定（訪客模式）';
    const bindColor = authUser ? '#7bed9f' : '#ffb37a';
    html += `<div style="background:linear-gradient(135deg,rgba(18,22,45,0.95),rgba(12,14,30,0.98));border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:16px;">`;
    html += `<div style="font-size:14px;font-weight:bold;color:#eee;letter-spacing:2px;margin-bottom:12px;">👤 帳號資訊</div>`;
    html += `<div style="font-size:11px;color:#888;line-height:2;">`;
    html += `召喚師名稱：<span style="color:#ffd700;">${playerName || '未設定'}</span><br>`;
    html += `帳號綁定：<span style="color:${bindColor};">${bindText}</span><br>`;
    html += `召喚師等級：<span style="color:#64c8ff;">Lv.${summonerLv}</span><br>`;
    html += `擁有角色數：<span style="color:#7bed9f;">${ownedCards.length}</span><br>`;
    html += `體力藥水：<span style="color:#ff6b9d;"><img src="其他圖示/體力圖示.png" style="width:14px;height:14px;vertical-align:middle;"> ×${staminaPotions}</span>`;
    html += `</div><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">`;
    if (!authUser) {
        html += `<button onclick="showBindAccountDialog()" style="padding:8px 14px;background:rgba(123,237,159,0.16);border:1px solid rgba(123,237,159,0.35);border-radius:6px;color:#7bed9f;font-size:12px;font-weight:bold;cursor:pointer;">🔗 綁定帳號</button>`;
    }
    html += `<button onclick="closeSettings();logoutAccount();" style="padding:8px 14px;background:rgba(255,71,87,0.16);border:1px solid rgba(255,71,87,0.35);border-radius:6px;color:#ff9aa8;font-size:12px;font-weight:bold;cursor:pointer;">登出帳號</button>`;
    html += `</div></div>`;

    // 體力藥水
    html += `<div style="background:linear-gradient(135deg,rgba(18,22,45,0.95),rgba(12,14,30,0.98));border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:16px;">`;
    html += `<div style="font-size:14px;font-weight:bold;color:#eee;letter-spacing:2px;margin-bottom:12px;"><img src="其他圖示/體力圖示.png" style="width:16px;height:16px;vertical-align:middle;"> 道具使用</div>`;
    html += `<div style="display:flex;align-items:center;gap:12px;">`;
    html += `<div style="font-size:11px;color:#888;flex:1;">體力藥水（剩餘 ${staminaPotions} 個）<br><span style="font-size:9px;color:#666;">使用後體力回滿</span></div>`;
    html += `<button onclick="useStaminaPotion();closeSettings();showSettings();" style="padding:8px 16px;background:linear-gradient(180deg,#2a7ab5,#1a5a8a);border:1px solid rgba(100,200,255,0.3);border-radius:6px;color:#e0f0ff;font-size:12px;font-weight:bold;letter-spacing:1px;cursor:pointer;">使用</button>`;
    html += '</div></div>';

    // 其他操作
    html += `<div style="background:linear-gradient(135deg,rgba(18,22,45,0.95),rgba(12,14,30,0.98));border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:16px;">`;
    html += `<div style="font-size:14px;font-weight:bold;color:#eee;letter-spacing:2px;margin-bottom:12px;">⚙️ 其他</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:8px;">`;
    html += `<button onclick="if(confirm('確定要清除所有存檔嗎？此操作無法復原！')){localStorage.removeItem('${SAVE_KEY}');localStorage.removeItem('caitiankm_starter_done');localStorage.removeItem('caitiankm_prologue_done');location.reload();}" style="padding:10px;background:rgba(255,71,87,0.15);border:1px solid rgba(255,71,87,0.3);border-radius:6px;color:#ff6b81;font-size:12px;font-weight:bold;letter-spacing:1px;cursor:pointer;">🗑️ 清除存檔</button>`;
    html += `</div></div>`;

    // 版本資訊
    html += `<div style="text-align:center;font-size:10px;color:#444;padding:8px;">CaiTianKaiMen v2.0.0<br>© 2026 Made by Xuan</div>`;

    html += '</div></div>';
    document.getElementById('lobby-screen').insertAdjacentHTML('beforeend', html);
}

function closeSettings() {
    const el = document.getElementById('settings-screen');
    if (el) el.remove();
}

function showBindAccountDialog() {
    const existing = document.getElementById('bind-account-dialog');
    if (existing) existing.remove();

    const html = `
    <div id="bind-account-dialog" style="position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;">
        <div style="background:linear-gradient(135deg,#1a1e3a,#0d1020);border:1px solid rgba(255,215,0,0.2);border-radius:12px;padding:24px;width:85%;max-width:340px;">
            <div style="font-size:16px;font-weight:bold;color:#ffd700;text-align:center;margin-bottom:16px;">🔗 綁定帳號</div>
            <div style="font-size:11px;color:#aaa;text-align:center;margin-bottom:16px;">綁定後可雲端存檔、使用 PVP 等功能</div>
            <input id="bind-email" type="email" placeholder="Email" style="width:100%;padding:10px;margin-bottom:8px;background:#0d1224;color:#dfe7ff;border:1px solid rgba(255,255,255,0.1);border-radius:6px;box-sizing:border-box;">
            <input id="bind-password" type="password" placeholder="密碼（至少6位）" style="width:100%;padding:10px;margin-bottom:8px;background:#0d1224;color:#dfe7ff;border:1px solid rgba(255,255,255,0.1);border-radius:6px;box-sizing:border-box;">
            <div id="bind-warning" style="color:#ff7b7b;font-size:11px;min-height:16px;margin-bottom:8px;"></div>
            <div style="display:flex;gap:8px;">
                <button onclick="bindAccountSubmit('register')" style="flex:1;padding:10px;border:none;border-radius:6px;background:#2e8b57;color:#fff;font-weight:bold;cursor:pointer;">註冊綁定</button>
                <button onclick="bindAccountSubmit('login')" style="flex:1;padding:10px;border:none;border-radius:6px;background:#3b82f6;color:#fff;font-weight:bold;cursor:pointer;">登入綁定</button>
            </div>
            <button onclick="document.getElementById('bind-account-dialog').remove()" style="width:100%;margin-top:8px;padding:8px;border:none;border-radius:6px;background:rgba(255,255,255,0.08);color:#aaa;cursor:pointer;">取消</button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

async function bindAccountSubmit(mode) {
    const email = document.getElementById('bind-email').value.trim();
    const password = document.getElementById('bind-password').value;
    const warning = document.getElementById('bind-warning');
    warning.textContent = '';

    if (!email || !password) { warning.textContent = '⚠ 請填寫 Email 和密碼'; return; }
    if (password.length < 6) { warning.textContent = '⚠ 密碼至少 6 位'; return; }

    if (!firebaseReady && typeof initFirebaseServices === 'function' && !initFirebaseServices()) {
        warning.textContent = '⚠ Firebase 未就緒';
        return;
    }

    try {
        let cred;
        if (mode === 'register') {
            cred = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
            await cred.user.updateProfile({ displayName: playerName || '召喚師' });
        } else {
            cred = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
        }

        // 綁定成功 → 上傳當前存檔到雲端
        if (typeof ensurePublicProfile === 'function') await ensurePublicProfile(cred.user);
        saveGame();
        if (typeof window.queueCloudSave === 'function') {
            const raw = localStorage.getItem('caitiankm_save_v2');
            if (raw) window.queueCloudSave(JSON.parse(raw));
        }

        document.getElementById('bind-account-dialog').remove();
        showToast('帳號綁定成功！存檔已上傳雲端');
        closeSettings();
        showSettings();
    } catch (e) {
        warning.textContent = `⚠ ${e.message}`;
    }
}

// ===== 好友系統（Firebase 邀請版） =====
let friendSearchCache = [];
let pvpInviteRealtimeUnsub = null;

async function getCurrentProfile() {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || !window.firebaseDb) return null;
    const snap = await window.firebaseDb.collection('users').doc(user.uid).get();
    return snap.exists ? (snap.data() || null) : null;
}

function friendCollection(uid) {
    return window.firebaseDb.collection('users').doc(uid).collection('friends');
}

function incomingRequestCollection(uid) {
    return window.firebaseDb.collection('users').doc(uid).collection('friendRequestsIncoming');
}

function outgoingRequestCollection(uid) {
    return window.firebaseDb.collection('users').doc(uid).collection('friendRequestsOutgoing');
}

function pvpInviteIncomingCollection(uid) {
    return window.firebaseDb.collection('users').doc(uid).collection('pvpInvitesIncoming');
}

function pvpInviteOutgoingCollection(uid) {
    return window.firebaseDb.collection('users').doc(uid).collection('pvpInvitesOutgoing');
}

async function getRelationStatus(myUid, targetUid) {
    const [friendSnap, outgoingSnap, incomingSnap] = await Promise.all([
        friendCollection(myUid).doc(targetUid).get(),
        outgoingRequestCollection(myUid).doc(targetUid).get(),
        incomingRequestCollection(myUid).doc(targetUid).get(),
    ]);
    if (friendSnap.exists) return 'friend';
    if (outgoingSnap.exists) return 'outgoing';
    if (incomingSnap.exists) return 'incoming';
    return 'none';
}

async function openFriendsPanel() {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || !window.firebaseDb) {
        showToast('請先使用帳號登入才能使用好友功能');
        return;
    }

    await clearExpiredPvpInvites();
    const profile = await getCurrentProfile();
    const myPublicUid = profile?.publicUid || '尚未建立';

    const existing = document.getElementById('friends-screen');
    if (existing) existing.remove();

    let html = '<div id="friends-screen" style="position:absolute;inset:0;z-index:260;background:rgba(0,0,0,0.96);display:flex;flex-direction:column;">';
    html += '<div style="padding:14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,215,0,0.12);"><button class="back-btn" onclick="closeFriendsPanel()">← 返回</button><div style="font-size:16px;font-weight:bold;letter-spacing:3px;color:#ffd700;">好友</div><div style="width:50px;"></div></div>';
    html += `<div style="padding:8px 12px;color:#9ab;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.08);">你的公開 UID：<span style="color:#ffd700;font-weight:bold;">${myPublicUid}</span></div>`;
    html += '<div style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;gap:8px;">';
    html += '<input id="friend-search-input" type="text" placeholder="輸入玩家 UID（例：CTKXXXXXXX）" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(20,24,48,0.9);color:#fff;">';
    html += '<button onclick="searchUsersForFriend()" style="padding:10px 12px;border-radius:8px;border:1px solid rgba(255,215,0,0.35);background:linear-gradient(180deg,#ffd700,#b8860b);color:#1a1a2e;font-weight:bold;">搜尋</button>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid rgba(255,255,255,0.08);">';
    html += '<button id="friend-tab-list" onclick="switchFriendTab(\'list\')" style="padding:10px;border:none;background:rgba(100,200,255,0.12);color:#fff;">好友列表</button>';
    html += '<button id="friend-tab-req" onclick="switchFriendTab(\'requests\')" style="padding:10px;border:none;background:rgba(255,255,255,0.03);color:#aaa;">邀請通知</button>';
    html += '</div>';
    html += '<div id="friend-search-result" style="max-height:140px;overflow-y:auto;padding:8px;border-bottom:1px solid rgba(255,255,255,0.08);"></div>';
    html += '<div id="friend-outgoing-result" style="max-height:120px;overflow-y:auto;padding:8px;border-bottom:1px solid rgba(255,255,255,0.08);"></div>';
    html += '<div id="friend-pvp-invite-result" style="max-height:120px;overflow-y:auto;padding:8px;border-bottom:1px solid rgba(255,255,255,0.08);"></div>';
    html += '<div id="friend-list-container" style="flex:1;overflow-y:auto;padding:10px;"></div>';
    html += '</div>';

    document.getElementById('lobby-screen').insertAdjacentHTML('beforeend', html);
    loadOutgoingRequests();
    loadPvpIncomingInvites();
    startPvpInviteRealtimeListener();
    switchFriendTab('list');
}

function closeFriendsPanel() {
    const el = document.getElementById('friends-screen');
    if (el) el.remove();
    if (pvpInviteRealtimeUnsub) {
        try { pvpInviteRealtimeUnsub(); } catch (e) {}
        pvpInviteRealtimeUnsub = null;
    }
}

function switchFriendTab(tab) {
    const tabList = document.getElementById('friend-tab-list');
    const tabReq = document.getElementById('friend-tab-req');
    if (!tabList || !tabReq) return;

    const isList = tab === 'list';
    tabList.style.background = isList ? 'rgba(100,200,255,0.12)' : 'rgba(255,255,255,0.03)';
    tabReq.style.background = isList ? 'rgba(255,255,255,0.03)' : 'rgba(100,200,255,0.12)';
    tabList.style.color = isList ? '#fff' : '#aaa';
    tabReq.style.color = isList ? '#aaa' : '#fff';

    if (isList) loadFriendsList();
    else loadIncomingRequests();
}

async function searchUsersForFriend() {
    const input = document.getElementById('friend-search-input');
    const box = document.getElementById('friend-search-result');
    if (!input || !box) return;

    const q = input.value.trim().toUpperCase();
    if (!q) {
        box.innerHTML = '<div style="color:#888;font-size:12px;padding:6px;">請輸入 UID</div>';
        return;
    }

    box.innerHTML = '<div style="color:#888;font-size:12px;padding:6px;">搜尋中...</div>';

    try {
        const me = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!me) throw new Error('尚未登入');

        const snap = await window.firebaseDb.collection('users').where('publicUid', '==', q).limit(1).get();
        if (snap.empty) {
            friendSearchCache = [];
            box.innerHTML = '<div style="color:#888;font-size:12px;padding:6px;">找不到玩家</div>';
            return;
        }

        const doc = snap.docs[0];
        if (doc.id === me.uid) {
            friendSearchCache = [];
            box.innerHTML = '<div style="color:#888;font-size:12px;padding:6px;">這是你自己的 UID</div>';
            return;
        }

        const target = { id: doc.id, ...doc.data() };
        friendSearchCache = [target];

        const status = await getRelationStatus(me.uid, target.id);
        let btn = `<button onclick="sendFriendRequest('${target.id}')" style="padding:6px 10px;border:none;border-radius:6px;background:#2e8b57;color:#fff;">加好友</button>`;
        if (status === 'friend') {
            btn = '<button disabled style="padding:6px 10px;border:none;border-radius:6px;background:#3b4a5e;color:#aab;">已是好友</button>';
        } else if (status === 'outgoing') {
            btn = '<button disabled style="padding:6px 10px;border:none;border-radius:6px;background:#6b5b2a;color:#e6d8aa;">已送邀請</button>';
        } else if (status === 'incoming') {
            btn = '<button disabled style="padding:6px 10px;border:none;border-radius:6px;background:#2a4f6b;color:#b8def5;">對方已邀請你</button>';
        }

        box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 4px;border-bottom:1px dashed rgba(255,255,255,0.08);"><div style="color:#e6e6e6;font-size:13px;">${target.nickname || '召喚師'} <span style="color:#8aa;font-size:11px;">(${target.publicUid || '-'})</span></div>${btn}</div>`;
    } catch (error) {
        friendSearchCache = [];
        box.innerHTML = `<div style="color:#ff7b7b;font-size:12px;padding:6px;">${error.message}</div>`;
    }
}

async function sendFriendRequest(toUserId) {
    try {
        const me = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!me) throw new Error('尚未登入');

        const myProfile = await getCurrentProfile();
        const targetSnap = await window.firebaseDb.collection('users').doc(toUserId).get();
        if (!targetSnap.exists) throw new Error('玩家不存在');
        const target = targetSnap.data() || {};

        const status = await getRelationStatus(me.uid, toUserId);
        if (status === 'friend') throw new Error('你們已經是好友');
        if (status === 'outgoing') throw new Error('邀請已送出，請等待對方回覆');
        if (status === 'incoming') throw new Error('對方已向你發送邀請，請到邀請通知接受');

        const now = firebase.firestore.FieldValue.serverTimestamp();
        await outgoingRequestCollection(me.uid).doc(toUserId).set({
            uid: toUserId,
            nickname: target.nickname || '召喚師',
            publicUid: target.publicUid || '',
            createdAt: now,
        }, { merge: true });

        await incomingRequestCollection(toUserId).doc(me.uid).set({
            uid: me.uid,
            nickname: myProfile?.nickname || playerName || '召喚師',
            publicUid: myProfile?.publicUid || '',
            createdAt: now,
        }, { merge: true });

        showToast('好友邀請已送出');
        searchUsersForFriend();
        loadOutgoingRequests();
        loadIncomingRequests();
    } catch (error) {
        showToast(error.message || '送出邀請失敗');
    }
}

async function loadOutgoingRequests() {
    const box = document.getElementById('friend-outgoing-result');
    if (!box) return;

    try {
        const me = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!me) throw new Error('尚未登入');

        const snap = await outgoingRequestCollection(me.uid).orderBy('createdAt', 'desc').get();
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (list.length === 0) {
            box.innerHTML = '<div style="color:#667;font-size:11px;">目前沒有待回覆的邀請</div>';
            return;
        }

        box.innerHTML = '<div style="font-size:11px;color:#9ab;margin-bottom:6px;">你送出的邀請：</div>' + list.map((r) =>
            `<div style="color:#cbd5e1;font-size:12px;padding:4px 0;">• ${r.nickname || '召喚師'} <span style="color:#8aa;">(${r.publicUid || '-'})</span></div>`
        ).join('');
    } catch (error) {
        box.innerHTML = `<div style="color:#ff7b7b;font-size:11px;">${error.message}</div>`;
    }
}

async function clearExpiredPvpInvites() {
    try {
        const me = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!me) return;
        const now = Date.now();
        const snap = await pvpInviteIncomingCollection(me.uid).get();
        const expired = snap.docs.filter(d => {
            const x = d.data() || {};
            return (x.expiresAtTs || 0) > 0 && (x.expiresAtTs < now);
        });
        await Promise.all(expired.map(async (d) => {
            const x = d.data() || {};
            await pvpInviteIncomingCollection(me.uid).doc(d.id).delete();
            if (x.fromUid) {
                await pvpInviteOutgoingCollection(x.fromUid).doc(me.uid).delete();
            }
        }));
    } catch (e) {}
}

async function loadPvpIncomingInvites() {
    const box = document.getElementById('friend-pvp-invite-result');
    if (!box) return;

    try {
        const me = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!me) throw new Error('尚未登入');

        const snap = await pvpInviteIncomingCollection(me.uid).orderBy('createdAtTs', 'desc').limit(8).get();
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!list.length) {
            box.innerHTML = '<div style="color:#667;font-size:11px;">目前沒有新的邀戰通知</div>';
            return;
        }

        box.innerHTML = '<div style="font-size:11px;color:#9ab;margin-bottom:6px;">邀戰通知：</div>' + list.map((r) => {
            const remain = Math.max(0, Math.floor(((r.expiresAtTs || 0) - Date.now()) / 1000));
            return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed rgba(255,255,255,0.08);">
                <div style="color:#cbd5e1;font-size:12px;">${r.fromName || '好友'} 邀你 PVP（房號 ${r.roomCode || '--'}）<span style="color:#8aa;font-size:10px;"> ${remain}s</span></div>
                <button onclick="acceptPvpInvite('${r.fromUid || ''}','${r.roomCode || ''}')" style="padding:5px 8px;border:none;border-radius:6px;background:#2e8b57;color:#fff;font-size:11px;">加入</button>
            </div>`;
        }).join('');
    } catch (error) {
        box.innerHTML = `<div style="color:#ff7b7b;font-size:11px;">${error.message}</div>`;
    }
}

async function acceptPvpInvite(fromUid, roomCode) {
    try {
        if (!roomCode) throw new Error('邀戰資料失效');
        closeFriendsPanel();
        openPvpPanel();
        setTimeout(async () => {
            const input = document.getElementById('pvp-join-input');
            if (input) input.value = roomCode;
            await pvpJoinRoom();
        }, 120);

        const me = window.getCurrentUser ? window.getCurrentUser() : null;
        if (me) {
            await pvpInviteIncomingCollection(me.uid).doc(fromUid).delete();
            await pvpInviteOutgoingCollection(fromUid).doc(me.uid).delete();
        }
    } catch (error) {
        showToast(error.message || '加入邀戰失敗');
    }
}

function startPvpInviteRealtimeListener() {
    const me = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!me || !window.firebaseDb) return;

    if (pvpInviteRealtimeUnsub) {
        try { pvpInviteRealtimeUnsub(); } catch (e) {}
        pvpInviteRealtimeUnsub = null;
    }

    pvpInviteRealtimeUnsub = pvpInviteIncomingCollection(me.uid)
        .orderBy('createdAtTs', 'desc')
        .limit(8)
        .onSnapshot(() => {
            loadPvpIncomingInvites();
        }, () => {});
}

async function loadFriendsList() {
    const box = document.getElementById('friend-list-container');
    if (!box) return;

    box.innerHTML = '<div style="color:#888;font-size:12px;">讀取中...</div>';
    try {
        const me = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!me) throw new Error('尚未登入');

        const snap = await friendCollection(me.uid).orderBy('createdAt', 'desc').get();
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (list.length === 0) {
            box.innerHTML = '<div style="color:#888;font-size:12px;">你目前還沒有好友</div>';
            return;
        }

        box.innerHTML = list.map((f) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:rgba(20,24,48,0.75);margin-bottom:8px;gap:8px;">
                <div style="color:#f1f1f1;font-size:13px;flex:1;">${f.nickname || '召喚師'} <span style="color:#8aa;font-size:11px;">(${f.publicUid || '-'})</span></div>
                <button onclick="showFriendProfile('${f.id}', '${(f.nickname || '召喚師').replace(/'/g, "\\'")}')" style="padding:6px 10px;border:none;border-radius:6px;background:#6c5ce7;color:#fff;">資料</button>
                <button onclick="sendPvpInvite('${f.id}', '${(f.nickname || '好友').replace(/'/g, "\\'")}')" style="padding:6px 10px;border:none;border-radius:6px;background:#355cde;color:#fff;">邀戰</button>
                <button onclick="removeFriend('${f.id}')" style="padding:6px 10px;border:none;border-radius:6px;background:#a94442;color:#fff;">刪除</button>
            </div>
        `).join('');
    } catch (error) {
        box.innerHTML = `<div style="color:#ff7b7b;font-size:12px;">${error.message}</div>`;
    }
}

async function loadIncomingRequests() {
    const box = document.getElementById('friend-list-container');
    if (!box) return;

    box.innerHTML = '<div style="color:#888;font-size:12px;">讀取中...</div>';
    try {
        const me = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!me) throw new Error('尚未登入');

        const snap = await incomingRequestCollection(me.uid).orderBy('createdAt', 'desc').get();
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (list.length === 0) {
            box.innerHTML = '<div style="color:#888;font-size:12px;">目前沒有新的好友邀請</div>';
            return;
        }

        box.innerHTML = list.map((r) => `
            <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:rgba(20,24,48,0.75);margin-bottom:8px;">
                <div style="color:#f1f1f1;font-size:13px;margin-bottom:8px;">${r.nickname || '召喚師'} <span style="color:#8aa;font-size:11px;">(${r.publicUid || '-'})</span> 向你發送好友邀請</div>
                <div style="display:flex;gap:8px;">
                    <button onclick="acceptFriendRequest('${r.id}')" style="padding:6px 10px;border:none;border-radius:6px;background:#2e8b57;color:#fff;">接受</button>
                    <button onclick="rejectFriendRequest('${r.id}')" style="padding:6px 10px;border:none;border-radius:6px;background:#a94442;color:#fff;">拒絕</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        box.innerHTML = `<div style="color:#ff7b7b;font-size:12px;">${error.message}</div>`;
    }
}

async function acceptFriendRequest(fromUserId) {
    try {
        const me = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!me) throw new Error('尚未登入');

        const incomingSnap = await incomingRequestCollection(me.uid).doc(fromUserId).get();
        if (!incomingSnap.exists) throw new Error('邀請不存在或已失效');
        const fromData = incomingSnap.data() || {};

        const myProfile = await getCurrentProfile();
        const now = firebase.firestore.FieldValue.serverTimestamp();

        await friendCollection(me.uid).doc(fromUserId).set({
            uid: fromUserId,
            nickname: fromData.nickname || '召喚師',
            publicUid: fromData.publicUid || '',
            status: 'accepted',
            createdAt: now,
        }, { merge: true });

        await friendCollection(fromUserId).doc(me.uid).set({
            uid: me.uid,
            nickname: myProfile?.nickname || playerName || '召喚師',
            publicUid: myProfile?.publicUid || '',
            status: 'accepted',
            createdAt: now,
        }, { merge: true });

        await incomingRequestCollection(me.uid).doc(fromUserId).delete();
        await outgoingRequestCollection(fromUserId).doc(me.uid).delete();

        showToast('已接受邀請');
        loadIncomingRequests();
        loadOutgoingRequests();
        setTimeout(() => switchFriendTab('list'), 180);
    } catch (error) {
        showToast(error.message || '處理邀請失敗');
    }
}

async function rejectFriendRequest(fromUserId) {
    try {
        const me = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!me) throw new Error('尚未登入');

        await incomingRequestCollection(me.uid).doc(fromUserId).delete();
        await outgoingRequestCollection(fromUserId).doc(me.uid).delete();
        showToast('已拒絕邀請');
        loadIncomingRequests();
        loadOutgoingRequests();
    } catch (error) {
        showToast(error.message || '處理邀請失敗');
    }
}

async function removeFriend(friendId) {
    if (!confirm('確定要刪除此好友嗎？')) return;
    try {
        const me = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!me) throw new Error('尚未登入');

        await friendCollection(me.uid).doc(friendId).delete();
        await friendCollection(friendId).doc(me.uid).delete();
        showToast('已刪除好友');
        loadFriendsList();
    } catch (error) {
        showToast(error.message || '刪除好友失敗');
    }
}

async function showFriendProfile(friendId, fallbackName = '好友') {
    const old = document.getElementById('friend-profile-modal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'friend-profile-modal';
    modal.style.cssText = 'position:absolute;inset:0;z-index:320;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;padding:12px;';
    modal.innerHTML = `
        <div style="width:min(92vw,360px);max-height:86vh;overflow:auto;background:linear-gradient(180deg,#171d36,#0f1428);border:1px solid rgba(255,215,0,0.2);border-radius:12px;padding:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">
                <div style="color:#ffd166;font-size:14px;font-weight:bold;">${fallbackName} 戰績資料</div>
                <div style="display:flex;gap:6px;">
                    <button onclick="quickInviteFriend('${friendId}', '${fallbackName.replace(/'/g, "\\'")}')" style="padding:4px 8px;border:none;border-radius:6px;background:#355cde;color:#fff;">一鍵邀戰</button>
                    <button onclick="closeFriendProfile()" style="padding:4px 8px;border:none;border-radius:6px;background:#444;color:#fff;">關閉</button>
                </div>
            </div>
            <div id="friend-profile-stat" style="font-size:12px;color:#9ab;margin-bottom:8px;">讀取中...</div>
            <div id="friend-profile-list" style="font-size:12px;color:#dce3f8;">讀取中...</div>
        </div>
    `;
    document.getElementById('lobby-screen').appendChild(modal);

    try {
        const snap = await pvpMatchesCollection(friendId).orderBy('ts', 'desc').limit(12).get();
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const statEl = document.getElementById('friend-profile-stat');
        const listEl = document.getElementById('friend-profile-list');
        if (!statEl || !listEl) return;

        const total = rows.length;
        const win = rows.filter(x => x.result === 'win').length;
        const lose = rows.filter(x => x.result === 'lose').length;
        const rate = total ? Math.round((win / total) * 100) : 0;
        statEl.textContent = `近 ${total} 場｜勝 ${win}｜敗 ${lose}｜勝率 ${rate}%`;

        if (!rows.length) {
            listEl.innerHTML = '<div style="color:#667;">尚無戰績資料</div>';
            return;
        }

        listEl.innerHTML = rows.map((r) => {
            const date = r.ts ? new Date(r.ts) : null;
            const time = date ? `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '--';
            const color = r.result === 'win' ? '#7bed9f' : '#ff7b7b';
            const badge = r.result === 'win' ? '勝' : '敗';
            return `<div style="padding:7px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:rgba(10,14,28,0.75);margin-bottom:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                    <div>vs ${r.opponentName || '對手'}</div>
                    <div style="color:${color};font-weight:bold;">${badge}</div>
                </div>
                <div style="font-size:11px;color:#9ab;margin-top:3px;">HP ${r.hpSelf ?? '-'} : ${r.hpEnemy ?? '-'} ・ ${time}</div>
            </div>`;
        }).join('');
    } catch (error) {
        const statEl = document.getElementById('friend-profile-stat');
        const listEl = document.getElementById('friend-profile-list');
        if (statEl) statEl.textContent = '讀取失敗';
        if (listEl) listEl.innerHTML = `<div style="color:#ff7b7b;">${error.message || '無法讀取資料'}</div>`;
    }
}

function closeFriendProfile() {
    const el = document.getElementById('friend-profile-modal');
    if (el) el.remove();
}

async function quickInviteFriend(friendId, friendName = '好友') {
    try {
        closeFriendProfile();
        openPvpPanel();
        await pvpCreateRoom();

        const me = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!me) throw new Error('尚未登入');

        const now = Date.now();
        const expiresAtTs = now + 120000;
        const payloadToTarget = {
            fromUid: me.uid,
            fromName: pvpMyName || playerName || '好友',
            roomCode: pvpRoomCode,
            createdAtTs: now,
            expiresAtTs,
            status: 'pending',
        };
        const payloadToMe = {
            toUid: friendId,
            toName: friendName,
            roomCode: pvpRoomCode,
            createdAtTs: now,
            expiresAtTs,
            status: 'pending',
        };

        await Promise.all([
            pvpInviteIncomingCollection(friendId).doc(me.uid).set(payloadToTarget, { merge: true }),
            pvpInviteOutgoingCollection(me.uid).doc(friendId).set(payloadToMe, { merge: true }),
        ]);

        setTimeout(() => {
            const input = document.getElementById('pvp-join-input');
            if (input) input.placeholder = `等待 ${friendName} 加入房號 ${pvpRoomCode}`;
            setPvpStatus(`已發送邀戰通知給 ${friendName}，房號：${pvpRoomCode}`);
            showToast(`已通知 ${friendName} 加入房號 ${pvpRoomCode}`);
        }, 120);
    } catch (error) {
        showToast(error.message || '發送邀戰通知失敗');
    }
}

// ===== PVP 系統（Firestore 房間同步版） =====
let pvpRoomCode = '';
let pvpMyName = '';
let pvpEnemyName = '對手';
let pvpBattleState = null;
let pvpMyRole = '';
let pvpRoomUnsub = null;
let pvpHistoryCache = [];
let pvpHistoryCursor = null;
let pvpHistoryFilter = 'all';
let pvpLiveRoomData = null;
let pvpHeartbeatTimer = null;
let pvpDisconnectWatchTimer = null;
let pvpMyRating = 0;

const PVP_STAGE_TEMPLATES = [
    { name: '林地狼群', hp: 90, atkMin: 5, atkMax: 11 },
    { name: '熔岩魔像', hp: 130, atkMin: 8, atkMax: 14 },
    { name: '深淵龍王', hp: 200, atkMin: 12, atkMax: 22 },
];

// 用真實 ENEMIES 建立 PVP 3 關敵人清單（2野怪 + 1 BOSS）
function pvpBuildRealEnemies(scale) {
    const normalPool = ENEMIES.filter(e => !e.img.includes('BOSS'));
    const bossPool = ENEMIES.filter(e => e.img.includes('BOSS'));
    const result = [];
    const usedIdx = new Set();
    // 2 隻野怪
    for (let i = 0; i < 2; i++) {
        let idx;
        do { idx = Math.floor(Math.random() * normalPool.length); } while (usedIdx.has(idx) && usedIdx.size < normalPool.length);
        usedIdx.add(idx);
        const base = normalPool[idx];
        const e = JSON.parse(JSON.stringify(base));
        e.hp = Math.floor(e.hp * scale);
        e.atk = Math.floor(e.atk * scale);
        result.push(e);
    }
    // 1 BOSS
    if (bossPool.length > 0) {
        const base = bossPool[Math.floor(Math.random() * bossPool.length)];
        const e = JSON.parse(JSON.stringify(base));
        e.hp = Math.floor(e.hp * scale * 1.3);
        e.atk = Math.floor(e.atk * scale * 1.2);
        result.push(e);
    } else {
        const base = normalPool[Math.floor(Math.random() * normalPool.length)];
        const e = JSON.parse(JSON.stringify(base));
        e.hp = Math.floor(e.hp * scale * 1.5);
        e.atk = Math.floor(e.atk * scale * 1.3);
        result.push(e);
    }
    return result;
}

const PVP_RATING_REWARDS = [
    { score: 100, reward: { gems: 30, gold: 3000 } },
    { score: 300, reward: { gems: 50, gold: 6000 } },
    { score: 600, reward: { gems: 80, gold: 12000 } },
    { score: 900, reward: { gems: 120, gold: 20000 } },
    { score: 1200, reward: { gems: 180, gold: 32000 } },
    { score: 1500, reward: { gems: 300, gold: 50000 } },
];

function pvpRoomsCollection() {
    return window.firebaseDb.collection('pvpRooms');
}

function pvpMatchesCollection(uid) {
    return window.firebaseDb.collection('users').doc(uid).collection('pvpMatches');
}

async function areUsersFriends(uidA, uidB) {
    if (!uidA || !uidB) return false;
    const snap = await friendCollection(uidA).doc(uidB).get();
    return snap.exists;
}

function canUsePvp() {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || !user.uid) {
        showToast('PVP 需綁定帳號後才能使用');
        return false;
    }
    return true;
}

function clampPvpRating(v) {
    return Math.max(0, Math.min(1500, Math.floor(v || 0)));
}

async function pvpGetUserProfile(uid) {
    const snap = await window.firebaseDb.collection('users').doc(uid).get();
    return snap.exists ? (snap.data() || {}) : {};
}

async function pvpGetUserRating(uid) {
    const p = await pvpGetUserProfile(uid);
    return clampPvpRating(p.pvpRating || 0);
}

function pvpCalcDifficultyScale(avgRating) {
    if (avgRating >= 1200) return 1.8;
    if (avgRating >= 900) return 1.6;
    if (avgRating >= 600) return 1.4;
    if (avgRating >= 300) return 1.2;
    return 1;
}

let pvpBattleSeed = 0; // 隨機種子，確保雙方打同一組敵人

function pvpBuildStagesByScale(scale) {
    return PVP_STAGE_TEMPLATES.map((x, i) => ({
        id: i + 1,
        name: x.name,
        maxHp: Math.floor(x.hp * scale),
        hp: Math.floor(x.hp * scale),
        atkMin: Math.max(1, Math.floor(x.atkMin * scale)),
        atkMax: Math.max(2, Math.floor(x.atkMax * scale)),
    }));
}

function pvpGetCurrentStage() {
    const idx = (pvpBattleState?.currentStage || 1) - 1;
    return pvpBattleState?.stages?.[idx] || null;
}

function pvpTrySettleWinnerByHp() {
    if (!pvpBattleState || pvpBattleState.winner) return;
    if ((pvpBattleState.hp?.host || 0) <= 0) pvpBattleState.winner = 'guest';
    if ((pvpBattleState.hp?.guest || 0) <= 0) pvpBattleState.winner = 'host';
}

async function pvpApplyRatingAndRewards(uid, oldRating, newRating) {
    const ref = window.firebaseDb.collection('users').doc(uid);
    const snap = await ref.get();
    const profile = snap.exists ? (snap.data() || {}) : {};
    const claims = profile.pvpRewardClaims || {};

    let addGems = 0;
    let addGold = 0;
    const newClaims = { ...claims };

    PVP_RATING_REWARDS.forEach((x) => {
        const key = String(x.score);
        if (!newClaims[key] && oldRating < x.score && newRating >= x.score) {
            newClaims[key] = true;
            addGems += x.reward.gems || 0;
            addGold += x.reward.gold || 0;
        }
    });

    await ref.set({
        pvpRating: clampPvpRating(newRating),
        pvpRewardClaims: newClaims,
        pvpRewardChest: {
            gems: (profile.pvpRewardChest?.gems || 0) + addGems,
            gold: (profile.pvpRewardChest?.gold || 0) + addGold,
        },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { addGems, addGold };
}

async function pvpFinalizeRatingIfNeeded(winnerRole) {
    if (!pvpBattleState || pvpBattleState.ratingSettled || !pvpRoomCode) return;

    const snap = await pvpRoomsCollection().doc(pvpRoomCode).get();
    if (!snap.exists) return;
    const room = snap.data() || {};
    if (!room.hostUid || !room.guestUid) return;

    const hostOld = clampPvpRating(room.hostRating || 0);
    const guestOld = clampPvpRating(room.guestRating || 0);
    const hostWin = winnerRole === 'host';

    const hostNew = clampPvpRating(hostOld + (hostWin ? 30 : -20));
    const guestNew = clampPvpRating(guestOld + (hostWin ? -20 : 30));

    const [hostReward, guestReward] = await Promise.all([
        pvpApplyRatingAndRewards(room.hostUid, hostOld, hostNew),
        pvpApplyRatingAndRewards(room.guestUid, guestOld, guestNew),
    ]);

    pvpBattleState.ratingSettled = true;
    pvpAppendLog(`積分結算：房主 ${hostOld}→${hostNew} / 加入者 ${guestOld}→${guestNew}`);
    await pvpUpdateRoom({
        battleState: pvpBattleState,
        hostRating: hostNew,
        guestRating: guestNew,
    });

    const me = window.getCurrentUser ? window.getCurrentUser() : null;
    if (me) {
        const myDelta = me.uid === room.hostUid
            ? { old: hostOld, next: hostNew, reward: hostReward }
            : { old: guestOld, next: guestNew, reward: guestReward };
        pvpMyRating = myDelta.next;
        if (myDelta.reward.addGems || myDelta.reward.addGold) {
            if (typeof playerGems !== 'undefined') playerGems += myDelta.reward.addGems;
            if (typeof playerGold !== 'undefined') playerGold += myDelta.reward.addGold;
            if (typeof saveGame === 'function') saveGame();
            showToast(`積分獎勵：+${myDelta.reward.addGems} 鑽石、+${myDelta.reward.addGold} 金幣`);
        }
    }
}

async function pvpLoadMyRating() {
    try {
        const me = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!me) return;
        pvpMyRating = await pvpGetUserRating(me.uid);
        renderPvpRoom();
    } catch (e) {}
}

function openPvpPanel() {
    if (!canUsePvp()) return;

    const old = document.getElementById('pvp-screen');
    if (old) old.remove();

    pvpMyName = getCurrentPlayerDisplayName();

    let html = '<div id="pvp-screen" style="position:absolute;inset:0;z-index:280;background:rgba(0,0,0,0.94);display:flex;flex-direction:column;">';
    html += '<div style="padding:14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,215,0,0.12);"><button class="back-btn" onclick="closePvpPanel()">← 返回</button><div style="font-size:16px;font-weight:bold;letter-spacing:3px;color:#ffd700;">PVP（雲端房間）</div><div style="width:50px;"></div></div>';
    html += '<div id="pvp-status" style="padding:12px;color:#aab;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.08);">建立房間後，朋友輸入房號即可加入</div>';
    html += '<div id="pvp-room" style="flex:1;overflow:auto;padding:12px;"></div>';
    html += '</div>';

    document.getElementById('lobby-screen').insertAdjacentHTML('beforeend', html);
    renderPvpRoom();
    pvpLoadMyRating();
    // 嘗試自動重連到進行中的房間
    pvpTryReconnect();
}

async function pvpTryReconnect() {
    const me = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!me || pvpRoomCode) return; // 已有房間就不重連

    try {
        // 查詢我是 host 的進行中房間
        let snap = await pvpRoomsCollection()
            .where('hostUid', '==', me.uid)
            .where('status', 'in', ['waiting', 'ready', 'playing'])
            .limit(1).get();

        if (snap.empty) {
            // 查詢我是 guest 的進行中房間
            snap = await pvpRoomsCollection()
                .where('guestUid', '==', me.uid)
                .where('status', 'in', ['ready', 'playing'])
                .limit(1).get();
        }

        if (snap.empty) return;

        const doc = snap.docs[0];
        const data = doc.data() || {};
        pvpRoomCode = doc.id;
        pvpMyRole = data.hostUid === me.uid ? 'host' : 'guest';
        pvpEnemyName = pvpMyRole === 'host' ? (data.guestName || '對手') : (data.hostName || '房主');
        pvpBattleState = data.battleState || null;
        pvpLiveRoomData = data;

        const myRating = await pvpGetUserRating(me.uid);
        pvpMyRating = myRating;

        pvpSubscribeRoom();
        pvpStartRuntimeTimers();
        setPvpStatus(`已重新連線到房間 ${pvpRoomCode}`);
        renderPvpRoom();

        // 如果戰鬥已開始且我還沒完成 → 自動進入戰鬥
        if (pvpBattleState && pvpBattleState.started && !pvpBattleState.winner) {
            const myResult = pvpMyRole === 'host' ? pvpBattleState.hostResult : pvpBattleState.guestResult;
            if (!myResult?.finished) {
                setPvpStatus('重連中…自動進入戰鬥');
                setTimeout(() => pvpLaunchRealBattle(), 500);
            }
        }
    } catch (e) {
        console.warn('PVP 重連失敗', e);
    }
}

function pvpRejoinBattle() {
    if (!pvpRoomCode || !pvpBattleState || !pvpBattleState.started) {
        showToast('找不到進行中的對戰');
        return;
    }
    pvpLaunchRealBattle();
}

async function closePvpPanel() {
    const el = document.getElementById('pvp-screen');
    if (el) el.remove();

    // 如果戰鬥進行中，不刪除房間（允許重連）
    const battleInProgress = pvpBattleState && pvpBattleState.started && !pvpBattleState.winner;
    if (battleInProgress) {
        // 只關閉面板，保留房間和連線狀態（允許重連）
        return;
    }

    try {
        const me = window.getCurrentUser ? window.getCurrentUser() : null;
        if (me && pvpRoomCode) {
            const ref = pvpRoomsCollection().doc(pvpRoomCode);
            const snap = await ref.get();
            if (snap.exists) {
                const data = snap.data() || {};
                if (data.hostUid === me.uid) {
                    await ref.delete();
                } else if (data.guestUid === me.uid) {
                    const battle = data.battleState || pvpBattleState || {};
                    battle.guestReady = false;
                    battle.started = false;
                    await ref.set({
                        guestUid: '',
                        guestName: '',
                        status: 'waiting',
                        battleState: battle,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                }
            }
        }
    } catch (e) {}

    pvpCleanupConnection(true);
}

function getCurrentPlayerDisplayName() {
    return (window.playerData && window.playerData.name) || localStorage.getItem('playerName') || '召喚師';
}

function sendPvpInvite(friendId = '', friendName = '好友') {
    if (!canUsePvp()) return;
    if (friendId) {
        quickInviteFriend(friendId, friendName);
        return;
    }
    openPvpPanel();
    showToast('已開啟 PVP 面板，請建立房間後把房號給好友');
}

function setPvpStatus(text) {
    const el = document.getElementById('pvp-status');
    if (el) el.textContent = text;
}

function makeRoomCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function pvpInitBattleState() {
    pvpBattleState = {
        started: false,
        winner: null,
        hostReady: false,
        guestReady: false,
        hostResult: null, // { stagesCleared, hpPercent, totalDamage, finished }
        guestResult: null,
        disconnect: {
            hostCount: 0,
            guestCount: 0,
            hostDeadlineTs: 0,
            guestDeadlineTs: 0,
        },
        logs: ['房間建立成功，等待雙方準備'],
    };
}

function pvpAppendLog(text) {
    if (!pvpBattleState) return;
    pvpBattleState.logs = pvpBattleState.logs || [];
    pvpBattleState.logs.unshift(text);
    if (pvpBattleState.logs.length > 12) pvpBattleState.logs.length = 12;
}

function pvpCanAttack() {
    if (!pvpBattleState || !pvpBattleState.started || pvpBattleState.winner) return false;
    return pvpBattleState.turn === pvpMyRole;
}

function pvpStopRuntimeTimers() {
    if (pvpHeartbeatTimer) {
        clearInterval(pvpHeartbeatTimer);
        pvpHeartbeatTimer = null;
    }
    if (pvpDisconnectWatchTimer) {
        clearInterval(pvpDisconnectWatchTimer);
        pvpDisconnectWatchTimer = null;
    }
}

function pvpCleanupConnection(resetState = true) {
    if (pvpRoomUnsub) {
        try { pvpRoomUnsub(); } catch (e) {}
    }
    pvpRoomUnsub = null;
    pvpStopRuntimeTimers();
    if (resetState) {
        pvpRoomCode = '';
        pvpEnemyName = '對手';
        pvpBattleState = null;
        pvpMyRole = '';
        pvpLiveRoomData = null;
    }
}

function pvpStartRuntimeTimers() {
    pvpStopRuntimeTimers();

    pvpHeartbeatTimer = setInterval(async () => {
        if (!pvpRoomCode || !pvpMyRole) return;
        const key = pvpMyRole === 'host' ? 'hostLastSeenTs' : 'guestLastSeenTs';
        await pvpUpdateRoom({ [key]: Date.now() });
    }, 5000);

    pvpDisconnectWatchTimer = setInterval(async () => {
        if (!pvpRoomCode || !pvpBattleState || pvpBattleState.winner) return;
        const room = pvpLiveRoomData || {};
        const now = Date.now();
        const hostSeen = room.hostLastSeenTs || 0;
        const guestSeen = room.guestLastSeenTs || 0;
        const dc = pvpBattleState.disconnect || { hostCount: 0, guestCount: 0, hostDeadlineTs: 0, guestDeadlineTs: 0 };
        let changed = false;

        const hostOffline = pvpBattleState.started && room.guestUid && hostSeen && (now - hostSeen > 10000);
        const guestOffline = pvpBattleState.started && room.guestUid && guestSeen && (now - guestSeen > 10000);

        // 房主斷線判定
        if (hostOffline && !dc.hostDeadlineTs && !pvpBattleState.winner) {
            if ((dc.hostCount || 0) >= 1) {
                // 第 2 次斷線 → 直接判負
                pvpBattleState.winner = 'guest';
                pvpAppendLog('房主第 2 次斷線，直接判定加入者獲勝');
                changed = true;
            } else {
                dc.hostDeadlineTs = now + 30000;
                pvpAppendLog('房主斷線，30 秒內未回線將判負');
                changed = true;
            }
        }
        // 加入者斷線判定
        if (guestOffline && !dc.guestDeadlineTs && !pvpBattleState.winner) {
            if ((dc.guestCount || 0) >= 1) {
                // 第 2 次斷線 → 直接判負
                pvpBattleState.winner = 'host';
                pvpAppendLog('加入者第 2 次斷線，直接判定房主獲勝');
                changed = true;
            } else {
                dc.guestDeadlineTs = now + 30000;
                pvpAppendLog('加入者斷線，30 秒內未回線將判負');
                changed = true;
            }
        }

        // 房主回線
        if (!hostOffline && dc.hostDeadlineTs) {
            dc.hostDeadlineTs = 0;
            dc.hostCount = 1;
            pvpAppendLog('房主已回線（1/1），再斷線直接判負');
            changed = true;
        }
        // 加入者回線
        if (!guestOffline && dc.guestDeadlineTs) {
            dc.guestDeadlineTs = 0;
            dc.guestCount = 1;
            pvpAppendLog('加入者已回線（1/1），再斷線直接判負');
            changed = true;
        }

        // 30 秒倒數到期
        if (dc.hostDeadlineTs && now > dc.hostDeadlineTs && !pvpBattleState.winner) {
            pvpBattleState.winner = 'guest';
            dc.hostDeadlineTs = 0;
            pvpAppendLog('房主超過 30 秒未回線，判定加入者獲勝');
            changed = true;
        }
        if (dc.guestDeadlineTs && now > dc.guestDeadlineTs && !pvpBattleState.winner) {
            pvpBattleState.winner = 'host';
            dc.guestDeadlineTs = 0;
            pvpAppendLog('加入者超過 30 秒未回線，判定房主獲勝');
            changed = true;
        }

        if (changed) {
            pvpBattleState.disconnect = dc;
            if (pvpBattleState.winner) {
                await pvpSaveMatchResult(pvpBattleState.winner);
                await pvpFinalizeRatingIfNeeded(pvpBattleState.winner);
            }
            await pvpUpdateRoom({ battleState: pvpBattleState, winner: pvpBattleState.winner || '' });
        }
    }, 2000);
}

async function pvpCreateRoom() {
    if (!window.firebaseDb) {
        setPvpStatus('Firebase 尚未初始化');
        return;
    }

    const me = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!me) {
        showToast('請先登入');
        return;
    }

    pvpCleanupConnection(true);
    pvpMyRole = 'host';
    pvpRoomCode = makeRoomCode();
    pvpEnemyName = '對手';
    pvpInitBattleState();

    const hostRating = await pvpGetUserRating(me.uid);
    pvpMyRating = hostRating;

    await pvpRoomsCollection().doc(pvpRoomCode).set({
        code: pvpRoomCode,
        hostUid: me.uid,
        hostName: pvpMyName,
        guestUid: '',
        guestName: '',
        status: 'waiting',
        winner: '',
        hostRating,
        guestRating: 0,
        hostLastSeenTs: Date.now(),
        guestLastSeenTs: 0,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        battleState: pvpBattleState,
    }, { merge: true });

    pvpSubscribeRoom();
    pvpStartRuntimeTimers();
    setPvpStatus('房間已建立，請把房號給朋友加入');
    renderPvpRoom();
}

async function pvpJoinRoom() {
    if (!window.firebaseDb) {
        setPvpStatus('Firebase 尚未初始化');
        return;
    }

    const me = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!me) {
        showToast('請先登入');
        return;
    }

    const code = (document.getElementById('pvp-join-input')?.value || '').trim().toUpperCase();
    if (!code) {
        showToast('請輸入房號');
        return;
    }

    const ref = pvpRoomsCollection().doc(code);
    const snap = await ref.get();
    if (!snap.exists) {
        showToast('找不到此房間');
        return;
    }

    const data = snap.data() || {};
    if (data.hostUid === me.uid) {
        showToast('不能加入自己的房間');
        return;
    }
    if (data.guestUid && data.guestUid !== me.uid) {
        showToast('房間已滿');
        return;
    }

    const isFriend = await areUsersFriends(me.uid, data.hostUid);
    if (!isFriend) {
        showToast('僅限好友可加入此房間');
        return;
    }

    pvpCleanupConnection(true);
    pvpMyRole = 'guest';
    pvpRoomCode = code;

    const guestRating = await pvpGetUserRating(me.uid);
    pvpMyRating = guestRating;

    await ref.set({
        guestUid: me.uid,
        guestName: pvpMyName,
        status: 'ready',
        guestRating,
        guestLastSeenTs: Date.now(),
        battleState: {
            ...(data.battleState || pvpBattleState || {}),
            ratingSettled: false,
        },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    pvpSubscribeRoom();
    pvpStartRuntimeTimers();
    setPvpStatus('加入房間成功，等待雙方準備');
    renderPvpRoom();
}

function pvpSubscribeRoom() {
    if (!pvpRoomCode) return;
    if (pvpRoomUnsub) {
        try { pvpRoomUnsub(); } catch (e) {}
    }

    pvpRoomUnsub = pvpRoomsCollection().doc(pvpRoomCode).onSnapshot((snap) => {
        if (!snap.exists) {
            setPvpStatus('房間已不存在');
            pvpCleanupConnection(true);
            renderPvpRoom();
            return;
        }
        const data = snap.data() || {};
        pvpLiveRoomData = data;
        pvpBattleState = data.battleState || pvpBattleState;
        pvpEnemyName = pvpMyRole === 'host' ? (data.guestName || '對手') : (data.hostName || '房主');

        if (pvpMyRole === 'host' && !data.guestUid) {
            setPvpStatus('等待好友加入房間');
        } else if (pvpMyRole === 'guest' && !data.hostUid) {
            setPvpStatus('房主已離開，房間已關閉');
        }

        // 對方已準備好且我也準備好 → 自動進入戰鬥
        if (pvpBattleState.started && !isPvpBattle && !pvpBattleState.winner) {
            const myResult = pvpMyRole === 'host' ? pvpBattleState.hostResult : pvpBattleState.guestResult;
            if (!myResult?.finished) {
                pvpLaunchRealBattle();
            }
        }

        // 對手已全通關且我還在打 → 我直接落敗
        const opRole = pvpMyRole === 'host' ? 'guestResult' : 'hostResult';
        const opResult = pvpBattleState[opRole];
        if (opResult?.finished && opResult.stagesCleared >= 3 && isPvpBattle && !pvpBattleState.winner) {
            // 對手先過全 3 關，強制結束我的戰鬥
            if (typeof pvpFinishBattle === 'function') pvpFinishBattle(false);
        }

        // 對手完成戰鬥 → 檢查是否雙方都完成
        if (pvpBattleState.hostResult?.finished && pvpBattleState.guestResult?.finished && !pvpBattleState.winner) {
            pvpCheckBothFinished();
        }
        // 對方已判出勝負 → 顯示結果
        if (pvpBattleState.winner && pvpBattleState.hostResult?.finished && pvpBattleState.guestResult?.finished) {
            pvpShowFinalResult();
        }

        renderPvpRoom();
    });
}

async function pvpUpdateRoom(patch) {
    if (!pvpRoomCode) return;
    await pvpRoomsCollection().doc(pvpRoomCode).set({
        ...patch,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}

async function pvpReady() {
    if (!pvpBattleState || pvpBattleState.started || !pvpRoomCode) return;

    if (pvpMyRole === 'host') pvpBattleState.hostReady = true;
    if (pvpMyRole === 'guest') pvpBattleState.guestReady = true;
    pvpAppendLog(`${pvpMyName} 已準備`);

    if (pvpBattleState.hostReady && pvpBattleState.guestReady) {
        pvpBattleState.started = true;
        pvpAppendLog('雙方已就緒，進入轉珠戰鬥！');
        setPvpStatus('戰鬥開始');
    }

    await pvpUpdateRoom({ battleState: pvpBattleState, status: pvpBattleState.started ? 'playing' : 'ready' });

    // 雙方都準備好後，各自進入真正的轉珠戰鬥
    if (pvpBattleState.started) {
        pvpLaunchRealBattle();
    }
}

function pvpLaunchRealBattle() {
    const scale = pvpCalcDifficultyScale(pvpMyRating);
    const enemyList = pvpBuildRealEnemies(scale);
    // 隱藏 PVP 面板
    const pvpScreen = document.getElementById('pvp-screen');
    if (pvpScreen) pvpScreen.remove();
    // 啟動真正的轉珠戰鬥
    startPvpBattle(enemyList);
}

async function pvpReportBattleResult(stagesCleared, enemyHpPercent, selfHpPercent) {
    if (!pvpRoomCode || !pvpMyRole || !pvpBattleState) return;

    const resultKey = pvpMyRole === 'host' ? 'hostResult' : 'guestResult';
    pvpBattleState[resultKey] = { stagesCleared, enemyHpPercent, selfHpPercent, finished: true };
    pvpAppendLog(`${pvpMyName} 完成戰鬥：通關 ${stagesCleared}/3，敵HP ${enemyHpPercent}%，自身HP ${selfHpPercent}%`);

    await pvpUpdateRoom({ battleState: pvpBattleState });

    // 檢查雙方是否都完成
    pvpCheckBothFinished();
}

async function pvpCheckBothFinished() {
    if (!pvpBattleState) return;
    const hr = pvpBattleState.hostResult;
    const gr = pvpBattleState.guestResult;
    if (!hr?.finished || !gr?.finished) return;
    if (pvpBattleState.winner) return;

    // 判定勝負：關卡進度 > 當前敵人剩餘血量（低者勝）> 自身剩餘血量（高者勝）
    let winnerRole = '';
    if (hr.stagesCleared !== gr.stagesCleared) {
        winnerRole = hr.stagesCleared > gr.stagesCleared ? 'host' : 'guest';
    } else if (hr.enemyHpPercent !== gr.enemyHpPercent) {
        winnerRole = hr.enemyHpPercent < gr.enemyHpPercent ? 'host' : 'guest'; // 敵人血越少越好
    } else if (hr.selfHpPercent !== gr.selfHpPercent) {
        winnerRole = hr.selfHpPercent > gr.selfHpPercent ? 'host' : 'guest'; // 自己血越多越好
    } else {
        winnerRole = 'host'; // 完全平局房主勝
    }

    pvpBattleState.winner = winnerRole;
    pvpAppendLog(winnerRole === 'host' ? '房主獲勝！' : '加入者獲勝！');

    await pvpSaveMatchResult(winnerRole);
    await pvpFinalizeRatingIfNeeded(winnerRole);
    await pvpUpdateRoom({ battleState: pvpBattleState, winner: winnerRole });

    // 顯示最終結果
    pvpShowFinalResult();
}

function pvpShowFinalResult() {
    if (!pvpBattleState) return;
    const hr = pvpBattleState.hostResult || {};
    const gr = pvpBattleState.guestResult || {};
    const iWin = pvpBattleState.winner === pvpMyRole;
    const myResult = pvpMyRole === 'host' ? hr : gr;
    const opResult = pvpMyRole === 'host' ? gr : hr;

    const screen = document.getElementById('result-screen');
    if (screen && screen.classList.contains('show')) {
        const waitDiv = screen.querySelector('div[style*="等待對手"]');
        if (waitDiv) waitDiv.remove();

        const finalHtml = `
            <div style="margin-top:16px;padding:12px;border:1px solid rgba(255,215,0,0.2);border-radius:8px;background:rgba(0,0,0,0.5);">
                <div style="font-size:16px;font-weight:bold;color:${iWin ? '#7bed9f' : '#ff7b7b'};text-align:center;margin-bottom:8px;">
                    ${iWin ? '🏆 你贏了！' : '💀 你輸了…'}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:#ccc;">
                    <div style="text-align:center;"><div style="color:#ffd700;font-weight:bold;margin-bottom:4px;">你</div>
                        <div>通關 ${myResult.stagesCleared || 0}/3</div>
                        <div>敵人HP ${myResult.enemyHpPercent ?? '-'}%</div>
                        <div>自身HP ${myResult.selfHpPercent ?? '-'}%</div>
                    </div>
                    <div style="text-align:center;"><div style="color:#64c8ff;font-weight:bold;margin-bottom:4px;">${pvpEnemyName}</div>
                        <div>通關 ${opResult.stagesCleared || 0}/3</div>
                        <div>敵人HP ${opResult.enemyHpPercent ?? '-'}%</div>
                        <div>自身HP ${opResult.selfHpPercent ?? '-'}%</div>
                    </div>
                </div>
                <div style="text-align:center;margin-top:8px;font-size:11px;color:#aaa;">
                    積分：${pvpMyRating}
                </div>
            </div>`;
        const overlay = screen.querySelector('.result-overlay');
        if (overlay) overlay.insertAdjacentHTML('beforeend', finalHtml);
    }
}

async function pvpSaveMatchResult(winnerRole) {
    try {
        const ref = pvpRoomsCollection().doc(pvpRoomCode);
        const snap = await ref.get();
        if (!snap.exists) return;
        const room = snap.data() || {};
        const now = Date.now();
        const hostUid = room.hostUid;
        const guestUid = room.guestUid;
        if (!hostUid || !guestUid) return;

        const hostWin = winnerRole === 'host';
        const hr = pvpBattleState?.hostResult || {};
        const gr = pvpBattleState?.guestResult || {};
        const hostRecord = {
            roomCode: pvpRoomCode,
            opponentUid: guestUid,
            opponentName: room.guestName || '對手',
            result: hostWin ? 'win' : 'lose',
            stagesCleared: hr.stagesCleared || 0,
            enemyHpPercent: hr.enemyHpPercent ?? 100,
            selfHpPercent: hr.selfHpPercent ?? 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            ts: now,
        };
        const guestRecord = {
            roomCode: pvpRoomCode,
            opponentUid: hostUid,
            opponentName: room.hostName || '房主',
            result: hostWin ? 'lose' : 'win',
            stagesCleared: gr.stagesCleared || 0,
            enemyHpPercent: gr.enemyHpPercent ?? 100,
            selfHpPercent: gr.selfHpPercent ?? 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            ts: now,
        };

        await Promise.all([
            pvpMatchesCollection(hostUid).doc(`${now}-${pvpRoomCode}`).set(hostRecord, { merge: true }),
            pvpMatchesCollection(guestUid).doc(`${now}-${pvpRoomCode}`).set(guestRecord, { merge: true }),
        ]);
    } catch (e) {}
}

async function pvpResetBattle() {
    if (!pvpRoomCode) return;
    // 戰鬥結束後雙方都可以重置；未結束時只有房主可以
    if (!pvpBattleState?.winner && pvpMyRole !== 'host') {
        showToast('只有房主可以重置對戰');
        return;
    }

    pvpInitBattleState();
    pvpBattleState.ratingSettled = false;
    pvpAppendLog('房主重置了對戰');
    await pvpUpdateRoom({ battleState: pvpBattleState, status: 'ready', winner: '' });
}

async function loadPvpMatchHistory(limit = 12, append = false) {
    try {
        const me = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!me) return [];

        let q = pvpMatchesCollection(me.uid).orderBy('ts', 'desc').limit(limit);
        if (append && pvpHistoryCursor) {
            q = q.startAfter(pvpHistoryCursor);
        }

        const snap = await q.get();
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (append) pvpHistoryCache = pvpHistoryCache.concat(rows);
        else pvpHistoryCache = rows;

        pvpHistoryCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : pvpHistoryCursor;
        return pvpHistoryCache;
    } catch (e) {
        return [];
    }
}

function formatPvpRecord(r) {
    const date = r.ts ? new Date(r.ts) : null;
    const time = date ? `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '--';
    const color = r.result === 'win' ? '#7bed9f' : '#ff7b7b';
    const badge = r.result === 'win' ? '勝利' : '敗北';
    return `<div style="padding:8px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:rgba(10,14,28,0.7);margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="font-size:12px;color:#dce3f8;">vs ${r.opponentName || '對手'} <span style="color:#8aa;">(${r.roomCode || '-'})</span></div>
            <div style="font-size:11px;color:${color};font-weight:bold;">${badge}</div>
        </div>
        <div style="font-size:11px;color:#9ab;margin-top:4px;">通關 ${r.stagesCleared ?? '-'}/3 · 敵HP ${r.enemyHpPercent ?? '-'}% · 自身HP ${r.selfHpPercent ?? '-'}% ・ ${time}</div>
    </div>`;
}

function renderPvpHistoryList() {
    const box = document.getElementById('pvp-history-list');
    const stat = document.getElementById('pvp-history-stat');
    const moreBtn = document.getElementById('pvp-history-more-btn');
    if (!box) return;

    const filtered = pvpHistoryFilter === 'all'
        ? pvpHistoryCache
        : pvpHistoryCache.filter(x => x.result === pvpHistoryFilter);

    if (stat) {
        const total = pvpHistoryCache.length;
        const win = pvpHistoryCache.filter(x => x.result === 'win').length;
        const lose = pvpHistoryCache.filter(x => x.result === 'lose').length;
        const rate = total ? Math.round((win / total) * 100) : 0;
        stat.textContent = `總場 ${total}｜勝 ${win}｜敗 ${lose}｜勝率 ${rate}%`;
    }

    if (!filtered.length) {
        box.innerHTML = '<div style="color:#667;font-size:12px;">此篩選下尚無戰績</div>';
    } else {
        box.innerHTML = filtered.slice(0, 30).map(formatPvpRecord).join('');
    }

    if (moreBtn) {
        moreBtn.style.display = pvpHistoryCursor ? 'inline-block' : 'none';
    }
}

function setPvpHistoryFilter(filter) {
    pvpHistoryFilter = filter;
    const allBtn = document.getElementById('pvp-filter-all');
    const winBtn = document.getElementById('pvp-filter-win');
    const loseBtn = document.getElementById('pvp-filter-lose');
    if (allBtn) allBtn.style.opacity = filter === 'all' ? '1' : '0.6';
    if (winBtn) winBtn.style.opacity = filter === 'win' ? '1' : '0.6';
    if (loseBtn) loseBtn.style.opacity = filter === 'lose' ? '1' : '0.6';
    renderPvpHistoryList();
}

async function showPvpHistory() {
    const box = document.getElementById('pvp-history-list');
    if (!box) return;
    box.innerHTML = '<div style="color:#888;font-size:12px;">讀取戰績中...</div>';
    pvpHistoryCursor = null;
    pvpHistoryFilter = 'all';
    await loadPvpMatchHistory(12, false);
    setPvpHistoryFilter('all');
    renderPvpHistoryList();
}

async function loadMorePvpHistory() {
    const btn = document.getElementById('pvp-history-more-btn');
    if (btn) btn.textContent = '載入中...';
    await loadPvpMatchHistory(12, true);
    renderPvpHistoryList();
    if (btn) btn.textContent = '載入更多';
}

function renderPvpRoom() {
    const box = document.getElementById('pvp-room');
    if (!box) return;

    const hr = pvpBattleState?.hostResult;
    const gr = pvpBattleState?.guestResult;
    const hostStatus = hr?.finished ? `通關 ${hr.stagesCleared}/3 · 敵HP ${hr.enemyHpPercent ?? '-'}% · 自身HP ${hr.selfHpPercent ?? '-'}%` : (pvpBattleState?.hostReady ? '已準備' : '未準備');
    const guestStatus = gr?.finished ? `通關 ${gr.stagesCleared}/3 · 敵HP ${gr.enemyHpPercent ?? '-'}% · 自身HP ${gr.selfHpPercent ?? '-'}%` : (pvpBattleState?.guestReady ? '已準備' : '未準備');

    const winnerLabel = pvpBattleState?.winner
        ? (pvpBattleState.winner === 'host' ? '房主獲勝' : '加入者獲勝')
        : (pvpBattleState?.started ? '戰鬥進行中…' : '等待雙方準備');

    const dc = pvpBattleState?.disconnect || {};
    const hostDc = dc.hostCount || 0;
    const guestDc = dc.guestCount || 0;
    const nowTs = Date.now();
    const hostRemain = dc.hostDeadlineTs ? Math.max(0, Math.ceil((dc.hostDeadlineTs - nowTs) / 1000)) : 0;
    const guestRemain = dc.guestDeadlineTs ? Math.max(0, Math.ceil((dc.guestDeadlineTs - nowTs) / 1000)) : 0;
    const dcAlert = hostRemain > 0
        ? `房主斷線倒數：${hostRemain}s`
        : (guestRemain > 0 ? `加入者斷線倒數：${guestRemain}s` : '');

    const logs = (pvpBattleState?.logs || []).map((x) => `<div style="padding:4px 0;border-bottom:1px dashed rgba(255,255,255,0.06);">${x}</div>`).join('') || '<div style="color:#667;">尚無紀錄</div>';

    const canReady = pvpRoomCode && pvpBattleState && !pvpBattleState.started && pvpLiveRoomData?.guestUid;
    // 判斷是否可以重新加入戰鬥（戰鬥已開始、沒結束、我還沒打完）
    const myResult = pvpMyRole === 'host' ? pvpBattleState?.hostResult : pvpBattleState?.guestResult;
    const canRejoin = pvpRoomCode && pvpBattleState && pvpBattleState.started && !pvpBattleState.winner && !myResult?.finished;
    // 判斷是否已因中離被判負
    const iLostByDc = pvpRoomCode && pvpBattleState && pvpBattleState.winner && pvpBattleState.winner !== pvpMyRole;
    const iWonByDc = pvpRoomCode && pvpBattleState && pvpBattleState.winner && pvpBattleState.winner === pvpMyRole;

    // 判斷中離判負原因
    let dcResultMsg = '';
    if (iLostByDc) {
        const myDcCount = pvpMyRole === 'host' ? (dc.hostCount || 0) : (dc.guestCount || 0);
        if (myDcCount >= 1) dcResultMsg = '你中離後再次斷線，已被判定敗北。';
        else dcResultMsg = '你斷線超過 30 秒未回線，已被判定敗北。';
    } else if (iWonByDc) {
        dcResultMsg = '對手中離，你已獲勝！';
    }

    box.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr;gap:12px;">
            ${dcResultMsg ? `
            <div style="padding:16px;border:2px solid ${iWonByDc ? '#7bed9f' : '#ff7b7b'};border-radius:10px;background:${iWonByDc ? 'rgba(123,237,159,0.1)' : 'rgba(255,123,123,0.1)'};text-align:center;">
                <div style="font-size:18px;font-weight:bold;color:${iWonByDc ? '#7bed9f' : '#ff7b7b'};margin-bottom:8px;">
                    ${iWonByDc ? '🏆 你獲勝了！' : '💀 對戰結束'}
                </div>
                <div style="font-size:13px;color:#dce3f8;margin-bottom:8px;">${dcResultMsg}</div>
                <div style="font-size:11px;color:#aaa;margin-bottom:12px;">房號：${pvpRoomCode} ・ 對手：${pvpEnemyName} ・ 積分：${pvpMyRating}</div>
                <button onclick="pvpResetBattle()" style="padding:10px 20px;border:none;border-radius:8px;background:#7f8c8d;color:#fff;font-weight:bold;cursor:pointer;">重置對戰</button>
            </div>
            ` : ''}
            ${canRejoin ? `
            <div style="padding:16px;border:2px solid #ffd700;border-radius:10px;background:rgba(255,215,0,0.1);text-align:center;">
                <div style="font-size:16px;font-weight:bold;color:#ffd700;margin-bottom:8px;">⚠️ 你有一場進行中的對戰！</div>
                <div style="font-size:12px;color:#dce3f8;margin-bottom:12px;">房號：${pvpRoomCode} ・ 對手：${pvpEnemyName}</div>
                <button onclick="pvpRejoinBattle()" style="padding:12px 28px;border:none;border-radius:8px;background:#e67e22;color:#fff;font-size:16px;font-weight:bold;cursor:pointer;animation:pulse 1.5s infinite;">🔥 重新加入戰鬥</button>
            </div>
            ` : ''}

            <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:rgba(18,22,40,0.8);">
                <div style="font-size:13px;color:#ffd166;margin-bottom:8px;">建立或加入房間</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="pvpCreateRoom()" style="padding:10px 12px;border:none;border-radius:8px;background:#2e8b57;color:#fff;font-weight:bold;">建立房間</button>
                    <input id="pvp-join-input" placeholder="輸入房號" style="padding:10px;background:#0d1224;color:#dfe7ff;border:1px solid rgba(255,255,255,0.1);border-radius:6px;min-width:120px;">
                    <button onclick="pvpJoinRoom()" style="padding:10px 12px;border:none;border-radius:8px;background:#9b59b6;color:#fff;font-weight:bold;">加入房間</button>
                </div>
                <div style="font-size:11px;color:#9ab;margin-top:8px;">目前房號：${pvpRoomCode || '--'}</div>
            </div>

            <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:rgba(18,22,40,0.8);">
                <div style="font-size:13px;color:#ffd166;margin-bottom:8px;">⚔️ 轉珠對戰（3 關卡 · 限時 3 分鐘）</div>
                <div style="font-size:12px;color:#dce3f8;line-height:1.8;">
                    <div>你：${pvpMyName} ${pvpMyRole ? `（${pvpMyRole === 'host' ? '房主' : '加入者'}）` : ''}</div>
                    <div>對手：${pvpEnemyName}</div>
                    <div>狀態：${winnerLabel}</div>
                    <div>你的積分：<span style="color:#ffd700;">${pvpMyRating}</span></div>
                    <div>房主戰績：${hostStatus}</div>
                    <div>加入者戰績：${guestStatus}</div>
                    <div>中離次數（房主 / 加入者）：${hostDc} / ${guestDc}</div>
                    ${dcAlert ? `<div style="color:#ffd166;">${dcAlert}</div>` : ''}
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
                    <button onclick="pvpReady()" ${canReady ? '' : 'disabled'} style="padding:8px 14px;border:none;border-radius:6px;background:${canReady ? '#16a085' : '#555'};color:#fff;font-weight:bold;">準備開戰</button>
                    <button onclick="pvpResetBattle()" ${!pvpRoomCode ? 'disabled' : ''} style="padding:8px 10px;border:none;border-radius:6px;background:#7f8c8d;color:#fff;">重置對戰</button>
                    <button onclick="showPvpHistory()" style="padding:8px 10px;border:none;border-radius:6px;background:#3b82f6;color:#fff;">戰績</button>
                </div>
                <div style="margin-top:8px;font-size:10px;color:#778;">限時 3 分鐘打 3 關，比較：關卡進度 → 敵人剩餘血量 → 自身剩餘血量</div>
                <div style="margin-top:10px;font-size:11px;color:#8ea0c6;max-height:140px;overflow:auto;">${logs}</div>
            </div>

            <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:rgba(18,22,40,0.8);">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                    <div style="font-size:13px;color:#ffd166;">近期戰績</div>
                    <div id="pvp-history-stat" style="font-size:11px;color:#9ab;">總場 0｜勝 0｜敗 0｜勝率 0%</div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
                    <button id="pvp-filter-all" onclick="setPvpHistoryFilter('all')" style="padding:5px 8px;border:none;border-radius:6px;background:#3b82f6;color:#fff;font-size:11px;">全部</button>
                    <button id="pvp-filter-win" onclick="setPvpHistoryFilter('win')" style="padding:5px 8px;border:none;border-radius:6px;background:#2e8b57;color:#fff;font-size:11px;opacity:0.6;">勝場</button>
                    <button id="pvp-filter-lose" onclick="setPvpHistoryFilter('lose')" style="padding:5px 8px;border:none;border-radius:6px;background:#a94442;color:#fff;font-size:11px;opacity:0.6;">敗場</button>
                </div>
                <div id="pvp-history-list" style="max-height:220px;overflow:auto;">
                    ${(pvpHistoryCache && pvpHistoryCache.length) ? pvpHistoryCache.slice(0, 8).map(formatPvpRecord).join('') : '<div style="color:#667;font-size:12px;">按下「戰績」載入紀錄</div>'}
                </div>
                <div style="margin-top:8px;">
                    <button id="pvp-history-more-btn" onclick="loadMorePvpHistory()" style="display:none;padding:7px 10px;border:none;border-radius:6px;background:#556b8a;color:#fff;font-size:11px;">載入更多</button>
                </div>
            </div>
        </div>
    `;
}

// ===== 張邦勤 NPC =====
let bangqinAudio = null;
let bangqinPlaying = false;

function openBangqinDialog() {
    SFX.play('tap');
    document.getElementById('bangqin-dialog').classList.remove('hidden');
    document.getElementById('bangqin-text').textContent = '嘿！召喚師，要聽我唱首歌嗎？';
    const btn = document.getElementById('bangqin-play-btn');
    btn.textContent = '🎤 聽他唱歌';
    btn.classList.remove('playing');
}

function closeBangqinDialog() {
    document.getElementById('bangqin-dialog').classList.add('hidden');
    stopBangqinSong();
}

function startBangqinTutorial() {
    closeBangqinDialog();
    const steps = [
        { title: '歡迎來到五行轉珠！', text: '嘿！我是張邦勤，你的新手導師！讓我帶你認識這個世界吧～' },
        { title: '🎯 轉珠戰鬥', text: '點擊「BATTLE」進入戰鬥！拖動珠子連成同色消除，消越多傷害越高！' },
        { title: '⚔️ 隊伍編成', text: '點擊下方「隊伍」可以編輯你的戰鬥隊伍，最多放6名角色！' },
        { title: '🌟 五行召喚', text: '用鑽石抽卡！SR和SSR角色更強力，集滿保底必出！' },
        { title: '🎒 背包管理', text: '在「背包」查看你擁有的所有角色，點擊可看詳細資料！' },
        { title: '📋 每日任務', text: '每天完成任務可以獲得獎勵，記得每天上線領取喔！' },
        { title: '🎵 最後...', text: '有空來找我聊天，我還會唱歌給你聽！祝你冒險愉快～' },
    ];
    let idx = 0;
    const overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;';
    window._tutorialNext = () => { idx++; render(); };
    window._tutorialClose = () => { overlay.remove(); delete window._tutorialNext; delete window._tutorialClose; };
    function render() {
        const s = steps[idx];
        const isLast = idx >= steps.length - 1;
        overlay.innerHTML = `
            <div style="background:linear-gradient(135deg,#1a1a35,#0a0a16);border:1.5px solid rgba(255,215,0,0.3);border-radius:12px;padding:20px;max-width:300px;width:85%;text-align:center;">
                <div style="font-size:16px;font-weight:bold;color:#ffd700;margin-bottom:10px;letter-spacing:2px;">${s.title}</div>
                <div style="font-size:13px;color:#ccc;line-height:1.8;margin-bottom:16px;">${s.text}</div>
                <div style="display:flex;gap:8px;justify-content:center;">
                    ${isLast
                        ? '<button onclick="_tutorialClose()" style="padding:8px 20px;background:linear-gradient(180deg,#2a7ab5,#1a5a8a);border:none;border-radius:6px;color:#e0f0ff;font-weight:bold;font-size:13px;cursor:pointer;">完成教學！</button>'
                        : '<button onclick="_tutorialNext()" style="padding:8px 20px;background:linear-gradient(180deg,#ffd700,#b8860b);border:none;border-radius:6px;color:#1a1a2e;font-weight:bold;font-size:13px;cursor:pointer;">下一步 (' + (idx+1) + '/' + steps.length + ')</button>'}
                    <button onclick="_tutorialClose()" style="padding:8px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#999;font-size:12px;cursor:pointer;">跳過</button>
                </div>
            </div>`;
    }
    render();
    document.body.appendChild(overlay);
}

function toggleBangqinSong() {
    if (!bangqinAudio) {
        bangqinAudio = document.getElementById('bangqin-audio');
    }
    const btn = document.getElementById('bangqin-play-btn');
    const text = document.getElementById('bangqin-text');

    if (bangqinPlaying) {
        stopBangqinSong();
    } else {
        bangqinAudio.currentTime = 0;
        bangqinAudio.play().then(() => {
            bangqinPlaying = true;
            btn.textContent = '⏸ 暫停';
            btn.classList.add('playing');
            text.textContent = '🎵 正在演唱中～ ♪♫♬';
        }).catch(() => {
            text.textContent = '音檔載入失敗...再試一次？';
        });
        bangqinAudio.onended = () => {
            bangqinPlaying = false;
            btn.textContent = '🎤 再聽一次';
            btn.classList.remove('playing');
            text.textContent = '唱完啦！要再聽一次嗎？😄';
        };
    }
}

function stopBangqinSong() {
    if (bangqinAudio) {
        bangqinAudio.pause();
        bangqinAudio.currentTime = 0;
    }
    bangqinPlaying = false;
    const btn = document.getElementById('bangqin-play-btn');
    if (btn) {
        btn.textContent = '🎤 聽他唱歌';
        btn.classList.remove('playing');
    }
}

// ===== 新手任務系統（神魔之塔風格） =====
const ROOKIE_STAGES = [
    {
        name: '入門', icon: '📖', color: '#64c8ff',
        quests: [
            { id: 'r_clear1', name: '完成第一場戰鬥', desc: '通關任意一個主線關卡', target: 1, action: 'clearStage', reward: { gems: 10 } },
            { id: 'r_team1', name: '編輯隊伍', desc: '更換隊伍中的任意角色', target: 1, action: 'editTeam', reward: { gold: 5000 } },
            { id: 'r_gacha1', name: '首次召喚', desc: '進行一次五行召喚', target: 1, action: 'gacha', reward: { gems: 15 } },
        ]
    },
    {
        name: '初階', icon: '⚔️', color: '#7bed9f',
        quests: [
            { id: 'r_clear5', name: '征戰五場', desc: '累計通關 5 個主線關卡', target: 5, action: 'clearStage', reward: { gems: 20 } },
            { id: 'r_combo3', name: '連鎖入門', desc: '單次轉珠達成 3 Combo', target: 3, action: 'maxCombo', reward: { gold: 8000 } },
            { id: 'r_lv5', name: '成長之路', desc: '召喚師等級達到 5', target: 5, action: 'level', reward: { gems: 10 } },
        ]
    },
    {
        name: '中階', icon: '🌟', color: '#ffd700',
        quests: [
            { id: 'r_ch2', name: '突破第二章', desc: '通關第二章所有關卡', target: 1, action: 'clearChapter2', reward: { gems: 30 } },
            { id: 'r_combo5', name: '連鎖大師', desc: '單次轉珠達成 5 Combo', target: 5, action: 'maxCombo', reward: { gems: 20 } },
            { id: 'r_gacha5', name: '召喚達人', desc: '累計召喚 5 次', target: 5, action: 'gacha', reward: { gold: 15000 } },
        ]
    },
    {
        name: '高階', icon: '👑', color: '#c77dff',
        quests: [
            { id: 'r_ch5', name: '征服妖林', desc: '通關第五章所有關卡', target: 1, action: 'clearChapter5', reward: { gems: 50 } },
            { id: 'r_lv20', name: '資深召喚師', desc: '召喚師等級達到 20', target: 20, action: 'level', reward: { gems: 30 } },
            { id: 'r_combo8', name: '連鎖宗師', desc: '單次轉珠達成 8 Combo', target: 8, action: 'maxCombo', reward: { gems: 30 } },
        ]
    },
];

let rookieProgress = {}; // { questId: { progress: 0, claimed: false } }

function initRookieProgress() {
    for (const stage of ROOKIE_STAGES) {
        for (const q of stage.quests) {
            if (!rookieProgress[q.id]) rookieProgress[q.id] = { progress: 0, claimed: false };
        }
    }
}
initRookieProgress();

function trackRookieQuest(action, value) {
    let changed = false;
    for (const stage of ROOKIE_STAGES) {
        for (const q of stage.quests) {
            const rp = rookieProgress[q.id];
            if (!rp || rp.claimed) continue;
            if (q.action === action) {
                if (action === 'maxCombo' || action === 'level') {
                    if ((value || 0) > rp.progress) { rp.progress = value; changed = true; }
                } else {
                    rp.progress = Math.min(q.target, rp.progress + 1);
                    changed = true;
                }
            }
            // 特殊：章節通關檢查
            if (q.action === 'clearChapter2' && typeof storyProgress !== 'undefined' && storyProgress[1]?.every(s => s)) {
                if (rp.progress < 1) { rp.progress = 1; changed = true; }
            }
            if (q.action === 'clearChapter5' && typeof storyProgress !== 'undefined' && storyProgress[4]?.every(s => s)) {
                if (rp.progress < 1) { rp.progress = 1; changed = true; }
            }
        }
    }
    // 等級自動同步
    for (const stage of ROOKIE_STAGES) {
        for (const q of stage.quests) {
            if (q.action === 'level') {
                const rp = rookieProgress[q.id];
                if (rp && !rp.claimed && summonerLv > rp.progress) { rp.progress = summonerLv; changed = true; }
            }
        }
    }
    if (changed) saveGame();
}

function showRookieQuests() {
    SFX.play('pageOpen');
    trackRookieQuest('level', summonerLv); // 同步等級

    // 移除舊的再重建
    const old = document.getElementById('rookie-screen');
    if (old) old.remove();

    let html = '<div class="sub-screen" id="rookie-screen" style="z-index:65;">';
    html += '<div class="sub-header"><button class="back-btn" onclick="closeSub(\'rookie-screen\')">← 返回</button><div class="sub-title">新手任務</div><div></div></div>';
    html += '<div class="rq-content">';

    for (let si = 0; si < ROOKIE_STAGES.length; si++) {
        const stage = ROOKIE_STAGES[si];
        const allDone = stage.quests.every(q => rookieProgress[q.id]?.claimed);
        const allComplete = stage.quests.every(q => (rookieProgress[q.id]?.progress || 0) >= q.target);
        // 前一階段是否全部領取
        const prevDone = si === 0 || ROOKIE_STAGES[si - 1].quests.every(q => rookieProgress[q.id]?.claimed);
        const locked = !prevDone;

        html += `<div class="rq-stage ${locked ? 'rq-locked' : ''} ${allDone ? 'rq-done' : ''}">`;
        html += `<div class="rq-stage-header" style="border-left:3px solid ${stage.color};">`;
        html += `<span class="rq-stage-icon">${stage.icon}</span>`;
        html += `<span class="rq-stage-name" style="color:${stage.color};">${stage.name}</span>`;
        if (allDone) html += '<span class="rq-stage-badge rq-badge-done">完成</span>';
        else if (allComplete && !locked) html += '<span class="rq-stage-badge rq-badge-ready">可領取</span>';
        html += '</div>';

        for (const q of stage.quests) {
            const rp = rookieProgress[q.id] || { progress: 0, claimed: false };
            const done = rp.progress >= q.target;
            const pct = Math.min(100, Math.floor((rp.progress / q.target) * 100));
            const rewardText = q.reward.gems
                ? `<img src="其他圖示/鑽石圖示.png" style="width:16px;height:16px;vertical-align:middle;"> ×${q.reward.gems}`
                : `<img src="其他圖示/金幣圖示.png" style="width:16px;height:16px;vertical-align:middle;"> ×${q.reward.gold?.toLocaleString()}`;

            html += `<div class="rq-quest ${rp.claimed ? 'rq-quest-claimed' : ''}">`;
            html += `<div class="rq-quest-info"><div class="rq-quest-name">${q.name}</div><div class="rq-quest-desc">${q.desc} (${rp.progress}/${q.target})</div>`;
            html += `<div class="rq-quest-bar"><div class="rq-quest-bar-fill" style="width:${pct}%;background:${stage.color};"></div></div></div>`;
            if (rp.claimed) {
                html += '<div class="rq-reward rq-reward-claimed">已領取</div>';
            } else if (done && !locked) {
                html += `<div class="rq-reward rq-reward-ready" onclick="claimRookieQuest('${q.id}')">${rewardText}</div>`;
            } else {
                html += `<div class="rq-reward rq-reward-locked">${rewardText}</div>`;
            }
            html += '</div>';
        }
        html += '</div>';
    }

    html += '</div></div>';
    document.getElementById('game-container').insertAdjacentHTML('beforeend', html);
}

function claimRookieQuest(qid) {
    const rp = rookieProgress[qid];
    if (!rp || rp.claimed) return;
    // 找到對應任務
    let quest = null;
    for (const stage of ROOKIE_STAGES) {
        quest = stage.quests.find(q => q.id === qid);
        if (quest) break;
    }
    if (!quest || rp.progress < quest.target) return;
    rp.claimed = true;
    if (quest.reward.gems) playerGems += quest.reward.gems;
    if (quest.reward.gold) playerGold += quest.reward.gold;
    updateResources();
    saveGame();
    SFX.play('confirm');
    showToast('獎勵已領取！');
    // 重新渲染
    closeSub('rookie-screen');
    showRookieQuests();
}

// ===== Toast 提示 =====
function showToast(msg) {
    let toast = document.getElementById('game-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'game-toast';
        toast.style.cssText = `
            position:absolute; top:40%; left:50%; transform:translate(-50%,-50%);
            background:rgba(0,0,0,0.85); color:#fff; padding:12px 28px;
            border-radius:8px; font-size:14px; letter-spacing:2px; z-index:999;
            pointer-events:none; opacity:0; transition:opacity 0.3s;
            border:1px solid rgba(255,215,0,0.15);
            box-shadow:0 4px 20px rgba(0,0,0,0.5);
            text-align:center;
        `;
        document.getElementById('game-container').appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.style.opacity = '0', 1800);
}
