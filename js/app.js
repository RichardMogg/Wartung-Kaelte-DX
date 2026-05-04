var STORAGE_KEY = 'gebatech_wartungsprotokoll_kaelte_v34';
var lineBreak = String.fromCharCode(10);
var csvLineBreak = String.fromCharCode(13, 10);

var indoorCounter = 0;
var signatureDirty = false;
var signatureDrawing = false;
var editingIndex = null;
var crcTable = null;

var appState = {
  version: 'V3.5',
  protocols: [],
  draft: null
};

var photoStore = {};
var currentPhotos = [];

var CHECKLISTS = {
  allgemein: [
    { label: 'Zustand', cleaned: true, repaired: true },
    { label: 'Kühlleistung', cleaned: false, repaired: false },
    { label: 'Betriebsgeräusch', cleaned: false, repaired: true },
    { label: 'Kältemittelfüllung', cleaned: false, repaired: false }
  ],
  aussen: [
    { label: 'Gehäuse', cleaned: true, repaired: true },
    { label: 'Kondensator', cleaned: true, repaired: true },
    { label: 'Ventilatoreinheit', cleaned: true, repaired: true },
    { label: 'Elektroanschluss', cleaned: true, repaired: true },
    { label: 'Kondensatableitung', cleaned: true, repaired: true },
    { label: 'Befestigung', cleaned: false, repaired: true }
  ],
  innen: [
    { label: 'Gehäuse', cleaned: true, repaired: true },
    { label: 'Verdampfer', cleaned: true, repaired: true },
    { label: 'Ventilatoreinheit', cleaned: true, repaired: true },
    { label: 'Elektroanschluss', cleaned: true, repaired: true },
    { label: 'Kondensatableitung', cleaned: true, repaired: true },
    { label: 'Befestigung', cleaned: false, repaired: true }
  ],
  regelung: [
    { label: 'Funktion', cleaned: false, repaired: true },
    { label: 'Zustand', cleaned: true, repaired: true },
    { label: 'Sicherheitseinrichtung', cleaned: true, repaired: true }
  ],
  leitung: [
    { label: 'Dichtheit', cleaned: false, repaired: true },
    { label: 'Anschlüsse', cleaned: true, repaired: true },
    { label: 'Isolierung', cleaned: false, repaired: true }
  ]
};

var MEASUREMENTS = [
  { key: 'tcL1', label: 'tcL1 (Außentemperatur)', unit: '°C' },
  { key: 'tcL2', label: 'tcL2 (Temp. Wärmeabfuhr)', unit: '°C' },
  { key: 'tc1h', label: 'tc1h (Temp. Verflüssigereintritt)', unit: '°C' },
  { key: 'tc2u', label: 'tc2u (Temp. Verflüssigeraustritt)', unit: '°C' },
  { key: 'peV1', label: 'peV1 (Druck Verdichtereintritt)', unit: 'bar' },
  { key: 'peV2', label: 'peV2 (Druck Verdichteraustritt)', unit: 'bar' }
];

var INDOOR_MEASUREMENTS = [
  { key: 'toL1', label: 'toL1 (Raumtemperatur)', unit: '°C' },
  { key: 'toL2', label: 'toL2 (Einblastemperatur)', unit: '°C' },
  { key: 'to', label: 'to (Temp. Verdampfereintritt)', unit: '°C' },
  { key: 'to2h', label: 'to2h (Temp. Verdampferaustritt)', unit: '°C' }
];

window.addEventListener('load', function () {
  setDefaultDate();
  renderStaticChecklists();
  renderMeasurements();
  bindEvents();
  addCollapseButtons();
  initSignatureCanvas();
  loadState();
  restoreDraft();

  if (!document.querySelector('.indoor-card')) {
    addIndoorUnit(false);
  }

  renderProtocolList();
  updateSummaries();
  updateEditModeUI();
  setStatus('Wartungsprotokoll V3.5 geladen. JSON-Import aktiv.', 'ok');
  startAtTop();
});

function startAtTop() {
  document.querySelectorAll('details.section').forEach(function (section) {
    section.open = section.id === 'sectionStammdaten';
  });

  setTimeout(function () {
    window.scrollTo(0, 0);
  }, 0);
}

