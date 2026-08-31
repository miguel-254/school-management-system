const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const FONT_PATH = path.join(__dirname, '..', '..', 'fonts');

function registerFonts(doc) {
  try {
    const regularPath = path.join(FONT_PATH, 'Roboto-Regular.ttf');
    const boldPath = path.join(FONT_PATH, 'Roboto-Bold.ttf');
    if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
      doc.registerFont('Roboto', regularPath);
      doc.registerFont('Roboto-Bold', boldPath);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function addHeader(doc, reportCard, schoolSettings) {
  const pageWidth = doc.page.width;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  if (schoolSettings.logo && schoolSettings.reportCardConfig?.showLogo !== false) {
    const logoPath = path.resolve(
      schoolSettings.logo.startsWith('/') || schoolSettings.logo.startsWith('C:')
        ? schoolSettings.logo
        : path.join(__dirname, '..', '..', schoolSettings.logo)
    );
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, margin, 30, { width: 80, height: 80 });
    }
  }

  const titleY = schoolSettings.logo ? 40 : 30;
  const titleX = schoolSettings.logo ? margin + 100 : margin;

  doc.fontSize(20).font('Helvetica-Bold').text(schoolSettings.schoolName || 'School Name', titleX, titleY, {
    align: 'center',
    width: contentWidth - (schoolSettings.logo ? 100 : 0),
  });

  const addressParts = [];
  if (schoolSettings.address?.street) addressParts.push(schoolSettings.address.street);
  if (schoolSettings.address?.city) addressParts.push(schoolSettings.address.city);
  if (schoolSettings.address?.state) addressParts.push(schoolSettings.address.state);
  const addressLine = addressParts.join(', ');

  if (addressLine) {
    doc.fontSize(10).font('Helvetica').text(addressLine, titleX, titleY + 22, {
      align: 'center',
      width: contentWidth - (schoolSettings.logo ? 100 : 0),
    });
  }

  if (schoolSettings.phone || schoolSettings.email) {
    const contactParts = [];
    if (schoolSettings.phone) contactParts.push(`Tel: ${schoolSettings.phone}`);
    if (schoolSettings.email) contactParts.push(`Email: ${schoolSettings.email}`);
    doc.fontSize(9).font('Helvetica').text(contactParts.join(' | '), titleX, titleY + 36, {
      align: 'center',
      width: contentWidth - (schoolSettings.logo ? 100 : 0),
    });
  }

  if (schoolSettings.motto) {
    doc.fontSize(10).font('Helvetica-Oblique').text(`"${schoolSettings.motto}"`, titleX, titleY + 48, {
      align: 'center',
      width: contentWidth - (schoolSettings.logo ? 100 : 0),
    });
  }

  doc.moveDown(2);

  const lineY = doc.y;
  doc.moveTo(margin, lineY).lineTo(pageWidth - margin, lineY).strokeColor('#333').lineWidth(1.5).stroke();
  doc.moveDown(1);

  doc.fontSize(18).font('Helvetica-Bold').text('REPORT CARD', { align: 'center' });

  doc.moveTo(margin, doc.y + 5).lineTo(pageWidth - margin, doc.y + 5).strokeColor('#333').lineWidth(1.5).stroke();
  doc.moveDown(1.5);
}

function addStudentInfo(doc, reportCard) {
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Student Information', { underline: true });
  doc.moveDown(0.3);

  doc.fontSize(9).font('Helvetica');
  const student = reportCard.student || {};
  const studentName = student.fullName || `${student.firstName || ''} ${student.lastName || ''}`.trim();
  const admission = student.admissionNumber || 'N/A';
  const className = reportCard.class?.name || reportCard.class?.toString().slice(-6) || 'N/A';
  const streamName = reportCard.stream?.name || reportCard.stream?.toString().slice(-6) || '';
  const termName = reportCard.term?.name || reportCard.term?.toString().slice(-6) || 'N/A';
  const yearName = reportCard.academicYear?.name || reportCard.academicYear?.year || reportCard.academicYear?.toString().slice(-6) || 'N/A';

  const leftColX = 50;
  const rightColX = 300;
  let rowY = doc.y;

  const fields = [
    { label: 'Student Name:', value: studentName, x: leftColX },
    { label: 'Admission No:', value: admission, x: rightColX },
  ];

  fields.forEach((f) => {
    doc.text(`${f.label} ${f.value}`, f.x, rowY, { continued: false });
  });

  rowY += 14;
  const fields2 = [
    { label: 'Class:', value: streamName ? `${className} - ${streamName}` : className, x: leftColX },
    { label: 'Term:', value: termName, x: rightColX },
  ];

  fields2.forEach((f) => {
    doc.text(`${f.label} ${f.value}`, f.x, rowY, { continued: false });
  });

  rowY += 14;
  doc.text(`Academic Year: ${yearName}`, leftColX, rowY);
  doc.y = rowY + 20;

  if (student.passportPhoto && reportCard.class?.schoolSettings?.reportCardConfig?.showPhoto !== false) {
    const photoPath = path.resolve(
      student.passportPhoto.startsWith('/') || student.passportPhoto.startsWith('C:')
        ? student.passportPhoto
        : path.join(__dirname, '..', '..', student.passportPhoto)
    );
    if (fs.existsSync(photoPath)) {
      try {
        doc.image(photoPath, 450, 80, { width: 60, height: 70 });
      } catch {
        // silently skip photo if it fails to load
      }
    }
  }
}

