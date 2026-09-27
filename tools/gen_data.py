"""Generate the CodeCraft SQL world as js/sql-data.js (deterministic)."""
import json, random, sqlite3, sys

random.seed(11)

MOBS = [  # id, name, type, health, damage, home, loot (None = drops nothing)
 (1,'Creeper','hostile',20,43,'overworld','gunpowder'), (2,'Zombie','hostile',20,3,'overworld','rotten_flesh'),
 (3,'Skeleton','hostile',20,4,'overworld','bone'), (4,'Spider','hostile',16,2,'overworld','string'),
 (5,'Enderman','neutral',40,7,'end','ender_pearl'), (6,'Blaze','hostile',20,6,'nether','blaze_rod'),
 (7,'Ghast','hostile',10,17,'nether','ghast_tear'), (8,'Wither Skeleton','hostile',20,8,'nether','coal'),
 (9,'Slime','hostile',16,4,'overworld','slimeball'), (10,'Warden','hostile',500,30,'caves','sculk_catalyst'),
 (11,'Iron Golem','neutral',100,21,'overworld','iron_ingot'), (12,'Wolf','neutral',8,4,'overworld',None),
 (13,'Bee','neutral',10,2,'overworld',None), (14,'Pig','passive',10,0,'overworld','porkchop'),
 (15,'Cow','passive',10,0,'overworld','beef'), (16,'Sheep','passive',8,0,'overworld','wool'),
 (17,'Chicken','passive',4,0,'overworld','feather'), (18,'Villager','passive',20,0,'overworld',None),
 (19,'Axolotl','passive',14,2,'caves',None), (20,'Fox','passive',10,2,'overworld',None),
]
ITEMS = [  # id, name, rarity, value (emeralds), used_for
 (1,'gunpowder','common',3,'TNT'), (2,'rotten_flesh','common',1,'feeding wolves'), (3,'bone','common',2,'bone meal'),
 (4,'string','common',2,'bows'), (5,'ender_pearl','rare',12,'teleporting'), (6,'blaze_rod','rare',15,'potions'),
 (7,'ghast_tear','epic',20,'regeneration'), (8,'coal','common',1,'torches'), (9,'slimeball','uncommon',5,'sticky pistons'),
 (10,'sculk_catalyst','epic',30,'sculk'), (11,'iron_ingot','uncommon',6,'tools'), (12,'porkchop','common',2,'food'),
 (13,'beef','common',2,'food'), (14,'wool','common',1,'beds'), (15,'feather','common',1,'arrows'), (16,'diamond','epic',25,'best tools'),
]
PLAYERS = [  # id, name, village, rank, joined_day
 (1,'Alex','Oakridge','iron',1), (2,'Steve','Oakridge','gold',1), (3,'Luna','Sandpeak','diamond',2),
 (4,'Kai','Frostvale','stone',3), (5,'Nova','Sandpeak','iron',5), (6,'Rio','Frostvale','wood',8), (7,'Mia','Oakridge','wood',13),
]

# ---- hunts: which mobs each player likes, where each mob lives, xp per kill
BIOME = {1:'plains',2:'plains',3:'forest',4:'forest',5:'end',6:'nether',7:'nether',8:'nether',9:'swamp',10:'caves',
         12:'forest',13:'plains',14:'plains',15:'plains',16:'plains',17:'plains',20:'forest'}
XP = {1:(5,8),2:(4,6),3:(4,7),4:(3,6),5:(8,12),6:(9,14),7:(10,15),8:(11,16),9:(2,4),10:(40,60),
      12:(2,4),13:(1,3),14:(1,3),15:(1,3),16:(1,3),17:(1,2),20:(2,4)}
LIKES = {1:[1,2,3,4,14,15], 2:[2,3,4,16,17,9], 3:[6,7,8,5,3], 4:[2,3,4,9,12], 5:[6,8,5,1,3], 6:[14,15,16,17,2]}
PER_DAY = [4,5,3,6,5,8,4,6,7,5,4,6,8,5]
hunts, hid = [], 1
for day, n in enumerate(PER_DAY, start=1):
    who = [p for p in LIKES if PLAYERS[p-1][4] <= day]
    for _ in range(n):
        p = random.choice(who)
        m = random.choice(LIKES[p])
        lo, hi = XP[m]
        hunts.append((hid, day, p, m, BIOME[m], random.randint(0, 3), random.randint(lo, hi)))
        hid += 1
