/* ==========================================================================
   LOGIQUE DE L'APPLICATION — VANILLA JS, ANIME.JS & WEB AUDIO API
   Fichier : app.js
   ========================================================================== */

// Webhook URL Google Apps Script pour l'enregistrement automatique dans Google Sheets
const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxppu2PcP2t1yHGRWT47etcZRnp2eHzzBgcI4mot1R_DvFh_gLdvh2MimlBeni_LzTJog/exec"; 

// État global de l'application
const state = {
  currentSectionId: "section-1",
  selectedBranch: null, // "pro" ou "public"
  currentSubstepSec2: 1, // 1 à 3
  currentSubstepSec3: 1, // 1 à 3
  soundEnabled: false,
  startTime: Date.now(),
  userJob: "",
  answers: {}
};

// HELPERS DEFENSIFS SAFETY
function safeSplit(value, delimiter = ",") {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(delimiter).map(s => s.trim()).filter(Boolean);
  return [String(value)];
}

function cleanLabel(val) {
  if (!val) return "";
  const str = typeof val === "string" ? val : String(val);
  return str.split("(")[0].trim();
}

// Synthèse Sonore Web Audio API (Effets Studio)
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx && typeof window.AudioContext !== "undefined") {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type) {
  if (!state.soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === "click") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.015);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
      osc.start(now);
      osc.stop(now + 0.015);
    } else if (type === "tick") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
      osc.start(now);
      osc.stop(now + 0.01);
    } else if (type === "whoosh") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  } catch (e) {
    // Ignorer les erreurs audio browser
  }
}

// Libellés dynamiques qualitatifs pour les échelles 1 à 5
const SLIDER_FEEDBACK_MAPS = {
  pro_time_gain_agree: {
    1: "1/5 : Pas du tout d'accord",
    2: "2/5 : Plutôt pas d'accord",
    3: "3/5 : Mitigé",
    4: "4/5 : Plutôt d'accord",
    5: "5/5 : Tout à fait d'accord"
  },
  pro_supervisor_role: {
    1: "1/5 : Pas du tout d'accord",
    2: "2/5 : Plutôt pas d'accord",
    3: "3/5 : Évolution naturelle",
    4: "4/5 : Plutôt d'accord",
    5: "5/5 : Tout à fait d'accord"
  },
  public_sound_attention: {
    1: "1/5 : Secondaire",
    2: "2/5 : Peu attentif",
    3: "3/5 : Attentif",
    4: "4/5 : Très attentif",
    5: "5/5 : Priorité absolue"
  },
  public_dialogue_preference: {
    1: "1/5 : Voix 100% intelligible (quitte à paraître traitée)",
    2: "2/5 : Plutôt propre",
    3: "3/5 : Équilibre propreté / naturel",
    4: "4/5 : Plutôt naturel",
    5: "5/5 : Prise naturelle avec ses imperfections de tournage"
  },
  public_room_tone_importance: {
    1: "1/5 : Aucune (seul le texte compte)",
    2: "2/5 : Faible importance",
    3: "3/5 : Importance moyenne",
    4: "4/5 : Très importante",
    5: "5/5 : Indispensable pour créer une vraie atmosphère"
  },
  global_human_imperfection_agree: {
    1: "1/5 : Pas du tout d'accord",
    2: "2/5 : Plutôt pas d'accord",
    3: "3/5 : Nuancé",
    4: "4/5 : Plutôt d'accord",
    5: "5/5 : Tout à fait d'accord"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initSoundToggle();
  initWaveformCanvas();
  initGlowButtons();
  initNavigation();
  initFormListeners();
  initMicroInteractions();
  initOtherInputsFocus();
  initCustomSliders();
  initSuggestionChips();
  initEndActions();
  
  animateSectionIn(document.getElementById("section-1"));
});

/* ==========================================================================
   AUDIO TOGGLE STUDIO
   ========================================================================== */
function initSoundToggle() {
  const btn = document.getElementById("btn-sound-toggle");
  if (!btn) return;

  btn.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    const icon = btn.querySelector(".sound-icon");
    if (icon) icon.textContent = state.soundEnabled ? "🔊" : "🔇";
    btn.classList.toggle("active", state.soundEnabled);
    if (state.soundEnabled) {
      playSound("click");
      showToast("Son studio activé 🔊");
    } else {
      showToast("Son désactivé 🔇");
    }
  });
}

/* ==========================================================================
   CANVAS WAVEFORM ANIMÉE & RÉACTIVE
   ========================================================================== */
let wavePulse = 1;
function triggerWaveformPulse() {
  wavePulse = 2.5;
}

function initWaveformCanvas() {
  const canvas = document.getElementById("waveform-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  let step = 0;
  function render() {
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";

    const centerY = height * 0.85;
    step += 0.03;

    if (wavePulse > 1) {
      wavePulse -= 0.04;
    }

    for (let x = 0; x < width; x += 10) {
      const y = centerY + Math.sin(x * 0.008 + step) * 15 * wavePulse + Math.cos(x * 0.015 - step) * 8 * wavePulse;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    requestAnimationFrame(render);
  }
  render();
}

/* ==========================================================================
   EFFECT HALO RADIANT SUR BOUTONS (GLOW)
   ========================================================================== */
function initGlowButtons() {
  document.querySelectorAll(".glow-btn, .option-card").forEach(btn => {
    btn.addEventListener("mousemove", (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      btn.style.setProperty("--mouse-x", `${x}px`);
      btn.style.setProperty("--mouse-y", `${y}px`);
    });
  });
}

/* ==========================================================================
   TOASTS & FLASH MESSAGES ÉPHÉMÈRES
   ========================================================================== */
function showToast(msg) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast-message";
  toast.textContent = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 1200);
}

