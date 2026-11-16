import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export interface DispatchSlipOrderData {
  orderNumber: string;
  orderId: string;
  createdAt: Date | string;
  status: string;
  pickupSlotStart?: Date | string | null;
  pickupSlotEnd?: Date | string | null;
  isDelivery?: boolean;
  buyerName?: string | null;
  buyerPhone?: string | null;
  buyerAddress?: string | null;
  shopName: string;
  shopAddress: string;
  shopPhone?: string | null;
  shopGstin?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  bookingAmount: number;
  balanceAmount: number;
  total: number;
}

/**
 * Generates a clean, production-ready PDF dispatch slip buffer (SEL-8)
 */
export async function generateOrderSlipPdf(order: DispatchSlipOrderData): Promise<Buffer> {
  // 1. Generate QR code buffer for seller handheld / counter barcode scanning
  const qrPayload = JSON.stringify({
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    pickupCode: order.orderNumber.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase(),
    balanceToCollect: Math.max(0, Math.round(order.balanceAmount)),
  });

  const qrCodeBuffer = await QRCode.toBuffer(qrPayload, {
    width: 140,
    margin: 1,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `Dispatch Slip #${order.orderNumber}`,
        Author: 'CityLocalShop',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    // Header & Brand
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .fillColor('#0f766e')
      .text(order.shopName.toUpperCase(), 40, 40);

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#4b5563')
      .text(order.shopAddress, 40, 68)
      .text(`Phone: ${order.shopPhone || 'N/A'}${order.shopGstin ? `  •  GSTIN: ${order.shopGstin}` : ''}`, 40, 82);

    // Order Badge (Right side)
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text(`ORDER #${order.orderNumber}`, 360, 40, { align: 'right' });

    const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#6b7280')
      .text(`Placed: ${orderDate}`, 360, 60, { align: 'right' })
      .text(`Type: ${order.isDelivery ? 'Direct Delivery' : 'In-Store Handover'}`, 360, 74, { align: 'right' })
      .text(`Status: ${order.status}`, 360, 88, { align: 'right' });

    // Divider
    doc
      .strokeColor('#e5e7eb')
      .lineWidth(1)
      .moveTo(40, 110)
      .lineTo(555, 110)
      .stroke();

    // Customer & Handover Details box
    doc
      .rect(40, 120, 360, 75)
      .fillAndStroke('#f9fafb', '#e5e7eb');

    const buyerFirst = (order.buyerName || 'Valued Customer').split(' ')[0];
    const maskedPhone = order.buyerPhone && order.buyerPhone.length >= 10
      ? `${order.buyerPhone.slice(0, 3)}****${order.buyerPhone.slice(-3)}`
      : 'Registered Customer';

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text('CUSTOMER & DISPATCH DETAILS', 52, 130);

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#374151')
      .text(`Customer: ${buyerFirst} (${maskedPhone})`, 52, 148);

    if (order.pickupSlotStart) {
      const slotTime = new Date(order.pickupSlotStart).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      doc.text(`Scheduled Handover Slot: Today at ${slotTime}`, 52, 162);
    } else {
      doc.text(`Handover Type: Immediate In-Store Pickup`, 52, 162);
    }

    if (order.isDelivery && order.buyerAddress) {
      doc.text(`Address: ${order.buyerAddress.slice(0, 50)}...`, 52, 176);
    } else {
      doc.text(`Verification: Scan Handover QR code at showroom desk`, 52, 176);
    }

    // QR Code for Handover Scanner
    doc.image(qrCodeBuffer, 425, 115, { width: 85, height: 85 });
    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .fillColor('#0f766e')
      .text('SCAN TO VERIFY', 425, 202, { width: 85, align: 'center' });

    // Items Table Header
    const tableTop = 225;
    doc
      .rect(40, tableTop, 515, 24)
      .fillAndStroke('#0f766e', '#0f766e');

    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .text('ITEM DESCRIPTION', 52, tableTop + 7)
      .text('QTY', 330, tableTop + 7, { width: 40, align: 'center' })
      .text('RATE (₹)', 390, tableTop + 7, { width: 60, align: 'right' })
      .text('AMOUNT (₹)', 470, tableTop + 7, { width: 70, align: 'right' });

    // Items List
    let currentY = tableTop + 24;
    order.items.forEach((item, idx) => {
      const isEven = idx % 2 === 0;
      doc
        .rect(40, currentY, 515, 24)
        .fillAndStroke(isEven ? '#ffffff' : '#f9fafb', '#f3f4f6');

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#1f2937')
        .text(item.name.length > 45 ? `${item.name.slice(0, 42)}...` : item.name, 52, currentY + 7, { width: 260 })
        .text(String(item.quantity), 330, currentY + 7, { width: 40, align: 'center' })
        .text(`₹${Math.round(item.price).toLocaleString('en-IN')}`, 390, currentY + 7, { width: 60, align: 'right' })
        .text(`₹${Math.round(item.total).toLocaleString('en-IN')}`, 470, currentY + 7, { width: 70, align: 'right' });

      currentY += 24;
    });

    // Summary & Financial Breakdown
    const summaryTop = currentY + 15;
    doc
      .rect(340, summaryTop, 215, 105)
      .fillAndStroke('#f9fafb', '#e5e7eb');

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#4b5563')
      .text('Subtotal:', 352, summaryTop + 10)
      .text(`₹${Math.round(order.subtotal).toLocaleString('en-IN')}`, 465, summaryTop + 10, { width: 75, align: 'right' });

    if (order.discount > 0) {
      doc
        .text('Discount Applied:', 352, summaryTop + 26)
        .text(`- ₹${Math.round(order.discount).toLocaleString('en-IN')}`, 465, summaryTop + 26, { width: 75, align: 'right' });
    }

    doc
      .text('Total Order Value:', 352, summaryTop + 42)
      .text(`₹${Math.round(order.total).toLocaleString('en-IN')}`, 465, summaryTop + 42, { width: 75, align: 'right' });

    doc
      .strokeColor('#e5e7eb')
      .lineWidth(1)
      .moveTo(352, summaryTop + 58)
      .lineTo(543, summaryTop + 58)
      .stroke();

    doc
      .text('Prepaid Token / Booking:', 352, summaryTop + 65)
      .text(`₹${Math.round(order.bookingAmount).toLocaleString('en-IN')}`, 465, summaryTop + 65, { width: 75, align: 'right' });

    const balToCollect = Math.max(0, Math.round(order.balanceAmount));
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(balToCollect > 0 ? '#b91c1c' : '#047857')
      .text('BALANCE TO COLLECT:', 352, summaryTop + 85)
      .text(`₹${balToCollect.toLocaleString('en-IN')}`, 465, summaryTop + 85, { width: 75, align: 'right' });

    // Terms / Handover Instructions (Left of Summary)
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text('MERCHANT HANDOVER INSTRUCTIONS', 40, summaryTop + 10);

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#6b7280')
      .text('1. Scan the QR code above with the CityLocalShop Seller app to complete handover.', 40, summaryTop + 26, { width: 280 })
      .text('2. Collect any outstanding balance at the showroom desk before release.', 40, summaryTop + 42, { width: 280 })
      .text('3. This dispatch slip serves as official delivery challan & proof of collection.', 40, summaryTop + 58, { width: 280 });

    // Footer
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#9ca3af')
      .text('Generated by CityLocalShop  •  Physical Showroom Commerce Platform', 40, 770, { align: 'center', width: 515 });

    doc.end();
  });
}
