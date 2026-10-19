# Founders Grotesk

Founders Grotesk (Klim Type Foundry) is a commercial typeface: it is not included here. The page
and report ask for it by name, so it shows wherever it is installed.

To build it into `cloc-fusion.html` and every HTML report (so it shows on any machine), put your
licensed web font files in this folder, for example:

    founders-grotesk-regular.woff2
    founders-grotesk-medium.woff2
    founders-grotesk-semibold.woff2
    founders-grotesk-bold.woff2

then run `node scripts/embed-brand-font.mjs` and `node scripts/build-standalone.mjs`. Check that your
licence covers embedding the font in documents you share before committing these files.
