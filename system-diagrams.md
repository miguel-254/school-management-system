# School Attendance Tracking & Grading Management System Diagrams

Generated from the Express routes and Mongoose schemas in `server/src`.

## Data Flow Diagram

```mermaid
flowchart LR
  %% External entities
  subgraph Actors["External Entities"]
    HT["Headteacher"]
    CT["Class Teacher"]
    ST["Subject Teacher"]
    AT["Academic Teacher"]
    AD["Admin"]
  end

  %% Client/application boundary
  subgraph Client["React Client"]
    UI["Protected UI Pages"]
    AUTHCTX["Auth Context<br/>JWT in localStorage"]
    API["Axios API Layer<br/>/api/*"]
  end

  subgraph Server["Node.js / Express API"]
    AUTH["1.0 Authentication<br/>JWT, RBAC, Rate Limit"]
    ACADEMIC["2.0 Academic Management<br/>Students, Teachers, Classes,<br/>Streams, Subjects, Years, Terms"]
    ATTEND["3.0 Attendance Tracking<br/>Mark, Bulk Mark, Reports"]
    ASSESS["4.0 Assessment & Marks<br/>Assessments, Imports,<br/>Marks Entry, Approval"]
    GRADING["5.0 Grading & Report Cards<br/>Grade Calculation,<br/>Report Generation, Publishing"]
    REPORTING["6.0 Reports & Dashboards<br/>Analytics, Rankings,<br/>Performance Reports"]
    ADMINPROC["7.0 Administration<br/>Settings, Notifications,<br/>Audit, Uploads"]
  end

  subgraph Mongo["MongoDB Data Stores"]
    D1[("D1 Users")]
    D2[("D2 Teachers")]
    D3[("D3 Students")]
    D4[("D4 Classes & Streams")]
    D5[("D5 Subjects")]
    D6[("D6 Academic Years & Terms")]
    D7[("D7 Teacher Assignments")]
    D8[("D8 Attendance")]
    D9[("D9 Assessments")]
    D10[("D10 Marks")]
    D11[("D11 Grade Scales")]
    D12[("D12 Report Cards")]
    D13[("D13 School Settings")]
    D14[("D14 Notifications")]
    D15[("D15 Audit Logs")]
  end

  subgraph Files["File Stores / Generated Output"]
    F1[/"Uploads<br/>student photos, imports, logo"/]
    F2[/"Generated PDFs<br/>report cards"/]
    F3[/"Excel/CSV Exports<br/>reports and templates"/]
  end

  HT -->|"manage school, approve marks,<br/>publish reports"| UI
  CT -->|"mark attendance,<br/>view class, enter marks"| UI
  ST -->|"enter marks,<br/>view subject performance"| UI
  AT -->|"manage assessments,<br/>academic oversight"| UI
  AD -->|"settings and audit tasks"| UI

  UI --> AUTHCTX
  AUTHCTX -->|"Bearer token"| API
  API -->|"REST requests"| AUTH

  AUTH -->|"validate credentials/token"| D1
  AUTH -->|"authorized request"| ACADEMIC
  AUTH -->|"authorized request"| ATTEND
  AUTH -->|"authorized request"| ASSESS
  AUTH -->|"authorized request"| GRADING
  AUTH -->|"authorized request"| REPORTING
  AUTH -->|"authorized request"| ADMINPROC

  ACADEMIC <-->|"CRUD students"| D3
  ACADEMIC <-->|"CRUD teachers"| D2
  ACADEMIC <-->|"classes and streams"| D4
  ACADEMIC <-->|"subjects"| D5
  ACADEMIC <-->|"years and terms"| D6
  ACADEMIC <-->|"teacher assignments"| D7
  ACADEMIC -->|"photo/import uploads"| F1

  ATTEND <-->|"attendance records"| D8
  ATTEND -->|"student/class context"| D3
  ATTEND -->|"class/subject context"| D4
  ATTEND --> D5
  ATTEND --> D6

  ASSESS <-->|"assessment definitions"| D9
  ASSESS <-->|"student scores"| D10
  ASSESS -->|"student/class/subject context"| D3
  ASSESS --> D4
  ASSESS --> D5
  ASSESS --> D6
  ASSESS -->|"import template/export"| F3

  GRADING -->|"read scores"| D10
  GRADING -->|"read scales"| D11
  GRADING -->|"attendance summary"| D8
  GRADING <-->|"create/publish reports"| D12
  GRADING -->|"PDF report card"| F2

  REPORTING -->|"attendance analytics"| D8
  REPORTING -->|"performance analytics"| D10
  REPORTING -->|"student/class counts"| D3
  REPORTING --> D4
  REPORTING -->|"export reports"| F3

  ADMINPROC <-->|"school configuration"| D13
  ADMINPROC <-->|"user notifications"| D14
  ADMINPROC -->|"write activity trail"| D15
  AUTH -->|"login/access logs"| D15
  ACADEMIC -->|"write activity logs"| D15
  ATTEND -->|"write activity logs"| D15
  ASSESS -->|"write activity logs"| D15
  GRADING -->|"write activity logs"| D15
  ADMINPROC -->|"logo upload"| F1

  API -->|"JSON responses,<br/>files, errors"| UI
```

