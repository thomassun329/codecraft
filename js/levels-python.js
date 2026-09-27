// Python track: each level teaches one idea. Randomized levels are tested on
// several worlds so memorizing a path doesn't work — the code has to "look".
(function () {
  'use strict';

  const onChest = (w) => w.here() === 'chest';
  const atChest = (w) => w.here() === 'chest' || w.ahead() === 'chest';

  function tunnel(cells) {
    const wall = 'B'.repeat(cells.length + 4);
    return [wall, 'BP' + cells.join('') + 'CB', wall];
  }

  window.PY_LEVELS = [
    {
      id: 'py1', concept: 'commands', par: 8, tests: 1,
      commands: ['move', 'turn_left', 'turn_right'],
      layout: () => ({ dir: 'E', rows: [
        'BBBBBBB',
        'BP..BBB',
        'BBB.BBB',
        'BBB..CB',
        'BBBBBBB',
      ] }),
      check: (w) => onChest(w) ? { ok: true } : { ok: false, why: 'not_at_chest' },
      starter: { en: '# Walk to the chest!\nmove()\n', es: '# ¡Camina hasta el cofre!\nmove()\n', de: '# Lauf zur Truhe!\nmove()\n' },
      solution: 'move()\nmove()\nturn_right()\nmove()\nmove()\nturn_left()\nmove()\nmove()',
      text: {
        en: {
          title: 'First Steps',
          story: 'You wake up in a dark cave. There\'s a treasure chest nearby! Your miner only moves when you give it commands — in Python.',
          lesson: 'A <b>command</b> tells the computer to do one thing. In Python you write its name followed by <code>()</code>. The computer reads your code from top to bottom, one line at a time.',
          example: 'move()\nmove()\nturn_right()',
          goal: 'Walk onto the chest 🎁',
          hints: [
            'Count the blocks to the first corner. How many <code>move()</code> do you need?',
            'At the corner, <code>turn_right()</code> makes you face down. Later you\'ll need <code>turn_left()</code>.',
          ],
        },
        es: {
          title: 'Primeros pasos',
          story: 'Te despiertas en una cueva oscura. ¡Hay un cofre del tesoro cerca! Tu minero solo se mueve cuando le das órdenes — en Python.',
          lesson: 'Un <b>comando</b> le dice al ordenador que haga una cosa. En Python escribes su nombre seguido de <code>()</code>. El ordenador lee tu código de arriba abajo, línea por línea.',
          example: 'move()\nmove()\nturn_right()',
          goal: 'Camina hasta el cofre 🎁',
          hints: [
            'Cuenta los bloques hasta la primera esquina. ¿Cuántos <code>move()</code> necesitas?',
            'En la esquina, <code>turn_right()</code> te hace mirar hacia abajo. Más tarde necesitarás <code>turn_left()</code>.',
          ],
        },
        de: {
          title: 'Erste Schritte',
          story: 'Du wachst in einer dunklen Höhle auf. In der Nähe steht eine Schatztruhe! Dein Miner bewegt sich nur, wenn du ihm Befehle gibst — in Python.',
          lesson: 'Ein <b>Befehl</b> sagt dem Computer, dass er eine Sache tun soll. In Python schreibst du den Namen und dahinter <code>()</code>. Der Computer liest deinen Code von oben nach unten, Zeile für Zeile.',
          example: 'move()\nmove()\nturn_right()',
          goal: 'Lauf auf die Truhe 🎁',
          hints: [
            'Zähl die Blöcke bis zur ersten Ecke. Wie viele <code>move()</code> brauchst du?',
            'An der Ecke dreht dich <code>turn_right()</code> nach unten. Später brauchst du <code>turn_left()</code>.',
          ],
        },
      },
    },

    {
      id: 'py2', concept: 'for', par: 3, tests: 1,
      commands: ['move', 'mine', 'for'],
      layout: () => ({ dir: 'E', rows: tunnel(Array(10).fill('#')) }),
      check: (w) => onChest(w) ? { ok: true } : { ok: false, why: 'not_at_chest' },
      starter: { en: '# Dig through the stone!\n', es: '# ¡Excava a través de la piedra!\n', de: '# Grab dich durch den Stein!\n' },
      solution: 'for i in range(11):\n    mine()\n    move()',
      text: {
        en: {
          title: 'The Long Tunnel',
          story: 'The chest is behind 10 blocks of stone. You could type <code>mine()</code> and <code>move()</code> 20 times… but good programmers are lazy in a smart way.',
          lesson: 'A <b>for loop</b> repeats code. <code>range(5)</code> means "5 times". Everything <b>indented</b> (pushed in with 4 spaces — press Tab) under the loop is repeated. Don\'t forget the <code>:</code> at the end!',
          example: 'for i in range(3):\n    mine()\n    move()',
          goal: 'Dig through to the chest. ⭐ Can you do it in just 3 lines?',
          hints: [
            'Every block needs two commands: <code>mine()</code> then <code>move()</code>.',
            'You need 11 steps in total — the last step is onto the chest. Mining air or a chest does nothing, so that\'s fine.',
          ],
        },
        es: {
          title: 'El túnel largo',
          story: 'El cofre está detrás de 10 bloques de piedra. Podrías escribir <code>mine()</code> y <code>move()</code> 20 veces… pero los buenos programadores son perezosos de forma inteligente.',
          lesson: 'Un <b>bucle for</b> repite código. <code>range(5)</code> significa "5 veces". Todo lo que está <b>sangrado</b> (movido 4 espacios a la derecha — pulsa Tab) debajo del bucle se repite. ¡No olvides los <code>:</code> al final!',
          example: 'for i in range(3):\n    mine()\n    move()',
          goal: 'Excava hasta el cofre. ⭐ ¿Puedes hacerlo en solo 3 líneas?',
          hints: [
            'Cada bloque necesita dos comandos: <code>mine()</code> y luego <code>move()</code>.',
            'Necesitas 11 pasos en total — el último es sobre el cofre. Minar aire o un cofre no hace nada, así que no pasa nada.',
          ],
        },
        de: {
          title: 'Der lange Tunnel',
          story: 'Die Truhe liegt hinter 10 Steinblöcken. Du könntest 20-mal <code>mine()</code> und <code>move()</code> tippen… aber gute Programmierer sind auf schlaue Art faul.',
          lesson: 'Eine <b>for-Schleife</b> wiederholt Code. <code>range(5)</code> heißt "5-mal". Alles, was darunter <b>eingerückt</b> ist (4 Leerzeichen nach rechts — drück Tab), wird wiederholt. Vergiss den <code>:</code> am Ende nicht!',
          example: 'for i in range(3):\n    mine()\n    move()',
          goal: 'Grab dich bis zur Truhe durch. ⭐ Schaffst du es in nur 3 Zeilen?',
          hints: [
            'Jeder Block braucht zwei Befehle: <code>mine()</code> und dann <code>move()</code>.',
            'Du brauchst insgesamt 11 Schritte — der letzte geht auf die Truhe. Luft oder eine Truhe abbauen macht nichts, das ist also okay.',
          ],
        },
      },
    },

    {
      id: 'py3', concept: 'if', par: 6, tests: 3,
      commands: ['move', 'mine', 'place', 'ahead', 'for', 'if'],
      layout: (rand) => {
        let cells;
        do { cells = Array.from({ length: 8 }, () => (rand() < 0.5 ? 'L' : '#')); }
        while (cells.filter((c) => c === 'L').length < 2 || cells.filter((c) => c === '#').length < 2);
        return { dir: 'E', rows: tunnel(cells) };
      },
      check: (w) => onChest(w) ? { ok: true } : { ok: false, why: 'not_at_chest' },
      starter: { en: '# Stone or lava? Look before you step!\n', es: '# ¿Piedra o lava? ¡Mira antes de pisar!\n', de: '# Stein oder Lava? Schau, bevor du gehst!\n' },
      solution: 'for i in range(9):\n    if ahead() == "lava":\n        place()\n    else:\n        mine()\n    move()',
      text: {
        en: {
          title: 'Lava Lake',
          story: 'Every block on this path is either stone or LAVA 🔥 — and it changes every time you run your code! You can\'t memorize the path. Your code has to <i>look</i>.',
          lesson: '<code>if</code> lets your code make decisions. <code>ahead()</code> tells you what\'s in front of you. <code>==</code> means "is equal to" (two = signs!). <code>else:</code> runs when the <code>if</code> was not true.',
          example: 'if ahead() == "lava":\n    place()\nelse:\n    mine()',
          goal: 'Reach the chest. Your code is tested on 3 different random worlds!',
          hints: [
            'There are 8 blocks, then the chest — so 9 steps. Use a <code>for</code> loop.',
            'Inside the loop: lava → <code>place()</code> a bridge. Otherwise → <code>mine()</code>. Then <code>move()</code>. Watch the indentation: <code>move()</code> belongs to the loop, not to the <code>else</code>.',
          ],
        },
        es: {
          title: 'Lago de lava',
          story: 'Cada bloque de este camino es piedra o LAVA 🔥 — ¡y cambia cada vez que ejecutas tu código! No puedes memorizar el camino. Tu código tiene que <i>mirar</i>.',
          lesson: '<code>if</code> permite que tu código tome decisiones. <code>ahead()</code> te dice qué hay delante de ti. <code>==</code> significa "es igual a" (¡dos signos =!). <code>else:</code> se ejecuta cuando el <code>if</code> no era cierto.',
          example: 'if ahead() == "lava":\n    place()\nelse:\n    mine()',
          goal: 'Llega al cofre. ¡Tu código se prueba en 3 mundos aleatorios distintos!',
          hints: [
            'Hay 8 bloques y luego el cofre — o sea, 9 pasos. Usa un bucle <code>for</code>.',
            'Dentro del bucle: lava → <code>place()</code> un puente. Si no → <code>mine()</code>. Luego <code>move()</code>. Cuidado con el sangrado: <code>move()</code> pertenece al bucle, no al <code>else</code>.',
          ],
        },
        de: {
          title: 'Lavasee',
          story: 'Jeder Block auf diesem Weg ist entweder Stein oder LAVA 🔥 — und das ändert sich jedes Mal, wenn du deinen Code startest! Du kannst dir den Weg nicht merken. Dein Code muss <i>hinschauen</i>.',
          lesson: 'Mit <code>if</code> kann dein Code Entscheidungen treffen. <code>ahead()</code> sagt dir, was vor dir ist. <code>==</code> heißt "ist gleich" (zwei =-Zeichen!). <code>else:</code> läuft, wenn das <code>if</code> nicht gestimmt hat.',
          example: 'if ahead() == "lava":\n    place()\nelse:\n    mine()',
          goal: 'Erreiche die Truhe. Dein Code wird in 3 verschiedenen Zufallswelten getestet!',
          hints: [
            'Es sind 8 Blöcke und dann die Truhe — also 9 Schritte. Nimm eine <code>for</code>-Schleife.',
            'In der Schleife: Lava → <code>place()</code> eine Brücke. Sonst → <code>mine()</code>. Danach <code>move()</code>. Achte auf die Einrückung: <code>move()</code> gehört zur Schleife, nicht zum <code>else</code>.',
          ],
        },
      },
    },

    {
      id: 'py4', concept: 'while', par: 7, tests: 3,
      commands: ['move', 'mine', 'ahead', 'say', 'while', 'if', 'variable'],
      layout: (rand) => {
        const n = 5 + Math.floor(rand() * 7);
        let cells;
        do { cells = Array.from({ length: n }, () => (rand() < 0.35 ? 'D' : '#')); }
        while (!cells.includes('D'));
        return { dir: 'E', rows: tunnel(cells), diamonds: cells.filter((c) => c === 'D').length };
      },
      check: (w) => {
        if (!atChest(w)) return { ok: false, why: 'not_at_chest' };
        if (!w.said.length) return { ok: false, why: 'no_say' };
        const last = w.said[w.said.length - 1].trim();
        if (last !== String(w.layout.diamonds)) return { ok: false, why: 'wrong_count', said: last };
        return { ok: true };
      },
      starter: { en: 'diamonds = 0\n', es: 'diamonds = 0\n', de: 'diamonds = 0\n' },
      solution: 'diamonds = 0\nwhile ahead() != "chest":\n    if ahead() == "diamond":\n        diamonds = diamonds + 1\n    mine()\n    move()\nsay(diamonds)',
      text: {
        en: {
          title: 'Diamond Counter',
          story: 'A villager wants to know how many diamonds 💎 are hidden in this tunnel. But the tunnel is a different length every time!',
          lesson: 'A <b>variable</b> is a box with a name that stores a value: <code>diamonds = 0</code>. You can change it: <code>diamonds = diamonds + 1</code>.<br>A <b>while loop</b> repeats as long as something is true — perfect when you don\'t know how many times. <code>!=</code> means "is not equal to".',
          example: 'count = 0\nwhile count < 3:\n    say(count)\n    count = count + 1',
          goal: 'Stop at the chest and <code>say()</code> how many diamonds you found. Tested on 3 random tunnels.',
          hints: [
            'Keep going <code>while ahead() != "chest":</code> — that way the tunnel length doesn\'t matter.',
            'Inside the loop, before mining: <code>if ahead() == "diamond":</code> add 1 to your variable. After the loop (not indented!) use <code>say(diamonds)</code>.',
          ],
        },
        es: {
          title: 'Contador de diamantes',
          story: 'Un aldeano quiere saber cuántos diamantes 💎 hay escondidos en este túnel. ¡Pero el túnel tiene una longitud distinta cada vez!',
          lesson: 'Una <b>variable</b> es una caja con nombre que guarda un valor: <code>diamonds = 0</code>. Puedes cambiarla: <code>diamonds = diamonds + 1</code>.<br>Un <b>bucle while</b> se repite mientras algo sea cierto — perfecto cuando no sabes cuántas veces. <code>!=</code> significa "no es igual a".',
          example: 'count = 0\nwhile count < 3:\n    say(count)\n    count = count + 1',
          goal: 'Para en el cofre y di con <code>say()</code> cuántos diamantes encontraste. Se prueba en 3 túneles aleatorios.',
          hints: [
            'Sigue <code>while ahead() != "chest":</code> — así da igual lo largo que sea el túnel.',
            'Dentro del bucle, antes de minar: <code>if ahead() == "diamond":</code> suma 1 a tu variable. Después del bucle (¡sin sangrado!) usa <code>say(diamonds)</code>.',
          ],
        },
        de: {
          title: 'Diamantenzähler',
          story: 'Ein Dorfbewohner will wissen, wie viele Diamanten 💎 in diesem Tunnel versteckt sind. Aber der Tunnel ist jedes Mal anders lang!',
          lesson: 'Eine <b>Variable</b> ist eine Kiste mit Namen, die einen Wert speichert: <code>diamonds = 0</code>. Du kannst ihn ändern: <code>diamonds = diamonds + 1</code>.<br>Eine <b>while-Schleife</b> wiederholt, solange etwas stimmt — perfekt, wenn du nicht weißt, wie oft. <code>!=</code> heißt "ist nicht gleich".',
          example: 'count = 0\nwhile count < 3:\n    say(count)\n    count = count + 1',
          goal: 'Halte an der Truhe an und sag mit <code>say()</code>, wie viele Diamanten du gefunden hast. Getestet in 3 Zufallstunneln.',
          hints: [
            'Mach weiter mit <code>while ahead() != "chest":</code> — dann ist die Tunnellänge egal.',
            'In der Schleife, vor dem Abbauen: <code>if ahead() == "diamond":</code> zähl 1 zu deiner Variable dazu. Nach der Schleife (nicht eingerückt!) kommt <code>say(diamonds)</code>.',
          ],
        },
      },
    },

    {
      id: 'py5', concept: 'def', par: 7, tests: 1, boss: true,
      commands: ['move', 'turn_right', 'build', 'for', 'def'],
      layout: () => ({ dir: 'E', startOnTarget: true, rows: [
        'BBBBBBB',
        'BPooooB',
        'Bo...oB',
        'Bo...oB',
        'Bo...oB',
        'BoooooB',
        'BBBBBBB',
      ] }),
      check: (w) => {
        const missing = w.missingTargets();
        return missing ? { ok: false, why: 'missing_planks', n: missing } : { ok: true };
      },
      starter: { en: 'def side():\n    # teach your miner a new command here\n    build()\n\n', es: 'def side():\n    # enseña a tu minero un comando nuevo aquí\n    build()\n\n', de: 'def side():\n    # bring deinem Miner hier einen neuen Befehl bei\n    build()\n\n' },
      solution: 'def side():\n    for i in range(4):\n        build()\n        move()\n    turn_right()\n\nfor i in range(4):\n    side()',
      text: {
        en: {
          title: 'Boss: Build Your Base',
          story: 'Boss level! 🏰 Build the foundation of your base: lay planks on all 16 glowing tiles. Doing it by hand is super long — so first teach your miner a brand-new command.',
          lesson: '<code>def</code> creates <b>your own command</b> (called a <b>function</b>). You write it once and use it as often as you like. The code inside is indented, just like in a loop.',
          example: 'def dig():\n    mine()\n    move()\n\ndig()\ndig()',
          goal: 'Cover every yellow tile with planks. ⭐ Can you do it in 7 lines?',
          hints: [
            'One side of the square = <code>build()</code> and <code>move()</code> 4 times, then <code>turn_right()</code>.',
            'Put that pattern inside <code>def side():</code>. Then call <code>side()</code> 4 times — with a loop, of course.',
          ],
        },
        es: {
          title: 'Jefe: construye tu base',
          story: '¡Nivel jefe! 🏰 Construye los cimientos de tu base: pon tablones en las 16 casillas brillantes. Hacerlo a mano es larguísimo — así que primero enséñale a tu minero un comando nuevo.',
          lesson: '<code>def</code> crea <b>tu propio comando</b> (se llama <b>función</b>). Lo escribes una vez y lo usas tantas veces como quieras. El código de dentro va sangrado, igual que en un bucle.',
          example: 'def dig():\n    mine()\n    move()\n\ndig()\ndig()',
          goal: 'Cubre todas las casillas amarillas con tablones. ⭐ ¿Puedes hacerlo en 7 líneas?',
          hints: [
            'Un lado del cuadrado = <code>build()</code> y <code>move()</code> 4 veces, luego <code>turn_right()</code>.',
            'Mete ese patrón dentro de <code>def side():</code>. Luego llama a <code>side()</code> 4 veces — con un bucle, claro.',
          ],
        },
        de: {
          title: 'Boss: Bau deine Basis',
          story: 'Bosslevel! 🏰 Bau das Fundament deiner Basis: Leg Bretter auf alle 16 leuchtenden Felder. Von Hand dauert das ewig — also bring deinem Miner zuerst einen ganz neuen Befehl bei.',
          lesson: 'Mit <code>def</code> erfindest du <b>deinen eigenen Befehl</b> (das nennt man <b>Funktion</b>). Du schreibst ihn einmal und benutzt ihn so oft du willst. Der Code darin wird eingerückt, genau wie bei einer Schleife.',
          example: 'def dig():\n    mine()\n    move()\n\ndig()\ndig()',
          goal: 'Bedecke alle gelben Felder mit Brettern. ⭐ Schaffst du es in 7 Zeilen?',
          hints: [
            'Eine Seite des Quadrats = 4-mal <code>build()</code> und <code>move()</code>, dann <code>turn_right()</code>.',
            'Pack dieses Muster in <code>def side():</code>. Dann rufst du <code>side()</code> 4-mal auf — natürlich mit einer Schleife.',
          ],
        },
      },
    },
  ];
})();
