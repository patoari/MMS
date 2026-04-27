<?php
/**
 * Route dispatcher
 * Matches METHOD + URI pattern and calls the right controller method.
 */

require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/StudentController.php';
require_once __DIR__ . '/../controllers/TeacherController.php';
require_once __DIR__ . '/../controllers/FeeController.php';
require_once __DIR__ . '/../controllers/ExamController.php';
require_once __DIR__ . '/../controllers/ResultController.php';
require_once __DIR__ . '/../controllers/SalaryController.php';
require_once __DIR__ . '/../controllers/SalaryReceiptController.php';
require_once __DIR__ . '/../controllers/NoticeController.php';
require_once __DIR__ . '/../controllers/RoutineController.php';
require_once __DIR__ . '/../controllers/GalleryController.php';
require_once __DIR__ . '/../controllers/SettingsController.php';
require_once __DIR__ . '/../controllers/SubjectController.php';
require_once __DIR__ . '/../controllers/ReceiptController.php';
require_once __DIR__ . '/../controllers/LogoController.php';
require_once __DIR__ . '/../controllers/SiteFeaturesController.php';
require_once __DIR__ . '/../controllers/HomepageTeacherController.php';
require_once __DIR__ . '/../controllers/HomepageGalleryController.php';
require_once __DIR__ . '/../controllers/StudentWritingController.php';
require_once __DIR__ . '/../controllers/PromotionController.php';
require_once __DIR__ . '/../controllers/TransactionController.php';
require_once __DIR__ . '/../controllers/UserController.php';
require_once __DIR__ . '/../controllers/ClassController.php';
require_once __DIR__ . '/../controllers/SessionController.php';
require_once __DIR__ . '/../controllers/SearchController.php';
require_once __DIR__ . '/../controllers/CommitteeController.php';
require_once __DIR__ . '/../controllers/AttendanceController.php';
require_once __DIR__ . '/../controllers/HolidayController.php';

