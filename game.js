// ===== 五行轉珠遊戲 =====

// ===== 音效系統（Web Audio API 合成 — 清晰版） =====
const SFX = (() => {
    let ctx = null;
    let masterGain = null;
    let bgmPlaying = '';
    let _bgmVol = 0.35;
    let _sfxVol = 0.6;

    function init() {
        if (ctx) return;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = 1;
        masterGain.connect(ctx.destination);
    }

    function ensureCtx() {
        if (!ctx) init();
        if (ctx.state === 'suspended') ctx.resume();
    }

    function clamp(v) { return Math.max(0, Math.min(1, v)); }

    // 清晰短音：快速 attack、乾淨 linear release
    function ping(freq, dur, type, vol, delay) {
        ensureCtx();
        const t = ctx.currentTime + (delay || 0);
        const v = clamp((vol || 0.3) * _sfxVol);
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(v, t + 0.005);          // 5ms attack
        g.gain.linearRampToValueAtTime(v * 0.7, t + dur * 0.3); // sustain
        g.gain.linearRampToValueAtTime(0, t + dur);              // clean release
        osc.connect(g);
        g.connect(masterGain);
        osc.start(t);
        osc.stop(t + dur + 0.01);
    }

    // 帶濾波的音色
    function filteredPing(freq, dur, type, vol, filterType, filterFreq, delay) {
        ensureCtx();
        const t = ctx.currentTime + (delay || 0);
        const v = clamp((vol || 0.3) * _sfxVol);
        const osc = ctx.createOscillator();
        const flt = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = type || 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        flt.type = filterType || 'lowpass';
        flt.frequency.setValueAtTime(filterFreq || 2000, t);
        flt.Q.value = 1;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(v, t + 0.005);
        g.gain.linearRampToValueAtTime(0, t + dur);
        osc.connect(flt);
        flt.connect(g);
        g.connect(masterGain);
        osc.start(t);
        osc.stop(t + dur + 0.01);
    }

    // 清脆噪音打擊
    function hitNoise(dur, vol, freq, delay) {
        ensureCtx();
        const t = ctx.currentTime + (delay || 0);
        const v = clamp((vol || 0.15) * _sfxVol);
        const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = freq || 4000;
        bp.Q.value = 1.5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(v, t);
        g.gain.linearRampToValueAtTime(0, t + dur);
        src.connect(bp);
        bp.connect(g);
        g.connect(masterGain);
        src.start(t);
        src.stop(t + dur + 0.01);
    }

    // 低音鼓
    function kick(vol, delay) {
        ensureCtx();
        const t = ctx.currentTime + (delay || 0);
        const v = clamp((vol || 0.3) * _sfxVol);
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(v, t);
        g.gain.linearRampToValueAtTime(0, t + 0.15);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.16);
    }

    const sounds = {
        orbMove() {
            ping(1200, 0.04, 'sine', 0.15);
            ping(1500, 0.03, 'sine', 0.08, 0.015);
        },
        orbDrop() {
            ping(800, 0.06, 'sine', 0.2);
            ping(600, 0.05, 'triangle', 0.1, 0.02);
        },
        orbClear() {
            const f = 800 + Math.random() * 600;
            ping(f, 0.06, 'sine', 0.15);
            hitNoise(0.025, 0.06, 6000);
        },
        combo(n) {
            const freq = 700 * Math.pow(1.06, Math.min(n, 12));
            ping(freq, 0.1, 'sine', 0.25);
            ping(freq * 1.5, 0.07, 'triangle', 0.1, 0.03);
            if (n >= 5) ping(freq * 2, 0.08, 'sine', 0.08, 0.05);
        },
        bigCombo() {
            [700, 880, 1047, 1400].forEach((f, i) => {
                ping(f, 0.12, 'sine', 0.2, i * 0.05);
            });
        },
        hit() {
            hitNoise(0.06, 0.25, 3000);
            filteredPing(250, 0.08, 'sawtooth', 0.18, 'lowpass', 1500);
            kick(0.15);
        },
        enemyHit() {
            kick(0.25);
            hitNoise(0.08, 0.3, 2500);
            filteredPing(100, 0.12, 'sawtooth', 0.2, 'lowpass', 800, 0.02);
        },
        enemyDeath() {
            hitNoise(0.1, 0.15, 5000);
            [600, 800, 1000, 1300, 1600].forEach((f, i) => {
                ping(f, 0.12, 'sine', 0.15, i * 0.03);
            });
        },
        heal() {
            [700, 880, 1047].forEach((f, i) => {
                ping(f, 0.15, 'sine', 0.18, i * 0.07);
            });
        },
        skill() {
            hitNoise(0.03, 0.06, 8000);
            [880, 1100, 1320, 1568].forEach((f, i) => {
                ping(f, 0.1, 'sine', 0.2, 0.03 + i * 0.04);
            });
        },
        victory() {
            [700, 880, 1047, 1400, 1047, 1400, 1760].forEach((f, i) => {
                ping(f, 0.18, 'sine', 0.2, i * 0.1);
            });
        },
        defeat() {
            [440, 392, 349, 294].forEach((f, i) => {
                ping(f, 0.25, 'sine', 0.2, i * 0.18);
            });
        },
        tap() {
            ping(1000, 0.035, 'sine', 0.12);
            ping(1300, 0.025, 'sine', 0.06, 0.015);
        },
        confirm() {
            ping(880, 0.06, 'sine', 0.15);
            ping(1100, 0.07, 'sine', 0.12, 0.04);
        },
        error() {
            filteredPing(250, 0.1, 'square', 0.12, 'lowpass', 1000);
            filteredPing(220, 0.12, 'square', 0.08, 'lowpass', 800, 0.06);
        },
        gacha() {
            hitNoise(0.03, 0.08, 6000);
            [587, 740, 880, 1175].forEach((f, i) => {
                ping(f, 0.1, 'sine', 0.15, i * 0.06);
            });
        },
        gachaSSR() {
            [700, 880, 1047, 1400, 1760, 2093].forEach((f, i) => {
                ping(f, 0.2, 'sine', 0.2, i * 0.06);
                ping(f * 1.5, 0.12, 'triangle', 0.07, i * 0.06 + 0.02);
            });
            hitNoise(0.06, 0.06, 8000, 0.25);
        },
        levelUp() {
            [700, 880, 1047, 1400].forEach((f, i) => {
                ping(f, 0.18, 'sine', 0.2, i * 0.08);
            });
            ping(2093, 0.3, 'sine', 0.1, 0.35);
        },
        enemySkill() {
            filteredPing(280, 0.1, 'sawtooth', 0.15, 'lowpass', 1200);
            filteredPing(200, 0.12, 'square', 0.1, 'lowpass', 800, 0.04);
            hitNoise(0.05, 0.08, 3000, 0.08);
        },
        pageOpen() {
            ping(800, 0.04, 'sine', 0.1);
            ping(1100, 0.05, 'sine', 0.08, 0.025);
        },
        pageClose() {
            ping(1100, 0.04, 'sine', 0.1);
            ping(800, 0.05, 'sine', 0.08, 0.025);
        },
    };

    // ===== BGM 系統（乾淨版） =====
    let bgmInterval = null;
    let bgmNodes = [];

    function cleanBgmNodes() {
        bgmNodes.forEach(n => { try { n.stop(); } catch(e){} try { n.disconnect(); } catch(e){} });
        bgmNodes = [];
    }

    // 定期清理已結束的 BGM 節點，防止記憶體洩漏
    function pruneEndedNodes() {
        bgmNodes = bgmNodes.filter(n => {
            try {
                if (n.playbackState === 3 || (n.context && n.context.currentTime > (n._stopTime || Infinity))) {
                    try { n.disconnect(); } catch(e){}
                    return false;
                }
            } catch(e) { return false; }
            return true;
        });
    }

    function bgmPing(freq, dur, type, vol, delay) {
        ensureCtx();
        const t = ctx.currentTime + (delay || 0);
        const v = clamp(vol * _bgmVol);
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(v, t + 0.01);
        g.gain.linearRampToValueAtTime(v * 0.6, t + dur * 0.5);
        g.gain.linearRampToValueAtTime(0, t + dur);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(t);
        osc.stop(t + dur + 0.01);
        osc._stopTime = t + dur + 0.02;
        bgmNodes.push(osc);
    }

    function bgmKick(vol, delay) {
        ensureCtx();
        const t = ctx.currentTime + (delay || 0);
        const v = clamp(vol * _bgmVol);
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.1);
        g.gain.setValueAtTime(v, t);
        g.gain.linearRampToValueAtTime(0, t + 0.12);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.13);
        osc._stopTime = t + 0.14;
        bgmNodes.push(osc);
    }

    function bgmHihat(vol, delay) {
        ensureCtx();
        const t = ctx.currentTime + (delay || 0);
        const v = clamp(vol * _bgmVol);
        const len = Math.floor(ctx.sampleRate * 0.03);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 8000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(v, t);
        g.gain.linearRampToValueAtTime(0, t + 0.03);
        src.connect(hp);
        hp.connect(g);
        g.connect(masterGain);
        src.start(t);
        src.stop(t + 0.04);
        src._stopTime = t + 0.05;
        bgmNodes.push(src);
    }

    function startBGM(type) {
        ensureCtx();
        stopBGM();
        bgmPlaying = type;

        const chords = {
            lobby: [[262,330,392],[220,277,330],[349,440,523],[392,494,587]],
            battle: [[220,277,330],[262,330,392],[349,440,523],[196,247,294]],
        };
        const prog = chords[type] || chords.lobby;
        let ci = 0, beat = 0;
        const bpm = type === 'battle' ? 135 : 85;
        const beatMs = 60000 / bpm;
        const beatSec = beatMs / 1000;

        let tickCount = 0;
        function tick() {
            if (!ctx || bgmPlaying !== type) return;
            const chord = prog[ci];

            // 每 16 拍清理一次已結束的節點
            tickCount++;
            if (tickCount % 16 === 0) pruneEndedNodes();

            if (type === 'battle') {
                // 低音 bass（每拍第一下）
                if (beat === 0) bgmPing(chord[0] * 0.5, beatSec * 3.5, 'sine', 0.06);
                // kick + hihat 節奏
                if (beat === 0 || beat === 2) bgmKick(0.05);
                bgmHihat(0.025);
                // 琶音 triangle
                const arpF = chord[beat % chord.length] * 1;
                bgmPing(arpF, beatSec * 0.6, 'triangle', 0.04, 0);
            } else {
                // lobby: 柔和 pad
                if (beat === 0) {
                    chord.forEach(f => bgmPing(f, beatSec * 3.8, 'sine', 0.035));
                }
                // 輕柔琶音
                const arpF = chord[beat % chord.length] * 2;
                bgmPing(arpF, beatSec * 0.5, 'sine', 0.03, 0);
            }

            beat++;
            if (beat >= 4) { beat = 0; ci = (ci + 1) % prog.length; }
        }

        bgmInterval = setInterval(tick, beatMs);
        tick();
    }

    function stopBGM() {
        if (bgmInterval) { clearInterval(bgmInterval); bgmInterval = null; }
        cleanBgmNodes();
        bgmPlaying = '';
    }

    return {
        init,
        play(name, ...args) {
            try { ensureCtx(); if (sounds[name]) sounds[name](...args); } catch(e){}
        },
        startBGM,
        stopBGM,
        get bgmVolume() { return _bgmVol; },
        set bgmVolume(v) { _bgmVol = clamp(v); },
        get sfxVolume() { return _sfxVol; },
        set sfxVolume(v) { _sfxVol = clamp(v); },
        get playing() { return bgmPlaying; },
    };
})();

// 五行屬性定義
const ELEMENTS = {
    wood:  { name: '木', emoji: '🌿', color: '#2ed573', darkColor: '#1e8449', orbImg: '五行珠/木.png' },
    fire:  { name: '火', emoji: '🔥', color: '#ff4757', darkColor: '#c0392b', orbImg: '五行珠/火.png' },
    earth: { name: '土', emoji: '🪨', color: '#ffa502', darkColor: '#b8860b', orbImg: '五行珠/土.png' },
    metal: { name: '金', emoji: '⚔️', color: '#dfe6e9', darkColor: '#7f8c8d', orbImg: '五行珠/金.png' },
    water: { name: '水', emoji: '💧', color: '#3742fa', darkColor: '#1e3799', orbImg: '五行珠/水.png' },
    heal:  { name: '癒', emoji: '💖', color: '#ff6b9d', darkColor: '#c44569', orbImg: '五行珠/治癒.png' }
};

const SHENG = { wood:'fire', fire:'earth', earth:'metal', metal:'water', water:'wood' };
const KE = { wood:'earth', earth:'water', water:'fire', fire:'metal', metal:'wood' };
const ORB_TYPES = ['wood','fire','earth','metal','water','heal'];
const COLS = 6, ROWS = 5;

// 五行珠圖片載入（個別圖片）
const orbImages = {};
let orbImagesReady = 0;
const ORB_IMG_PATHS = {
    wood:  '五行珠/木.png',
    fire:  '五行珠/火.png',
    earth: '五行珠/土.png',
    metal: '五行珠/金.png',
    water: '五行珠/水.png',
    heal:  '五行珠/治癒.png',
};
for (const [type, path] of Object.entries(ORB_IMG_PATHS)) {
    const img = new Image();
    img.src = path;
    img.onload = function() {
        orbImages[type] = img;
        orbImagesReady++;
        if (orbImagesReady >= 6 && canvas && ctx) drawBoard();
    };
    orbImages[type] = img;
}

