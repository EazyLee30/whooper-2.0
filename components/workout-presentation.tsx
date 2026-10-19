import type { CSSProperties } from "react";
import type { ShareSnapshot } from "@/lib/dashboard/types";
import type { TemplateId } from "@/lib/presentation";
import type {
  PublicStrength,
  StrengthSet,
} from "@/lib/public-workout/strength-data";
import "./workout-presentation.css";

type Exercise = PublicStrength["exercises"][number];
type Props = {
  snapshot: ShareSnapshot;
  template: TemplateId;
  compact?: boolean;
};

const number = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
const load = (set: StrengthSet) =>
  set.weight === null ? "未记录" : `${number(set.weight)} ${set.units}`;
const indexLabel = (index: number) => String(index + 1).padStart(2, "0");

function dateLabels(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()))
    return { long: date, short: date, day: "TRAINING DAY" };
  return {
    long: new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsed),
    short: date.replaceAll("-", "."),
    day: new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" })
      .format(parsed)
      .toUpperCase(),
  };
}

function SetDetails({
  exercise,
  compact,
}: {
  exercise: Exercise;
  compact: boolean;
}) {
  if (compact)
    return (
      <p className="wp-set-summary">
        {exercise.sets.length} 组 <span aria-hidden="true">·</span>{" "}
        {exercise.sets
          .map((set) => `${number(set.reps)} × ${load(set)}`)
          .join(" / ")}
      </p>
    );
  return (
    <ol className="wp-set-list" aria-label={`${exercise.name} 各组记录`}>
      {exercise.sets.map((set, index) => (
        <li key={index}>
          <span className="wp-set-number">{indexLabel(index)}</span>
          <span className="wp-set-reps">
            {number(set.reps)} <small>reps</small>
          </span>
          <span className="wp-set-times" aria-hidden="true">
            ×
          </span>
          <span className="wp-set-load">{load(set)}</span>
        </li>
      ))}
    </ol>
  );
}

function Footer({ label }: { label: string }) {
  return (
    <footer className="wp-footer">
      <span>WHOOPER</span>
      <span>{label}</span>
      <span aria-hidden="true">↗</span>
    </footer>
  );
}

function More({ count }: { count: number }) {
  return count > 0 ? (
    <p className="wp-more">+ {count} 个动作 · 完整分享页展开全部记录</p>
  ) : null;
}

function NoExercises({
  snapshot,
  variant,
}: {
  snapshot: ShareSnapshot;
  variant: TemplateId;
}) {
  return (
    <div className={`wp-no-exercises wp-no-exercises-${variant}`}>
      <span className="wp-activity-mark" aria-hidden="true">
        ↗
      </span>
      <p className="wp-kicker">
        {snapshot.strength ? "STRENGTH TRAINER" : "ACTIVITY RECORD"}
      </p>
      <h4>{snapshot.workout.name}</h4>
      <p>
        {snapshot.strength
          ? "本次训练暂无已记录的动作组数。"
          : "这一次的投入，也值得记录。"}
      </p>
      {!snapshot.strength && (
        <p className="wp-general-note">
          此运动没有 Strength Trainer 动作明细。
        </p>
      )}
    </div>
  );
}

