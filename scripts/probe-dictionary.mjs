const word = 'remember'
const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
console.log(res.status)
if (res.ok) {
  const data = await res.json()
  console.log('word:', data[0]?.word)
  console.log('phonetic:', data[0]?.phonetic)
  console.log('phonetics:', data[0]?.phonetics)
  console.log('meanings:', data[0]?.meanings?.map(m => ({ pos: m.partOfSpeech, def: m.definitions?.[0]?.definition })))
}