function addCollapseButtons() {
  document.querySelectorAll('details.section').forEach(function (section) {
    var body = section.querySelector('.section-body');

    if (!body || body.querySelector('[data-collapse-section="true"]')) {
      return;
    }

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-light collapse-section-button';
    button.setAttribute('data-collapse-section', 'true');
    button.textContent = 'Abschnitt einklappen';

    button.addEventListener('click', function () {
      section.open = false;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    body.appendChild(button);
  });
}

function setDefaultDate() {
  var field = document.querySelector('[data-field="datum"]');

  if (field && !field.value) {
    field.value = new Date().toISOString().slice(0, 10);
  }

  updateInspectionMonths();
}

function updateInspectionMonths() {
  var datumField = document.querySelector('[data-field="datum"]');

  if (!datumField || !datumField.value) {
    return;
  }

  var parts = datumField.value.split('-');

  if (parts.length < 2) {
    return;
  }

  var year = Number(parts[0]);
  var month = Number(parts[1]);

  if (!year || !month) {
    return;
  }

  setMonthValue('letzteUeberpruefung', year - 1, month);
  setMonthValue('naechsteUeberpruefung', year + 1, month);
}

function setMonthValue(fieldName, year, month) {
  var field = document.querySelector('[data-field="' + fieldName + '"]');

  if (!field) {
    return;
  }

  field.value = String(year) + '-' + pad2(month);
}

function bindEvents() {
  document.getElementById('saveStammdatenButton').addEventListener('click', function () {
    saveDraft();
    openSection('sectionKopfdaten', true);
    setStatus('Stammdaten gespeichert.', 'ok');
  });

  document.getElementById('addInnenButton').addEventListener('click', function () {
    addIndoorUnit(true);
  });

  document.getElementById('bottomInnenButton').addEventListener('click', function () {
    addIndoorUnit(true);
  });

  document.getElementById('fotoInput').addEventListener('change', updatePhotoListFromInput);
  document.getElementById('clearSignatureButton').addEventListener('click', clearSignature);
  document.getElementById('takeProtocolButton').addEventListener('click', takeProtocolIntoList);
  document.getElementById('bottomTakeButton').addEventListener('click', takeProtocolIntoList);
  document.getElementById('clearFormButton').addEventListener('click', function () { resetCurrentForm(true); });
  document.getElementById('exportZipButton').addEventListener('click', exportZip);

  document.getElementById('importJsonButton').addEventListener('click', function () {
    document.getElementById('importJsonInput').click();
  });

  document.getElementById('importJsonInput').addEventListener('change', importJsonFromFile);

  document.getElementById('saveDraftButton').addEventListener('click', function () {
    saveDraft();
    setStatus('Entwurf lokal gespeichert. Fotos werden nicht dauerhaft im Entwurf gespeichert.', 'ok');
  });

  document.getElementById('clearAllButton').addEventListener('click', clearAll);

  document.getElementById('protocolForm').addEventListener('input', throttledDraftSave);

  document.getElementById('protocolForm').addEventListener('change', function () {
    handleConditionalFields();
    throttledDraftSave();
  });

  document.querySelector('[data-field="datum"]').addEventListener('change', function () {
    updateInspectionMonths();
    throttledDraftSave();
    updateSummaries();
  });

  document.getElementById('kundeInput').addEventListener('input', throttledDraftSave);
  document.getElementById('objektInput').addEventListener('input', throttledDraftSave);
  document.getElementById('globalMangelText').addEventListener('input', throttledDraftSave);
  document.getElementById('bemerkungenText').addEventListener('input', throttledDraftSave);

  document.querySelectorAll('[name="gesamtzustand"]').forEach(function (radio) {
    radio.addEventListener('change', handleConditionalFields);
  });
}

var draftTimer = null;

function throttledDraftSave() {
  clearTimeout(draftTimer);

  draftTimer = setTimeout(function () {
    saveDraft(false);
    updateSummaries();
  }, 450);
}

function openSection(id, closeOthers) {
  var sections = document.querySelectorAll('details.section');

  for (var i = 0; i < sections.length; i++) {
    if (sections[i].id === id) {
      sections[i].open = true;
      sections[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (closeOthers) {
      sections[i].open = false;
    }
  }
}

function renderStaticChecklists() {
  renderChecklist(document.getElementById('checkAllgemein'), 'allgemein', CHECKLISTS.allgemein);
  renderChecklist(document.getElementById('checkAussen'), 'aussen', CHECKLISTS.aussen);
  renderChecklist(document.getElementById('checkRegelung'), 'regelung', CHECKLISTS.regelung);
  renderChecklist(document.getElementById('checkLeitung'), 'leitung', CHECKLISTS.leitung);
}

function renderChecklist(container, prefix, items) {
  container.innerHTML = '';

  for (var i = 0; i < items.length; i++) {
    container.appendChild(createCheckRow(prefix, i, items[i]));
  }
}

function createCheckRow(prefix, index, item) {
  var label = typeof item === 'string' ? item : item.label;
  var allowCleaned = typeof item === 'string' ? true : item.cleaned !== false;
  var allowRepaired = typeof item === 'string' ? true : item.repaired !== false;
  var row = document.createElement('div');
  var key = prefix + '_' + index;
  var actionHtml = '';

  if (allowCleaned) {
    actionHtml += '<label class="checkbox-option"><input type="checkbox" data-cleaned="true"> gereinigt</label>';
  }

  if (allowRepaired) {
    actionHtml += '<label class="checkbox-option"><input type="checkbox" data-repaired="true"> repariert</label>';
  }

  row.className = 'check-row';
  row.setAttribute('data-check-key', key);
  row.setAttribute('data-check-label', label);

  row.innerHTML =
    '<div class="check-title">' + escapeHtml(label) + '</div>' +
    '<div class="check-options">' +
      '<label class="pill-option"><input type="radio" name="' + key + '_status" value="in Ordnung"> in Ordnung</label>' +
      '<label class="pill-option"><input type="radio" name="' + key + '_status" value="nicht in Ordnung"> nicht in Ordnung</label>' +
      actionHtml +
    '</div>' +
    '<div class="mangel-field" data-mangel-wrap="true">' +
      '<label>Mangelbeschreibung / Maßnahme <span class="required-hint">*</span></label>' +
      '<textarea data-mangel-text="true"></textarea>' +
    '</div>';

  row.addEventListener('change', function () {
    updateCheckRowConditional(row);
    updateSummaries();
  });

  return row;
}

function updateCheckRowConditional(row) {
  var notOk = row.querySelector('input[type="radio"][value="nicht in Ordnung"]');
  var repaired = row.querySelector('[data-repaired="true"]');
  var wrap = row.querySelector('[data-mangel-wrap="true"]');
  var text = row.querySelector('[data-mangel-text="true"]');
  var isVisible = !!((notOk && notOk.checked) || (repaired && repaired.checked));

  wrap.classList.toggle('visible', isVisible);
  text.required = isVisible;
}

function addIndoorUnit(scrollToNew, values) {
  indoorCounter++;

  var card = document.createElement('details');
  card.className = 'indoor-card';
  card.open = true;
  card.setAttribute('data-indoor-index', indoorCounter);

  card.innerHTML =
    '<summary><span class="indoor-summary">Inneneinheit ' + indoorCounter + '</span></summary>' +
    '<div class="indoor-body">' +
      '<div class="field"><label>Bezeichnung / Standort der Inneneinheit</label><input data-indoor-name autocomplete="off"></div>' +
      '<div class="field"><label>Messwerte Inneneinheit</label>' + buildIndoorMeasurementHtml() + '</div>' +
      '<div data-indoor-checks></div>' +
      '<button type="button" class="btn-danger" data-remove-indoor>Diese Inneneinheit entfernen</button>' +
    '</div>';

  document.getElementById('innenContainer').appendChild(card);

  renderChecklist(card.querySelector('[data-indoor-checks]'), 'innen_' + indoorCounter, CHECKLISTS.innen);

  card.querySelector('[data-remove-indoor]').addEventListener('click', function () {
    card.remove();
    updateIndoorSummaries();
    throttledDraftSave();
  });

  card.querySelector('[data-indoor-name]').addEventListener('input', updateIndoorSummaries);

  card.addEventListener('toggle', function () {
    if (card.open) {
      closeOtherIndoorCards(card);
    }
  });

  if (values) {
    setIndoorValues(card, values);
  }

  closeOtherIndoorCards(card);
  updateIndoorSummaries();

  if (scrollToNew) {
    openSection('sectionInnen', true);
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function buildIndoorMeasurementHtml() {
  var html = '<table class="measurement-table"><thead><tr><th>Messpunkt</th><th>Wert</th><th>Einheit</th></tr></thead><tbody>';

  for (var i = 0; i < INDOOR_MEASUREMENTS.length; i++) {
    var m = INDOOR_MEASUREMENTS[i];
    html += '<tr><td>' + escapeHtml(m.label) + '</td><td><input data-indoor-measurement="' + m.key + '" inputmode="decimal"></td><td>' + escapeHtml(m.unit) + '</td></tr>';
  }

  html += '</tbody></table>' + buildIndoorSchemaHtml();

  return html;
}

function buildIndoorSchemaHtml() {
  return '<div class="schema-box" aria-label="Inneneinheit Messpunkte">' +
    '<svg viewBox="0 0 520 240" role="img">' +
      '<rect x="35" y="35" width="450" height="165" fill="white" stroke="#111" stroke-width="1"/>' +
      '<rect x="145" y="78" width="210" height="70" fill="#f8fafc" stroke="#111"/>' +
      '<text x="250" y="116" font-size="15" text-anchor="middle">Verdampfer / Inneneinheit</text>' +
      '<path d="M70 78 H125" stroke="#111" stroke-width="2"/>' +
      '<path d="M70 148 H125" stroke="#111" stroke-width="2"/>' +
      '<path d="M355 95 H450" stroke="#111" stroke-width="2"/>' +
      '<path d="M355 132 H450" stroke="#111" stroke-width="2"/>' +
      '<text x="68" y="68" font-size="12">toL1 Raumtemperatur</text>' +
      '<text x="360" y="85" font-size="12">toL2 Einblastemperatur</text>' +
      '<text x="95" y="171" font-size="12">to Eintritt</text>' +
      '<text x="360" y="154" font-size="12">to2h Austritt</text>' +
      '<circle cx="125" cy="78" r="5" fill="#c4bd18" stroke="#111"/>' +
      '<circle cx="355" cy="95" r="5" fill="#c4bd18" stroke="#111"/>' +
      '<circle cx="125" cy="148" r="5" fill="#c4bd18" stroke="#111"/>' +
      '<circle cx="355" cy="132" r="5" fill="#c4bd18" stroke="#111"/>' +
    '</svg>' +
  '</div>';
}

function closeOtherIndoorCards(current) {
  document.querySelectorAll('.indoor-card').forEach(function (card) {
    if (card !== current) {
      card.open = false;
    }
  });
}

function updateIndoorSummaries() {
  var cards = document.querySelectorAll('.indoor-card');

  cards.forEach(function (card, index) {
    var name = card.querySelector('[data-indoor-name]').value.trim();
    card.querySelector('.indoor-summary').textContent = 'Inneneinheit ' + (index + 1) + (name ? ' – ' + name : '');
  });

  document.getElementById('summaryInnen').textContent = cards.length + ' Inneneinheit(en) angelegt';
}

function renderMeasurements() {
  var tbody = document.getElementById('measurementBody');
  tbody.innerHTML = '';

  for (var i = 0; i < MEASUREMENTS.length; i++) {
    var m = MEASUREMENTS[i];
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + escapeHtml(m.label) + '</td><td><input data-measurement="' + m.key + '" inputmode="decimal"></td><td>' + escapeHtml(m.unit) + '</td>';
    tbody.appendChild(tr);
  }
}

function handleConditionalFields() {
  document.querySelectorAll('.check-row').forEach(updateCheckRowConditional);

  var value = getRadioValue('gesamtzustand');
  var wrap = document.getElementById('globalMangelWrap');
  var text = document.getElementById('globalMangelText');
  var needs = value === 'leichte Mängel' || value === 'mangelhaft';

  wrap.classList.toggle('visible', needs);
  text.required = needs;

  updateSummaries();
}

async function takeProtocolIntoList() {
  if (draftTimer) {
    clearTimeout(draftTimer);
    draftTimer = null;
  }

  var wasEditing = editingIndex !== null;
  var targetIndex = editingIndex;
  var issues = getCurrentProtocolIssuesForSave();

  if (issues.length > 0) {
    var message =
      'Protokoll nicht vollständig! Trotzdem speichern?' +
      lineBreak + lineBreak +
      'Fehlende / unvollständige Punkte:' +
      lineBreak +
      '- ' + issues.slice(0, 12).join(lineBreak + '- ');

    if (issues.length > 12) {
      message += lineBreak + '- ... weitere ' + (issues.length - 12) + ' Punkt(e)';
    }

    if (!confirm(message)) {
      setStatus(
        wasEditing
          ? 'Änderungen wurden nicht gespeichert. Protokoll ist noch unvollständig.'
          : 'Protokoll wurde nicht übernommen. Protokoll ist noch unvollständig.',
        'error'
      );
      return;
    }
  }

  try {
    setStatus(wasEditing ? 'Änderungen werden gespeichert ...' : 'Protokoll wird übernommen ...', 'ok');

    var data = collectProtocol();
    var now = new Date().toISOString();
    var existing = wasEditing ? appState.protocols[targetIndex] : null;

    if (wasEditing && !existing) {
      editingIndex = null;
      appState.draft = null;
      saveState(false);
      renderProtocolList();
      updateEditModeUI();
      updateSummaries();
      setStatus('Bearbeitung konnte nicht gespeichert werden: Der Datensatz ist nicht mehr vorhanden.', 'error');
      return;
    }

    var recordId = existing ? existing.recordId : createId('WP');
    var photos = await getCurrentPhotoFilesForRecord(recordId);

    data.fotos = photos.map(function (p) {
      return {
        name: p.name,
        type: p.type,
        size: p.data.length
      };
    });

    var record = {
      recordId: recordId,
      erstelltAm: existing ? existing.erstelltAm : now,
      bearbeitetAm: now,
      data: data,
      vollstaendig: issues.length === 0,
      unvollstaendigHinweise: issues
    };

    if (wasEditing) {
      appState.protocols[targetIndex] = record;
      photoStore[recordId] = photos;

      editingIndex = null;
      appState.draft = null;

      saveState(false);
      renderProtocolList();
      updateEditModeUI();
      updateSummaries();
      openSection('sectionListe', true);

      setStatus(
        issues.length
          ? 'Änderungen gespeichert. Hinweis: Protokoll ist noch nicht vollständig.'
          : 'Änderungen gespeichert. Bearbeitungsmodus wurde beendet.',
        issues.length ? 'error' : 'ok'
      );
      return;
    }

    appState.protocols.push(record);
    photoStore[recordId] = photos;

    editingIndex = null;
    appState.draft = null;

    saveState(false);
    resetCurrentForm(false);
    renderProtocolList();
    updateEditModeUI();
    updateSummaries();
    openSection('sectionListe', true);

    setStatus(
      issues.length
        ? 'Protokoll in Liste übernommen. Hinweis: Protokoll ist noch nicht vollständig.'
        : 'Protokoll in Liste übernommen. Protokolle: ' + appState.protocols.length,
      issues.length ? 'error' : 'ok'
    );
  } catch (err) {
    setStatus('Speichern fehlgeschlagen: ' + getErrorText(err), 'error');
  }
}

async function getCurrentPhotoFilesForRecord(recordId) {
  return currentPhotos.slice();
}

function loadProtocolForEdit(index) {
  if (index < 0 || index >= appState.protocols.length) {
    return;
  }

  var record = appState.protocols[index];

  editingIndex = index;
  fillFormFromProtocol(record.data);
  currentPhotos = (photoStore[record.recordId] || []).slice();
  document.getElementById('fotoInput').value = '';
  updatePhotoListFromCurrentPhotos();

  appState.draft = {
    editingIndex: editingIndex,
    data: collectProtocol()
  };

  saveState(false);
  renderProtocolList();
  updateEditModeUI();
  updateSummaries();
  openSection('sectionKopfdaten', true);
  setStatus('Bearbeitungsmodus aktiv. Änderungen mit „Änderungen speichern“ übernehmen.', 'ok');
}

function deleteProtocol(index) {
  if (!confirm('Dieses Protokoll aus der Liste löschen?')) {
    return;
  }

  var record = appState.protocols[index];

  if (record && record.recordId) {
    delete photoStore[record.recordId];
  }

  appState.protocols.splice(index, 1);

  if (editingIndex === index) {
    editingIndex = null;
  } else if (editingIndex !== null && editingIndex > index) {
    editingIndex--;
  }

  saveState(false);
  renderProtocolList();
  updateEditModeUI();
  updateSummaries();
  setStatus('Protokoll gelöscht.', 'ok');
}

function renderProtocolList() {
  var list = document.getElementById('protocolList');
  var summary = document.getElementById('summaryListe');

  list.innerHTML = '';
  summary.textContent = appState.protocols.length === 0
    ? 'Noch kein Protokoll übernommen'
    : appState.protocols.length + ' Protokoll(e) in der Liste';

  for (var i = 0; i < appState.protocols.length; i++) {
    var record = appState.protocols[i];
    var data = record.data || {};
    var kopf = data.kopfdaten || {};
    var stammdaten = data.stammdaten || {};
    var isEditing = editingIndex === i;
    var photos = photoStore[record.recordId] || [];
    var name = kopf.bezeichnungName || kopf.anlagentyp || 'ohne Anlagentyp';
    var div = document.createElement('div');

    div.className = isEditing ? 'protocol-list-item editing' : 'protocol-list-item';
    div.innerHTML =
      '<strong>' + escapeHtml(name) + '</strong>' +
      'Protokoll-ID: ' + escapeHtml(record.recordId || '-') + '<br>' +
      'Kunde: ' + escapeHtml(stammdaten.kunde || '-') + '<br>' +
      'Objekt: ' + escapeHtml(stammdaten.objekt || '-') + '<br>' +
      'Datum: ' + escapeHtml(kopf.datum || '-') + '<br>' +
      '<span class="badge">Fotodateien geladen: ' + photos.length + '</span>' +
      (record.vollstaendig === false ? ' <span class="badge badge-edit">unvollständig</span>' : '') +
      (isEditing ? ' <span class="badge badge-edit">in Bearbeitung</span>' : '') +
      '<div class="button-grid">' +
        '<button type="button" class="btn-warning" data-edit-index="' + i + '">Bearbeiten</button>' +
        '<button type="button" class="btn-danger" data-delete-index="' + i + '">Löschen</button>' +
      '</div>';

    list.appendChild(div);
  }

  list.querySelectorAll('[data-edit-index]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      loadProtocolForEdit(Number(this.getAttribute('data-edit-index')));
    });
  });

  list.querySelectorAll('[data-delete-index]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      deleteProtocol(Number(this.getAttribute('data-delete-index')));
    });
  });
}

