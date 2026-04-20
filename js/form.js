/**
 * Logic for the multi-step Grant Application Form
 */
const FORM = {
    currentStep: 1,
    data: {
        application: { year: 2026, status: 'draft', selected_axe: null },
        association: {},
        financials: [],
        metrics: {}
    },

    async init() {
        // Load existing draft if any
        if (STATE.association) {
            const apps = await DB.getApplicationsByAssoc(STATE.association.id);
            const draft = apps.find(a => a.status === 'draft' && a.year === 2026);
            if (draft) {
                const full = await DB.getFullApplication(draft.id);
                FORM.data = full;
            } else {
                // Initialize default financials from EXCEL_MAPPING
                FORM.initDefaultFinancials();
            }
        }
    },

    initDefaultFinancials() {
        // Prepare template lines for charges and revenues
        const accounts = EXCEL_MAPPING.financial_accounts;
        FORM.data.financials = accounts.map(acc => ({
            account_code: acc.code,
            label: acc.label,
            type: acc.code.startsWith('6') ? 'expense' : 'revenue',
            bp_year: 0, cr_n1: 0, cr_n2: 0, cr_n3: 0
        }));
    },

    renderStep(step) {
        FORM.currentStep = step;
        const container = document.getElementById('step-content');
        
        // Update header badges
        document.querySelectorAll('.step-badge').forEach((b, idx) => {
            b.classList.toggle('active', idx + 1 === step);
            b.classList.toggle('completed', idx + 1 < step);
        });

        switch(step) {
            case 1: container.innerHTML = FORM.tplNotice(); break;
            case 2: container.innerHTML = FORM.tplIdentity(); break;
            case 3: container.innerHTML = FORM.tplAxes(); break;
            case 4: container.innerHTML = FORM.tplFinancials('expense'); break;
            case 5: container.innerHTML = FORM.tplFinancials('revenue'); break;
            case 6: container.innerHTML = FORM.tplBilan(); break;
            case 7: container.innerHTML = FORM.tplDeclarations(); break;
        }

        FORM.bindEvents();
    },

    tplNotice() {
        return `
            <div class="form-step">
                <h3>Notice d'utilisation</h3>
                <div class="info-box">
                    <p>Bienvenue dans le portail de demande de subvention CCMVR.</p>
                    <p>Ce formulaire remplace le fichier Excel précédent. Les cases grises comportent des calculs automatiques.</p>
                    <p>Une fois validé, vous recevrez une confirmation par mail.</p>
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" onclick="FORM.renderStep(2)">Démarrer</button>
                </div>
            </div>
        `;
    },

    tplIdentity() {
        const assoc = STATE.association || {};
        return `
            <div class="form-step">
                <h3>Fiche Identité</h3>
                <div class="grid-2">
                    <div class="input-group">
                        <label>Nom de l'association</label>
                        <input type="text" id="f-name" value="${assoc.name || ''}" placeholder="Ex: ACIJA">
                    </div>
                    <div class="input-group">
                        <label>SIRET</label>
                        <input type="text" id="f-siret" value="${assoc.siret || ''}">
                    </div>
                    <div class="input-group">
                        <label>Mail de contact</label>
                        <input type="email" id="f-email" value="${assoc.contact_email || ''}">
                    </div>
                    <div class="input-group">
                        <label>Subvention demandée (€)</label>
                        <input type="number" id="f-requested" value="${FORM.data.application.total_requested || 0}">
                    </div>
                </div>
                <div class="form-actions">
                    <button class="btn" onclick="FORM.renderStep(1)">Précédent</button>
                    <button class="btn btn-primary" onclick="FORM.saveAndNext(3)">Suivant</button>
                </div>
            </div>
        `;
    },

    tplAxes() {
        return `
            <div class="form-step">
                <h3>Axe de la demande</h3>
                <p class="help-text">SVP Veuillez cocher une seule case représentant l'axe principal de votre projet.</p>
                <div class="axes-selection">
                    ${EXCEL_MAPPING.axes.map(axe => `
                        <label class="axe-option">
                            <input type="radio" name="axe" value="${axe.code}" ${FORM.data.application.selected_axe === axe.code ? 'checked' : ''}>
                            <div class="axe-info">
                                <strong>${axe.principal}</strong>
                                <span>${axe.secondary}</span>
                            </div>
                        </label>
                    `).join('')}
                </div>
                <div class="form-actions">
                    <button class="btn" onclick="FORM.renderStep(2)">Précédent</button>
                    <button class="btn btn-primary" onclick="FORM.saveAndNext(4)">Suivant</button>
                </div>
            </div>
        `;
    },

    tplFinancials(type) {
        const title = type === 'expense' ? 'Charges Prévisionnelles' : 'Recettes Prévisionnelles';
        const rows = FORM.data.financials.filter(f => f.type === type);
        
        return `
            <div class="form-step wide">
                <h3>${title}</h3>
                <div class="table-responsive">
                    <table class="financial-table">
                        <thead>
                            <tr>
                                <th>Compte</th>
                                <th>Libellé</th>
                                <th>BP 2026</th>
                                <th>CR 2025</th>
                                <th>CR 2024</th>
                                <th>Evolution %</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(row => `
                                <tr>
                                    <td>${row.account_code}</td>
                                    <td>${row.label}</td>
                                    <td><input type="number" class="calc-input" data-code="${row.account_code}" data-field="bp_year" value="${row.bp_year}"></td>
                                    <td><input type="number" class="calc-input" data-code="${row.account_code}" data-field="cr_n1" value="${row.cr_n1}"></td>
                                    <td><input type="number" class="calc-input" data-code="${row.account_code}" data-field="cr_n2" value="${row.cr_n2}"></td>
                                    <td class="readonly-cell">${FORM.calcEvolution(row.bp_year, row.cr_n1)}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="form-actions">
                    <button class="btn" onclick="FORM.renderStep(${type === 'expense' ? 3 : 4})">Précédent</button>
                    <button class="btn btn-primary" onclick="FORM.saveAndNext(${type === 'expense' ? 5 : 6})">Suivant</button>
                </div>
            </div>
        `;
    },

    calcEvolution(now, before) {
        if (!before || before === 0) return 0;
        return (((now - before) / before) * 100).toFixed(1);
    },

    bindEvents() {
        // Handle input changes for auto-calc
        document.querySelectorAll('.calc-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const code = e.target.dataset.code;
                const field = e.target.dataset.field;
                const val = parseFloat(e.target.value) || 0;
                
                const rec = FORM.data.financials.find(f => f.account_code === code);
                if (rec) rec[field] = val;
                
                // Refresh evolution cells in the row
                const row = e.target.closest('tr');
                const bp = parseFloat(row.querySelector('[data-field="bp_year"]').value) || 0;
                const n1 = parseFloat(row.querySelector('[data-field="cr_n1"]').value) || 0;
                row.querySelector('.readonly-cell').textContent = FORM.calcEvolution(bp, n1) + '%';
            });
        });
    },

    async saveAndNext(nextStep) {
        UI.toggleLoader(true);
        try {
            // In a real app, here we would call SB to update tables
            // For now, we simulate saving to local STATE and move on
            UI.notify("Données sauvegardées temporairement.", "success");
            FORM.renderStep(nextStep);
        } catch (err) {
            UI.notify(err.message, "error");
        } finally {
            UI.toggleLoader(false);
        }
    },

    tplBilan() { return `<h3>Bilan Comptable</h3><p>En cours...</p><button class="btn" onclick="FORM.renderStep(5)">Précédent</button><button class="btn btn-primary" onclick="FORM.renderStep(7)">Suivant</button>`; },
    tplDeclarations() { return `<h3>Déclarations finales</h3><p>Engagement républicain...</p><button class="btn" onclick="FORM.renderStep(6)">Précédent</button><button class="btn btn-primary" onclick="UI.switchView('dashboard')">Soumettre</button>`; }
};
