// Scroll-reveal: fade/slide sections in as they enter the viewport.
const revealEls = document.querySelectorAll('.reveal')
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal--visible')
        observer.unobserve(entry.target)
      }
    })
  },
  { threshold: 0.15 },
)
revealEls.forEach((el) => observer.observe(el))

// Typewriter loop for the "Ask your Carpet" demo search bar.
const phrases = [
  'that article about the early facebook engineer',
  'the code snippet for cosine similarity',
  'screenshot of the invoice from last week',
]

const typewriterEl = document.getElementById('typewriter')

if (typewriterEl) {
  let phraseIndex = 0
  let charIndex = 0
  let deleting = false

  function tick() {
    const phrase = phrases[phraseIndex]

    if (!deleting) {
      charIndex++
      typewriterEl.textContent = phrase.slice(0, charIndex)
      if (charIndex === phrase.length) {
        deleting = true
        setTimeout(tick, 1400)
        return
      }
    } else {
      charIndex--
      typewriterEl.textContent = phrase.slice(0, charIndex)
      if (charIndex === 0) {
        deleting = false
        phraseIndex = (phraseIndex + 1) % phrases.length
      }
    }

    setTimeout(tick, deleting ? 22 : 38)
  }

  tick()
}