function updateEditModeUI() {
  var banner = document.getElementById('editBanner');
  var main = document.getElementById('takeProtocolButton');
  var bottom = document.getElementById('bottomTakeButton');

  if (editingIndex !== null && appState.protocols[editingIndex]) {
    var record = appState.protocols[editingIndex];

    main.textContent = 'Änderungen speichern';
    bottom.textContent = 'Änderungen speichern';
    banner.textContent = 'Bearbeitungsmodus aktiv: ' + record.recordId;
    banner.className = 'edit-banner active';
  } else {
    main.textContent = 'Protokoll in Liste übernehmen';
    bottom.textContent = 'Übernehmen';
    banner.textContent = '';
    banner.className = 'edit-banner';
  }
}

function updateSummaries() {
  document.getElementById('summaryStammdaten').textContent =
    (document.getElementById('kundeInput').value || 'kein Kunde') +
    ' | ' +
    (document.getElementById('objektInput').value || 'kein Objekt');

  var kopf = collectFields(document.getElementById('kopfdatenFields'));
  var kopfText =
    (kopf.bezeichnungName || kopf.anlagentyp || 'kein Anlagentyp') +
    ' | ' +
    (kopf.datum || 'kein Datum') +
    ' | ' +
    (kopf.techniker || 'kein Techniker');

  if (editingIndex !== null) {
    kopfText = 'Bearbeitung: ' + kopfText;
  }

  document.getElementById('summaryKopfdaten').textContent = kopfText;
  document.getElementById('summaryBemerkungen').textContent = document.getElementById('bemerkungenText').value.trim() ? 'Bemerkung vorhanden' : 'keine Bemerkung';
  document.getElementById('summaryFotos').textContent = getCurrentPhotoCount() + ' Foto(s) aktuell';
  document.getElementById('summaryGesamt').textContent = getRadioValue('gesamtzustand') || 'nicht ausgewählt';
  document.getElementById('summaryUnterschrift').textContent = signatureDirty ? 'Unterschrift vorhanden' : 'keine Unterschrift';

  updateIndoorSummaries();

  document.getElementById('summaryListe').textContent = appState.protocols.length === 0
    ? 'Noch kein Protokoll übernommen'
    : appState.protocols.length + ' Protokoll(e) in der Liste';
}

function getCurrentPhotoCount() {
  return currentPhotos.length;
}

function collectFields(container) {
  var result = {};

  container.querySelectorAll('[data-field]').forEach(function (el) {
    result[el.getAttribute('data-field')] = el.value || '';
  });

  return result;
}

function setFields(container, data) {
  container.querySelectorAll('[data-field]').forEach(function (el) {
    var key = el.getAttribute('data-field');

    if (data && data[key] !== undefined) {
      el.value = data[key];
    }
  });
}

function collectChecklist(container, bereich) {
  var rows = [];

  container.querySelectorAll('.check-row').forEach(function (row) {
    var cleaned = row.querySelector('[data-cleaned="true"]');
    var repaired = row.querySelector('[data-repaired="true"]');

    rows.push({
      bereich: bereich,
      pruefpunkt: row.getAttribute('data-check-label') || '',
      status: getRowStatus(row),
      gereinigt: cleaned ? cleaned.checked : null,
      repariert: repaired ? repaired.checked : null,
      mangelbeschreibung: row.querySelector('[data-mangel-text="true"]').value || ''
    });
  });

  return rows;
}

function setChecklist(container, values) {
  var rows = container.querySelectorAll('.check-row');
  values = values || [];

  rows.forEach(function (row, index) {
    var data = values[index] || {};

    if (data.status) {
      var status = row.querySelector('input[type="radio"][value="' + cssEscape(data.status) + '"]');

      if (status) {
        status.checked = true;
      }
    }

    var cleaned = row.querySelector('[data-cleaned="true"]');
    var repaired = row.querySelector('[data-repaired="true"]');

    if (cleaned) {
      cleaned.checked = data.gereinigt === true;
    }

    if (repaired) {
      repaired.checked = data.repariert === true;
    }

    row.querySelector('[data-mangel-text="true"]').value = data.mangelbeschreibung || '';
    updateCheckRowConditional(row);
  });
}

function getRowStatus(row) {
  var checked = row.querySelector('input[type="radio"]:checked');
  return checked ? checked.value : '';
}

function collectIndoorUnits() {
  var units = [];

  document.querySelectorAll('.indoor-card').forEach(function (card, index) {
    units.push({
      nr: index + 1,
      bezeichnung: card.querySelector('[data-indoor-name]').value || '',
      messwerte: collectIndoorMeasurements(card),
      pruefpunkte: collectChecklist(card, 'Inneneinheit ' + (index + 1))
    });
  });

  return units;
}

