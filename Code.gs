/**
 * GOOGLE APPS SCRIPT WEBHOOK — SONDAGE VEILLE & MÉMOIRE 3iS
 * "Étude de Veille & Mémoire de fin d'études — 3iS (SON Cinéma & Audiovisuel)"
 * Fichier : Code.gs
 * 
 * INSTRUCTIONS DE DÉPLOIEMENT & MISE À JOUR :
 * 1. Ouvrez votre Google Sheet > Menu "Extensions" > "Apps Script".
 * 2. Remplacez TOUT le code existant dans Code.gs par celui-ci.
 * 3. Enregistrez (Ctrl+S / Cmd+S).
 * 4. Cliquez sur "Déployer" (bouton bleu en haut à droite) > "Gérer les déploiements".
 * 5. Cliquez sur l'icône Crayon (Modifier) de votre déploiement actif.
 * 6. Dans la liste déroulante "Version", choisissez IMPÉRATIVEMENT "Nouvelle version".
 * 7. Cliquez sur "Déployer". (L'URL reste identique).
 * 
 * CONSEILS POUR VOTRE GOOGLE SHEET :
 * 1. Vous pouvez supprimer le 2ème onglet ("Feuille 2") créé par erreur.
 * 2. Le script écrira toujours de façon stable dans votre premier onglet (ou celui nommé "Réponses").
 * 3. Si vous aviez des colonnes fantômes décalées (AK à BT), le script les nettoie automatiquement
 *    dès la prochaine soumission pour tout réaligner proprement à partir de la Colonne A.
 */

// Nom de l'onglet cible prioritaire (si non trouvé, la 1ère feuille du classeur est prise par défaut)
var TARGET_SHEET_NAME = "Réponses";

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Verrouillage de 15 secondes pour éviter les conflits en cas d'envois simultanés
    lock.waitLock(15000);
  } catch (err) {
    return createJsonResponse({ status: "error", message: "Serveur occupé, veuillez réessayer." });
  }

  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getTargetSheet(spreadsheet);

    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: "error", message: "Aucune donnée reçue (payload vide)." });
    }

    var contents = e.postData.contents;
    var data = JSON.parse(contents);
    var dataKeys = Object.keys(data);

    if (dataKeys.length === 0) {
      return createJsonResponse({ status: "error", message: "Objet de données vide." });
    }

    // 1. Détection et validation des en-têtes existants en Ligne 1
    var lastColumn = sheet.getLastColumn();
    var rawHeaders = [];
    if (lastColumn > 0) {
      rawHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    }

    // Filtrer les valeurs non vides
    var validHeaders = [];
    for (var i = 0; i < rawHeaders.length; i++) {
      var cellVal = rawHeaders[i];
      if (cellVal !== null && cellVal !== undefined && String(cellVal).trim() !== "") {
        validHeaders.push(String(cellVal).trim());
      }
    }

    // Détection d'un état corrompu (ex: cellules effacées où les premières colonnes sont vides, bug AK)
    var isCorruptedOrEmpty = (validHeaders.length === 0) || 
                             (rawHeaders.length > 0 && String(rawHeaders[0] || "").trim() === "");

    var headers = [];

    if (isCorruptedOrEmpty) {
      // Nettoyer la ligne 1 pour effacer d'éventuelles colonnes fantômes résiduelles
      var clearCols = Math.max(lastColumn, dataKeys.length, 60);
      sheet.getRange(1, 1, 1, clearCols).clearContent().clearFormat();

      // Écriture stricte à partir de la Colonne 1 (Colonne A)
      headers = dataKeys;
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

      // Style de l'en-tête (Gras + Fond bleu nuit moderne + Texte blanc)
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0f172a");
      headerRange.setFontColor("#f8fafc");
      headerRange.setHorizontalAlignment("center");
      headerRange.setVerticalAlignment("middle");
      headerRange.setWrap(true);
      sheet.setRowHeight(1, 40);
      sheet.setFrozenRows(1);
    } else {
      // Les en-têtes existants commencent bien en colonne A
      headers = validHeaders;
      var newHeadersAdded = false;

      // Si de nouvelles questions sont ajoutées au formulaire, créer les colonnes à la suite
      for (var k = 0; k < dataKeys.length; k++) {
        var key = dataKeys[k];
        if (headers.indexOf(key) === -1) {
          headers.push(key);
          newHeadersAdded = true;
          var newCol = headers.length;
          var newCell = sheet.getRange(1, newCol);
          newCell.setValue(key);
          newCell.setFontWeight("bold");
          newCell.setBackground("#0f172a");
          newCell.setFontColor("#f8fafc");
          newCell.setHorizontalAlignment("center");
          newCell.setVerticalAlignment("middle");
          newCell.setWrap(true);
        }
      }

      if (newHeadersAdded) {
        sheet.setFrozenRows(1);
      }
    }

    // Effacer tout reliquat d'en-tête fantôme au-delà de headers.length
    if (lastColumn > headers.length) {
      sheet.getRange(1, headers.length + 1, 1, lastColumn - headers.length).clearContent().clearFormat();
    }

    // 2. Construction de la ligne de données ordonnée selon les en-têtes
    var row = headers.map(function(header) {
      var val = data[header];
      if (val === undefined || val === null) return "";
      if (Array.isArray(val)) return val.join(", ");
      return val;
    });

    // 3. Détermination de la première ligne disponible (évite les sauts de lignes après suppression de tests)
    var targetRow = getFirstAvailableRow(sheet);
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);

    // Formatage de la ligne insérée
    var insertedRange = sheet.getRange(targetRow, 1, 1, row.length);
    insertedRange.setVerticalAlignment("middle");
    sheet.setRowHeight(targetRow, 28);

    return createJsonResponse({
      status: "success",
      message: "Données enregistrées avec succès",
      sheet: sheet.getName(),
      row: targetRow,
      columnsCount: row.length
    });

  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Trouve la feuille de calcul cible de manière 100% déterministe.
 * Évite d'écrire dans la mauvaise feuille selon l'onglet affiché par l'utilisateur.
 */