// 角色卡牌資料（全卡池）— 平衡版
// R: atk 300-500, hp 1500-2500, rcv 100-250, cost 5-8, maxLv 50
// SR: atk 500-750, hp 2500-4000, rcv 150-300, cost 10-15, maxLv 70
// SSR: atk 750-1000, hp 4000-6000, rcv 200-400, cost 18-25, maxLv 99
// 隊長技 mult: R 30~50%, SR 60~100%, SSR 100~160%（加法制）
// mult 格式: { type:'element'|'all', element:'fire', stat:'atk'|'hp'|'rcv', pct:0.5 }
const CHARACTERS = [
    // ===== 初始可選角色（R，index 0-4）=====
    { name:'雷光劍士',title:'雷光劍士',element:'metal',rarity:'R',race:'人',img:'角色卡牌/初始-金 雷光劍士 — 金 — 人 — 男.png',
      lv:1,maxLv:50,atk:450,hp:2200,rcv:180,cost:8,
      activeSkill:{name:'雷光斬擊',cd:10,desc:'將所有珠子轉化為金珠',effect:'convertAll_metal'},
      leaderSkill:{name:'雷光之威',desc:'金屬性角色攻擊力+50%',mult:[{type:'element',element:'metal',stat:'atk',pct:0.5}]},
      teamSkill:{name:'五行共鳴・金',desc:'隊伍中有3種以上屬性時\n金屬性角色攻擊力+20%'},
      bond:{name:'金之絆',desc:'與其他金屬性同隊時\n自身攻擊力+15%'} },
    { name:'炎焰戰士',title:'炎焰戰士',element:'fire',rarity:'R',race:'人',img:'角色卡牌/初始-火 炎焰戰士 — 火 — 人 — 男.png',
      lv:1,maxLv:50,atk:480,hp:2000,rcv:150,cost:7,
      activeSkill:{name:'烈焰衝擊',cd:8,desc:'2回合內火屬性攻擊力+80%',effect:'burst_fire'},
      leaderSkill:{name:'戰魂燃燒',desc:'火屬性角色攻擊力+50%',mult:[{type:'element',element:'fire',stat:'atk',pct:0.5}]},
      teamSkill:{name:'五行共鳴・火',desc:'隊伍中有3種以上屬性時\n火屬性角色攻擊力+20%'},
      bond:{name:'火之絆',desc:'與其他火屬性同隊時\n自身攻擊力+15%'} },
    { name:'潮汐法師',title:'潮汐法師',element:'water',rarity:'R',race:'人',img:'角色卡牌/初始-水 潮汐法師 — 水 — 人 — 女.png',
      lv:1,maxLv:50,atk:380,hp:2400,rcv:240,cost:7,
      activeSkill:{name:'潮汐水鏡',cd:9,desc:'回復全隊50%生命力',effect:'heal50_convertHeal'},
      leaderSkill:{name:'潮汐庇護',desc:'水屬性角色生命力+40%\n回復力+30%',mult:[{type:'element',element:'water',stat:'hp',pct:0.4},{type:'element',element:'water',stat:'rcv',pct:0.3}]},
      teamSkill:{name:'五行共鳴・水',desc:'隊伍中有3種以上屬性時\n水屬性角色回復力+25%'},
      bond:{name:'水之絆',desc:'與其他水屬性同隊時\n自身回復力+15%'} },
    { name:'翠葉弓手',title:'翠葉弓手',element:'wood',rarity:'R',race:'人',img:'角色卡牌/初始-木 翠葉弓手 — 木 — 人 — 女.png',
      lv:1,maxLv:50,atk:460,hp:2100,rcv:170,cost:7,
      activeSkill:{name:'翠葉箭雨',cd:10,desc:'延遲敵人行動2回合',effect:'delay2'},
      leaderSkill:{name:'翠葉之眼',desc:'木屬性角色攻擊力+45%',mult:[{type:'element',element:'wood',stat:'atk',pct:0.45}]},
      teamSkill:{name:'五行共鳴・木',desc:'隊伍中有3種以上屬性時\n木屬性角色攻擊力+20%'},
      bond:{name:'木之絆',desc:'與其他木屬性同隊時\n自身攻擊力+15%'} },
    { name:'岩石守衛',title:'岩石守衛',element:'earth',rarity:'R',race:'人',img:'角色卡牌/初始-土 岩石守衛 — 土 — 人 — 男.png',
      lv:1,maxLv:50,atk:400,hp:2500,rcv:200,cost:7,
      activeSkill:{name:'岩石淨化',cd:11,desc:'回復全隊30%生命力\n3回合防禦力+50%',effect:'heal30_def'},
      leaderSkill:{name:'岩石守護',desc:'土屬性角色生命力+40%\n回復力+30%',mult:[{type:'element',element:'earth',stat:'hp',pct:0.4},{type:'element',element:'earth',stat:'rcv',pct:0.3}]},
      teamSkill:{name:'五行共鳴・土',desc:'隊伍中有3種以上屬性時\n土屬性角色生命力+20%'},
      bond:{name:'土之絆',desc:'與其他土屬性同隊時\n自身生命力+15%'} },
    // ===== R 卡池（index 5-29）=====
    { name:'鐵衛劍士',title:'鐵衛劍士',element:'metal',rarity:'R',race:'人',img:'角色卡牌/R-01 鐵衛劍士 — 金 — 人 — 男.png',
      lv:1,maxLv:50,atk:350,hp:2500,rcv:120,cost:6,
      activeSkill:{name:'鐵壁防禦',cd:10,desc:'3回合減傷30%',effect:'shield30_3'},
      leaderSkill:{name:'鐵壁之心',desc:'金屬性角色生命力+40%',mult:[{type:'element',element:'metal',stat:'hp',pct:0.4}]},
      teamSkill:{name:'堅守陣線',desc:'隊伍中有2名以上金屬性時\n金屬性角色生命力+15%'},
      bond:{name:'金之絆',desc:'與其他金屬性同隊時\n自身生命力+10%'} },
    { name:'火焰弓手',title:'火焰弓手',element:'fire',rarity:'R',race:'人',img:'角色卡牌/R-02 火焰弓手 — 火 — 人 — 女.png',
      lv:1,maxLv:50,atk:470,hp:1800,rcv:160,cost:6,
      activeSkill:{name:'火箭連射',cd:8,desc:'隨機轉化3顆珠子為火珠',effect:'convert3_fire'},
      leaderSkill:{name:'烈焰之弓',desc:'火屬性角色攻擊力+40%',mult:[{type:'element',element:'fire',stat:'atk',pct:0.4}]},
      teamSkill:{name:'火力集中',desc:'隊伍中有2名以上火屬性時\n火屬性角色攻擊力+15%'},
      bond:{name:'火之絆',desc:'與其他火屬性同隊時\n自身攻擊力+10%'} },
    { name:'水晶法師',title:'水晶法師',element:'water',rarity:'R',race:'人',img:'角色卡牌/R-03 水晶法師 — 水 — 人 — 女.png',
      lv:1,maxLv:50,atk:380,hp:2100,rcv:230,cost:6,
      activeSkill:{name:'水晶治癒',cd:9,desc:'回復全隊40%生命力',effect:'heal40'},
      leaderSkill:{name:'水晶庇護',desc:'水屬性角色回復力+45%',mult:[{type:'element',element:'water',stat:'rcv',pct:0.45}]},
      teamSkill:{name:'治癒之水',desc:'隊伍中有2名以上水屬性時\n水屬性角色回復力+15%'},
      bond:{name:'水之絆',desc:'與其他水屬性同隊時\n自身回復力+10%'} },
    { name:'森林獵人',title:'森林獵人',element:'wood',rarity:'R',race:'人',img:'角色卡牌/R-04 森林獵人 — 木 — 人 — 男.png',
      lv:1,maxLv:50,atk:440,hp:2000,rcv:170,cost:6,
      activeSkill:{name:'翠箭穿心',cd:8,desc:'隨機轉化3顆珠子為木珠',effect:'convert3_wood'},
      leaderSkill:{name:'獵人之眼',desc:'木屬性角色攻擊力+40%',mult:[{type:'element',element:'wood',stat:'atk',pct:0.4}]},
      teamSkill:{name:'叢林伏擊',desc:'隊伍中有2名以上木屬性時\n木屬性角色攻擊力+15%'},
      bond:{name:'木之絆',desc:'與其他木屬性同隊時\n自身攻擊力+10%'} },
    { name:'岩石武僧',title:'岩石武僧',element:'earth',rarity:'R',race:'人',img:'角色卡牌/R-05 岩石武僧 — 土 — 人 — 男.png',
      lv:1,maxLv:50,atk:420,hp:2200,rcv:160,cost:6,
      activeSkill:{name:'岩拳碎擊',cd:10,desc:'隨機轉化3顆珠子為土珠',effect:'convert3_earth'},
      leaderSkill:{name:'武僧之道',desc:'土屬性角色攻擊力+35%\n生命力+15%',mult:[{type:'element',element:'earth',stat:'atk',pct:0.35},{type:'element',element:'earth',stat:'hp',pct:0.15}]},
      teamSkill:{name:'岩石意志',desc:'隊伍中有2名以上土屬性時\n土屬性角色攻擊力+15%'},
      bond:{name:'土之絆',desc:'與其他土屬性同隊時\n自身攻擊力+10%'} },
    { name:'金光祭司',title:'金光祭司',element:'metal',rarity:'R',race:'神',img:'角色卡牌/R-06 金光祭司 — 金 — 神 — 女.png',
      lv:1,maxLv:50,atk:460,hp:1700,rcv:190,cost:6,
      activeSkill:{name:'金光祝福',cd:9,desc:'2回合內金屬性攻擊力+60%',effect:'burst_metal'},
      leaderSkill:{name:'金光庇護',desc:'金屬性角色攻擊力+35%\n回復力+20%',mult:[{type:'element',element:'metal',stat:'atk',pct:0.35},{type:'element',element:'metal',stat:'rcv',pct:0.2}]},
      teamSkill:{name:'神族祝福',desc:'隊伍中有神時\n全隊回復力+10%'},
      bond:{name:'神族之絆',desc:'與其他神同隊時\n自身回復力+10%'} },
    { name:'炎陽天使',title:'炎陽天使',element:'fire',rarity:'R',race:'神',img:'角色卡牌/R-07 炎陽天使 — 火 — 神 — 女.png',
      lv:1,maxLv:50,atk:330,hp:2500,rcv:140,cost:6,
      activeSkill:{name:'炎陽之翼',cd:11,desc:'3回合減傷35%',effect:'shield35_3'},
      leaderSkill:{name:'炎陽守護',desc:'火屬性角色生命力+45%',mult:[{type:'element',element:'fire',stat:'hp',pct:0.45}]},
      teamSkill:{name:'天使祝福',desc:'隊伍中有神時\n全隊生命力+10%'},
      bond:{name:'神族之絆',desc:'與其他神同隊時\n自身生命力+10%'} },
    { name:'冰霜女神',title:'冰霜女神',element:'water',rarity:'R',race:'神',img:'角色卡牌/R-08 冰霜女神 — 水 — 神 — 女.png',
      lv:1,maxLv:50,atk:490,hp:1600,rcv:150,cost:7,
      activeSkill:{name:'冰霜連斬',cd:7,desc:'隨機轉化3顆珠子為水珠',effect:'convert3_water'},
      leaderSkill:{name:'冰霜之心',desc:'水屬性角色攻擊力+45%',mult:[{type:'element',element:'water',stat:'atk',pct:0.45}]},
      teamSkill:{name:'女神祝福',desc:'隊伍中有神時\n全隊攻擊力+10%'},
      bond:{name:'神族之絆',desc:'與其他神同隊時\n自身攻擊力+10%'} },
    { name:'翠葉仙子',title:'翠葉仙子',element:'wood',rarity:'R',race:'神',img:'角色卡牌/R-09 翠葉仙子 — 木 — 神 — 女.png',
      lv:1,maxLv:50,atk:370,hp:2200,rcv:220,cost:6,
      activeSkill:{name:'翠葉纏繞',cd:10,desc:'延遲敵人行動1回合',effect:'delay1'},
      leaderSkill:{name:'仙子庇護',desc:'木屬性角色生命力+30%\n回復力+30%',mult:[{type:'element',element:'wood',stat:'hp',pct:0.3},{type:'element',element:'wood',stat:'rcv',pct:0.3}]},
      teamSkill:{name:'自然治癒',desc:'隊伍中有2名以上木屬性時\n木屬性角色回復力+15%'},
      bond:{name:'木之絆',desc:'與其他木屬性同隊時\n自身回復力+10%'} },
    { name:'大地守護神',title:'大地守護神',element:'earth',rarity:'R',race:'神',img:'角色卡牌/R-10 大地守護神 — 土 — 神 — 男.png',
      lv:1,maxLv:50,atk:500,hp:1500,rcv:130,cost:7,
      activeSkill:{name:'大地震擊',cd:7,desc:'隨機轉化3顆珠子為土珠',effect:'convert3_earth'},
      leaderSkill:{name:'大地之力',desc:'土屬性角色攻擊力+50%',mult:[{type:'element',element:'earth',stat:'atk',pct:0.5}]},
      teamSkill:{name:'守護之力',desc:'隊伍中有神時\n全隊攻擊力+10%'},
      bond:{name:'神族之絆',desc:'與其他神同隊時\n自身攻擊力+10%'} },
    { name:'暗影刺客',title:'暗影刺客',element:'metal',rarity:'R',race:'魔',img:'角色卡牌/R-11 暗影刺客 — 金 — 魔 — 女.png',
      lv:1,maxLv:50,atk:450,hp:2100,rcv:140,cost:7,
      activeSkill:{name:'暗影突擊',cd:8,desc:'2回合內金屬性攻擊力+70%',effect:'burst_metal_70'},
      leaderSkill:{name:'暗影之刃',desc:'金屬性角色攻擊力+40%\n生命力+15%',mult:[{type:'element',element:'metal',stat:'atk',pct:0.4},{type:'element',element:'metal',stat:'hp',pct:0.15}]},
      teamSkill:{name:'魔族之力',desc:'隊伍中有魔時\n全隊攻擊力+10%'},
      bond:{name:'魔族之絆',desc:'與其他魔同隊時\n自身攻擊力+10%'} },
    { name:'獄焰術士',title:'獄焰術士',element:'fire',rarity:'R',race:'魔',img:'角色卡牌/R-12 獄焰術士 — 火 — 魔 — 男.png',
      lv:1,maxLv:50,atk:360,hp:2300,rcv:210,cost:6,
      activeSkill:{name:'獄焰衝擊',cd:9,desc:'隨機轉化4顆珠子為火珠',effect:'convert4_fire'},
      leaderSkill:{name:'獄焰之力',desc:'火屬性角色攻擊力+40%\n回復力+15%',mult:[{type:'element',element:'fire',stat:'atk',pct:0.4},{type:'element',element:'fire',stat:'rcv',pct:0.15}]},
      teamSkill:{name:'魔焰共鳴',desc:'隊伍中有魔時\n全隊攻擊力+10%'},
      bond:{name:'魔族之絆',desc:'與其他魔同隊時\n自身攻擊力+10%'} },
    { name:'深淵巫女',title:'深淵巫女',element:'water',rarity:'R',race:'魔',img:'角色卡牌/R-13 深淵巫女 — 水 — 魔 — 女.png',
      lv:1,maxLv:50,atk:430,hp:2300,rcv:130,cost:7,
      activeSkill:{name:'深淵咒術',cd:8,desc:'回復全隊35%生命力',effect:'heal35'},
      leaderSkill:{name:'深淵之力',desc:'水屬性角色攻擊力+40%\n生命力+15%',mult:[{type:'element',element:'water',stat:'atk',pct:0.4},{type:'element',element:'water',stat:'hp',pct:0.15}]},
      teamSkill:{name:'深淵共鳴',desc:'隊伍中有魔時\n全隊生命力+10%'},
      bond:{name:'魔族之絆',desc:'與其他魔同隊時\n自身生命力+10%'} },
    { name:'腐化德魯伊',title:'腐化德魯伊',element:'wood',rarity:'R',race:'魔',img:'角色卡牌/R-14 腐化德魯伊 — 木 — 魔 — 男.png',
      lv:1,maxLv:50,atk:480,hp:1700,rcv:160,cost:7,
      activeSkill:{name:'腐化之力',cd:7,desc:'隨機轉化4顆珠子為木珠',effect:'convert4_wood'},
      leaderSkill:{name:'腐化之術',desc:'木屬性角色攻擊力+45%',mult:[{type:'element',element:'wood',stat:'atk',pct:0.45}]},
      teamSkill:{name:'腐化共鳴',desc:'隊伍中有魔時\n全隊攻擊力+10%'},
      bond:{name:'魔族之絆',desc:'與其他魔同隊時\n自身攻擊力+10%'} },
    { name:'岩漿戰士',title:'岩漿戰士',element:'earth',rarity:'R',race:'魔',img:'角色卡牌/R-15 岩漿戰士 — 土 — 魔 — 男.png',
      lv:1,maxLv:50,atk:420,hp:2300,rcv:140,cost:7,
      activeSkill:{name:'岩漿衝鋒',cd:9,desc:'2回合內土屬性攻擊力+70%',effect:'burst_earth_70'},
      leaderSkill:{name:'岩漿之威',desc:'土屬性角色攻擊力+35%\n生命力+20%',mult:[{type:'element',element:'earth',stat:'atk',pct:0.35},{type:'element',element:'earth',stat:'hp',pct:0.2}]},
      teamSkill:{name:'岩漿共鳴',desc:'隊伍中有魔時\n全隊生命力+10%'},
      bond:{name:'魔族之絆',desc:'與其他魔同隊時\n自身生命力+10%'} },
    { name:'雷龍騎士',title:'雷龍騎士',element:'metal',rarity:'R',race:'龍',img:'角色卡牌/R-16 雷龍騎士 — 金 — 龍 — 男.png',
      lv:1,maxLv:50,atk:460,hp:1900,rcv:170,cost:6,
      activeSkill:{name:'雷龍衝擊',cd:8,desc:'隨機轉化4顆珠子為金珠',effect:'convert4_metal'},
      leaderSkill:{name:'雷龍之力',desc:'金屬性角色攻擊力+40%\n回復力+15%',mult:[{type:'element',element:'metal',stat:'atk',pct:0.4},{type:'element',element:'metal',stat:'rcv',pct:0.15}]},
      teamSkill:{name:'龍族之力',desc:'隊伍中有龍時\n全隊攻擊力+10%'},
      bond:{name:'龍族之絆',desc:'與其他龍同隊時\n自身攻擊力+10%'} },
    { name:'炎龍戰士',title:'炎龍戰士',element:'fire',rarity:'R',race:'龍',img:'角色卡牌/R-17 炎龍戰士 — 火 — 龍 — 男.png',
      lv:1,maxLv:50,atk:390,hp:2100,rcv:220,cost:6,
      activeSkill:{name:'炎龍吐息',cd:9,desc:'隨機轉化4顆珠子為火珠',effect:'convert4_fire'},
      leaderSkill:{name:'炎龍之力',desc:'火屬性角色攻擊力+30%\n回復力+30%',mult:[{type:'element',element:'fire',stat:'atk',pct:0.3},{type:'element',element:'fire',stat:'rcv',pct:0.3}]},
      teamSkill:{name:'龍焰共鳴',desc:'隊伍中有龍時\n全隊回復力+10%'},
      bond:{name:'龍族之絆',desc:'與其他龍同隊時\n自身回復力+10%'} },
    { name:'冰龍公主',title:'冰龍公主',element:'water',rarity:'R',race:'龍',img:'角色卡牌/R-18 冰龍公主 — 水 — 龍 — 女.png',
      lv:1,maxLv:50,atk:370,hp:2200,rcv:200,cost:6,
      activeSkill:{name:'冰龍吐息',cd:10,desc:'回復全隊30%生命力',effect:'heal30'},
      leaderSkill:{name:'冰龍庇護',desc:'水屬性角色生命力+35%\n回復力+20%',mult:[{type:'element',element:'water',stat:'hp',pct:0.35},{type:'element',element:'water',stat:'rcv',pct:0.2}]},
      teamSkill:{name:'冰龍之力',desc:'隊伍中有龍時\n全隊生命力+10%'},
      bond:{name:'龍族之絆',desc:'與其他龍同隊時\n自身生命力+10%'} },
    { name:'翠龍射手',title:'翠龍射手',element:'wood',rarity:'R',race:'龍',img:'角色卡牌/R-19 翠龍射手 — 木 — 龍 — 女.png',
      lv:1,maxLv:50,atk:410,hp:2200,rcv:150,cost:6,
      activeSkill:{name:'翠龍箭雨',cd:8,desc:'隨機轉化3顆珠子為木珠',effect:'convert3_wood'},
      leaderSkill:{name:'翠龍之力',desc:'木屬性角色攻擊力+40%',mult:[{type:'element',element:'wood',stat:'atk',pct:0.4}]},
      teamSkill:{name:'翠龍共鳴',desc:'隊伍中有龍時\n全隊攻擊力+10%'},
      bond:{name:'龍族之絆',desc:'與其他龍同隊時\n自身攻擊力+10%'} },
    { name:'土龍守衛',title:'土龍守衛',element:'earth',rarity:'R',race:'龍',img:'角色卡牌/R-20 土龍守衛 — 土 — 龍 — 男.png',
      lv:1,maxLv:50,atk:380,hp:2400,rcv:160,cost:6,
      activeSkill:{name:'土龍護盾',cd:11,desc:'3回合減傷25%\n回復全隊20%生命力',effect:'shield25_3_heal20'},
      leaderSkill:{name:'土龍守護',desc:'土屬性角色生命力+40%\n回復力+15%',mult:[{type:'element',element:'earth',stat:'hp',pct:0.4},{type:'element',element:'earth',stat:'rcv',pct:0.15}]},
      teamSkill:{name:'土龍共鳴',desc:'隊伍中有龍時\n全隊生命力+10%'},
      bond:{name:'龍族之絆',desc:'與其他龍同隊時\n自身生命力+10%'} },
    { name:'雷虎戰士',title:'雷虎戰士',element:'metal',rarity:'R',race:'獸',img:'角色卡牌/R-21 雷虎戰士 — 金 — 獸 — 男.png',
      lv:1,maxLv:50,atk:470,hp:2000,rcv:150,cost:7,
      activeSkill:{name:'雷虎衝擊',cd:8,desc:'2回合內金屬性攻擊力+70%',effect:'burst_metal_70'},
      leaderSkill:{name:'雷虎之魂',desc:'金屬性角色攻擊力+45%',mult:[{type:'element',element:'metal',stat:'atk',pct:0.45}]},
      teamSkill:{name:'獸族之力',desc:'隊伍中有獸時\n全隊攻擊力+10%'},
      bond:{name:'獸族之絆',desc:'與其他獸同隊時\n自身攻擊力+10%'} },
    { name:'火狐少女',title:'火狐少女',element:'fire',rarity:'R',race:'獸',img:'角色卡牌/R-22 火狐少女 — 火 — 獸 — 女.png',
      lv:1,maxLv:50,atk:440,hp:1900,rcv:200,cost:6,
      activeSkill:{name:'狐火幻術',cd:9,desc:'隨機轉化4顆珠子為火珠',effect:'convert4_fire'},
      leaderSkill:{name:'狐火之力',desc:'火屬性角色攻擊力+40%\n回復力+15%',mult:[{type:'element',element:'fire',stat:'atk',pct:0.4},{type:'element',element:'fire',stat:'rcv',pct:0.15}]},
      teamSkill:{name:'狐族之力',desc:'隊伍中有獸時\n全隊回復力+10%'},
      bond:{name:'獸族之絆',desc:'與其他獸同隊時\n自身回復力+10%'} },
    { name:'冰狼騎士',title:'冰狼騎士',element:'water',rarity:'R',race:'獸',img:'角色卡牌/R-23 冰狼騎士 — 水 — 獸 — 男.png',
      lv:1,maxLv:50,atk:430,hp:2100,rcv:170,cost:7,
      activeSkill:{name:'冰狼突擊',cd:8,desc:'隨機轉化3顆珠子為水珠',effect:'convert3_water'},
      leaderSkill:{name:'冰狼之魂',desc:'水屬性角色攻擊力+40%\n生命力+15%',mult:[{type:'element',element:'water',stat:'atk',pct:0.4},{type:'element',element:'water',stat:'hp',pct:0.15}]},
      teamSkill:{name:'狼族之力',desc:'隊伍中有獸時\n全隊生命力+10%'},
      bond:{name:'獸族之絆',desc:'與其他獸同隊時\n自身生命力+10%'} },
    { name:'翠鹿遊俠',title:'翠鹿遊俠',element:'wood',rarity:'R',race:'獸',img:'角色卡牌/R-24 翠鹿遊俠 — 木 — 獸 — 女.png',
      lv:1,maxLv:50,atk:400,hp:2200,rcv:190,cost:6,
      activeSkill:{name:'翠鹿疾風',cd:9,desc:'回復全隊30%生命力',effect:'heal30'},
      leaderSkill:{name:'翠鹿庇護',desc:'木屬性角色生命力+35%\n回復力+25%',mult:[{type:'element',element:'wood',stat:'hp',pct:0.35},{type:'element',element:'wood',stat:'rcv',pct:0.25}]},
      teamSkill:{name:'鹿族之力',desc:'隊伍中有獸時\n全隊回復力+10%'},
      bond:{name:'獸族之絆',desc:'與其他獸同隊時\n自身回復力+10%'} },
    { name:'熊人戰士',title:'熊人戰士',element:'earth',rarity:'R',race:'獸',img:'角色卡牌/R-25 熊人戰士 — 土 — 獸 — 男.png',
      lv:1,maxLv:50,atk:420,hp:2400,rcv:140,cost:7,
      activeSkill:{name:'熊掌衝擊',cd:8,desc:'隨機轉化3顆珠子為土珠',effect:'convert3_earth'},
      leaderSkill:{name:'熊人之力',desc:'土屬性角色攻擊力+40%\n生命力+20%',mult:[{type:'element',element:'earth',stat:'atk',pct:0.4},{type:'element',element:'earth',stat:'hp',pct:0.2}]},
      teamSkill:{name:'熊族之力',desc:'隊伍中有獸時\n全隊生命力+10%'},
      bond:{name:'獸族之絆',desc:'與其他獸同隊時\n自身生命力+10%'} },
    // ===== SR 卡池（index 30-49）=====
    { name:'翠風劍聖',title:'翠風劍聖',element:'wood',rarity:'SR',race:'人',img:'角色卡牌/SR-01 翠風劍聖 — 木 — 人 — 男.png',
      lv:1,maxLv:70,atk:680,hp:3200,rcv:200,cost:12,
      activeSkill:{name:'翠風斬',cd:8,desc:'隨機轉化6顆珠子為木珠',effect:'convert6_wood'},
      leaderSkill:{name:'翠風之威',desc:'木屬性角色攻擊力+80%',mult:[{type:'element',element:'wood',stat:'atk',pct:0.8}]},
      teamSkill:{name:'劍聖之道',desc:'隊伍中有人時\n全隊攻擊力+10%'},
      bond:{name:'人族之絆',desc:'與其他人同隊時\n自身攻擊力+15%'} },
    { name:'大地祭司',title:'大地祭司',element:'earth',rarity:'SR',race:'人',img:'角色卡牌/SR-02 大地祭司 — 土 — 人 — 女.png',
      lv:1,maxLv:70,atk:620,hp:3500,rcv:220,cost:12,
      activeSkill:{name:'大地護盾',cd:9,desc:'3回合減傷40%\n回復全隊30%生命力',effect:'shield40_3_heal30'},
      leaderSkill:{name:'大地守護',desc:'土屬性角色生命力+60%\n回復力+40%',mult:[{type:'element',element:'earth',stat:'hp',pct:0.6},{type:'element',element:'earth',stat:'rcv',pct:0.4}]},
      teamSkill:{name:'守護之力',desc:'隊伍中有人時\n全隊生命力+10%'},
      bond:{name:'人族之絆',desc:'與其他人同隊時\n自身生命力+15%'} },
    { name:'月華巫女',title:'月華巫女',element:'water',rarity:'SR',race:'人',img:'角色卡牌/SR-03 月華巫女 — 水 — 人 — 女.png',
      lv:1,maxLv:70,atk:580,hp:3500,rcv:280,cost:12,
      activeSkill:{name:'月華綻放',cd:9,desc:'回復全隊60%生命力\n隨機生成4顆癒珠',effect:'heal60_genHeal4'},
      leaderSkill:{name:'月華庇護',desc:'水屬性角色生命力+60%\n回復力+50%',mult:[{type:'element',element:'water',stat:'hp',pct:0.6},{type:'element',element:'water',stat:'rcv',pct:0.5}]},
      teamSkill:{name:'巫女祝福',desc:'隊伍中有人時\n全隊回復力+15%'},
      bond:{name:'人族之絆',desc:'與其他人同隊時\n自身回復力+15%'} },
    { name:'緋櫻忍者',title:'緋櫻忍者',element:'fire',rarity:'SR',race:'人',img:'角色卡牌/SR-04 緋櫻忍者 — 火 — 人 — 女.png',
      lv:1,maxLv:70,atk:650,hp:3800,rcv:170,cost:14,
      activeSkill:{name:'緋櫻亂舞',cd:10,desc:'4回合減傷40%',effect:'shield40_4'},
      leaderSkill:{name:'緋櫻之道',desc:'火屬性角色生命力+70%\n攻擊力+40%',mult:[{type:'element',element:'fire',stat:'hp',pct:0.7},{type:'element',element:'fire',stat:'atk',pct:0.4}]},
      teamSkill:{name:'忍者之力',desc:'隊伍中有人時\n全隊生命力+10%'},
      bond:{name:'人族之絆',desc:'與其他人同隊時\n自身生命力+15%'} },
    { name:'冰蓮仙子',title:'冰蓮仙子',element:'water',rarity:'SR',race:'神',img:'角色卡牌/SR-05 冰蓮仙子 — 水 — 神 — 女.png',
      lv:1,maxLv:70,atk:720,hp:2800,rcv:180,cost:13,
      activeSkill:{name:'冰蓮綻放',cd:7,desc:'2回合內水屬性攻擊力+100%',effect:'burst_water_100'},
      leaderSkill:{name:'冰蓮之力',desc:'水屬性角色攻擊力+90%',mult:[{type:'element',element:'water',stat:'atk',pct:0.9}]},
      teamSkill:{name:'神族之力',desc:'隊伍中有神時\n全隊攻擊力+10%'},
      bond:{name:'神族之絆',desc:'與其他神同隊時\n自身攻擊力+15%'} },
    { name:'金剛力士',title:'金剛力士',element:'metal',rarity:'SR',race:'神',img:'角色卡牌/SR-06 金剛力士 — 金 — 神 — 男.png',
      lv:1,maxLv:70,atk:700,hp:3000,rcv:200,cost:13,
      activeSkill:{name:'金剛衝擊',cd:8,desc:'隨機轉化6顆珠子為金珠',effect:'convert6_metal'},
      leaderSkill:{name:'金剛之威',desc:'金屬性角色攻擊力+80%\n生命力+30%',mult:[{type:'element',element:'metal',stat:'atk',pct:0.8},{type:'element',element:'metal',stat:'hp',pct:0.3}]},
      teamSkill:{name:'神族之力',desc:'隊伍中有神時\n全隊攻擊力+10%'},
      bond:{name:'神族之絆',desc:'與其他神同隊時\n自身攻擊力+15%'} },
    { name:'花靈女王',title:'花靈女王',element:'wood',rarity:'SR',race:'神',img:'角色卡牌/SR-07 花靈女王 — 木 — 神 — 女.png',
      lv:1,maxLv:70,atk:680,hp:3200,rcv:210,cost:12,
      activeSkill:{name:'花靈綻放',cd:8,desc:'2回合內木屬性攻擊力+90%',effect:'burst_wood_90'},
      leaderSkill:{name:'花靈之威',desc:'木屬性角色攻擊力+80%\n回復力+30%',mult:[{type:'element',element:'wood',stat:'atk',pct:0.8},{type:'element',element:'wood',stat:'rcv',pct:0.3}]},
      teamSkill:{name:'神族之力',desc:'隊伍中有神時\n全隊攻擊力+10%'},
      bond:{name:'神族之絆',desc:'與其他神同隊時\n自身攻擊力+15%'} },
    { name:'雷霆戰神',title:'雷霆戰神',element:'metal',rarity:'SR',race:'神',img:'角色卡牌/SR-08 雷霆戰神 — 金 — 神 — 男.png',
      lv:1,maxLv:70,atk:600,hp:4000,rcv:160,cost:14,
      activeSkill:{name:'雷霆壁壘',cd:10,desc:'5回合減傷35%\n回復全隊25%生命力',effect:'shield35_5_heal25'},
      leaderSkill:{name:'雷霆之威',desc:'金屬性角色生命力+80%',mult:[{type:'element',element:'metal',stat:'hp',pct:0.8}]},
      teamSkill:{name:'戰神之力',desc:'隊伍中有神時\n全隊生命力+10%'},
      bond:{name:'神族之絆',desc:'與其他神同隊時\n自身生命力+15%'} },
    { name:'獄焰修羅',title:'獄焰修羅',element:'fire',rarity:'SR',race:'魔',img:'角色卡牌/SR-09 獄焰修羅 — 火 — 魔 — 男.png',
      lv:1,maxLv:70,atk:710,hp:3100,rcv:190,cost:13,
      activeSkill:{name:'獄焰爆裂',cd:8,desc:'隨機轉化6顆珠子為火珠\n2回合內火屬性攻擊力+60%',effect:'convert6_fire_burst60'},
      leaderSkill:{name:'修羅之威',desc:'火屬性角色攻擊力+85%',mult:[{type:'element',element:'fire',stat:'atk',pct:0.85}]},
      teamSkill:{name:'魔族之力',desc:'隊伍中有魔時\n全隊攻擊力+10%'},
      bond:{name:'魔族之絆',desc:'與其他魔同隊時\n自身攻擊力+15%'} },
    { name:'暗影女王',title:'暗影女王',element:'water',rarity:'SR',race:'魔',img:'角色卡牌/SR-10 暗影女王 — 水 — 魔 — 女.png',
      lv:1,maxLv:70,atk:690,hp:3000,rcv:230,cost:12,
      activeSkill:{name:'暗影波動',cd:8,desc:'隨機轉化6顆珠子為水珠',effect:'convert6_water'},
      leaderSkill:{name:'暗影之舞',desc:'水屬性角色攻擊力+80%\n回復力+30%',mult:[{type:'element',element:'water',stat:'atk',pct:0.8},{type:'element',element:'water',stat:'rcv',pct:0.3}]},
      teamSkill:{name:'魔族之力',desc:'隊伍中有魔時\n全隊回復力+10%'},
      bond:{name:'魔族之絆',desc:'與其他魔同隊時\n自身回復力+15%'} },
    { name:'腐化君主',title:'腐化君主',element:'wood',rarity:'SR',race:'魔',img:'角色卡牌/SR-11 腐化君主 — 木 — 魔 — 男.png',
      lv:1,maxLv:70,atk:600,hp:3400,rcv:270,cost:12,
      activeSkill:{name:'腐化侵蝕',cd:9,desc:'回復全隊55%生命力\n隨機生成3顆癒珠',effect:'heal55_genHeal3'},
      leaderSkill:{name:'腐化之力',desc:'木屬性角色生命力+60%\n回復力+50%',mult:[{type:'element',element:'wood',stat:'hp',pct:0.6},{type:'element',element:'wood',stat:'rcv',pct:0.5}]},
      teamSkill:{name:'魔族祝福',desc:'隊伍中有魔時\n全隊回復力+15%'},
      bond:{name:'魔族之絆',desc:'與其他魔同隊時\n自身回復力+15%'} },
    { name:'地裂巨人',title:'地裂巨人',element:'earth',rarity:'SR',race:'魔',img:'角色卡牌/SR-12 地裂巨人 — 土 — 魔 — 男.png',
      lv:1,maxLv:70,atk:730,hp:2700,rcv:180,cost:13,
      activeSkill:{name:'地裂衝擊',cd:7,desc:'2回合內土屬性攻擊力+100%',effect:'burst_earth_100'},
      leaderSkill:{name:'地裂之力',desc:'土屬性角色攻擊力+90%',mult:[{type:'element',element:'earth',stat:'atk',pct:0.9}]},
      teamSkill:{name:'魔族之力',desc:'隊伍中有魔時\n全隊攻擊力+10%'},
      bond:{name:'魔族之絆',desc:'與其他魔同隊時\n自身攻擊力+15%'} },
    { name:'炎龍將軍',title:'炎龍將軍',element:'fire',rarity:'SR',race:'龍',img:'角色卡牌/SR-13 炎龍將軍 — 火 — 龍 — 男.png',
      lv:1,maxLv:70,atk:620,hp:3600,rcv:250,cost:13,
      activeSkill:{name:'炎龍咆哮',cd:9,desc:'回復全隊50%生命力\n3回合減傷30%',effect:'heal50_shield30_3'},
      leaderSkill:{name:'炎龍之威',desc:'火屬性角色生命力+70%\n回復力+40%',mult:[{type:'element',element:'fire',stat:'hp',pct:0.7},{type:'element',element:'fire',stat:'rcv',pct:0.4}]},
      teamSkill:{name:'龍族之力',desc:'隊伍中有龍時\n全隊生命力+10%'},
      bond:{name:'龍族之絆',desc:'與其他龍同隊時\n自身生命力+15%'} },
    { name:'深淵海將',title:'深淵海將',element:'water',rarity:'SR',race:'龍',img:'角色卡牌/SR-14 深淵海將 — 水 — 龍 — 男.png',
      lv:1,maxLv:70,atk:700,hp:3100,rcv:190,cost:13,
      activeSkill:{name:'深淵衝擊',cd:8,desc:'隨機轉化6顆珠子為水珠',effect:'convert6_water'},
      leaderSkill:{name:'深淵之威',desc:'水屬性角色攻擊力+85%\n生命力+20%',mult:[{type:'element',element:'water',stat:'atk',pct:0.85},{type:'element',element:'water',stat:'hp',pct:0.2}]},
      teamSkill:{name:'龍族之力',desc:'隊伍中有龍時\n全隊攻擊力+10%'},
      bond:{name:'龍族之絆',desc:'與其他龍同隊時\n自身攻擊力+15%'} },
    { name:'蒼海龍騎',title:'蒼海龍騎',element:'water',rarity:'SR',race:'龍',img:'角色卡牌/SR-15 蒼海龍騎 — 水 — 龍 — 男.png',
      lv:1,maxLv:70,atk:740,hp:2900,rcv:170,cost:14,
      activeSkill:{name:'蒼海衝鋒',cd:7,desc:'2回合內水屬性攻擊力+100%\n隨機轉化4顆珠子為水珠',effect:'burst_water_100_convert4'},
      leaderSkill:{name:'蒼海之威',desc:'水屬性角色攻擊力+95%',mult:[{type:'element',element:'water',stat:'atk',pct:0.95}]},
      teamSkill:{name:'龍族之力',desc:'隊伍中有龍時\n全隊攻擊力+10%'},
      bond:{name:'龍族之絆',desc:'與其他龍同隊時\n自身攻擊力+15%'} },
    { name:'翠玉龍姬',title:'翠玉龍姬',element:'wood',rarity:'SR',race:'龍',img:'角色卡牌/SR-16 翠玉龍姬 — 木 — 龍 — 女.png',
      lv:1,maxLv:70,atk:660,hp:3300,rcv:240,cost:12,
      activeSkill:{name:'翠玉吐息',cd:8,desc:'隨機轉化6顆珠子為木珠\n回復全隊25%生命力',effect:'convert6_wood_heal25'},
      leaderSkill:{name:'翠玉庇護',desc:'木屬性角色攻擊力+75%\n回復力+40%',mult:[{type:'element',element:'wood',stat:'atk',pct:0.75},{type:'element',element:'wood',stat:'rcv',pct:0.4}]},
      teamSkill:{name:'龍族之力',desc:'隊伍中有龍時\n全隊回復力+10%'},
      bond:{name:'龍族之絆',desc:'與其他龍同隊時\n自身回復力+15%'} },
    { name:'森之守護者',title:'森之守護者',element:'wood',rarity:'SR',race:'獸',img:'角色卡牌/SR-17 森之守護者 — 木 — 獸 — 男.png',
      lv:1,maxLv:70,atk:640,hp:3200,rcv:260,cost:12,
      activeSkill:{name:'森林祝福',cd:9,desc:'回復全隊50%生命力\n隨機生成3顆癒珠',effect:'heal50_genHeal3'},
      leaderSkill:{name:'森林庇護',desc:'木屬性角色生命力+55%\n回復力+55%',mult:[{type:'element',element:'wood',stat:'hp',pct:0.55},{type:'element',element:'wood',stat:'rcv',pct:0.55}]},
      teamSkill:{name:'獸族之力',desc:'隊伍中有獸時\n全隊回復力+10%'},
      bond:{name:'獸族之絆',desc:'與其他獸同隊時\n自身回復力+15%'} },
    { name:'白銀聖騎',title:'白銀聖騎',element:'metal',rarity:'SR',race:'獸',img:'角色卡牌/SR-18 白銀聖騎 — 金 — 獸 — 女.png',
      lv:1,maxLv:70,atk:710,hp:3400,rcv:180,cost:14,
      activeSkill:{name:'白銀衝鋒',cd:8,desc:'隨機轉化6顆珠子為金珠\n2回合內金屬性攻擊力+60%',effect:'convert6_metal_burst60'},
      leaderSkill:{name:'白銀聖威',desc:'金屬性角色攻擊力+85%\n生命力+25%',mult:[{type:'element',element:'metal',stat:'atk',pct:0.85},{type:'element',element:'metal',stat:'hp',pct:0.25}]},
      teamSkill:{name:'獸族之力',desc:'隊伍中有獸時\n全隊生命力+10%'},
      bond:{name:'獸族之絆',desc:'與其他獸同隊時\n自身生命力+15%'} },
    { name:'火獅戰神',title:'火獅戰神',element:'fire',rarity:'SR',race:'獸',img:'角色卡牌/SR-19 火獅戰神 — 火 — 獸 — 男.png',
      lv:1,maxLv:70,atk:660,hp:3500,rcv:200,cost:13,
      activeSkill:{name:'火獅咆哮',cd:9,desc:'3回合減傷35%\n2回合內火屬性攻擊力+70%',effect:'shield35_3_burst_fire_70'},
      leaderSkill:{name:'火獅之魂',desc:'火屬性角色攻擊力+70%\n生命力+40%',mult:[{type:'element',element:'fire',stat:'atk',pct:0.7},{type:'element',element:'fire',stat:'hp',pct:0.4}]},
      teamSkill:{name:'獸族之力',desc:'隊伍中有獸時\n全隊攻擊力+10%'},
      bond:{name:'獸族之絆',desc:'與其他獸同隊時\n自身攻擊力+15%'} },
    { name:'冰狼領主',title:'冰狼領主',element:'water',rarity:'SR',race:'獸',img:'角色卡牌/SR-20 冰狼領主 — 水 — 獸 — 男.png',
      lv:1,maxLv:70,atk:580,hp:3600,rcv:270,cost:12,
      activeSkill:{name:'冰狼結界',cd:10,desc:'5回合減傷40%',effect:'shield40_5'},
      leaderSkill:{name:'冰狼守護',desc:'水屬性角色生命力+70%\n回復力+40%',mult:[{type:'element',element:'water',stat:'hp',pct:0.7},{type:'element',element:'water',stat:'rcv',pct:0.4}]},
      teamSkill:{name:'獸族之力',desc:'隊伍中有獸時\n全隊生命力+10%'},
      bond:{name:'獸族之絆',desc:'與其他獸同隊時\n自身生命力+15%'} },
    // ===== SSR 卡池（index 50-54）=====
    { name:'天焰帝王',title:'天焰帝王',element:'fire',rarity:'SSR',race:'神',img:'角色卡牌/SSR-01 天焰帝王 — 火 — 神 — 男.png',
      lv:1,maxLv:99,atk:950,hp:5200,rcv:280,cost:22,
      activeSkill:{name:'天焰審判',cd:8,desc:'全盤轉為火珠和癒珠\n2回合內火屬性攻擊力+120%',effect:'convertAll_fire_heal_burst120'},
      leaderSkill:{name:'天焰帝威',desc:'火屬性角色攻擊力+160%',mult:[{type:'element',element:'fire',stat:'atk',pct:1.6}]},
      teamSkill:{name:'帝王之焰',desc:'隊伍中有神時\n全隊攻擊力+15%'},
      bond:{name:'神族之絆',desc:'與其他神同隊時\n自身攻擊力+20%'} },
    { name:'深海龍神',title:'深海龍神',element:'water',rarity:'SSR',race:'龍',img:'角色卡牌/SSR-02 深海龍神 — 水 — 龍 — 男.png',
      lv:1,maxLv:99,atk:800,hp:5800,rcv:380,cost:22,
      activeSkill:{name:'深海祝福',cd:9,desc:'回復全隊80%生命力\n5回合減傷30%',effect:'heal80_shield30_5'},
      leaderSkill:{name:'深海龍威',desc:'水屬性角色生命力+100%\n回復力+100%',mult:[{type:'element',element:'water',stat:'hp',pct:1.0},{type:'element',element:'water',stat:'rcv',pct:1.0}]},
      teamSkill:{name:'龍族祝福',desc:'隊伍中有龍時\n全隊回復力+15%'},
      bond:{name:'龍族之絆',desc:'與其他龍同隊時\n自身回復力+20%'} },
    { name:'世界樹之主',title:'世界樹之主',element:'wood',rarity:'SSR',race:'神',img:'角色卡牌/SSR-03 世界樹之主 — 木 — 神 — 男.png',
      lv:1,maxLv:99,atk:880,hp:5500,rcv:320,cost:23,
      activeSkill:{name:'世界樹之力',cd:8,desc:'全盤轉為木珠和癒珠\n回復全隊50%生命力',effect:'convertAll_wood_heal_heal50'},
      leaderSkill:{name:'世界樹庇護',desc:'木屬性角色攻擊力+120%\n生命力+50%',mult:[{type:'element',element:'wood',stat:'atk',pct:1.2},{type:'element',element:'wood',stat:'hp',pct:0.5}]},
      teamSkill:{name:'世界樹之恩',desc:'隊伍中有神時\n全隊生命力+15%'},
      bond:{name:'神族之絆',desc:'與其他神同隊時\n自身攻擊力+20%'} },
    { name:'終極霸主',title:'終極霸主',element:'metal',rarity:'SSR',race:'魔',img:'角色卡牌/SSR-04 終極霸主 — 金 — 魔 — 男.png',
      lv:1,maxLv:99,atk:1000,hp:4800,rcv:250,cost:24,
      activeSkill:{name:'霸主降臨',cd:7,desc:'全盤轉為金珠\n2回合內金屬性攻擊力+150%',effect:'convertAll_metal_burst150'},
      leaderSkill:{name:'終極霸威',desc:'金屬性角色攻擊力+160%',mult:[{type:'element',element:'metal',stat:'atk',pct:1.6}]},
      teamSkill:{name:'霸主之力',desc:'隊伍中有魔時\n全隊攻擊力+15%'},
      bond:{name:'魔族之絆',desc:'與其他魔同隊時\n自身攻擊力+20%'} },
    { name:'大地獸王',title:'大地獸王',element:'earth',rarity:'SSR',race:'獸',img:'角色卡牌/SSR-05 大地獸王 — 土 — 獸 — 男.png',
      lv:1,maxLv:99,atk:820,hp:6000,rcv:350,cost:23,
      activeSkill:{name:'大地咆哮',cd:9,desc:'回復全隊100%生命力\n5回合減傷40%',effect:'heal100_shield40_5'},
      leaderSkill:{name:'獸王護佑',desc:'土屬性角色生命力+120%\n回復力+80%',mult:[{type:'element',element:'earth',stat:'hp',pct:1.2},{type:'element',element:'earth',stat:'rcv',pct:0.8}]},
      teamSkill:{name:'獸王庇護',desc:'隊伍中有獸時\n全隊生命力+15%'},
      bond:{name:'獸族之絆',desc:'與其他獸同隊時\n自身生命力+20%'} },
];

