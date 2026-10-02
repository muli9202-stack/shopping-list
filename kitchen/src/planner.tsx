import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { countMeals, useStore } from './store';
import { findMatches, matchScore, type Candidate } from './text';
import type { Course, ItemLink, Meal, PlanItem } from './types';
import { Modal, Thumb, confirmDelete, useUi } from './ui';

/** Resolves a saved link to something openable, or null when its target was deleted. */
function useOpenLink() {
  const nav = useNavigate();
  const play = useUi((s) => s.play);
  const videos = useStore((s) => s.videos);
  const recipes = useStore((s) => s.recipes);
  return (link: ItemLink | undefined): boolean => {
    if (!link) return false;
    if (link.kind === 'video') {
      const v = videos.find((x) => x.id === link.id);
      if (!v) return false;
      play(v);
      return true;
    }
    if (!recipes.some((x) => x.id === link.id)) return false;
    nav(`/recipe/${link.id}`);
    return true;
  };
}

export function Counter({ left, total, big }: { left: number; total: number; big?: boolean }) {
  const all = total > 0 && left === 0;
  return (
    <span className={`counter${big ? ' big' : ''}${all ? ' done' : ''}`}>
      {total === 0 ? 'אין פריטים' : all ? `✓ הכול מוכן (${total})` : `נשארו ${left} מתוך ${total}`}
    </span>
  );
}

/* ---------------- link picker ---------------- */

function CandidateRow({ c, onPick }: { c: Candidate; onPick: () => void }) {
  const chef = useStore((s) => s.chefs.find((x) => x.id === c.item.chefId));
  return (
    <button className="pick-row" onClick={onPick}>
      <Thumb id={c.item.youtubeId} alt="" />
      <span className="pick-text">
        <strong>{c.item.title}</strong>
        <span className="muted small">
          {c.kind === 'recipe' ? '📖 מתכון' : '🎬 סרטון'} · {chef?.name ?? ''}
          {c.item.rating ? ` · ${'★'.repeat(c.item.rating)}` : ''}
        </span>
      </span>
    </button>
  );
}

