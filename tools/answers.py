A = {
'1.0': "DESCRIBE mobs", '3.0': "DESCRIBE hunts", '6.0': "DESCRIBE players", '7.0': "DESCRIBE chest_log",
'1.1': "SELECT * FROM mobs", '1.2': "SELECT name, health FROM mobs", '1.3': "SELECT name, health FROM mobs ORDER BY health DESC",
'1.4': "SELECT name, health FROM mobs ORDER BY health DESC LIMIT 3", '1.5': "SELECT DISTINCT home FROM mobs",
'1.6': "SELECT name, damage * 3 AS three_hits FROM mobs",
'2.1': "SELECT * FROM mobs WHERE type = 'hostile'", '2.2': "SELECT name FROM mobs WHERE health > 20",
'2.3': "SELECT name FROM mobs WHERE type = 'hostile' AND home = 'overworld'", '2.4': "SELECT name, home FROM mobs WHERE home = 'nether' OR home = 'end'",
'2.5': "SELECT name, loot FROM mobs WHERE loot IN ('bone', 'string', 'gunpowder')", '2.6': "SELECT name, health FROM mobs WHERE health BETWEEN 10 AND 20",
'2.7': "SELECT name FROM mobs WHERE name LIKE '%skeleton%'", '2.8': "SELECT name FROM mobs WHERE loot IS NULL",
'3.1': "SELECT * FROM hunts WHERE day = 1", '3.2': "SELECT COUNT(*) FROM hunts", '3.3': "SELECT SUM(xp) FROM hunts",
'3.4': "SELECT ROUND(AVG(xp), 1) FROM hunts", '3.5': "SELECT MAX(xp), MIN(xp) FROM hunts", '3.6': "SELECT COUNT(DISTINCT player_id) FROM hunts",
'3.7': "SELECT SUM(xp) FROM hunts WHERE biome = 'nether'",
'4.1': "SELECT biome, COUNT(*) FROM hunts GROUP BY biome", '4.2': "SELECT player_id, SUM(xp) AS total FROM hunts GROUP BY player_id ORDER BY total DESC",
'4.3': "SELECT player_id, biome, COUNT(*) FROM hunts GROUP BY player_id, biome", '4.4': "SELECT day, COUNT(*) FROM hunts GROUP BY day HAVING COUNT(*) > 6",
'4.5': "SELECT player_id, SUM(xp) FROM hunts WHERE biome = 'nether' GROUP BY player_id HAVING SUM(xp) > 30",
'5.1': "SELECT name, CASE WHEN damage > 10 THEN 'danger' ELSE 'safe' END FROM mobs",
'5.2': "SELECT name, CASE WHEN damage >= 20 THEN 'boss' WHEN damage >= 5 THEN 'fighter' ELSE 'harmless' END FROM mobs",
'5.3': "SELECT UPPER(name), LENGTH(name) FROM mobs", '5.4': "SELECT name || ' lives in the ' || home FROM mobs",
'5.5': "SELECT CASE WHEN xp >= 10 THEN 'big' ELSE 'small' END AS size, COUNT(*) FROM hunts GROUP BY size",
'6.1': "SELECT hunts.day, mobs.name FROM hunts JOIN mobs ON hunts.mob_id = mobs.id",
'6.2': "SELECT p.name, h.xp FROM hunts h JOIN players p ON h.player_id = p.id",
'6.3': "SELECT p.name, SUM(h.xp) AS total FROM hunts h JOIN players p ON h.player_id = p.id GROUP BY p.name ORDER BY total DESC",
'6.4': "SELECT m.name, i.value FROM mobs m JOIN items i ON m.loot = i.name",
'6.5': "SELECT p.name FROM players p LEFT JOIN hunts h ON p.id = h.player_id WHERE h.id IS NULL",
'6.6': "SELECT p.name, COUNT(*) FROM hunts h JOIN players p ON h.player_id = p.id JOIN mobs m ON h.mob_id = m.id WHERE m.type = 'hostile' GROUP BY p.name ORDER BY COUNT(*) DESC",
'7.1': "SELECT * FROM chest_log WHERE item = 'diamond' ORDER BY day, hour",
'7.2': "SELECT p.name, c.hour FROM chest_log c JOIN players p ON c.player_id = p.id WHERE c.day = 9 AND c.hour >= 20",
'7.3': "SELECT p.name, t.day, t.amount * i.value AS emeralds FROM trades t JOIN players p ON t.player_id = p.id JOIN items i ON t.item = i.name WHERE t.item = 'diamond'",
'7.4': "SELECT p.name, SUM(t.amount) FROM trades t JOIN players p ON t.player_id = p.id WHERE t.item = 'diamond' AND t.day > 9 GROUP BY p.name",
'7.5': "SELECT name FROM players WHERE id IN (SELECT player_id FROM chest_log WHERE day = 9 AND hour >= 20) AND id IN (SELECT player_id FROM trades WHERE item = 'diamond' AND day > 9)",
'7.6': "WITH suspects AS (SELECT player_id FROM chest_log WHERE day = 9 AND hour >= 20), sold AS (SELECT player_id, SUM(amount) AS diamonds FROM trades WHERE item = 'diamond' AND day > 9 GROUP BY player_id) SELECT p.name, s.diamonds FROM players p JOIN suspects su ON su.player_id = p.id JOIN sold s ON s.player_id = p.id",
'8.1': "SELECT name, health, RANK() OVER (ORDER BY health DESC) FROM mobs",
'8.2': "SELECT name, type, damage, RANK() OVER (PARTITION BY type ORDER BY damage DESC) FROM mobs",
'8.3': "WITH d AS (SELECT day, SUM(xp) AS xp FROM hunts GROUP BY day) SELECT day, xp, SUM(xp) OVER (ORDER BY day) FROM d",
'8.4': "WITH t AS (SELECT p.name, SUM(h.xp) AS total FROM hunts h JOIN players p ON h.player_id = p.id GROUP BY p.name) SELECT name, total, RANK() OVER (ORDER BY total DESC) FROM t",
}
if __name__ == '__main__':
    import sqlite3, json, re
    db = json.loads(re.search(r'window\.SQL_DB_SQL = (".*");', open(__import__('os').path.join(__import__('os').path.dirname(__file__), '..', 'js', 'sql-data.js')).read()).group(1))
    c = sqlite3.connect(':memory:'); c.executescript(db)
    import re as _re
    def run(q):  # the site translates DESCRIBE, SQLite doesn't have it
        m = _re.match(r'^\s*describe\s+(\w+)', q, _re.I)
        return c.execute(f"SELECT name, type FROM pragma_table_info('{m.group(1)}')" if m else q).fetchall()
    for k, q in A.items():
        rows = run(q)
        show = rows if len(rows) <= 8 else rows[:6] + ['…']
        print(f"{k} [{len(rows):>2}] {show}")
