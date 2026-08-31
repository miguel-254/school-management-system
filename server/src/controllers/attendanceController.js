const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const AuditLog = require('../models/AuditLog');
const gradingEngine = require('../utils/gradingEngine');

function extractQueryClassIds(query) {
  if (!query.class) return [];
  if (query.class.$in) return query.class.$in.map(id => id.toString());
  if (query.class.$eq) return [query.class.$eq.toString()];
  if (query.class._id) return [query.class._id.toString()];
  if (typeof query.class === 'string' || typeof query.class === 'object') return [query.class.toString()];
  return [];
}

function applyTeacherScope(req, query) {
  if (req.teacherClassIds) {
    query.class = query.class || {};
    if (query.class.$in) {
      const userFiltered = query.class.$in.filter(id => req.teacherClassIds.includes(id.toString()));
      query.class.$in = userFiltered;
    } else if (query.class.$eq) {
      if (!req.teacherClassIds.includes(query.class.$eq.toString())) query.class = { $in: req.teacherClassIds };
    } else if (query.class._id || typeof query.class === 'string') {
      const id = (query.class._id || query.class).toString();
      if (!req.teacherClassIds.includes(id)) query.class = { $in: req.teacherClassIds };
    } else {
      query.class = { $in: req.teacherClassIds };
    }
  }

  if (req.teacherSubjectIds && req.teacherSubjectIds.length > 0 && !query.subject) {
    const classMap = (req.teacherScope && req.teacherScope.classMap) || {};
    const targetClasses = extractQueryClassIds(query);
    const scopeClasses = targetClasses.length > 0 ? targetClasses : (req.teacherClassIds || []);

    const restricted = scopeClasses.filter(cid => classMap[cid] && !classMap[cid].allSubjects);
    const unrestricted = scopeClasses.filter(cid => classMap[cid] && classMap[cid].allSubjects);

    const restrictedSubjectIds = [];
    for (const cid of restricted) {
      for (const sid of (classMap[cid].subjectIds || [])) {
        if (!restrictedSubjectIds.includes(sid)) restrictedSubjectIds.push(sid);
      }
    }

    if (restricted.length > 0 && restrictedSubjectIds.length > 0) {
      if (unrestricted.length > 0) {
        query.$or = [
          { class: { $in: unrestricted } },
          { class: { $in: restricted }, subject: { $in: restrictedSubjectIds } },
        ];
      } else {
        query.subject = { $in: restrictedSubjectIds };
      }
    }
  }
  return query;
}

async function applyStreamScope(req, query) {
  if (!req.teacherStreamIds || req.teacherStreamIds.length === 0) return query;
  if (!req.teacherScope) return query;

  const classMap = req.teacherScope.classMap || {};
  const targetClasses = [];

  if (query.class) {
    if (query.class.$in) {
      for (const id of query.class.$in) targetClasses.push(id.toString());
    } else if (typeof query.class === 'object' && query.class._id) {
      targetClasses.push(query.class._id.toString());
    } else if (typeof query.class === 'string' || typeof query.class === 'object') {
      targetClasses.push(query.class.toString());
    }
  }

  const streamRestricted = targetClasses.length > 0
    ? targetClasses.some(cid => classMap[cid] && !classMap[cid].allStreams)
    : Object.values(classMap).some(c => !c.allStreams);

  if (!streamRestricted) return query;

  const studentIds = await Student.find({
    class: targetClasses.length > 0 ? { $in: targetClasses } : { $in: req.teacherClassIds },
    stream: { $in: req.teacherStreamIds },
  }).distinct('_id');

  if (studentIds.length > 0) {
    if (query.student) {
      const origId = typeof query.student === 'object' && query.student._id
        ? query.student._id.toString()
        : query.student.toString();
      const allowed = studentIds.some(sid => sid.toString() === origId);
      if (!allowed) query.student = { $in: [] };
    } else {
      query.student = { $in: studentIds };
    }
  }
  return query;
}

async function verifyAttendanceStreamAccess(req, classId, streamId) {
  if (!req.teacherScope) return true;
  if (!classId) return false;
  const classEntry = req.teacherScope.classMap[classId.toString()];
  if (!classEntry) return false;
  if (classEntry.allStreams) return true;
  if (!streamId) return false;
  return classEntry.streamIds.includes(streamId.toString());
}

async function checkAttendanceAlreadyTaken(classId, date) {
  const recordDate = new Date(date);
  recordDate.setHours(0, 0, 0, 0);
  const existing = await Attendance.findOne({ class: classId, date: recordDate }).limit(1);
  return existing;
}