function addSubjectTable(doc, reportCard) {
  doc.moveDown(1);
  doc.fontSize(10).font('Helvetica-Bold').text('Academic Performance', { underline: true });
  doc.moveDown(0.5);

  const pageWidth = doc.page.width;
  const margin = 50;
  const tableTop = doc.y;
  const colWidths = [150, 60, 60, 70, 150];
  const colPositions = [];
  let currentX = margin;
  colWidths.forEach((w) => {
    colPositions.push(currentX);
    currentX += w;
  });

  const headers = ['Subject', 'Score', 'Grade', 'Grade Point', 'Remarks'];

  doc.fontSize(9).font('Helvetica-Bold');
  doc.rect(margin, tableTop, pageWidth - margin * 2, 18).fill('#f0f0f0');
  doc.fill('#000');

  headers.forEach((header, i) => {
    doc.text(header, colPositions[i] + 3, tableTop + 4, { width: colWidths[i] - 6, align: 'left' });
  });

  let rowY = tableTop + 18;
  const subjects = reportCard.subjects || [];

  doc.fontSize(9).font('Helvetica');

  subjects.forEach((subj, index) => {
    const subjectName = subj.subject?.name || (typeof subj.subject === 'string' ? subj.subject : `Subject ${index + 1}`);
    const score = subj.score !== undefined && subj.score !== null ? subj.score.toString() : '-';
    const grade = subj.grade || '-';
    const gradePoint = subj.gradePoint !== undefined && subj.gradePoint !== null ? subj.gradePoint.toString() : '-';
    const remarks = subj.remarks || subj.teacherComments || '-';

    if (index % 2 === 1) {
      doc.rect(margin, rowY, pageWidth - margin * 2, 16).fill('#f9f9f9');
      doc.fill('#000');
    }

    const rowData = [subjectName, score, grade, gradePoint, remarks];
    rowData.forEach((val, i) => {
      doc.text(val, colPositions[i] + 3, rowY + 3, { width: colWidths[i] - 6, align: i === 0 ? 'left' : 'center' });
    });

    rowY += 16;
  });

  doc.moveTo(margin, tableTop).lineTo(margin, rowY).strokeColor('#999').lineWidth(0.5).stroke();
  doc.moveTo(pageWidth - margin, tableTop).lineTo(pageWidth - margin, rowY).strokeColor('#999').lineWidth(0.5).stroke();
  doc.moveTo(margin, rowY).lineTo(pageWidth - margin, rowY).strokeColor('#999').lineWidth(0.5).stroke();

  doc.y = rowY + 15;
}

function addSummary(doc, reportCard) {
  doc.moveDown(1);
  doc.fontSize(10).font('Helvetica-Bold').text('Performance Summary', { underline: true });
  doc.moveDown(0.3);

  doc.fontSize(9).font('Helvetica');

  const total = reportCard.totalScore !== undefined ? reportCard.totalScore : 0;
  const average = reportCard.averageScore !== undefined ? reportCard.averageScore : 0;
  const grade = reportCard.grade || 'N/A';
  const position = reportCard.position !== undefined ? reportCard.position : 'N/A';
  const classSize = reportCard.classSize !== undefined ? reportCard.classSize : 'N/A';

  const items = [
    { label: 'Total Score:', value: total.toString() },
    { label: 'Average Score:', value: average.toString() },
    { label: 'Grade:', value: grade },
    { label: 'Position:', value: `${position}${classSize !== 'N/A' ? ` out of ${classSize}` : ''}` },
  ];

  const startX = 50;
  let y = doc.y;

  items.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col === 0 ? startX : 300;
    const rowY = y + row * 16;
    doc.font('Helvetica-Bold').text(item.label, x, rowY, { width: 100, continued: true });
    doc.font('Helvetica').text(` ${item.value}`, { continued: false });
  });

  doc.y = y + 40;
}

