// Runs the kid's Python in a Web Worker (via Pyodide) so an endless loop
// can be killed without freezing the page. The world simulation runs here
// synchronously so sensors like ahead() see the real state; the page then
// replays the recorded actions as an animation.
importScripts('https://cdn.jsdelivr.net/npm/pyodide@0.26.4/pyodide.js');
importScripts('world.js?v=32');

const MAX_STEPS = 3000;
let py = null;
let world, actions, steps;

function act(name, arg) {
  steps++;
  if (steps > MAX_STEPS) return 'FATAL:steps';
  const r = world.do(name, arg == null ? undefined : arg);
  actions.push({ a: name, arg: arg == null ? undefined : String(arg), note: r.note });
  if (r.fatal) {
    actions.push({ a: 'fatal', arg: r.fatal });
    return 'FATAL:' + r.fatal;
  }
  return r.value || '';
}

const PRELUDE = `
from game import act as _act
import traceback

class GameStop(Exception):
    pass

def _do(name, arg=None):
    r = _act(name, arg)
    if r and r.startswith("FATAL"):
        raise GameStop(r[6:])
    return r

def move(): _do("move")
def turn_left(): _do("turn_left")
def turn_right(): _do("turn_right")
def mine(): return _do("mine")
def place(): _do("place")
def build(): _do("build")
def ahead(): return _do("ahead")
def say(message): _do("say", str(message))

_COMMANDS = dict(move=move, turn_left=turn_left, turn_right=turn_right, mine=mine,
                 place=place, build=build, ahead=ahead, say=say)

def _line(e):
    ln = None
    for fr in traceback.extract_tb(e.__traceback__):
        if fr.filename == "main.py":
            ln = fr.lineno
    return ln

def _run(src):
    g = {"__name__": "__main__"}
    g.update(_COMMANDS)
    try:
        exec(compile(src, "main.py", "exec"), g)
        return None
    except SyntaxError as e:
        return [type(e).__name__, str(e.msg), e.lineno]
    except BaseException as e:
        return [type(e).__name__, str(e), _line(e)]
`;

async function init() {
  py = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/npm/pyodide@0.26.4/' });
  py.registerJsModule('game', { act });
  await py.runPythonAsync(PRELUDE);
  postMessage({ type: 'ready' });
}

onmessage = (ev) => {
  const { code, layouts, id } = ev.data;
  const run = py.globals.get('_run');
  const results = layouts.map((layout) => {
    world = new World(layout);
    actions = [];
    steps = 0;
    const prints = [];
    py.setStdout({ batched: (s) => prints.push(s) });
    const res = run(code);
    let error = null;
    if (res) {
      const [kind, msg, line] = res.toJs();
      res.destroy();
      error = { kind, msg, line: line == null ? null : line };
    }
    return { actions, prints, error };
  });
  run.destroy();
  postMessage({ type: 'result', id, results });
};

init().catch((e) => postMessage({ type: 'loadError', msg: String(e) }));
