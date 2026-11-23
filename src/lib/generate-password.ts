/** Generate a 20-character password locally using the browser's secure random source. */
export function generatePassword(): string {
  const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%&*+-=?"]
  const alphabet = groups.join("")
  function randomIndex(length: number) {
    const bytes = new Uint8Array(1)
    const limit = 256 - (256 % length)
    do { crypto.getRandomValues(bytes) } while (bytes[0] >= limit)
    return bytes[0] % length
  }
  const characters = groups.map(group => group[randomIndex(group.length)])
  while (characters.length < 20) characters.push(alphabet[randomIndex(alphabet.length)])
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[characters[i], characters[j]] = [characters[j], characters[i]]
  }
  return characters.join("")
}