function dispatch(string $method, string $uri): void {
    // strip query string, then strip everything up to and including /api
    $path = preg_replace('/\?.*$/', '', $uri);
    $path = preg_replace('#^.*/api#', '', $path);
    $path = rtrim($path, '/') ?: '/';

    $routes = [
        // AUTH
        ['POST', 'auth/login',          fn() => (new AuthController)->login()],
        ['POST', 'auth/register',       fn() => (new AuthController)->register()],
        ['POST', 'auth/student-login',  fn() => (new AuthController)->studentLogin()],
        ['GET',  'auth/me',             fn() => (new AuthController)->me()],

        // CLASSES & SUBJECTS
        ['GET',    'classes',                    fn()    => (new ClassController)->index()],
        ['POST',   'classes',                    fn()    => (new ClassController)->store()],
        ['PUT',    'classes/{id}',               fn($p)  => (new ClassController)->update((int)$p['id'])],
        ['DELETE', 'classes/{id}',               fn($p)  => (new ClassController)->destroy((int)$p['id'])],
        ['PUT',    'classes/{id}/sections',      fn($p)  => (new ClassController)->storeSections((int)$p['id'])],
        ['GET',    'class-subjects',      fn()    => (new SubjectController)->index()],
        ['POST',   'class-subjects',      fn()    => (new SubjectController)->store()],
        ['PUT',    'class-subjects/{id}/teacher', fn($p) => (new SubjectController)->updateTeacher((int)$p['id'])],
        ['DELETE', 'class-subjects/{id}', fn($p)  => (new SubjectController)->destroy((int)$p['id'])],

        // STUDENTS
        ['GET',    'students',        fn() => (new StudentController)->index()],
        ['POST',   'students',        fn() => (new StudentController)->store()],
        ['GET',    'students/me',     fn() => (new StudentController)->me()],
        ['GET',    'students/{id}',   fn($p) => (new StudentController)->show($p['id'])],
        ['PUT',    'students/{id}',   fn($p) => (new StudentController)->update($p['id'])],
        ['POST',   'students/{id}',   fn($p) => (new StudentController)->update($p['id'])], // Support POST for file uploads
        ['PUT',    'students/{id}/restore', fn($p) => (new StudentController)->restore($p['id'])],
        ['DELETE', 'students/{id}',   fn($p) => (new StudentController)->destroy($p['id'])],

        // TEACHERS
        ['GET',    'teachers',        fn() => (new TeacherController)->index()],
        ['POST',   'teachers',        fn() => (new TeacherController)->store()],
        ['GET',    'teachers/me',     fn() => (new TeacherController)->me()],
        ['PUT',    'teachers/{id}',   fn($p) => (new TeacherController)->update($p['id'])],
        ['PUT',    'teachers/{id}/link-user', fn($p) => (new TeacherController)->linkUser($p['id'])],
        ['PUT',    'teachers/{id}/restore',   fn($p) => (new TeacherController)->restore($p['id'])],
        ['DELETE', 'teachers/{id}',   fn($p) => (new TeacherController)->destroy($p['id'])],

        // FEES
        ['GET',  'fees',                        fn() => (new FeeController)->index()],
        ['POST', 'fees',                        fn() => (new FeeController)->store()],
        ['POST', 'fees/generate-monthly',       fn() => (new FeeController)->generateMonthly()],
        ['GET',  'fees/due-collections',        fn() => (new FeeController)->dueCollections()],
        ['PUT',  'fees/{id}',                   fn($p) => (new FeeController)->update($p['id'])],
        ['GET',  'fees/summary',                fn() => (new FeeController)->summary()],
        ['GET',  'fees/my',                     fn() => (new FeeController)->myFees()],
        ['GET',  'fees/my-admit-cards',         fn() => (new FeeController)->myAdmitCards()],
        ['GET',  'fees/student/{id}',           fn($p) => (new FeeController)->byStudent($p['id'])],
        ['POST', 'fees/{id}/collect',           fn($p) => (new FeeController)->collect($p['id'])],
        ['GET',  'fee-settings',                fn() => (new FeeController)->getSettings()],
        ['PUT',  'fee-settings/{classId}',      fn($p) => (new FeeController)->updateSettings((int)$p['classId'])],

        // EXAMS
        ['GET',    'exams',       fn() => (new ExamController)->index()],
        ['GET',    'exams/all',   fn() => (new ExamController)->all()],
        ['POST',   'exams',       fn() => (new ExamController)->store()],
        ['PUT',    'exams/{id}',  fn($p) => (new ExamController)->update($p['id'])],
        ['DELETE', 'exams/{id}',  fn($p) => (new ExamController)->destroy($p['id'])],

        // RESULTS
        ['POST', 'results/bulk',          fn() => (new ResultController)->bulkStore()],
        ['POST', 'results/submit',        fn() => (new ResultController)->submitMarks()],
        ['POST', 'results/publish',       fn() => (new ResultController)->publishMarks()],
        ['GET',  'results/my',            fn() => (new ResultController)->myResults()],
        ['GET',  'results/check',         fn() => (new ResultController)->check()],
        ['GET',  'results/pending',       fn() => (new ResultController)->pendingMarks()],
        ['GET',  'results/exam/{examId}', fn($p) => (new ResultController)->byExam($p['examId'])],

        // SALARIES
        ['GET',  'salaries',              fn() => (new SalaryController)->index()],
        ['POST', 'salaries',              fn() => (new SalaryController)->store()],
        ['POST', 'salaries/generate',     fn() => (new SalaryController)->generate()],
        ['GET',  'salaries/summary',      fn() => (new SalaryController)->summary()],
        ['POST', 'salaries/{id}/pay',     fn($p) => (new SalaryController)->pay($p['id'])],

        // SALARY RECEIPTS
        ['GET',  'salary-receipts',                    fn() => (new SalaryReceiptController)->index()],
        ['POST', 'salary-receipts',                    fn() => (new SalaryReceiptController)->store()],
        ['GET',  'salary-receipts/search/{number}',    fn($p) => (new SalaryReceiptController)->search($p['number'])],
        ['GET',  'salary-receipts/{id}',               fn($p) => (new SalaryReceiptController)->show($p['id'])],

        // NOTICES
        ['GET',    'notices',              fn() => (new NoticeController)->index()],
        ['POST',   'notices',              fn() => (new NoticeController)->store()],
        ['PUT',    'notices/{id}',         fn($p) => (new NoticeController)->update((int)$p['id'])],
        ['POST',   'notices/{id}/approve', fn($p) => (new NoticeController)->approve((int)$p['id'])],
        ['DELETE', 'notices/{id}',         fn($p) => (new NoticeController)->destroy((int)$p['id'])],

        // ROUTINES
        ['GET',  'class-routine',                  fn() => (new RoutineController)->classRoutine()],
        ['POST', 'class-routine',                  fn() => (new RoutineController)->storeClassRoutine()],
        ['POST', 'class-routine/publish',          fn() => (new RoutineController)->publishClassRoutine()],
        ['GET',  'class-routine/teacher-subjects', fn() => (new RoutineController)->teacherSubjects()],
        ['GET',  'exam-routine',           fn() => (new RoutineController)->examRoutine()],
        ['GET',  'exam-routine/list',      fn() => (new RoutineController)->listExamRoutines()],
        ['POST', 'exam-routine',           fn() => (new RoutineController)->storeExamRoutine()],
        ['POST', 'exam-routine/publish',   fn() => (new RoutineController)->publishExamRoutine()],

        // GALLERY
        ['GET',    'gallery',      fn() => (new GalleryController)->index()],
        ['POST',   'gallery',      fn() => (new GalleryController)->store()],
        ['DELETE', 'gallery/{id}', fn($p) => (new GalleryController)->destroy((int)$p['id'])],

        // SITE SETTINGS
        ['GET', 'settings',      fn() => (new SettingsController)->index()],
        ['PUT', 'settings',      fn() => (new SettingsController)->update()],
        ['POST','settings/logo', fn() => (new LogoController)->upload()],

        // SITE FEATURES
        ['GET',    'site-features',      fn()    => (new SiteFeaturesController)->index()],
        ['POST',   'site-features',      fn()    => (new SiteFeaturesController)->store()],
        ['PUT',    'site-features/{id}', fn($p)  => (new SiteFeaturesController)->update((int)$p['id'])],
        ['DELETE', 'site-features/{id}', fn($p)  => (new SiteFeaturesController)->destroy((int)$p['id'])],

        // STUDENT WRITINGS
        ['GET',    'student-writings',      fn()   => (new StudentWritingController)->index()],
        ['GET',    'student-writings/all',  fn()   => (new StudentWritingController)->all()],
        ['POST',   'student-writings',      fn()   => (new StudentWritingController)->store()],
        ['PUT',    'student-writings/{id}', fn($p) => (new StudentWritingController)->update((int)$p['id'])],
        ['DELETE', 'student-writings/{id}', fn($p) => (new StudentWritingController)->destroy((int)$p['id'])],

        // HOMEPAGE GALLERY (separate from hero carousel gallery)
        ['GET',    'homepage-gallery',      fn()   => (new HomepageGalleryController)->index()],
        ['POST',   'homepage-gallery',      fn()   => (new HomepageGalleryController)->store()],
        ['DELETE', 'homepage-gallery/{id}', fn($p) => (new HomepageGalleryController)->destroy((int)$p['id'])],
        ['GET',    'homepage-teachers',        fn()   => (new HomepageTeacherController)->index()],
        ['POST',   'homepage-teachers',        fn()   => (new HomepageTeacherController)->store()],
        ['POST',   'homepage-teachers/upload', fn()   => (new HomepageTeacherController)->uploadPhoto()],
        ['PUT',    'homepage-teachers/{id}',   fn($p) => (new HomepageTeacherController)->update((int)$p['id'])],
        ['DELETE', 'homepage-teachers/{id}',   fn($p) => (new HomepageTeacherController)->destroy((int)$p['id'])],

        // TRANSACTIONS (general income/expense ledger)
        ['GET',    'transactions',         fn()    => (new TransactionController)->index()],
        ['POST',   'transactions',         fn()    => (new TransactionController)->store()],
        ['DELETE', 'transactions/{id}',    fn($p)  => (new TransactionController)->destroy((int)$p['id'])],
        ['GET',    'transactions/summary', fn()    => (new TransactionController)->summary()],
        ['GET',    'transactions/ledger',         fn()    => (new TransactionController)->ledger()],
        ['GET',    'transactions/monthly-report', fn()    => (new TransactionController)->monthlyReport()],

        // RECEIPTS
        ['GET',  'receipts',          fn() => (new ReceiptController)->index()],
        ['POST', 'receipts',          fn() => (new ReceiptController)->store()],
        ['GET',  'receipts/{no}',     fn($p) => (new ReceiptController)->show($p['no'])],

        // USERS (role management)
        ['GET', 'users',                  fn()    => (new UserController)->index()],
        ['PUT', 'users/{id}/role',        fn($p)  => (new UserController)->updateRole((int)$p['id'])],
        ['PUT', 'users/{id}/reset-password', fn($p) => (new UserController)->resetPassword((int)$p['id'])],
        ['DELETE', 'users/{id}',          fn($p)  => (new UserController)->destroy((int)$p['id'])],

        // PROMOTIONS
        ['GET',  'promotions',              fn() => (new PromotionController)->index()],
        ['POST', 'promotions',              fn() => (new PromotionController)->run()],
        ['POST', 'promotions/manual',       fn() => (new PromotionController)->manualPromote()],
        ['POST', 'promotions/demote',       fn() => (new PromotionController)->demote()],
        ['GET',  'promotions/annual-exams', fn() => (new PromotionController)->annualExams()],
        ['PUT',  'promotions/mark-annual',  fn() => (new PromotionController)->markAnnual()],

        // ACADEMIC SESSIONS
        ['GET',  'sessions',                   fn()   => (new SessionController)->index()],
        ['GET',  'sessions/all',               fn()   => (new SessionController)->all()],
        ['GET',  'sessions/current',           fn()   => (new SessionController)->current()],
        ['POST', 'sessions',                   fn()   => (new SessionController)->store()],
        ['PUT',  'sessions/{id}',              fn($p) => (new SessionController)->update((int)$p['id'])],
        ['POST', 'sessions/{id}/activate',     fn($p) => (new SessionController)->activate((int)$p['id'])],
        ['POST', 'sessions/{id}/lock',         fn($p) => (new SessionController)->lock((int)$p['id'])],
        ['POST', 'sessions/{id}/snapshot',     fn($p) => (new SessionController)->snapshot((int)$p['id'])],
        ['GET',  'sessions/{id}/students',     fn($p) => (new SessionController)->sessionStudents((int)$p['id'])],
        ['GET',  'sessions/{id}/teachers',     fn($p) => (new SessionController)->sessionTeachers((int)$p['id'])],
        ['GET',  'sessions/{id}/fees',         fn($p) => (new SessionController)->sessionFees((int)$p['id'])],
        ['GET',  'sessions/{id}/statistics',   fn($p) => (new SessionController)->statistics((int)$p['id'])],

        // CROSS-SESSION SEARCH
        ['GET',  'search/students',            fn()   => (new SearchController)->searchStudents()],
        ['GET',  'search/results',             fn()   => (new SearchController)->searchResults()],
        ['GET',  'search/receipts',            fn()   => (new SearchController)->searchReceipts()],
        ['GET',  'search/fees',                fn()   => (new SearchController)->searchFees()],
        ['GET',  'search/student-history',     fn()   => (new SearchController)->studentHistory()],

        // COMMITTEE MEMBERS
        ['GET',    'committee-members',        fn()   => (new CommitteeController)->index()],
        ['GET',    'committee-members/all',    fn()   => (new CommitteeController)->all()],
        ['POST',   'committee-members',        fn()   => (new CommitteeController)->store()],
        ['POST',   'committee-members/upload', fn()   => (new CommitteeController)->uploadPhoto()],
        ['PUT',    'committee-members/{id}',   fn($p) => (new CommitteeController)->update($p['id'])],
        ['PUT',    'committee-members/{id}/toggle', fn($p) => (new CommitteeController)->toggle($p['id'])],
        ['DELETE', 'committee-members/{id}',   fn($p) => (new CommitteeController)->destroy($p['id'])],

        // ATTENDANCE
        ['GET',  'attendance',                fn() => (new AttendanceController)->index()],
        ['POST', 'attendance',                fn() => (new AttendanceController)->store()],
        ['GET',  'attendance/report',         fn() => (new AttendanceController)->report()],
        ['GET',  'attendance/dates',          fn() => (new AttendanceController)->dates()],
        ['GET',  'attendance/summary',        fn() => (new AttendanceController)->summary()],
        ['GET',  'attendance/student-stats',  fn() => (new AttendanceController)->studentStats()],

        // HOLIDAYS
        ['GET',    'holidays',          fn()    => (new HolidayController)->index()],
        ['POST',   'holidays',          fn()    => (new HolidayController)->store()],
        ['GET',    'holidays/check',    fn()    => (new HolidayController)->check()],
        ['DELETE', 'holidays/{date}',   fn($p)  => (new HolidayController)->destroy($p['date'])],
    ];

    foreach ($routes as [$routeMethod, $routePattern, $handler]) {
        if ($routeMethod !== $method) continue;
        $params = matchRoute($routePattern, $path);
        if ($params !== null) { $handler($params); return; }
    }

    Response::error('Route not found', 404);
}

function matchRoute(string $pattern, string $path): ?array {
    $path    = ltrim($path, '/');
    $pattern = ltrim($pattern, '/');
    $regex   = preg_replace('/\{(\w+)\}/', '(?P<$1>[^/]+)', $pattern);
    if (preg_match("#^$regex$#", $path, $m)) {
        return array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);
    }
    return null;
}