function getTargetSheet(spreadsheet) {
  // 1. Chercher un onglet dédié "Réponses", "Reponses" ou "Feuille 1"
  var sheet = spreadsheet.getSheetByName(TARGET_SHEET_NAME) ||
              spreadsheet.getSheetByName("Reponses") ||
              spreadsheet.getSheetByName("Feuille 1") ||
              spreadsheet.getSheetByName("Sheet1") ||
              spreadsheet.getSheetByName("Réponses au formulaire 1");
  if (sheet) return sheet;

  // 2. Par défaut : toujours le premier onglet du classeur
  var sheets = spreadsheet.getSheets();
  return sheets[0];
}

/**
 * Détecte la première ligne libre après la ligne d'en-tête.
 * Empêche de laisser des lignes vides si des tests précédents ont été effacés avec la touche Suppr.
 */
function getFirstAvailableRow(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 2;

  // Inspecter les cellules de la colonne A (submittedAt)
  var colAValues = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (var r = 1; r < colAValues.length; r++) {
    var val = colAValues[r][0];
    if (val === "" || val === null || val === undefined) {
      return r + 1; // 1-indexed
    }
  }
  return lastRow + 1;
}

function doGet(e) {
  return createJsonResponse({
    status: "online",
    service: "Webhook Sondage Veille 3iS (SON Cinéma & Audiovisuel)",
    timestamp: new Date().toISOString()
  });
}

function createJsonResponse(responseObject) {
  return ContentService.createTextOutput(JSON.stringify(responseObject))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Fonction de test manuel directement exécutable dans l'éditeur Apps Script
 */
function testDoPost() {
  var fakeEvent = {
    postData: {
      contents: JSON.stringify({
        "Date & Heure d'envoi (submittedAt)": new Date().toISOString(),
        "Branche / Parcours (userBranch)": "pro",
        "Activité principale (domain_sector)": "audio_cinema",
        "Métier en Post-Prod (pro_job)": "Mixeur / Mixeuse",
        "Perception globale de l'IA (global_ai_perception)": "Test automatique Apps Script"
      })
    }
  };
  var result = doPost(fakeEvent);
  Logger.log(result.getContent());
}