/* ==========================================================================
   RUBAN DE PROFILAGE EN DIRECT (STICKY RIBBON)
   ========================================================================== */
function updateProfilerRibbon() {
  const ribbon = document.getElementById("user-profiler-ribbon");
  const tagsContainer = document.getElementById("ribbon-tags");
  if (!ribbon || !tagsContainer) return;

  const tags = [];

  if (state.selectedBranch === "pro") {
    tags.push("🎬 Pro du son");
  } else if (state.answers.domain_sector === "cinema_other") {
    tags.push("🎥 Métiers Image");
  } else if (state.answers.domain_sector === "public_other") {
    tags.push("🍿 Spectateur");
  }

  if (state.answers.pro_job) {
    tags.push(`🎧 ${cleanLabel(state.answers.pro_job)}`);
  } else if (state.answers.public_job) {
    tags.push(`📽️ ${cleanLabel(state.answers.public_job)}`);
  }

  if (state.answers.pro_experience) {
    tags.push(`⏱ ${cleanLabel(state.answers.pro_experience)}`);
  }

  const delTasks = safeSplit(state.answers.pro_delegated_tasks);
  if (delTasks.length > 0) {
    tags.push(`⚙️ ${delTasks.length} outils IA`);
  }

  if (tags.length > 0) {
    ribbon.classList.remove("hidden");
    tagsContainer.innerHTML = tags.map(t => `<span class="tag-item">${t}</span>`).join("");
  }
}

/* ==========================================================================
   INTERSTICE DE RESPIRATION (1.2S)
   ========================================================================== */
function showInterstitial(titleText, callback) {
  const overlay = document.getElementById("interstitial-overlay");
  const title = document.getElementById("interstitial-title-text");

  if (!overlay) {
    callback();
    return;
  }

  if (title) title.textContent = titleText;
  overlay.classList.remove("hidden");
  playSound("whoosh");

  setTimeout(() => {
    overlay.classList.add("hidden");
    callback();
  }, 1200);
}

/* ==========================================================================
   1. NAVIGATION & TRANSITIONS ENTRE SECTIONS & SOUS-ÉCRANS
   ========================================================================== */
function initNavigation() {
  const btnSec1Next = document.getElementById("btn-sec1-next");
  const btnSec2Next = document.getElementById("btn-sec2-next");
  const btnSec2Back = document.getElementById("btn-sec2-back");
  const btnSec3Next = document.getElementById("btn-sec3-next");
  const btnSec3Back = document.getElementById("btn-sec3-back");
  const btnSec4Back = document.getElementById("btn-sec4-back");
  const btnSubmit = document.getElementById("btn-submit");

  btnSec1Next?.addEventListener("click", () => {
    playSound("click");
    triggerWaveformPulse();
    const domain = getSelectedRadioValue("domain_sector");
    state.answers["domain_sector"] = domain;

    updateProfilerRibbon();

    if (domain === "pro_audio") {
      state.selectedBranch = "pro";
      state.currentSubstepSec2 = 1;
      showSubstep("section-2", 1);
      showInterstitial("Entrons dans le vif du sujet sur la console...", () => {
        navigateToSection("section-2");
      });
    } else {
      state.selectedBranch = "public";
      state.currentSubstepSec3 = 1;
      showSubstep("section-3", 1);
      showInterstitial("Voyons comment cela résonne côté image...", () => {
        navigateToSection("section-3");
      });
    }
  });

  btnSec2Next?.addEventListener("click", () => {
    playSound("click");
    triggerWaveformPulse();
    collectSectionInputs("section-2");
    updateProfilerRibbon();

    if (state.currentSubstepSec2 < 3) {
      state.currentSubstepSec2++;
      switchSubstep("section-2", state.currentSubstepSec2);
    } else {
      updatePreSubmitSummary();
      navigateToSection("section-4");
    }
  });

  btnSec2Back?.addEventListener("click", () => {
    playSound("click");
    if (state.currentSubstepSec2 > 1) {
      state.currentSubstepSec2--;
      switchSubstep("section-2", state.currentSubstepSec2);
    } else {
      navigateToSection("section-1");
    }
  });

  btnSec3Next?.addEventListener("click", () => {
    playSound("click");
    triggerWaveformPulse();
    collectSectionInputs("section-3");
    updateProfilerRibbon();

    if (state.currentSubstepSec3 < 3) {
      state.currentSubstepSec3++;
      switchSubstep("section-3", state.currentSubstepSec3);
    } else {
      updatePreSubmitSummary();
      navigateToSection("section-4");
    }
  });

  btnSec3Back?.addEventListener("click", () => {
    playSound("click");
    if (state.currentSubstepSec3 > 1) {
      state.currentSubstepSec3--;
      switchSubstep("section-3", state.currentSubstepSec3);
    } else {
      navigateToSection("section-1");
    }
  });

  btnSec4Back?.addEventListener("click", () => {
    playSound("click");
    if (state.selectedBranch === "pro") {
      state.currentSubstepSec2 = 3;
      showSubstep("section-2", 3);
      navigateToSection("section-2");
    } else {
      state.currentSubstepSec3 = 3;
      showSubstep("section-3", 3);
      navigateToSection("section-3");
    }
  });

  btnSubmit?.addEventListener("click", async () => {
    playSound("click");
    collectSectionInputs("section-4");
    checkEasterEgg();
    await handleFormSubmission();
  });
}

