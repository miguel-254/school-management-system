const gradingEngine = {
  calculateGrade(score, gradeScales) {
    if (!gradeScales || gradeScales.length === 0) {
      return { grade: 'N/A', gradePoint: 0, remarks: 'No grade scale defined' };
    }

    const sortedScales = [...gradeScales].sort((a, b) => b.minScore - a.minScore);

    for (const scale of sortedScales) {
      if (score >= scale.minScore && score <= scale.maxScore) {
        return {
          grade: scale.code,
          gradePoint: scale.gradePoint,
          remarks: scale.remark || scale.description || '',
        };
      }
    }

    const lowest = sortedScales[sortedScales.length - 1];
    if (score < lowest.minScore) {
      return {
        grade: lowest.code,
        gradePoint: lowest.gradePoint,
        remarks: lowest.remark || lowest.description || '',
      };
    }

    const highest = sortedScales[0];
    if (score > highest.maxScore) {
      return {
        grade: highest.code,
        gradePoint: highest.gradePoint,
        remarks: highest.remark || highest.description || '',
      };
    }

    return { grade: 'N/A', gradePoint: 0, remarks: 'Unable to determine grade' };
  },

  calculateSubjectAverage(marks) {
    if (!marks || marks.length === 0) return 0;

    const totalScore = marks.reduce((sum, mark) => {
      const score = typeof mark.score === 'number' ? mark.score : 0;
      return sum + score;
    }, 0);

    return parseFloat((totalScore / marks.length).toFixed(2));
  },

  calculateClassAverage(students, subject) {
    if (!students || students.length === 0) return 0;

    const scores = students
      .map((student) => {
        if (!student.marks || student.marks.length === 0) return null;
        if (subject) {
          const subjectMark = student.marks.find((m) => {
            const subId = typeof m.subject === 'object' && m.subject ? m.subject._id || m.subject.toString() : m.subject;
            const targetId = typeof subject === 'object' && subject ? subject._id || subject.toString() : subject;
            return subId && targetId && subId.toString() === targetId.toString();
          });
          return subjectMark ? subjectMark.score : null;
        }
        const scores = student.marks.filter((m) => typeof m.score === 'number').map((m) => m.score);
        return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      })
      .filter((score) => score !== null);

    if (scores.length === 0) return 0;

    return parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
  },

  calculatePosition(students, subject) {
    if (!students || students.length === 0) return [];

    const scored = students.map((student) => {
      let score = 0;
      let hasScore = false;

      if (subject && student.marks) {
        const mark = student.marks.find((m) => {
          const subId = typeof m.subject === 'object' && m.subject ? m.subject._id || m.subject.toString() : m.subject;
          const targetId = typeof subject === 'object' && subject ? subject._id || subject.toString() : subject;
          return subId && targetId && subId.toString() === targetId.toString();
        });
        if (mark && typeof mark.score === 'number') {
          score = mark.score;
          hasScore = true;
        }
      } else if (student.average !== undefined && student.average !== null) {
        score = student.average;
        hasScore = true;
      }

      return { student, score, hasScore };
    });

    const ranked = scored
      .filter((s) => s.hasScore)
      .sort((a, b) => b.score - a.score);

    let currentRank = 1;
    let currentScore = ranked.length > 0 ? ranked[0].score : null;

    return ranked.map((entry, index) => {
      if (entry.score !== currentScore) {
        currentRank = index + 1;
        currentScore = entry.score;
      }
      return {
        student: entry.student,
        score: entry.score,
        position: currentRank,
      };
    });
  },

  calculateOverallPosition(allStudents) {
    if (!allStudents || allStudents.length === 0) return [];

    const withAverage = allStudents.map((student) => {
      let average = student.average;
      if (average === undefined || average === null) {
        average = gradingEngine.calculateSubjectAverage(student.marks || []);
      }
      return { student, average: typeof average === 'number' ? average : 0 };
    });

    const ranked = withAverage.sort((a, b) => b.average - a.average);

    let currentRank = 1;
    let currentAvg = ranked.length > 0 ? ranked[0].average : null;

    return ranked.map((entry, index) => {
      if (entry.average !== currentAvg) {
        currentRank = index + 1;
        currentAvg = entry.average;
      }
      return {
        student: entry.student,
        average: entry.average,
        position: currentRank,
      };
    });
  },

  calculateGPA(grades) {
    if (!grades || grades.length === 0) return 0;

    const totalPoints = grades.reduce((sum, g) => {
      const gp = typeof g.gradePoint === 'number' ? g.gradePoint : 0;
      const credits = typeof g.credits === 'number' ? g.credits : 1;
      return sum + gp * credits;
    }, 0);

    const totalCredits = grades.reduce((sum, g) => {
      const credits = typeof g.credits === 'number' ? g.credits : 1;
      return sum + credits;
    }, 0);

    if (totalCredits === 0) return 0;

    return parseFloat((totalPoints / totalCredits).toFixed(2));
  },

  calculateMeanScore(scores) {
    if (!scores || scores.length === 0) return 0;

    const validScores = scores.filter((s) => typeof s === 'number' && !isNaN(s));
    if (validScores.length === 0) return 0;

    return parseFloat((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2));
  },

  generateRemarks(average, gradeScale) {
    if (!gradeScale) {
      if (average >= 80) return 'Excellent performance. Keep it up!';
      if (average >= 70) return 'Very good performance. Keep striving for excellence.';
      if (average >= 60) return 'Good performance. Room for improvement.';
      if (average >= 50) return 'Fair performance. Needs more effort.';
      if (average >= 40) return 'Below average. Significant improvement needed.';
      return 'Poor performance. Urgent attention required.';
    }

    return gradeScale.remark || gradeScale.description || 'Performance recorded.';
  },

  detectMissingMarks(students, assessments, marks = []) {
    if (!students || !assessments || students.length === 0 || assessments.length === 0) return [];

    const missing = [];

    for (const student of students) {
      const studentId = student._id || student;

      for (const assessment of assessments) {
        const assessmentId = assessment._id || assessment;
        const hasMark = marks.some((mark) => {
          const markStudentId = typeof mark.student === 'object' && mark.student
            ? mark.student._id || mark.student.toString()
            : mark.student;
          const markAssessmentId = typeof mark.assessment === 'object' && mark.assessment
            ? mark.assessment._id || mark.assessment.toString()
            : mark.assessment;
          return markStudentId
            && markStudentId.toString() === studentId.toString()
            && markAssessmentId
            && markAssessmentId.toString() === assessmentId.toString();
        });

        if (!hasMark) {
          missing.push({
            student: studentId,
            assessment: assessmentId,
            studentName: student.firstName && student.lastName
              ? `${student.firstName} ${student.lastName}`
              : undefined,
            assessmentName: assessment.name || undefined,
          });
        }
      }
    }

    return missing;
  },

  calculateAttendancePercentage(total, present) {
    if (!total || total <= 0) return 0;
    if (present < 0) return 0;

    return parseFloat(((present / total) * 100).toFixed(2));
  },
};

module.exports = gradingEngine;
