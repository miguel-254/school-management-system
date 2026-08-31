const ReportCard = require('../models/ReportCard');
const Student = require('../models/Student');
const Mark = require('../models/Mark');
const Attendance = require('../models/Attendance');
const Assessment = require('../models/Assessment');
const SchoolSetting = require('../models/SchoolSetting');
const GradeScale = require('../models/GradeScale');
const AcademicYear = require('../models/AcademicYear');
const Term = require('../models/Term');
const gradingEngine = require('../utils/gradingEngine');
const { generateReportCard: generatePDF } = require('../utils/pdfGenerator');
const { exportToExcel, generateMarksReport } = require('../utils/excelExporter');
const AuditLog = require('../models/AuditLog');
const QRCode = require('qrcode');
const TeacherAssignment = require('../models/TeacherAssignment');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const { sendNotificationToMany } = require('../utils/notificationService');

exports.getReportCards = async (req, res) => {
  try {
    const { class: classId, stream, term, academicYear, status, page = 1, limit = 50 } = req.query;

    const query = {};
    if (classId) query.class = classId;
    if (stream) query.stream = stream;
    if (term) query.term = term;
    if (academicYear) query.academicYear = academicYear;
    if (status === 'published') query.isPublished = true;
    else if (status === 'draft') query.isPublished = false;

    if (req.teacherClassIds && !classId) {
      query.class = { $in: req.teacherClassIds };
    }

    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope && !stream) {
      const hasUnrestricted = Object.values(req.teacherScope.classMap).some(c => c.allStreams);
      if (!hasUnrestricted) {
        query.stream = { $in: req.teacherStreamIds };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reportCards, total] = await Promise.all([
      ReportCard.find(query)
        .populate('student', 'firstName lastName admissionNumber')
        .populate('class', 'name')
        .populate('stream', 'name')
        .populate('academicYear', 'name year')
        .populate('term', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ReportCard.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        reportCards,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

async function buildReportCardData(studentId, yearId, termId, userId) {
  const student = await Student.findById(studentId).populate('class stream');
  if (!student) throw new Error('Student not found');
  if (!student.class) throw new Error('Student has no class assigned');

  const academicYear = await AcademicYear.findById(yearId);
  const term = await Term.findById(termId);
  if (!academicYear || !term) throw new Error('Academic year or term not found');

  const classId = student.class._id || student.class;

  const marks = await Mark.find({
    student: studentId,
    academicYear: yearId,
    term: termId,
  }).populate('subject', 'name code')
    .populate('assessment', 'name type weight');

  const gradeScales = await GradeScale.find({ isActive: true, system: 'percentage' });

  const subjectsMap = {};
  for (const mark of marks) {
    const subId = mark.subject?._id?.toString() || mark.subject?.toString();
    if (!subjectsMap[subId]) {
      subjectsMap[subId] = {
        subject: mark.subject,
        scores: [],
        total: 0,
      };
    }
    subjectsMap[subId].scores.push(mark);
    subjectsMap[subId].total += mark.score || 0;
  }

  const subjectResults = Object.values(subjectsMap).map((s) => {
    const average = s.scores.length > 0 ? parseFloat((s.total / s.scores.length).toFixed(2)) : 0;
    const gradeResult = gradingEngine.calculateGrade(average, gradeScales);
    return {
      subject: s.subject._id,
      name: s.subject.name,
      score: average,
      grade: gradeResult.grade,
      gradePoint: gradeResult.gradePoint,
      remarks: gradeResult.remarks,
    };
  });

  const totalScore = subjectResults.reduce((sum, s) => sum + (s.score || 0), 0);
  const averageScore = subjectResults.length > 0 ? parseFloat((totalScore / subjectResults.length).toFixed(2)) : 0;
  const overallGrade = gradingEngine.calculateGrade(averageScore, gradeScales);

  const attendanceRecords = await Attendance.find({
    student: studentId,
    academicYear: yearId,
    term: termId,
  });

  const totalDays = attendanceRecords.length;
  const present = attendanceRecords.filter((a) => a.status === 'present').length;
  const absent = attendanceRecords.filter((a) => a.status === 'absent').length;
  const excused = attendanceRecords.filter((a) => a.status === 'excused' || a.status === 'sick').length;
  const attendancePercentage = gradingEngine.calculateAttendancePercentage(totalDays, present);

  const allStudents = await Student.find({ class: classId, status: 'active' });
  const classSize = allStudents.length;

  let position = 0;
  if (classSize > 0) {
    const allStudentMarks = await Mark.find({
      academicYear: yearId,
      term: termId,
      class: classId,
    });

    const studentAverages = {};
    for (const mark of allStudentMarks) {
      const sid = mark.student.toString();
      if (!studentAverages[sid]) studentAverages[sid] = { total: 0, count: 0 };
      studentAverages[sid].total += mark.score || 0;
      studentAverages[sid].count++;
    }

    const ranked = Object.entries(studentAverages)
      .map(([sid, data]) => ({
        student: sid,
        average: data.count > 0 ? data.total / data.count : 0,
      }))
      .sort((a, b) => b.average - a.average);

    const pos = ranked.findIndex((r) => r.student === studentId.toString());
    position = pos >= 0 ? pos + 1 : 0;
  }

  const reportCard = await ReportCard.findOneAndUpdate(
    { student: studentId, academicYear: yearId, term: termId },
    {
      $set: {
        class: classId,
        stream: student.stream?._id,
        subjects: subjectResults,
        totalScore: parseFloat(totalScore.toFixed(2)),
        averageScore,
        grade: overallGrade.grade,
        gradePoint: overallGrade.gradePoint,
        position,
        classSize,
        attendanceSummary: {
          totalDays,
          present,
          absent,
          excused,
          percentage: attendancePercentage,
        },
        generatedBy: userId,
      },
      $setOnInsert: { student: studentId, academicYear: yearId, term: termId },
    },
    { new: true, upsert: true }
  );

  await AuditLog.create({
    user: userId,
    action: 'GENERATE_REPORT_CARD',
    resource: 'ReportCard',
    resourceId: reportCard._id,
    details: { student: studentId, academicYear: yearId, term: termId },
  });

  const populated = await ReportCard.findById(reportCard._id)
    .populate('student', 'firstName lastName admissionNumber')
    .populate('class', 'name')
    .populate('stream', 'name')
    .populate('academicYear', 'name year')
    .populate('term', 'name');

  return populated;
}

exports.generateReportCard = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.body.studentId || req.body.student;
    const yearId = req.body.academicYearId || req.body.academicYear;
    const termId = req.body.termId || req.body.term;

    if (!studentId || !yearId || !termId) {
      return res.status(400).json({ success: false, message: 'studentId, academicYearId and termId are required' });
    }

    const populated = await buildReportCardData(studentId, yearId, termId, req.user._id);

    res.status(201).json({
      success: true,
      data: populated,
      message: 'Report card generated successfully',
    });
  } catch (error) {
    if (error.message === 'Student not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === 'Student has no class assigned' || error.message === 'Academic year or term not found') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bulkGenerateReportCards = async (req, res) => {
  try {
    let { studentIds, classId, academicYear: yearId, academicYearId, term: termId, termId: termIdAlt } = req.body;
    yearId = yearId || academicYearId;
    termId = termId || termIdAlt;

    if (!yearId || !termId) {
      return res.status(400).json({ success: false, message: 'academicYearId and termId are required' });
    }

    if (!studentIds || !studentIds.length) {
      if (!classId) {
        return res.status(400).json({ success: false, message: 'studentIds or classId is required' });
      }
      const students = await Student.find({ class: classId, status: 'active' }).select('_id');
      studentIds = students.map((s) => s._id);
    }

    if (!studentIds.length) {
      return res.status(400).json({ success: false, message: 'No active students found in the selected class' });
    }

    const results = { generated: 0, skipped: 0, errors: [] };

    for (const studentId of studentIds) {
      try {
        await buildReportCardData(studentId, yearId, termId, req.user._id);
        results.generated++;
      } catch (err) {
        results.skipped++;
        results.errors.push({ student: studentId, reason: err.message });
      }
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'BULK_GENERATE_REPORT_CARDS',
      resource: 'ReportCard',
      details: { academicYear: yearId, term: termId, generated: results.generated, skipped: results.skipped },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(201).json({
      success: true,
      data: results,
      message: `Generated ${results.generated} report cards, skipped ${results.skipped}`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getReportCard = async (req, res) => {
  try {
    const reportCard = await ReportCard.findById(req.params.id)
      .populate('student', 'firstName lastName admissionNumber passportPhoto guardianInfo')
      .populate('class', 'name')
      .populate('stream', 'name')
      .populate('academicYear', 'name year')
      .populate('term', 'name')
      .populate('subjects.subject', 'name code')
      .populate('generatedBy', 'firstName lastName');

    if (!reportCard) {
      return res.status(404).json({ success: false, message: 'Report card not found' });
    }

    res.json({ success: true, data: reportCard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.publishReportCards = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'ids array is required' });
    }

    const result = await ReportCard.updateMany(
      { _id: { $in: ids } },
      { $set: { isPublished: true } }
    );

    const cards = await ReportCard.find({ _id: { $in: ids } }).select('class term academicYear');
    const classIds = [...new Set(cards.map((c) => c.class?.toString()).filter(Boolean))];

    if (classIds.length > 0) {
      const [assignments, classDocs, term] = await Promise.all([
        TeacherAssignment.find({ class: { $in: classIds }, isClassTeacher: true }).populate('teacher', 'user'),
        Class.find({ _id: { $in: classIds } }).select('classTeacher'),
        cards[0]?.term ? Term.findById(cards[0].term).select('name') : null,
      ]);

      const teacherUserIds = assignments
        .map((a) => a.teacher?.user?.toString())
        .filter(Boolean);

      const classTeachers = await Teacher.find({
        _id: { $in: classDocs.map((c) => c.classTeacher).filter(Boolean) },
      }).select('user');

      const recipients = [
        ...teacherUserIds,
        ...classTeachers.map((t) => t.user?.toString()),
      ].filter(Boolean);

      await sendNotificationToMany({
        recipients,
        type: 'result',
        title: 'Report cards published',
        message: `${result.modifiedCount} report card(s) published${term?.name ? ` for ${term.name}` : ''}`,
        link: '/report-cards',
        sentBy: req.user._id,
      });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'PUBLISH_REPORT_CARDS',
      resource: 'ReportCard',
      details: { count: ids.length },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: { modifiedCount: result.modifiedCount },
      message: `${result.modifiedCount} report cards published`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStudentReportCards = async (req, res) => {
  try {
    const reportCards = await ReportCard.find({ student: req.params.id })
      .populate('academicYear', 'name year')
      .populate('term', 'name')
      .populate('class', 'name')
      .populate('stream', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: reportCards });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.printReportCard = async (req, res) => {
  try {
    const reportCard = await ReportCard.findById(req.params.id)
      .populate('student', 'firstName lastName admissionNumber passportPhoto guardianInfo dateOfBirth gender')
      .populate('class', 'name')
      .populate('stream', 'name')
      .populate('academicYear', 'name year')
      .populate('term', 'name')
      .populate('subjects.subject', 'name code');

    if (!reportCard) {
      return res.status(404).json({ success: false, message: 'Report card not found' });
    }

    const schoolSettings = await SchoolSetting.findOne();

    const doc = { ...reportCard.toJSON() };
    if (schoolSettings) {
      doc.class.schoolSettings = schoolSettings;
    }

    const pdfBuffer = await generatePDF(doc, schoolSettings || {});

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report_card_${reportCard.student?.admissionNumber || req.params.id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportReportCards = async (req, res) => {
  try {
    const { class: classId, term, academicYear } = req.query;

    const query = {};
    if (classId) query.class = classId;
    if (term) query.term = term;
    if (academicYear) query.academicYear = academicYear;

    if (req.teacherClassIds && !classId) {
      query.class = { $in: req.teacherClassIds };
    }

    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      const hasUnrestricted = Object.values(req.teacherScope.classMap).some(c => c.allStreams);
      if (!hasUnrestricted) {
        query.stream = { $in: req.teacherStreamIds };
      }
    }

    const reportCards = await ReportCard.find(query)
      .populate('student', 'firstName lastName admissionNumber')
      .populate('class', 'name')
      .populate('stream', 'name')
      .populate('subjects.subject', 'name code');

    const data = reportCards.map((rc) => {
      const student = rc.student || {};
      const row = {
        'Admission No.': student.admissionNumber || 'N/A',
        'Student Name': `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        'Class': rc.class?.name || '',
        'Average': rc.averageScore || 0,
        'Grade': rc.grade || '',
        'Position': rc.position || '',
        'Status': rc.isPublished ? 'Published' : 'Draft',
      };
      for (const subj of rc.subjects || []) {
        row[subj.subject?.name || 'Subject'] = subj.score || '-';
      }
      return row;
    });

    const headers = Object.keys(data[0] || {});
    const rows = data.map((r) => headers.map((h) => r[h]));

    const buffer = exportToExcel(rows, headers, 'ReportCards');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=report_cards.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateQRCode = async (req, res) => {
  try {
    const reportCard = await ReportCard.findById(req.params.id);
    if (!reportCard) {
      return res.status(404).json({ success: false, message: 'Report card not found' });
    }

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify/report-card/${reportCard._id}`;
    const qrCode = await QRCode.toDataURL(verificationUrl);

    reportCard.qrCode = qrCode;
    await reportCard.save();

    res.json({
      success: true,
      data: { qrCode },
      message: 'QR code generated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};