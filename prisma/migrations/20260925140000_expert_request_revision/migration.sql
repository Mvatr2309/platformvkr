-- M1: модератор возвращает запрос студенту на доработку с комментарием.
-- Новый статус запроса и тип уведомления студенту. Данные не трогаются.
-- AlterEnum
ALTER TYPE "ExpertRequestStatus" ADD VALUE 'NEEDS_REVISION';
-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'EXPERT_REQUEST_RETURNED';
