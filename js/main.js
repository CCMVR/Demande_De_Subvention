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

        // BILAN (B) - ACTIF
        { code: 'B_ACTIF_IMMO', group: 'B1', label: "TOTAL ACTIF IMMOBILISE" },
        { code: 'B_ACTIF_CIRC', group: 'B2', label: "TOTAL ACTIF CIRCULANT" },
        { code: 'B_ACTIF_CREANCES', group: 'B2', label: "Créances clients, usagers et comptes rattachés" },
        { code: 'B_ACTIF_DISPO', group: 'B2', label: "Disponibilités" },
        { code: 'B_ACTIF_STOCK', group: 'B2', label: "Stock" },
        { code: 'B_ACTIF_VMP', group: 'B2', label: "Valeur mobilière de placement" },
        { code: 'B_ACTIF_CCA', group: 'B2', label: "Charges constatées d'avance" },
        { code: 'B_ACTIF_OTHER', group: 'B2', label: "Autres (Actif)" },
        { code: 'B_ACTIF_TOTAL', group: 'B3', label: "TOTAL GENERAL ACTIF" },
        
        // BILAN (B) - PASSIF
        { code: 'B_PASSIF_FP', group: 'B4', label: "TOTAL FONDS PROPRES" },
        { code: 'B_PASSIF_FONDS', group: 'B4', label: "Fonds associatifs (sans droit de reprise)" },
        { code: 'B_PASSIF_RESERVES', group: 'B4', label: "Réserves" },
        { code: 'B_PASSIF_RAN', group: 'B4', label: "Report à nouveau" },
        { code: 'B_PASSIF_RESULTAT', group: 'B4', label: "Résultat de l'exercice" },
        { code: 'B_PASSIF_SUBV', group: 'B4', label: "Subventions d'investissement" },
        { code: 'B_PASSIF_OTHER_FP', group: 'B4', label: "Autres (Fonds propres)" },
        { code: 'B_PASSIF_DEDIES', group: 'B5', label: "TOTAL FONDS DEDIES" },
        { code: 'B_PASSIF_PROV', group: 'B6', label: "TOTAL PROVISIONS" },
        { code: 'B_PASSIF_DETTES', group: 'B7', label: "TOTAL DETTES" },
        { code: 'B_PASSIF_D1Y', group: 'B7', label: "Dettes à plus d'un an" },
        { code: 'B_PASSIF_D0Y', group: 'B7', label: "Dettes à moins d'un an" },
        { code: 'B_PASSIF_D_FOURN', group: 'B7', label: "Dettes fournisseurs, fiscales et sociales" },
        { code: 'B_PASSIF_PCA', group: 'B7', label: "Produits constatés d'avance" },
        { code: 'B_PASSIF_OTHER_D', group: 'B7', label: "Autres (Dettes)" },
        { code: 'B_PASSIF_TOTAL', group: 'B8', label: "TOTAL GENERAL PASSIF" },
        { code: 'B_DIFF', group: 'B9', label: "DIFFERENCE ACTIF - PASSIF" }
    ]
};
