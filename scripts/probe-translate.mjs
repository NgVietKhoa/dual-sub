const lines = ['Hi everyone.', "Today our topic is Vietnamese people.", 'We will listen to a real life conversation', 'a\nb']
const body = new URLSearchParams()
for (const l of lines) body.append('q', l)
const url = 'https://translate.googleapis.com/translate_a/t?client=gtx&sl=en&tl=vi&dt=t'
const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body })
console.log(res.status, await res.text())
const res2 = await fetch(url + '&' + lines.map((l) => 'q=' + encodeURIComponent(l)).join('&'))
console.log(res2.status, await res2.text())

