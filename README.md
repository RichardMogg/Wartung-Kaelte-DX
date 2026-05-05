index.html
assets/
css/
data/
js/
vendor/

# Wartungsprotokoll Kältetechnik

Lokale browserbasierte Web-App zur Erstellung von Prüf-/Wartungsprotokollen für Kältetechnik.

## Projektstruktur

```text
/
├─ index.html
├─ assets/
│  ├─ logo.svg
│  └─ frontpage-gear.svg
├─ css/
│  └─ app.css
├─ data/
│  └─ kaeltemittel.txt
├─ js/
│  ├─ form-config.js
│  └─ app.js
└─ vendor/
   └─ html2pdf.bundle.min.js

   | Datei                           | Aufgabe                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`                    | Seitenstruktur, Formularabschnitte, Buttons, Script- und CSS-Einbindung                             |
| `css/app.css`                   | Layout, Farben, Formularoptik, Tabellen, Bottom-Bar, responsive Darstellung                         |
| `js/form-config.js`             | Checklisten, Messpunkte, Storage-Key, Print-Gear-Konfiguration                                      |
| `js/app.js`                     | Formularlogik, Validierung, lokale Speicherung, Fotoverwaltung, Signatur, Import/Export, ZIP-Export |
| `data/kaeltemittel.txt`         | Auswahlliste der Kältemittel                                                                        |
| `assets/logo.svg`               | Logo in App und Druckansicht                                                                        |
| `assets/frontpage-gear.svg`     | Zahnradgrafik für Druckansicht                                                                      |
| `vendor/html2pdf.bundle.min.js` | PDF-Erzeugung aus der Druckansicht                                                                  |
