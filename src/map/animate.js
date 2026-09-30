import gsap from 'gsap';
import { FLOW_BY_ID } from '../data/flows.js';
import { METRIC } from './layout.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The map's motion.
 *
 * Two things are animated and nothing else. The map draws itself once, in cycle
 * order, so the first thing a visitor sees is the company running from Develop
 * to Listen rather than a finished diagram. And selecting a tool sends a pulse
 * down each link it touches, which answers "what feeds this, and what does it
 * feed" faster than reading the panel does.
 *
 * Everything here is skipped under prefers-reduced-motion: the map is already
 * complete and readable without a single tween.
 */

/** Orders links by the step they leave from, so the map fills in cycle order. */
function orderOf(rows, stations, link) {
  const station = stations.get(link.from);
  if (!station) return 0;
  return rows.indexOf(station.row);
}

export function createMapAnimation({ map, rows, stations, prefersReducedMotion }) {
  const context = gsap.context(() => {});
  const timeline = gsap.timeline();
  let pulseTween = null;
  const pulses = [];

  function clearPulses() {
    pulseTween?.kill();
    pulseTween = null;
    for (const dot of pulses.splice(0)) dot.remove();
  }

  function playIntro() {
    if (prefersReducedMotion) return;

    const linkEntries = [...map.linkEls.values()].sort(
      (a, b) => orderOf(rows, stations, a.link) - orderOf(rows, stations, b.link),
    );

    // Lines draw by running their dash offset out to zero. No plugin needed:
    // the path's own length is the whole trick.
    for (const entry of linkEntries) {
      const length = entry.line.getTotalLength();
      entry.lengths = length;
      for (const path of [entry.line, entry.casing]) {
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length}`;
      }
      entry.arrow.style.opacity = '0';
    }

    gsap.set([...map.stationEls.values()].map((e) => e.group), { scale: 0, transformOrigin: 'center' });
    gsap.set([...map.stationEls.values()].map((e) => e.label), { opacity: 0, x: -8 });
    gsap.set([...map.rowEls.values()].map((e) => e.header), { opacity: 0, x: -14 });
    gsap.set([...map.laneEls.values()].map((e) => e.header), { opacity: 0, y: -8 });

    timeline
      .to([...map.laneEls.values()].map((e) => e.header), {
        opacity: 1,
        y: 0,
        duration: 0.4,
        stagger: 0.05,
        ease: 'power2.out',
      })
      .to(
        [...map.rowEls.values()].map((e) => e.header),
        { opacity: 1, x: 0, duration: 0.45, stagger: 0.07, ease: 'power2.out' },
        0.1,
      );

    linkEntries.forEach((entry, index) => {
      const at = 0.5 + index * 0.075;
      timeline.to(
        [entry.line, entry.casing],
        {
          strokeDashoffset: 0,
          duration: 0.7,
          ease: 'power1.inOut',
          // Hand the dash back to the stylesheet once the line is drawn, or the
          // inline dasharray this animation needs would leave planned links
          // looking solid - and solid is what 'already built' means here.
          onComplete() {
            for (const path of [entry.line, entry.casing]) {
              path.style.removeProperty('stroke-dasharray');
              path.style.removeProperty('stroke-dashoffset');
            }
          },
        },
        at,
      );
      timeline.to(entry.arrow, { opacity: 1, duration: 0.25 }, at + 0.6);
    });

    // Stations land after the lines that reach them, in the same cycle order.
    const stationEntries = [...map.stationEls.values()].sort(
      (a, b) => rows.indexOf(a.station.row) - rows.indexOf(b.station.row),
    );
    stationEntries.forEach((entry, index) => {
      const at = 0.7 + index * 0.06;
      timeline.to(entry.group, { scale: 1, duration: 0.45, ease: 'back.out(2)' }, at);
      timeline.to(entry.label, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out' }, at + 0.1);
    });
  }

  /**
   * Sends a dot down every link touching the selected tool, in the direction the
   * work actually travels. Planned links stay still, because nothing flows yet.
   */
  function pulseFor(appId) {
    clearPulses();
    if (prefersReducedMotion || !appId) return;

    const entries = [...map.linkEls.values()].filter(
      (entry) =>
        !entry.link.ghost && (entry.link.from === appId || entry.link.to === appId),
    );
    if (entries.length === 0) return;

    const layer = map.canvas.querySelector('.map__lines');
    const travellers = entries.map((entry) => {
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('class', 'map__pulse');
      dot.setAttribute('r', String(METRIC.stationRadius - 3));
      dot.setAttribute('fill', FLOW_BY_ID[entry.link.flow].color);
      layer.append(dot);
      pulses.push(dot);
      return { dot, path: entry.line, length: entry.line.getTotalLength() };
    });

    const progress = { value: 0 };
    pulseTween = gsap.to(progress, {
      value: 1,
      duration: 1.5,
      repeat: -1,
      repeatDelay: 0.25,
      ease: 'power1.inOut',
      onUpdate() {
        for (const traveller of travellers) {
          const point = traveller.path.getPointAtLength(progress.value * traveller.length);
          traveller.dot.setAttribute('cx', point.x);
          traveller.dot.setAttribute('cy', point.y);
          // Fade in and out at the ends so the dot is absorbed by the stations
          // rather than blinking out mid-air.
          const edge = Math.min(progress.value, 1 - progress.value);
          traveller.dot.setAttribute('opacity', String(Math.min(1, edge / 0.12)));
        }
      },
    });
  }

  return {
    playIntro,
    pulseFor,
    destroy() {
      clearPulses();
      timeline.kill();
      context.revert();
    },
  };
}

/** The strip view gets one gentle stagger and nothing more. */
export function playStripIntro(container, prefersReducedMotion) {
  if (prefersReducedMotion) return () => {};

  const tween = gsap.from(container.querySelectorAll('.strip__header, .strip__station'), {
    opacity: 0,
    y: 10,
    duration: 0.4,
    stagger: 0.035,
    ease: 'power2.out',
    clearProps: 'all',
  });

  return () => tween.kill();
}