function collectIndoorMeasurements(card) {
  var result = [];

  for (var i = 0; i < INDOOR_MEASUREMENTS.length; i++) {
    var m = INDOOR_MEASUREMENTS[i];
    var input = card.querySelector('[data-indoor-measurement="' + m.key + '"]');

    result.push({
      key: m.key,
      label: m.label,
      wert: input ? input.value || '' : '',
      einheit: m.unit
    });
  }

  return result;
}

function setIndoorMeasurements(card, values) {
  values = values || [];

  values.forEach(function (m) {
    var input = card.querySelector('[data-indoor-measurement="' + m.key + '"]');

    if (input) {
      input.value = m.wert || '';
    }
  });
}

function setIndoorValues(card, values) {
  card.querySelector('[data-indoor-name]').value = values.bezeichnung || '';
  setIndoorMeasurements(card, values.messwerte || []);
  setChecklist(card, values.pruefpunkte || []);
}

function collectMeasurements() {
  var result = [];

  for (var i = 0; i < MEASUREMENTS.length; i++) {
    var m = MEASUREMENTS[i];
    var input = document.querySelector('[data-measurement="' + m.key + '"]');

    result.push({
      key: m.key,
      label: m.label,
      wert: input.value || '',
      einheit: m.unit
    });
  }

  return result;
}

function setMeasurements(values) {
  values = values || [];

  values.forEach(function (m) {
    var input = document.querySelector('[data-measurement="' + m.key + '"]');

    if (input) {
      input.value = m.wert || '';
    }
  });
}

function collectProtocol() {
  return {
    exportFormat: 'GEBATECH_Wartungsprotokoll_Kaelte_JSON_V3_5',
    exportiertAm: new Date().toISOString(),
    stammdaten: {
      kunde: document.getElementById('kundeInput').value || '',
      objekt: document.getElementById('objektInput').value || ''
    },
    kopfdaten: collectFields(document.getElementById('kopfdatenFields')),
    pruefung: {
      allgemein: collectChecklist(document.getElementById('checkAllgemein'), 'Allgemein'),
      ausseneinheit: collectChecklist(document.getElementById('checkAussen'), 'Außeneinheit'),
      inneneinheiten: collectIndoorUnits(),
      bedienungRegelung: collectChecklist(document.getElementById('checkRegelung'), 'Bedienung / Regelung'),
      leitungssystem: collectChecklist(document.getElementById('checkLeitung'), 'Leitungssystem')
    },
    messwerte: collectMeasurements(),
    bemerkungen: document.getElementById('bemerkungenText').value || '',
    fotos: getPhotoMetaForCurrent(),
    gesamtzustand: getRadioValue('gesamtzustand'),
    gesamtMangelbeschreibung: document.getElementById('globalMangelText').value || '',
    unterschrift: {
      techniker: document.getElementById('signTechnikerInput').value || '',
      vorhanden: signatureDirty,
      pngDataUrl: signatureDirty ? document.getElementById('signatureCanvas').toDataURL('image/png') : '',
      jpegDataUrl: signatureDirty ? getSignatureJpegDataUrl() : ''
    },
    fusszeile: document.getElementById('footerText').innerText
  };
}

function getPhotoMetaForCurrent() {
  var meta = [];

  for (var i = 0; i < currentPhotos.length; i++) {
    meta.push({
      name: currentPhotos[i].name,
      type: currentPhotos[i].type,
      size: currentPhotos[i].data.length
    });
  }

  return meta;
}

function getSignatureJpegDataUrl() {
  var source = document.getElementById('signatureCanvas');
  var temp = document.createElement('canvas');

  temp.width = source.width;
  temp.height = source.height;

  var ctx = temp.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, temp.width, temp.height);
  ctx.drawImage(source, 0, 0);

  return temp.toDataURL('image/jpeg', 0.92);
}

function getCurrentProtocolIssuesForSave() {
  try {
    handleConditionalFields();
    var data = collectProtocol();
    return getProtocolValidationIssues(data, 'aktuelles Protokoll');
  } catch (err) {
    return ['aktuelles Protokoll: Prüfung konnte nicht ausgeführt werden: ' + getErrorText(err)];
  }
}

function getAllProtocolValidationIssuesForExport() {
  var allIssues = [];

  for (var i = 0; i < appState.protocols.length; i++) {
    var record = appState.protocols[i];
    var label = 'Protokoll ' + (i + 1) + ' / ' + (record.recordId || 'ohne ID');
    var data = record.data || {};
    var issues = getProtocolValidationIssues(data, label);

    for (var j = 0; j < issues.length; j++) {
      allIssues.push(issues[j]);
    }
  }

  return allIssues;
}

function getProtocolValidationIssues(data, label) {
  var issues = [];

  if (!data) {
    issues.push(label + ': keine Protokolldaten vorhanden.');
    return issues;
  }

  var stammdaten = data.stammdaten || {};
  var kopfdaten = data.kopfdaten || {};
  var pruefung = data.pruefung || {};
  var unterschrift = data.unterschrift || {};

  if (!safeText(stammdaten.kunde)) {
    issues.push(label + ': Kunde fehlt.');
  }

  if (!safeText(stammdaten.objekt)) {
    issues.push(label + ': Objekt fehlt.');
  }

  if (!safeText(kopfdaten.anlagentyp)) {
    issues.push(label + ': Anlagentyp fehlt.');
  }

  if (!safeText(kopfdaten.datum)) {
    issues.push(label + ': Datum fehlt.');
  }

  if (!safeText(kopfdaten.techniker)) {
    issues.push(label + ': Techniker in Kopfdaten fehlt.');
  }

  if (!safeText(data.gesamtzustand)) {
    issues.push(label + ': Gesamtzustand fehlt.');
  }

  if (
    (data.gesamtzustand === 'leichte Mängel' || data.gesamtzustand === 'mangelhaft') &&
    !safeText(data.gesamtMangelbeschreibung)
  ) {
    issues.push(label + ': Gesamt-Mangelbeschreibung fehlt.');
  }

  if (!safeText(unterschrift.techniker)) {
    issues.push(label + ': Technikername bei Unterschrift fehlt.');
  }

  if (
    unterschrift.vorhanden !== true &&
    !safeText(unterschrift.pngDataUrl) &&
    !safeText(unterschrift.jpegDataUrl)
  ) {
    issues.push(label + ': Unterschrift fehlt.');
  }

  addChecklistValidationIssues(issues, label, 'Allgemein', pruefung.allgemein || []);
  addChecklistValidationIssues(issues, label, 'Außeneinheit', pruefung.ausseneinheit || []);

  var inneneinheiten = pruefung.inneneinheiten || [];

  for (var i = 0; i < inneneinheiten.length; i++) {
    var unit = inneneinheiten[i] || {};
    var unitName =
      'Inneneinheit ' +
      (i + 1) +
      (unit.bezeichnung ? ' – ' + unit.bezeichnung : '');

    addChecklistValidationIssues(issues, label, unitName, unit.pruefpunkte || []);
  }

  addChecklistValidationIssues(issues, label, 'Bedienung / Regelung', pruefung.bedienungRegelung || []);
  addChecklistValidationIssues(issues, label, 'Leitungssystem', pruefung.leitungssystem || []);

  return issues;
}

function addChecklistValidationIssues(issues, label, bereich, rows) {
  rows = rows || [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || {};
    var pruefpunkt = row.pruefpunkt || ('Prüfpunkt ' + (i + 1));
    var mangelErforderlich =
      row.status === 'nicht in Ordnung' ||
      row.repariert === true;

    if (mangelErforderlich && !safeText(row.mangelbeschreibung)) {
      issues.push(
        label +
        ': ' +
        bereich +
        ' – ' +
        pruefpunkt +
        ': Mangelbeschreibung / Maßnahme fehlt.'
      );
    }
  }
}

function safeText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function saveDraft(showStatus) {
  try {
    appState.draft = {
      editingIndex: editingIndex,
      data: collectProtocol()
    };

    saveState(false);

    if (showStatus !== false) {
      setStatus('Entwurf gespeichert. Fotos werden nicht dauerhaft im Entwurf gespeichert.', 'ok');
    }
  } catch (err) {
    setStatus('Entwurf konnte nicht gespeichert werden: ' + getErrorText(err), 'error');
  }
}

function saveState(showError) {
  try {
    var stateForStorage = {
      version: appState.version,
      protocols: appState.protocols,
      draft: appState.draft
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateForStorage));
  } catch (err) {
    if (showError !== false) {
      setStatus('Lokales Speichern fehlgeschlagen: ' + getErrorText(err), 'error');
    }
  }
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return;
    }

    var parsed = JSON.parse(raw);

    if (parsed) {
      appState.protocols = Array.isArray(parsed.protocols) ? parsed.protocols : [];
      appState.draft = parsed.draft || null;
    }
  } catch (err) {
    setStatus('Lokale Daten konnten nicht geladen werden: ' + getErrorText(err), 'error');
  }
}

function restoreDraft() {
  if (!appState.draft || !appState.draft.data) {
    return;
  }

  editingIndex = typeof appState.draft.editingIndex === 'number' ? appState.draft.editingIndex : null;
  fillFormFromProtocol(appState.draft.data);
}

