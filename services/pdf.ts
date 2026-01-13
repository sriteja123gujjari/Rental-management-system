import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePDF = (shops: any[], records: any[], expenses: any[], currentMonth: string, monthlyData: any) => {
  const doc = new jsPDF();
  const [year, month] = currentMonth.split('-');
  const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('default', { month: 'long' });

  doc.setFont("helvetica", "bold");
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 25, 'F');
  
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(`Rent Report: ${monthName} ${year}`, 14, 16);
  
  const today = new Date();
  const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${dateStr}`, 160, 16);

  // Summary Cards
  const cardY = 30;
  const cardWidth = 43;
  const cardHeight = 20;
  const gap = 8;
  const margin = 14;

  // Received
  doc.setFillColor(34, 197, 94);
  doc.roundedRect(margin, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8); doc.text('RECEIVED', margin + 4, cardY + 7);
  doc.setFontSize(11); doc.text(`Rs. ${monthlyData.received.toLocaleString()}`, margin + 4, cardY + 16);

  // Expenses
  doc.setFillColor(239, 68, 68);
  doc.roundedRect(margin + cardWidth + gap, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(8); doc.text('EXPENSES', margin + cardWidth + gap + 4, cardY + 7);
  doc.setFontSize(11); doc.text(`Rs. ${monthlyData.totalExpenses.toLocaleString()}`, margin + cardWidth + gap + 4, cardY + 16);

  // Target
  doc.setFillColor(59, 130, 246);
  doc.roundedRect(margin + (cardWidth + gap) * 2, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(8); doc.text('TARGET SPLIT', margin + (cardWidth + gap) * 2 + 4, cardY + 7);
  doc.setFontSize(11); doc.text(`Rs. ${monthlyData.split.toLocaleString()}`, margin + (cardWidth + gap) * 2 + 4, cardY + 16);

  let currentY = cardY + cardHeight + 15;
  const tableStyles = { fontSize: 9, cellPadding: 4, fontStyle: 'bold' as const }; 
  const headStyles = { fillColor: [59, 130, 246] as [number, number, number], fontStyle: 'bold' as const, fontSize: 9, cellPadding: 4 };

  // Section 1: Settlement Plan
  if (monthlyData.transactions.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('Settlement Plan', 14, currentY);
      const transactionBody = monthlyData.transactions.map((t: any) => [t.from, 'pays', t.to, `Rs. ${t.amount.toLocaleString()}`]);
      
      autoTable(doc, {
          startY: currentY + 4,
          head: [['From', 'Action', 'To', 'Amount']],
          body: transactionBody,
          theme: 'striped',
          headStyles: headStyles,
          styles: tableStyles
      });
      currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  // Section 2: Shop Payment Details
  const shopBody = shops.map(shop => {
    const rec = records.find(r => r.shopId === shop.id);
    const isPaid = rec?.status === 'Paid';
    return [
      shop.name, 
      `Rs. ${shop.baseRent.toLocaleString()}`, 
      isPaid ? `Paid (${rec.collectedBy})` : 'Unpaid', 
      `Rs. ${(rec?.amountPaid || 0).toLocaleString()}`
    ];
  });

  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('Shop Payment Details', 14, currentY);
  
  autoTable(doc, {
    startY: currentY + 4,
    head: [['Shop Name', 'Base Rent', 'Status', 'Paid Amount']],
    body: shopBody,
    theme: 'grid',
    headStyles: { ...headStyles, fillColor: [71, 85, 105] as [number, number, number] },
    styles: tableStyles,
    didParseCell: (data) => {
      // Column index 2 is "Status"
      if (data.section === 'body' && data.column.index === 2) {
        const text = data.cell.text[0] || '';
        if (text.startsWith('Paid')) {
          data.cell.styles.textColor = [34, 197, 94]; // Green [34, 197, 94]
        } else if (text === 'Unpaid') {
          data.cell.styles.textColor = [239, 68, 68]; // Red [239, 68, 68]
        }
      }
    }
  });
  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Section 3: Expenditure List
  if (expenses.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Monthly Expenditures', 14, currentY);
    
    const expenseBody = expenses.map(exp => [
      exp.description,
      exp.paidBy,
      new Date(exp.timestamp).toLocaleDateString(),
      `Rs. ${exp.amount.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: currentY + 4,
      head: [['Description', 'Paid By', 'Date', 'Amount']],
      body: expenseBody,
      theme: 'striped',
      headStyles: { ...headStyles, fillColor: [239, 68, 68] as [number, number, number] },
      styles: tableStyles
    });
  }

  doc.save(`Rent_Report_${currentMonth}.pdf`);
};