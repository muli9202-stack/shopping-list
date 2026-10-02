import json, re, os, unicodedata
OUT='/tmp/claude-0/yt'
P = r"(?:^|[\s\-|:,.(\"'!?/#&+])(?:[ובהלמשכ]{0,2})"   # word start, allowing Hebrew prefixes
def he(*words): return [re.compile(P + w) for w in words]
def en(*words): return [re.compile(r"\b" + w + r"(?:s|es)?\b", re.I) for w in words]

# Dish categories, checked in this order; the first match is the video's main category.
DISH = [
  ('challah', he('חלה(?!ב)', 'חלות') + en('challah')),
  ('cookies', he('עוגיו', 'עוגיי', 'ביסקוטי', 'רוגלך', 'מקרונ(?!י)') + en('cookie', 'cookies', 'biscotti', 'rugelach', 'macaron(?!i)', 'shortbread')),
  ('cakes', he('עוג(?:ה|ת|ות)(?:\\s|$)', 'עוגת', 'עוגות', 'עוגה', 'קאפקייק', 'מאפינס', 'רולדה', 'טורט') + en('cake', 'cheesecake', 'cupcake', 'muffin', 'torte')),
  ('desserts', he('קינוח', 'רולד', 'שוקולד', 'מוס(?:\\s|$)', 'פודינג', 'גלידה', 'טירמיסו', 'מלבי', 'סופלה', 'בראוניז', 'טארט', 'פאי(?:\\s|$)', 'קרם ברולה', 'סופגני', 'דונאטס', 'קרפ(?:\\s|$|ים)', 'ממתק', 'טראפל', 'פבלובה', 'חלבה', 'כדורי שוקולד', 'פחזני', 'אקלר', 'בקלאווה', 'קנאפה') + en('dessert', 'ice cream', 'mousse', 'pudding', 'tiramisu', 'brownie', 'brownies', 'tart', 'pie', 'donut', 'doughnut', 'churro', 'crepe', 'truffle', 'pavlova', 'eclair', 'baklava', 'fudge', 'candy', 'sundae', 'gelato', 'sorbet', 'panna cotta', 'cobbler', 'crumble')),
  ('fish', he('דג(?:\\s|$|ים|י)', 'סלמון', 'טונה', 'אמנון', 'לברק', 'בורי(?:\\s|$)', 'דניס', 'שרימפס', 'סושי', 'חריימה', 'פילה מושט', 'מושט', 'בקלה', 'סרדינ', 'פירות ים', 'קלמרי') + en('fish', 'salmon', 'tuna', 'cod', 'shrimp', 'prawn', 'sushi', 'seafood', 'lobster', 'crab', 'scallop', 'mussel', 'clam', 'halibut', 'branzino', 'sea bass', 'calamari', 'squid', 'octopus', 'anchov', 'sardine', 'trout', 'ceviche')),
  ('chicken', he('עוף', 'עופות', 'פרגי', 'שניצל', 'כנפיים', 'כנפי', 'חזה עוף', 'שוקיים', 'הודו(?:\\s|$)', 'נאגטס', 'כבד עוף') + en('chicken', 'turkey', 'wings', 'schnitzel', 'nugget', 'duck')),
  ('meat', he('בשר', 'בקר(?:\\s|$|ים|י)', 'אסאדו', 'צלע', 'סטייק', 'קציצ', 'המבורגר', 'כבש(?:\\s|$|ים)', 'טלה(?:\\s|$)', 'שווארמה', 'שוארמה', 'קבב', 'צלי(?:\\s|$|ה)', 'סינטה', 'אנטריקוט', 'לשון(?:\\s|$)', 'נקניק', 'פסטרמה', 'ריבס', 'מעורב ירושלמי', 'כבד(?:\\s|$)') + en('steak', 'beef', 'burger', 'lamb', 'pork', 'ribs', 'brisket', 'meatball', 'meat', 'bacon', 'sausage', 'veal', 'prime rib', 'pastrami', 'hot dog', 'bolognese', 'ragu', 'carnitas', 'barbacoa', 'kebab', 'shawarma')),
  ('soups', he('מרק', 'מרקים') + en('soup', 'ramen', 'pho', 'chowder', 'broth', 'bisque', 'gazpacho', 'minestrone')),
  ('salads', he('סלט') + en('salad', 'slaw', 'coleslaw')),
  ('pasta', he('פסטה', 'ספגטי', 'לזניה', 'ניוקי', 'רביולי', 'מקרוני', 'אטריות', 'פטוצ', 'קרבונרה', 'לינגוויני', 'פנה(?:\\s|$)', 'טורטליני', 'אורזו') + en('pasta', 'spaghetti', 'lasagna', 'lasagne', 'gnocchi', 'ravioli', 'noodle', 'fettuccine', 'carbonara', 'linguine', 'penne', 'mac and cheese', 'mac & cheese', 'macaroni', 'tortellini', 'orzo', 'rigatoni', 'pappardelle', 'orecchiette', 'cacio e pepe', 'alfredo', 'udon', 'pad thai', 'lo mein')),
  ('breakfast', he('ארוחת בוקר', 'שקשוקה', 'חביתה', 'פנקייק', 'וופל', 'גרנולה', 'בראנץ', 'ביצים', 'ביצה(?:\\s|$)', 'טוסט') + en('breakfast', 'brunch', 'pancake', 'waffle', 'french toast', 'omelet', 'omelette', 'eggs', 'granola', 'shakshuka', 'frittata', 'quiche', 'benedict', 'oatmeal', 'scrambled')),
  ('stews', he('תבשיל', 'חמין', 'צ\'ולנט', 'צולנט', 'קדרה', 'קארי', 'גולאש', 'מפרום', 'קובה', 'מחשי', 'ממולא') + en('stew', 'curry', 'curries', 'chili', 'goulash', 'cholent', 'braise', 'tagine', 'casserole', 'pot roast', 'dal', 'daal', 'gumbo', 'jambalaya')),
  ('breads', he('לחם', 'פיתה', 'פיתות', 'מאפה', 'מאפים', 'בורקס', 'ג\'חנון', 'מלאווח', 'פוקאצ', 'בצק', 'שמרים', 'צמה', 'צמת', 'שמרי', 'פיצה', 'בייגל', 'קרואסון', 'לחמני', 'בריוש', 'פשטיד', 'קיש(?:\\s|$|ים)', 'לאפה', 'כעכ', 'סמבוס', 'אמפנד', 'מאפינס') + en('bread', 'focaccia', 'bagel', 'croissant', 'buns', 'rolls', 'brioche', 'dough', 'pizza', 'sourdough', 'baguette', 'pita', 'naan', 'tortilla', 'biscuit', 'scone', 'pretzel', 'cinnamon roll', 'empanada', 'calzone', 'flatbread', 'babka', 'danish', 'pastry', 'pastries', 'pastr', 'dumpling')),
  ('dips', he('רוטב', 'ממרח', 'מטבל', 'חומוס', 'טחינה', 'מטבוחה', 'סחוג', 'פסטו', 'ריבה', 'מיונז', 'צזיקי', 'באבא גנוש', 'חציל') + en('sauce', 'dip', 'dressing', 'pesto', 'salsa', 'jam', 'hummus', 'tahini', 'aioli', 'mayo', 'guacamole', 'gravy', 'chutney', 'spread')),
  ('sides', he('תוספת', 'אורז', 'תפוחי אדמה', 'תפוח אדמה', 'פירה', 'קוסקוס', 'פתיתים', 'צ\'יפס', 'קינואה', 'ירקות', 'גראטן', 'קוגל', 'בטטה', 'כרובית', 'ברוקולי', 'מג\'דרה', 'לביבות', 'שעועית', 'פטריות') + en('rice', 'potato', 'potatoes', 'fries', 'quinoa', 'vegetable', 'side dish', 'sides', 'gratin', 'kugel', 'risotto', 'couscous', 'cauliflower', 'broccoli', 'mushroom', 'beans', 'latke', 'stuffing', 'corn', 'carrots', 'brussels', 'eggplant', 'zucchini', 'asparagus')),
]
THEMES = [
  ('holiday', he('פסח', 'ראש השנה', 'ראש-השנה', 'סוכות', 'חנוכה', 'פורים', 'שבועות', 'חג(?:\\s|$|ים|י)', 'ליל הסדר', 'סדר פסח', 'יום כיפור', 'ט"ו בשבט', 'טו בשבט', 'ל"ג בעומר') + en('passover', 'pesach', 'rosh hashana', 'hanukkah', 'chanukah', 'purim', 'shavuot', 'sukkot', 'yom kippur', 'thanksgiving', 'christmas', 'holiday', 'easter', 'seder', 'new year')),
  ('shabbat', he('שבת', 'שבתות', 'סעודת') + en('shabbat', 'shabbos', 'sabbath', 'friday night')),
  ('quick', he('מהיר', 'מהירה', 'מהירים', 'מהירות', 'בקלות', 'קל(?:\\s|$|ה|ים)', 'פשוט', '\\d+ דקות', 'דקות') + en('quick', 'easy', '\\d+[- ]?minute (?:meal|recipe|dinner|lunch|breakfast|dessert)', 'in \\d+ minute', 'simple', 'weeknight', 'one[- ]pan', 'one[- ]pot')),
  ('veggie', he('טבעוני', 'צמחוני', 'טופו', 'ללא בשר') + en('vegan', 'vegetarian', 'tofu', 'plant[- ]based', 'meatless')),
  ('kids', he('ילדים', 'לילדים') + en('kids', 'kid-friendly', 'children')),
]

