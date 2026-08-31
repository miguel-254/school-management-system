const XLSX = require('xlsx');

function exportToExcel(data, headers, filename) {
  const workbook = XLSX.utils.book_new();
  const sheetData = [headers, ...data];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  const colWidths = headers.map((header) => ({
    wch: Math.max(header.length * 2, 15),
  }));
  worksheet['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, filename || 'Sheet1');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

function generateAttendanceReport(data) {
  const headers = [
    'Admission No.',
    'Student Name',
    'Class',
    'Stream',
    'Total Days',
    'Present',
    'Absent',
    'Excused',
    'Sick',
    'Attendance %',
    'Status',
  ];

  const rows = data.map((record) => {
    const student = record.student || {};
    const studentName = student.fullName || `${student.firstName || ''} ${student.lastName || ''}`.trim();
    const admission = student.admissionNumber || 'N/A';
    const className = record.class?.name || record.className || 'N/A';
    const streamName = record.stream?.name || record.streamName || '';
    const totalDays = record.totalDays || record.total || 0;
    const present = record.present || 0;
    const absent = record.absent || 0;
    const excused = record.excused || 0;
    const sick = record.sick || 0;
    const percentage = record.percentage !== undefined
      ? record.percentage
      : totalDays > 0
        ? parseFloat(((present / totalDays) * 100).toFixed(2))
        : 0;
    const status = percentage >= 80 ? 'Good' : percentage >= 50 ? 'Fair' : 'Poor';

    return [
      admission,
      studentName,
      className,
      streamName,
      totalDays,
      present,
      absent,
      excused,
      sick,
      percentage,
      status,
    ];
  });

  return { headers, rows };
}

function generateMarksReport(data, subjects) {
  const subjectHeaders = subjects.map((subj) => subj.name || subj.code || subj);
  const headers = [
    'Admission No.',
    'Student Name',
    'Class',
    'Stream',
    ...subjectHeaders,
    'Total Score',
    'Average',
    'Grade',
    'Position',
  ];

  const rows = data.map((student) => {
    const studentName = student.fullName || `${student.firstName || ''} ${student.lastName || ''}`.trim();
    const admission = student.admissionNumber || 'N/A';
    const className = student.class?.name || student.className || 'N/A';
    const streamName = student.stream?.name || student.streamName || '';
    const marks = student.marks || [];

    const subjectScores = subjects.map((subj) => {
      const subjId = subj._id || subj;
      const mark = marks.find((m) => {
        const mSubj = typeof m.subject === 'object' && m.subject ? m.subject._id || m.subject.toString() : m.subject;
        const tSubj = typeof subjId === 'object' && subjId ? subjId._id || subjId.toString() : subjId;
        return mSubj && tSubj && mSubj.toString() === tSubj.toString();
      });
      return mark ? mark.score : '-';
    });

    const totalScore = student.totalScore !== undefined ? student.totalScore : '-';
    const average = student.average !== undefined ? student.average : '-';
    const grade = student.grade || '-';
    const position = student.position !== undefined ? student.position : '-';

    return [
      admission,
      studentName,
      className,
      streamName,
      ...subjectScores,
      totalScore,
      average,
      grade,
      position,
    ];
  });

  return { headers, rows };
}

function generateStudentList(students) {
  const headers = [
    'Admission No.',
    'First Name',
    'Last Name',
    'Full Name',
    'Gender',
    'Date of Birth',
    'Class',
    'Stream',
    'Guardian Name',
    'Guardian Phone',
    'Guardian Email',
    'Status',
    'Enrollment Date',
  ];

  const rows = students.map((student) => {
    const guardian = student.guardianInfo || {};
    const className = student.class?.name || student.className || 'N/A';
    const streamName = student.stream?.name || student.streamName || '';
    const dob = student.dateOfBirth
      ? new Date(student.dateOfBirth).toISOString().split('T')[0]
      : '';
    const enrollmentDate = student.enrollmentDate
      ? new Date(student.enrollmentDate).toISOString().split('T')[0]
      : '';

    return [
      student.admissionNumber || 'N/A',
      student.firstName || '',
      student.lastName || '',
      student.fullName || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
      student.gender || '',
      dob,
      className,
      streamName,
      guardian.name || '',
      guardian.phone || '',
      guardian.email || '',
      student.status || 'active',
      enrollmentDate,
    ];
  });

  return { headers, rows };
}

module.exports = {
  exportToExcel,
  generateAttendanceReport,
  generateMarksReport,
  generateStudentList,
};
