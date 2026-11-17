import QRCode from 'qrcode'

/**
 * UAE FTA-compliant QR code content format.
 * Contains: Seller Name | TRN | Invoice Number | Date | Total | VAT
 */
export function buildInvoiceQrContent(params: {
  sellerName: string
  trn: string
  invoiceNumber: string
  invoiceDate: string
  totalAmount: number
  vatAmount: number
}): string {
  const { sellerName, trn, invoiceNumber, invoiceDate, totalAmount, vatAmount } = params
  const parts = [
    sellerName || 'N/A',
    trn || 'N/A',
    invoiceNumber || 'N/A',
    invoiceDate || 'N/A',
    totalAmount.toFixed(2),
    vatAmount.toFixed(2),
  ]
  return parts.join('|')
}

/**
 * Generate QR code as PNG base64 data URL for invoice.
 */
export async function generateInvoiceQrCode(content: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(content, {
    type: 'image/png',
    margin: 2,
    width: 200,
    errorCorrectionLevel: 'M',
  })
  return dataUrl
}
