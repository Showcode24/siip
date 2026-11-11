-- The SIIP test: one test only, about workplace conduct (not subject knowledge).
-- Videos start as placeholders (no YouTube link yet); admins add the links and
-- edit or replace the starter questions in the admin portal, without code.

-- Subject-knowledge tests are retired: interns no longer see them. Their
-- questions and every past attempt are kept.
UPDATE "Assessment" SET "published" = false WHERE "type" IN ('SCREENING', 'FINAL');

INSERT INTO "Assessment" (
  "id", "cohortId", "type", "title", "description", "timeLimitMinutes", "passMark", "maxAttempts",
  "shuffleQuestions", "shuffleOptions", "published", "retakeAfterHours", "unlockAfterWeeks",
  "minCheckInRating", "createdAt", "updatedAt"
) VALUES (
  'siip_test', NULL, 'SIIP', 'The SIIP test',
  'Watch the short videos on working well with others, then answer questions about them.',
  20, 70, 100, true, true, true, 24, 8, 3, now(), now()
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "TestVideo" ("id", "assessmentId", "title", "description", "youtubeId", "order", "createdAt", "updatedAt") VALUES
  ('siip_video_1', 'siip_test', 'Welcome to SIIP',
   'A short welcome from our founder on what companies expect from SIIP interns.', NULL, 1, now(), now()),
  ('siip_video_2', 'siip_test', 'Behaviour and courtesy at work',
   'How to treat colleagues, customers and shared spaces with respect.', NULL, 2, now(), now()),
  ('siip_video_3', 'siip_test', 'Communicating at work',
   'Clear updates, asking for help, and writing messages your team can act on.', NULL, 3, now(), now()),
  ('siip_video_4', 'siip_test', 'Punctuality and meeting deadlines',
   'Arriving on time, planning your work, and what to do when you will miss a deadline.', NULL, 4, now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Question" ("id", "assessmentId", "type", "prompt", "points", "order", "acceptedAnswers", "videoId", "createdAt", "updatedAt") VALUES
  ('siip_q1', 'siip_test', 'SINGLE_CHOICE', 'Your supervisor gives you feedback you disagree with. What is the best first step?', 1, 1, '{}', 'siip_video_2', now(), now()),
  ('siip_q2', 'siip_test', 'SINGLE_CHOICE', 'A customer is rude to you on the phone. What should you do?', 1, 2, '{}', 'siip_video_2', now(), now()),
  ('siip_q3', 'siip_test', 'SINGLE_CHOICE', 'You are stuck on a task and the deadline is tomorrow. When should you tell your supervisor?', 1, 3, '{}', 'siip_video_3', now(), now()),
  ('siip_q4', 'siip_test', 'SINGLE_CHOICE', 'Which update is most useful to send your team at the end of the day?', 1, 4, '{}', 'siip_video_3', now(), now()),
  ('siip_q5', 'siip_test', 'SINGLE_CHOICE', 'You will be 20 minutes late for a 9am meeting. What should you do?', 1, 5, '{}', 'siip_video_4', now(), now()),
  ('siip_q6', 'siip_test', 'SINGLE_CHOICE', 'You have three tasks due this week. What is the best way to plan them?', 1, 6, '{}', 'siip_video_4', now(), now()),
  ('siip_q7', 'siip_test', 'SINGLE_CHOICE', 'A colleague shares a file with customer details by mistake. What should you do?', 1, 7, '{}', 'siip_video_2', now(), now()),
  ('siip_q8', 'siip_test', 'SINGLE_CHOICE', 'What do companies on SIIP most expect from an intern?', 1, 8, '{}', 'siip_video_1', now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Option" ("id", "questionId", "text", "isCorrect", "order", "createdAt", "updatedAt") VALUES
  ('siip_q1_a', 'siip_q1', 'Listen, ask questions to understand it, and agree on next steps', true, 0, now(), now()),
  ('siip_q1_b', 'siip_q1', 'Ignore it and carry on as before', false, 1, now(), now()),
  ('siip_q1_c', 'siip_q1', 'Complain about it to other interns', false, 2, now(), now()),
  ('siip_q1_d', 'siip_q1', 'Argue until your supervisor changes their mind', false, 3, now(), now()),
  ('siip_q2_a', 'siip_q2', 'Stay calm and polite, and pass it to your supervisor if it continues', true, 0, now(), now()),
  ('siip_q2_b', 'siip_q2', 'Be rude back so they stop', false, 1, now(), now()),
  ('siip_q2_c', 'siip_q2', 'Hang up without saying anything', false, 2, now(), now()),
  ('siip_q2_d', 'siip_q2', 'Post about the call on social media', false, 3, now(), now()),
  ('siip_q3_a', 'siip_q3', 'As soon as you know you are stuck, with what you have tried', true, 0, now(), now()),
  ('siip_q3_b', 'siip_q3', 'After the deadline has passed', false, 1, now(), now()),
  ('siip_q3_c', 'siip_q3', 'Only if they ask you', false, 2, now(), now()),
  ('siip_q3_d', 'siip_q3', 'Never; it is better to hand in nothing', false, 3, now(), now()),
  ('siip_q4_a', 'siip_q4', 'What you finished, what is next, and anything blocking you', true, 0, now(), now()),
  ('siip_q4_b', 'siip_q4', '"Busy day, see you tomorrow"', false, 1, now(), now()),
  ('siip_q4_c', 'siip_q4', 'A list of everything that went wrong, without next steps', false, 2, now(), now()),
  ('siip_q4_d', 'siip_q4', 'No update; the team can ask if they need to know', false, 3, now(), now()),
  ('siip_q5_a', 'siip_q5', 'Tell the organiser before 9am and say when you will arrive', true, 0, now(), now()),
  ('siip_q5_b', 'siip_q5', 'Arrive late and say nothing', false, 1, now(), now()),
  ('siip_q5_c', 'siip_q5', 'Skip the meeting without telling anyone', false, 2, now(), now()),
  ('siip_q5_d', 'siip_q5', 'Send a message after the meeting ends', false, 3, now(), now()),
  ('siip_q6_a', 'siip_q6', 'List them by deadline and importance, and check the plan with your supervisor', true, 0, now(), now()),
  ('siip_q6_b', 'siip_q6', 'Start whichever looks most fun', false, 1, now(), now()),
  ('siip_q6_c', 'siip_q6', 'Wait until the day before and do them all at once', false, 2, now(), now()),
  ('siip_q6_d', 'siip_q6', 'Work on all three at the same time without a plan', false, 3, now(), now()),
  ('siip_q7_a', 'siip_q7', 'Tell them privately so they can remove it, and do not share it further', true, 0, now(), now()),
  ('siip_q7_b', 'siip_q7', 'Download a copy in case it is useful later', false, 1, now(), now()),
  ('siip_q7_c', 'siip_q7', 'Forward it to your friends', false, 2, now(), now()),
  ('siip_q7_d', 'siip_q7', 'Ignore it', false, 3, now(), now()),
  ('siip_q8_a', 'siip_q8', 'Reliability, good communication and the skills you were verified for', true, 0, now(), now()),
  ('siip_q8_b', 'siip_q8', 'Knowing everything already, with no need for guidance', false, 1, now(), now()),
  ('siip_q8_c', 'siip_q8', 'Working alone without updating anyone', false, 2, now(), now()),
  ('siip_q8_d', 'siip_q8', 'Doing only the tasks you enjoy', false, 3, now(), now())
ON CONFLICT ("id") DO NOTHING;

-- Settings that only make sense in range.
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_siip_settings_chk" CHECK (
  "retakeAfterHours" BETWEEN 0 AND 720
  AND "unlockAfterWeeks" BETWEEN 0 AND 52
  AND "minCheckInRating" BETWEEN 1 AND 5
);
