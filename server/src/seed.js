require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SchoolSetting = require('./models/SchoolSetting');
const User = require('./models/User');
const Teacher = require('./models/Teacher');
const Class = require('./models/Class');
const Stream = require('./models/Stream');
const Subject = require('./models/Subject');
const AcademicYear = require('./models/AcademicYear');
const Term = require('./models/Term');
const GradeScale = require('./models/GradeScale');
const Student = require('./models/Student');
const TeacherAssignment = require('./models/TeacherAssignment');

async function seed() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/school_management';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const existingSchool = await SchoolSetting.findOne({ schoolCode: 'ATS001' });
    let school;
    if (existingSchool) {
      school = existingSchool;
      console.log('School settings already exist, skipping...');
    } else {
      school = await SchoolSetting.create({
        schoolName: 'Achievers Trophy School',
        schoolCode: 'ATS001',
        motto: 'Excellence Through Dedication',
        address: '123 Education Lane, Nairobi, Kenya',
        phone: '+254712345678',
        email: 'info@achieverstrophy.sch.ke',
        website: 'https://achieverstrophy.sch.ke',
        logo: '',
        principalName: 'Dr. James Kimani',
        gradingSystem: 'percentage',
        academicYearConfig: { terms: 3, semesters: 0 },
        reportCardConfig: {
          showLogo: true,
          showPhoto: true,
          showQR: true,
          showSignature: true,
          showStamp: true,
          showGraph: false,
        },
        sessionTimeout: 30,
        theme: 'light',
        timezone: 'Africa/Nairobi',
        locale: 'en',
      });
      console.log('School settings created');
    }

    const headteacherEmail = 'headteacher@school.com';
    let headteacherUser = await User.findOne({ email: headteacherEmail });
    if (headteacherUser) {
      console.log('Headteacher user already exists, skipping...');
    } else {
      headteacherUser = await User.create({
        email: headteacherEmail,
        password: 'password123',
        role: 'headteacher',
        firstName: 'John',
        lastName: 'Kimani',
        phone: '+254712345670',
        isActive: true,
        schoolId: school._id,
      });
      console.log('Headteacher user created: headteacher@school.com / password123');
    }

    let headteacherTeacher = await Teacher.findOne({ user: headteacherUser._id });
    if (headteacherTeacher) {
      console.log('Headteacher teacher profile already exists, skipping...');
    } else {
      headteacherTeacher = await Teacher.create({
        user: headteacherUser._id,
        employeeId: 'TCH-ADMIN-001',
        firstName: 'John',
        lastName: 'Kimani',
        gender: 'male',
        dateOfEmployment: new Date('2020-01-15'),
        qualifications: [{ degree: 'PhD in Education', institution: 'University of Nairobi', year: 2015, field: 'Education' }],
      });
      console.log('Headteacher teacher profile created');
    }

    const teacherEmails = ['teacher1@school.com', 'teacher2@school.com'];
    const teacherData = [
      { email: teacherEmails[0], firstName: 'Jane', lastName: 'Wanjiku', employeeId: 'TCH-001', phone: '+254723456789' },
      { email: teacherEmails[1], firstName: 'Peter', lastName: 'Ochieng', employeeId: 'TCH-002', phone: '+254734567890' },
    ];
    const teacherUsers = [];

    for (const td of teacherData) {
      let user = await User.findOne({ email: td.email });
      if (user) {
        console.log(`Teacher ${td.email} already exists, skipping...`);
      } else {
        user = await User.create({
          email: td.email,
          password: 'password123',
          role: 'teacher',
          firstName: td.firstName,
          lastName: td.lastName,
          phone: td.phone,
          isActive: true,
          schoolId: school._id,
        });
        console.log(`Teacher user created: ${td.email} / password123`);
      }
      teacherUsers.push(user);
    }

    const teacherProfiles = [];
    for (let i = 0; i < teacherData.length; i++) {
      const td = teacherData[i];
      const u = teacherUsers[i];
      let teacherProfile = await Teacher.findOne({ user: u._id });
      if (teacherProfile) {
        console.log(`Teacher profile for ${td.email} already exists, skipping...`);
      } else {
        teacherProfile = await Teacher.create({
          user: u._id,
          employeeId: td.employeeId,
          firstName: td.firstName,
          lastName: td.lastName,
          gender: i === 0 ? 'female' : 'male',
          dateOfEmployment: new Date('2021-02-01'),
        });
        console.log(`Teacher profile created: ${td.firstName} ${td.lastName}`);
      }
      teacherProfiles.push(teacherProfile);
    }

    const classNames = ['Grade 1', 'Grade 2', 'Grade 3'];
    const streams = ['East', 'West'];
    const classIds = [];
    const streamIds = [];

    for (const className of classNames) {
      const code = className.replace(' ', '_').toUpperCase();
      let existingClass = await Class.findOne({ code });
      if (existingClass) {
        console.log(`Class ${className} already exists, skipping...`);
        classIds.push(existingClass._id);
        const existingStreams = await Stream.find({ class: existingClass._id });
        for (const s of existingStreams) {
          streamIds.push(s._id);
        }
        continue;
      }

      const createdClass = await Class.create({
        name: className,
        code,
        description: `${className} class`,
        capacity: 40,
      });
      classIds.push(createdClass._id);
      console.log(`Class created: ${className}`);

      for (const streamName of streams) {
        const streamCode = `${code}_${streamName.toUpperCase()}`;
        let existingStream = await Stream.findOne({ code: streamCode });
        if (existingStream) {
          streamIds.push(existingStream._id);
        } else {
          const stream = await Stream.create({
            name: streamName,
            code: streamCode,
            class: createdClass._id,
            description: `${streamName} stream of ${className}`,
          });
          streamIds.push(stream._id);
          console.log(`Stream created: ${className} - ${streamName}`);
        }
      }
    }

    const subjectData = [
      { name: 'Mathematics', code: 'MATH', category: 'core', credits: 4 },
      { name: 'English', code: 'ENG', category: 'core', credits: 4 },
      { name: 'Science', code: 'SCI', category: 'core', credits: 3 },
      { name: 'Social Studies', code: 'SST', category: 'core', credits: 2 },
      { name: 'Arts', code: 'ART', category: 'elective', credits: 1 },
    ];
    const subjectIds = [];

    for (const sd of subjectData) {
      let existing = await Subject.findOne({ code: sd.code });
      if (existing) {
        console.log(`Subject ${sd.name} already exists, skipping...`);
        subjectIds.push(existing._id);
      } else {
        const sub = await Subject.create(sd);
        subjectIds.push(sub._id);
        console.log(`Subject created: ${sd.name} (${sd.code})`);
      }
    }

    const yearName = '2025-2026';
    let academicYear = await AcademicYear.findOne({ year: yearName });
    if (academicYear) {
      console.log(`Academic year ${yearName} already exists, skipping...`);
    } else {
      academicYear = await AcademicYear.create({
        name: yearName,
        year: yearName,
        startDate: new Date('2025-01-15'),
        endDate: new Date('2026-12-15'),
        isCurrent: true,
        terms: [],
      });
      console.log(`Academic year created: ${yearName}`);

      const termNames = ['Term 1', 'Term 2', 'Term 3'];
      const termStartDates = [
        new Date('2025-01-15'),
        new Date('2025-05-01'),
        new Date('2025-09-01'),
      ];
      const termEndDates = [
        new Date('2025-04-15'),
        new Date('2025-08-15'),
        new Date('2025-12-15'),
      ];

      const termIds = [];
      for (let i = 0; i < termNames.length; i++) {
        const term = await Term.create({
          name: termNames[i],
          academicYear: academicYear._id,
          startDate: termStartDates[i],
          endDate: termEndDates[i],
          isCurrent: i === 0,
        });
        termIds.push(term._id);
        console.log(`Term created: ${termNames[i]}`);
      }

      academicYear.terms = termIds;
      await academicYear.save();
    }

    const percentageScales = [
      { name: 'A - Excellent', code: 'A', minScore: 80, maxScore: 100, gradePoint: 12, description: 'Excellent', remark: 'Outstanding performance', system: 'percentage' },
      { name: 'B - Good', code: 'B', minScore: 70, maxScore: 79, gradePoint: 10, description: 'Good', remark: 'Good performance', system: 'percentage' },
      { name: 'C - Satisfactory', code: 'C', minScore: 60, maxScore: 69, gradePoint: 8, description: 'Satisfactory', remark: 'Satisfactory performance', system: 'percentage' },
      { name: 'D - Poor', code: 'D', minScore: 50, maxScore: 59, gradePoint: 6, description: 'Poor', remark: 'Below average performance', system: 'percentage' },
      { name: 'E - Fail', code: 'E', minScore: 0, maxScore: 49, gradePoint: 4, description: 'Fail', remark: 'Needs improvement', system: 'percentage' },
    ];

    for (const scale of percentageScales) {
      const existing = await GradeScale.findOne({ code: scale.code, system: 'percentage' });
      if (existing) {
        console.log(`Grade scale ${scale.code} (percentage) already exists, skipping...`);
      } else {
        await GradeScale.create(scale);
        console.log(`Grade scale created: ${scale.code} (${scale.minScore}-${scale.maxScore})`);
      }
    }

    const cbcScales = [
      { name: 'Exceeding Expectations', code: 'EE', minScore: 80, maxScore: 100, gradePoint: 4, description: 'Exceeding Expectations', remark: 'Learner exceeds expectations', system: 'cbc' },
      { name: 'Meeting Expectations', code: 'ME', minScore: 60, maxScore: 79, gradePoint: 3, description: 'Meeting Expectations', remark: 'Learner meets expectations', system: 'cbc' },
      { name: 'Approaching Expectations', code: 'AE', minScore: 40, maxScore: 59, gradePoint: 2, description: 'Approaching Expectations', remark: 'Learner approaching expectations', system: 'cbc' },
      { name: 'Below Expectations', code: 'BE', minScore: 0, maxScore: 39, gradePoint: 1, description: 'Below Expectations', remark: 'Learner below expectations', system: 'cbc' },
    ];

    for (const scale of cbcScales) {
      const existing = await GradeScale.findOne({ code: scale.code, system: 'cbc' });
      if (existing) {
        console.log(`Grade scale ${scale.code} (CBC) already exists, skipping...`);
      } else {
        await GradeScale.create(scale);
        console.log(`Grade scale created: ${scale.code} (${scale.minScore}-${scale.maxScore})`);
      }
    }

    const studentsData = [
      { firstName: 'Alice', lastName: 'Wambui', gender: 'female', admissionNumber: 'STU/2025/0001' },
      { firstName: 'Brian', lastName: 'Kiprop', gender: 'male', admissionNumber: 'STU/2025/0002' },
      { firstName: 'Cynthia', lastName: 'Atieno', gender: 'female', admissionNumber: 'STU/2025/0003' },
      { firstName: 'David', lastName: 'Mwangi', gender: 'male', admissionNumber: 'STU/2025/0004' },
      { firstName: 'Esther', lastName: 'Njoki', gender: 'female', admissionNumber: 'STU/2025/0005' },
      { firstName: 'Francis', lastName: 'Omondi', gender: 'male', admissionNumber: 'STU/2025/0006' },
      { firstName: 'Grace', lastName: 'Akinyi', gender: 'female', admissionNumber: 'STU/2025/0007' },
      { firstName: 'Henry', lastName: 'Kamau', gender: 'male', admissionNumber: 'STU/2025/0008' },
      { firstName: 'Irene', lastName: 'Chebet', gender: 'female', admissionNumber: 'STU/2025/0009' },
      { firstName: 'James', lastName: 'Ndirangu', gender: 'male', admissionNumber: 'STU/2025/0010' },
      { firstName: 'Kevin', lastName: 'Otieno', gender: 'male', admissionNumber: 'STU/2025/0011' },
      { firstName: 'Linda', lastName: 'Wanjala', gender: 'female', admissionNumber: 'STU/2025/0012' },
    ];

    const studentIds = [];

    for (const sd of studentsData) {
      const existing = await Student.findOne({ admissionNumber: sd.admissionNumber });
      if (existing) {
        console.log(`Student ${sd.admissionNumber} already exists, skipping...`);
        studentIds.push(existing._id);
        continue;
      }

      const classIndex = studentsData.indexOf(sd) % classIds.length;
      const classObj = classIds[classIndex];
      const classStreams = await Stream.find({ class: classObj });
      const stream = classStreams.length > 0 ? classStreams[studentsData.indexOf(sd) % classStreams.length] : null;

      const student = await Student.create({
        admissionNumber: sd.admissionNumber,
        firstName: sd.firstName,
        lastName: sd.lastName,
        gender: sd.gender,
        dateOfBirth: new Date(2012 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        class: classObj,
        stream: stream ? stream._id : undefined,
        guardianInfo: {
          name: `Parent of ${sd.firstName} ${sd.lastName}`,
          phone: `+2547${String(Math.floor(10000000 + Math.random() * 90000000))}`,
          relationship: 'parent',
        },
        enrollmentDate: new Date('2025-01-15'),
        status: 'active',
      });
      studentIds.push(student._id);
      console.log(`Student created: ${sd.firstName} ${sd.lastName} (${sd.admissionNumber})`);
    }

    for (let i = 0; i < teacherProfiles.length; i++) {
      const teacher = teacherProfiles[i];
      const cls = classIds[i % classIds.length];
      const sub = subjectIds[i % subjectIds.length];

      const existingAssignment = await TeacherAssignment.findOne({
        teacher: teacher._id,
        class: cls,
        subject: sub,
      });
      if (existingAssignment) {
        console.log(`Teacher assignment for ${teacher.firstName} already exists, skipping...`);
        continue;
      }

      await TeacherAssignment.create({
        teacher: teacher._id,
        class: cls,
        subject: sub,
        academicYear: academicYear ? academicYear._id : undefined,
        isClassTeacher: i === 0,
        assignedBy: headteacherUser._id,
      });
      console.log(`Teacher assignment created: ${teacher.firstName} assigned to class with subject`);
    }

    console.log('\n========================================');
    console.log('  Database seeding completed successfully!');
    console.log('========================================');
    console.log('  Headteacher: headteacher@school.com / password123');
    console.log('  Teacher 1:   teacher1@school.com / password123');
    console.log('  Teacher 2:   teacher2@school.com / password123');
    console.log('========================================\n');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error.message);
    console.error(error.stack);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

seed();