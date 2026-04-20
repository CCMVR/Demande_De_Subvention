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

        const logoHtml = `
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #721c24; padding-bottom: 20px; margin-bottom: 30px; align-items: center;">
                <img src="logo.png" style="width: 80px; height: auto;">
                <div style="font-size: 24px; font-weight: bold; color: #721c24; flex: 1; text-align: center;">Dossier de Subvention CCMVR</div>
                <div style="text-align: right; font-size: 14px; width: 80px;">Année : ${data.application.year}</div>
            </div>
        `;

        const identityHtml = `
            <section style="margin-bottom: 30px;">
                <h2 style="background: #f1f5f9; padding: 10px;">1. IDENTITÉ DE L'ASSOCIATION</h2>
                <p><strong>Nom :</strong> ${data.association?.name || 'N/A'}</p>
                <p><strong>SIRET :</strong> ${data.association?.siret || 'N/A'}</p>
                <p><strong>Montant demandé :</strong> ${data.application.total_requested} €</p>
                <p><strong>Axe choisi :</strong> ${data.application.selected_axe}</p>
            </section>
        `;

        const financialHtml = `
            <section style="margin-bottom: 30px;">
                <h2 style="background: #f1f5f9; padding: 10px;">2. DONNÉES COMPTABLES</h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <tr style="background: #721c24; color: white;">
                        <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Libellé</th>
                        <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">BP ${data.application.year}</th>
                        <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">CR N-1</th>
                    </tr>
                    ${data.financials.map(f => `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd;">${f.label}</td>
                            <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${f.bp_year} €</td>
                            <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${f.cr_n1} €</td>
                        </tr>
                    `).join('')}
                </table>
            </section>
        `;

        const declarationsHtml = `
            <section style="margin-bottom: 30px;">
                <h2 style="background: #f1f5f9; padding: 10px;">3. DÉCLARATIONS SUR L'HONNEUR</h2>
                <p>✔ L'association est à jour de ses obligations administratives.</p>
                <p>✔ L'association souscrit au contrat d'engagement républicain.</p>
                <p>✔ Certifié exact par le représentant légal.</p>
                <div style="margin-top: 20px; font-style: italic; text-align: right;">
                    Généré le ${new Date().toLocaleString()}
                </div>
            </section>
        `;

        element.innerHTML = logoHtml + identityHtml + financialHtml + declarationsHtml;

        const opt = {
            margin:       [10, 10, 10, 10],
            filename:     `Dossier_Subvention_${data.association?.name || 'Asso'}_${data.application.year}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        return html2pdf().set(opt).from(element).save();
    }
};
