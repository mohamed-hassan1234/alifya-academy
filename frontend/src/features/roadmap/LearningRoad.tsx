import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faClock,
  faFlag,
  faGraduationCap,
  faLayerGroup,
  faLock,
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';

export type StageState = 'completed' | 'current' | 'available' | 'locked';

export interface RoadStage {
  id: string;
  title: string;
  description: string;
  durationText: string;
  courseCount: number;
  state: StageState;
}

type Pt = { x: number; y: number };

const WIDE_MIN = 768;
const WIDE = { top: 64, step: 210, road: 44, gap: 40 };
const NARROW = { top: 72, cardLeft: 76, road: 28, nodeOffset: 30 };

/** Smooth path through points: cubic curves with vertical tangents give a calm, road-like S. */
function pathThrough(points: Pt[]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const h = (b.y - a.y) * 0.55;
    d += ` C ${a.x} ${a.y + h}, ${b.x} ${b.y - h}, ${b.x} ${b.y}`;
  }
  return d;
}

const STATE_ICON: Partial<Record<StageState, typeof faCheck>> = { completed: faCheck, locked: faLock };

/**
 * Interactive winding-road learning roadmap.
 * - The road is decorative SVG; every stage is a real <button> inside an ordered list, so keyboard and
 *   screen-reader users get the same journey in order (state is announced, never colour-only).
 * - Desktop (≥768px): stage cards alternate either side of a gentle S-curve.
 * - Mobile: cards stack in normal flow; the road runs down the left edge and its milestones are placed
 *   by measuring the real cards, so long titles can never overlap. No horizontal scrolling at any width.
 */
