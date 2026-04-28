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

// Financial accounts mapping - CORRECTED with proper subtotal markers
const EXCEL_MAPPING = {
    axes: [
        { code: '5a', principal: 'Enfance et Jeunesse', secondary: 'Accueil 0-6 ans : Crèches' },
        { code: '5b', principal: 'Enfance et Jeunesse', secondary: 'Accueil 3-14 ans : Périscolaire et Extrascolaire' },
        { code: '5c', principal: 'Enfance et Jeunesse', secondary: 'Accueil ados 11-17 ans' },
        { code: '5d', principal: 'Enfance et Jeunesse', secondary: 'Autres accueils : Ludothèque, Relais Petite Enfance, autres.' },
        { code: '6a', principal: 'Solidarités', secondary: 'Prévention et accès au droit (PAEJ, PIJ, CLAS, Habitat, accès aux droits, insertion.)' }
    ],
    financial_accounts: [
        // ========== CHARGES (Expenses) ==========
        
        // GROUP G1 — 60/61/62 Achats et services extérieurs
        { code: 'TOTAL_G1', group: 'G1', label: "60 61 et 62 - Achats / services extérieurs / autres", type: 'expense', isSubtotal: true, subtotalLabel: "Sous-total : Achats / services extérieurs / autres" },
        { code: '60212', group: 'G1', label: "Fournitures d'atelier ou d'activité", type: 'expense' },
        { code: '60214', group: 'G1', label: "Alimentation, boissons", type: 'expense' },
        { code: '60635', group: 'G1', label: "Petit équipement", type: 'expense' },
        { code: '611', group: 'G1', label: "Prestation extérieure pour activité", type: 'expense' },
        { code: '6135_L', group: 'G1', label: "Loyer et charges locatives", type: 'expense' },
        { code: '6135_M', group: 'G1', label: "Location de matériel", type: 'expense' },
        { code: '6156', group: 'G1', label: "Maintenance informatique", type: 'expense' },
        { code: '621', group: 'G1', label: "Personnel extérieur à la structure (facturé et hors activité)", type: 'expense' },
        { code: '622', group: 'G1', label: "Honoraires (hors activité)", type: 'expense' },
        { code: '624', group: 'G1', label: "Transport de biens et de personnes (en collectif pour activités)", type: 'expense' },
        { code: 'G1_OTHER', group: 'G1', label: "Autres achats et services", type: 'expense' },
        
        // GROUP G2 — 63 Impôts et taxes
        { code: 'TOTAL_G2', group: 'G2', label: "63 - Impôts et taxes", type: 'expense', isSubtotal: true, subtotalLabel: "Sous-total : Impôts et taxes" },
        { code: '63', group: 'G2', label: "Impôts, taxes et versements assimilés", type: 'expense' },
        
        // GROUP G3 — 64 Charges de personnel
        { code: 'TOTAL_G3', group: 'G3', label: "64 - Charges de personnel", type: 'expense', isSubtotal: true, subtotalLabel: "Sous-total : Charges de personnel" },
        { code: '64', group: 'G3', label: "Charges du personnel", type: 'expense' },
        
        // GROUP G4 — 65 Autres charges de gestion courante
        { code: 'TOTAL_G4', group: 'G4', label: "65 - Autres charges de gestion courante", type: 'expense', isSubtotal: true, subtotalLabel: "Sous-total : Autres charges de gestion courante" },
        { code: '65', group: 'G4', label: "Autres charges de gestion courante", type: 'expense' },
        
        // GROUP G5 — 66 Charges financières
        { code: 'TOTAL_G5', group: 'G5', label: "66 - Charges financières", type: 'expense', isSubtotal: true, subtotalLabel: "Sous-total : Charges financières" },
        { code: '66', group: 'G5', label: "Charges financières", type: 'expense' },
        
        // GROUP G6 — 67 Charges exceptionnelles
        { code: 'TOTAL_G6', group: 'G6', label: "67 - Charges exceptionnelles", type: 'expense', isSubtotal: true, subtotalLabel: "Sous-total : Charges exceptionnelles" },
        { code: '67', group: 'G6', label: "Charges exceptionnelles", type: 'expense' },
        
        // GROUP G7 — 68 Dotations
        { code: 'TOTAL_G7', group: 'G7', label: "68 - Dot. aux amortis. et aux provis.", type: 'expense', isSubtotal: true, subtotalLabel: "Sous-total : Dotations aux amortissements et provisions" },
        { code: '68', group: 'G7', label: "Dotations aux amortissements, dépréciations et provisions", type: 'expense' },

        // ========== RECETTES (Revenue) ==========
        
        // GROUP R1 — 70-73 Produits des services
        { code: 'TOTAL_R1', group: 'R1', label: "70 à 73 - Produits des services", type: 'revenue', isSubtotal: true, subtotalLabel: "Sous-total : Produits des services" },
        { code: '70', group: 'R1', label: "Participation des familles", type: 'revenue' },
        { code: '70_73_PS', group: 'R1', label: "Prestation de service CAF", type: 'revenue' },
        { code: '70_73_CTG', group: 'R1', label: "Bonus CTG CAF", type: 'revenue' },
        { code: '70_75_COT', group: 'R1', label: "Cotisations, Adhésions", type: 'revenue' },
        { code: 'R1_OTHER', group: 'R1', label: "Autres produits de services", type: 'revenue' },

        // GROUP R2 — 74 Subventions
        { code: 'TOTAL_R2', group: 'R2', label: "74 - Subventions d'exploitation", type: 'revenue', isSubtotal: true, subtotalLabel: "Sous-total : Subventions d'exploitation" },
        { code: '74', group: 'R2', label: "Subvention Marches du Velay Rochebaron (Fonctionnement)", type: 'revenue' },
        { code: '74_AJC', group: 'R2', label: "Subvention AJC (CCMVR)", type: 'revenue' },
        { code: 'R2_OTHER', group: 'R2', label: "Autres subventions", type: 'revenue' },

        // GROUP R3 — 76 Produits financiers
        { code: 'TOTAL_R3', group: 'R3', label: "76 - Produits financiers", type: 'revenue', isSubtotal: true, subtotalLabel: "Sous-total : Produits financiers" },
        { code: '76', group: 'R3', label: "Produits financiers", type: 'revenue' },
        
        // GROUP R4 — 77 Produits exceptionnels
        { code: 'TOTAL_R4', group: 'R4', label: "77 - Produits exceptionnels", type: 'revenue', isSubtotal: true, subtotalLabel: "Sous-total : Produits exceptionnels" },
        { code: '77', group: 'R4', label: "Produits exceptionnels", type: 'revenue' },
        
        // GROUP R5 — 78 Reprises
        { code: 'TOTAL_R5', group: 'R5', label: "78 - Reprise sur amortis. et provisions", type: 'revenue', isSubtotal: true, subtotalLabel: "Sous-total : Reprises sur amortissements et provisions" },
        { code: '78', group: 'R5', label: "Reprises sur provisions et dépréciations", type: 'revenue' },
        
        // GROUP R6 — 79 Transferts de charges
        { code: 'TOTAL_R6', group: 'R6', label: "79 - Transfert de charges", type: 'revenue', isSubtotal: true, subtotalLabel: "Sous-total : Transfert de charges" },
        { code: '79', group: 'R6', label: "Transferts de charges", type: 'revenue' },
        
        // GROUP R7 — 75 Autres produits
        { code: 'TOTAL_R7', group: 'R7', label: "75 - Autres produits", type: 'revenue', isSubtotal: true, subtotalLabel: "Sous-total : Autres produits" },
        { code: '75', group: 'R7', label: "Autres produits de gestion courante", type: 'revenue' },

        // ========== BILAN ==========
        // ACTIF
        { code: 'B_ACTIF_IMMO', group: 'B1', label: "TOTAL ACTIF IMMOBILISE", type: 'bilan' },
        { code: 'B_ACTIF_CIRC', group: 'B2', label: "TOTAL ACTIF CIRCULANT", type: 'bilan', isSubtotal: true },
        { code: 'B_ACTIF_CREANCES', group: 'B2', label: "Créances clients, usagers et comptes rattachés", type: 'bilan' },
        { code: 'B_ACTIF_DISPO', group: 'B2', label: "Disponibilités", type: 'bilan' },
        { code: 'B_ACTIF_STOCK', group: 'B2', label: "Stock", type: 'bilan' },
        { code: 'B_ACTIF_VMP', group: 'B2', label: "Valeur mobilière de placement", type: 'bilan' },
        { code: 'B_ACTIF_CCA', group: 'B2', label: "Charges constatées d'avance", type: 'bilan' },
        { code: 'B_ACTIF_OTHER', group: 'B2', label: "Autres (Actif)", type: 'bilan' },
        { code: 'B_ACTIF_TOTAL', group: 'B3', label: "TOTAL GENERAL ACTIF", type: 'bilan', isSubtotal: true },
        
        // PASSIF
        { code: 'B_PASSIF_FP', group: 'B4', label: "TOTAL FONDS PROPRES", type: 'bilan', isSubtotal: true },
        { code: 'B_PASSIF_FONDS', group: 'B4', label: "Fonds associatifs (sans droit de reprise)", type: 'bilan' },
        { code: 'B_PASSIF_RESERVES', group: 'B4', label: "Réserves", type: 'bilan' },
        { code: 'B_PASSIF_RAN', group: 'B4', label: "Report à nouveau", type: 'bilan' },
        { code: 'B_PASSIF_RESULTAT', group: 'B4', label: "Résultat de l'exercice", type: 'bilan' },
        { code: 'B_PASSIF_SUBV', group: 'B4', label: "Subventions d'investissement", type: 'bilan' },
        { code: 'B_PASSIF_OTHER_FP', group: 'B4', label: "Autres (Fonds propres)", type: 'bilan' },
        { code: 'B_PASSIF_DEDIES', group: 'B5', label: "TOTAL FONDS DEDIES", type: 'bilan' },
        { code: 'B_PASSIF_PROV', group: 'B6', label: "TOTAL PROVISIONS", type: 'bilan' },
        { code: 'B_PASSIF_DETTES', group: 'B7', label: "TOTAL DETTES", type: 'bilan', isSubtotal: true },
        { code: 'B_PASSIF_D1Y', group: 'B7', label: "Dettes à plus d'un an", type: 'bilan' },
        { code: 'B_PASSIF_D0Y', group: 'B7', label: "Dettes à moins d'un an", type: 'bilan' },
        { code: 'B_PASSIF_D_FOURN', group: 'B7', label: "Dettes fournisseurs, fiscales et sociales", type: 'bilan' },
        { code: 'B_PASSIF_PCA', group: 'B7', label: "Produits constatés d'avance", type: 'bilan' },
        { code: 'B_PASSIF_OTHER_D', group: 'B7', label: "Autres (Dettes)", type: 'bilan' },
        { code: 'B_PASSIF_TOTAL', group: 'B8', label: "TOTAL GENERAL PASSIF", type: 'bilan', isSubtotal: true },
        { code: 'B_DIFF', group: 'B9', label: "DIFFERENCE ACTIF - PASSIF", type: 'bilan', isSubtotal: true }
    ]
};
