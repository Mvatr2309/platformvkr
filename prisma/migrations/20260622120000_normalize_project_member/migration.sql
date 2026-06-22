-- Подстраховка от «задвоения» участников проекта.
-- Если участника добавляют вручную по email, который принадлежит зарегистрированному
-- студенту, БД автоматически привязывает участие к его аккаунту вместо создания
-- «внешней» записи (inSystem=false). Ловит любой путь вставки, в т.ч. старые билды.

CREATE OR REPLACE FUNCTION normalize_project_member()
RETURNS trigger AS $$
DECLARE
  matched_student text;
BEGIN
  IF NEW."studentId" IS NULL AND NEW."manualEmail" IS NOT NULL THEN
    SELECT sp.id INTO matched_student
    FROM "User" u
    JOIN "StudentProfile" sp ON sp."userId" = u.id
    WHERE lower(u.email) = lower(NEW."manualEmail")
    LIMIT 1;

    IF matched_student IS NOT NULL THEN
      NEW."studentId" := matched_student;
      NEW."inSystem"  := true;
      NEW."manualEmail" := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_project_member ON "ProjectMember";
CREATE TRIGGER trg_normalize_project_member
  BEFORE INSERT OR UPDATE ON "ProjectMember"
  FOR EACH ROW EXECUTE FUNCTION normalize_project_member();
