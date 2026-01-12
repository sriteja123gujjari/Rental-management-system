
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

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
  const tableStyles = { fontSize: 9, cellPadding: 4, fontStyle: 'bold' }; 
  const headStyles = { fillColor: [59, 130, 246], fontStyle: 'bold', fontSize: 9, cellPadding: 4 };

  if (monthlyData.transactions.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('Settlement Plan', 14, currentY);
      const transactionBody = monthlyData.transactions.map((t: any) => [t.from, 'pays', t.to, `Rs. ${t.amount.toLocaleString()}`]);
      (doc as any).autoTable({
          startY: currentY + 4,
          head: [['From', 'Action', 'To', 'Amount']],
          body: transactionBody,
          theme: 'striped',
          headStyles: headStyles,
          styles: tableStyles
      });
      currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  const shopBody = shops.map(shop => {
    const rec = records.find(r => r.shopId === shop.id);
    return [shop.name, `Rs. ${shop.baseRent}`, rec?.status === 'Paid' ? `Paid (${rec.collectedBy})` : 'Unpaid', `Rs. ${rec?.amountPaid || 0}`];
  });

  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('Shop Payment Details', 14, currentY);
  (doc as any).autoTable({
    startY: currentY + 4,
    head: [['Shop Name', 'Base Rent', 'Status', 'Paid']],
    body: shopBody,
    theme: 'grid',
    headStyles: { ...headStyles, fillColor: [71, 85, 105] },
    styles: tableStyles
  });

  doc.save(`Rent_Report_${currentMonth}.pdf`);
};
