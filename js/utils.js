/**
 * Shared utility functions for calculations and formatting
 */
window.UTILS = {
    calculateEvolution(current, previous) {
        const cur = parseFloat(current) || 0;
        const prev = parseFloat(previous) || 0;
        if (prev === 0 && cur === 0) return "0.0";
        if (prev === 0) return "100.0";
        return (((cur - prev) / prev) * 100).toFixed(1);
    },

    calculateRatios(financials, assets = 0, liabilities = 0) {
        // Simple logic for treasury and autonomy based on grant app data
        const revenues = financials.filter(f => f.type === 'revenue').reduce((s, r) => s + (parseFloat(r.bp_year) || 0), 0);
        const expenses = financials.filter(f => f.type === 'expense').reduce((s, r) => s + (parseFloat(r.bp_year) || 0), 0);
        
        const grantCCMVR = financials.find(f => f.account_code === '74')?.bp_year || 0;
        
        return {
            ratios: {
                treasuryDaysRaw: (revenues > 0) ? (assets / (revenues / 365)).toFixed(0) : 0,
                treasuryDaysAdjusted: (expenses > 0) ? ((assets - liabilities) / (expenses / 365)).toFixed(0) : 0,
                financialAutonomy: (revenues > 0) ? (((revenues - grantCCMVR) / revenues) * 100).toFixed(1) : 0,
                ccmvrDependence: (revenues > 0) ? ((grantCCMVR / revenues) * 100).toFixed(1) : 0
            }
        };
    },

    getRiskLevel(type, value) {
        const val = parseFloat(value) || 0;
        switch(type) {
            case 'treasuryDaysRaw':
            case 'treasuryDaysAdjusted':
                if (val > 60) return 'badge-success';
                if (val > 30) return 'badge-warning';
                return 'badge-danger';
            case 'financialAutonomy':
                if (val > 50) return 'badge-success';
                if (val > 20) return 'badge-warning';
                return 'badge-danger';
            case 'ccmvrDependence':
                if (val < 30) return 'badge-success';
                if (val < 60) return 'badge-warning';
                return 'badge-danger';
            default:
                return 'badge-secondary';
        }
    }
};
