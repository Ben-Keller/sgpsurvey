import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Group } from "../types";
import { sectionAccentStyle } from "../lib/sectionAccent";

const kindIcon: Record<string, string> = { dimension: "◫", single_choice: "●", ordinal_choice: "↕", multi_select: "≡", language_need: "≡", matrix_frequency: "⌁", matrix_rating: "⌁", qualitative: "✎" };

export function QuestionNavigator({ group, active, visible, filtersQuery, drawerOpen = false, onNavigate }: { group: Group; active: number; visible: number; filtersQuery: string; drawerOpen?: boolean; onNavigate?: (questionNumber: number) => void }) {
  const navigation = useRef<HTMLElement>(null);
  const orientedSection = useRef("");
  const [indicator, setIndicator] = useState({ top: 0, height: 0, shown: false });
  const sections = [...new Set(group.questions.map((question) => question.section))];
  const visibleSection = group.questions.find((question) => question.number === visible)?.section;
  const visibleSectionIndex = Math.max(0, sections.indexOf(visibleSection ?? sections[0]));

  useLayoutEffect(() => {
    const nav = navigation.current;
    const link = nav?.querySelector<HTMLElement>(`[data-question-link="${visible}"]`);
    if (!nav || !link) return;
    const sectionKey = `${group.key}:${visibleSection ?? ""}`;
    const shouldOrientSection = orientedSection.current !== sectionKey;
    orientedSection.current = sectionKey;
    let orientPending = shouldOrientSection;
    const update = () => {
      const navRect = nav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      setIndicator({ top: linkRect.top - navRect.top, height: linkRect.height, shown: true });
      const shell = nav.closest<HTMLElement>(".navigator-shell");
      if (!shell || (matchMedia("(max-width: 900px)").matches && !drawerOpen)) return;
      const shellRect = shell.getBoundingClientRect();
      if (orientPending) {
        const summary = link.closest("details")?.querySelector<HTMLElement>("summary");
        if (summary) {
          orientPending = false;
          const titleHeight = shell.querySelector<HTMLElement>(".rail-stakeholder-title.is-visible")?.offsetHeight ?? 0;
          const summaryRect = summary.getBoundingClientRect();
          const targetTop = shell.scrollTop + summaryRect.top - shellRect.top - titleHeight - 14;
          shell.scrollTo({ top: Math.max(0, targetTop), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          return;
        }
      }
      if (linkRect.top < shellRect.top + 24) shell.scrollTo({ top: shell.scrollTop - (shellRect.top + 24 - linkRect.top), behavior: "auto" });
      else if (linkRect.bottom > shellRect.bottom - 24) shell.scrollTo({ top: shell.scrollTop + (linkRect.bottom - shellRect.bottom + 24), behavior: "auto" });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [group, visible, visibleSection, drawerOpen]);

  return <nav ref={navigation} className="question-nav" aria-label={`${group.label} questions`}><div className="question-nav-indicator" data-question-number={visible} aria-hidden="true" style={{ ...sectionAccentStyle(group.key, visibleSectionIndex), height: `${indicator.height}px`, transform: `translate3d(0, ${indicator.top}px, 0)`, opacity: indicator.shown ? 1 : 0 }} />{sections.map((section, sectionIndex) => <details key={section} open style={sectionAccentStyle(group.key, sectionIndex)}><summary>{section}</summary><ol>{group.questions.filter((question) => question.section === section).map((question) => <li key={question.id}><Link className={question.number === visible ? "is-visible" : undefined} data-question-link={question.number} aria-current={question.number === active ? "page" : undefined} to={`/${slug(group.key)}/q${question.number}${filtersQuery}`} onClick={() => onNavigate?.(question.number)}><span aria-hidden="true">{kindIcon[question.kind] ?? "•"}</span><span><strong>Q{question.number}</strong> {question.prompt}</span></Link></li>)}</ol></details>)}</nav>;
}

export function slug(key: string) {
  return ({ country_team: "country-teams", grantee_partners: "grantee-partners", implementing_agencies: "implementing-agencies", steering_committee: "steering-committees" } as Record<string, string>)[key];
}
