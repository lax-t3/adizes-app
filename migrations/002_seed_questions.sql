-- ============================================================
-- Seed: 36 PAEI Questions + Options
-- Section assignments from PAEI_Questions_Turiyaskills_Format.xlsx
-- (Question Tag column — interleaved, NOT sequential blocks)
--
-- Is     (12): Q0, Q4, Q7, Q10, Q14, Q19, Q21, Q23, Q26, Q29, Q33, Q35
-- Should (12): Q2, Q5, Q6, Q9, Q12, Q13, Q18, Q20, Q24, Q27, Q31, Q34
-- Want   (12): Q1, Q3, Q8, Q11, Q15, Q16, Q17, Q22, Q25, Q28, Q30, Q32
-- ============================================================

DO $$
DECLARE
    q UUID;
BEGIN

INSERT INTO questions (question_index, text, section) VALUES (0, 'What my colleagues value most about me is:', 'is') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','My ability to get them to cooperate.','I'),(q,'b','My ability to get the day-by-day work done.','P'),(q,'c','My ability to change things.','E'),(q,'d','My ability to work systematically.','A');

INSERT INTO questions (question_index, text, section) VALUES (1, 'I want to be praised because:', 'want') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','I work hard.','P'),(q,'b','I am accurate.','A'),(q,'c','I understand others.','I'),(q,'d','I am creative.','E');

INSERT INTO questions (question_index, text, section) VALUES (2, 'What characterizes the heroes (those we admire) in our organization is that they:', 'should') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Maintain a high standard of quality in everything they do.','A'),(q,'b','Demonstrate a will and ability to put in extra work.','P'),(q,'c','Bring good new ideas.','E'),(q,'d','Have an ability to tackle conflicts.','I');

INSERT INTO questions (question_index, text, section) VALUES (3, 'When evaluating a new opportunity, I am most drawn to:', 'want') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','New challenges.','E'),(q,'b','Stability and job security.','A'),(q,'c','Demands on the individual to perform.','P'),(q,'d','A good working environment.','I');

INSERT INTO questions (question_index, text, section) VALUES (4, 'What characterizes me in my day-to-day work as a manager is that I am good at:', 'is') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Completing my tasks.','P'),(q,'b','Structuring my work day.','A'),(q,'c','Spotting new opportunities.','E'),(q,'d','Listening to others.','I');

INSERT INTO questions (question_index, text, section) VALUES (5, 'The corporate culture in our organization can be characterized as one in which we:', 'should') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Follow internal quality procedures.','A'),(q,'b','Cooperate across departments.','I'),(q,'c','Get the day to day work done.','P'),(q,'d','Face tomorrow''s challenges.','E');

INSERT INTO questions (question_index, text, section) VALUES (6, 'In our organization, people are most successful when they:', 'should') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Build strong collaboration across teams and departments.','I'),(q,'b','Challenge existing approaches and explore new possibilities.','E'),(q,'c','Create structure, consistency, and reliable ways of working.','A'),(q,'d','Stay closely connected to customer needs and practical results.','P');

INSERT INTO questions (question_index, text, section) VALUES (7, 'I spend most of my time:', 'is') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Creating new projects and tasks.','E'),(q,'b','Ensuring that decisions made are complied with.','A'),(q,'c','Getting precise results from projects/tasks in progress.','P'),(q,'d','Ensuring that decisions/solutions are accepted by the parties concerned.','I');

INSERT INTO questions (question_index, text, section) VALUES (8, 'If I had some spare time at work, I would like to:', 'want') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Clean up and/or organize my paper work.','A'),(q,'b','Get through some of the day-to-day work.','P'),(q,'c','Get a development project under way.','E'),(q,'d','Walk around to maintain contact with my colleagues.','I');

INSERT INTO questions (question_index, text, section) VALUES (9, 'My job is characterized by:', 'should') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Structured and repetitive operational responsibilities.','P'),(q,'b','Leading, coordinating, and supporting people.','I'),(q,'c','Monitoring progress, quality, and follow-through.','A'),(q,'d','Constant change, variety, and new challenges.','E');