function Metrics({
  snapshot,
  mode = "default",
}: {
  snapshot: ShareSnapshot;
  mode?: "default" | "pulse";
}) {
  const { strength, workout } = snapshot;
  const metrics = [
    { value: number(workout.durationMin), unit: "min", label: "训练时长" },
    ...(strength
      ? [
          {
            value: number(strength.set_count),
            unit: "sets",
            label: "完成组数",
          },
          {
            value:
              strength.total_volume_kg === null
                ? "—"
                : number(strength.total_volume_kg),
            unit: "kg",
            label:
              strength.total_volume_kg === null ? "总训练量未记录" : "总训练量",
          },
        ]
      : workout.calories !== null
        ? [{ value: number(workout.calories), unit: "kcal", label: "活动热量" }]
        : []),
  ];
  return (
    <dl className={`wp-metrics wp-metrics-${mode}`}>
      {metrics.map((metric) => (
        <div key={metric.label}>
          <dt>{metric.label}</dt>
          <dd>
            {metric.value}
            <span>{metric.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Match only supported movements. Unknown exercises keep their original logged names.
function movementFor(exercise: Exercise): string | null {
  const aliases: Record<string, string> = {
    OVERHANDGRIPPULLUPS: "pull-up",
    SEATEDROW_PULLEYMACHINE: "seated-row",
    LATPULLDOWNFRONT_PULLEYMACHINE: "lat-pulldown",
    NARROWGRIPLATPULLDOWNFRONT_PULLEYMACHINE: "lat-pulldown",
  };
  if (aliases[exercise.id]) return aliases[exercise.id];
  const name = `${exercise.id} ${exercise.name}`
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ");
  const matches: [RegExp, string][] = [
    [/\bbench press\b|卧推/, "bench-press"],
    [/\bpush up\b|俯卧撑/, "push-up"],
    [/\bpull up\b|\bchin up\b|引体向上/, "pull-up"],
    [/\bseated (?:cable )?row\b|坐姿.*划船/, "seated-row"],
    [/\blat pull ?down\b|高位下拉/, "lat-pulldown"],
    [/\bbicep(?:s)? curl\b|二头.*弯举/, "bicep-curl"],
    [/\b(?:back |barbell )?squat\b|深蹲/, "squat"],
    [/\bdeadlift\b|硬拉/, "deadlift"],
  ];
  return matches.find(([pattern]) => pattern.test(name))?.[1] ?? null;
}

function Movement({ exercise }: { exercise: Exercise }) {
  const slug = movementFor(exercise);
  return (
    <div
      className={`wp-original-figure ${slug ? "" : "wp-original-figure-none"}`}
      aria-hidden="true"
    >
      {slug
        ? [1, 2, 3].map((frame) => (
            <span
              key={frame}
              className={`wp-movement-frame wp-movement-frame-${frame}`}
              style={
                {
                  "--wp-frame": `url("/workout-guide/${slug}/frame-${frame}.svg")`,
                } as CSSProperties
              }
            />
          ))
        : "·"}
    </div>
  );
}

function GuideCredit({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <p className="wp-guide-credit">
        Workout Guide · Bryl Lim / Everkinetic · CC BY-SA 4.0 · 主题调色
      </p>
    );
  return (
    <p className="wp-guide-credit">
      动作插画：
      <a
        href="https://github.com/bryllim/workout-guide"
        target="_blank"
        rel="noreferrer"
      >
        Workout Guide · Bryl Lim / Everkinetic
      </a>{" "}
      ·{" "}
      <a
        href="https://creativecommons.org/licenses/by-sa/4.0/"
        target="_blank"
        rel="noreferrer"
      >
        CC BY-SA 4.0
      </a>
      。颜色随主题显示；动作用于呈现记录。
    </p>
  );
}

const SHEET_POSITIONS = [
  30.8, 37.05, 43.3, 49.55, 55.8, 62, 68, 73.85, 79.6, 86.05,
];
type SheetGroup = StrengthSet & { key: string; name: string; count: number };

function sheetGroups(exercises: Exercise[]): SheetGroup[] {
  const groups: SheetGroup[] = [];
  for (const exercise of exercises)
    for (const set of exercise.sets) {
      const key = JSON.stringify([
        exercise.id,
        exercise.name,
        set.weight,
        set.units,
        set.reps,
      ]);
      const previous = groups.at(-1);
      if (previous?.key === key) previous.count += 1;
      else groups.push({ key, name: exercise.name, ...set, count: 1 });
    }
  return groups;
}

function OriginalSource({
  snapshot,
  paper,
}: {
  snapshot: ShareSnapshot;
  paper: boolean;
}) {
  return (
    <div className="wp-original-source">
      <div>
        <span>{number(snapshot.workout.durationMin)} MIN</span>
        {snapshot.workout.strain !== null && (
          <span>{number(snapshot.workout.strain)} STRAIN</span>
        )}
        {snapshot.strength?.total_volume_kg !== null &&
          snapshot.strength?.total_volume_kg !== undefined && (
            <span>{number(snapshot.strength.total_volume_kg)} KG VOLUME</span>
          )}
        {paper && (
          <small>
            WEIGHT IN LBS · KG × 2.2046 · 0 = ZERO RECORDED LOAD · 未记录 =
            UNKNOWN
          </small>
        )}
      </div>
      <div className="wp-original-whoop">
        <small>DATA FROM</small>
        <span className="wp-whoop-wordmark" role="img" aria-label="WHOOP" />
      </div>
    </div>
  );
}

function Ledger({
  snapshot,
  compact,
}: Omit<Props, "template"> & { compact: boolean }) {
  const exercises = snapshot.strength?.exercises ?? [];
  const shown = compact ? exercises.slice(0, 2) : exercises;
  const groups = sheetGroups(shown);
  // Fixed paper rows are paginated exactly as the original, never cropped.
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(groups.length / 10)) },
    (_, page) => groups.slice(page * 10, page * 10 + 10),
  );
  const parsed = new Date(`${snapshot.workout.date}T12:00:00Z`);
  const date = Number.isNaN(parsed.getTime())
    ? snapshot.workout.date
    : new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
        .format(parsed)
        .toUpperCase();
  return (
    <article
      className={`wp wp-ledger ${compact ? "wp-compact" : ""}`}
      aria-label="原版手写训练单"
    >
      <h3 className="wp-sr-only">{snapshot.title || "手写训练单"}</h3>
      <div className="wp-original-sheets">
        {pages.map((rows, page) => (
          <figure
            className="wp-original-sheet"
            key={page}
            aria-label={`${snapshot.workout.date} 训练单，第 ${page + 1} 页`}
          >
            {/* This facsimile is intentionally rendered from the owner's original artwork. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="wp-original-sheet-image"
              src="/workout/exercise-list-original.png"
              width={1086}
              height={1448}
              alt="克強健力學院 Exercise List 原版训练单底图"
            />
            <time
              className="wp-sheet-date wp-sheet-hand"
              dateTime={snapshot.workout.date}
            >
              {date}
            </time>
            <div className="wp-sheet-entries wp-sheet-hand">
              {rows.map((group, index) => {
                const pounds =
                  group.weight === null
                    ? "未记录"
                    : number(
                        group.units === "kg"
                          ? Math.round(group.weight * 2.2046226218 * 10) / 10
                          : group.weight,
                      );
                // Keep names inside the original boxes; the unabridged log is available below.
                const fontSize = Math.min(
                  3.25,
                  Math.sqrt(180 / Math.max(group.name.length, 1)),
                );
                return (
                  <div
                    className="wp-sheet-entry"
                    style={{ top: `${SHEET_POSITIONS[index]}%` }}
                    key={`${group.key}-${index}`}
                  >
                    <span style={{ fontSize: `${fontSize}cqw` }}>
                      {group.name}
                    </span>
                    <span>{group.count}</span>
                    <span>{pounds}</span>
                    <span>{number(group.reps)}</span>
                    <span style={{ fontSize: `${fontSize}cqw` }}>
                      {group.name}
                    </span>
                  </div>
                );
              })}
            </div>
            {!groups.length && (
              <figcaption className="wp-sheet-empty">
                {snapshot.strength
                  ? "暂无已记录的动作组数"
                  : `${snapshot.workout.name} · 无 Strength Trainer 动作明细`}
              </figcaption>
            )}
            {pages.length > 1 && (
              <figcaption className="wp-sheet-page">
                {page + 1} / {pages.length}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
      <More count={exercises.length - shown.length} />
      <OriginalSource snapshot={snapshot} paper />
      <p className="wp-sheet-art-note">
        EAZY LEE 原版训练单 · 底图姓名和性别为模板装饰
      </p>
      {!compact && exercises.length > 0 && (
        <details className="wp-sheet-log">
          <summary>查看逐组记录与原始重量单位</summary>
          <div className="wp-sheet-log-content">
            {exercises.map((exercise, index) => (
              <section key={`${exercise.id}-${index}`}>
                <h4>{exercise.name}</h4>
                <SetDetails exercise={exercise} compact={false} />
              </section>
            ))}
          </div>
        </details>
      )}
      {!snapshot.strength && (
        <p className="wp-sheet-art-note">
          本次为普通运动记录；训练单不会生成未记录的力量动作。
        </p>
      )}
    </article>
  );
}

function Illustrated({
  snapshot,
  compact,
}: Omit<Props, "template"> & { compact: boolean }) {
  const exercises = snapshot.strength?.exercises ?? [];
  const shown = compact ? exercises.slice(0, 2) : exercises;
  return (
    <article
      className={`wp wp-illustrated ${compact ? "wp-compact" : ""}`}
      aria-label="原版动作演示"
    >
      <h3 className="wp-sr-only">{snapshot.title || "动作演示"}</h3>
      <div className="wp-original-meta">
        <span>{dateLabels(snapshot.workout.date).short}</span>
        <span>
          {number(snapshot.workout.durationMin)} 分钟
          {snapshot.workout.strain !== null
            ? ` · strain ${number(snapshot.workout.strain)}`
            : ""}
        </span>
        {snapshot.strength && (
          <span>
            {snapshot.strength.total_volume_kg === null
              ? "总量未记录"
              : `${number(snapshot.strength.total_volume_kg)} kg 总量`}{" "}
            · {snapshot.strength.set_count} 组 ·{" "}
            {snapshot.strength.exercise_count} 个动作
          </span>
        )}
      </div>
      {shown.length > 0 ? (
        <div className="wp-original-grid">
          {shown.map((exercise, index) => (
            <section
              className="wp-original-card"
              key={`${exercise.id}-${index}`}
            >
              <div className="wp-original-card-head">
                <h4>{exercise.name}</h4>
              </div>
              <Movement exercise={exercise} />
              <ol
                className="wp-original-sets"
                aria-label={`${exercise.name} 各组记录`}
              >
                {exercise.sets.map((set, setIndex) => (
                  <li key={setIndex}>
                    <span className="wp-original-set-n">
                      SET {indexLabel(setIndex)}
                    </span>
                    <span className="wp-original-set-r">
                      {number(set.reps)} 次
                    </span>
                    <span className="wp-original-set-w">{load(set)}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <NoExercises snapshot={snapshot} variant="illustrated" />
      )}
      <More count={exercises.length - shown.length} />
      <OriginalSource snapshot={snapshot} paper={false} />
      {shown.some((exercise) => movementFor(exercise)) && (
        <GuideCredit compact={compact} />
      )}
    </article>
  );
}

function Journal({
  snapshot,
  compact,
}: Omit<Props, "template"> & { compact: boolean }) {
  const dates = dateLabels(snapshot.workout.date);
  const exercises = snapshot.strength?.exercises ?? [];
  const shown = compact ? exercises.slice(0, 2) : exercises;
  return (
    <article
      className={`wp wp-journal ${compact ? "wp-compact" : ""}`}
      aria-label="训练日志"
    >
      <div className="wp-journal-path">
        ~/training/{snapshot.workout.date}
        <span aria-hidden="true"> ↵</span>
      </div>
      <header className="wp-journal-heading">
        <p className="wp-kicker">{dates.day} · TRAINING JOURNAL</p>
        <h3>{snapshot.title || "一些训练，一些进步。"}</h3>
        <p>
          {dates.long}
          <span aria-hidden="true"> · </span>
          {snapshot.workout.name}
        </p>
      </header>
      <Metrics snapshot={snapshot} />
      <div className="wp-journal-section-label">
        <span>01 / THE SESSION</span>
        <span>
          {exercises.length ? `${exercises.length} MOVEMENTS` : "ACTIVITY"}
        </span>
      </div>
      {shown.length > 0 ? (
        <ol className="wp-journal-list">
          {shown.map((exercise, index) => (
            <li key={`${exercise.id}-${index}`}>
              <span className="wp-exercise-index">{indexLabel(index)}</span>
              <div>
                <div className="wp-journal-exercise-heading">
                  <h4>{exercise.name}</h4>
                  <span>{exercise.sets.length} sets</span>
                </div>
                <SetDetails exercise={exercise} compact={compact} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <NoExercises snapshot={snapshot} variant="journal" />
      )}
      <More count={exercises.length - shown.length} />
      <p className="wp-journal-closing">
        <span aria-hidden="true">*</span> A page from my training life.
      </p>
      <Footer label="LOGGED WITH INTENTION" />
    </article>
  );
}

function Pulse({
  snapshot,
  compact,
}: Omit<Props, "template"> & { compact: boolean }) {
  const exercises = snapshot.strength?.exercises ?? [];
  const shown = compact ? exercises.slice(0, 2) : exercises;
  return (
    <article
      className={`wp wp-pulse ${compact ? "wp-compact" : ""}`}
      aria-label="数字脉搏"
    >
      <div className="wp-pulse-top">
        <span>
          <i aria-hidden="true" /> SESSION COMPLETE
        </span>
        <span>{dateLabels(snapshot.workout.date).short}</span>
      </div>
      <header className="wp-pulse-heading">
        <p className="wp-kicker">{snapshot.workout.name}</p>
        <h3>{snapshot.title || "SHOWED UP."}</h3>
        <div className="wp-pulse-arrow" aria-hidden="true">
          ↗
        </div>
      </header>
      <Metrics snapshot={snapshot} mode="pulse" />
      {shown.length > 0 ? (
        <div className="wp-pulse-exercises">
          {shown.map((exercise, index) => (
            <section key={`${exercise.id}-${index}`}>
              <div className="wp-pulse-exercise-title">
                <span>{indexLabel(index)}</span>
                <h4>{exercise.name}</h4>
                <strong>
                  {exercise.sets.length}
                  <small>SETS</small>
                </strong>
              </div>
              <SetDetails exercise={exercise} compact={compact} />
            </section>
          ))}
        </div>
      ) : (
        <NoExercises snapshot={snapshot} variant="pulse" />
      )}
      <More count={exercises.length - shown.length} />
      <Footer label="THE WORK SPEAKS." />
    </article>
  );
}

export function WorkoutPresentation({
  snapshot,
  template,
  compact = false,
}: Props) {
  switch (template) {
    case "ledger":
      return <Ledger snapshot={snapshot} compact={compact} />;
    case "illustrated":
      return <Illustrated snapshot={snapshot} compact={compact} />;
    case "journal":
      return <Journal snapshot={snapshot} compact={compact} />;
    case "pulse":
      return <Pulse snapshot={snapshot} compact={compact} />;
  }
}
