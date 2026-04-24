const UI = {
    init() {
        // Nav listeners
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                UI.switchView(view);
            });
        });

        // Apply logo from data file
        UI.applyLogo();

        // Show version info
        UI.fetchGitHubVersion();
    },

    applyLogo() {
        if (typeof LOGO_BASE64 !== 'undefined' && LOGO_BASE64 !== "") {
            let logoUrl = LOGO_BASE64;
            // Add prefix if missing
            if (!logoUrl.startsWith('data:')) {
                logoUrl = 'data:image/png;base64,' + logoUrl;
            }
            const containers = document.querySelectorAll('.logo-container');
            containers.forEach(container => {
                container.style.backgroundImage = `url('${logoUrl}')`;
                container.style.backgroundColor = 'transparent';
                container.style.boxShadow = 'none';
                container.textContent = ''; // Hide the "CCMVR" text
            });
        }
    },

    async fetchGitHubVersion() {
        const versionEl = document.getElementById('github-version');
        if (!versionEl) return;

        try {
            // Try to get from CONFIG or auto-detect if on github.io
            let repo = CONFIG.GITHUB_REPO;
            
            if (window.location.hostname.includes('github.io')) {
                const parts = window.location.hostname.split('.');
                const owner = parts[0];
                const repoName = window.location.pathname.split('/')[1] || repo.split('/')[1];
                repo = `${owner}/${repoName}`;
            }

            const response = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`);
            if (!response.ok) throw new Error('GitHub API error');
            
            const data = await response.json();
            if (data && data.length > 0) {
                const date = new Date(data[0].commit.committer.date);
                const options = { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                };
                const formattedDate = date.toLocaleString('fr-FR', options);
                versionEl.textContent = `v. ${formattedDate}`;
            }
        } catch (e) {
            console.warn("Could not fetch version info:", e);
            versionEl.textContent = "Mode Local / Inconnu";
        }
    },

    notify(message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.innerHTML = `
            <div class="notif-content">${message}</div>
            <button class="notif-close">&times;</button>
        `;
        
        container.appendChild(notif);
        
        // Auto remove
        setTimeout(() => {
            notif.classList.add('fade-out');
            setTimeout(() => notif.remove(), 500);
        }, 5000);

        notif.querySelector('.notif-close').addEventListener('click', () => notif.remove());
    },

    toggleLoader(show) {
        document.getElementById('global-loader').classList.toggle('hidden', !show);
    },

    showAuth() {
        document.getElementById('splash-screen')?.classList.add('hidden');
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-content').classList.add('hidden');
    },

    showApp() {
        document.getElementById('splash-screen')?.classList.add('hidden');
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-content').classList.remove('hidden');
    },

    resetRoleUI() {
        document.getElementById('admin-menu').classList.add('hidden');
        document.getElementById('user-role').textContent = "Association";
        document.getElementById('org-name').textContent = "Chargement...";
    },

    toggleAuthMode(mode) {
        const login = document.getElementById('login-form');
        const register = document.getElementById('register-form');
        if (mode === 'login') {
            login.classList.remove('hidden');
            register.classList.add('hidden');
        } else {
            login.classList.add('hidden');
            register.classList.remove('hidden');
        }
    },

    async switchView(viewId) {
        STATE.currentView = viewId;
        
        // Update nav UI
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
        });

        // Load Content
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

        try {
            let html = '';
            switch (viewId) {
                case 'dashboard':
                    html = await UI.renderDashboard();
                    break;
                case 'application':
                    html = await UI.renderApplicationForm();
                    break;
                case 'history':
                    html = await UI.renderHistory();
                    break;
                case 'profile':
                    html = await UI.renderProfile();
                    break;
                case 'admin-dashboard':
                    html = await ADMIN.renderAdminDashboard();
                    break;
                case 'admin-view-dossier':
                    html = await ADMIN.renderDossierDetail(arguments[0]);
                    break;
                default:
                    html = '<h3>Vue en cours de développement</h3>';
            }
            contentArea.innerHTML = html;
            
            // Post-render init
            UI.initViewInteractions(viewId);
        } catch (err) {
            contentArea.innerHTML = `<div class="error-state">Erreur : ${err.message}</div>`;
        }
    },

    async renderDashboard() {
        const applications = STATE.association ? await DB.getApplicationsByAssoc(STATE.association.id) : [];
        const lastApp = applications[0] || null;
        STATE.lastApplication = lastApp;

        return `
            <div class="dashboard-grid">
                <section class="card welcome-card">
                    <h3>Bienvenue, ${STATE.association ? STATE.association.name : 'Utilisateur'}</h3>
                    <p>C'est ici que vous pouvez gérer vos demandes de subvention annuelle pour la CCMVR.</p>
                </section>
                
                    <section class="card status-card">
                    <h3>État de votre demande 2026</h3>
                    ${lastApp ? `
                        <div class="status-indicator ${lastApp.status}">
                            <i class="fas fa-circle"></i> Statut : ${lastApp.status.toUpperCase()}
                        </div>
                        <p>Dernière mise à jour : ${new Date(lastApp.created_at).toLocaleDateString()}</p>
                        <div class="card-actions" style="margin-top:15px; display:flex; gap:10px; flex-wrap:wrap;">
                            ${lastApp.status === 'draft' ? `
                                <button class="btn btn-primary" onclick="UI.switchView('application')">
                                    <i class="fas fa-edit"></i> Continuer ma demande
                                </button>
                                <button class="btn btn-danger-outline" onclick="FORM.deleteApplication('${lastApp.id}')">
                                    <i class="fas fa-trash-alt"></i> Supprimer
                                </button>
                            ` : ''}
                            <button class="btn btn-secondary" id="download-pdf">
                                <i class="fas fa-file-pdf"></i> Télécharger mon dossier (PDF)
                            </button>
                        </div>
                    ` : `
                        <p>Aucune demande en cours pour l'année 2026.</p>
                        <button class="btn btn-primary" onclick="UI.switchView('application')">Démarrer une demande</button>
                    `}
                </section>

                <section class="card history-card">
                    <h3>Dernières activités</h3>
                    <ul class="activity-list">
                        ${applications.slice(0, 3).map(app => `
                            <li>Demande ${app.year} - ${app.status}</li>
                        `).join('') || '<li>Aucune activité récente</li>'}
                    </ul>
                </section>
            </div>
        `;
    },

    async renderProfile() {
        if (!STATE.association) return `
            <div class="card">
                <h3>Profil non trouvé</h3>
                <p>Impossible de charger les informations de votre association. Vérifiez que votre compte est correctement activé.</p>
            </div>
        `;

        const a = STATE.association;
        return `
            <div class="card">
                <h3>Mon Profil Association</h3>
                <p class="help-text">Modifiez ici les informations de base qui seront utilisées pour vos futures demandes.</p>
                <form id="profile-edit-form" style="margin-top: 20px">
                    <div class="form-section">
                        <h4>Informations Administratives</h4>
                        <div class="input-group">
                            <label>Nom de l'association</label>
                            <input type="text" id="p-name" value="${a.name || ''}" required>
                        </div>
                        <div class="grid-2">
                            <div class="input-group">
                                <label>Numéro RNA</label>
                                <input type="text" id="p-rna" value="${a.rna || ''}" required>
                            </div>
                            <div class="input-group">
                                <label>Date de création</label>
                                <input type="date" id="p-creation-date" value="${a.creation_date || ''}" required>
                            </div>
                        </div>
                        <div class="grid-2">
                            <div class="input-group">
                                <label>Numéro SIREN</label>
                                <input type="text" id="p-siren" value="${a.siren || ''}" required>
                            </div>
                            <div class="input-group">
                                <label>Numéro SIRET</label>
                                <input type="text" id="p-siret" value="${a.siret || ''}" required>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4>Gouvernance & Statuts</h4>
                        <div class="input-group">
                            <label>Nom complet du déclarant</label>
                            <input type="text" id="p-declarant" value="${a.declarant_name || ''}" required>
                        </div>
                        <div class="input-group">
                            <label>Liste des dirigeants (Bureau)</label>
                            <textarea id="p-leaders" rows="3" required>${a.leaders_list || ''}</textarea>
                        </div>
                        <div class="input-group">
                            <label>Texte des statuts</label>
                            <textarea id="p-statutes" rows="5" required>${a.statutes_text || ''}</textarea>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4>Coordonnées de contact</h4>
                        <div class="grid-2">
                            <div class="input-group">
                                <label>Email de contact public</label>
                                <input type="email" id="p-contact-email" value="${a.contact_email || ''}" required>
                            </div>
                            <div class="input-group">
                                <label>Numéro de contact</label>
                                <input type="tel" id="p-contact-phone" value="${a.contact_phone || ''}" required>
                            </div>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Enregistrer les modifications</button>
                    </div>
                </form>
            </div>
        `;
    },

    bindProfileEvents() {
        const form = document.getElementById('profile-edit-form');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            UI.toggleLoader(true);
            
            const updatedData = {
                name: document.getElementById('p-name').value,
                rna: document.getElementById('p-rna').value,
                creation_date: document.getElementById('p-creation-date').value,
                siren: document.getElementById('p-siren').value,
                siret: document.getElementById('p-siret').value,
                declarant_name: document.getElementById('p-declarant').value,
                leaders_list: document.getElementById('p-leaders').value,
                statutes_text: document.getElementById('p-statutes').value,
                contact_email: document.getElementById('p-contact-email').value,
                contact_phone: document.getElementById('p-contact-phone').value
            };

            try {
                const { error } = await sb.from('associations')
                    .update(updatedData)
                    .eq('id', STATE.association.id);
                
                if (error) throw error;
                
                STATE.association = { ...STATE.association, ...updatedData };
                document.getElementById('org-name').textContent = STATE.association.name;
                UI.notify("Profil mis à jour avec succès !", "success");
            } catch (err) {
                UI.notify("Erreur lors de la mise à jour : " + err.message, "error");
            } finally {
                UI.toggleLoader(false);
            }
        });
    },

    async renderApplicationForm() {
        // Simplified view for now, will be expanded into a stepper
        return `
            <div class="stepper-container">
                <div class="stepper-header">
                    <div class="step-badge active">1</div>
                    <div class="step-badge">2</div>
                    <div class="step-badge">3</div>
                    <div class="step-badge">4</div>
                    <div class="step-badge">5</div>
                    <div class="step-badge">6</div>
                    <div class="step-badge">7</div>
                    <div class="step-badge">8</div>
                    <div class="step-badge">9</div>
                </div>
                
                <div id="step-content" class="card">
                    <div class="loader-container" style="padding: 50px; text-align: center;">
                        <div class="spinner"></div>
                        <p style="margin-top: 15px; color: var(--primary-color); font-weight: 500;">Chargement de votre dossier...</p>
                    </div>
                </div>
            </div>
        `;
    },

    async renderHistory() {
        return `
            <div class="card">
                <h3>Historique des demandes</h3>
                <p>Cette section affichera vos dossiers archivés des années précédentes.</p>
                <div class="info-box">Aucun historique disponible pour le moment.</div>
            </div>
        `;
    },

    initViewInteractions(viewId) {
        if (viewId === 'dashboard') {
            document.getElementById('download-pdf')?.addEventListener('click', async () => {
                if (STATE.lastApplication) {
                    UI.notify("Génération du PDF...", "info");
                    const fullData = await DB.getFullApplication(STATE.lastApplication.id);
                    await PDF.generate(fullData);
                }
            });
        }
        
        if (viewId === 'application') {
            FORM.init().then(() => FORM.renderStep(1));
        }

        if (viewId === 'profile') {
            UI.bindProfileEvents();
        }
    }
};