function addAttendance(doc, reportCard) {
  const attendance = reportCard.attendanceSummary;
  if (!attendance) return;

  doc.moveDown(1);
  doc.fontSize(10).font('Helvetica-Bold').text('Attendance Summary', { underline: true });
  doc.moveDown(0.3);

  doc.fontSize(9).font('Helvetica');

  const totalDays = attendance.totalDays || 0;
  const present = attendance.present || 0;
  const absent = attendance.absent || 0;
  const excused = attendance.excused || 0;
  const percentage = attendance.percentage || (totalDays > 0 ? ((present / totalDays) * 100).toFixed(2) : 0);

  const items = [
    { label: 'Total Days:', value: totalDays.toString() },
    { label: 'Present:', value: present.toString() },
    { label: 'Absent:', value: absent.toString() },
    { label: 'Excused:', value: excused.toString() },
    { label: 'Attendance %:', value: `${percentage}%` },
  ];

  let y = doc.y;
  items.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 50 + col * 150;
    const rowY = y + row * 16;
    doc.font('Helvetica-Bold').text(item.label, x, rowY, { width: 80, continued: true });
    doc.font('Helvetica').text(` ${item.value}`, { continued: false });
  });

  doc.y = y + 40;
}

function addTeacherRemarks(doc, reportCard) {
  if (!reportCard.teacherRemarks && !reportCard.headteacherRemarks) return;

  doc.moveDown(1);

  if (reportCard.teacherRemarks) {
    doc.fontSize(10).font('Helvetica-Bold').text("Teacher's Remarks:", { underline: true });
    doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica').text(reportCard.teacherRemarks, {
      align: 'left',
      lineGap: 3,
    });
    doc.moveDown(0.5);
  }

  if (reportCard.headteacherRemarks) {
    doc.fontSize(10).font('Helvetica-Bold').text("Headteacher's Remarks:", { underline: true });
    doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica').text(reportCard.headteacherRemarks, {
      align: 'left',
      lineGap: 3,
    });
    doc.moveDown(0.5);
  }
}

function addSignatures(doc, reportCard, schoolSettings) {
  if (schoolSettings.reportCardConfig?.showSignature === false) return;

  doc.moveDown(2);

  const pageWidth = doc.page.width;
  const margin = 50;
  const signatureWidth = 200;
  const leftSigX = margin;
  const rightSigX = pageWidth - margin - signatureWidth;

  const y = doc.y;

  doc.fontSize(9).font('Helvetica');

  if (reportCard.teacherRemarks) {
    doc.text('____________________________', leftSigX, y);
    doc.text("Class Teacher's Signature", leftSigX, y + 12);
  }

  doc.text('____________________________', rightSigX, y);
  doc.text("Headteacher's Signature", rightSigX, y + 12);

  if (reportCard.generatedAt) {
    const dateY = y + 35;
    const dateStr = new Date(reportCard.generatedAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    doc.text(`Date: ${dateStr}`, margin, dateY);
  }

  const stampY = y + 55;

  if (schoolSettings.reportCardConfig?.showStamp !== false) {
    doc.rect(margin + 10, stampY, 100, 60).strokeColor('#999').lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor('#999').text('School Stamp', margin + 35, stampY + 25, { align: 'center' });
    doc.fillColor('#000');
  }

  if (schoolSettings.reportCardConfig?.showQR !== false && reportCard.qrCode) {
    const qrX = pageWidth - margin - 80;
    doc.rect(qrX, stampY, 60, 60).strokeColor('#999').lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor('#999').text('QR Code', qrX + 12, stampY + 25, { align: 'center' });
    doc.fillColor('#000');
  }

  doc.y = stampY + 70;
}

function addFooter(doc) {
  const pageWidth = doc.page.width;
  const margin = 50;
  const bottomY = doc.page.height - 30;

  doc.fontSize(7).fillColor('#999').font('Helvetica');
  doc.text(
    'This is a computer-generated document.',
    margin,
    bottomY,
    { align: 'center', width: pageWidth - margin * 2 }
  );
  doc.fillColor('#000');
}

async function generateReportCard(reportCard, schoolSettings) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margins: { top: 30, bottom: 30, left: 50, right: 50 },
        bufferPages: true,
      });

      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      registerFonts(doc);

      addHeader(doc, reportCard, schoolSettings);
      addStudentInfo(doc, reportCard);
      addSubjectTable(doc, reportCard);
      addSummary(doc, reportCard);
      addAttendance(doc, reportCard);
      addTeacherRemarks(doc, reportCard);
      addSignatures(doc, reportCard, schoolSettings);
      addFooter(doc);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateReportCard };
