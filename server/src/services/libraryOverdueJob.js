const LibraryLoan = require('../models/LibraryLoan');
const Student = require('../models/Student');
const User = require('../models/User');
const { sendNotificationToMany } = require('../utils/notificationService');

const checkOverdueLoans = async () => {
  try {
    const overdueLoans = await LibraryLoan.find({
      status: 'issued',
      overdueNotified: false,
      dueDate: { $lt: new Date() },
    }).select('book borrowerType student borrowerUser borrowerName issuedBy dueDate');

    if (overdueLoans.length === 0) return;

    const libraryStaff = await User.find({ role: { $in: ['librarian', 'headteacher'] } }).distinct('_id');
    const staffUserIds = libraryStaff.map((id) => id.toString());

    const studentIds = [...new Set(overdueLoans.filter((l) => l.borrowerType === 'student' && l.student).map((l) => l.student.toString()))];
    const students = studentIds.length > 0
      ? await Student.find({ _id: { $in: studentIds } }).select('user')
      : [];
    const studentUserMap = new Map(students.map((s) => [s._id.toString(), s.user?.toString()]));

    for (const loan of overdueLoans) {
      const overdueDays = Math.max(Math.ceil((new Date() - loan.dueDate) / (24 * 60 * 60 * 1000)), 1);

      let borrowerUser = loan.borrowerUser?.toString();
      if (!borrowerUser && loan.student) {
        borrowerUser = studentUserMap.get(loan.student.toString());
      }

      const recipients = [
        ...(borrowerUser ? [borrowerUser] : []),
        ...staffUserIds,
      ];

      await sendNotificationToMany({
        recipients,
        type: 'general',
        title: 'Overdue book',
        message: `"${loan.borrowerName || 'A borrower'}" has a book ${overdueDays} day(s) past the ${loan.dueDate.toLocaleDateString()} due date`,
        link: '/library/loans',
        sentBy: loan.issuedBy || undefined,
      });
    }

    await LibraryLoan.updateMany(
      { _id: { $in: overdueLoans.map((l) => l._id) } },
      { $set: { overdueNotified: true } }
    );

    console.log(`[overdue-job] Notified for ${overdueLoans.length} overdue loan(s)`);
  } catch (error) {
    console.error('[overdue-job] Failed:', error.message);
  }
};

const startOverdueJob = () => {
  const INTERVAL_MS = 6 * 60 * 60 * 1000;
  setTimeout(checkOverdueLoans, 60 * 1000);
  setInterval(checkOverdueLoans, INTERVAL_MS);
};

module.exports = { checkOverdueLoans, startOverdueJob };
