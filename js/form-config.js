var STORAGE_KEY = 'gebatech_wartungsprotokoll_kaelte_v34';

var CHECKLISTS = {
  aussen: [
    { label: 'Zustand', cleaned: true, repaired: true },
    { label: 'Kühlleistung/Heizleistung', cleaned: false, repaired: false },
    { label: 'Betriebsgeräusch', cleaned: false, repaired: true },
    { label: 'Kältemittelfüllung', cleaned: false, repaired: false },
    { label: 'Gehäuse', cleaned: true, repaired: true },
    { label: 'Kondensator', cleaned: true, repaired: true },
    { label: 'Ventilatoreinheit', cleaned: true, repaired: true },
    { label: 'Elektroanschluss', cleaned: true, repaired: true },
    { label: 'Kondensatableitung', cleaned: true, repaired: true },
    { label: 'Befestigung', cleaned: false, repaired: true }
  ],
  innen: [
    { label: 'Kühlleistung/Heizleistung', cleaned: false, repaired: false },
    { label: 'Betriebsgeräusch', cleaned: false, repaired: true },
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


var PRINT_GEAR_BACKGROUND = {
  enabled: true,

  // Deckkraft: 0 = unsichtbar, 1 = volle Deckkraft
  opacity: 1,

  // SVG-Datei
  imagePath: 'assets/frontpage-gear.svg',

  // Position auf der A4-Seite
  topMm: 0,
  rightMm: 0,

  // sichtbarer Ausschnitt oben rechts
  boxWidthMm: 85,
  boxHeightMm: 85,

  // Gesamtgröße des Zahnrads vor dem Beschneiden
  // Da nur das linke untere Viertel sichtbar sein soll,
  // ist das Zahnrad etwa doppelt so groß wie die sichtbare Box.
  svgWidthMm: 150,
  svgHeightMm: 150
};
