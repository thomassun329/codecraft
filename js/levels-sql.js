// SQL track: a "Mobdex" database. Each solved quest unlocks mob cards.
// Stats are approximate (Normal difficulty) — close enough for a game.
(function () {
  'use strict';

  // id, name, type, health, damage, home, loot
  const MOBS = [
    [1, 'Creeper', 'hostile', 20, 43, 'overworld', 'gunpowder'],
    [2, 'Zombie', 'hostile', 20, 3, 'overworld', 'rotten_flesh'],
    [3, 'Skeleton', 'hostile', 20, 4, 'overworld', 'bone'],
    [4, 'Spider', 'hostile', 16, 2, 'overworld', 'string'],
    [5, 'Enderman', 'neutral', 40, 7, 'end', 'ender_pearl'],
    [6, 'Blaze', 'hostile', 20, 6, 'nether', 'blaze_rod'],
    [7, 'Ghast', 'hostile', 10, 17, 'nether', 'ghast_tear'],
    [8, 'Wither Skeleton', 'hostile', 20, 8, 'nether', 'coal'],
    [9, 'Slime', 'hostile', 16, 4, 'overworld', 'slimeball'],
    [10, 'Warden', 'hostile', 500, 30, 'caves', 'sculk_catalyst'],
    [11, 'Iron Golem', 'neutral', 100, 21, 'overworld', 'iron_ingot'],
    [12, 'Wolf', 'neutral', 8, 4, 'overworld', 'nothing'],
    [13, 'Bee', 'neutral', 10, 2, 'overworld', 'nothing'],
    [14, 'Pig', 'passive', 10, 0, 'overworld', 'porkchop'],
    [15, 'Cow', 'passive', 10, 0, 'overworld', 'beef'],
    [16, 'Sheep', 'passive', 8, 0, 'overworld', 'wool'],
    [17, 'Chicken', 'passive', 4, 0, 'overworld', 'feather'],
    [18, 'Villager', 'passive', 20, 0, 'overworld', 'nothing'],
    [19, 'Axolotl', 'passive', 14, 2, 'caves', 'nothing'],
    [20, 'Fox', 'passive', 10, 2, 'overworld', 'nothing'],
  ];

  window.MOBS = MOBS.map(([id, name, type, health, damage, home, loot]) => ({ id, name, type, health, damage, home, loot }));

  window.MOB_SCHEMA = [
    ['id', 'INTEGER'], ['name', 'TEXT'], ['type', 'TEXT'], ['health', 'INTEGER'],
    ['damage', 'INTEGER'], ['home', 'TEXT'], ['loot', 'TEXT'],
  ];

  window.MOB_DB_SQL =
    'CREATE TABLE mobs (id INTEGER PRIMARY KEY, name TEXT, type TEXT, health INTEGER, damage INTEGER, home TEXT, loot TEXT);\n' +
    MOBS.map((m) => `INSERT INTO mobs VALUES (${m.map((v) => (typeof v === 'number' ? v : `'${v}'`)).join(', ')});`).join('\n');

  // Each quest: expected query (compared by result, not by text), mobs it unlocks.
  // orderCol: when order matters, the column index whose sequence must match.
  window.SQL_LEVELS = [
    {
      id: 'sql1', concept: 'select',
      quests: [
        { answer: 'SELECT * FROM mobs', unlock: [1, 2, 14], starter: 'SELECT * FROM mobs' },
        { answer: 'SELECT name, health FROM mobs', unlock: [3, 15, 17] },
        { answer: 'SELECT name, home, loot FROM mobs', unlock: [4, 16] },
      ],
      text: {
        en: {
          title: 'Open the Mobdex',
          story: 'You found an ancient Mobdex — a database with info on every mob. But it only answers questions written in <b>SQL</b>.',
          lesson: 'A <b>database</b> stores data in <b>tables</b> (like a spreadsheet). <code>SELECT</code> picks which columns you want, <code>FROM</code> says which table. <code>*</code> means "all columns".',
          example: 'SELECT name, type FROM mobs',
          quests: [
            'Show <b>everything</b> in the <code>mobs</code> table. Just press ▶ Run to try it!',
            'Show only the <b>name</b> and <b>health</b> of every mob.',
            'Show the <b>name</b>, <b>home</b> and <b>loot</b> of every mob.',
          ],
          hints: [
            'Column names go between <code>SELECT</code> and <code>FROM</code>, separated by commas.',
            'Check the table on the right side to see the exact column names.',
          ],
        },
        es: {
          title: 'Abre el Mobdex',
          story: 'Has encontrado un Mobdex antiguo — una base de datos con información de todas las criaturas. Pero solo responde a preguntas escritas en <b>SQL</b>.',
          lesson: 'Una <b>base de datos</b> guarda datos en <b>tablas</b> (como una hoja de cálculo). <code>SELECT</code> elige qué columnas quieres, <code>FROM</code> dice de qué tabla. <code>*</code> significa "todas las columnas".',
          example: 'SELECT name, type FROM mobs',
          quests: [
            'Muestra <b>todo</b> lo que hay en la tabla <code>mobs</code>. ¡Solo pulsa ▶ Ejecutar para probarlo!',
            'Muestra solo el <b>name</b> (nombre) y la <b>health</b> (vida) de cada criatura.',
            'Muestra el <b>name</b>, <b>home</b> (hogar) y <b>loot</b> (botín) de cada criatura.',
          ],
          hints: [
            'Los nombres de las columnas van entre <code>SELECT</code> y <code>FROM</code>, separados por comas.',
            'Mira la tabla de la derecha para ver los nombres exactos de las columnas.',
          ],
        },
        de: {
          title: 'Öffne den Mobdex',
          story: 'Du hast einen uralten Mobdex gefunden — eine Datenbank mit Infos über jeden Mob. Aber er beantwortet nur Fragen, die in <b>SQL</b> geschrieben sind.',
          lesson: 'Eine <b>Datenbank</b> speichert Daten in <b>Tabellen</b> (wie eine Tabellenkalkulation). <code>SELECT</code> wählt aus, welche Spalten du willst, <code>FROM</code> sagt, aus welcher Tabelle. <code>*</code> heißt "alle Spalten".',
          example: 'SELECT name, type FROM mobs',
          quests: [
            'Zeig <b>alles</b> aus der Tabelle <code>mobs</code>. Drück einfach ▶ Start, um es auszuprobieren!',
            'Zeig nur <b>name</b> und <b>health</b> (Leben) von jedem Mob.',
            'Zeig <b>name</b>, <b>home</b> (Zuhause) und <b>loot</b> (Beute) von jedem Mob.',
          ],
          hints: [
            'Die Spaltennamen kommen zwischen <code>SELECT</code> und <code>FROM</code>, getrennt durch Kommas.',
            'Schau dir die Tabelle rechts an, dort stehen die genauen Spaltennamen.',
          ],
        },
      },
    },
    {
      id: 'sql2', concept: 'where',
      quests: [
        { answer: "SELECT * FROM mobs WHERE type = 'hostile'", unlock: [9, 12, 13] },
        { answer: 'SELECT name FROM mobs WHERE health > 20', unlock: [5, 11] },
        { answer: "SELECT name, damage FROM mobs WHERE home = 'nether'", unlock: [6, 7, 8] },
      ],
      text: {
        en: {
          title: 'Mob Hunter',
          story: 'Night is coming. You need to know which mobs are dangerous — fast! Time to <b>filter</b> the Mobdex.',
          lesson: '<code>WHERE</code> keeps only the rows that match a rule. Text goes in single quotes: <code>\'hostile\'</code>. Numbers don\'t need quotes, and you can compare them with <code>&gt;</code> (bigger than) and <code>&lt;</code> (smaller than).',
          example: "SELECT name FROM mobs WHERE type = 'passive'",
          quests: [
            'Show all columns, but only for <b>hostile</b> mobs.',
            'Show the <b>name</b> of every mob with <b>health more than 20</b>. These are the tanks!',
            'Show the <b>name</b> and <b>damage</b> of the mobs whose home is the <b>nether</b>.',
          ],
          hints: [
            'The rule goes at the end: <code>SELECT … FROM mobs WHERE …</code>',
            'Text values need single quotes like <code>\'nether\'</code>, numbers don\'t: <code>health &gt; 20</code>.',
          ],
        },
        es: {
          title: 'Cazador de criaturas',
          story: 'Se acerca la noche. Necesitas saber qué criaturas son peligrosas — ¡rápido! Es hora de <b>filtrar</b> el Mobdex.',
          lesson: '<code>WHERE</code> se queda solo con las filas que cumplen una regla. El texto va entre comillas simples: <code>\'hostile\'</code>. Los números no necesitan comillas, y puedes compararlos con <code>&gt;</code> (mayor que) y <code>&lt;</code> (menor que).',
          example: "SELECT name FROM mobs WHERE type = 'passive'",
          quests: [
            'Muestra todas las columnas, pero solo de las criaturas <b>hostile</b> (hostiles).',
            'Muestra el <b>name</b> de cada criatura con <b>health mayor que 20</b>. ¡Son los tanques!',
            'Muestra el <b>name</b> y el <b>damage</b> (daño) de las criaturas cuyo hogar es el <b>nether</b>.',
          ],
          hints: [
            'La regla va al final: <code>SELECT … FROM mobs WHERE …</code>',
            'El texto necesita comillas simples como <code>\'nether\'</code>, los números no: <code>health &gt; 20</code>.',
          ],
        },
        de: {
          title: 'Mob-Jäger',
          story: 'Die Nacht kommt. Du musst wissen, welche Mobs gefährlich sind — schnell! Zeit, den Mobdex zu <b>filtern</b>.',
          lesson: '<code>WHERE</code> behält nur die Zeilen, die zu einer Regel passen. Text kommt in einfache Anführungszeichen: <code>\'hostile\'</code>. Zahlen brauchen keine, und du kannst sie mit <code>&gt;</code> (größer als) und <code>&lt;</code> (kleiner als) vergleichen.',
          example: "SELECT name FROM mobs WHERE type = 'passive'",
          quests: [
            'Zeig alle Spalten, aber nur für <b>hostile</b> (feindliche) Mobs.',
            'Zeig den <b>name</b> von jedem Mob mit <b>health größer als 20</b>. Das sind die Panzer!',
            'Zeig <b>name</b> und <b>damage</b> (Schaden) der Mobs, deren Zuhause der <b>nether</b> ist.',
          ],
          hints: [
            'Die Regel kommt ans Ende: <code>SELECT … FROM mobs WHERE …</code>',
            'Text braucht einfache Anführungszeichen wie <code>\'nether\'</code>, Zahlen nicht: <code>health &gt; 20</code>.',
          ],
        },
      },
    },
    {
      id: 'sql3', concept: 'order', boss: true,
      quests: [
        { answer: 'SELECT name, damage FROM mobs ORDER BY damage DESC', orderCol: 1, unlock: [18, 19, 20] },
        { answer: 'SELECT name, health FROM mobs ORDER BY health DESC LIMIT 3', orderCol: 1, unlock: [10] },
        { answer: "SELECT COUNT(*) FROM mobs WHERE type = 'hostile'", unlock: [] },
      ],
      text: {
        en: {
          title: 'Boss: Rank the Mobs',
          story: 'Boss level! 🏆 To prepare for the Warden you need rankings: who hits hardest, who is toughest, and how many enemies are out there.',
          lesson: '<code>ORDER BY</code> sorts the rows. Add <code>DESC</code> for biggest first. <code>LIMIT 3</code> keeps only the first 3 rows. <code>COUNT(*)</code> counts rows instead of showing them.',
          example: 'SELECT name, health FROM mobs ORDER BY health DESC LIMIT 5',
          quests: [
            'Show <b>name</b> and <b>damage</b> of all mobs, sorted from the <b>hardest hit</b> to the weakest.',
            'Show <b>name</b> and <b>health</b> of the <b>3 toughest</b> mobs (most health).',
            '<b>How many</b> hostile mobs are in the Mobdex? Let SQL count them.',
          ],
          hints: [
            'Order of the parts: <code>SELECT … FROM … WHERE … ORDER BY … LIMIT …</code>',
            '<code>SELECT COUNT(*) FROM mobs</code> counts all mobs. Add a <code>WHERE</code> to count only some of them.',
          ],
        },
        es: {
          title: 'Jefe: clasifica a las criaturas',
          story: '¡Nivel jefe! 🏆 Para prepararte contra el Warden necesitas clasificaciones: quién pega más fuerte, quién aguanta más y cuántos enemigos hay.',
          lesson: '<code>ORDER BY</code> ordena las filas. Añade <code>DESC</code> para que el mayor vaya primero. <code>LIMIT 3</code> se queda solo con las 3 primeras filas. <code>COUNT(*)</code> cuenta filas en vez de mostrarlas.',
          example: 'SELECT name, health FROM mobs ORDER BY health DESC LIMIT 5',
          quests: [
            'Muestra <b>name</b> y <b>damage</b> de todas las criaturas, ordenadas de la que <b>más daño hace</b> a la que menos.',
            'Muestra <b>name</b> y <b>health</b> de las <b>3 más resistentes</b> (más vida).',
            '¿<b>Cuántas</b> criaturas hostiles hay en el Mobdex? Deja que SQL las cuente.',
          ],
          hints: [
            'Orden de las partes: <code>SELECT … FROM … WHERE … ORDER BY … LIMIT …</code>',
            '<code>SELECT COUNT(*) FROM mobs</code> cuenta todas las criaturas. Añade un <code>WHERE</code> para contar solo algunas.',
          ],
        },
        de: {
          title: 'Boss: Rangliste der Mobs',
          story: 'Bosslevel! 🏆 Um dich auf den Warden vorzubereiten, brauchst du Ranglisten: Wer schlägt am härtesten zu, wer hält am meisten aus, und wie viele Feinde gibt es?',
          lesson: '<code>ORDER BY</code> sortiert die Zeilen. Mit <code>DESC</code> kommt das Größte zuerst. <code>LIMIT 3</code> behält nur die ersten 3 Zeilen. <code>COUNT(*)</code> zählt Zeilen, statt sie anzuzeigen.',
          example: 'SELECT name, health FROM mobs ORDER BY health DESC LIMIT 5',
          quests: [
            'Zeig <b>name</b> und <b>damage</b> aller Mobs, sortiert vom <b>härtesten Schlag</b> zum schwächsten.',
            'Zeig <b>name</b> und <b>health</b> der <b>3 zähesten</b> Mobs (meiste Leben).',
            '<b>Wie viele</b> feindliche (hostile) Mobs gibt es im Mobdex? Lass SQL zählen.',
          ],
          hints: [
            'Reihenfolge der Teile: <code>SELECT … FROM … WHERE … ORDER BY … LIMIT …</code>',
            '<code>SELECT COUNT(*) FROM mobs</code> zählt alle Mobs. Mit <code>WHERE</code> zählst du nur einige davon.',
          ],
        },
      },
    },
  ];
})();