function fillFormFromProtocol(data) {
  data = data || {};

  document.getElementById('kundeInput').value = data.stammdaten && data.stammdaten.kunde || '';
  document.getElementById('objektInput').value = data.stammdaten && data.stammdaten.objekt || '';

  setFields(document.getElementById('kopfdatenFields'), data.kopfdaten || {});
  setChecklist(document.getElementById('checkAllgemein'), data.pruefung && data.pruefung.allgemein || []);
  setChecklist(document.getElementById('checkAussen'), data.pruefung && data.pruefung.ausseneinheit || []);
  setChecklist(document.getElementById('checkRegelung'), data.pruefung && data.pruefung.bedienungRegelung || []);
  setChecklist(document.getElementById('checkLeitung'), data.pruefung && data.pruefung.leitungssystem || []);
  setMeasurements(data.messwerte || []);

  document.getElementById('bemerkungenText').value = data.bemerkungen || '';
  document.getElementById('globalMangelText').value = data.gesamtMangelbeschreibung || '';

  setRadioValue('gesamtzustand', data.gesamtzustand || '');

  document.getElementById('signTechnikerInput').value = data.unterschrift && data.unterschrift.techniker || '';
  clearSignature(false);

  if (data.unterschrift && data.unterschrift.pngDataUrl) {
    loadSignature(data.unterschrift.pngDataUrl);
  }

  var container = document.getElementById('innenContainer');
  container.innerHTML = '';
  indoorCounter = 0;

  var units = data.pruefung && data.pruefung.inneneinheiten || [];

  for (var i = 0; i < units.length; i++) {
    addIndoorUnit(false, units[i]);
  }

  if (!units.length) {
    addIndoorUnit(false);
  }

  handleConditionalFields();
  updateInspectionMonths();
  updateSummaries();
}

function resetCurrentForm(showMessage) {
  var keepKunde = document.getElementById('kundeInput').value;
  var keepObjekt = document.getElementById('objektInput').value;

  document.getElementById('protocolForm').reset();
  document.getElementById('kundeInput').value = keepKunde;
  document.getElementById('objektInput').value = keepObjekt;
  document.getElementById('innenContainer').innerHTML = '';

  indoorCounter = 0;
  addIndoorUnit(false);

  document.getElementById('fotoInput').value = '';
  currentPhotos = [];
  updatePhotoListFromCurrentPhotos();

  clearSignature(false);
  signatureDirty = false;

  editingIndex = null;
  appState.draft = null;

  setDefaultDate();
  handleConditionalFields();
  saveState(false);
  renderProtocolList();
  updateEditModeUI();
  updateSummaries();
  openSection('sectionKopfdaten', true);

  if (showMessage !== false) {
    setStatus('Formular geleert. Bereits übernommene Protokolle bleiben in der Liste.', 'ok');
  }
}