function showSubstep(sectionId, stepNum) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const substeps = section.querySelectorAll(".sub-step");
  substeps.forEach(st => {
    const isTarget = parseInt(st.dataset.step) === stepNum;
    if (isTarget) {
      st.classList.remove("hidden");
      st.classList.add("active");
    } else {
      st.classList.remove("active");
      st.classList.add("hidden");
    }
  });

  const badge = document.getElementById(`substep-badge-${sectionId === "section-2" ? "sec2" : "sec3"}`);
  if (badge) {
    if (stepNum === 1) badge.textContent = "Questions 1 à 3 sur 9";
    else if (stepNum === 2) badge.textContent = "Questions 4 à 6 sur 9";
    else if (stepNum === 3) badge.textContent = "Questions 7 à 9 sur 9";
  }

  const nextBtn = section.querySelector(".btn-primary");
  if (nextBtn) {
    const spanText = nextBtn.querySelector("span");
    if (spanText) {
      spanText.textContent = stepNum === 3 ? "Suivant (Conclusion)" : "Suivant";
    }
  }
}

function switchSubstep(sectionId, targetStepNum) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const activeSubstep = section.querySelector(".sub-step.active");
  const targetSubstep = section.querySelector(`.sub-step[data-step="${targetStepNum}"]`);

  if (!targetSubstep) return;

  if (activeSubstep && typeof anime !== "undefined") {
    anime({
      targets: activeSubstep,
      opacity: [1, 0],
      translateY: [0, -8],
      duration: 160,
      easing: "easeInQuad",
      complete: () => {
        activeSubstep.classList.remove("active");
        activeSubstep.classList.add("hidden");

        showSubstep(sectionId, targetStepNum);
        
        anime({
          targets: targetSubstep,
          opacity: [0, 1],
          translateY: [10, 0],
          duration: 250,
          easing: "easeOutCubic"
        });

        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  } else {
    showSubstep(sectionId, targetStepNum);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  updateProgressBar(sectionId);
}

function navigateToSection(targetSectionId) {
  const currentSec = document.getElementById(state.currentSectionId);
  const targetSec = document.getElementById(targetSectionId);

  if (!currentSec || !targetSec) return;

  if (typeof anime !== "undefined") {
    anime({
      targets: currentSec,
      opacity: [1, 0],
      translateY: [0, -10],
      duration: 180,
      easing: "easeInQuad",
      complete: () => {
        currentSec.classList.remove("active");
        currentSec.classList.add("hidden");

        targetSec.classList.remove("hidden");
        targetSec.classList.add("active");
        state.currentSectionId = targetSectionId;

        animateSectionIn(targetSec);
        updateProgressBar(targetSectionId);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  } else {
    currentSec.classList.remove("active");
    currentSec.classList.add("hidden");
    targetSec.classList.remove("hidden");
    targetSec.classList.add("active");
    state.currentSectionId = targetSectionId;
    updateProgressBar(targetSectionId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function animateSectionIn(sectionEl) {
  if (!sectionEl || typeof anime === "undefined") return;

  anime({
    targets: sectionEl,
    opacity: [0, 1],
    translateY: [12, 0],
    duration: 350,
    easing: "easeOutCubic"
  });

  const elementsToStagger = sectionEl.querySelectorAll(".question-block, .option-card, .matrix-wrapper, .custom-slider-container");
  if (elementsToStagger.length > 0) {
    anime({
      targets: elementsToStagger,
      opacity: [0, 1],
      translateY: [8, 0],
      delay: anime.stagger(30, { start: 60 }),
      duration: 280,
      easing: "easeOutCubic"
    });
  }
}

function updateProgressBar(sectionId) {
  const progressBar = document.getElementById("global-progress-bar");
  const stepText = document.getElementById("progress-step-text");
  const percentText = document.getElementById("progress-percentage");
  const container = document.getElementById("progress-bar-container");

  let stepNumber = 1;
  let totalSteps = 3;
  let percentage = 33;

  if (sectionId === "section-1") {
    stepNumber = 1;
    percentage = 33;
  } else if (sectionId === "section-2") {
    stepNumber = 2;
    const substep = state.currentSubstepSec2;
    percentage = 33 + (substep / 3) * 33;
  } else if (sectionId === "section-3") {
    stepNumber = 2;
    const substep = state.currentSubstepSec3;
    percentage = 33 + (substep / 3) * 33;
  } else if (sectionId === "section-4" || sectionId === "section-success") {
    stepNumber = 3;
    percentage = 100;
  }

  if (progressBar) {
    if (typeof anime !== "undefined") {
      anime({
        targets: progressBar,
        width: `${percentage}%`,
        duration: 450,
        easing: "easeOutCubic"
      });
    } else {
      progressBar.style.width = `${percentage}%`;
    }
  }

  if (stepText) stepText.textContent = `Étape ${stepNumber} sur ${totalSteps}`;
  if (percentText) percentText.textContent = `${Math.round(percentage)}%`;
  if (container) container.setAttribute("aria-valuenow", percentage);
}

/* ==========================================================================
   2. COMPOSANT CUSTOM SLIDER PHYSIQUE SPRING & FEEDBACK DYNAMIQUE
   ========================================================================== */
function initCustomSliders() {
  document.querySelectorAll(".custom-slider-container").forEach(container => {
    const hiddenInput = container.querySelector('input[type="hidden"]');
    const trackWrapper = container.querySelector(".slider-track-wrapper");
    const fill = container.querySelector(".slider-fill");
    const thumb = container.querySelector(".slider-thumb");
    const badge = container.querySelector(".thumb-badge");
    const feedbackLabel = container.querySelector(".slider-feedback-label");
    const ticks = container.querySelectorAll(".tick-mark");
    const name = container.dataset.name;

    let isDragging = false;
    let currentStep = parseInt(container.dataset.value || "3");

    function getFeedbackText(step) {
      if (SLIDER_FEEDBACK_MAPS[name] && SLIDER_FEEDBACK_MAPS[name][step]) {
        return SLIDER_FEEDBACK_MAPS[name][step];
      }
      return `${step}/5`;
    }

    function updateTicksVisual(step) {
      ticks.forEach((tick, idx) => {
        if (idx + 1 === step) {
          tick.classList.add("active");
        } else {
          tick.classList.remove("active");
        }
      });
    }

    function setStep(step, animate = true) {
      step = Math.max(1, Math.min(5, step));
      currentStep = step;
      container.dataset.value = step;
      if (hiddenInput) hiddenInput.value = step;
      state.answers[name] = step;

      const targetPct = (step - 1) * 25;

      if (badge) badge.textContent = step;
      if (feedbackLabel) feedbackLabel.textContent = getFeedbackText(step);
      updateTicksVisual(step);

      if (animate && typeof anime !== "undefined") {
        anime.remove(thumb);
        anime.remove(fill);

        anime({
          targets: thumb,
          left: `${targetPct}%`,
          duration: 350,
          easing: "spring(1, 80, 10, 0)"
        });
        anime({
          targets: fill,
          width: `${targetPct}%`,
          duration: 350,
          easing: "easeOutCubic"
        });
      } else {
        thumb.style.left = `${targetPct}%`;
        fill.style.width = `${targetPct}%`;
      }
    }

    function calculatePos(clientX) {
      const rect = trackWrapper.getBoundingClientRect();
      const rawPct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const step = Math.round(rawPct / 25) + 1;
      return { rawPct, step };
    }

    function onPointerDown(e) {
      isDragging = true;
      thumb.classList.add("is-dragging");
      triggerWaveformPulse();

      if (typeof anime !== "undefined") {
        anime.remove(thumb);
        anime.remove(fill);
      }

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const { rawPct, step } = calculatePos(clientX);

      fill.style.width = `${rawPct}%`;
      thumb.style.left = `${rawPct}%`;
      if (badge) badge.textContent = step;
      if (feedbackLabel) feedbackLabel.textContent = getFeedbackText(step);
      updateTicksVisual(step);

      window.addEventListener("mousemove", onPointerMove);
      window.addEventListener("touchmove", onPointerMove, { passive: false });
      window.addEventListener("mouseup", onPointerUp);
      window.addEventListener("touchend", onPointerUp);
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      if (e.cancelable) e.preventDefault();

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const { rawPct, step } = calculatePos(clientX);

      fill.style.width = `${rawPct}%`;
      thumb.style.left = `${rawPct}%`;
      if (badge) badge.textContent = step;
      if (feedbackLabel) feedbackLabel.textContent = getFeedbackText(step);
      updateTicksVisual(step);

      playSound("tick");
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      thumb.classList.remove("is-dragging");

      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const { step } = calculatePos(clientX);

      setStep(step, true);
      playSound("click");

      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchend", onPointerUp);
    }

    trackWrapper.addEventListener("mousedown", onPointerDown);
    trackWrapper.addEventListener("touchstart", onPointerDown, { passive: true });

    setStep(3, false);
  });
}

/* ==========================================================================
   3. CHIPS DE SUGGESTION & WORDING DYNAMIQUE
   ========================================================================== */
function initSuggestionChips() {
  const textarea = document.getElementById("global-final-comment");
  const chips = document.querySelectorAll(".suggestion-chips .chip-btn");

  if (!textarea) return;

  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      playSound("click");
      const prefix = chip.dataset.prefix;
      if (prefix) {
        if (!textarea.value.startsWith(prefix)) {
          textarea.value = prefix + textarea.value;
        }
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    });
  });
}

function updateDynamicWording() {
  if (state.answers.pro_job) {
    const jobLabel = cleanLabel(state.answers.pro_job).toLowerCase();
    const labelQ27 = document.getElementById("label-q2-7");
    if (labelQ27 && jobLabel) {
      labelQ27.innerHTML = `7. En tant que <strong>${jobLabel}</strong>, le rôle glisse-t-il de "l'artisan du signal" vers un "superviseur" qui valide le travail des algorithmes ?`;
    }
  }
}

/* ==========================================================================
   4. CHECKMARKS & COMPTEURS DE CASES À COCHER & PULSE
   ========================================================================== */
function initFormListeners() {
  const section1Inputs = document.querySelectorAll('#section-1 input[name="domain_sector"]');
  const btnSec1Next = document.getElementById("btn-sec1-next");

  section1Inputs.forEach(input => {
    input.addEventListener("change", () => {
      if (btnSec1Next) btnSec1Next.disabled = false;
      const checkq1 = document.getElementById("check-q1");
      if (checkq1) checkq1.classList.add("visible");
      showToast("Option sélectionnée !");
    });
  });

  document.querySelectorAll("input[type='checkbox']").forEach(cb => {
    cb.addEventListener("change", () => {
      playSound("click");
      triggerWaveformPulse();
      const groupName = cb.name;
      const groupChecked = document.querySelectorAll(`input[name="${groupName}"]:checked`);
      const counterEl = document.getElementById(`counter-${groupName}`);
      if (counterEl) {
        const count = groupChecked.length;
        counterEl.textContent = `${count} sélectionné${count > 1 ? "s" : ""}`;
        if (typeof anime !== "undefined") {
          anime({ targets: counterEl, scale: [1.2, 1], duration: 150, easing: "easeOutQuad" });
        }
      }
    });
  });

  document.querySelectorAll("input[type='radio']").forEach(radio => {
    radio.addEventListener("change", () => {
      playSound("click");
      triggerWaveformPulse();

      const qBlock = radio.closest(".question-block");
      const checkmark = qBlock?.querySelector(".q-checkmark");
      if (checkmark) checkmark.classList.add("visible");

      const panel = document.getElementById("main-panel");
      if (panel) {
        panel.classList.add("panel-pulse");
        setTimeout(() => panel.classList.remove("panel-pulse"), 250);
      }

      if (radio.name === "pro_job") {
        updateDynamicWording();
      }
    });
  });
}

function initOtherInputsFocus() {
  document.querySelectorAll(".inline-other-input, textarea").forEach(input => {
    input.addEventListener("focus", () => {
      const parentLabel = input.closest(".option-card");
      const checkable = parentLabel?.querySelector("input[type='radio'], input[type='checkbox']");
      if (checkable) {
        checkable.checked = true;
        checkable.dispatchEvent(new Event("change", { bubbles: true }));
      }
      setTimeout(() => {
        input.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 250);
    });
  });
}

function collectSectionInputs(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const hiddenInputs = section.querySelectorAll('input[type="hidden"]');
  hiddenInputs.forEach(hInput => {
    if (hInput.name) state.answers[hInput.name] = parseInt(hInput.value || "3");
  });

  const radioInputs = section.querySelectorAll("input[type='radio']:checked");
  radioInputs.forEach(input => {
    if (input.name) {
      if (input.value === "Autre") {
        const otherTextInput = section.querySelector(`input[name="${input.name}_other"]`);
        state.answers[input.name] = "Autre";
        if (otherTextInput?.name) {
          state.answers[otherTextInput.name] = otherTextInput.value.trim();
        }
      } else {
        state.answers[input.name] = input.value;
      }
    }
  });

  const textareas = section.querySelectorAll("textarea");
  textareas.forEach(txt => {
    if (txt.name) {
      state.answers[txt.name] = txt.value.trim();
    }
  });

  const checkboxes = section.querySelectorAll("input[type='checkbox']");
  const checkboxGroups = {};
  checkboxes.forEach(cb => {
    if (!checkboxGroups[cb.name]) checkboxGroups[cb.name] = [];
    if (cb.checked) {
      checkboxGroups[cb.name].push(cb.value);
      if (cb.value === "Autre") {
        const otherTextInput = section.querySelector(`input[name="${cb.name}_other"]`);
        if (otherTextInput?.name) {
          state.answers[otherTextInput.name] = otherTextInput.value.trim();
        }
      }
    }
  });
  Object.keys(checkboxGroups).forEach(groupName => {
    state.answers[groupName] = checkboxGroups[groupName];
  });

  section.querySelectorAll(".inline-other-input").forEach(otherInput => {
    if (otherInput.name && otherInput.value.trim()) {
      state.answers[otherInput.name] = otherInput.value.trim();
    }
  });
}

function getSelectedRadioValue(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : null;
}

/* ==========================================================================
   5. ANIME.JS MICRO-BUMP SUR LES CARTE DE CHOIX
   ========================================================================== */
function initMicroInteractions() {
  if (typeof anime === "undefined") return;

  document.querySelectorAll(".option-card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("inline-other-input")) return;
      
      anime({
        targets: card,
        scale: [1, 1.04, 1],
        duration: 180,
        easing: "easeOutCubic"
      });
    });
  });

  document.querySelectorAll(".btn-primary, .btn-secondary, .btn-submit").forEach(btn => {
    btn.addEventListener("mousedown", () => {
      anime({ targets: btn, scale: 0.96, duration: 100, easing: "easeOutQuad" });
    });
    btn.addEventListener("mouseup", () => {
      anime({ targets: btn, scale: 1, duration: 150, easing: "easeOutCubic" });
    });
  });
}

/* ==========================================================================
   6. GENERATEUR LOGIQUE DE SYNTHESE
   ========================================================================== */
function generatePositioningSummary(answers) {
  const isPro = state.selectedBranch === "pro" || answers.userBranch === "pro";
  const rawJob = isPro 
    ? (answers.pro_job || "Professionnel du son")
    : (answers.public_job || "Collaborateur / Spectateur");
  const job = cleanLabel(rawJob);

  const perceptionRaw = (answers.global_ai_perception || "").toLowerCase();
  let perceptionText = "un outil d'appoint à apprivoiser";
  
  if (perceptionRaw.includes("opportunité") || perceptionRaw.includes("passionnante")) {
    perceptionText = "un levier créatif stimulant et prometteur";
  } else if (perceptionRaw.includes("menace")) {
    perceptionText = "un risque pour la sensibilité artistique et l'artisanat";
  } else if (perceptionRaw.includes("outil")) {
    perceptionText = "un simple outil technique au service du projet";
  }

  let nuanceText = "";

  if (isPro) {
    const overclean = (answers.pro_overclean_risk || "").toLowerCase();
    const supervisorRating = parseInt(answers.pro_supervisor_role || 3);

    if (overclean.includes("oui") || overclean.includes("vrai problème")) {
      nuanceText = "tout en restant très vigilant face au risque d'un son lissé ou dénaturé";
    } else if (supervisorRating >= 4) {
      nuanceText = "en anticipant une évolution vers un rôle de supervision et de direction artistique";
    } else {
      nuanceText = "tout en veillant à préserver l'exigence d'une oreille critique humaine";
    }
  } else {
    const roomToneRating = parseInt(answers.public_room_tone_importance || 3);
    const dialoguePref = parseInt(answers.public_dialogue_preference || 3);

    if (roomToneRating >= 4) {
      nuanceText = "avec un attachement fort à l'atmosphère acoustique et au grain naturel des lieux";
    } else if (dialoguePref <= 2) {
      nuanceText = "en accordant une priorité absolue à la clarté et l'intelligibilité des voix";
    } else {
      nuanceText = "tout en privilégiant l'immersion globale et l'authenticité de l'œuvre";
    }
  }

  return `En tant que <strong>${job}</strong>, vous percevez l'IA en post-production principalement comme <strong>${perceptionText}</strong>, ${nuanceText}.`;
}

function updatePreSubmitSummary() {
  const summaryBox = document.getElementById("pre-submit-summary");
  const summaryText = document.getElementById("summary-text-content");

  if (!summaryBox || !summaryText) return;

  const summaryHtml = generatePositioningSummary(state.answers);
  summaryText.innerHTML = summaryHtml;
  summaryBox.classList.remove("hidden");
}

/* ==========================================================================
   7. EASTER EGG ÉGALISEUR TRANCHÉ
   ========================================================================== */
function checkEasterEgg() {
  const elapsed = (Date.now() - state.startTime) / 1000;
  if (elapsed < 12) {
    showToast("On dirait que votre avis est déjà bien tranché sur le sujet ! 👀");
  }
}

/* ==========================================================================
   8. ACTIONS DE FIN (PARTAGE & MODAL ACCORDÉON RÉCAPITULATIF)
   ========================================================================== */
function initEndActions() {
  const btnShare = document.getElementById("btn-share-survey");
  const btnReview = document.getElementById("btn-review-answers");
  const modal = document.getElementById("recap-modal");
  const btnClose = document.getElementById("btn-close-recap");

  btnShare?.addEventListener("click", () => {
    playSound("click");
    const shareUrl = window.location.href.startsWith("http") ? window.location.href : "https://sondage-veille.vercel.app";
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast("Lien copié ! Merci pour le relais 🙏");
    }).catch(() => {
      showToast("Lien : sondage-veille.vercel.app");
    });
  });

  btnReview?.addEventListener("click", () => {
    playSound("click");
    if (!modal) return;
    populateRecapModal();
    modal.classList.remove("hidden");
  });

  btnClose?.addEventListener("click", () => {
    playSound("click");
    if (modal) modal.classList.add("hidden");
  });
}

function populateRecapModal() {
  const container = document.getElementById("recap-modal-list");
  if (!container) return;

  const answers = state.answers;
  const items = [];

  const labelsMap = {
    domain_sector: "Activité principale",
    pro_job: "Rôle Post-Prod",
    pro_experience: "Expérience",
    pro_delegated_tasks: "Tâches déléguées à l'IA",
    pro_time_gain_agree: "Gain de temps vs création",
    pro_overclean_risk: "Risque son sur-nettoyé",
    pro_supervisor_role: "Rôle de superviseur",
    pro_critical_ear_danger: "Danger oreille critique",
    pro_resistant_fields: "Domaines préservés",
    public_job: "Métier / Rôle Image",
    public_sound_attention: "Attention au son",
    public_bothered_overclean: "Son trop nettoyé remarqué",
    public_dialogue_preference: "Préférence dialogue",
    public_delegate_ai_full: "Restauration IA 100% auto",
    public_editor_ai_use: "Utilisation IA montage image",
    public_set_behavior_changed: "Rigueur sur les plateaux",
    public_room_tone_importance: "Valeur Room Tone",
    public_saved_time_reinvestment: "Réinvestissement du temps",
    global_ai_perception: "Perception globale IA",
    global_human_imperfection_agree: "Imperfection humaine vs IA",
    global_final_comment: "Mot de la fin"
  };

  Object.keys(answers).forEach(key => {
    const val = answers[key];
    if (val && labelsMap[key]) {
      const displayVal = Array.isArray(val) ? val.join(", ") : val;
      items.push(`
        <div class="recap-item">
          <div class="recap-q">${labelsMap[key]} :</div>
          <div class="recap-a">${displayVal}</div>
        </div>
      `);
    }
  });

  container.innerHTML = items.length > 0 ? items.join("") : "<p class='recap-q'>Aucune donnée enregistrée.</p>";
}

/* ==========================================================================
   9. SOUMISSION WEBHOOK & ÉCRAN DE CONFIRMATION CÉLÉBRATION (CONFETTI)
   ========================================================================== */
async function handleFormSubmission() {
  const btnSubmit = document.getElementById("btn-submit");
  const spinner = document.getElementById("submit-spinner");
  const btnText = btnSubmit?.querySelector(".btn-text");
  const loadingOverlay = document.getElementById("loading-overlay");

  const answers = state.answers;

  let userBranch = "public_other";
  if (state.selectedBranch === "pro") {
    userBranch = "pro";
  } else if (answers.domain_sector === "cinema_other") {
    userBranch = "public_image";
  } else {
    userBranch = "public_other";
  }

  const getArrayVal = (val) => Array.isArray(val) ? val.join(", ") : (val || "");

  const payload = {
    submittedAt: new Date().toISOString(),
    userBranch: userBranch,
    domain_sector: answers.domain_sector || "N/A",
    pro_job: answers.pro_job || "",
    pro_job_other: answers.pro_job_other || "",
    pro_experience: answers.pro_experience || "",
    pro_delegated_tasks: getArrayVal(answers.pro_delegated_tasks),
    pro_freq_denoise: answers.pro_freq_denoise || "",
    pro_freq_isolate: answers.pro_freq_isolate || "",
    pro_freq_transcription: answers.pro_freq_transcription || "",
    pro_freq_dereverb: answers.pro_freq_dereverb || "",
    pro_freq_spectral_rec: answers.pro_freq_spectral_rec || "",
    pro_time_gain_agree: answers.pro_time_gain_agree || "",
    pro_overclean_risk: answers.pro_overclean_risk || "",
    pro_overclean_risk_other: answers.pro_overclean_risk_other || "",
    pro_supervisor_role: answers.pro_supervisor_role || "",
    pro_critical_ear_danger: answers.pro_critical_ear_danger || "",
    pro_critical_ear_other: answers.pro_critical_ear_other || "",
    pro_resistant_fields: getArrayVal(answers.pro_resistant_fields),
    pro_resistant_fields_other: answers.pro_resistant_fields_other || "",
    public_job: answers.public_job || "",
    public_job_other: answers.public_job_other || "",
    public_sound_attention: answers.public_sound_attention || "",
    public_bothered_overclean: answers.public_bothered_overclean || "",
    public_dialogue_preference: answers.public_dialogue_preference || "",
    public_delegate_ai_full: answers.public_delegate_ai_full || "",
    public_editor_ai_use: answers.public_editor_ai_use || "",
    public_set_behavior_changed: answers.public_set_behavior_changed || "",
    public_set_behavior_other: answers.public_set_behavior_other || "",
    public_room_tone_importance: answers.public_room_tone_importance || "",
    public_saved_time_reinvestment: answers.public_saved_time_reinvestment || "",
    public_saved_time_other: answers.public_saved_time_other || "",
    global_ai_perception: answers.global_ai_perception || "",
    global_ai_perception_other: answers.global_ai_perception_other || "",
    global_human_imperfection_agree: answers.global_human_imperfection_agree || "",
    global_final_comment: answers.global_final_comment || ""
  };

  if (btnSubmit) btnSubmit.disabled = true;
  if (spinner) spinner.classList.remove("hidden");
  if (btnText) btnText.textContent = "Transmission en cours...";
  if (loadingOverlay) loadingOverlay.classList.remove("hidden");

  const mainPanel = document.getElementById("main-panel");
  if (mainPanel && typeof anime !== "undefined") {
    anime({
      targets: mainPanel,
      translateY: [0, -14],
      opacity: [1, 0.95],
      duration: 300,
      easing: "easeOutCubic"
    });
  }

  await submitResponses(payload);
}

async function submitResponses(data) {
  const loadingOverlay = document.getElementById("loading-overlay");
  const btnSubmit = document.getElementById("btn-submit");
  const spinner = document.getElementById("submit-spinner");
  const btnText = btnSubmit?.querySelector(".btn-text");

  if (!WEBHOOK_URL) {
    setTimeout(() => {
      if (loadingOverlay) loadingOverlay.classList.add("hidden");
      fallbackExport(data);
    }, 600);
    return;
  }

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data)
    });
    
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
    showSuccessScreen(false, data.userBranch);
  } catch (err) {
    console.warn("Erreur d'envoi vers Google Apps Script, bascule sur fallback local :", err);
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
    if (btnSubmit) btnSubmit.disabled = false;
    if (spinner) spinner.classList.add("hidden");
    if (btnText) btnText.textContent = "Transmettre mes réponses";
    fallbackExport(data);
  }
}

