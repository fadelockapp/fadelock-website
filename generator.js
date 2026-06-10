/* ============================================
   Fadelock Web Password Generator
   - Web Crypto API for secure random generation
   - 5-second auto-delete timer
   - 12-hour cooldown (localStorage)
   - Copy with 15-second auto-clear
   ============================================ */

(function () {
  "use strict";

  // Character sets (matching the mobile app)
  const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
  const NUMBERS = "0123456789";
  const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  // Cooldown: 12 hours in milliseconds
  const COOLDOWN_MS = 12 * 60 * 60 * 1000;
  const AUTO_DELETE_SECONDS = 5;
  const CLIPBOARD_CLEAR_SECONDS = 15;
  const STORAGE_KEY = "fadelock_web_last_gen";

  // DOM elements
  const passwordDisplay = document.getElementById("passwordDisplay");
  const passwordEmpty = document.getElementById("passwordEmpty");
  const passwordWrapper = document.getElementById("passwordWrapper");
  const passwordValue = document.getElementById("passwordValue");
  const copyBtn = document.getElementById("copyBtn");
  const copyToast = document.getElementById("copyToast");
  const timerBarContainer = document.getElementById("timerBarContainer");
  const timerBar = document.getElementById("timerBar");
  const timerText = document.getElementById("timerText");
  const strengthRow = document.getElementById("strengthRow");
  const strengthLabel = document.getElementById("strengthLabel");
  const segments = [
    document.getElementById("seg1"),
    document.getElementById("seg2"),
    document.getElementById("seg3"),
    document.getElementById("seg4"),
  ];
  const segmentColors = ["#EF4444", "#F97316", "#F59E0B", "#22C55E"];
  const lengthSlider = document.getElementById("lengthSlider");
  const lengthValue = document.getElementById("lengthValue");
  const generateBtn = document.getElementById("generateBtn");
  const cooldownDisplay = document.getElementById("cooldownDisplay");
  const cooldownTimer = document.getElementById("cooldownTimer");

  // Toggle chips
  const toggleUpper = document.getElementById("toggleUpper");
  const toggleLower = document.getElementById("toggleLower");
  const toggleNumbers = document.getElementById("toggleNumbers");
  const toggleSymbols = document.getElementById("toggleSymbols");

  // State
  let options = {
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: false,
  };
  let currentPassword = null;
  let countdownTimer = null;
  let cooldownInterval = null;
  let clipboardClearTimer = null;
  let countdownRemaining = 0;

  // ---- Crypto-secure password generation ----

  function generatePassword(length) {
    let charset = "";
    if (options.uppercase) charset += UPPERCASE;
    if (options.lowercase) charset += LOWERCASE;
    if (options.numbers) charset += NUMBERS;
    if (options.symbols) charset += SYMBOLS;

    if (charset.length === 0) {
      charset = UPPERCASE + LOWERCASE + NUMBERS;
    }

    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length];
    }
    return password;
  }

  // ---- Password strength calculation ----

  function calculateStrength(password) {
    if (!password || password.length === 0) {
      return { score: 0, label: "Very Weak", color: "#EF4444", percentage: 0 };
    }

    let score = 0;
    if (password.length >= 4) score += 0.5;
    if (password.length >= 6) score += 0.5;
    if (password.length >= 8) score += 0.5;
    if (password.length >= 10) score += 0.5;

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    const diversity = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
    score += diversity * 0.5;
    score = Math.min(4, score);

    const roundedScore = Math.round(score);
    const levels = [
      { score: 0, label: "Very Weak", color: "#EF4444", percentage: 10 },
      { score: 1, label: "Weak", color: "#F97316", percentage: 25 },
      { score: 2, label: "Fair", color: "#F59E0B", percentage: 50 },
      { score: 3, label: "Strong", color: "#22C55E", percentage: 75 },
      { score: 4, label: "Very Strong", color: "#10B981", percentage: 100 },
    ];

    return levels[Math.min(roundedScore, 4)];
  }

  // ---- Estimated crack time ----

  function estimateCrackTime(length) {
    let charsetSize = 0;
    if (options.uppercase) charsetSize += 26;
    if (options.lowercase) charsetSize += 26;
    if (options.numbers) charsetSize += 10;
    if (options.symbols) charsetSize += 26;
    if (charsetSize === 0) charsetSize = 62;

    const combinations = Math.pow(charsetSize, length);
    const seconds = combinations / 10_000_000_000;

    if (seconds < 1) return "Instant";
    if (seconds < 60) return Math.round(seconds) + " seconds";
    if (seconds < 3600) return Math.round(seconds / 60) + " minutes";
    if (seconds < 86400) return Math.round(seconds / 3600) + " hours";
    if (seconds < 86400 * 365) return Math.round(seconds / 86400) + " days";
    if (seconds < 86400 * 365 * 1000) return Math.round(seconds / (86400 * 365)) + " years";
    if (seconds < 86400 * 365 * 1_000_000) return Math.round(seconds / (86400 * 365 * 1000)) + "K years";
    return "Millions of years";
  }

  // ---- Cooldown management ----

  function getLastGenerationTime() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? parseInt(stored, 10) : null;
    } catch {
      return null;
    }
  }

  function setLastGenerationTime() {
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {
      // localStorage unavailable
    }
  }

  function canGenerate() {
    const last = getLastGenerationTime();
    if (!last) return true;
    return Date.now() - last >= COOLDOWN_MS;
  }

  function timeUntilNextGeneration() {
    const last = getLastGenerationTime();
    if (!last) return 0;
    const elapsed = Date.now() - last;
    return Math.max(0, COOLDOWN_MS - elapsed);
  }

  function formatCooldown(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return (
      hours.toString().padStart(2, "0") +
      ":" +
      minutes.toString().padStart(2, "0") +
      ":" +
      seconds.toString().padStart(2, "0")
    );
  }

  // ---- UI Updates ----

  function updateStrengthPreview() {
    const length = parseInt(lengthSlider.value, 10);
    // Build a representative sample
    let sampleChars = "";
    if (options.uppercase) sampleChars += "A";
    if (options.lowercase) sampleChars += "a";
    if (options.numbers) sampleChars += "1";
    if (options.symbols) sampleChars += "!";
    if (!sampleChars) sampleChars = "Aa1";

    let sample = "";
    for (let i = 0; i < length; i++) {
      sample += sampleChars[i % sampleChars.length];
    }

    const strength = calculateStrength(sample);
    updateSegments(strength.score);
    if (strengthLabel) {
      strengthLabel.textContent = strength.label;
      strengthLabel.style.color = strength.color;
      strengthLabel.title = "Crack time: " + estimateCrackTime(length);
    }
    if (strengthRow) strengthRow.classList.add("visible");
  }

  let lastActiveCount = 0;

  function updateSegments(score) {
    // score 0-4: light up segments progressively with color coding
    // 1 = red (weak), 2 = orange (fair), 3 = yellow (strong), 4 = green (very strong)
    const activeCount = Math.min(score, 4);
    segments.forEach((seg, i) => {
      if (seg) {
        if (i < activeCount) {
          seg.style.backgroundColor = segmentColors[i];
          // Pulse animation when a new segment lights up
          if (i >= lastActiveCount) {
            seg.classList.remove("pulse");
            void seg.offsetWidth; // force reflow to restart animation
            seg.classList.add("pulse");
          }
        } else {
          seg.style.backgroundColor = "";
          seg.classList.remove("pulse");
        }
      }
    });
    lastActiveCount = activeCount;
  }

  function showPassword(password) {
    currentPassword = password;
    passwordEmpty.style.display = "none";
    passwordWrapper.style.display = "flex";
    passwordValue.textContent = password;
    passwordDisplay.classList.add("generating");
    setTimeout(() => passwordDisplay.classList.remove("generating"), 600);

    // Update strength for actual password
    const strength = calculateStrength(password);
    updateSegments(strength.score);
    if (strengthLabel) {
      strengthLabel.textContent = strength.label;
      strengthLabel.style.color = strength.color;
      strengthLabel.title = "Crack time: " + estimateCrackTime(password.length);
    }
    if (strengthRow) strengthRow.classList.add("visible");
  }

  function clearPassword() {
    currentPassword = null;
    passwordEmpty.style.display = "flex";
    passwordWrapper.style.display = "none";
    passwordValue.textContent = "";
    timerBarContainer.style.display = "none";
    copyToast.classList.remove("show");
  }

  function startAutoDeleteTimer() {
    timerBarContainer.style.display = "block";
    countdownRemaining = AUTO_DELETE_SECONDS;
    timerBar.style.width = "100%";
    timerText.textContent = AUTO_DELETE_SECONDS + "s";

    if (countdownTimer) clearInterval(countdownTimer);

    const startTime = Date.now();
    const totalMs = AUTO_DELETE_SECONDS * 1000;

    countdownTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = totalMs - elapsed;

      if (remaining <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        clearPassword();
        return;
      }

      const pct = (remaining / totalMs) * 100;
      timerBar.style.width = pct + "%";
      timerText.textContent = Math.ceil(remaining / 1000) + "s";
    }, 50);
  }

  function updateCooldownUI() {
    const remaining = timeUntilNextGeneration();
    if (remaining > 0) {
      generateBtn.style.display = "none";
      cooldownDisplay.style.display = "flex";
      cooldownTimer.textContent = formatCooldown(remaining);
    } else {
      generateBtn.style.display = "flex";
      cooldownDisplay.style.display = "none";
    }
  }

  function startCooldownInterval() {
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownInterval = setInterval(() => {
      updateCooldownUI();
      if (timeUntilNextGeneration() <= 0) {
        clearInterval(cooldownInterval);
        cooldownInterval = null;
      }
    }, 1000);
  }

  // ---- Copy to clipboard ----

  async function copyToClipboard() {
    if (!currentPassword) return;

    try {
      await navigator.clipboard.writeText(currentPassword);
      copyToast.classList.add("show");
      copyBtn.classList.add("copied");
      setTimeout(() => copyToast.classList.remove("show"), 2500);
      setTimeout(() => copyBtn.classList.remove("copied"), 2000);

      // Auto-clear clipboard after 15 seconds
      if (clipboardClearTimer) clearTimeout(clipboardClearTimer);
      clipboardClearTimer = setTimeout(async () => {
        try {
          await navigator.clipboard.writeText("");
        } catch {
          // Clipboard clear failed silently
        }
      }, CLIPBOARD_CLEAR_SECONDS * 1000);
    } catch {
      // Fallback: select text for manual copy
      const range = document.createRange();
      range.selectNodeContents(passwordValue);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // ---- Generate handler ----

  function handleGenerate() {
    if (!canGenerate()) {
      return;
    }

    const length = parseInt(lengthSlider.value, 10);
    const password = generatePassword(length);

    setLastGenerationTime();
    showPassword(password);
    startAutoDeleteTimer();
    updateCooldownUI();
    startCooldownInterval();

    // Increment total generation counter for social proof
    const totalGens = parseInt(localStorage.getItem('fadelock_total_gens') || '0', 10);
    localStorage.setItem('fadelock_total_gens', String(totalGens + 1));
  }

  // ---- Toggle handlers ----

  function setupToggles() {
    const toggleMap = [
      { el: toggleUpper, key: "uppercase" },
      { el: toggleLower, key: "lowercase" },
      { el: toggleNumbers, key: "numbers" },
      { el: toggleSymbols, key: "symbols" },
    ];

    toggleMap.forEach(({ el, key }) => {
      el.addEventListener("click", () => {
        // Prevent disabling all options
        const activeCount = Object.values(options).filter(Boolean).length;
        if (options[key] && activeCount <= 1) return;

        options[key] = !options[key];
        el.classList.toggle("active", options[key]);
        updateStrengthPreview();
      });
    });
  }

  // ---- Slider handler ----

  function setupSlider() {
    lengthSlider.addEventListener("input", () => {
      lengthValue.textContent = lengthSlider.value;
      updateStrengthPreview();
    });
  }

  // ---- Event listeners ----

  function init() {
    setupToggles();
    setupSlider();

    generateBtn.addEventListener("click", handleGenerate);
    copyBtn.addEventListener("click", copyToClipboard);

    // Initial UI state
    updateStrengthPreview();
    updateCooldownUI();

    // Start cooldown interval if needed
    if (timeUntilNextGeneration() > 0) {
      startCooldownInterval();
    }

    // Keyboard shortcut: Enter to generate
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && canGenerate() && !currentPassword) {
        handleGenerate();
      }
    });
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
