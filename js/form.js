const FORM = {
    currentStep: 1,
    data: { application: { year: CONFIG.CURRENT_YEAR, status: 'draft', application_type: 'globale', selected_axe: null, total_requested: 0, current_step: 1 }, association: {}, financials: [], metrics: {} },
    config: { axes: [], metrics: [] },

    async init() {
        UI.toggleLoader(true);
        this.resetData();
        try {
            this.config.axes = await DB.getFormAxes() || [];
            if (STATE.association && STATE.association.id) {
                const apps = await DB.getApplicationsByAssoc(STATE.association.id);
                const draft = apps.find(a => (a.status === 'draft' || a.status === 'submitted') && a.year === CONFIG.CURRENT_YEAR);
                if (draft) {
                    // Check if validated/refused - block editing
                    if (draft.status === 'validated' || draft.status === 'refused' || draft.status === 'frozen') {
                        UI.notify("Ce dossier est figé et ne peut plus être modifié.", "info");
                        UI.switchView('dashboard');
                        return;
                    }
                    const full = await DB.getFullApplication(draft.id);
                    if (full && full.id) {
                        this.data.application = { ...full };
                        if (Array.isArray(full.financials)) {
                            full.financials.forEach(dbRow => {
                                const localRow = this.data.financials.find(f => f.account_code === dbRow.account_code);
                                if (localRow) { localRow.bp_year = parseFloat(dbRow.bp_year)||0; localRow.cr_n1 = parseFloat(dbRow.cr_n1)||0; localRow.cr_n2 = parseFloat(dbRow.cr_n2)||0; localRow.cr_n3 = parseFloat(dbRow.cr_n3)||0; }
                            });
                        }
                        this.data.metrics = {};
                        if (Array.isArray(full.metrics)) { full.metrics.forEach(m => { this.data.metrics[m.metric_key] = m.value; }); }
                        delete this.data.application.financials;
                        delete this.data.application.metrics;
                        delete this.data.application.associations;
                        console.log("Form: Loaded draft", full.id, "step", this.data.application.current_step);
                    }
                }
                // N-2/N-3 prefill from previous year
                if (this.data.application.selected_axe && !this.data.application.id) {
                    await this.prefillFromPreviousYear();
                }
            }
        } catch (err) { console.error("Form init error", err); }
        finally { UI.toggleLoader(false); }
    },

    async prefillFromPreviousYear() {
        if (!STATE.association || !this.data.application.selected_axe) return;
        try {
            const prev = await DB.getPreviousYearApplication(STATE.association.id, CONFIG.CURRENT_YEAR, this.data.application.selected_axe);
            if (prev && prev.financials) {
                prev.financials.forEach(pRow => {
                    const local = this.data.financials.find(f => f.account_code === pRow.account_code);
                    if (local) {
                        // Previous N-1 becomes our N-2, previous N-2 becomes our N-3
                        if (!local.cr_n2) local.cr_n2 = parseFloat(pRow.cr_n1) || 0;
                        if (!local.cr_n3) local.cr_n3 = parseFloat(pRow.cr_n2) || 0;
                    }
                });
                UI.notify("Les colonnes N-2 et N-3 ont été pré-remplies depuis votre demande précédente.", "info");
            }
        } catch(e) { console.warn("Prefill failed:", e); }
    },

    async deleteApplication(appId) {
        if (!confirm("Voulez-vous vraiment supprimer définitivement ce brouillon ?")) return;
        UI.toggleLoader(true);
        try { await DB.deleteApplication(appId); UI.notify("Demande supprimée.", "success"); UI.switchView('dashboard'); }
        catch (err) { UI.notify("Erreur lors de la suppression.", "error"); }
        finally { UI.toggleLoader(false); }
    },

    resetData() {
        this.data = { application: { year: CONFIG.CURRENT_YEAR, status: 'draft', application_type: 'globale', selected_axe: null, total_requested: 0, current_step: 1 }, association: {}, financials: [], metrics: {} };
        this.currentStep = 1;
        this.initDefaultFinancials();
    },

    initDefaultFinancials() {
        this.data.financials = EXCEL_MAPPING.financial_accounts.map(acc => ({
            account_code: acc.code, label: acc.label, type: acc.type, group: acc.group,
            bp_year: 0, cr_n1: 0, cr_n2: 0, cr_n3: 0,
            isSubtotal: acc.isSubtotal || false, subtotalLabel: acc.subtotalLabel || ''
        }));
    },

    async renderStep(step) {
        try {
            this.currentStep = step;
            const container = document.getElementById('step-content');
            document.querySelectorAll('.step-badge').forEach((b, idx) => {
                b.classList.toggle('active', idx + 1 === step);
                b.classList.toggle('completed', idx + 1 < step);
            });
            let html = '';
            switch(step) {
                case 1: html = this.tplNotice(); break;
                case 2: html = this.tplType(); break;
                case 3: html = this.tplIdentity(); break;
                case 4: html = this.tplAxes(); break;
                case 5: html = await this.tplDetails(); break;
                case 6: html = this.tplFinancials('expense'); break;
                case 7: html = this.tplFinancials('revenue'); break;
                case 8: html = this.tplDeclarations(); break;
            }
            if (!html) throw new Error("Contenu de l'étape vide.");
            container.innerHTML = html;
            this.bindEvents();
        } catch (err) { console.error("Render Step Error:", err); UI.notify("Erreur étape " + step + ": " + err.message, "error"); }
    },

    // Automation Tools
    copyN1ToBP() {
        const type = this.currentStep === 6 ? 'expense' : 'revenue';
        this.data.financials.filter(f => f.type === type && !f.isSubtotal).forEach(row => {
            row.bp_year = row.cr_n1 || 0;
        });
        UI.notify("Colonne N-1 copiée vers BP.", "info");
        this.renderStep(this.currentStep);
    },

    applyGlobalPercentage(field) {
        const pctEl = document.getElementById('pct-value');
        const pct = pctEl ? (parseFloat(pctEl.value) || 0) : 0;
        if (pct <= 0) return UI.notify("Veuillez saisir un pourcentage valide.", "error");

        const type = this.currentStep === 6 ? 'expense' : 'revenue';
        const history = STATE.association?.global_budget_history || {};
        const historyField = field === 'bp_year' ? 'bp' : (field === 'cr_n1' ? 'n1' : (field === 'cr_n2' ? 'n2' : 'n3'));
        
        const allRows = this.data.financials.filter(f => f.type === type);
        const groups = [...new Set(allRows.map(r => r.group))];
        
        let count = 0;
        groups.forEach(g => {
            const profileData = history[g] || {};
            const globalVal = parseFloat(profileData[historyField]) || 0;
            if (globalVal > 0) {
                const axeVal = Math.round(globalVal * (pct / 100) * 100) / 100;
                // Find first detail row of this group
                const row = allRows.find(r => r.group === g && !r.isSubtotal);
                if (row) {
                    row[field] = axeVal;
                    count++;
                }
            }
        });

        if (count > 0) {
            UI.notify(`Affectation de ${pct}% du global effectuée sur ${count} groupes.`, "success");
            this.renderStep(this.currentStep);
        } else {
            UI.notify("Aucune donnée globale correspondante trouvée dans votre profil.", "warning");
        }
    },

    tplNotice() {
        return `<div class="form-step"><h3>Notice d'utilisation</h3>
            <div class="info-box"><p>Bienvenue dans le portail de demande de subvention CCMVR.</p>
            <p>Les <span class="auto-cell-demo">cases grisées</span> comportent des calculs automatiques. Les cases blanches sont des champs de saisie.</p>
            <p>Votre progression est sauvegardée automatiquement à chaque étape.</p></div>
            <div class="form-actions"><button class="btn btn-primary" onclick="FORM.renderStep(2)">Démarrer</button></div></div>`;
    },

    tplType() {
        const types = [
            { id: 'globale', label: 'Demande de fonctionnement globale', icon: 'fa-building' },
            { id: 'projet', label: 'Demande de fonctionnement sur projet', icon: 'fa-project-diagram' },
            { id: 'exceptionnelle', label: 'Demande exceptionnelle', icon: 'fa-exclamation-triangle' },
            { id: 'investissement', label: "Demande d'investissement", icon: 'fa-tools' }
        ];
        return `<div class="form-step"><h3>Type de demande</h3><p class="help-text">Sélectionnez la nature de votre demande.</p>
            <div class="type-selection grid-2">${types.map(t => `
                <label class="type-option card luxe ${this.data.application.application_type === t.id ? 'active' : ''}">
                    <input type="radio" name="app-type" value="${t.id}" ${this.data.application.application_type === t.id ? 'checked' : ''} onchange="FORM.data.application.application_type=this.value;FORM.renderStep(2)">
                    <div class="type-info"><i class="fas ${t.icon}" style="font-size:1.5rem;color:var(--primary-color);margin-bottom:8px"></i><strong>${t.label}</strong></div>
                </label>`).join('')}</div>
            <div class="form-actions"><button class="btn" onclick="FORM.renderStep(1)">Précédent</button><button class="btn btn-primary" onclick="FORM.saveAndNext(3)">Suivant</button></div></div>`;
    },

    tplIdentity() {
        const assoc = STATE.association || {};
        return `<div class="form-step"><h3>Fiche Identité</h3>
            <div class="grid-2">
                <div class="input-group"><label>Nom de l'association</label><input type="text" id="f-name" value="${assoc.name||''}" readonly style="background:#f1f5f9"></div>
                <div class="input-group"><label>SIRET</label><input type="text" id="f-siret" value="${assoc.siret||''}" readonly style="background:#f1f5f9"></div>
                <div class="input-group"><label>Mail de contact</label><input type="email" id="f-email" value="${assoc.contact_email||''}" readonly style="background:#f1f5f9"></div>
                <div class="input-group highlight"><label>Nom et prénom du déclarant</label><input type="text" id="f-declarant" value="${this.data.application.declarant_name||assoc.declarant_name||''}" placeholder="Ex: Jean DUPONT"></div>
            </div>
            <div class="form-actions"><button class="btn" onclick="FORM.renderStep(2)">Précédent</button><button class="btn btn-primary" onclick="FORM.saveAndNext(4)">Suivant</button></div></div>`;
    },

    tplAxes() {
        const axes = this.config.axes.length > 0 ? this.config.axes : EXCEL_MAPPING.axes;
        return `<div class="form-step"><h3>Axe de la demande</h3><p class="help-text">Cochez une seule case. Pour un deuxième axe, créez une autre demande.</p>
            <div class="axes-selection">${axes.map(axe => `
                <label class="axe-option"><input type="radio" name="axe" value="${axe.code}" ${this.data.application.selected_axe===axe.code?'checked':''} onchange="FORM.data.application.selected_axe=this.value">
                <div class="axe-info"><strong>${axe.principal}</strong><span>${axe.secondary||''}</span></div></label>`).join('')}</div>
            <div class="form-actions"><button class="btn" onclick="FORM.renderStep(3)">Précédent</button><button class="btn btn-primary" onclick="FORM.saveAndNext(5)">Suivant</button></div></div>`;
    },

    async tplDetails() {
        const axeCode = this.data.application.selected_axe;
        if (!axeCode) return '<div class="error-state card">Veuillez sélectionner un axe à l\'étape précédente.</div>';
        UI.toggleLoader(true);
        const metrics = await DB.getAxeMetrics(axeCode);
        UI.toggleLoader(false);
        return `<div class="form-step"><h3>Détails de l'activité — Axe ${axeCode}</h3>
            <div class="grid-2">${metrics.map(m => `<div class="input-group"><label>${m.label}</label><input type="${m.input_type}" class="metric-input" data-key="${m.metric_key}" value="${this.data.metrics[m.metric_key]||''}"></div>`).join('')||'<p>Aucune question spécifique pour cet axe.</p>'}</div>
            <div class="form-actions"><button class="btn" onclick="FORM.renderStep(4)">Précédent</button><button class="btn btn-primary" onclick="FORM.saveAndNext(6)">Suivant</button></div></div>`;
    },

    tplFinancials(type) {
        const title = type === 'expense' ? 'Dépenses (Charges)' : 'Recettes (Produits)';
        const stepNum = type === 'expense' ? 6 : 7;
        const allRows = this.data.financials.filter(f => f.type === type);
        const groups = [...new Set(allRows.map(r => r.group))];
        const Y = CONFIG.CURRENT_YEAR;

        return `<div class="form-step wide"><h3>Étape ${stepNum} — ${title}</h3>
            <p class="help-text">Détaillez les montants spécifiques au projet/axe sélectionné. Les <span class="auto-cell-demo">cases grisées</span> sont calculées automatiquement.</p>
            
            <div class="table-tools" style="background:#f8fafc; padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px">
                <div style="display:flex; align-items:center; gap:10px">
                    <span style="font-weight:600; font-size:0.85rem">Outils de saisie :</span>
                    <button class="btn btn-secondary btn-sm" onclick="FORM.copyN1ToBP()"><i class="fas fa-copy"></i> Copier N-1 → BP</button>
                </div>
                <div style="display:flex; align-items:center; gap:10px">
                    <span style="font-weight:600; font-size:0.85rem">Affecter % du global (Profil) :</span>
                    <div style="display:flex; align-items:center; background:white; border:1px solid #cbd5e1; border-radius:6px; padding:2px 8px">
                        <input type="number" id="pct-value" value="100" style="width:50px; border:none; padding:4px; font-weight:bold; text-align:right" min="0" max="100">
                        <span style="font-weight:700; margin-left:2px">%</span>
                    </div>
                    <div class="btn-group" style="display:flex; gap:2px">
                        <button class="btn btn-secondary btn-sm" onclick="FORM.applyGlobalPercentage('cr_n1')" title="Appliquer à N-1">N-1</button>
                        <button class="btn btn-secondary btn-sm" onclick="FORM.applyGlobalPercentage('cr_n2')" title="Appliquer à N-2">N-2</button>
                        <button class="btn btn-secondary btn-sm" onclick="FORM.applyGlobalPercentage('cr_n3')" title="Appliquer à N-3">N-3</button>
                    </div>
                </div>
            </div>

            <div class="table-responsive"><table class="financial-table">
                <thead><tr><th style="min-width:250px">Libellé</th><th>BP ${Y}</th><th>CR ${Y-1} (N-1)</th><th>CR ${Y-2} (N-2)</th><th>CR ${Y-3} (N-3)</th><th>Evol. %</th></tr></thead>
                <tbody>${groups.map(groupCode => {
                    const groupRows = allRows.filter(r => r.group === groupCode);
                    const subtotalRow = groupRows.find(r => r.isSubtotal);
                    const detailRows = groupRows.filter(r => !r.isSubtotal);
                    const subtotalLabel = subtotalRow ? (subtotalRow.subtotalLabel || subtotalRow.label) : groupCode;

                    let html = '';
                    // Group header
                    if (subtotalRow) {
                        html += `<tr class="group-header-row ${type}-row"><td colspan="6" style="font-weight:700;font-size:0.85rem;padding:10px 12px;background:#e8ecf1">${subtotalRow.label}</td></tr>`;
                    }
                    // Detail rows
                    detailRows.forEach(row => {
                        const evol = UTILS.calculateEvolution(row.bp_year, row.cr_n1);
                        html += `<tr class="${type}-row">
                            <td style="font-size:0.85rem">${row.label}</td>
                            <td><input type="number" class="calc-input" data-code="${row.account_code}" data-group="${groupCode}" data-field="bp_year" value="${row.bp_year||0}"></td>
                            <td><input type="number" class="calc-input" data-code="${row.account_code}" data-group="${groupCode}" data-field="cr_n1" value="${row.cr_n1||0}"></td>
                            <td><input type="number" class="calc-input" data-code="${row.account_code}" data-group="${groupCode}" data-field="cr_n2" value="${row.cr_n2||0}"></td>
                            <td><input type="number" class="calc-input" data-code="${row.account_code}" data-group="${groupCode}" data-field="cr_n3" value="${row.cr_n3||0}"></td>
                            <td class="readonly-cell row-evol" data-code="${row.account_code}">${evol}%</td></tr>`;
                    });
                    // Subtotal row (auto-calculated, greyed out)
                    html += `<tr class="subtotal-row ${type}-row">
                        <td style="font-weight:600;font-size:0.85rem">${subtotalLabel}</td>
                        <td><input type="number" class="calc-input auto-cell" data-code="${subtotalRow?subtotalRow.account_code:''}" data-group="${groupCode}" data-field="bp_year" value="${subtotalRow?subtotalRow.bp_year||0:0}" readonly></td>
                        <td><input type="number" class="calc-input auto-cell" data-code="${subtotalRow?subtotalRow.account_code:''}" data-group="${groupCode}" data-field="cr_n1" value="${subtotalRow?subtotalRow.cr_n1||0:0}" readonly></td>
                        <td><input type="number" class="calc-input auto-cell" data-code="${subtotalRow?subtotalRow.account_code:''}" data-group="${groupCode}" data-field="cr_n2" value="${subtotalRow?subtotalRow.cr_n2||0:0}" readonly></td>
                        <td><input type="number" class="calc-input auto-cell" data-code="${subtotalRow?subtotalRow.account_code:''}" data-group="${groupCode}" data-field="cr_n3" value="${subtotalRow?subtotalRow.cr_n3||0:0}" readonly></td>
                        <td class="readonly-cell st-evol" data-group="${groupCode}">0%</td></tr>`;
                    return html;
                }).join('')}</tbody>
                <tfoot>
                    <tr class="total-row"><td>TOTAL GÉNÉRAL</td>
                        <td id="total-bp">0 €</td><td id="total-n1">0 €</td><td id="total-n2">0 €</td><td id="total-n3">0 €</td><td id="total-evol">0%</td>
                    </tr>
                    ${type === 'revenue' ? `
                    <tr class="diff-row result-row" style="background:#fff1f2 !important; border-top:2px solid var(--primary-color)">
                        <td style="font-weight:700">RÉSULTAT : Bénéfice (+) / Déficit (-)</td>
                        <td id="res-bp" style="font-weight:700">0 €</td>
                        <td id="res-n1" style="font-weight:700">0 €</td>
                        <td id="res-n2" style="font-weight:700">0 €</td>
                        <td id="res-n3" style="font-weight:700">0 €</td>
                        <td></td>
                    </tr>` : ''}
                </tfoot>
            </table></div>
            <div class="form-actions">
                <button class="btn" onclick="FORM.renderStep(${type==='expense'?5:6})">Précédent</button>
                <button class="btn btn-primary" onclick="FORM.saveAndNext(${type==='expense'?7:8})">Suivant</button>
            </div></div>`;
    },

    getFinVal(code, field) {
        const row = this.data.financials.find(f => f.account_code === code);
        return row ? (parseFloat(row[field]) || 0) : 0;
    },

    tplDeclarations() {
        const subvention = this.getFinVal('74', 'bp_year') || 0;
        // Check bilan prerequisite
        const bilanOk = STATE.association && STATE.association.bilan_data && Object.keys(STATE.association.bilan_data).length > 0;
        const bilanWarning = !bilanOk ? '<div class="info-box" style="background:#fef2f2;border-color:#ef4444"><i class="fas fa-exclamation-triangle" style="color:#ef4444"></i> <strong>Attention :</strong> Vous devez renseigner votre bilan dans "Mon Profil" avant de pouvoir soumettre votre demande.</div>' : '';

        return `<div class="form-step"><h3>Déclarations et Signature</h3>
            ${bilanWarning}
            <div class="info-box highlight-box">
                <p><strong>Récapitulatif de votre demande :</strong></p>
                <p style="font-size:1.2rem;margin:10px 0">Montant sollicité : <span style="color:var(--primary-color);font-weight:bold">${subvention.toLocaleString('fr-FR')} €</span></p>
            </div>
            <div class="declarations-list">
                <label class="check-item luxe"><input type="checkbox" id="check-confirm-amount" required><span>Je confirme que le montant demandé est de ${subvention.toLocaleString('fr-FR')} €.</span></label>
                <label class="check-item luxe"><input type="checkbox" id="decl-1" required><div class="check-text"><strong>Obligations administratives</strong>L'association est à jour de ses obligations administratives, comptables, sociales et fiscales.</div></label>
                <label class="check-item luxe"><input type="checkbox" id="decl-2" required><div class="check-text"><strong>Contrat d'engagement républicain</strong>L'association souscrit au contrat d'engagement républicain.</div></label>
                <label class="check-item luxe"><input type="checkbox" id="decl-3" required><div class="check-text"><strong>Charte des engagements réciproques</strong>L'association respecte les principes de la Charte du 14 février 2014.</div></label>
            </div>
            <div class="form-actions">
                <button class="btn" onclick="FORM.renderStep(7)">Précédent</button>
                <button class="btn btn-primary" id="final-submit" onclick="FORM.submitApplication()" ${!bilanOk?'disabled style="opacity:0.5;cursor:not-allowed"':''}>Soumettre la demande</button>
            </div></div>`;
    },

    bindEvents() {
        document.querySelectorAll('.calc-input:not(.auto-cell)').forEach(input => {
            input.addEventListener('input', (e) => {
                const code = e.target.dataset.code, field = e.target.dataset.field;
                const val = parseFloat(e.target.value) || 0;
                const rec = this.data.financials.find(f => f.account_code === code);
                if (rec) { rec[field] = val; if (code === '74' && field === 'bp_year') this.data.application.total_requested = val; }
                this.updateStepTotals();
            });
        });
        document.querySelectorAll('.metric-input').forEach(input => {
            input.addEventListener('change', (e) => { this.data.metrics[e.target.dataset.key] = e.target.value; });
        });
        if (this.currentStep === 6 || this.currentStep === 7) this.updateStepTotals();
    },

    updateStepTotals() {
        const type = this.currentStep === 6 ? 'expense' : 'revenue';
        const allRows = this.data.financials.filter(f => f.type === type);
        const groups = [...new Set(allRows.map(r => r.group))];

        groups.forEach(g => {
            const gRows = allRows.filter(r => r.group === g);
            const subtotalRow = gRows.find(r => r.isSubtotal);
            const detailRows = gRows.filter(r => !r.isSubtotal);

            // Sum ONLY detail rows (not subtotal) → fixes double counting
            ['bp_year','cr_n1','cr_n2','cr_n3'].forEach(f => {
                const sum = detailRows.reduce((s, r) => s + (parseFloat(r[f])||0), 0);
                if (subtotalRow) {
                    subtotalRow[f] = sum;
                    const input = document.querySelector(`.calc-input[data-code="${subtotalRow.account_code}"][data-field="${f}"]`);
                    if (input) input.value = sum;
                }
            });

            // Subtotal evolution
            if (subtotalRow) {
                const evol = UTILS.calculateEvolution(subtotalRow.bp_year, subtotalRow.cr_n1);
                document.querySelectorAll(`.st-evol[data-group="${g}"]`).forEach(el => el.textContent = evol + '%');
            }
        });

        // Update per-row evolution dynamically
        allRows.filter(r => !r.isSubtotal).forEach(row => {
            const evol = UTILS.calculateEvolution(row.bp_year, row.cr_n1);
            document.querySelectorAll(`.row-evol[data-code="${row.account_code}"]`).forEach(el => el.textContent = evol + '%');
        });

        // General total = sum of subtotal rows only (no double counting)
        const calcTotal = (field) => groups.reduce((sum, g) => {
            const sub = allRows.find(r => r.group === g && r.isSubtotal);
            if (sub) return sum + (parseFloat(sub[field])||0);
            return sum + allRows.filter(r => r.group === g).reduce((s, r) => s + (parseFloat(r[field])||0), 0);
        }, 0);

        const bpT = calcTotal('bp_year'), n1T = calcTotal('cr_n1'), n2T = calcTotal('cr_n2'), n3T = calcTotal('cr_n3');
        const fmt = v => v.toLocaleString('fr-FR') + ' €';
        if (document.getElementById('total-bp')) document.getElementById('total-bp').textContent = fmt(bpT);
        if (document.getElementById('total-n1')) document.getElementById('total-n1').textContent = fmt(n1T);
        if (document.getElementById('total-n2')) document.getElementById('total-n2').textContent = fmt(n2T);
        if (document.getElementById('total-n3')) document.getElementById('total-n3').textContent = fmt(n3T);
        if (document.getElementById('total-evol')) document.getElementById('total-evol').textContent = UTILS.calculateEvolution(bpT, n1T) + '%';

        // Calculation of Net Result (Step 7 only)
        if (type === 'revenue') {
            const calcExp = (field) => {
                const expRows = this.data.financials.filter(r => r.type === 'expense');
                const expGroups = [...new Set(expRows.map(r => r.group))];
                return expGroups.reduce((sum, g) => {
                    const sub = expRows.find(r => r.group === g && r.isSubtotal);
                    return sum + (sub ? (parseFloat(sub[field])||0) : 0);
                }, 0);
            };
            const expBP = calcExp('bp_year'), expN1 = calcExp('cr_n1'), expN2 = calcExp('cr_n2'), expN3 = calcExp('cr_n3');
            
            const resBP = bpT - expBP, resN1 = n1T - expN1, resN2 = n2T - expN2, resN3 = n3T - expN3;
            
            if (document.getElementById('res-bp')) document.getElementById('res-bp').textContent = fmt(resBP);
            if (document.getElementById('res-n1')) document.getElementById('res-n1').textContent = fmt(resN1);
            if (document.getElementById('res-n2')) document.getElementById('res-n2').textContent = fmt(resN2);
            if (document.getElementById('res-n3')) document.getElementById('res-n3').textContent = fmt(resN3);
            
            // Color coding for positive/negative result
            ['bp', 'n1', 'n2', 'n3'].forEach(k => {
                const val = k === 'bp' ? resBP : (k === 'n1' ? resN1 : (k === 'n2' ? resN2 : resN3));
                const el = document.getElementById(`res-${k}`);
                if (el) el.style.color = val < 0 ? '#ef4444' : '#10b981';
            });
        }
    },

    async saveAndNext(nextStep) {
        if (!STATE.association) return this.renderStep(nextStep);
        if (this.currentStep === 4 && !this.data.application.selected_axe) return UI.notify("Veuillez sélectionner un axe.", "error");

        UI.toggleLoader(true);
        try {
            if (this.currentStep === 3) this.data.application.declarant_name = document.getElementById('f-declarant').value;

            const appToSave = { ...this.data.application };
            delete appToSave.financials; delete appToSave.metrics; delete appToSave.associations;
            appToSave.association_id = STATE.association.id;
            appToSave.current_step = nextStep;

            let res;
            if (appToSave.id) {
                res = await sb.from('grant_applications').update(appToSave).eq('id', appToSave.id).select().single();
            } else {
                res = await sb.from('grant_applications').insert([appToSave]).select().single();
                if (res.data) this.data.application.id = res.data.id;
            }
            if (res.error) throw res.error;

            // Save financials on steps 6 & 7
            if (this.currentStep === 6 || this.currentStep === 7) {
                if (this.currentStep === 7) {
                    const subvRow = this.data.financials.find(f => f.account_code === '74');
                    if (subvRow) {
                        this.data.application.total_requested = parseFloat(subvRow.bp_year) || 0;
                        await sb.from('grant_applications').update({ total_requested: this.data.application.total_requested }).eq('id', this.data.application.id);
                    }
                }
                const finData = this.data.financials.filter(f => f.type !== 'bilan').map(f => ({
                    application_id: this.data.application.id, account_code: f.account_code,
                    bp_year: parseFloat(f.bp_year)||0, cr_n1: parseFloat(f.cr_n1)||0, cr_n2: parseFloat(f.cr_n2)||0, cr_n3: parseFloat(f.cr_n3)||0
                }));
                const { error: finErr } = await sb.from('financial_records').upsert(finData, { onConflict: 'application_id, account_code' });
                if (finErr) throw finErr;
            }

            // After selecting axe, try prefill
            if (this.currentStep === 4 && this.data.application.selected_axe) await this.prefillFromPreviousYear();

            UI.notify("Progrès enregistré.", "success");
            this.renderStep(nextStep);
        } catch (err) {
            console.error("Save error", err);
            UI.notify("Erreur de sauvegarde : " + err.message, "error");
            this.renderStep(nextStep);
        } finally { UI.toggleLoader(false); }
    },

    async submitApplication() {
        const checks = document.querySelectorAll('.declarations-list input[type="checkbox"][required]');
        if (!Array.from(checks).every(c => c.checked)) return UI.notify("Veuillez cocher toutes les déclarations.", "error");

        // Bilan check
        if (!STATE.association || !STATE.association.bilan_data || Object.keys(STATE.association.bilan_data).length === 0) {
            return UI.notify("Veuillez renseigner votre bilan dans 'Mon Profil' avant de soumettre.", "error");
        }

        if (!confirm("Voulez-vous soumettre votre demande ? Vous pourrez encore la modifier tant que l'administration ne l'a pas validée.")) return;

        UI.toggleLoader(true);
        try {
            // Snapshot bilan & CR at submission time
            const snapshotData = {
                status: 'submitted',
                snapshot_bilan: STATE.association.bilan_data,
                snapshot_cr: STATE.association.global_budget_history || {},
                current_step: 8
            };
            const { error } = await sb.from('grant_applications').update(snapshotData).eq('id', this.data.application.id);
            if (error) throw error;
            UI.notify("Demande soumise avec succès ! Vous pouvez encore la modifier.", "success");
            UI.switchView('dashboard');
        } catch (err) { UI.notify(err.message, "error"); }
        finally { UI.toggleLoader(false); }
    }
};
