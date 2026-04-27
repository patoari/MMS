-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 25, 2026 at 06:34 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `madrasah_mms`
--

DELIMITER $$
--
-- Procedures
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `create_session_snapshot` (IN `p_session_id` SMALLINT UNSIGNED)   BEGIN
  -- Snapshot students
  INSERT INTO student_session_history (student_id, session_id, class_id, roll, section, status)
  SELECT id, session_id, class_id, roll, section, status
  FROM students
  WHERE session_id = p_session_id AND deleted_at IS NULL;
  
  -- Snapshot teachers
  INSERT INTO teacher_session_history (teacher_id, session_id, designation, salary, status)
  SELECT id, session_id, designation, salary, status
  FROM teachers
  WHERE session_id = p_session_id AND deleted_at IS NULL;
  
  SELECT CONCAT('Snapshot created for session ID: ', p_session_id) AS message;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `get_session_statistics` (IN `p_session_id` SMALLINT UNSIGNED)   BEGIN
  SELECT 
    (SELECT COUNT(*) FROM students WHERE session_id = p_session_id AND deleted_at IS NULL) AS total_students,
    (SELECT COUNT(*) FROM teachers WHERE session_id = p_session_id AND deleted_at IS NULL) AS total_teachers,
    (SELECT COUNT(*) FROM exams WHERE session_id = p_session_id) AS total_exams,
    (SELECT COUNT(*) FROM fees WHERE session_id = p_session_id) AS total_fees,
    (SELECT SUM(amount) FROM fees WHERE session_id = p_session_id) AS total_fee_amount,
    (SELECT SUM(paid) FROM fees WHERE session_id = p_session_id) AS total_paid_amount,
    (SELECT COUNT(*) FROM results WHERE session_id = p_session_id) AS total_results,
    (SELECT COUNT(*) FROM payment_receipts WHERE session_id = p_session_id) AS total_receipts;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `promote_students` (IN `p_exam_id` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, IN `p_academic_year` YEAR)   BEGIN
  DECLARE v_class_id SMALLINT UNSIGNED;
  DECLARE v_pass_pct TINYINT UNSIGNED;

  -- Get the class and pass mark for this exam
  SELECT `class_id`, `pass_mark_percent`
    INTO v_class_id, v_pass_pct
    FROM `exams`
   WHERE `id` = p_exam_id
   LIMIT 1;

  -- Clear any previous promotion data for this exam
  DELETE FROM `promotions` WHERE `exam_id` = p_exam_id;

  -- Insert promotion records with rank, pass/fail per student
  INSERT INTO `promotions` (
    `student_id`, `exam_id`, `from_class_id`,
    `total_marks`, `total_obtained`,
    `subjects_passed`, `subjects_total`,
    `is_promoted`, `academic_year`
  )
  SELECT
    r.student_id,
    p_exam_id,
    v_class_id,
    SUM(r.total_marks)   AS total_marks,
    SUM(r.obtained)      AS total_obtained,
    SUM(CASE WHEN (r.obtained / r.total_marks * 100) >= v_pass_pct THEN 1 ELSE 0 END) AS subjects_passed,
    COUNT(r.id)          AS subjects_total,
    -- Promoted only if passed ALL subjects
    CASE WHEN MIN(r.obtained / r.total_marks * 100) >= v_pass_pct THEN 1 ELSE 0 END AS is_promoted,
    p_academic_year
  FROM `results` r
  INNER JOIN `students` s ON s.id = r.student_id AND s.class_id = v_class_id
  WHERE r.exam_id = p_exam_id
  GROUP BY r.student_id;

  -- FIXED RANKING LOGIC:
  -- 1st Priority: subjects_passed DESC (more passed subjects = better rank)
  -- 2nd Priority: total_obtained DESC (higher total marks = better rank)
  -- Note: We rank ALL students together, not separating promoted/failed
  SET @rnk = 0;
  UPDATE `promotions` p
  JOIN (
    SELECT student_id,
           @rnk := @rnk + 1 AS computed_rank
    FROM `promotions`
    WHERE exam_id = p_exam_id
    ORDER BY subjects_passed DESC, total_obtained DESC
  ) ranked ON ranked.student_id = p.student_id
  SET p.rank_in_class = ranked.computed_rank
  WHERE p.exam_id = p_exam_id;

  -- Assign new_roll = rank (rank 1 gets roll 1, etc.) for promoted students only
  UPDATE `promotions`
  SET `new_roll` = `rank_in_class`
  WHERE `exam_id` = p_exam_id AND `is_promoted` = 1;

  -- Set to_class_id = next class for promoted students
  -- Classes order by id: 1→2→3→4→5→6→7→8→9→10
  UPDATE `promotions` p
  JOIN (
    SELECT id,
           LEAD(id) OVER (ORDER BY id) AS next_class_id
    FROM `classes`
  ) cls ON cls.id = v_class_id
  SET p.to_class_id = cls.next_class_id
  WHERE p.exam_id = p_exam_id AND p.is_promoted = 1;

  -- Update students table: move promoted students to new class with new roll
  UPDATE `students` s
  JOIN `promotions` p ON p.student_id = s.id
  SET
    s.class_id = p.to_class_id,
    s.roll     = p.new_roll
  WHERE p.exam_id = p_exam_id
    AND p.is_promoted = 1
    AND p.to_class_id IS NOT NULL;

  -- Return the promotion results
  SELECT
    p.student_id,
    s.name AS student_name,
    s.photo,
    p.total_marks,
    p.total_obtained,
    p.subjects_passed,
    p.subjects_total,
    p.rank_in_class,
    p.new_roll,
    p.is_promoted,
    cf.name AS from_class,
    ct.name AS to_class
  FROM `promotions` p
  JOIN `students` s  ON s.id = p.student_id
  JOIN `classes` cf  ON cf.id = p.from_class_id
  LEFT JOIN `classes` ct ON ct.id = p.to_class_id
  WHERE p.exam_id = p_exam_id
  ORDER BY p.rank_in_class;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `switch_current_session` (IN `p_new_session_id` SMALLINT UNSIGNED)   BEGIN
  DECLARE v_old_session_id SMALLINT UNSIGNED;
  
  -- Get current session
  SELECT id INTO v_old_session_id FROM academic_sessions WHERE is_current = 1 LIMIT 1;
  
  -- Create snapshot of old session before switching
  IF v_old_session_id IS NOT NULL THEN
    CALL create_session_snapshot(v_old_session_id);
  END IF;
  
  -- Switch sessions
  UPDATE academic_sessions SET is_current = 0 WHERE is_current = 1;
  UPDATE academic_sessions SET is_current = 1 WHERE id = p_new_session_id;
  
  SELECT CONCAT('Switched to session ID: ', p_new_session_id) AS message;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `academic_sessions`
