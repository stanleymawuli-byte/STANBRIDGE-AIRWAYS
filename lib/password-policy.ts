const commonPasswords = new Set([
  "admin",
  "changeme",
  "iloveyou",
  "letmein",
  "monkey",
  "passw0rd",
  "password",
  "qwerty",
  "stanbridge",
  "welcome",
]);

function normalizePassword(password: string) {
  return password
    .toLowerCase()
    .replace(/[@]/g, "a")
    .replace(/[0]/g, "o")
    .replace(/[1!]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[$5]/g, "s")
    .replace(/[^a-z]/g, "");
}

export function isCommonPassword(password: string) {
  const normalized = normalizePassword(password);
  return commonPasswords.has(normalized) || [...commonPasswords].some((candidate) =>
    candidate.length >= 5 && normalized.includes(normalizePassword(candidate)),
  );
}