// ===== 卡片強化系統 =====
const GROWTH_MULT = { 'R': 2.5, 'SR': 3.0, 'SSR': 3.5 };

// 強化等級：C(+0%) → B(+5%) → A(+10%) → S(+20%) → SS(+30%) → SSS(+50%)
const ENHANCE_GRADES = ['C', 'B', 'A', 'S', 'SS', 'SSS'];
const ENHANCE_BONUS = { 'C': 0, 'B': 0.05, 'A': 0.10, 'S': 0.20, 'SS': 0.30, 'SSS': 0.50 };
const ENHANCE_COLORS = { 'C': '#888', 'B': '#64c8ff', 'A': '#7bed9f', 'S': '#ffd700', 'SS': '#ff6b9d', 'SSS': '#c77dff' };

// 升級費用：gold = baseCost × level
const LEVELUP_GOLD_BASE = { 'R': 100, 'SR': 200, 'SSR': 400 };

// 強化費用：gold per grade
const ENHANCE_GOLD = { 'B': 5000, 'A': 15000, 'S': 50000, 'SS': 150000, 'SSS': 500000 };

// 計算卡片當前數值（含等級 + 強化等級）
function getCardStats(card) {
    const rarity = card.rarity || 'R';
    const lv = card.lv || 1;
    const maxLv = card.maxLv || 50;
    const grade = card.enhanceGrade || 'C';
    const mult = GROWTH_MULT[rarity] || 2.5;
    const baseHp = card.baseHp || card.hp || 0;
    const baseAtk = card.baseAtk || card.atk || 0;
    const baseRcv = card.baseRcv || card.rcv || 0;
    const maxHp = Math.floor(baseHp * mult);
    const maxAtk = Math.floor(baseAtk * mult);
    const maxRcv = Math.floor(baseRcv * mult);
    const progress = maxLv > 1 ? (lv - 1) / (maxLv - 1) : 0;
    const gradeBonus = 1 + (ENHANCE_BONUS[grade] || 0);
    return {
        hp: Math.floor((baseHp + (maxHp - baseHp) * progress) * gradeBonus),
        atk: Math.floor((baseAtk + (maxAtk - baseAtk) * progress) * gradeBonus),
        rcv: Math.floor((baseRcv + (maxRcv - baseRcv) * progress) * gradeBonus),
        maxHp, maxAtk, maxRcv
    };
}

// 確保卡片有 baseHp/baseAtk/baseRcv（首次初始化）
function ensureBaseStats(card) {
    if (!card.baseHp) card.baseHp = card.hp;
    if (!card.baseAtk) card.baseAtk = card.atk;
    if (!card.baseRcv) card.baseRcv = card.rcv;
    if (!card.enhanceGrade) card.enhanceGrade = 'C';
}

// 重新計算卡片數值（升級/強化後呼叫）
function recalcCardStats(card) {
    ensureBaseStats(card);
    const s = getCardStats(card);
    card.hp = s.hp;
    card.atk = s.atk;
    card.rcv = s.rcv;
}

// 升級卡片
function levelUpCard(card) {
    ensureBaseStats(card);
    const maxLv = card.maxLv || 50;
    if ((card.lv || 1) >= maxLv) return { success: false, msg: '已達最高等級' };
    const rarity = card.rarity || 'R';
    const cost = LEVELUP_GOLD_BASE[rarity] * (card.lv || 1);
    if (playerGold < cost) return { success: false, msg: '金幣不足' };
    playerGold -= cost;
    card.lv = (card.lv || 1) + 1;
    recalcCardStats(card);
    return { success: true, cost };
}

// 強化成功率
const ENHANCE_SUCCESS_RATE = { 'B': 1.0, 'A': 1.0, 'S': 0.7, 'SS': 0.3, 'SSS': 0.1 };

// 強化所需技能書數量
const ENHANCE_BOOK_COST = { 'B': 1, 'A': 2, 'S': 3, 'SS': 5, 'SSS': 10 };

// 強化卡片等級
function enhanceCard(card) {
    ensureBaseStats(card);
    const maxLv = card.maxLv || 50;
    if ((card.lv || 1) < maxLv) return { success: false, msg: '需要先升到滿等' };
    const currentGrade = card.enhanceGrade || 'C';
    const idx = ENHANCE_GRADES.indexOf(currentGrade);
    if (idx >= ENHANCE_GRADES.length - 1) return { success: false, msg: '已達最高強化等級' };
    const nextGrade = ENHANCE_GRADES[idx + 1];
    const cost = ENHANCE_GOLD[nextGrade];
    if (playerGold < cost) return { success: false, msg: '金幣不足' };
    // 檢查種族技能書
    const race = card.race || '人';
    const bookCost = ENHANCE_BOOK_COST[nextGrade] || 1;
    if (typeof skillBooks !== 'undefined' && (skillBooks[race] || 0) < bookCost) {
        return { success: false, msg: `${race}族技能書不足（需要 ${bookCost} 本）` };
    }
    // 扣除資源
    playerGold -= cost;
    if (typeof skillBooks !== 'undefined') skillBooks[race] -= bookCost;
    // 判定成功率
    const rate = ENHANCE_SUCCESS_RATE[nextGrade] ?? 1.0;
    if (Math.random() > rate) {
        return { success: false, failed: true, msg: `強化失敗！（成功率 ${(rate * 100).toFixed(1)}%）`, cost };
    }
    card.enhanceGrade = nextGrade;
    recalcCardStats(card);
    return { success: true, grade: nextGrade, cost };
}


