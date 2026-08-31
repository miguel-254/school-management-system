const Assessment = require('../models/Assessment');
const AuditLog = require('../models/AuditLog');
const fs = require('fs');
const path = require('path');

const KNOWN_COLUMNS = ['name', 'code', 'type', 'weight', 'academicYear', 'term', 'subject', 'class', 'stream', 'maxScore', 'examDate', 'duration', 'instructions', 'releaseDate', 'isRequired'];
const KNOWN_HEADER_KEYS = KNOWN_COLUMNS.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

function normalizeHeader(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function splitLine(line) {
  let parts = line.split('\t').map((c) => c.trim());
  if (parts.filter((p) => p !== '').length >= 2) return parts;
  parts = line.split(',').map((c) => c.trim());
  if (parts.filter((p) => p !== '').length >= 2) return parts;
  parts = line.split(/\s{2,}/).map((c) => c.trim());
  if (parts.filter((p) => p !== '').length >= 2) return parts;
  return null;
}

function textToRows(text) {
  const rows = [];
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  let headerOrder = null;
  for (const line of lines) {
    if (/^[=\-_*\s]+$/.test(line)) continue;
    const cells = splitLine(line);
    if (!cells) continue;
    if (!headerOrder) {
      const keys = cells.map((c) => normalizeHeader(c));
      const matched = keys.filter((k) => KNOWN_HEADER_KEYS.includes(k)).length;
      if (matched >= 2) {
        headerOrder = keys.map((k) => KNOWN_COLUMNS[KNOWN_HEADER_KEYS.indexOf(k)]);
        continue;
      }
      rows.push(Object.fromEntries(cells.map((c, i) => [KNOWN_COLUMNS[i], c])));
      continue;
    }
    const row = {};
    cells.forEach((c, i) => {
      if (!headerOrder[i] || c === '' || headerOrder[i] in row) return;
      row[headerOrder[i]] = c;
    });
    rows.push(row);
  }
  return rows;
}

exports.getAssessments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      class: classId,
      subject,
      type,
      term,
      academicYear,
      status,
      sort = '-createdAt',
    } = req.query;

    const query = {};

    // Auto-release assessments whose scheduled releaseDate has arrived and exam is within window
    const releaseWindowDays = parseInt(process.env.RELEASE_WINDOW_DAYS || '3', 10);
    const now = new Date();
    await Assessment.updateMany(
      {
        status: 'draft',
        releaseDate: { $lte: now },
        examDate: {
          $gte: now,
          $lte: new Date(now.getTime() + releaseWindowDays * 24 * 60 * 60 * 1000),
        },
      },
      { status: 'released' }
    );

    // Role-based filtering
    if (req.user.role === 'subject_teacher' || req.user.role === 'class_teacher') {
      query.status = { $in: ['released', 'published', 'closed'] };
    }

    if (classId) query.class = classId;
    if (subject) query.subject = subject;
    if (type) query.type = type;
    if (term) query.term = term;
    if (academicYear) query.academicYear = academicYear;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [assessments, total] = await Promise.all([
      Assessment.find(query)
        .populate('class', 'name code')
        .populate('subject', 'name code')
        .populate('term', 'name')
        .populate('academicYear', 'name year')
        .populate('createdBy', 'firstName lastName')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Assessment.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        assessments,
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

exports.getAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id)
      .populate('class', 'name code')
      .populate('subject', 'name code')
      .populate('term', 'name')
      .populate('academicYear', 'name year')
      .populate('createdBy', 'firstName lastName role');

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    const Mark = require('../models/Mark');
    const markQuery = { assessment: assessment._id };
    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      const classEntry = assessment.class ? req.teacherScope.classMap[assessment.class.toString()] : null;
      if (classEntry && !classEntry.allStreams && classEntry.streamIds.length > 0) {
        markQuery.stream = { $in: classEntry.streamIds.map(id => new (require('mongoose').Types.ObjectId)(id)) };
      }
    }
    const marks = await Mark.find(markQuery)
      .populate('student', 'firstName lastName admissionNumber')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { assessment, marks },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAssessment = async (req, res) => {
  try {
    const {
      name, code, type, weight, academicYear, term,
      subject, class: classId, stream, maxScore,
      examDate, duration, instructions, isRequired,
    } = req.body;

    if (!name || !type || !academicYear || !term || !subject || !classId || !maxScore) {
      return res.status(400).json({
        success: false,
        message: 'name, type, academicYear, term, subject, class and maxScore are required',
      });
    }

    const assessmentCode = code || `${type.toUpperCase()}-${Date.now()}`;

    const existing = await Assessment.findOne({ code: assessmentCode.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Assessment code already exists' });
    }

    const validTypes = ['assignment', 'classExercise', 'cat', 'project', 'practical', 'midTerm', 'endTerm', 'finalExam'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    const initialStatus = req.body.releaseDate ? 'draft' : 'draft';

    const assessment = await Assessment.create({
      name, code: assessmentCode, type, weight, academicYear, term,
      subject, class: classId, stream, maxScore,
      examDate, duration, instructions, isRequired,
      releaseDate: req.body.releaseDate || undefined,
      status: initialStatus,
      createdBy: req.user._id,
    });

    const populated = await Assessment.findById(assessment._id)
      .populate('class', 'name code')
      .populate('subject', 'name code')
      .populate('term', 'name')
      .populate('academicYear', 'name year');

    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE_ASSESSMENT',
      resource: 'Assessment',
      resourceId: assessment._id,
      details: { name, code: assessmentCode, type, class: classId },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(201).json({
      success: true,
      data: populated,
      message: 'Assessment created successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAssessment = async (req, res) => {
  try {
    const allowedFields = [
      'name', 'type', 'weight', 'maxScore', 'examDate',
      'duration', 'instructions', 'isRequired', 'stream',
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const assessment = await Assessment.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    })
      .populate('class', 'name code')
      .populate('subject', 'name code')
      .populate('term', 'name')
      .populate('academicYear', 'name year');

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE_ASSESSMENT',
      resource: 'Assessment',
      resourceId: assessment._id,
      details: Object.keys(updates),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: assessment,
      message: 'Assessment updated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    const Mark = require('../models/Mark');
    const markCount = await Mark.countDocuments({ assessment: assessment._id });
    if (markCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete assessment with ${markCount} marks. Remove marks first.`,
      });
    }

    await Assessment.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      user: req.user._id,
      action: 'DELETE_ASSESSMENT',
      resource: 'Assessment',
      resourceId: req.params.id,
      details: { name: assessment.name, code: assessment.code },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: {},
      message: 'Assessment deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.publishAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findByIdAndUpdate(
      req.params.id,
      { status: 'published' },
      { new: true }
    )
      .populate('class', 'name code')
      .populate('subject', 'name code')
      .populate('term', 'name')
      .populate('academicYear', 'name year');

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'PUBLISH_ASSESSMENT',
      resource: 'Assessment',
      resourceId: assessment._id,
      details: { name: assessment.name, status: 'published' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: assessment,
      message: 'Assessment published successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.releaseAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    if (!assessment.examDate) {
      return res.status(400).json({ success: false, message: 'Assessment must have an exam date before it can be released' });
    }

    const now = new Date();
    const examDate = new Date(assessment.examDate);
    const diffDays = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return res.status(400).json({ success: false, message: 'Cannot release an assessment after the exam date has passed' });
    }

    const releaseWindowDays = parseInt(process.env.RELEASE_WINDOW_DAYS || '3', 10);
    if (diffDays > releaseWindowDays) {
      return res.status(400).json({
        success: false,
        message: `Assessments can only be released within ${releaseWindowDays} days before the exam date. The exam is in ${diffDays} days.`,
      });
    }

    assessment.status = 'released';
    assessment.releaseDate = now;
    await assessment.save();

    const populated = await Assessment.findById(assessment._id)
      .populate('class', 'name code')
      .populate('subject', 'name code')
      .populate('term', 'name')
      .populate('academicYear', 'name year');

    await AuditLog.create({
      user: req.user._id,
      action: 'RELEASE_ASSESSMENT',
      resource: 'Assessment',
      resourceId: assessment._id,
      details: { name: assessment.name, status: 'released', examDate: assessment.examDate },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: populated,
      message: 'Assessment released successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.closeAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findByIdAndUpdate(
      req.params.id,
      { status: 'closed' },
      { new: true }
    )
      .populate('class', 'name code')
      .populate('subject', 'name code')
      .populate('term', 'name')
      .populate('academicYear', 'name year');

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'CLOSE_ASSESSMENT',
      resource: 'Assessment',
      resourceId: assessment._id,
      details: { name: assessment.name, status: 'closed' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: assessment,
      message: 'Assessment closed successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadTemplate = async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    const headers = ['name', 'code', 'type', 'weight', 'academicYear', 'term', 'subject', 'class', 'stream', 'maxScore', 'examDate', 'duration', 'instructions'];
    const example = ['Mid-Term Mathematics', 'MATH-MT-2025', 'midTerm', 20, '2025-2026', 'Term 1', 'Mathematics', 'Grade 1', 'East', 100, '2025-03-15', 60, 'Answer all questions'];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length * 2, 15) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=assessment_import_template.xlsx');
    res.send(buf);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.importAssessments = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a CSV, Excel, Word or PDF file' });
    }

    const Subject = require('../models/Subject');
    const Class = require('../models/Class');
    const Stream = require('../models/Stream');

    const ext = (req.file.originalname || '').split('.').pop().toLowerCase();
    const documentExts = ['doc', 'docx', 'pdf'];

    if (documentExts.includes(ext)) {
      const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'assessment-docs');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const base = path.basename(req.file.originalname, path.extname(req.file.originalname))
        .replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
      const filename = `assessment_${Date.now()}_${base || 'document'}${path.extname(req.file.originalname).toLowerCase()}`;
      fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);

      await AuditLog.create({
        user: req.user._id,
        action: 'UPLOAD_ASSESSMENT_DOCUMENT',
        resource: 'Assessment',
        details: { filename, originalName: req.file.originalname, size: req.file.size },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.json({
        success: true,
        data: {
          document: {
            filename,
            url: `/uploads/assessment-docs/${filename}`,
            originalName: req.file.originalname,
            size: req.file.size,
            mimeType: req.file.mimetype,
          },
        },
        message: 'Document uploaded successfully',
      });
    }

    const spreadsheetExts = ['xlsx', 'xls', 'xlsb', 'ods', 'csv', 'tsv', 'txt'];

    let rows = null;
    if (spreadsheetExts.includes(ext)) {
      try {
        const XLSX = require('xlsx');
        const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      } catch {
        rows = null;
      }
    }
    if (!rows || rows.length === 0) {
      rows = textToRows(req.file.buffer.toString('latin1'));
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'File is empty' });
    }

    const results = { imported: 0, skipped: 0, errors: [] };
    const validTypes = ['assignment', 'classExercise', 'cat', 'project', 'practical', 'midTerm', 'endTerm', 'finalExam'];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      try {
        if (!row.name || !row.type) {
          results.errors.push({ row: rowNum, reason: 'Missing required fields (name, type)' });
          results.skipped++;
          continue;
        }
        const type = row.type.replace(/[\s-]/g, '');
        const camelType = type.charAt(0).toLowerCase() + type.slice(1);
        if (!validTypes.includes(camelType)) {
          results.errors.push({ row: rowNum, reason: `Invalid type "${row.type}". Must be one of: ${validTypes.join(', ')}` });
          results.skipped++;
          continue;
        }

        let subjectDoc = null;
        if (row.subject) {
          subjectDoc = await Subject.findOne({
            $or: [
              { name: { $regex: `^${row.subject}$`, $options: 'i' } },
              { code: { $regex: `^${row.subject}$`, $options: 'i' } },
            ]
          });
          if (!subjectDoc) {
            results.errors.push({ row: rowNum, reason: `Subject "${row.subject}" not found` });
            results.skipped++;
            continue;
          }
        } else {
          results.errors.push({ row: rowNum, reason: 'Missing subject' });
          results.skipped++;
          continue;
        }

        let classDoc = null;
        if (row.class) {
          classDoc = await Class.findOne({ name: { $regex: `^${row.class}$`, $options: 'i' } });
          if (!classDoc) {
            results.errors.push({ row: rowNum, reason: `Class "${row.class}" not found` });
            results.skipped++;
            continue;
          }
        } else {
          results.errors.push({ row: rowNum, reason: 'Missing class' });
          results.skipped++;
          continue;
        }

        let streamDoc = null;
        if (row.stream && classDoc) {
          streamDoc = await Stream.findOne({ name: { $regex: `^${row.stream}$`, $options: 'i' }, class: classDoc._id });
        }

        if (!row.maxScore) {
          results.errors.push({ row: rowNum, reason: 'Missing maxScore' });
          results.skipped++;
          continue;
        }

        let academicYearDoc = null;
        if (row.academicYear) {
          academicYearDoc = await require('../models/AcademicYear').findOne({
            name: { $regex: `^${row.academicYear}$`, $options: 'i' }
          });
        }
        if (!academicYearDoc) {
          academicYearDoc = await require('../models/AcademicYear').findOne({ isCurrent: true });
        }

        let termDoc = null;
        if (row.term && academicYearDoc) {
          termDoc = await require('../models/Term').findOne({
            name: { $regex: `^${row.term}$`, $options: 'i' },
            academicYear: academicYearDoc._id
          });
        }

        const code = row.code || `${subjectDoc.code}-${camelType.toUpperCase()}-${Date.now()}`;

        await Assessment.create({
          name: row.name,
          code: code.toUpperCase(),
          type: camelType,
          weight: Number(row.weight) || 0,
          academicYear: academicYearDoc?._id,
          term: termDoc?._id,
          subject: subjectDoc._id,
          class: classDoc._id,
          stream: streamDoc?._id,
          maxScore: Number(row.maxScore),
          examDate: row.examDate ? new Date(row.examDate) : undefined,
          duration: row.duration ? Number(row.duration) : undefined,
          instructions: row.instructions || undefined,
          createdBy: req.user._id,
          status: 'released',
          releaseDate: new Date(),
        });

        results.imported++;
      } catch (err) {
        results.errors.push({ row: rowNum, reason: err.message });
        results.skipped++;
      }
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'BULK_IMPORT_ASSESSMENTS',
      resource: 'Assessment',
      details: { imported: results.imported, skipped: results.skipped },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: results,
      message: `Imported ${results.imported} assessment(s), skipped ${results.skipped}`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportAssessments = async (req, res) => {
  try {
    const assessments = await Assessment.find({})
      .populate('class', 'name')
      .populate('subject', 'name')
      .populate('term', 'name')
      .populate('academicYear', 'name')
      .populate('stream', 'name')
      .sort('-createdAt');

    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    const headers = ['Name', 'Code', 'Type', 'Weight', 'Academic Year', 'Term', 'Subject', 'Class', 'Stream', 'Max Score', 'Exam Date', 'Duration', 'Status', 'Instructions'];
    const data = assessments.map(a => [
      a.name, a.code, a.type, a.weight,
      a.academicYear?.name || '', a.term?.name || '',
      a.subject?.name || '', a.class?.name || '',
      a.stream?.name || '', a.maxScore,
      a.examDate ? new Date(a.examDate).toLocaleDateString('en-CA') : '',
      a.duration || '', a.status, a.instructions || '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length * 2, 15) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Assessments');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=assessments_export.xlsx');
    res.send(buf);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id)
      .populate('class', 'name')
      .populate('subject', 'name')
      .populate('term', 'name')
      .populate('academicYear', 'name')
      .populate('stream', 'name');

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();

    const details = [
      ['Field', 'Value'],
      ['Name', assessment.name],
      ['Code', assessment.code],
      ['Type', assessment.type],
      ['Subject', assessment.subject?.name || ''],
      ['Class', assessment.class?.name || ''],
      ['Stream', assessment.stream?.name || ''],
      ['Term', assessment.term?.name || ''],
      ['Academic Year', assessment.academicYear?.name || ''],
      ['Max Score', assessment.maxScore],
      ['Weight', `${assessment.weight}%`],
      ['Exam Date', assessment.examDate ? new Date(assessment.examDate).toLocaleDateString('en-CA') : ''],
      ['Duration', assessment.duration ? `${assessment.duration} min` : ''],
      ['Status', assessment.status],
      ['Instructions', assessment.instructions || ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(details);
    ws['!cols'] = [{ wch: 20 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Assessment');

    const filename = `assessment_${assessment.code}_${Date.now()}.xlsx`;
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buf);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};