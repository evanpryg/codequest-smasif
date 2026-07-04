-- =============================================================================
-- CodeQuest — Migrasi 0004: Seed Achievement (MVP)
-- Rujukan: DataModel.md §6.2
--
-- Achievement bersifat sistem/global untuk MVP (dipakai semua guru). Semua
-- syarat dapat dihitung dari data yang sudah ada (submission_attempt,
-- student_achievement, total_xp). Idempotent: aman dijalankan ulang.
-- =============================================================================

insert into achievement (code, name, description, icon) values
  ('first_quest',       'Langkah Pertama',  'Menyelesaikan quest pertama',                       'first_quest'),
  ('first_boss',        'Penakluk Boss',    'Menyelesaikan boss quest pertama',                  'first_boss'),
  ('chapter_clear',     'Bab Tuntas',       'Menyelesaikan semua quest dalam satu chapter',      'chapter_clear'),
  ('quests_10',         'Rajin Ngoding',    'Menyelesaikan 10 quest',                            'quests_10'),
  ('quests_25',         'Kutu Kode',        'Menyelesaikan 25 quest',                            'quests_25'),
  ('level_5',           'Naik Kelas',       'Mencapai Level 5',                                  'level_5'),
  ('flawless',          'Sekali Jalan',     'Lolos quest auto pada percobaan pertama',           'flawless'),
  ('persistence',       'Pantang Menyerah', 'Lolos quest auto setelah 5+ percobaan',             'persistence'),
  ('full_chapter_boss', 'Sang Juara',       'Menuntaskan seluruh chapter beserta boss-nya',      'full_chapter_boss')
on conflict (code) do nothing;