// 敵人資料（含技能 + 個別圖片）
const ENEMIES = [
    // ===== 第一章（0-5）=====
    { name: '火焰狂徒', element: 'fire', hp: 5000, atk: 300, cd: 3, img: '野怪/火焰狂徒 — 火 — 人.png',
      skills: [{ name: '狂暴揮擊', trigger: 'hp50', desc: '攻擊力+50%持續2回合', effect: 'atkUp50_2', used: false }] },
    { name: '荊棘藤怪', element: 'wood', hp: 5500, atk: 280, cd: 2, img: '野怪/荊棘藤怪 — 木 — 獸.png',
      skills: [{ name: '荊棘纏繞', trigger: 'hp50', desc: '隨機轉化 3 顆珠子', effect: 'randomConvert3', used: false }] },
    { name: '冰雪刺客', element: 'water', hp: 6000, atk: 320, cd: 3, img: '野怪/冰雪刺客 — 水 — 人.png',
      skills: [{ name: '寒冰突襲', trigger: 'hp40', desc: '連續攻擊 2 次', effect: 'doubleAttack', used: false }] },
    { name: '沙漠盜賊', element: 'earth', hp: 5200, atk: 310, cd: 2, img: '野怪/沙漠盜賊 — 土 — 人.png',
      skills: [{ name: '砂塵暴', trigger: 'hp50', desc: '隨機轉化 3 顆珠子', effect: 'randomConvert3', used: false }] },
    { name: '雷電狼', element: 'metal', hp: 5800, atk: 350, cd: 3, img: '野怪/雷電狼 — 金 — 獸.png',
      skills: [{ name: '閃電撲擊', trigger: 'hp40', desc: '攻擊力+50%持續2回合', effect: 'atkUp50_2', used: false }] },
    { name: '毒霧蘑菇', element: 'wood', hp: 4800, atk: 260, cd: 2, img: '野怪/毒霧蘑菇 — 木 — 人.png',
      skills: [{ name: '孢子散佈', trigger: 'hp50', desc: '隨機轉化 3 顆珠子', effect: 'randomConvert3', used: false }] },
    // ===== 第一章 BOSS（6）=====
    { name: '熔岩巨龍', element: 'fire', hp: 50000, atk: 800, cd: 2, img: '野怪/BOSS-1 熔岩巨龍 — 火 — 龍.png',
      skills: [
          { name: '龍炎吐息', trigger: 'hp80', desc: '全隊 3000 點傷害', effect: 'aoe3000', used: false },
          { name: '熔岩爆發', trigger: 'hp50', desc: '攻擊力+80%持續3回合', effect: 'atkUp80_3', used: false },
          { name: '毀滅烈焰', trigger: 'hp20', desc: '全隊 8000 點傷害', effect: 'aoe8000', used: false }] },
    // ===== 第二章（7-12）=====
    { name: '火焰蝙蝠', element: 'fire', hp: 8000, atk: 450, cd: 3, img: '野怪/火焰蝙蝠 — 火 — 獸.png',
      skills: [{ name: '烈焰俯衝', trigger: 'hp50', desc: '攻擊力+60%持續2回合', effect: 'atkUp60_2', used: false }] },
    { name: '翠綠幼龍', element: 'wood', hp: 8500, atk: 420, cd: 2, img: '野怪/翠綠幼龍 — 木 — 龍.png',
      skills: [{ name: '毒息噴射', trigger: 'hp50', desc: '隨機轉化 4 顆珠子', effect: 'randomConvert4', used: false }] },
    { name: '冰霜蜘蛛', element: 'water', hp: 9000, atk: 480, cd: 3, img: '野怪/冰霜蜘蛛 — 水 — 獸.png',
      skills: [{ name: '寒冰結網', trigger: 'hp40', desc: '封鎖 1 顆珠子 2 回合', effect: 'lock1_2', used: false }] },
    { name: '岩石巨龜', element: 'earth', hp: 10000, atk: 380, cd: 2, img: '野怪/岩石巨龜 — 土 — 獸.png',
      skills: [{ name: '岩甲防禦', trigger: 'hp60', desc: '3回合減傷50%', effect: 'shield50_3', used: false }] },
    { name: '金甲蠍', element: 'metal', hp: 8800, atk: 500, cd: 3, img: '野怪/金甲蠍 — 金 — 獸.png',
      skills: [{ name: '毒尾刺擊', trigger: 'hp40', desc: '連續攻擊 2 次', effect: 'doubleAttack', used: false }] },
    { name: '幽靈火焰', element: 'fire', hp: 7500, atk: 460, cd: 2, img: '野怪/幽靈火焰 — 火 — 魔.png',
      skills: [{ name: '鬼火纏繞', trigger: 'hp50', desc: '隨機轉化 4 顆珠子', effect: 'randomConvert4', used: false }] },
    // ===== 第二章 BOSS（13）=====
    { name: '深淵魔王', element: 'water', hp: 80000, atk: 1200, cd: 2, img: '野怪/BOSS-2 深淵魔王 — 水 — 魔.png',
      skills: [
          { name: '深淵漩渦', trigger: 'hp80', desc: '全隊 5000 點傷害', effect: 'aoe5000', used: false },
          { name: '黑暗侵蝕', trigger: 'hp50', desc: '隨機轉化 6 顆珠子\n攻擊力+60%', effect: 'randomConvert6_atkUp60', used: false },
          { name: '深淵吞噬', trigger: 'hp20', desc: '全隊 15000 點傷害', effect: 'aoe15000', used: false }] },
    // ===== 第三章（14-19）=====
    { name: '熔岩史萊姆', element: 'fire', hp: 12000, atk: 600, cd: 3, img: '野怪/熔岩史萊姆 — 火 — 魔.png',
      skills: [{ name: '熔岩噴射', trigger: 'hp50', desc: '全隊 2000 點傷害', effect: 'aoe2000', used: false }] },
    { name: '腐化樹魔', element: 'wood', hp: 13000, atk: 580, cd: 2, img: '野怪/腐化樹魔 — 木 — 魔.png',
      skills: [{ name: '腐化之根', trigger: 'hp50', desc: '隨機轉化 5 顆珠子', effect: 'randomConvert5', used: false },
              { name: '枯萎詛咒', trigger: 'hp25', desc: '攻擊力+80%持續3回合', effect: 'atkUp80_3', used: false }] },
    { name: '暗影水妖', element: 'water', hp: 14000, atk: 650, cd: 3, img: '野怪/暗影水妖 — 水 — 魔.png',
      skills: [{ name: '暗流漩渦', trigger: 'hp40', desc: '全隊 3000 點傷害', effect: 'aoe3000', used: false }] },
    { name: '岩漿巨像', element: 'earth', hp: 15000, atk: 550, cd: 2, img: '野怪/岩漿巨像 — 土 — 魔.png',
      skills: [{ name: '岩漿護體', trigger: 'hp60', desc: '3回合減傷60%', effect: 'shield60_3', used: false },
              { name: '岩漿噴發', trigger: 'hp30', desc: '全隊 5000 點傷害', effect: 'aoe5000', used: false }] },
    { name: '鋼鐵惡魔', element: 'metal', hp: 13500, atk: 680, cd: 3, img: '野怪/鋼鐵惡魔 — 金 — 魔.png',
      skills: [{ name: '鋼爪撕裂', trigger: 'hp40', desc: '連續攻擊 2 次', effect: 'doubleAttack', used: false }] },
    { name: '深海海馬', element: 'water', hp: 11000, atk: 520, cd: 2, img: '野怪/深海海馬 — 水 — 龍.png',
      skills: [{ name: '水柱衝擊', trigger: 'hp50', desc: '隨機轉化 4 顆珠子', effect: 'randomConvert4', used: false }] },
    // ===== 第三章 BOSS（20）=====
    { name: '世界樹守護者', element: 'wood', hp: 120000, atk: 1600, cd: 2, img: '野怪/BOSS-3 世界樹守護者 — 木 — 神.png',
      skills: [
          { name: '根系纏繞', trigger: 'hp80', desc: '封鎖 2 顆珠子 3 回合', effect: 'lock2_3', used: false },
          { name: '生命吸收', trigger: 'hp50', desc: '回復自身 10% HP\n攻擊力+80%', effect: 'selfHeal10_atkUp80', used: false },
          { name: '世界樹制裁', trigger: 'hp20', desc: '全隊 20000 點傷害', effect: 'aoe20000', used: false }] },
    // ===== 第四章（21-26）=====
    { name: '火焰鳳凰幼體', element: 'fire', hp: 18000, atk: 800, cd: 3, img: '野怪/火焰鳳凰幼體 — 火 — 龍.png',
      skills: [{ name: '鳳凰之焰', trigger: 'hp50', desc: '全隊 4000 點傷害', effect: 'aoe4000', used: false },
              { name: '浴火重生', trigger: 'hp20', desc: '回復自身 15% HP', effect: 'selfHeal15', used: false }] },
    { name: '腐化神木', element: 'wood', hp: 20000, atk: 750, cd: 2, img: '野怪/腐化神木 — 木 — 神.png',
      skills: [{ name: '腐化之根', trigger: 'hp60', desc: '封鎖 2 顆珠子 3 回合', effect: 'lock2_3', used: false },
              { name: '枯萎詛咒', trigger: 'hp30', desc: '攻擊力+100%持續3回合', effect: 'atkUp100_3', used: false }] },
    { name: '冰晶飛龍', element: 'water', hp: 22000, atk: 850, cd: 3, img: '野怪/冰晶飛龍 — 水 — 龍.png',
      skills: [{ name: '冰晶吐息', trigger: 'hp50', desc: '全隊 5000 點傷害', effect: 'aoe5000', used: false },
              { name: '冰封領域', trigger: 'hp25', desc: '隨機轉化 6 顆珠子', effect: 'randomConvert6', used: false }] },
    { name: '琥珀土龍', element: 'earth', hp: 25000, atk: 700, cd: 2, img: '野怪/琥珀土龍 — 土 — 龍.png',
      skills: [{ name: '琥珀護甲', trigger: 'hp70', desc: '3回合減傷60%', effect: 'shield60_3', used: false },
              { name: '大地震動', trigger: 'hp30', desc: '全隊 6000 點傷害', effect: 'aoe6000', used: false }] },
    { name: '黃金機械蛇', element: 'metal', hp: 21000, atk: 900, cd: 3, img: '野怪/黃金機械蛇 — 金 — 龍.png',
      skills: [{ name: '機械咬擊', trigger: 'hp40', desc: '連續攻擊 3 次', effect: 'tripleAttack', used: false }] },
    { name: '業火骷髏', element: 'fire', hp: 19000, atk: 780, cd: 2, img: '野怪/業火骷髏 — 火 — 神.png',
      skills: [{ name: '骷髏烈焰', trigger: 'hp50', desc: '全隊 4000 點傷害\n隨機轉化 4 顆珠子', effect: 'aoe4000_randomConvert4', used: false }] },
    // ===== 第四章 BOSS（27）=====
    { name: '黃金機甲泰坦', element: 'metal', hp: 180000, atk: 2200, cd: 2, img: '野怪/BOSS-4 黃金機甲泰坦 — 金 — 人.png',
      skills: [
          { name: '機甲護盾', trigger: 'hp80', desc: '5回合減傷50%', effect: 'shield50_5', used: false },
          { name: '雷電風暴', trigger: 'hp50', desc: '全隊 12000 點傷害\n隨機轉化 8 顆珠子', effect: 'aoe12000_randomConvert8', used: false },
          { name: '毀滅炮擊', trigger: 'hp20', desc: '全隊 30000 點傷害', effect: 'aoe30000', used: false }] },
    // ===== 第五章（28-33）=====
    { name: '冰霜神像', element: 'water', hp: 28000, atk: 1000, cd: 3, img: '野怪/冰霜神像 — 水 — 神.png',
      skills: [{ name: '神像冰封', trigger: 'hp50', desc: '封鎖 3 顆珠子 3 回合', effect: 'lock3_3', used: false },
              { name: '冰封審判', trigger: 'hp25', desc: '全隊 8000 點傷害', effect: 'aoe8000', used: false }] },
    { name: '石像鬼', element: 'earth', hp: 30000, atk: 950, cd: 2, img: '野怪/石像鬼 — 土 — 神.png',
      skills: [{ name: '石化凝視', trigger: 'hp60', desc: '3回合減傷70%', effect: 'shield70_3', used: false },
              { name: '碎岩衝擊', trigger: 'hp30', desc: '全隊 10000 點傷害', effect: 'aoe10000', used: false }] },
    { name: '墮落天使', element: 'metal', hp: 32000, atk: 1100, cd: 3, img: '野怪/墮落天使 — 金 — 神.png',
      skills: [{ name: '墮落審判', trigger: 'hp40', desc: '全隊 8000 點傷害\n攻擊力+80%', effect: 'aoe8000_atkUp80', used: false }] },
    { name: '雷霆叛神', element: 'metal', hp: 35000, atk: 1200, cd: 2, img: '野怪/雷霆叛神 — 金 — 神.png',
      skills: [{ name: '雷霆制裁', trigger: 'hp50', desc: '全隊 10000 點傷害', effect: 'aoe10000', used: false },
              { name: '叛神之怒', trigger: 'hp20', desc: '攻擊力+150%持續3回合', effect: 'atkUp150_3', used: false }] },
    { name: '黃金僱傭兵', element: 'metal', hp: 26000, atk: 1050, cd: 3, img: '野怪/黃金僱傭兵 — 金 — 人.png',
      skills: [{ name: '精準射擊', trigger: 'hp40', desc: '連續攻擊 3 次', effect: 'tripleAttack', used: false }] },
    { name: '狂戰士', element: 'metal', hp: 28000, atk: 1150, cd: 2, img: '野怪/狂戰士 — 金 — 人.png',
      skills: [{ name: '狂暴斬擊', trigger: 'hp50', desc: '攻擊力+100%持續3回合', effect: 'atkUp100_3', used: false },
              { name: '致命連擊', trigger: 'hp25', desc: '連續攻擊 3 次', effect: 'tripleAttack', used: false }] },
    // ===== 第五章 BOSS（34）=====
    { name: '大地暴君', element: 'earth', hp: 250000, atk: 3000, cd: 2, img: '野怪/BOSS-5 大地暴君 — 土 — 獸.png',
      skills: [
          { name: '暴君咆哮', trigger: 'hp80', desc: '攻擊力+100%持續5回合\n隨機轉化 8 顆珠子', effect: 'atkUp100_5_randomConvert8', used: false },
          { name: '大地裂縫', trigger: 'hp50', desc: '全隊 20000 點傷害\n封鎖 3 顆珠子 3 回合', effect: 'aoe20000_lock3_3', used: false },
          { name: '暴君終焉', trigger: 'hp10', desc: '全隊 45000 點傷害', effect: 'aoe45000', used: false }] },
];

// ===== 遊戲狀態 =====
let board = [];
let team = [];
let teamMaxHp = 0, teamHp = 0;
let currentStage = 0;
let enemy = null, enemyHp = 0, enemyMaxHp = 0, enemyCd = 0, enemyMaxCd = 0;
let isDragging = false, dragOrb = null, dragPath = [];
let canvas, ctx;
let orbSize = 65, canvasW, canvasH;
let animating = false;
let playerName = '';
let particles = [], particleCanvas, particleCtx, particleAnimId = null;
let isStoryBattle = false; // 是否為故事模式戰鬥（只打一關）
let isRoguelike = false; // 是否為輪迴挑戰模式
let roguelikeEnemies = []; // 輪迴挑戰的敵人列表
let roguelikeFloor = 0; // 當前層數
let roguelikeTotalFloors = 50; // 總層數

// 技能系統狀態
let skillCooldowns = []; // 每個隊員的當前CD
let activeBuffs = []; // { type, turns, value }
let enemyBuffs = []; // 敵人增益
let turnCount = 0;
let orbShimmerPhase = 0; // 珠子閃光動畫相位
let boardAnimId = null; // 盤面動畫循環

// 戰鬥粒子特效
let battleParticles = [];

// ===== 粒子系統（登入畫面用） =====
function initParticles() {
    particleCanvas = document.getElementById('particle-canvas');
    const container = document.getElementById('game-container');
    particleCanvas.width = container.clientWidth;
    particleCanvas.height = container.clientHeight;
    particleCtx = particleCanvas.getContext('2d');
    particles = [];
    for (let i = 0; i < 35; i++) {
        particles.push({ type:'orb', x:Math.random()*particleCanvas.width, y:Math.random()*particleCanvas.height,
            r:Math.random()*2+1, dy:-Math.random()*0.5-0.15, dx:(Math.random()-0.5)*0.2,
            alpha:Math.random()*0.5+0.3, color:`hsl(${40+Math.random()*20},100%,${60+Math.random()*20}%)`, pulse:Math.random()*Math.PI*2 });
    }
    for (let i = 0; i < 6; i++) {
        const p = { type:'streak', x:Math.random()*particleCanvas.width, y:Math.random()*particleCanvas.height*0.5,
            len:Math.random()*60+40, speed:Math.random()*1.5+1, angle:Math.PI*0.7+Math.random()*0.2,
            alpha:0, fadeIn:true, life:Math.random()*200+100, maxLife:0, color:`hsl(${30+Math.random()*30},90%,70%)` };
        p.maxLife = p.life; particles.push(p);
    }
    for (let i = 0; i < 4; i++) {
        particles.push({ type:'glow', x:Math.random()*particleCanvas.width, y:Math.random()*particleCanvas.height,
            r:Math.random()*80+40, dx:(Math.random()-0.5)*0.15, dy:(Math.random()-0.5)*0.15,
            alpha:Math.random()*0.04+0.02, color:['#ffd700','#ff6b9d','#3742fa','#2ed573'][i], pulse:Math.random()*Math.PI*2 });
    }
    drawParticles();
}
function drawParticles() {
    particleCtx.clearRect(0,0,particleCanvas.width,particleCanvas.height);
    const W=particleCanvas.width, H=particleCanvas.height;
    for (const p of particles) {
        if (p.type==='orb') {
            p.x+=p.dx; p.y+=p.dy; p.pulse+=0.025;
            const a=p.alpha*(0.4+0.6*Math.sin(p.pulse));
            if(p.y<-10){p.y=H+10;p.x=Math.random()*W;} if(p.x<-10)p.x=W+10; if(p.x>W+10)p.x=-10;
            particleCtx.save(); particleCtx.globalAlpha=a; particleCtx.shadowColor=p.color; particleCtx.shadowBlur=12;
            particleCtx.fillStyle=p.color; particleCtx.beginPath(); particleCtx.arc(p.x,p.y,p.r,0,Math.PI*2); particleCtx.fill(); particleCtx.restore();
        } else if (p.type==='streak') {
            p.life--; if(p.life<=0){p.x=Math.random()*W;p.y=-20;p.life=Math.random()*200+100;p.maxLife=p.life;}
            const progress=1-p.life/p.maxLife; p.alpha=(progress<0.1?progress/0.1:(progress>0.7?(1-progress)/0.3:1))*0.35;
            p.x+=Math.cos(p.angle)*p.speed; p.y+=Math.sin(p.angle)*p.speed;
            particleCtx.save(); particleCtx.globalAlpha=p.alpha;
            const grad=particleCtx.createLinearGradient(p.x,p.y,p.x-Math.cos(p.angle)*p.len,p.y-Math.sin(p.angle)*p.len);
            grad.addColorStop(0,p.color); grad.addColorStop(1,'transparent');
            particleCtx.strokeStyle=grad; particleCtx.lineWidth=1.5; particleCtx.beginPath();
            particleCtx.moveTo(p.x,p.y); particleCtx.lineTo(p.x-Math.cos(p.angle)*p.len,p.y-Math.sin(p.angle)*p.len);
            particleCtx.stroke(); particleCtx.restore();
        } else if (p.type==='glow') {
            p.x+=p.dx; p.y+=p.dy; p.pulse+=0.008;
            const a=p.alpha*(0.5+0.5*Math.sin(p.pulse));
            if(p.x<-p.r)p.x=W+p.r; if(p.x>W+p.r)p.x=-p.r; if(p.y<-p.r)p.y=H+p.r; if(p.y>H+p.r)p.y=-p.r;
            particleCtx.save(); particleCtx.globalAlpha=a;
            const grad=particleCtx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);
            grad.addColorStop(0,p.color); grad.addColorStop(1,'transparent');
            particleCtx.fillStyle=grad; particleCtx.beginPath(); particleCtx.arc(p.x,p.y,p.r,0,Math.PI*2); particleCtx.fill(); particleCtx.restore();
        }
    }
    particleAnimId = requestAnimationFrame(drawParticles);
}
function stopParticles() {
    if(particleAnimId){cancelAnimationFrame(particleAnimId);particleAnimId=null;}
    if(particleCtx)particleCtx.clearRect(0,0,particleCanvas.width,particleCanvas.height);
}

