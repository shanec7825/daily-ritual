"use strict";

(() => {
  const storagePrefix = "early-evening-ritual.v1/";
  const byId = id => document.getElementById(id);
  const modeOptions = document.querySelectorAll("[data-mode-option]");
  const title = byId("action-title");
  const complete = byId("complete-action");
  const startBreath = byId("start-breath");
  const skip = byId("skip-action");
  const undoSkip = byId("undo-skip");
  const actionOptions = byId("action-options");
  const scene = byId("ritual-scene");
  const birdDetails = byId("bird-details");
  const feedback = byId("completion-feedback");
  const actionSketch = byId("action-sketch");
  const motionPreference = matchMedia("(prefers-reduced-motion: no-preference)");
  const moving = new Map();
  const supplementPanel = byId("supplement-panel");
  const supplementItems = byId("supplement-items");
  const supplementDialog = byId("supplement-dialog");
  const supplementSettings = byId("supplement-settings");
  const supplementForm = byId("supplement-form");
  const noteDetails = byId("night-note");
  const noteForm = byId("note-form");
  const breathDialog = byId("breath-dialog");
  const announcements = byId("action-announcement");
  const historyView = byId("history-view");
  const historyHabit = byId("history-habit");
  const historyGrid = byId("habit-heatmap");
  const historyDetail = byId("heatmap-detail");
  const displayDate = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" });
  const shortDate = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" });
  const asDate = key => new Date(`${key}T12:00:00`);

  let timeBand = Ritual.defaultMode(new Date());
  let mode = timeBand;
  let day = Ritual.activeDay(mode, new Date());
  let selected;
  let store = { days: {}, supplements: {} };
  let canPersist = true;
  let lastSkip;
  let completion;
  let grainTimer;
  let breathTimer;
  let breathStart;
  let noteContext;
  let noteBaseline;
  let editingSupplement;
  let historyRange = "month";
  let historyOffset = 0;
  let historyDay;
  const habitDialog = byId("habit-dialog");
  const stepIcon = id => id === "water" ? "water" : id === "walk" ? "walk" : id.startsWith("custom-") ? "brand" : id;

  function saveUnavailable() {
    canPersist = false;
    byId("storage-warning").hidden = false;
  }

  function load() {
    if (!canPersist) return;
    try {
      const loaded = { days: {}, supplements: {} };
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(storagePrefix)) Ritual.readEntry(loaded, key.slice(storagePrefix.length), localStorage.getItem(key));
      }
      store = loaded;
    } catch {
      saveUnavailable();
    }
  }

  function persist(path, value) {
    if (!canPersist) return false;
    try {
      if (value) localStorage.setItem(storagePrefix + path, value);
      else localStorage.removeItem(storagePrefix + path);
      return true;
    } catch {
      saveUnavailable();
      return false;
    }
  }

  function updateAction(id, status, expectedStatus) {
    load();
    const actions = Ritual.getActions(store, day, mode);
    if (actions[id]?.status === status) return false;
    if (expectedStatus && actions[id]?.status !== expectedStatus) return false;
    Ritual.saveAction(store, day, mode, id, status);
    const entry = Ritual.getActions(store, day, mode)[id];
    persist(`${day}/${mode}/${id}`, entry ? JSON.stringify(entry) : "");
    return true;
  }

  function getStep() {
    return Ritual.currentAction(mode, Ritual.getActions(store, day, mode), completion?.id ?? selected, store);
  }

  function focusAction(scroll = false) {
    title.focus({ preventScroll: true });
    if (scroll) byId("action-card").scrollIntoView({ block: "nearest" });
  }

  function setDate(element, key, formatter) {
    element.dateTime = key;
    element.textContent = formatter.format(asDate(key));
  }

  function announce(message) {
    announcements.textContent = message;
  }

  function icon(id, className = "line-icon") {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    const use = document.createElementNS(namespace, "use");
    svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    use.setAttribute("href", `#icon-${id}`);
    svg.append(use);
    return svg;
  }

  function animateUI(element, keyframes, options) {
    moving.get(element)?.cancel();
    if (!motionPreference.matches || !window.Motion?.animate || !element) return;
    const player = window.Motion.animate(element, keyframes, options);
    moving.set(element, player);
    player.then(() => {
      if (moving.get(element) === player) moving.delete(element);
    });
  }

  function revealAction(direction = 1) {
    animateUI(actionSketch, {
      opacity: [0.45, 1],
      transform: [`translateX(${direction * 10}px)`, "translateX(0px)"]
    }, { duration: 0.26, ease: [0.2, 0.65, 0.3, 1] });
  }

  function confirmAction() {
    animateUI(complete.querySelector(".check-disc"), {
      opacity: [0.5, 1], transform: ["scale(.985)", "scale(1)"]
    }, { duration: 0.19, ease: "easeOut" });
  }

  function clearCompletion() {
    clearTimeout(grainTimer);
    delete scene.dataset.instantGrain;
    if (!completion) return;
    clearTimeout(completion.timer);
    const actions = Ritual.getActions(store, day, mode);
    selected = actions[completion.id]?.status === "done" ? Ritual.nextAction(store, mode, actions, completion.id) : undefined;
    completion = undefined;
  }

  function advanceAfterCompletion() {
    if (!completion) return;
    const returnFocus = document.activeElement === complete;
    clearCompletion();
    if (!syncDay()) {
      renderAction();
      revealAction();
    }
    if (returnFocus && !byId("daily-view").hidden) {
      if (complete.hidden) focusAction();
      else announce("下一项，" + title.textContent);
    }
  }

  function render({ refreshNote = false } = {}) {
    document.documentElement.dataset.mode = mode;
    document.documentElement.dataset.theme = mode === "morning" ? "paper-dawn" : "paper-night";
    for (const button of modeOptions) button.setAttribute("aria-pressed", String(mode === button.dataset.modeOption));
    byId("top-date").dateTime = day;
    byId("top-month-day").textContent = displayDate.format(asDate(day));
    const weekday = byId("top-weekday");
    weekday.lang = Ritual.journalLanguage(day).lang;
    weekday.textContent = asDate(day).toLocaleDateString(weekday.lang, { weekday: "long" });
    renderAction();
    renderSupplements();
    if (supplementDialog.open) renderSupplementSettings();
    renderNote(refreshNote);
    renderRecentNotes();
    if (!historyView.hidden) renderHeatmap();
    if (habitDialog.open) renderHabitSettings();
  }

  function renderAction() {
    const actions = Ritual.getActions(store, day, mode);
    const choices = Ritual.getSteps(store, mode);
    if (completion && (actions[completion.id]?.status !== "done" || !choices.some(item => item.id === completion.id))) clearCompletion();
    const step = getStep();
    const status = actions[step.id]?.status;
    const done = status === "done";
    if (lastSkip && actions[lastSkip]?.status !== "skipped") lastSkip = undefined;
    const finished = step.id === "finished";
    byId("action-card").dataset.state = finished && choices.length ? "finished" : status ?? "ready";
    byId("action-name").textContent = finished ? "" : step.title;
    const roundTitle = byId("round-title");
    roundTitle.hidden = !finished;
    roundTitle.textContent = finished ? step.title : "";
    const drawing = finished || step.id.startsWith("custom-") ? "sprig" : step.id;
    actionSketch.firstElementChild.setAttribute("href", "#drawing-" + drawing);
    const description = byId("action-description");
    const language = Ritual.journalLanguage(day);
    const translated = !status && step.prompt && language.prompts[step.id];
    description.lang = translated ? language.lang : "zh-CN";
    description.textContent = (done ? step.done : status === "skipped" ? "已跳过，可随时补做。" : translated || step.prompt) ?? "";
    description.hidden = !description.textContent;
    complete.setAttribute("aria-pressed", String(done));
    complete.title = completion ? "已完成" : done ? "撤销完成" : "完成";
    byId("complete-glyph").setAttribute("href", done && !completion ? "#icon-undo" : "#icon-check");
    complete.setAttribute("aria-label", completion ? `${step.label}已完成，已喂一粒谷物` : `${complete.title} · ${step.label}`);
    scene.classList.toggle("feeding", Boolean(completion));
    if (scene.dataset.instantGrain && actions[scene.dataset.instantGrain]?.status !== "done") delete scene.dataset.instantGrain;
    if (completion) complete.setAttribute("aria-disabled", "true");
    else complete.removeAttribute("aria-disabled");
    complete.disabled = finished;
    complete.hidden = finished;
    startBreath.hidden = done || step.id !== "breath";
    const focused = document.activeElement;
    skip.hidden = finished || status !== undefined;
    undoSkip.hidden = !lastSkip;
    actionOptions.hidden = skip.hidden && undoSkip.hidden;
    if (actionOptions.contains(focused) && (actionOptions.hidden || focused.hidden)) {
      const fallback = actionOptions.hidden ? (finished ? title : complete) : actionOptions.querySelector("summary");
      fallback.focus({ preventScroll: true });
    }

    const { done: doneCount } = Ritual.roundProgress(choices, actions);
    const { done: meals, latest } = Ritual.roundProgress(Ritual.getSteps(store, mode, true), actions);
    scene.classList.toggle("has-meals", meals > 0);
    RitualQuotes.show(byId("habit-quote"), finished ? latest?.id ?? "general" : step.id, mode, day);
    const growth = Ritual.companionGrowth(store, Ritual.activeDay("morning", new Date()));
    scene.dataset.stage = growth.stage;
    byId("bird-days").textContent = growth.days;
    byId("meal-value").textContent = meals;
    const growthLabel = `${growth.label} · 累计 ${growth.days} 天`;
    byId("bird-growth").textContent = growthLabel;
    scene.style.setProperty("--progress", choices.length ? doneCount / choices.length : 0);
    feedback.hidden = !latest;
    const period = mode === "morning" ? "今晨" : "今晚";
    const mealLabel = `${period}已喂 ${meals} 粒`;
    byId("meal-count").textContent = mealLabel;
    byId("bird-metrics").setAttribute("aria-label", `小鸟成长与喂食，${growthLabel}，${mealLabel}`);
    const fedHabit = completion ? step : latest;
    feedback.textContent = fedHabit ? `${fedHabit.label}已完成 · 喂食 +1 粒` : "";
    const meter = byId("routine-meter");
    meter.max = Math.max(1, choices.length);
    meter.value = doneCount;
    byId("routine-progress").textContent = `${doneCount} / ${choices.length}`;
    const optionList = byId("routine-actions");
    const focusedStep = optionList.contains(document.activeElement) ? document.activeElement.dataset.step : undefined;
    optionList.replaceChildren(...choices.map(item => {
      const row = document.createElement("li");
      const button = document.createElement("button");
      const label = document.createElement("span");
      const badge = document.createElement("span");
      button.type = "button";
      button.className = "btn btn-ghost habit-button";
      button.dataset.step = item.id;
      button.setAttribute("aria-pressed", String(item.id === step.id));
      label.textContent = item.label;
      const itemStatus = actions[item.id]?.status;
      if (itemStatus === "done") {
        badge.append(icon("check", "line-icon item-done"));
        const state = document.createElement("span");
        state.className = "sr-only";
        state.textContent = "已完成";
        badge.append(state);
      } else if (itemStatus === "skipped") {
        badge.textContent = "已跳过";
      }
      badge.className = "option-state";
      const tile = document.createElement("span");
      tile.className = "habit-icon";
      tile.append(icon(stepIcon(item.id)));
      button.append(tile, label, badge);
      row.append(button);
      return row;
    }));
    if (focusedStep) optionList.querySelector(`[data-step="${focusedStep}"]`)?.focus({ preventScroll: true });
  }

  function supplementCheckRow(id, label, recordedIn) {
    const row = document.createElement("li");
    const button = document.createElement("button");
    const text = document.createElement("span");
    button.type = "button";
    button.className = "btn btn-ghost supplement-item";
    button.dataset.supplementCheck = id;
    button.setAttribute("aria-pressed", String(Boolean(recordedIn)));
    text.textContent = label;
    const moved = recordedIn && recordedIn !== mode;
    if (moved) {
      const origin = document.createElement("small");
      origin.className = "supplement-origin";
      origin.textContent = recordedIn === "morning" ? "早晨已记" : "晚上已记";
      text.append(origin);
      button.title = "撤销这条记录";
    }
    button.append(text, icon("check", "line-icon item-done"));
    row.append(button);
    return row;
  }

  function renderSupplements() {
    RitualQuotes.show(byId("supplement-quote"), "supplement", mode, day);
    const configured = Object.entries(store.supplements);
    const active = configured.filter(([, item]) => item.mode === mode && !item.paused);
    const checks = Ritual.supplementChecks(store, day);
    const count = active.filter(([id]) => checks[id]).length;
    const legacyDone = Ritual.getActions(store, day, mode).supplement?.status === "done";
    const rows = active.map(([id, item]) => supplementCheckRow(id, item.name, checks[id]));
    if (!configured.length || legacyDone) {
      rows.push(supplementCheckRow("legacy", configured.length ? "原有整组记录" : "整组打卡", legacyDone ? mode : undefined));
    }
    byId("supplement-count").textContent = active.length ? `${count}/${active.length}` : legacyDone ? "已记录" : "";
    const message = byId("supplement-message");
    message.hidden = active.length > 0 || !configured.length;
    message.textContent = message.hidden ? "" : "这个时段暂无启用的补品。";
    const focused = supplementItems.contains(document.activeElement) ? document.activeElement.dataset.supplementCheck : undefined;
    supplementItems.replaceChildren(...rows);
    if (focused) {
      const next = supplementItems.querySelector(`[data-supplement-check="${focused}"]`) ?? supplementPanel.querySelector("summary");
      next.focus({ preventScroll: true });
    }
  }

  function renderSupplementSettings() {
    const active = supplementSettings.contains(document.activeElement) ? document.activeElement.dataset : null;
    supplementSettings.replaceChildren(...Object.entries(store.supplements).map(([id, item]) => {
      const row = document.createElement("li");
      const label = document.createElement("span");
      const name = document.createElement("strong");
      const metadata = document.createElement("small");
      name.textContent = item.name;
      metadata.textContent = `${item.mode === "morning" ? "早晨" : "晚上"}${item.paused ? " · 已停用" : ""}`;
      label.append(name, metadata);
      row.append(label);
      for (const [command, text] of [["edit", "编辑"], item.paused ? ["resume", "启用"] : ["pause", "停用"]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-ghost settings-button";
        button.dataset.setting = id;
        button.dataset.command = command;
        button.textContent = text;
        button.setAttribute("aria-label", `${text}${item.name}`);
        row.append(button);
      }
      return row;
    }));
    if (active?.setting) {
      const row = `[data-setting="${active.setting}"]`;
      const next = supplementSettings.querySelector(`${row}[data-command="${active.command}"]`) ??
        supplementSettings.querySelector(`${row}:last-child`);
      next?.focus({ preventScroll: true });
    }
  }

  function fillSupplementEditor(id) {
    const item = store.supplements[id];
    editingSupplement = item ? { id, name: item.name, mode: item.mode } : undefined;
    const name = supplementForm.elements.name;
    name.value = item?.name ?? "";
    name.setCustomValidity("");
    supplementForm.elements.period.value = item?.mode ?? mode;
    byId("save-supplement").textContent = item ? "保存修改" : "添加补品";
    byId("cancel-supplement-edit").hidden = !item;
    byId("supplement-feedback").textContent = "";
  }

  function writeSupplement(id, item) {
    store.supplements[id] = item;
    return persist(`supplement-settings/${id}`, JSON.stringify(item));
  }

  function renderNote(refresh) {
    const visible = mode === "morning" && (
      Object.values(Ritual.getActions(store, day, mode)).some(entry => entry.status === "done") ||
      Object.values(Ritual.supplementChecks(store, day)).includes(mode)
    );
    noteDetails.hidden = !visible;
    const previousNight = Ritual.offsetDay(day, -1);
    if (!visible || (noteContext === previousNight && !refresh)) return;
    if (noteContext !== previousNight) noteDetails.open = false;
    noteContext = previousNight;
    setDate(byId("note-date"), previousNight, shortDate);
    const note = store.days[previousNight]?.note;
    noteBaseline = { lightsOut: note?.lightsOut ?? "", snack: note?.snack ?? "" };
    noteForm.elements.lightsOut.value = noteBaseline.lightsOut;
    for (const option of noteForm.elements.snack) option.checked = option.value === noteBaseline.snack;
    byId("note-feedback").textContent = "";
  }

  function renderRecentNotes() {
    const notes = Ritual.weekEnding(store, day).filter(date => date.note).reverse();
    byId("week-notes").hidden = notes.length === 0;
    byId("week-note-list").replaceChildren(...notes.map(date => {
      const row = document.createElement("li");
      const label = document.createElement("time");
      const info = document.createElement("span");
      setDate(label, date.day, shortDate);
      const parts = [];
      if (date.note.lightsOut) parts.push(`${date.note.lightsOut} 关灯`);
      if (date.note.snack) parts.push(date.note.snack === "yes" ? "吃了夜宵" : "没有吃夜宵");
      info.textContent = parts.join(" · ");
      row.append(label, info);
      return row;
    }));
  }

  function writeHabits(items) {
    store.habits ??= {};
    store.habits[mode] = items;
    persist(`habit-settings/${mode}`, JSON.stringify(items));
    selected = undefined;
    render();
  }

  function renderHabitSettings() {
    byId("habit-period-label").textContent = mode === "morning" ? "早晨的顺序" : "晚上的顺序";
    const items = Ritual.getSteps(store, mode, true);
    const focused = document.activeElement?.closest("[data-habit-command]");
    const focusId = focused?.dataset.habit;
    const focusCommand = focused?.dataset.habitCommand;
    byId("habit-settings").replaceChildren(...items.map((item, index) => {
      const row = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = `${index + 1}. ${item.title}${item.paused ? " · 已停用" : ""}`;
      row.append(label);
      for (const [command, text] of [["up", "上移"], ["down", "下移"], ["toggle", item.paused ? "启用" : "停用"]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-ghost settings-button";
        button.dataset.habit = item.id;
        button.dataset.habitCommand = command;
        button.textContent = text;
        button.setAttribute("aria-label", `${text}${item.title}`);
        button.disabled = command === "up" && index === 0 || command === "down" && index === items.length - 1;
        row.append(button);
      }
      return row;
    }));
    if (focusId) {
      const buttons = [...byId("habit-settings").querySelectorAll("button")];
      const same = buttons.find(button => button.dataset.habit === focusId && button.dataset.habitCommand === focusCommand && !button.disabled);
      (same ?? buttons.find(button => button.dataset.habit === focusId && !button.disabled))?.focus();
    }
  }

  function showView(focus = false) {
    const showHistory = location.hash === "#footprints";
    if (focus && showHistory === !historyView.hidden) return;
    clearCompletion();
    if (showHistory) {
      birdDetails.open = false;
      actionOptions.open = false;
      for (const dialog of [habitDialog, supplementDialog, breathDialog]) {
        if (dialog.open) dialog.close();
      }
    }
    const homeLink = byId("open-today");
    const historyLink = byId("open-history");
    byId("daily-view").hidden = showHistory;
    historyView.hidden = !showHistory;
    historyLink.hidden = showHistory;
    homeLink.hidden = !showHistory;
    document.title = showHistory ? "习惯足迹 · 早晚打卡" : "早晚打卡";
    if (showHistory) renderHeatmap();
    else if (focus) renderAction();
    if (focus) {
      window.scrollTo(0, 0);
      (showHistory ? byId("heatmap-title") : historyLink).focus({ preventScroll: true });
    }
  }

  function historyItems() {
    const records = Object.values(store.days);
    const items = [...Ritual.getSteps(store, mode, true),
      ...Object.entries(store.supplements).filter(([id, item]) => item.mode === mode || records.some(record => record.supplementChecks?.[id] === mode))
        .map(([id, item]) => ({ id: `supplement-${id}`, title: `补品 · ${item.name}`, paused: item.paused }))];
    if (!Object.keys(store.supplements).length || records.some(record => record[mode]?.supplement)) {
      items.push({ id: "supplement", title: "补品（整组记录）" });
    }
    return items;
  }

  function calendarGrid(cells, item) {
    const grid = document.createElement("div");
    grid.className = "heatmap-grid";
    const firstWeekday = asDate(cells[0].day).getDay();
    const offset = historyRange === "week" ? 0 : (firstWeekday + 6) % 7;
    for (let column = 0; column < 7; column++) {
      const heading = document.createElement("span");
      heading.className = "calendar-weekday";
      heading.textContent = "日一二三四五六"[(firstWeekday - offset + column + 7) % 7];
      grid.append(heading);
    }
    cells.forEach((cell, index) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = cellClass(cell);
      tile.dataset.day = cell.day;
      tile.disabled = cell.future;
      if (index === 0) tile.style.gridColumnStart = offset + 1;
      const state = cell.future ? "未来" : cell.done ? "已完成" : "未记录";
      const label = `${cell.day} · ${item.title} · ${state}`;
      tile.setAttribute("aria-label", label);
      tile.setAttribute("aria-pressed", String(historyDay === cell.day));
      if (historyDay === cell.day) historyDetail.textContent = label;
      if (cell.day === day) tile.setAttribute("aria-current", "date");
      const number = document.createElement("span");
      number.className = "date-number";
      number.textContent = Number(cell.day.slice(8));
      tile.append(number);
      grid.append(tile);
    });
    return grid;
  }

  function cellClass(cell) {
    return cell.future ? "heat-cell future" : cell.done ? "heat-cell done" : "heat-cell";
  }

  function yearCalendar(cells, base) {
    const year = document.createElement("div");
    year.className = "year-calendar";
    const axis = document.createElement("div");
    axis.className = "year-axis";
    axis.setAttribute("aria-hidden", "true");
    for (const date of [1, 5, 10, 15, 20, 25, 31]) {
      const tick = document.createElement("span");
      tick.style.gridColumn = date + 1;
      tick.textContent = date;
      axis.append(tick);
    }
    year.append(axis);
    const months = Array.from({ length: 12 }, () => []);
    for (const cell of cells) months[Number(cell.day.slice(5, 7)) - 1].push(cell);
    months.forEach((monthCells, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mini-month";
      button.dataset.monthOffset = historyOffset * 12 + index - base.getMonth();
      button.disabled = monthCells[0].future;
      if (monthCells[0].day.slice(0, 7) === day.slice(0, 7)) button.setAttribute("aria-current", "date");
      const label = document.createElement("span");
      label.className = "month-heading";
      label.textContent = `${index + 1}月`;
      const done = monthCells.filter(cell => cell.done).length;
      button.setAttribute("aria-label", `${label.textContent}，${button.disabled ? "未来" : "已记 " + done + " 天，查看月历"}`);
      button.append(label);
      for (const cell of monthCells) {
        const dot = document.createElement("span");
        dot.className = cellClass(cell);
        dot.setAttribute("aria-hidden", "true");
        button.append(dot);
      }
      year.append(button);
    });
    return year;
  }

  function renderHeatmap() {
    const base = asDate(day);
    let end = day;
    let caption;
    if (historyRange === "week") {
      end = Ritual.offsetDay(day, historyOffset * 7);
      caption = `${shortDate.format(asDate(Ritual.offsetDay(end, -6)))} — ${shortDate.format(asDate(end))} · ${asDate(end).getFullYear()}`;
    } else {
      const target = historyRange === "year" ? new Date(base.getFullYear() + historyOffset, 0, 1, 12) : new Date(base.getFullYear(), base.getMonth() + historyOffset, 1, 12);
      const last = historyRange === "year" ? new Date(target.getFullYear(), 11, 31, 12) : new Date(target.getFullYear(), target.getMonth() + 1, 0, 12);
      end = historyOffset === 0 ? day : Ritual.activeDay("morning", last);
      caption = historyRange === "year" ? `${target.getFullYear()} 年` : `${target.getFullYear()} 年 ${target.getMonth() + 1} 月`;
    }
    byId("history-period").textContent = caption;
    byId("history-next").disabled = historyOffset === 0;
    for (const button of document.querySelectorAll("[data-range]")) button.setAttribute("aria-pressed", String(button.dataset.range === historyRange));
    const items = historyItems();
    const item = items.find(item => item.id === historyHabit.value) ?? items[0];
    historyHabit.replaceChildren(...items.map(({ id, title, paused }) => new Option(`${title}${paused ? "（已停用）" : ""}`, id)));
    historyHabit.disabled = !item;
    historyDetail.textContent = "";
    const total = byId("heatmap-total");
    const consistency = byId("habit-consistency");
    if (!item) {
      total.textContent = "暂无习惯记录";
      consistency.textContent = "";
      historyGrid.replaceChildren();
      return;
    }
    historyHabit.value = item.id;
    const recent = Ritual.recentHabitDays(store, mode, item.id, end);
    const windowLabel = historyOffset ? `截至 ${shortDate.format(asDate(end))} 的 28 天` : "近 28 天";
    consistency.textContent = `${windowLabel}已记 ${recent} 天`;
    const cells = Ritual.heatmap(store, mode, item.id, end, historyRange);
    const count = document.createElement("strong");
    count.textContent = cells.filter(cell => cell.done).length;
    total.replaceChildren("已记 ", count, " 天");
    const focused = historyGrid.contains(document.activeElement) ? document.activeElement.dataset : null;
    historyGrid.replaceChildren(historyRange === "year" ? yearCalendar(cells, base) : calendarGrid(cells, item));
    if (focused?.day) historyGrid.querySelector(`[data-day="${focused.day}"]`)?.focus({ preventScroll: true });
    else if (focused?.monthOffset !== undefined) historyGrid.querySelector(`[data-month-offset="${focused.monthOffset}"]`)?.focus({ preventScroll: true });
  }

  byId("manage-habits").addEventListener("click", () => {
    load(); renderHabitSettings(); byId("habit-feedback").textContent = ""; habitDialog.showModal();
  });
  byId("habit-settings").addEventListener("click", event => {
    const button = event.target.closest("button[data-habit-command]");
    if (!button) return;
    load();
    const items = Ritual.getSteps(store, mode, true).map(item => ({ ...item }));
    const index = items.findIndex(item => item.id === button.dataset.habit);
    if (index < 0) return;
    const command = button.dataset.habitCommand;
    if (command === "toggle") items[index].paused = !items[index].paused;
    else {
      const other = index + (command === "up" ? -1 : 1);
      if (other < 0 || other >= items.length) return;
      [items[index], items[other]] = [items[other], items[index]];
    }
    writeHabits(items);
    byId("habit-feedback").textContent = canPersist ? "安排已保存" : "当前页面已更新，未保存";
  });
  byId("habit-form").addEventListener("input", () => { byId("habit-name").setCustomValidity(""); byId("habit-name").removeAttribute("aria-invalid"); });
  byId("habit-form").addEventListener("submit", event => {
    event.preventDefault(); load();
    const input = byId("habit-name");
    const name = input.value.trim();
    const items = Ritual.getSteps(store, mode, true);
    if (!name || name.length > 40 || items.length >= 100 || items.some(item => item.title.normalize("NFKC").toLowerCase() === name.normalize("NFKC").toLowerCase())) {
      input.setCustomValidity(items.length >= 100 ? "当前时段最多添加 100 项。" : "请输入不重复的习惯名称（1–40 字）。"); input.setAttribute("aria-invalid", "true"); input.reportValidity(); return;
    }
    const id = "custom-" + Array.from(crypto.getRandomValues(new Uint32Array(3)), part => part.toString(16).padStart(8, "0")).join("");
    writeHabits([...items, { id, title: name, label: name }]);
    input.value = "";
    byId("habit-feedback").textContent = canPersist ? "习惯已添加" : "当前页面已更新，未保存";
    input.focus();
  });
  function changeHistory(range, offset) {
    historyRange = range;
    historyOffset = offset;
    historyDay = undefined;
    renderHeatmap();
  }

  window.addEventListener("hashchange", () => showView(true));
  for (const button of document.querySelectorAll("[data-range]")) button.addEventListener("click", () => {
    if (historyRange !== button.dataset.range) changeHistory(button.dataset.range, 0);
  });
  historyHabit.addEventListener("change", () => changeHistory(historyRange, historyOffset));
  byId("history-previous").addEventListener("click", () => changeHistory(historyRange, historyOffset - 1));
  byId("history-next").addEventListener("click", () => {
    if (historyOffset < 0) changeHistory(historyRange, historyOffset + 1);
    if (historyOffset === 0) byId("history-period").focus();
  });
  historyGrid.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.monthOffset !== undefined) {
      changeHistory("month", Number(button.dataset.monthOffset));
      byId("history-period").focus();
      return;
    }
    historyGrid.querySelector('[aria-pressed="true"]')?.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-pressed", "true");
    historyDay = button.dataset.day;
    historyDetail.textContent = button.getAttribute("aria-label");
  });

  function syncDay() {
    const now = new Date();
    const currentBand = Ritual.defaultMode(now);
    const updatedMode = currentBand === timeBand ? mode : currentBand;
    const updatedDay = Ritual.activeDay(updatedMode, now);
    if (mode === "morning" && updatedMode !== mode && updatedDay === day && noteDetails.open &&
        !noteDetails.hidden && Object.keys(noteBaseline).some(field => noteForm.elements[field].value !== noteBaseline[field])) {
      return false;
    }
    timeBand = currentBand;
    if (updatedDay === day && mode === updatedMode) return false;
    clearCompletion();
    historyDay = undefined;
    mode = updatedMode;
    day = updatedDay;
    selected = undefined;
    lastSkip = undefined;
    noteContext = undefined;
    actionOptions.open = false;
    if (breathDialog.open) breathDialog.close();
    render({ refreshNote: true });
    revealAction(mode === "morning" ? -1 : 1);
    return true;
  }

  function tickBreathing() {
    const elapsed = performance.now() - breathStart;
    const seconds = Math.max(0, 60 - Math.floor(elapsed / 1000));
    const phase = seconds === 0 ? "完成" : elapsed % 10000 < 4000 ? "吸气" : "呼气";
    byId("breath-remaining").textContent = seconds ? `剩余 ${seconds} 秒` : "已练习一分钟，可以回去打卡。";
    if (byId("breath-instruction").textContent !== phase) {
      byId("breath-display").textContent = phase;
      byId("breath-instruction").textContent = phase;
      byId("breath-ring").dataset.phase = phase;
    }
    if (!seconds) {
      clearInterval(breathTimer);
      breathDialog.querySelector("button").textContent = "返回打卡";
    }
  }

  function startBreathing() {
    breathDialog.showModal();
    breathStart = performance.now();
    byId("breath-ring").dataset.phase = "静止";
    byId("breath-instruction").textContent = "";
    breathDialog.querySelector("button").textContent = "结束练习";
    tickBreathing();
    breathTimer = setInterval(tickBreathing, 100);
  }

  for (const button of modeOptions) {
    button.addEventListener("click", () => {
      if (mode === button.dataset.modeOption) return;
      clearCompletion();
      historyDay = undefined;
      mode = button.dataset.modeOption;
      day = Ritual.activeDay(mode, new Date());
      selected = undefined;
      lastSkip = undefined;
      actionOptions.open = false;
      noteDetails.open = false;
      render({ refreshNote: true });
      revealAction(mode === "morning" ? -1 : 1);
    });
  }

  complete.addEventListener("keydown", event => {
    if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();
  });

  complete.addEventListener("click", event => {
    if (syncDay() || completion || event.detail > 1) return;
    const step = getStep();
    if (step.id === "finished") return;
    const done = complete.getAttribute("aria-pressed") === "true";
    const wasFocused = document.activeElement === complete;
    const updated = updateAction(step.id, done ? undefined : "done", done ? "done" : undefined);
    lastSkip = undefined;
    actionOptions.open = false;
    if (updated && !done && motionPreference.matches) {
      completion = { id: step.id, timer: setTimeout(advanceAfterCompletion, 1350) };
    } else selected = done ? step.id : Ritual.nextAction(store, mode, Ritual.getActions(store, day, mode), step.id);
    render();
    if (completion) confirmAction();
    else if (updated && !done) {
      clearTimeout(grainTimer);
      scene.dataset.instantGrain = step.id;
      grainTimer = setTimeout(() => { delete scene.dataset.instantGrain; }, 1350);
      revealAction();
      if (wasFocused && complete.hidden) focusAction();
    }
    if (updated && done) revealAction(-1);
    announce(!updated ? "记录已在另一处更新" : done ? "已撤销完成" : `${step.label}已完成，已喂一粒谷物。`);
  });

  startBreath.addEventListener("click", () => {
    if (!syncDay()) startBreathing();
  });

  skip.addEventListener("click", () => {
    if (syncDay()) return;
    const step = getStep();
    updateAction(step.id, "skipped");
    lastSkip = step.id;
    selected = Ritual.nextAction(store, mode, Ritual.getActions(store, day, mode), step.id);
    actionOptions.open = false;
    render();
    revealAction();
    announce(`已跳过${step.label}`);
    focusAction();
  });

  undoSkip.addEventListener("click", () => {
    if (syncDay() || !lastSkip) return;
    const id = lastSkip;
    const updated = updateAction(id, undefined, "skipped");
    selected = id;
    lastSkip = undefined;
    actionOptions.open = false;
    render();
    revealAction(-1);
    announce(updated ? "已撤销跳过" : "记录已在另一处更新");
    focusAction();
  });

  const disclosures = [actionOptions, birdDetails];
  document.addEventListener("pointerdown", event => {
    for (const panel of disclosures) {
      if (panel.open && !panel.contains(event.target)) panel.open = false;
    }
  });
  for (const panel of disclosures) {
    panel.addEventListener("keydown", event => {
      if (event.key === "Escape" && panel.open) {
        panel.open = false;
        panel.querySelector("summary").focus();
      }
    });
    panel.addEventListener("focusout", event => {
      if (event.relatedTarget && !panel.contains(event.relatedTarget)) panel.open = false;
    });
  }

  byId("routine-actions").addEventListener("click", event => {
    const button = event.target.closest("button[data-step]");
    if (!button || syncDay()) return;
    clearCompletion();
    selected = button.dataset.step;
    actionOptions.open = false;
    renderAction();
    revealAction();
    focusAction(true);
  });

  supplementPanel.addEventListener("toggle", () => {
    if (supplementPanel.open) {
      animateUI(supplementPanel.querySelector(".supplement-content"), {
        opacity: [0.2, 1], transform: ["translateY(-12px)", "translateY(0px)"]
      }, { duration: 0.42, ease: "easeOut" });
    }
  });

  supplementItems.addEventListener("click", event => {
    const button = event.target.closest("button[data-supplement-check]");
    if (!button || syncDay()) return;
    const id = button.dataset.supplementCheck;
    const checked = button.getAttribute("aria-pressed") === "true";
    if (id === "legacy") {
      updateAction("supplement", checked ? undefined : "done", checked ? "done" : undefined);
    } else {
      load();
      const item = store.supplements[id];
      const prior = Ritual.supplementChecks(store, day)[id];
      if (item && !item.paused && item.mode === mode && Boolean(prior) === checked) {
        Ritual.setSupplementCheck(store, day, id, checked ? undefined : mode);
        persist(`${day}/supplement-check/${id}`, checked ? "" : mode);
      }
    }
    render();
    const updatedItem = supplementItems.querySelector(`[data-supplement-check="${id}"]`);
    if (updatedItem?.getAttribute("aria-pressed") !== String(checked) && updatedItem) {
      animateUI(updatedItem, { transform: ["translateX(-5px)", "translateX(0px)"] }, { type: "spring", visualDuration: 0.36, bounce: 0.3 });
      animateUI(byId("supplement-count"), { transform: ["scale(.82)", "scale(1)"] }, { type: "spring", visualDuration: 0.38, bounce: 0.33 });
    }
  });

  byId("manage-supplements").addEventListener("click", () => {
    load();
    fillSupplementEditor();
    renderSupplementSettings();
    supplementDialog.showModal();
  });

  supplementSettings.addEventListener("click", event => {
    const button = event.target.closest("button[data-setting]");
    if (!button) return;
    load();
    const id = button.dataset.setting;
    const item = store.supplements[id];
    if (!item) return;
    if (button.dataset.command === "edit") {
      fillSupplementEditor(id);
      supplementForm.elements.name.focus();
    } else {
      const paused = button.dataset.command === "pause";
      const saved = item.paused === paused || writeSupplement(id, { ...item, paused });
      byId("supplement-feedback").textContent = saved ? (paused ? "已停用" : "已启用") : "当前页面已更新";
      render();
    }
  });

  byId("cancel-supplement-edit").addEventListener("click", () => {
    fillSupplementEditor();
    supplementForm.elements.name.focus();
  });

  supplementForm.addEventListener("input", () => supplementForm.elements.name.setCustomValidity(""));
  supplementForm.addEventListener("submit", event => {
    event.preventDefault();
    load();
    const nameField = supplementForm.elements.name;
    const enteredName = nameField.value.trim();
    const enteredMode = supplementForm.elements.period.value;
    const previous = editingSupplement ? store.supplements[editingSupplement.id] : undefined;
    const name = previous && enteredName === editingSupplement.name ? previous.name : enteredName;
    const period = previous && enteredMode === editingSupplement.mode ? previous.mode : enteredMode;
    const nameKey = value => value.normalize("NFKC").toLowerCase();
    const duplicate = Object.entries(store.supplements).some(([id, item]) =>
      id !== editingSupplement?.id && item.mode === period && nameKey(item.name) === nameKey(name)
    );
    if (!name || name.length > 40 || duplicate) {
      nameField.setCustomValidity(duplicate ? "这个时段已经有同名补品。" : "请输入 1 到 40 个字符。");
      nameField.reportValidity();
      return;
    }
    const id = editingSupplement?.id ?? Array.from(crypto.getRandomValues(new Uint32Array(3)), part => part.toString(16).padStart(8, "0")).join("");
    const saved = writeSupplement(id, { name, mode: period, paused: previous?.paused ?? false });
    const changed = Boolean(editingSupplement);
    fillSupplementEditor();
    byId("supplement-feedback").textContent = saved ? (changed ? "已保存修改" : "已添加") : "当前页面已更新";
    render();
    nameField.focus();
  });

  noteForm.addEventListener("submit", event => {
    event.preventDefault();
    if (syncDay()) return;
    if (!noteContext || noteDetails.hidden) return;
    load();
    for (const field of Object.keys(noteBaseline)) {
      const value = noteForm.elements[field].value;
      if (value === noteBaseline[field]) continue;
      Ritual.saveNote(store, noteContext, field, value);
      persist(`${noteContext}/note/${field}`, value);
    }
    renderNote(true);
    byId("note-feedback").textContent = canPersist ? "已保存" : "当前页面已更新";
    renderRecentNotes();
  });

  breathDialog.addEventListener("close", () => clearInterval(breathTimer));
  motionPreference.addEventListener("change", () => {
    if (motionPreference.matches) return;
    for (const player of moving.values()) player.complete();
    moving.clear();
    advanceAfterCompletion();
  });
  window.addEventListener("storage", event => {
    if (event.key === null || event.key.startsWith(storagePrefix)) {
      load();
      render({ refreshNote: !noteDetails.open });
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncDay();
  });
  setInterval(syncDay, 15000);

  load();
  render();
  showView();
})();