export function LearningRoad({
  stages,
  selectedId,
  onSelect,
}: {
  stages: RoadStage[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [narrowYs, setNarrowYs] = useState<number[]>([]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const wide = box.w >= WIDE_MIN;

  // Mobile: milestones follow the measured card positions (re-measured whenever the box resizes).
  useLayoutEffect(() => {
    if (!box.w || wide) return;
    const ys = stages.map((_, i) => (cardRefs.current[i]?.offsetTop ?? 0) + NARROW.nodeOffset);
    setNarrowYs((prev) => (prev.length === ys.length && prev.every((v, i) => v === ys[i]) ? prev : ys));
  }, [box, wide, stages]);

  let nodes: Pt[] = [];
  let start: Pt = { x: 0, y: 0 };
  let finish: Pt = { x: 0, y: 0 };
  let height = 0;
  if (box.w && wide) {
    nodes = stages.map((_, i) => ({
      x: box.w * (i % 2 === 0 ? 0.4 : 0.6),
      y: WIDE.top + 80 + i * WIDE.step,
    }));
    start = { x: box.w / 2, y: WIDE.top - 28 };
    finish = { x: box.w / 2, y: (nodes.at(-1)?.y ?? WIDE.top) + 124 };
    height = finish.y + 72;
  } else if (box.w && narrowYs.length === stages.length) {
    nodes = narrowYs.map((y, i) => ({ x: i % 2 === 0 ? 30 : 48, y }));
    start = { x: 40, y: 28 };
    finish = { x: 40, y: box.h - 52 };
    height = box.h;
  }
  const ready = nodes.length === stages.length && height > 0;
  const roadWidth = wide ? WIDE.road : NARROW.road;
  const fullPath = ready ? pathThrough([start, ...nodes, finish]) : '';
  const lastDone = stages.reduce((n, s, i) => (s.state === 'completed' ? i : n), -1);
  const progressPath = ready && lastDone >= 0 ? pathThrough([start, ...nodes.slice(0, lastDone + 1)]) : '';

  return (
    <div
      ref={ref}
      className={cn('relative w-full', !wide && 'pb-28')}
      style={wide ? { height: height || 400 } : { paddingTop: NARROW.top }}
    >
      {ready && (
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${box.w} ${height}`}
          preserveAspectRatio="none"
        >
          <path
            d={fullPath}
            pathLength={1}
            className="road-reveal"
            fill="none"
            stroke="rgb(var(--alf-border-strong))"
            strokeWidth={roadWidth + 4}
            strokeLinecap="round"
          />
          <path
            d={fullPath}
            pathLength={1}
            className="road-reveal"
            fill="none"
            stroke="rgb(var(--alf-mint))"
            strokeWidth={roadWidth}
            strokeLinecap="round"
          />
          {progressPath && (
            <path
              d={progressPath}
              fill="none"
              stroke="rgb(var(--alf-brand) / 0.85)"
              strokeWidth={roadWidth * 0.32}
              strokeLinecap="round"
            />
          )}
          <path
            d={fullPath}
            className="road-lane"
            fill="none"
            stroke="rgb(var(--alf-primary) / 0.32)"
            strokeWidth={2}
            strokeDasharray="10 12"
            strokeLinecap="round"
          />
        </svg>
      )}

      {ready && (
        <>
          <Landmark at={start} wide={wide} icon={faFlag} label={t('roadmaps.start')} />
          <Landmark
            at={finish}
            wide={wide}
            icon={faGraduationCap}
            label={t('roadmaps.finish')}
            note={t('roadmaps.finishNote')}
          />
        </>
      )}

      <ol
        className={wide ? 'contents' : 'space-y-5'}
        style={wide ? undefined : { paddingLeft: NARROW.cardLeft }}
      >
        {stages.map((s, i) => {
          const p = nodes[i];
          const selected = s.id === selectedId;
          const icon = STATE_ICON[s.state];
          let cardStyle: CSSProperties | undefined;
          if (wide && p) {
            const cardWidth = Math.min(360, box.w * 0.4 - WIDE.gap - 16);
            const left = i % 2 === 0;
            cardStyle = {
              position: 'absolute',
              top: p.y,
              width: cardWidth,
              left: left ? p.x - WIDE.gap - cardWidth : p.x + WIDE.gap,
              transform: 'translateY(-50%)',
            };
          }
          return (
            <li key={s.id} className={wide ? 'contents' : undefined}>
              {p && (
                <span
                  aria-hidden
                  onClick={() => onSelect(s.id)}
                  style={{ left: p.x, top: p.y }}
                  className={cn(
                    'absolute z-10 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-2 text-sm font-bold transition-shadow duration-200',
                    s.state === 'completed' && 'border-brand bg-brand text-brand-foreground',
                    s.state === 'current' && 'border-brand bg-background text-primary ring-4 ring-accent/45',
                    s.state === 'available' && 'border-primary/70 bg-background text-primary',
                    s.state === 'locked' && 'border-border-strong bg-mint text-muted-foreground',
                    selected && 'ring-4 ring-primary/25',
                  )}
                >
                  {icon ? <FontAwesomeIcon icon={icon} /> : i + 1}
                </span>
              )}

              <button
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                type="button"
                data-stage-id={s.id}
                onClick={() => onSelect(s.id)}
                aria-label={`${t('roadmaps.stageOf', { n: i + 1, total: stages.length })}: ${s.title}. ${t(`roadmaps.state.${s.state}`)}`}
                aria-pressed={selected}
                style={{ ...cardStyle, animationDelay: `${200 + i * 80}ms` }}
                className={cn(
                  'group z-10 block w-full rounded-lg border bg-background p-4 text-left transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-card motion-safe:animate-fade-up sm:p-5',
                  selected ? 'border-primary shadow-card' : 'border-border',
                  s.state === 'locked' && 'bg-ivory',
                  !wide && 'relative',
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-strong">
                    {t('roadmaps.stageLabel', { n: i + 1 })}
                  </span>
                  <StateBadge state={s.state} />
                </span>
                <span className="mt-2 block font-display text-lg leading-snug text-foreground group-hover:text-primary">
                  {s.title}
                </span>
                {s.description && (
                  <span className="mt-1.5 line-clamp-2 block text-sm leading-relaxed text-muted-foreground">
                    {s.description}
                  </span>
                )}
                <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <FontAwesomeIcon icon={faLayerGroup} aria-hidden />
                    {t('roadmaps.courses', { count: s.courseCount })}
                  </span>
                  {s.durationText && (
                    <span className="inline-flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faClock} aria-hidden />
                      {s.durationText}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Landmark({
  at,
  wide,
  icon,
  label,
  note,
}: {
  at: Pt;
  wide: boolean;
  icon: typeof faFlag;
  label: string;
  note?: string;
}) {
  return (
    <div
      className={cn(
        'absolute z-10 flex -translate-y-1/2 items-center gap-2.5',
        wide ? '-translate-x-1/2 flex-col text-center' : '-translate-x-[22px]',
      )}
      style={{ left: at.x, top: at.y }}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-brand bg-brand text-brand-foreground">
        <FontAwesomeIcon icon={icon} aria-hidden />
      </span>
      <span className={cn('rounded-md bg-background px-2 py-0.5', wide && 'border border-border')}>
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {note && <span className="block text-xs text-muted-foreground">{note}</span>}
      </span>
    </div>
  );
}

export function StateBadge({ state }: { state: StageState }) {
  const { t } = useTranslation();
  const icon = { completed: faCheck, current: faFlag, available: null, locked: faLock }[state];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold',
        state === 'completed' && 'border-success/30 bg-success/10 text-success',
        state === 'current' && 'border-accent/50 bg-accent/15 text-accent-strong',
        state === 'available' && 'border-border bg-background text-muted-foreground',
        state === 'locked' && 'border-border bg-mint text-muted-foreground',
      )}
    >
      {icon && <FontAwesomeIcon icon={icon} aria-hidden className="text-[0.65rem]" />}
      {t(`roadmaps.state.${state}`)}
    </span>
  );
}

/** Small decorative road glyph for roadmap cards in listings. */
export function MiniRoad({ stops, className }: { stops: number; className?: string }) {
  const n = Math.max(2, Math.min(stops, 8));
  const pts = Array.from({ length: n }, (_, i) => ({ x: 20 + (i * 200) / (n - 1), y: i % 2 ? 46 : 22 }));
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const h = (b.x - a.x) * 0.5;
    d += ` C ${a.x + h} ${a.y}, ${b.x - h} ${b.y}, ${b.x} ${b.y}`;
  }
  return (
    <svg aria-hidden viewBox="0 0 240 68" className={className}>
      <path d={d} fill="none" stroke="rgb(var(--alf-border-strong))" strokeWidth={14} strokeLinecap="round" />
      <path d={d} fill="none" stroke="rgb(var(--alf-mint))" strokeWidth={11} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke="rgb(var(--alf-primary) / 0.35)"
        strokeWidth={1.5}
        strokeDasharray="5 6"
      />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={6}
          fill="rgb(var(--alf-background))"
          stroke="rgb(var(--alf-primary))"
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}
