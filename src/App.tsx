import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import manifestJson from "../question-manifest.json";
import type { ChartType, DataBundle, Group, Manifest, Question } from "./types";
import { filterRespondents } from "./lib/analysis";
import { Filters } from "./components/Filters";
import { QuestionNavigator, slug } from "./components/QuestionNavigator";
import { VirtualQuestionSection } from "./components/QuestionStream";
import { availableChartTypes } from "./lib/charts";
import { downloadSurveyPdf } from "./lib/pdfExport";
import { FilterIcon, MenuIcon, PdfDownloadIcon, QuestionsIcon, ShareIcon } from "./components/HeaderIcons";
import { sectionAccentStyle } from "./lib/sectionAccent";

const manifest = manifestJson as Manifest;
const groupBySlug = new Map(manifest.groups.map((group) => [slug(group.key), group]));
const dataMode = (import.meta.env.VITE_DATA_MODE === "internal" ? "internal" : "public") as "public" | "internal";
const bundleRequests = new Map<string, Promise<DataBundle>>();

function loadBundle(group: Group) {
  const existing = bundleRequests.get(group.key);
  if (existing) return existing;
  const dataUrl = `${import.meta.env.BASE_URL}data/${dataMode}/${slug(group.key)}.json?v=${encodeURIComponent(manifest.schemaVersion)}`;
  const request = fetch(dataUrl, { cache: "no-store" })
    .then((response) => { if (!response.ok) throw new Error(`Data request failed (${response.status})`); return response.json() as Promise<DataBundle>; })
    .then((data) => {
      if (data.schemaVersion !== manifest.schemaVersion) throw new Error("The data and question manifest versions do not match.");
      return data;
    });
  bundleRequests.set(group.key, request);
  return request;
}

function decodeFilters(params: URLSearchParams, group: Group) {
  return Object.fromEntries(group.filters.map((filter) => [filter.key, params.getAll(`filter.${filter.key}`)]).filter(([, values]) => values.length)) as Record<string, string[]>;
}