INSERT INTO questions (question_index, text, section) VALUES (10, 'My closest colleagues would describe me as someone who is:', 'is') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Pleasant and easy to work with.','I'),(q,'b','Focused and work thoroughly within the scope of my job.','A'),(q,'c','Good at implementing change.','E'),(q,'d','Good at making quick decisions.','P');

INSERT INTO questions (question_index, text, section) VALUES (11, 'My ideal work environment would allow me to:', 'want') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Be with people I like.','I'),(q,'b','Experience something exciting.','E'),(q,'c','Concentrate on my work.','P'),(q,'d','Structure my work.','A');

INSERT INTO questions (question_index, text, section) VALUES (12, 'Looking at my position as part of a team, to complement the style of others in the team, the person holding my position should be:', 'should') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Efficient and systematic.','A'),(q,'b','A good judge of character and a mediator.','I'),(q,'c','Creative and progressive.','E'),(q,'d','Motivated by results.','P');

INSERT INTO questions (question_index, text, section) VALUES (13, 'My superiors'' most important demands on the person in my job are a good knowledge of:', 'should') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Rules and regulations.','A'),(q,'b','The customers'' needs.','P'),(q,'c','Future developments.','E'),(q,'d','How to make people cooperate.','I');

INSERT INTO questions (question_index, text, section) VALUES (14, 'A good day for me is when:', 'is') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','I have been able to work without interruptions.','A'),(q,'b','My new ideas have won acceptance.','E'),(q,'c','I have met all my objectives for the day.','P'),(q,'d','We have succeeded as a team.','I');

INSERT INTO questions (question_index, text, section) VALUES (15, 'I need to feel that:', 'want') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','I am well liked.','I'),(q,'b','I am in control of the situation.','A'),(q,'c','I can use my creativity.','E'),(q,'d','I achieve results every day.','P');

INSERT INTO questions (question_index, text, section) VALUES (16, 'What I want others to notice about me is:', 'want') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','My capacity to work.','P'),(q,'b','My ability to work well with others.','I'),(q,'c','My ability to work systematically.','A'),(q,'d','My ability to think creatively.','E');

INSERT INTO questions (question_index, text, section) VALUES (17, 'The kind of new job I would like to apply for is:', 'want') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','One with constantly changing tasks and challenges.','E'),(q,'b','One with orderly and secure working conditions.','A'),(q,'c','One where I can work with people.','I'),(q,'d','One where I can use my professional skills every day.','P');

INSERT INTO questions (question_index, text, section) VALUES (18, 'The most important areas of responsibility in my job are:', 'should') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Developing people.','I'),(q,'b','Assuring the day-to-day work is achieved.','P'),(q,'c','Developing new products/services/systems.','E'),(q,'d','Undertaking supervision and control of the daily operations.','A');

INSERT INTO questions (question_index, text, section) VALUES (19, 'What I consider most important when making a decision is:', 'is') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Getting results fast.','P'),(q,'b','Following the relevant rules and regulations.','A'),(q,'c','Finding a solution that is acceptable to everyone.','I'),(q,'d','Ensuring that they lead to new conditions or ways of doing things.','E');

INSERT INTO questions (question_index, text, section) VALUES (20, 'My role is most effective when I:', 'should') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Create structure and systems that improve efficiency and reliability.','A'),(q,'b','Maintain focus on delivering consistent day-to-day results.','P'),(q,'c','Drive improvement, adaptation, and forward development.','E'),(q,'d','Build commitment, trust, and motivation across people and teams.','I');

INSERT INTO questions (question_index, text, section) VALUES (21, 'In my job I am good at:', 'is') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Finding new ways to accomplish my work.','E'),(q,'b','Supervising others to ensure the job is done correctly.','A'),(q,'c','Getting work done fast.','P'),(q,'d','Motivating others to work well.','I');

INSERT INTO questions (question_index, text, section) VALUES (22, 'My attitude toward development work is that it:', 'want') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Takes me away from important day-to-day work.','P'),(q,'b','Creates turbulence.','A'),(q,'c','Creates opportunities for creative thinking.','E'),(q,'d','Gives me a chance to get to know others in the organization.','I');

INSERT INTO questions (question_index, text, section) VALUES (23, 'I am most likely to delay an important decision when:', 'is') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','I do not have sufficient information.','A'),(q,'b','I am not sure of other people''s opinion.','I'),(q,'c','I have too much to do.','P'),(q,'d','I see many possible solutions to the problem.','E');

