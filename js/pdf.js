/**
 * PDF Generation Module
 * Uses html2pdf.js to convert thermal-styled HTML to a formal PDF document.
 */
const PDF = {
    async generate(data) {
        const element = document.createElement('div');
        element.style.padding = '40px';
        element.style.color = '#1e293b';
        element.style.fontFamily = 'Arial, sans-serif';

        const logoUrl = (typeof LOGO_BASE64 !== 'undefined' && LOGO_BASE64 !== "") ? LOGO_BASE64 : "";
        const logoHtml = `
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #721c24; padding-bottom: 20px; margin-bottom: 30px; align-items: center;">
                ${logoUrl ? `<img src="${logoUrl}" style="width: 80px; height: auto;">` : '<div style="width: 80px; height: 80px; background: #721c24; border-radius: 10px; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px;">CCMVR</div>'}
                <div style="font-size: 24px; font-weight: bold; color: #721c24; flex: 1; text-align: center;">Dossier de Subvention CCMVR</div>
                <div style="text-align: right; font-size: 14px; width: 80px;">Année : ${data.application.year || 2026}</div>
            </div>
        `;

        const identityHtml = `
            <section style="margin-bottom: 30px;">
                <h2 style="background: #f1f5f9; padding: 10px; font-size: 18px;">1. IDENTITÉ DE L'ASSOCIATION</h2>
                <p><strong>Nom :</strong> ${data.association?.name || 'N/A'}</p>
                <p><strong>SIRET :</strong> ${data.association?.siret || 'N/A'}</p>
                <p><strong>Montant demandé :</strong> ${data.application.total_requested} €</p>
                <p><strong>Axe choisi :</strong> ${data.application.selected_axe || 'N/A'}</p>
            </section>
        `;

        const generateTableHtml = (type) => {
            const title = type === 'expense' ? 'DÉPENSES (Charges)' : 'RECETTES (Produits)';
            const rows = data.financials.filter(f => f.type === type);
            const groups = [...new Set(rows.map(r => r.group))];

            return `
                <h3 style="color: #721c24; border-bottom: 1px solid #ddd; padding-bottom: 5px;">${title}</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px;">
                    <tr style="background: #f8fafc;">
                        <th style="padding: 5px; text-align: left; border: 1px solid #ddd;">Libellé</th>
                        <th style="padding: 5px; text-align: right; border: 1px solid #ddd;">BP 2026</th>
                        <th style="padding: 5px; text-align: right; border: 1px solid #ddd;">CR 2025</th>
                        <th style="padding: 5px; text-align: right; border: 1px solid #ddd;">CR 2024</th>
                        <th style="padding: 5px; text-align: right; border: 1px solid #ddd;">CR 2023</th>
                    </tr>
                    ${groups.map(g => {
                        const gRows = rows.filter(r => r.group === g);
                        const subBp = gRows.reduce((s, r) => s + (parseFloat(r.bp_year) || 0), 0);
                        return `
                            ${gRows.map(r => `
                                <tr>
                                    <td style="padding: 5px; border: 1px solid #ddd;">${r.label}</td>
                                    <td style="padding: 5px; text-align: right; border: 1px solid #ddd;">${r.bp_year} €</td>
                                    <td style="padding: 5px; text-align: right; border: 1px solid #ddd;">${r.cr_n1} €</td>
                                    <td style="padding: 5px; text-align: right; border: 1px solid #ddd;">${r.cr_n2} €</td>
                                    <td style="padding: 5px; text-align: right; border: 1px solid #ddd;">${r.cr_n3} €</td>
                                </tr>
                            `).join('')}
                            <tr style="background: #f1f5f9; font-weight: bold;">
                                <td style="padding: 5px; border: 1px solid #ddd;">Sous-total ${g}</td>
                                <td style="padding: 5px; text-align: right; border: 1px solid #ddd;">${subBp} €</td>
                                <td colspan="3" style="border: 1px solid #ddd;"></td>
                            </tr>
                        `;
                    }).join('')}
                </table>
            `;
        };

        const financialHtml = `
            <section style="margin-bottom: 30px; page-break-inside: auto;">
                <h2 style="background: #f1f5f9; padding: 10px; font-size: 18px;">2. DONNÉES COMPTABLES PAR AXE</h2>
                ${generateTableHtml('expense')}
                ${generateTableHtml('revenue')}
            </section>
        `;

        const declarationsHtml = `
            <section style="margin-bottom: 30px;">
                <h2 style="background: #f1f5f9; padding: 10px; font-size: 18px;">3. DÉCLARATIONS SUR L'HONNEUR</h2>
                <p>✔ L'association est à jour de ses obligations administratives, comptables, sociales et fiscales.</p>
                <p>✔ L'association souscrit au contrat d'engagement républicain.</p>
                <p>✔ Certifié exact par le représentant légal.</p>
                <div style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 10px; font-style: italic; text-align: right;">
                    Document généré numériquement le ${new Date().toLocaleString()}<br>
                    ID Demande : ${data.application.id}
                </div>
            </section>
        `;

        element.innerHTML = logoHtml + identityHtml + financialHtml + declarationsHtml;

        const opt = {
            margin: [10, 10, 10, 10],
            filename: `Dossier_Subvention_${data.association?.name || 'Asso'}_2026.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        return html2pdf().set(opt).from(element).save();
    }
};
