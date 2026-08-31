const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const Mark = require('../models/Mark');
const Assessment = require('../models/Assessment');
const AcademicYear = require('../models/AcademicYear');
const Term = require('../models/Term');
const TeacherAssignment = require('../models/TeacherAssignment');

exports.getHeadteacherDashboard = async (req, res) => {
  try {
    const currentYear = await AcademicYear.findOne({ isCurrent: true });
    const currentTerm = currentYear
      ? await Term.findOne({ academicYear: currentYear._id, isCurrent: true })
      : null;

    const deactivatedUserIds = await User.find({ isActive: false }).distinct('_id');
    const activeTeacherQuery = deactivatedUserIds.length > 0 ? { user: { $nin: deactivatedUserIds } } : {};

    const [totalStudents, totalTeachers, totalClasses, activeStudents] = await Promise.all([
      Student.countDocuments(),
      Teacher.countDocuments(activeTeacherQuery),
      Class.countDocuments(),
      Student.countDocuments({ status: 'active' }),
    ]);

    let attendancePercentage = 0;
    let totalAttendance = 0;
    let presentAttendance = 0;

    const attendanceMatch = currentTerm ? { term: currentTerm._id } : {};
    const attendanceStats = await Attendance.aggregate([
      { $match: attendanceMatch },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        },
      },
    ]);

    if (attendanceStats.length > 0) {
      totalAttendance = attendanceStats[0].total;
      presentAttendance = attendanceStats[0].present;
      attendancePercentage = totalAttendance > 0
        ? parseFloat(((presentAttendance / totalAttendance) * 100).toFixed(2))
        : 0;
    }

    const attendanceByClass = await Attendance.aggregate([
      { $match: currentTerm ? { term: currentTerm._id } : {} },
      {
        $group: {
          _id: '$class',
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        },
      },
      {
        $lookup: { from: 'classes', localField: '_id', foreignField: '_id', as: 'class' },
      },
      { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          className: '$class.name',
          total: 1,
          present: 1,
          percentage: {
            $cond: [{ $gt: ['$total', 0] }, { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 2] }, 0],
          },
        },
      },
      { $sort: { className: 1 } },
    ]);

    const recentAssessments = await Assessment.find({ status: { $ne: 'draft' } })
      .populate('class', 'name')
      .populate('subject', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    let overallAverage = 0;
    if (currentTerm) {
      const markStats = await Mark.aggregate([
        { $match: { term: currentTerm._id } },
        { $group: { _id: null, averageScore: { $avg: '$score' }, totalMarks: { $sum: 1 } } },
      ]);

      if (markStats.length > 0) {
        overallAverage = parseFloat(markStats[0].averageScore.toFixed(2));
      }
    }

    const performanceByClass = await Mark.aggregate([
      { $match: currentTerm ? { term: currentTerm._id } : {} },
      {
        $group: {
          _id: '$class',
          averageScore: { $avg: '$score' },
          totalMarks: { $sum: 1 },
        },
      },
      {
        $lookup: { from: 'classes', localField: '_id', foreignField: '_id', as: 'class' },
      },
      { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          className: '$class.name',
          averageScore: { $round: ['$averageScore', 2] },
          totalMarks: 1,
        },
      },
      { $sort: { className: 1 } },
    ]);

    const studentsByClass = await Student.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$class', count: { $sum: 1 } } },
      {
        $lookup: { from: 'classes', localField: '_id', foreignField: '_id', as: 'class' },
      },
      { $unwind: '$class' },
      { $project: { className: '$class.name', count: 1 } },
      { $sort: { className: 1 } },
    ]);

    const genderDistribution = await Student.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$gender', count: { $sum: 1 } } },
    ]);

    const performanceDistribution = await Mark.aggregate([
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $gte: ['$score', 80] }, then: 'Excellent (80-100)' },
                { case: { $gte: ['$score', 70] }, then: 'Good (70-79)' },
                { case: { $gte: ['$score', 60] }, then: 'Fair (60-69)' },
                { case: { $gte: ['$score', 50] }, then: 'Average (50-59)' },
                { case: { $gte: ['$score', 40] }, then: 'Below Average (40-49)' },
              ],
              default: 'Poor (0-39)',
            },
          },
          count: { $sum: 1 },
          average: { $avg: '$score' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const genderRatio = genderDistribution.reduce((acc, g) => {
      acc[g._id || 'other'] = g.count;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        overview: {
          totalStudents,
          activeStudents,
          totalTeachers,
          totalClasses,
          attendancePercentage,
          overallAverage,
          currentAcademicYear: currentYear?.name,
          currentTerm: currentTerm?.name,
        },
        studentsByClass,
        genderRatio,
        attendanceByClass,
        performanceByClass,
        performanceDistribution,
        recentAssessments,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getClassTeacherDashboard = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user._id });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    const currentYear = await AcademicYear.findOne({ isCurrent: true });
    const currentTerm = currentYear
      ? await Term.findOne({ academicYear: currentYear._id, isCurrent: true })
      : null;

    const [assignments, classTeacherClasses] = await Promise.all([
      TeacherAssignment.find({
        teacher: teacher._id,
        isClassTeacher: true,
      })
        .populate('class', 'name code')
        .populate('subject', 'name')
        .populate('stream', 'name'),
      Class.find({ classTeacher: teacher._id }).distinct('_id'),
    ]);

    const classIds = [...new Set([
      ...assignments.map((a) => a.class?._id?.toString()).filter(Boolean),
      ...classTeacherClasses.map((id) => id.toString()),
    ])];

    const classMap = req.teacherScope && req.teacherScope.classMap ? req.teacherScope.classMap : {};
    const hasAnyStreamRestriction = req.teacherStreamIds && req.teacherStreamIds.length > 0;

    const streamRestrictedClasses = classIds.filter(cid => {
      const entry = classMap[cid];
      return entry && !entry.allStreams && entry.streamIds.length > 0;
    });

    let streamStudentIds = null;
    if (hasAnyStreamRestriction && streamRestrictedClasses.length > 0) {
      streamStudentIds = await Student.find({
        class: { $in: streamRestrictedClasses },
        stream: { $in: req.teacherStreamIds },
      }).distinct('_id');
    }

    const classesList = [];
    for (const classId of classIds) {
      const cls = await Class.findById(classId).populate('streams', 'name');
      if (!cls) continue;
      const studentQuery = { class: classId, status: 'active' };
      const entry = classMap[classId];
      if (entry && !entry.allStreams && entry.streamIds.length > 0 && streamStudentIds) {
        studentQuery._id = { $in: streamStudentIds };
      }
      const studentCount = await Student.countDocuments(studentQuery);
      const classAssignments = assignments.filter((a) => a.class?._id?.toString() === classId.toString());
      const subjectNames = [...new Set(classAssignments.map((a) => a.subject?.name).filter(Boolean))];
      classesList.push({
        _id: cls._id,
        name: cls.name,
        studentCount,
        streams: (cls.streams || []).map((s) => s.name),
        subjects: subjectNames,
      });
    }

    const totalStudents = classesList.reduce((sum, c) => sum + c.studentCount, 0);

    const buildAttendanceMatch = (classObjectIds) => {
      const match = { class: { $in: classObjectIds } };
      if (streamRestrictedClasses.length > 0 && streamStudentIds) {
        match.student = { $in: streamStudentIds };
      }
      return match;
    };

    let todayAttendance = { total: 0, present: 0, percentage: 0 };
    if (classIds.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextDay = new Date(today);
      nextDay.setDate(nextDay.getDate() + 1);

      const attendanceMatch = buildAttendanceMatch(classIds.map((id) => new (require('mongoose').Types.ObjectId)(id)));
      attendanceMatch.date = { $gte: today, $lt: nextDay };

      const attendanceData = await Attendance.aggregate([
        { $match: attendanceMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          },
        },
      ]);

      if (attendanceData.length > 0) {
        todayAttendance = {
          total: attendanceData[0].total,
          present: attendanceData[0].present,
          percentage: attendanceData[0].total > 0
            ? parseFloat(((attendanceData[0].present / attendanceData[0].total) * 100).toFixed(2))
            : 0,
        };
      }
    }

    let weeklyAttendance = [];
    if (classIds.length > 0) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const weeklyMatch = buildAttendanceMatch(classIds.map((id) => new (require('mongoose').Types.ObjectId)(id)));
      weeklyMatch.date = { $gte: sevenDaysAgo };

      weeklyAttendance = await Attendance.aggregate([
        { $match: weeklyMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            date: '$_id',
            total: 1,
            present: 1,
            percentage: {
              $cond: [{ $gt: ['$total', 0] }, { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 2] }, 0],
            },
          },
        },
      ]);
    }

    res.json({
      success: true,
      data: {
        classesList,
        totalStudents,
        totalClasses: classIds.length,
        todayAttendance,
        weeklyAttendance,
        currentAcademicYear: currentYear?.name,
        currentTerm: currentTerm?.name,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSubjectTeacherDashboard = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user._id });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    const currentYear = await AcademicYear.findOne({ isCurrent: true });
    const currentTerm = currentYear
      ? await Term.findOne({ academicYear: currentYear._id, isCurrent: true })
      : null;

    const previousTerm = currentYear
      ? await Term.findOne({ academicYear: currentYear._id, isCurrent: false }).sort({ createdAt: -1 })
      : null;

    const yearFilter = currentYear ? { academicYear: { $in: [currentYear._id, null] } } : {};
    let assignments = await TeacherAssignment.find({ teacher: teacher._id, ...yearFilter })
      .populate('class', 'name code')
      .populate('subject', 'name code')
      .populate('stream', 'name');

    if (assignments.length === 0) {
      assignments = await TeacherAssignment.find({ teacher: teacher._id })
        .populate('class', 'name code')
        .populate('subject', 'name code')
        .populate('stream', 'name');
    }

    const subjectIds = [...new Set(assignments.map((a) => a.subject?._id?.toString()).filter(Boolean))];

    const subjectsPerformance = [];
    for (const subjectId of subjectIds) {
      const subject = assignments.find((a) => a.subject?._id?.toString() === subjectId)?.subject;
      if (!subject) continue;

      const subjectAssignments = assignments.filter(a => a.subject?._id?.toString() === subjectId);
      const classSet = new Set();
      const streamSet = new Set();
      let hasAllStreams = false;
      for (const a of subjectAssignments) {
        if (a.class) classSet.add(a.class._id || a.class);
        if (a.stream) streamSet.add(a.stream._id || a.stream);
        else hasAllStreams = true;
      }
      const markFilter = { subject: subjectId };
      if (classSet.size > 0) markFilter.class = { $in: [...classSet] };
      if (!hasAllStreams && streamSet.size > 0) markFilter.stream = { $in: [...streamSet] };

      const currentMarks = currentTerm
        ? await Mark.find({ ...markFilter, term: currentTerm._id })
        : [];
      const currentAvg = currentMarks.length > 0
        ? currentMarks.reduce((sum, m) => sum + m.score, 0) / currentMarks.length
        : 0;

      let previousAvg = 0;
      if (previousTerm) {
        const previousMarks = await Mark.find({ ...markFilter, term: previousTerm._id });
        previousAvg = previousMarks.length > 0
          ? previousMarks.reduce((sum, m) => sum + m.score, 0) / previousMarks.length
          : 0;
      }

      const classNames = [...classSet]
        .map((cid) => subjectAssignments.find((a) => (a.class?._id || a.class)?.toString() === cid.toString())?.class?.name)
        .filter(Boolean);
      const streamNames = [...streamSet]
        .map((sid) => subjectAssignments.find((a) => (a.stream?._id || a.stream)?.toString() === sid.toString())?.stream?.name)
        .filter(Boolean);

      subjectsPerformance.push({
        subjectId: subject._id,
        subjectName: subject.name,
        currentAverage: parseFloat(currentAvg.toFixed(2)),
        previousAverage: parseFloat(previousAvg.toFixed(2)),
        change: previousAvg > 0
          ? parseFloat((((currentAvg - previousAvg) / previousAvg) * 100).toFixed(2))
          : 0,
        totalMarks: currentMarks.length,
        classes: classNames,
        streams: streamNames,
        allStreams: hasAllStreams,
      });
    }

    const pendingAssessments = await Assessment.find({
      subject: { $in: subjectIds },
      status: 'released',
    })
      .populate('class', 'name')
      .populate('subject', 'name')
      .sort({ releaseDate: -1 })
      .limit(10);

    const totalMarksEntered = currentTerm
      ? await Mark.countDocuments({ gradedBy: req.user._id, term: currentTerm._id })
      : 0;

    const recentMarks = await Mark.find({ gradedBy: req.user._id })
      .populate('student', 'firstName lastName admissionNumber')
      .populate('subject', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        assignments,
        subjectsPerformance,
        pendingAssessments,
        totalMarksEntered,
        totalSubjects: subjectIds.length,
        totalClasses: assignments.length,
        recentMarks,
        currentAcademicYear: currentYear?.name,
        currentTerm: currentTerm?.name,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAcademicTeacherDashboard = async (req, res) => {
  try {
    const currentYear = await AcademicYear.findOne({ isCurrent: true });
    const currentTerm = currentYear
      ? await Term.findOne({ academicYear: currentYear._id, isCurrent: true })
      : null;

    const totalAssessments = await Assessment.countDocuments();
    const draftAssessments = await Assessment.countDocuments({ status: 'draft' });
    const releasedAssessments = await Assessment.countDocuments({ status: 'released' });
    const publishedAssessments = await Assessment.countDocuments({ status: 'published' });

    const totalMarks = currentTerm
      ? await Mark.countDocuments({ term: currentTerm._id })
      : 0;

    const overallAverage = currentTerm
      ? await Mark.aggregate([
          { $match: { term: currentTerm._id } },
          { $group: { _id: null, average: { $avg: '$score' } } },
        ]).then((r) => r.length > 0 ? parseFloat(r[0].average.toFixed(2)) : 0)
      : 0;

    const performanceByClass = currentTerm
      ? await Mark.aggregate([
          { $match: { term: currentTerm._id } },
          {
            $group: {
              _id: '$class',
              averageScore: { $avg: '$score' },
              totalMarks: { $sum: 1 },
            },
          },
          {
            $lookup: { from: 'classes', localField: '_id', foreignField: '_id', as: 'class' },
          },
          { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              className: '$class.name',
              averageScore: { $round: ['$averageScore', 2] },
              totalMarks: 1,
            },
          },
          { $sort: { className: 1 } },
        ])
      : [];

    const recentAssessments = await Assessment.find()
      .populate('class', 'name')
      .populate('subject', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    const allMarks = await Mark.find()
      .populate('student', 'firstName lastName admissionNumber')
      .populate('subject', 'name')
      .populate('class', 'name')
      .populate('assessment', 'name')
      .sort({ createdAt: -1 })
      .limit(20);

    // Marks grouped by teacher (gradedBy) — the reports the academic teacher needs to see
    const marksByTeacher = currentTerm
      ? await Mark.aggregate([
          { $match: { term: currentTerm._id } },
          {
            $group: {
              _id: '$gradedBy',
              totalMarks: { $sum: 1 },
              averageScore: { $avg: '$score' },
              totalScore: { $sum: '$score' },
              assessments: { $addToSet: '$assessment' },
              subjects: { $addToSet: '$subject' },
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'teacher',
            },
          },
          { $unwind: { path: '$teacher', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'teachers',
              localField: 'teacher._id',
              foreignField: 'user',
              as: 'teacherProfile',
            },
          },
          { $unwind: { path: '$teacherProfile', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              teacherId: '$_id',
              teacherName: {
                $concat: [
                  { $ifNull: ['$teacher.firstName', 'Unknown'] },
                  ' ',
                  { $ifNull: ['$teacher.lastName', ''] },
                ],
              },
              employeeId: '$teacherProfile.employeeId',
              designation: '$teacherProfile.designation',
              totalMarks: 1,
              averageScore: { $round: ['$averageScore', 2] },
              totalScore: { $round: ['$totalScore', 2] },
              assessmentCount: { $size: '$assessments' },
              subjectCount: { $size: '$subjects' },
            },
          },
          { $sort: { totalMarks: -1 } },
        ])
      : [];

    // Get pending assessments that need marks (released but not yet all marked)
    const pendingForMarks = await Assessment.find({ status: 'released' })
      .populate('class', 'name')
      .populate('subject', 'name')
      .sort({ examDate: 1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        assessmentStats: {
          total: totalAssessments,
          draft: draftAssessments,
          released: releasedAssessments,
          published: publishedAssessments,
        },
        totalMarks,
        overallAverage,
        performanceByClass,
        recentAssessments,
        allMarks,
        marksByTeacher,
        pendingForMarks,
        currentAcademicYear: currentYear?.name,
        currentTerm: currentTerm?.name,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};