INSERT INTO questions (question_index, text, section) VALUES (24, 'My job requires me to:', 'should') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Work quickly and in an orderly way.','P'),(q,'b','Inspire the commitment of my colleagues.','I'),(q,'c','Find new ways of working and new methods.','E'),(q,'d','Work carefully and systematically.','A');

INSERT INTO questions (question_index, text, section) VALUES (25, 'The kinds of tasks I like are:', 'want') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Those that require cooperation with colleagues.','I'),(q,'b','Those that give me the opportunity to plan for the future.','E'),(q,'c','Those that make it possible to work systematically and within a structure.','A'),(q,'d','Those in which you can see the results the same day.','P');

INSERT INTO questions (question_index, text, section) VALUES (26, 'My most important quality in my current job is:', 'is') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','My ability to systematize.','A'),(q,'b','My ability to achieve goals.','P'),(q,'c','My flexibility.','E'),(q,'d','My ability to work well with others.','I');

INSERT INTO questions (question_index, text, section) VALUES (27, 'The person taking over from me should like:', 'should') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Working under pressure.','P'),(q,'b','Dealing with conflict and controversial discussions.','I'),(q,'c','Being in a secure and stable working environment.','A'),(q,'d','Risks and excitement.','E');

INSERT INTO questions (question_index, text, section) VALUES (28, 'Deep down, I would like to see myself:', 'want') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','As someone in touch with my colleagues.','I'),(q,'b','As someone whom colleagues approach for accurate information.','A'),(q,'c','As someone recognized by colleagues for the ability to find new solutions.','E'),(q,'d','As someone to rely on when they need help to do extra work.','P');

INSERT INTO questions (question_index, text, section) VALUES (29, 'What pleases me most in my current job is:', 'is') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','That I reach the planned day-to-day objectives.','P'),(q,'b','That I manage to foresee and plan for future developments.','E'),(q,'c','That I ensure cooperation in teams.','I'),(q,'d','That I do things right the first time.','A');

INSERT INTO questions (question_index, text, section) VALUES (30, 'The type of work that gives me the energy and fulfillment is:', 'want') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Work which requires systematic planning.','A'),(q,'b','Work which requires teamwork.','I'),(q,'c','Work which requires hard work to achieve the tasks of the day.','P'),(q,'d','Work which requires creativity and a willingness to take risks.','E');

INSERT INTO questions (question_index, text, section) VALUES (31, 'Managers in our organization are praised for their:', 'should') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Drive, responsiveness, and ability to deliver results under pressure.','P'),(q,'b','Vision, adaptability, and ability to anticipate future opportunities.','E'),(q,'c','Discipline, consistency, and attention to operational quality.','A'),(q,'d','Ability to build trust, alignment, and cohesion across people and teams.','I');

INSERT INTO questions (question_index, text, section) VALUES (32, 'I want to be thought of as someone who is good at:', 'want') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Getting tomorrow''s work done.','E'),(q,'b','Getting the day-to-day work done.','P'),(q,'c','Creating good working relationships.','I'),(q,'d','Ensuring quality in our procedures.','A');

INSERT INTO questions (question_index, text, section) VALUES (33, 'What characterizes me in meetings is that:', 'is') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','I facilitate good communication.','I'),(q,'b','I contribute with objective knowledge and information.','A'),(q,'c','I stick to the issue.','P'),(q,'d','I contribute with many new solutions.','E');

INSERT INTO questions (question_index, text, section) VALUES (34, 'People rely on me most for my ability to:', 'should') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','Work quickly.','P'),(q,'b','Dare to try new ideas or ways of doing things.','E'),(q,'c','Contribute to the maintenance of high quality.','A'),(q,'d','Help sort out conflicts.','I');

INSERT INTO questions (question_index, text, section) VALUES (35, 'Of greatest concern to me in my day-to-day work is that:', 'is') RETURNING id INTO q;
INSERT INTO options (question_id, option_key, text, paei_role) VALUES (q,'a','What needs doing is accepted by everyone.','I'),(q,'b','What needs doing can be done.','P'),(q,'c','I know how to do what needs doing.','A'),(q,'d','What needs doing is done now.','E');

END $$;
