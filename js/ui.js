const UI = {
    init() {
        // Nav listeners
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                UI.switchView(view);
            });
        });

        // Initial view determination is handled via AUTH.loadProfile
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
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-content').classList.add('hidden');
    },

    showApp() {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-content').classList.remove('hidden');
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
                case 'admin-dashboard':
                    html = await ADMIN.renderAdminDashboard();
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

    async renderApplicationForm() {
        // Simplified view for now, will be expanded into a stepper
        return `
            <div class="stepper-container">
                <div class="stepper-header">
                    <div class="step-badge active">1</div>
                    <div class="step-badge">2</div>
                    <div class="step-badge">3</div>
                    <div class="step-badge">4</div>
                </div>
                
                <div id="step-content" class="card">
                    <h3>Notice - Étape 1</h3>
                    <div class="notice-content">
                        <p>Ce fichier est à destination des demandes de subvention de fonctionnement annuelles à la CCMVR uniquement.</p>
                        <ul>
                            <li>Veuillez remplir chaque section les unes après les autres.</li>
                            <li>Les données sont sauvegardées automatiquement à chaque étape.</li>
                            <li>Une fois soumise, la demande ne peut plus être modifiée.</li>
                        </ul>
                    </div>
                    <div class="form-actions">
                        <button class="btn btn-primary" id="next-step">Suivant</button>
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
        if (viewId === 'application') {
            document.getElementById('next-step')?.addEventListener('click', () => {
                UI.notify("Le formulaire complet est en cours d'intégration.", "info");
            });
        }
    }
};
