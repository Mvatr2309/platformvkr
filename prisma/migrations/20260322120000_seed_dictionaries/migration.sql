-- Seed dictionaries with default values

-- directions
INSERT INTO "Dictionary" (id, type, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'directions', NOW(), NOW())
ON CONFLICT (type) DO NOTHING;

INSERT INTO "DictionaryValue" (id, "dictionaryId", value, "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid(), d.id, v.value, v.ord, NOW(), NOW()
FROM "Dictionary" d,
(VALUES
  ('Управление IT продуктом', 0),
  ('Разработка IT-продуктов', 1),
  ('Науки о данных', 2)
) AS v(value, ord)
WHERE d.type = 'directions'
  AND NOT EXISTS (SELECT 1 FROM "DictionaryValue" dv WHERE dv."dictionaryId" = d.id AND dv.value = v.value);

-- roles
INSERT INTO "Dictionary" (id, type, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'roles', NOW(), NOW())
ON CONFLICT (type) DO NOTHING;

INSERT INTO "DictionaryValue" (id, "dictionaryId", value, "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid(), d.id, v.value, v.ord, NOW(), NOW()
FROM "Dictionary" d,
(VALUES
  ('Разработчик', 0),
  ('ML-инженер', 1),
  ('Data Engineer', 2),
  ('Data Scientist', 3),
  ('Product-менеджер', 4)
) AS v(value, ord)
WHERE d.type = 'roles'
  AND NOT EXISTS (SELECT 1 FROM "DictionaryValue" dv WHERE dv."dictionaryId" = d.id AND dv.value = v.value);

-- academicTitles
INSERT INTO "Dictionary" (id, type, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'academicTitles', NOW(), NOW())
ON CONFLICT (type) DO NOTHING;

INSERT INTO "DictionaryValue" (id, "dictionaryId", value, "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid(), d.id, v.value, v.ord, NOW(), NOW()
FROM "Dictionary" d,
(VALUES
  ('Нет', 0),
  ('Доцент', 1),
  ('Профессор', 2)
) AS v(value, ord)
WHERE d.type = 'academicTitles'
  AND NOT EXISTS (SELECT 1 FROM "DictionaryValue" dv WHERE dv."dictionaryId" = d.id AND dv.value = v.value);

-- cohorts
INSERT INTO "Dictionary" (id, type, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'cohorts', NOW(), NOW())
ON CONFLICT (type) DO NOTHING;

INSERT INTO "DictionaryValue" (id, "dictionaryId", value, "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid(), d.id, v.value, v.ord, NOW(), NOW()
FROM "Dictionary" d,
(VALUES
  ('Поток2025', 0),
  ('Поток2026', 1)
) AS v(value, ord)
WHERE d.type = 'cohorts'
  AND NOT EXISTS (SELECT 1 FROM "DictionaryValue" dv WHERE dv."dictionaryId" = d.id AND dv.value = v.value);
