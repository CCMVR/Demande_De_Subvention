const AUTH = {
    async init() {
        if (!sb) {
            console.error("AUTH: Supabase client (sb) is not initialized.");
            UI.notify("Erreur de connexion à la base de données.", "error");
            UI.showAuth();
            return;
        }

        // Listen for auth changes
        sb.auth.onAuthStateChange(async (event, session) => {
            console.log("Auth Event:", event);
            UI.toggleLoader(true);
            
            try {
                if (session) {
                    STATE.user = session.user;
                    await AUTH.loadProfile();
                    UI.showApp();
                } else {
                    STATE.user = null;
                    STATE.profile = null;
                    STATE.association = null;
                    UI.showAuth();
                }
            } catch (err) {
                console.error("Critical Auth Error:", err);
                UI.notify("Erreur d'initialisation du compte.", "error");
                UI.showAuth(); // Always fallback to something visible
            } finally {
                UI.toggleLoader(false);
            }
        });

        // Initialize UI listeners
        document.getElementById('login-form').addEventListener('submit', AUTH.login);
        document.getElementById('register-form').addEventListener('submit', AUTH.register);
        document.getElementById('logout-btn').addEventListener('click', () => sb.auth.signOut());
        
        document.getElementById('show-register').addEventListener('click', (e) => {
            e.preventDefault();
            UI.toggleAuthMode('register');
        });
        
        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            UI.toggleAuthMode('login');
        });
    },

    async login(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        UI.toggleLoader(true);
        try {
            const { error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw error;
        } catch (err) {
            UI.notify("Erreur de connexion : " + err.message, "error");
        } finally {
            UI.toggleLoader(false);
        }
    },

    async register(e) {
        e.preventDefault();
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm-password').value;

        if (password !== confirm) {
            return UI.notify("Les mots de passe ne correspondent pas.", "error");
        }

        UI.toggleLoader(true);
        try {
            // Check pre-validation
            const preVal = await sb.from('prevalidated_emails')
                             .select('*')
                             .eq('email', email)
                             .is('used_at', null)
                             .single();
            
            if (preVal.error) throw new Error("Votre adresse mail n'est pas pré-validée ou l'invitation a expiré.");
            
            // Check expiry (3 days)
            const expiry = new Date(preVal.data.created_at);
            expiry.setDate(expiry.getDate() + CONFIG.REGISTRATION_VALIDITY_DAYS);
            if (new Date() > expiry) throw new Error("L'invitation a expiré (limite de 3 jours). Contactez l'admin.");

            const { data, error } = await sb.auth.signUp({ email, password });
            if (error) throw error;

            // Mark as used
            await sb.from('prevalidated_emails').update({ used_at: new Date() }).eq('id', preVal.data.id);

            UI.notify("Inscription réussie ! Vous pouvez maintenant vous connecter.", "success");
            UI.toggleAuthMode('login');
        } catch (err) {
            UI.notify(err.message, "error");
        } finally {
            UI.toggleLoader(false);
        }
    },

    async loadProfile() {
        try {
            // Reset UI state before loading new profile
            UI.resetRoleUI();

            const profile = await DB.getProfile(STATE.user.id);
            STATE.profile = profile;
            
            if (profile && profile.association_id) {
                STATE.association = await DB.getAssociation(profile.association_id);
                document.getElementById('org-name').textContent = STATE.association.name;
                document.getElementById('user-role').textContent = "Association";
                await FORM.init();
                UI.switchView('dashboard');
            } else if (STATE.user.email && STATE.user.email.toLowerCase() === CONFIG.AO_EMAIL.toLowerCase()) {
                document.getElementById('org-name').textContent = "Administration CCMVR";
                document.getElementById('user-role').textContent = "Admin";
                document.getElementById('admin-menu').classList.remove('hidden');
                await ADMIN.init();
                UI.switchView('admin-dashboard');
            } else {
                // Default fallback for new users without associations yet
                document.getElementById('org-name').textContent = "Nouvel Utilisateur";
                document.getElementById('user-role').textContent = "En attente";
                UI.switchView('dashboard');
            }
        } catch (err) {
            console.error("Error loading profile", err);
        }
    }
};
