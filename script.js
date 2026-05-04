// --- LOGIC & MATH ---

        let modes = {
            p1: { dmg: 'calc', hp: 'calc', range: 'cac' },
            p2: { dmg: 'calc', hp: 'calc', range: 'dist' }
        };

        // Tier system
        const SKILL_TIERS = {
            1: ['arrows', 'meat', 'shout'],
            2: ['berserk', 'cannonbarrage', 'shuriken'],
            3: ['buff', 'rainofarrows', 'thorns'],
            4: ['bomb', 'meteorite', 'morale'],
            5: ['lightning', 'stampede', 'worm'],
            6: ['drone', 'highermorale', 'straferun']
        };

        function onTierChange(prefix) {
            const tier = parseInt(document.getElementById(`${prefix}-tier`)?.value || '6');
            const skills = SKILL_TIERS[tier] || SKILL_TIERS[6];
            for (let i = 0; i < 3; i++) {
                let sel = document.getElementById(`${prefix}-skill${i+1}-id`);
                if (sel) sel.value = skills[i];
            }
            saveAndCalc();
        }

        function getUseSkills() {
            const el = document.getElementById('g-use-skills');
            return el ? el.checked : true;
        }
        function getUseRegen() {
            const el = document.getElementById('g-use-regen');
            return el ? el.checked : true;
        }

        function setMode(player, type, mode) {
            modes[player][type] = mode;
            document.getElementById(`${player}-mode-${type}-calc`).classList.toggle('active', mode === 'calc');
            document.getElementById(`${player}-mode-${type}-direct`).classList.toggle('active', mode === 'direct');
            if (type === 'dmg') {
                document.getElementById(`${player}-base`).disabled = (mode === 'direct');
                document.getElementById(`${player}-pdegat`).disabled = (mode === 'direct');
                document.getElementById(`${player}-direct-dmg`).disabled = (mode === 'calc');
            } else {
                document.getElementById(`${player}-hp`).disabled = (mode === 'direct');
                document.getElementById(`${player}-php`).disabled = (mode === 'direct');
                document.getElementById(`${player}-direct-hp`).disabled = (mode === 'calc');
            }
            saveAndCalc();
        }

        function setRange(player, type) {
            modes[player].range = type;
            document.getElementById(`${player}-range-cac`).classList.toggle('active', type === 'cac');
            document.getElementById(`${player}-range-dist`).classList.toggle('active', type === 'dist');
            saveAndCalc();
        }

        function getNum(id) { 
            let val = parseFloat(document.getElementById(id)?.value) || 0;
            let unitEl = document.getElementById(id + '-unit');
            let unit = unitEl ? (parseFloat(unitEl.value) || 1) : 1;
            return val * unit;
        }

        function getPlayerStats(prefix) {
            const player = prefix;
            const global = getGlobalSettings();
            const type = modes[player].range;

            const stats = {
                windup: type === 'cac' ? global.cacWindup : global.distWindup,
                recovery: type === 'cac' ? global.cacRecovery : global.distRecovery,
                fixedInt: type === 'cac' ? global.cacFixed : global.distFixed,
                doubleDelay: type === 'cac' ? global.cacDouble : global.distDouble,
                pvit: getNum(prefix + '-pvit') / 100,
                ccc: getNum(prefix + '-ccc') / 100,
                dcc: getNum(prefix + '-dcc') / 100,
                block: getNum(prefix + '-block') / 100,
                ls: getNum(prefix + '-ls') / 100,
                dc: getNum(prefix + '-dc') / 100,
                range: type === 'cac' ? global.rangeCac : global.rangeDist,
                regen: getUseRegen() ? getNum(prefix + '-regen') / 100 : 0
            };

            if (modes[player].dmg === 'calc') {
                const base = getNum(prefix + '-base');
                const pdegat = getNum(prefix + '-pdegat') / 100;
                stats.baseDmg = base * (1 + pdegat);
            } else {
                stats.baseDmg = getNum(prefix + '-direct-dmg');
            }

            if (modes[player].hp === 'calc') {
                const hpBase = getNum(prefix + '-hp');
                const php = getNum(prefix + '-php') / 100;
                stats.hpTotal = hpBase * (1 + php);
            } else {
                stats.hpTotal = getNum(prefix + '-direct-hp');
            }

            // Regen per second = hpTotal (before mult) * regen%
            stats.regenPerSec = stats.hpTotal * stats.regen;

            let ascLevel = parseInt(document.getElementById(`${prefix}-ascension`)?.value || '0');
            let ascMult = ASCENSION_MULTS[ascLevel] || 1;
            let sdmg = getNum(prefix + '-sdmg') / 100;
            let scdr = getNum(prefix + '-scdr') / 100;

            stats.ascLevel = ascLevel;
            stats.ascMult = ascMult;
            stats.sdmg = sdmg;
            stats.scdr = scdr;

            stats.skills = [];
            if (getUseSkills()) {
                for (let i = 1; i <= 3; i++) {
                    let skillId = document.getElementById(`${prefix}-skill${i}-id`)?.value || 'none';
                    if (skillId !== 'none' && SKILLS_DB[skillId]) {
                        let base = SKILLS_DB[skillId];
                        let isDot = base.dur > 0 && base.dmg > 0;
                        stats.skills.push({
                            id: skillId,
                            name: base.name,
                            cd: base.cd * (1 - scdr),
                            dur: base.dur,
                            dmg: base.dmg * ascMult * (1 + sdmg),
                            hp: base.hp * ascMult,
                            isDot: isDot,
                            nextCastTime: 3, // 3s initial delay
                            activeBuffEnd: 0,
                            dotEnd: 0,
                            lastDotTick: 0
                        });
                    }
                }
            }

            return stats;
        }

        function getGlobalSettings() {
            return {
                arenaSize: getNum('g-arena-size'),
                moveSpeed: getNum('g-move-speed'),
                hpMult: getNum('g-hp-mult'),
                cacWindup: getNum('g-cac-windup'),
                cacRecovery: getNum('g-cac-recovery'),
                cacFixed: getNum('g-cac-fixed'),
                cacDouble: getNum('g-cac-double'),
                distWindup: getNum('g-dist-windup'),
                distRecovery: getNum('g-dist-recovery'),
                distFixed: getNum('g-dist-fixed'),
                distDouble: getNum('g-dist-double'),
                rangeCac: getNum('g-range-cac'),
                rangeDist: getNum('g-range-dist'),
                spellStart: getNum('g-spell-start'),
                spellDur: getNum('g-spell-dur'),
                spellAtk: getNum('g-spell-atk'),
                spellHp: getNum('g-spell-hp')
            };
        }

        function computeTheoretics(s) {
            const spd = 1 + s.pvit;
            const t_norm = (s.windup + s.recovery) / spd + s.fixedInt;
            const t_extra_double = s.doubleDelay / spd;

            // Probabilités de double coup (Bridé à 100%)
            const p_double = Math.min(1.0, s.dc);
            const avg_hits = 1 + p_double;
            const t_avg = t_norm + (p_double * t_extra_double);

            const atk_s = avg_hits / t_avg;
            const d_base = s.baseDmg;
            const d_cc = d_base * (1.2 + s.dcc);
            const d_coup_solo = d_base * (1 - s.ccc) + d_cc * s.ccc;
            const block_mult = 1 - s.block;

            const dps_s_base = d_base * atk_s * block_mult * (1 - s.ccc);
            const dps_s_cc = d_cc * atk_s * block_mult * s.ccc;
            const dps_total = dps_s_base + dps_s_cc;
            const survie = dps_total * s.ls;

            return { atk_s, d_base, d_cc, d_coup: d_coup_solo * avg_hits, dps_s_base, dps_s_cc, dps_total, survie };
        }

        function updateUI(prefix, res) {
            document.getElementById(prefix + '-c-atk').innerText = res.atk_s.toFixed(4);
            document.getElementById(prefix + '-c-dbase').innerText = res.d_base.toFixed(2);
            document.getElementById(prefix + '-c-dcc').innerText = res.d_cc.toFixed(2);
            document.getElementById(prefix + '-c-dtot').innerText = res.d_coup.toFixed(2);
            document.getElementById(prefix + '-c-dps-b').innerText = res.dps_s_base.toFixed(2);
            document.getElementById(prefix + '-c-dps-c').innerText = res.dps_s_cc.toFixed(2);
            document.getElementById(prefix + '-c-dps-t').innerText = res.dps_total.toFixed(2);
            document.getElementById(prefix + '-c-surv').innerText = res.survie.toFixed(2);
        }

        function saveAndCalc() {
            const data = { modes: modes };
            document.querySelectorAll('.persist').forEach(el => {
                if (el.type === 'checkbox') data[el.id] = el.checked;
                else data[el.id] = el.value;
            });
            localStorage.setItem('forge_master_v4', JSON.stringify(data));
            const p1 = getPlayerStats('p1');
            const p2 = getPlayerStats('p2');
            updateUI('p1', computeTheoretics(p1));
            updateUI('p2', computeTheoretics(p2));
        }

        function loadSaved() {
            const raw = localStorage.getItem('forge_master_v4');
            if (raw) {
                const data = JSON.parse(raw);
                applyConfig(data);
            } else {
                // Init tiers on first load
                onTierChange('p1');
                onTierChange('p2');
                saveAndCalc();
            }
        }

        function applyConfig(data) {
            if (data.modes) modes = data.modes;
            Object.keys(data).forEach(id => {
                const el = document.getElementById(id);
                if (el && id !== 'modes') {
                    if (el.type === 'checkbox') el.checked = data[id];
                    else el.value = data[id];
                }
            });
            ['p1', 'p2'].forEach(p => {
                setMode(p, 'dmg', modes[p].dmg);
                setMode(p, 'hp', modes[p].hp);
                setRange(p, modes[p].range);
            });
            saveAndCalc();
        }

        function exportConfig() {
            const data = { modes: modes };
            document.querySelectorAll('.persist').forEach(el => data[el.id] = el.value);
            const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `forge_master_config_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }

        function importConfig(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    applyConfig(data);
                    alert("Configuration importée !");
                } catch (err) { alert("Erreur d'import."); }
            };
            reader.readAsText(file);
        }

        // --- SIMULATION ENGINE ---
        
const SKILLS_DB = {
    'none': { name: 'Aucune', dmg: 0, hp: 0, cd: 999, dur: 0 },
    'arrows': { name: 'Arrows', dmg: 315, hp: 0, cd: 7, dur: 0 },
    'meat': { name: 'Meat', dmg: 0, hp: 157, cd: 8, dur: 10 },
    'shout': { name: 'Shout', dmg: 236, hp: 0, cd: 6, dur: 0 },
    'berserk': { name: 'Berserk', dmg: 2015, hp: 0, cd: 8, dur: 10 },
    'cannonbarrage': { name: 'CannonBarrage', dmg: 2015, hp: 0, cd: 5, dur: 0 },
    'shuriken': { name: 'Shuriken', dmg: 2015, hp: 0, cd: 4, dur: 0 },
    'buff': { name: 'Buff', dmg: 10625, hp: 84995, cd: 8, dur: 10 },
    'rainofarrows': { name: 'RainOfArrows', dmg: 106242, hp: 0, cd: 10, dur: 0 },
    'thorns': { name: 'Thorns', dmg: 21759, hp: 0, cd: 5, dur: 0 },
    'bomb': { name: 'Bomb', dmg: 944376, hp: 0, cd: 6, dur: 0 },
    'meteorite': { name: 'Meteorite', dmg: 1573959, hp: 0, cd: 9, dur: 0 },
    'morale': { name: 'Morale', dmg: 201467, hp: 1611734, cd: 8, dur: 10 },
    'lightning': { name: 'Lightning', dmg: 3399751, hp: 0, cd: 3, dur: 0 },
    'stampede': { name: 'Stampede', dmg: 3399751, hp: 0, cd: 20, dur: 0 },
    'worm': { name: 'Worm', dmg: 6799502, hp: 0, cd: 8, dur: 0 },
    'drone': { name: 'Drone', dmg: 23609384, hp: 0, cd: 8, dur: 8 },
    'highermorale': { name: 'HigherMorale', dmg: 9791283, hp: 78330269, cd: 8, dur: 8 },
    'straferun': { name: 'StrafeRun', dmg: 21758408, hp: 0, cd: 10, dur: 0 }
};

const SKILL_KEYS = Object.keys(SKILLS_DB).filter(k => k !== 'none');
const ASCENSION_MULTS = [1, 50, 2549, 127548];

function populateSkillSelects() {
    let optionsHTML = '';
    for (let key in SKILLS_DB) {
        optionsHTML += `<option value="${key}">${SKILLS_DB[key].name}</option>`;
    }
    ['p1', 'p2'].forEach(p => {
        for(let i=1; i<=3; i++) {
            let el = document.getElementById(`${p}-skill${i}-id`);
            if(el) el.innerHTML = optionsHTML;
        }
        // Initialize tier skills
        onTierChange(p);
    });
}
setTimeout(populateSkillSelects, 10);

let visualInterval = null;

        function formatNumber(n) { if(n>=1e6) return (n/1e6).toFixed(2)+'M'; if(n>=1e3) return (n/1e3).toFixed(1)+'K'; return Math.round(n); }

function getCombatEntity(prefix, globalSettings) {
            const stats = getPlayerStats(prefix);
            const maxHp = stats.hpTotal * globalSettings.hpMult;
            const spd = 1 + stats.pvit;
            return {
                ...stats,
                hp: maxHp,
                maxHp: maxHp,
                pos: 0,
                nextAttackTime: 0,
                spellUsed: false,
                lastRegenTick: 0,
                tNorm: (stats.windup + stats.recovery) / spd + stats.fixedInt,
                tExtraDouble: stats.doubleDelay / spd
            };
        }

        function calcHitDamage(attacker, target, t, globalSettings) {
            if (Math.random() < target.block) return { damage: 0, isCrit: false, doubleCount: 0, isBlocked: true };
            const isSpellActive = t >= globalSettings.spellStart && t <= (globalSettings.spellStart + globalSettings.spellDur);
            const flatAtkBonus = isSpellActive ? globalSettings.spellAtk : 0;
            const d_base_combat = attacker.baseDmg + flatAtkBonus;
            const d_cc_combat = d_base_combat * (1.2 + attacker.dcc);
            let isCrit = Math.random() < attacker.ccc;
            let dmgBase = isCrit ? d_cc_combat : d_base_combat;

            let dc_chance = Math.min(1.0, attacker.dc);
            let doubleCount = (Math.random() < dc_chance) ? 1 : 0;

            let totalDmg = dmgBase * (1 + doubleCount);
            return { damage: totalDmg, isCrit: isCrit, doubleCount: doubleCount, isBlocked: false };
        }

        function showVisualDamage(targetEl, hit, isP1) {
            const popup = document.createElement('div');
            popup.className = 'dmg-popup';
            if (hit.isBlocked) { popup.style.color = '#94a3b8'; popup.innerText = 'BLOCKED'; }
            else {
                popup.style.color = hit.isCrit ? '#fbbf24' : '#fff';
                let txt = '';
                if (hit.doubleCount > 0) txt += (hit.doubleCount + 1) + 'x ';
                if (hit.isCrit) txt += 'CRIT! ';
                txt += Math.round(hit.damage);
                popup.innerText = txt;
            }
            const offsetX = (Math.random() - 0.5) * 30;
            popup.style.left = `calc(${targetEl.style.left} + ${offsetX}px)`;
            popup.style.bottom = '50px';
            document.getElementById('arena').appendChild(popup);
            setTimeout(() => popup.remove(), 800);
        }

        function triggerAttackAnim(elId) {
            const el = document.getElementById(elId);
            const animClass = elId === 'p1-sprite' ? 'attack-anim-1' : 'attack-anim-2';
            el.classList.remove(animClass);
            void el.offsetWidth;
            el.classList.add(animClass);
        }

        function runVisualCombat() {
            if (visualInterval) clearInterval(visualInterval);
            const g = getGlobalSettings();
            let p1 = getCombatEntity('p1', g);
            let p2 = getCombatEntity('p2', g);
            p1.pos = 0; p2.pos = g.arenaSize;
            let t = 0; const dt = 0.05;
            const p1Sprite = document.getElementById('p1-sprite');
            const p2Sprite = document.getElementById('p2-sprite');
            document.querySelectorAll('.dmg-popup').forEach(e => e.remove());

            visualInterval = setInterval(() => {
                t += dt;
                let dist = Math.abs(p2.pos - p1.pos);
                if (dist > p1.range) p1.pos += g.moveSpeed * dt;
                if (dist > p2.range) p2.pos -= g.moveSpeed * dt;
                p1.pos = Math.max(0, Math.min(p1.pos, g.arenaSize));
                p2.pos = Math.max(0, Math.min(p2.pos, g.arenaSize));
                dist = Math.abs(p2.pos - p1.pos);

                const isSpellActive = t >= g.spellStart && t <= (g.spellStart + g.spellDur);
                if (t >= g.spellStart && !p1.spellUsed) {
                    p1.maxHp += g.spellHp; p1.hp += g.spellHp; p1.spellUsed = true;
                    p2.maxHp += g.spellHp; p2.hp += g.spellHp; p2.spellUsed = true;
                }
                if (isSpellActive) { p1Sprite.classList.add('buffed'); p2Sprite.classList.add('buffed'); }
                else { p1Sprite.classList.remove('buffed'); p2Sprite.classList.remove('buffed'); }

                
                // --- REGEN LOGIC ---
                [p1, p2].forEach(entity => {
                    if (entity.regenPerSec > 0 && entity.hp > 0) {
                        let nextTick = entity.lastRegenTick + 1;
                        if (t >= nextTick) {
                            entity.hp = Math.min(entity.maxHp, entity.hp + entity.regenPerSec);
                            entity.lastRegenTick = nextTick;
                        }
                    }
                });

                // --- SKILLS LOGIC ---
                [p1, p2].forEach(attacker => {
                    let defender = (attacker === p1) ? p2 : p1;
                    let defSprite = (attacker === p1) ? p2Sprite : p1Sprite;
                    let atkSprite = (attacker === p1) ? p1Sprite : p2Sprite;
                    
                    // Remove expired buffs
                    attacker.skills.forEach(skill => {
                        if (skill.activeBuffEnd > 0 && t >= skill.activeBuffEnd) {
                            attacker.hp -= skill.hp;
                            attacker.maxHp -= skill.hp;
                            skill.activeBuffEnd = 0;
                        }
                    });

                    // DoT tick processing (Drone-like: dmg each second during dur)
                    attacker.skills.forEach(skill => {
                        if (skill.isDot && skill.dotEnd > 0 && t < skill.dotEnd && defender.hp > 0) {
                            let nextDotTick = skill.lastDotTick + 1;
                            if (t >= nextDotTick) {
                                let tickDmg = skill.dmg / skill.dur;
                                defender.hp -= tickDmg;
                                skill.lastDotTick = nextDotTick;
                                const popup = document.createElement('div');
                                popup.className = 'dmg-popup-skill';
                                popup.innerText = `[${skill.name}] ` + formatNumber(tickDmg);
                                const offsetX = (Math.random() - 0.5) * 60;
                                popup.style.left = `calc(${defSprite.style.left} + ${offsetX}px)`;
                                popup.style.bottom = '80px';
                                document.getElementById('arena').appendChild(popup);
                                setTimeout(() => popup.remove(), 1000);
                            }
                        }
                    });

                    // Cast skills
                    attacker.skills.forEach(skill => {
                        if (t >= skill.nextCastTime && attacker.hp > 0) {
                            skill.nextCastTime = t + skill.cd;
                            
                            if (skill.isDot && skill.dmg > 0 && defender.hp > 0) {
                                // DoT skill: start ticking damage each second
                                skill.dotEnd = t + skill.dur;
                                skill.lastDotTick = t; // first tick at cast time
                                let tickDmg = skill.dmg / skill.dur;
                                defender.hp -= tickDmg; // immediate first tick
                                const popup = document.createElement('div');
                                popup.className = 'dmg-popup-skill';
                                popup.innerText = `[${skill.name}] START ` + formatNumber(tickDmg);
                                const offsetX = (Math.random() - 0.5) * 60;
                                popup.style.left = `calc(${defSprite.style.left} + ${offsetX}px)`;
                                popup.style.bottom = '80px';
                                document.getElementById('arena').appendChild(popup);
                                setTimeout(() => popup.remove(), 1000);
                            } else if (!skill.isDot && skill.dmg > 0 && defender.hp > 0) {
                                // Instant damage skill
                                defender.hp -= skill.dmg;
                                const popup = document.createElement('div');
                                popup.className = 'dmg-popup-skill';
                                popup.innerText = `[${skill.name}] ` + formatNumber(skill.dmg);
                                const offsetX = (Math.random() - 0.5) * 60;
                                popup.style.left = `calc(${defSprite.style.left} + ${offsetX}px)`;
                                popup.style.bottom = '80px';
                                document.getElementById('arena').appendChild(popup);
                                setTimeout(() => popup.remove(), 1000);
                            }
                            
                            if (skill.hp > 0) {
                                attacker.maxHp += skill.hp;
                                attacker.hp += skill.hp;
                                skill.activeBuffEnd = t + skill.dur;
                            }
                        }
                    });
                });

                if (t >= p1.nextAttackTime && dist <= p1.range && p2.hp > 0) {
                    const hit = calcHitDamage(p1, p2, t, g);
                    p2.hp -= hit.damage; p1.hp = Math.min(p1.maxHp, p1.hp + (hit.damage * p1.ls));

                    // Durée basée sur le nombre de coups réellement tirés
                    const actionDuration = p1.tNorm + (hit.doubleCount * p1.tExtraDouble);

                    p1.nextAttackTime = t + actionDuration;
                    triggerAttackAnim('p1-sprite'); showVisualDamage(p2Sprite, hit, false);
                }
                if (t >= p2.nextAttackTime && dist <= p2.range && p1.hp > 0) {
                    const hit = calcHitDamage(p2, p1, t, g);
                    p1.hp -= hit.damage; p2.hp = Math.min(p2.maxHp, p2.hp + (hit.damage * p2.ls));

                    const actionDuration = p2.tNorm + (hit.doubleCount * p2.tExtraDouble);

                    p2.nextAttackTime = t + actionDuration;
                    triggerAttackAnim('p2-sprite'); showVisualDamage(p1Sprite, hit, true);
                }

                p1Sprite.style.left = `calc(${(p1.pos / g.arenaSize) * 100}% - 20px)`;
                p2Sprite.style.left = `calc(${(p2.pos / g.arenaSize) * 100}% - 20px)`;
                const p1HpPct = Math.max(0, (p1.hp / p1.maxHp) * 100);
                const p2HpPct = Math.max(0, (p2.hp / p2.maxHp) * 100);
                document.getElementById('p1-hp-bar').style.width = p1HpPct + '%';
                document.getElementById('p2-hp-bar').style.width = p2HpPct + '%';
                document.getElementById('p1-hp-txt').innerText = Math.round(p1HpPct) + '%';
                document.getElementById('p2-hp-txt').innerText = Math.round(p2HpPct) + '%';
                document.getElementById('combat-time').innerText = t.toFixed(1) + 's';

                if (p1.hp <= 0 || p2.hp <= 0 || t > 180) {
                    clearInterval(visualInterval);
                    document.getElementById('combat-time').innerText = (p1.hp > 0 ? "J1 GAGNE" : "J2 GAGNE") + " (" + t.toFixed(1) + "s)";
                }
            }, dt * 1000);
        }

        function runMassCombat() {
            const g = getGlobalSettings();
            let wins1 = 0, wins2 = 0, totalTime = 0;
            const simulations = 1000; const dt = 0.05;
            for (let i = 0; i < simulations; i++) {
                let p1 = getCombatEntity('p1', g);
                let p2 = getCombatEntity('p2', g);
                p1.skills = p1.skills.map(s => ({...s}));
                p2.skills = p2.skills.map(s => ({...s}));
                p1.pos = 0; p2.pos = g.arenaSize;
                let t = 0;
                while (p1.hp > 0 && p2.hp > 0 && t < 180) {
                    t += dt;
                    let dist = Math.abs(p2.pos - p1.pos);
                    if (dist > p1.range) p1.pos += g.moveSpeed * dt;
                    if (dist > p2.range) p2.pos -= g.moveSpeed * dt;
                    dist = Math.abs(p2.pos - p1.pos);
                    if (t >= g.spellStart && !p1.spellUsed) { p1.maxHp += g.spellHp; p1.hp += g.spellHp; p1.spellUsed = true; p2.maxHp += g.spellHp; p2.hp += g.spellHp; p2.spellUsed = true; }
                    
                    // Regen
                    [p1, p2].forEach(entity => {
                        if (entity.regenPerSec > 0 && entity.hp > 0) {
                            let nextTick = entity.lastRegenTick + 1;
                            if (t >= nextTick) { entity.hp = Math.min(entity.maxHp, entity.hp + entity.regenPerSec); entity.lastRegenTick = nextTick; }
                        }
                    });

                    [p1, p2].forEach(attacker => {
                        let defender = (attacker === p1) ? p2 : p1;
                        attacker.skills.forEach(skill => {
                            if (skill.activeBuffEnd > 0 && t >= skill.activeBuffEnd) {
                                attacker.hp -= skill.hp; attacker.maxHp -= skill.hp; skill.activeBuffEnd = 0;
                            }
                        });
                        // DoT ticks
                        attacker.skills.forEach(skill => {
                            if (skill.isDot && skill.dotEnd > 0 && t < skill.dotEnd && defender.hp > 0) {
                                let nextDotTick = skill.lastDotTick + 1;
                                if (t >= nextDotTick) { defender.hp -= (skill.dmg / skill.dur); skill.lastDotTick = nextDotTick; }
                            }
                        });
                        // Cast
                        attacker.skills.forEach(skill => {
                            if (t >= skill.nextCastTime && attacker.hp > 0) {
                                skill.nextCastTime = t + skill.cd;
                                if (skill.isDot && skill.dmg > 0 && defender.hp > 0) {
                                    skill.dotEnd = t + skill.dur; skill.lastDotTick = t; defender.hp -= (skill.dmg / skill.dur);
                                } else if (!skill.isDot && skill.dmg > 0 && defender.hp > 0) {
                                    defender.hp -= skill.dmg;
                                }
                                if (skill.hp > 0) { attacker.maxHp += skill.hp; attacker.hp += skill.hp; skill.activeBuffEnd = t + skill.dur; }
                            }
                        });
                    });

                    if (t >= p1.nextAttackTime && dist <= p1.range) {
                        const hit = calcHitDamage(p1, p2, t, g);
                        p2.hp -= hit.damage;
                        p1.hp = Math.min(p1.maxHp, p1.hp + (hit.damage * p1.ls));
                        p1.nextAttackTime = t + (p1.tNorm + hit.doubleCount * p1.tExtraDouble);
                    }
                    if (p2.hp > 0 && t >= p2.nextAttackTime && dist <= p2.range) {
                        const hit = calcHitDamage(p2, p1, t, g);
                        p1.hp -= hit.damage;
                        p2.hp = Math.min(p2.maxHp, p2.hp + (hit.damage * p2.ls));
                        p2.nextAttackTime = t + (p2.tNorm + hit.doubleCount * p2.tExtraDouble);
                    }
                }
                if (p1.hp > 0 && p2.hp <= 0) wins1++; else wins2++;
                totalTime += t;
            }
            document.getElementById('mass-results').classList.remove('hidden');
            document.getElementById('res-win-1').innerText = (wins1 / simulations * 100).toFixed(1) + '%';
            document.getElementById('res-win-2').innerText = (wins2 / simulations * 100).toFixed(1) + '%';
            document.getElementById('res-time').innerText = (totalTime / simulations).toFixed(1) + 's';
        }

        window.onload = loadSaved;
        // --- BENCHMARK MODULE ---
        let benchRunning = false;
        let benchBest = null;
        
        let benchStatsOrder = ['pvit', 'dc', 'dcc', 'ccc', 'block', 'ls', 'pdegat', 'php', 'sdmg', 'scdr', 'regen'];
        let benchNames = { pvit: 'Vit', dc: 'Dbl', dcc: 'DCC', ccc: 'CC', block: 'Blc', ls: 'VdV', pdegat: 'Dgt', php: 'PV', sdmg: 'SDmg', scdr: 'SCD', regen: 'Reg' };


        function toggleBenchmark() {
            benchRunning = !benchRunning;
            const btn = document.getElementById('bench-btn');
            const text = document.getElementById('bench-btn-text');
            const icon = document.getElementById('bench-btn-icon');

            if (benchRunning) {
                btn.classList.replace('bg-indigo-600', 'bg-red-600');
                btn.classList.replace('hover:bg-indigo-500', 'hover:bg-red-500');
                text.innerText = "Arrêter le Benchmark";
                icon.classList.add('bg-white');
                runBenchmarkLoop();
            } else {
                btn.classList.replace('bg-red-600', 'bg-indigo-600');
                btn.classList.replace('hover:bg-red-500', 'hover:bg-indigo-500');
                text.innerText = "Lancer le Benchmark";
                icon.classList.remove('animate-pulse');
            }
        }

        let topBuilds = []; // Stocke les 5 meilleurs builds {rolls, winRate}
        let benchCache = new Map(); // Mémoire : "rolls-string" -> {winRate, sims}

        async function runBenchmarkLoop() {
            let testedCount = 0;
            let cycleCount = 0;
            const DEEP_CLEAN_INTERVAL = 2000;
            benchCache.clear();
            topBuilds = []; // Reset Top 5

            let p1Tier = parseInt(document.getElementById('p1-tier')?.value || '6');
            let tierSkills = SKILL_TIERS[p1Tier] || SKILL_TIERS[6];
            let currentBuild = { rolls: [0, 3, 8, 8, 0, 2, 3, 0, 0, 0, 0], skills: [...tierSkills] };

            const statusEl = document.getElementById('bench-status');
            const progressEl = document.getElementById('bench-cycle-progress');

            while (benchRunning) {
                testedCount++;
                cycleCount++;
                document.getElementById('bench-count').innerText = `Builds testés : ${testedCount}`;

                let isDeepPhase = (topBuilds.length > 0 && cycleCount >= DEEP_CLEAN_INTERVAL);
                let simsCount = isDeepPhase ? 2000 : 500;

                let progress = (cycleCount / DEEP_CLEAN_INTERVAL) * 100;
                progressEl.style.width = Math.min(100, progress) + '%';
                progressEl.style.backgroundColor = isDeepPhase ? '#fbbf24' : '#6366f1';

                if (isDeepPhase) {
                    let targetIdx = (cycleCount - DEEP_CLEAN_INTERVAL) % topBuilds.length;
                    let targetBuild = topBuilds[targetIdx];
                    statusEl.innerText = `💎 POLISSAGE TOP ${targetIdx + 1} (${cycleCount - DEEP_CLEAN_INTERVAL + 1}/500)...`;
                    statusEl.style.color = "#fbbf24";
                    currentBuild = mutateRolls(targetBuild, 1);
                } else {
                    statusEl.innerText = `🔍 EXPLORATION GLOBALE (${cycleCount}/${DEEP_CLEAN_INTERVAL})...`;
                    statusEl.style.color = "#94a3b8";
                    if (topBuilds.length > 0 && Math.random() < 0.7) {
                        let base = topBuilds[Math.floor(Math.random() * topBuilds.length)];
                        currentBuild = mutateRolls(base, 2);
                    } else {
                        currentBuild = generateRandomBuild(24);
                    }
                }

                let cacheKey = currentBuild.rolls.join(',') + '|' + currentBuild.skills.join(',');
                let winRate;
                let cached = benchCache.get(cacheKey);

                if (cached && cached.sims >= simsCount) {
                    winRate = cached.winRate;
                } else {
                    winRate = runBenchSims('p1', currentBuild, simsCount);
                    benchCache.set(cacheKey, { winRate: winRate, sims: simsCount });
                }

                updateBenchStatsUI('bench-current-stats', currentBuild, winRate, 'bench-current-win');
                updateTopBuilds(currentBuild, winRate);

                if (cycleCount >= DEEP_CLEAN_INTERVAL + 500) { cycleCount = 0; }
                await new Promise(r => setTimeout(r, 10));
            }

            statusEl.innerText = "Benchmark arrêté.";
        }

        
        
        function generateRandomBuild(totalPoints) {
            let numStats = 11;
            let rolls = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            let remaining = totalPoints;
            const isCac = (modes.p1.range === 'cac');

            rolls[1] = Math.min(3, Math.floor(Math.random() * 4));
            remaining -= rolls[1];

            if (!isCac) {
                if (Math.random() < 0.8) {
                    rolls[2] = 4 + Math.floor(Math.random() * 9);
                    rolls[3] = 4 + Math.floor(Math.random() * 9);
                    remaining -= (rolls[2] + rolls[3]);
                }
            } else {
                let rand = Math.random();
                if (rand < 0.5) {
                    rolls[2] = 4 + Math.floor(Math.random() * 9);
                    rolls[3] = 4 + Math.floor(Math.random() * 9);
                    remaining -= (rolls[2] + rolls[3]);
                } else {
                    rolls[2] = 0;
                    rolls[3] = 0;
                    rolls[6] = 6 + Math.floor(Math.random() * 7);
                    remaining -= rolls[6];
                }
            }

            while (remaining > 0) {
                let idx = Math.floor(Math.random() * numStats);
                let max = (idx === 1) ? 3 : 12;
                if (isCac && rolls[2] === 0 && (idx === 2 || idx === 3)) continue;
                if (rolls[idx] < max) {
                    rolls[idx]++;
                    remaining--;
                }
            }
            while (remaining < 0) {
                let idx = Math.floor(Math.random() * numStats);
                if (rolls[idx] > 0) { rolls[idx]--; remaining++; }
            }

            let p1Tier = parseInt(document.getElementById('p1-tier')?.value || '6');
            let tierSkills = SKILL_TIERS[p1Tier] || SKILL_TIERS[6];

            return { rolls: rolls, skills: [...tierSkills] };
        }



        function mutateRolls(build, intensity = 1) {
            let newRolls = [...build.rolls];
            let newSkills = [...build.skills];
            let numStats = 11;
            
            for (let i = 0; i < intensity; i++) {
                let fromCandidates = newRolls.map((v, idx) => (v > 0 && idx < numStats) ? idx : -1).filter(idx => idx !== -1);
                if (fromCandidates.length > 0) {
                    let from = fromCandidates[Math.floor(Math.random() * fromCandidates.length)];
                    newRolls[from]--;
                }

                let toCandidates = newRolls.map((v, idx) => {
                    if (idx >= numStats) return -1;
                    let max = (idx === 1) ? 3 : 12;
                    return v < max ? idx : -1;
                }).filter(idx => idx !== -1);

                if (toCandidates.length > 0) {
                    let weights = toCandidates.map(idx => 1 + newRolls[idx]);
                    let totalWeight = weights.reduce((a, b) => a + b, 0);
                    let random = Math.random() * totalWeight;
                    let sum = 0;
                    let to = toCandidates[0];
                    for (let j = 0; j < toCandidates.length; j++) {
                        sum += weights[j];
                        if (random <= sum) { to = toCandidates[j]; break; }
                    }
                    newRolls[to]++;
                }
            }

            if (newRolls[2] > 0 && newRolls[3] === 0) { newRolls[3] = 1; newRolls[2]--; }
            else if (newRolls[3] > 0 && newRolls[2] === 0) { newRolls[2] = 1; newRolls[3]--; }

            return { rolls: newRolls, skills: newSkills };
        }

        
        function runBenchSims(prefix, build, count) {
            const g = getGlobalSettings();
            const opponent = getCombatEntity('p2', g);
            opponent.skills = opponent.skills.map(s => ({...s, nextCastTime: s.cd, activeBuffEnd: 0}));

            const p1Base = getPlayerStats('p1');
            const powerMult = getNum('bench-roll-power') / 100;
            const rollVals = {
                ccc: 12 * powerMult, dcc: 100 * powerMult, block: 5 * powerMult,
                ls: 20 * powerMult, dc: 40 * powerMult, pvit: 40 * powerMult, php: 15 * powerMult,
                pdegat: (modes.p1.range === 'cac' ? 50 : 15) * powerMult,
                sdmg: 30 * powerMult, scdr: 5 * powerMult, regen: 6 * powerMult
            };

            const subjectStats = { ...p1Base };
            benchStatsOrder.forEach((key, i) => {
                subjectStats[key] = (build.rolls[i] * rollVals[key]) / 100;
            });

            const rawBase = getNum('p1-base');
            const rawHpBase = getNum('p1-hp');
            subjectStats.baseDmg = rawBase * (1 + subjectStats.pdegat);
            subjectStats.hpTotal = rawHpBase * (1 + subjectStats.php);
            subjectStats.regenPerSec = subjectStats.hpTotal * subjectStats.regen;
            
            // Build skills
            subjectStats.skills = build.skills.map(skillId => {
                let base = SKILLS_DB[skillId];
                if(!base) return null;
                let isDot = base.dur > 0 && base.dmg > 0;
                return {
                    id: skillId, name: base.name, cd: base.cd * (1 - subjectStats.scdr), dur: base.dur,
                    dmg: base.dmg * subjectStats.ascMult * (1 + subjectStats.sdmg), hp: base.hp * subjectStats.ascMult,
                    nextCastTime: 3, activeBuffEnd: 0, isDot: isDot, dotEnd: 0, lastDotTick: 0
                };
            }).filter(s => s !== null);

            let wins = 0;
            const dt = 0.05;

            for (let i = 0; i < count; i++) {
                let p1 = { ...subjectStats };
                let p2 = { ...opponent };
                p1.skills = p1.skills.map(s => ({...s, nextCastTime: 3, activeBuffEnd: 0, dotEnd: 0, lastDotTick: 0}));
                p2.skills = p2.skills.map(s => ({...s, nextCastTime: 3, activeBuffEnd: 0, dotEnd: 0, lastDotTick: 0}));

                const maxHp1 = p1.hpTotal * g.hpMult;
                const maxHp2 = p2.hpTotal * g.hpMult;
                p1.hp = maxHp1; p1.maxHp = maxHp1;
                p2.hp = maxHp2; p2.maxHp = maxHp2;
                p1.pos = 0; p2.pos = g.arenaSize;
                p1.nextAttackTime = 0; p2.nextAttackTime = 0;
                p1.spellUsed = false; p2.spellUsed = false;
                p1.lastRegenTick = 0; p2.lastRegenTick = 0;

                const spd1 = 1 + p1.pvit;
                p1.tNorm = (p1.windup + p1.recovery) / spd1 + p1.fixedInt;
                p1.tExtraDouble = p1.doubleDelay / spd1;

                let t = 0;
                while (p1.hp > 0 && p2.hp > 0 && t < 180) {
                    t += dt;
                    let dist = Math.abs(p2.pos - p1.pos);
                    if (dist > p1.range) p1.pos += g.moveSpeed * dt;
                    if (dist > p2.range) p2.pos -= g.moveSpeed * dt;
                    dist = Math.abs(p2.pos - p1.pos);

                    if (t >= g.spellStart && !p1.spellUsed) {
                        p1.hp += g.spellHp; p1.maxHp += g.spellHp; p1.spellUsed = true;
                        p2.hp += g.spellHp; p2.maxHp += g.spellHp; p2.spellUsed = true;
                    }

                    // Regen
                    [p1, p2].forEach(entity => {
                        if (entity.regenPerSec > 0 && entity.hp > 0) {
                            let nextTick = entity.lastRegenTick + 1;
                            if (t >= nextTick) { entity.hp = Math.min(entity.maxHp, entity.hp + entity.regenPerSec); entity.lastRegenTick = nextTick; }
                        }
                    });

                    [p1, p2].forEach(attacker => {
                        let defender = (attacker === p1) ? p2 : p1;
                        attacker.skills.forEach(skill => {
                            if (skill.activeBuffEnd > 0 && t >= skill.activeBuffEnd) {
                                attacker.hp -= skill.hp; attacker.maxHp -= skill.hp; skill.activeBuffEnd = 0;
                            }
                        });
                        // DoT ticks
                        attacker.skills.forEach(skill => {
                            if (skill.isDot && skill.dotEnd > 0 && t < skill.dotEnd && defender.hp > 0) {
                                let nextDotTick = skill.lastDotTick + 1;
                                if (t >= nextDotTick) { defender.hp -= (skill.dmg / skill.dur); skill.lastDotTick = nextDotTick; }
                            }
                        });
                        // Cast
                        attacker.skills.forEach(skill => {
                            if (t >= skill.nextCastTime && attacker.hp > 0) {
                                skill.nextCastTime = t + skill.cd;
                                if (skill.isDot && skill.dmg > 0 && defender.hp > 0) {
                                    skill.dotEnd = t + skill.dur; skill.lastDotTick = t; defender.hp -= (skill.dmg / skill.dur);
                                } else if (!skill.isDot && skill.dmg > 0 && defender.hp > 0) {
                                    defender.hp -= skill.dmg;
                                }
                                if (skill.hp > 0) { attacker.maxHp += skill.hp; attacker.hp += skill.hp; skill.activeBuffEnd = t + skill.dur; }
                            }
                        });
                    });

                    if (t >= p1.nextAttackTime && dist <= p1.range) {
                        const hit = calcHitDamageBench(p1, p2, t, g);
                        p2.hp -= hit.damage;
                        p1.hp = Math.min(p1.maxHp, p1.hp + (hit.damage * p1.ls));
                        p1.nextAttackTime = t + (p1.tNorm + hit.doubleCount * p1.tExtraDouble);
                    }
                    if (p2.hp > 0 && t >= p2.nextAttackTime && dist <= p2.range) {
                        const hit = calcHitDamageBench(p2, p1, t, g);
                        p1.hp -= hit.damage;
                        p2.hp = Math.min(p2.maxHp, p2.hp + (hit.damage * p2.ls));
                        p2.nextAttackTime = t + (p2.tNorm + hit.doubleCount * p2.tExtraDouble);
                    }
                }
                if (p1.hp > 0 && p2.hp <= 0) wins++;
            }
            return (wins / count) * 100;
        }

        function OLD_runBenchSims(prefix, rolls, count) {
            const g = getGlobalSettings();
            const opponent = getCombatEntity('p2', g);

            // Build temporary player stats from rolls (multiplied by roll power)
            const p1Base = getPlayerStats('p1');
            const powerMult = getNum('bench-roll-power') / 100;
            const rollVals = {
                ccc: 12 * powerMult, dcc: 100 * powerMult, block: 5 * powerMult,
                ls: 20 * powerMult, dc: 40 * powerMult, pvit: 40 * powerMult, php: 15 * powerMult,
                pdegat: (modes.p1.range === 'cac' ? 50 : 15) * powerMult
            };

            // Reset and apply rolls
            const subjectStats = { ...p1Base };
            benchStatsOrder.forEach((key, i) => {
                subjectStats[key] = (rolls[i] * rollVals[key]) / 100;
            });

            // Recalculate derived base stats if necessary
            const rawBase = getNum('p1-base');
            const rawHpBase = getNum('p1-hp');
            subjectStats.baseDmg = rawBase * (1 + subjectStats.pdegat);
            subjectStats.hpTotal = rawHpBase * (1 + subjectStats.php);

            let wins = 0;
            const dt = 0.05;

            for (let i = 0; i < count; i++) {
                let p1 = { ...subjectStats };
                let p2 = { ...opponent };
                const maxHp1 = p1.hpTotal * g.hpMult;
                const maxHp2 = p2.hpTotal * g.hpMult;
                p1.hp = maxHp1; p1.maxHp = maxHp1;
                p2.hp = maxHp2; p2.maxHp = maxHp2;
                p1.pos = 0; p2.pos = g.arenaSize;
                p1.nextAttackTime = 0; p2.nextAttackTime = 0;
                p1.spellUsed = false; p2.spellUsed = false;

                const spd1 = 1 + p1.pvit;
                p1.tNorm = (p1.windup + p1.recovery) / spd1 + p1.fixedInt;
                p1.tExtraDouble = p1.doubleDelay / spd1;

                let t = 0;
                while (p1.hp > 0 && p2.hp > 0 && t < 180) {
                    t += dt;
                    let dist = Math.abs(p2.pos - p1.pos);
                    if (dist > p1.range) p1.pos += g.moveSpeed * dt;
                    if (dist > p2.range) p2.pos -= g.moveSpeed * dt;
                    dist = Math.abs(p2.pos - p1.pos);

                    // Spell logic
                    if (t >= g.spellStart && !p1.spellUsed) {
                        p1.hp += g.spellHp; p1.maxHp += g.spellHp; p1.spellUsed = true;
                        p2.hp += g.spellHp; p2.maxHp += g.spellHp; p2.spellUsed = true;
                    }

                    
                    [p1, p2].forEach(attacker => {
                        let defender = (attacker === p1) ? p2 : p1;
                        attacker.skills.forEach(skill => {
                            if (skill.activeBuffEnd > 0 && t >= skill.activeBuffEnd) {
                                attacker.hp -= skill.hp; attacker.maxHp -= skill.hp; skill.activeBuffEnd = 0;
                            }
                        });
                        attacker.skills.forEach(skill => {
                            if (t >= skill.nextCastTime && attacker.hp > 0) {
                                skill.nextCastTime = t + skill.cd;
                                if (skill.dmg > 0 && defender.hp > 0) defender.hp -= skill.dmg;
                                if (skill.hp > 0) { attacker.maxHp += skill.hp; attacker.hp += skill.hp; skill.activeBuffEnd = t + skill.dur; }
                            }
                        });
                    });

                    if (t >= p1.nextAttackTime && dist <= p1.range) {
                        const hit = calcHitDamageBench(p1, p2, t, g);
                        p2.hp -= hit.damage;
                        p1.hp = Math.min(p1.maxHp, p1.hp + (hit.damage * p1.ls));
                        p1.nextAttackTime = t + (p1.tNorm + hit.doubleCount * p1.tExtraDouble);
                    }
                    if (p2.hp > 0 && t >= p2.nextAttackTime && dist <= p2.range) {
                        const hit = calcHitDamageBench(p2, p1, t, g);
                        p1.hp -= hit.damage;
                        p2.hp = Math.min(p2.maxHp, p2.hp + (hit.damage * p2.ls));
                        p2.nextAttackTime = t + (p2.tNorm + hit.doubleCount * p2.tExtraDouble);
                    }
                }
                if (p1.hp > 0 && p2.hp <= 0) wins++;
            }
            return (wins / count) * 100;
        }

        function calcHitDamageBench(attacker, target, t, g) {
            if (Math.random() < target.block) return { damage: 0, doubleCount: 0 };
            const isSpell = t >= g.spellStart && t <= (g.spellStart + g.spellDur);
            const d_base = attacker.baseDmg + (isSpell ? g.spellAtk : 0);
            const d_cc = d_base * (1.2 + attacker.dcc);
            let dc_chance = Math.min(1.0, attacker.dc);
            let doubleCount = (Math.random() < dc_chance) ? 1 : 0;
            let dmg = (Math.random() < attacker.ccc ? d_cc : d_base) * (1 + doubleCount);
            return { damage: dmg, doubleCount: doubleCount };
        }

        
        function updateBenchStatsUI(containerId, build, winRate, winTextId) {
            const container = document.getElementById(containerId);
            container.innerHTML = '';
            
            // Stats UI
            benchStatsOrder.forEach((key, i) => {
                const div = document.createElement('div');
                div.className = 'flex flex-col items-center p-1 bg-slate-800/50 rounded-lg border border-slate-700/50';
                div.innerHTML = `<span class="text-[8px] text-slate-500 font-bold uppercase">${benchNames[key]}</span>
                                 <span class="text-xs font-mono font-black ${build.rolls[i] > 0 ? 'text-indigo-400' : 'text-slate-700'}">${build.rolls[i]}</span>`;
                container.appendChild(div);
            });
            
            // Skills UI
            const skillsDiv = document.createElement('div');
            skillsDiv.className = 'col-span-4 flex justify-around mt-1 pt-1 border-t border-slate-700/50 text-[9px] font-black text-purple-400 uppercase tracking-widest';
            skillsDiv.innerHTML = build.skills.map(s => SKILLS_DB[s]?.name.substring(0,6) || 'Auc').join(' | ');
            container.appendChild(skillsDiv);

            document.getElementById(winTextId).innerText = winRate.toFixed(1) + '%';
            document.getElementById(winTextId + '-bar').style.width = winRate + '%';
        }

        function updateTopBuilds(build, winRate) {
            topBuilds.push({ rolls: [...build.rolls], skills: [...build.skills], winRate: winRate });
            topBuilds.sort((a, b) => b.winRate - a.winRate);
            let unique = [];
            let seen = new Set();
            for (let b of topBuilds) {
                let key = b.rolls.join(',') + '|' + b.skills.join(',');
                if (!seen.has(key)) { unique.push(b); seen.add(key); }
                if (unique.length >= 5) break;
            }
            topBuilds = unique;

            if (topBuilds.length > 0) {
                const best = topBuilds[0];
                benchBest = best;
                updateBenchStatsUI('bench-best-stats', best, best.winRate, 'bench-best-win');
                document.getElementById('apply-bench-btn').classList.remove('hidden');

                const hofEl = document.getElementById('bench-hof');
                hofEl.innerHTML = topBuilds.map((b, i) => `
                    <div class="p-2 rounded-xl bg-slate-900/50 border border-slate-800 text-[10px]">
                        <div class="flex justify-between font-black mb-1">
                            <span class="text-slate-500">#${i + 1}</span>
                            <span class="text-indigo-400">${b.winRate.toFixed(1)}%</span>
                        </div>
                        <div class="text-[8px] text-slate-600 truncate mb-1">${b.rolls.join('·')}</div>
                        <div class="text-[8px] text-purple-400 truncate">${b.skills.map(s => SKILLS_DB[s]?.name.substring(0,4)).join('·')}</div>
                    </div>
                `).join('');
            }
        }
        
        function applyBestBuild() {
            if (!benchBest) return;
            const powerMult = getNum('bench-roll-power') / 100;
            const rollVals = {
                ccc: 12 * powerMult, dcc: 100 * powerMult, block: 5 * powerMult,
                ls: 20 * powerMult, dc: 40 * powerMult, pvit: 40 * powerMult, php: 15 * powerMult,
                pdegat: (modes.p1.range === 'cac' ? 50 : 15) * powerMult,
                sdmg: 30 * powerMult, scdr: 5 * powerMult, regen: 6 * powerMult
            };
            benchStatsOrder.forEach((key, i) => {
                const input = document.getElementById('p1-' + key);
                if (input) input.value = (benchBest.rolls[i] * rollVals[key]).toFixed(2);
            });
            for(let i=0; i<3; i++) {
                let sel = document.getElementById(`p1-skill${i+1}-id`);
                if(sel) sel.value = benchBest.skills[i];
            }
            saveAndCalc();
            alert("Meilleur build (stats + compétences) appliqué !");
        }