function fallbackExport(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reponses-sondage-veille-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const fallbackContainer = document.getElementById("fallback-container");
  const btnCopy = document.getElementById("btn-copy-json");
  const btnDownload = document.getElementById("btn-download-json");

  if (fallbackContainer) fallbackContainer.classList.remove("hidden");

  btnCopy?.addEventListener("click", () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      btnCopy.querySelector("span").textContent = "Copié dans le presse-papier !";
      setTimeout(() => {
        btnCopy.querySelector("span").textContent = "Copier le JSON";
      }, 3000);
    });
  });

  btnDownload?.addEventListener("click", () => {
    const blobRetry = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const urlRetry = URL.createObjectURL(blobRetry);
    const aRetry = document.createElement("a");
    aRetry.href = urlRetry;
    aRetry.download = `reponses-sondage-veille-${Date.now()}.json`;
    aRetry.click();
    URL.revokeObjectURL(urlRetry);
  });

  showSuccessScreen(true, data.userBranch);
}

function showSuccessScreen(isFallback = false, userBranch = "public_other") {
  const answers = state.answers;

  // 1. Déclenchement des confettis thématiques (sécurisé)
  try {
    if (typeof confetti === "function") {
      confetti({
        particleCount: 85,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#00e5ff", "#e66800", "#10b981", "#fbbf24"]
      });
    }
  } catch (e) {
    // Ignorer si le script externe confetti est indisponible
  }

  // 2. Remplissage de la carte collector "Profil Audio & Vision"
  const valJob = document.getElementById("card-val-job");
  const valTrend = document.getElementById("card-val-trend");
  const valPrint = document.getElementById("card-val-print");
  const meterArtisanat = document.getElementById("meter-artisanat");
  const meterValArtisanat = document.getElementById("meter-val-artisanat");
  const meterAi = document.getElementById("meter-ai");
  const meterValAi = document.getElementById("meter-val-ai");

  const rawJob = userBranch === "pro" ? answers.pro_job : answers.public_job;
  if (valJob) valJob.textContent = cleanLabel(rawJob) || "Collaborateur / Spectateur";

  const perceptionRaw = (answers.global_ai_perception || "").toLowerCase();
  let trendText = "Un outil d'optimisation sous contrôle";
  if (perceptionRaw.includes("opportunité") || perceptionRaw.includes("passionnante")) {
    trendText = "Un levier créatif stimulant & prometteur";
  } else if (perceptionRaw.includes("menace")) {
    trendText = "Vigilance pour l'artisanat humain";
  }
  if (valTrend) valTrend.textContent = trendText;

  let printText = "Attaché à la matière humaine & l'oreille critique";
  const roomToneRating = parseInt(answers.public_room_tone_importance || 3);
  if (userBranch !== "pro" && roomToneRating >= 4) {
    printText = "Passionné par l'acoustique & le grain des lieux";
  }
  if (valPrint) valPrint.textContent = printText;

  // Calcul des Jauges Audio Peak Meters
  const humanScore = parseInt(answers.global_human_imperfection_agree || 3);
  const artisanatPct = Math.min(95, Math.max(45, humanScore * 18));
  
  const delTasks = safeSplit(answers.pro_delegated_tasks);
  const aiScore = delTasks.length * 12 + (perceptionRaw.includes("opportunité") ? 25 : 15);
  const aiPct = Math.min(90, Math.max(30, aiScore || 50));

  if (meterArtisanat) meterArtisanat.style.width = `${artisanatPct}%`;
  if (meterValArtisanat) meterValArtisanat.textContent = `${artisanatPct}%`;
  if (meterAi) meterAi.style.width = `${aiPct}%`;
  if (meterValAi) meterValAi.textContent = `${aiPct}%`;

  // 3. Messages de remerciements personnalisés au singulier (Jules / Travail individuel)
  const msgEl = document.getElementById("success-message-text");

  const proVariants = [
    "<strong>🎉 Un grand merci pour ce retour du terrain !</strong><br><br>Avoir la vision de professionnels en activité est ce qui permet de donner une vraie valeur à mon travail de fin d'études à 3iS Nantes. Ces données vont directement nourrir mon analyse.<br><br><em>Au plaisir d'en échanger autour d'une console ou d'un projet !</em>",
    "<strong>🎉 Merci beaucoup d'avoir partagé votre expérience !</strong><br><br>Votre retour de terrain est essentiel pour dresser un panorama fidèle de l'intégration de l'IA en post-production. Merci pour le temps accordé à mon travail académique.<br><br><em>Bonnes sessions et à bientôt !</em>",
    "<strong>🎉 Un grand merci pour votre contribution !</strong><br><br>Votre perspective professionnelle apporte un éclairage indispensable pour comprendre l'évolution de la posture artistique de l'ingénieur du son.<br><br><em>Au plaisir de croiser vos chemins en studio !</em>"
  ];

  const publicVariants = [
    "<strong>🎉 Merci beaucoup pour le coup de main !</strong><br><br>Mesurer l'impact de l'IA ne peut pas se faire sans le regard de ceux qui font l'image et de ceux qui vivent les films en salle. Vos retours apportent un éclairage précieux pour compléter mon étude.<br><br><em>Bonne continuation et séances de cinéma !</em>",
    "<strong>🎉 Merci infiniment pour votre temps !</strong><br><br>Votre vision en tant que collaborateur ou spectateur m'aide à mesurer la perception réelle du son et de ses évolutions technologiques.<br><br><em>Très belles projections à vous !</em>"
  ];

  if (msgEl) {
    const variants = userBranch === "pro" ? proVariants : publicVariants;
    const randomMsg = variants[Math.floor(Math.random() * variants.length)];
    msgEl.innerHTML = randomMsg;
  }

  // 4. Animation séquencée Staggered d'arrivée
  navigateToSection("section-success");

  const successEl = document.getElementById("section-success");
  if (successEl && typeof anime !== "undefined") {
    const blocks = successEl.querySelectorAll(".success-signal-badge, .success-headline, .profile-collector-card, .success-message-box, .success-actions-row");
    anime({
      targets: blocks,
      opacity: [0, 1],
      translateY: [16, 0],
      delay: anime.stagger(140),
      duration: 400,
      easing: "easeOutCubic"
    });
  }
}
