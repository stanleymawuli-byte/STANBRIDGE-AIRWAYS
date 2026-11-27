-- Local classroom demonstration only. Never expose password hashes through a public API.
SELECT
  u.email AS username,
  a.password AS password_hash,
  a."providerId" AS authentication_provider
FROM "User" AS u
INNER JOIN "Account" AS a ON a."userId" = u.id
WHERE a."providerId" = 'credential'
ORDER BY u."createdAt" DESC;

SELECT role, COUNT(*) AS account_count
FROM "User"
GROUP BY role
ORDER BY role;
