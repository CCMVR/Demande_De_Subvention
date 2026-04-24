// Main Entry Point
document.addEventListener('DOMContentLoaded', async () => {
    // Check if Supabase loaded correctly
    if (typeof supabase === 'undefined') {
        console.error("Supabase CDN failed to load.");
        return;
    }

    // Initialize Modules
    console.log("DOM Ready. Initializing App...");
    
    // 1. UI First (prepare elements)
    UI.init();
    
    // 2. Auth Second (starts listener)
    try {
        console.log("Auth init...");
        
        // Safety timeout: If after 5s we are still on splash, force show auth
        const safetyTimer = setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash && !splash.classList.contains('hidden')) {
                console.warn("Initialization took too long, forcing auth screen.");
                UI.showAuth();
            }
        }, 5000);

        await AUTH.init();
        
        console.log("CCMVR Application Ready.");
    } catch (err) {
        console.error("APP INITIALIZATION FAILED:", err);
        UI.showAuth();
    }
});

// Polyfill dynamic content for specific Excel data mapping
const EXCEL_MAPPING = {
    axes: [
        { code: '5a', principal: 'Enfance et Jeunesse', secondary: 'Accueil 0-6 ans : Crèches' },
        { code: '5b', principal: 'Enfance et Jeunesse', secondary: 'Accueil 3-14 ans : Périscolaire et Extrascolaire' },
        { code: '5c', principal: 'Enfance et Jeunesse', secondary: 'Accueil ados 11-17 ans' },
        { code: '5d', principal: 'Enfance et Jeunesse', secondary: 'Autres accueils : Ludothèque, Relais Petite Enfance, autres.' },
        { code: '6a', principal: 'Solidarités', secondary: 'Prévention et accès au droit (PAEJ, PIJ, CLAS, Habitat, accès aux droits, insertion.)' }
    ],
    financial_accounts: [
        // CHARGES (6x)
        { code: '60', group: 'G1', label: "Achats" },
        { code: '61', group: 'G1', label: "Services extérieurs" },
        { code: '62', group: 'G1', label: "Autres services extérieurs" },
        { code: 'G1-OTHER', group: 'G1', label: "Autres charges G1", isOther: true },
        
        { code: '63', group: 'G2', label: "Impôts et taxes" },
        { code: 'G2-OTHER', group: 'G2', label: "Autres impôts et taxes", isOther: true },
        
        { code: '641', group: 'G3', label: "Salaires et traitements" },
        { code: '645', group: 'G3', label: "Charges sociales" },
        { code: 'G3-OTHER', group: 'G3', label: "Autres charges de personnel", isOther: true },
        
        { code: '65', group: 'G4', label: "Autres charges de gestion courante" },
        { code: 'G4-OTHER', group: 'G4', label: "Détail autres charges G4", isOther: true },
        
        { code: '66', group: 'G5', label: "Charges financières" },
        { code: '67', group: 'G6', label: "Charges exceptionnelles" },
        { code: '68', group: 'G7', label: "Dot. aux amortis et provis." },
        
        // RECETTES (7x)
        { code: '70', group: 'R1', label: "Participation des familles / Cotisations" },
        { code: '70b', group: 'R1', label: "Prestation de service CAF" },
        { code: 'R1-OTHER', group: 'R1', label: "Autres recettes G1", isOther: true },
        
        { code: '74', group: 'R2', label: "Subvention CCMVR (Demandée ici)", isReadOnly: true },
        { code: '74b', group: 'R2', label: "Subvention AJC (CCMVR)" },
        
        { code: '75', group: 'R3', label: "Autres produits de gestion courante" },
        { code: '76', group: 'R4', label: "Produits financiers" },
        { code: '77', group: 'R5', label: "Produits exceptionnels" },
        { code: '78', group: 'R6', label: "Reprise sur Amortis. et provisions" },
        { code: '79', group: 'R7', label: "Transfert de charges" },

        // BILAN (S)
        { code: 'TRESO', group: 'S1', label: "Trésorerie disponible (Actif)" },
        { code: 'DETTES', group: 'S2', label: "Dettes (Passif)" },
        { code: 'RESULTAT', group: 'S3', label: "Résultat de l'exercice" },
        { code: 'RESERVES', group: 'S4', label: "Report à nouveau / Réserves" }
    ]
};
