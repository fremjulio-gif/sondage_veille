/* ==========================================================================
   LOGIQUE DE L'APPLICATION — VANILLA JS & ANIME.JS
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
  answers: {}
};

// Libellés dynamiques qualitatifs pour les échelles 1 à 5 (Charte éditoriale 3iS)
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
  initNavigation();
  initFormListeners();
  initMicroInteractions();
  initOtherInputsFocus();
  initCustomSliders();
  initSuggestionChips();
  
  // Animation initiale de la Section 1 au chargement
  animateSectionIn(document.getElementById("section-1"));
});

/* ==========================================================================
   1. NAVIGATION & TRANSITIONS ENTRE SECTIONS & SOUS-ÉCRANS (ANIME.JS)
   ========================================================================== */
function initNavigation() {
  const btnSec1Next = document.getElementById("btn-sec1-next");
  const btnSec2Next = document.getElementById("btn-sec2-next");
  const btnSec2Back = document.getElementById("btn-sec2-back");
  const btnSec3Next = document.getElementById("btn-sec3-next");
  const btnSec3Back = document.getElementById("btn-sec3-back");
  const btnSec4Back = document.getElementById("btn-sec4-back");
  const btnSubmit = document.getElementById("btn-submit");

  // Écran 1 -> Branchement selon Q1
  btnSec1Next?.addEventListener("click", () => {
    const domain = getSelectedRadioValue("domain_sector");
    state.answers["domain_sector"] = domain;

    if (domain === "pro_audio") {
      state.selectedBranch = "pro";
      state.currentSubstepSec2 = 1;
      showSubstep("section-2", 1);
      navigateToSection("section-2");
    } else {
      state.selectedBranch = "public";
      state.currentSubstepSec3 = 1;
      showSubstep("section-3", 1);
      navigateToSection("section-3");
    }
  });

  // Section 2 (Pro) - Navigation par sous-étape
  btnSec2Next?.addEventListener("click", () => {
    collectSectionInputs("section-2");
    if (state.currentSubstepSec2 < 3) {
      state.currentSubstepSec2++;
      switchSubstep("section-2", state.currentSubstepSec2);
    } else {
      navigateToSection("section-4");
    }
  });

  btnSec2Back?.addEventListener("click", () => {
    if (state.currentSubstepSec2 > 1) {
      state.currentSubstepSec2--;
      switchSubstep("section-2", state.currentSubstepSec2);
    } else {
      navigateToSection("section-1");
    }
  });

  // Section 3 (Public/Image) - Navigation par sous-étape
  btnSec3Next?.addEventListener("click", () => {
    collectSectionInputs("section-3");
    if (state.currentSubstepSec3 < 3) {
      state.currentSubstepSec3++;
      switchSubstep("section-3", state.currentSubstepSec3);
    } else {
      navigateToSection("section-4");
    }
  });

  btnSec3Back?.addEventListener("click", () => {
    if (state.currentSubstepSec3 > 1) {
      state.currentSubstepSec3--;
      switchSubstep("section-3", state.currentSubstepSec3);
    } else {
      navigateToSection("section-1");
    }
  });

  // Section 4 (Conclusion) - Retour
  btnSec4Back?.addEventListener("click", () => {
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

  // Bouton de Soumission finale (Section 4)
  btnSubmit?.addEventListener("click", async () => {
    collectSectionInputs("section-4");
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
   2. COMPOSANT CUSTOM SLIDER ULTRA-FLUIDE AVEC FEEDBACK LIKERT DYNAMIQUE
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
          duration: 250,
          easing: "easeOutCubic"
        });
        anime({
          targets: fill,
          width: `${targetPct}%`,
          duration: 250,
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
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      thumb.classList.remove("is-dragging");

      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const { step } = calculatePos(clientX);

      setStep(step, true);

      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchend", onPointerUp);
    }

    trackWrapper.addEventListener("mousedown", onPointerDown);
    trackWrapper.addEventListener("touchstart", onPointerDown, { passive: true });

    // Initialisation au centre (Step 3 = 50%)
    setStep(3, false);
  });
}

/* ==========================================================================
   3. CHIPS DE SUGGESTION POUR LA QUESTION OUVERTE
   ========================================================================== */
function initSuggestionChips() {
  const textarea = document.getElementById("global-final-comment");
  const chips = document.querySelectorAll(".suggestion-chips .chip-btn");

  if (!textarea) return;

  chips.forEach(chip => {
    chip.addEventListener("click", () => {
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

/* ==========================================================================
   4. GESTION DES CHAMPS "AUTRE" ET FORMULAIRES
   ========================================================================== */
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

function initFormListeners() {
  const section1Inputs = document.querySelectorAll('#section-1 input[name="domain_sector"]');
  const btnSec1Next = document.getElementById("btn-sec1-next");

  section1Inputs.forEach(input => {
    input.addEventListener("change", () => {
      if (btnSec1Next) btnSec1Next.disabled = false;
    });
  });
}

function collectSectionInputs(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  // Inputs cachés des Sliders
  const hiddenInputs = section.querySelectorAll('input[type="hidden"]');
  hiddenInputs.forEach(hInput => {
    if (hInput.name) state.answers[hInput.name] = parseInt(hInput.value || "3");
  });

  // Radios
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

  // Textareas
  const textareas = section.querySelectorAll("textarea");
  textareas.forEach(txt => {
    if (txt.name) {
      state.answers[txt.name] = txt.value.trim();
    }
  });

  // Checkboxes
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

  // Champs texte "Autre"
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
   5. ANIME.JS MICRO-INTERACTIONS
   ========================================================================== */
function initMicroInteractions() {
  if (typeof anime === "undefined") return;

  document.querySelectorAll(".option-card").forEach(card => {
    const indicator = card.querySelector(".card-indicator");

    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("inline-other-input")) return;
      
      anime({
        targets: card,
        scale: [0.98, 1],
        duration: 200,
        easing: "easeOutCubic"
      });

      if (indicator) {
        anime({
          targets: indicator,
          scale: [0.75, 1],
          duration: 180,
          easing: "easeOutBack"
        });
      }
    });
  });

  document.querySelectorAll(".btn-primary, .btn-secondary, .btn-submit").forEach(btn => {
    btn.addEventListener("mousedown", () => {
      anime({ targets: btn, scale: 0.96, duration: 100, easing: "easeOutQuad" });
    });
    btn.addEventListener("mouseup", () => {
      anime({ targets: btn, scale: 1, duration: 150, easing: "easeOutCubic" });
    });
    btn.addEventListener("mouseleave", () => {
      anime({ targets: btn, scale: 1, duration: 150, easing: "easeOutQuad" });
    });
  });
}

/* ==========================================================================
   6. SOUMISSION WEBHOOK / SCHÉMA FIXE IMMUABLE POUR GOOGLE SHEETS
   ========================================================================== */
async function handleFormSubmission() {
  const btnSubmit = document.getElementById("btn-submit");
  const spinner = document.getElementById("submit-spinner");
  const btnText = btnSubmit?.querySelector(".btn-text");
  const loadingOverlay = document.getElementById("loading-overlay");

  const answers = state.answers;

  // Calcul de la branche utilisateur
  let userBranch = "public_other";
  if (state.selectedBranch === "pro") {
    userBranch = "pro";
  } else if (answers.domain_sector === "cinema_other") {
    userBranch = "public_image";
  } else {
    userBranch = "public_other";
  }

  const getArrayVal = (val) => Array.isArray(val) ? val.join(", ") : (val || "");

  // Payload fixe et déterministe demandée par le schéma
  const payload = {
    // --- INFOS GÉNÉRALES ---
    submittedAt: new Date().toISOString(),
    userBranch: userBranch,
    domain_sector: answers.domain_sector || "N/A",

    // --- PARCOURS 1 : PROS DU SON (Rempli si userBranch === 'pro') ---
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

    // --- PARCOURS 2 & 3 : METIERS IMAGE / SPECTATEURS (Rempli si userBranch !== 'pro') ---
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

    // --- CONCLUSION GLOBALE (REMPLI PAR TOUS) ---
    global_ai_perception: answers.global_ai_perception || "",
    global_ai_perception_other: answers.global_ai_perception_other || "",
    global_human_imperfection_agree: answers.global_human_imperfection_agree || "",
    global_final_comment: answers.global_final_comment || ""
  };

  // 1. Désactivation du bouton & affichage du loader overlay
  if (btnSubmit) btnSubmit.disabled = true;
  if (spinner) spinner.classList.remove("hidden");
  if (btnText) btnText.textContent = "Transmission en cours...";
  if (loadingOverlay) loadingOverlay.classList.remove("hidden");

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
  const msgEl = document.getElementById("success-message-text");

  if (msgEl) {
    if (userBranch === "pro") {
      msgEl.innerHTML = "<strong>🎉 Merci infiniment pour ce retour du terrain !</strong><br><br>Avoir la vision de professionnels en activité est ce qui permet de donner une vraie valeur à ce travail de fin d'études à 3iS. Ces données vont directement nourrir l'analyse de notre mémoire.<br><br><em>Au plaisir d'en échanger autour d'une console ou d'un projet !</em>";
    } else {
      msgEl.innerHTML = "<strong>🎉 Merci beaucoup pour le coup de main !</strong><br><br>Mesurer l'impact de l'IA ne peut pas se faire sans le regard de ceux qui font l'image et de ceux qui vivent les films en salle. Ces retours apportent un éclairage précieux pour compléter notre étude.<br><br><em>Bonne continuation et séances de cinéma !</em>";
    }
  }

  navigateToSection("section-success");
}