// ===== 登入流程 =====
function showLoginMenu() {
    SFX.init(); // 初始化音效（需要用戶互動）
    if (hasSaveData) {
        // 有存檔：點擊登入畫面後直接進大廳
        const overlay = document.getElementById('transition-overlay');
        overlay.classList.add('active');
        setTimeout(() => {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('battle-screen').style.display = 'none';
            document.getElementById('result-screen').classList.remove('show');
            enterLobby();
            setTimeout(() => overlay.classList.remove('active'), 100);
        }, 600);
        return;
    }
    const overlay=document.getElementById('transition-overlay'); overlay.classList.add('active');
    setTimeout(()=>{document.getElementById('login-screen').style.display='none'; initParticles();
        document.getElementById('login-menu').classList.remove('hidden'); setTimeout(()=>overlay.classList.remove('active'),100);},600);
}
function showNameDialog() {
    const overlay=document.getElementById('transition-overlay'); overlay.classList.add('active');
    setTimeout(()=>{document.getElementById('login-menu').classList.add('hidden'); document.getElementById('name-dialog').classList.remove('hidden');
        document.getElementById('player-name-input').value='';
        setTimeout(()=>{overlay.classList.remove('active'); setTimeout(()=>document.getElementById('player-name-input').focus(),300);},100);},500);
}
function hideNameDialog() {
    const overlay=document.getElementById('transition-overlay'); overlay.classList.add('active');
    setTimeout(()=>{document.getElementById('name-dialog').classList.add('hidden'); document.getElementById('login-menu').classList.remove('hidden');
        setTimeout(()=>overlay.classList.remove('active'),100);},500);
}
function tryStart() {
    const check=document.getElementById('agree-check'), warning=document.getElementById('agree-warning');
    if(!check.checked){warning.textContent='⚠ 請先勾選同意使用者條款'; check.parentElement.style.animation='headShake 0.5s';
        setTimeout(()=>check.parentElement.style.animation='',500); SFX.play('error'); return;} warning.textContent=''; SFX.play('confirm'); showNameDialog();
}
const TERMS = {
    privacy:{title:'私隱條款',content:`<p>CaiTianKaiMen 非常重視您的隱私權。</p><p><b>1. 資料收集</b><br>本遊戲可能收集您的暱稱、裝置資訊及遊戲進度等資料。</p><p><b>2. 資料使用</b><br>所收集之資料僅用於遊戲營運。</p><p><b>3. 資料保護</b><br>我們採用業界標準的加密技術保護您的個人資料。</p><p><b>4. 第三方分享</b><br>除法律要求外，不會分享給第三方。</p><p><b>5. 條款修改</b><br>本遊戲保留隨時修改本條款之權利。</p>`},
    service:{title:'服務條款',content:`<p>歡迎使用 CaiTianKaiMen。</p><p><b>1. 服務內容</b><br>本遊戲提供線上轉珠戰鬥遊戲服務。</p><p><b>2. 帳號管理</b><br>您有責任妥善保管帳號資訊。</p><p><b>3. 使用規範</b><br>禁止使用外掛、修改遊戲資料。</p><p><b>4. 智慧財產權</b><br>本遊戲之所有內容均受著作權法保護。</p><p><b>5. 免責聲明</b><br>本遊戲不保證服務不中斷或無錯誤。</p><p><b>6. 條款變更</b><br>繼續使用即視為同意修改後之條款。</p>`}
};
function showTerms(type){const t=TERMS[type]; document.getElementById('terms-title').textContent=t.title; document.getElementById('terms-content').innerHTML=t.content; document.getElementById('terms-dialog').classList.remove('hidden');}
function closeTerms(){document.getElementById('terms-dialog').classList.add('hidden');}
function confirmName(){const input=document.getElementById('player-name-input'),name=input.value.trim();
    if(!name){input.style.borderColor='#ff4757';input.setAttribute('placeholder','名稱不能為空！');SFX.play('error');return;}
    playerName=name; document.getElementById('confirm-name-display').textContent=name;
    document.getElementById('name-dialog').classList.add('hidden'); document.getElementById('confirm-dialog').classList.remove('hidden');SFX.play('confirm');}
function cancelConfirm(){document.getElementById('confirm-dialog').classList.add('hidden'); document.getElementById('name-dialog').classList.remove('hidden');}
function finalConfirm(){const overlay=document.getElementById('transition-overlay'); overlay.classList.add('active');
    setTimeout(()=>{document.getElementById('confirm-dialog').classList.add('hidden'); startGame(); setTimeout(()=>overlay.classList.remove('active'),100);},600);}

// ===== 初始化 =====
let prologuePlayed = false;

function startGame() {
    stopParticles();
    document.getElementById('login-screen').style.display='none';
    document.getElementById('login-menu').classList.add('hidden');
    document.getElementById('name-dialog').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('show');
    document.getElementById('battle-screen').style.display='none';
    // 新手首次進入：先選初始角色，再播序章
    if (!localStorage.getItem('caitiankm_starter_done')) {
        showStarterSelect();
        return;
    }
    // 新手首次進入：播放序章
    if (!prologuePlayed && !localStorage.getItem('caitiankm_prologue_done')) {
        prologuePlayed = true;
        localStorage.setItem('caitiankm_prologue_done', '1');
        playPrologue(() => { saveGame(); enterLobby(); });
        return;
    }
    saveGame(); enterLobby();
}

// ===== 初始角色選擇 =====
let selectedStarterIdx = -1;
const STARTER_INDICES = [0, 1, 2, 3, 4]; // CHARACTERS index 0-4

function showStarterSelect() {
    const screen = document.getElementById('starter-select');
    const container = document.getElementById('starter-cards');
    container.innerHTML = '';
    selectedStarterIdx = -1;
    for (const idx of STARTER_INDICES) {
        const c = CHARACTERS[idx];
        const el = ELEMENTS[c.element];
        const div = document.createElement('div');
        div.className = 'starter-card';
        div.onclick = () => selectStarter(idx, div);
        div.innerHTML = `<img src="${c.img}" alt="${c.name}">
            <div class="starter-card-element"><img src="${el.orbImg}" alt="${el.name}"></div>
            <div class="starter-card-name">${c.title}・${c.name}</div>`;
        container.appendChild(div);
    }
    document.getElementById('starter-selected-info').textContent = '';
    document.getElementById('starter-confirm-btn').disabled = true;
    screen.classList.remove('hidden');
}

function selectStarter(idx, el) {
    selectedStarterIdx = idx;
    document.querySelectorAll('.starter-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    const c = CHARACTERS[idx];
    const info = document.getElementById('starter-selected-info');
    info.innerHTML = `<div style="color:#ffd700;font-weight:bold;">${c.title}・${c.name}</div>
        <div>ATK ${c.atk} / HP ${c.hp} / RCV ${c.rcv}</div>
        <div style="color:#aaa;font-size:11px;">${c.leaderSkill.desc}</div>`;
    document.getElementById('starter-confirm-btn').disabled = false;
    SFX.play('tap');
}

function confirmStarter() {
    if (selectedStarterIdx < 0) return;
    localStorage.setItem('caitiankm_starter_done', '1');
    // 將選擇的初始角色加入背包
    const starterCard = { ...CHARACTERS[selectedStarterIdx] };
    ensureBaseStats(starterCard);
    ownedCards.push(starterCard);
    // 設定初始隊伍：只有選擇的角色（index 0 in ownedCards）
    if (typeof teamSlots !== 'undefined') {
        teamSlots[0] = 0;
        for (let i = 1; i < 5; i++) teamSlots[i] = -1;
    }
    document.getElementById('starter-select').classList.add('hidden');
    SFX.play('confirm');
    // 繼續序章
    if (!prologuePlayed && !localStorage.getItem('caitiankm_prologue_done')) {
        prologuePlayed = true;
        localStorage.setItem('caitiankm_prologue_done', '1');
        playPrologue(() => { saveGame(); enterLobby(); });
        return;
    }
    saveGame(); enterLobby();
}

// ===== 故事序章系統 =====
const PROLOGUE_LINES = [
    { text: '……', shake: false, delay: 1200 },
    { text: '天地初開，五行化生萬物。', shake: false, delay: 2500 },
    { text: '金、木、水、火、土——\n五種元素維繫著世界的平衡。', shake: false, delay: 3000 },
    { text: '然而……', shake: false, delay: 1500 },
    { text: '', shake: true, flash: true, delay: 800 },
    { text: '一股來自深淵的力量，打破了五行的秩序。', shake: false, delay: 2800 },
    { text: '大地崩裂，海洋沸騰，\n天空被黑暗吞噬。', shake: true, delay: 3000 },
    { text: '世界……正在崩壞。', shake: false, delay: 2200 },
    { text: '', shake: true, flash: true, delay: 600 },
    { text: '「醒來吧……被選中的召喚師。」', shake: false, delay: 2800 },
    { text: '「唯有你體內沉睡的五行之力，\n能夠拯救這個世界。」', shake: false, delay: 3200 },
    { text: '「集結夥伴，以轉珠之力\n喚醒沉睡的神獸——」', shake: false, delay: 3000 },
    { text: '「重建天地秩序！」', shake: true, flash: true, delay: 2000 },
];

let prologueCallback = null;
let prologueIdx = 0;
let prologueTimer = null;

function playPrologue(callback) {
    prologueCallback = callback;
    prologueIdx = 0;
    const screen = document.getElementById('prologue-screen');
    screen.classList.remove('hidden');
    screen.onclick = advancePrologue;
    showPrologueLine();
}

function showPrologueLine() {
    if (prologueIdx >= PROLOGUE_LINES.length) { endPrologue(); return; }
    const line = PROLOGUE_LINES[prologueIdx];
    const screen = document.getElementById('prologue-screen');
    const textEl = document.getElementById('prologue-text');

    // 震動
    if (line.shake) {
        screen.classList.remove('shake');
        void screen.offsetWidth;
        screen.classList.add('shake');
    }
    // 閃白
    if (line.flash) {
        const flash = document.createElement('div');
        flash.className = 'prologue-flash';
        screen.appendChild(flash);
        setTimeout(() => flash.remove(), 900);
    }
    // 打字機效果
    if (line.text) {
        textEl.textContent = '';
        let charIdx = 0;
        const chars = line.text;
        const typeInterval = setInterval(() => {
            if (charIdx < chars.length) {
                textEl.textContent += chars[charIdx];
                charIdx++;
            } else {
                clearInterval(typeInterval);
            }
        }, 50);
    }

    prologueIdx++;
    prologueTimer = setTimeout(showPrologueLine, line.delay);
}

function advancePrologue() {
    if (prologueTimer) clearTimeout(prologueTimer);
    // Show full text of current line immediately
    if (prologueIdx > 0 && prologueIdx <= PROLOGUE_LINES.length) {
        const prev = PROLOGUE_LINES[prologueIdx - 1];
        if (prev.text) document.getElementById('prologue-text').textContent = prev.text;
    }
    showPrologueLine();
}

function skipPrologue() { endPrologue(); }

function endPrologue() {
    if (prologueTimer) clearTimeout(prologueTimer);
    const screen = document.getElementById('prologue-screen');
    // 最終閃白過場
    const flash = document.createElement('div');
    flash.className = 'prologue-flash';
    flash.style.animationDuration = '1.2s';
    screen.appendChild(flash);
    setTimeout(() => {
        screen.classList.add('hidden');
        screen.onclick = null;
        if (prologueCallback) prologueCallback();
    }, 800);
}

const BATTLE_BGS = [
    '戰鬥背景/背景 1 — 幽暗森林.png',
    '戰鬥背景/背景 2 — 熔岩火山.png',
    '戰鬥背景/背景 3 — 冰霜雪原.png',
    '戰鬥背景/背景 4 — 天空神殿 .png',
];

function startBattle() {
    isStoryBattle = false;
    team = teamSlots.filter(idx => idx >= 0).map(idx => ownedCards[idx] || ownedCards[0]);
    if (team.length === 0) team = [ownedCards[0] || CHARACTERS[0]];
    teamMaxHp = team.reduce((s,c)=>s+c.hp, 0);
    teamHp = teamMaxHp;
    currentStage = 0;
    turnCount = 0;
    activeBuffs = [];
    enemyBuffs = [];
    battleParticles = [];
    // 初始化技能CD
    skillCooldowns = team.map(c => c.activeSkill.cd);

    // 清理大廳動畫，釋放資源
    if (typeof lobbyParticleId !== 'undefined' && lobbyParticleId) { cancelAnimationFrame(lobbyParticleId); lobbyParticleId = null; }
    if (typeof avatarParticleId !== 'undefined' && avatarParticleId) { cancelAnimationFrame(avatarParticleId); avatarParticleId = null; }
    if (typeof battleWaveId !== 'undefined' && battleWaveId) { cancelAnimationFrame(battleWaveId); battleWaveId = null; }

    document.getElementById('lobby-screen').classList.remove('show');
    document.getElementById('battle-screen').style.display='flex';
    document.getElementById('result-screen').classList.remove('show');

    const battleBg = document.getElementById('battle-bg');
    if(battleBg) battleBg.src = BATTLE_BGS[Math.floor(Math.random()*BATTLE_BGS.length)];

    initCanvas();
    renderTeam();
    loadStage();
    startBoardAnimation();
    SFX.startBGM('battle');
}

// ===== 輪迴挑戰系統 =====
function generateRoguelikeEnemies() {
    const rl = [];
    // 非 BOSS 野怪池（排除 BOSS，BOSS 名稱含 'BOSS' 或 img 含 'BOSS'）
    const normalPool = ENEMIES.filter(e => !e.img.includes('BOSS'));
    // BOSS 池
    const bossPool = ENEMIES.filter(e => e.img.includes('BOSS'));

    // 前 45 層：隨機野怪，逐層強化
    for (let i = 0; i < 45; i++) {
        const base = normalPool[Math.floor(Math.random() * normalPool.length)];
        const floor = i + 1;
        const scale = 1 + floor * 0.12; // 每層 +12% 強化
        const e = JSON.parse(JSON.stringify(base));
        e.hp = Math.floor(e.hp * scale);
        e.atk = Math.floor(e.atk * scale);
        e._rogueFloor = floor;
        rl.push(e);
    }

    // 後 5 層：BOSS（從 BOSS 池隨機挑選，大幅強化）
    const usedBoss = [];
    for (let i = 0; i < 5; i++) {
        let pool = bossPool.filter(b => !usedBoss.includes(b.name));
        if (pool.length === 0) pool = bossPool;
        const base = pool[Math.floor(Math.random() * pool.length)];
        usedBoss.push(base.name);
        const floor = 46 + i;
        const scale = 1.5 + i * 0.5; // BOSS 從 1.5x 到 3.5x
        const e = JSON.parse(JSON.stringify(base));
        e.hp = Math.floor(e.hp * scale);
        e.atk = Math.floor(e.atk * scale);
        e._rogueFloor = floor;
        e._isBoss = true;
        rl.push(e);
    }
    return rl;
}

function startRoguelike() {
    isRoguelike = true;
    isStoryBattle = false;
    roguelikeEnemies = generateRoguelikeEnemies();
    roguelikeFloor = 0;

    team = teamSlots.filter(idx => idx >= 0).map(idx => ownedCards[idx] || ownedCards[0]);
    if (team.length === 0) team = [ownedCards[0] || CHARACTERS[0]];
    teamMaxHp = team.reduce((s,c)=>s+c.hp, 0);
    teamHp = teamMaxHp;
    currentStage = 0;
    turnCount = 0;
    activeBuffs = [];
    enemyBuffs = [];
    battleParticles = [];
    skillCooldowns = team.map(c => c.activeSkill.cd);

    // 清理大廳動畫
    if (typeof lobbyParticleId !== 'undefined' && lobbyParticleId) { cancelAnimationFrame(lobbyParticleId); lobbyParticleId = null; }
    if (typeof avatarParticleId !== 'undefined' && avatarParticleId) { cancelAnimationFrame(avatarParticleId); avatarParticleId = null; }
    if (typeof battleWaveId !== 'undefined' && battleWaveId) { cancelAnimationFrame(battleWaveId); battleWaveId = null; }

    document.getElementById('lobby-screen').classList.remove('show');
    document.getElementById('battle-screen').style.display='flex';
    document.getElementById('result-screen').classList.remove('show');

    const battleBg = document.getElementById('battle-bg');
    if(battleBg) battleBg.src = BATTLE_BGS[Math.floor(Math.random()*BATTLE_BGS.length)];

    initCanvas();
    renderTeam();
    loadStage();
    startBoardAnimation();
    SFX.startBGM('battle');
}

function restartGame() {
    isRoguelike = false;
    roguelikeEnemies = [];
    stopBoardAnimation();
    SFX.stopBGM();
    document.getElementById('result-screen').classList.remove('show');
    document.getElementById('battle-screen').style.display='none';
    enterLobby();
}

function initCanvas() {
    canvas = document.getElementById('board-canvas');
    ctx = canvas.getContext('2d');
    const containerW = document.getElementById('game-container').clientWidth;
    orbSize = Math.floor((containerW-16)/COLS);
    canvasW = orbSize*COLS; canvasH = orbSize*ROWS;
    // 高解析度螢幕支援（解決珠子模糊問題）
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
    ctx.scale(dpr, dpr);
    // 移除舊的事件監聽器再重新綁定，避免重複
    canvas.removeEventListener('mousedown', onPointerDown);
    canvas.removeEventListener('mousemove', onPointerMove);
    canvas.removeEventListener('mouseup', onPointerUp);
    canvas.removeEventListener('mouseleave', onPointerUp);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onPointerUp);
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);
    canvas.addEventListener('touchstart', onTouchStart, {passive:false});
    canvas.addEventListener('touchmove', onTouchMove, {passive:false});
    canvas.addEventListener('touchend', onPointerUp);
}

function loadStage() {
    // 輪迴挑戰模式
    if (isRoguelike) {
        if (currentStage >= roguelikeEnemies.length) { showRoguelikeResult(true); return; }
        const e = roguelikeEnemies[currentStage];
        enemy = JSON.parse(JSON.stringify(e));
        enemyMaxHp = e.hp; enemyHp = e.hp;
        enemyCd = e.cd; enemyMaxCd = e.cd;
        enemyBuffs = [];
        roguelikeFloor = currentStage + 1;

        const floorLabel = e._isBoss ? `BOSS 層 ${roguelikeFloor}` : `第 ${roguelikeFloor} 層`;
        document.getElementById('stage-info').textContent = `輪迴挑戰 ${floorLabel} / ${roguelikeTotalFloors}`;
        const spriteEl = document.getElementById('enemy-sprite');
        spriteEl.innerHTML = `<img src="${e.img}" alt="${e.name}" class="enemy-img">`;
        document.getElementById('enemy-name').textContent = `【${ELEMENTS[e.element].name}】${e.name}`;
        updateEnemyHp(); updateEnemyCd(); updateTeamHp();
        generateBoard(); drawBoard();
        playEnemyEntrance();
        return;
    }

    // 一般模式
    if (currentStage >= ENEMIES.length) { showResult(true); return; }
    const e = ENEMIES[currentStage];
    // Deep clone enemy to reset skills
    enemy = JSON.parse(JSON.stringify(e));
    enemyMaxHp = e.hp; enemyHp = e.hp;
    enemyCd = e.cd; enemyMaxCd = e.cd;
    enemyBuffs = [];

    document.getElementById('stage-info').textContent = `第 ${currentStage+1} 關 / ${ENEMIES.length}`;
    // 使用個別裁切的野怪圖片
    const spriteEl = document.getElementById('enemy-sprite');
    spriteEl.innerHTML = `<img src="${e.img}" alt="${e.name}" class="enemy-img">`;
    document.getElementById('enemy-name').textContent = `【${ELEMENTS[e.element].name}】${e.name}`;
    updateEnemyHp(); updateEnemyCd(); updateTeamHp();
    generateBoard(); drawBoard();
    playEnemyEntrance();
}

// ===== 盤面動畫循環（珠子閃光特效） =====
function startBoardAnimation() {
    stopBoardAnimation();
    function loop() {
        orbShimmerPhase += 0.03;
        // 更新戰鬥粒子
        updateBattleParticles();
        if (!isDragging && !animating) drawBoard();
        boardAnimId = requestAnimationFrame(loop);
    }
    boardAnimId = requestAnimationFrame(loop);
}
function stopBoardAnimation() {
    if (boardAnimId) { cancelAnimationFrame(boardAnimId); boardAnimId = null; }
}

// ===== 戰鬥粒子系統 =====
function spawnBattleParticles(cx, cy, color, count, type) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        const life = type === 'explode' ? 30 + Math.random() * 20 : 40 + Math.random() * 30;
        battleParticles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed * (type === 'explode' ? 2 : 0.5),
            vy: Math.sin(angle) * speed * (type === 'explode' ? 2 : 0.5) - (type === 'rise' ? 1.5 : 0),
            r: Math.random() * 3 + 1,
            color, life, maxLife: life, type
        });
    }
}

function updateBattleParticles() {
    for (let i = battleParticles.length - 1; i >= 0; i--) {
        const p = battleParticles[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.05; // gravity
        p.life--;
        if (p.life <= 0) battleParticles.splice(i, 1);
    }
}

function drawBattleParticles() {
    for (const p of battleParticles) {
        const alpha = p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ===== 盤面生成 =====
function generateBoard() {
    board = [];
    for (let r=0;r<ROWS;r++){board[r]=[];for(let c=0;c<COLS;c++) board[r][c]=randomOrb();}
    while(findMatches().length>0){for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)board[r][c]=randomOrb();}
}
function randomOrb(){return ORB_TYPES[Math.floor(Math.random()*ORB_TYPES.length)];}

// ===== 繪製盤面（含珠子閃光特效） =====
function drawBoard(floatingOrb) {
    ctx.clearRect(0, 0, canvasW, canvasH);
    // 背景格子（漸層 + 邊線）
    for (let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const base = (r+c)%2===0 ? [26,26,62] : [22,22,58];
        // 微妙的脈動光效
        const pulse = Math.sin(orbShimmerPhase * 0.5 + r * 0.3 + c * 0.3) * 0.03 + 0.85;
        ctx.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},${pulse})`;
        ctx.fillRect(c*orbSize, r*orbSize, orbSize, orbSize);
        // 格線
        ctx.strokeStyle = 'rgba(100,200,255,0.06)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(c*orbSize, r*orbSize, orbSize, orbSize);
    }
    // 盤面邊緣內光
    const edgeGrad = ctx.createLinearGradient(0, 0, 0, canvasH);
    edgeGrad.addColorStop(0, 'rgba(100,200,255,0.08)');
    edgeGrad.addColorStop(0.5, 'rgba(100,200,255,0)');
    edgeGrad.addColorStop(1, 'rgba(100,200,255,0.05)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 繪製珠子（含閃光）
    for (let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        if(isDragging&&dragOrb&&r===dragOrb.row&&c===dragOrb.col) continue;
        if(board[r][c]) drawOrb(c*orbSize+orbSize/2, r*orbSize+orbSize/2, board[r][c], orbSize*0.46, false, r, c);
    }
    // 拖曳路徑光跡
    if (isDragging && dragPath.length > 1) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        for (let i = 0; i < dragPath.length; i++) {
            const px = dragPath[i].col * orbSize + orbSize / 2;
            const py = dragPath[i].row * orbSize + orbSize / 2;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
    }
    // 戰鬥粒子
    drawBattleParticles();
    // 拖曳中的珠子
    if(floatingOrb&&dragOrb) drawOrb(floatingOrb.x, floatingOrb.y, board[dragOrb.row][dragOrb.col], orbSize*0.52, true);
}

function drawOrb(cx, cy, type, radius, glow, row, col) {
    const el = ELEMENTS[type];
    if (!el) return;
    ctx.save();

    // 珠子閃光效果
    const shimmer = row !== undefined ? Math.sin(orbShimmerPhase + row * 0.7 + col * 1.1) * 0.12 + 0.88 : 1;

    const orbImg = orbImages[type];
    if (orbImg && orbImg.complete && orbImg.naturalWidth > 0) {
        const drawSize = radius * 1.9;

        // 高品質圖片渲染
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 底部陰影（讓珠子有立體感）
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 3;
        ctx.beginPath(); ctx.arc(cx, cy+2, radius*0.7, 0, Math.PI*2); ctx.fill();
        ctx.restore();

        // 拖曳光暈（畫在圖片下方）
        if(glow){
            ctx.save();
            ctx.shadowColor = el.color; ctx.shadowBlur = 28;
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = el.color;
            ctx.beginPath(); ctx.arc(cx, cy, radius+4, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }

        // 直接繪製去背圖片（不裁切）
        ctx.globalAlpha = shimmer;
        if(glow){ ctx.shadowColor = el.color; ctx.shadowBlur = 18; }
        ctx.drawImage(orbImg, cx-drawSize/2, cy-drawSize/2, drawSize, drawSize);

        // 珠子表面高光
        ctx.globalAlpha = shimmer * 0.18;
        const hlGrad = ctx.createRadialGradient(cx-radius*0.25, cy-radius*0.3, 0, cx, cy, radius*0.9);
        hlGrad.addColorStop(0, 'rgba(255,255,255,1)');
        hlGrad.addColorStop(0.4, 'rgba(255,255,255,0.3)');
        hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hlGrad;
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2); ctx.fill();

        ctx.restore();

        // 拖曳外圈光環
        if(glow){
            ctx.save(); ctx.shadowColor=el.color; ctx.shadowBlur=24; ctx.strokeStyle=el.color;
            ctx.lineWidth=2; ctx.globalAlpha=0.6;
            ctx.beginPath(); ctx.arc(cx,cy,radius+3,0,Math.PI*2); ctx.stroke();
            ctx.globalAlpha=0.15; ctx.lineWidth=1;
            ctx.beginPath(); ctx.arc(cx,cy,radius+8,0,Math.PI*2); ctx.stroke();
            ctx.restore();
        }
    } else {
        // 備用 emoji
        if(glow){ctx.shadowColor=el.color;ctx.shadowBlur=20;}
        const grad=ctx.createRadialGradient(cx-radius*0.3,cy-radius*0.3,radius*0.1,cx,cy,radius);
        grad.addColorStop(0,el.color); grad.addColorStop(1,el.darkColor);
        ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(cx,cy,radius,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=2; ctx.stroke();
        ctx.shadowBlur=0; ctx.font=`${radius*0.9}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(el.emoji,cx,cy+2); ctx.restore();
    }
}