function Explorer() {
  const { groupSlug = "", questionSlug = "" } = useParams();
  const group = groupBySlug.get(groupSlug);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const number = Number(questionSlug.replace(/^q/, ""));
  const [bundles, setBundles] = useState<Record<string, DataBundle>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [mastheadPassed, setMastheadPassed] = useState(false);
  const [chartSelections, setChartSelections] = useState<Record<string, ChartType>>(() => Object.fromEntries(
    manifest.groups.flatMap((manifestGroup) => manifestGroup.questions.map((manifestQuestion) => {
      const saved = sessionStorage.getItem(`chart-selection:${manifestQuestion.id}`) as ChartType | null;
      return saved && availableChartTypes(manifestQuestion).includes(saved) ? [[manifestQuestion.id, saved]] : [];
    }))
  ));
  const [visibleQuestion, setVisibleQuestion] = useState(number);
  const programmaticTarget = useRef<number | null>(number);
  const scrollDrivenTarget = useRef<number | null>(null);
  const initializedGroup = useRef("");
  const mastheadPassedRef = useRef(false);

  useEffect(() => {
    const overlayOpen = filtersOpen || navOpen || mobileMenuOpen;
    if (!overlayOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFiltersOpen(false);
      setNavOpen(false);
      setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [filtersOpen, navOpen, mobileMenuOpen]);

  const question = group?.questions.find((item) => item.number === number);
  const filterSignature = [...params.entries()].filter(([key]) => key.startsWith("filter.")).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
  const filters = useMemo(() => {
    const currentGroup = groupBySlug.get(groupSlug);
    return currentGroup ? decodeFilters(new URLSearchParams(filterSignature), currentGroup) : {};
  }, [filterSignature, groupSlug]);

  useEffect(() => {
    if (!group) return;
    let cancelled = false;
    const orderedGroups = [group, ...manifest.groups.filter((item) => item.key !== group.key)];
    orderedGroups.forEach((targetGroup) => {
      void loadBundle(targetGroup)
        .then((data) => {
          if (!cancelled) setBundles((current) => current[targetGroup.key] ? current : { ...current, [targetGroup.key]: data });
        })
        .catch((reason) => {
          if (!cancelled) setErrors((current) => ({ ...current, [targetGroup.key]: reason instanceof Error ? reason.message : "Unable to load survey data." }));
        });
    });
    return () => { cancelled = true; };
  }, [group]);

  useEffect(() => {
    if (!group || !matchMedia("(max-width: 620px)").matches) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`.stakeholder-tabs a[data-group="${group.key}"]`)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest", inline: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [group]);

  const updateFilters = (next: Record<string, string[]>) => {
    const updated = new URLSearchParams(params);
    group?.filters.forEach((filter) => updated.delete(`filter.${filter.key}`));
    Object.entries(next).forEach(([key, values]) => values.forEach((value) => updated.append(`filter.${key}`, value)));
    setParams(updated, { replace: true });
    setLiveMessage("Filters updated");
  };

  const scrollToQuestion = useCallback((questionNumber: number, behavior: ScrollBehavior = "smooth", focus = true) => {
    requestAnimationFrame(() => {
      const target = document.getElementById(`question-${questionNumber}`);
      if (!target) return;
      const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-header-height")) || 72;
      const subsectionHeight = document.querySelector<HTMLElement>(".subsection-marker")?.getBoundingClientRect().height ?? 0;
      const top = window.scrollY + target.getBoundingClientRect().top - headerHeight - subsectionHeight - 12;
      window.scrollTo({ top, behavior });
      if (focus) {
        const delay = behavior === "smooth" && !matchMedia("(prefers-reduced-motion: reduce)").matches ? 450 : 0;
        window.setTimeout(() => target.querySelector<HTMLElement>("[data-question-heading]")?.focus({ preventScroll: true }), delay);
      }
    });
  }, []);

  useEffect(() => {
    const releaseProgrammaticNavigation = () => {
      programmaticTarget.current = null;
    };
    const releaseForScrollingKey = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) releaseProgrammaticNavigation();
    };
    window.addEventListener("wheel", releaseProgrammaticNavigation, { passive: true, capture: true });
    window.addEventListener("touchstart", releaseProgrammaticNavigation, { passive: true, capture: true });
    window.addEventListener("pointerdown", releaseProgrammaticNavigation, { passive: true, capture: true });
    window.addEventListener("keydown", releaseForScrollingKey, { capture: true });
    return () => {
      window.removeEventListener("wheel", releaseProgrammaticNavigation, { capture: true });
      window.removeEventListener("touchstart", releaseProgrammaticNavigation, { capture: true });
      window.removeEventListener("pointerdown", releaseProgrammaticNavigation, { capture: true });
      window.removeEventListener("keydown", releaseForScrollingKey, { capture: true });
    };
  }, []);

  const setChart = useCallback((targetQuestion: Question, chart: ChartType) => {
    setChartSelections((current) => ({ ...current, [targetQuestion.id]: chart }));
    sessionStorage.setItem(`chart-selection:${targetQuestion.id}`, chart);
    const updated = new URLSearchParams(params);
    if (chart === targetQuestion.chart.default) updated.delete("chart"); else updated.set("chart", chart);
    const query = updated.toString();
    navigate(`/${groupSlug}/q${targetQuestion.number}${query ? `?${query}` : ""}`, { replace: true });
    setLiveMessage(`${chart.replaceAll("_", " ")} chart selected`);
  }, [params, navigate, groupSlug, setLiveMessage, setChartSelections]);

  const activeBundle = group ? bundles[group.key] ?? null : null;
  const activeError = group ? errors[group.key] ?? "" : "";
  const filtered = useMemo(() => activeBundle ? filterRespondents(activeBundle.respondents, filters) : [], [activeBundle, filters]);
  const requestedChart = params.get("chart") as ChartType | null;
  const index = group && question ? group.questions.indexOf(question) : -1;
  const activeFilterCount = Object.values(filters).reduce((sum, values) => sum + values.length, 0);
  const filterParams = new URLSearchParams(params);
  filterParams.delete("chart");
  const preservedQuery = filterParams.toString() ? `?${filterParams.toString()}` : "";

  useEffect(() => {
    if (!question || !requestedChart || !availableChartTypes(question).includes(requestedChart)) return;
    sessionStorage.setItem(`chart-selection:${question.id}`, requestedChart);
  }, [question, requestedChart]);

  useEffect(() => {
    if (!group || !question || !activeBundle) return;
    sessionStorage.setItem(`last-question:${group.key}`, String(question.number));
    const isInitialGroup = initializedGroup.current !== group.key;
    if (scrollDrivenTarget.current === question.number) {
      scrollDrivenTarget.current = null;
      return;
    }
    initializedGroup.current = group.key;
    if (isInitialGroup && question.number === group.questions[0].number) {
      programmaticTarget.current = null;
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
      return;
    }
    programmaticTarget.current = question.number;
    const behavior = isInitialGroup ? "auto" : "smooth";
    scrollToQuestion(question.number, behavior, !isInitialGroup);
    let settle = 0;
    let release = 0;
    let layoutObserver: ResizeObserver | null = null;
    const stopWatchingScroll = () => window.removeEventListener("scroll", waitForScrollToSettle);
    const finishNavigation = () => {
      stopWatchingScroll();
      if (programmaticTarget.current !== question.number) return;
      scrollToQuestion(question.number, "auto", !isInitialGroup);
      window.clearTimeout(release);
      release = window.setTimeout(() => {
        if (programmaticTarget.current === question.number) programmaticTarget.current = null;
      }, 120);
    };
    const waitForScrollToSettle = () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(finishNavigation, 320);
    };
    if (!isInitialGroup) window.addEventListener("scroll", waitForScrollToSettle, { passive: true });
    const stream = document.querySelector(".question-stream");
    if (stream) {
      layoutObserver = new ResizeObserver(waitForScrollToSettle);
      layoutObserver.observe(stream);
    }
    settle = window.setTimeout(finishNavigation, isInitialGroup ? 1200 : 1600);
    return () => {
      stopWatchingScroll();
      layoutObserver?.disconnect();
      window.clearTimeout(settle);
      window.clearTimeout(release);
    };
  }, [group, question, activeBundle, scrollToQuestion]);

  const onBecomeActive = useCallback((nextQuestion: Question) => {
    setVisibleQuestion((current) => current === nextQuestion.number ? current : nextQuestion.number);
    if (!group || nextQuestion.number === number) return;
    if (programmaticTarget.current !== null) return;
    const updated = new URLSearchParams(params);
    updated.delete("chart");
    const query = updated.toString();
    scrollDrivenTarget.current = nextQuestion.number;
    navigate(`/${groupSlug}/q${nextQuestion.number}${query ? `?${query}` : ""}`, { replace: true });
    sessionStorage.setItem(`last-question:${group.key}`, String(nextQuestion.number));
  }, [group, number, params, navigate, groupSlug, setVisibleQuestion]);

  useEffect(() => {
    if (!group || !activeBundle) return;
    let frame = 0;
    const updateVisibleQuestion = () => {
      frame = 0;
      const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-header-height")) || 72;
      const readingLine = headerHeight + Math.max(110, Math.min(220, (window.innerHeight - headerHeight - 70) * .3));
      let nearest: Question | undefined;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const candidate of group.questions) {
        const element = document.getElementById(`question-${candidate.number}`);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        const distance = readingLine < rect.top ? rect.top - readingLine : readingLine > rect.bottom ? readingLine - rect.bottom : 0;
        if (distance < nearestDistance) {
          nearest = candidate;
          nearestDistance = distance;
        }
      }
      if (nearest) onBecomeActive(nearest);
    };
    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateVisibleQuestion);
    };
    const stream = document.querySelector(".question-stream");
    const resizeObserver = stream ? new ResizeObserver(scheduleUpdate) : null;
    if (stream) resizeObserver?.observe(stream);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    scheduleUpdate();
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver?.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [group, activeBundle, onBecomeActive]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const masthead = document.querySelector<HTMLElement>(".survey-masthead");
      const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-header-height")) || 72;
      const passed = Boolean(masthead && masthead.getBoundingClientRect().bottom <= headerHeight + 1);
      if (mastheadPassedRef.current && !passed) {
        document.querySelector<HTMLElement>(".navigator-shell")?.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
      mastheadPassedRef.current = passed;
      setMastheadPassed(passed);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.cancelAnimationFrame(frame);
    };
  }, [group?.key]);

  const prepareQuestionNavigation = (questionNumber: number) => {
    programmaticTarget.current = questionNumber;
    setNavOpen(false);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (!group || !question) return;
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName) || target.isContentEditable) return;
      if (event.key === "ArrowLeft" && index > 0) {
        const previous = group.questions[index - 1].number;
        programmaticTarget.current = previous;
        navigate(`/${groupSlug}/q${previous}${preservedQuery}`);
      }
      if (event.key === "ArrowRight" && index < group.questions.length - 1) {
        const next = group.questions[index + 1].number;
        programmaticTarget.current = next;
        navigate(`/${groupSlug}/q${next}${preservedQuery}`);
      }
      if (event.key.toLowerCase() === "c" && question.kind !== "qualitative") {
        const charts = availableChartTypes(question);
        const selected = chartSelections[question.id] ?? requestedChart;
        const current = selected && charts.includes(selected) ? selected : question.chart.default;
        setChart(question, charts[(charts.indexOf(current) + 1) % charts.length]);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [index, group, groupSlug, preservedQuery, navigate, question, requestedChart, setChart, chartSelections]);

  if (!group) return <Navigate to="/country-teams/q2" replace />;
  if (!question) return <Navigate to={`/${groupSlug}/q${group.questions[0].number}`} replace />;
  if (activeError) return <main className="fatal"><div><span className="eyebrow">Data unavailable</span><h1>We couldn’t open this survey group.</h1><p>{activeError}</p><button onClick={() => window.location.reload()}>Try again</button></div></main>;
  if (!activeBundle) return <main className="loading" aria-busy="true"><div className="skeleton" /><p>Loading {group.label.toLowerCase()}…</p></main>;

  const share = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setLiveMessage("Share link copied");
  };
  const downloadPdf = async () => {
    setExportingPdf(true);
    setExportProgress("Starting PDF...");
    try {
      const activeSelection = requestedChart && availableChartTypes(question).includes(requestedChart) ? requestedChart : undefined;
      await downloadSurveyPdf({
        manifest,
        dataMode,
        baseUrl: import.meta.env.BASE_URL,
        chartSelections: activeSelection ? { ...chartSelections, [question.id]: activeSelection } : chartSelections,
        onProgress: (message) => { setExportProgress(message); setLiveMessage(message); }
      });
      setLiveMessage("PDF downloaded");
    } catch (reason) {
      console.error(reason);
      setLiveMessage(reason instanceof Error ? reason.message : "Unable to create PDF");
    } finally {
      setExportingPdf(false);
      setExportProgress("");
    }
  };
  const sectionNames = [...new Set(group.questions.map((item) => item.section))];
  return <div className="app-shell" data-stakeholder={group.key}>
    <header className="site-header">
      <div className="site-logo"><img src={`${import.meta.env.BASE_URL}branding/sgp-logo.png`} alt="GEF Small Grants Programme" /></div>
      <nav className="stakeholder-tabs" aria-label="Stakeholder groups">{manifest.groups.map((item) => { const destination = item.key === group.key ? question.number : item.questions[0].number; return <Link key={item.key} data-group={item.key} className={item.key === group.key ? "active" : ""} aria-current={item.key === group.key ? "page" : undefined} onClick={() => { if (item.key !== group.key) { programmaticTarget.current = destination; setVisibleQuestion(destination); } }} to={`/${slug(item.key)}/q${destination}`}>{item.label}<span>{item.respondentCount}</span></Link>; })}</nav>
      <nav className="header-actions" aria-label="Global">{activeFilterCount > 0 && <button className="text-button" onClick={() => updateFilters({})}>Reset {activeFilterCount}</button>}<button className="filter-button header-icon-button" aria-label="Filters" title="Filters" onClick={() => setFiltersOpen(true)}><FilterIcon />{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button><details className="share-menu"><summary className="share-button" aria-label="Share" title="Share"><ShareIcon /></summary><div><button onClick={(event) => { void share(); event.currentTarget.closest("details")?.removeAttribute("open"); }}>Copy link</button></div></details><button className="header-icon-button has-file-tooltip" aria-label={exportingPdf ? "Preparing PDF" : "Download PDF"} data-tooltip="Download PDF report" onClick={() => void downloadPdf()} disabled={exportingPdf}><PdfDownloadIcon /></button></nav>
      <button className="mobile-menu-trigger mobile-only" aria-label="Open menu" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}><MenuIcon />{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button>
    </header>
    {mobileMenuOpen && <div className="mobile-menu-backdrop mobile-only" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setMobileMenuOpen(false)}><aside className="mobile-app-menu" role="dialog" aria-modal="true" aria-labelledby="mobile-menu-heading"><header><div><span>KLP Survey</span><h2 id="mobile-menu-heading">Menu</h2></div><button className="icon-button" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}>×</button></header><div className="mobile-menu-actions"><button onClick={() => { setMobileMenuOpen(false); setNavOpen(true); }}><QuestionsIcon /><span><strong>Questions</strong><small>Browse this survey section</small></span></button><button onClick={() => { setMobileMenuOpen(false); setFiltersOpen(true); }}><FilterIcon /><span><strong>Filters</strong><small>{activeFilterCount ? `${activeFilterCount} selected` : "Refine the responses"}</small></span></button><button onClick={() => { setMobileMenuOpen(false); void share(); }}><ShareIcon /><span><strong>Copy link</strong><small>Share this exact view</small></span></button><button disabled={exportingPdf} onClick={() => { setMobileMenuOpen(false); void downloadPdf(); }}><PdfDownloadIcon /><span><strong>{exportingPdf ? "Preparing PDF" : "Download PDF"}</strong><small>All tabs and selected charts</small></span></button></div>{activeFilterCount > 0 && <button className="mobile-reset" onClick={() => { updateFilters({}); setMobileMenuOpen(false); }}>Reset {activeFilterCount} selected filter{activeFilterCount === 1 ? "" : "s"}</button>}</aside></div>}
    {activeFilterCount > 0 && <div className="filter-chips">{Object.entries(filters).flatMap(([key, values]) => values.map((value) => <button key={`${key}:${value}`} onClick={() => updateFilters({ ...filters, [key]: values.filter((item) => item !== value) })}>{value} <span aria-hidden="true">×</span></button>))}</div>}
    <section className="survey-masthead" aria-labelledby="survey-stakeholder-title">
      <div className="survey-masthead__inner">
        <p>SGP Knowledge and Learning Platform Survey</p>
        <h1 id="survey-stakeholder-title">{group.label}</h1>
      </div>
    </section>
    <div className="explorer-layout">
      <aside className={`navigator-shell${navOpen ? " open" : ""}${mastheadPassed ? " has-stakeholder-title" : ""}`}><div className="mobile-drawer-heading mobile-only"><div><span>KLP Survey</span><strong>{group.label} questions</strong></div><button className="icon-button" aria-label="Close questions" onClick={() => setNavOpen(false)}>×</button></div><div className={mastheadPassed ? "rail-stakeholder-title is-visible" : "rail-stakeholder-title"}><span>KLP Survey</span><strong>{group.label}</strong></div><QuestionNavigator group={group} active={question.number} visible={visibleQuestion} filtersQuery={preservedQuery} drawerOpen={navOpen} onNavigate={prepareQuestionNavigation} /></aside>
      <main id="main-content" className="workspace">
        <div key={group.key} className="question-stream tab-transition" aria-label={`${group.label} question stream`}>
          {sectionNames.map((sectionName, sectionIndex) => <section key={sectionName} className="question-subsection" aria-labelledby={`subsection-${group.key}-${sectionIndex}`} style={sectionAccentStyle(group.key, sectionIndex)}><header className="subsection-marker"><div><span>Subsection</span><h2 id={`subsection-${group.key}-${sectionIndex}`}>{sectionName}</h2></div></header>{group.questions.filter((streamQuestion) => streamQuestion.section === sectionName).map((streamQuestion) => <VirtualQuestionSection key={streamQuestion.id} question={streamQuestion} respondents={filtered} bundle={activeBundle} active={streamQuestion.number === question.number} requestedChart={streamQuestion.number === question.number && requestedChart ? requestedChart : chartSelections[streamQuestion.id] ?? null} groupKey={group.key} sectionIndex={sectionIndex} onChartChange={setChart} onResetFilters={() => updateFilters({})} />)}</section>)}
        </div>
      </main>
    </div>
    <nav className="sticky-nav" aria-label="Sequential question navigation"><div>{index > 0 ? <Link aria-label="Previous question" title="Previous question" onClick={() => prepareQuestionNavigation(group.questions[index - 1].number)} to={`/${groupSlug}/q${group.questions[index - 1].number}${preservedQuery}`}>←</Link> : <span />}</div><span><strong>{index + 1}</strong> of {group.questions.length}</span><div>{index < group.questions.length - 1 ? <Link aria-label="Next question" title="Next question" onClick={() => prepareQuestionNavigation(group.questions[index + 1].number)} to={`/${groupSlug}/q${group.questions[index + 1].number}${preservedQuery}`}>→</Link> : <span />}</div></nav>
    {filtersOpen && <Filters group={group} respondents={activeBundle.respondents} filters={filters} onChange={updateFilters} onClose={() => setFiltersOpen(false)} />}
    {exportingPdf && <div className="pdf-export-status" role="status"><span /><strong>Preparing complete PDF</strong><small>{exportProgress}</small></div>}
    <div className="sr-only" aria-live="polite">{liveMessage}</div>
  </div>;
}

function Home() {
  const last = sessionStorage.getItem("last-question:country_team") ?? "2";
  return <Navigate to={`/country-teams/q${last}`} replace />;
}

export default function App() {
  return <Routes><Route path="/" element={<Home />} /><Route path="/:groupSlug/:questionSlug" element={<Explorer />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}
