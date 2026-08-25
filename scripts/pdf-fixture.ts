/**
 * Generates a minimal but VALID single-page PDF (no compression) so tests can
 * exercise the encryption path with real qpdf tooling.
 */
export function makeMinimalPdf(): Buffer {
  const streamData = Buffer.from(
    'BT /F1 24 Tf 72 720 Td (SwiftLab Smoke Test) Tj ET',
    'utf8',
  );
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>'); // 1
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'); // 2
  objects.push(
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  ); // 3
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); // 4
  objects.push(
    `<< /Length ${streamData.length} >>\nstream\n${streamData.toString('utf8')}\nendstream`,
  ); // 5

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}