// ===== 拖曳操作 =====
function getOrbPos(e){const rect=canvas.getBoundingClientRect(); const x=e.clientX-rect.left,y=e.clientY-rect.top;
    return {x,y,col:Math.floor(x/orbSize),row:Math.floor(y/orbSize)};}
function onTouchStart(e){e.preventDefault(); const t=e.touches[0]; onPointerDown({clientX:t.clientX,clientY:t.clientY});}
function onTouchMove(e){e.preventDefault(); const t=e.touches[0]; onPointerMove({clientX:t.clientX,clientY:t.clientY});}
function onPointerDown(e){
    if(animating)return; const pos=getOrbPos(e);
    if(pos.row<0||pos.row>=ROWS||pos.col<0||pos.col>=COLS)return;
    isDragging=true; dragOrb={row:pos.row,col:pos.col}; dragPath=[{row:pos.row,col:pos.col}]; drawBoard({x:pos.x,y:pos.y});
    SFX.play('tap');
}
function onPointerMove(e){
    if(!isDragging||!dragOrb)return; const pos=getOrbPos(e);
    const newRow=Math.max(0,Math.min(ROWS-1,pos.row)), newCol=Math.max(0,Math.min(COLS-1,pos.col));
    if(newRow!==dragOrb.row||newCol!==dragOrb.col){
        const temp=board[newRow][newCol]; board[newRow][newCol]=board[dragOrb.row][dragOrb.col]; board[dragOrb.row][dragOrb.col]=temp;
        dragOrb={row:newRow,col:newCol}; dragPath.push({row:newRow,col:newCol});
        SFX.play('orbMove');
    }
    drawBoard({x:pos.x,y:pos.y});
}
function onPointerUp(){
    if(!isDragging)return; isDragging=false; dragOrb=null; drawBoard();
    if(dragPath.length>1){animating=true; SFX.play('orbDrop'); resolveBoard();}
}

// ===== 消除邏輯 =====
function findMatches(){
    const matched=new Set();
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS-2;c++){
        const t=board[r][c]; if(t&&board[r][c+1]===t&&board[r][c+2]===t){
            let end=c+2; while(end+1<COLS&&board[r][end+1]===t)end++;
            for(let i=c;i<=end;i++)matched.add(`${r},${i}`);
        }
    }
    for(let c=0;c<COLS;c++) for(let r=0;r<ROWS-2;r++){
        const t=board[r][c]; if(t&&board[r+1][c]===t&&board[r+2][c]===t){
            let end=r+2; while(end+1<ROWS&&board[end+1][c]===t)end++;
            for(let i=r;i<=end;i++)matched.add(`${i},${c}`);
        }
    }
    return [...matched];
}
function getMatchGroups(){
    const visited=Array.from({length:ROWS},()=>Array(COLS).fill(false));
    const matches=findMatches(), matchSet=new Set(matches), groups=[];
    for(const key of matches){
        const [r,c]=key.split(',').map(Number); if(visited[r][c])continue;
        const type=board[r][c]; let count=0; const queue=[[r,c]]; visited[r][c]=true;
        while(queue.length>0){const [cr,cc]=queue.shift(); count++;
            for(const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0]]){
                const nr=cr+dr,nc=cc+dc;
                if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&!visited[nr][nc]&&matchSet.has(`${nr},${nc}`)&&board[nr][nc]===type){
                    visited[nr][nc]=true; queue.push([nr,nc]);
                }
            }
        }
        groups.push({type,count,cells:[]});
    }
    // 重新收集每組的格子座標（用於逐顆消除動畫）
    const visited2=Array.from({length:ROWS},()=>Array(COLS).fill(false));
    groups.length = 0;
    for(const key of matches){
        const [r,c]=key.split(',').map(Number); if(visited2[r][c])continue;
        const type=board[r][c]; const cells=[]; const queue=[[r,c]]; visited2[r][c]=true;
        while(queue.length>0){const [cr,cc]=queue.shift(); cells.push({r:cr,c:cc});
            for(const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0]]){
                const nr=cr+dr,nc=cc+dc;
                if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&!visited2[nr][nc]&&matchSet.has(`${nr},${nc}`)&&board[nr][nc]===type){
                    visited2[nr][nc]=true; queue.push([nr,nc]);
                }
            }
        }
        groups.push({type,count:cells.length,cells});
    }
    return groups;
}
function removeMatches(matches){for(const key of matches){const [r,c]=key.split(',').map(Number); board[r][c]=null;}}
function dropOrbs(){
    for(let c=0;c<COLS;c++){
        let wr=ROWS-1; for(let r=ROWS-1;r>=0;r--){if(board[r][c]!==null){board[wr][c]=board[r][c]; if(wr!==r)board[r][c]=null; wr--;}}
        for(let r=wr;r>=0;r--) board[r][c]=randomOrb();
    }
}

// ===== 消除結算（逐顆消除 + 特效） =====
async function resolveBoard() {
    let totalCombo = 0, totalDamage = 0, totalHeal = 0;
    let allGroups = [];

    while (true) {
        const matches = findMatches();
        if (matches.length === 0) break;

        const groups = getMatchGroups();
        allGroups.push(...groups);
        // 每一組連消 = 1 combo（不是每波才 +1）
        totalCombo += groups.length;

        // 逐組消除動畫
        let groupIdx = 0;
        for (const group of groups) {
            groupIdx++;
            const el = ELEMENTS[group.type];
            // 逐顆消除：每顆珠子依序閃爍消失
            for (let i = 0; i < group.cells.length; i++) {
                const cell = group.cells[i];
                const cx = cell.c * orbSize + orbSize / 2;
                const cy = cell.r * orbSize + orbSize / 2;

                // 爆破粒子（更多、更華麗）
                spawnBattleParticles(cx, cy, el.color, 14, 'explode');
                spawnBattleParticles(cx, cy, '#fff', 4, 'explode');
                SFX.play('orbClear');

                board[cell.r][cell.c] = null;
                drawBoard();

                // 繪製多層爆破光圈
                ctx.save();
                // 外圈光暈
                ctx.globalAlpha = 0.5;
                ctx.shadowColor = el.color;
                ctx.shadowBlur = 30;
                const outerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbSize * 0.7);
                outerGrad.addColorStop(0, el.color);
                outerGrad.addColorStop(0.5, el.color + '44');
                outerGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = outerGrad;
                ctx.beginPath();
                ctx.arc(cx, cy, orbSize * 0.7, 0, Math.PI * 2);
                ctx.fill();
                // 內圈白光
                ctx.globalAlpha = 0.9;
                const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbSize * 0.4);
                innerGrad.addColorStop(0, '#fff');
                innerGrad.addColorStop(0.4, el.color);
                innerGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = innerGrad;
                ctx.beginPath();
                ctx.arc(cx, cy, orbSize * 0.4, 0, Math.PI * 2);
                ctx.fill();
                // 十字光芒
                ctx.globalAlpha = 0.6;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.shadowColor = '#fff';
                ctx.shadowBlur = 8;
                const crossLen = orbSize * 0.35;
                ctx.beginPath();
                ctx.moveTo(cx - crossLen, cy); ctx.lineTo(cx + crossLen, cy);
                ctx.moveTo(cx, cy - crossLen); ctx.lineTo(cx, cy + crossLen);
                ctx.stroke();
                ctx.restore();

                await sleep(45);
            }
            // 每組消完顯示當前 combo 數
            showCombo(totalCombo - groups.length + groupIdx);
            SFX.play('combo', totalCombo - groups.length + groupIdx);
            await sleep(100);
        }

        await sleep(100);
        dropOrbs();
        drawBoard();
        await sleep(250);
    }

    if (totalCombo > 0) {
        turnCount++;
        const turnEl = document.getElementById('battle-turn-count');
        if (turnEl) turnEl.textContent = `回合 ${turnCount}`;

        // 計算傷害（每組獨立計算，combo 加成套用在全部組上）
        let elementDamages = {}; // 按屬性統計傷害
        for (const g of allGroups) {
            if (g.type === 'heal') {
                totalHeal += 300 * g.count;
            } else {
                const dmg = calcDamage(g.type, g.count, totalCombo);
                totalDamage += dmg;
                elementDamages[g.type] = (elementDamages[g.type] || 0) + dmg;
            }
        }

        // 大 Combo 特效
        if (totalCombo >= 3) {
            showBigCombo(totalCombo);
            SFX.play('bigCombo');
            await sleep(800);
        }

        // 顯示每個角色的個別傷害數字
        for (let ci = 0; ci < team.length; ci++) {
            const c = team[ci];
            const charDmg = elementDamages[c.element] || 0;
            if (charDmg > 0) {
                const perCharDmg = Math.floor(charDmg * (c.atk / team.filter(t => t.element === c.element).reduce((s, t) => s + t.atk, 0)));
                showCharDamage(ci, perCharDmg, c.element);
            }
        }

        // 追蹤每日任務
        trackDailyCombo(totalCombo);
        const totalOrbsCleared = allGroups.reduce((s, g) => s + g.count, 0);
        trackDailyOrbs(totalOrbsCleared);
        renderBuffBar();

        // 回血
        if (totalHeal > 0) {
            teamHp = Math.min(teamMaxHp, teamHp + totalHeal);
            animateHpBar('team', totalHeal, true);
            showFloatingText('+' + totalHeal.toLocaleString(), '#7bed9f', 'team');
            SFX.play('heal');
            await sleep(400);
        }

        // 對敵人造成傷害
        if (totalDamage > 0) {
            // 檢查玩家增益
            const atkBuff = activeBuffs.find(b => b.type === 'atkUp');
            if (atkBuff) totalDamage = Math.floor(totalDamage * atkBuff.value);

            // 檢查敵人減傷
            const shield = enemyBuffs.find(b => b.type === 'shield');
            if (shield) totalDamage = Math.floor(totalDamage * (1 - shield.value));

            showDamage(totalDamage);
            spawnDamageParticles(totalDamage);
            enemyHp = Math.max(0, enemyHp - totalDamage);
            updateEnemyHp();
            animateHpBar('enemy', totalDamage, false);
            hitEnemy();
            SFX.play('hit');
            await sleep(600);
        }

        // 減少技能CD
        for (let i = 0; i < skillCooldowns.length; i++) {
            if (skillCooldowns[i] > 0) skillCooldowns[i]--;
        }
        renderTeam();

        // 減少增益回合
        activeBuffs = activeBuffs.filter(b => { b.turns--; return b.turns > 0; });
        enemyBuffs = enemyBuffs.filter(b => { b.turns--; return b.turns > 0; });
        renderBuffBar();

        // 敵人死亡？
        if (enemyHp <= 0) {
            await showEnemyDeath();
            if (isRoguelike) {
                currentStage++;
                if (currentStage >= roguelikeEnemies.length) { showRoguelikeResult(true); }
                else {
                    // 每層回復 20% HP
                    teamHp = Math.min(teamMaxHp, teamHp + Math.floor(teamMaxHp * 0.2));
                    updateTeamHp();
                    showFloatingText('+20% HP', '#7bed9f', 'team');
                    loadStage();
                }
            } else if (isStoryBattle) {
                showResult(true);
            } else {
                currentStage++;
                if (currentStage >= ENEMIES.length) { showResult(true); }
                else { loadStage(); }
            }
            animating = false; return;
        }

        // 檢查敵人技能觸發
        await checkEnemySkills();

        // 敵人回合
        enemyCd--;
        updateEnemyCd();
        if (enemyCd <= 0) {
            await showEnemyAttackWarning();
            await enemyAttack();
            enemyCd = enemyMaxCd;
            updateEnemyCd();
        }

        // 玩家死亡？
        if (teamHp <= 0) {
            if (isRoguelike) { showRoguelikeResult(false); }
            else { showResult(false); }
            animating = false; return;
        }
    }
    animating = false;
}

// ===== 傷害計算（平衡版）=====
// 最終傷害 = ATK × 技能區 × 領袖區 × Combo區 × 屬性區 × 特殊區 × 敵人區
// 領袖區 = 1 + 隊長% + 戰友%（加法制，不乘法）
// Combo區 = 1 + combo × 0.12（10 combo = 2.2x）
// 總倍率上限 50x
function calcDamage(orbType, orbCount, combo) {
    // 基礎攻擊力：該屬性所有角色的ATK總和
    let matchingCards = team.filter(c => c.element === orbType);
    let baseAtk = 0;
    if (matchingCards.length > 0) {
        baseAtk = matchingCards.reduce((s, c) => s + c.atk, 0);
    } else {
        return 0; // 無對應屬性角色時不造成傷害
    }
    // 珠子數量加成：3顆=1x, 4顆=1.25x, 5顆=1.5x ...
    const orbMul = 1 + (orbCount - 3) * 0.25;
    // Combo 加成：1 + combo × 0.12
    const comboMul = 1 + combo * 0.12;
    // 領袖區（加法制）
    const leaderMul = getLeaderSkillMultiplier(orbType);
    // 技能增傷 buff
    let skillMul = 1;
    const atkBuff = activeBuffs.find(b => b.type === 'atkUp');
    if (atkBuff) skillMul = atkBuff.value;
    // 屬性區（相剋/相生）
    let elementMul = 1;
    if (KE[orbType] === enemy.element) elementMul = 1.5;
    else if (SHENG[orbType] === enemy.element) elementMul = 1.25;
    if (KE[enemy.element] === orbType) elementMul = 0.5;
    // 玩家 debuff
    let debuffMul = 1;
    const atkDebuff = activeBuffs.find(b => b.type === 'atkDown');
    if (atkDebuff) debuffMul = 1 - atkDebuff.value;
    // 計算總傷害
    let dmg = baseAtk * orbMul * comboMul * leaderMul * skillMul * elementMul * debuffMul;
    // 總倍率上限 50x（以 baseAtk 為基準）
    if (baseAtk > 0 && dmg / baseAtk > 50) dmg = baseAtk * 50;
    return Math.floor(dmg);
}

// 隊長技倍率計算（加法制：1 + 隊長% + 戰友%）
// 讀取 leaderSkill.mult 陣列中 stat==='atk' 的 pct
function getLeaderSkillMultiplier(orbType) {
    let totalPct = 0;
    // 隊長（slot 0）
    if (team[0] && team[0].leaderSkill && team[0].leaderSkill.mult) {
        for (const m of team[0].leaderSkill.mult) {
            if (m.stat !== 'atk') continue;
            if (m.type === 'all' || (m.type === 'element' && m.element === orbType)) {
                totalPct += m.pct;
            }
        }
    }
    // 戰友（slot 最後一位，模擬好友隊長）— 暫用隊長自身
    // 未來可加好友系統，目前隊長技只算一次
    return 1 + totalPct;
}

// 隊伍技倍率（目前不額外乘法，已整合到領袖區）
function getTeamSkillMultiplier(orbType) {
    return 1;
}

// ===== 敵人技能系統 =====
async function checkEnemySkills() {
    if (!enemy.skills) return;
    const hpPct = enemyHp / enemyMaxHp * 100;

    // 先重置所有 _activatedThisTurn 標記
    for (const skill of enemy.skills) skill._activatedThisTurn = false;

    for (const skill of enemy.skills) {
        // HP 觸發型（統一處理）
        if (skill.trigger.startsWith('hp') && !skill.used) {
            const threshold = parseInt(skill.trigger.replace('hp', ''), 10);
            if (hpPct <= threshold) {
                skill.used = true; await executeEnemySkill(skill);
            }
        }
        // CD 觸發型
        if (skill.trigger === 'cd') {
            skill.counter = (skill.counter || 0) + 1;
            if (skill.counter >= skill.interval) {
                skill.counter = 0; await executeEnemySkill(skill);
            }
        }
    }
}

async function executeEnemySkill(skill) {
    // 顯示技能名稱
    await showEnemySkillAnnounce(skill.name, skill.desc);

    // === 通用敵人技能解析器 ===
    const eff = skill.effect;
    let boardChanged = false;
    let didShake = false;

    // doubleHit / tripleHit / doubleAttack / tripleAttack — 在攻擊階段處理
    if (['doubleHit','tripleHit','doubleAttack','tripleAttack'].includes(eff)) {
        skill._activatedThisTurn = true;
        await sleep(300); return;
    }

    // shuffleBoard / shuffle — 洗盤
    if (eff.includes('shuffle')) {
        for (let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) board[r][c]=randomOrb();
        while(findMatches().length>0){for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)board[r][c]=randomOrb();}
        boardChanged = true;
    }

    // aoeN — 全隊傷害（匹配所有含 aoe 的效果）
    const aoeMatch = eff.match(/aoe(\d+)/);
    if (aoeMatch) {
        const aoeDmg = parseInt(aoeMatch[1]);
        teamHp = Math.max(0, teamHp - aoeDmg); updateTeamHp();
        showFloatingText('-' + aoeDmg.toLocaleString(), '#ff4757', 'team');
        const shakeTime = Math.min(0.8, 0.3 + aoeDmg / 50000);
        const cg = document.getElementById('game-container');
        cg.style.animation = 'shake ' + shakeTime + 's'; await sleep(shakeTime * 1000); cg.style.animation = '';
        didShake = true;
    }

    // selfHealN — 敵人自身回復N% HP
    const selfHealMatch = eff.match(/selfHeal(\d+)/);
    if (selfHealMatch) {
        const pct = parseInt(selfHealMatch[1]) / 100;
        const heal = Math.floor(enemyMaxHp * pct);
        enemyHp = Math.min(enemyMaxHp, enemyHp + heal);
        updateEnemyHp();
        showFloatingText('+' + heal.toLocaleString(), '#2ed573', 'enemy');
    }

    // shieldN_T — 敵人減傷護盾 N% T回合
    const shieldMatch = eff.match(/shield(\d+)_(\d+)/);
    if (shieldMatch) {
        const val = parseInt(shieldMatch[1]) / 100;
        const turns = parseInt(shieldMatch[2]);
        enemyBuffs.push({ type: 'shield', value: val, turns: turns });
        showFloatingText('🛡 減傷 ' + (val*100) + '%', '#ffa502', 'enemy');
    }

    // permAtkUpN — 敵人永久攻擊力提升N%
    const permAtkMatch = eff.match(/permAtkUp(\d+)/);
    if (permAtkMatch) {
        const pct = parseInt(permAtkMatch[1]) / 100;
        enemy.atk = Math.floor(enemy.atk * (1 + pct));
        showFloatingText('⚔️ 攻擊力 UP！', '#ff4757', 'enemy');
    }

    // atkUpN_T — 敵人攻擊力提升N% T回合（臨時 buff，存到 enemyBuffs）
    const atkUpMatch = eff.match(/atkUp(\d+)_(\d+)/);
    if (atkUpMatch && !permAtkMatch) {
        const pct = parseInt(atkUpMatch[1]) / 100;
        const turns = parseInt(atkUpMatch[2]);
        enemyBuffs.push({ type: 'enemyAtkUp', value: pct, turns: turns });
        showFloatingText('⚔️ 攻擊力 +' + (pct*100) + '%！', '#ff4757', 'enemy');
    }

    // atkUp1.5（舊格式）
    if (eff === 'atkUp1.5') {
        enemy.atk = Math.floor(enemy.atk * 1.5);
        showFloatingText('⚔️ 攻擊力 UP！', '#ff4757', 'enemy');
    }

    // debuffAtkN_T — 降低玩家攻擊力N% T回合
    const debuffMatch = eff.match(/debuffAtk(\d+)_(\d+)/);
    if (debuffMatch) {
        const val = parseInt(debuffMatch[1]) / 100;
        const turns = parseInt(debuffMatch[2]);
        activeBuffs.push({ type: 'atkDown', value: val, turns: turns });
        showFloatingText('⚔️↓ 攻擊力降低！', '#ff6b81', 'team');
    }

    // convertAll_X / convertAll_X_Y — 全盤轉珠
    const convertAllMatch = eff.match(/convertAll_(\w+)/);
    if (convertAllMatch) {
        const parts = convertAllMatch[1].split('_');
        const validTypes = parts.filter(t => ORB_TYPES.includes(t) || t === 'heal');
        if (validTypes.length === 1) {
            for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) board[r][c]=validTypes[0];
        } else if (validTypes.length >= 2) {
            for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) board[r][c] = Math.random() < 0.6 ? validTypes[0] : validTypes[1];
        }
        boardChanged = true;
    }

    // convertN_X — 隨機轉N顆珠子為X屬性
    const convertNMatch = eff.match(/convert(\d+)_(\w+)/);
    if (convertNMatch && !convertAllMatch) {
        const n = parseInt(convertNMatch[1]);
        const t = convertNMatch[2];
        if (ORB_TYPES.includes(t) || t === 'heal') {
            for (let i = 0; i < n; i++) {
                const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS);
                board[r][c] = t;
            }
            boardChanged = true;
            showFloatingText('⚡ 珠子被轉化！', '#ff4757', 'team');
        }
    }

    // randomConvertN — 隨機轉N顆為隨機屬性（不含癒）
    const randomConvertMatch = eff.match(/randomConvert(\d+)/);
    if (randomConvertMatch && !convertNMatch) {
        const n = parseInt(randomConvertMatch[1]);
        for (let i = 0; i < n; i++) {
            const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS);
            board[r][c] = ORB_TYPES[Math.floor(Math.random()*5)];
        }
        boardChanged = true;
        showFloatingText('⚡ 珠子被轉化！', '#ff4757', 'team');
    }

    // convertRow_X / convertRows_X — 轉化底排
    const convertRowMatch = eff.match(/convertRows?_(\w+)/);
    if (convertRowMatch && !convertNMatch && !convertAllMatch) {
        const t = convertRowMatch[1];
        const rows = eff.includes('convertRows') ? 2 : 1;
        for (let r = ROWS - rows; r < ROWS; r++) for (let c = 0; c < COLS; c++) board[r][c] = t;
        boardChanged = true;
        showFloatingText('⚡ 底排被轉化！', '#ff4757', 'team');
    }

    // lockN_T — 封鎖N顆珠子T回合（目前簡化為轉化為隨機珠）
    const lockMatch = eff.match(/lock(\d+)_(\d+)/);
    if (lockMatch) {
        const n = parseInt(lockMatch[1]);
        for (let i = 0; i < n; i++) {
            const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS);
            board[r][c] = ORB_TYPES[Math.floor(Math.random()*5)];
        }
        boardChanged = true;
        showFloatingText('🔒 珠子被封鎖！', '#ff4757', 'team');
    }

    // chaosConvert — 混亂轉珠
    if (eff === 'chaosConvert') {
        for (let i = 0; i < 2; i++) {
            const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS);
            board[r][c] = ORB_TYPES[Math.floor(Math.random()*6)];
        }
        boardChanged = true;
    }

    // healN（for enemy: e.g. heal15 在複合效果中回復敵人）
    // 注意：只在沒有 selfHeal 的情況下，且eff包含 _heal 時回復敵人
    if (!selfHealMatch && eff.match(/_heal(\d+)/) && !eff.includes('convertHeal')) {
        const hm = eff.match(/_heal(\d+)/);
        if (hm) {
            const pct = parseInt(hm[1]) / 100;
            const heal = Math.floor(enemyMaxHp * pct);
            enemyHp = Math.min(enemyMaxHp, enemyHp + heal);
            updateEnemyHp();
            showFloatingText('+' + heal.toLocaleString(), '#2ed573', 'enemy');
        }
    }

    if (boardChanged) drawBoard();
    await sleep(300);
}

