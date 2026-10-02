import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { byRating, inCategory, useAllRecipes, useAllVideos, useStore } from './store';
import { isHeading, matchScore, parseDescription } from './text';
import type { Chef, CollectionKey, Recipe, Video } from './types';
import { IS_ARTIFACT } from './env';
import { fetchSnippet, fetchTitle, thumbUrl, watchUrl, youtubeId } from './youtube';
import { CollectionButtons, Empty, Header, Modal, SearchBar, Stars, Thumb, confirmDelete, useUi } from './ui';

export type Mode = 'videos' | 'recipes';
const MODE_TITLE: Record<Mode, string> = { videos: 'הסרטונים שלי', recipes: 'מתכונים' };
const MODE_TONE: Record<Mode, string> = { videos: '#e11d48', recipes: '#16a34a' };

const AVATAR_TONES = ['#e11d48', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777'];
const toneOf = (s: string) => AVATAR_TONES[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_TONES.length];
const initials = (name: string) =>
  name
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const PLATFORM_LABEL = { youtube: 'YouTube', tiktok: 'TikTok', other: 'קישור' } as const;

const PAGE = 60;

function MoreButton({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (shown >= total) return null;
  return (
    <button className="btn ghost full" onClick={onMore}>
      הצג עוד ({total - shown} נוספים)
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                                */
/* ------------------------------------------------------------------ */

function VideoCard({ v, showChef }: { v: Video; showChef?: boolean }) {
  const play = useUi((s) => s.play);
  const update = useStore((s) => s.updateVideo);
  const chef = useStore((s) => s.chefs.find((c) => c.id === v.chefId));
  const icon = useStore((s) => s.categories.find((c) => c.id === v.categoryId)?.icon);
  const [editing, setEditing] = useState(false);
  return (
    <article className="card media-card">
      <button className="media-thumb" onClick={() => play(v)} aria-label={`ניגון ${v.title}`}>
        <Thumb id={v.youtubeId} alt={v.title} icon={icon} />
        <span className="play-badge">▶</span>
      </button>
      <div className="media-body">
        <h3 onClick={() => play(v)}>{v.title}</h3>
        {showChef && <span className="muted small">{chef?.name}</span>}
        <div className="row between">
          <Stars value={v.rating} onChange={(rating) => update(v.id, { rating })} />
          <button className="icon-btn" aria-label="עריכה" onClick={() => setEditing(true)}>
            ✎
          </button>
        </div>
        <CollectionButtons kind="video" id={v.id} />
      </div>
      {editing && <EditVideoModal v={v} onClose={() => setEditing(false)} />}
    </article>
  );
}

function EditVideoModal({ v, onClose }: { v: Video; onClose: () => void }) {
  const update = useStore((s) => s.updateVideo);
  const remove = useStore((s) => s.deleteVideo);
  const categories = useStore((s) => s.categories);
  const nav = useNavigate();
  const [title, setTitle] = useState(v.title);
  const [cat, setCat] = useState(v.categoryId);
  return (
    <Modal title="עריכת סרטון" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          update(v.id, { title: title.trim() || v.title, categoryId: cat, ...(cat !== v.categoryId ? { extraCategoryIds: [] } : {}) });
          onClose();
        }}
      >
        <label>
          שם המנה
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          קטגוריה
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="row gap wrap">
          <button className="btn">שמירה</button>
          <button type="button" className="btn ghost" onClick={() => nav(`/recipes/${v.chefId}/${v.categoryId}/new?yt=${v.youtubeId}`)}>
            📖 יצירת מתכון מהסרטון
          </button>
          <button type="button" className="btn danger" onClick={() => void confirmDelete(`הסרטון "${v.title}"`).then((ok) => ok && (remove(v.id), onClose()))}>
            מחיקה
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RecipeCard({ r, showChef }: { r: Recipe; showChef?: boolean }) {
  const nav = useNavigate();
  const update = useStore((s) => s.updateRecipe);
  const chef = useStore((s) => s.chefs.find((c) => c.id === r.chefId));
  const open = () => nav(`/recipe/${r.id}`);
  return (
    <article className="card media-card">
      <button className="media-thumb" onClick={open} aria-label={r.title}>
        <Thumb id={r.youtubeId} alt={r.title} />
        {r.missing && <span className="missing-badge">חסר</span>}
      </button>
      <div className="media-body">
        <h3 onClick={open}>{r.title}</h3>
        {showChef && <span className="muted small">{chef?.name}</span>}
        <Stars value={r.rating} onChange={(rating) => update(r.id, { rating })} />
        <CollectionButtons kind="recipe" id={r.id} />
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Chefs                                                                */
/* ------------------------------------------------------------------ */

function ChefModal({ chef, onClose }: { chef?: Chef; onClose: () => void }) {
  const add = useStore((s) => s.addChef);
  const update = useStore((s) => s.updateChef);
  const remove = useStore((s) => s.deleteChef);
  const [name, setName] = useState(chef?.name ?? '');
  const [url, setUrl] = useState(chef?.url ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (chef) update(chef.id, { name: name.trim(), url: url.trim() });
    else add(name.trim(), url.trim());
    onClose();
  };
  return (
    <Modal title={chef ? 'עריכת שף' : 'הוספת שף'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          שם השף / הערוץ
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label>
          קישור לערוץ (יוטיוב או טיקטוק)
          <input className="input" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/@..." />
        </label>
        <div className="row gap wrap">
          <button className="btn" disabled={!name.trim()}>
            שמירה
          </button>
          {chef && (
            <button
              type="button"
              className="btn danger"
              onClick={() => void confirmDelete(`השף "${chef.name}" וכל הסרטונים והמתכונים שלו`).then((ok) => ok && (remove(chef.id), onClose()))}
            >
              מחיקת שף
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function CollectionTiles() {
  const c = useStore((s) => s.collections);
  return (
    <div className="tile-grid two">
      <Link to="/collection/shabbat" className="big-tile small t-shabbat">
        <span className="emoji">🕯️</span>
        <span>שבת</span>
        <span className="muted-light">{c.shabbat.length} פריטים</span>
      </Link>
      <Link to="/collection/chag" className="big-tile small t-chag">
        <span className="emoji">🍷</span>
        <span>חג</span>
        <span className="muted-light">{c.chag.length} פריטים</span>
      </Link>
    </div>
  );
}

function useSearch(mode: Mode, q: string) {
  const videos = useAllVideos();
  const recipes = useAllRecipes();
  const chefs = useStore((s) => s.chefs);
  return useMemo(() => {
    if (!q.trim()) return null;
    const chefName = new Map(chefs.map((c) => [c.id, c.name]));
    if (mode === 'videos') {
      const ingByYt = new Map(recipes.map((r) => [r.youtubeId, r.ingredients.join(' ')]));
      return videos
        .map((v) => ({ v, score: matchScore(q, `${v.title} ${chefName.get(v.chefId) ?? ''} ${ingByYt.get(v.youtubeId) ?? ''}`) }))
        .filter((x) => x.score)
        .sort((a, b) => b.v.rating - a.v.rating || b.score - a.score)
        .map((x) => ({ kind: 'video' as const, item: x.v }));
    }
    return recipes
      .map((r) => ({ r, score: matchScore(q, `${r.title} ${chefName.get(r.chefId) ?? ''} ${r.ingredients.join(' ')}`) }))
      .filter((x) => x.score)
      .sort((a, b) => b.r.rating - a.r.rating || b.score - a.score)
      .map((x) => ({ kind: 'recipe' as const, item: x.r }));
  }, [mode, q, videos, recipes, chefs]);
}

export function ChefsScreen({ mode }: { mode: Mode }) {
  const chefs = useStore((s) => s.chefs);
  const videos = useAllVideos();
  const recipes = useAllRecipes();
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<Chef | 'new' | null>(null);
  const [shown, setShown] = useState(PAGE);
  const results = useSearch(mode, q);
  useEffect(() => setShown(PAGE), [q]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of mode === 'videos' ? videos : recipes) m.set(x.chefId, (m.get(x.chefId) ?? 0) + 1);
    return m;
  }, [mode, videos, recipes]);

  return (
    <div className="page" style={{ '--tone': MODE_TONE[mode] } as React.CSSProperties}>
      <Header title={MODE_TITLE[mode]} back="/" tone={MODE_TONE[mode]} />
      <SearchBar value={q} onChange={setQ} placeholder="חיפוש לפי שם מנה, שף או מצרך" />
      {results ? (
        results.length ? (
          <>
            <p className="muted small">{results.length} תוצאות</p>
            <div className="media-grid">
              {results.slice(0, shown).map((x) =>
                x.kind === 'video' ? <VideoCard key={x.item.id} v={x.item} showChef /> : <RecipeCard key={x.item.id} r={x.item} showChef />,
              )}
            </div>
            <MoreButton shown={shown} total={results.length} onMore={() => setShown((n) => n + PAGE)} />
          </>
        ) : (
          <Empty>לא נמצאו תוצאות ל"{q}"</Empty>
        )
      ) : (
        <>
          <CollectionTiles />
          <div className="row between section-head">
            <h2>שפים ({chefs.length})</h2>
            <button className="btn" onClick={() => setModal('new')}>
              + הוספת שף
            </button>
          </div>
          <div className="chef-grid">
            {chefs.map((c) => (
              <div key={c.id} className="chef-tile">
                <Link to={`/${mode}/${c.id}`} className="chef-main">
                  <span className="avatar" style={{ background: toneOf(c.name) }}>
                    {initials(c.name)}
                  </span>
                  <strong>{c.name}</strong>
                  {c.note && <span className="muted small">{c.note}</span>}
                  <span className="muted small">
                    {counts.get(c.id) ?? 0} {mode === 'videos' ? 'סרטונים' : 'מתכונים'}
                  </span>
                </Link>
                <div className="chef-foot">
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer" className={`plat ${c.platform}`}>
                      {PLATFORM_LABEL[c.platform]} ↗
                    </a>
                  ) : (
                    <span />
                  )}
                  <button className="icon-btn" aria-label="עריכת שף" onClick={() => setModal(c)}>
                    ✎
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {modal && <ChefModal chef={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Categories                                                           */
/* ------------------------------------------------------------------ */

function CategoryModal({ id, onClose }: { id?: string; onClose: () => void }) {
  const cat = useStore((s) => s.categories.find((c) => c.id === id));
  const add = useStore((s) => s.addCategory);
  const update = useStore((s) => s.updateCategory);
  const remove = useStore((s) => s.deleteCategory);
  const [name, setName] = useState(cat?.name ?? '');
  const [icon, setIcon] = useState(cat?.icon ?? '🍽️');
  return (
    <Modal title={cat ? 'עריכת קטגוריה' : 'הוספת קטגוריה'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          if (cat) update(cat.id, { name: name.trim(), icon: icon.trim() || '🍽️' });
          else add(name.trim(), icon.trim());
          onClose();
        }}
      >
        <label>
          שם הקטגוריה
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label>
          אימוג׳י
          <input className="input" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
        </label>
        <p className="muted small">הקטגוריות משותפות לכל השפים, גם בסרטונים וגם במתכונים.</p>
        <div className="row gap wrap">
          <button className="btn" disabled={!name.trim()}>
            שמירה
          </button>
          {cat && (
            <button
              type="button"
              className="btn danger"
              onClick={() => void confirmDelete(`הקטגוריה "${cat.name}" וכל הסרטונים והמתכונים שבה (אצל כל השפים)`).then((ok) => ok && (remove(cat.id), onClose()))}
            >
              מחיקה
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export function CategoriesScreen({ mode }: { mode: Mode }) {
  const { chefId = '' } = useParams();
  const chef = useStore((s) => s.chefs.find((c) => c.id === chefId));
  const categories = useStore((s) => s.categories);
  const videos = useAllVideos();
  const recipes = useAllRecipes();
  const [modal, setModal] = useState<string | 'new' | null>(null);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of mode === 'videos' ? videos : recipes) {
      if (x.chefId !== chefId) continue;
      const cats = 'extraCategoryIds' in x && x.extraCategoryIds ? [x.categoryId, ...x.extraCategoryIds] : [x.categoryId];
      for (const c of cats) m.set(c, (m.get(c) ?? 0) + 1);
    }
    return m;
  }, [mode, videos, recipes, chefId]);
  if (!chef) return <NotFound />;
  return (
    <div className="page">
      <Header title={chef.name} back={`/${mode}`} tone={MODE_TONE[mode]} />
      <div className="row between section-head">
        <span className="muted">{MODE_TITLE[mode]} · בחרו קטגוריה</span>
        {chef.url && (
          <a href={chef.url} target="_blank" rel="noreferrer" className={`plat ${chef.platform}`}>
            לערוץ ב-{PLATFORM_LABEL[chef.platform]} ↗
          </a>
        )}
      </div>
      <div className="cat-grid">
        {categories.map((c) => (
          <div key={c.id} className="cat-tile">
            <Link to={`/${mode}/${chefId}/${c.id}`} className="cat-main">
              <span className="emoji">{c.icon}</span>
              <strong>{c.name}</strong>
              <span className="muted small">{counts.get(c.id) ?? 0}</span>
            </Link>
            <button className="icon-btn corner" aria-label="עריכת קטגוריה" onClick={() => setModal(c.id)}>
              ✎
            </button>
          </div>
        ))}
        <button className="cat-tile add-tile" onClick={() => setModal('new')}>
          <span className="emoji">＋</span>
          <strong>הוספת קטגוריה</strong>
        </button>
      </div>
      {modal && <CategoryModal id={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Category content                                                     */
/* ------------------------------------------------------------------ */

function AddVideosModal({ chefId, categoryId, onClose }: { chefId: string; categoryId: string; onClose: () => void }) {
  const addVideo = useStore((s) => s.addVideo);
  const existing = useAllVideos();
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string[]>([]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const lines = text.split(/[\s]+/).filter(Boolean);
    if (!lines.length) return;
    setBusy(true);
    const out: string[] = [];
    for (const line of lines) {
      const id = youtubeId(line);
      if (!id) {
        out.push(`✗ לא קישור יוטיוב: ${line}`);
        continue;
      }
      if (existing.some((v) => v.youtubeId === id && v.chefId === chefId && v.categoryId === categoryId)) {
        out.push(`• כבר קיים: ${line}`);
        continue;
      }
      const typed = lines.length === 1 ? name.trim() : '';
      const title = typed || (await fetchTitle(id)) || 'סרטון ללא שם';
      addVideo({ chefId, categoryId, youtubeId: id, url: watchUrl(id), title });
      out.push(`✓ ${title}`);
    }
    setBusy(false);
    setReport(out);
    setText('');
    setName('');
    if (out.every((l) => l.startsWith('✓'))) onClose();
  };

  return (
    <Modal title="הוספת סרטון" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          הדביקו קישור ליוטיוב (אפשר כמה קישורים, אחד בכל שורה)
          <textarea className="input" dir="ltr" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" autoFocus />
        </label>
        <label>
          שם המנה (לא חובה — אם ריק, השם נמשך מיוטיוב)
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל בשר מתוק" />
        </label>
        <button className="btn" disabled={busy || !text.trim()}>
          {busy ? 'מוסיף…' : 'הוספה'}
        </button>
        {report.length > 0 && (
          <ul className="report">
            {report.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </form>
    </Modal>
  );
}

export function CategoryScreen({ mode }: { mode: Mode }) {
  const { chefId = '', catId = '' } = useParams();
  const chef = useStore((s) => s.chefs.find((c) => c.id === chefId));
  const cat = useStore((s) => s.categories.find((c) => c.id === catId));
  const videos = useAllVideos();
  const recipes = useAllRecipes();
  const nav = useNavigate();
  const [adding, setAdding] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const list = useMemo(
    () =>
      mode === 'videos'
        ? videos.filter((v) => v.chefId === chefId && inCategory(v, catId)).sort(byRating)
        : recipes.filter((r) => r.chefId === chefId && r.categoryId === catId).sort(byRating),
    [mode, videos, recipes, chefId, catId],
  );
  if (!chef || !cat) return <NotFound />;
  return (
    <div className="page">
      <Header title={`${cat.icon} ${cat.name}`} back={`/${mode}/${chefId}`} tone={MODE_TONE[mode]} />
      <div className="row between section-head">
        <span className="muted">
          {chef.name} · {list.length} {mode === 'videos' ? 'סרטונים' : 'מתכונים'}
        </span>
        <button className="btn" onClick={() => (mode === 'videos' ? setAdding(true) : nav(`/recipes/${chefId}/${catId}/new`))}>
          {mode === 'videos' ? '+ הוספת סרטון' : '+ הוספת מתכון'}
        </button>
      </div>
      {list.length === 0 ? (
        <Empty>{mode === 'videos' ? 'אין עדיין סרטונים בקטגוריה הזאת.' : 'אין עדיין מתכונים בקטגוריה הזאת.'}</Empty>
      ) : (
        <div className="media-grid">
          {mode === 'videos'
            ? (list as Video[]).slice(0, shown).map((v) => <VideoCard key={v.id} v={v} />)
            : (list as Recipe[]).slice(0, shown).map((r) => <RecipeCard key={r.id} r={r} />)}
        </div>
      )}
      <MoreButton shown={shown} total={list.length} onMore={() => setShown((n) => n + PAGE)} />
      {adding && <AddVideosModal chefId={chefId} categoryId={catId} onClose={() => setAdding(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recipe page + editor                                                 */
/* ------------------------------------------------------------------ */

export function RecipeScreen() {
  const { id = '' } = useParams();
  const r = useAllRecipes().find((x) => x.id === id);
  const chef = useStore((s) => s.chefs.find((c) => c.id === r?.chefId));
  const catIcon = useStore((s) => s.categories.find((c) => c.id === r?.categoryId)?.icon);
  const update = useStore((s) => s.updateRecipe);
  const remove = useStore((s) => s.deleteRecipe);
  const nav = useNavigate();
  if (!r) return <NotFound />;
  let step = 0;
  return (
    <div className="page recipe-page">
      <Header title="מתכון" tone={MODE_TONE.recipes} back="">
        <Link to={`/recipe/${r.id}/edit`} className="icon-btn" aria-label="עריכה">
          ✎
        </Link>
      </Header>
      {r.youtubeId &&
        (IS_ARTIFACT ? (
          <div className="hero">
            <Thumb id={r.youtubeId} alt={r.title} icon={catIcon} />
          </div>
        ) : (
          <img className="hero" src={thumbUrl(r.youtubeId, 'hq')} alt={r.title} />
        ))}
      <h1 className="recipe-title">{r.title}</h1>
      <div className="row between wrap gap">
        <span className="muted">{chef?.name}</span>
        <Stars value={r.rating} onChange={(rating) => update(r.id, { rating })} />
      </div>
      <CollectionButtons kind="recipe" id={r.id} />
      {r.missing && (
        <div className="notice warn">
          <strong>חסר</strong> — בתיאור הסרטון אין מתכון מלא, ולכן לא הומצאו מצרכים או כמויות. אפשר להשלים ידנית בעריכה.
        </div>
      )}
      <section className="card">
        <h2>🧺 מצרכים</h2>
        {r.ingredients.length ? (
          <ul className="ingredients">
            {r.ingredients.map((l, i) => (isHeading(l) ? <li key={i} className="sub">{l}</li> : <li key={i}>{l}</li>))}
          </ul>
        ) : (
          <p className="muted">חסר</p>
        )}
      </section>
      <section className="card">
        <h2>👩‍🍳 אופן ההכנה</h2>
        {r.steps.length ? (
          <ol className="steps">
            {r.steps.map((l, i) =>
              isHeading(l) ? (
                <li key={i} className="sub">
                  {l}
                </li>
              ) : (
                <li key={i}>
                  <span className="num">{++step}</span>
                  <span>{l}</span>
                </li>
              ),
            )}
          </ol>
        ) : (
          <p className="muted">חסר</p>
        )}
      </section>
      <div className="row gap wrap between">
        {r.url && (
          <a className="muted small" href={r.url} target="_blank" rel="noreferrer">
            מקור: תיאור הסרטון ביוטיוב ↗
          </a>
        )}
        <button className="btn small danger" onClick={() => void confirmDelete(`המתכון "${r.title}"`).then((ok) => ok && (remove(r.id), nav(-1)))}>
          מחיקת מתכון
        </button>
      </div>
    </div>
  );
}

const toLines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

export function RecipeEditScreen() {
  const { id, chefId: pChef, catId: pCat } = useParams();
  const [params] = useSearchParams();
  const existing = useAllRecipes().find((r) => r.id === id);
  const apiKey = useStore((s) => s.settings.ytApiKey);
  const chefs = useStore((s) => s.chefs);
  const categories = useStore((s) => s.categories);
  const videoTitle = useAllVideos().find((v) => v.youtubeId === params.get('yt'))?.title;
  const add = useStore((s) => s.addRecipe);
  const update = useStore((s) => s.updateRecipe);
  const nav = useNavigate();

  const initYt = params.get('yt');
  const [url, setUrl] = useState(existing?.url ?? (initYt ? watchUrl(initYt) : ''));
  const [title, setTitle] = useState(existing?.title ?? videoTitle ?? '');
  const [chefId, setChefId] = useState(existing?.chefId ?? pChef ?? chefs[0]?.id ?? '');
  const [catId, setCatId] = useState(existing?.categoryId ?? pCat ?? categories[0]?.id ?? '');
  const [desc, setDesc] = useState(existing?.description ?? '');
  const [ing, setIng] = useState(existing?.ingredients.join('\n') ?? '');
  const [steps, setSteps] = useState(existing?.steps.join('\n') ?? '');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const ytId = youtubeId(url);

  const extract = (text: string) => {
    const p = parseDescription(text);
    setIng(p.ingredients.join('\n'));
    setSteps(p.steps.join('\n'));
    setStatus(p.missing ? 'בתיאור אין מתכון מלא — המתכון יסומן "חסר".' : '✓ המצרכים ושלבי ההכנה חולצו מהתיאור.');
  };

  const pull = async () => {
    if (!ytId) return setStatus('הקישור אינו קישור יוטיוב תקין');
    setBusy(true);
    setStatus('');
    try {
      if (apiKey) {
        const sn = await fetchSnippet(ytId, apiKey);
        if (!sn) throw new Error('הסרטון לא נמצא');
        if (!title.trim()) setTitle(sn.title);
        setDesc(sn.description);
        extract(sn.description);
      } else {
        const t = await fetchTitle(ytId);
        if (t && !title.trim()) setTitle(t);
        setStatus('נמשכו השם והתמונה. כדי למשוך גם את התיאור צריך מפתח YouTube בהגדרות — או להדביק את התיאור כאן למטה.');
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'שגיאה במשיכה');
    } finally {
      setBusy(false);
    }
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !chefId || !catId) return;
    const ingredients = toLines(ing);
    const stepsL = toLines(steps);
    const data = {
      chefId,
      categoryId: catId,
      youtubeId: ytId ?? '',
      url: ytId ? watchUrl(ytId) : url.trim(),
      title: title.trim(),
      description: desc,
      ingredients,
      steps: stepsL,
      missing: !ingredients.some((l) => !isHeading(l)) || !stepsL.some((l) => !isHeading(l)),
    };
    if (existing) {
      update(existing.id, data);
      nav(`/recipe/${existing.id}`, { replace: true });
    } else {
      const nid = add(data);
      nav(`/recipe/${nid}`, { replace: true });
    }
  };

  return (
    <div className="page">
      <Header title={existing ? 'עריכת מתכון' : 'מתכון חדש'} back="" tone={MODE_TONE.recipes} />
      <form className="form card" onSubmit={save}>
        <label>
          קישור לסרטון ביוטיוב
          <div className="row gap">
            <input className="input" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtu.be/…" />
            <button type="button" className="btn small" onClick={pull} disabled={busy || !url.trim()}>
              {busy ? '…' : 'משיכה'}
            </button>
          </div>
        </label>
        {ytId && <img className="hero small" src={thumbUrl(ytId)} alt="" />}
        <label>
          שם המתכון
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="row gap wrap">
          <label className="grow">
            שף
            <select className="input" value={chefId} onChange={(e) => setChefId(e.target.value)}>
              {chefs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grow">
            קטגוריה
            <select className="input" value={catId} onChange={(e) => setCatId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          תיאור הסרטון (מקור המתכון)
          <textarea className="input" rows={6} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="הדביקו כאן את התיאור מיוטיוב…" />
        </label>
        <button type="button" className="btn ghost" onClick={() => extract(desc)} disabled={!desc.trim()}>
          ⚙ חילוץ מצרכים ושלבים מהתיאור
        </button>
        {status && <div className="notice">{status}</div>}
        <label>
          מצרכים (שורה לכל מצרך; שורה שמסתיימת בנקודתיים היא כותרת)
          <textarea className="input" rows={8} value={ing} onChange={(e) => setIng(e.target.value)} />
        </label>
        <label>
          שלבי הכנה (שורה לכל שלב)
          <textarea className="input" rows={8} value={steps} onChange={(e) => setSteps(e.target.value)} />
        </label>
        <button className="btn" disabled={!title.trim()}>
          שמירת מתכון
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shabbat / Chag collections                                           */
/* ------------------------------------------------------------------ */

export function CollectionScreen() {
  const { which } = useParams();
  const key: CollectionKey = which === 'chag' ? 'chag' : 'shabbat';
  const entries = useStore((s) => s.collections[key]);
  const videos = useAllVideos();
  const recipes = useAllRecipes();
  const chefs = useStore((s) => s.chefs);
  const setNote = useStore((s) => s.setCollectionNote);
  const toggle = useStore((s) => s.toggleCollection);
  const play = useUi((s) => s.play);
  const nav = useNavigate();
  const [filter, setFilter] = useState<'all' | 'video' | 'recipe'>('all');

  const rows = entries
    .map((e) => {
      const item = e.kind === 'video' ? videos.find((v) => v.id === e.id) : recipes.find((r) => r.id === e.id);
      return item ? { e, item } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x && (filter === 'all' || x.e.kind === filter))
    .sort((a, b) => b.item.rating - a.item.rating || a.e.addedAt - b.e.addedAt);

  const open = (kind: 'video' | 'recipe', item: Video | Recipe) => (kind === 'video' ? play(item as Video) : nav(`/recipe/${item.id}`));

  return (
    <div className={`page coll-${key}`}>
      <Header title={key === 'shabbat' ? '🕯️ אוסף שבת' : '🍷 אוסף חג'} back="" tone={key === 'shabbat' ? '#4f46e5' : '#b45309'} />
      <p className="muted small">האוסף נפרד מתכנון הסעודות — מה שנמצא כאן לא משנה סעודות, מנות או מונים.</p>
      <div className="seg">
        {(['all', 'recipe', 'video'] as const).map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? 'הכול' : f === 'recipe' ? 'מתכונים' : 'סרטונים'}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty>האוסף ריק. הוסיפו מתכונים וסרטונים בכפתור "הוסף ל{key === 'shabbat' ? 'שבת' : 'חג'}".</Empty>
      ) : (
        <div className="coll-list">
          {rows.map(({ e, item }) => (
            <article key={e.kind + e.id} className="card coll-row">
              <button className="media-thumb" onClick={() => open(e.kind, item)}>
                <Thumb id={item.youtubeId} alt={item.title} />
                {e.kind === 'video' && <span className="play-badge">▶</span>}
              </button>
              <div className="coll-body">
                <div className="row between gap">
                  <h3 onClick={() => open(e.kind, item)}>{item.title}</h3>
                  <button className="icon-btn" aria-label="הסרה מהאוסף" onClick={() => toggle(key, e.kind, e.id)}>
                    ✕
                  </button>
                </div>
                <span className="muted small">
                  {e.kind === 'recipe' ? '📖 מתכון' : '🎬 סרטון'} · {chefs.find((c) => c.id === item.chefId)?.name}
                </span>
                <Stars value={item.rating} small />
                <textarea
                  className="input note"
                  rows={2}
                  placeholder="הערה…"
                  value={e.note}
                  onChange={(ev) => setNote(key, e.kind, e.id, ev.target.value)}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function NotFound() {
  return (
    <div className="page">
      <Header title="לא נמצא" back="/" />
      <Empty>הדף הזה לא קיים (אולי נמחק).</Empty>
    </div>
  );
}
