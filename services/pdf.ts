import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDF_FILE_PREFIX } from '../const';

// Format Helper
const formatIndianCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
};

export const generatePDF = (shops: any[], records: any[], expenses: any[], currentMonth: string, monthlyData: any, returnType: 'save' | 'blob' | 'base64' = 'save') => {
  const doc = new jsPDF();

  const [year, month] = currentMonth.split('-');
  const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('default', { month: 'long' });

  // --- 1. HEADER & TITLE ---
  doc.setFont("helvetica", "bold");
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 25, 'F');
  
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(`${PDF_FILE_PREFIX}: ${monthName} ${year}`, 14, 16);
  
  const today = new Date();
  const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${dateStr}`, 160, 16);

  // --- 2. SUMMARY CARDS ---
  const cardY = 30;
  const cardWidth = 43;
  const cardHeight = 20;
  const gap = 8;
  const margin = 14;

  // Received Card
  doc.setFillColor(34, 197, 94);
  doc.roundedRect(margin, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8); doc.text('RECEIVED', margin + 4, cardY + 7);
  doc.setFontSize(11); doc.text(`Rs. ${formatIndianCurrency(monthlyData.received)}`, margin + 4, cardY + 16);

  // Expenses Card
  doc.setFillColor(239, 68, 68);
  doc.roundedRect(margin + cardWidth + gap, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(8); doc.text('EXPENSES', margin + cardWidth + gap + 4, cardY + 7);
  doc.setFontSize(11); doc.text(`Rs. ${formatIndianCurrency(monthlyData.totalExpenses)}`, margin + cardWidth + gap + 4, cardY + 16);

  // Target Split Card
  doc.setFillColor(59, 130, 246);
  doc.roundedRect(margin + (cardWidth + gap) * 2, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(8); doc.text('TARGET SPLIT', margin + (cardWidth + gap) * 2 + 4, cardY + 7);
  doc.setFontSize(11); doc.text(`Rs. ${formatIndianCurrency(monthlyData.split)}`, margin + (cardWidth + gap) * 2 + 4, cardY + 16);

  let currentY = cardY + cardHeight + 15;
  const tableStyles = { fontSize: 9, cellPadding: 4, fontStyle: 'bold' as const }; 
  const headStyles = { fillColor: [59, 130, 246] as [number, number, number], fontStyle: 'bold' as const, fontSize: 9, cellPadding: 4 };

  // --- 3. SETTLEMENT TABLE ---
  if (monthlyData.transactions.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('Settlement Plan', 14, currentY);
      const transactionBody = monthlyData.transactions.map((t: any) => [
          t.from, 'pays', t.to, `Rs. ${formatIndianCurrency(t.amount)}`
      ]);
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

  // --- 4. SHOPS TABLE ---
  const shopBody = shops.map(shop => {
    // FIX: Using snake_case for Supabase data
    const rec = records.find(r => r.shop_id === shop.id);
    const isPaid = rec?.status === 'Paid';
    return [
      shop.name, 
      `Rs. ${formatIndianCurrency(shop.base_rent)}`, 
      isPaid ? `Paid (${rec.collected_by})` : 'Unpaid', 
      `Rs. ${formatIndianCurrency(rec?.amount_paid || 0)}`
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
      if (data.section === 'body' && data.column.index === 2) {
        const text = data.cell.text[0] || '';
        if (text.startsWith('Paid')) data.cell.styles.textColor = [34, 197, 94];
        else if (text === 'Unpaid') data.cell.styles.textColor = [239, 68, 68];
      }
    }
  });
  currentY = (doc as any).lastAutoTable.finalY + 12;

  // --- 5. EXPENSES TABLE ---
  if (expenses.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Monthly Expenditures', 14, currentY);
    const expenseBody = expenses.map(exp => {
      // FIX: Robust Date Handling
      // 1. Try created_at (Supabase default)
      // 2. Try date (Custom field)
      // 3. Fallback to current date
      const dateVal = exp.created_at || exp.date || new Date().toISOString();
      return [
        exp.description,
        exp.paid_by,
        new Date(dateVal).toLocaleDateString('en-IN'), // Fixed formatting
        `Rs. ${formatIndianCurrency(exp.amount)}`
      ];
    });
    autoTable(doc, {
      startY: currentY + 4,
      head: [['Description', 'Paid By', 'Date', 'Amount']],
      body: expenseBody,
      theme: 'striped',
      headStyles: { ...headStyles, fillColor: [239, 68, 68] as [number, number, number] },
      styles: tableStyles
    });
  }

  // --- 6. RETURN LOGIC ---
  if (returnType === 'base64') {
     return doc.output('datauristring').split(',')[1];
  } else if (returnType === 'blob') {
    return doc.output('blob'); 
  } else {
    doc.save(`Rent_Report_${currentMonth}.pdf`); 
  }
};