--

CREATE TABLE `academic_sessions` (
  `id` smallint(5) UNSIGNED NOT NULL,
  `name` varchar(20) NOT NULL,
  `year` year(4) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT 0,
  `is_locked` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `attendance`
--

CREATE TABLE `attendance` (
  `id` int(10) UNSIGNED NOT NULL,
  `session_id` smallint(5) UNSIGNED NOT NULL COMMENT 'Academic session',
  `class_id` smallint(5) UNSIGNED NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `date` date NOT NULL,
  `month` varchar(7) NOT NULL COMMENT 'YYYY-MM format for easy filtering',
  `year` year(4) NOT NULL COMMENT 'Year for reporting',
  `status` enum('present','absent','late','excused') NOT NULL DEFAULT 'present',
  `note` varchar(255) DEFAULT NULL,
  `taken_by` int(10) UNSIGNED DEFAULT NULL COMMENT 'User ID who took attendance',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `classes`
--

CREATE TABLE `classes` (
  `id` smallint(5) UNSIGNED NOT NULL,
  `name` varchar(50) NOT NULL,
  `sort_order` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `class_routine_cells`
--

CREATE TABLE `class_routine_cells` (
  `id` int(10) UNSIGNED NOT NULL,
  `session_id` smallint(5) UNSIGNED DEFAULT NULL,
  `class_id` smallint(5) UNSIGNED NOT NULL,
  `col_id` varchar(30) NOT NULL,
  `row_day` varchar(20) NOT NULL,
  `subject` varchar(100) NOT NULL DEFAULT '',
  `teacher` varchar(100) DEFAULT NULL COMMENT 'Teacher name for this class period'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `class_routine_columns`
--

CREATE TABLE `class_routine_columns` (
  `id` varchar(30) NOT NULL,
  `class_id` smallint(5) UNSIGNED NOT NULL,
  `session_id` int(11) DEFAULT NULL,
  `label` varchar(100) NOT NULL,
  `time_slot` varchar(30) DEFAULT NULL,
  `is_leisure` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `published` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `class_routine_legacy`
--

CREATE TABLE `class_routine_legacy` (
  `id` int(10) UNSIGNED NOT NULL,
  `class_id` smallint(5) UNSIGNED NOT NULL,
  `day` varchar(20) NOT NULL,
  `period_no` tinyint(3) UNSIGNED NOT NULL,
  `subject` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `class_sections`
--

CREATE TABLE `class_sections` (
  `id` int(10) UNSIGNED NOT NULL,
  `class_id` smallint(5) UNSIGNED NOT NULL,
  `name` varchar(20) NOT NULL,
  `sort_order` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `class_subjects`
--

CREATE TABLE `class_subjects` (
  `id` int(10) UNSIGNED NOT NULL,
  `class_id` smallint(5) UNSIGNED NOT NULL,
  `class_name` varchar(50) DEFAULT NULL,
  `subject` varchar(100) NOT NULL,
  `sort_order` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `teacher_id` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `committee_members`
--

CREATE TABLE `committee_members` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `position` varchar(100) NOT NULL COMMENT 'Position in committee',
  `photo` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `sort_order` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `email_otps`
--

CREATE TABLE `email_otps` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `otp` varchar(10) NOT NULL,
  `purpose` varchar(50) NOT NULL DEFAULT 'register',
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `exams`
--

CREATE TABLE `exams` (
  `id` varchar(20) NOT NULL,
  `session_id` smallint(5) UNSIGNED DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `class_id` smallint(5) UNSIGNED DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` enum('আসন্ন','চলমান','সম্পন্ন') NOT NULL DEFAULT 'আসন্ন',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `pass_mark_percent` tinyint(3) UNSIGNED NOT NULL DEFAULT 33,
  `is_annual` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `exam_routine_cells`
--

CREATE TABLE `exam_routine_cells` (
  `id` int(10) UNSIGNED NOT NULL,
  `session_id` smallint(5) UNSIGNED DEFAULT NULL,
  `row_id` varchar(30) NOT NULL,
  `col_id` varchar(30) NOT NULL,
  `value` varchar(500) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `exam_routine_columns`
--

CREATE TABLE `exam_routine_columns` (
  `id` varchar(30) NOT NULL,
  `class_id` int(11) DEFAULT NULL,
  `session_id` int(11) DEFAULT NULL,
  `exam_id` varchar(30) DEFAULT NULL,
  `label` varchar(100) NOT NULL,
  `exam_col_type` varchar(20) DEFAULT NULL,
  `sort_order` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `published` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `exam_routine_legacy`
--

CREATE TABLE `exam_routine_legacy` (
  `id` int(10) UNSIGNED NOT NULL,
  `exam_id` varchar(20) NOT NULL,
  `exam_date` date NOT NULL,
  `day` varchar(20) NOT NULL,
  `subject` varchar(100) NOT NULL,
  `start_time` time NOT NULL,
  `duration` varchar(30) NOT NULL,
  `class_id` smallint(5) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `exam_routine_rows`
--

CREATE TABLE `exam_routine_rows` (
  `id` varchar(30) NOT NULL,
  `class_id` int(11) DEFAULT NULL,
  `session_id` int(11) DEFAULT NULL,
  `exam_id` varchar(30) DEFAULT NULL,
  `sort_order` smallint(5) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `fees`
--

CREATE TABLE `fees` (
  `id` varchar(20) NOT NULL,
  `session_id` smallint(5) UNSIGNED DEFAULT NULL,
  `student_id` varchar(20) NOT NULL,
  `category` varchar(100) NOT NULL,
  `month` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `paid` decimal(10,2) NOT NULL DEFAULT 0.00,
  `due` decimal(10,2) GENERATED ALWAYS AS (`amount` - `paid`) STORED,
  `status` enum('বকেয়া','আংশিক','পরিশোধিত','অগ্রিম') NOT NULL DEFAULT 'বকেয়া',
  `paid_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `fee_settings`
--

CREATE TABLE `fee_settings` (
  `id` int(10) UNSIGNED NOT NULL,
  `class_id` smallint(5) UNSIGNED NOT NULL,
  `admission` decimal(10,2) NOT NULL DEFAULT 0.00,
  `session` decimal(10,2) NOT NULL DEFAULT 0.00,
  `monthly` decimal(10,2) NOT NULL DEFAULT 0.00,
  `exam` decimal(10,2) NOT NULL DEFAULT 0.00,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `fee_transactions`
--

CREATE TABLE `fee_transactions` (
  `id` int(10) UNSIGNED NOT NULL,
  `fee_id` varchar(20) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `transaction_date` date DEFAULT NULL,
  `collected_by` int(10) UNSIGNED DEFAULT NULL,
  `collected_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `note` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gallery`
--

CREATE TABLE `gallery` (
  `id` int(10) UNSIGNED NOT NULL,
  `url` varchar(500) NOT NULL,
  `caption` varchar(255) DEFAULT NULL,
  `uploaded_by` int(10) UNSIGNED DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `holidays`
--

CREATE TABLE `holidays` (
  `id` int(10) UNSIGNED NOT NULL,
  `date` date NOT NULL,
  `title` varchar(255) NOT NULL,
  `type` enum('holiday','event') NOT NULL DEFAULT 'holiday',
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `homepage_gallery`
--

CREATE TABLE `homepage_gallery` (
  `id` int(10) UNSIGNED NOT NULL,
  `url` varchar(500) NOT NULL,
  `caption` varchar(200) DEFAULT '',
  `sort_order` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `homepage_teachers`
--

CREATE TABLE `homepage_teachers` (
  `id` int(10) UNSIGNED NOT NULL,
  `teacher_id` varchar(20) DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `designation` varchar(100) DEFAULT '',
  `subject` varchar(100) DEFAULT '',
  `bio` text DEFAULT '',
  `photo` varchar(500) DEFAULT '',
  `sort_order` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notices`
--

CREATE TABLE `notices` (
  `id` int(10) UNSIGNED NOT NULL,
  `session_id` smallint(5) UNSIGNED DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `category` varchar(50) NOT NULL,
  `is_important` tinyint(1) NOT NULL DEFAULT 0,
  `status` enum('draft','published') NOT NULL DEFAULT 'published',
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_receipts`
--

CREATE TABLE `payment_receipts` (
  `receipt_no` varchar(25) NOT NULL,
  `session_id` smallint(5) UNSIGNED DEFAULT NULL,
  `fee_id` varchar(20) DEFAULT NULL,
  `student_id` varchar(20) DEFAULT NULL,
  `student_name` varchar(150) DEFAULT NULL,
  `student_class` varchar(50) DEFAULT NULL,
  `category` varchar(100) NOT NULL,
  `month` varchar(50) NOT NULL,
  `paid_amount` decimal(10,2) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `total_paid` decimal(10,2) NOT NULL,
  `collected_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `line_items` longtext DEFAULT NULL CHECK (json_valid(`line_items`)),
  `total_this_paid` decimal(10,2) NOT NULL DEFAULT 0.00,
  `guardian` varchar(150) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `promotions`
--

CREATE TABLE `promotions` (
  `id` int(10) UNSIGNED NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `exam_id` varchar(20) NOT NULL,
  `from_class_id` smallint(5) UNSIGNED NOT NULL,
  `to_class_id` smallint(5) UNSIGNED DEFAULT NULL,
  `total_marks` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `total_obtained` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `subjects_passed` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `subjects_total` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `rank_in_class` smallint(5) UNSIGNED DEFAULT NULL,
  `new_roll` smallint(5) UNSIGNED DEFAULT NULL,
  `is_promoted` tinyint(1) NOT NULL DEFAULT 0,
  `academic_year` year(4) NOT NULL,
  `promoted_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `results`
--

CREATE TABLE `results` (
  `id` int(10) UNSIGNED NOT NULL,
  `session_id` smallint(5) UNSIGNED DEFAULT NULL,
  `student_id` varchar(20) NOT NULL,
  `exam_id` varchar(20) NOT NULL,
  `subject_id` smallint(5) UNSIGNED DEFAULT NULL,
  `subject_name` varchar(100) DEFAULT NULL,
  `total_marks` smallint(5) UNSIGNED NOT NULL DEFAULT 100,
  `obtained` smallint(5) UNSIGNED NOT NULL DEFAULT 0,
  `grade` varchar(5) DEFAULT NULL,
  `status` enum('pending','submitted','published') NOT NULL DEFAULT 'published',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `salaries`
--

CREATE TABLE `salaries` (
  `id` varchar(20) NOT NULL,
  `session_id` smallint(5) UNSIGNED DEFAULT NULL,
  `teacher_id` varchar(20) NOT NULL,
  `month` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `paid` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('বকেয়া','পরিশোধিত') NOT NULL DEFAULT 'বকেয়া',
  `paid_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `salary_payment_receipts`
--

CREATE TABLE `salary_payment_receipts` (
  `id` varchar(20) NOT NULL,
  `session_id` smallint(5) UNSIGNED DEFAULT NULL,
  `receipt_number` varchar(50) NOT NULL,
  `salary_id` varchar(20) NOT NULL,
  `teacher_id` varchar(20) NOT NULL,
  `teacher_name` varchar(255) NOT NULL,
  `month` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_method` varchar(50) DEFAULT 'নগদ',
  `payment_date` date NOT NULL,
  `remarks` text DEFAULT NULL,
  `created_by` varchar(20) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `site_features`
--

CREATE TABLE `site_features` (
  `id` tinyint(3) UNSIGNED NOT NULL,
  `icon` varchar(10) NOT NULL COMMENT 'Emoji icon',
  `title` varchar(100) NOT NULL,
  `description` varchar(255) NOT NULL,
  `sort_order` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `site_settings`
--

CREATE TABLE `site_settings` (
  `setting_key` varchar(50) NOT NULL,
  `setting_value` text NOT NULL,
  `updated_by` int(10) UNSIGNED DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `students`
--

CREATE TABLE `students` (
  `id` varchar(20) NOT NULL,
  `session_id` smallint(5) UNSIGNED DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `name_bn` varchar(150) DEFAULT NULL,
  `name_en` varchar(150) DEFAULT NULL,
  `class_id` smallint(5) UNSIGNED NOT NULL,
  `roll` smallint(5) UNSIGNED NOT NULL,
  `section` varchar(10) NOT NULL DEFAULT 'ক',
  `guardian` varchar(150) NOT NULL,
  `father_name_bn` varchar(150) DEFAULT NULL,
  `father_name_en` varchar(150) DEFAULT NULL,
  `mother_name_bn` varchar(150) DEFAULT NULL,
  `mother_name_en` varchar(150) DEFAULT NULL,
  `guardian_type` enum('father','mother','other') DEFAULT 'father',
  `guardian_name` varchar(150) DEFAULT NULL,
  `guardian_relation` varchar(100) DEFAULT NULL,
  `phone` varchar(20) NOT NULL,
  `address` varchar(255) NOT NULL,
  `photo` varchar(500) DEFAULT NULL,
  `status` enum('সক্রিয়','নিষ্ক্রিয়','বহিষ্কৃত') NOT NULL DEFAULT 'সক্রিয়',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `student_session_history`
--

CREATE TABLE `student_session_history` (
  `id` int(11) UNSIGNED NOT NULL,
  `student_id` varchar(30) NOT NULL,
  `session_id` smallint(5) UNSIGNED NOT NULL,
  `class_id` smallint(5) UNSIGNED NOT NULL,
  `roll` smallint(5) UNSIGNED NOT NULL,
  `section` varchar(5) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'সক্রিয়',
  `snapshot_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `student_writings`
--

CREATE TABLE `student_writings` (
  `id` int(10) UNSIGNED NOT NULL,
  `title` varchar(200) NOT NULL,
  `content` text NOT NULL,
  `author` varchar(150) DEFAULT '',
  `type` varchar(50) DEFAULT 'প্রবন্ধ',
  `sort_order` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `subjects`
--

CREATE TABLE `subjects` (
  `id` smallint(5) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `teachers`
--

CREATE TABLE `teachers` (
  `id` varchar(20) NOT NULL,
  `session_id` smallint(5) UNSIGNED DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `subject` varchar(100) NOT NULL,
  `class_id` smallint(5) UNSIGNED DEFAULT NULL,
  `phone` varchar(20) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `qualification` varchar(150) DEFAULT NULL,
  `join_date` date DEFAULT NULL,
  `photo` varchar(500) DEFAULT NULL,
  `salary` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('সক্রিয়','নিষ্ক্রিয়') NOT NULL DEFAULT 'সক্রিয়',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `teacher_session_history`
--

CREATE TABLE `teacher_session_history` (
  `id` int(11) UNSIGNED NOT NULL,
  `teacher_id` varchar(30) NOT NULL,
  `session_id` smallint(5) UNSIGNED NOT NULL,
  `class_id` smallint(5) UNSIGNED DEFAULT NULL,
  `subject` varchar(100) DEFAULT NULL,
  `salary` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` varchar(20) NOT NULL DEFAULT 'সক্রিয়',
  `snapshot_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

CREATE TABLE `transactions` (
  `id` int(10) UNSIGNED NOT NULL,
  `session_id` smallint(5) UNSIGNED DEFAULT NULL,
  `voucher_no` varchar(30) DEFAULT NULL,
  `type` enum('income','expense') NOT NULL,
  `category` varchar(100) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `date` date NOT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','teacher','class_teacher','student','visitor','accountant') NOT NULL DEFAULT 'visitor',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `class_id` smallint(5) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_class_routine`
-- (See below for the actual view)
--
CREATE TABLE `v_class_routine` (
`class_id` smallint(5) unsigned
,`class_name` varchar(50)
,`day` varchar(20)
,`col_id` varchar(30)
,`period_label` varchar(100)
,`time_slot` varchar(30)
,`is_leisure` tinyint(1)
,`sort_order` tinyint(3) unsigned
,`subject` varchar(100)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_class_subjects`
-- (See below for the actual view)
--
CREATE TABLE `v_class_subjects` (
`id` int(10) unsigned
,`class_id` smallint(5) unsigned
,`class_name` varchar(50)
,`subject` varchar(100)
,`sort_order` tinyint(3) unsigned
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_current_session_exams`
-- (See below for the actual view)
--
CREATE TABLE `v_current_session_exams` (
`id` varchar(20)
,`session_id` smallint(5) unsigned
,`name` varchar(150)
,`class_id` smallint(5) unsigned
,`start_date` date
,`end_date` date
,`status` enum('আসন্ন','চলমান','সম্পন্ন')
,`created_at` timestamp
,`pass_mark_percent` tinyint(3) unsigned
,`is_annual` tinyint(1)
,`class_name` varchar(50)
,`session_name` varchar(20)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_current_session_fees`
-- (See below for the actual view)
--
CREATE TABLE `v_current_session_fees` (
`id` varchar(20)
,`session_id` smallint(5) unsigned
,`student_id` varchar(20)
,`category` varchar(100)
,`month` varchar(50)
,`amount` decimal(10,2)
,`paid` decimal(10,2)
,`due` decimal(10,2)
,`status` enum('বকেয়া','আংশিক','পরিশোধিত','অগ্রিম')
,`paid_date` date
,`created_at` timestamp
,`updated_at` timestamp
,`student_name` varchar(150)
,`class_name` varchar(50)
,`session_name` varchar(20)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_current_session_results`
-- (See below for the actual view)
--
CREATE TABLE `v_current_session_results` (
`id` int(10) unsigned
,`session_id` smallint(5) unsigned
,`student_id` varchar(20)
,`exam_id` varchar(20)
,`subject_id` smallint(5) unsigned
,`subject_name` varchar(100)
,`total_marks` smallint(5) unsigned
,`obtained` smallint(5) unsigned
,`grade` varchar(5)
,`created_at` timestamp
,`updated_at` timestamp
,`student_name` varchar(150)
,`exam_name` varchar(150)
,`session_name` varchar(20)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_current_session_students`
-- (See below for the actual view)
--
CREATE TABLE `v_current_session_students` (
`id` varchar(20)
,`session_id` smallint(5) unsigned
,`user_id` int(10) unsigned
,`name` varchar(150)
,`class_id` smallint(5) unsigned
,`roll` smallint(5) unsigned
,`section` varchar(10)
,`guardian` varchar(150)
,`phone` varchar(20)
,`address` varchar(255)
,`photo` varchar(500)
,`status` enum('সক্রিয়','নিষ্ক্রিয়','বহিষ্কৃত')
,`created_at` timestamp
,`updated_at` timestamp
,`deleted_at` timestamp
,`class_name` varchar(50)
,`session_name` varchar(20)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_current_session_teachers`
-- (See below for the actual view)
--
CREATE TABLE `v_current_session_teachers` (
`id` varchar(20)
,`session_id` smallint(5) unsigned
,`user_id` int(10) unsigned
,`name` varchar(150)
,`subject` varchar(100)
,`class_id` smallint(5) unsigned
,`phone` varchar(20)
,`email` varchar(150)
,`address` varchar(255)
,`qualification` varchar(150)
,`join_date` date
,`photo` varchar(500)
,`salary` decimal(10,2)
,`status` enum('সক্রিয়','নিষ্ক্রিয়')
,`created_at` timestamp
,`updated_at` timestamp
,`deleted_at` timestamp
,`session_name` varchar(20)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_exam_routine`
-- (See below for the actual view)
--
CREATE TABLE `v_exam_routine` (
`row_id` varchar(30)
,`sort_order` smallint(5) unsigned
,`col_id` varchar(30)
,`col_label` varchar(100)
,`col_order` tinyint(3) unsigned
,`value` varchar(500)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_result_summary`
-- (See below for the actual view)
--
CREATE TABLE `v_result_summary` (
`student_id` varchar(20)
,`student_name` varchar(150)
,`exam_id` varchar(20)
,`exam_name` varchar(150)
,`total_marks` decimal(27,0)
,`total_obtained` decimal(27,0)
,`percentage` decimal(33,2)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_salary_status`
-- (See below for the actual view)
--
CREATE TABLE `v_salary_status` (
`teacher_id` varchar(20)
,`teacher_name` varchar(150)
,`month` varchar(50)
,`amount` decimal(10,2)
,`paid` decimal(10,2)
,`due` decimal(11,2)
,`status` enum('বকেয়া','পরিশোধিত')
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_student_fee_summary`
-- (See below for the actual view)
--
CREATE TABLE `v_student_fee_summary` (
`student_id` varchar(20)
,`student_name` varchar(150)
,`class` varchar(50)
,`total_amount` decimal(32,2)
,`total_paid` decimal(32,2)
,`total_due` decimal(33,2)
);

-- --------------------------------------------------------

--
-- Structure for view `v_class_routine`
--
DROP TABLE IF EXISTS `v_class_routine`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_class_routine`  AS SELECT `crc`.`class_id` AS `class_id`, `c`.`name` AS `class_name`, `crc`.`row_day` AS `day`, `crc`.`col_id` AS `col_id`, `col`.`label` AS `period_label`, `col`.`time_slot` AS `time_slot`, `col`.`is_leisure` AS `is_leisure`, `col`.`sort_order` AS `sort_order`, `crc`.`subject` AS `subject` FROM ((`class_routine_cells` `crc` join `classes` `c` on(`c`.`id` = `crc`.`class_id`)) join `class_routine_columns` `col` on(`col`.`id` = `crc`.`col_id` and `col`.`class_id` = `crc`.`class_id`)) ORDER BY `crc`.`class_id` ASC, `col`.`sort_order` ASC ;

-- --------------------------------------------------------

--
-- Structure for view `v_class_subjects`
--
DROP TABLE IF EXISTS `v_class_subjects`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_class_subjects`  AS SELECT `cs`.`id` AS `id`, `cs`.`class_id` AS `class_id`, `c`.`name` AS `class_name`, `cs`.`subject` AS `subject`, `cs`.`sort_order` AS `sort_order` FROM (`class_subjects` `cs` join `classes` `c` on(`c`.`id` = `cs`.`class_id`)) ORDER BY `cs`.`class_id` ASC, `cs`.`sort_order` ASC, `cs`.`id` ASC ;

-- --------------------------------------------------------

--
-- Structure for view `v_current_session_exams`
--
DROP TABLE IF EXISTS `v_current_session_exams`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_current_session_exams`  AS SELECT `e`.`id` AS `id`, `e`.`session_id` AS `session_id`, `e`.`name` AS `name`, `e`.`class_id` AS `class_id`, `e`.`start_date` AS `start_date`, `e`.`end_date` AS `end_date`, `e`.`status` AS `status`, `e`.`created_at` AS `created_at`, `e`.`pass_mark_percent` AS `pass_mark_percent`, `e`.`is_annual` AS `is_annual`, `c`.`name` AS `class_name`, `sess`.`name` AS `session_name` FROM ((`exams` `e` join `classes` `c` on(`c`.`id` = `e`.`class_id`)) join `academic_sessions` `sess` on(`sess`.`id` = `e`.`session_id`)) WHERE `sess`.`is_current` = 1 ;

-- --------------------------------------------------------

--
-- Structure for view `v_current_session_fees`
--
DROP TABLE IF EXISTS `v_current_session_fees`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_current_session_fees`  AS SELECT `f`.`id` AS `id`, `f`.`session_id` AS `session_id`, `f`.`student_id` AS `student_id`, `f`.`category` AS `category`, `f`.`month` AS `month`, `f`.`amount` AS `amount`, `f`.`paid` AS `paid`, `f`.`due` AS `due`, `f`.`status` AS `status`, `f`.`paid_date` AS `paid_date`, `f`.`created_at` AS `created_at`, `f`.`updated_at` AS `updated_at`, `s`.`name` AS `student_name`, `c`.`name` AS `class_name`, `sess`.`name` AS `session_name` FROM (((`fees` `f` join `students` `s` on(`s`.`id` = `f`.`student_id`)) join `classes` `c` on(`c`.`id` = `s`.`class_id`)) join `academic_sessions` `sess` on(`sess`.`id` = `f`.`session_id`)) WHERE `sess`.`is_current` = 1 ;

-- --------------------------------------------------------

--
-- Structure for view `v_current_session_results`
--
DROP TABLE IF EXISTS `v_current_session_results`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_current_session_results`  AS SELECT `r`.`id` AS `id`, `r`.`session_id` AS `session_id`, `r`.`student_id` AS `student_id`, `r`.`exam_id` AS `exam_id`, `r`.`subject_id` AS `subject_id`, `r`.`subject_name` AS `subject_name`, `r`.`total_marks` AS `total_marks`, `r`.`obtained` AS `obtained`, `r`.`grade` AS `grade`, `r`.`created_at` AS `created_at`, `r`.`updated_at` AS `updated_at`, `s`.`name` AS `student_name`, `e`.`name` AS `exam_name`, `sess`.`name` AS `session_name` FROM (((`results` `r` join `students` `s` on(`s`.`id` = `r`.`student_id`)) join `exams` `e` on(`e`.`id` = `r`.`exam_id`)) join `academic_sessions` `sess` on(`sess`.`id` = `r`.`session_id`)) WHERE `sess`.`is_current` = 1 ;

-- --------------------------------------------------------

--
-- Structure for view `v_current_session_students`
--
DROP TABLE IF EXISTS `v_current_session_students`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_current_session_students`  AS SELECT `s`.`id` AS `id`, `s`.`session_id` AS `session_id`, `s`.`user_id` AS `user_id`, `s`.`name` AS `name`, `s`.`class_id` AS `class_id`, `s`.`roll` AS `roll`, `s`.`section` AS `section`, `s`.`guardian` AS `guardian`, `s`.`phone` AS `phone`, `s`.`address` AS `address`, `s`.`photo` AS `photo`, `s`.`status` AS `status`, `s`.`created_at` AS `created_at`, `s`.`updated_at` AS `updated_at`, `s`.`deleted_at` AS `deleted_at`, `c`.`name` AS `class_name`, `sess`.`name` AS `session_name` FROM ((`students` `s` join `classes` `c` on(`c`.`id` = `s`.`class_id`)) join `academic_sessions` `sess` on(`sess`.`id` = `s`.`session_id`)) WHERE `sess`.`is_current` = 1 AND `s`.`deleted_at` is null ;

-- --------------------------------------------------------

--
-- Structure for view `v_current_session_teachers`
--
DROP TABLE IF EXISTS `v_current_session_teachers`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_current_session_teachers`  AS SELECT `t`.`id` AS `id`, `t`.`session_id` AS `session_id`, `t`.`user_id` AS `user_id`, `t`.`name` AS `name`, `t`.`subject` AS `subject`, `t`.`class_id` AS `class_id`, `t`.`phone` AS `phone`, `t`.`email` AS `email`, `t`.`address` AS `address`, `t`.`qualification` AS `qualification`, `t`.`join_date` AS `join_date`, `t`.`photo` AS `photo`, `t`.`salary` AS `salary`, `t`.`status` AS `status`, `t`.`created_at` AS `created_at`, `t`.`updated_at` AS `updated_at`, `t`.`deleted_at` AS `deleted_at`, `sess`.`name` AS `session_name` FROM (`teachers` `t` join `academic_sessions` `sess` on(`sess`.`id` = `t`.`session_id`)) WHERE `sess`.`is_current` = 1 AND `t`.`deleted_at` is null ;

-- --------------------------------------------------------

--
-- Structure for view `v_exam_routine`
--
DROP TABLE IF EXISTS `v_exam_routine`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_exam_routine`  AS SELECT `er`.`id` AS `row_id`, `er`.`sort_order` AS `sort_order`, `ec`.`id` AS `col_id`, `ec`.`label` AS `col_label`, `ec`.`sort_order` AS `col_order`, `erc`.`value` AS `value` FROM ((`exam_routine_rows` `er` join `exam_routine_cells` `erc` on(`erc`.`row_id` = `er`.`id`)) join `exam_routine_columns` `ec` on(`ec`.`id` = `erc`.`col_id`)) ORDER BY `er`.`sort_order` ASC, `ec`.`sort_order` ASC ;

-- --------------------------------------------------------

--
-- Structure for view `v_result_summary`
--
DROP TABLE IF EXISTS `v_result_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_result_summary`  AS SELECT `r`.`student_id` AS `student_id`, `s`.`name` AS `student_name`, `e`.`id` AS `exam_id`, `e`.`name` AS `exam_name`, sum(`r`.`total_marks`) AS `total_marks`, sum(`r`.`obtained`) AS `total_obtained`, round(sum(`r`.`obtained`) / sum(`r`.`total_marks`) * 100,2) AS `percentage` FROM ((`results` `r` join `students` `s` on(`s`.`id` = `r`.`student_id`)) join `exams` `e` on(`e`.`id` = `r`.`exam_id`)) GROUP BY `r`.`student_id`, `s`.`name`, `e`.`id`, `e`.`name` ;

-- --------------------------------------------------------

--
-- Structure for view `v_salary_status`
--
DROP TABLE IF EXISTS `v_salary_status`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_salary_status`  AS SELECT `t`.`id` AS `teacher_id`, `t`.`name` AS `teacher_name`, `sal`.`month` AS `month`, `sal`.`amount` AS `amount`, `sal`.`paid` AS `paid`, `sal`.`amount`- `sal`.`paid` AS `due`, `sal`.`status` AS `status` FROM (`salaries` `sal` join `teachers` `t` on(`t`.`id` = `sal`.`teacher_id`)) ;

-- --------------------------------------------------------

--
-- Structure for view `v_student_fee_summary`
--
DROP TABLE IF EXISTS `v_student_fee_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_student_fee_summary`  AS SELECT `s`.`id` AS `student_id`, `s`.`name` AS `student_name`, `cl`.`name` AS `class`, sum(`f`.`amount`) AS `total_amount`, sum(`f`.`paid`) AS `total_paid`, sum(greatest(`f`.`amount` - `f`.`paid`,0)) AS `total_due` FROM ((`students` `s` join `classes` `cl` on(`cl`.`id` = `s`.`class_id`)) left join `fees` `f` on(`f`.`student_id` = `s`.`id`)) GROUP BY `s`.`id`, `s`.`name`, `cl`.`name` ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `academic_sessions`
--
ALTER TABLE `academic_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_session_name` (`name`);

--
-- Indexes for table `attendance`
--
ALTER TABLE `attendance`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_attendance` (`session_id`,`class_id`,`student_id`,`date`),
  ADD KEY `idx_session_class_date` (`session_id`,`class_id`,`date`),
  ADD KEY `idx_session_class_month` (`session_id`,`class_id`,`month`),
  ADD KEY `idx_student_session` (`student_id`,`session_id`),
  ADD KEY `idx_date` (`date`),
  ADD KEY `idx_month` (`month`),
  ADD KEY `fk_attendance_class` (`class_id`),
  ADD KEY `fk_attendance_user` (`taken_by`),
  ADD KEY `idx_year` (`year`),
  ADD KEY `idx_session_date` (`session_id`,`date`);

--
-- Indexes for table `classes`
--
ALTER TABLE `classes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `class_routine_cells`
--
ALTER TABLE `class_routine_cells`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_cell` (`class_id`,`col_id`,`row_day`),
  ADD KEY `idx_crc_cells_class` (`class_id`),
  ADD KEY `idx_class_routine_session` (`session_id`);

--
-- Indexes for table `class_routine_columns`
--
ALTER TABLE `class_routine_columns`
  ADD PRIMARY KEY (`id`,`class_id`),
  ADD KEY `idx_crc_class` (`class_id`);

--
-- Indexes for table `class_routine_legacy`
--
ALTER TABLE `class_routine_legacy`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_routine` (`class_id`,`day`,`period_no`);

--
-- Indexes for table `class_sections`
--
ALTER TABLE `class_sections`
  ADD PRIMARY KEY (`id`),
  ADD KEY `class_id` (`class_id`);

--
-- Indexes for table `class_subjects`
--
ALTER TABLE `class_subjects`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_class_subject` (`class_id`,`subject`),
  ADD KEY `idx_cs_class_name` (`class_name`),
  ADD KEY `idx_class_subjects_teacher_id` (`teacher_id`);

--
-- Indexes for table `committee_members`
--
ALTER TABLE `committee_members`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `email_otps`
--
ALTER TABLE `email_otps`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_email_purpose` (`email`,`purpose`);

--
-- Indexes for table `exams`
--
ALTER TABLE `exams`
  ADD PRIMARY KEY (`id`),
  ADD KEY `class_id` (`class_id`),
  ADD KEY `idx_exams_name` (`name`(100)),
  ADD KEY `idx_exams_status` (`status`),
  ADD KEY `idx_exams_annual` (`is_annual`,`status`),
  ADD KEY `idx_exams_session` (`session_id`);

--
-- Indexes for table `exam_routine_cells`
--
ALTER TABLE `exam_routine_cells`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_exam_cell` (`row_id`,`col_id`),
  ADD KEY `idx_erc_row` (`row_id`),
  ADD KEY `idx_erc_col` (`col_id`),
  ADD KEY `idx_exam_routine_session` (`session_id`);

--
-- Indexes for table `exam_routine_columns`
--
ALTER TABLE `exam_routine_columns`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_exam_routine_columns_class` (`class_id`);

--
-- Indexes for table `exam_routine_legacy`
--
ALTER TABLE `exam_routine_legacy`
  ADD PRIMARY KEY (`id`),
  ADD KEY `exam_id` (`exam_id`),
  ADD KEY `class_id` (`class_id`);

--
-- Indexes for table `exam_routine_rows`
--
ALTER TABLE `exam_routine_rows`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_exam_routine_rows_class` (`class_id`);

--
-- Indexes for table `fees`
--
ALTER TABLE `fees`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_fees_student_cat_month` (`student_id`,`category`(50),`month`(30)),
  ADD KEY `idx_fees_cat_month` (`category`(50),`month`(30)),
  ADD KEY `idx_fees_student_status` (`student_id`,`status`),
  ADD KEY `idx_fees_session` (`session_id`);

--
-- Indexes for table `fee_settings`
--
ALTER TABLE `fee_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `class_id` (`class_id`);

--
-- Indexes for table `fee_transactions`
--
ALTER TABLE `fee_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fee_id` (`fee_id`),
  ADD KEY `collected_by` (`collected_by`);

--
-- Indexes for table `gallery`
--
ALTER TABLE `gallery`
  ADD PRIMARY KEY (`id`),
  ADD KEY `uploaded_by` (`uploaded_by`);

--
-- Indexes for table `holidays`
--
ALTER TABLE `holidays`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_date` (`date`),
  ADD KEY `idx_date` (`date`),
  ADD KEY `fk_holiday_user` (`created_by`);

--
-- Indexes for table `homepage_gallery`
--
ALTER TABLE `homepage_gallery`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `homepage_teachers`
--
ALTER TABLE `homepage_teachers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `teacher_id` (`teacher_id`);

--
-- Indexes for table `notices`
--
ALTER TABLE `notices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_notices_session` (`session_id`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `payment_receipts`
--
ALTER TABLE `payment_receipts`
  ADD PRIMARY KEY (`receipt_no`),
  ADD KEY `collected_by` (`collected_by`),
  ADD KEY `idx_pr_student` (`student_id`),
  ADD KEY `pr_fee_fk` (`fee_id`),
  ADD KEY `idx_payment_receipts_session` (`session_id`);

--
-- Indexes for table `promotions`
--
ALTER TABLE `promotions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_student_exam` (`student_id`,`exam_id`),
  ADD KEY `fk_promo_exam` (`exam_id`),
  ADD KEY `idx_promotions_exam_promoted` (`exam_id`,`is_promoted`);

--
-- Indexes for table `results`
--
ALTER TABLE `results`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_result` (`student_id`,`exam_id`,`subject_id`),
  ADD KEY `exam_id` (`exam_id`),
  ADD KEY `subject_id` (`subject_id`),
  ADD KEY `idx_results_subject_name` (`subject_name`),
  ADD KEY `idx_results_exam_student` (`exam_id`,`student_id`),
  ADD KEY `idx_results_session` (`session_id`),
  ADD KEY `idx_results_status` (`status`);

--
-- Indexes for table `salaries`
--
ALTER TABLE `salaries`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_teacher_month` (`teacher_id`,`month`),
  ADD KEY `idx_salaries_session` (`session_id`);

--
-- Indexes for table `salary_payment_receipts`
--
ALTER TABLE `salary_payment_receipts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `receipt_number` (`receipt_number`),
  ADD KEY `idx_salary_id` (`salary_id`),
  ADD KEY `idx_teacher_id` (`teacher_id`),
  ADD KEY `idx_receipt_number` (`receipt_number`),
  ADD KEY `idx_payment_date` (`payment_date`),
  ADD KEY `idx_receipt_search` (`receipt_number`,`teacher_name`,`month`),
  ADD KEY `idx_salary_receipts_session` (`session_id`);

--
-- Indexes for table `site_features`
--
ALTER TABLE `site_features`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `site_settings`
--
ALTER TABLE `site_settings`
  ADD PRIMARY KEY (`setting_key`),
  ADD KEY `updated_by` (`updated_by`);

--
-- Indexes for table `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD KEY `idx_students_class_status` (`class_id`,`status`),
  ADD KEY `idx_students_user_id` (`user_id`),
  ADD KEY `idx_students_deleted_at` (`deleted_at`),
  ADD KEY `idx_students_class_active` (`class_id`,`deleted_at`),
  ADD KEY `idx_students_name` (`name`(50)),
  ADD KEY `idx_students_session` (`session_id`);

--
-- Indexes for table `student_session_history`
--
ALTER TABLE `student_session_history`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_student_session` (`student_id`,`session_id`);

--
-- Indexes for table `student_writings`
--
ALTER TABLE `student_writings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `subjects`
--
ALTER TABLE `subjects`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `teachers`
--
ALTER TABLE `teachers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD KEY `class_id` (`class_id`),
  ADD KEY `idx_teachers_user_id` (`user_id`),
  ADD KEY `idx_teachers_deleted_at` (`deleted_at`),
  ADD KEY `idx_teachers_name` (`name`(50)),
  ADD KEY `idx_teachers_session` (`session_id`);

--
-- Indexes for table `teacher_session_history`
--
ALTER TABLE `teacher_session_history`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_teacher_session` (`teacher_id`,`session_id`);

--
-- Indexes for table `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_transactions_session` (`session_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `fk_users_class` (`class_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `academic_sessions`
--
ALTER TABLE `academic_sessions`
  MODIFY `id` smallint(5) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `attendance`
--
ALTER TABLE `attendance`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=535;

--
-- AUTO_INCREMENT for table `classes`
--
ALTER TABLE `classes`
  MODIFY `id` smallint(5) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `class_routine_cells`
--
ALTER TABLE `class_routine_cells`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=750;

--
-- AUTO_INCREMENT for table `class_routine_legacy`
--
ALTER TABLE `class_routine_legacy`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `class_sections`
--
ALTER TABLE `class_sections`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `class_subjects`
--
ALTER TABLE `class_subjects`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=90;

--
-- AUTO_INCREMENT for table `committee_members`
--
ALTER TABLE `committee_members`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `email_otps`
--
ALTER TABLE `email_otps`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `exam_routine_cells`
--
ALTER TABLE `exam_routine_cells`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=81;

--
-- AUTO_INCREMENT for table `exam_routine_legacy`
--
ALTER TABLE `exam_routine_legacy`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `fee_settings`
--
ALTER TABLE `fee_settings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `fee_transactions`
--
ALTER TABLE `fee_transactions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=587;

--
-- AUTO_INCREMENT for table `gallery`
--
ALTER TABLE `gallery`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT for table `holidays`
--
ALTER TABLE `holidays`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `homepage_gallery`
--
ALTER TABLE `homepage_gallery`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT for table `homepage_teachers`
--
ALTER TABLE `homepage_teachers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `notices`
--
ALTER TABLE `notices`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `promotions`
--
ALTER TABLE `promotions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `results`
--
ALTER TABLE `results`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=206;

--
-- AUTO_INCREMENT for table `site_features`
--
ALTER TABLE `site_features`
  MODIFY `id` tinyint(3) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `student_session_history`
--
ALTER TABLE `student_session_history`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1001;

--
-- AUTO_INCREMENT for table `student_writings`
--
ALTER TABLE `student_writings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `subjects`
--
ALTER TABLE `subjects`
  MODIFY `id` smallint(5) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `teacher_session_history`
--
ALTER TABLE `teacher_session_history`
  MODIFY `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `attendance`
--
ALTER TABLE `attendance`
  ADD CONSTRAINT `fk_attendance_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_attendance_session` FOREIGN KEY (`session_id`) REFERENCES `academic_sessions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_attendance_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_attendance_user` FOREIGN KEY (`taken_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `class_routine_cells`
--
ALTER TABLE `class_routine_cells`
  ADD CONSTRAINT `crc_cells_class_fk` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `class_routine_columns`
--
ALTER TABLE `class_routine_columns`
  ADD CONSTRAINT `crc_class_fk` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `class_routine_legacy`
--
ALTER TABLE `class_routine_legacy`
  ADD CONSTRAINT `class_routine_legacy_ibfk_1` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`);

--
-- Constraints for table `class_sections`
--
ALTER TABLE `class_sections`
  ADD CONSTRAINT `class_sections_ibfk_1` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `class_subjects`
--
ALTER TABLE `class_subjects`
  ADD CONSTRAINT `class_subjects_ibfk_1` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `class_subjects_teacher_fk` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `exams`
--
ALTER TABLE `exams`
  ADD CONSTRAINT `exams_ibfk_1` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`);

--
-- Constraints for table `exam_routine_cells`
--
ALTER TABLE `exam_routine_cells`
  ADD CONSTRAINT `erc_col_fk` FOREIGN KEY (`col_id`) REFERENCES `exam_routine_columns` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `erc_row_fk` FOREIGN KEY (`row_id`) REFERENCES `exam_routine_rows` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `exam_routine_legacy`
--
ALTER TABLE `exam_routine_legacy`
  ADD CONSTRAINT `exam_routine_legacy_ibfk_1` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`),
  ADD CONSTRAINT `exam_routine_legacy_ibfk_2` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`);

--
-- Constraints for table `fees`
--
ALTER TABLE `fees`
  ADD CONSTRAINT `fees_student_cascade_fk` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `fee_settings`
--
ALTER TABLE `fee_settings`
  ADD CONSTRAINT `fee_settings_ibfk_1` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`);

--
-- Constraints for table `fee_transactions`
--
ALTER TABLE `fee_transactions`
  ADD CONSTRAINT `fee_transactions_ibfk_1` FOREIGN KEY (`fee_id`) REFERENCES `fees` (`id`),
  ADD CONSTRAINT `fee_transactions_ibfk_2` FOREIGN KEY (`collected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `gallery`
--
ALTER TABLE `gallery`
  ADD CONSTRAINT `gallery_ibfk_1` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `holidays`
--
ALTER TABLE `holidays`
  ADD CONSTRAINT `fk_holiday_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `homepage_teachers`
--
ALTER TABLE `homepage_teachers`
  ADD CONSTRAINT `homepage_teachers_ibfk_1` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `notices`
--
ALTER TABLE `notices`
  ADD CONSTRAINT `notices_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `payment_receipts`
--
ALTER TABLE `payment_receipts`
  ADD CONSTRAINT `payment_receipts_ibfk_1` FOREIGN KEY (`fee_id`) REFERENCES `fees` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payment_receipts_ibfk_2` FOREIGN KEY (`collected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `pr_fee_fk` FOREIGN KEY (`fee_id`) REFERENCES `fees` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `promotions`
--
ALTER TABLE `promotions`
  ADD CONSTRAINT `fk_promo_exam` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_promo_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `results`
--
ALTER TABLE `results`
  ADD CONSTRAINT `results_ibfk_2` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `results_ibfk_3` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`),
  ADD CONSTRAINT `results_student_cascade_fk` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `salaries`
--
ALTER TABLE `salaries`
  ADD CONSTRAINT `salaries_ibfk_1` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `site_settings`
--
ALTER TABLE `site_settings`
  ADD CONSTRAINT `site_settings_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `students`
--
ALTER TABLE `students`
  ADD CONSTRAINT `students_ibfk_1` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`),
  ADD CONSTRAINT `students_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `teachers`
--
ALTER TABLE `teachers`
  ADD CONSTRAINT `teachers_ibfk_1` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `teachers_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