function LinkPicker({ item, onPick, onClose }: { item: PlanItem; onPick: (l: ItemLink) => void; onClose: () => void }) {
  const videos = useStore((s) => s.videos);
  const recipes = useStore((s) => s.recipes);
  const matches = useMemo(() => findMatches(item.name, videos, recipes), [item.name, videos, recipes]);
  const [manual, setManual] = useState(matches.length === 0);
  const [q, setQ] = useState('');
  const all: Candidate[] = useMemo(() => {
    const list: Candidate[] = [
      ...recipes.map((r) => ({ kind: 'recipe' as const, item: r, score: 1 })),
      ...videos.map((v) => ({ kind: 'video' as const, item: v, score: 1 })),
    ];
    return q.trim() ? list.filter((c) => matchScore(q, c.item.title) > 0) : list;
  }, [q, videos, recipes]);

  return (
    <Modal title={`מתכון / סרטון ל"${item.name}"`} onClose={onClose}>
      {!manual ? (
        <>
          <p className="muted">נמצאו {matches.length} התאמות. בחרו אחת:</p>
          <div className="pick-list">
            {matches.map((c) => (
              <CandidateRow key={c.kind + c.item.id} c={c} onPick={() => onPick({ kind: c.kind, id: c.item.id })} />
            ))}
          </div>
          <button className="btn ghost full" onClick={() => setManual(true)}>
            בחירה ידנית מכל הרשימה
          </button>
        </>
      ) : (
        <>
          {matches.length === 0 && <div className="notice">לא נמצא מתכון או סרטון. אפשר לבחור אחד ידנית:</div>}
          <input className="input" placeholder="חיפוש מתכון או סרטון…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="pick-list">
            {all.length === 0 && <p className="muted">אין עדיין מתכונים או סרטונים שמורים.</p>}
            {all.slice(0, 200).map((c) => (
              <CandidateRow key={c.kind + c.item.id} c={c} onPick={() => onPick({ kind: c.kind, id: c.item.id })} />
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------------- item ---------------- */

function ItemRow({ mealId, courseId, item }: { mealId: string; courseId: string; item: PlanItem }) {
  const toggle = useStore((s) => s.toggleItem);
  const update = useStore((s) => s.updateItem);
  const remove = useStore((s) => s.deleteItem);
  const open = useOpenLink();
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.qty);

  const onOpen = () => {
    if (open(item.link)) return;
    // A single match opens straight away and is remembered; otherwise let the user choose.
    const { videos, recipes } = useStore.getState();
    const matches = findMatches(item.name, videos, recipes);
    if (matches.length === 1) {
      const link = { kind: matches[0].kind, id: matches[0].item.id };
      update(mealId, courseId, item.id, { link });
      open(link);
      return;
    }
    if (item.link) update(mealId, courseId, item.id, { link: undefined });
    setPicking(true);
  };

  if (editing)
    return (
      <form
        className="item editing"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          update(mealId, courseId, item.id, { name: name.trim(), qty: qty.trim() });
          setEditing(false);
        }}
      >
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="שם הפריט" autoFocus />
        <input className="input qty" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="כמות" placeholder="כמות" />
        <div className="row gap wrap">
          <button className="btn small">שמירה</button>
          {item.link && (
            <button type="button" className="btn small ghost" onClick={() => update(mealId, courseId, item.id, { link: undefined })}>
              ניתוק מתכון/סרטון
            </button>
          )}
          <button
            type="button"
            className="btn small danger"
            onClick={() => void confirmDelete(`"${item.name}"`).then((ok) => ok && remove(mealId, courseId, item.id))}
          >
            מחיקה
          </button>
          <button type="button" className="btn small ghost" onClick={() => setEditing(false)}>
            ביטול
          </button>
        </div>
      </form>
    );

  return (
    <div className={`item${item.done ? ' done' : ''}`}>
      <button className="item-main" onClick={() => toggle(mealId, courseId, item.id)} aria-pressed={item.done}>
        <span className="check">{item.done ? '✓' : ''}</span>
        <span className="item-text">
          <span className="item-name">{item.name}</span>
          {item.qty && <span className="item-qty">{item.qty}</span>}
        </span>
      </button>
      <button className={`btn small open-link${item.link ? ' linked' : ''}`} onClick={onOpen} title="פתח מתכון / סרטון">
        ▶ <span className="long">פתח מתכון / סרטון</span>
        <span className="short">מתכון/סרטון</span>
      </button>
      <button
        className="icon-btn"
        aria-label="עריכה"
        onClick={() => {
          setName(item.name);
          setQty(item.qty);
          setEditing(true);
        }}
      >
        ✎
      </button>
      {picking && (
        <LinkPicker
          item={item}
          onClose={() => setPicking(false)}
          onPick={(link) => {
            update(mealId, courseId, item.id, { link });
            setPicking(false);
            open(link);
          }}
        />
      )}
    </div>
  );
}

function AddItemForm({ mealId, courseId }: { mealId: string; courseId: string }) {
  const add = useStore((s) => s.addItem);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    add(mealId, courseId, name.trim(), qty.trim());
    setName('');
    setQty('');
  };
  return (
    <form className="add-item" onSubmit={submit}>
      <input className="input" placeholder="פריט (למשל קציצות)" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input qty" placeholder="כמות" value={qty} onChange={(e) => setQty(e.target.value)} />
      <button className="btn small" disabled={!name.trim()}>
        + פריט
      </button>
    </form>
  );
}

/* ---------------- course & meal ---------------- */

function CourseCard({ mealId, course }: { mealId: string; course: Course }) {
  const rename = useStore((s) => s.renameCourse);
  const remove = useStore((s) => s.deleteCourse);
  const left = course.items.filter((i) => !i.done).length;
  return (
    <section className="course">
      <div className="course-head">
        <input className="title-input" value={course.name} onChange={(e) => rename(mealId, course.id, e.target.value)} aria-label="שם המנה" />
        <Counter left={left} total={course.items.length} />
        <button className="icon-btn" aria-label="מחיקת מנה" onClick={() => void confirmDelete(`"${course.name}" וכל הפריטים שבה`).then((ok) => ok && remove(mealId, course.id))}>
          🗑
        </button>
      </div>
      <div className="items">
        {course.items.map((i) => (
          <ItemRow key={i.id} mealId={mealId} courseId={course.id} item={i} />
        ))}
      </div>
      <AddItemForm mealId={mealId} courseId={course.id} />
    </section>
  );
}

export function MealCard({ meal, onDelete }: { meal: Meal; onDelete?: () => void }) {
  const rename = useStore((s) => s.renameMeal);
  const addCourse = useStore((s) => s.addCourse);
  const { total, left } = countMeals([meal]);
  return (
    <section className="meal">
      <div className="meal-head">
        <input className="title-input big" value={meal.name} onChange={(e) => rename(meal.id, e.target.value)} aria-label="שם הסעודה" />
        <Counter left={left} total={total} />
        {onDelete && (
          <button className="icon-btn" aria-label="מחיקת סעודה" onClick={() => void confirmDelete(`"${meal.name}"`).then((ok) => ok && onDelete())}>
            🗑
          </button>
        )}
      </div>
      <div className="courses">
        {meal.courses.map((c) => (
          <CourseCard key={c.id} mealId={meal.id} course={c} />
        ))}
      </div>
      <button className="btn add" onClick={() => addCourse(meal.id)}>
        + הוספת מנה
      </button>
    </section>
  );
}