// ===== 敵人技能公告 =====
async function showEnemySkillAnnounce(name, desc) {
    const el = document.getElementById('enemy-skill-announce');
    if (!el) return;
    el.querySelector('.esk-name').textContent = name;
    el.querySelector('.esk-desc').textContent = desc;
    el.classList.add('show');
    SFX.play('enemySkill');
    await sleep(1200);
    el.classList.remove('show');
    await sleep(200);
}

// ===== 敵人攻擊警告 =====
async function showEnemyAttackWarning() {
    const cdEl = document.getElementById('enemy-cd');
    cdEl.classList.add('cd-warning');
    // 敵人蓄力紅光
    const sprite = document.getElementById('enemy-sprite');
    sprite.style.filter = 'drop-shadow(0 0 12px rgba(255,0,0,0.6))';
    await sleep(600);
    cdEl.classList.remove('cd-warning');
    sprite.style.filter = '';
}

async function enemyAttack() {
    const sprite = document.getElementById('enemy-sprite');
    const battleScreen = document.getElementById('battle-screen');
    const container = document.getElementById('game-container');

    // 敵人蓄力動畫
    sprite.style.transition = 'transform 0.3s, filter 0.3s';
    sprite.style.transform = 'scale(1.15)';
    sprite.style.filter = 'brightness(1.4) drop-shadow(0 0 15px rgba(255,0,0,0.5))';
    await sleep(250);

    // 衝擊攻擊
    sprite.classList.add('attack');
    sprite.style.transition = '';
    sprite.style.transform = '';
    sprite.style.filter = '';
    await sleep(150);

    // 螢幕白閃
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    battleScreen.appendChild(flash);
    setTimeout(() => flash.remove(), 250);

    await sleep(150);
    sprite.classList.remove('attack');

    let hits = 1;
    if (enemy.skills) {
        // doubleHit/tripleHit/doubleAttack/tripleAttack：檢查技能是否已觸發
        const ta = enemy.skills.find(s => (s.effect === 'tripleHit' || s.effect === 'tripleAttack') && (s.used || s._activatedThisTurn));
        const da = enemy.skills.find(s => (s.effect === 'doubleHit' || s.effect === 'doubleAttack') && (s.used || s._activatedThisTurn));
        if (ta) hits = 3;
        else if (da) hits = 2;
    }

    for (let h = 0; h < hits; h++) {
        let dmg = enemy.atk;
        const defBuff = activeBuffs.find(b => b.type === 'defUp');
        if (defBuff) dmg = Math.floor(dmg * (1 - defBuff.value));

        teamHp = Math.max(0, teamHp - dmg);
        animateHpBar('team', dmg, false);

        // 紅色暈影
        const vignette = document.createElement('div');
        vignette.className = 'enemy-attack-vignette';
        battleScreen.appendChild(vignette);
        setTimeout(() => vignette.remove(), 600);

        // 斬擊痕跡
        const slash = document.createElement('div');
        slash.className = 'enemy-attack-slash';
        const angles = [-35, 25, -10];
        for (let s = 0; s < (hits > 1 ? 2 : 3); s++) {
            const line = document.createElement('div');
            line.className = 'slash-line';
            line.style.transform = `rotate(${angles[s] + (h * 15)}deg)`;
            slash.appendChild(line);
        }
        battleScreen.appendChild(slash);
        setTimeout(() => slash.remove(), 500);

        // 傷害數字
        showFloatingText('-' + dmg.toLocaleString(), '#ff4757', 'team');
        SFX.play('enemyHit');

        // 震動
        shakeScreen(0.6);
        await sleep(350);

        if (hits > 1 && h < hits - 1) await sleep(150);
    }

    updateTeamHp();
    // 重置敵人攻擊力，累計所有永久提升（通用解析）
    const baseEnemyAtk = isRoguelike ? (roguelikeEnemies[currentStage] || ENEMIES[currentStage] || {atk:500}).atk : ENEMIES[currentStage].atk;
    enemy.atk = baseEnemyAtk;
    if (enemy.skills) {
        let permMul = 1;
        for (const s of enemy.skills) {
            if (s.used) {
                const pm = s.effect.match(/permAtkUp(\d+)/);
                if (pm) permMul *= (1 + parseInt(pm[1]) / 100);
            }
        }
        if (permMul > 1) enemy.atk = Math.floor(baseEnemyAtk * permMul);
    }
}

// ===== 敵人死亡特效 =====
async function showEnemyDeath() {
    const sprite = document.getElementById('enemy-sprite');
    const battleScreen = document.getElementById('battle-screen');
    SFX.play('enemyDeath');

    // 閃爍階段
    for (let i = 0; i < 4; i++) {
        sprite.style.filter = 'brightness(4) saturate(0)';
        await sleep(80);
        sprite.style.filter = 'brightness(1)';
        await sleep(80);
    }

    // 爆炸白光
    const flash = document.createElement('div');
    flash.className = 'enemy-death-flash';
    battleScreen.appendChild(flash);

    // 膨脹消失
    sprite.style.transition = 'all 0.5s ease-out';
    sprite.style.transform = 'scale(1.8)';
    sprite.style.opacity = '0';
    sprite.style.filter = 'brightness(5) saturate(0) blur(4px)';

    await sleep(600);
    flash.remove();

    // 重置
    sprite.style.transition = '';
    sprite.style.transform = '';
    sprite.style.opacity = '1';
    sprite.style.filter = '';
}

// ===== 退出戰鬥 =====
function confirmExitBattle() {
    document.getElementById('exit-battle-dialog').classList.remove('hidden');
}
function doExitBattle() {
    document.getElementById('exit-battle-dialog').classList.add('hidden');
    restartGame();
}
function cancelExitBattle() {
    document.getElementById('exit-battle-dialog').classList.add('hidden');
}

// ===== 敵人進場動畫 =====
function playEnemyEntrance() {
    const sprite = document.getElementById('enemy-sprite');
    const showcase = document.getElementById('enemy-showcase');
    sprite.classList.remove('enemy-enter');
    // 設定屬性光環顏色
    const aura = document.getElementById('enemy-aura');
    if (aura && enemy) {
        const auraColors = { fire: 'rgba(255,60,60,0.2)', water: 'rgba(60,100,255,0.2)', wood: 'rgba(60,200,80,0.2)', earth: 'rgba(255,165,0,0.2)', metal: 'rgba(200,200,230,0.2)' };
        showcase.style.setProperty('--enemy-color', auraColors[enemy.element] || 'rgba(255,100,100,0.15)');
    }
    // 閃光 + 衝擊波
    const flash = document.createElement('div');
    flash.className = 'enemy-enter-flash';
    sprite.appendChild(flash);
    const wave = document.createElement('div');
    wave.className = 'enemy-enter-shockwave';
    sprite.appendChild(wave);
    setTimeout(() => { flash.remove(); wave.remove(); }, 1000);
    // 觸發動畫
    void sprite.offsetWidth;
    sprite.classList.add('enemy-enter');
    setTimeout(() => sprite.classList.remove('enemy-enter'), 1000);
}

// ===== 技能確認系統 =====
let pendingSkillIdx = -1;

function useSkill(idx) {
    if (animating) return;
    if (skillCooldowns[idx] > 0) {
        showToast(`技能冷卻中（剩餘 ${skillCooldowns[idx]} 回合）`);
        return;
    }
    // 顯示確認對話框
    pendingSkillIdx = idx;
    const char = team[idx];
    const skill = char.activeSkill;
    const el = ELEMENTS[char.element];
    document.getElementById('skill-confirm-icon').innerHTML = `<img src="${el.orbImg}" alt="${el.name}" style="width:36px;height:36px;">`;
    document.getElementById('skill-confirm-name').textContent = skill.name;
    document.getElementById('skill-confirm-desc').textContent = skill.desc;
    document.getElementById('skill-confirm-dialog').classList.remove('hidden');
}

function cancelSkillUse() {
    pendingSkillIdx = -1;
    document.getElementById('skill-confirm-dialog').classList.add('hidden');
}

function confirmSkillUse() {
    document.getElementById('skill-confirm-dialog').classList.add('hidden');
    const idx = pendingSkillIdx;
    pendingSkillIdx = -1;
    if (idx < 0 || !team[idx]) return;
    executeSkill(idx);
}

function executeSkill(idx) {
    if (animating) return;
    const char = team[idx];
    const skill = char.activeSkill;
    skillCooldowns[idx] = skill.cd;
    animating = true;

    // 技能發動特效
    showSkillActivation(char, skill);
    SFX.play('skill');

    let skillDmg = 0;

    // === 通用技能解析器 ===
    const eff = skill.effect;
    let boardChanged = false;

    // convertAll_X / convertAll_X_Y — 全盤轉珠
    const convertAllMatch = eff.match(/convertAll_(\w+)/);
    if (convertAllMatch) {
        const types = convertAllMatch[1].split('_').filter(t => ORB_TYPES.includes(t) || t === 'heal');
        if (types.length === 1) {
            for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) board[r][c]=types[0];
        } else if (types.length >= 2) {
            for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) board[r][c] = Math.random() < 0.6 ? types[0] : types[1];
        }
        boardChanged = true;
        skillDmg = Math.floor(char.atk * 5);
    }

    // convertN_X — 隨機轉N顆珠子為X屬性
    const convertNMatch = eff.match(/convert(\d+)_(\w+)/);
    if (convertNMatch && !convertAllMatch) {
        const n = parseInt(convertNMatch[1]);
        const t = convertNMatch[2];
        if (ORB_TYPES.includes(t) || t === 'heal') {
            for (let i = 0; i < n; i++) {
                const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS);
                board[r][c] = t;
            }
            boardChanged = true;
        }
    }

    // healN / heal_N — 回復全隊N%生命力
    const healMatches = eff.match(/heal(\d+)/g);
    if (healMatches) {
        for (const hm of healMatches) {
            // 排除 genHeal (生成癒珠) 和 selfHeal
            if (eff.indexOf('selfHeal') >= 0) continue;
            const pctVal = parseInt(hm.replace('heal',''));
            if (pctVal > 0 && pctVal <= 100) {
                const heal = Math.floor(teamMaxHp * pctVal / 100);
                teamHp = Math.min(teamMaxHp, teamHp + heal);
                updateTeamHp();
                showFloatingText('+' + heal.toLocaleString(), '#7bed9f', 'team');
                break; // 只回復一次
            }
        }
    }

    // genHealN — 生成N顆癒珠
    const genHealMatch = eff.match(/genHeal(\d+)/);
    if (genHealMatch) {
        const n = parseInt(genHealMatch[1]);
        let placed = 0, attempts = 0;
        while (placed < n && attempts < 50) {
            const r=Math.floor(Math.random()*ROWS), c=Math.floor(Math.random()*COLS);
            if (board[r][c] !== 'heal') { board[r][c] = 'heal'; placed++; }
            attempts++;
        }
        boardChanged = true;
    }

    // burst_X_N / burst_X — 增傷 buff
    const burstMatch = eff.match(/burst[_]?(\w+?)(?:_(\d+))?(?:_|$)/);
    if (burstMatch && eff.includes('burst')) {
        // 解析增傷倍率
        const burstNums = eff.match(/burst\w*?_?(\d+)/g);
        let burstVal = 1.8; // 預設 80%
        if (burstNums) {
            for (const bn of burstNums) {
                const num = parseInt(bn.match(/(\d+)$/)[1]);
                if (num >= 50 && num <= 200) { burstVal = 1 + num / 100; break; }
            }
        }
        const turns = 2;
        activeBuffs.push({ type: 'atkUp', value: burstVal, turns });
        showFloatingText('⚔️ 攻擊力 UP！', '#ff4757', 'team');
        if (!healMatches) skillDmg = Math.floor(char.atk * 4);
    }

    // shieldN_T — 減傷N% T回合
    const shieldMatch = eff.match(/shield(\d+)_(\d+)/);
    if (shieldMatch) {
        const val = parseInt(shieldMatch[1]) / 100;
        const turns = parseInt(shieldMatch[2]);
        activeBuffs.push({ type: 'defUp', value: val, turns });
        showFloatingText('🛡 防禦力 UP！', '#ffa502', 'team');
    }

    // delayN — 延遲敵人行動N回合
    const delayMatch = eff.match(/delay(\d+)/);
    if (delayMatch) {
        const n = parseInt(delayMatch[1]);
        enemyCd += n;
        updateEnemyCd();
        showFloatingText(`⏳ 敵人延遲 ${n} 回合`, '#64c8ff', 'enemy');
        skillDmg = Math.floor(char.atk * 3);
    }

    // megaBurst_X — 超級爆發
    if (eff.includes('megaBurst')) {
        skillDmg = Math.floor(char.atk * 7);
        const megaNums = eff.match(/(\d+)x?/);
        const megaVal = megaNums ? parseInt(megaNums[1]) : 2.5;
        activeBuffs.push({ type: 'atkUp', value: megaVal > 10 ? megaVal : megaVal, turns: 1 });
        showFloatingText('💥 超級爆發！', '#ffd700', 'team');
    }

    // convertHeal — 將癒珠轉為角色屬性珠
    if (eff.includes('convertHeal')) {
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(board[r][c]==='heal') board[r][c]=char.element;
        boardChanged = true;
    }

    // _def — 防禦 buff（不帶 shield 格式的）
    if (eff.includes('_def') && !shieldMatch) {
        activeBuffs.push({ type: 'defUp', value: 0.5, turns: 3 });
        showFloatingText('🛡 防禦力 UP！', '#ffa502', 'team');
    }

    // fullHeal_shield50 — 特殊：全回復 + 減傷50% 5回合
    if (eff === 'fullHeal_shield50') {
        teamHp = teamMaxHp;
        updateTeamHp();
        showFloatingText('+' + teamMaxHp.toLocaleString(), '#7bed9f', 'team');
        activeBuffs.push({ type: 'defUp', value: 0.5, turns: 5 });
        showFloatingText('🛡 減傷 50%！', '#ffa502', 'team');
    }

    if (boardChanged) drawBoard();

    // 造成傷害並檢查敵人死亡
    if (skillDmg > 0) {
        enemyHp = Math.max(0, enemyHp - skillDmg);
        updateEnemyHp(); hitEnemy();
        showDamage(skillDmg);
    }
    renderTeam();

    // 延遲後檢查敵人是否死亡
    setTimeout(async () => {
        if (enemyHp <= 0) {
            await showEnemyDeath();
            if (isRoguelike) {
                currentStage++;
                if (currentStage >= roguelikeEnemies.length) { showRoguelikeResult(true); }
                else {
                    teamHp = Math.min(teamMaxHp, teamHp + Math.floor(teamMaxHp * 0.2));
                    updateTeamHp();
                    showFloatingText('+20% HP', '#7bed9f', 'team');
                    loadStage();
                }
            } else if (isStoryBattle) {
                showResult(true);
            } else {
                currentStage++;
                if (currentStage >= ENEMIES.length) { showResult(true); }
                else { loadStage(); }
            }
        }
        animating = false;
    }, 800);
}

// ===== 技能發動特效 =====
function showSkillActivation(char, skill) {
    const el = ELEMENTS[char.element];
    const overlay = document.createElement('div');
    overlay.className = 'skill-activation-overlay';
    overlay.innerHTML = `
        <div class="skill-activation-flash" style="background:${el.color}"></div>
        <div class="skill-activation-text">
            <div class="skill-char-name">${char.title} ‧ ${char.name}</div>
            <div class="skill-name-display">${skill.name}</div>
        </div>
    `;
    document.getElementById('battle-screen').appendChild(overlay);
    setTimeout(() => overlay.classList.add('show'), 10);
    setTimeout(() => { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 300); }, 1200);
}

// ===== UI 更新 =====
function updateEnemyHp() {
    const pct = Math.max(0, enemyHp / enemyMaxHp * 100);
    const fill = document.getElementById('enemy-hp-fill');
    fill.style.width = pct + '%';
    // 低血量變色
    if (pct <= 20) fill.style.background = 'linear-gradient(90deg, #ff0000, #ff4444)';
    else if (pct <= 50) fill.style.background = 'linear-gradient(90deg, #ff6b00, #ff9500)';
    else fill.style.background = 'linear-gradient(90deg, #e94560, #ff6b81)';
    document.getElementById('enemy-hp-text').textContent = `${Math.max(0,enemyHp).toLocaleString()} / ${enemyMaxHp.toLocaleString()}`;
}

function updateEnemyCd() {
    const cdEl = document.getElementById('enemy-cd');
    // CD 圓點顯示
    let dots = '';
    for (let i = 0; i < enemyMaxCd; i++) {
        dots += i < enemyCd ? '🔴' : '⚫';
    }
    cdEl.innerHTML = `攻擊倒數 ${dots} <span class="cd-num">${enemyCd}</span>`;
    // CD=1 時閃爍警告
    if (enemyCd <= 1) cdEl.classList.add('cd-danger');
    else cdEl.classList.remove('cd-danger');
}

function updateTeamHp() {
    const pct = Math.max(0, teamHp / teamMaxHp * 100);
    const fill = document.getElementById('team-hp-fill');
    fill.style.width = pct + '%';
    if (pct <= 20) fill.style.background = 'linear-gradient(90deg, #ff0000, #ff4444)';
    else if (pct <= 50) fill.style.background = 'linear-gradient(90deg, #ffa502, #ffcc00)';
    else fill.style.background = 'linear-gradient(90deg, #2ed573, #7bed9f)';
    document.getElementById('team-hp-text').textContent = `${Math.max(0,teamHp).toLocaleString()} / ${teamMaxHp.toLocaleString()}`;
}

// HP 條受擊/回復動畫
function animateHpBar(target, amount, isHeal) {
    const bar = document.getElementById(target === 'enemy' ? 'enemy-hp-bar' : 'team-hp-bar');
    if (!bar) return;
    bar.classList.add(isHeal ? 'hp-heal-flash' : 'hp-damage-flash');
    setTimeout(() => bar.classList.remove('hp-heal-flash', 'hp-damage-flash'), 400);
}

// ===== 渲染隊伍（含技能按鈕） =====
function renderTeam() {
    const area = document.getElementById('team-area');
    area.innerHTML = '';
    for (let i = 0; i < team.length; i++) {
        const c = team[i];
        const el = ELEMENTS[c.element];
        const cd = skillCooldowns[i];
        const ready = cd <= 0;

        const card = document.createElement('div');
        card.className = 'team-card' + (ready ? ' skill-ready' : '');
        card.onclick = () => useSkill(i);
        card.innerHTML = `
            <img src="${c.img}" alt="${c.name}">
            <span class="card-element"><img src="${el.orbImg}" alt="${el.name}" style="width:18px;height:18px;"></span>
            <div class="skill-cd-overlay ${ready ? 'ready' : ''}">
                ${ready ? '<span class="skill-ready-icon">✦</span>' : `<span class="skill-cd-num">${cd}</span>`}
            </div>
            ${ready ? '<div class="skill-ready-glow"></div>' : ''}
        `;
        card.title = `${c.activeSkill.name}\n${c.activeSkill.desc}`;
        area.appendChild(card);
    }
}

// ===== 動畫效果 =====
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

// Combo 顯示（每次消除）
// 屬性傷害顏色
const ELEMENT_DMG_COLORS = {
    fire: '#ff4444', water: '#44aaff', wood: '#44dd44',
    earth: '#ddaa44', metal: '#ddddff', heal: '#88ff88'
};

function showCombo(combo) {
    const el = document.getElementById('combo-display');
    const pct = Math.round((combo - 1) * 25);
    const color = combo >= 7 ? '#ff4757' : combo >= 5 ? '#ffd700' : combo >= 3 ? '#64c8ff' : '#fff';
    el.innerHTML = `<span class="combo-num" style="color:${color}">${combo}</span><span class="combo-text">Combo</span><span class="combo-pct" style="color:${color}">+${pct}%</span>`;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 700);
}