def norm(t):
    t = re.sub(r'[֑-ׇ]', '', t)
    return ' ' + t.replace('״', '"').replace('׳', "'") + ' '

def classify(title):
    t = norm(title)
    main = next((cid for cid, pats in DISH if any(p.search(t) for p in pats)), None)
    themes = [cid for cid, pats in THEMES if any(p.search(t) for p in pats)]
    if not main:
        main = themes.pop(0) if themes else 'other'
    return main, themes

SKIP = re.compile(r'#shorts|\bshorts\b|trailer|טריילר|live stream|livestream|q&a|giveaway|הגרלה|announcement|channel update|vlog|podcast|reacts?\b|reaction|kitchen nightmares|hotel hell|hells? kitchen|full episode|compilation|rabbi|jewish learning|parshat|פרשת|פרשה', re.I)

chefs = json.load(open(OUT + '/chefs.json'))
result = {}
stats = {}
for c in chefs:
    f = f"{OUT}/{c['id']}.json"
    if not os.path.exists(f): continue
    vids = json.load(open(f))
    rows = []
    for v in vids:
        title = v['t'].strip()
        if SKIP.search(title): continue
        main, themes = classify(title)
        row = [v['id'], title, main] + ([themes] if themes else [])
        rows.append(row)
        stats[main] = stats.get(main, 0) + 1
    result[c['id']] = rows
json.dump(result, open('/home/user/shopping-list/kitchen/src/seedVideos.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print({k: len(v) for k, v in result.items()})
print(sorted(stats.items(), key=lambda x: -x[1]))
print(os.path.getsize('/home/user/shopping-list/kitchen/src/seedVideos.json') // 1024, 'KiB')
