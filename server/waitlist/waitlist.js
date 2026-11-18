(function () {
  var form = document.getElementById('waitlist')
  var btn = document.getElementById('submit')
  var msg = document.getElementById('msg')

  function show(kind, text) {
    msg.className = 'msg ' + kind
    msg.textContent = text
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault()
    var data = new FormData(form)
    var email = String(data.get('email') || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      show('err', 'Please enter a valid email address.')
      return
    }

    btn.disabled = true
    btn.textContent = 'Joining…'
    fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        role: data.get('role'),
        zip: data.get('zip'),
        interest: data.get('interest'),
        website: data.get('website')
      })
    })
      .then(function (r) { return r.json().then(function (body) { return { ok: r.ok, body: body } }) })
      .then(function (res) {
        if (!res.ok) throw new Error(res.body.error || 'Something went wrong. Please try again.')
        form.reset()
        show('ok', res.body.alreadyJoined
          ? "You're already on the list — we'll be in touch."
          : "You're on the list! We'll email you when Rentaleze launches.")
        btn.textContent = "You're in ✓"
      })
      .catch(function (err) {
        show('err', err.message)
        btn.disabled = false
        btn.textContent = 'Join the waitlist'
      })
  })
})()