# one legendary hunt: Luna vs the Warden
hunts.append((hid, 11, 3, 10, 'caves', 1, 55)); hid += 1

# ---- the mystery: 12 diamonds put in the chest on day 8, 2 taken (logged) by Luna, 10 vanish on night 9
CHEST = [  # id, day, hour, player_id, action, item, amount
 (1,2,9,1,'put','wool',10), (2,3,14,2,'put','bone',6), (3,4,11,4,'take','wool',3), (4,5,16,5,'put','gunpowder',8),
 (5,6,10,3,'put','blaze_rod',4), (6,7,13,1,'take','bone',2), (7,8,18,2,'put','diamond',12), (8,8,20,4,'open',None,None),
 (9,9,8,1,'open',None,None), (10,9,10,3,'take','diamond',2), (11,9,15,2,'open',None,None), (12,9,21,4,'open',None,None),
 (13,9,22,5,'open',None,None), (14,9,23,6,'open',None,None), (15,10,7,1,'open',None,None), (16,11,12,5,'put','string',5),
 (17,12,9,3,'take','blaze_rod',1), (18,13,17,6,'put','wool',2),
]
TRADES = [  # id, day, player_id, item, amount
 (1,2,1,'wool',6), (2,3,2,'bone',5), (3,4,4,'string',4), (4,5,3,'blaze_rod',3), (5,6,5,'gunpowder',7),
 (6,7,5,'diamond',2), (7,7,2,'feather',9), (8,8,1,'beef',4), (9,10,3,'diamond',2), (10,10,6,'diamond',4),
 (11,11,4,'rotten_flesh',8), (12,11,5,'ender_pearl',2), (13,12,6,'diamond',6), (14,12,2,'string',3), (15,13,1,'porkchop',5),
 (16,14,3,'ghast_tear',1),
]

SCHEMA = {
 'mobs': (['id INTEGER','name TEXT','type TEXT','health INTEGER','damage INTEGER','home TEXT','loot TEXT'], MOBS),
 'items': (['id INTEGER','name TEXT','rarity TEXT','value INTEGER','used_for TEXT'], ITEMS),
 'players': (['id INTEGER','name TEXT','village TEXT','rank TEXT','joined_day INTEGER'], PLAYERS),
 'hunts': (['id INTEGER','day INTEGER','player_id INTEGER','mob_id INTEGER','biome TEXT','loot_count INTEGER','xp INTEGER'], hunts),
 'chest_log': (['id INTEGER','day INTEGER','hour INTEGER','player_id INTEGER','action TEXT','item TEXT','amount INTEGER'], CHEST),
 'trades': (['id INTEGER','day INTEGER','player_id INTEGER','item TEXT','amount INTEGER'], TRADES),
}

def lit(v):
    return 'NULL' if v is None else str(v) if isinstance(v, int) else "'" + v.replace("'", "''") + "'"

sql = []
for t, (cols, rows) in SCHEMA.items():
    sql.append(f"CREATE TABLE {t} ({', '.join(c + (' PRIMARY KEY' if c.startswith('id ') else '') for c in cols)});")
    sql += [f"INSERT INTO {t} VALUES ({', '.join(lit(v) for v in r)});" for r in rows]
db_sql = '\n'.join(sql)

if len(sys.argv) > 1:
    out = sys.argv[1]
    with open(out, 'w') as f:
        f.write('// Generated by gen_data.py — the CodeCraft SQL world. Do not edit by hand.\n(function () {\n')
        f.write('  window.SQL_SCHEMA = ' + json.dumps({t: [c.split() for c in cols] for t, (cols, _) in SCHEMA.items()}) + ';\n')
        f.write('  window.MOBS = ' + json.dumps([dict(zip(['id','name','type','health','damage','home','loot'], m)) for m in MOBS]) + ';\n')
        f.write('  window.ITEMS = ' + json.dumps([dict(zip(['id','name','rarity','value','used_for'], i)) for i in ITEMS]) + ';\n')
        f.write('  window.SQL_DB_SQL = ' + json.dumps(db_sql) + ';\n})();\n')
    print('wrote', out, len(hunts), 'hunts')

conn = sqlite3.connect(':memory:'); conn.executescript(db_sql)
print('sqlite', sqlite3.sqlite_version, '| hunts', len(hunts), '| hunts per day', [sum(1 for h in hunts if h[1]==d) for d in range(1,15)])
