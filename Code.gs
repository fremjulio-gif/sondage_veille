/**
 * GOOGLE APPS SCRIPT WEBHOOK — SONDAGE VEILLE & MÉMOIRE 3iS NANTES
 * Fichier : Code.gs
 * 
 * Instructions de déploiement :
 * 1. Ouvrez votre Google Sheet > Extensions > Apps Script.
 * 2. Remplacez le code existant par celui-ci.
 * 3. Cliquez sur "Déployer" > "Nouveau déploiement".
 * 4. Type : "Application Web".
 * 5. Exécuter en tant que : "Moi" (votre compte).
 * 6. Qui a accès : "Tout le monde" (Anyone).
 * 7. Copiez l'URL obtenue et collez-la dans WEBHOOK_URL dans app.js.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Verrouillage de 10 secondes pour éviter les collisions de requêtes simultanées
    lock.waitLock(10000);
  } catch (err) {
    return createJsonResponse({ status: "error", message: "Serveur occupé, veuillez réessayer." });
  }

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var contents = e.postData.contents;
    var data = JSON.parse(contents);

    // 1. Récupération ou création automatique des en-têtes (Ligne 1)
    var headers = [];
    var lastColumn = sheet.getLastColumn();

    if (lastColumn > 0) {
      headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    }

    // Si la feuille est vide, créer la ligne d'en-tête avec les clés reçues
    if (headers.length === 0 || (headers.length === 1 && headers[0] === "")) {
      headers = Object.keys(data);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Mettre en forme la ligne d'en-tête (Gras + Fond foncé + Texte clair)
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0b0f19");
      headerRange.setFontColor("#ffffff");
    } else {
      // Vérifier si de nouvelles clés doivent être ajoutées en nouvelles colonnes
      for (var key in data) {
        if (headers.indexOf(key) === -1) {
          headers.push(key);
          sheet.getRange(1, headers.length).setValue(key);
          var newHeaderCell = sheet.getRange(1, headers.length);
          newHeaderCell.setFontWeight("bold");
          newHeaderCell.setBackground("#0b0f19");
          newHeaderCell.setFontColor("#ffffff");
        }
      }
    }

    // 2. Construction de la ligne de données en respectant l'ordre des en-têtes
    var row = headers.map(function(header) {
      var val = data[header];
      if (val === undefined || val === null) return "";
      if (Array.isArray(val)) return val.join(", ");
      return val;
    });

    // 3. Insertion de la ligne dans Google Sheets
    sheet.appendRow(row);

    return createJsonResponse({ status: "success", message: "Données enregistrées avec succès" });

  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return createJsonResponse({ status: "online", service: "Webhook Sondage 3iS Nantes" });
}

function createJsonResponse(responseObject) {
  return ContentService.createTextOutput(JSON.stringify(responseObject))
    .setMimeType(ContentService.MimeType.JSON);
}