## Entity Relationship Diagram

```mermaid
erDiagram
  SCHOOL_SETTING {
    ObjectId _id PK
    string schoolName
    string schoolCode UK
    object address
    string phone
    string email
    string website
    string logo
    string motto
    string principalName
    string gradingSystem
    object academicYearConfig
    object reportCardConfig
    number sessionTimeout
    string theme
    string timezone
    string locale
  }

  USER {
    ObjectId _id PK
    string email UK
    string password
    string role
    string firstName
    string lastName
    string phone
    boolean isActive
    date lastLogin
    date passwordChangedAt
    ObjectId schoolId FK
  }

  TEACHER {
    ObjectId _id PK
    ObjectId user FK
    string employeeId UK
    string firstName
    string lastName
    string gender
    date dateOfBirth
    array qualifications
    array subjects FK
    ObjectId classAssigned FK
    string designation
    object emergencyContact
    object address
    array documents
  }

  STUDENT {
    ObjectId _id PK
    ObjectId user FK
    string admissionNumber UK
    string firstName
    string lastName
    string gender
    date dateOfBirth
    ObjectId class FK
    ObjectId stream FK
    object guardianInfo
    string address
    string emergencyContact
    string medicalInfo
    string passportPhoto
    date enrollmentDate
    string status
    array academicHistory
    string previousSchool
    object schoolFees
  }

  ACADEMIC_YEAR {
    ObjectId _id PK
    string name
    string year
    date startDate
    date endDate
    boolean isCurrent
    array terms FK
  }

  TERM {
    ObjectId _id PK
    string name
    ObjectId academicYear FK
    date startDate
    date endDate
    boolean isCurrent
    array examCategories FK
  }

  CLASS {
    ObjectId _id PK
    string name
    string code UK
    string description
    string department
    ObjectId academicYear FK
    ObjectId classTeacher FK
    number capacity
    array streams FK
    array subjects FK
  }

  STREAM {
    ObjectId _id PK
    string name
    string code UK
    ObjectId class FK
    string description
  }

  SUBJECT {
    ObjectId _id PK
    string name
    string code UK
    string description
    string department
    string category
    number credits
  }

  TEACHER_ASSIGNMENT {
    ObjectId _id PK
    ObjectId teacher FK
    ObjectId class FK
    ObjectId subject FK
    ObjectId stream FK
    ObjectId academicYear FK
    ObjectId term FK
    string teacherRole
    boolean isClassTeacher
    ObjectId assignedBy FK
  }

  ATTENDANCE {
    ObjectId _id PK
    ObjectId student FK
    ObjectId teacher FK
    ObjectId class FK
    ObjectId subject FK
    date date
    date timeIn
    date timeOut
    string status
    string remarks
    string deviceUsed
    object location
    ObjectId academicYear FK
    ObjectId term FK
    ObjectId markedBy FK
  }

  ASSESSMENT {
    ObjectId _id PK
    string name
    string code UK
    string type
    number weight
    ObjectId academicYear FK
    ObjectId term FK
    ObjectId subject FK
    ObjectId class FK
    ObjectId stream FK
    number maxScore
    date examDate
    number duration
    string instructions
    ObjectId createdBy FK
    string status
    date releaseDate
    boolean isRequired
  }

  MARK {
    ObjectId _id PK
    ObjectId student FK
    ObjectId assessment FK
    ObjectId subject FK
    ObjectId class FK
    ObjectId stream FK
    ObjectId academicYear FK
    ObjectId term FK
    number score
    number totalScore
    string grade
    number gradePoint
    string remarks
    ObjectId gradedBy FK
    boolean isApproved
    ObjectId approvedBy FK
    date approvedAt
    boolean isMissing
    date submittedAt
  }

  GRADE_SCALE {
    ObjectId _id PK
    string name
    string code
    number minScore
    number maxScore
    number gradePoint
    string description
    string remark
    string system
    boolean isActive
  }

  REPORT_CARD {
    ObjectId _id PK
    ObjectId student FK
    ObjectId academicYear FK
    ObjectId term FK
    ObjectId class FK
    ObjectId stream FK
    array subjects FK
    number totalScore
    number averageScore
    string grade
    number gradePoint
    number position
    number classSize
    object attendanceSummary
    string teacherRemarks
    string headteacherRemarks
    ObjectId generatedBy FK
    date generatedAt
    boolean isPublished
    string qrCode
    string templateVersion
  }

  NOTIFICATION {
    ObjectId _id PK
    ObjectId recipient FK
    string type
    string title
    string message
    boolean isRead
    string link
    ObjectId sentBy FK
    date createdAt
  }

  AUDIT_LOG {
    ObjectId _id PK
    ObjectId user FK
    string action
    string resource
    string resourceId
    mixed details
    string ipAddress
    string userAgent
    date timestamp
  }

  SCHOOL_SETTING ||--o{ USER : schoolId
  USER ||--o| TEACHER : teacher_profile
  USER ||--o| STUDENT : student_profile
  USER ||--o{ TEACHER_ASSIGNMENT : assignedBy
  USER ||--o{ ASSESSMENT : createdBy
  USER ||--o{ MARK : grades_or_approves
  USER ||--o{ ATTENDANCE : markedBy
  USER ||--o{ REPORT_CARD : generatedBy
  USER ||--o{ NOTIFICATION : receives
  USER ||--o{ NOTIFICATION : sends
  USER ||--o{ AUDIT_LOG : performs

  ACADEMIC_YEAR ||--o{ TERM : contains
  ACADEMIC_YEAR ||--o{ CLASS : organizes
  ACADEMIC_YEAR ||--o{ TEACHER_ASSIGNMENT : scopes
  ACADEMIC_YEAR ||--o{ ATTENDANCE : scopes
  ACADEMIC_YEAR ||--o{ ASSESSMENT : scopes
  ACADEMIC_YEAR ||--o{ MARK : scopes
  ACADEMIC_YEAR ||--o{ REPORT_CARD : scopes

  TERM ||--o{ TEACHER_ASSIGNMENT : scopes
  TERM ||--o{ ATTENDANCE : scopes
  TERM ||--o{ ASSESSMENT : contains
  TERM ||--o{ MARK : scopes
  TERM ||--o{ REPORT_CARD : scopes

  TEACHER ||--o{ CLASS : classTeacher
  TEACHER ||--o{ TEACHER_ASSIGNMENT : receives
  TEACHER }o--o{ SUBJECT : subject_list
  TEACHER ||--o{ ATTENDANCE : records

  CLASS ||--o{ STREAM : has
  CLASS ||--o{ STUDENT : enrolls
  CLASS }o--o{ SUBJECT : offers
  CLASS ||--o{ TEACHER_ASSIGNMENT : assigned_in
  CLASS ||--o{ ATTENDANCE : attendance_for
  CLASS ||--o{ ASSESSMENT : assessment_for
  CLASS ||--o{ MARK : marks_for
  CLASS ||--o{ REPORT_CARD : reports_for

  STREAM ||--o{ STUDENT : groups
  STREAM ||--o{ TEACHER_ASSIGNMENT : assigned_in
  STREAM ||--o{ ATTENDANCE : attendance_for
  STREAM ||--o{ ASSESSMENT : assessment_for
  STREAM ||--o{ MARK : marks_for
  STREAM ||--o{ REPORT_CARD : reports_for

  SUBJECT ||--o{ TEACHER_ASSIGNMENT : assigned
  SUBJECT ||--o{ ATTENDANCE : attendance_for
  SUBJECT ||--o{ ASSESSMENT : tested_by
  SUBJECT ||--o{ MARK : marks_for
  SUBJECT }o--o{ REPORT_CARD : subject_results

  STUDENT ||--o{ ATTENDANCE : has
  STUDENT ||--o{ MARK : receives
  STUDENT ||--o{ REPORT_CARD : has

  ASSESSMENT ||--o{ MARK : has
  GRADE_SCALE ||..o{ MARK : used_to_calculate
  MARK }o..o{ REPORT_CARD : summarized_into
```

## Key Notes

- MongoDB stores these as Mongoose documents with `ObjectId` references and embedded objects/arrays, not SQL foreign keys.
- Compound unique indexes exist for `TeacherAssignment(teacher, class, subject)`, `Mark(student, assessment)`, and `ReportCard(student, academicYear, term)`.
- `ReportCard.subjects`, `ReportCard.attendanceSummary`, `Student.guardianInfo`, `Student.academicHistory`, `Teacher.qualifications`, and several settings fields are embedded structures.
- `GradeScale` is not referenced by `Mark`; it is used by the grading engine to derive `grade` and `gradePoint`.