// 大 Combo 特效（3+ combo 結算時）
function showBigCombo(combo) {
    const el = document.getElementById('combo-display');
    const pct = Math.round((combo - 1) * 25);
    const colors = combo >= 8 ? '#ff4757' : combo >= 6 ? '#ff6b9d' : combo >= 4 ? '#ffd700' : '#64c8ff';
    const glow = combo >= 8 ? 'rgba(255,71,87,0.6)' : combo >= 6 ? 'rgba(255,107,155,0.5)' : combo >= 4 ? 'rgba(255,215,0,0.5)' : 'rgba(100,200,255,0.4)';
    el.innerHTML = `<span class="combo-num big" style="color:${colors};text-shadow:0 0 30px ${glow},0 0 60px ${glow},0 2px 6px rgba(0,0,0,0.9);">${combo}</span><span class="combo-text">${combo >= 6 ? 'AMAZING!!' : 'Combo!!'}</span><span class="combo-pct big" style="color:${colors};">+${pct}%</span>`;
    el.className = 'combo-big-show';
    if (combo >= 5) {
        const flash = document.createElement('div');
        flash.className = 'screen-flash';
        flash.style.background = colors;
        flash.style.opacity = '0';
        flash.style.animation = 'screenFlashAnim 0.3s ease-out forwards';
        document.getElementById('battle-screen').appendChild(flash);
        setTimeout(() => flash.remove(), 400);
    }
    setTimeout(() => { el.className = ''; el.innerHTML = ''; }, 1400);
}

// 顯示每個角色的個別傷害數字（屬性顏色）
function showCharDamage(charIdx, dmg, element) {
    const teamArea = document.getElementById('team-area');
    if (!teamArea) return;
    const cards = teamArea.querySelectorAll('.team-card');
    if (!cards[charIdx]) return;
    const card = cards[charIdx];
    const color = ELEMENT_DMG_COLORS[element] || '#fff';
    const numEl = document.createElement('div');
    numEl.className = 'char-dmg-num';
    numEl.textContent = dmg.toLocaleString();
    numEl.style.color = color;
    numEl.style.textShadow = `0 0 8px ${color}, 0 2px 4px rgba(0,0,0,0.9)`;
    card.style.position = 'relative';
    card.appendChild(numEl);
    setTimeout(() => numEl.remove(), 1200);
}

function showDamage(dmg) {
    const el = document.getElementById('damage-display');
    const isBig = dmg >= 10000;
    const isHuge = dmg >= 50000;
    const isMega = dmg >= 200000;
    el.style.fontSize = isMega ? '52px' : isHuge ? '48px' : isBig ? '42px' : '38px';
    el.style.color = isMega ? '#ff0' : isHuge ? '#ff6b81' : isBig ? '#ffa502' : '#ff4757';
    el.textContent = `-${dmg.toLocaleString()}`;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 900);
}

function hitEnemy() {
    const sprite = document.getElementById('enemy-sprite');
    sprite.classList.add('hit');
    setTimeout(() => sprite.classList.remove('hit'), 300);

    // 斬擊特效
    const slash = document.createElement('div');
    slash.className = 'attack-slash-overlay';
    slash.innerHTML = '<div class="attack-slash-line"></div><div class="attack-slash-line"></div>';
    document.getElementById('enemy-area').appendChild(slash);
    setTimeout(() => slash.remove(), 400);

    // 螢幕微閃
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    flash.style.opacity = '0';
    document.getElementById('battle-screen').appendChild(flash);
    setTimeout(() => flash.remove(), 250);

    // 螢幕震動
    shakeScreen(0.3);
}

// 螢幕震動效果
function shakeScreen(intensity) {
    const bs = document.getElementById('battle-screen');
    if (!bs) return;
    const dur = intensity > 0.5 ? 400 : 250;
    const amp = Math.round(intensity * 8);
    bs.style.animation = `shake ${dur}ms ease-out`;
    bs.style.setProperty('--shake-amp', amp + 'px');
    setTimeout(() => { bs.style.animation = ''; }, dur + 50);
}

// 傷害數字噴射粒子（大傷害時觸發）
function spawnDamageParticles(dmg) {
    const bs = document.getElementById('battle-screen');
    if (!bs || dmg < 5000) return;
    const count = Math.min(20, Math.floor(dmg / 3000));
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'dmg-particle';
        const x = 40 + Math.random() * 20;
        const y = 20 + Math.random() * 15;
        const dx = (Math.random() - 0.5) * 120;
        const dy = -30 - Math.random() * 60;
        const size = 2 + Math.random() * 3;
        const hue = 30 + Math.random() * 30; // gold-orange
        p.style.cssText = `left:${x}%;top:${y}%;width:${size}px;height:${size}px;background:hsl(${hue},100%,65%);--dx:${dx}px;--dy:${dy}px;animation-delay:${i * 30}ms;`;
        bs.appendChild(p);
        setTimeout(() => p.remove(), 800);
    }
}

// 浮動文字（傷害/回復/狀態）
function showFloatingText(text, color, target) {
    const container = document.getElementById(target === 'enemy' ? 'enemy-area' : 'team-hp-area');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    el.style.color = color;
    el.style.textShadow = `0 0 12px ${color}, 0 2px 6px rgba(0,0,0,0.9)`;
    // 隨機偏移避免重疊
    const offsetX = (Math.random() - 0.5) * 40;
    el.style.left = `calc(50% + ${offsetX}px)`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 1200);
}

// ===== 增益狀態列渲染 =====
function renderBuffBar() {
    const bar = document.getElementById('buff-bar');
    if (!bar) return;
    bar.innerHTML = '';
    const allBuffs = [
        ...activeBuffs.map(b => ({ ...b, side: 'player' })),
        ...enemyBuffs.map(b => ({ ...b, side: 'enemy' }))
    ];
    for (const b of allBuffs) {
        let icon = '', label = '', color = '';
        if (b.type === 'atkUp') { icon = '⚔️'; label = `攻${Math.round(b.value * 100)}%`; color = '#ff4757'; }
        else if (b.type === 'atkDown') { icon = '⚔️↓'; label = `攻-${Math.round(b.value * 100)}%`; color = '#ff6b81'; }
        else if (b.type === 'defUp') { icon = '🛡'; label = `防${Math.round(b.value * 100)}%`; color = '#ffa502'; }
        else if (b.type === 'shield') { icon = '🛡'; label = `減傷${Math.round(b.value * 100)}%`; color = '#64c8ff'; }
        else { icon = '✦'; label = b.type; color = '#ccc'; }
        const sideTag = b.side === 'enemy' ? '👹' : '';
        bar.innerHTML += `<div style="display:flex;align-items:center;gap:2px;background:rgba(0,0,0,0.5);border:1px solid ${color}33;border-radius:4px;padding:1px 5px;font-size:8px;color:${color};white-space:nowrap;">${sideTag}${icon} ${label} <span style="color:#888;">${b.turns}T</span></div>`;
    }
}

// ===== 每日任務進度追蹤 =====
function trackDailyBattle() {
    if (typeof DAILY_QUESTS === 'undefined') return;
    // 完成 1 場主線戰鬥
    DAILY_QUESTS[0].progress = Math.min(DAILY_QUESTS[0].target, DAILY_QUESTS[0].progress + 1);
    // 完成 3 場戰鬥
    DAILY_QUESTS[1].progress = Math.min(DAILY_QUESTS[1].target, DAILY_QUESTS[1].progress + 1);
}

function trackDailyOrbs(count) {
    if (typeof DAILY_QUESTS === 'undefined') return;
    DAILY_QUESTS[3].progress = Math.min(DAILY_QUESTS[3].target, DAILY_QUESTS[3].progress + count);
}

function trackDailyCombo(combo) {
    if (typeof DAILY_QUESTS === 'undefined') return;
    if (combo > DAILY_QUESTS[4].progress) {
        DAILY_QUESTS[4].progress = Math.min(DAILY_QUESTS[4].target, combo);
    }
    // 解鎖 combo 徽章
    if (combo >= 5 && typeof checkBadgeUnlocks === 'function') {
        if (typeof unlockedBadges !== 'undefined' && !unlockedBadges.includes('combo5')) {
            unlockedBadges.push('combo5');
            checkBadgeUnlocks();
        }
    }
    // 新手任務 combo 追蹤
    if (typeof trackRookieQuest === 'function') trackRookieQuest('maxCombo', combo);
}

// ===== BOSS 掉落卡牌定義 =====
const BOSS_DROP_CARDS = [
    { name: '千手觀音', title: '慈悲憐憫', element: 'water', rarity: 'SSR', race: '神佛',
      img: '野怪/慈悲憐憫千手觀音 — 水.png', lv: 1, maxLv: 99, atk: 2500, hp: 10000, rcv: 800, cost: 30,
      activeSkill: { name: '千手慈悲', cd: 12, desc: '回復全隊 100% 生命力\n5 回合減傷 50%', effect: 'fullHeal_shield50' },
      leaderSkill: { name: '慈悲普渡', desc: '水屬性角色全能力 3 倍' },
      teamSkill: { name: '佛光普照', desc: '隊伍中有神佛族時\n全隊回復力額外 2 倍' },
      bond: { name: '三聖之絆', desc: '與其他神佛同隊時\n全隊攻擊力 1.5 倍' },
      bossEnemyIdx: 30 },
    { name: '阿修羅', title: '墮落深淵', element: 'fire', rarity: 'SSR', race: '魔神',
      img: '野怪/墮落深淵阿修羅 — 火.png', lv: 1, maxLv: 99, atk: 3500, hp: 7000, rcv: 200, cost: 30,
      activeSkill: { name: '六臂連斬', cd: 8, desc: '對敵方造成火屬性巨額傷害\n自身攻擊力 4 倍持續 1 回合', effect: 'megaBurst_fire4x' },
      leaderSkill: { name: '修羅霸道', desc: '火屬性角色攻擊力 4 倍\n回復力歸零' },
      teamSkill: { name: '深淵之力', desc: '隊伍中有魔神族時\n全隊攻擊力額外 1.5 倍' },
      bond: { name: '三聖之絆', desc: '與其他神佛同隊時\n全隊攻擊力 1.5 倍' },
      bossEnemyIdx: 31 },
    { name: '如來', title: '眾生信仰', element: 'wood', rarity: 'SSR', race: '神佛',
      img: '野怪/眾生信仰如來 — 木.png', lv: 1, maxLv: 99, atk: 2800, hp: 12000, rcv: 600, cost: 30,
      activeSkill: { name: '如來神掌', cd: 10, desc: '對敵方造成木屬性巨額傷害\n回復全隊 50% 生命力', effect: 'megaBurst_wood_heal50' },
      leaderSkill: { name: '涅槃寂靜', desc: '全隊生命力 3 倍\n木屬性攻擊力 3 倍' },
      teamSkill: { name: '菩提智慧', desc: '隊伍中有神佛族時\n全隊生命力額外 1.5 倍' },
      bond: { name: '三聖之絆', desc: '與其他神佛同隊時\n全隊攻擊力 1.5 倍' },
      bossEnemyIdx: 32 },
];

// ===== 輪迴挑戰結果畫面 =====
function showRoguelikeResult(win) {
    stopBoardAnimation();
    SFX.stopBGM();
    const screen = document.getElementById('result-screen');
    screen.classList.add('show');

    const floorsCleared = currentStage;
    const goldReward = Math.floor(floorsCleared * 150 + (win ? 5000 : 0));
    const expReward = Math.floor(floorsCleared * 20 + (win ? 500 : 0));
    const gemReward = win ? 30 : Math.floor(floorsCleared / 10) * 5;
    playerGold += goldReward;
    if (gemReward > 0) playerGems += gemReward;
    if (typeof gainExp === 'function') gainExp(expReward);
    trackDailyBattle();

    // 技能書掉落（通關層數越多機率越高）
    const RACES = ['人', '神', '魔', '龍', '獸'];
    let droppedBooks = [];
    const bookChance = Math.min(0.5, 0.05 + floorsCleared * 0.008);
    const bookCount = win ? 3 : Math.floor(floorsCleared / 15);
    for (let i = 0; i < bookCount; i++) {
        if (Math.random() < bookChance) {
            const race = RACES[Math.floor(Math.random() * RACES.length)];
            droppedBooks.push(race);
            if (typeof skillBooks !== 'undefined') {
                skillBooks[race] = (skillBooks[race] || 0) + 1;
            }
        }
    }

    if (win) {
        SFX.play('victory');
        screen.innerHTML = `
            <div class="result-overlay">
                <div class="result-header" style="color:#ffd700;">輪迴挑戰</div>
                <div class="result-divider" style="color:#ffd700;">★ 全 ${roguelikeTotalFloors} 層通關 ★</div>
                <div class="result-complete" style="color:#ffd700;text-shadow:0 0 20px #ffd700;">Complete!</div>
                <div class="result-rewards">
                    <div class="reward-row"><span class="reward-label">通關層數</span><span class="reward-val" style="color:#ffd700;">${floorsCleared} / ${roguelikeTotalFloors}</span></div>
                    <div class="reward-row"><span class="reward-label">獲得金幣</span><span class="reward-val gold">${goldReward.toLocaleString()}</span></div>
                    <div class="reward-row"><span class="reward-label">獲得 Exp</span><span class="reward-val exp">${expReward.toLocaleString()}</span></div>
                    <div class="reward-row"><span class="reward-label">獲得鑽石</span><span class="reward-val gem"><img src="其他圖示/鑽石圖示.png" style="width:18px;height:18px;vertical-align:middle;margin-right:2px;"> ×${gemReward}</span></div>
                </div>
                ${droppedBooks.length > 0 ? `
                <div class="result-loot-section">
                    <div class="result-loot-title">戰利品</div>
                    <div class="result-loot-items">
                        ${droppedBooks.map(b => `<div class="loot-item"><span class="loot-icon">📕</span><span>${b}族技能書 ×1</span></div>`).join('')}
                    </div>
                </div>` : ''}
                <div class="result-buttons">
                    <button class="result-btn-back" onclick="restartGame()">返回選單</button>
                </div>
            </div>`;
    } else {
        SFX.play('defeat');
        screen.innerHTML = `
            <div class="result-overlay fail">
                <div class="result-header" style="color:#ff6b81;">輪迴挑戰</div>
                <div class="result-complete fail-text">挑戰結束</div>
                <div class="result-fail-msg">在第 ${floorsCleared + 1} 層倒下</div>
                <div class="result-rewards" style="margin-top:12px;">
                    <div class="reward-row"><span class="reward-label">通關層數</span><span class="reward-val" style="color:#ff6b81;">${floorsCleared} / ${roguelikeTotalFloors}</span></div>
                    <div class="reward-row"><span class="reward-label">獲得金幣</span><span class="reward-val gold">${goldReward.toLocaleString()}</span></div>
                    <div class="reward-row"><span class="reward-label">獲得 Exp</span><span class="reward-val exp">${expReward.toLocaleString()}</span></div>
                    ${gemReward > 0 ? `<div class="reward-row"><span class="reward-label">獲得鑽石</span><span class="reward-val gem"><img src="其他圖示/鑽石圖示.png" style="width:18px;height:18px;vertical-align:middle;margin-right:2px;"> ×${gemReward}</span></div>` : ''}
                </div>
                ${droppedBooks.length > 0 ? `
                <div class="result-loot-section">
                    <div class="result-loot-title">戰利品</div>
                    <div class="result-loot-items">
                        ${droppedBooks.map(b => `<div class="loot-item"><span class="loot-icon">📕</span><span>${b}族技能書 ×1</span></div>`).join('')}
                    </div>
                </div>` : ''}
                <div class="result-buttons">
                    <button class="result-btn-back" onclick="restartGame()">返回選單</button>
                </div>
            </div>`;
    }
    saveGame();
}

// ===== 結果畫面 =====
function showResult(win) {
    stopBoardAnimation();
    SFX.stopBGM();
    const screen = document.getElementById('result-screen');
    screen.classList.add('show');

    if (win) {
        SFX.play('victory');

        // 計算獎勵
        const stage = STORY_CHAPTERS?.[currentStoryChapter]?.stages?.[currentStoryStage];
        const goldReward = stage ? Math.floor(500 + stage.cost * 100 + currentStoryChapter * 200) : 500;
        const expReward = stage ? Math.floor(30 + stage.cost * 15 + currentStoryChapter * 20 + currentStoryStage * 10) : 50;
        playerGold += goldReward;

        // 首次通關獎勵
        let firstClearGems = 0;
        let isFirstClear = false;
        if (typeof storyProgress !== 'undefined' && storyProgress[currentStoryChapter]) {
            isFirstClear = !storyProgress[currentStoryChapter][currentStoryStage];
            const wasChapterCleared = storyProgress[currentStoryChapter].every(s => s);
            storyProgress[currentStoryChapter][currentStoryStage] = true;
            const isChapterCleared = storyProgress[currentStoryChapter].every(s => s);
            if (isFirstClear) firstClearGems = 5;
            if (!wasChapterCleared && isChapterCleared && typeof STORY_CHAPTERS !== 'undefined') {
                const ch = STORY_CHAPTERS[currentStoryChapter];
                if (ch && ch.reward) {
                    const rewardLabel = ch.reward.label || '';
                    if (rewardLabel.includes('×')) {
                        const amount = parseInt(rewardLabel.replace(/[^\d]/g, ''), 10) || 0;
                        if (ch.reward.icon === '💎') { playerGems += amount; firstClearGems += amount; }
                        else if (ch.reward.icon === '🪙') playerGold += amount;
                    }
                }
            }
        }
        if (firstClearGems > 0) playerGems += (isFirstClear ? 5 : 0);

        // BOSS 掉落判定（1% 機率）
        let droppedCard = null;
        if (stage) {
            const bossCard = BOSS_DROP_CARDS.find(b => b.bossEnemyIdx === stage.enemyIdx);
            if (bossCard && Math.random() < 0.01) {
                droppedCard = { ...bossCard };
                delete droppedCard.bossEnemyIdx;
                ownedCards.push(droppedCard);
                ensureBaseStats(droppedCard);
            }
        }

        // 經驗值
        if (typeof gainExp === 'function') gainExp(expReward);
        trackDailyBattle();

        // 新手任務追蹤
        if (typeof trackRookieQuest === 'function') trackRookieQuest('clearStage');

        // 技能書掉落（隨機種族，10% 機率掉落 1 本）
        const RACES = ['人', '神', '魔', '龍', '獸'];
        let droppedBook = null;
        if (Math.random() < 0.10) {
            droppedBook = RACES[Math.floor(Math.random() * RACES.length)];
            if (typeof skillBooks !== 'undefined') {
                skillBooks[droppedBook] = (skillBooks[droppedBook] || 0) + 1;
            }
        }

        // 渲染結算畫面
        const stageName = stage ? `${STORY_CHAPTERS[currentStoryChapter].name} - ${stage.name}` : '戰鬥';
        screen.innerHTML = `
            <div class="result-overlay">
                <div class="result-header">${stageName}</div>
                <div class="result-divider">◆ 戰鬥結算 ◆</div>
                <div class="result-complete">Complete</div>
                <div class="result-rewards">
                    <div class="reward-row"><span class="reward-label">獲得金幣</span><span class="reward-val gold">${goldReward.toLocaleString()}</span></div>
                    <div class="reward-row"><span class="reward-label">獲得 Exp</span><span class="reward-val exp">${expReward.toLocaleString()}</span></div>
                    ${isFirstClear ? `<div class="reward-row first-clear"><span class="reward-label"><img src="其他圖示/星星圖示 — 通關亮星（32×32）.png" style="width:18px;height:18px;vertical-align:middle;margin-right:4px;"> 首次通關</span><span class="reward-val gem"><img src="其他圖示/鑽石圖示.png" style="width:18px;height:18px;vertical-align:middle;margin-right:2px;"> ×5</span></div>` : ''}
                </div>
                ${droppedCard ? `
                <div class="result-drop-section">
                    <div class="result-drop-title">✦ 稀有掉落 ✦</div>
                    <div class="result-drop-card">
                        <img src="${droppedCard.img}" alt="${droppedCard.name}">
                        <div class="drop-card-info">
                            <span class="drop-rarity ssr">SSR</span>
                            <span class="drop-name">${droppedCard.title}・${droppedCard.name}</span>
                        </div>
                    </div>
                </div>` : ''}
                <div class="result-loot-section">
                    <div class="result-loot-title">戰利品</div>
                    <div class="result-loot-items">
                        <div class="loot-item"><span class="loot-icon"><img src="其他圖示/金幣圖示.png" style="width:20px;height:20px;vertical-align:middle;"></span><span>${goldReward.toLocaleString()}</span></div>
                        ${droppedBook ? `<div class="loot-item"><span class="loot-icon">📕</span><span>${droppedBook}族技能書 ×1</span></div>` : ''}
                        ${droppedCard ? `<div class="loot-item"><img src="${droppedCard.img}" class="loot-card-img"><span class="loot-ssr">${droppedCard.name}</span></div>` : ''}
                    </div>
                </div>
                <div class="result-buttons">
                    <button class="result-btn-back" onclick="restartGame()">返回選單</button>
                </div>
            </div>`;

        saveGame();
    } else {
        screen.innerHTML = `
            <div class="result-overlay fail">
                <div class="result-complete fail-text">挑戰失敗</div>
                <div class="result-fail-msg">隊伍全滅，請強化角色後再次挑戰</div>
                <div class="result-buttons">
                    <button class="result-btn-back" onclick="restartGame()">返回選單</button>
                </div>
            </div>`;
        SFX.play('defeat');
    }
}

// ===== 頁面載入自動讀檔 =====
const SAVE_VERSION = 3; // 改版時遞增此數字，強制清檔
let hasSaveData = false;
window.addEventListener('DOMContentLoaded', () => {
    // 版本不符 → 強制清除所有存檔
    const savedVer = parseInt(localStorage.getItem('caitiankm_save_version') || '0');
    if (savedVer < SAVE_VERSION) {
        localStorage.removeItem('caitiankm_save');
        localStorage.removeItem('caitiankm_starter_done');
        localStorage.removeItem('caitiankm_prologue_done');
        localStorage.setItem('caitiankm_save_version', String(SAVE_VERSION));
    }
    // 有存檔但未完成初始角色選擇 → 強制清除存檔重頭來
    if (localStorage.getItem(SAVE_KEY) && !localStorage.getItem('caitiankm_starter_done')) {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem('caitiankm_prologue_done');
    }
    if (loadGame() && playerName) {
        hasSaveData = true;
    }
});