exports.getAttendance = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      date,
      startDate,
      endDate,
      class: classId,
      subject,
      student: studentId,
      status,
      academicYear,
      term,
      sort = '-date',
    } = req.query;

    const query = {};

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      query.date = { $gte: d, $lt: next };
    }
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }
    if (classId) query.class = classId;
    if (subject) query.subject = subject;
    if (studentId) query.student = studentId;
    if (status) query.status = status;
    if (academicYear) query.academicYear = academicYear;
    if (term) query.term = term;

    applyTeacherScope(req, query);
    await applyStreamScope(req, query);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [records, total] = await Promise.all([
      Attendance.find(query)
        .populate('student', 'firstName lastName admissionNumber')
        .populate('class', 'name')
        .populate('subject', 'name code')
        .populate('markedBy', 'firstName lastName')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Attendance.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        records,
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

exports.markAttendance = async (req, res) => {
  try {
    const { student: studentId, class: classId, subject, date, status, remarks, timeIn, timeOut, academicYear, term } = req.body;

    if (!studentId || !classId || !date || !status) {
      return res.status(400).json({ success: false, message: 'student, class, date and status are required' });
    }

    if (req.teacherClassIds && !req.teacherClassIds.includes(classId)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this class' });
    }

    const student = await Student.findById(studentId).select('stream class');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const hasStreamAccess = await verifyAttendanceStreamAccess(req, classId, student.stream);
    if (!hasStreamAccess) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this student\'s stream' });
    }

    const validStatuses = ['present', 'absent', 'excused', 'sick', 'schoolActivity'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const recordDate = new Date(date);
    recordDate.setHours(0, 0, 0, 0);

    const existingForStudent = await Attendance.findOne({
      student: studentId,
      class: classId,
      date: recordDate,
    });

    if (existingForStudent) {
      return res.status(409).json({
        success: false,
        message: 'Attendance has already been recorded for this student in this class on this date.',
        data: { existing: existingForStudent },
      });
    }

    const record = await Attendance.create({
      student: studentId,
      class: classId,
      subject,
      date: recordDate,
      status,
      remarks,
      timeIn,
      timeOut,
      academicYear,
      term,
      markedBy: req.user._id,
    });

    const populated = await Attendance.findById(record._id)
      .populate('student', 'firstName lastName admissionNumber')
      .populate('class', 'name')
      .populate('subject', 'name code');

    res.status(201).json({
      success: true,
      data: populated,
      message: 'Attendance marked successfully',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Attendance already marked for this student on this date' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bulkMarkAttendance = async (req, res) => {
  try {
    const { records, class: classId, date, academicYear, term, subject: subjectId } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'records array is required' });
    }

    if (!classId || !date) {
      return res.status(400).json({ success: false, message: 'class and date are required' });
    }

    if (req.teacherClassIds && !req.teacherClassIds.includes(classId)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this class' });
    }

    const recordDate = new Date(date);
    recordDate.setHours(0, 0, 0, 0);

    const existingRecords = await Attendance.find({
      class: classId,
      date: recordDate,
      student: { $in: records.map(r => r.student).filter(Boolean) },
    }).select('student');

    const existingStudentIds = new Set(existingRecords.map(r => r.student.toString()));

    const studentIds = records.map(r => r.student).filter(Boolean);
    const students = await Student.find({ _id: { $in: studentIds } }).select('_id stream class');

    const studentClassMap = {};
    const studentStreamMap = {};
    for (const s of students) {
      studentClassMap[s._id.toString()] = s.class ? s.class.toString() : null;
      studentStreamMap[s._id.toString()] = s.stream ? s.stream.toString() : null;
    }

    const results = { created: 0, skipped: 0, errors: [] };

    for (const record of records) {
      try {
        const { student, status, remarks, subject } = record;

        if (!student || !status) {
          results.skipped++;
          results.errors.push({ student, reason: 'Missing student or status' });
          continue;
        }

        if (studentClassMap[student] !== classId) {
          results.skipped++;
          results.errors.push({ student, reason: 'Student is not in the selected class' });
          continue;
        }

        const hasStreamAccess = await verifyAttendanceStreamAccess(req, classId, studentStreamMap[student]);
        if (!hasStreamAccess) {
          results.skipped++;
          results.errors.push({ student, reason: 'You are not assigned to this student\'s stream' });
          continue;
        }

        const existing = await Attendance.findOne({
          student,
          class: classId,
          date: recordDate,
        });

        if (existing) {
          results.skipped++;
          results.errors.push({ student, reason: 'Attendance already marked for this student on this date' });
          continue;
        } else {
          await Attendance.create({
            student,
            class: classId,
            subject: subject || subjectId,
            date: recordDate,
            status,
            remarks,
            academicYear,
            term,
            markedBy: req.user._id,
          });
          results.created++;
        }
      } catch (err) {
        results.skipped++;
        results.errors.push({ student: record.student, reason: err.message });
      }
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'BULK_MARK_ATTENDANCE',
      resource: 'Attendance',
      details: { class: classId, date, created: results.created, skipped: results.skipped },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: results,
      message: `Attendance marked for ${results.created} students`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAttendance = async (req, res) => {
  try {
    const { status, remarks, timeIn, timeOut } = req.body;

    const record = await Attendance.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    if (req.teacherClassIds && !req.teacherClassIds.includes(record.class.toString())) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this record\'s class' });
    }

    const recordStudent = await Student.findById(record.student).select('stream');
    if (recordStudent) {
      const hasStreamAccess = await verifyAttendanceStreamAccess(req, record.class.toString(), recordStudent.stream);
      if (!hasStreamAccess) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this student\'s stream' });
      }
    }

    const allowedWindow = 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(record.date).getTime() > allowedWindow) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update attendance older than 24 hours',
      });
    }

    if (status) record.status = status;
    if (remarks !== undefined) record.remarks = remarks;
    if (timeIn) record.timeIn = timeIn;
    if (timeOut) record.timeOut = timeOut;
    await record.save();

    const populated = await Attendance.findById(record._id)
      .populate('student', 'firstName lastName admissionNumber')
      .populate('class', 'name')
      .populate('subject', 'name code');

    res.json({
      success: true,
      data: populated,
      message: 'Attendance updated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAttendanceReport = async (req, res) => {
  try {
    const { class: classId, subject, startDate, endDate, academicYear, term } = req.query;

    const match = {};
    if (classId) match.class = new (require('mongoose').Types.ObjectId)(classId);
    if (subject) match.subject = new (require('mongoose').Types.ObjectId)(subject);
    if (academicYear) match.academicYear = new (require('mongoose').Types.ObjectId)(academicYear);
    if (term) match.term = new (require('mongoose').Types.ObjectId)(term);
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.date.$lte = end;
      }
    }

    if (req.teacherClassIds) {
      const teacherClassObjectIds = req.teacherClassIds.map(id => new (require('mongoose').Types.ObjectId)(id));
      if (classId) {
        if (!req.teacherClassIds.includes(classId)) {
          return res.json({ success: true, data: [] });
        }
      } else {
        match.class = { $in: teacherClassObjectIds };
      }
    }
    if (req.teacherSubjectIds && req.teacherSubjectIds.length > 0 && !subject && req.teacherScope) {
      const classMap = req.teacherScope.classMap || {};
      const queryClasses = classId ? [classId] : (req.teacherClassIds || []);
      const restricted = queryClasses.filter(cid => classMap[cid] && !classMap[cid].allSubjects);
      const unrestricted = queryClasses.filter(cid => classMap[cid] && classMap[cid].allSubjects);
      const restrictedSubjectIds = [];
      for (const cid of restricted) {
        for (const sid of (classMap[cid].subjectIds || [])) {
          if (!restrictedSubjectIds.includes(sid)) restrictedSubjectIds.push(sid);
        }
      }
      if (restricted.length > 0 && restrictedSubjectIds.length > 0) {
        const toObjId = id => new (require('mongoose').Types.ObjectId)(id);
        if (unrestricted.length > 0) {
          match.$or = [
            { class: { $in: unrestricted.map(toObjId) } },
            { class: { $in: restricted.map(toObjId) }, subject: { $in: restrictedSubjectIds.map(toObjId) } },
          ];
        } else {
          match.subject = { $in: restrictedSubjectIds.map(toObjId) };
        }
      }
    }

    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      const classMap = req.teacherScope.classMap || {};
      const queryClasses = classId ? [classId] : (req.teacherClassIds || []);
      const needsStreamFilter = queryClasses.some(cid => classMap[cid] && !classMap[cid].allStreams)
        || Object.values(classMap).some(c => !c.allStreams);
      if (needsStreamFilter) {
        const streamStudentIds = await Student.find({
          class: { $in: queryClasses.map(id => new (require('mongoose').Types.ObjectId)(id)) },
          stream: { $in: req.teacherStreamIds.map(id => new (require('mongoose').Types.ObjectId)(id)) },
        }).distinct('_id');
        if (streamStudentIds.length > 0) {
          match.student = { $in: streamStudentIds };
        } else {
          return res.json({ success: true, data: [] });
        }
      }
    }

    const report = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$student',
          totalDays: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          excused: { $sum: { $cond: [{ $eq: ['$status', 'excused'] }, 1, 0] } },
          sick: { $sum: { $cond: [{ $eq: ['$status', 'sick'] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: '$student' },
      {
        $lookup: {
          from: 'classes',
          localField: 'student.class',
          foreignField: '_id',
          as: 'class',
        },
      },
      { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          student: { _id: 1, firstName: 1, lastName: 1, admissionNumber: 1 },
          className: '$class.name',
          totalDays: 1,
          present: 1,
          absent: 1,
          excused: 1,
          sick: 1,
          percentage: {
            $cond: [
              { $gt: ['$totalDays', 0] },
              { $round: [{ $multiply: [{ $divide: ['$present', '$totalDays'] }, 100] }, 2] },
              0,
            ],
          },
        },
      },
      { $sort: { percentage: -1 } },
    ]);

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStudentAttendance = async (req, res) => {
  try {
    const { startDate, endDate, academicYear, term, page = 1, limit = 50 } = req.query;

    const query = { student: req.params.id };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }
    if (academicYear) query.academicYear = academicYear;
    if (term) query.term = term;

    applyTeacherScope(req, query);
    await applyStreamScope(req, query);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [records, total] = await Promise.all([
      Attendance.find(query)
        .populate('class', 'name')
        .populate('subject', 'name code')
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Attendance.countDocuments(query),
    ]);

    const statsMatch = { student: query.student };
    if (query.class) statsMatch.class = query.class;

    const stats = await Attendance.aggregate([
      { $match: statsMatch },
      {
        $group: {
          _id: null,
          totalDays: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          excused: { $sum: { $cond: [{ $eq: ['$status', 'excused'] }, 1, 0] } },
          sick: { $sum: { $cond: [{ $eq: ['$status', 'sick'] }, 1, 0] } },
        },
      },
    ]);

    const summary = stats[0] || { totalDays: 0, present: 0, absent: 0, excused: 0, sick: 0 };
    summary.percentage = gradingEngine.calculateAttendancePercentage(summary.totalDays, summary.present);

    res.json({
      success: true,
      data: {
        records,
        summary,
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

exports.getClassAttendance = async (req, res) => {
  try {
    const { date, startDate, endDate, academicYear, term } = req.query;

    const classId = req.params.classId;
    if (req.teacherClassIds && !req.teacherClassIds.includes(classId)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this class' });
    }
    const match = { class: new (require('mongoose').Types.ObjectId)(classId) };

    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      const classEntry = req.teacherScope.classMap[classId];
      if (classEntry && !classEntry.allStreams) {
        const streamStudentIds = await Student.find({
          class: new (require('mongoose').Types.ObjectId)(classId),
          stream: { $in: req.teacherStreamIds.map(id => new (require('mongoose').Types.ObjectId)(id)) },
        }).distinct('_id');
        if (streamStudentIds.length > 0) {
          match.student = { $in: streamStudentIds };
        } else {
          return res.json({ success: true, data: { summary: { totalRecords: 0, present: 0, absent: 0, excused: 0, sick: 0, percentage: 0 }, dailyStats: [] } });
        }
      }
    }
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      match.date = { $gte: d, $lt: next };
    }
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.date.$lte = end;
      }
    }
    if (academicYear) match.academicYear = new (require('mongoose').Types.ObjectId)(academicYear);
    if (term) match.term = new (require('mongoose').Types.ObjectId)(term);

    const summary = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          excused: { $sum: { $cond: [{ $eq: ['$status', 'excused'] }, 1, 0] } },
          sick: { $sum: { $cond: [{ $eq: ['$status', 'sick'] }, 1, 0] } },
        },
      },
    ]);

    const stats = summary[0] || { totalRecords: 0, present: 0, absent: 0, excused: 0, sick: 0 };
    stats.percentage = gradingEngine.calculateAttendancePercentage(stats.totalRecords, stats.present);

    const dailyStats = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        summary: stats,
        dailyStats,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAttendanceAnalytics = async (req, res) => {
  try {
    const { class: classId, startDate, endDate, academicYear } = req.query;

    const match = {};
    if (classId) match.class = new (require('mongoose').Types.ObjectId)(classId);
    if (academicYear) match.academicYear = new (require('mongoose').Types.ObjectId)(academicYear);
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.date.$lte = end;
      }
    }

    const weeklyTrend = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-W%V', date: '$date' } },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const statusDistribution = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const monthlyTrend = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        weeklyTrend,
        monthlyTrend,
        statusDistribution,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};