function clearAll() {
  if (!confirm('Wirklich alle lokalen Protokolldaten löschen?')) {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

async function updatePhotoListFromInput() {
  var input = document.getElementById('fotoInput');
  var files = input.files;

  if (!files.length) {
    updatePhotoListFromCurrentPhotos();
    updateSummaries();
    return;
  }

  var addedCount = 0;

  for (var i = 0; i < files.length; i++) {
    currentPhotos.push({
      name: files[i].name,
      type: files[i].type || 'application/octet-stream',
      data: new Uint8Array(await files[i].arrayBuffer())
    });

    addedCount++;
  }

  input.value = '';

  updatePhotoListFromCurrentPhotos();
  updateSummaries();
  saveDraft(false);

  setStatus(
    addedCount + ' Foto(s) hinzugefügt. Insgesamt geladen: ' + currentPhotos.length,
    'ok'
  );
}

function updatePhotoListFromCurrentPhotos() {
  var box = document.getElementById('photoList');
  box.innerHTML = '';

  if (!currentPhotos.length) {
    box.textContent = 'Keine Fotos ausgewählt.';
    updateSummaries();
    return;
  }

  for (var i = 0; i < currentPhotos.length; i++) {
    var row = document.createElement('div');
    row.className = 'photo-row';

    var info = document.createElement('div');
    info.innerHTML =
      '<div class="photo-name">' + escapeHtml(String(i + 1) + '. ' + currentPhotos[i].name) + '</div>' +
      '<div class="photo-meta">' + escapeHtml(formatBytes(currentPhotos[i].data.length)) + '</div>';

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-danger photo-delete';
    button.textContent = 'Löschen';
    button.setAttribute('data-photo-index', i);

    button.addEventListener('click', function () {
      deleteCurrentPhoto(Number(this.getAttribute('data-photo-index')));
    });

    row.appendChild(info);
    row.appendChild(button);
    box.appendChild(row);
  }

  updateSummaries();
}

function deleteCurrentPhoto(index) {
  if (index < 0 || index >= currentPhotos.length) {
    return;
  }

  var deleted = currentPhotos[index].name;
  currentPhotos.splice(index, 1);
  document.getElementById('fotoInput').value = '';
  updatePhotoListFromCurrentPhotos();
  saveDraft(false);
  setStatus('Foto gelöscht: ' + deleted, 'ok');
}

function initSignatureCanvas() {
  var canvas = document.getElementById('signatureCanvas');
  var ctx = canvas.getContext('2d');

  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111827';

  function pos(evt) {
    var rect = canvas.getBoundingClientRect();
    var p = evt.touches && evt.touches[0] ? evt.touches[0] : evt;

    return {
      x: (p.clientX - rect.left) * (canvas.width / rect.width),
      y: (p.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function start(evt) {
    evt.preventDefault();
    signatureDrawing = true;
    var p = pos(evt);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(evt) {
    if (!signatureDrawing) {
      return;
    }

    evt.preventDefault();
    var p = pos(evt);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    signatureDirty = true;
    updateSummaries();
  }

  function end(evt) {
    if (!signatureDrawing) {
      return;
    }

    evt.preventDefault();
    signatureDrawing = false;
    saveDraft(false);
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end, { passive: false });
}

function clearSignature(save) {
  var canvas = document.getElementById('signatureCanvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  signatureDirty = false;
  updateSummaries();

  if (save !== false) {
    saveDraft(false);
  }
}

function loadSignature(dataUrl) {
  var img = new Image();

  img.onload = function () {
    var canvas = document.getElementById('signatureCanvas');
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    signatureDirty = true;
    updateSummaries();
  };

  img.src = dataUrl;
}

async function importJsonFromFile(event) {
  var input = event.target;
  var file = input.files && input.files[0];

  if (!file) {
    return;
  }

  try {
    var text = await file.text();
    var parsed = JSON.parse(text);
    var importedProtocols = normalizeImportedProtocols(parsed);

    if (!importedProtocols.length) {
      setStatus('JSON-Import fehlgeschlagen: Keine Protokolle in der Datei gefunden.', 'error');
      input.value = '';
      return;
    }

    if (editingIndex !== null) {
      var endEdit = confirm(
        'Es ist noch ein Protokoll im Bearbeitungsmodus.' +
        lineBreak +
        lineBreak +
        'Der Import beendet den Bearbeitungsmodus. Fortfahren?'
      );

      if (!endEdit) {
        input.value = '';
        return;
      }
    }

    var mode = prompt(
      'JSON-Import: ' + importedProtocols.length + ' Protokoll(e) gefunden.' +
      lineBreak +
      lineBreak +
      'H = zur bestehenden Liste hinzufügen' +
      lineBreak +
      'E = bestehende Liste ersetzen' +
      lineBreak +
      lineBreak +
      'Hinweis: Fotodateien werden aus JSON allein nicht wiederhergestellt.',
      'H'
    );

    if (mode === null) {
      input.value = '';
      return;
    }

    mode = String(mode).trim().toUpperCase();

    if (mode !== 'H' && mode !== 'E') {
      setStatus('JSON-Import abgebrochen: Ungültige Auswahl. Bitte H oder E eingeben.', 'error');
      input.value = '';
      return;
    }

    var appendMode = mode === 'H';

    var continueImport = confirm(
      appendMode
        ? 'Importierte Protokolle zur bestehenden Liste hinzufügen?'
        : 'Bestehende Protokollliste durch importierte Protokolle ersetzen?'
    );

    if (!continueImport) {
      input.value = '';
      return;
    }

    if (appendMode) {
      importedProtocols = ensureUniqueImportedRecordIds(importedProtocols, appState.protocols);
      appState.protocols = appState.protocols.concat(importedProtocols);
    } else {
      appState.protocols = importedProtocols;
      photoStore = {};
    }

    editingIndex = null;
    appState.draft = null;

    updateImportedProtocolCompleteness();
    saveState(false);
    renderProtocolList();
    updateEditModeUI();
    updateSummaries();
    openSection('sectionListe', true);

    setStatus(
      'JSON-Import abgeschlossen.' +
      lineBreak +
      'Importierte Protokolle: ' + importedProtocols.length +
      lineBreak +
      'Hinweis: Fotodateien wurden nicht wiederhergestellt.',
      'ok'
    );
  } catch (err) {
    setStatus('JSON-Import fehlgeschlagen: ' + getErrorText(err), 'error');
  } finally {
    input.value = '';
  }
}

function normalizeImportedProtocols(parsed) {
  var source = [];

  if (Array.isArray(parsed)) {
    source = parsed;
  } else if (parsed && Array.isArray(parsed.protokolle)) {
    source = parsed.protokolle;
  } else if (parsed && Array.isArray(parsed.protocols)) {
    source = parsed.protocols;
  }

  var result = [];

  for (var i = 0; i < source.length; i++) {
    var item = source[i] || {};
    var data = item.data || item;

    if (!looksLikeProtocolData(data)) {
      continue;
    }

    var recordId = safeText(item.recordId);

    if (!recordId) {
      recordId = createId('WP');
    }

    var issues = [];

    if (typeof getProtocolValidationIssues === 'function') {
      issues = getProtocolValidationIssues(data, 'Import ' + (i + 1));
    }

    result.push({
      recordId: recordId,
      erstelltAm: item.erstelltAm || new Date().toISOString(),
      bearbeitetAm: item.bearbeitetAm || new Date().toISOString(),
      data: data,
      vollstaendig: issues.length === 0,
      unvollstaendigHinweise: issues,
      importiertAm: new Date().toISOString()
    });
  }

  return result;
}

function looksLikeProtocolData(data) {
  if (!data) {
    return false;
  }

  return !!(
    data.stammdaten ||
    data.kopfdaten ||
    data.pruefung ||
    data.messwerte ||
    data.gesamtzustand ||
    data.unterschrift
  );
}

function ensureUniqueImportedRecordIds(importedProtocols, existingProtocols) {
  var used = {};

  for (var i = 0; i < existingProtocols.length; i++) {
    if (existingProtocols[i] && existingProtocols[i].recordId) {
      used[existingProtocols[i].recordId] = true;
    }
  }

  for (var j = 0; j < importedProtocols.length; j++) {
    var id = importedProtocols[j].recordId;

    if (!id || used[id]) {
      importedProtocols[j].recordId = createId('WP-IMP');
    }

    used[importedProtocols[j].recordId] = true;
  }

  return importedProtocols;
}

function updateImportedProtocolCompleteness() {
  if (typeof getProtocolValidationIssues !== 'function') {
    return;
  }

  for (var i = 0; i < appState.protocols.length; i++) {
    var record = appState.protocols[i];

    if (!record || !record.data) {
      continue;
    }

    var label = 'Protokoll ' + (i + 1) + ' / ' + (record.recordId || 'ohne ID');
    var issues = getProtocolValidationIssues(record.data, label);

    record.vollstaendig = issues.length === 0;
    record.unvollstaendigHinweise = issues;
  }
}

async function exportZip() {
  if (editingIndex !== null) {
    setStatus('Es ist noch ein Protokoll im Bearbeitungsmodus. Erst Änderungen speichern oder Formular leeren.', 'error');
    openSection('sectionListe', true);
    return;
  }

  if (!appState.protocols.length) {
    setStatus('Noch keine Protokolle in der Liste. Erst „Protokoll in Liste übernehmen“ drücken.', 'error');
    openSection('sectionListe', true);
    return;
  }

  var exportIssues = getAllProtocolValidationIssuesForExport();

  if (exportIssues.length > 0) {
    var message =
      'Export nicht möglich. Es sind unvollständige Protokolle in der Liste:' +
      lineBreak + lineBreak +
      '- ' + exportIssues.slice(0, 40).join(lineBreak + '- ');

    if (exportIssues.length > 40) {
      message += lineBreak + '- ... weitere ' + (exportIssues.length - 40) + ' Punkt(e)';
    }

    setStatus(message, 'error');
    openSection('sectionListe', true);
    return;
  }

  setStatus('ZIP wird erstellt ...', 'ok');

  try {
    var files = [];
    var exportData = buildExportData();

    files.push({ name: 'protokolle.json', data: utf8(JSON.stringify(exportData, null, 2)) });
    files.push({ name: 'protokolle.csv', data: utf8(String.fromCharCode(65279) + buildCsvForProtocols(appState.protocols)) });

    for (var i = 0; i < appState.protocols.length; i++) {
      var record = appState.protocols[i];
      var folder = 'protokoll_' + pad3(i + 1) + '/';

      files.push({ name: folder + 'druckansicht.html', data: utf8(buildPrintHtml(record.data)) });
      files.push({ name: folder + 'protokoll.pdf', data: generatePdfBytes(record.data) });

      var photos = photoStore[record.recordId] || [];

      for (var p = 0; p < photos.length; p++) {
        files.push({
          name: folder + 'fotos/foto_' + pad3(p + 1) + '_' + sanitizeFileName(photos[p].name),
          data: photos[p].data
        });
      }
    }

    var zip = buildZip(files);
    var filename = 'wartungsprotokolle_kaelte_' + formatDateFile(new Date()) + '.zip';

    downloadFile(filename, zip, 'application/zip');

    setStatus('ZIP exportiert. Warte auf Auswahl: Leeren oder Daten behalten.', 'ok');

    var clearNow = await askExportCleanupChoice();

    if (clearNow) {
      clearCompletelyAfterExport();
    } else {
      setStatus('ZIP exportiert. Daten wurden behalten und können später manuell geleert werden.', 'ok');
    }
  } catch (err) {
    setStatus('ZIP konnte nicht erstellt werden: ' + getErrorText(err), 'error');
  }
}

function askExportCleanupChoice() {
  return new Promise(function (resolve) {
    var overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '9999';
    overlay.style.background = 'rgba(15, 23, 42, 0.55)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '18px';

    var box = document.createElement('div');
    box.style.width = '100%';
    box.style.maxWidth = '420px';
    box.style.background = '#ffffff';
    box.style.borderRadius = '16px';
    box.style.padding = '18px';
    box.style.boxShadow = '0 12px 40px rgba(0,0,0,0.35)';
    box.style.fontFamily = 'Arial, sans-serif';
    box.style.color = '#111827';

    box.innerHTML =
      '<div style="font-size:20px;font-weight:900;margin-bottom:8px;">Export abgeschlossen</div>' +
      '<div style="font-size:15px;line-height:1.4;margin-bottom:16px;">Soll das Formular jetzt komplett geleert werden oder sollen die Daten erhalten bleiben?</div>' +
      '<div style="display:grid;grid-template-columns:1fr;gap:10px;">' +
        '<button type="button" id="exportClearButton" style="min-height:52px;border:0;border-radius:12px;background:#dc2626;color:#fff;font-size:16px;font-weight:900;">Leeren</button>' +
        '<button type="button" id="exportKeepButton" style="min-height:52px;border:0;border-radius:12px;background:#dbeafe;color:#1e3a8a;font-size:16px;font-weight:900;">Daten behalten</button>' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('exportClearButton').addEventListener('click', function () {
      document.body.removeChild(overlay);
      resolve(true);
    });

    document.getElementById('exportKeepButton').addEventListener('click', function () {
      document.body.removeChild(overlay);
      resolve(false);
    });
  });
}

function clearCompletelyAfterExport() {
  appState = {
    version: 'V3.5',
    protocols: [],
    draft: null
  };

  photoStore = {};
  currentPhotos = [];
  editingIndex = null;
  indoorCounter = 0;

  localStorage.removeItem(STORAGE_KEY);

  document.getElementById('kundeInput').value = '';
  document.getElementById('objektInput').value = '';
  document.getElementById('protocolForm').reset();
  document.getElementById('innenContainer').innerHTML = '';
  document.getElementById('fotoInput').value = '';
  document.getElementById('importJsonInput').value = '';

  currentPhotos = [];
  updatePhotoListFromCurrentPhotos();

  clearSignature(false);
  signatureDirty = false;

  setDefaultDate();
  addIndoorUnit(false);
  handleConditionalFields();
  renderProtocolList();
  updateEditModeUI();
  updateSummaries();

  document.querySelectorAll('details.section').forEach(function (section) {
    section.open = section.id === 'sectionStammdaten';
  });

  window.scrollTo(0, 0);

  setStatus('Export abgeschlossen. Formular und lokale Protokolldaten wurden geleert.', 'ok');
}

function buildExportData() {
  return {
    exportFormat: 'GEBATECH_Wartungsprotokolle_Kaelte_JSON_V3_5',
    exportiertAm: new Date().toISOString(),
    protokolle: appState.protocols.map(function (record) {
      return {
        recordId: record.recordId,
        erstelltAm: record.erstelltAm,
        bearbeitetAm: record.bearbeitetAm,
        vollstaendig: record.vollstaendig,
        unvollstaendigHinweise: record.unvollstaendigHinweise || [],
        data: record.data
      };
    })
  };
}

function buildCsvForProtocols(records) {
  var rows = [];

  rows.push(['Protokoll_ID', 'Bereich', 'Einheit', 'Prüfpunkt', 'Status/Wert', 'Gereinigt', 'Repariert', 'Mangelbeschreibung', 'Einheit']);

  records.forEach(function (record) {
    var data = record.data;

    rows.push([record.recordId, 'Stammdaten', '', 'Kunde', data.stammdaten.kunde, '', '', '', '']);
    rows.push([record.recordId, 'Stammdaten', '', 'Objekt', data.stammdaten.objekt, '', '', '', '']);

    Object.keys(data.kopfdaten || {}).forEach(function (key) {
      rows.push([record.recordId, 'Kopfdaten', '', key, data.kopfdaten[key], '', '', '', '']);
    });

    addCsvChecklist(rows, record.recordId, data.pruefung.allgemein, 'Allgemein', '');
    addCsvChecklist(rows, record.recordId, data.pruefung.ausseneinheit, 'Außeneinheit', '');

    for (var i = 0; i < data.pruefung.inneneinheiten.length; i++) {
      var unit = data.pruefung.inneneinheiten[i];
      var unitName = unit.bezeichnung || String(i + 1);

      addCsvChecklist(rows, record.recordId, unit.pruefpunkte, 'Inneneinheit', unitName);

      (unit.messwerte || []).forEach(function (m) {
        rows.push([record.recordId, 'Messwerte Inneneinheit', unitName, m.label, m.wert, '', '', '', m.einheit]);
      });
    }

    addCsvChecklist(rows, record.recordId, data.pruefung.bedienungRegelung, 'Bedienung / Regelung', '');
    addCsvChecklist(rows, record.recordId, data.pruefung.leitungssystem, 'Leitungssystem', '');

    data.messwerte.forEach(function (m) {
      rows.push([record.recordId, 'Gemessene Daten', '', m.label, m.wert, '', '', '', m.einheit]);
    });

    if (data.bemerkungen) {
      rows.push([record.recordId, 'Bemerkungen', '', 'Bemerkungen', data.bemerkungen, '', '', '', '']);
    }

    rows.push([record.recordId, 'Gesamtzustand', '', 'Gesamtzustand', data.gesamtzustand, '', '', data.gesamtMangelbeschreibung, '']);
    rows.push([record.recordId, 'Unterschrift', '', 'Techniker', data.unterschrift.techniker, '', '', data.unterschrift.vorhanden ? 'Unterschrift im Protokoll eingebettet' : 'keine Unterschrift', '']);

    if (data.fotos && data.fotos.length) {
      data.fotos.forEach(function (foto, index) {
        rows.push([record.recordId, 'Fotos', '', 'Foto ' + (index + 1), foto.name, '', '', String(foto.size || ''), foto.type || '']);
      });
    }
  });

  return rows.map(function (row) {
    return row.map(csvCell).join(';');
  }).join(csvLineBreak);
}

function addCsvChecklist(rows, recordId, list, bereich, einheit) {
  (list || []).forEach(function (r) {
    rows.push([recordId, bereich, einheit, r.pruefpunkt, r.status, boolText(r.gereinigt), boolText(r.repariert), r.mangelbeschreibung, '']);
  });
}

function buildPrintHtml(data) {
  var css = [
    'body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px;position:relative}',
    '.print-content{position:relative;z-index:1}',
    '.logo{text-align:center;margin-bottom:8px}',
    'h1{text-align:center;font-size:20px;margin:0 0 4px 0}',
    '.sub{text-align:center;font-weight:bold;margin-bottom:14px}',
    '.box{border:1px solid #111;padding:8px;margin-bottom:10px}',
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.sec{font-weight:bold;background:#f8f7dc;border:1px solid #111;padding:5px;margin-top:10px}',
    'table{width:100%;border-collapse:collapse;margin-bottom:10px}',
    'th,td{border:1px solid #111;padding:4px;vertical-align:top}',
    'th{background:#eee}',
    '.ok{background:#92d050}',
    '.warn{background:#ffff00}',
    '.bad{background:#ff0000}',
    '.foot{font-size:9px;text-align:center;margin-top:16px}',
    '.sig{height:100px;border:1px solid #000;background:#fff}',
    '.sig img{max-height:95px;max-width:100%}'
  ].join('');

  var stammdaten = data.stammdaten || {};
  var kopfdaten = data.kopfdaten || {};
  var pruefung = data.pruefung || {};
  var unterschrift = data.unterschrift || {};

  var html =
    '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<title>Prüf-/Wartungsprotokoll Kältetechnik</title>' +
    '<style>' + css + '</style></head><body>' +
    '<div class="print-content">';

  html +=
    '<div class="logo">' + getInlineLogoSvg() + '</div>' +
    '<h1>Prüf-/Wartungsprotokoll Kältetechnik</h1>' +
    '<div class="sub">lt. § 22 Kältemittelverordnung und § 13 AStV</div>';

  html +=
    '<div class="box grid"><div><b>Kunde:</b> ' + escapeHtml(stammdaten.kunde || '') +
    '<br><b>Objekt:</b> ' + escapeHtml(stammdaten.objekt || '') +
    '<br><b>Bezeichnung/Name:</b> ' + escapeHtml(kopfdaten.bezeichnungName || '') +
    '<br><b>Anlagentyp:</b> ' + escapeHtml(kopfdaten.anlagentyp || '') +
    '<br><b>Kältemittel:</b> ' + escapeHtml(kopfdaten.kaeltemittel || '') +
    '<br><b>Type:</b> ' + escapeHtml(kopfdaten.type || '') +
    '<br><b>Gesamtleistung:</b> ' + escapeHtml(kopfdaten.gesamtleistung || '') +
    '<br><b>Serien-Nr.:</b> ' + escapeHtml(kopfdaten.seriennummer || '') +
    '</div><div><b>Datum:</b> ' + escapeHtml(kopfdaten.datum || '') +
    '<br><b>Techniker:</b> ' + escapeHtml(kopfdaten.techniker || '') +
    '<br><b>Letzte Überprüfung:</b> ' + escapeHtml(kopfdaten.letzteUeberpruefung || '') +
    '<br><b>Nächste Überprüfung:</b> ' + escapeHtml(kopfdaten.naechsteUeberpruefung || '') +
    '</div></div>';

  html += printChecklist('Allgemein', pruefung.allgemein || []);
  html += printChecklist('Außeneinheit', pruefung.ausseneinheit || []);

  (pruefung.inneneinheiten || []).forEach(function (unit, i) {
    var title = 'Inneneinheit ' + (i + 1) + (unit.bezeichnung ? ' – ' + unit.bezeichnung : '');
    html += printIndoorMeasurements(title + ' Messwerte', unit.messwerte || []);
    html += printChecklist(title, unit.pruefpunkte || []);
  });

  html += printChecklist('Bedienung / Regelung', pruefung.bedienungRegelung || []);
  html += printChecklist('Leitungssystem', pruefung.leitungssystem || []);

  html +=
    '<div class="sec">Gemessene Daten</div>' +
    '<table><tr><th>Messpunkt</th><th>Wert</th><th>Einheit</th></tr>' +
    (data.messwerte || []).map(function (m) {
      return '<tr><td>' + escapeHtml(m.label) + '</td><td>' + escapeHtml(m.wert) + '</td><td>' + escapeHtml(m.einheit) + '</td></tr>';
    }).join('') +
    '</table>';

  if (data.bemerkungen) {
    html += '<div class="sec">Bemerkungen</div><div class="box">' + escapeHtml(data.bemerkungen).replace(/\n/g, '<br>') + '</div>';
  }

  var cls = data.gesamtzustand === 'keine Mängel'
    ? 'ok'
    : data.gesamtzustand === 'leichte Mängel'
      ? 'warn'
      : 'bad';

  html +=
    '<div class="sec">Gesamtzustand</div>' +
    '<table><tr><td class="' + cls + '"><b>' + escapeHtml(data.gesamtzustand || '') + '</b></td></tr>' +
    '<tr><td>' + escapeHtml(data.gesamtMangelbeschreibung || '') + '</td></tr></table>';

  html +=
    '<div class="sec">Techniker / Unterschrift</div>' +
    '<div class="box"><b>Techniker:</b> ' + escapeHtml(unterschrift.techniker || '') +
    '<div class="sig">' +
    (unterschrift.pngDataUrl ? '<img src="' + unterschrift.pngDataUrl + '">' : '') +
    '</div></div>';

  html += '<div class="foot">' + escapeHtml(data.fusszeile || '').replace(/\n/g, '<br>') + '</div></div></body></html>';

  return html;
}

function printIndoorMeasurements(title, rows) {
  var html = '<div class="sec">' + escapeHtml(title) + '</div><table><tr><th>Messpunkt</th><th>Wert</th><th>Einheit</th></tr>';

  (rows || []).forEach(function (m) {
    html += '<tr><td>' + escapeHtml(m.label) + '</td><td>' + escapeHtml(m.wert) + '</td><td>' + escapeHtml(m.einheit) + '</td></tr>';
  });

  html += '</table>';

  return html;
}

function printChecklist(title, rows) {
  var html = '<div class="sec">' + escapeHtml(title) + '</div><table><tr><th>Prüfpunkt</th><th>Status</th><th>gereinigt</th><th>repariert</th><th>Mangel / Maßnahme</th></tr>';

  (rows || []).forEach(function (r) {
    html +=
      '<tr>' +
        '<td>' + escapeHtml(r.pruefpunkt) + '</td>' +
        '<td>' + escapeHtml(r.status) + '</td>' +
        '<td>' + escapeHtml(boolText(r.gereinigt)) + '</td>' +
        '<td>' + escapeHtml(boolText(r.repariert)) + '</td>' +
        '<td>' + escapeHtml(r.mangelbeschreibung) + '</td>' +
      '</tr>';
  });

  html += '</table>';

  return html;
}

function generatePdfBytes(data) {
  var lines = buildPdfTextLines(data);
  var content = 'BT /F1 10 Tf 40 800 Td 12 TL ';

  for (var i = 0; i < lines.length; i++) {
    if (i > 0) {
      content += 'T* ';
    }

    content += '(' + pdfEscape(lines[i]) + ') Tj ';
  }

  content += 'ET';

  var objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');

  var pdf = '%PDF-1.4\n';
  var offsets = [0];

  for (var j = 0; j < objects.length; j++) {
    offsets.push(pdf.length);
    pdf += (j + 1) + ' 0 obj\n' + objects[j] + '\nendobj\n';
  }

  var xref = pdf.length;
  pdf += 'xref\n0 ' + (objects.length + 1) + '\n';
  pdf += '0000000000 65535 f \n';

  for (var k = 1; k < offsets.length; k++) {
    pdf += String(offsets[k]).padStart(10, '0') + ' 00000 n \n';
  }

  pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';

  return utf8(pdf);
}

function buildPdfTextLines(data) {
  var out = [];

  function add(label, value) {
    out.push(label + ': ' + (value || ''));
  }

  data = data || {};
  data.stammdaten = data.stammdaten || {};
  data.kopfdaten = data.kopfdaten || {};
  data.pruefung = data.pruefung || {};
  data.unterschrift = data.unterschrift || {};

  out.push('Pruef-/Wartungsprotokoll Kaeltetechnik');
  out.push('Paragraph 22 Kaeltemittelverordnung und Paragraph 13 AStV');
  out.push('');

  add('Kunde', data.stammdaten.kunde);
  add('Objekt', data.stammdaten.objekt);
  add('Bezeichnung/Name', data.kopfdaten.bezeichnungName);
  add('Anlagentyp', data.kopfdaten.anlagentyp);
  add('Kaeltemittel', data.kopfdaten.kaeltemittel);
  add('Type', data.kopfdaten.type);
  add('Gesamtleistung', data.kopfdaten.gesamtleistung);
  add('Serien-Nr.', data.kopfdaten.seriennummer);
  add('Datum', data.kopfdaten.datum);
  add('Techniker', data.kopfdaten.techniker);
  add('Letzte Ueberpruefung', data.kopfdaten.letzteUeberpruefung);
  add('Naechste Ueberpruefung', data.kopfdaten.naechsteUeberpruefung);

  addChecklistPdf(out, 'Allgemein', data.pruefung.allgemein);
  addChecklistPdf(out, 'Ausseneinheit', data.pruefung.ausseneinheit);

  (data.pruefung.inneneinheiten || []).forEach(function (unit, i) {
    var title = 'Inneneinheit ' + (i + 1) + (unit.bezeichnung ? ' - ' + unit.bezeichnung : '');

    out.push('');
    out.push(title + ' Messwerte');

    (unit.messwerte || []).forEach(function (m) {
      out.push('- ' + m.label + ': ' + (m.wert || '') + ' ' + m.einheit);
    });

    addChecklistPdf(out, title, unit.pruefpunkte);
  });

  addChecklistPdf(out, 'Bedienung / Regelung', data.pruefung.bedienungRegelung);
  addChecklistPdf(out, 'Leitungssystem', data.pruefung.leitungssystem);

  out.push('');
  out.push('Gemessene Daten');

  (data.messwerte || []).forEach(function (m) {
    out.push('- ' + m.label + ': ' + (m.wert || '') + ' ' + m.einheit);
  });

  if (data.bemerkungen) {
    out.push('');
    out.push('Bemerkungen');
    out.push(data.bemerkungen);
  }

  if (data.fotos && data.fotos.length) {
    out.push('');
    out.push('Fotos');
    data.fotos.forEach(function (foto, index) {
      out.push((index + 1) + '. ' + foto.name);
    });
  }

  out.push('');
  add('Gesamtzustand', data.gesamtzustand);
  add('Gesamt-Mangelbeschreibung', data.gesamtMangelbeschreibung);
  add('Unterschrift', data.unterschrift.vorhanden ? 'im Protokoll eingebettet' : 'nicht vorhanden');
  out.push('');
  out.push((data.fusszeile || '').replace(/\n/g, ' | '));

  return wrapPdfLines(out);
}

function addChecklistPdf(out, title, list) {
  out.push('');
  out.push(title);

  (list || []).forEach(function (r) {
    var line =
      '- ' + r.pruefpunkt +
      ': ' + (r.status || '-') +
      ', gereinigt: ' + boolText(r.gereinigt) +
      ', repariert: ' + boolText(r.repariert);

    out.push(line);

    if (r.mangelbeschreibung) {
      out.push('  Massnahme: ' + r.mangelbeschreibung);
    }
  });
}

function wrapPdfLines(lines) {
  var wrapped = [];
  var max = 88;

  for (var i = 0; i < lines.length; i++) {
    var line = normalizePdfText(lines[i] || '');

    while (line.length > max) {
      wrapped.push(line.slice(0, max));
      line = line.slice(max);
    }

    wrapped.push(line);

    if (wrapped.length > 62) {
      wrapped.push('...');
      break;
    }
  }

  return wrapped;
}

function normalizePdfText(value) {
  return String(value)
    .replace(/[ä]/g, 'ae')
    .replace(/[ö]/g, 'oe')
    .replace(/[ü]/g, 'ue')
    .replace(/[Ä]/g, 'Ae')
    .replace(/[Ö]/g, 'Oe')
    .replace(/[Ü]/g, 'Ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function getInlineLogoSvg() {
  return '<svg viewBox="0 0 520 180" xmlns="http://www.w3.org/2000/svg" style="width:180px;height:auto">' +
    '<text x="90" y="88" style="fill:#111;font-family:Arial;font-weight:900;font-size:54px">GEBA</text>' +
    '<text x="240" y="88" style="fill:#c4bd18;font-family:Arial;font-weight:900;font-size:54px">TECH</text>' +
    '<text x="92" y="122" style="fill:#111;font-family:Arial;font-weight:700;font-size:23px">GEBÄUDE | ANLAGENTECHNIK</text>' +
  '</svg>';
}

function buildZip(files) {
  var localParts = [];
  var centralParts = [];
  var offset = 0;

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var nameBytes = utf8(file.name);
    var data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    var crc = crc32(data);
    var timeDate = dosDateTime(new Date());

    var localHeader = concatBytes(
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(timeDate.time),
      u16(timeDate.date),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes
    );

    localParts.push(localHeader, data);

    var centralHeader = concatBytes(
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(timeDate.time),
      u16(timeDate.date),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes
    );

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  var centralSize = sumLength(centralParts);
  var centralOffset = offset;

  var end = concatBytes(
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralSize),
    u32(centralOffset),
    u16(0)
  );

  return concatBytes.apply(null, localParts.concat(centralParts, [end]));
}

function dosDateTime(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function crc32(bytes) {
  if (!crcTable) {
    crcTable = [];

    for (var n = 0; n < 256; n++) {
      var c = n;

      for (var k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }

      crcTable[n] = c >>> 0;
    }
  }

  var crc = 0 ^ -1;

  for (var i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
  }

  return (crc ^ -1) >>> 0;
}

function concatBytes() {
  var total = 0;

  for (var i = 0; i < arguments.length; i++) {
    total += arguments[i].length;
  }

  var output = new Uint8Array(total);
  var offset = 0;

  for (var j = 0; j < arguments.length; j++) {
    output.set(arguments[j], offset);
    offset += arguments[j].length;
  }

  return output;
}

function sumLength(parts) {
  var total = 0;

  for (var i = 0; i < parts.length; i++) {
    total += parts[i].length;
  }

  return total;
}

function u16(value) {
  return new Uint8Array([value & 255, (value >>> 8) & 255]);
}

function u32(value) {
  return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
}

function utf8(value) {
  return new TextEncoder().encode(String(value));
}

function base64DataUrlToBytes(dataUrl) {
  var base64 = String(dataUrl).split(',')[1] || '';
  var binary = atob(base64);
  var bytes = new Uint8Array(binary.length);

  for (var i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function downloadFile(filename, data, mimeType) {
  var blob = new Blob([data], { type: mimeType });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
}

function formatDateFile(date) {
  return date.getFullYear() +
    '-' + pad2(date.getMonth() + 1) +
    '-' + pad2(date.getDate()) +
    '_' + pad2(date.getHours()) +
    '-' + pad2(date.getMinutes());
}

function createId(prefix) {
  var d = new Date();
  var stamp =
    d.getFullYear().toString() +
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) +
    '-' +
    pad2(d.getHours()) +
    pad2(d.getMinutes()) +
    pad2(d.getSeconds());

  var rnd = Math.random().toString(16).slice(2, 8).toUpperCase();

  return prefix + '-' + stamp + '-' + rnd;
}

function pad2(number) {
  number = String(number);
  return number.length < 2 ? '0' + number : number;
}

function pad3(number) {
  number = String(number);

  while (number.length < 3) {
    number = '0' + number;
  }

  return number;
}

function boolText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return value === true ? 'Ja' : 'Nein';
}

function csvCell(value) {
  value = value === null || value === undefined ? '' : String(value);
  return '"' + value.replace(/"/g, '""') + '"';
}

function sanitizeFileName(name) {
  return String(name)
    .replace(/[\\/:*?"<>|#%{}~&]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 160);
}

function cssEscape(value) {
  if (window.CSS && CSS.escape) {
    return CSS.escape(value);
  }

  return String(value).replace(/"/g, '\\"');
}

function setRadioValue(name, value) {
  document.querySelectorAll('[name="' + name + '"]').forEach(function (radio) {
    radio.checked = radio.value === value;
  });
}

function getRadioValue(name) {
  var checked = document.querySelector('[name="' + name + '"]:checked');
  return checked ? checked.value : '';
}

function formatBytes(bytes) {
  bytes = Number(bytes) || 0;

  if (bytes < 1024) {
    return bytes + ' B';
  }

  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function setStatus(message, type) {
  var status = document.getElementById('status');

  status.className = 'status';

  if (!message) {
    status.textContent = '';
    return;
  }

  status.textContent = message;
  status.className = 'status ' + type;
}

function getErrorText(error) {
  if (!error) {
    return 'Unbekannter Fehler';
  }

  return error.message || String(error);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function pdfEscape(text) {
  return normalizePdfText(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}
